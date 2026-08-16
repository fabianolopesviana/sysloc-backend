# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: Contratos de locação — montagem, ativação e cancelamento
- **Variante**: backend
- **Stack**: Node 24 LTS · TypeScript strict · NestJS + Fastify · Drizzle + drizzle-kit + postgres.js · PostgreSQL 18 · Zod · better-auth · Vitest + `embedded-postgres` · pnpm + Turborepo + Biome
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-08
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/contratos-de-locacao/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/contratos-de-locacao/v1/tech-alignment.md`
- **Pré-refinamento**: `docs/specs/features/contratos-de-locacao/v1/pre-refinement.md`
- **Fatia irmã (molde)**: `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/`
- **Oráculo das regras portadas**: `docs/specs/features/caracterizacao-regras-legadas/v1/`

---

## 2. Resumo Técnico da Solução

A fatia acrescenta ao schema `negocio` duas tabelas — `contrato` e `contrato_fiador` — no molde já provado da fatia anterior (`empresa_id`, RLS **forçada**, chave estrangeira composta, restrição única sobre o par), e com elas as **duas propriedades que nenhuma entidade existente tem**: ciclo de vida governado e série declarada. O ciclo de vida é uma máquina de quatro estados cujas transições são **rotas próprias governadas por ação sensível** (ADR-0019), nunca campo em atualização de recurso. A série é emitida por **sequência do próprio banco, uma por `(empresa, ano)`**, consumida através de duas funções `SECURITY DEFINER` cujo `EXECUTE` é a única concessão nova ao papel da aplicação (ADR-0020) — o avanço não participa do desfazimento, e é isso que torna o não-reuso propriedade do mecanismo em vez de promessa.

Três invariantes nascem aqui e são **estruturais, não conferidos**: a dupla locação é impedida por **índice único parcial** condicionado a `status = 'ATIVO'`; o cruzamento entre empresas é impedido pelas chaves estrangeiras compostas; e o número da série é impedido de voltar pela própria natureza da sequência. As duas regras portadas do sistema antigo — ativação e cancelamento — têm o **núcleo aritmético isolado em funções puras**, provadas caso a caso contra golden capturado do `/opt/frappe`, enquanto validações e efeitos continuam provados pela rota, com banco real.

A superfície cresce **9 rotas**: oito sob `TELA:contratos` e uma sobre `/v1/imoveis` — a de situação de locação, que a §4.1.2 registra e que fecha um furo herdado da fatia anterior. Nenhuma chave nova é criada no catálogo fechado, e o contrato de tipos ganha o esquema do contrato — interno nesta fase, publicado só no marco de entrega.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

Quatro camadas, na direção que a fatia anterior fixou e que esta não altera:

```
                       HTTP  /v1/contratos/*
                             │
   ┌─────────────────────────▼──────────────────────────────────────────┐
   │ apps/api/src/contratos/contrato.controller.ts                      │
   │  · declara a exigência (área, e a conjunção nas 4 rotas sensíveis) │
   │  · valida e canoniza :codigo e o corpo (esquemas de @sysloc/       │
   │    contracts, nunca redigitados)                                   │
   │  · ABRE A UNIDADE DE TRABALHO (sobContextoDaSessao)                │
   └─────────────────────────┬──────────────────────────────────────────┘
                             │ tx (executor)
   ┌─────────────────────────▼──────────────────────────────────────────┐
   │ apps/api/src/contratos/contrato.service.ts                         │
   │  · orquestra; NÃO escreve SQL e NÃO compara empresa                │
   │  · confere alcance e circulação dos cadastros referenciados        │
   │  · aplica a máquina de estados e traduz recusa no envelope 0017    │
   └────────┬──────────────────────────────┬────────────────────────────┘
            │                              │
   ┌────────▼─────────────────┐   ┌────────▼──────────────────────────┐
   │ packages/db/src/         │   │ packages/db/src/                  │
   │   contrato.ts            │   │   derivacao-de-contrato.ts        │
   │  · porta ÚNICA de SQL    │   │  · funções PURAS, sem banco       │
   │  · emissão do número     │   │  · término da locação             │
   │  · leitura em lote do    │   │  · valor total (centavos inteiros)│
   │    contrato vigente      │   │  · provadas contra o GOLDEN       │
   └────────┬─────────────────┘   └───────────────────────────────────┘
            │
   ┌────────▼─────────────────────────────────────────────────────────┐
   │ PostgreSQL — negocio.contrato · negocio.contrato_fiador           │
   │  · RLS FORÇADA + política USING/WITH CHECK                        │
   │  · FK composta (id_alheio, empresa_id)                            │
   │  · índice único PARCIAL de vigência                               │
   │  · sequência por (empresa, ano) + 2 funções SECURITY DEFINER      │
   └───────────────────────────────────────────────────────────────────┘
```

Fora do processo, e igualmente parte da entrega:

```
   /opt/frappe (site EFÊMERO)  ──capturar.py──▶  golden/contrato-ativacao.json
                                                 golden/contrato-cancelamento.json
                                                          │
                                          consumidos por  ▼
                              packages/db/test/derivacao-de-contrato.spec.ts
                              deploy/scripts/caracterizacao/verificar-golden.sh
```

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `ContratoController` | Declara exigência, valida e canoniza entrada, abre a unidade de trabalho, emite a linha de trilha | Apresentação |
| `ContratoService` | Máquina de estados, conferência de alcance e circulação, tradução das recusas no envelope da ADR-0017 | Aplicação |
| `packages/db/src/contrato.ts` | Porta única de SQL sobre `negocio.contrato` e `negocio.contrato_fiador`; emissão do número; leitura em lote do contrato vigente | Dados |
| `packages/db/src/derivacao-de-contrato.ts` | Término da locação e valor total — funções **puras**, sem dependência de banco | Domínio (puro) |
| `packages/contracts/src/contrato.ts` | Fonte única do contrato de API do recurso: esquemas de entrada, de saída, enum de estado, formato do código legível | Contrato |
| `negocio.garantir_contador_de_contrato` | Cria a sequência do escopo `(empresa, ano)`, idempotente, tolerante a corrida | Banco (`SECURITY DEFINER`) |
| `negocio.proximo_numero_de_contrato` | Consome a sequência do escopo corrente. Não aceita empresa por parâmetro | Banco (`SECURITY DEFINER`) |
| `capturar.py` (estendido) | Captura o comportamento do sistema antigo para as duas regras portadas, em site efêmero | Oráculo |

### 3.3 Camadas e Fronteiras

O estilo é o que a fatia anterior estabeleceu, e ele **não é renegociado aqui**:

1. **A unidade de trabalho abre na borda.** O controlador chama `sobContextoDaSessao`; o serviço **recebe** o executor e nunca chama `emUnidadeDeTrabalho`. É o que permite gravar contrato, fiadores e a situação do imóvel num commit só sem tocar o marcador `DECISÃO FECHADA` que recusa aninhamento em `packages/db/src/unidade-de-trabalho.ts`.
   - **Exceção declarada, e única**: a criação de contrato abre **duas unidades sequenciais** — a primeira só garante a existência do contador e commita; a segunda cria o contrato. Elas **não aninham** (a segunda começa depois de a primeira fechar), de modo que o marcador continua satisfeito. A razão está em §7.4.
2. **Toda instrução SQL vive na porta de dados**, publicada como função de domínio. A contenção de `apps/api` é de **tipo** e não alcança texto de SQL: um serviço com o executor em mãos escreveria `negocio.contrato` numa cadeia sem importar nada de proibido, e o alcance deixaria de ser enumerável.
3. **O contrato é folha.** `@sysloc/contracts` não depende de `@sysloc/db` nem de `apps/api`; a direção é sempre para ele. Os enums do banco derivam dos literais publicados lá, nunca o contrário (ADR-0016).
4. **Nenhum filtro por empresa é escrito na aplicação** (ADR-0008). O recorte é da política; a escrita apenas **propõe** `empresa_id` via `empresaDoContexto`, que é a transcrição literal da expressão da política.

### 3.4 Visão em Árvore

```
apps/
└── api/
    ├── src/
    │   ├── app.module.ts                                    [M]
    │   ├── comum/
    │   │   ├── contexto-da-sessao.ts                        [R]
    │   │   ├── esquema-de-erro.ts                           [R]
    │   │   ├── esquema-publicado.ts                         [R]
    │   │   └── validacao.ts                                 [R]
    │   ├── autenticacao/
    │   │   └── exigencia.decorator.ts                       [R]
    │   ├── imoveis/
    │   │   ├── imovel.controller.ts                         [M]
    │   │   └── imovel.service.ts                            [M]
    │   └── contratos/
    │       ├── contrato.controller.ts                       [N]
    │       ├── contrato.service.ts                          [N]
    │       └── contratos.module.ts                          [N]
    └── test/
        ├── contratos.e2e.spec.ts                            [N]
        ├── cobertura-de-autorizacao.e2e.spec.ts             [M]
        ├── autorizacao-do-dominio.e2e.spec.ts               [M]
        ├── contrato-publicado.e2e.spec.ts                   [M]
        ├── cadastro-de-imoveis.e2e.spec.ts                  [M]
        ├── carteira.e2e.spec.ts                             [M]
        └── circulacao-de-cadastro.e2e.spec.ts               [M]

packages/
├── contracts/
│   ├── src/
│   │   ├── contrato.ts                                      [N]
│   │   ├── imovel.ts                                        [M]
│   │   ├── comum.ts                                         [R]
│   │   └── index.ts                                         [M]
│   └── test/
│       ├── esquemas.spec.ts                                 [M]
│       └── folha.spec.ts                                    [R]
├── db/
│   ├── migracoes/
│   │   ├── 0006_seguranca_dominio.sql                       [R]
│   │   ├── 0007_dominio_contrato.sql                        [N]
│   │   └── 0008_seguranca_contrato.sql                      [N]
│   ├── src/
│   │   ├── esquema/negocio.ts                               [M]
│   │   ├── contrato.ts                                      [N]
│   │   ├── derivacao-de-contrato.ts                         [N]
│   │   ├── imovel.ts                                        [M]
│   │   ├── contexto-de-escrita.ts                           [R]
│   │   ├── catalogo.ts                                      [R]
│   │   └── index.ts                                         [M]
│   └── test/
│       ├── contrato.spec.ts                                 [N]
│       ├── derivacao-de-contrato.spec.ts                    [N]
│       ├── banco-efemero.ts                                 [R]
│       ├── isolamento.spec.ts                               [M]
│       ├── circulacao.spec.ts                               [M]
│       ├── janela.spec.ts                                   [M]
│       ├── papel-de-conexao.spec.ts                         [M]
│       └── catalogo.spec.ts                                 [M]
└── auth/
    └── src/catalogo-de-permissoes.ts                        [R]

deploy/
└── scripts/
    └── caracterizacao/
        ├── capturar.py                                       [M]
        ├── preparar-site-efemero.sh                          [R]
        ├── verificar-captura.sh                              [M]
        └── verificar-golden.sh                               [M]

docs/
└── specs/features/caracterizacao-regras-legadas/v1/golden/
    ├── contrato-ativacao.json                                [N]
    ├── contrato-cancelamento.json                            [N]
    └── PROCEDENCIA.md                                        [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `packages/contracts/src/contrato.ts` | Enum de estado, formato do código legível (constantes + formatador + esquema derivado delas), corpo de criação/alteração, recurso publicado, resposta de ativação | Contrato |
| `packages/db/migracoes/0007_dominio_contrato.sql` | **Gerada** pelo drizzle-kit: enum `status_contrato`, tabelas `contrato` e `contrato_fiador`, restrições, índices e o índice único parcial de vigência | Dados |
| `packages/db/migracoes/0008_seguranca_contrato.sql` | **Autoral**: `FORCE ROW LEVEL SECURITY`, as duas políticas, as duas funções `SECURITY DEFINER` e os `GRANT EXECUTE` | Dados |
| `packages/db/src/contrato.ts` | Porta única de SQL das duas tabelas; emissão do número; leitura em lote do contrato vigente por imóvel; tradução das violações de unicidade | Dados |
| `packages/db/src/derivacao-de-contrato.ts` | `derivarTerminoDaLocacao` e `derivarValorTotal` — funções puras | Domínio |
| `apps/api/src/contratos/contrato.controller.ts` | As 8 rotas, com exigência declarada e unidade aberta na borda | Apresentação |
| `apps/api/src/contratos/contrato.service.ts` | Máquina de estados, conferências de alcance e circulação, tradução das recusas | Aplicação |
| `apps/api/src/contratos/contratos.module.ts` | Composição do módulo | Apresentação |
| `docs/.../golden/contrato-ativacao.json` | Oráculo da regra de ativação, capturado do sistema antigo | Oráculo |
| `docs/.../golden/contrato-cancelamento.json` | Oráculo da regra de cancelamento | Oráculo |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `packages/db/src/esquema/negocio.ts` | Acrescenta o enum `statusContrato` e as tabelas `contrato` e `contratoFiador`; atualiza o cabeçalho (a lista de migrações de segurança passa a citar a `0008`, e o bloco da ADR-0015 deixa de dizer que *nenhuma* entidade tem contador) | As duas entidades novas da fatia |
| `packages/db/src/imovel.ts` | Nova porta estreita `definirSituacaoDeLocacaoDoImovel`; o agregado passa a carregar `contratoVigente` por leitura em lote; **`alterarImovel` deixa de tocar `status_locacao`** (§4.1.2) | RN-11, RN-17 e §4.1.2 |
| `packages/db/src/index.ts` | Publica a porta do contrato, as derivações puras e as classes de erro novas | Superfície do pacote |
| `packages/contracts/src/imovel.ts` | `esquemaDoImovel` ganha `contratoVigente`; nascem `esquemaDeImovelAlterado` (derivado por `omit`) e `esquemaDaSituacaoDeLocacao` | CA-14 · §4.1.2 |
| `apps/api/src/imoveis/imovel.controller.ts` | O `PUT` passa a validar com `esquemaDeImovelAlterado`; nasce `POST /:id/situacao-de-locacao` | §4.1.2 |
| `packages/contracts/src/index.ts` | Publica os símbolos de `contrato.ts` | Superfície do pacote |
| `apps/api/src/imoveis/imovel.service.ts` | `publicar` passa a copiar `contratoVigente` | CA-14 |
| `apps/api/src/app.module.ts` | Registra `ContratosModule` | Composição raiz |
| `deploy/scripts/caracterizacao/capturar.py` | Dois cenários novos, com os dados sintéticos das duas regras | Oráculo |
| `deploy/scripts/caracterizacao/verificar-captura.sh` | Reconhece os dois artefatos novos | Oráculo |
| `deploy/scripts/caracterizacao/verificar-golden.sh` | Lista de artefatos passa de 7 para 9; casos novos de forma e de bijeção | Oráculo |
| `docs/.../golden/PROCEDENCIA.md` | Regerado pela captura, com as máscaras dos cenários novos | Oráculo |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Âncoras de superfície e a lista nomeada de rotas com exigência | 9 rotas novas |
| `apps/api/test/autorizacao-do-dominio.e2e.spec.ts` | Casos das três ações sensíveis sobre as rotas novas | CA-16, CA-17 |
| `apps/api/test/contrato-publicado.e2e.spec.ts` | O documento derivado passa a descrever as rotas e o esquema novos | ADR-0016 |
| `apps/api/test/cadastro-de-imoveis.e2e.spec.ts` · `carteira.e2e.spec.ts` · `circulacao-de-cadastro.e2e.spec.ts` | Corpos de imóvel passam a carregar `contratoVigente` | CA-14 |
| `packages/db/test/isolamento.spec.ts` · `circulacao.spec.ts` · `catalogo.spec.ts` | As duas tabelas novas entram nos conjuntos afirmados | CA-18 |
| `packages/db/test/janela.spec.ts` | `INVOCACOES_DA_CARTEIRA` passa de 10 para 11 | Leitura do contrato vigente |
| `packages/contracts/test/esquemas.spec.ts` | Casos dos esquemas novos | ADR-0016 |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `packages/db/src/conjunto.ts` | Molde da porta com predicado de circulação por padrão e da leitura em lote por nível |
| `packages/db/src/cadastro-de-pessoa.ts` | Molde da tradução de violação de unicidade sob `SAVEPOINT` |
| `packages/db/src/contexto-de-escrita.ts` | `empresaDoContexto` — lar único do fragmento; **importar, nunca redigitar** |
| `packages/db/src/catalogo.ts` | Guarda de cobertura: o que ela cobra e o que ela ignora (sequências) |
| `packages/db/src/unidade-de-trabalho.ts` | O marcador `DECISÃO FECHADA` que recusa aninhamento |
| `packages/db/migracoes/0006_seguranca_dominio.sql` | A expressão **literal** das políticas, a ser transcrita e não reinventada |
| `packages/db/migracoes/0001_seguranca.sql` | O que já é concedido a `sysloc_app` — e o que não é (sequências) |
| `packages/contracts/src/comum.ts` | `ESQUEMA_DO_IDENTIFICADOR`, janela, envelope de lista, tetos |
| `packages/auth/src/catalogo-de-permissoes.ts` | As três chaves de ação que a fatia consome; o catálogo é fechado |
| `apps/api/src/imoveis/imovel.controller.ts` | Molde de controlador de cadastro com rotas de circulação |
| `apps/api/src/comum/validacao.ts` · `esquema-de-erro.ts` · `esquema-publicado.ts` | Importar, nunca copiar (débitos D38 e D40 já fechados) |
| `deploy/scripts/caracterizacao/preparar-site-efemero.sh` | O roteiro de site efêmero que a captura estende |
| `/opt/frappe/app-sync/locacao_automation/locacao_automation/contrato_ativacao/service.py` | Fonte da regra portada de ativação |
| `/opt/frappe/app-sync/locacao_automation/locacao_automation/contrato_cancelamento/service.py` | Fonte da regra portada de cancelamento |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Prefixo `/v1`. Autenticação por **sessão** (`better-auth`, cookie) em todas — a guarda recusa com `401` antes de qualquer exigência de permissão.

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Montar contrato | `POST` | `/v1/contratos` | `esquemaDeContratoNovo` | `esquemaDoContrato` | 201, 401, 403, 404, 422 | `TELA:contratos` |
| Listar carteira de contratos | `GET` | `/v1/contratos` | — (`limite`, `deslocamento`, `incluirRetirados`) | `envelopeDeLista(esquemaDoContrato)` | 200, 401, 403, 422 | `TELA:contratos` |
| Ler contrato | `GET` | `/v1/contratos/:codigo` | — | `esquemaDoContrato` | 200, 401, 403, 404, 422 | `TELA:contratos` |
| Alterar rascunho | `PUT` | `/v1/contratos/:codigo` | `esquemaDeContratoNovo` | `esquemaDoContrato` | 200, 401, 403, 404, 422 | `TELA:contratos` |
| Fazer valer | `POST` | `/v1/contratos/:codigo/ativacao` | `{}` | `esquemaDaAtivacaoDeContrato` | 200, 401, 403, 404, 422 | `TELA:contratos` **+** `ACAO:ativar_contrato` |
| Cancelar | `POST` | `/v1/contratos/:codigo/cancelamento` | `{}` | `esquemaDoContrato` | 200, 401, 403, 404, 422 | `TELA:contratos` **+** `ACAO:cancelar_contrato` |
| Retirar de circulação | `POST` | `/v1/contratos/:codigo/retirada` | `{}` | `esquemaDoContrato` | 200, 401, 403, 404, 422 | `TELA:contratos` **+** `ACAO:excluir_cadastro` |
| Devolver à circulação | `POST` | `/v1/contratos/:codigo/recirculacao` | `{}` | `esquemaDoContrato` | 200, 401, 403, 404, 422 | `TELA:contratos` **+** `ACAO:excluir_cadastro` |
| **Definir a situação do imóvel** | `POST` | `/v1/imoveis/:id/situacao-de-locacao` | `{ statusLocacao }` | `esquemaDoImovel` | 200, 401, 403, 404, 422 | `TELA:imoveis` |

> **A nona rota nasce nesta fatia e é sobre `/v1/imoveis`, não sobre contrato** — ver §4.1.2, que registra o furo que ela fecha e por que ela exige apenas a área.

**Quatro decisões de forma, cada uma com razão que não é estilo:**

1. **A chave exposta é o código legível**, não o UUID. A ADR-0017 é literal: *"a chave exposta é o código textual legível quando a entidade tem uma série declarada para ela — hoje contrato e cobrança"*. O UUID permanece chave interna e **não trafega**: ele não aparece em `esquemaDoContrato`.
2. **As quatro rotas sensíveis declaram a CONJUNÇÃO INTEIRA** (`@ExigeChaves(AREA, ACAO)`), e não só a ação. `getAllAndOverride` faz a declaração do método **substituir** a da classe: declarar só a ação apagaria `TELA:contratos` daquelas rotas, em silêncio, e a cobertura de autorização — que audita existência — continuaria verde. É o defeito medido e explorável que a ADR-0018 fechou, e o `CT-355` o pega por conteúdo.
3. **A ordem da conjunção é conteúdo**: a recusa nomeia a **primeira** ausente. Com a área antes da ação, quem tem a área e não tem a ação recebe o nome da ação — que é o que lhe falta.
4. **Transição é rota própria, nunca campo** (ADR-0019). Não existe `PATCH /v1/contratos/:codigo` com `status` no corpo, e `esquemaDeContratoNovo` **não tem** o campo `status` — o `strictObject` o recusa como chave desconhecida.

**Nomes das rotas de transição**: substantivo do ato (`ativacao`, `cancelamento`), no mesmo molde de `retirada`/`recirculacao` que a fatia anterior fixou. A ADR-0019 registra entre os Neutros que *"o nome e o formato das rotas de transição são decisão da spec"*; esta é a decisão, e ela existe para que a superfície tenha **uma** convenção de sub-recurso de ato.

### 4.1.1 Exemplo de Payload por Endpoint

> **Não há atualização parcial nesta superfície.** O `PUT` carrega o **corpo completo**, exatamente como o `POST`: campo ausente é recusa por campo obrigatório, **nunca** "preserve o valor atual". É a mesma decisão da fatia anterior, e ela vale para os fiadores também — a coleção é **substituída por inteiro**.

```
POST /v1/contratos
Content-Type: application/json

{
  "imovelId": "6f1b0f5a-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
  "locadorId": "1a2b3c4d-5e6f-4708-9a0b-1c2d3e4f5061",
  "locatarioId": "9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a",
  "fiadoresIds": ["3c4d5e6f-7081-4920-a3b4-c5d6e7f80912"],
  "dataInicioLocacao": "2026-01-31",
  "prazoMeses": 12,
  "valorMensal": 2500.00,
  "diaVencimento": 10,
  "gerarCobrancasAutomaticamente": true,
  "pdfContratoArquivo": null
}

201 Created
{
  "codigo": "CTR-2026-00001",
  "status": "RASCUNHO",
  "imovelId": "…", "locadorId": "…", "locatarioId": "…",
  "fiadores": [ { "id": "3c4d5e6f-…", "nome": "…" } ],
  "dataInicioLocacao": "2026-01-31",
  "prazoMeses": 12,
  "valorMensal": 2500,
  "diaVencimento": 10,
  "dataFimLocacao": null,
  "valorTotalContrato": null,
  "gerarCobrancasAutomaticamente": true,
  "pdfContratoArquivo": null,
  "retiradoEm": null
}
```

```
PUT /v1/contratos/CTR-2026-00001            (corpo COMPLETO, idêntico ao do POST)

Regras: nenhum campo é opcional; o `codigo` NÃO está no corpo e NÃO muda;
        `status`, `dataFimLocacao` e `valorTotalContrato` são recusados como
        chave desconhecida (o servidor os decide). Aceito somente quando
        `status == "RASCUNHO"`.
```

```
POST /v1/contratos/CTR-2026-00001/ativacao
Content-Type: application/json
{}                                  ← corpo VAZIO e FECHADO (strictObject({}))

200 OK
{
  "codigo": "CTR-2026-00001",
  "status": "ATIVO",
  "dataFimLocacao": "2027-01-30",
  "valorTotalContrato": 30000,
  …demais campos do recurso…,
  "efeitos": { "cobrancasGeradas": false }
}
```

```
POST /v1/contratos/CTR-2026-00001/cancelamento   → 200, o contrato como ficou (status CANCELADO)
POST /v1/contratos/CTR-2026-00001/retirada       → 200, retiradoEm preenchido, status INALTERADO
POST /v1/contratos/CTR-2026-00001/recirculacao   → 200, retiradoEm nulo, status INALTERADO
```

As quatro rotas de ato **de contrato** aceitam corpo **vazio e fechado**: qualquer chave é recusada com `422` nomeando o corpo. Sem isso, um cliente que enviasse `{"status":"ATIVO"}` receberia `200` e acreditaria ter escolhido o estado. A rota de situação do imóvel (§4.1.2) é a única com corpo, e ele é fechado num campo só.

### 4.1.2 A situação de locação sai do corpo do `PUT` de imóvel

**O furo que isto fecha, e ele é observável hoje.** `alterarImovel` escreve `status_locacao` incondicionalmente, e `esquemaDeImovelNovo` só aceita `DISPONIVEL` ou `INDISPONIVEL` — `LOCADO` **não é informável**, por decisão fechada da fatia 1. Logo **toda** alteração de um imóvel locado, inclusive uma correção de endereço, apagaria o `LOCADO` em silêncio, enquanto o contrato seguiria `ATIVO` e o índice único parcial seguiria bloqueando um segundo contrato. O resultado observável seria um imóvel respondendo `statusLocacao: 'DISPONIVEL'` **e** `contratoVigente: { … }` no mesmo corpo — que é literalmente a dor de origem descrita no PRD §2: *"as duas fontes podem divergir, e a tela mostra o que quiser"*.

**A correção, em três partes:**

1. **`statusLocacao` sai do corpo do `PUT`.** O esquema de alteração é **derivado**, nunca redigitado: `esquemaDeImovelAlterado = esquemaDeImovelNovo.omit({ statusLocacao: true })`. O `POST` mantém o campo — ali o imóvel nasce, e nascer sem contrato é o único estado possível.
2. **`alterarImovel` deixa de tocar a coluna** — exatamente como ela já não toca `retirado_em`, e pela razão que o próprio docblock dela registra: *"a circulação tem porta própria, e reuni-las faria uma correção de endereço carregar, por descuido, uma mudança de estado"*. O argumento não envelheceu; ele apenas não tinha sido aplicado à segunda coluna de estado.
3. **A situação ganha rota própria**, `POST /v1/imoveis/:id/situacao-de-locacao`, com corpo fechado de um campo (`statusLocacao ∈ SITUACOES_INFORMAVEIS`) e a **mesma porta estreita** que a ativação e o cancelamento usam. Uma rota, e não duas gêmeas no molde de `retirada`/`recirculacao`, porque a união informável pode ganhar um terceiro valor e duas rotas por valor multiplicariam a superfície a cada crescimento do enum.

**Ela exige apenas `TELA:imoveis`, e a leitura precisa ficar escrita.** A `Decision` da ADR-0019 diz *"rota própria, governada pela chave de ação sensível correspondente do catálogo fechado"*, e **não existe ação sensível para esta transição** — o catálogo é fechado nas sete, e a própria ADR registra entre os *Cons* que ele "não cresce sem decisão explícita". A leitura adotada: a ADR-0019 alcança **transição governada** — ativar, cancelar, retirar de circulação —, e alternar entre disponível e indisponível é **atributo operacional do cadastro**, não ato sensível. Ela se apoia nos *Neutros* da própria ADR (*"quais estados cada entidade tem é decisão da fatia dela; esta ADR fixa a forma da transição"*), e a metade que importa — **rota própria, nunca campo em atualização do recurso** — é obedecida ao pé da letra.

> ~~**Isto é interpretação do texto, e não conformidade literal.**~~ **DEIXOU DE SER, em 2026-08-09.** O parágrafo acima foi escrito quando a rota era regida pela ADR-0019, e a saída rigorosa que ele nomeava — emendar a `Decision` para distinguir transição governada de transição de atributo operacional — **foi tomada**: a **ADR-0021** supersede a 0019 e faz exatamente esse recorte, nomeando a **situação de locação do imóvel** como a instância declarada da segunda classe. A leitura descrita acima é hoje **o texto da ADR vigente**, e não uma interpretação dele; a exigência da rota não mudou uma linha. Onde esta seção diz `ADR-0019`, leia **ADR-0021** — a 0019 está `superseded-by:0021` e **não se cita**. Registro: **D43** na §2 do `_run/run-report.md`.

**Reusar `ACAO:excluir_cadastro` foi avaliado e descartado**: a ADR-0019 rejeita nominalmente esse reuso nas Alternativas (*"são efeitos diferentes"*), e quem marca um imóvel em reforma passaria a precisar da concessão de excluir cadastro para pôr um imóvel em reforma.

**Consequência para a fatia 1, que está *staged* e não commitada**: os casos que fazem `PUT /v1/imoveis/:id` com `statusLocacao` no corpo passam a enviar um campo desconhecido e serão recusados com `422`. A alteração deles é **crescimento de contrato**, não afrouxamento, e carrega a linha `SUT_IS_CORRECT_BECAUSE`.

### 4.2 Schemas / DTOs

Todos em `packages/contracts/src/contrato.ts`. **O esquema é a fonte única** (ADR-0016): a conferência de entrada, o tipo da resposta e o documento publicado saem da mesma declaração; nada é descrito à mão em paralelo.

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `ESTADOS_DO_CONTRATO` | `Object.freeze([...] as const)` | `RASCUNHO`, `ATIVO`, `CANCELADO`, `ENCERRADO` | v1 |
| `ESQUEMA_DO_CODIGO_DE_CONTRATO` | Zod, derivado das constantes de formato | `trim` → `toUpperCase` → regex `^CTR-\d{4}-\d{5,}$` | v1 |
| `esquemaDeContratoNovo` | `z.strictObject` | `imovelId`, `locadorId`, `locatarioId`, `fiadoresIds[]`, `dataInicioLocacao`, `prazoMeses`, `valorMensal`, `diaVencimento`, `gerarCobrancasAutomaticamente`, `pdfContratoArquivo` | v1 |
| `esquemaDoContrato` | `z.object` | o acima **mais** `codigo`, `status`, `fiadores[]`, `dataFimLocacao`, `valorTotalContrato`, `retiradoEm` | v1 |
| `esquemaDaAtivacaoDeContrato` | `esquemaDoContrato.extend` | `+ efeitos: { cobrancasGeradas: z.literal(false) }` | v1 |
| `esquemaDoImovel` (**alterado**) | `z.object` | `+ contratoVigente: { codigo, locatario: { id, nome } } \| null` | v1 |
| `esquemaDeImovelAlterado` (**novo**) | `esquemaDeImovelNovo.omit` | o corpo do `POST` **menos** `statusLocacao` (§4.1.2) — derivado, nunca redigitado | v1 |
| `esquemaDaSituacaoDeLocacao` (**novo**) | `z.strictObject` | `statusLocacao ∈ SITUACOES_INFORMAVEIS` — corpo fechado de um campo | v1 |

**O formato do código legível é declarado UMA vez**, e o esquema deriva dele:

```ts
export const PREFIXO_DO_CODIGO_DE_CONTRATO = 'CTR';
export const LARGURA_DO_SEQUENCIAL_DE_CONTRATO = 5;
export function formatarCodigoDeContrato(ano: number, sequencial: number): string;
export const ESQUEMA_DO_CODIGO_DE_CONTRATO = /* regex construída das duas constantes */;
```

Formatador e esquema numa fonte só é o que impede a divergência muda em que a emissão produz um código que a rota de leitura recusa. E é aqui que mora o marcador exigido pelo PRD §9:

```ts
// DECISÃO FECHADA — F2/fatia 2 · 2026-08-08
// O QUÊ: a largura do sequencial é CINCO dígitos (`CTR-2026-00001`).
// POR QUÊ: é o valor MEDIDO no sistema antigo (`autoname` = `CTR-.YYYY.-.#####`, série viva em 20).
//          O `plano-execucao.md` §F2, o `CLAUDE.md` e o briefing da fase escrevem QUATRO; a
//          divergência é conhecida e a correção daqueles textos não pertence a esta fatia. O código
//          legível é o TÍTULO do contrato nas telas e o rótulo dos seletores do Financeiro — mudar a
//          largura muda o que o usuário reconhece.
// REVERTER EXIGE: medir de novo o `autoname` no sistema antigo (ou, depois da virada, provar que
//                 nenhum código de cinco dígitos foi emitido nem citado fora do sistema).
```

**`valorMensal` e `prazoMeses` — os tetos vêm da capacidade da coluna**, no mesmo desenho já medido de `MAIOR_METRAGEM`/`ESCALA_DA_METRAGEM`:

- `MAIOR_VALOR_MONETARIO = 9_999_999_999_999.99` — o maior valor que `numeric(15,2)` representa;
- `ESCALA_MONETARIA = 0.01` — a escala da mesma declaração de coluna. Sem ela, `2500.555` seria aprovado, gravado como `2500.56` e devolvido **diferente do que o cliente enviou**, sem erro nem aviso;
- `MAIOR_PRAZO_EM_MESES` derivado: o maior inteiro tal que `MAIOR_VALOR_MONETARIO / prazo ≥ 0.01`, isto é, o teto que **garante** que `valorTotalContrato` também cabe na coluna.

A regra que a ADR-0016 implica é a mesma dos três precedentes: **todo valor que o contrato aprova tem de ser representável a jusante** — e "representável" inclui *representável sem ser alterado*. O teto **recusa em vez de truncar**, e a recusa nomeia o campo.

**As restrições de escala valem para a ENTRADA e não são replicadas na SAÍDA.** É a mesma assimetria deliberada de `ESCALA_DA_METRAGEM`, e pela primeira das duas razões que o marcador dela registra: esquema de saída que recusa **não produz `422`** — ele levanta na serialização e derruba a rota. `valorTotalContrato` é derivado, e a derivação em centavos inteiros (§6.2) o mantém na escala; ainda assim a saída não o restringe, porque converter divergência a montante em queda é o defeito pior.

### 4.3 Eventos Publicados / Consumidos

N/A — **nada é enfileirado nesta fatia**. A ativação é síncrona e o cancelamento também. É deliberado, e tem consequência registrada: o débito **D32 · F0/T6** (`apps/worker/src/fila.ts`) tem por gatilho *"a primeira fatia que enfileirar tarefa de negócio"*, e **ele não dispara aqui**. A emissão de boletos com novas tentativas, que é o que enfileiraria, é F4.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**Montar o contrato — `POST /v1/contratos`**

1. **Controlador** valida o corpo com `esquemaDeContratoNovo` (`422` nomeando o campo, sem tocar o banco).
2. **Controlador** abre a **primeira unidade** e chama `garantirContadorDeContrato(tx, ano)`. Commita. Idempotente: no caso comum é um `CREATE SEQUENCE IF NOT EXISTS` que só consulta o catálogo.
3. **Controlador** abre a **segunda unidade** (`sobContextoDaSessao`).
4. **Serviço** confere, sob a política, que imóvel, locador, locatário e cada fiador são **alcançáveis** e estão **em circulação** — `404` para o inalcançável, `422` nomeando o campo para o retirado.
5. **Serviço** chama a porta, que emite o número (`negocio.proximo_numero_de_contrato`), formata o código e grava contrato e fiadores **no mesmo commit**.
6. O contrato nasce `RASCUNHO`, em circulação, com `dataFimLocacao` e `valorTotalContrato` **nulos**.
7. **Controlador** emite a linha de trilha (`empresaId`, `entidade: 'contrato'`, `codigo`) e responde `201`.

**Fazer valer — `POST /v1/contratos/:codigo/ativacao`**

1. **Guarda** confere a conjunção `TELA:contratos` **e** `ACAO:ativar_contrato`; a recusa nomeia a primeira ausente.
2. **Controlador** valida e canoniza `:codigo` e o corpo vazio, e abre a unidade.
3. **Serviço** localiza o contrato (`404` se inalcançável) e exige `status == 'RASCUNHO'`.
4. **Serviço** aplica as **condições de entrada portadas** (§6.3, RN-08) — as mesmas do sistema antigo, provadas contra o golden.
5. **Serviço** confere que imóvel, locador, locatário e fiadores continuam **em circulação** (a montagem pode ter sido há semanas).
6. **Derivações puras**: `dataFimLocacao = derivarTerminoDaLocacao(dataInicioLocacao, prazoMeses)` e `valorTotalContrato = derivarValorTotal(valorMensal, prazoMeses)`.
7. **Porta** grava o contrato como `ATIVO` com as duas derivações. **Se o imóvel já tem contrato vigente, quem recusa é o índice único parcial**, não um `if` que leu antes — a violação `23505` é traduzida em `422` com o discriminador do conflito.
8. **Porta** escreve `imovel.status_locacao = 'LOCADO'` pela porta estreita.
9. Um commit só. Resposta `200` com o contrato no root **mais** `efeitos: { cobrancasGeradas: false }`.

**Cancelar — `POST /v1/contratos/:codigo/cancelamento`**

1. Guarda confere `TELA:contratos` **e** `ACAO:cancelar_contrato`.
2. Serviço localiza e exige `status == 'ATIVO'`.
3. Porta grava `CANCELADO` e escreve `imovel.status_locacao = 'DISPONIVEL'`. Um commit só.
4. `200` com o contrato como ficou. **O contrato permanece na carteira** — é o histórico que a ADR-0014 preserva.

### 5.2 Fluxos Alternativos

| Situação | Resultado |
|---|---|
| Ativar contrato `ATIVO`, `CANCELADO` ou `ENCERRADO` | `422 CAMPO_INVALIDO`, `campo: 'status'`, `detalhes: { estadoAtual, transicaoPedida }`. Nada muda. |
| Cancelar rascunho, cancelado ou encerrado | Idem. O contrato permanece como estava. |
| Alterar contrato que não é rascunho | Idem. Nada muda — a mudança de termos exige cancelar e montar outro. |
| Imóvel já tem contrato vigente | `422 CAMPO_INVALIDO`, `campo: 'imovelId'`, `detalhes: { conflito: 'IMOVEL_COM_CONTRATO_VIGENTE', contratoVigente: 'CTR-2026-00007' }`. O segundo continua `RASCUNHO`; o vigente **não é afetado**. |
| Condição de entrada não satisfeita | `422 CAMPO_INVALIDO` nomeando o campo culpado (§6.3). O contrato continua `RASCUNHO` e o imóvel **permanece exatamente como estava** — a transação inteira desfaz. |
| Cadastro referenciado fora de circulação | `422 CAMPO_INVALIDO`, `campo` = o do cadastro, `detalhes: { circulacao: 'RETIRADO_DE_CIRCULACAO' }`. Vale na montagem, na alteração **e** na ativação. |
| Retirar de circulação imóvel/pessoa já referenciado por contrato | **Aceito.** Sem recusa por vínculo (ADR-0014). O contrato continua legível, o imóvel continua `LOCADO`, o estado do contrato não muda. |
| Repetir retirada ou recirculação do contrato | **Idempotente**: a marca é preservada pela instrução (`coalesce(retirado_em, now())`), e a resposta é a mesma. `200`. |
| Contrato de outra empresa | `404 RECURSO_NAO_ENCONTRADO`, corpo **idêntico** ao de contrato inexistente. As duas causas são deliberadamente indistinguíveis. |
| `:codigo` malformado | `422 CAMPO_INVALIDO`, `campo: 'codigo'`, **sem tocar o banco** — a forma do identificador não vira oráculo de existência. |
| Sem a ação sensível | `403 ACESSO_NEGADO` com `detalhes.exigido` nomeando a chave que falta. O rascunho criado antes **continua existindo**. |
| Rascunho abandonado e retirado | O número que ele consumiu **não volta**. Furo aceito (ADR-0015). |

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | `POST /v1/contratos` | `ContratoController.criar` → `ContratoService.criar` → `criarContrato` |
| US-02 | `PUT /v1/contratos/:codigo` | `ContratoController.alterar` → `ContratoService.alterar` → `alterarContrato` |
| US-03 | `POST` e `PUT /v1/contratos[/:codigo]` (coleção `fiadoresIds` no corpo) | `substituirFiadoresDoContrato` |
| US-04 | `POST /v1/contratos` (emissão) e `GET /v1/contratos/:codigo` | `garantirContadorDeContrato`, `proximo_numero_de_contrato`, `formatarCodigoDeContrato` |
| US-05 | `POST /v1/contratos/:codigo/ativacao` | `ContratoService.ativar` → `ativarContrato` + `definirSituacaoDeLocacaoDoImovel` |
| US-06 | `POST /v1/contratos/:codigo/ativacao` (resposta) | `esquemaDaAtivacaoDeContrato` |
| US-07 | `POST /v1/contratos/:codigo/ativacao` (recusa) | `contrato_imovel_vigente_uidx` → `ErroDeImovelComContratoVigente` |
| US-08 | `POST /v1/contratos/:codigo/cancelamento` | `ContratoService.cancelar` → `cancelarContrato` + `definirSituacaoDeLocacaoDoImovel` |
| US-09 | `POST`, `PUT` e `/ativacao` (conferência de circulação) | `ContratoService.exigirCadastrosEmCirculacao` |
| US-10 | `GET /v1/contratos` | `ContratoController.listar` → `listarContratos` |
| US-11 | `GET /v1/imoveis/:id`, `GET /v1/imoveis`, `GET /v1/conjuntos?expandir=imoveis` | `lerContratosVigentesDeImoveis` dentro do agregado de imóvel |
| US-12 | `POST /v1/contratos/:codigo/{retirada,recirculacao}` | `definirCirculacaoDoContrato` |
| US-13 | Todas as 8 rotas (declaração de exigência) | `@ExigeChave`, `@ExigeChaves`, `contexto.guard.ts` |
| US-14 | Todas as 8 rotas (política e FK composta) | RLS forçada, `unique(id, empresa_id)`, FK composta |
| US-15 | `GET /v1/contratos[/:codigo]` | `status` como coluna de enum, calculada pelo servidor |
| US-16 | `POST /v1/contratos/:codigo/ativacao` | `derivarTerminoDaLocacao`, `derivarValorTotal` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| `:codigo` casa `CTR-{4 dígitos}-{5+ dígitos}`, após `trim` e `toUpperCase` | Controlador, **antes** de abrir a unidade | `422 CAMPO_INVALIDO`, `campo: 'codigo'`, sem tocar o banco |
| Corpo é `strictObject` completo — nenhum campo opcional, nenhuma chave desconhecida | Controlador | `422 CAMPO_INVALIDO` nomeando o campo (ou `corpo`, quando o Zod não tem caminho) |
| `imovelId`, `locadorId`, `locatarioId` e cada `fiadoresIds[n]` são UUID canonizados | Controlador (`ESQUEMA_DO_IDENTIFICADOR`, importado) | `422 CAMPO_INVALIDO` |
| `fiadoresIds` sem repetição | Controlador | `422 CAMPO_INVALIDO`, `campo: 'fiadoresIds'` — a restrição `unique(contrato_id, fiador_id)` recusaria de qualquer jeito, mas a recusa do banco chegaria sem nome de campo |
| `dataInicioLocacao` é data de calendário `YYYY-MM-DD` | Controlador | `422 CAMPO_INVALIDO` |
| `prazoMeses` inteiro, `≥ 1`, `≤ MAIOR_PRAZO_EM_MESES` | Controlador | `422 CAMPO_INVALIDO` — **recusa, não trunca** |
| `valorMensal` `> 0`, `≤ MAIOR_VALOR_MONETARIO`, múltiplo de `ESCALA_MONETARIA` | Controlador | `422 CAMPO_INVALIDO` |
| `diaVencimento` inteiro entre `1` e `28` | Controlador **e** `check` no banco | `422 CAMPO_INVALIDO` |
| `gerarCobrancasAutomaticamente` booleano, padrão `true` | Controlador (`.default(true)`) | — |
| `pdfContratoArquivo` texto ou `null` | Controlador | `422 CAMPO_INVALIDO` |
| Corpo das 4 rotas de ato é **vazio e fechado** | Controlador | `422 CAMPO_INVALIDO`, `campo: 'corpo'` |
| `limite` `≤ 200`, `deslocamento` `≥ 0`, `incluirRetirados` ∈ `{'true','false'}` | Controlador (`esquemaDaJanelaComCirculacao`, importado) | `422 CAMPO_INVALIDO` |

**`empresaId` não aparece em lugar nenhum do corpo.** Ele sai da sessão, e o `strictObject` o recusa como chave desconhecida. **`status`, `dataFimLocacao`, `valorTotalContrato` e `codigo` também não**: os quatro são decididos pelo servidor (ADR-0017), e aceitá-los seria a segunda fonte de estado que a RN-03 elimina.

### 6.2 Transformações de Dados

**Camada de nomes.** As colunas são `snake_case` e o contrato fala camelCase (ADR-0017). A tradução acontece **num ponto por entidade**: no fragmento de projeção da porta (apelidos no `SELECT`) e na função `publicar` do serviço. Nenhum espalhamento (`...linha`) — o espalhamento publicaria qualquer coluna que a projeção venha a ganhar, inclusive `empresa_id`.

**Datas nunca passam por `Date` com fuso.** `data_inicio_locacao` e `data_fim_locacao` são colunas `date` e são lidas com `to_char(coluna, 'YYYY-MM-DD')`, viajando como cadeia da consulta até o JSON. As funções puras de derivação recebem e devolvem `YYYY-MM-DD` e fazem aritmética de calendário sobre `Date.UTC`, nunca sobre o relógio local. Um `date` entregue como objeto `Date` pelo driver e reserializado com o fuso do processo desloca a data em um dia para metade dos fusos — e é justamente `dataFimLocacao` que o CA-20 compara contra o oráculo.

**Aritmética do término da locação** — reprodução do sistema antigo (`add_days(add_months(inicio, prazo), -1)`):

```
derivarTerminoDaLocacao(inicio, prazoMeses):
    avançar `prazoMeses` no par (ano, mês)
    dia := min(dia de `inicio`, último dia do mês de destino)     ← SATURAÇÃO
    subtrair 1 dia do resultado
```

A **saturação** é o comportamento de `dateutil.relativedelta`, que é o que `frappe.utils.add_months` usa — e é o que a leitura do código portado **não revela**, porque mora na biblioteca do arcabouço. Ela decide a data de fim de **todo contrato iniciado em 29, 30 ou 31**, que o CA-20 nomeia. Exemplo verificável: início `2026-01-31`, prazo `1` → avanço satura em `2026-02-28` → menos um dia → **`2026-02-27`**. O valor exato de cada caso é o que o **golden** fixa; esta descrição é o mecanismo, não o oráculo.

**Aritmética do valor total** — `valorMensal × prazoMeses` **em centavos inteiros**:

```
derivarValorTotal(valorMensal, prazoMeses):
    centavos := Math.round(valorMensal * 100) * prazoMeses
    devolve centavos / 100
```

É o mesmo desenho, e a mesma razão medida, de `somarMetragem`: multiplicar diretamente em ponto flutuante produz resíduo binário em combinações perfeitamente legítimas, e o resíduo viajaria no JSON num campo que o cliente exibe. O `Math.round` fecha o outro lado — o número que chega já veio de um `numeric(15,2)` convertido, e multiplicá-lo por cem pode render `249999.99999999997`.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RD-01 | RN-01 | Contrato, imóvel, locador, locatário e fiadores pertencem à mesma empresa. Garantido pelas **quatro chaves estrangeiras compostas** e pela política — nenhuma comparação de empresa é escrita na aplicação | — (recusa estrutural do banco) |
| RD-02 | RN-02 | Quatro estados. Nasce `RASCUNHO`; `ATIVO` e `CANCELADO` por ato próprio; `ENCERRADO` **sem produtor nesta fatia** | `ErroDeTransicaoInvalida` |
| RD-03 | RN-03 | `status` é **coluna única**, decidida pelo servidor. Nenhum indicador do sistema antigo sobrevive; nenhum consumidor deriva estado | — |
| RD-04 | RN-04 | Código `CTR-{ano}-{5 dígitos}`, único por empresa, emitido **ao nascer**, contador por `(empresa, ano)`, valor inicial parametrizável, **nunca reusado**, furo aceito | `ErroDeCodigoEmUso` |
| RD-05 | RN-05 | Alterável **só** enquanto `RASCUNHO`. A alteração **não muda** o código | `ErroDeTransicaoInvalida` |
| RD-06 | RN-06 | Zero ou mais fiadores, sem teto. Vínculo puro, sem atributo próprio nem histórico. Congela na ativação — pela guarda do **pai**, não por regra de sub-recurso | — |
| RD-07 | RN-07 | Área é pré-condição de tudo; ativar, cancelar e retirar exigem, **além dela**, a ação sensível correspondente | `403 ACESSO_NEGADO` |
| RD-08 | RN-08 | **As seis condições de entrada portadas**: data de início presente · prazo `> 0` · valor mensal `> 0` · dia de vencimento entre 1 e 28 · imóvel vinculado · locatário vinculado. O oráculo é o golden | `ErroDeContratoInapto` |
| RD-09 | RN-09 | Um imóvel não tem dois contratos vigentes. **Índice único parcial** `WHERE status = 'ATIVO'` — recusa do banco, imune a concorrência | `ErroDeImovelComContratoVigente` |
| RD-10 | RN-10 | `dataFimLocacao` e `valorTotalContrato` são **derivados na ativação**, nunca informados, e reproduzem o sistema antigo inclusive na virada de mês | — |
| RD-11 | RN-11 | Ativar escreve `imovel.status_locacao = 'LOCADO'`; cancelar escreve `'DISPONIVEL'`. **A coluna deixa de ser escrita pelo `PUT` de imóvel** e passa a ter três produtores, todos por porta estreita: a criação, os dois atos, e a rota de situação (§4.1.2) | `ErroDeImovelComContratoVigente` na rota de situação |
| RD-12 | RN-12 | Nesta fatia a ativação **não gera cobrança** e o cancelamento **não cancela cobrança nem pede baixa**. A resposta da ativação declara isso | — |
| RD-13 | RN-13 | A exigência do sistema antigo de possuir o PDF para cancelar **não é portada** | — (débito com gatilho, F3) |
| RD-14 | RN-14 | Cadastro fora de circulação não é aceito ao montar, alterar nem ativar. **O sentido inverso é livre** | `ErroDeCadastroForaDeCirculacao` |
| RD-15 | RN-15 | Retirada de circulação do contrato é **de visibilidade**: alcança qualquer estado, **não muda o estado**, **não libera o imóvel**, é reversível, nada é apagado | — |
| RD-16 | RN-16 | `gerarCobrancasAutomaticamente` (padrão `true`) e `pdfContratoArquivo` são **apenas persistidos** aqui | — |
| RD-17 | RN-17 | Imóvel ocupado apresenta o contrato vigente e o locatário dele; imóvel sem contrato vigente apresenta `null` | — |
| RD-18 | RN-18 | O Sysloc Master não alcança contrato: a matriz de perfil dele é **vazia**, e a exigência das 8 rotas é por chave | `403 ACESSO_NEGADO` |

**`INDISPONIVEL` não impede a ativação, e a assimetria é decidida — não esquecida.** `ativar_imovel_contrato`, no sistema antigo, confere **apenas** `contrato_ativo`; ele não olha `status_locacao`. A ativação daqui reproduz isso: ela escreve `LOCADO` por cima de `INDISPONIVEL`, sem recusar. Acrescentar a recusa seria **condição de entrada nova**, sem fonte no legado nem no PRD, contra a RN-08 — que sujeita o conjunto das condições ao oráculo. Fica, portanto, a leitura: `INDISPONIVEL` significa *"não ofereça nas buscas"*, e não *"proibido de locar"*.

A assimetria com a rota de §4.1.2 é consequência, e é intencional: **pôr um imóvel locado em `INDISPONIVEL` é recusado**, porque desfaria o `LOCADO` que o contrato vigente sustenta; **locar um imóvel `INDISPONIVEL` passa**, porque nada no oráculo o proíbe. Um sentido protege um invariante que existe; o outro inventaria uma regra que ninguém declarou.

**A máquina de estados é NOSSA, e a divergência do sistema antigo é deliberada.** No sistema antigo, `ativar_contrato_e_gerar_cobrancas` **não confere estado algum** — ele ativa a partir de qualquer `status_contrato`, inclusive de um já cancelado. Reproduzir isso literalmente contradiria o **CA-10**, que exige recusar fazer valer um contrato cancelado. O que o oráculo governa é o conjunto das **condições de entrada** (RD-08), as **derivações** (RD-10) e a **guarda de imóvel ocupado** (RD-09); a máquina de estados é decisão desta fatia, e está fixada pela ADR-0019. Isto precisa estar escrito no código, ou a rodada seguinte "corrigirá" a divergência contra o golden.

**A assimetria de `statusLocacao` da fatia anterior NÃO se unifica.** A entrada da API aceita duas situações (`SITUACOES_INFORMAVEIS`) e o domínio tem três, porque `LOCADO` é produzido **só** pelos atos desta fatia. É decisão fechada da fatia 1, com prova dedicada (`CT-334`/`CT-335`), e "simplificar" isso é regressão de decisão (R3). A ativação e o cancelamento escrevem por uma **porta nova e estreita** — `definirSituacaoDeLocacaoDoImovel(tx, imovelId, situacao)` —, jamais pela porta de alteração de imóvel, que continua tipada em `SituacaoInformavel`.

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, schema `negocio` (ADR-0009). Acesso por `postgres.js`; estrutura declarada em Drizzle e migrada por `drizzle-kit`. Papéis: `sysloc_migracao` (dono dos schemas e das tabelas) e `sysloc_app` (a aplicação, `NOBYPASSRLS`).

### 7.2 Tabelas / Coleções

**`negocio.contrato`**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` | Chave interna. **Não trafega** |
| `empresa_id` | `uuid NOT NULL` | A coluna que a política compara. **Sem FK própria** para `identidade.empresa`: ela é implicada pelas compostas abaixo, e uma segunda restrição custaria verificação a cada escrita sem recusar nada a mais |
| `codigo` | `text NOT NULL` | A chave **exposta** |
| `imovel_id` · `locador_id` · `locatario_id` | `uuid NOT NULL` | |
| `status` | `negocio.status_contrato NOT NULL` | Sem padrão: quem cria declara. O serviço grava `RASCUNHO` |
| `data_inicio_locacao` | `date NOT NULL` | |
| `prazo_meses` | `integer NOT NULL` | |
| `valor_mensal` | `numeric(15,2) NOT NULL` | Invariante 4 do projeto |
| `dia_vencimento` | `integer NOT NULL` | |
| `data_fim_locacao` | `date` | **Anulável**: derivado na ativação |
| `valor_total_contrato` | `numeric(15,2)` | **Anulável**: derivado na ativação |
| `gerar_cobrancas_automaticamente` | `boolean NOT NULL DEFAULT true` | Mesmo desenho de `comodo.metragem`: o contrato aplica o padrão na entrada, e o `NOT NULL` impede um caminho futuro de gravar a ausência como nulo |
| `pdf_contrato_arquivo` | `text` | Guarda **caminho**, nunca bytes |
| `retirado_em` | `timestamptz` | Exclusão lógica (ADR-0014) |

Restrições e índices:

| Nome | Forma | Razão |
|---|---|---|
| `contrato_id_empresa_key` | `unique (id, empresa_id)` | Alvo das FK compostas das filhas; **exigido pela guarda de cobertura** |
| `contrato_empresa_codigo_key` | `unique (empresa_id, codigo)` | RN-04. **Total**, alcança o retirado — parcial faria a recirculação colidir, exatamente como no identificador municipal |
| `contrato_imovel_empresa_fkey` | `FK (imovel_id, empresa_id) → imovel (id, empresa_id)` | ADR-0008 |
| `contrato_locador_empresa_fkey` | `FK (locador_id, empresa_id) → locador (id, empresa_id)` | ADR-0008 |
| `contrato_locatario_empresa_fkey` | `FK (locatario_id, empresa_id) → locatario (id, empresa_id)` | ADR-0008 |
| `contrato_dia_vencimento_chk` | `check (dia_vencimento BETWEEN 1 AND 28)` | RD-08 no banco |
| `contrato_prazo_positivo_chk` | `check (prazo_meses > 0)` | RD-08 no banco |
| `contrato_valor_mensal_positivo_chk` | `check (valor_mensal > 0)` | RD-08 no banco |
| **`contrato_imovel_vigente_uidx`** | **`unique index (imovel_id) WHERE status = 'ATIVO'`** | **RN-09 — ver o bloco abaixo** |
| `contrato_empresa_retirado_idx` | `index (empresa_id, retirado_em)` | A listagem padrão filtra o par |
| `contrato_empresa_imovel_idx` | `index (empresa_id, imovel_id)` | Leitura do contrato vigente por imóvel |

> **`contrato_imovel_vigente_uidx` é ÍNDICE, e não restrição — e isso não é escolha de estilo.** O PostgreSQL **não admite restrição única parcial**: `ALTER TABLE … ADD CONSTRAINT … UNIQUE (…) WHERE …` não existe. Só `CREATE UNIQUE INDEX … WHERE` alcança a condição. Quem "corrigir" isto para restrição, por consistência com as vizinhas, **remove a condição** e passa a impedir dois contratos **em qualquer estado** sobre o mesmo imóvel — o que quebra a montagem de um contrato novo depois do cancelamento do anterior, que é o fluxo normal do negócio.
>
> `empresa_id` fica **fora** do índice de propósito: ele é funcionalmente determinado por `imovel_id`, que a chave estrangeira composta amarra a um único imóvel — e um imóvel pertence a uma empresa só. Acrescentá-lo alargaria a chave sem recusar nada a mais. É o mesmo desenho, e a mesma razão, de `comodo_imovel_posicao_key`.
>
> Ele **não** satisfaz a guarda de cobertura, e não precisa: a guarda cobra **restrição nomeada** sobre `(id, empresa_id)`, que é `contrato_id_empresa_key`. As duas coexistem sem se substituir.

**`negocio.contrato_fiador`** — **vínculo puro**

| Coluna | Tipo |
|---|---|
| `id` | `uuid` PK `default gen_random_uuid()` |
| `empresa_id` | `uuid NOT NULL` |
| `contrato_id` | `uuid NOT NULL` |
| `fiador_id` | `uuid NOT NULL` |

| Nome | Forma | Razão |
|---|---|---|
| `contrato_fiador_id_empresa_key` | `unique (id, empresa_id)` | Exigido pela guarda de cobertura |
| `contrato_fiador_contrato_fiador_key` | `unique (contrato_id, fiador_id)` | O mesmo fiador não entra duas vezes no mesmo contrato |
| `contrato_fiador_contrato_empresa_fkey` | `FK (contrato_id, empresa_id) → contrato (id, empresa_id)` | ADR-0008 |
| `contrato_fiador_fiador_empresa_fkey` | `FK (fiador_id, empresa_id) → fiador (id, empresa_id)` | ADR-0008 |
| `contrato_fiador_empresa_contrato_idx` | `index (empresa_id, contrato_id)` | Leitura dos fiadores em lote |

> **Não há `retirado_em`, e a ausência é a decisão.** A ADR-0014 exclui do alcance da exclusão lógica *"vínculo ou concessão, cuja linha representa estado de relacionamento"*, e o discriminador dela é **ser referenciável** — nada aponta para uma linha de `contrato_fiador`. Medido no sistema antigo: a tabela-filha `Fiadores` tem **um único campo**, `fiador`; nenhum percentual, nenhuma data, nenhuma ordem de negócio. Acrescentar a coluna "por simetria" com as outras seis desfaria a decisão em silêncio, e a guarda de cobertura **não acusaria** — ela não cobra `retirado_em` de ninguém. A ausência precisa ser afirmada por caso próprio, no molde do `CT-317` do cômodo.

**Enum `negocio.status_contrato`** — `RASCUNHO`, `ATIVO`, `CANCELADO`, `ENCERRADO`. Derivado de `ESTADOS_DO_CONTRATO`, de `@sysloc/contracts`, **nunca redigitado** (ADR-0016): redigitar seria a segunda fonte do mesmo fato, e o dia em que o contrato ganhasse um estado, o banco o recusaria sem que nada acusasse antes da primeira gravação em operação. `RESCINDIDO` do sistema antigo é **podado** — zero caminhos de escrita no app legado inteiro. `ENCERRADO` fica no enum **sem produtor nesta fatia**, no mesmo padrão com que a fatia anterior reservou `LOCADO`.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| 0007 | `packages/db/migracoes/0007_dominio_contrato.sql` | **Gerada** (`drizzle-kit`): `CREATE TYPE negocio.status_contrato`; `CREATE TABLE negocio.contrato` e `negocio.contrato_fiador` com restrições, FK compostas, `check`, índices e o índice único parcial; `ENABLE ROW LEVEL SECURITY` nas duas |
| 0008 | `packages/db/migracoes/0008_seguranca_contrato.sql` | **Autoral**: `FORCE ROW LEVEL SECURITY` nas duas; as duas políticas `FOR ALL` com `USING`/`WITH CHECK`; as duas funções `SECURITY DEFINER`; `REVOKE`/`GRANT EXECUTE`; `GRANT USAGE ON TYPE negocio.status_contrato` |

**Gerada e autoral nunca convivem no mesmo arquivo**, e **nunca se emenda a `0005` ou a `0006`** — elas descrevem schemas já aplicados e são, portanto, imutáveis. Uma regeração futura da gerada sobrescreveria em silêncio o trecho autoral perdido, e trecho autoral de isolamento perdido em silêncio é a pior forma de perder isolamento.

A `0008` transcreve a expressão da política **literalmente** da `0006`, sem reinventá-la: duas redações do mesmo isolamento são livres para divergir, e a divergência não faz barulho — ela aparece como uma tabela que enxerga o que não devia.

**Sem descida (`down`)**: reverter isolamento por migração é operação de risco; o caminho de volta é restauração de backup.

**As concessões que a `0008` precisa fazer, e a que ela deliberadamente NÃO faz:**

- `GRANT USAGE ON TYPE negocio.status_contrato TO sysloc_app` — o `ALTER DEFAULT PRIVILEGES … GRANT USAGE ON TYPES` da `0001` já cobre tipos criados por `sysloc_migracao`, e as tabelas são cobertas pela cláusula gêmea `ON TABLES`. A concessão explícita segue o precedente da `0001`, que declara os tipos um a um mesmo tendo o padrão.
- `REVOKE ALL ON FUNCTION … FROM PUBLIC` seguido de `GRANT EXECUTE … TO sysloc_app` para as duas funções.
- **NÃO concede `USAGE ON SEQUENCES`.** O `nextval` corre **dentro** da função `SECURITY DEFINER`, com os direitos da dona; o papel da aplicação nunca toca a sequência diretamente. Conceder seria privilégio a mais sem consumidor, e abriria um segundo caminho para o número — pelo qual o escopo `(empresa, ano)` deixaria de ser imposto pela função.

### 7.4 Estratégia de Transação e Consistência

**O mecanismo da série (ADR-0020).** O número é emitido por **sequência do próprio banco**, uma por escopo `(empresa, ano)`, nomeada `contrato_{ano}_{empresa sem hífens}` — 46 caracteres, dentro do limite de 63 do identificador. Duas funções, ambas `SECURITY DEFINER` com `SET search_path`, donas `sysloc_migracao`:

```sql
negocio.garantir_contador_de_contrato(p_ano integer, p_inicio bigint DEFAULT 1) RETURNS void
    -- CREATE SEQUENCE IF NOT EXISTS negocio.<nome> START WITH p_inicio MINVALUE p_inicio NO CYCLE
    -- captura duplicate_table / unique_violation e devolve sem erro (corrida na primeira emissão)

negocio.proximo_numero_de_contrato(p_ano integer) RETURNS bigint
    -- nextval sobre a sequência do escopo corrente
```

**Nenhuma das duas aceita `empresa_id` por parâmetro.** As duas leem `nullif(current_setting('app.empresa_id', true), '')::uuid` e **levantam** quando ele está ausente. É isso, e não uma conferência de aplicação, que impede pedir o contador de outra empresa: como o `SECURITY DEFINER` roda com os direitos da dona, aceitar a empresa por argumento daria à aplicação exatamente o poder que a RLS lhe tira. O contador fica fora do alcance da política de linha (ADR-0020 registra isso entre os *Cons*), e o escopo é preservado pela **identidade do objeto**.

**Por que a criação de contrato abre DUAS unidades sequenciais.** A alternativa óbvia — criar a sequência e consumi-la na mesma transação — tem um modo de falha que contraria a ADR-0015 ao pé da letra:

> se a transação que **cria** a sequência e toma `nextval = 1` **aborta**, o `CREATE SEQUENCE` é desfeito junto e a sequência deixa de existir. O contrato seguinte a recria e toma `nextval = 1` outra vez. O número **foi reusado** — e a cláusula que a ADR-0015 existe para sustentar é *"o número nunca é reusado, nem por registro excluído, nem por criação abortada"*.

Com as duas unidades, a sequência já está **commitada** quando o `nextval` corre. Um `nextval` **nunca** volta atrás no desfazimento: a criação abortada queima o número para sempre, que é exatamente o furo que a ADR-0015 aceita por escrito. O custo é uma transação curta a mais por criação de contrato — no caso comum, um `CREATE SEQUENCE IF NOT EXISTS` que só consulta o catálogo —, num volume medido de **dezenas de contratos por ano**.

As duas unidades **não aninham**: a segunda começa depois de a primeira fechar. O marcador `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts` recusa **abrir uma segunda unidade de dentro de uma aberta**, e não abrir duas em sequência — ele **não é tocado**.

**Valor inicial parametrizável.** `garantir_contador_de_contrato` aceita `p_inicio`. A criação normal o omite (padrão `1`); a **virada (F7)** invoca a função com o valor medido no sistema antigo antes do primeiro contrato do ano, e a chamada seguinte, com o padrão, é no-op porque a sequência já existe. A **semeadura efetiva não pertence a esta fatia** — o que pertence é não impedi-la.

**Atomicidade das operações.** Cada rota é um commit só:

| Operação | O que entra no mesmo commit |
|---|---|
| Criar | `nextval` + linha de `contrato` + N linhas de `contrato_fiador` |
| Alterar | linha de `contrato` + substituição integral de `contrato_fiador` |
| Ativar | `contrato` (estado + duas derivações) + `imovel.status_locacao = 'LOCADO'` |
| Cancelar | `contrato` (estado) + `imovel.status_locacao = 'DISPONIVEL'` |

Nível de isolamento: o padrão do PostgreSQL, `READ COMMITTED`. **Nenhuma leitura decide se pode gravar** — a unicidade do código e a vigência única por imóvel são recusas do banco. Leitura-antes-de-gravar é *janela de corrida disfarçada de validação*, e é desenho que este repositório já recusou por escrito.

A tradução das duas violações de unicidade corre atrás de um `SAVEPOINT`, no molde já publicado: no PostgreSQL um erro coloca a transação em estado abortado, e sem o ponto de retorno a leitura que **descreve** o conflito seria impossível na mesma unidade.

**Idempotência.** Retirada e recirculação usam `coalesce(retirado_em, now())` / `NULL` numa instrução só — repetir preserva a marca, caractere a caractere, e a ausência de linha significa uma coisa só: o contexto não alcança o contrato. Ativação e cancelamento **não são idempotentes por decisão**: repetir é transição inválida e recebe `422`, porque o segundo pedido significa que quem o fez não sabia o estado.

### 7.5 Política de Retenção / Archival

**Nada é apagado** (ADR-0014). Não há `DELETE` sobre `negocio.contrato` em caminho nenhum; a retirada de circulação é marca de coluna. `negocio.contrato_fiador`, por ser **vínculo**, é a exceção nomeada pela própria ADR: substituir a lista de fiadores de um rascunho **remove** e **insere** linhas, que é o mecanismo legítimo — o mesmo do ajuste bidirecional da matriz de permissões.

**Dívida ampliada, e registrada como tal**: o contrato acrescenta **dado financeiro** (valor mensal, valor total) ao conjunto retido indefinidamente. É a mesma dívida que a ADR-0014 já registra entre os *Cons* para dado pessoal, agora ampliada em classe de dado. **Não há política de retenção declarada no projeto**, e fechá-la é decisão de produto, não desta fatia.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|-----------------|------|------|----------|-------|
| — | — | — | — | — |

**N/A em tempo de execução** — a fatia não fala com nenhum serviço externo. O Sicoob é F4.

Há, porém, uma **dependência externa em tempo de construção**, e ela é do caminho crítico: a captura do oráculo executa contra o `/opt/frappe`, que só existe até a fase de virada. Regime, sob **ADR-0006**:

- O site `frontend` (produção) recebe **exclusivamente `bench backup`** — comando que produz arquivo e não altera dado. Nada mais o toca.
- Todo o resto executa em **site efêmero** (`caracterizacao.localhost`), criado por `preparar-site-efemero.sh` e destruído ao fim do fluxo.
- O manifesto de procedência registra o dump de origem, o horário e o commit do app, e a bijeção entre as máscaras declaradas e os marcadores presentes nos artefatos é **verificada**.
- O roteiro tem caso dedicado a reprovar qualquer script que toque o site de produção; ele continua valendo para os cenários novos.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Tópico / Fila | Produtor | Consumidor | Garantia |
|---------------|----------|------------|----------|
| — | — | — | — |

N/A. **Nada é enfileirado** — ver §4.3 e a consequência sobre o débito **D32 · F0/T6**.

### 9.2 Idempotência

Ver §7.4. Resumo: retirada e recirculação são idempotentes **pela instrução**; as duas transições de estado **não são**, por decisão; a criação **não é** — dois envios produzem dois rascunhos com códigos distintos, que é o comportamento correto (não há chave natural que os identifique como o mesmo pedido, e inventar uma seria requisito novo).

### 9.3 Outbox / Saga

N/A — não há consistência distribuída nesta fatia. Toda operação é uma transação local.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

O vocabulário é **fechado em oito códigos** e `STATUS_POR_CODIGO` é `Record<CodigoErro, number>` — acrescentar valor sem mapear status não compila, e acrescentar código é decisão de contrato com efeito no handoff. **Não há código de conflito**, e é por isso que toda recusa de domínio abaixo sai como `CAMPO_INVALIDO` com discriminador em `detalhes`.

| Erro | Código | Status | `campo` | `detalhes` | Camada de Origem |
|------|--------|--------|---------|------------|------------------|
| Contrato inalcançável (inexistente **ou** de outra empresa) | `RECURSO_NAO_ENCONTRADO` | 404 | — | — | Serviço |
| Imóvel/locador/locatário/fiador inalcançável | `RECURSO_NAO_ENCONTRADO` | 404 | — | — | Serviço |
| Cadastro referenciado **fora de circulação** | `CAMPO_INVALIDO` | 422 | `imovelId` \| `locadorId` \| `locatarioId` \| `fiadoresIds` | `{ circulacao: 'RETIRADO_DE_CIRCULACAO' }` | Serviço |
| Transição de estado inválida | `CAMPO_INVALIDO` | 422 | `status` | `{ estadoAtual, transicaoPedida }` | Serviço |
| Condição de entrada da ativação não satisfeita | `CAMPO_INVALIDO` | 422 | o campo culpado (`dataInicioLocacao`, `prazoMeses`, `valorMensal`, `diaVencimento`, `imovelId`, `locatarioId`) | — | Serviço |
| Imóvel já tem contrato vigente | `CAMPO_INVALIDO` | 422 | `imovelId` | `{ conflito: 'IMOVEL_COM_CONTRATO_VIGENTE', contratoVigente: 'CTR-…' }` | Porta → Serviço |
| Código legível já em uso (colisão de série) | `CAMPO_INVALIDO` | 422 | `codigo` | `{ conflito: 'CODIGO_EM_USO' }` | Porta → Serviço |
| Corpo/consulta/identificador malformados | `CAMPO_INVALIDO` | 422 | o caminho que o Zod reporta | — | Controlador |
| Sem sessão | `NAO_AUTENTICADO` | 401 | — | — | Guarda |
| Sem a chave exigida | `ACESSO_NEGADO` | 403 | — | `{ exigido: '<primeira chave ausente>' }` | Guarda |
| Contexto de empresa ausente na função do banco | `ERRO_INTERNO` | 500 | — | — | Banco → filtro |

**A recusa por conflito de vigência carrega o código do contrato vigente**, e a recusa por cadastro retirado carrega o campo culpado: nos dois casos, é essa informação que **decide o que o usuário faz em seguida** — cancelar o vigente, ou devolver o cadastro à circulação. É o mesmo desenho do discriminador `detalhes.conflito` já publicado para o identificador municipal.

**Nada do valor recusado entra na mensagem.** A mensagem chega ao registro estruturado, e a recusa é a resposta a um cliente sobre dado que ele enviou. O que o usuário precisa saber viaja em campo nomeado, não em prosa.

**A colisão de código é estado quase impossível** e, ainda assim, tem tradução: ela só ocorreria se a sequência fosse semeada para trás. Deixá-la sem tradução faria o erro do driver virar `500` — resposta mentirosa, e uma linha de nível `error` no journal afirmando falha do serviço.

### 10.2 Resiliência

Sem dependência de rede em tempo de execução, o único eixo é o banco, e ele já é coberto pelo que existe: reserva de conexões com teto, desligamento gracioso, e `SERVICO_INDISPONIVEL` (503) para dependência necessária indisponível.

**A corrida na primeira emissão de um escopo** é o único ponto novo de contenção, e é tratada por construção: `CREATE SEQUENCE IF NOT EXISTS` bloqueia a segunda transação até a primeira decidir, e o `EXCEPTION WHEN duplicate_table OR unique_violation` cobre o caminho em que o PostgreSQL levanta em vez de bloquear (a variante `IF NOT EXISTS` não é imune a corrida no índice de `pg_class`). Nos dois desfechos a função devolve sem erro e a sequência existe.

### 10.3 Estratégia de Logging de Erros

Pino, JSON estruturado, com a redação de credencial que a F0 instalou por entrada única. Uma linha por operação bem-sucedida, no molde já publicado, com `empresaId`, `entidade: 'contrato'` e `codigo`. **`codigo` é identificador de negócio da própria empresa, não segredo** — é o que torna a trilha auditável. Valor mensal, valor total e identificadores de pessoa **não** entram na trilha.

Recusa de cliente (`4xx`) **não** é registrada em nível `error` — entrada malformada entrando na trilha em nível `error` é ruído no sinal que a §13 usa para alertar.

---

## 11. Segurança

### 11.1 Autenticação

Sessão `better-auth` por cookie, com barreira única de admissão e `versaoPermissoes` por pessoa relido quando diverge. **Nada novo nesta fatia**: as 8 rotas passam pela mesma guarda das 33 existentes, e a sessão sem empresa é recusada num ponto único (`sobContextoDaSessao`).

### 11.2 Autorização

Duas dimensões independentes (ADR-0011), com **default que nega**: rota que não declara nada é recusada com `403`. As 8 rotas declaram a dimensão de **chave**, nunca a de perfil — é o que permite ao Admin conceder e retirar o alcance por ajuste individual, com a negação individual vencendo a matriz do perfil (ADR-0010).

**O catálogo é fechado e não cresce.** As três ações que a fatia usa — `ACAO:ativar_contrato`, `ACAO:cancelar_contrato`, `ACAO:excluir_cadastro` — e a área `TELA:contratos` **já existem** desde a fase de autorização. Precisar de chave nova seria sinal de escopo mal delimitado.

**Consequência da coerência ação↔tela, que precisa estar declarada**: `MAPA_ACAO_TELA` associa `ACAO:excluir_cadastro` a `TELA:cadastros`, e `validarCoerenciaDeAjustes` exige que quem tem a ação tenha também a tela dela. Logo, retirar um **contrato** de circulação exige, de fato, `TELA:contratos` **e** `ACAO:excluir_cadastro` **e** (por coerência do ajuste) `TELA:cadastros`. Não é anomalia desta fatia: é exatamente o que já vale para as rotas de circulação de conjunto e de imóvel, que vivem sob `TELA:imoveis`.

**Cobertura verificada sobre a superfície publicada** (ADR-0018): a verificação confere **existência e conteúdo** — nenhum manipulador exige menos do que a classe dele. As âncoras a atualizar:

| Âncora | Antes | Depois (**esperado**) | Delta |
|---|---|---|---|
| `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` | 51 | 60 | **+9 manipuladores** — as 8 rotas de contrato mais a de situação de locação (§4.1.2) |
| `ROTAS_PUBLICADAS_EM_PRODUCAO` (`rotasEnumeradas`) | 66 | 75 | **+9** — um por manipulador publicado |
| `semDeclaracao` | `[]` | `[]` | inalterado |

> **O delta é o que esta spec fixa; os valores absolutos são esperados e têm de ser reconferidos.** As duas contagens são **refeitas do zero**, por varredura dos decoradores de rota em `apps/api/src`, e **não derivadas uma da outra** — derivar uma da outra faria um erro de contagem passar despercebido. A alteração de âncora de teste carrega a linha `SUT_IS_CORRECT_BECAUSE`, como a fatia anterior fez a cada crescimento; sem ela, alterar um teste que reprovou é fraude de gate.
>
> ⚠️ **Esta seção escreveu `77` até 2026-08-09, e o `+2` vinha de uma premissa que a medição REFUTOU**: *"cada rota `GET` entra em dobro na tabela do roteador (`GET` e `HEAD`)"*. É falso contra o módulo implementado — `apps/api/src/autenticacao/cobertura-de-autorizacao.ts` **suprime explicitamente** o `HEAD` derivado de `GET` (o mapa `semHeadDerivado`), e foi por isso que a T6 contou **6 pares para 6 rotas**, das quais duas eram `GET`. O valor medido é **75**, e é o que as âncoras executáveis carregam desde a T10. Os **60 manipuladores batem exatamente**, o que localiza o erro na soma do total e não no escopo entregue. Registrado como **D45** na §2 do `_run/run-report.md`; a correção veio na intervenção dirigida de 2026-08-09. **Não "corrija" para 77.**

### 11.3 Criptografia

Nada novo. Sem segredo, sem chave, sem dado cifrado nesta fatia. `pdfContratoArquivo` guarda **caminho**, nunca bytes.

### 11.4 Sanitização e Validação

Toda entrada passa por Zod `strictObject` antes de qualquer instrução. **Nenhuma cadeia é interpolada em SQL**: as consultas são template literals do driver, e os fragmentos reusados (projeção, predicado de circulação, `empresaDoContexto`) são constantes de módulo sem interpolação de valor externo.

**O único ponto de SQL dinâmico da fatia é o `format('… %I …')` das duas funções do banco**, e ele é seguro por construção: o nome da sequência é derivado de `p_ano` (inteiro) e do `empresa_id` do contexto (convertido para `uuid` — o cast recusa qualquer coisa que não seja UUID), e `%I` cita o identificador. Nenhum dos dois vem de texto do cliente.

**A canonização de caixa acontece num ponto** — o esquema do código, em `@sysloc/contracts`. É a mesma razão medida que produziu a canonização do UUID na fatia anterior: um código citado em minúsculas na URL e comparado com o valor gravado responderia `false` sobre o mesmo contrato. Normalizar em dois pontos deixa os dois livres para divergir, e é a repetição, não a transformação, que reabre o defeito.

### 11.5 Rate Limiting / Anti-abuse

Nada específico. O limitador de taxa da fase de autorização governa a autenticação; rota de negócio autenticada não tem eixo próprio nesta fatia.

### 11.6 Secrets Management

Nada novo. Nenhum segredo é lido, gravado ou versionado aqui.

---

## 12. Performance

### 12.1 Metas

O produto atende **de 20 a 300 empresas**, com volume medido de **~20 contratos por empresa por ano**. Não há meta numérica de latência declarada no projeto, e inventar uma aqui seria requisito sem fonte. O que a fatia se obriga a cumprir é a propriedade que a fatia anterior fixou e que **é** verificável:

> **o número de consultas ao banco de uma leitura de coleção não depende do número de itens dela.**

### 12.2 Estratégias

- **Leitura em lote em todos os níveis.** `lerContratosVigentesDeImoveis(tx, imoveisIds)` recebe **a lista** e emite **uma** consulta, no mesmo molde de `lerComodosDeImoveis` e `lerImoveisDeConjuntos`. O mesmo vale para os fiadores: `lerFiadoresDeContratos(tx, contratosIds)`.
- **Índices que cobrem o que as consultas pedem**: `(empresa_id, retirado_em)` para a listagem padrão, `(empresa_id, imovel_id)` para o contrato vigente, `(empresa_id, contrato_id)` para os fiadores.
- **Paginação com teto que recusa** em vez de truncar — herdada de `esquemaDaJanela`.
- **`total` e a página lidos na mesma transação**, sempre. Lidos separadamente, o total descreveria um conjunto do qual a página já não faz parte.

**Custo medido da apresentação do contrato vigente**, que é o preço aceito no *trade-off* de D2:

| Leitura | Antes | Depois |
|---|---|---|
| `GET /v1/imoveis/:id` | 2 consultas (imóvel, cômodos) | 3 (+ contratos vigentes) |
| `GET /v1/imoveis` | 3 (página, total, cômodos) | 4 |
| `GET /v1/conjuntos?expandir=imoveis` | `INVOCACOES_DA_CARTEIRA = 10` | **11** |

Em todos os casos o número continua **independente de N**, que é a propriedade que o `CT-329 (d)` mede comparando dois cenários de tamanhos diferentes.

### 12.3 Limites Conhecidos

- **Contrato com muitos fiadores reescreve a coleção inteira a cada correção.** Sem teto declarado, é custo teórico: o sistema antigo não impõe limite e o contrato real de produção tem **zero** fiadores.
- **O contador é objeto por escopo.** Com 300 empresas e 10 anos, são 3.000 sequências no schema `negocio`. É irrelevante para o PostgreSQL (são linhas de catálogo), mas **o número aparece** para quem inspecionar o schema, e a guarda de cobertura as ignora por espécie — nenhuma delas entra em `tabelasExaminadas`.
- **A primeira emissão de um escopo serializa**, brevemente, entre criações concorrentes. Uma vez por `(empresa, ano)`.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| Contrato criado | `info` | `empresaId`, `entidade: 'contrato'`, `codigo` | sem valor monetário, sem identificador de pessoa |
| Contrato alterado | `info` | `empresaId`, `entidade`, `codigo` | idem |
| Contrato ativado | `info` | `empresaId`, `entidade`, `codigo`, `imovelId` | idem |
| Contrato cancelado | `info` | `empresaId`, `entidade`, `codigo`, `imovelId` | idem |
| Circulação alterada | `info` | `empresaId`, `entidade`, `codigo`, `acao: 'retirada' \| 'recirculacao'` | idem |
| Falha não prevista | `error` | pilha da exceção | a mensagem da resposta **não** nomeia sessão, pessoa nem empresa |

Pino, JSON, com a redação de credencial instalada por **entrada única de despacho** na F0 — o marcador `DECISÃO FECHADA` daquele ponto não é tocado.

### 13.2 Métricas

| Métrica | Tipo | Labels | SLO Alvo |
|---------|------|--------|----------|
| — | — | — | — |

N/A nesta fatia. O projeto tem OpenTelemetry na stack e **não tem exportador configurado**; instalar um aqui seria trabalho fora do escopo, e declarar SLO sem instrumentação seria promessa sem medição.

### 13.3 Tracing

N/A — ver §13.2. A correlação disponível hoje é o registro estruturado.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| — | — | — | — |

N/A. O sinal existente é o journal do systemd; alertar sobre ele é trabalho da F7.

---

## 14. Feature Flags

### 14.1 Solução

**Nenhuma.** O projeto não tem solução de feature flag, e esta fatia não introduz uma.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

> **`gerarCobrancasAutomaticamente` NÃO é feature flag**, e a distinção importa: é **decisão de negócio por contrato**, informada pelo usuário e persistida na linha, exatamente como no sistema antigo (`Custom Field` do tipo `Check`, padrão `1`). Nesta fatia ela é **apenas registrada** — não tem leitor. Quem a lê é a F3.

---

## 15. Versionamento de API

### 15.1 Estratégia

**Prefixo no caminho** (`/v1`), aplicado globalmente com uma lista explícita de exclusões. Decisão da fatia de fundação; esta fatia a herda sem alterá-la. As 9 rotas novas ficam **dentro** do prefixo.

### 15.2 Compatibilidade

A superfície da API **será congelada no marco de entrega do backend**, e esta é a última fatia da fase de domínio de locação a acrescentar rota de cadastro. Duas consequências para o que se escreve aqui:

- **`esquemaDoImovel` ganha um campo**, e isso é mudança **aditiva** para o consumidor — nenhum campo sai, nenhum tipo se estreita. Mas ela alcança **três** superfícies publicadas de uma vez (`GET /v1/imoveis/:id`, `GET /v1/imoveis`, e a carteira), porque as três derivam do mesmo esquema. É consequência direta da ADR-0016 e é o comportamento desejado: um segundo esquema de imóvel "sem contrato" seria a segunda fonte do mesmo fato.
- **A forma da declaração de efeito da ativação é herdada pela F3.** `efeitos.cobrancasGeradas` é `z.literal(false)` **de propósito**: sendo o valor fechado, a fase que passar a gerar cobrança é **obrigada** a tocar o contrato para afrouxá-lo, e a mudança aparece no diff em vez de acontecer por omissão.

### 15.3 Schemas / Contratos

`@sysloc/contracts` é a fonte única (ADR-0016): a conferência de entrada, o tipo da resposta e o documento OpenAPI publicado saem da mesma declaração — `esquemaPublicado` traduz o mesmo objeto que confere a entrada, e **nenhuma descrição de corpo é escrita à mão**.

O pacote é **folha** e continua sendo: nada em `contrato.ts` importa `@sysloc/db`, `@sysloc/shared` nem o arcabouço HTTP. É a propriedade que o `CT-339` afirma sobre o fonte e sobre o manifesto, e ela é pré-condição do handoff — é este pacote que o React importa.

A publicação no GitHub privado **não acontece nesta fatia**: é entregável do marco.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há CI/CD. A verificação é local e manual, nesta ordem: `pnpm build` → `pnpm lint` → `pnpm test` → os verificadores de shell da fatia. **A baseline é medida antes e depois**, e a contagem de casos é comparada — queda inexplicada é regressão de prova.

### 16.2 Empacotamento

**Nativo, sem Docker.** Node 24 fixado por `mise`, processos supervisionados por unidades `systemd` com `Restart=always`. Nada muda aqui.

### 16.3 Infraestrutura como Código

Sem Terraform/Helm. O provisionamento é `deploy/scripts/instalacao/provisionar-base.sh`, idempotente e versionado (ADR-0005).

> **O provisionamento NÃO é tocado por esta fatia**, e isso precisa estar dito: as duas funções e as concessões vivem na **migração** `0008`, que é o lugar de estrutura de banco. O provisionamento cria papéis e schemas, e a `0008` já roda com o papel que os possui.

### 16.4 Estratégia de Rollout

Aplicação de migração seguida de reinício da unidade, na janela do operador. As migrações `0007` e `0008` são **aditivas** — nenhuma tabela existente é alterada, nenhuma coluna some — e, portanto, o binário antigo continua funcionando com o schema novo. A recíproca não vale: o binário novo exige as duas migrações.

### 16.5 Escalabilidade

Vertical, instância única. O contador por `(empresa, ano)` **não** introduz ponto de serialização entre empresas nem, dentro da empresa, entre criações concorrentes — que é a metade da ADR-0015 que a alternativa da tabela de contador quebrava.

### 16.6 Rollback

**Não há descida de migração** (§7.3). O caminho de volta é restauração de backup — item 1 da F7, e pré-requisito do marco de entrega. Reverter só o código, mantendo o schema, é seguro: as tabelas novas ficam sem escritor.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 | §7.2 `negocio.contrato` · §4.2 `esquemaDeContratoNovo` · §5.1 fluxo de montagem | `negocio.ts`, `contrato.ts` (contracts e db), `contrato.controller.ts`, `contrato.service.ts` |
| US-02 | §6.3 RD-05 · §4.1.1 corpo completo no `PUT` | `alterarContrato`, `substituirFiadoresDoContrato`, `ContratoService.alterar` |
| US-03 | §7.2 `negocio.contrato_fiador` (vínculo puro, sem `retirado_em`) · §6.3 RD-06 | `contrato_fiador`, `lerFiadoresDeContratos`, `substituirFiadoresDoContrato` |
| US-04 | §7.4 mecanismo da série · §4.2 formato do código · marcador `DECISÃO FECHADA` dos 5 dígitos | `garantir_contador_de_contrato`, `proximo_numero_de_contrato`, `formatarCodigoDeContrato`, `contrato_empresa_codigo_key` |
| US-05 | §5.1 fluxo de ativação · §6.3 RD-08, RD-10, RD-11 | `ContratoService.ativar`, `derivacao-de-contrato.ts`, `definirSituacaoDeLocacaoDoImovel` |
| US-06 | §4.2 `esquemaDaAtivacaoDeContrato` com `z.literal(false)` | `contrato.ts` (contracts), `ContratoService.ativar` |
| US-07 | §7.2 `contrato_imovel_vigente_uidx` · §10.1 discriminador do conflito | índice único parcial, `ErroDeImovelComContratoVigente`, `ContratoService` |
| US-08 | §5.1 fluxo de cancelamento · §6.3 RD-11 | `ContratoService.cancelar`, `cancelarContrato`, `definirSituacaoDeLocacaoDoImovel` |
| US-09 | §6.3 RD-14 · §10.1 recusa por circulação | `ContratoService.exigirCadastrosEmCirculacao`, portas de leitura com predicado |
| US-10 | §4.1 `GET /v1/contratos` · §12.2 leitura em lote dos fiadores | `listarContratos`, `lerFiadoresDeContratos`, `envelopeDeLista` |
| US-11 | §4.2 `esquemaDoImovel.contratoVigente` · §12.2 custo medido | `lerContratosVigentesDeImoveis`, `imovel.ts`, `publicar` |
| US-12 | §6.3 RD-15 · §7.4 idempotência | `definirCirculacaoDoContrato`, rotas 7 e 8 |
| US-13 | §11.2 declaração de exigência · ADR-0018 conjunção inteira | `@ExigeChave`, `@ExigeChaves`, `cobertura-de-autorizacao` |
| US-14 | §7.2 FK compostas e `unique(id, empresa_id)` · §7.3 política com `FORCE` | `0007`, `0008`, `verificarCoberturaDeIsolamento` |
| US-15 | §7.2 enum `status_contrato` derivado do contrato · §6.3 RD-03 | `ESTADOS_DO_CONTRATO`, `statusContrato`, `esquemaDoContrato` |
| US-16 | §6.2 aritmética do término e do valor total | `derivarTerminoDaLocacao`, `derivarValorTotal`, golden |
| **— (sem US)** | §4.1.2 a situação de locação sai do corpo do `PUT` e ganha rota própria | `esquemaDeImovelAlterado`, `esquemaDaSituacaoDeLocacao`, `imovel.controller.ts`, `alterarImovel` |

> **A última linha não tem US, e isso está declarado de propósito.** Ela não é funcionalidade pedida: é a correção de um furo que a fatia anterior deixou e que **esta** fatia torna observável — sem ela, `LOCADO` e `contratoVigente` divergiriam no mesmo corpo de resposta, e as US-05, US-08 e US-11 entregariam um estado que a tela não pode acreditar. É trabalho de invariante, não de escopo novo; o critério que ela protege é o CA-05 e o CA-09.

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | NestJS + Fastify | já no projeto | Superfície HTTP |
| ORM / driver | Drizzle + drizzle-kit + postgres.js | já no projeto | Declaração de estrutura, migração e execução |
| Validação / contrato | Zod | já no projeto | Fonte única do contrato (ADR-0016) |
| Banco | PostgreSQL | 18 | Sequência por escopo, RLS forçada, índice único parcial |
| Teste | Vitest + `embedded-postgres` | já no projeto | Instância efêmera própria (ADR-0006) |
| Captura do oráculo | Python 3 + `docker compose` do `/opt/frappe` | existente | Roteiro de caracterização já versionado |

**Nenhuma dependência nova é acrescentada.** Em particular, **nenhuma biblioteca de datas**: a aritmética de virada de mês é de poucas linhas, e a razão de escrevê-la é justamente que o comportamento seja **declarado por nós** e provado contra o oráculo, em vez de herdado por acaso de uma terceira implementação que ninguém declarou como contrato.

---

## 19. Estratégia de Testes

> **Resumo**: **34 casos** de teste | Unitários: 6 | Integração: 10 | E2E: 18
> **Padrão**: Vitest + `embedded-postgres` (instância efêmera própria) para unitário e integração; Vitest exercitando **HTTP real** em porta dinâmica para E2E; **Bash** com o vocabulário `caso`/`ok`/`falhar`/`afirmar_igual`/`fechar_caso` para o oráculo. **Mock é evitado por decisão** — nesta fatia ele não provaria concorrência, isolamento nem equivalência com o sistema antigo, que são as três coisas que a fatia existe para provar. Rastreabilidade `CA-xx → CT-xxx (RN-xx)`, com seção de INVARIANTES por arquivo. Numeração a partir de **CT-401** (os IDs até CT-355 já estão em uso).
>
> **Vinte e nove casos vieram do `agent-spec-qa-test-generator`; quatro são acréscimo do arquiteto** — CT-430 a CT-433 —, e estão marcados como tal. Eles fecham lacunas que a validação do Passo 5 encontrou: a ausência declarada de coluna no vínculo, os privilégios da migração autoral, o eixo de fuso horário e **a frente shell inteira**, que o gerador não emitiu.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | Contrato criado como rascunho num único envio | CT-408 |
| CA-02 | Alterar rascunho preserva o código; ativo/cancelado recusa | CT-409 |
| CA-03 | Zero, um ou vários fiadores; congelam na ativação | CT-408, CT-410, CT-430 |
| CA-04 | Código `CTR-{ano}-{5 dígitos}`, único por empresa, número nunca reusado | CT-403, CT-404, CT-405, CT-406, CT-408, CT-428, CT-431 |
| CA-05 | Ativar torna o contrato ativo e o imóvel locado | CT-413, CT-434 |
| CA-06 | A ativação declara que as cobranças não foram geradas | CT-413, CT-429 |
| CA-07 | Segundo contrato sobre imóvel ocupado é recusado | CT-407, CT-414 |
| CA-08 | Rascunho inapto é recusado, como no sistema antigo | CT-401, CT-411, CT-433 |
| CA-09 | Cancelar libera o imóvel e desfaz o vínculo | CT-415, CT-434 |
| CA-10 | Cancelado permanece na carteira; recusa nova transição | CT-415 |
| CA-11 | Cadastro fora de circulação recusado ao montar e ao ativar | CT-412 |
| CA-12 | Retirar imóvel ocupado é aceito, sem recusa por vínculo | CT-416 |
| CA-13 | Carteira de contratos com código, partes, termos e estado | CT-418 |
| CA-14 | Contrato vigente apresentado nas consultas de imóvel | CT-419, CT-420 |
| CA-15 | Retirada de circulação do contrato é só de visibilidade | CT-417 |
| CA-16 | Sem a ação de ativar: cria rascunho, não ativa | CT-425, CT-427 |
| CA-17 | Sem a ação de cancelar: o contrato permanece vigente | CT-426, CT-427 |
| CA-18 | Isolamento entre empresas, sem conferência da aplicação | CT-406, CT-421, CT-422, CT-423, CT-431 |
| CA-19 | Estado em campo único, lista fechada de quatro | CT-424 |
| CA-20 | Data de fim e valor total derivados, iguais ao sistema antigo | CT-401, CT-402, CT-413, CT-432, CT-433 |

**Validação reversa**: nenhum CT referencia CA inexistente. O `CT-423` declarava também `RN-01` no retorno do gerador — é regra de negócio, não critério de aceite; ela é a **razão** do caso, e o critério que ele valida é o CA-18.

**Ordem de execução obrigatória**: os CT-401, CT-402, CT-411 e CT-433 dependem de `golden/contrato-ativacao.json` e `golden/contrato-cancelamento.json` **já existirem**. Eles são produzidos pela **Fase 1 (Oráculo)** desta mesma fatia; rodar a captura antes não é conveniência, é pré-condição.

---

### 19.1 Testes Unitários

#### Domínio: derivações do contrato (`packages/db/test/derivacao-de-contrato.spec.ts`)

Mock: **nenhum** — as duas funções são puras e não tocam banco, relógio nem requisição.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-401 | término da locação reproduz o oráculo, inclusive na virada de mês | CA-20, CA-08 | Para todo par `(dataInicio, prazoMeses)` do golden, a data de fim é **byte a byte** igual à do sistema antigo — inclusive início em dia que não existe no mês de destino | todo cenário do golden, mais `{ '2026-01-31', 1 }` | `'2026-02-27'` (28/02 saturado, menos 1 dia); zero divergência no golden | — | — |
| CT-402 | valor total multiplica em centavos inteiros, sem resíduo binário | CA-20 | O valor total é exato em duas casas e nunca carrega resíduo de ponto flutuante | cenários do golden + par de resíduo achado por busca | igualdade **exata** de número, nunca proximidade | — | — |
| CT-432 | **(arquiteto)** a derivação e a leitura de data não deslocam com o fuso do processo | CA-20 | A data de fim é a mesma em qualquer `TZ` — a aritmética é de calendário sobre cadeia, nunca sobre o relógio local | o mesmo cenário sob `TZ=UTC`, `TZ=America/Sao_Paulo` e `TZ=Pacific/Kiritimati` | cadeia `YYYY-MM-DD` idêntica nos três; o companheiro negativo troca a aritmética por `new Date(...)` local e **reprova** | — | — |

#### Contrato: esquemas de `@sysloc/contracts` (`packages/contracts/test/esquemas.spec.ts` — **existente**, estendido)

Mock: **nenhum**.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|----|-------|----|----------|-------|----------|------|--------------------------|
| CT-424 | o estado aceita só os quatro valores fechados | CA-19 | `status` é união fechada de `{RASCUNHO, ATIVO, CANCELADO, ENCERRADO}`; o quinto valor do sistema antigo é recusado | os 4 válidos; `'RESCINDIDO'`; valor arbitrário | os 4 passam; `'RESCINDIDO'` falha com `issues[0].path === ['status']`; a união tem **exatamente 4** elementos, na ordem | — | — |
| CT-428 | o código é canonizado num ponto e o formato é de 5 dígitos | CA-04 | `trim` + maiúsculas num ponto único; `CTR-{4 dígitos}-{5 dígitos}` é o único formato aceito | `'CTR-2026-00001'`; `'ctr-2026-00001'`; `'  …  '`; `'CTR-2026-0001'`; `'CTR-2026-000001'` | os três primeiros passam canonizados; os de **4 e 6 dígitos** são recusados | — | — |
| CT-429 | a declaração de efeito da ativação é literal `false` | CA-06 | O esquema recusa qualquer valor de `efeitos.cobrancasGeradas` diferente de `false` — é contrato fechado, não comportamento observado | corpo com `false`; corpo com `true` | o primeiro passa; o segundo **falha**, nomeando `efeitos.cobrancasGeradas` | — | — |

> **CT-428 é a rede que o marcador `DECISÃO FECHADA` dos 5 dígitos exige** (P4 do Protocolo Antirregressão): sem ele, "corrigir" o formato para quatro passaria pela suíte.

### 19.2 Testes de Integração

#### Porta de dados + banco real (`packages/db/test/contrato.spec.ts` — **novo**)

Setup: instância efêmera de PostgreSQL por execução, com as migrações `0000`–`0008` aplicadas; contexto de tenant fixado por `contextoDeTenant.executarCom`, **o mesmo mecanismo já publicado** que `isolamento.spec.ts` usa — não é superfície privilegiada, é utilitário de teste existente.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-403 | o código nasce no formato certo e a unicidade é por empresa | CA-04 | Duas empresas **podem** ter o mesmo número no mesmo ano; só `(empresa_id, codigo)` importa | criar em A → criar em B → criar de novo em A | formato `/^CTR-\d{4}-\d{5}$/`; A e B recebem o **mesmo** número; o segundo de A recebe o **próximo** | imite `isolamento.spec.ts`: fixe o contexto com `contextoDeTenant.executarCom` antes de chamar a porta |
| CT-404 | **criação abortada queima o número para sempre** | CA-04 | O número reservado por uma unidade que aborta **nunca** é atribuído a contrato posterior — o furo é do mecanismo | unidade 1 emite N e commita → unidade 2 viola um `check` e desfaz → cria contrato válido | o novo contrato usa **N+1**; nenhuma linha da empresa usa **N** | idem CT-403; chame as funções pela porta, como a borda faz nas duas unidades |
| CT-405 | duas emissões concorrentes não esperam uma pela outra | CA-04 | A metade "não-fila" da ADR-0020: nenhuma chamada bloqueia até o commit da outra, e os números são distintos | duas conexões independentes, `Promise.all` antes de qualquer commit | ambas retornam dentro do limite declarado; **números diferentes** | duas conexões `postgres.js` sob o mesmo contexto |
| CT-406 | a emissão recusa sem contexto e **não aceita empresa por parâmetro** | CA-04, CA-18 | É estruturalmente impossível pedir o contador de outra empresa: a função lê o contexto e levanta se ausente | chamada SQL direta sem `SET LOCAL app.empresa_id` | levanta nomeando o contexto ausente; a introspecção do catálogo confirma que a assinatura **não tem** parâmetro de empresa | imite `isolamento.spec.ts` (CT-005): conexão sem contexto fixado |
| CT-407 | **duas ativações simultâneas: uma passa, a outra o banco recusa** | CA-07 | A exclusão mútua é do índice único parcial, **não** de uma leitura-antes-de-gravar — que perderia a corrida | dois rascunhos sobre o mesmo imóvel → duas transações → commits em paralelo | exatamente **uma** commita; a outra recebe `23505` nomeando `contrato_imovel_vigente_uidx` e segue `RASCUNHO` | duas transações independentes, no molde do CT-405 |
| CT-430 | **(arquiteto)** `contrato_fiador` **não tem** coluna `retirado_em` | CA-03 | A ausência é a decisão (ADR-0014 exclui vínculo). A guarda de cobertura **não** a acusaria — ela não cobra `retirado_em` de ninguém | consulta a `pg_attribute` para a tabela | a coluna **não existe**; o companheiro positivo confirma que as seis entidades de cadastro **têm** a coluna | imite `catalogo.spec.ts` (CT-317, mesma afirmação para o cômodo) |
| CT-431 | **(arquiteto)** o papel da aplicação executa as funções e **não** alcança a sequência | CA-04, CA-18 | O privilégio novo é **só** `EXECUTE`; conceder `USAGE ON SEQUENCES` abriria um segundo caminho para o número, fora do escopo imposto pela função | conectado como `sysloc_app`: `SELECT negocio.proximo_numero_de_contrato(…)` e `SELECT nextval('negocio.<sequência>')` | a primeira **funciona**; a segunda é recusada por privilégio insuficiente; `PUBLIC` também é recusado | imite `papel-de-conexao.spec.ts`: conecte com a cadeia do papel de aplicação, não a de migração |

#### Cobertura e agregado (`packages/db/test/catalogo.spec.ts` · `janela.spec.ts` — **existentes**, estendidos)

Setup: instância efêmera; para a falsificação, instância **dedicada** com a migração alterada.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-421 | a guarda examina as duas tabelas novas e ignora a sequência | CA-18 | As duas nascem com as quatro propriedades; a sequência não é examinada por espécie (`relkind = 'S'`) | guarda sobre schema íntegro → guarda sobre instância sem `FORCE` em `negocio.contrato` | `excecoes: []` e as duas em `tabelasExaminadas`; a sequência **não** aparece; sem `FORCE`, a exceção é `RLS_NAO_FORCADA` nomeando a tabela | imite `catalogo.spec.ts` (CT-301), que já faz isso para `negocio.imovel` |
| CT-420 | a carteira sobe de 10 para 11 invocações, e o número não depende de N | CA-14 | A leitura do contrato vigente é **em lote**: uma consulta para qualquer número de imóveis | carteira pequena → carteira grande, contando invocações do executor | `INVOCACOES_DA_CARTEIRA === 11` na pequena; **o mesmo número** na grande | imite `janela.spec.ts` (CT-329 d), que já instrumenta o executor por `Proxy` |

#### Oráculo — **frente shell** (`deploy/scripts/caracterizacao/verificar-golden.sh` — **existente**, estendido)

Setup: nenhum banco. Roda **offline**, sobre os artefatos versionados. Vocabulário `caso`/`ok`/`falhar`/`afirmar_igual`/`fechar_caso`, com o ID literal no `caso "CT-433 …"`.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------|-------|-----------|--------------------------|
| CT-433 | **(arquiteto)** os dois artefatos novos existem, têm forma e mantêm a bijeção com o manifesto | CA-08, CA-20 | A extensão é **acréscimo**: os 6 artefatos anteriores continuam íntegros, e toda máscara declarada no manifesto tem marcador presente nos artefatos — e vice-versa | `git ls-files` sobre `golden/` → forma dos dois artefatos → bijeção máscara ↔ marcador → procedência | **9** caminhos (era 7); os dois novos declaram cenário de ativação e de cancelamento; nenhuma máscara órfã nos dois sentidos; o manifesto nomeia o dump, o horário e o commit | frente shell — **não** transportar para Vitest: é observável inspecionando git e filesystem |

> **`verificar-captura.sh` exige o site efêmero de pé e `sudo` para o `docker compose`.** Nenhum subagente consegue executá-lo: quando um gate precisar dele, a execução é conduzida junto ao operador e o gate audita a saída preservada, reportando `executou_testes: false` — o que reflete o papel dele, **não** suíte pulada.

### 19.3 Testes End-to-End (E2E)

Todos em `apps/api/test/`, exercitando **HTTP real** contra a aplicação montada como em operação, com banco efêmero e sessão obtida pela **rota de entrada real**. Arquivo novo `contratos.e2e.spec.ts`, salvo onde indicado.

**Precondição privilegiada, comum a quase todos**: a sessão precisa das chaves concedidas — o perfil-piso do Usuário Empresa só tem `TELA:resumo`. O caminho legítimo é o `conceder`/`escreverAjustes` sob `contextoDeTenant.executarCom` que `carteira.e2e.spec.ts` e `circulacao-de-cadastro.e2e.spec.ts` já usam. **Nenhum símbolo de produção é exportado nem criado para teste.**

#### Fluxo: montar o contrato num único envio (CT-408)
- **Framework**: Vitest + HTTP real em porta dinâmica
- **CA**: CA-01, CA-03, CA-04
- **Objetivo**: montar com imóvel, locador, locatário, termos e **zero, um ou três** fiadores é um envio só; o contrato nasce `RASCUNHO`, com código, e **ainda não vale**
- **Pré-condições**: cadastros em circulação; sessão com `TELA:contratos` (imite `carteira.e2e.spec.ts`, função `conceder`)
- **Passos**: `POST /v1/contratos` para cada sub-caso de fiador → ler o imóvel referenciado
- **Validações**: `201`; `status: 'RASCUNHO'`; código no formato; `dataFimLocacao` e `valorTotalContrato` **nulos**; a lista de fiadores bate com a enviada; `GET /v1/imoveis/:id` responde `contratoVigente: null` — **o rascunho não vale**

#### Fluxo: alterar só enquanto rascunho, preservando o código (CT-409)
- **CA**: CA-02 · **Objetivo**: o `PUT` é aceito só em `RASCUNHO`, nunca muda o código, e as duas recusas não gravam nada
- **Pré-condições**: um contrato em cada estado; `TELA:contratos` + `ACAO:ativar_contrato` para montar o arranjo
- **Passos**: `PUT` no rascunho → `PUT` no ativo → `PUT` no cancelado → reler os dois recusados
- **Validações**: `200` com código **inalterado**; `422 CAMPO_INVALIDO`, `campo: 'status'`, `detalhes.estadoAtual` nos dois; releitura **byte a byte igual** à de antes da tentativa

#### Fluxo: fiadores substituídos por inteiro, congelados na ativação (CT-410)
- **CA**: CA-03 · **Objetivo**: o `PUT` **substitui** a coleção (não faz mescla); depois da ativação a lista é intocável, pela guarda do **pai**
- **Passos**: criar com `[F1, F2]` → `PUT` com `[F2, F3]` → ativar → `PUT` com `[F3]`
- **Validações**: a lista fica **exatamente** `[F2, F3]` (F1 sai, sem sobra); a última tentativa é `422 campo status`; releitura mostra `[F2, F3]` intactos

#### Fluxo: condições de entrada inválidas recusadas nomeando o campo (CT-411)
- **CA**: CA-08 · **Objetivo**: prazo `≤ 0`, valor `≤ 0`, dia fora de 1–28 e data ausente **nunca** produzem contrato
- **Pré-condições**: contagem **crua** de `negocio.contrato` antes de cada tentativa
- **Passos**: tabela de recusas, no molde de `RECUSAS[]` do `CT-345`
- **Validações**: cada linha responde `422 CAMPO_INVALIDO` nomeando o campo; a contagem crua **não muda**

> **Ressalva do gerador, e a resposta do arquiteto**: ele observou que as quatro condições numéricas são garantidas por `check` e `NOT NULL` **já na criação**, e por isso a recusa observável ocorre ali. Está correto, e é consequência do desenho de §6.1 — nesta spec **não há campo opcional na criação**. As duas condições restantes da RN-08 (imóvel e locatário vinculados) são `NOT NULL` de coluna, logo igualmente inalcançáveis na ativação. **O que a ativação re-confere, e o que o CT-412 prova, é a circulação** — que pode ter mudado entre montar e fazer valer.

#### Fluxo: cadastro fora de circulação recusado ao montar **e** ao ativar (CT-412)
- **CA**: CA-11 · **Objetivo**: as quatro referências recusam nos dois momentos, nomeando o campo
- **Pré-condições**: `TELA:contratos` + `ACAO:ativar_contrato` + `ACAO:excluir_cadastro`; os cadastros retirados **pela rota real**, nunca por `UPDATE` direto (imite `circulacao-de-cadastro.e2e.spec.ts`)
- **Passos**: retirar imóvel, locador, locatário e fiador → tentar montar apontando cada um → montar rascunho válido, retirar o locatário dele, tentar ativar
- **Validações**: `422 CAMPO_INVALIDO` com `campo` correto e `detalhes.circulacao: 'RETIRADO_DE_CIRCULACAO'` nos oito casos; o contrato do último passo **permanece rascunho**

#### Fluxo: ativação bem-sucedida, com derivação e efeito no imóvel (CT-413)
- **CA**: CA-05, CA-06, CA-20 · **Objetivo**: um commit só que transita o estado, deriva as duas grandezas, marca o imóvel e declara o que **não** fez
- **Dados**: `dataInicioLocacao: '2026-01-31'`, `prazoMeses: 1`, `valorMensal: 1500.00` — o caso de virada de mês, o mesmo do CT-401
- **Validações**: `200`; corpo **inteiro por igualdade**: `status: 'ATIVO'`, `dataFimLocacao: '2026-02-27'`, `valorTotalContrato: 1500`, `efeitos: { cobrancasGeradas: false }`; o imóvel responde `statusLocacao: 'LOCADO'` e `contratoVigente: { codigo, locatario: { id, nome } }`; a releitura do contrato é igual ao corpo da ativação **menos** `efeitos`, que só existe na resposta da transição

#### Fluxo: segunda ativação sobre imóvel ocupado (CT-414)
- **CA**: CA-07 · **Objetivo**: a tradução HTTP do `23505` em `422`, com a informação que decide o próximo passo do usuário
- **Validações**: `422`, `campo: 'imovelId'`, `detalhes.conflito: 'IMOVEL_COM_CONTRATO_VIGENTE'` **e o código do vigente**; o segundo segue `RASCUNHO`; o imóvel e o vigente **inalterados**
- **Nota**: é o par **sequencial** do CT-407, que prova a mesma exclusão sob **concorrência**, no nível do banco. Nenhum dos dois substitui o outro

#### Fluxo: cancelamento e as quatro transições inválidas (CT-415)
- **CA**: CA-09, CA-10 · **Objetivo**: cancelar libera o imóvel; ativar-ativo, ativar-cancelado, cancelar-rascunho e cancelar-cancelado são recusados sem efeito colateral
- **Validações**: `200` com `CANCELADO`, imóvel `DISPONIVEL` e `contratoVigente: null`; as quatro recusas são `422 campo status` com `estadoAtual`/`transicaoPedida` corretos; **o cancelado continua listado na carteira**

#### Fluxo: retirar de circulação imóvel ocupado é aceito (CT-416) — em `circulacao-de-cadastro.e2e.spec.ts`
- **CA**: CA-12 · **Objetivo**: **ausência de recusa por vínculo** — a asserção negativa é sobre não haver `4xx`
- **Validações**: `200` com `retiradoEm` preenchido; o imóvel continua `LOCADO` e `contratoVigente` continua apontando o mesmo contrato; o contrato continua `ATIVO` com `imovelId` inalterado
- **Nota**: **estende** a suíte existente em vez de abrir arquivo novo — a montagem de retirada/recirculação de imóvel já vive lá, e duplicá-la criaria duas montagens do mesmo fato

#### Fluxo: circulação do contrato é ortogonal ao estado (CT-417)
- **CA**: CA-15 · **Objetivo**: alcança os três estados alcançáveis, **não transita nada**, **não libera o imóvel**, é idempotente e reversível
- **Passos**: retirada + recirculação sobre `RASCUNHO`, `ATIVO` e `CANCELADO`; retirada repetida; retirada com corpo não vazio
- **Validações**: `200` com estado **inalterado** nos três; o imóvel do ativo **permanece `LOCADO`**; a repetição devolve corpo profundamente igual; corpo não vazio é `422 campo 'corpo'` com a marca intocada
- **Nota**: `ENCERRADO` fica fora da tabela por não ter produtor nesta fatia

#### Fluxo: carteira de contratos numa consulta só (CT-418)
- **CA**: CA-13 · **Objetivo**: código, partes, termos e estado no mesmo envelope, sem segunda consulta
- **Validações**: `200` com os campos de termo em cada item; `{ itens, total, limite, deslocamento }` conforme a ADR-0017; `limite=201` responde `422 campo 'limite'` — **recusa, não trunca**

#### Fluxo: o contrato vigente nas três superfícies de imóvel (CT-419) — em `carteira.e2e.spec.ts`
- **CA**: CA-14 · **Objetivo**: consistência de `contratoVigente` em `GET /v1/imoveis/:id`, `GET /v1/imoveis` e `GET /v1/conjuntos?expandir=imoveis`
- **Validações**: imóvel ocupado traz `{ codigo, locatario: { id, nome } }` nas três; imóvel sem contrato vigente — **inclusive o que só tem rascunho** — traz `null` nas três
- **Nota**: **estende** a suíte existente, que já monta a carteira expandida e a listagem

#### Fluxo: contrato de outra empresa é inalcançável nas cinco operações (CT-422)
- **CA**: CA-18 · **Objetivo**: a recusa é o `404` uniforme, e **não depende de conferência da aplicação**
- **Pré-condições**: duas sessões, uma por empresa, **ambas com as quatro chaves concedidas** — sem isso o `403` mascararia o `404` e o caso não provaria isolamento
- **Passos**: da sessão de B: `GET`, `PUT`, `/ativacao`, `/cancelamento`, `/retirada` sobre o código de A; depois, controle positivo pela sessão de A
- **Validações**: as cinco respondem `404 RECURSO_NAO_ENCONTRADO` com corpo **idêntico** ao de código inexistente; o contrato de A permanece intacto

#### Fluxo: cruzar imóvel de uma empresa com pessoa de outra (CT-423)
- **CA**: CA-18 (RN-01) · **Objetivo**: o cruzamento é recusado **sem vazar** qual identificador existe alhures
- **Validações**: `404` canônico; a contagem crua de contratos **não muda em nenhuma das duas empresas**; o controle positivo com o locatário de A responde `201`

#### Fluxo: sem a ação de ativar, monta mas não faz valer (CT-425)
- **CA**: CA-16 · **Objetivo**: a área basta para montar; ativar exige a ação **além** da área
- **Pré-condições**: a **ausência** da chave é afirmada por `GET /v1/sessao` **antes** da tentativa — imite `circulacao-de-cadastro.e2e.spec.ts` (CT-354). Sem essa afirmação, o `403` poderia vir de outra causa e o caso não provaria nada
- **Validações**: `201` no `POST`; `403 ACESSO_NEGADO` com `detalhes.exigido: 'ACAO:ativar_contrato'`; o contrato segue `RASCUNHO` e o imóvel `DISPONIVEL`

#### Fluxo: sem a ação de cancelar, o contrato permanece vigente (CT-426)
- **CA**: CA-17 · **Objetivo**: cancelar exige ação própria, **independente** de quem pode ativar
- **Validações**: `403` com `detalhes.exigido: 'ACAO:cancelar_contrato'`; o contrato segue `ATIVO` e o imóvel `LOCADO`

#### Fluxo: o `PUT` de imóvel não desfaz o `LOCADO`, e a rota de situação é o único caminho (CT-434) — **acréscimo do challenge**
- **CA**: CA-05, CA-09 · **Objetivo**: a situação de locação de um imóvel com contrato vigente é **irrepresentável** como divergente do estado do contrato — nenhuma resposta traz `statusLocacao: 'DISPONIVEL'` junto de `contratoVigente` preenchido
- **Pré-condições**: imóvel com contrato `ATIVO`; `TELA:imoveis` + `TELA:contratos` + `ACAO:ativar_contrato`
- **Passos**: `PUT /v1/imoveis/:id` com corpo completo **e** `statusLocacao` → `PUT` com o corpo novo (sem o campo) alterando o endereço → `POST /:id/situacao-de-locacao` com `INDISPONIVEL` sobre o imóvel locado
- **Validações**: o primeiro `PUT` responde `422` nomeando `statusLocacao` como chave desconhecida; o segundo responde `200` com o endereço alterado **e `statusLocacao` ainda `LOCADO`**; a rota de situação sobre imóvel locado é recusada com `422 campo statusLocacao`, `detalhes.conflito: 'IMOVEL_COM_CONTRATO_VIGENTE'`
- **Companheiro negativo / falsificação**: devolver `statusLocacao` ao esquema de alteração **e** reativar a escrita da coluna em `alterarImovel` — o caso tem de reprovar **nos dois** mutantes, aplicados isoladamente. Um mutante só não discrimina: reaceitar o campo sem escrever a coluna passaria despercebido por uma asserção que só olhasse o corpo da resposta

#### Fluxo: cobertura de autorização sobre a superfície publicada (CT-427) — em `cobertura-de-autorizacao.e2e.spec.ts`
- **CA**: CA-16, CA-17 · **Objetivo**: as quatro rotas governadas declaram a **conjunção inteira**, na ordem área→ação; nenhum manipulador fica sem declaração; a contagem estrutural bate com as âncoras
- **Validações**: `rotasEnumeradas === 75`; manipuladores examinados `=== 60`; `semDeclaracao === []`; a estrutura confirma `TELA:contratos` **seguido** da ação própria nas quatro
- **Falsificação obrigatória**: declarar `@ExigeChave` só com a ação numa das quatro — a guarda tem de acusar o manipulador **pelo nome**, no mesmo molde do `CT-355`
- **Nota**: os valores `75` e `60` são os **esperados** de §11.2 — as 8 rotas de contrato mais a de situação de locação — e têm de ser reconferidos por varredura, com a linha `SUT_IS_CORRECT_BECAUSE` na alteração das âncoras. Esta linha dizia `77` até 2026-08-09, pela premissa falsa do `HEAD` derivado que a §11.2 agora refuta por extenso

### 19.4 Cenários de Erro

| Cenário | CA | Objetivo | Trigger | Status / Log Esperado |
|---------|----|----------|---------|------------------------|
| Prazo, valor, dia de vencimento ou data de início inválidos | CA-08 | Nenhum contrato nasce inapto; a recusa nomeia o campo | `prazoMeses: 0` · `valorMensal: 0` · `diaVencimento: 0` ou `29` · data ausente | `422 CAMPO_INVALIDO` nomeando o campo; contagem crua inalterada; **sem linha `error`** no journal |
| Cadastro referenciado fora de circulação | CA-11 | A recusa carrega a informação que resolve a situação | `imovelId`/`locadorId`/`locatarioId`/`fiadoresIds[n]` retirado, na montagem **e** na ativação | `422 CAMPO_INVALIDO`, `detalhes.circulacao: 'RETIRADO_DE_CIRCULACAO'` |
| Transição de estado inválida | CA-02, CA-10 | A máquina de estados é do servidor e recusa o que não é caminho | ativar `ATIVO`/`CANCELADO`; cancelar `RASCUNHO`/`CANCELADO`; alterar não-rascunho | `422 CAMPO_INVALIDO`, `campo: 'status'`, `detalhes: { estadoAtual, transicaoPedida }`; nada muda |
| Imóvel já com contrato vigente — **sequencial** | CA-07 | A tradução do `23505` em recusa nomeada | ativar segundo contrato sobre imóvel ocupado | `422`, `campo: 'imovelId'`, `detalhes.conflito` + código do vigente |
| Imóvel já com contrato vigente — **concorrente** | CA-07 | A exclusão é do banco, imune à corrida | dois commits em paralelo | exatamente um commita; o outro recebe `23505` de `contrato_imovel_vigente_uidx` |
| Corpo não vazio numa rota de ato | CA-15 | O estado nunca é escolhido pelo cliente | `POST …/retirada` com `{ qualquerCampo: 1 }` | `422 CAMPO_INVALIDO`, `campo: 'corpo'`; marca inalterada |
| `:codigo` malformado | CA-04 | A forma do identificador não vira oráculo de existência | `'CTR-2026-0001'`, `'ctr-…'` fora do padrão | `422 CAMPO_INVALIDO`, `campo: 'codigo'`, **sem tocar o banco** |
| Janela acima do teto | CA-13 | Recusa em vez de truncar em silêncio | `?limite=201` | `422 CAMPO_INVALIDO`, `campo: 'limite'` |
| Sem a chave exigida | CA-16, CA-17 | O default nega, e a recusa nomeia a primeira ausente | sessão sem `ACAO:ativar_contrato` / sem `ACAO:cancelar_contrato` | `403 ACESSO_NEGADO`, `detalhes.exigido` com a chave que falta |
| Contrato ou cadastro de outra empresa | CA-18 | As duas causas da ausência são indistinguíveis | as cinco operações de B sobre o código de A; cruzar imóvel de A com pessoa de B | `404 RECURSO_NAO_ENCONTRADO`, corpo **idêntico** ao de inexistente |
| Emissão sem contexto de empresa | CA-04, CA-18 | A função do banco não tem como servir outra empresa | `SELECT negocio.proximo_numero_de_contrato(2026)` sem `app.empresa_id` | levanta nomeando o contexto ausente; nenhuma sequência criada nem avançada |
| Sequência alcançada diretamente pelo papel da aplicação | CA-18 | O privilégio novo é **só** `EXECUTE` | `SELECT nextval('negocio.<sequência>')` como `sysloc_app` | recusa por privilégio insuficiente |
| `FORCE ROW LEVEL SECURITY` ausente numa tabela nova | CA-18 | Não existe terceiro estado: ou nasce protegida, ou reprova | instância dedicada com o `FORCE` retirado de `negocio.contrato` | a guarda acusa `RLS_NAO_FORCADA` nomeando a tabela |

### Cenários deliberadamente não cobertos

| Cenário | Motivo |
|---|---|
| Carga e desempenho da listagem e da emissão concorrente em alto volume | Teste de carga é **proibido por contrato** nesta stack; o eixo que importa — o número de consultas independente de N — é coberto pelo CT-420 |
| Retenção do dado financeiro retido indefinidamente | Dívida já registrada na ADR-0014, **ampliada** aqui em classe de dado. É decisão de produto, não desta fatia (§7.5) |
| Limitador de taxa e tempo limite das rotas de contrato | Não há requisito diferenciado; é preocupação transversal, e o débito **D27 · F1/T6** já a agenda para a publicação atrás do servidor de borda |
| Geração de cobrança na ativação e emissão de boleto | Fora de escopo (RN-12, F3 e F4). O que esta fatia prova é que a **ausência é declarada** — CT-429 e CT-413 |
| A exigência do sistema antigo de PDF para cancelar | **Não portada** por decisão (RN-13). O CT-415 cancela sem qualquer menção a documento, que é a forma de a ausência ficar provada |
| O ramo `contrato_sem_name` da rotina de encerramento | Inalcançável pelo caminho real, como o `PROCEDENCIA.md` já registra para a captura anterior. Forjá-lo produziria referência de comportamento que a produção nunca exibe |

### Notas de execução

1. **A pirâmide é deliberadamente pesada em E2E** — 18 de 34. A invariante central da fatia é uma **máquina de estados governada por permissão de rota**, e ela só é observável de ponta a ponta: é a camada mais baixa que detecta a falha. As três invariantes de maior risco, porém, **têm prova na camada baixa**: o furo e o não-reuso do número (CT-404), a exclusão mútua sob concorrência (CT-407) e as derivações contra o oráculo (CT-401, CT-402).
2. **Prova de falsificação obrigatória** para toda asserção estática (CT-421, CT-427, CT-430, CT-431, CT-433) e, por força do Protocolo Antirregressão, para **todo defeito corrigido**: reintroduza o defeito descrito no companheiro negativo, veja o caso reprovar, reverta.
3. **Mutante sobre fonte de `packages/*` roda SEMPRE pelo script do pacote** — `pnpm --filter @sysloc/<pacote> test` ou `pnpm test`. **`vitest run` avulso é inválido** para trabalho de mutante: os quatro pacotes resolvem `"."` para `dist/`, e o mutante ficaria no fonte sem alcançar o que executa. O modo de falha é silencioso e **inverte a conclusão** — verde lido como "o mutante sobreviveu".
4. **Preserve o par (CT, arquivo de teste)** indicado acima ao distribuir os casos pelas tasks. Seis casos **estendem suítes existentes** em vez de abrir arquivo novo, e trocá-los de lugar recriaria montagens redundantes: CT-416 (`circulacao-de-cadastro`), CT-419 (`carteira`), CT-420 (`janela`), CT-421 (`catalogo`), CT-424/CT-428/CT-429 (`esquemas`), CT-427 (`cobertura-de-autorizacao`).
5. **Baseline antes e depois**, com a contagem comparada. A suíte está em **541 casos**; queda inexplicada é regressão de prova.

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **A janela do oráculo fecha.** A captura depende de o `/opt/frappe` estar de pé e responsivo; regra não capturada agora vira risco que só aparece na virada, sem oráculo para consultar | Baixa | **Alto** | A captura é a **primeira** coisa da fatia, e cobre as regras **inteiras** — inclusive as partes que só a F3 implementa. A parte excedente é insumo arquivado, não backlog |
| **A extensão do roteiro de captura quebra o golden existente.** Os artefatos são de uma fatia **fechada** | Média | Alto | Acréscimo puro sob o Protocolo Antirregressão: nenhum cenário existente muda de forma; a bijeção manifesto ↔ golden permanece verificável; a baseline dos 6 artefatos é comparada antes e depois |
| **A criação lazy do contador reusa o número 00001.** Se a criação e o consumo da sequência ficassem na mesma transação, o desfazimento devolveria o número — contra a cláusula literal da ADR-0015 | Alta se mal feito | Alto | As **duas unidades sequenciais** de §7.4. O caso que prova é o rascunho abortado seguido de criação nova, afirmando que o segundo contrato **não** recebe o número do primeiro |
| **"Simplificar" o índice único parcial para restrição** remove a condição e impede recontratar um imóvel depois do cancelamento | Média | Alto | O bloco de §7.2 declara que o PostgreSQL não admite restrição parcial; caso dedicado ao fluxo cancelar → recontratar; comentário no ponto do código |
| **Unificar a assimetria de `statusLocacao`** desfaz decisão fechada da fatia anterior (R3) | Média | Alto | Porta **estreita** própria para a escrita de `LOCADO`/`DISPONIVEL`; a rota de situação continua tipada em `SituacaoInformavel`; o Protocolo Antirregressão (P2, arqueologia) cobre |
| **Devolver `statusLocacao` ao corpo do `PUT` de imóvel** por parecer "mais simples" reabre o furo de §4.1.2 — o imóvel responderia `DISPONIVEL` com `contratoVigente` preenchido | Média | **Alto** | O ponto do código leva marcador `DECISÃO FECHADA`; o caso CT-434 reprova o `PUT` que aceite o campo, nos dois sentidos (aceitação indevida e escrita indevida da coluna) |
| **`contratoVigente` em `esquemaDoImovel` quebra asserções de corpo inteiro** da fatia anterior, em quatro arquivos de teste | **Alta** | Médio | É crescimento de esquema, não afrouxamento. Cada teste alterado carrega `SUT_IS_CORRECT_BECAUSE`; **nenhuma asserção de igualdade de corpo é trocada por asserção de presença** — trocar seria regressão de prova (R2) |
| **Reproduzir literalmente a máquina de estados do sistema antigo** (que ativa a partir de qualquer estado) contradiria o CA-10 | Média | Médio | §6.3 declara a divergência e o que exatamente o oráculo governa; o comentário no ponto do código impede a "correção" contra o golden |
| **A ordem da conjunção de exigências trocada** é defeito silencioso — nenhuma requisição falha, só o `exigido` fica errado | Média | Médio | Casos que afirmam `detalhes.exigido` nos dois sentidos (tem a área e não a ação; tem a ação e não a área) |
| **Datas deslocadas por fuso** entre o driver e o JSON invalidariam a comparação com o oráculo | Média | Médio | `to_char(…, 'YYYY-MM-DD')` na projeção; funções puras sobre cadeia e `Date.UTC`; caso com fuso do processo alterado |
| **A guarda de cobertura de isolamento reprovar por objeto novo** | Baixa | Médio | A guarda ignora sequências por espécie (`relkind NOT IN (…,'S',…)`), e as duas tabelas nascem com as quatro propriedades. Caso que afirma `excecoes: []` **e** que as duas tabelas constam de `tabelasExaminadas` |
| **`SECURITY DEFINER` como escalada de privilégio.** As funções rodam com os direitos da dona das tabelas | Baixa | **Alto** | `SET search_path` explícito; **nenhuma delas aceita empresa por parâmetro** — leem o contexto e levantam se ausente; `REVOKE ALL … FROM PUBLIC` antes do `GRANT EXECUTE`; o corpo só cria e consome sequência, nunca toca tabela |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

Inventário sobre as **17 ADRs `accepted`** do índice. As três `deprecated` (0002, 0003, 0004) e as duas `superseded` (0007 → 0012 → 0017) ficam fora por status.

| ADR | Classificação | Onde toca, e como esta spec a satisfaz **literalmente** |
|---|---|---|
| **0006** — Ambiente de verificação separado | **APLICÁVEL** | §8. A `Decision` é *"a suíte de verificação nunca executa contra o ambiente que atende a operação"*. A captura toca o site `frontend` **só** com `bench backup`; tudo mais roda em site efêmero. A suíte Vitest sobe instância efêmera própria e ignora `DATABASE_URL` por construção |
| **0008** — Isolamento garantido pelo banco | **APLICÁVEL** | §7.2. As duas tabelas nascem com `empresa_id`, RLS **forçada** e FK composta; §3.3 e §6.3 RD-01 declaram que **nenhum filtro por empresa é escrito na aplicação** — a `Decision` rejeita por escrito a defesa em profundidade |
| **0009** — Fronteira por schema, cobertura no catálogo | **APLICÁVEL** | §7.2, §7.3. As duas tabelas ficam em `negocio`; a cobertura é consultada no catálogo, nunca em lista de exceções; nenhuma exceção é aberta |
| **0010** — Efetivo com overrides bidirecionais | **PARCIAL** | §11.2. A fatia **consome** o efetivo; a dimensão de chave é o que permite conceder e retirar as três ações por ajuste individual. Nada do cálculo é alterado |
| **0011** — Cobertura declarada por rota, default que nega | **APLICÁVEL** | §11.2, §4.1. As 8 rotas declaram exigência na dimensão de chave; o catálogo **fechado** já contém as três ações e a área; nenhuma chave nova é criada — a `Decision` rejeita inflar o catálogo |
| **0013** — Alcance do operador do SaaS | **APLICÁVEL** | §6.3 RD-18. O Master não alcança contrato: a matriz de perfil dele é **vazia**, e as 8 rotas exigem por chave |
| **0014** — Cadastro nunca é apagado | **APLICÁVEL** | §7.5, §6.3 RD-14/RD-15. `contrato` ganha `retirado_em` (a `Decision` o **nomeia** na lista); `contrato_fiador` fica **fora**, pela cláusula literal *"vínculo ou concessão, cuja linha representa estado de relacionamento"*; a recusa por vínculo **não existe** — retirar imóvel ocupado é aceito |
| **0015** — Contador por empresa, furo aceito, número nunca reusado | ⚠️ **SUPERSEDED por [ADR-0033](../../../../adr/0033-serie-declara-o-proprio-escopo-com-furo-aceito.md) em 2026-08-14 — a conformidade abaixo permanece verdadeira sob a decisão vigente** | §7.4. Escopo `(empresa, ano)`, que é literalmente o que a `Decision` declara (*"o contrato inclui o ano no escopo"*); criações concorrentes **não esperam**; furo aceito; e as **duas unidades sequenciais** existem para que o número **nunca seja reusado, nem por criação abortada**. · **Nada nesta fatia mudou**: a 0033 estendeu a política para admitir série de escopo **SaaS** (o identificador bancário da F4), e a 0015 falhava só no quantificador universal *"todo contador… é único por empresa"*. O escopo `(empresa, ano)` do contrato atravessou intacto, e as cláusulas de furo e não-reuso também |
| **0016** — O esquema é a fonte única | **APLICÁVEL** | §4.2, §15.3. Um esquema por forma; o enum do banco **deriva** dos literais publicados; o documento é derivado por `esquemaPublicado`; nada é descrito à mão em paralelo |
| **0017** — Forma canônica, três classes de chave exposta | **APLICÁVEL** | §4.1, §4.2. A `Decision` é literal: *"a chave exposta é o código textual legível quando a entidade tem uma série declarada para ela — hoje contrato e cobrança"* → as rotas são sobre `:codigo` e o UUID **não trafega**. As outras quatro regras: camelCase; `status` calculado no servidor; sucesso no root e lista em `{ itens, total, limite, deslocamento }`; erro com `{ codigo, mensagem, campo?, detalhes? }` de enum fechado |
| **0018** — Conjunção de exigências, cobertura confere conteúdo | **APLICÁVEL** | §4.1, §11.2. As 4 rotas sensíveis declaram a **conjunção inteira** na ordem área→ação; a verificação confere conteúdo, não só existência |
| **0019** — Transição de estado é rota própria governada | ⚠️ **SUPERSEDED por [ADR-0021](../../../../adr/0021-transicao-de-estado-governada-conforme-a-natureza-do-ato.md) em 2026-08-09 — e a interpretação declarada abaixo DEIXOU DE SER interpretação** | §4.1, §4.1.2, §6.3 RD-02. Quatro estados exatamente como a `Decision` os instancia: `RASCUNHO` nasce na criação e **já consome número da série**; `ATIVO` por `ACAO:ativar_contrato`; `CANCELADO` por `ACAO:cancelar_contrato`; `ENCERRADO` sem ator humano nesta fatia. A retirada de circulação é **ortogonal**: não transita nada e não libera o imóvel. **A interpretação**: a rota de situação de locação (§4.1.2) obedece a metade "rota própria, nunca campo em atualização" e **não** a metade "governada por ação sensível" — não há chave para ela no catálogo fechado. Declarada como interpretação, não como conformidade literal; a saída rigorosa é emendar a `Decision` distinguindo transição governada de transição de atributo operacional. · ✅ **E foi exatamente essa a saída tomada**: a **ADR-0021** partiu a governança pela *natureza do ato* — chave de ação para o ato sensível, apenas a área para *"atributo operacional do cadastro, que não transfere direito nem move dinheiro nem altera o que outra entidade pode fazer"* — e **nomeia a situação de locação do imóvel (`contratos-de-locacao`, v1) como instância declarada** dessa segunda classe. Sob a 0021 isto é **conformidade literal**, não interpretação. Leia a 0021, nunca a 0019 |
| **0020** — Número de série emitido por contador do banco fora do desfazimento | **APLICÁVEL** | §7.4. Sequência do próprio banco, um objeto por escopo declarado, avanço fora do desfazimento; escopo `(empresa, ano)`; ponto de criação idempotente e concessão de `EXECUTE`, **sem alargar o papel da aplicação** — a `Decision` e os *Neutros* proíbem nominalmente essa saída |
| **0001** — Cobrança canônica com adaptador por provedor | **N/A** | A fatia não toca cobrança nem provedor bancário |
| **0005** — Rotinas operacionais versionadas | **PARCIAL** | Os scripts de captura estendidos são versionados e não carregam credencial. Nenhuma rotina agendada nova |
| **0012** — Forma canônica (chave por classe de entidade) | **N/A** | `superseded-by: 0017` |
| **0007** — Forma canônica do contrato da API | **N/A** | `superseded-by: 0012` |

**Nenhum conflito spec × ADR foi encontrado**, e nenhum conflito ADR × ADR. Dois pontos onde a conformidade **decidiu o desenho**, e que merecem leitura antes de qualquer simplificação:

1. A **cláusula do não-reuso da ADR-0015** é o que obriga as duas unidades sequenciais (§7.4). A alternativa de uma unidade só é mais simples e **contraria a ADR ao pé da letra**.
2. Os ***Neutros* da ADR-0020** proíbem nominalmente alargar o privilégio do papel da aplicação para criar o objeto de contador. É isso que força as funções `SECURITY DEFINER` em vez de um `GRANT CREATE ON SCHEMA negocio`.

### Candidatos a ADR

Aplicados os 5 critérios canônicos a cada decisão técnica desta spec:

- **Vigência única por imóvel via unicidade condicionada ao estado** — **Candidato a ADR parcial** (`data`, `architecture`). Passa C1 (transversal: qualquer entidade futura com vigência exclusiva sobre outra herda a forma), C2, C3 (trocar depois exige reconciliar dado) e C5 (B1, B2 e B3 avaliadas, com razão registrada). **Falha C4**: não é surpreendente sem contexto — é aplicação direta de um princípio que o projeto já tem canonizado na ADR-0008 (recusa estrutural em vez de conferência de aplicação) a um caso novo. Registrar ADR para ela é churn enquanto não houver um segundo caso que a generalize. É a mesma leitura do tech-alignment §4.
- **Duas unidades de trabalho sequenciais na criação** — **0/5 relevantes**: é corolário forçado da ADR-0015 mais a ADR-0020, e não decisão independente. Fica registrado em §7.4, não como candidato.
- **Declaração de efeito fechada na resposta de transição** (`efeitos.cobrancasGeradas` como literal) — **Candidato a ADR parcial** (`http`, `architecture`). Passa C1 (a F3 e a F4 herdam a forma para emitir boleto e pedir baixa), C4 (um leitor futuro perguntará por que um literal em vez de booleano) e C5 (I1, I2 e I3 avaliadas). **Falha C3** — reverter é trocar um campo de esquema, custo baixo — e **fica na fronteira de C2**. Recomendação: **não registrar agora**; reavaliar na F3, quando o segundo caso existir e a forma tiver sido exercitada.
- **Aritmética de virada de mês declarada por nós, provada contra oráculo** — **1/5**: é decisão de fatia, sem alcance transversal. Registrada em §6.2.

- **Estado de negócio nunca é escrito por atualização do recurso — nem quando não há ação sensível para ele** (§4.1.2) — **Candidato a ADR confirmado, adiado por decisão do usuário** (`state-management`, `architecture`). Nasceu na sessão de challenge de 2026-08-08 e satisfaz os cinco: **C1** — a cobrança da F3 terá o mesmo dilema, com estados que ninguém vai querer expor no corpo; **C2** — `state-management`; **C3** — reverter é devolver o campo ao corpo, reativar a escrita da coluna e refazer os testes das duas fatias; **C4** — um leitor futuro perguntará por que `statusLocacao` está no `POST` e não no `PUT`; **C5** — quatro caminhos avaliados, três rejeitados por razão registrada (recusar todo `PUT` de imóvel locado; aceitar a divergência; débito com gatilho).
  **Por que não foi criada**: a decisão certa não é uma ADR nova — é **emendar a `Decision` da ADR-0019** para distinguir transição governada de transição de atributo operacional. Isso foi oferecido na sessão e o usuário optou por **registrar a leitura na spec** (§4.1.2) em vez de mexer na ADR antes de gerar as tasks. A saída rigorosa fica nomeada, e o comando é `/agent-spec-adr-supersede 0019`.
  ✅ **CUMPRIDO em 2026-08-09**: o comando foi rodado e a **ADR-0021** nasceu — *"Transição de estado de negócio é rota própria, governada conforme a natureza do ato"*. A emenda é exatamente a que este item previa, e o adiamento durou o que devia durar: da sessão de challenge ao fecho da fatia, antes do congelamento da superfície. A 0019 está `superseded-by:0021`.

Nenhuma **outra** decisão desta spec satisfaz os 5 critérios, e as duas ADRs que a fatia precisava (0019 e 0020) já foram registradas antes dela. A distinção `INDISPONIVEL` não impede a ativação (§6.3) fica em **1/5** — é decisão de fatia, sem alcance transversal.

### Terminologia — canonizada na sessão de challenge (2026-08-08)

Sete termos entraram no glossário **global** (`docs/specs/domain-glossary.md`), que passou de 21 para 28. Nenhum glossário-feature foi criado: os sete são cross-feature — a F3 pendura cobrança na ativação, a F5 escreve o encerramento, e a cobrança tem série própria.

| Termo | Nível | Sentido canônico |
|---|---|---|
| **Contrato de locação** | global | O acordo que liga imóvel, locador e locatário sob prazo, valor e datas |
| **Rascunho** | global | O estado em que o contrato nasce: já consumiu o número da série e ainda não vale |
| **Ativação de contrato** | global | O ato deliberado que faz o contrato valer e marca o imóvel como locado |
| **Cancelamento de contrato** | global | O ato deliberado que faz o contrato deixar de valer e devolve o imóvel |
| **Contrato vigente** | global | O contrato ativo que ocupa um imóvel — no máximo um, garantido pelo banco |
| **Série declarada** | global | O conjunto dos códigos legíveis de uma entidade, com escopo e contador próprios |
| **Carteira** | global | O conjunto dos registros de um tipo que a empresa administra — **sempre qualificada** |

**Duas ambiguidades foram resolvidas, e as duas eram colisões reais:**

1. **"Contador sequencial"** nomeava dois números incompatíveis: o do boleto perante o provedor, que a definição canônica declara *"nunca reinicia"*, e o da série do contrato, que **reinicia a cada ano** por decisão da ADR-0015. Resolvido: o primeiro mantém o nome (é exigência do provedor); o segundo é o contador de uma **Série declarada**. A definição do global foi restringida para dizê-lo.
2. **"Carteira"** nomeava a árvore conjunto→imóvel do código e a lista de contratos do PRD. Resolvido: sempre qualificada, e o termo desqualificado não é usado.

Mais três ambiguidades entraram no glossário por serem previsíveis nesta fatia: *cancelar × encerrar* (estados distintos, produtores distintos), *excluir um contrato* (cancelar libera o imóvel; retirar de circulação não) e o alcance da **Retirada de circulação**, que passa a nomear o contrato e a excluir o vínculo com o fiador.

### Débitos com gatilho que esta fatia registra

Dois nascem aqui e **precisam de marcador no código**, mais a linha correspondente no índice do `CLAUDE.md` (§3-B do Protocolo Antirregressão). A numeração sai da §2 do `run-report.md` **desta** fatia, não da sucessão dos marcadores existentes.

| Débito | Onde | Dispara quando |
|---|---|---|
| Pré-condição de PDF no cancelamento **não portada** (RN-13) | `apps/api/src/contratos/contrato.service.ts`, no ponto do cancelamento | A **F3**, que produz o documento do contrato, decide se o carimbo é pré-condição ou efeito |
| Geração de cobranças na ativação **não implementada** — a declaração de efeito é literal | `packages/contracts/src/contrato.ts`, em `esquemaDaAtivacaoDeContrato` | A **F3**, que passa a gerar cobrança e é obrigada a afrouxar o literal |

Dois **débitos existentes não disparam aqui**, e vale registrar por quê: o **D32 · F0/T6** (fila) porque a fatia não enfileira nada (§4.3); e o **D3 · F2/T1** (a segunda definição de `ESQUEMA_DO_IDENTIFICADOR`) porque `usuario.controller.ts` **não** está entre os arquivos desta fatia — o gatilho dele é a primeira task que o abrir por outra razão.

### Pontos deliberadamente fora do escopo, e a fonte de cada um

- **Geração de cobranças, emissão de boletos, baixa Sicoob, PDF do contrato** — F3 e F4, pelo corte por efeito colateral externo do pré-refinamento (~115 LOC ficam, ~400 viram gatilho).
- **`ENCERRADO` ganhar produtor** — F5, com golden próprio já capturado (`encerrar-contratos-vencidos.json`).
- **Semeadura efetiva do contador e migração de dado** — F7. Aqui só se garante que o mecanismo **aceite** valor inicial.
- **Publicação de `@sysloc/contracts`** — marco de entrega.
- **Correção do formato de quatro dígitos** no `plano-execucao.md` e no `CLAUDE.md` — divergência conhecida, sem dono atribuído; o marcador `DECISÃO FECHADA` de §4.2 é a proteção local enquanto isso.
- **Declaração de efeito no cancelamento.** O CA-06 fala **só** da ativação, e RN-12 diz literalmente *"a resposta da ativação declara isso explicitamente"*. Estender ao cancelamento seria inventar contrato sem fonte; fica registrado como escolha, não como esquecimento.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-16 mapeadas em 17, e em 5.3)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6)
- [x] Persistência: tabelas, índices, migrações, transação (seção 7)
- [x] Integrações externas mapeadas (seção 8 — N/A em execução, com o oráculo declarado)
- [x] Sincronização: eventos, idempotência (seção 9)
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13)
- [x] Feature flags listadas (seção 14 — nenhuma, com a distinção declarada)
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura (seção 16)
- [x] Dependências externas listadas (seção 18 — nenhuma nova)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19, com rastreabilidade CA→CT) — **34 casos** (33 do gerador + CT-434 do challenge), os 20 CA cobertos, nenhum CA alucinado. ⚠️ `_run/test-cases.json` tem 33: o CT-434 nasceu no challenge, que não pode escrever naquele arquivo — a §19 é canônica, ver `_run/workflow-report.md`
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21 — inventário de ADRs com conformidade literal, candidatos a ADR, terminologia, débitos com gatilho)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4-3.7)
- [x] Pronto para geração das TASKS
