# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação

- **Feature/Projeto**: `fundacao-bancaria` — identidade por empresa perante o provedor bancário e
  identificador de cobrança único em todo o SaaS. Fatia **(i) de 3** da F4
  (`integracao-bancaria-sicoob`)
- **Variante**: backend
- **Stack**: Node 24 LTS · TypeScript 7 strict · NestJS 11 + Fastify · Drizzle + postgres.js ·
  PostgreSQL 18 · Zod 4 · Vitest + `embedded-postgres` · pnpm + Turborepo + Biome
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-14
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/fundacao-bancaria/v1/prd.md` (Aprovado, 2026-08-14)
- **Tech Alignment**: `docs/specs/features/fundacao-bancaria/v1/tech-alignment.md` (Decidido,
  2026-08-14) — as decisões **D1 a D9** dele são a entrada desta spec e não são redecididas aqui
- **Design Relacionado**: — (variante `backend`; o projeto não escreve frontend)

---

## 2. Resumo Técnico da Solução

A fatia instala **três coisas que a fase inteira consome e nenhuma emissão**. A primeira é a
**identidade por empresa**: `negocio.certificado_do_provedor`, dado da empresa com RLS forçada e
chave estrangeira composta, guardando o material PKCS#12 e a senha que o abre num **envelope único
cifrado com AES-256-GCM**, cuja chave vive fora da árvore versionada (ADR-0032). A segunda é a
**fundação numérica**: o schema **`plataforma`** (ADR-0031), com a sequência do identificador
bancário e a função `SECURITY DEFINER` **sem parâmetro de empresa** que a consome — a ausência de
parâmetro é a declaração de escopo, e é ela que torna irrepresentável o pedido de uma empresa pelo
contador de outra. A terceira é o **pacote `@sysloc/cobranca-bancaria`** (pacotes 6 → 7), que declara
o modelo canônico com **meio de recebimento** (`BOLETO` | `PIX`, o pix sem operação) e a porta
`PortaDeIdentidadeBancaria` com **uma** operação — a que esta fatia exerce —, satisfeita por um
adaptador mTLS construído **por chamada** e descartado no fim do ato.

Duas propriedades atravessam tudo. **O segredo não retorna por superfície nenhuma**, e a garantia é
**medida sobre a saída real** — nunca lida no código: o material e a senha existem como valor apenas
dentro do módulo que os cifra e decifra, e fora dele viajam num invólucro opaco cuja serialização é
`[REDIGIDO]`. **Não há identidade de reserva**: a ausência de material próprio é recusa nomeada,
jamais a identidade de outra empresa.

A superfície publicada sobe de **89/74 para 92/77**, em três rotas do Admin da empresa, e o número é
fechado por **dupla medição independente com a igualdade entre os dois eixos afirmada** — o
precedente são os `CT-533`, `CT-635` e `CT-732`.

> **Quatro medições feitas nesta spec** (2026-08-14), porque o método do projeto é medir antes de
> registrar. Elas estão na §21.1 e decidem, cada uma, um ponto que o tech-alignment deixou aberto ou
> supunha: `undici` **não entra nesta fatia**; o `ZodError` **não ecoa** o valor recusado; o erro de
> OpenSSL **não carrega** a senha nem os bytes; e a redação do registrador **não alcança** os nomes
> que esta fatia introduz.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                   ┌──────────────────────────────────────────────────────────┐
   Admin da        │  apps/api  (NestJS + Fastify)                            │
   empresa ───────▶│  CertificadoDoProvedorController                         │
   (sessão)        │    │  @ExigeChave(TELA:integracoes_bancarias)            │
                   │    │  @ExigeChaves(TELA:…, ACAO:configurar_integracao)   │
                   │    ▼                                                      │
                   │  CertificadoDoProvedorService                            │
                   │    │            │                     │                   │
                   └────┼────────────┼─────────────────────┼───────────────────┘
                        │            │                     │
          ┌─────────────▼──┐   ┌─────▼───────────────┐  ┌──▼────────────────────────┐
          │ @sysloc/shared │   │ @sysloc/db          │  │ @sysloc/cobranca-bancaria │
          │ segredo-       │   │ certificado-do-     │  │ porta-de-identidade  (D)  │
          │ operavel       │   │ provedor            │  │ leitura-do-material  (A)  │
          │ (AES-256-GCM,  │   │ identificador-      │  │ adaptador-sicoob     (A)  │
          │  invólucro     │   │ bancario            │  │ modelo-canonico      (D)  │
          │  opaco)        │   │ catalogo-de-        │  └──┬────────────────────────┘
          └────────────────┘   │ plataforma          │     │ mTLS por chamada
                               └─────┬───────────────┘     │ (node:https + pfx)
                                     │                     ▼
                       ┌─────────────▼──────────┐    ┌──────────────┐
                       │ PostgreSQL 18          │    │ Provedor     │
                       │  negocio.certificado_  │    │ bancário     │
                       │    do_provedor (RLS F) │    │ (externo)    │
                       │  plataforma.identifi-  │    └──────────────┘
                       │    cador_bancario_seq  │
                       │  + proximo_identifica- │
                       │    dor_bancario()      │
                       └────────────────────────┘
```

`(D)` = lado do domínio · `(A)` = lado do adaptador. A direção da dependência aponta **do adaptador
para o domínio** (ADR-0025), e os dois moram no mesmo pacote — precedente do adaptador de e-mail,
que vive dentro de `@sysloc/regua`.

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|------------|------------------|--------|
| `CertificadoDoProvedorController` | Publica as três rotas, declara a exigência de autorização, valida a entrada pelo esquema e traduz a recusa no envelope da ADR-0017 | Borda HTTP |
| `CertificadoDoProvedorService` | Orquestra registro, consulta e verificação sob o contexto da sessão; deriva o estado da vigência a partir da data corrente do banco | Aplicação |
| `packages/contracts/src/integracao-bancaria.ts` | Fonte única do contrato: esquema de entrada, de saída, formato do identificador bancário, meios de recebimento, limiar de vencimento | Contrato |
| `packages/shared/src/segredo-operavel.ts` | Cifra e decifra o envelope AES-256-GCM; publica o invólucro opaco `SegredoOperavel`. **Único lugar do produto em que o material existe em claro** | Transversal |
| `packages/db/src/certificado-do-provedor.ts` | Registra (com substituição na mesma unidade de trabalho), lê o vigente, lê o histórico e devolve o segredo cifrado para uso | Dados |
| `packages/db/src/identificador-bancario.ts` | Consome o contador do banco e compõe as 18 posições (`AAAAMM` + 12 dígitos) | Dados |
| `packages/db/src/catalogo-de-plataforma.ts` | Guarda de admissão do schema `plataforma` (ADR-0031), nas duas pontas | Dados |
| `@sysloc/cobranca-bancaria` · `modelo-canonico.ts` | Meio de recebimento (`BOLETO` \| `PIX`) e os tipos que atravessam a porta — vocabulário próprio, sem termo do provedor | Domínio |
| `@sysloc/cobranca-bancaria` · `porta-de-identidade.ts` | Declara `PortaDeIdentidadeBancaria` e o tipo do dado que a atravessa | Domínio |
| `@sysloc/cobranca-bancaria` · `leitura-do-material.ts` | Lê titular, validade e impressão digital do material por aperto de mão em laço local | Adaptador |
| `@sysloc/cobranca-bancaria` · `adaptador-sicoob.ts` | Satisfaz a porta por mTLS contra o endereço do provedor, construindo e descartando o cliente por chamada | Adaptador |

### 3.3 Camadas e Fronteiras

O projeto pratica **camadas por fora e estilo hexagonal por dentro**, e a fronteira desta fatia é a
que a **ADR-0025** governa: o pacote de domínio declara o tipo do dado que atravessa e a interface da
porta; o adaptador **importa dele** para declarar que a satisfaz. A porta chega ao domínio **por
parâmetro**, nunca por import.

Direção das dependências:

```
apps/api ──▶ @sysloc/cobranca-bancaria ──▶ @sysloc/contracts
   │                    │
   │                    └──▶ @sysloc/shared   (invólucro do segredo)
   ├──▶ @sysloc/db ──▶ @sysloc/contracts, @sysloc/shared
   └──▶ @sysloc/shared
```

⚠️ **`@sysloc/db` NÃO depende de `@sysloc/cobranca-bancaria`, e a ausência é a decisão.** A camada de
dados guarda o **envelope cifrado** e não sabe o que há dentro dele; quem decifra é o adaptador, e
quem os liga é a composição da borda. Inverter isso poria o material em claro dentro do pacote que
monta consulta — que é exatamente o vetor pelo qual o cliente de banco anexa parâmetros ao erro.

Três fronteiras adicionais, todas herdadas:

- **Isolamento pelo banco** (ADR-0008/0009): o certificado é dado da empresa e nasce com
  `empresa_id`, RLS **forçada** e chave estrangeira composta. O contador **não** é dado de empresa
  nenhuma e vive em `plataforma`, sem coluna de empresa (ADR-0031).
- **O contexto de tenant nunca vem do pedido** (invariante 2): os três atos correm sob
  `sobContextoDaSessao`, que fixa `app.empresa_id` por transação.
- **O relógio mora no banco** (ADR-0026): a validade é comparada com
  `negocio.data_corrente_da_operacao()`, e a competência do prefixo sai da mesma função. Nenhum
  `new Date()` decide comportamento.

### 3.4 Visão em Árvore

```
.
├── .env.example                                                        [M]
├── CLAUDE.md                                                           [M]
├── apps
│   └── api
│       ├── src
│       │   ├── app.module.ts                                           [M]
│       │   ├── autenticacao
│       │   │   └── cobertura-de-autorizacao.ts                         [R]
│       │   ├── comum
│       │   │   ├── contexto-da-sessao.ts                               [R]
│       │   │   ├── esquema-de-erro.ts                                  [R]
│       │   │   ├── esquema-publicado.ts                                [R]
│       │   │   ├── filtro-excecao.ts                                   [R]
│       │   │   └── validacao.ts                                        [R]
│       │   ├── configuracao
│       │   │   └── ambiente.ts                                         [M]
│       │   └── integracoes-bancarias
│       │       ├── certificado.controller.ts                           [N]
│       │       ├── certificado.service.ts                              [N]
│       │       └── integracoes-bancarias.module.ts                     [N]
│       └── test
│           ├── ambiente.spec.ts                                        [M]
│           ├── automacao-de-cobranca.e2e.spec.ts                       [R]
│           ├── certificado-do-provedor.e2e.spec.ts                     [N]
│           ├── cobertura-de-autorizacao.e2e.spec.ts                    [M]
│           ├── contrato-publicado.e2e.spec.ts                          [M]
│           └── segredo-nao-escapa.e2e.spec.ts                          [N]
├── deploy
│   └── scripts
│       └── instalacao
│           ├── provisionar-base.sh                                     [M]
│           ├── verificar-migracao.sh                                   [M]
│           └── verificar-provisionamento.sh                            [M]
├── docs
│   └── adr
│       ├── 0031-tabela-sem-dono-empresa-vive-fora-do-schema-negocio.md [R]
│       └── 0032-segredo-operavel-cifrado-nunca-retorna-...md           [R]
└── packages
    ├── cobranca-bancaria                                               [N]
    │   ├── package.json                                                [N]
    │   ├── tsconfig.json                                               [N]
    │   ├── tsconfig.test.json                                          [N]
    │   ├── src
    │   │   ├── adaptador-sicoob.ts                                     [N]
    │   │   ├── index.ts                                                [N]
    │   │   ├── leitura-do-material.ts                                  [N]
    │   │   ├── modelo-canonico.ts                                      [N]
    │   │   └── porta-de-identidade.ts                                  [N]
    │   └── test
    │       ├── adaptador-sicoob.spec.ts                                [N]
    │       ├── material-de-teste.ts                                    [N]
    │       ├── leitura-do-material.spec.ts                             [N]
    │       └── vocabulario-canonico.spec.ts                            [N]
    ├── contracts
    │   ├── src
    │   │   ├── comum.ts                                                [R]
    │   │   ├── cobranca.ts                                             [R]
    │   │   ├── index.ts                                                [M]
    │   │   └── integracao-bancaria.ts                                  [N]
    │   └── test
    │       └── esquemas.spec.ts                                        [M]
    ├── db
    │   ├── migracoes
    │   │   ├── 0010_seguranca_cobranca.sql                             [R]
    │   │   ├── 0014_seguranca_confirmacao.sql                          [R]
    │   │   ├── 0015_dominio_bancario.sql                               [N]
    │   │   └── 0016_seguranca_bancaria.sql                             [N]
    │   ├── src
    │   │   ├── catalogo.ts                                             [R]
    │   │   ├── catalogo-de-plataforma.ts                               [N]
    │   │   ├── certificado-do-provedor.ts                              [N]
    │   │   ├── esquema
    │   │   │   └── negocio.ts                                          [M]
    │   │   ├── identificador-bancario.ts                               [N]
    │   │   ├── index.ts                                                [M]
    │   │   └── unidade-de-trabalho.ts                                  [R]
    │   └── test
    │       ├── banco-efemero.ts                                        [M]
    │       ├── catalogo-de-plataforma.spec.ts                          [N]
    │       ├── certificado-do-provedor.spec.ts                         [N]
    │       ├── coerencia-de-migracoes.spec.ts                          [M]
    │       ├── identificador-bancario.spec.ts                          [N]
    │       ├── isolamento.spec.ts                                      [M]
    │       └── portador-de-confirmacao.spec.ts                         [R]
    └── shared
        ├── src
        │   ├── index.ts                                                [M]
        │   ├── log.ts                                                  [M]
        │   └── segredo-operavel.ts                                     [N]
        └── test
            ├── log.spec.ts                                             [M]
            └── segredo-operavel.spec.ts                                [N]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---------|-----------|--------|
| `packages/contracts/src/integracao-bancaria.ts` | Esquemas de entrada e saída do certificado, `ESQUEMA_DO_IDENTIFICADOR_BANCARIO`, `MEIOS_DE_RECEBIMENTO`, `ESTADOS_DO_CERTIFICADO`, `LIMIAR_DE_VENCIMENTO_EM_DIAS` | Contrato |
| `packages/shared/src/segredo-operavel.ts` | `cifrar`/`decifrar` (AES-256-GCM) e o invólucro opaco `SegredoOperavel` | Transversal |
| `packages/shared/test/segredo-operavel.spec.ts` | Ida e volta, adulteração recusada, opacidade do invólucro nas três formas de serialização | Teste |
| `packages/db/migracoes/0015_dominio_bancario.sql` | Estrutural (gerada): `negocio.certificado_do_provedor`, restrições e índices | Migração |
| `packages/db/migracoes/0016_seguranca_bancaria.sql` | Manual: `FORCE RLS` + políticas; sequência e função do identificador em `plataforma`; `REVOKE`/`GRANT` | Migração |
| `packages/db/src/certificado-do-provedor.ts` | Registro com substituição, leitura do vigente, leitura do histórico, obtenção do envelope cifrado | Dados |
| `packages/db/src/identificador-bancario.ts` | Consumo do contador e composição das 18 posições | Dados |
| `packages/db/src/catalogo-de-plataforma.ts` | Guarda de admissão do schema `plataforma` (roster enumerado + ausência de coluna de empresa) | Dados |
| `packages/db/test/certificado-do-provedor.spec.ts` | Substituição atômica, unicidade do vigente imposta pelo banco, isolamento entre empresas | Teste |
| `packages/db/test/identificador-bancario.spec.ts` | Não-reuso, avanço fora do desfazimento, ausência de escopo por empresa, forma das 18 posições | Teste |
| `packages/db/test/catalogo-de-plataforma.spec.ts` | As duas pontas da ADR-0031, com o conjunto examinado devolvido junto | Teste |
| `packages/cobranca-bancaria/package.json` · `tsconfig.json` · `tsconfig.test.json` | Manifesto e compilação do pacote novo (pacotes 6 → 7) | Infra |
| `packages/cobranca-bancaria/src/modelo-canonico.ts` | Meio de recebimento e os tipos que atravessam a porta | Domínio |
| `packages/cobranca-bancaria/src/porta-de-identidade.ts` | `PortaDeIdentidadeBancaria` — uma operação, declarada pelo domínio | Domínio |
| `packages/cobranca-bancaria/src/leitura-do-material.ts` | Titular, validade e impressão digital por aperto de mão em laço local | Adaptador |
| `packages/cobranca-bancaria/src/adaptador-sicoob.ts` | Aperto de mão mútuo com o provedor, cliente por chamada | Adaptador |
| `packages/cobranca-bancaria/src/index.ts` | Superfície pública do pacote | Domínio |
| `packages/cobranca-bancaria/test/material-de-teste.ts` | Gera material PKCS#12 em diretório temporário — **nunca versionado** | Teste |
| `packages/cobranca-bancaria/test/leitura-do-material.spec.ts` | Leitura correta, senha errada, material ilegível, certificado vencido | Teste |
| `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` | Aperto de mão aceito e recusado contra servidor TLS real em porta dinâmica | Teste |
| `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` | Nenhum termo do provedor no vocabulário publicado (RN-10) | Teste |
| `apps/api/src/integracoes-bancarias/certificado.controller.ts` | As três rotas, com exigência declarada e esquema derivado do contrato | Borda |
| `apps/api/src/integracoes-bancarias/certificado.service.ts` | Orquestração e derivação do estado da vigência | Aplicação |
| `apps/api/src/integracoes-bancarias/integracoes-bancarias.module.ts` | Registro do controlador, do serviço e da porta | Borda |
| `apps/api/test/certificado-do-provedor.e2e.spec.ts` | Os fluxos do PRD de ponta a ponta, por HTTP real | Teste |
| `apps/api/test/segredo-nao-escapa.e2e.spec.ts` | **A medição** da ADR-0032 sobre a saída real: registro, corpo de erro, documento publicado e diagnóstico | Teste |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---------|-------------|--------|
| `packages/contracts/src/index.ts` | Reexporta o módulo novo | O pacote publica o contrato por um ponto só |
| `packages/contracts/test/esquemas.spec.ts` | Casos do esquema novo | A suíte do pacote cobre cada esquema publicado |
| `packages/shared/src/log.ts` | **Acréscimo** de exatamente três radicais sensíveis — `pfx`, `passphrase` e `material` — à lista existente. ⚠️ **`certificado` NÃO entra** (§10.3) | Medido: a redação atual **não alcança** `materialDoCertificado` nem `{certificado:{pfx,passphrase}}` (§21.1, M4). Acréscimo puro — **nada é removido nem afrouxado** |
| `packages/shared/src/index.ts` | Reexporta `segredo-operavel` | Ponto único de exportação do pacote |
| `packages/shared/test/log.spec.ts` | Casos dos radicais novos | Radical acrescentado sem caso é radical que ninguém sabe se funciona |
| `packages/db/src/esquema/negocio.ts` | Declara `certificadoDoProvedor` | A migração estrutural é gerada deste arquivo |
| `packages/db/src/index.ts` | Reexporta os módulos novos | Ponto único de exportação do pacote |
| `packages/db/test/banco-efemero.ts` | `SCHEMAS` passa a incluir `'plataforma'` | O schema nasce no provisionamento; a instância efêmera reproduz o provisionamento |
| `packages/db/test/coerencia-de-migracoes.spec.ts` | Reconhece `0015`/`0016` | A suíte confere a sequência e a integridade das migrações |
| `packages/db/test/isolamento.spec.ts` | Acrescenta a tabela nova ao exercício de isolamento | Toda tabela de negócio prova o isolamento com o papel real |
| `apps/api/src/configuracao/ambiente.ts` | Duas variáveis novas no esquema de partida e o símbolo do provedor de porta | A partida **falha fechado** sem a chave de cifra |
| `apps/api/src/app.module.ts` | Importa `IntegracoesBancariasModule` | Registro do módulo novo |
| `apps/api/test/ambiente.spec.ts` | Casos das variáveis novas | Variável exigida sem caso é variável que some sem ninguém ver |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Superfície de **89/74 → 92/77**, por dupla medição independente | O número é o critério de congelamento do marco de entrega |
| `apps/api/test/contrato-publicado.e2e.spec.ts` | As três rotas no documento publicado | ADR-0016: o documento deriva do esquema |
| `deploy/scripts/instalacao/provisionar-base.sh` | Cria o schema `plataforma` com dono `sysloc_migracao` e uso concedido a `sysloc_app` | Precedente de `identidade` e `negocio`: o schema nasce no provisionamento, não na migração |
| `deploy/scripts/instalacao/verificar-provisionamento.sh` | Caso para o schema novo | Provisionamento sem verificação é provisionamento que ninguém sabe se rodou |
| `deploy/scripts/instalacao/verificar-migracao.sh` | Inclui `plataforma` na varredura de schemas | A varredura hoje enumera os dois schemas em posição executável |
| `.env.example` | Documenta `CHAVE_DE_CIFRA_DO_CERTIFICADO` e `ENDERECO_DO_PROVEDOR_BANCARIO` | É o índice do que o sistema exige |
| `CLAUDE.md` | Estado da F4, pacotes 6 → 7, superfície 92/77, índice de débitos | O bloco é lido por todo subagente antes de qualquer arquivo |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---------|--------------------|
| `packages/db/migracoes/0010_seguranca_cobranca.sql` | Precedente literal da função de série `SECURITY DEFINER`, do par `REVOKE`/`GRANT` e da `data_corrente_da_operacao()` |
| `packages/db/migracoes/0014_seguranca_confirmacao.sql` | Precedente de função `SECURITY DEFINER` com dono próprio e da ordem obrigatória `REVOKE` → `GRANT` → `ALTER OWNER` |
| `packages/db/migracoes/0013_dominio_documentos_e_confirmacao.sql` | Precedente de tabela de negócio que guarda derivado de segredo |
| `packages/db/src/catalogo.ts` | Guarda de cobertura de isolamento — **e a doutrina de que nenhum nome de tabela entra em posição executável ali** (ver §21.2) |
| `packages/db/src/unidade-de-trabalho.ts` | Como a transação fixa `app.empresa_id`; carrega `DECISÃO FECHADA` que esta fatia **não toca** |
| `packages/db/src/portador-de-confirmacao.ts` | Precedente de módulo de dados que manipula segredo |
| `packages/db/test/portador-de-confirmacao.spec.ts` | Precedente de teste de segredo com banco real |
| `packages/regua/src/porta-de-email.ts` · `adaptador-smtp.ts` | Precedente de porta declarada pelo domínio e adaptador no mesmo pacote (ADR-0025) |
| `apps/api/src/comum/validacao.ts` | Ponto único de tradução da recusa de esquema |
| `apps/api/src/comum/filtro-excecao.ts` | O que vai ao registro quando a requisição falha — é um dos vetores medidos |
| `apps/api/src/comum/esquema-publicado.ts` · `esquema-de-erro.ts` | Como o esquema chega ao documento publicado |
| `apps/api/src/comum/contexto-da-sessao.ts` | `sobContextoDaSessao` — a única entrada legítima do contexto de tenant |
| `apps/api/src/autenticacao/exigencia.decorator.ts` | `ExigeChave` / `ExigeChaves` — a declaração composta da ADR-0018 |
| `apps/api/src/autenticacao/cobertura-de-autorizacao.ts` | Os dois eixos da medição da superfície |
| `apps/api/src/automacao/automacao.controller.ts` | Controlador mais recente de rota de área — molde de estilo e de documentação |
| `docs/adr/0031-*.md` · `docs/adr/0032-*.md` | As duas ADRs que nasceram para esta fatia; leitura da `Decision` integral é obrigatória |
| `/opt/frappe/app-sync/.../cobranca_sicoob/sequencial.py` | Oráculo do formato do identificador (medido: `AAAAMM` + 12, teto `999999999999`) |
| `/opt/frappe/app-sync/.../cobranca_sicoob/auth.py` | Oráculo do aperto de mão com o provedor |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Prefixo global `v1`. Área: `integracoes-bancarias` (o caminho espelha a chave de catálogo
`TELA:integracoes_bancarias`, no molde de `automacao-de-cobranca` ↔ `TELA:automacao_de_cobranca`).

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|------|--------|------|---------|----------|--------------|------|
| Registrar / renovar certificado | `POST` | `/v1/integracoes-bancarias/certificados` | `{ material, senha }` (corpo **completo**, `strictObject`) | `CertificadoPublicado` | `201`, `401`, `403`, `422` | Sessão + `TELA:integracoes_bancarias` **e** `ACAO:configurar_integracao` |
| Consultar o certificado vigente | `GET` | `/v1/integracoes-bancarias/certificado` | — | `CertificadoPublicado` | `200`, `401`, `403`, `404` | Sessão + `TELA:integracoes_bancarias` |
| Verificar a identidade no provedor | `POST` | `/v1/integracoes-bancarias/certificado/verificacao` | corpo vazio (`ESQUEMA_DO_CORPO_VAZIO`) | `ResultadoDaVerificacao` | `200`, `401`, `403`, `404`, `422` | Sessão + `TELA:integracoes_bancarias` |

Notas de contrato, cada uma com a decisão que a sustenta:

- **`POST` de registro devolve `201`**, e não `200`: cada registro **cria um recurso novo** — a
  renovação é substituição por inserção (D9-b), não atualização da linha anterior.
- **A verificação é `POST` e não `GET`** apesar de não alterar nada: ela **alcança um terceiro**, e um
  `GET` prometeria segurança de repetição que uma chamada de rede não tem. A forma *"ato é rota
  própria"* é a mesma régua da ADR-0021, citada aqui **por analogia** — a `Decision` dela fixa isso de
  **transição de estado**, e esta rota não é uma.
- **A verificação exige apenas a área**, não a chave de ação, e quem governa isso é a **ADR-0011**
  (toda rota declara o que exige, com default que nega) com a **ADR-0018** (conjunção e cobertura por
  conteúdo); o fato que classifica o ato é a **RN-06**, que o declara **sem efeito** — o produto
  continua idêntico campo a campo depois dele (CT-826/CT-827). O **registro**, sim, exige a
  conjunção: ele troca a identidade com que a empresa cobra, e a chave já existe no catálogo fechado.
  ⚠️ **A ADR-0021 não é cláusula governante de nenhuma destas três rotas**: a `Decision` dela tem por
  sujeito *"toda transição de estado de entidade de negócio"*, a segunda classe é *"atributo
  operacional **do cadastro**"*, e as *"Instâncias declaradas da segunda classe"* não nomeiam a
  verificação. Ela entra **só como analogia de critério** (a mesma régua de natureza do ato). ⚠️ **A
  fatia (ii) não herda esta classificação**: ato que alcance o mesmo provedor para **mover dinheiro**
  decide a própria exigência lá, contra o catálogo fechado — classificar por analogia afrouxaria a
  autorização, que é o primeiro dos `Cons` da 0021.
- **Nenhuma rota é pública.** O conjunto `publicas` permanece com as **19** entradas de hoje — as 18
  anteriores à F3 mais a única rota de negócio sem sessão que a sub-fatia `documentos-e-confirmacao`
  acrescentou (ADR-0027) —, e `semDeclaracao` permanece **vazio** (ADR-0011). Nenhuma das três rotas
  novas entra em nenhum dos dois conjuntos.
- **A chave exposta do certificado é o UUID** — não há série declarada para ele (ADR-0017).
- **Nenhuma rota devolve bytes**, de modo que a ADR-0028 **não se aplica** a esta fatia.

### 4.1.1 Exemplo de Payload por Endpoint

Nenhuma rota desta fatia aceita **atualização parcial** — não há `PUT` nem `PATCH`, e o corpo do
`POST` de registro é **completo e estrito**: os dois campos são obrigatórios, campo desconhecido é
`422`, e ausência de campo **nunca** significa "preserve o valor atual". A obrigatoriedade que a
observação anti-`required` do template previne não se aplica aqui, e o registro desta ausência é
deliberado.

```
POST /v1/integracoes-bancarias/certificados
Content-Type: application/json

{
  "material": "<PKCS#12 em base64 — até 8 KiB codificados>",
  "senha": "<a senha que abre o material>"
}

201 Created
{
  "id": "0f7c1c4e-6a4e-4f0e-9f9a-2f9b1f0a9c31",
  "titular": "IMOBILIARIA EXEMPLO LTDA:12345678000199",
  "validoDe": "2026-01-10T12:00:00.000Z",
  "validoAte": "2027-01-10T12:00:00.000Z",
  "impressaoDigital": "3A:F0:C4:…:B6",
  "estado": "VIGENTE",
  "diasParaVencer": 149,
  "registradoPor": { "id": "…", "nome": "Fulana de Tal" },
  "registradoEm": "2026-08-14T13:00:00.000Z"
}
```

⚠️ **O corpo da resposta não tem — e nunca terá — campo que carregue `material` ou `senha`.** O
esquema de saída é `strictObject`, e o caso que o prova observa a **resposta real**, não a
declaração.

```
POST /v1/integracoes-bancarias/certificado/verificacao
Content-Type: application/json

{}

200 OK
{ "aceito": true,  "verificadoEm": "2026-08-14T13:05:00.000Z",
  "detalhe": "o provedor aceitou este certificado no aperto de mão" }
200 OK
{ "aceito": false, "verificadoEm": "2026-08-14T13:05:00.000Z",
  "detalhe": "o provedor não aceitou a identidade apresentada" }
```

⚠️ **`detalhe` é preenchido nos DOIS desfechos, e no positivo ele não é ornamento**: a sonda desta
fatia é o aperto de mão mútuo, não a obtenção de credencial de acesso (§8), e o `detalhe` é onde o
alcance dessa afirmação chega ao Admin. `detalhe` nulo prometeria *"está tudo pronto para cobrar"*,
que é mais do que foi medido. O esquema de saída mantém `detalhe` **anulável** — a fatia (ii) o zera
no positivo quando a sonda passar a ser o `client_credentials` e a promessa passar a ser inteira.

A verificação **recusada pelo provedor é `200` com `aceito: false`** — a pergunta foi respondida, e
a resposta é "não". O que produz `404` é a **ausência de certificado** (CA-08), e o corpo nomeia a
empresa e a ausência pelo envelope da ADR-0017.

### 4.2 Schemas / DTOs

Todos derivados do esquema Zod declarado em `@sysloc/contracts` — fonte única da conferência de
entrada, do tipo da resposta e do documento publicado (ADR-0016).

| Schema | Origem | Campos principais | Versão |
|--------|--------|-------------------|--------|
| `esquemaDoCertificadoNovo` | `packages/contracts/src/integracao-bancaria.ts` | `material` (base64, ≤ `MAIOR_MATERIAL_CODIFICADO`), `senha` (1..`MAIOR_SENHA_DO_MATERIAL`) | v1 |
| `esquemaDoCertificado` (saída) | idem | `id`, `titular`, `validoDe`, `validoAte`, `impressaoDigital`, `estado`, `diasParaVencer`, `registradoPor`, `registradoEm` | v1 |
| `esquemaDoResultadoDaVerificacao` | idem | `aceito`, `verificadoEm`, `detalhe` | v1 |
| `ESQUEMA_DO_IDENTIFICADOR_BANCARIO` | idem | `/^[0-9]{18}$/` com as 18 posições descritas | v1 |
| `MEIOS_DE_RECEBIMENTO` | idem | `['BOLETO', 'PIX']` (`as const`, congelado) | v1 |
| `ESTADOS_DO_CERTIFICADO` | idem | `['VIGENTE', 'VENCENDO', 'VENCIDO']` | v1 |
| `esquemaDoErro` | `apps/api/src/comum/esquema-de-erro.ts` | `codigo`, `mensagem`, `campo?`, `detalhes?` | ADR-0017 |

**`LIMIAR_DE_VENCIMENTO_EM_DIAS = 30` tem definição única**, em `@sysloc/contracts`, e as três
respostas do produto derivam dela. Duas declarações do mesmo limiar é a forma exata do débito
**D14** que a fase anterior deixou aberto sobre o fuso — não a repita.

### 4.3 Eventos Publicados / Consumidos

| Evento | Tipo | Tópico / Fila | Payload | Schema |
|--------|------|---------------|---------|--------|
| — | — | — | — | — |

**N/A — e a ausência é decisão, não esquecimento.** A ADR-0029 manda para a fila o efeito externo
*"cujo resultado não compõe a resposta do pedido"*; a verificação é chamada síncrona cujo retorno o
solicitante **espera na própria resposta**, e a própria `Decision` diz que essa classe *"permanece em
linha, e não é exceção"*. Nada desta fatia é enfileirado.

⚠️ **Ganho de desenho que precisa estar escrito**: o vetor do achado crítico da fase anterior — o
segredo em claro alcançando o diário por `err.command.args`, porque a fila empurra a carga como
argumento de comando — **não existe nesta fatia, por construção**: não há carga de tarefa. A fatia
**(ii)**, que terá fila e levará o mesmo material a ela, **não herda essa propriedade**, e precisa
refazer a medição por conta própria.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**Registro do certificado** (US-01, CA-01):

1. **Borda** — `certificado.controller.ts` recebe `POST /v1/integracoes-bancarias/certificados`. A
   guarda de contexto já resolveu a sessão e recusou quem não tem a área e a ação.
2. **Validação** — `validar(esquemaDoCertificadoNovo, corpo, 'corpo')`. Recusa sai como `422` com
   `campo` nomeado e **sem eco do valor** (medido: o `ZodError` não carrega a entrada — §21.1, M2).
3. **Contenção imediata** — o controlador embrulha `material` e `senha` em `SegredoOperavel` na
   **primeira instrução** após a validação e não volta a tocar as cadeias cruas. A partir daqui,
   tudo o que viaja é opaco.
4. **Leitura do material** — `lerMaterial(segredo)` sobe um ponto de escuta TLS em laço local com o
   material, conecta-se a ele e lê do par: titular, `valid_from`, `valid_to` e `fingerprint256`
   (D2-a; medido, §21.1 M1). Senha que não abre e material ilegível levantam erros distintos no
   registro interno e **desfecho indistinguível** na resposta ao Admin.
5. **Conferência de vigência** — a validade lida é comparada com `data_corrente_da_operacao()`.
   Certificado já vencido é recusado **na entrada** (RN-03/CA-06), informando a data em que venceu.
6. **Unidade de trabalho única** — dentro de uma transação com `app.empresa_id` fixado:
   `UPDATE` no vigente anterior (`substituido_em = now()`, `segredo_cifrado = NULL`) e `INSERT` do
   novo com o envelope cifrado. Os dois efeitos são atômicos: falha em qualquer ponto **não deixa a
   empresa pior do que estava**.
7. **Resposta** — `201` com a projeção publicada, montada a partir das colunas — **nunca** a partir
   do que chegou no corpo.

**Consulta** (US-02/US-03, CA-02/CA-03/CA-04): lê a linha vigente da empresa da sessão, deriva
`estado` e `diasParaVencer` da validade contra a data corrente do banco (D8-b) e devolve `200`.
Empresa sem certificado recebe `404` — a ausência é fato do domínio, não erro do cliente, e o corpo
a nomeia.

**Verificação** (US-04, CA-07/CA-08): lê o envelope cifrado do vigente, decifra **dentro do módulo
de cifra**, entrega o resultado ao adaptador, que constrói o cliente mTLS, **completa o aperto de mão
mútuo contra o endereço de credencial do provedor sem enviar corpo nem credencial de acesso** (§8) e
**descarta o cliente ao fim do ato** (D6-b). Nada é gravado. Empresa sem certificado recebe `404`
nomeando a empresa e a ausência, **sem que identidade alguma seja tentada** (RN-01).

**Identificador perante o provedor** (US-06, CA-10/CA-11): a fatia entrega o mecanismo e **não o
exerce em rota nenhuma** — quem o consome é a emissão, na fatia (ii). O caminho é
`proximoIdentificadorBancario(tx)`, que chama `plataforma.proximo_identificador_bancario()` e compõe
`AAAAMM` (da data corrente do banco) + 12 dígitos preenchidos à esquerda.

### 5.2 Fluxos Alternativos

| Situação | Desfecho | Critério |
|---|---|---|
| A senha não abre o material | `422`, e **o que valia antes continua valendo, inalterado** — nada foi escrito | CA-05 |
| O material é ilegível | `422` com a mesma mensagem do caso acima — **indistinguível na resposta**, distinto no registro interno | PRD §7.2 |
| O certificado já está vencido | `422` informando a data em que venceu | CA-06 |
| O corpo excede o tamanho declarado | `422` pelo esquema (não pelo servidor HTTP), com o envelope da ADR-0017 | D3-b |
| O provedor recusa a identidade | `200` com `aceito: false`; o certificado registrado permanece **exatamente** como estava | CA-07 |
| O provedor não responde no prazo | `200` com `aceito: false` e `detalhe` de indisponibilidade — a pergunta do Admin é "posso cobrar?", e "não consegui falar" é resposta, não falha do serviço | RN-06 |
| A verificação sem certificado registrado | `404` nomeando a empresa e a ausência; **nenhuma outra identidade é tentada** | CA-08 |
| Renovação | O novo passa a valer na hora; o anterior segue consultável no histórico, e o segredo dele **deixa de existir** | CA-09 |
| O certificado entra na faixa dos 30 dias | Toda consulta passa a apresentá-lo como `VENCENDO`, com os dias restantes. **Nada é enviado** | CA-04 |
| O contador atinge `999999999999` | `nextval` levanta — a sequência é `NO CYCLE`. Número fora de forma **nunca** é produzido | RN-07 |

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|------------------|------------------|------------------------|
| US-01 | Registro — `POST /v1/integracoes-bancarias/certificados` | Controller → `validar` → `SegredoOperavel` → `lerMaterial` → `registrarCertificado` (unidade de trabalho) |
| US-02 | Consulta — `GET /v1/integracoes-bancarias/certificado` | Controller → Service → `lerCertificadoVigente` → projeção publicada |
| US-03 | Consulta (mesma rota), na derivação do estado | Service → `data_corrente_da_operacao()` → `derivarEstadoDaVigencia` |
| US-04 | Verificação — `POST /v1/integracoes-bancarias/certificado/verificacao` | Controller → Service → `decifrar` → `AdaptadorSicoob.verificarIdentidade` |
| US-05 | Registro sobre empresa que já tem vigente | `registrarCertificado` (substituição atômica) + `lerHistoricoDeCertificados` |
| US-06 | Sem rota — mecanismo consumido pela fatia (ii) | `plataforma.proximo_identificador_bancario()` + `proximoIdentificadorBancario` |
| US-07 | Verificação e (na fatia ii) emissão, sem certificado | Service — recusa nomeada; **nenhum caminho de reserva existe no código** |
| US-08 | Atravessa todos os fluxos | `SegredoOperavel` + radicais do registrador + a suíte de medição |
| US-09 | Sem fluxo de execução — é propriedade do vocabulário publicado | `modelo-canonico.ts` + `integracao-bancaria.ts` + a asserção de vocabulário |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|-------|-------------|------------------------|
| `material` é base64 e não excede `MAIOR_MATERIAL_CODIFICADO` (8 KiB — o material medido tem ~2,6 KB, que viram ~3,5 KB codificados) | Esquema de entrada (`@sysloc/contracts`) | `422` `CAMPO_INVALIDO`, `campo: "material"`, **sem eco do valor** |
| `senha` tem de 1 a `MAIOR_SENHA_DO_MATERIAL` caracteres | Esquema de entrada | `422` `CAMPO_INVALIDO`, `campo: "senha"`, **sem eco do valor** |
| Corpo é `strictObject` — campo desconhecido recusa | Esquema de entrada | `422` `CAMPO_INVALIDO` com `campo` padrão `corpo` |
| Corpo da verificação é vazio | `ESQUEMA_DO_CORPO_VAZIO` (definição única, F3) | `422` `CAMPO_INVALIDO` |
| A senha abre o material | `lerMaterial` (adaptador) | `422` com mensagem única para as duas causas |
| O material é legível como PKCS#12 | `lerMaterial` | idem — **indistinguível na resposta** |
| A validade ainda não passou | Serviço, contra `data_corrente_da_operacao()` | `422` informando a data em que venceu |
| A empresa da sessão existe e está fixada | `sobContextoDaSessao` | `401`/`403` pela guarda; o contexto **nunca** vem do corpo |

### 6.2 Transformações de Dados

- **Entrada → segredo**: `material` e `senha` são embrulhados em `SegredoOperavel` antes de qualquer
  outra operação e cifrados juntos num **envelope único** (`iv || tag || texto cifrado`, em base64),
  gravado numa coluna só. Um envelope, uma operação de cifra, um único ponto a anular na
  substituição.
- **Material → projeção publicada**: `getPeerCertificate()` devolve `subject`, `valid_from`,
  `valid_to` e `fingerprint256`; a projeção publica **titular** (a forma textual do sujeito),
  validade nas duas pontas e a impressão digital tal como o runtime a formata. O `serialNumber` e o
  emissor **não** são publicados — o PRD lista o que sai, e acrescentar campo aqui é alargar
  superfície sem caso de uso.
- **Contador → identificador**: `AAAAMM` da data corrente do banco, concatenado com o número
  devolvido pelo contador preenchido à esquerda até 12 dígitos. A composição vive na aplicação, no
  molde das duas séries existentes; o banco entrega o **número**, nunca o texto.
- **Validade → estado**: `VENCIDO` quando `validoAte < hoje`; `VENCENDO` quando
  `diasParaVencer ≤ 30`; `VIGENTE` no restante. `diasParaVencer` é a diferença em dias inteiros entre
  `validoAte` e a data corrente do banco.

  ⚠️ **A forma da função é fixada pela ADR-0026, e não é detalhe de implementação.** A `Decision` diz
  que *"a aplicação recebe o instante já resolvido, **por parâmetro**, e a decisão que o consome é
  **pura**"*. Portanto `derivarEstadoDaVigencia(validoAte, dataCorrente)` recebe **as duas** datas por
  parâmetro e **não lê relógio nenhum** — nem `new Date()`, nem `Date.now()`, nem consulta ao banco de
  dentro dela. Quem resolve o instante é o serviço, uma vez por requisição, contra
  `negocio.data_corrente_da_operacao()`; a função é pura e por isso testável sem banco, o que é
  exatamente o que torna o **CT-825** (o limiar fechado do lado `VENCENDO`, com `+31 → VIGENTE`)
  capaz de reprovar sozinho um deslize de um dia.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|-------|-----------|-----------|---------------------------|
| RN-01 | RN-01 | Toda empresa que cobra tem certificado próprio; **não existe identidade de reserva**, e a recusa nomeia a empresa e a razão | `RECURSO_NAO_ENCONTRADO` (`404`) |
| RN-02 | RN-02 | O material e a senha entram e **não saem**: publica-se titular, validade, impressão digital, autoria e desde quando | — (propriedade, não erro) |
| RN-03 | RN-03 | Certificado só é aceito se a senha o abrir, o titular for legível e a validade não tiver passado | `CAMPO_INVALIDO` (`422`) |
| RN-04 | RN-04 | O estado é **derivado** da validade contra a data corrente, nunca marca gravada | — |
| RN-05 | RN-05 | Registrar substitui; do anterior fica o registro, e o segredo dele é descartado **no mesmo ato** | — |
| RN-06 | RN-06 | A verificação é ato explícito e **não altera nada** | — |
| RN-07 | RN-07 | 18 posições: 6 de competência + 12 de contador, único no SaaS, sem reinício em virada de período | `nextval` levanta ao teto |
| RN-08 | RN-08 | Número entregue **nunca** é reaproveitado, mesmo com a operação desfeita | — |
| RN-09 | RN-09 | O contador **não é dado de empresa nenhuma**: ninguém o enxerga, influencia ou alcança | `42501` do banco a quem tentar |
| RN-10 | RN-10 | Vocabulário próprio: nenhum nome de campo, código ou termo do provedor no modelo publicado | — (asserção de vocabulário) |
| RN-11 | RN-11 | Meio de recebimento cobre boleto e pix; pix **declarado sem operação** | — |
| RN-12 | — | A unicidade do **vigente por empresa** é imposta pelo **banco** (índice único parcial), nunca conferida pela aplicação | `23505` **sobe intacto** (ver §10.1) |
| RN-13 | — | `segredo_cifrado` presente **se e somente se** `substituido_em` for nulo — restrição do banco | `23514` **sobe intacto** |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, relacional, acessado por Drizzle + postgres.js. Três schemas a partir desta fatia:
`identidade` (sem noção de tenant), `negocio` (tudo com dono, RLS forçada) e **`plataforma`** (o que
não é dado de empresa nenhuma — ADR-0031).

### 7.2 Tabelas / Coleções

| Nome | Colunas / Campos | Tipos | Constraints | Índices |
|------|------------------|-------|-------------|---------|
| `negocio.certificado_do_provedor` | `id` | `uuid` | PK, default `gen_random_uuid()` | — |
| | `empresa_id` | `uuid` | `NOT NULL`, FK simples → `identidade.empresa(id)` | parte dos índices abaixo |
| | `titular` | `text` | `NOT NULL` | — |
| | `valido_de` | `timestamptz` | `NOT NULL` | — |
| | `valido_ate` | `timestamptz` | `NOT NULL` | — |
| | `impressao_digital` | `text` | `NOT NULL` | — |
| | `segredo_cifrado` | `text` | nulo **se e somente se** substituído (`CHECK`) | — |
| | `registrado_por` | `uuid` | `NOT NULL`, **FK composta** `(registrado_por, empresa_id)` → `identidade.usuario(id, empresa_id)` | — |
| | `criado_em` | `timestamptz` | `NOT NULL`, default `now()` | — |
| | `substituido_em` | `timestamptz` | nulo = **é o vigente** | — |
| | — | — | `UNIQUE (id, empresa_id)` — a chave composta que a ADR-0008 exige para referência futura | — |
| | — | — | `CHECK ((segredo_cifrado IS NULL) = (substituido_em IS NOT NULL))` | — |
| | — | — | RLS **habilitada e forçada**, políticas `USING` e `WITH CHECK` sobre `app.empresa_id` | — |
| | — | — | — | `UNIQUE (empresa_id) WHERE substituido_em IS NULL` — **um vigente por empresa, imposto pelo banco** |
| | — | — | — | `(empresa_id, criado_em DESC)` — o histórico da empresa |

**Objetos de `plataforma`** (não são tabelas, e a distinção importa para a guarda da §7.3):

| Objeto | Tipo | Propriedade |
|---|---|---|
| `plataforma.identificador_bancario_seq` | `SEQUENCE` | `START 1 MINVALUE 1 MAXVALUE 999999999999 NO CYCLE`; **nenhum privilégio concedido a `sysloc_app`** |
| `plataforma.proximo_identificador_bancario()` | `FUNCTION` | `RETURNS bigint`, `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = pg_catalog, pg_temp`, **sem parâmetro** |

⚠️ **O roster de tabelas de `plataforma` nesta fatia é VAZIO, e o vazio é o conteúdo.** A guarda de
admissão (§7.3) afirma que o conjunto observado é **exatamente** o roster declarado — de modo que a
tabela crua da notificação bancária, que a fatia (iii) trará, só entra por alteração explícita e
revisada, que é literalmente o que a ADR-0031 pede.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|--------|---------|----------|
| 0015 | `packages/db/migracoes/0015_dominio_bancario.sql` | up — **gerada** por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`: tabela, restrições e índices |
| 0016 | `packages/db/migracoes/0016_seguranca_bancaria.sql` | up — **manual**: `FORCE ROW LEVEL SECURITY`, as duas políticas, o índice único parcial, a sequência e a função de `plataforma`, e o par `REVOKE`/`GRANT` |

Cinco restrições de manutenção, cada uma com precedente literal na base:

1. **`CREATE SCHEMA "plataforma"` NÃO entra na migração.** Os dois schemas existentes nascem em
   `provisionar-base.sh`, e a razão está escrita no cabeçalho da `0000`: criá-los na migração
   exigiria conceder ao papel de migração o privilégio `CREATE` sobre um banco cujo dono é o papel da
   aplicação — poder maior do que a tarefa pede. Se `drizzle-kit` emitir a linha, ela **sai da
   saída**, como as duas de lá saíram.
2. **A `0016` é escrita à mão**, como a `0010`, a `0012` e a `0014`: o gerador declara RLS e
   políticas, mas **não emite `FORCE ROW LEVEL SECURITY`**, e a autoridade sobre o estado real é a
   verificação de catálogo (ADR-0009, Neutros).
3. **`REVOKE ALL … FROM PUBLIC` vem ANTES do `GRANT EXECUTE … TO sysloc_app`**, com a assinatura
   completa da função. Invertido, o `REVOKE` apagaria a concessão nominal que acabou de ser feita —
   é o que a `0010` §6 registra por extenso.
4. **Nenhuma migração já aplicada é editada.** A `0010` está sob `DECISÃO FECHADA` e sob o
   `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco durável; esta fatia **não
   a toca**, e o `sha256sum` do `migrar-banco.sh` continua batendo.
5. **A função é criada pelo dono das migrações** (`sysloc_migracao`), de quem o `SECURITY DEFINER`
   toma os direitos — mesmo molde das quatro funções da `0008` e das duas da `0010`. Ela **não**
   precisa do papel de resolução da `0014`: ali o `SECURITY DEFINER` existia para **atravessar** a
   `FORCE RLS` de uma tabela de negócio; aqui existe para alcançar uma sequência de `plataforma`,
   onde não há política de linha a atravessar.

**Guarda de admissão do schema `plataforma`** (`packages/db/src/catalogo-de-plataforma.ts`), as duas
pontas que a ADR-0031 exige, mais a metade que impede a aprovação vazia:

- **(a)** nenhuma tabela de `plataforma` carrega coluna de empresa — a consulta pergunta ao
  `information_schema`, não a uma lista;
- **(b)** o conjunto de tabelas observado em `plataforma` é **igual** ao roster declarado;
- **(c)** a guarda devolve **também o conjunto examinado**, para que "não encontrei nada" não passe
  por "está tudo certo" — é a lição que o cabeçalho de `catalogo.ts` registra e que vale igual aqui.

### 7.4 Estratégia de Transação e Consistência

- **Registro e substituição correm numa unidade de trabalho só** (`abrirAcessoAoBanco` →
  `executarEmTransacao`), com `SET LOCAL app.empresa_id` fixado pelo escritor único. `UPDATE` do
  anterior e `INSERT` do novo são atômicos: ou a empresa troca de identidade, ou nada mudou.
- **A leitura do material acontece FORA da transação.** O aperto de mão em laço local custa alguns
  milissegundos, mas é I/O; segurar conexão física durante ele repetiria o achado da T7 da fatia
  anterior (renderização de ~0,5 s dentro do `sql.begin`). A ordem é: validar → ler o material →
  abrir a transação → escrever.
- **A verificação contra o provedor acontece FORA de qualquer transação**, e com folga maior: ela é
  chamada de rede a terceiro. A leitura do envelope cifrado é uma transação curta que **fecha antes**
  de o cliente mTLS ser construído.
- **Isolamento**: o padrão do projeto (`READ COMMITTED`). Não há leitura-modificação-escrita que
  exija serialização — a unicidade do vigente é imposta por índice, não por leitura prévia, e duas
  renovações concorrentes na mesma empresa resolvem-se com uma delas recebendo `23505`.
- **O avanço do contador NÃO participa do desfazimento** (ADR-0020): `nextval` é imune a `ROLLBACK`,
  e é isso que torna a CA-11 propriedade do mecanismo, e não promessa de alguém.
- **Idempotência**: o registro **não é idempotente**, e a não-idempotência é a decisão — dois envios
  do mesmo material são duas renovações, e a segunda substitui a primeira. A CA-09 descreve
  exatamente esse comportamento, e uma chave de idempotência aqui esconderia a renovação legítima de
  um certificado reemitido com o mesmo titular.

### 7.5 Política de Retenção / Archival

O certificado **substituído permanece** — é o registro que a CA-09 exige, e o que permite explicar
uma falha ocorrida depois da troca. O que **não** permanece é o segredo dele: `segredo_cifrado` vai a
nulo no ato da substituição, e a restrição `CHECK` torna o estado "substituído com segredo" não
representável.

Não há exclusão física nem lógica pela ADR-0014: certificado não é entidade de cadastro do domínio —
ninguém o nomeia nem o referencia de outro registro —, e o PRD §4.2 poda explicitamente a remoção sem
substituto. A retirada do histórico, se um dia fizer sentido, entra junto da política de retenção da
F7, com `identidade.tentativa_login`, `negocio.envio_de_cobranca` e `negocio.portador_de_confirmacao`,
que têm a mesma natureza.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|-----------------|------|------|----------|-------|
| Provedor bancário (Sicoob) — endereço vindo de `ENDERECO_DO_PROVEDOR_BANCARIO` | HTTPS com **TLS mútuo** | O próprio certificado da empresa (PKCS#12 + senha) | Conexão e resposta com teto declarado como constante nomeada (10 s) | **Nenhum** — ver abaixo |

- **Cliente**: `node:https` nativo, com `pfx` e `passphrase` nas opções da requisição. **Medido
  funcionando** (§21.1, M3).

⚠️ **Qual operação serve de sonda de identidade — o ponto 4 dos Pontos em Aberto do tech-alignment,
decidido aqui e contra o oráculo, porque ele chegava à spec sem resposta.**

A sonda desta fatia é o **aperto de mão mútuo TLS** contra o endereço de credencial do provedor, e
**nada mais** — nenhum corpo é enviado, nenhuma credencial de acesso é apresentada, nenhum recurso do
provedor é consultado. É a única sonda que esta fatia **pode** exercer, e a razão é medida no oráculo:
`/opt/frappe/.../cobranca_sicoob/auth.py` mostra que a obtenção de credencial de acesso do provedor é
um `client_credentials` que exige, **além** do material PKCS#12, um `client_id` e um `scope` — e o PRD
§9 põe as *"credenciais de habilitação"* como dependência **da fatia (ii)**, não desta. Modelá-las
aqui seria trazer a fatia (ii) para dentro desta; ignorá-las e chamar o `client_credentials` mesmo
assim produziria recusa do provedor por credencial ausente, lida como *"a identidade não serve"* —
falso negativo estrutural, e o pior desfecho possível para um ato cujo propósito é dar confiança.

**O que `aceito: true` afirma, e o que NÃO afirma** — e esta distinção é contrato, não nota de
rodapé, porque ela é o alcance real do CA-07:

| Afirma | Não afirma |
|---|---|
| O provedor aceitou **este certificado, desta empresa**, no aperto de mão mútuo: ele é confiável na cadeia do provedor, está dentro da validade do lado de lá e não foi revogado | Que a emissão vai funcionar — isso depende de `client_id` e `scope`, que são da fatia (ii) |

O campo `detalhe` da resposta carrega esse alcance **por escrito** também no desfecho positivo, para
que a tela do Admin não possa prometer mais do que foi medido. É o que impede a leitura *"o teste
passou, então está tudo pronto para cobrar"*, que é exatamente a expectativa que o PRD §3 cria.

⚠️ **Isto NÃO é lacuna de fundação, e a razão é a forma do envelope.** O segredo vive numa coluna só,
como **envelope** (§6.2) — não como par de colunas tipadas. Acrescentar `client_id` e `scope` ao
envelope na fatia (ii) é mudança do que se cifra, **não** da tabela, da migração, da RLS nem do
contrato de saída. A decisão do envelope único, tomada por outra razão (um único ponto a anular na
substituição), paga aqui um segundo dividendo, e vale registrar que ela o paga.

**Marcador a instalar** — `adaptador-sicoob.ts`, junto da sonda:

```
DÉBITO COM GATILHO — D{n} · F4/T{n} · registrado na execução desta fatia
O QUÊ: a sonda de identidade é aperto de mão mútuo, e não obtenção de credencial de acesso —
       ela não exercita `client_id` nem `scope`, que esta fatia não modela.
QUANDO FECHA: a fatia (ii) (`emissao-e-conciliacao`), ao trazer `client_id` e `scope` para o
       envelope cifrado. A sonda sobe para o `client_credentials` do oráculo e passa a responder
       a pergunta inteira; o `detalhe` do desfecho positivo perde a ressalva de alcance.
POR QUE NÃO AGORA: as credenciais de habilitação são dependência declarada da fatia (ii)
       (PRD §9). Modelá-las aqui traria a fatia seguinte para dentro desta.
ÍNDICE: docs/specs/features/fundacao-bancaria/v1/_run/run-report.md §2, D{n}
```
- **`undici` NÃO entra nesta fatia**, e a decisão é medida, não preferência: ele não é dependência do
  monorepo hoje, e o que acrescenta sobre o cliente nativo é o **agrupamento de conexões**, que a
  D6-b adia por manter o material decifrado residente por tempo indefinido. A dependência pertence à
  fatia que exercer o agrupamento — a **(ii)**, na emissão em lote. O `CLAUDE.md` já declara `undici`
  na stack para este fim, então adiá-la não contraria plano nenhum: escolhe a fatia em que é paga.
- **Ciclo de vida**: cliente construído **por chamada** e descartado no fim do ato. A janela de
  residência do segredo em memória é a duração da verificação.
- **Sem repetição automática**: o ato é explícito, sob comando do Admin, e repetir por conta própria
  transformaria um clique em três apertos de mão com o material decifrado. Quem repete é a pessoa.
- **Sem disjuntor de circuito**: não há caminho automático que dependa deste provedor nesta fatia —
  ele entra com a emissão, na fatia (ii).
- **Indisponibilidade** degrada para `aceito: false` com `detalhe` nomeando a indisponibilidade,
  **nunca** para `500`: a pergunta do Admin foi respondida.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Tópico / Fila | Produtor | Consumidor | Garantia |
|---------------|----------|------------|----------|
| — | — | — | — |

**N/A** — nada desta fatia é enfileirado (ver §4.3 e ADR-0029).

### 9.2 Idempotência

Ver §7.4: o registro é deliberadamente não idempotente; a consulta e a verificação são leituras sem
efeito. O único mecanismo com semântica de "uma vez só" é o contador, e ela é a **oposta** da
idempotência: cada chamada entrega um número novo, e é isso que a RN-08 exige.

### 9.3 Outbox / Saga

**N/A** — não há consistência distribuída a coordenar: o único efeito externo (a verificação) não
grava nada, e a única escrita (o registro) é local e atômica.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|------|--------|----------|------------------|
| Corpo, material ou senha fora do esquema | `CAMPO_INVALIDO` | `422` — campo nomeado, **valor jamais ecoado** | Borda (`validar`) |
| A senha não abre o material **ou** o material é ilegível | `CAMPO_INVALIDO` | `422` — mensagem **única** para as duas causas | Adaptador → Serviço |
| Certificado já vencido na entrada | `CAMPO_INVALIDO` | `422` — informa a data em que venceu | Serviço |
| Empresa sem certificado (consulta ou verificação) | `RECURSO_NAO_ENCONTRADO` | `404` — nomeia a empresa e a ausência | Serviço |
| Sessão ausente ou inválida | `NAO_AUTENTICADO` | `401` | Guarda de contexto |
| Área ou ação ausente no efetivo | `ACESSO_NEGADO` | `403` — nomeia a **primeira** exigência ausente na ordem declarada (ADR-0018) | Guarda de contexto |
| Renovação concorrente perdendo a corrida (`23505` do índice único parcial) | `ERRO_INTERNO` | `500` — a violação **sobe intacta**, nomeando a restrição no registro | Banco → Filtro |
| Chave de cifra ausente na partida | — | **O processo não sobe**, nomeando a variável e **sem ecoar o valor** | Configuração |

⚠️ **A violação de unicidade NÃO é traduzida, e a escolha tem precedente e razão.** O enum de códigos
é **fechado** e não tem valor de conflito; `REQUISICAO_RECUSADA` é *"código de fecho do filtro, não
código de negócio levantável"*, e a base já registra por extenso que *"traduzir `23505` em bloco
esconderia uma colisão atrás de outra"* (`packages/db/src/index.ts`, `cadastro-de-pessoa.ts`,
`comodo.ts` — este último aceitando explicitamente o `500`). Acrescentar valor ao enum é o caminho
legítimo quando nenhum serve, mas ele **alcança o contrato publicado e todo consumidor** — preço
desproporcional para uma corrida entre duas renovações da mesma empresa, ato que acontece cerca de
uma vez por ano por Admin. A violação sobe intacta, nomeando a restrição no registro, e é aí que o
diagnóstico mora.

⚠️ **A indistinguibilidade entre senha errada e material ilegível é decisão, não preguiça** — é o que
os fluxos alternativos do PRD pedem. As duas causas são **distintas no registro interno**, que é onde o
diagnóstico mora.

O precedente na base é **de método, não da mesma propriedade**, e a distinção importa para quem for
implementar: `apps/api/test/recusa-indistinguivel.e2e.spec.ts` prova indistinguibilidade da recusa de
**entrada no sistema** — conta bloqueada, pessoa desativada, empresa suspensa e senha provisória já
substituída (`CT-016`, `CT-017`, `CT-223`) —, onde o que se protege é **enumeração de conta** e o
oráculo inclui o **tempo de resposta**. Aqui a classe é outra: recusa de **validação de material já
autenticado**, onde o que se protege é a não-revelação de qual metade do par falhou, e o tempo **não**
entra no invariante. Do arquivo se herda a **forma da prova** — duas causas, uma resposta, comparação
byte a byte do corpo —, não o invariante. Não o cite como se provasse esta propriedade.

### 10.2 Resiliência

- **Teto de tempo declarado** como constante nomeada no adaptador — nunca número mágico no meio da
  chamada. É a regra que a `.claude/rules/testing-stack.md` fixa para espera, e vale igual para
  produção.
- **Sem repetição automática** e **sem disjuntor** (§8).
- **Falha fechada na partida**: sem `CHAVE_DE_CIFRA_DO_CERTIFICADO` o processo recusa subir. O modo
  perigoso é o inverso do habitual — subir sem a chave levaria a descobrir o problema no primeiro
  registro, com o Admin achando que entregou o certificado.
- **Falha fechada na ausência de identidade**: sem certificado, recusa nomeada. Não há caminho de
  reserva **no código** — é a diferença entre remover o *default* e remover a *possibilidade*.

### 10.3 Estratégia de Logging de Erros

O registrador estruturado do projeto (`@sysloc/shared`) tem **entrada única de despacho** e redação
por três eixos: nome de chave, forma do valor (credencial em cadeia de conexão) e par `nome=valor` em
endereço. Esta fatia acrescenta ao eixo do nome **exatamente três** radicais — `pfx`, `passphrase` e
`material` — **acréscimo puro**, nenhum radical existente é removido ou afrouxado.

⚠️ **`certificado` NÃO é acrescentado, e a ausência é a decisão.** O casamento do eixo do nome é por
**radical contido na chave normalizada** (`packages/shared/src/log.ts`, `contemRadicalSensivel`:
`nome.toLowerCase().replace(/[^a-z0-9]/g,'')` seguido de `includes`), de modo que o radical
`certificado` alcançaria **`certificadoId`** — que é justamente o campo que a §13.1 manda registrar
nos três eventos desta fatia, e o único eixo pelo qual uma falha se liga à linha do banco. Acrescentá-lo
trocaria vazamento por cegueira operacional: o diagnóstico sairia `[REDIGIDO]` sem que nenhum segredo
a mais ficasse coberto.

**Os três radicais escolhidos cobrem os dois vetores que a M4 mediu, e a cobertura é por construção**:
`materialDoCertificado` casa `material`; `{ certificado: { pfx, passphrase } }` casa pelas **chaves
internas** (`pfx` e `passphrase`), que são onde o valor de fato está — a chave externa `certificado`
carrega um objeto, não um segredo. Nenhuma chave hoje existente no produto casa `material`, `pfx` ou
`passphrase` (conferido por varredura sobre `apps/api/src` e `packages/*/src`), de modo que o
acréscimo não redige nada que hoje seja legível.

⚠️ **A redação é a SEGUNDA barreira, nunca a garantia** (ADR-0032, e o achado crítico que a motiva).
A primeira é estrutural: o material e a senha **não são campo de objeto** que viaje para registro,
erro, resposta ou documento. O que se registra sobre um certificado é o `id`, a `empresa_id`, o
titular e o desfecho — nunca o que chegou no corpo.

**Um vetor medido que a redação NÃO fecha, e que por isso é regra de escrita**: segredo interpolado
em texto de mensagem sobrevive em `mensagem` e `pilha` do evento (§21.1, M4). Nenhuma mensagem desta
fatia interpola valor vindo do corpo — as mensagens nomeiam **campo** e **desfecho**, jamais conteúdo.

---

## 11. Segurança

### 11.1 Autenticação

Sessão do `better-auth` sobre a barreira única de admissão da F1, resolvida pela guarda de contexto.
As três rotas exigem sessão; **nenhuma é pública**, e o critério da ADR-0027 (*ato do titular do dado
que nunca terá sessão*) **não se aplica** — quem registra o certificado é o Admin, que é usuário do
sistema.

### 11.2 Autorização

Declarada por rota, com default que nega (ADR-0011), e **composta** onde há duas exigências
(ADR-0018):

| Rota | Declaração |
|---|---|
| Classe (`@Controller`) | `@ExigeChave('TELA:integracoes_bancarias')` |
| `POST /certificados` | `@ExigeChaves('TELA:integracoes_bancarias', 'ACAO:configurar_integracao')` |
| `GET /certificado` | herda a da classe |
| `POST /certificado/verificacao` | herda a da classe |

As duas chaves **já existem** no catálogo fechado (`packages/auth/src/catalogo-de-permissoes.ts`) —
nenhuma chave nova é criada, e o catálogo permanece fechado. Pela matriz de perfil, `ADMIN_EMPRESA`
alcança as duas; `USUARIO_EMPRESA` alcança apenas `TELA:resumo`; **`SYSLOC_MASTER` não alcança
nenhuma**, que é exatamente o que o PRD §4.2 exige ao pôr fora de escopo o operador da plataforma
registrar ou consultar certificado de empresa. A garantia é da **sessão** dele (ADR-0013), e vale sem
regra nova.

⚠️ **A declaração do método não substitui a da classe** — a `ExigeChaves` do registro repete a área
de propósito, porque a cobertura de autorização confere **conteúdo**, e um manipulador que exija
menos que a classe reprova (ADR-0018).

### 11.3 Criptografia

- **Em trânsito com o provedor**: TLS mútuo, com o certificado da empresa apresentado por chamada.
- **Em repouso**: **AES-256-GCM** sobre o envelope que carrega material e senha. Cifra **autenticada**
  — adulteração do texto cifrado é detectada na decifração, e não produz material silenciosamente
  corrompido apresentado ao provedor. O vetor de inicialização é aleatório por operação e viaja no
  envelope; a etiqueta de autenticação também.
- **A chave é única do SaaS**, vive em `CHAVE_DE_CIFRA_DO_CERTIFICADO` (32 bytes em base64), fora da
  árvore versionada, no arquivo de ambiente 0600 que as unidades já consomem. Chave por empresa
  exigiria guardá-la em algum lugar, e esse lugar seria o mesmo banco — indireção sem barreira nova
  (D1).
- **Senhas de acesso continuam resumidas e irrecuperáveis**: esta decisão alcança apenas o **segredo
  operável** de terceiro, e a ADR-0032 diz isso nos Neutros. Quem chegar depois não deve "corrigir" a
  cifra reversível em nome da coerência.

⚠️ **O dump do banco passa a conter material cifrado**, e a chave **não** está nele. Isso vira
cláusula do item de resguardo da F7: **dump e chave nunca viajam no mesmo pacote**. É o trade-off que
a D1 aceitou por escrito, e ele **precisa** chegar ao runbook — sem essa cláusula, a cifra vira
ornamento.

### 11.4 Sanitização e Validação

- **Injeção de SQL**: nenhuma instrução é montada como texto. O nome da sequência é literal na função
  (não há escopo variável a interpolar — a simplificação que a D7 registra), e a camada de dados usa
  parâmetros vinculados.
- **`SET search_path = pg_catalog, pg_temp`** na função `SECURITY DEFINER` fecha o vetor clássico
  dessa classe de função, exatamente como a `0010` e a `0014` fazem.
- **SSRF**: o endereço do provedor vem do **ambiente**, nunca do corpo nem da sessão. Nenhuma entrada
  do usuário decide para onde a verificação conecta.
- **Material não confiável**: os bytes entregues pelo Admin são interpretados por
  `tls.createServer`, do runtime — o produto não escreve leitor de formato próprio, e não há
  biblioteca de terceiro sobre o segredo (D2-c, rejeitada).
- **Tamanho declarado no esquema**: a recusa por tamanho sai pelo envelope de erro da ADR-0017, e não
  pelo servidor HTTP — que é o efeito de escolher corpo estruturado em vez de partes múltiplas (D3-b).

### 11.5 Rate Limiting / Anti-abuse

Herdado, sem acréscimo: o limitador de taxa da F1 alcança a superfície autenticada, e as três rotas
exigem sessão. A verificação é o único ato que alcança um terceiro, e ela é **por chamada, sem
repetição automática** — não há laço que o Admin possa disparar sem clicar. O eixo de origem do
limitador segue com o débito **D27**, cujo gatilho é a publicação atrás do servidor de borda na F7, e
esta fatia **não o dispara**.

### 11.6 Secrets Management

| Segredo | Onde vive | Quem lê |
|---|---|---|
| `CHAVE_DE_CIFRA_DO_CERTIFICADO` | `/etc/sysloc/backend.env` (0600, dono root), fora da árvore | Apenas `apps/api`, na partida |
| Material e senha do certificado | `negocio.certificado_do_provedor.segredo_cifrado`, **cifrado** | Apenas `segredo-operavel.ts`, no ato da verificação |
| Credencial de migração | `/etc/sysloc/migracao.env`, separado — sem alteração | `migrar-banco.sh` |

Invariante 3 preservado: **nenhum segredo versionado**. O material de teste é **gerado em tempo de
execução** em diretório temporário — nenhum `.pfx` entra no repositório, e o `.gitignore` já barra
`*.pfx`.

⚠️ **O débito D39 CRESCE com esta fatia, e o crescimento precisa ser anotado.** Ele registra que
`provisionar-base.sh` não gera `BETTER_AUTH_SECRET`, de modo que uma máquina provisionada hoje precisa
receber a chave à mão. Agora são **duas** variáveis nessa condição, e a segunda tem consequência pior:
sem `BETTER_AUTH_SECRET` ninguém entra; sem a chave de cifra, nenhuma empresa cobra. O gatilho
continua sendo *"a próxima instalação do zero"*, e a fatia **atualiza o marcador e a §2 da fatia de
origem** — não o fecha, porque fechá-lo exige tocar script com privilégio, fora do que esta fatia pede.

---

## 12. Performance

### 12.1 Metas

- **Latência p95** — registro: `< 300 ms` (dominado pelo aperto de mão em laço local, medido em
  poucos milissegundos, mais uma transação curta). Consulta: `< 50 ms` (uma linha, um índice).
- **Latência p99** — verificação: **não tem meta**, e a ausência é deliberada: ela depende de uma
  rede que não é nossa. O que ela tem é **teto**, declarado como constante nomeada (10 s).
- **Throughput esperado**: irrisório por natureza. O registro é ato de renovação — **uma vez por ano
  por empresa**, mais as trocas excepcionais; a consulta é abertura de tela; a verificação é clique
  deliberado. Com 20 a 300 empresas, o volume anual do registro cabe num dia de tráfego de qualquer
  outra rota do produto.

### 12.2 Estratégias

- **Índice único parcial** resolve a consulta do vigente com uma varredura de índice.
- **Nada de cache**: guardar em memória o certificado decifrado é exatamente o que a D6-a foi
  rejeitada por fazer. A decisão de segurança e a de simplicidade coincidem aqui.
- **Leitura do material e chamada ao provedor fora de transação** (§7.4) — o que se protege não é o
  tempo de resposta, e sim a **conexão física**, que é o recurso escasso.

### 12.3 Limites Conhecidos

- **Um aperto de mão TLS por registro** e **um por verificação**. É o preço da D2-a, e ele foi aceito
  contra a alternativa de apoiar um caminho que decide se a empresa cobra num acessório **não
  documentado** do runtime.
- **O contador é global**: em emissão concorrente pesada (fatia ii) ele é ponto de serialização.
  `nextval` **não** bloqueia entre transações — é a razão pela qual a ADR-0020 o escolhe —, e a
  contenção do `FOR UPDATE` que o sistema antigo pagava **desaparece**.
- **Rotacionar a chave de cifra obriga a recifrar** o material de todas as empresas. Aceitável porque
  a renovação já é por substituição e o volume é o número de empresas, não o de cobranças.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|--------|-------|--------------|---------------|
| Certificado registrado | `info` | `empresaId`, `certificadoId`, `entidade: 'certificado_do_provedor'`, `validoAte`, `substituiu` | **Nunca** material nem senha; o titular é dado de negócio e sai |
| Registro recusado na leitura do material | `warn` | `empresaId`, `motivo` (`SENHA_NAO_ABRE` \| `MATERIAL_ILEGIVEL` \| `JA_VENCIDO`) | O motivo é **interno** — a resposta ao Admin não o distingue nos dois primeiros |
| Verificação disparada | `info` | `empresaId`, `certificadoId`, `aceito`, `duracaoMs` | — |
| Requisição recusada | `warn` | Herdado do filtro global: `erro`, `codigo`, `status`, `metodo`, `caminho`, `idCorrelacao` | O `erro` atravessa a redação; ver §10.3 |

Padrão JSON via Pino, com `messageKey` e nível como rótulo legível — sem alteração.

⚠️ **`certificadoId` tem de sobreviver à redação, e é por isso que `certificado` não é radical**
(§10.3). Ele é o único eixo que liga uma falha registrada à linha do banco; redigi-lo tornaria os três
eventos acima inúteis para diagnóstico sem cobrir segredo nenhum a mais. O caso **CT-829** afirma as
duas metades: as sentinelas de `pfx`, `passphrase` e `material` saem `[REDIGIDO]`, **e** um
`certificadoId` no mesmo evento chega **legível** ao arquivo. Sem a segunda metade, acrescentar o
radical `certificado` numa manutenção futura passaria verde.

### 13.2 Métricas

| Métrica | Tipo | Labels | SLO Alvo |
|---------|------|--------|----------|
| — | — | — | — |

**N/A** — o produto ainda não instrumenta métricas; o `CLAUDE.md` declara OpenTelemetry na stack e
nenhuma fatia a materializou. Instrumentar aqui seria a primeira, sem consumidor — complexidade
especulativa pelo nome que o catálogo do Gate 2 usa. O sinal operacional desta fatia é o **estado
publicado** do certificado, que é dado, não métrica.

### 13.3 Tracing

**N/A** — mesma razão. O `idCorrelacao` que o adaptador HTTP atribui já liga a linha do registro à
requisição, e é o que a operação usa hoje.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|--------|----------|------------|---------|
| — | — | — | — |

**N/A, e a ausência é decisão de produto, não lacuna técnica.** O PRD §4.2 põe fora de escopo o aviso
de vencimento enviado ao Admin: o alerta é **estado publicado na consulta**, não mensagem. Enviar
exigiria rotina agendada, que pertence à fase de rotinas.

---

## 14. Feature Flags

### 14.1 Solução

**N/A** — o projeto não usa mecanismo de bandeira, e esta fatia não introduz um. O que poderia
parecer bandeira é o **meio de recebimento**: `PIX` está **declarado e sem operação** (RN-11). Ele não
é bandeira desligada — é valor do vocabulário que nenhum caminho de execução consome ainda, e a
diferença importa: bandeira esconde código pronto, e aqui não há código a esconder.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|------|-----------|--------|---------|
| — | — | — | — |

---

## 15. Versionamento de API

### 15.1 Estratégia

Prefixo no caminho (`/v1`), herdado e inalterado — `PREFIXO_DE_VERSAO` em
`apps/api/src/configuracao/ambiente.ts`.

### 15.2 Compatibilidade

As três rotas são **aditivas**: nenhuma rota existente muda de forma, de status ou de exigência. A
superfície da API **ainda não está congelada** — o congelamento é o *depois* da F4 e da F5, e este é
o penúltimo crescimento previsto (a fatia (ii) traz ~5 rotas e a (iii), ~2).

### 15.3 Schemas / Contratos

`@sysloc/contracts` é a fonte única (ADR-0016), e o documento publicado deriva dela por
`esquemaPublicado()`. Não há registro externo de esquema nem validação em integração contínua — a
rede é a suíte: o `contrato-publicado.e2e.spec.ts` reprova se uma rota sumir do documento.

⚠️ **O contrato é o artefato que o React importa no marco de entrega.** Todo campo declarado aqui
chega ao frontend; todo campo **não** declarado não existe para ele. É a segunda razão — além da
segurança — pela qual o esquema de saída é `strictObject`.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

Não há integração contínua: o projeto é **nativo, sem Docker**, e a verificação roda por comando
(`pnpm build`, `pnpm lint`, `pnpm test` — este último **por pacote**, porque `turbo run test` aborta
os pacotes irmãos quando um falha). Os verificadores de infraestrutura são scripts de shell com
contrato de saída próprio.

### 16.2 Empacotamento

Sem contêiner. Compilação por `tsup`/`tsc` em cada pacote; execução por unidades systemd com
`Restart=always` e `EnvironmentFile=` 0600. O **pacote novo entra na cadeia de build do Turborepo**
por dependência declarada — nenhuma etapa nova.

### 16.3 Infraestrutura como Código

`deploy/scripts/instalacao/`, idempotente por contrato (ADR-0005). Esta fatia acrescenta **um passo**:
o schema `plataforma`, com dono `sysloc_migracao` e uso concedido a `sysloc_app`, no molde exato dos
dois schemas existentes — mais o caso correspondente no verificador de provisionamento.

⚠️ **Esses dois scripts exigem `sudo` com senha interativa, e nenhum subagente os executa.** É
fronteira declarada da `.claude/rules/testing-stack.md`: quando um gate precisar deles, a execução é
conduzida pelo orquestrador junto ao operador, e o gate audita a saída preservada, reportando
`executou_testes: false` — o que reflete o **papel** dele, não suíte pulada.

### 16.4 Estratégia de Rollout

Instalação direta — não há tráfego de produção contra este backend antes da virada da F7. O
`/opt/frappe` segue de pé e atendendo.

### 16.5 Escalabilidade

Um processo de aplicação e um de trabalho, verticalmente dimensionados. O contador global é o único
ponto de serialização introduzido, e `nextval` não serializa entre transações.

### 16.6 Rollback

Migração **não tem `down`** neste projeto — a reversão é restauração do resguardo, que é o item 1 da
F7. O que esta fatia acrescenta ao runbook de resguardo é a **cláusula da §11.3**: dump e chave de
cifra em pacotes separados, e a restauração precisa dos dois para que a aptidão de cobrar volte.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|------------------|-------------------|------------------------|
| US-01 — registrar o certificado | Tabela `negocio.certificado_do_provedor` (§7.2), `esquemaDoCertificadoNovo` (§4.2), `SegredoOperavel` (§11.3), `lerMaterial` (§6.2) | `certificado.controller.ts`, `certificado.service.ts`, `certificado-do-provedor.ts`, `segredo-operavel.ts`, `leitura-do-material.ts` |
| US-02 — consultar sem que o segredo volte | Projeção publicada `strictObject` (§4.2), contenção estrutural (§10.3), radicais do registrador (§10.3) | `integracao-bancaria.ts`, `certificado.service.ts`, `log.ts` |
| US-03 — ver a antecedência do vencimento | Derivação na aplicação a partir de `data_corrente_da_operacao()` (§6.2), `LIMIAR_DE_VENCIMENTO_EM_DIAS` com definição única | `certificado.service.ts`, `integracao-bancaria.ts` |
| US-04 — testar contra o provedor | `PortaDeIdentidadeBancaria` (§3.2), adaptador mTLS por chamada (§8) | `porta-de-identidade.ts`, `adaptador-sicoob.ts`, `certificado.service.ts` |
| US-05 — renovar preservando o registro | Substituição atômica + `CHECK` que torna "substituído com segredo" irrepresentável (§7.2/§7.4) | `certificado-do-provedor.ts`, `0015`, `0016` |
| US-06 — identificador único no SaaS | Schema `plataforma`, sequência e função sem parâmetro (§7.2), composição das 18 posições (§6.2) | `0016`, `identificador-bancario.ts`, `catalogo-de-plataforma.ts` |
| US-07 — ausência falha de forma nomeada | `404` nomeando empresa e ausência (§10.1); **nenhum caminho de reserva existe no código** | `certificado.service.ts` |
| US-08 — segredo não aparece em lugar nenhum | Contenção estrutural + redação como segunda barreira + **medição sobre a saída real** (§10.3, §19) | `segredo-operavel.ts`, `log.ts`, `segredo-nao-escapa.e2e.spec.ts` |
| US-09 — vocabulário próprio com meio de recebimento | Modelo canônico agnóstico (§3.2), `MEIOS_DE_RECEBIMENTO` (§4.2), asserção de vocabulário | `modelo-canonico.ts`, `integracao-bancaria.ts`, `vocabulario-canonico.spec.ts` |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|------|------|--------|--------|
| Framework | NestJS + Fastify | 11.1.28 / 5.10.0 | Já na base — a borda das três rotas |
| ORM | Drizzle | 0.45.2 | Já na base — declara a tabela e gera a `0015` |
| Driver | postgres.js | 3.4.9 | Já na base |
| Validação | Zod | 4.4.3 | Já na base — fonte única do contrato |
| Cliente HTTP | **`node:https`** (nativo) | Node 24.18.1 | mTLS por chamada, **medido** — nenhuma dependência nova |
| Leitura do material | **`node:tls`** (nativo) | Node 24.18.1 | Aperto de mão em laço local (D2-a) |
| Cifra | **`node:crypto`** (nativo) | Node 24.18.1 | AES-256-GCM |
| Mensageria | — | — | **N/A** — nada é enfileirado nesta fatia |
| Observabilidade | Pino | 10.3.1 | Já na base |
| Teste | Vitest + `embedded-postgres` | 4.1.10 / 18.4.0-beta.17 | Já na base |

**Zero dependências novas.** É consequência direta das medições: `undici` fica para a fatia (ii)
(§8), e a biblioteca de terceiro que interpreta PKCS#12 foi rejeitada por alargar a superfície de
confiança exatamente sobre o segredo que a fatia existe para conter (D2-c).

⚠️ **Um pacote interno novo** (`@sysloc/cobranca-bancaria`), levando o monorepo de **6 para 7**
pacotes. Ele depende de `@sysloc/contracts` e `@sysloc/shared`; nada depende dele exceto `apps/api`.

---

## 19. Estratégia de Testes

> **Resumo**: **38 casos de teste** | Unitários: 5 | Integração: 9 | E2E: 5 | Segurança: 19
> **Padrão**: Vitest. Integração e banco com `embedded-postgres` (instância efêmera **própria** por
> execução, com os papéis reais `sysloc_app`/`sysloc_migracao` e RLS **forçada**); E2E por **HTTP
> real** em porta dinâmica. **Mock evitado por decisão do projeto** — nenhum caso desta fatia usa
> dublê. Rastreabilidade `CA-xx → CT-8xx (RN-xx)` com seção de INVARIANTES por arquivo.
> Faixa **CT-801 a CT-838**, **sem lacuna e sem sufixo**. ⚠️ **O challenge de 2026-08-14 casou as
> duas anomalias que se anulavam**: havia um número sem caso (o `CT-818`, que o gerador não emitiu) e
> um caso sem número (o companheiro negativo da renovação, escrito como `CT-822b`). O companheiro é
> caso de primeira classe — é *"a metade que impede a implementação 'anula primeiro, insere depois'"*
> —, e viver como sub-item de outro caso o deixava fora da contagem, fora da rastreabilidade e fora do
> alcance de `-t "CT-…"`. Ele **é o `CT-818`**. Total: **38**, e nenhum outro identificador muda.
> A faixa CT-8xx está **livre no repositório** — conferida por varredura, o maior identificador de
> fatia hoje é o `CT-740`, e a faixa `CT-9xx` é do protocolo antirregressão.

**Comando**: `pnpm --filter @sysloc/<pacote> test` — **sempre por pacote**. `turbo run test` aborta os
pacotes irmãos quando um falha, e a saída agregada não carrega contagem confiável dos interrompidos.
Rode `rm -rf /tmp/sysloc-banco-*` entre execuções (o disco do host está em ~96%, e
`No space left on device` **se disfarça de teste vermelho**).

**Prova de falsificação obrigatória** (`.claude/rules/testing-stack.md`) para os casos de asserção
**estática** — os que inspecionam texto, nome ou estrutura em vez de exercitar o SUT: **CT-809**,
**CT-829**, **CT-832**, **CT-834**, **CT-835** e **CT-836**. Mutante aplicado, suíte rodada **pelo
script do pacote**, reprovação demonstrada nomeando o item ofensor, mutante revertido.
⚠️ **`vitest run` avulso é INVÁLIDO para trabalho de mutante** — os pacotes resolvem `"."` para
`dist/`, e o mutante fica no fonte sem alcançar o que executa: verde lido como *"o mutante
sobreviveu"* quando ele nunca foi executado.

### 19.0 Reconciliações entre o gerador de QA e esta spec

O gerador propôs três colocações que **esta spec decide diferente**. Os **invariantes dos casos são
preservados na íntegra**; o que muda é onde o SUT mora. Registrado aqui para que a divergência não
seja lida como erro de nenhum dos dois lados:

| O gerador propôs | Esta spec decide | Por quê |
|---|---|---|
| Cifra em `packages/cobranca-bancaria/src/cifra.ts` | **`packages/shared/src/segredo-operavel.ts`** | A ADR-0032 fixa uma regra de **classe** — *"segredo de terceiro que o produto precisa usar"* —, não uma regra do provedor bancário. Pôr a cifra no pacote bancário faria a próxima credencial de terceiro nascer com uma segunda cópia |
| Duas colunas, `material_cifrado` e `senha_cifrada` | **Uma coluna, `segredo_cifrado`** (envelope único) | Um envelope, uma operação de cifra e **um único ponto a anular** na substituição. Com duas colunas, "o segredo do anterior deixou de existir" passa a ter duas metades livres para divergir |
| Guarda da `plataforma` dentro de `packages/db/src/catalogo.ts` | **`packages/db/src/catalogo-de-plataforma.ts`**, e `catalogo.ts` **não é editado** | O cabeçalho de `catalogo.ts` proíbe nome de tabela em posição executável **naquele arquivo**, e a ADR-0031 exige roster enumerado. A explicação de por que as duas não se contradizem está na **§21.2** |

Mais duas respostas às recomendações do gerador:

- **Nomes de código de erro**: os placeholders `SENHA_INVALIDA` / `MATERIAL_ILEGIVEL` /
  `CERTIFICADO_VENCIDO` são **motivos internos**, não códigos do envelope. O que sai ao cliente é
  `CAMPO_INVALIDO` (§10.1), e **a senha errada é indistinguível do material ilegível na resposta** —
  distintos apenas no registro interno, que é onde o diagnóstico mora. Os casos que afirmam a
  distinção (**CT-807**, **CT-808**) a afirmam **na camada do adaptador**; os que observam a borda
  (**CT-820**, **CT-830**) afirmam o envelope canônico.
- **Endereço do provedor no teste**: o servidor TLS que faz as vezes do provedor é configurado pela
  **mesma** variável que o adaptador real lê — `ENDERECO_DO_PROVEDOR_BANCARIO` (§8, §11.6).

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|----------|--------------------|--------|
| CA-01 | Registro aceito publica titular, validade e impressão digital | CT-806, CT-808, CT-819, CT-836 |
| CA-02 | Nenhuma resposta devolve o material ou a senha | CT-803, CT-823, CT-832, CT-833, CT-836 |
| CA-03 | Dias restantes e faixa, contra a data corrente da operação | CT-824, CT-836 |
| CA-04 | ≤ 30 dias é *vencendo*; validade passada é *vencido* | CT-824, CT-825 |
| CA-05 | Senha que não abre recusa, e o que valia antes **continua valendo, inalterado** | CT-807, CT-820 |
| CA-06 | Certificado vencido recusado na entrada, com a data em que venceu | CT-821 |
| CA-07 | O teste informa o desfecho e **não altera nada** | CT-826, CT-827, CT-836 |
| CA-08 | Teste sem certificado recusa nomeando empresa e ausência, sem identidade de outra origem | CT-828, CT-836 |
| CA-09 | Renovação: o novo vale, o anterior segue consultável, o segredo dele deixa de existir | CT-810, CT-811, CT-818, CT-822, CT-836 |
| CA-10 | Duas empresas no mesmo mês nunca colidem, e o contador avança para as duas | CT-804, CT-814, CT-816 |
| CA-11 | Operação desfeita não devolve o número ao contador | CT-814, CT-817 |
| CA-12 | Nada de segredo em registro, erro ou diagnóstico | CT-803, CT-829, CT-830, CT-831, CT-832, CT-833 |
| CA-13 | Nenhum termo do provedor no vocabulário publicado | CT-809, CT-834 |
| CA-14 | Boleto e pix previstos; pix sem operação | CT-835 |

**Nenhum CA órfão e nenhum CT órfão.** Sete casos não apontam CA porque provam **regra de negócio ou
propriedade estrutural** sem critério de aceite próprio, e cada um tem dono declarado: CT-802 e
CT-805 (companheiros negativos de CT-801 e CT-804), CT-812 e CT-813 (ADR-0031), CT-815 (RN-09),
CT-837 e CT-838 (ADR-0011/0018).

> ⚠️ **Duas correções de rastreabilidade do challenge de 2026-08-14.** (1) O **CT-804** apontava
> **CA-01** e prova a composição das **18 posições do identificador** — que é CA-10, não "o registro
> publica titular, validade e impressão digital". Um CT sob o CA errado não perde cobertura: ele
> **empresta** cobertura ao CA errado, e o CA verdadeiro fica parecendo coberto por casos que não o
> exercitam. (2) O **CT-818** entrou em CA-09, que é o critério da renovação de que ele é a metade
> negativa.

---

### 19.1 Testes Unitários

#### Cifra e invólucro do segredo — `packages/shared/test/segredo-operavel.spec.ts`

Mock: **nenhum**.

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|----------|--------------------------|
| CT-801 | ida e volta da cifra | — | Material cifrado e decifrado **pela mesma chave** devolve exatamente os bytes originais, e o texto cifrado nunca é igual ao claro | Material sintético de ~2,6 KB e senha de 12 caracteres, gerados em execução | `Buffer.equals(original) === true`; o texto cifrado não contém nenhuma subcadeia do claro | — |

#### Composição do identificador — `packages/db/test/identificador-bancario.spec.ts`

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|----------|--------------------------|
| CT-804 | as 18 posições | CA-10 | Compor a partir de competência e contador produz **sempre** 18 caracteres, com o contador preenchido à esquerda | `(202608, 1)`, `(202608, 42)`, `(202608, 999999999999)` | `202608000000000001`, `202608000000000042`, `202608999999999999` — igualdade literal, incluindo os zeros | — |
| CT-805 | contador acima da largura | — | A composição é **total**: contador fora da largura é recusado **antes** de compor, e cadeia de 19 nunca existe | `(202608, 1_000_000_000_000)` | Erro nomeado; nenhuma cadeia devolvida | — |

#### Superfície do domínio bancário — `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`

| CT | Teste | CA | Objetivo (invariante) | Input | Expected | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|----------|--------------------------|
| CT-809 | a porta declara **uma** operação | CA-13 | `PortaDeIdentidadeBancaria` expõe exatamente um método, e nem o parâmetro nem o retorno carregam nome de campo do provedor | Introspecção do módulo exportado | Conjunto de operações com **um** item; nenhum termo do provedor na assinatura | — · **exige prova de falsificação** (2º método acrescentado ⇒ reprova nomeando o excedente) |
| CT-835 | meio de recebimento | CA-14 | O enum tem exatamente `['BOLETO','PIX']`, e o conjunto de operações sobre `PIX` é **vazio** | Introspecção do enum e das exportações | Igualdade de conjunto no enum; lista de operações de pix vazia | — · **exige prova de falsificação** |

### 19.2 Testes de Integração

#### Leitura do material — `packages/cobranca-bancaria/test/leitura-do-material.spec.ts`

Setup: material PKCS#12 autoassinado **gerado em execução** em diretório temporário (nunca
versionado), com titular e validade conhecidos; aperto de mão TLS em laço local, porta dinâmica.

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-806 | leitura correta | CA-01 | Material legível com senha correta devolve titular, validade nas duas pontas e `fingerprint256` | Gerar material → `lerMaterial` | Titular igual ao gerado; validade igual; impressão digital no formato hexadecimal com separadores | — |

#### Registro, recusa e renovação — `packages/db/test/certificado-do-provedor.spec.ts`

Setup: instância efêmera migrada até a `0016`; empresas semeadas; operações pela **porta real**, com
`sysloc_app`.

| CT | Teste | CA | Objetivo (invariante) | Fluxo | Validação | Setup (caminho legítimo) |
|----|-------|----|----------------------|-------|-----------|--------------------------|
| CT-811 | dois vigentes são impossíveis | CA-09 | É o **banco**, não a aplicação, que impede duas linhas com `substituido_em IS NULL` na mesma empresa | Gravar vigente 1 → `INSERT` cru do vigente 2 | `23505` nomeando o índice parcial; contagem final de vigentes = 1 | `conexaoDeMigracao(banco)` para o `INSERT` cru — molde de `executarPrivilegiado` de `catalogo.spec.ts` |
| CT-816 | duas empresas, um contador | CA-10 | Chamadas sob contextos distintos devolvem números **consecutivos e diferentes**, do **mesmo** contador | A → B → A | `n1 ≠ n2 ≠ n3`, com `n2 = n1+1` e `n3 = n2+1` | Contexto fixado pela unidade de trabalho real — **não** é precondição privilegiada |
| CT-817 | operação desfeita | CA-11 | Número obtido numa transação desfeita **nunca** é reentregue | Transação → número → `ROLLBACK` → nova transação → número | `n2 = n1 + 1` | — |
| CT-818 | renovação que **falha** | CA-09 | Companheiro negativo do CT-822: renovação que falha na leitura do material novo deixa o antigo vigente **e com o segredo intacto** — a anulação nunca acontece antes de o novo ser aceito | Registrar 1 → tentar registrar 2 com material ilegível → reler | Recusa; o vigente continua sendo o 1; `segredo_cifrado` do 1 **não** é `NULL`; contagem de linhas inalterada | `conexaoDeMigracao` só para a leitura da coluna crua |
| CT-819 | registro válido | CA-01 | Registro com senha correta e validade futura grava o vigente, e a consulta devolve exatamente o que foi lido do material | Registrar → consultar | Titular, validade e impressão digital iguais aos do material; **nenhum** campo de material ou senha na projeção | — |
| CT-820 | senha errada não move nada | CA-05 | Recusa por senha incorreta **não altera nada** do vigente anterior — nenhuma coluna, nenhum carimbo | Capturar linha → tentar com senha errada → recapturar | Recusa; as duas capturas são idênticas campo a campo; contagem de linhas inalterada | `conexaoDeMigracao` **só** para a leitura de comparação; o registro corre pela porta real |
| CT-821 | certificado vencido | CA-06 | Validade encerrada antes da data corrente é recusada **na entrada**, informando a data exata | Material com validade vencida há 10 dias | Recusa com a data de fim igual à do material; nenhuma linha gravada | Comparação contra `negocio.data_corrente_da_operacao()`, nunca o relógio do processo |
| CT-822 | renovação | CA-09 | O novo vale, o anterior segue consultável, e o segredo do anterior é anulado **na mesma unidade de trabalho** | Registrar 2 → consultar vigente → consultar histórico → ler coluna crua | Vigente é o 2; dados públicos do 1 intactos; `segredo_cifrado` do 1 é `NULL` | `conexaoDeMigracao` só para a leitura de verificação |

⚠️ **O `CT-818` é o companheiro negativo do `CT-822`, e o par é indivisível.** Sozinho, o CT-822
aprova tanto a implementação correta quanto a que **anula primeiro e insere depois** — e esta segunda
perde o segredo da empresa quando a inserção falha, que é dano sem recurso, porque ninguém recompõe
material vindo de terceiro. Quem cortar um dos dois por escopo tem de cortar os dois.

### 19.3 Testes End-to-End (E2E)

#### Fluxo: estado derivado da vigência (CT-824, CT-825)

- **Framework**: HTTP real contra `apps/api` em porta dinâmica.
- **CA**: CA-03, CA-04
- **Objetivo**: a consulta calcula faixa e dias restantes da validade contra
  `negocio.data_corrente_da_operacao()`, com o limiar de 30 dias **fechado do lado `VENCENDO`**.
- **Pré-condições**: sessão de Admin da empresa com a chave `TELA:integracoes_bancarias`, obtida por
  entrada real mais concessão da chave sob contexto de tenant — o mesmo caminho de
  `apps/api/test/automacao-de-cobranca.e2e.spec.ts`.
- **Passos**: registrar certificados com validade em `+45`, `+30`, `+1` e `−1` dias relativos à data
  corrente do banco; consultar cada um; conferir faixa e dias restantes. **CT-825** acrescenta o caso
  de `+31`.
- **Validações**: `+45 → VIGENTE`; `+30 → VENCENDO` com 30 dias; `+1 → VENCENDO` com 1 dia;
  `−1 → VENCIDO`; **`+31 → VIGENTE` com 31 dias**. Um deslize de um dia no limiar reprova o CT-825
  **sozinho**, sem tocar o CT-824.

#### Fluxo: verificação contra o provedor (CT-826, CT-827, CT-828)

- **Framework**: HTTP real, mais **servidor TLS real** em porta dinâmica fazendo as vezes do
  provedor. **Nenhum caso toca o provedor real** (ADR-0006).
- **CA**: CA-07, CA-08
- **Objetivo**: a verificação responde o desfecho e **não altera nada**, nos dois desfechos; e a
  ausência de certificado recusa **sem tentar identidade alguma**.
- **Pré-condições**: empresa A com certificado vigente (CT-826/827); empresa B com sessão válida e
  chave concedida, **sem** certificado (CT-828).
- **Passos**: capturar a linha do certificado → `POST …/certificado/verificacao` → recapturar →
  comparar. No CT-828, o servidor TLS de teste **registra se recebeu conexão**.
- **Validações**: CT-826 — `200` com aceite, linha idêntica campo a campo. CT-827 — resposta informa
  a recusa (**nunca** erro genérico do servidor), linha idêntica. CT-828 — `404` nomeando a empresa e
  a ausência, **e o servidor de teste registra zero conexões**. ⚠️ **Essa segunda asserção é a que
  prova o fim do caminho de reserva** (RN-01): sem ela, o caso provaria apenas a mensagem.

### 19.4 Cenários de Erro e de Segurança

> **19 casos**, agrupados por natureza. Todos exercitam **fronteira real** — banco, HTTP ou sistema
> de arquivos —, e nenhum usa dublê.

**(a) O segredo não escapa — a medição que a ADR-0032 exige** (`segredo-nao-escapa.e2e.spec.ts`,
`segredo-operavel.spec.ts`, `log.spec.ts`)

| Cenário | CA | Objetivo (invariante) | Trigger | Esperado |
|---------|----|----------------------|---------|----------|
| CT-802 · decifrar com chave errada | — | Lança erro nomeado, **nunca** devolve bytes parciais, e a exceção não carrega o claro nem nenhuma das chaves | Texto cifrado com a chave A, decifrado com a B | Exceção; nenhuma varredura acha o segredo nem as chaves |
| CT-803 · invólucro opaco | CA-02, CA-12 | `toString`, `JSON.stringify` e a inspeção devolvem `[REDIGIDO]` — **as três** | Segredo sentinela dentro do invólucro | As três saídas são `[REDIGIDO]`; nenhuma contém a sentinela |
| CT-807 · senha não abre | CA-05 | Recusa nomeada **distinta** de "ilegível", e a exceção não carrega a senha nem os bytes | Material bom, senha sentinela errada | Motivo interno `SENHA_NAO_ABRE`; varredura de mensagem, pilha e campos próprios não acha nada |
| CT-808 · material ilegível | CA-01 | Recusa nomeada **distinta** de "senha inválida", sem devolver conteúdo | 200 bytes aleatórios | Motivo interno `MATERIAL_ILEGIVEL`; nenhum byte do material na exceção |
| CT-823 · corpos das três rotas | CA-02 | Os três corpos, serializados **por inteiro**, não contêm o material nem a senha | Sentinelas improváveis nas três rotas | Nenhuma das varreduras acha as sentinelas |
| CT-829 · radicais novos do registrador | CA-12 | `passphrase`, `pfx` e `materialDoCertificado` — **inclusive aninhados** — saem `[REDIGIDO]`, **e `certificadoId` sai legível**, sem silenciar o evento | Evento com os três valores sentinela **mais** um `certificadoId` conhecido | Nenhuma sentinela no arquivo; as chaves sensíveis presentes como `[REDIGIDO]`; o `certificadoId` presente **com o valor** · **duas provas de falsificação: reverter o acréscimo ⇒ reprova pelas sentinelas; acrescentar o radical `certificado` ⇒ reprova pelo `certificadoId` redigido** |
| CT-830 · corpo de erro de validação | CA-12 | O envelope `422` não ecoa o material nem a senha — **medido na saída HTTP real**, não presumido do Zod | Corpo acima do limite declarado, com sentinelas | `422` canônico; nenhuma sentinela em `mensagem`, `campo` ou `detalhes` |
| CT-831 · registro real no arquivo de diário | CA-12 | Falha de leitura do material não leva a senha nem os bytes ao arquivo de registro **do processo real** | Os dois cenários de falha, com o destino do registrador apontado para arquivo temporário | Nenhuma ocorrência da sentinela em nenhuma linha do arquivo |
| CT-832 · documento publicado | CA-02, CA-12 | O esquema publicado das três rotas **não declara** campo de material ou senha, nem em exemplo | Documento OpenAPI da aplicação montada | Igualdade de conjunto das chaves; nenhuma das proibidas · **prova de falsificação** |
| CT-833 · o material em repouso | CA-02, CA-12 | Os bytes gravados diferem do claro, e decifrá-los com outra chave lança — o banco **por si** não reconstitui o segredo | Leitura crua da coluna após registro | `segredo_cifrado ≠ claro`; decifrar com chave errada lança sem devolver bytes |
| CT-834 · vocabulário publicado | CA-13 | Nenhum nome de campo, código ou termo do provedor entra nos tipos publicados | Enumeração das chaves de todo esquema exportado | Interseção vazia com a lista de termos do provedor · **prova de falsificação** |

**(b) O banco impõe o que a aplicação não confere** (`catalogo-de-plataforma.spec.ts`,
`certificado-do-provedor.spec.ts`)

| Cenário | CA | Objetivo (invariante) | Trigger | Esperado |
|---------|----|----------------------|---------|----------|
| CT-810 · anatomia da tabela | CA-09 | `empresa_id`, RLS **habilitada e forçada**, única `(id, empresa_id)` e o índice único parcial do vigente | Introspecção do catálogo | As quatro verdadeiras; a definição do índice contém literalmente `WHERE (substituido_em IS NULL)` |
| CT-812 · `plataforma` íntegra | — | A guarda aprova o roster **e devolve o conjunto examinado** — "não achei nada" não passa por "está tudo certo" | Instância migrada | Exceções vazias **e** conjunto examinado igual ao roster enumerado |
| CT-813 · tabela intrusa | — | Tabela criada em `plataforma` com coluna de empresa é **nomeada** como exceção | `CREATE TABLE plataforma.residuo_com_empresa (…, empresa_id uuid)` | Exatamente uma exceção, nomeando tabela e motivo; removida a tabela, volta a vazio |
| CT-814 · anatomia da função | CA-10, CA-11 | `SECURITY DEFINER`, **zero parâmetros**, `search_path` fixado, `EXECUTE` a `sysloc_app` e **nenhum** privilégio sobre a sequência | Introspecção de `pg_proc` e `has_sequence_privilege` | Zero parâmetros; `prosecdef` verdadeiro; os três privilégios sobre a sequência falsos |
| CT-815 · acesso direto à sequência | — (RN-09) | Nenhuma das três formas de tocar o contador é alcançável fora da função | `nextval`, `setval` e `SELECT last_value` pelo papel da aplicação | As três levantam `42501` nomeando a sequência |

> ⚠️ **CT-815 é a prova literal da RN-09** — *"nenhuma empresa o **enxerga**, **influencia** ou
> **alcança**"* —, e as três palavras mapeiam uma a uma para `SELECT`, `setval` e `nextval`. Provar
> só uma delas deixaria a regra dois terços aberta.

**(c) Autorização e superfície** (`cobertura-de-autorizacao.e2e.spec.ts`)

| Cenário | CA | Objetivo (invariante) | Trigger | Esperado |
|---------|----|----------------------|---------|----------|
| CT-836 · exigência e superfície | CA-01..CA-03, CA-07..CA-09 | As três rotas declaram a área; o registro declara **também** a ação; nenhuma pública; `semDeclaracao` vazio; e a superfície fecha por **dupla medição independente com a igualdade entre os eixos afirmada** | Introspecção da guarda + as duas medições | Retrato de exigência por igualdade de objeto; `N₁ = N₂ = 92` e `M₁ = M₂ = 77` · **prova de falsificação** |
| CT-837 · sessão sem a chave | — | `403 ACESSO_NEGADO` nas três, **e nenhuma escrita no banco antes da recusa** | Sessão de `USUARIO_EMPRESA` (cuja matriz padrão é só `TELA:resumo`) | `403` com o envelope canônico nas três; contagem de linhas idêntica antes e depois |
| CT-838 · sem sessão | — | `401` nas três, antes de qualquer acesso ao banco | Chamadas sem cookie | `401` com o envelope canônico |

⚠️ **O CT-836 afirma o inventário desta fatia — 3 pares — ANTES de comparar com o total.** É o que
impede o caso de "fechar a conta" por acaso quando duas rotas mudarem em direções opostas; o
precedente é o `CT-635`, e o `CT-732` acrescentou o mutante que **nomeia** `{ metodo, caminho,
controlador }` da rota ofensora.

### 19.5 O que deliberadamente NÃO é testado, e por quê

| Não coberto | Razão |
|---|---|
| Operação real de pix | Fora de escopo por decisão de produto (RN-11, CA-14) — pix é **declarado**, não implementado |
| A API de homologação real do provedor | **Proibido pela ADR-0006.** A sonda é exercitada contra servidor TLS real construído pelo próprio caso. A confirmação da habilitação **por data** é pré-condição da fatia (ii) |
| Rotação da chave de cifra e recifra do acervo | Operação de runbook, da F7 — o trade-off já está registrado na §11.3 |
| Restauração de resguardo com o dump carregando material cifrado | A prova de resguardo é o item 1 da F7. O **CT-833** já prova a propriedade de fundo (o estado em repouso é cifra, não claro) sem executar `pg_dump` |
| Carga e desempenho da leitura TLS ou da cifra | **Vedado** por `.claude/rules/testing-stack.md` |
| Agrupamento de conexões por empresa | Adiado para a fatia (ii) por decisão medida (D6-b, §8) — não há o que exercitar aqui |
| `provisionar-base.sh` e `verificar-provisionamento.sh` | Exigem `sudo` com senha interativa; **nenhum subagente os executa**. A suíte cobre o **efeito** (o schema existe na instância efêmera); o script é conduzido pelo orquestrador junto ao operador, com saída preservada, e o gate reporta `executou_testes: false` — o que reflete o **papel** dele, não suíte pulada |

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **O segredo escapa por caminho que ninguém lê** — foi o achado crítico da fase anterior, e a fatia põe um segredo maior perto de mais superfícies | Média | **Crítico** | Contenção estrutural (o valor não é campo de objeto) + radicais novos no registrador + **medição sobre a saída real** de quatro superfícies. Os vetores estão nomeados na §21.1, e a medição tem alvo em vez de ser varredura de boa vontade |
| **O aperto de mão em laço local se comporta diferente sob disputa de CPU** — ele abre porta e conecta a si mesmo | Baixa | Médio | Porta dinâmica (`listen(0)`), teto de tempo declarado, e o par de casos positivo/negativo. O precedente do `CT-907` mostra que o modo de falha é **tempo esgotado**, não resultado errado |
| **A guarda do schema `plataforma` aprova vazia** — o roster desta fatia é vazio, e consulta que não acha nada parece consulta que aprovou | Média | Alto | A guarda devolve o **conjunto examinado** junto do veredito, e o caso afirma a igualdade nas duas direções. É a lição escrita no cabeçalho de `catalogo.ts`, aplicada a um schema novo |
| **O `provisionar-base.sh` não é executável por subagente** (`sudo` interativo), e o schema novo nasce nele | **Alta** | Médio | A instância efêmera reproduz o provisionamento (`banco-efemero.ts`), de modo que a suíte cobre o **efeito**; o script é conduzido pelo orquestrador junto ao operador, com saída preservada e auditada |
| **A chave de cifra não é provisionada** — o débito D39 cresce para duas variáveis | **Alta** | Alto | Partida **falha fechado** nomeando a variável; `.env.example` documenta; o marcador do D39 e a §2 da fatia de origem são atualizados. Fechá-lo de vez exige tocar script com privilégio, fora do que esta fatia pede |
| **O dump passa a conter material cifrado**, e alguém guarda dump e chave juntos | Média | **Crítico** | Cláusula escrita no item de resguardo da F7 (§11.3, §16.6). É risco de **operação**, e a mitigação é documental por natureza — a ADR-0032 diz isso nos Cons |
| **A habilitação junto ao provedor pode não estar válida**, e a verificação não é demonstrável de ponta a ponta contra a API real | Média | Baixo **nesta fatia** | Nenhum caso da suíte toca o provedor real (ADR-0006): a prova é contra servidor TLS real em porta dinâmica. A confirmação **por data** é pré-condição da fatia (ii), e o PRD §9 já a registra |
| **O vocabulário do provedor vaza para o modelo canônico** ao escrever o adaptador | Média | Médio | Asserção de vocabulário sobre a superfície publicada do pacote e do contrato, com prova de falsificação (é asserção estática) |

---

## 21. Observações Técnicas

### 21.1 Medições feitas para esta spec (2026-08-14)

Quatro medições, cada uma decidindo um ponto que o tech-alignment deixou aberto ou que o projeto
supunha. O material usado foi um PKCS#12 gerado em diretório temporário (2.686 bytes — o mesmo porte
do material real medido).

| # | Medido | Como | Consequência |
|---|---|---|---|
| **M1** | `new X509Certificate(pfx)` falha com `ERR_OSSL_PEM_NO_START_LINE`; o aperto de mão em laço local devolve `subject`, `issuer`, `valid_from`, `valid_to`, `fingerprint256` e `serialNumber` | `node` sobre material gerado | **Confirma a N1 e a D2-a.** A linha da stack do `CLAUDE.md` que atribui a `X509Certificate` a *"leitura de `.pfx`"* segue **imprecisa** — corrigi-la não pertence a esta fatia, e está registrado para que ninguém implemente contra a linha errada |
| **M2** | O `ZodError` do Zod 4.4.3 **não carrega o valor recusado** — nem em `issues`, nem em `message`, nem na inspeção profunda | `safeParse` com material e senha sintéticos, sobre o Zod do monorepo | ⚠️ **Refuta o risco que a D3 registra** (*"objeto validado é o que uma falha de validação tende a ecoar"*) para o caminho do Zod. O risco **não some**: ele se desloca para quem registre o **corpo cru**. O caso de medição observa a saída, não presume |
| **M3** | `https.request({ pfx, passphrase })` completa o aperto de mão mútuo e recebe resposta; `fetch` global **não** aceita certificado de cliente sem despachante; `undici` **não resolve** no monorepo | Servidor mTLS local em porta dinâmica | **Decide o ponto 1 dos Pontos em Aberto**: o cliente nativo entrega o que a fatia exerce, logo `undici` **não entra aqui** — ele pertence à fatia que exercer o agrupamento de conexões |
| **M4** | O erro de OpenSSL (`mac verify failure`, `not enough data`) **não carrega** a senha nem os bytes — zero propriedades próprias, e a inspeção profunda não os contém. **Mas** a redação do registrador **não alcança** `materialDoCertificado`, nem `{ certificado: { pfx, passphrase } }`, e segredo interpolado em mensagem sobrevive em `mensagem` e `pilha` | `util.inspect` sobre o erro; três linhas reais pelo `criarLogger` do pacote | **Um vetor a menos e dois a mais.** Justifica o acréscimo de radicais (§10.3) **e** a regra de escrita de que nenhuma mensagem interpola valor vindo do corpo |

### 21.2 Conflito de doutrina resolvido — por que a guarda de `plataforma` mora em módulo próprio

O cabeçalho de `packages/db/src/catalogo.ts` declara uma restrição para toda manutenção futura
**daquele arquivo**: *"nenhum nome de tabela entra em posição executável aqui"* — nem em conjunto
permitido, nem em exceção, nem em filtro —, porque uma lista *"sabe apenas o que alguém lembrou de
escrever nela"*, e é exatamente a tabela nova que ninguém lembra de acrescentar.

A ADR-0031, por sua vez, exige que *"o roster de tabelas de `plataforma` seja **enumerado**"*.

**As duas não se contradizem, e a diferença é a direção da lista.** Em `negocio`, enumerar seria
**isentar** — a lista diria quais tabelas escapam da RLS, e uma tabela esquecida escaparia em
silêncio. Em `plataforma`, enumerar é **admitir** — a lista diz quais tabelas têm licença para viver
fora do alcance da RLS, e uma tabela esquecida **reprova**, que é o efeito oposto. O modo de falha da
omissão se inverte junto com a direção.

Por isso a guarda nova vive em **`catalogo-de-plataforma.ts`**, e não dentro de `catalogo.ts`: pôr um
nome de tabela em posição executável naquele arquivo contrariaria a restrição escrita nele, e o
docblock do módulo novo carrega esta explicação, para que a distinção não precise ser redescoberta.
**`catalogo.ts` não é editado por esta fatia.**

### 21.3 Leitura conjunta obrigatória — ADR-0025 e ADR-0001 sobre o pacote novo

> ⚠️ O cabeçalho desta seção dizia *"ADR-0025 e ADR-0031"* até o challenge de 2026-08-14, e o corpo
> sempre tratou da **0001**. A 0031 é tratada na §21.2. Corrigido para que a §21.5 e esta seção não
> apontem para ADRs diferentes ao discutir o mesmo ponto.

A **ADR-0025** manda o domínio declarar a porta e o adaptador importar dele. A **ADR-0001** nomeia
**cinco** operações da porta bancária (`obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`,
`consultar`), e esta fatia exerce **nenhuma delas** — ela exerce a verificação de identidade, que não
está na lista.

Lidas ao pé da letra e em conjunto, isso poderia ser tomado como divergência da ADR-0001. **Não é**, e
a razão está registrada aqui para não virar achado de gate: a cláusula que a 0001 existe para
garantir é *"nenhum campo, URL ou vocabulário específico de provedor cruza a porta"*, e ela vale
igual para uma operação ou para cinco. Declarar as outras quatro agora seria escolher quatro
assinaturas **sem quem as chame** — complexidade especulativa pelo nome que o catálogo do Gate 2 usa,
e a fatia (ii) as reescreveria contra a API real (D5-b).

**A fatia diz por escrito, e este parágrafo é o registro**: as cinco operações da ADR-0001 chegam com
a fatia que as exerce. A ausência delas aqui **não é omissão**.

#### A cláusula de exclusividade da 0001, e por que a porta nova não a viola

O challenge de 2026-08-14 abriu a `Decision` da 0001 e achou uma cláusula que este parágrafo não
tratava — a palavra **apenas**:

> *"Toda a **operação de cobrança bancária** passa a trafegar em tipos canônicos agnósticos de
> provedor. O núcleo conversa **apenas** com a porta `AdaptadorCobrancaBancaria` (`obter_token`,
> `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar`)."*

Lida sem o sujeito da oração anterior, ela proibiria a `PortaDeIdentidadeBancaria`. **Com** o sujeito,
não: o que a cláusula fecha é o conjunto de portas pelas quais **a operação de cobrança bancária**
trafega, e a verificação de identidade **não é operação de cobrança** — ela não emite, não baixa, não
consulta título e não toca cobrança alguma. É ato de **configuração**, cujo consumidor é o Admin da
empresa na área de integrações, e o `certificado.service.ts` que a chama não é o núcleo de cobrança.
Nenhuma das cinco operações fica acessível por fora da porta que a 0001 nomeia, que é o que o
*"apenas"* protege.

**Duas obrigações decorrem disso, e as duas são desta fatia porque é ela que cria o pacote:**

1. **O nome canônico fica reservado agora.** A porta das cinco operações se chamará
   `AdaptadorCobrancaBancaria` — o nome literal da 0001 —, e nasce na fatia (ii). O pacote
   `@sysloc/cobranca-bancaria` **não** usa esse nome para nenhuma outra coisa, para que a fatia (ii)
   não precise inventá-lo nem renomear o que esta deixou.
2. **A `PortaDeIdentidadeBancaria` está sujeita à mesma cláusula de vocabulário** da 0001 — *"nenhum
   campo, URL ou vocabulário específico de provedor cruza a porta"* —, e é isso que o **CT-809** e o
   **CT-834** medem. Ser porta irmã não a isenta; isenta-a apenas do roster de cinco.

⚠️ **Se o Gate 2 discordar desta leitura**, o caminho é emendar a 0001 explicitando que a
exclusividade governa a operação de cobrança e não a fronteira inteira com o provedor — **não** é
suprimir a porta. Fica registrado para que a discordância, se vier, chegue com o desfecho já
desenhado, em vez de custar uma rodada.

### 21.4 Débitos com gatilho — conferidos contra o CÓDIGO, não contra o índice

O tech-alignment §6 levantou dois candidatos a disparo. Os dois foram abertos e lidos no ponto do
marcador:

| Débito | Gatilho literal | Dispara? |
|---|---|---|
| **D26** (F3/T8) | *"TERCEIRO consumidor de aritmética de calendário **do pacote**"* — `ultimoDiaDoMes` e `ehBissexto` | **NÃO.** Esta fatia não usa regra gregoriana: `diasParaVencer` é diferença entre datas, e o prefixo `AAAAMM` é extração de ano e mês. Além disso, a derivação do estado vive na **aplicação** (D8-b), não em `@sysloc/db` |
| **D14** (F3/T5) | *"a primeira migração que **redefinir** `negocio.data_corrente_da_operacao()`"* | **NÃO.** A fatia **consome** a função; não a redefine. A `0010`, onde ela vive, não é tocada |
| **D1** (F3/T2) | *"o TERCEIRO consumidor monetário do pacote (a emissão de boleto da F4 é a candidata óbvia)"* | **NÃO nesta fatia** — não há valor monetário aqui. O gatilho é da fatia **(ii)**, que emite |
| **D12** (F3/T10) | *"a TERCEIRA mensagem de e-mail do produto (o boleto, na F4)"* | **NÃO** — esta fatia não envia mensagem nenhuma; o alerta de vencimento é **estado publicado** |
| **D5** (F3/T7) | *"o TERCEIRO consumidor de extração de texto de PDF (o carnê da F4)"* | **NÃO** — o carnê é da fatia **(iii)** |
| **D39** (F1/fechamento) | *"a próxima instalação do zero"* | **NÃO dispara, mas CRESCE** — ver §11.6. Atualizar o marcador e a §2 da fatia de origem é trabalho **desta** fatia |
| **D20** (F3/T7) | *"a primeira aplicação da `0010` a banco durável"* | **NÃO** — nada aqui toca a `0010` |

### 21.5 ADRs Aplicáveis nesta Feature

Inventário declarativo sobre as **26 ADRs `accepted`**. A conformidade das aplicáveis foi confrontada
contra o texto da `Decision`, aberto arquivo por arquivo — não contra a linha-resumo do `INDEX.md`.

| ADR | Classificação | Onde incide, e o trecho literal que a decisão satisfaz |
|---|---|---|
| **0001** — modelo canônico com adaptador por provedor | **PARCIAL** | §3.2, §21.3. Satisfaz *"nenhum campo, URL ou vocabulário específico de provedor cruza a porta"*; as cinco operações nomeadas chegam com a fatia que as exerce, e o registro está na §21.3 |
| **0005** — rotinas versionadas, nenhuma carregando credencial | **PARCIAL** | §16.3. O passo novo de `provisionar-base.sh` **não carrega segredo**: cria schema. A chave de cifra entra por configuração não versionada, que é *"condição de entrada, não ajuste posterior"* |
| **0006** — ambiente de verificação separado do que atende a operação | **APLICÁVEL** | §19, §21.1. Nenhum caso toca o provedor real nem o banco de operação; o helper efêmero ignora `DATABASE_URL` por construção |
| **0008** — isolamento garantido pelo banco | **APLICÁVEL** | §7.2. `empresa_id`, RLS com `USING` e `WITH CHECK`, **e** a chave estrangeira composta `(id, empresa_id)` como *"forma de referência entre entidades tenantizadas"*. A aplicação **não** implementa filtro equivalente |
| **0009** — fronteira por schema, cobertura no catálogo | **APLICÁVEL** | §7.2, §7.3. A tabela nasce em `negocio` com RLS forçada; o schema novo é conferido *"no catálogo do sistema"*, nunca por lista à mão |
| **0010** — efetivo de permissão na sessão, revalidado por versão | **PARCIAL** | §11.2. Consumido sem alteração: as três rotas leem o efetivo que a sessão carrega |
| **0011** — cobertura por rota, default que nega | **APLICÁVEL** | §11.2. As três declaram; `semDeclaracao` permanece vazio, e a cobertura é *"consultada sobre a superfície publicada"* |
| **0013** — alcance da garantia do operador do SaaS | **APLICÁVEL** | §11.2. *"Nenhuma requisição autenticada como operador devolve dado de negócio de empresa alguma"* — é o que põe o Master fora, sem regra nova |
| **0014** — exclusão lógica para entidade de cadastro | **N/A** | §7.5. Certificado **não é** entidade de cadastro: ninguém o nomeia nem o referencia de outro registro. O discriminador da ADR é *"ser referenciável"* |
| **0015** — contador por empresa, furo aceito, número nunca reusado | **SUPERSEDED — não citar como vigente** | `superseded-by:0033` desde 2026-08-14, pelo conflito que esta spec levantou (§21.9). Quem ler esta linha procurando a política de contador vai para a **0033** |
| **0033** — cada série declara o próprio escopo, furo aceito, número nunca reusado | **APLICÁVEL** | §7.2, §7.4, §21.9. *"Toda série sequencial deste produto declara o próprio escopo… o identificador perante o provedor declara **o SaaS**, e pedi-lo em nome de uma empresa é irrepresentável"* — é literalmente o que a função sem parâmetro materializa (§7.2), e o **CT-814** o mede pela ausência de parâmetro em `pg_proc`. As cláusulas *"furo aceito"* e *"número nunca reusado"* atravessaram inteiras da 0015, e o **CT-817** prova a segunda |
| **0016** — o esquema é a fonte única do contrato | **APLICÁVEL** | §4.2, §15.3. Conferência, tipo e documento derivam do mesmo esquema; **nenhuma** descrição escrita à mão em paralelo. É a razão de a D3-b recusar corpo em partes múltiplas |
| **0017** — forma canônica, três classes de chave exposta | **APLICÁVEL** | §4.1, §10.1. Chave exposta é **UUID** (não há série declarada para o certificado); corpo em camelCase; envelope de erro `{ codigo, mensagem, campo?, detalhes? }` com `codigo` de enum fechado |
| **0018** — exigências compostas, cobertura por conteúdo | **APLICÁVEL** | §11.2. O registro declara a **conjunção**, e a recusa nomeia *"a primeira ausente na ordem declarada"* |
| **0020** — número de série por contador do banco fora do desfazimento | **APLICÁVEL** | §7.2, §7.4. *"Contador do próprio banco, um por escopo declarado da série, cujo avanço não participa do desfazimento"* — instanciado com escopo SaaS, com **uma** função só, porque o escopo não tem parte variável (D7) |
| **0021** — transição governada conforme a natureza do ato | **N/A — citada só por analogia** | §4.1. Nenhuma das três rotas é *"transição de estado de entidade de negócio"* nem *"atributo operacional do cadastro"*, que são o sujeito e a segunda classe da `Decision`; as *"Instâncias declaradas da segunda classe"* não nomeiam a verificação. A exigência das três apoia-se em **0011 + 0018**, com a **RN-06** classificando o ato. Da 0021 se aproveita a **régua** (natureza do ato) e a forma *"ato é rota própria"* — nunca como cláusula governante |
| **0022** — o que se grava e o que se deriva num fato financeiro | **PARCIAL** | §6.2. A segunda cláusula (*"o estado publicado é derivado dos fatos gravados, nunca coluna movida por rotina"*) é o que a RN-04 instancia para a vigência |
| **0023** — onde vive a derivação de valor não persistido | **APLICÁVEL** | §6.2. *"Vive na aplicação quando serve apenas à apresentação do registro já selecionado"* — é o caso: uma linha por empresa, sem filtro nem ordenação por estado. Se a fatia (ii) precisar **filtrar** empresas por estado, a derivação sobe para o banco (gatilho registrado, não dívida silenciosa) |
| **0024** — origem do contexto de tenant sem requisição | **N/A** | Não há execução fora de requisição nesta fatia |
| **0025** — o domínio declara a porta, o adaptador depende dele | **APLICÁVEL** | §3.3. *"O pacote de domínio declara o tipo do dado que atravessa e a interface da porta; o adaptador importa dele"*, e a porta chega **por parâmetro** |
| **0026** — o relógio da operação mora no banco | **APLICÁVEL** | §6.2, §7.4. A validade e a competência saem de `data_corrente_da_operacao()`; *"a aplicação recebe o instante já resolvido, por parâmetro, e a decisão que o consome é pura"* |
| **0027** — critério para dispensar sessão | **N/A** | §11.1. Nenhuma rota dispensa sessão; o Admin **é** usuário do sistema |
| **0028** — o que o contrato publica para rota que devolve bytes | **N/A** | §4.1. Nenhuma rota devolve bytes |
| **0029** — efeito externo sai por fila | **APLICÁVEL** | §4.3. A verificação é *"chamada síncrona a terceiro cujo retorno o solicitante espera na própria resposta"*, e a `Decision` diz que ela *"permanece em linha, e não é exceção"* |
| **0030** — artefato derivado é composto sob demanda | **N/A** | Não há artefato derivado aqui. ⚠️ A **cláusula de exclusão** dela (*"fato recebido de terceiro… não é artefato derivado"*) alcança o boleto da fatia (ii), não esta |
| **0031** — tabela sem dono-empresa vive fora do schema de negócio | **APLICÁVEL** | §7.2, §7.3, §21.2. *"Fora do schema de negócio, num terceiro schema — `plataforma` — e não carrega `empresa_id`"*, com *"o roster enumerado"* e a admissão conferida *"nas duas pontas"*. ⚠️ O discovery escreve `integracao.notificacao_bancaria`; o nome do schema que **vale** é `plataforma`, fixado pela ADR |
| **0032** — segredo operável é cifrado, nunca retorna, se prova por medição | **APLICÁVEL** | §11.3, §10.3, §19. *"Cifrado de forma reversível, com a chave vivendo fora da árvore versionada e fora do mesmo pacote em que o material cifrado é salvaguardado"*; *"não retorna por superfície alguma"*; e a ausência de vazamento *"afirmada por medição da saída real, nunca por leitura do código"* |

✅ **Nenhum conflito spec × ADR resta aberto — e agora a afirmação é verificável, não retórica.** O
único que restava, o da **ADR-0015**, foi **resolvido em 2026-08-14 pela ADR-0033**, que a supersede
(§21.9). Os outros dois pontos que poderiam ser lidos como divergência estão resolvidos por escrito:
a ADR-0001 na §21.3, e a doutrina de `catalogo.ts` contra a ADR-0031 na §21.2.

> ⚠️ **Esta frase já foi falsa duas vezes, e vale saber por quê antes de confiar nela.** A spec
> nasceu afirmando *"nenhum conflito spec × ADR restou aberto"*, e o **challenge de 2026-08-14** a
> derrubou ao abrir a `Decision` da 0015 em vez de ler a linha-resumo. Foi a segunda vez que a mesma
> afirmação caiu pelo mesmo método — a primeira foi na sub-fatia `documentos-e-confirmacao` —, e a
> lição está no `CLAUDE.md`: *"citar ADR exige abrir a `Decision`"*. Ela volta a valer aqui porque o
> conflito foi **fechado no artefato certo** (a ADR), não porque alguém releu a linha com mais
> otimismo.

### 21.9 Conflito com a ADR-0015 — RESOLVIDO pela ADR-0033 em 2026-08-14

> ✅ **Fechado. Esta seção deixou de ser pré-requisito e passou a ser registro.** A
> **[ADR-0033](../../../../adr/0033-serie-declara-o-proprio-escopo-com-furo-aceito.md)** foi criada e
> aceita em 2026-08-14, e a **0015 está `superseded-by:0033`**. Nada bloqueia a T1 por este motivo.
> O texto abaixo permanece porque é o **raciocínio que produziu a ADR** — quem revisar a 0033 depois
> precisa poder reconstituir por que ela existe, e o `Context` dela é necessariamente mais curto.
>
> **O que mudou entre o diagnóstico e o desfecho**: o challenge propunha **emendar** a 0015, no molde
> da 0021 e da 0024. O supersede foi escolhido no lugar, e a razão está nas `Alternatives considered`
> da 0033: naqueles dois precedentes *"a decisão não mudou, mudou o registro dela"*; **aqui a extensão
> é real** — o universo de unicidade deixa de ser um só —, e reescrever o texto da 0015 apagaria a
> razão pela qual a regra antiga estava certa quando foi tomada. A 0015 permanece legível, com o
> `Applied in` intacto.

**O conflito, literal.** A `Decision` da ADR-0015 abria assim:

> *"Todo contador sequencial deste produto é **único por empresa**, e cada série declara o próprio
> escopo (o contrato inclui o ano no escopo; uma série sem ano é igualmente válida)."*

O contador desta fatia é **único no SaaS** — é o que a RN-07 exige, o que a RN-09 impõe pelo banco e o
que a decisão de produto **23** fecha. Ele falsifica o quantificador universal da primeira cláusula.
A segunda cláusula **não o salva**: os dois exemplos que ela dá variam o escopo na dimensão do **ano**,
e a única série "sem ano" que a ADR contempla continua sendo por empresa.

**Por que isto não se resolve conformando a spec.** Conformar significaria tornar o contador por
empresa — o que reabre exatamente o defeito que a fatia existe para fechar (duas empresas emitindo no
mesmo mês disputando o mesmo número, PRD §2) e contraria a decisão 23, a RN-07 e a RN-09. Não é opção.

**A resolução foi superseder a 0015 pela ADR-0033** (`/agent-spec-adr-supersede 0015`, 2026-08-14). A
`Decision` vigente, que é a que o executor lê:

> *"Toda série sequencial deste produto **declara o próprio escopo**, e o escopo é parte da definição
> da série — não uma variação dentro de um padrão por empresa. Contrato e cobrança declaram
> `(empresa, ano)`; o identificador perante o provedor declara **o SaaS**, e pedi-lo em nome de uma
> empresa é irrepresentável. Dentro do escopo declarado, criações concorrentes **não esperam umas
> pelas outras** — **furo na sequência é aceito** — e o número **nunca é reusado**, nem por registro
> excluído, nem por criação abortada."*

**Duas cláusulas atravessaram intactas** — *furo aceito* e *número nunca reusado* —, e é isso que
torna o **CT-817** (número de transação desfeita nunca reentregue) prova da 0033 sem ter sido escrito
para ela. **Uma cláusula mudou**: o escopo deixou de ser fixo em `empresa` e passou a ser campo
declarado da série. É essa mudança que torna `plataforma.proximo_identificador_bancario()` **sem
parâmetro** a materialização literal da ADR, e não uma exceção tolerada — a ausência de parâmetro é a
declaração de escopo, e o **CT-814** a mede em `pg_proc`.

**O que o executor precisa saber, em uma linha**: a política de contador deste produto é a **0033**.
A 0015 continua legível como história e **não se cita como vigente**.

⚠️ **A 0033 não substitui a ADR-0020, e as duas se leem juntas.** A 0033 fixa o **escopo** da série;
a 0020 fixa o **mecanismo** pelo qual o número nasce (contador do próprio banco, cujo avanço não
participa do desfazimento). O `Context` da 0020 foi atualizado no mesmo ato para citar a 0033 — ele
abria repetindo a cláusula *"único por empresa"*, que deixou de valer.

### 21.6 Candidatos a ADR (hook de detecção)

- **Entrada de bytes pela borda** — **candidato PARCIAL**, e por isso **não** promovido. Espelho da
  ADR-0028, que governa a rota que **devolve** bytes. Falha em **C1 (transversal)**: há um único
  consumidor hoje, e o segundo previsto (o carnê da fatia iii) **devolve** bytes, não recebe. Fica
  registrado como decisão de feature (D3-b, §4.1.1); promova a ADR se e quando uma segunda rota de
  **entrada** de bytes aparecer.
- **Nenhum candidato 5/5.** A decisão de classe que esta fatia produziria — a guarda do segredo
  operável — **já foi registrada** na ADR-0032, e o lugar da tabela sem dono, na ADR-0031. As duas
  estão `accepted` desde 2026-08-14 e são pré-requisito desta spec, não produto dela.
- **A sessão de challenge de 2026-08-14 confirmou o veredito acima e não produziu candidato novo.** O
  que ela produziu foi a **ADR-0033**, que **supersede a 0015** (§21.9) — e isso é categoria distinta
  de "candidato": não nasceu de uma decisão desta fatia, nasceu de uma decisão **antiga cujo alcance a
  fatia estendeu**. Ela não passou pelo hook de detecção; passou pelos 5 critérios no gate da
  `/agent-spec-adr-supersede`, que é onde essa classe é validada.
- **Por que supersede e não emenda**, já que a 0021 e a 0024 foram emendadas: naquelas duas *"a decisão
  não mudou, mudou o registro dela"*. Na 0015 a extensão é **real** — o universo de unicidade deixa de
  ser um só —, e reescrever o texto apagaria a razão pela qual a regra antiga estava certa quando foi
  tomada. O critério que separa os dois instrumentos, e que vale para a próxima vez: **emenda quando o
  registro ficou falso; supersede quando a decisão passou a alcançar um caso que ela excluía.**
- **Um quase-candidato examinado e recusado**: *"a sonda de identidade é o aperto de mão, não a
  obtenção de credencial de acesso"* (§8). Falha em **C1 (transversal)** — vale para um provedor, numa
  fatia — e em **C3 (custo de reversão)**, porque a fatia (ii) a substitui por construção, com o
  gatilho já escrito. É decisão de feature com débito datado, que é exatamente o instrumento certo
  para ela.

### 21.7 Vocabulário — divergência CANONIZADA no challenge de 2026-08-14

O glossário global (`docs/specs/domain-glossary.md`) definia **Contador sequencial** como *"número
único e contínuo mantido pela imobiliária"*. Esta feature o torna **único do SaaS inteiro**, e não da
imobiliária — é o que a decisão 23 pede e o que a medição do sistema antigo confirma (`sequencial.py`:
a sequência já é global, e o `AAAAMM` é decorativo).

✅ **Resolvido — a divergência não está mais aberta.** A sessão de challenge, que é a dona do
glossário, gravou:

**No glossário GLOBAL** (`docs/specs/domain-glossary.md`), cinco termos, quatro deles novos:

| Termo | O que mudou |
|---|---|
| **Contador sequencial** | Definição **corrigida**: o escopo é o SaaS, não a imobiliária. Alias novo a evitar: *contador da empresa* |
| **Identificador perante o provedor** | **Novo.** A composição de 18 posições ganha termo próprio — a ambiguidade "seu número" já apontava para ele sem que ele existisse |
| **Certificado do provedor** | **Novo.** A entidade que as três fatias da F4 consomem |
| **Segredo operável** | **Novo.** A classe que a ADR-0032 fixa, oposta ao segredo verificável |
| **Meio de recebimento** | **Novo.** Boleto e pix, de lista fechada |

Mais cinco relacionamentos e quatro ambiguidades resolvidas — entre elas a do próprio contador, que
registra **por que** a definição antiga era falsa (ela vinha de um sistema que atendia uma empresa só,
onde os dois escopos coincidiam) e fixa a regra que reconcilia os três contadores do produto: *cada
série declara o próprio escopo*.

**No glossário FEATURE** (`docs/specs/features/fundacao-bancaria/domain-glossary.md`, **criado**),
quatro termos operacionais que não atravessam features: **Estado do certificado**, **Verificação de
identidade**, **Renovação por substituição** e **Caminho de reserva** — este último existindo
justamente para nomear o que foi removido.

✅ **A ponta da ADR também fechou** — a **0033** supersede a 0015 e fixa em `Decision` a mesma regra
que o glossário passou a registrar como ambiguidade resolvida (§21.9). Os dois artefatos são
distintos e ambos precisavam mudar: o glossário fixa o **termo**, a ADR fixa a **decisão**, e é a
`Decision` que o executor lê como vinculante. Corrigir só o glossário teria deixado o executor
implementando contra uma ADR que a implementação falsifica.

### 21.8 Duas notas de fronteira

- **Nenhum código de frontend.** As telas que o Admin usa para entregar o certificado, ver a validade
  e disparar a verificação são implementadas **fora deste repositório**, a partir do handoff. O que
  esta fatia entrega ao frontend é o contrato tipado.
- **Nenhuma captura do sistema antigo.** O discovery mediu que o fonte e a suíte legados estão
  versionados em `/opt/frappe/app-sync` e **não expiram** — não há janela de oráculo a fechar aqui.
  O legado foi lido nesta spec como **insumo** (o formato do identificador e o aperto de mão), nunca
  como oráculo executável.

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-09 mapeadas na 17; CA-01 a CA-14 na 19)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6)
- [x] Persistência: tabelas, índices, migrações, transação (seção 7)
- [x] Integrações externas mapeadas (seção 8)
- [x] Sincronização: eventos, idempotência (seção 9) — declarada **N/A** com a razão
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13) — métricas e alertas **N/A** com a razão
- [x] Feature flags listadas (seção 14) — **N/A** com a razão
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura: pipeline, empacotamento, IaC, rollout (seção 16)
- [x] Dependências externas listadas (seção 18) — **zero novas**
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19, com rastreabilidade CA→CT)
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4-3.7)
- [x] Pronto para geração das TASKS
