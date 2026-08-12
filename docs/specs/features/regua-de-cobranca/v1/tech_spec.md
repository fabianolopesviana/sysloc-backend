# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação

- **Feature/Projeto**: Régua de cobrança por empresa — o aviso ao inadimplente, configurável, auditado e sem cobrar dívida que não existe
- **Variante**: **backend**
- **Stack**: Node 24 LTS · TypeScript 7 strict · NestJS 11 + Fastify · Drizzle + postgres.js · PostgreSQL 18 (RLS forçada) · Zod 4 · BullMQ 5 + ioredis · **nodemailer (dependência nova)** · Pino · Vitest + `embedded-postgres`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-11
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/regua-de-cobranca/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/regua-de-cobranca/v1/tech-alignment.md` (decisões **D1** a **D6**, todas respeitadas)
- **Oráculo**: `docs/specs/features/caracterizacao-regras-legadas/v1/golden/regua-de-cobranca.json`

---

## 2. Resumo Técnico da Solução

A régua nasce como **pacote de domínio próprio** (`@sysloc/regua`) consumido pelos **dois** caminhos — o trabalho enfileirado no `worker` e o disparo manual na `api` —, de modo que a decisão de quem é avisado exista **num lugar só**: é essa unicidade, e não uma guarda escrita na régua, que torna impossível o caminho manual discordar do automático, que é o defeito medido no legado (REG-08).

O conjunto de candidatas se apura **no banco** (ADR-0023), sobre `negocio.cobranca_derivada` — a fonte única do estado publicado (ADR-0022) —, num predicado que já carrega a política da empresa e a trava de intervalo. Duas tabelas novas entram em `negocio` com `empresa_id`, RLS **habilitada e forçada** e FK composta: `politica_de_aviso` (uma linha por empresa, régua **desligada** por padrão) e `envio_de_cobranca` (o registro de toda tentativa, com caminho, desfecho, destinatário e causa).

A saída de e-mail é uma **porta** com dois adaptadores — produção e captura — e a barreira **falha fechado**: sem transporte declarado, o processo **recusa a partida** em vez de degradar em silêncio. A verificação injeta o adaptador de captura e afirma sobre o que foi capturado; nenhum envio real acontece por nenhum caminho (CA-17/RN-15).

O contexto de tenant do trabalho enfileirado vem da **carga do job**, aberto uma vez na borda pelo mesmo escritor único da borda HTTP (**ADR-0024**). O contrato da fila desce para `@sysloc/shared`, fechando o débito **D32 (F0/T6)**, que dispara aqui. A superfície publicada sobe de **82/67** para **86/71**.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
                            ┌───────────────────────────────────────────┐
                            │       @sysloc/regua  (NOVO) — o núcleo    │
     ┌──────────────────────┤  decidirJanelaDeHorario · comporAviso     │
     │                      │  executarReguaDaEmpresa · enviarAvisoDe   │
     │                      │  PortaDeEnvioDeEmail · PortaDeCandidatas  │
     │                      │  PortaDeRegistro · CandidataAoAviso       │
     │                      └───────▲───────────────────────▲───────────┘
     │                              │ implementa            │ implementa
     │  ┌───────────────────────────┴──────┐   ┌────────────┴─────────────┐
     │  │        @sysloc/db                │   │  adaptador de e-mail     │
     │  │  selecionarCandidatasAoAviso     │   │  produção (nodemailer)   │
     │  │  registrarEnvioDeCobranca        │   │  captura (verificação)   │
     │  │  ler/gravarPoliticaDeAviso       │   └──────────────────────────┘
     │  │  lerEnviosDaCobranca             │
     │  └───────────────┬──────────────────┘
     │                  │  unidade de trabalho + SET LOCAL app.empresa_id
     │        ┌─────────▼──────────────────────────────────────┐
     │        │  PostgreSQL 18 — schema `negocio`, RLS forçada │
     │        │  cobranca_derivada · politica_de_aviso ·        │
     │        │  envio_de_cobranca · configuracao_de_mora       │
     │        └────────────────────────────────────────────────┘
     │
     ├── apps/api  ──► AutomacaoDeCobrancaController (4 rotas · sessão ► contexto)
     │                 ▲ o disparo MANUAL executa aqui, na hora, síncrono
     │
     └── apps/worker ──► tarefas/regua.ts ◄── fila `regua-de-cobranca`
                         ▲ contexto vem da CARGA do job (ADR-0024)

     packages/shared/src/fila.ts (NOVO) — nome, opções e tipos de carga das filas
     ▲ produtor (api/F5) e consumidor (worker) leem daqui — fecha o D32
```

**Os dois caminhos, e o que eles compartilham.** O automático percorre as candidatas de **uma** empresa; o manual age sobre **uma** cobrança. Os dois entram em `@sysloc/regua` e passam pelo **mesmo** teste de admissão sobre o estado publicado — o que muda é apenas o que o caminho manual **dispensa** (a janela de horário, a trava de intervalo e o recorte de dias), e a dispensa é declarada como parâmetro, não como um segundo trecho de código.

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|---|---|---|
| `negocio.politica_de_aviso` | A política de aviso de uma empresa — uma linha por empresa, régua desligada por padrão | Persistência |
| `negocio.envio_de_cobranca` | O registro de **toda** tentativa: instante, cobrança, caminho, desfecho, destinatário, causa | Persistência |
| `politica-de-aviso.ts` (`@sysloc/db`) | Porta única de leitura e escrita da política (`upsert` de um comando só) | Dados |
| `envio-de-cobranca.ts` (`@sysloc/db`) | Seleção das candidatas **no banco** (com a junção da §5.1-B′), hora corrente da operação, registro da tentativa, histórico da cobrança | Dados |
| `regua.ts` (`@sysloc/regua`) | `executarReguaDaEmpresa` e `enviarAvisoDeCobranca` — a decisão, num lugar só | Domínio |
| `janela.ts` (`@sysloc/regua`) | A janela de horário — propriedade do job, não da linha (D4) | Domínio |
| `mensagem.ts` (`@sysloc/regua`) | Composição do assunto e do corpo, nos dois moldes do oráculo | Domínio |
| `porta-de-email.ts` (`@sysloc/regua`) | A interface `PortaDeEnvioDeEmail` e o adaptador de **captura** | Domínio |
| `adaptador-smtp.ts` (`@sysloc/regua`) | O adaptador de **produção**, sobre `nodemailer` — recusa a partida sem transporte | Infraestrutura |
| `fila.ts` (`@sysloc/shared`) | Nome, opções de repetição e tipos de carga das filas — o **D32** fechado | Compartilhado |
| `tarefas/regua.ts` (`apps/worker`) | A borda do job: abre o contexto da carga e chama o domínio | Apresentação (fila) |
| `AutomacaoDeCobrancaController` | As 4 rotas sob `TELA:automacao_de_cobranca` | Apresentação (HTTP) |
| `AutomacaoDeCobrancaService` | Orquestra as portas de dados sob o executor recebido da borda | Aplicação |
| `automacao-de-cobranca.ts` (`@sysloc/contracts`) | Os esquemas — fonte única do contrato (ADR-0016) | Contrato |

### 3.3 Camadas e Fronteiras

Estilo **hexagonal por dentro, em camadas por fora** — o que a base já pratica:

1. **`@sysloc/db` continua sendo a porta única para `negocio`.** Nenhum SQL contra o schema é escrito fora dele, e o índice do pacote é auditado por **igualdade** (`CT-012`). O predicado de elegibilidade — que é SQL — mora aqui, e não em `@sysloc/regua`; o que sobe para o domínio é o **resultado** da seleção. A contenção da §11.2 é de tipo e não alcança texto de SQL, e é justamente por isso que a porta precisa existir.
2. **`@sysloc/regua` não conhece banco nem SMTP.** Ele recebe as candidatas e uma `PortaDeEnvioDeEmail`; devolve o que aconteceu. É o que o torna exercitável sem subir processo.
3. **`@sysloc/regua` é o núcleo, e a seta aponta para ele — `apps/* → @sysloc/regua`, `apps/* → @sysloc/db`, `@sysloc/db → @sysloc/regua`.** Ele **não** importa `@sysloc/db`, nem em valor nem em tipo: as portas de dados chegam a ele **por parâmetro**, como funções, para que a verificação do domínio não precise de banco e para que o pacote não ganhe um segundo caminho para o dado.

   ⚠️ **A seta `db → regua` é deliberada e inverte a leitura ingênua.** É `@sysloc/regua` quem **declara** `CandidataAoAviso`, `PortaDeCandidatas` e `PortaDeRegistro`; `@sysloc/db` **importa esses tipos** para dizer que os satisfaz. É a forma hexagonal canônica — o domínio possui a porta, o adaptador se conforma a ela —, e é o que torna literalmente verdadeira a frase *"a régua não conhece banco"*. A alternativa (o tipo nascendo em `@sysloc/db`) preservaria o desenho ingênuo ao custo de o pacote de domínio passar a falar o vocabulário da camada de dados, e de a frase acima virar meia-verdade (*"não importa valor, só tipo"*). Quem for implementar: **não "corrija" a direção para `regua → db`** achando que é engano.
4. **A unidade de trabalho abre na borda** (o controlador, ou o processador de tarefa) e o executor (`tx`) desce por parâmetro — a forma preferida que `unidade-de-trabalho.ts` já prescreve para composição de serviços.
5. **O contexto de tenant tem escritor único por borda** (ADR-0008 + ADR-0024): a guarda de sessão na `api`, a borda do job no `worker`.

### 3.4 Visão em Árvore

```
.
├── .env.example                                                    [M]
├── deploy
│   ├── scripts
│   │   ├── caracterizacao
│   │   │   ├── extrair-fonte-do-pdf.sh                             [N]
│   │   │   └── verificar-golden.sh                                 [M]
│   │   └── instalacao
│   │       └── verificar-migracao.sh                               [R]
│   └── systemd
│       ├── sysloc-api.service                                      [M]
│       └── sysloc-worker.service                                   [M]
├── docs
│   └── specs/features/caracterizacao-regras-legadas/v1/golden
│       ├── PROCEDENCIA.md                                          [M]
│       ├── contrato-pdf-fonte.py                                   [N]
│       └── regua-de-cobranca.json                                  [R]
├── packages
│   ├── contracts
│   │   ├── src
│   │   │   ├── automacao-de-cobranca.ts                            [N]
│   │   │   ├── cobranca.ts                                         [R]
│   │   │   ├── comum.ts                                            [R]
│   │   │   ├── configuracao-de-mora.ts                             [R]
│   │   │   └── index.ts                                            [M]
│   │   └── test/esquemas.spec.ts                                   [M]
│   ├── db
│   │   ├── migracoes
│   │   │   ├── 0010_seguranca_cobranca.sql                         [R]
│   │   │   ├── 0011_dominio_regua.sql                              [N]
│   │   │   └── 0012_seguranca_regua.sql                            [N]
│   │   ├── src
│   │   │   ├── envio-de-cobranca.ts                                [N]
│   │   │   ├── esquema/negocio.ts                                  [M]
│   │   │   ├── index.ts                                            [M]
│   │   │   ├── politica-de-aviso.ts                                [N]
│   │   │   ├── contexto.ts                                         [M]
│   │   │   ├── contexto-de-escrita.ts                              [R]
│   │   │   └── unidade-de-trabalho.ts                              [R]
│   │   └── test
│   │       ├── banco-efemero.ts                                    [M]
│   │       ├── coerencia-de-migracoes.spec.ts                      [M]
│   │       ├── envio-de-cobranca.spec.ts                           [N]
│   │       ├── fonte-unica-do-estado.spec.ts                       [M]
│   │       ├── isolamento.spec.ts                                  [M]
│   │       ├── papel-de-conexao.spec.ts                            [M]
│   │       ├── politica-de-aviso.spec.ts                           [N]
│   │       └── varredura-de-fontes.ts                              [M]
│   ├── regua                                                       [N]
│   │   ├── package.json                                            [N]
│   │   ├── tsconfig.json                                           [N]
│   │   ├── tsconfig.test.json                                      [N]
│   │   ├── vitest.config.ts                                        [N]
│   │   ├── src
│   │   │   ├── adaptador-smtp.ts                                   [N]
│   │   │   ├── index.ts                                            [N]
│   │   │   ├── janela.ts                                           [N]
│   │   │   ├── mensagem.ts                                         [N]
│   │   │   ├── porta-de-dados.ts                                   [N]
│   │   │   ├── porta-de-email.ts                                   [N]
│   │   │   └── regua.ts                                            [N]
│   │   └── test
│   │       ├── barreira-de-envio.spec.ts                           [N]
│   │       ├── equivalencia-com-o-oraculo.spec.ts                  [N]
│   │       ├── janela.spec.ts                                      [N]
│   │       ├── mensagem.spec.ts                                    [N]
│   │       └── regua.spec.ts                                       [N]
│   ├── shared
│   │   ├── src
│   │   │   ├── fila.ts                                             [N]
│   │   │   └── index.ts                                            [M]
│   │   └── test
│   │       ├── protocolo-antirregressao.spec.ts                    [M]
│   │       └── redis-efemero.ts                                    [R]
│   └── auth/src/catalogo-de-permissoes.ts                          [R]
└── apps
    ├── api
    │   ├── package.json                                            [M]
    │   ├── src
    │   │   ├── app.module.ts                                       [M]
    │   │   ├── automacao
    │   │   │   ├── automacao.controller.ts                         [N]
    │   │   │   ├── automacao.module.ts                             [N]
    │   │   │   └── automacao.service.ts                            [N]
    │   │   ├── comum/contexto-da-sessao.ts                         [R]
    │   │   ├── configuracao/ambiente.ts                            [M]
    │   │   └── mora/mora.controller.ts                             [R]
    │   └── test
    │       ├── ambiente.spec.ts                                    [M]
    │       ├── automacao-de-cobranca.e2e.spec.ts                   [N]
    │       ├── autorizacao-do-dominio.e2e.spec.ts                  [M]
    │       └── cobertura-de-autorizacao.e2e.spec.ts                [M]
    └── worker
        ├── package.json                                            [M]
        ├── src
        │   ├── fila.ts                                             [M]
        │   ├── main.ts                                             [M]
        │   └── tarefas/regua.ts                                    [N]
        └── test
            ├── ambiente.spec.ts                                    [M]
            └── regua.spec.ts                                       [N]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---|---|---|
| `packages/db/migracoes/0011_dominio_regua.sql` | As duas tabelas, os três enums, restrições e índices | Persistência |
| `packages/db/migracoes/0012_seguranca_regua.sql` | `FORCE ROW LEVEL SECURITY`, as duas políticas e os `GRANT USAGE ON TYPE` | Persistência |
| `packages/db/src/politica-de-aviso.ts` | Porta única da política: leitura sem `404` e `upsert` de um comando | Dados |
| `packages/db/src/envio-de-cobranca.ts` | O predicado de elegibilidade **com a junção da §5.1-B′** (contato e imóvel), `lerHoraCorrenteDaOperacao` (§5.1-B passo 4), o registro da tentativa e o histórico | Dados |
| `packages/db/test/politica-de-aviso.spec.ts` | Prova da porta contra banco efêmero, com isolamento entre empresas | Teste |
| `packages/db/test/envio-de-cobranca.spec.ts` | Prova do predicado — estado, dias, trava e isolamento | Teste |
| `packages/contracts/src/automacao-de-cobranca.ts` | Os esquemas de entrada e de saída da política e do envio | Contrato |
| `packages/shared/src/fila.ts` | Nome, opções de repetição e tipos de carga — o **D32** fechado | Compartilhado |
| `packages/regua/test/barreira-de-envio.spec.ts` | **CT-626** — a suíte não alcança rede, provado por construção | Teste |
| `packages/regua/package.json` · `tsconfig.json` · `tsconfig.test.json` · `vitest.config.ts` | O pacote novo, no molde de `@sysloc/contracts` | Build |
| `packages/regua/src/index.ts` | Superfície pública declarada símbolo a símbolo | Domínio |
| `packages/regua/src/regua.ts` | `executarReguaDaEmpresa` e `enviarAvisoDeCobranca` | Domínio |
| `packages/regua/src/janela.ts` | A janela de horário, e a normalização `HH:MM` do oráculo | Domínio |
| `packages/regua/src/mensagem.ts` | Os dois moldes de mensagem (a vencer × vencida) | Domínio |
| `packages/regua/src/porta-de-email.ts` | A interface e o adaptador de **captura** | Domínio |
| `packages/regua/src/porta-de-dados.ts` | `CandidataAoAviso`, `PortaDeCandidatas` e `PortaDeRegistro` — **o domínio é o dono das portas**, e `@sysloc/db` importa daqui (§3.3.3) | Domínio |
| `packages/regua/src/adaptador-smtp.ts` | O adaptador de produção, com a barreira que falha fechado | Infraestrutura |
| `packages/regua/test/*.spec.ts` (5 arquivos) | `regua`, `janela`, `mensagem`, `barreira-de-envio` e a **equivalência com o oráculo** | Teste |
| `apps/api/src/automacao/automacao.controller.ts` | As 4 rotas | Apresentação |
| `apps/api/src/automacao/automacao.service.ts` | Orquestração sob o executor recebido da borda | Aplicação |
| `apps/api/src/automacao/automacao.module.ts` | Fiação do módulo | Composição |
| `apps/api/test/automacao-de-cobranca.e2e.spec.ts` | As 4 rotas por HTTP real | Teste |
| `apps/worker/src/tarefas/regua.ts` | A borda do job — abre o contexto da carga | Apresentação (fila) |
| `apps/worker/test/regua.spec.ts` | Prova do job contra fila e banco efêmeros | Teste |
| `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh` | **CA-01** — extrai o fonte do Server Script do banco legado | Infraestrutura |
| `docs/.../golden/contrato-pdf-fonte.py` | O artefato versionado da **CA-01** | Referência |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---|---|---|
| `packages/db/src/esquema/negocio.ts` | +2 tabelas, +3 enums | O schema é a declaração única da estrutura |
| `packages/db/src/index.ts` | Publicar as portas novas, com a justificativa de índice | O `CT-012` audita por **igualdade** |
| `packages/db/package.json` | +`@sysloc/regua` (`workspace:*`) | A seta `db → regua` da §3.3.3 — `@sysloc/db` importa os tipos de porta que o domínio declara |
| `packages/db/src/contexto.ts` | Emendar o cabeçalho: o escritor deixa de ser um e passa a ser **um por borda** | ADR-0024 nomeia o `Cons` exatamente disto |
| `packages/db/test/papel-de-conexao.spec.ts` | A lista de tabelas de `negocio` vai de 12 para 14 | O próprio arquivo declara que atualizar a lista é a manutenção legítima |
| `packages/db/test/banco-efemero.ts` | Semear política de aviso e locatário sem endereço | Precondição de CA-03 e CA-16 |
| `packages/db/test/isolamento.spec.ts` | **CT-607** — as duas tabelas novas na suíte canônica de isolamento | O isolamento é auditado por conjunto, não por amostra |
| `packages/db/test/coerencia-de-migracoes.spec.ts` | **CT-608** — RLS forçada, política, FK composta e enums por introspecção | Área crítica `db_migrations` |
| `packages/db/test/fonte-unica-do-estado.spec.ts` · `varredura-de-fontes.ts` | **CT-612** e **CT-624** — estender a varredura a `packages/regua/src/**` e `apps/worker/src/**` | Sem estender, o pacote novo fica fora da guarda |
| `packages/shared/test/protocolo-antirregressao.spec.ts` | **CT-638** — o fecho do D32 conferido nas **duas pontas** | A barreira executável do protocolo já confere o índice |
| `apps/api/test/autorizacao-do-dominio.e2e.spec.ts` | **CT-633** e **CT-634** — as quatro rotas novas | Suíte canônica de autorização do domínio |
| `packages/contracts/src/index.ts` | Publicar os esquemas novos | Superfície declarada símbolo a símbolo |
| `packages/contracts/test/esquemas.spec.ts` | Incluir os esquemas novos na varredura entrada-fechada/saída-aberta | A varredura é por conjunto, não por amostra |
| `packages/shared/src/index.ts` | Publicar o contrato da fila | Fechar o **D32** |
| `apps/worker/src/fila.ts` | Importar o contrato de `@sysloc/shared`, **remover o marcador `DÉBITO COM GATILHO — D32`**, registrar a fila da régua | O gatilho do D32 disparou; o marcador sai no mesmo commit |
| `apps/worker/src/main.ts` | `lerAmbiente` passa a exigir `DATABASE_URL`, `SMTP_URL` e `EMAIL_REMETENTE`; registra o processador da régua | O `worker` passa a falar com banco e com e-mail (D1) |
| `apps/worker/test/ambiente.spec.ts` | Cobrir as três variáveis novas | Falha de partida é comportamento, não configuração |
| `apps/worker/package.json` | +`@sysloc/db`, +`@sysloc/regua` | D1 |
| `apps/api/src/configuracao/ambiente.ts` | +`SMTP_URL`, +`EMAIL_REMETENTE`, +`TOKEN_PORTA_DE_EMAIL` | O disparo manual envia a partir da `api` — a barreira da CA-17 passa a valer para **dois** processos (§8, §19.1) |
| `apps/api/test/ambiente.spec.ts` | **CT-639** — a barreira que falha fechado provada também na `api` | Sem ele, o processo que atende requisição ganha o poder de enviar sem uma asserção de que recusa a partida |
| `apps/api/src/app.module.ts` | Registrar `AutomacaoModule` | Fiação |
| `apps/api/package.json` | +`@sysloc/regua` | D1 |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | Superfície de **82/67** para **86/71**, por dupla medição | Molde do `CT-533` |
| `deploy/systemd/sysloc-api.service` · `sysloc-worker.service` | As variáveis novas chegam pelo `EnvironmentFile` 0600 | Invariante 3 — nenhum segredo versionado |
| `.env.example` | Declarar as três variáveis novas, **sem valor** | Convenção já vigente |
| `deploy/scripts/caracterizacao/verificar-golden.sh` | Conferir o artefato novo da CA-01 | O verificador é o dono da conferência dos goldens |
| `docs/.../golden/PROCEDENCIA.md` | Registrar a procedência do fonte extraído | O arquivo é o registro de proveniência dos goldens |

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---|---|
| `packages/db/migracoes/0010_seguranca_cobranca.sql` | A view `cobranca_derivada`, o padrão de RLS e `data_corrente_da_operacao()`. **Contém `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`: não editar** |
| `packages/db/src/configuracao-de-mora.ts` | O molde exato da porta de recurso singular por empresa |
| `packages/contracts/src/configuracao-de-mora.ts` | O molde do contrato singular: corpo completo, entrada fechada, saída aberta |
| `apps/api/src/mora/mora.controller.ts` | O molde das duas rotas de configuração e da trilha de log |
| `apps/api/src/cobrancas/cobranca.controller.ts` | O molde do `:codigo` e da declaração de exigência |
| `packages/db/src/unidade-de-trabalho.ts` | Duas `DECISÃO FECHADA`: a recusa de aninhamento e a fixação sempre emitida |
| `packages/auth/src/catalogo-de-permissoes.ts` | A área e a ação já existem — **o catálogo não abre** |
| `packages/contracts/src/cobranca.ts` | `ESQUEMA_DO_CODIGO_DE_COBRANCA` e o `DÉBITO COM GATILHO — D1` |
| `packages/db/src/derivacao-de-cobranca.ts` | O `DÉBITO COM GATILHO — D26` (não dispara aqui — ver §21) |
| `packages/shared/test/redis-efemero.ts` · `postgres-efemero.ts` | Os acessórios de fronteira real |
| `docs/.../golden/regua-de-cobranca.json` | **O oráculo** — os dez cenários e as quatro funções auxiliares |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Todos sob o prefixo `/v1` e sob a classe `@ExigeChave('TELA:automacao_de_cobranca')`.

| Ação | Método | Rota | Payload | Resposta | Status Codes | Auth |
|---|---|---|---|---|---|---|
| Ler a política de aviso | `GET` | `/v1/automacao-de-cobranca` | — | `PoliticaDeAviso` | `200`, `401`, `403` | sessão + `TELA:automacao_de_cobranca` |
| Definir a política de aviso | `PUT` | `/v1/automacao-de-cobranca` | `PoliticaDeAvisoNova` (**completo**) | `PoliticaDeAviso` | `200`, `401`, `403`, `422` | sessão + `TELA:automacao_de_cobranca` |
| Consultar o histórico de envios | `GET` | `/v1/automacao-de-cobranca/cobrancas/:codigo/avisos` | consulta: `esquemaDaJanela` (`limite`, `deslocamento`) | `EnvelopeDeLista<EnvioDeCobranca>` | `200`, `401`, `403`, `404`, `422` | sessão + `TELA:automacao_de_cobranca` |
| Disparar o aviso manualmente | `POST` | `/v1/automacao-de-cobranca/cobrancas/:codigo/avisos` | corpo **vazio e fechado** | `EnvioDeCobranca` | `200`, `401`, `403`, `404`, `422` | sessão + **conjunção** (`@ExigeChaves`) `TELA:automacao_de_cobranca` **e** `ACAO:enviar_cobranca_manual` |

**Por que as quatro moram na área, e não em `/v1/cobrancas`.** A RN-12 exige que o disparo manual peça a **área Automação de cobrança** mais a ação `ACAO:enviar_cobranca_manual`. Se o manipulador vivesse em `CobrancaController` — cuja classe declara `TELA:financeiro` — a declaração de método **substituiria** a de classe (`getAllAndOverride`), e o `CT-355` acusaria um manipulador exigindo coisa diferente da classe dele. Sob a classe da automação, o método declara a **conjunção inteira** e exige estritamente **mais** que a classe, que é o que a ADR-0018 pede.

**Por que `POST` responde `200` e não `201`.** O ato **registra** um envio; a linha do registro é consequência, não o recurso que o cliente foi criar. É a mesma escolha, e a mesma razão, das rotas de transição de `CobrancaController`.

**Por que não há rota que aciona a régua da empresa inteira.** Decisão **D3** do tech alignment, confirmada pelo usuário: o trabalho é uma **porta de aplicação enfileirável**, sem rota. Nenhum CA exige acionar a régua por HTTP, e a F5 herda o ponto de entrada pronto sem que a superfície — que congela depois dela — cresça por diagnóstico.

**Superfície resultante**: **86 rotas / 71 manipuladores** (de 82/67). O número é conferido por **dupla medição independente** — pelo roteador e pela composição —, no molde do `CT-533`, na task de fecho. Não propague a premissa refutada de que cada `GET` entra em dobro por causa do `HEAD`: o módulo `cobertura-de-autorizacao.ts` **suprime** o `HEAD` derivado.

### 4.1.1 Exemplo de Payload por Endpoint

**Nenhum endpoint desta fatia aceita atualização parcial** — a observação obrigatória desta subseção vale ao contrário, e a inversão é conteúdo:

```
PUT /v1/automacao-de-cobranca   (corpo COMPLETO — nenhum campo opcional)

{
  "ativo": true,
  "diasAntesDoVencimento": 10,
  "intervaloMinimoDias": 2,
  "janelaInicio": "08:00",
  "janelaFim": "18:00",
  "canal": "EMAIL"
}

Regra: campo ausente é 422 nomeando o campo que falta — NUNCA "preserve o valor
atual". O esquema é `z.strictObject` com SEIS campos, nenhum `.optional()`.
Campo desconhecido também é 422, por chave desconhecida.
```

A razão está por extenso no cabeçalho de `packages/contracts/src/configuracao-de-mora.ts` e vale igual aqui: o `PUT` parcial que copia o `required` do `POST` faz o cliente que envia só `ativo` acreditar que zerou o resto, enquanto o servidor preserva o anterior sem que nada acuse. A ausência de campo opcional é também o que torna a rota **idempotente por construção**.

```
POST /v1/automacao-de-cobranca/cobrancas/COB-2026-0000042/avisos

{}          ← corpo vazio e FECHADO (ESQUEMA_DO_CORPO_VAZIO)

Regra: nada é aceito pelo corpo. O destinatário sai do locatário do contrato da
cobrança; o instante sai do relógio do banco; a empresa sai da sessão.
```

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|---|---|---|---|
| `esquemaDaPoliticaDeAvisoNova` | Zod (`@sysloc/contracts`) — **entrada, `strictObject`** | `ativo`, `diasAntesDoVencimento`, `intervaloMinimoDias`, `janelaInicio`, `janelaFim`, `canal` | v1 |
| `esquemaDaPoliticaDeAviso` | Zod — **saída, `z.object`** | os mesmos seis | v1 |
| `esquemaDoEnvioDeCobranca` | Zod — **saída, `z.object`** | `id`, `cobrancaCodigo`, `criadoEm`, `caminho`, `desfecho`, `destinatario`, `causa` | v1 |
| `CANAIS_DE_AVISO` | Zod enum fechado | `['EMAIL']` — **um** valor | v1 |
| `CAMINHOS_DO_AVISO` | Zod enum fechado | `['AUTOMATICO', 'MANUAL']` | v1 |
| `DESFECHOS_DO_AVISO` | Zod enum fechado | `['ENVIADA', 'FALHOU', 'SEM_DESTINATARIO']` | v1 |
| `envelopeDeLista(esquemaDoEnvioDeCobranca)` | Derivado de `comum.ts` | `{ itens, total, limite, deslocamento }` | v1 |

**O canal é enum de um valor, e a solidão é a decisão.** A RN-13/CA-15 manda **recusar na entrada** valor de canal que o produto não implementa. Um enum de um elemento faz a recusa ser do esquema — `422 CAMPO_INVALIDO` nomeando `canal` —, sem uma linha de verificação escrita à mão, e faz o documento publicado (ADR-0016) dizer a verdade sobre o que existe. Um campo livre validado por texto aceitaria `sms` em silêncio, que é exatamente o que a regra proíbe.

**Os horários viajam como `HH:MM`**, conferidos por `z.string().regex(...)` ancorado, e a coluna é `time`. Não é `z.iso.time()`: aquele aceita segundos e fração, e a política não tem resolução de segundo — aceitar `08:00:30.500` seria aprovar um valor que a comparação nunca discrimina.

### 4.3 Eventos Publicados / Consumidos

| Evento | Tipo | Fila | Payload | Schema |
|---|---|---|---|---|
| Trabalho da régua de uma empresa | pub (F5 / suíte) → sub (`worker`) | `regua-de-cobranca` | `{ empresaId: string }` | `CargaDaRegua` em `@sysloc/shared/fila` |

**A carga tem um campo e ele é obrigatório** — é a materialização literal da ADR-0024 (*"apenas declara que o identificador de empresa é campo obrigatório dela, e de onde ele veio"*). O `empresaId` é produzido por quem **já detinha direito a ele**: a enumeração de empresas ativas em `identidade.empresa`, que a ADR-0009 declara schema sem noção de tenant. **Ele nunca vem de fonte externa** — não há rota que enfileire, e a cláusula de procedência é o que impede a carga de virar "o novo request".

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**A — Definir a política (US-02 · CA-02, CA-14, CA-15)**

1. `PUT /v1/automacao-de-cobranca` chega com corpo completo. A guarda de autenticação admite a sessão; a de autorização confere `TELA:automacao_de_cobranca` — ausente, `403` nomeando o exigido.
2. O controlador valida o corpo com `esquemaDaPoliticaDeAvisoNova`. Canal fora de `EMAIL`, campo ausente, campo desconhecido, horário fora do molde ou dia fora da faixa → `422 CAMPO_INVALIDO`, **antes de qualquer escrita**: nada é gravado pela metade.
3. `sobContextoDaSessao` abre a unidade de trabalho e fixa `app.empresa_id`. O serviço chama `gravarPoliticaDeAviso(tx, entrada)`.
4. A porta emite **um** `INSERT … ON CONFLICT (empresa_id) DO UPDATE … RETURNING`. Não há leitura prévia — a forma "ler, decidir, gravar" é corrida disfarçada, e quem impede a segunda linha é a restrição, não a leitura.
5. O controlador registra a trilha (`empresaId`, `entidade`) — **sem os valores da política** — e devolve `200` com o que passou a valer.

**B — O trabalho automático de uma empresa (US-03, US-08 · CA-02..CA-06, CA-12, CA-16)**

1. Alguém enfileira `{ empresaId }` na fila `regua-de-cobranca` (na F5, o relógio; nesta fatia, a suíte e a porta de aplicação).
2. `tarefas/regua.ts` recebe o job. **Primeira coisa**: `contextoDeTenant.executarCom({ empresaId }, …)` — uma vez, na borda, pelo mesmo escritor único da borda HTTP (ADR-0024). Nada abaixo reescreve o contexto.
3. Abre a unidade de trabalho e lê `lerPoliticaDeAviso(tx)`. **Política ausente ou `ativo = false` → o trabalho termina sem enviar nada e sem registrar falha alguma** (RN-03/CA-03). A ausência é a régua desligada, não é erro.
4. A borda lê a **hora corrente da operação** com `lerHoraCorrenteDaOperacao(tx)` — `to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')` — e a passa a `dentroDaJanela` de `@sysloc/regua`. Fora dela, o trabalho termina sem enviar — e a cobrança volta a ser considerada na próxima passagem (CA-05). A janela é conferida **uma vez, para o job inteiro**: ela é propriedade do job, não da linha, e não discrimina uma cobrança de outra (D4).

   ⚠️ **O relógio é o do banco, e a decisão é deliberada — não a "otimize" para `new Date()`.** `dentroDaJanela` é função pura e recebe o `HH:MM` por parâmetro (CT-613), o que significa que **nenhum caso de teste pode pegar** um erro na origem desse parâmetro. Uma leitura do relógio do processo (`getHours()`, ou `Date` cru) depende da variável `TZ`, que **nenhuma das duas unidades systemd declara**; hoje ela acerta por acidente — o host está em `America/Sao_Paulo` —, e no dia em que o serviço rodar sob UTC a régua dispara três horas fora da janela que a imobiliária configurou, **sem uma linha vermelha em lugar nenhum**. Tirar a hora do mesmo relógio de onde sai `data_corrente_da_operacao()` dá ao produto **uma** fonte de tempo, e não duas que podem divergir na virada da meia-noite.
5. `selecionarCandidatasAoAviso(tx, politica)` executa **um** predicado no banco, ancorado em `negocio.cobranca_derivada`, que já filtra: estado em aberto, dia relativo ao vencimento dentro do que a política manda, e **ausência** de tentativa `ENVIADA` dentro do intervalo mínimo. A RLS recorta a empresa; **não há `WHERE empresa_id` escrito na aplicação**. ⚠️ **O predicado junta, e a junção é obrigatória** — ver §5.1-B′ logo abaixo: a view **não** carrega contato nem imóvel, e a mensagem precisa dos dois.
6. Para **cada** candidata, em ordem determinística de vencimento e código: o domínio compõe a mensagem, chama a `PortaDeEnvioDeEmail` e **registra a tentativa** — `ENVIADA`, `FALHOU` com a causa, ou `SEM_DESTINATARIO`. Cada registro vai em unidade de trabalho própria, e o laço **não para** na falha de uma (RN-11/CA-16).
7. Se **qualquer** tentativa falhou, o processador levanta ao fim do laço, e a fila repete o job pela política já declarada (D6). Na repetição, as já avisadas caem **fora** do conjunto de candidatas, porque cada uma tem tentativa `ENVIADA` dentro do intervalo — a idempotência vem do predicado, não de uma guarda escrita para ela.

**B′ — A projeção da candidata, e por que a junção não é opcional**

`negocio.cobranca_derivada` publica `c.*` mais `contrato_codigo`, `locatario_id`, `dias_atraso`, `status`, `valor_multa`, `valor_juros`, os percentuais vigentes e `valor_total`. Ela **não** carrega nome do locatário, endereço de contato, nem dado algum do imóvel — e os três são exigidos pela RD-16 e pelo molde do oráculo (*"Prezado(a) {nome}"*, *"Dados do imovel: {imóvel} ({conjunto})"*). O destinatário, portanto, **não existe na fonte do estado**: ele mora em `negocio.locatario`.

A decisão é **manter um predicado só** e fazê-lo projetar a junção, em vez de devolver chaves e buscar o resto por candidata. A alternativa (segunda leitura por candidata) foi descartada por contrariar a §12.2 — ela transforma uma consulta em `1 + N` idas ao banco, e a régua percorre a carteira inteira de uma empresa.

```sql
SELECT cd.codigo, cd.data_vencimento, cd.status, cd.valor_total,
       l.nome                    AS nome_do_locatario,
       l.email                   AS destinatario,
       i.identificador_municipal AS imovel,
       cj.nome                   AS conjunto
  FROM negocio.cobranca_derivada cd
  JOIN negocio.locatario l  ON l.id  = cd.locatario_id
  JOIN negocio.contrato  ct ON ct.id = cd.contrato_id
  JOIN negocio.imovel    i  ON i.id  = ct.imovel_id
  JOIN negocio.conjunto  cj ON cj.id = i.conjunto_id
 WHERE cd.status IN ('A_VENCER', 'VENCIDA')
   AND <recorte de dias pela política>
   AND NOT EXISTS (<trava de intervalo — só desfecho 'ENVIADA', RD-05>)
 ORDER BY cd.data_vencimento, cd.codigo
```

O resultado é o tipo **`CandidataAoAviso`** — `{ codigo, dataVencimento, status, valorTotal, destinatario, nomeDoLocatario, imovel, conjunto }` —, e ele é a **única** coisa que sobe para `@sysloc/regua`.

Três propriedades que a junção preserva, e que valem estar escritas:

1. **Nenhum `JOIN` reintroduz filtro de empresa na aplicação.** As quatro tabelas estão sob RLS forçada e a view é `security_invoker`; o recorte continua vindo do contexto da transação, e escrever `AND l.empresa_id = …` seria o segundo caminho para o dado que a ADR-0008 proíbe.
2. **Todas as junções são `INNER` e nenhuma pode faltar** — `cobranca.contrato_id`, `contrato.imovel_id`, `contrato.locatario_id` e `imovel.conjunto_id` são `NOT NULL` com FK composta. Uma candidata **não some** por junção vazia; se sumisse, o modo de falha seria o pior possível (a cobrança deixa de ser avisada em silêncio).
3. **O `destinatario` vazio é o caso da RD-11**, e ele chega até aqui: `negocio.locatario.email` é `NOT NULL`, mas nada impede a cadeia vazia. A candidata entra no laço, o domínio a reconhece e registra `SEM_DESTINATARIO` — a exclusão **não** acontece no predicado, senão o registro nunca nasceria (§5.2 e CT-619).

**C — O disparo manual (US-04 · CA-07, CA-13)**

1. `POST /v1/automacao-de-cobranca/cobrancas/:codigo/avisos`. A guarda confere a **conjunção**: área, depois ação; a recusa nomeia a **primeira ausente na ordem declarada** (ADR-0018).
2. `:codigo` é validado por `ESQUEMA_DO_CODIGO_DE_COBRANCA`. Fora do molde → `422`; cobrança inexistente **ou de outra empresa** → `404` com o **mesmo** corpo (a RLS torna as duas indistinguíveis, e essa é a propriedade).
3. Sob contexto da sessão, lê a cobrança de `negocio.cobranca_derivada` — a **mesma** fonte que o automático consulta (RN-01).
4. `@sysloc/regua` aplica o **mesmo** teste de admissão sobre o estado publicado, com a janela de horário, a trava de intervalo e o recorte de dias **dispensados por parâmetro**. Cobrança `PAGA` ou `CANCELADA` → `422 CAMPO_INVALIDO` nomeando `codigo`, com `detalhes.estado`, **e nenhuma mensagem sai** (RN-02/CA-08).
5. Envia, registra a tentativa com `caminho = 'MANUAL'` e devolve `200` com a linha do registro — inclusive quando o desfecho é `FALHOU`: o operador precisa saber que não saiu, e a falha de comunicação não é erro da requisição dele.

**D — O histórico (US-05 · CA-11)**

`GET .../avisos` valida a janela de paginação com `esquemaDaJanela` de `packages/contracts/src/comum.ts` — `limite` (1..`MAIOR_PAGINA`, padrão `PAGINA_PADRAO`) e `deslocamento` (≥ 0, padrão `0`), ambos por `z.coerce` sobre a cadeia da consulta —, lê `lerEnviosDaCobranca(tx, codigo, janela)` e devolve a página com instante, caminho, desfecho, destinatário e causa, do mais recente para o mais antigo. `total` é a contagem **de todas** as tentativas daquela cobrança, não a da página, no molde que o envelope já fixa. Nenhum esquema de paginação nasce aqui — reescrevê-lo por recurso é exatamente o que `comum.ts` existe para impedir.

**E — A extração do fonte do documento do contrato (US-01 · CA-01)**

Trabalho de **prazo**, primeiro na ordem de execução e **sem consumidor nesta fatia**. Um script em shell consulta o banco do sistema antigo por `docker compose exec -T`, extrai o fonte do Server Script `PDF contrato` (752 linhas, existindo **só** no banco), grava o artefato versionado e confere o determinismo por recaptura. **Nada é alterado no sistema antigo** — a consulta é somente leitura, e o site `frontend` é produção.

### 5.2 Fluxos Alternativos

| Situação | Comportamento |
|---|---|
| Empresa nunca definiu a política | Leitura devolve `200` com a política **desligada** e **não cria linha**; o trabalho não avisa ninguém e não registra falha (RN-03/CA-03) |
| Política existe com `ativo = false` | Idêntico ao anterior no trabalho; a leitura devolve o que está gravado |
| Fora da janela de horário | O automático não envia; o manual envia assim mesmo (RN-07/CA-07) |
| Tentativa `ENVIADA` dentro do intervalo | O automático pula a cobrança; o manual envia assim mesmo |
| Tentativa que **falhou** dentro do intervalo | **Não trava** — ver a §6.3, RD-05, e a emenda declarada na §21 |
| Cobrança paga ou cancelada | **Nenhum** aviso, por **nenhum** caminho (RN-02/CA-08) — é a divergência por vitória contra o legado |
| Locatário sem endereço de contato | Registra `SEM_DESTINATARIO`, **não** envia, **não** trava o intervalo e **não** interrompe as demais (RN-11/CA-16) |
| Envio falha | Registra `FALHOU` com a causa; **a cobrança e a mora ficam idênticas**; a fila repete o job (RN-09/CA-10) |
| Job com carga de empresa inexistente | Falha **na borda**, ao abrir o contexto — não na seleção (é o `Cons` que a ADR-0024 declara) |
| Transporte de e-mail não declarado | O processo **recusa a partida**, com a variável nomeada (D5) |

### 5.3 Mapeamento de User Stories → Fluxos

| User Story (PRD) | Fluxo / Endpoint | Componentes Envolvidos |
|---|---|---|
| US-01 | Fluxo **E** — captura em shell contra `/opt/frappe` | `extrair-fonte-do-pdf.sh`, `verificar-golden.sh`, `contrato-pdf-fonte.py` |
| US-02 | Fluxo **A** — `GET`/`PUT /v1/automacao-de-cobranca` | `AutomacaoDeCobrancaController`, `…Service`, `politica-de-aviso.ts`, `automacao-de-cobranca.ts` |
| US-03 | Fluxo **B** — fila `regua-de-cobranca` | `tarefas/regua.ts`, `regua.ts`, `janela.ts`, `envio-de-cobranca.ts` |
| US-04 | Fluxo **C** — `POST .../avisos` | `AutomacaoDeCobrancaController`, `regua.ts`, `envio-de-cobranca.ts` |
| US-05 | Fluxo **D** — `GET .../avisos` | `AutomacaoDeCobrancaController`, `envio-de-cobranca.ts` |
| US-06 | Fluxos **B** e **C** — o teste de admissão único | `regua.ts` (admissão), `cobranca_derivada` (estado) |
| US-07 | Fluxo **B**, passo 6 | `envio-de-cobranca.ts` (só grava no registro), `cobranca_derivada` (não é tocada) |
| US-08 | Fluxos **B** e **C** — contexto e RLS | `contexto.ts`, `unidade-de-trabalho.ts`, políticas das duas tabelas |
| US-09 | Transversal | `porta-de-email.ts` (adaptador de captura), `adaptador-smtp.ts` (barreira) |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|---|---|---|
| Corpo do `PUT` **completo e fechado** (6 campos, nenhum opcional) | `esquemaDaPoliticaDeAvisoNova` | `422 CAMPO_INVALIDO` nomeando o campo ausente ou desconhecido |
| `canal` ∈ `{EMAIL}` | enum Zod fechado | `422 CAMPO_INVALIDO`, `campo: "canal"` (RN-13/CA-15) |
| `diasAntesDoVencimento` inteiro em `[0, 90]` | Zod + `CHECK` no banco | `422`; o `CHECK` é a rede, nunca a primeira linha de defesa |
| `intervaloMinimoDias` inteiro em `[1, 90]` | Zod + `CHECK` | `422`. O piso é **1**: zero desligaria a trava, e desligá-la se faz por `ativo`, não por valor de borda |
| `janelaInicio` e `janelaFim` no molde `HH:MM` ancorado | Zod regex | `422` nomeando o campo |
| `janelaFim` ≥ `janelaInicio` | `refine` no esquema + `CHECK` | `422`, `campo: "janelaFim"`. Janela invertida não é "a noite inteira": é engano do cliente, e adivinhar seria pior |
| `:codigo` no molde `COB-{ano}-{7 dígitos}` | `ESQUEMA_DO_CODIGO_DE_COBRANCA` | `422`, `campo: "codigo"` |
| Corpo do `POST` **vazio e fechado** | `ESQUEMA_DO_CORPO_VAZIO` | `422` por chave desconhecida |
| `empresaId` **nunca** vem do corpo, em rota alguma | `strictObject` | `422` por chave desconhecida — sem verificação escrita à mão (ADR-0008) |
| Carga do job com `empresaId` UUID | esquema Zod na borda do job | O job falha na borda, antes de qualquer leitura (ADR-0024) |

### 6.2 Transformações de Dados

- **`snake_case` → camelCase** por apelido na projeção do SQL, num ponto só por porta — o molde de `colunasDaConfiguracao`. Duas traduções livres divergiriam.
- **`timestamptz` → `z.iso.datetime()`** em `criadoEm`, projetado pelo banco.
- **`time` → `HH:MM`** por `to_char(coluna, 'HH24:MI')` na projeção — o driver devolveria `08:00:00`, e publicar segundo que a política não tem seria contrato mentindo sobre a resolução.
- **Nenhuma conversão monetária nesta fatia.** O corpo da mensagem imprime valor, e ele chega **já formatado** da leitura da cobrança — a régua não faz aritmética de dinheiro (ADR-0023).
- **Ausência de linha de política → política desligada**, composta na porta e **congelada** (`Object.freeze`), no molde exato de `POLITICA_AUSENTE` de `configuracao-de-mora.ts`. O congelamento não é ornamento: o objeto é devolvido por referência e é compartilhado por toda empresa que nunca configurou; uma escrita nele mudaria a política publicada a todas elas no processo inteiro.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|---|---|---|---|
| **RD-01** | RN-01 | O estado consultado é **sempre** `negocio.cobranca_derivada`; a régua nunca deriva estado | — |
| **RD-02** | RN-02 | Cobrança `PAGA` ou `CANCELADA` **nunca** gera aviso, por nenhum caminho. No automático ela cai fora do predicado; no manual, é recusa nomeada | `422 CAMPO_INVALIDO`, `detalhes.estado` |
| **RD-03** | RN-03 | Política ausente **ou** `ativo = false` ⇒ nada sai e nada é registrado. Ausência ≠ falha | — |
| **RD-04** | RN-04, RN-05 | Elegível por dia: `A_VENCER` quando faltam **≤ `diasAntesDoVencimento`** dias; `VENCIDA` **enquanto estiver em aberto**, sem teto. É o "antes e depois" da RN-04, e reproduz o oráculo (`dias_antes_vencimento`, e nenhum limite depois) | — |
| **RD-05** | RN-06 **(emendada)** | A trava conta **apenas** a tentativa com desfecho `ENVIADA`. Ver a §21 — a emenda é declarada, medida contra o oráculo e protegida por `DECISÃO FECHADA` no predicado | — |
| **RD-06** | RN-05 | A janela de horário é conferida **uma vez por job**, na aplicação, sobre o `HH:MM` que o **banco** projeta em `America/Sao_Paulo` (§5.1-B passo 4); ela **não** entra no predicado (D4). A decisão pura recebe a hora por parâmetro — o relógio do processo **nunca** é lido | — |
| **RD-07** | RN-07 | O manual dispensa janela, trava e recorte de dias — e **continua** sujeito à RD-02. A dispensa é parâmetro do mesmo teste, nunca um segundo teste | — |
| **RD-08** | RN-08 | Toda tentativa deixa registro: instante, cobrança, caminho, desfecho, destinatário e causa. **O manual registra como qualquer outro** | — |
| **RD-09** | RN-09 | Falha de envio **não** escreve em `negocio.cobranca`. A régua não tem, em lugar nenhum, uma escrita naquela tabela — a ausência é o mecanismo | — |
| **RD-10** | RN-10 | O trabalho é **sempre** de uma empresa; não existe consulta cross-tenant. Sob RLS forçada, ela nem teria contexto para executar | — |
| **RD-11** | RN-11 | Locatário sem endereço: registra `SEM_DESTINATARIO`, não envia, **não trava** e **não interrompe** o laço | — |
| **RD-12** | RN-12 | Configurar e consultar exigem a **área**; o disparo manual exige a **conjunção** área + ação | `403 ACESSO_NEGADO` |
| **RD-13** | RN-13 | Canal não implementado é recusado **na entrada**, nunca aceito e ignorado | `422 CAMPO_INVALIDO` |
| **RD-14** | RN-14 | **Não há gatilho de tempo** nesta fatia. A janela diz *quando é permitido*; quem aciona é a F5 | — |
| **RD-15** | RN-15 | Nenhuma verificação entrega mensagem a destinatário real. Barreira que **falha fechado**, não configuração | falha de partida |
| **RD-16** | — | O conteúdo do aviso tem **dois** moldes, escolhidos pelo estado publicado: `A_VENCER` → *"Aviso de vencimento"*; `VENCIDA` → *"Pendência financeira"*. São os do oráculo, byte a byte no que não varia | — |
| **RD-17** | — | A ordem de percurso das candidatas é **determinística** (`data_vencimento`, depois `codigo`). Ordem indeterminada faria a equivalência com o oráculo depender de sorte | — |

**Sobre a RD-16 e o que dela é contrato.** O corpo do aviso é composto **em código**, no pacote de domínio — não é dado configurável, porque o PRD fecha personalização por empresa fora de escopo. O molde vem de `retorno.template` do oráculo. Duas divergências de forma são **deliberadas** e não são regressão: o legado escreve `<br>` porque compõe HTML no arcabouço dele, e imprime `Boleto indisponivel` porque a emissão bancária é da F4. O que se preserva é a **estrutura**: saudação nominal, o código da cobrança, o vencimento formatado, o valor, os dados do imóvel e o fecho. O oráculo é o registro do que existia, não uma exigência de igualdade de bytes num texto que ele mesmo mede com o boleto ausente.

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, schema `negocio`, RLS **habilitada e forçada**, papel `sysloc_app` (o mesmo dos dois processos — **nenhum papel novo**). O `worker` passa a conectar pelo mesmo `DATABASE_URL`, e é por isso que ele fica sob a mesma política: a alternativa — papel próprio sem RLS — é a que a ADR-0008 rejeita por escrito e que a ADR-0024 enumera entre as alternativas descartadas.

### 7.2 Tabelas / Coleções

**`negocio.politica_de_aviso`** — uma linha por empresa

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `empresa_id` | `uuid` | `NOT NULL`, FK → `identidade.empresa(id)` |
| `ativo` | `boolean` | `NOT NULL DEFAULT false` — **a régua nasce desligada** |
| `dias_antes_do_vencimento` | `integer` | `NOT NULL DEFAULT 0` |
| `intervalo_minimo_dias` | `integer` | `NOT NULL DEFAULT 1` |
| `janela_inicio` | `time` | `NOT NULL DEFAULT '00:00'` |
| `janela_fim` | `time` | `NOT NULL DEFAULT '23:59'` |
| `canal` | `negocio.canal_de_aviso` | `NOT NULL DEFAULT 'EMAIL'` |

Restrições: `politica_de_aviso_id_empresa_key UNIQUE(id, empresa_id)` · `politica_de_aviso_empresa_key UNIQUE(empresa_id)` · `politica_de_aviso_faixa_chk CHECK (dias_antes_do_vencimento BETWEEN 0 AND 90 AND intervalo_minimo_dias BETWEEN 1 AND 90)` · `politica_de_aviso_janela_chk CHECK (janela_fim >= janela_inicio)`.

A `UNIQUE(empresa_id)` existe para ser o **alvo do `ON CONFLICT`**, não como índice de leitura — mesma razão registrada em `configuracao_de_mora`. A `UNIQUE(id, empresa_id)` existe pela ADR-0008, ainda que nada a referencie hoje: a forma de referência entre entidades tenantizadas é a FK composta, e ela precisa de destino.

**`negocio.envio_de_cobranca`** — o registro de toda tentativa

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `empresa_id` | `uuid` | `NOT NULL`, FK → `identidade.empresa(id)` |
| `cobranca_id` | `uuid` | `NOT NULL`; **FK composta** `(cobranca_id, empresa_id)` → `negocio.cobranca(id, empresa_id)` |
| `criado_em` | `timestamptz` | `NOT NULL DEFAULT now()` |
| `caminho` | `negocio.caminho_do_aviso` | `NOT NULL` — `AUTOMATICO` \| `MANUAL` |
| `desfecho` | `negocio.desfecho_do_aviso` | `NOT NULL` — `ENVIADA` \| `FALHOU` \| `SEM_DESTINATARIO` |
| `destinatario` | `text` | `NOT NULL` — cadeia **vazia** quando não havia endereço |
| `causa` | `text` | anulável — preenchida **só** quando `desfecho <> 'ENVIADA'` |

Restrições: `envio_de_cobranca_id_empresa_key UNIQUE(id, empresa_id)` · `envio_de_cobranca_causa_chk CHECK ((desfecho = 'ENVIADA') = (causa IS NULL))`.

Índices: `envio_de_cobranca_trava_idx ON (empresa_id, cobranca_id, criado_em DESC) WHERE desfecho = 'ENVIADA'` — **parcial**, porque é exatamente o conjunto que a trava consulta (RD-05), e um índice que carregasse as falhas seria maior sem servir ao predicado; e `envio_de_cobranca_historico_idx ON (empresa_id, cobranca_id, criado_em DESC)` para o histórico, que lê **todas**.

**A linha nunca é apagada nem alterada.** Não há `UPDATE` nem `DELETE` sobre esta tabela em lugar nenhum do produto — é registro de fato, e a ADR-0014 não a alcança porque ela não é cadastro (retenção e expurgo vão para a F7, junto de `identidade.tentativa_login`).

**Três enums novos**: `negocio.canal_de_aviso`, `negocio.caminho_do_aviso`, `negocio.desfecho_do_aviso`, com `GRANT USAGE ON TYPE … TO sysloc_app` declarado um a um, no precedente das migrações `0008` e `0010`.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|---|---|---|
| 0011 | `packages/db/migracoes/0011_dominio_regua.sql` | up — 3 enums, 2 tabelas, restrições, índices, `ENABLE ROW LEVEL SECURITY` |
| 0012 | `packages/db/migracoes/0012_seguranca_regua.sql` | up — `FORCE ROW LEVEL SECURITY`, as 2 políticas `FOR ALL`, os 3 `GRANT USAGE ON TYPE` |

**Duas migrações, e o par é o padrão da base** (`0005`/`0006`, `0007`/`0008`, `0009`/`0010`): domínio e segurança separados, porque é o segundo arquivo que a guarda de cobertura de catálogo audita e é nele que a decisão de isolamento fica legível sozinha.

⚠️ **A `0010` NÃO é tocada.** Ela carrega uma `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco durável. Esta fatia cria migrações **novas**; nada aqui altera a `0010`, e o `sha256sum` que `migrar-banco.sh` mantém continua valendo.

As políticas são a **mesma expressão** que as existentes, palavra por palavra:

```sql
USING      ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
```

`USING` e `WITH CHECK` idênticos: divergi-las abriria o caso *"enxerga só o seu, grava para o alheio"*. `FOR ALL` cobre os quatro verbos numa política só.

### 7.4 Estratégia de Transação e Consistência

- **A unidade de trabalho abre na borda** e o executor desce por parâmetro. Aninhamento é recusado por `ErroDeUnidadeAninhada` — decisão fechada de `unidade-de-trabalho.ts`.
- **A escrita da política é `upsert` de um comando**, e a semântica é **última escrita vence** — correta aqui porque o corpo é completo e sem campo opcional: duas escritas concorrentes descrevem, cada uma, um estado final inteiro.
- **Cada tentativa registra em unidade própria.** Uma unidade para o job inteiro faria a falha da décima cobrança desfazer o registro das nove anteriores — e o registro é justamente o que impede o reenvio na repetição. É a decisão que torna a idempotência do D6 verdadeira.
- **A leitura das candidatas e o envio ficam em unidades diferentes**, e a janela entre as duas é aceita: o pior caso é avisar uma cobrança que acabou de ser paga, e o custo dele é uma mensagem a mais — contra o custo de segurar transação aberta durante N idas à rede, que trava conexão da reserva e é o modo de falha que derruba o processo inteiro.
- **Idempotência do job**: derivada do predicado (ver §9.2), não de chave de idempotência própria.
- **Nível de isolamento**: o padrão (`READ COMMITTED`). Nada aqui depende de leitura repetível — a única corrida possível é a acima, e ela é declarada.

### 7.5 Política de Retenção / Archival

**Nenhuma nesta fatia**, e a ausência é decisão do PRD (§4.2). O registro de envios cresce monotonicamente. A política de retenção e expurgo vai para a **F7**, junto da do irmão `identidade.tentativa_login`, que já é o **item 5 da §F7** do plano de execução. O crescimento esperado é da ordem de uma linha por cobrança em aberto por passagem da régua — ver §12.3.

---

## 8. Integração com APIs Externas

| Serviço Externo | Tipo | Auth | Timeouts | Retry |
|---|---|---|---|---|
| Servidor SMTP | SMTP sobre TLS, via `nodemailer` | usuário e senha na `SMTP_URL` (`EnvironmentFile` 0600) | conexão **10 s**, envio **20 s**, ambos constantes nomeadas | **Nenhum no adaptador** — a repetição é a do job (D6) |
| Banco do sistema antigo (só CA-01) | `docker compose exec -T` sobre `/opt/frappe` | do próprio contêiner | — | — |

**A porta, e por que ela existe.** `@sysloc/regua` conhece apenas *"entregue esta mensagem a este endereço"*. Dois adaptadores a implementam: o de **produção**, sobre `nodemailer`, e o de **captura**, que acumula em memória o que teria saído. A verificação injeta o de captura e **afirma sobre o que foi capturado** — é a única forma de provar CA-04, CA-11 e CA-16 sem enviar nada.

**A barreira falha fechado, e ela é parte da decisão (D5).** Sem `SMTP_URL` e `EMAIL_REMETENTE` declarados, o adaptador de produção **não é construído** e o processo **recusa a partida**, no molde exato do `lerAmbiente` que já existe nos dois pontos de entrada. O modo perigoso aqui é o inverso do habitual: *"tentar mesmo assim"* é o que alcança a caixa de uma pessoa. E a barreira é **estrutural, não configuração**: a suíte não tem caminho para construir o adaptador de produção, porque a composição raiz da verificação injeta o de captura — uma variável de ambiente herdada do host não basta para um envio escapar, que é o defeito do caminho E2 descartado no tech alignment.

**Onde exatamente o adaptador de captura entra, nos dois processos.** A porta é publicada por um token de injeção, `TOKEN_PORTA_DE_EMAIL`, no molde exato de `TOKEN_LOGGER`, `TOKEN_AMBIENTE` e `TOKEN_AUTENTICACAO`, que `apps/api/src/configuracao/ambiente.ts` já declara. A substituição na verificação é feita **pelo arcabouço de teste**, nunca por um caminho aberto no código de produção:

- **`apps/api`** — `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(TOKEN_PORTA_DE_EMAIL).useValue(capturador)`. É **o mesmo mecanismo, sobre o mesmo tipo de token**, que `apps/api/test/contexto.e2e.spec.ts` e `saude.e2e.spec.ts` já usam para o registrador, e o cabeçalho do primeiro deles registra a razão em uma frase que vale aqui sem alteração: *"o ponto de substituição é o do próprio arcabouço de teste — nada em `apps/api/src`"*. Note que `criarAplicacao()` **não ganha parâmetro**: uma opção de composição que só a suíte passa seria seam nascido para o teste, que é o que a doutrina do projeto proíbe.
- **`apps/worker`** — a borda do job recebe a porta por parâmetro, como as demais portas do domínio (§3.3.3); a composição de `main.ts` passa o adaptador de produção, e a suíte passa o de captura.

⚠️ **O CT-635 continua montando a aplicação por inteiro.** Substituir um provedor não é montagem reduzida: o roteador, as guardas, o prefixo global e o contrato publicado são exatamente os de produção — é o que a dupla medição de `86`/`71` exige, e é por isso que a substituição alcança **só** o destino da mensagem.

**Sem circuit breaker e sem fallback.** Não há degradação graciosa possível: ou a mensagem sai, ou o fato é registrado como falha e repetido. Acrescentar um disjuntor aqui seria complexidade especulativa — não há segunda via de entrega para a qual desviar.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas

| Fila | Produtor | Consumidor | Garantia |
|---|---|---|---|
| `regua-de-cobranca` | a F5 (relógio) · a suíte · a porta de aplicação | `apps/worker` | **at-least-once** |
| `eco` | (nenhum em produção) | `apps/worker` | at-least-once |

**At-least-once é a garantia, e é o que torna a §9.2 obrigatória.** BullMQ com `attempts: 3` e espera crescente repete o job; a repetição precisa ser inofensiva, e é.

**O contrato da fila desce para `@sysloc/shared`, e isso fecha o D32.** O marcador em `apps/worker/src/fila.ts` prescreve, no `QUANDO FECHA`, extrair **nome, opções e tipos de carga** para lugar compartilhado — ou declarar a repetição como deliberada nos dois lados. A decisão é **extrair**: a alternativa preserva a duplicação que o débito nomeia. O novo `packages/shared/src/fila.ts` não ganha dependência nenhuma — o nome é cadeia, as opções são objeto estrutural, e os tipos de carga são interfaces; o tipo `Job<…>` da biblioteca continua morando no `worker`, que é quem a consome. **O marcador sai no mesmo commit da extração, e a linha correspondente sai do índice do `CLAUDE.md`.**

### 9.2 Idempotência

**Não há chave de idempotência, e a ausência é a decisão.** A repetição do job refaz a seleção da empresa, e as cobranças já avisadas **caem fora do predicado** porque cada uma tem tentativa `ENVIADA` dentro do intervalo mínimo. O registro que existe para a trava e para a auditoria entrega a idempotência de graça, sem estado novo a reconciliar (D6/F1).

⚠️ **A prova de que a repetição não duplica aviso é caso de teste obrigatório.** É a asserção que sustenta a escolha; sem ela, a decisão fica apenas argumentada — e é assim que o tech alignment a registra.

O limite honesto: com `intervaloMinimoDias` no piso `1` e a repetição do job acontecendo em segundos, a cobrança já avisada continua fora do conjunto, porque a comparação é por **dias corridos** desde a última tentativa `ENVIADA` e não por virada de calendário. Uma comparação por data de calendário reabriria a janela na virada da meia-noite; por isso ela é por **intervalo**, e é assim que o oráculo a mede (`(hoje − último_envio).days >= intervalo_dias`).

### 9.3 Outbox / Saga

**Não se aplica.** Há uma única fonte transacional (o PostgreSQL) e um único efeito externo (o e-mail), e o efeito externo é **naturalmente não transacional**. Um padrão de outbox trocaria "pode enviar duas vezes" por "pode enviar duas vezes, com mais peças" — o que o resolve de fato é a trava do §9.2. Registrar isto é o que impede a rodada seguinte de introduzir a caixa de saída achando que fecha um buraco.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|---|---|---|---|
| Sessão ausente ou inválida | `401` `NAO_AUTENTICADO` | envelope da ADR-0017 | Guarda de autenticação |
| Falta a área, ou falta a ação no disparo manual | `403` `ACESSO_NEGADO` | `detalhes.exigido` nomeia a **primeira ausente** | Guarda de autorização |
| Cobrança inexistente **ou de outra empresa** | `404` `RECURSO_NAO_ENCONTRADO` | **corpo idêntico nos dois casos** | Serviço |
| Corpo, canal, faixa, horário ou `:codigo` inválidos | `422` `CAMPO_INVALIDO` | `campo` nomeia o primeiro problema | Borda (Zod) |
| Disparo manual sobre cobrança paga ou cancelada | `422` `CAMPO_INVALIDO` | `campo: "codigo"`, `detalhes.estado` | Domínio (`@sysloc/regua`) |
| Falha de entrega no disparo manual | **`200`** com `desfecho: "FALHOU"` | — | Domínio |

**A falha de entrega no manual responde `200`, e a escolha é conteúdo.** A requisição do operador foi atendida: a tentativa foi feita e **registrada**. Um `502` diria que o pedido dele fracassou, quando o que fracassou foi a comunicação com terceiro — e, pior, esconderia do cliente o `id` do registro que ele precisa para consultar o histórico. O que o operador precisa saber está no corpo, com a causa.

**A indistinguibilidade do `404` é propriedade da RLS, não do serviço.** Cobrança de outra empresa não é enxergada, então o caminho é literalmente o mesmo de cobrança inexistente — não há um ramo escrito para igualá-los, e é por isso que ele não pode divergir.

### 10.2 Resiliência

- **Repetição**: a da fila (`attempts: 3`, espera crescente a partir de 1 s), declarada num lugar só desde o D32. Nenhuma segunda política dentro do job.
- **Falha parcial do laço**: a falha de uma cobrança **não interrompe** as demais. O job coleta os desfechos, registra cada um, e **levanta ao fim** se houve qualquer falha — é o que faz a fila repetir sem que as bem-sucedidas sejam perdidas.
- **Timeout do SMTP**: constantes nomeadas no adaptador. Sem teto, uma conexão pendurada seguraria o job até o encerramento gracioso desistir.
- **Encerramento gracioso**: preservado como está. O `close()` do consumidor espera a tarefa em andamento terminar, e o prazo de `LIMITE_DE_DESLIGAMENTO_MS` continua sendo o único — **as duas `DECISÃO FECHADA` de `fila.ts` não são tocadas**.
- **Degradação graciosa**: não existe, e a ausência é deliberada (§8).

### 10.3 Estratégia de Logging de Erros

Pino estruturado, com a redação de segredo que `packages/shared/src/log.ts` já instala. Três regras próprias desta fatia:

1. **O endereço do locatário NÃO entra no registro estruturado.** Ele é dado pessoal e o journal é lido por operação; o destinatário mora na **linha do registro de envios**, que é tenantizada e alcançável só sob autorização. A trilha nomeia `cobrancaCodigo`, `caminho` e `desfecho`.
2. **A `SMTP_URL` nunca é registrada** — carrega credencial. A falha de conexão nomeia a **variável**, nunca o valor, no molde do que `fila.ts` já faz com a cadeia da fila.
3. **A causa da falha é registrada em dois lugares e com recortes diferentes**: a mensagem do erro vai para a coluna `causa` (auditável pelo operador) e para o journal em nível `warn`. O que não se repete é o conteúdo da mensagem de e-mail.

---

## 11. Segurança

### 11.1 Autenticação

`better-auth` por sessão, com a barreira única de admissão da F1. **Nenhuma rota desta fatia é pública** — nenhuma delas entra em `publicas` na guarda de cobertura, e o conjunto `semDeclaracao` continua **vazio**, que é o que prova a cobertura.

O trabalho enfileirado **não tem sessão e não simula uma** — a alternativa da sessão de serviço sintética foi descartada nominalmente pela ADR-0024, porque criaria credencial de longa duração e atribuiria ato de auditoria a um usuário que não existe.

### 11.2 Autorização

Declarada por rota, com default que nega (ADR-0011), e conferida por **conteúdo** (ADR-0018):

- Classe `AutomacaoDeCobrancaController`: `@ExigeChave('TELA:automacao_de_cobranca')`.
- `GET`/`PUT` da política e `GET` do histórico: **nada no método** — a declaração da classe é o que a guarda encontra. Declarar duas vezes o mesmo valor criaria dois lugares para esquecer um.
- `POST` do disparo manual: **`@ExigeChaves('TELA:automacao_de_cobranca', 'ACAO:enviar_cobranca_manual')`** — o decorador **plural**, que existe justamente para a conjunção (`exigencia.decorator.ts`), com a **conjunção inteira** e nunca só a ação, porque `getAllAndOverride` faz a declaração do método **substituir** a da classe. É o mesmo risco que o marcador `DECISÃO FECHADA` de `conjunto.controller.ts` governa, e o mesmo desenho que a retirada de circulação já usa.

⚠️ **Não use `@ExigeChave` (singular) com dois argumentos** — a assinatura dele aceita **uma** `ChaveDoCatalogo`, e o segundo argumento não compila. O plural exige, pelo tipo, no mínimo **duas** chaves.

**O catálogo de permissões NÃO abre.** A área e a ação já existem em `packages/auth/src/catalogo-de-permissoes.ts`; **nenhuma chave nasce aqui**, e portanto nada supersede a ADR-0011. O arquivo não é tocado.

O trabalho enfileirado não passa por autorização — ele não é operação de usuário. O que o limita é o **isolamento do banco**: sem contexto válido, ele não alcança linha alguma.

### 11.3 Criptografia

TLS na conexão SMTP (a `SMTP_URL` declara `smtps://` ou `smtp://` com `STARTTLS`). **Nenhum dado novo em repouso é cifrado**, e a decisão é consistente: o endereço do locatário já está em claro em `negocio.locatario.email`, sob RLS; cifrar a cópia no registro de envios daria a impressão de proteção sem mover a fronteira, que continua sendo a do banco.

### 11.4 Sanitização e Validação

- **Nenhuma composição de SQL nesta fatia.** Todo predicado é consulta parametrizada do driver. A única composição da base é o `SET LOCAL` da unidade de trabalho, que já é decisão fechada com validação prévia de UUID.
- **O corpo da mensagem é montado por concatenação de valores já conferidos** — código da cobrança (molde fechado), datas do banco, valores do banco, e o nome do locatário. O nome é texto livre do operador: como o corpo sai em **texto puro** (§5, RD-16), não há contexto de marcação a escapar. Se algum dia o corpo virar HTML, este parágrafo é o ponto em que a escapada passa a ser obrigatória.
- **O endereço de destino não é escolhido pelo cliente em caminho nenhum** — ele sai do locatário do contrato da cobrança, sob RLS. É o que impede a régua de virar um encaminhador de mensagem.

### 11.5 Rate Limiting / Anti-abuse

**Nada novo.** O limitador de taxa da F1 cobre a superfície autenticada. O disparo manual é uma escrita por requisição, sob concessão própria, e o volume dele é o que uma pessoa consegue clicar.

⚠️ Registro do que **não** é problema aqui: o **D27** (o limitador ainda sem eixo de origem confiável até a publicação atrás do servidor de borda, na F7) alcança **rota pública**, e nenhuma rota desta fatia dispensa sessão.

### 11.6 Secrets Management

`SMTP_URL` e `EMAIL_REMETENTE` entram no `EnvironmentFile` 0600 lido pelas duas unidades systemd, e no `.env.example` **sem valor** — a convenção já vigente. **Nenhum segredo versionado** (invariante 3). A `SMTP_URL` nunca aparece em `argv`, em log, nem em mensagem de erro.

---

## 12. Performance

### 12.1 Metas

- **Latência p95** das três rotas síncronas de leitura e escrita da política: **< 50 ms** (uma consulta indexada, mesma ordem de grandeza de `/v1/multa-e-juros`).
- **Latência p95** do disparo manual: **< 3 s**, dominada pela ida ao SMTP.
- **Throughput do trabalho automático**: uma empresa com **500 cobranças em aberto** processada em **< 60 s**, dominada pelas idas ao SMTP, não pelo predicado.
- **Latência p99**: não declarada — não há amostra para calibrá-la, e um número inventado viraria alerta falso na F5.

### 12.2 Estratégias

- **Um predicado, uma ida ao banco.** A seleção é uma consulta só; a alternativa — ler tudo em aberto e filtrar em TypeScript — foi **descartada** por contrariar a ADR-0023 e por transportar para a aplicação linhas que o predicado descartaria.
- **Índice parcial para a trava** (`WHERE desfecho = 'ENVIADA'`), que é exatamente o conjunto consultado.
- **A janela de horário é conferida antes do predicado**, e o trabalho termina sem percorrer a carteira quando está fora dela. ⚠️ **Ela não termina sem tocar o banco** — a hora corrente vem do próprio banco (§5.1-B passo 4), de modo que o job fora da janela custa **duas** consultas triviais (a política e a hora) em vez de zero. É o preço declarado de ter uma só fonte de tempo, e ele é pago uma vez por job, não por cobrança.
- **`data_corrente_da_operacao()` é `STABLE` e inlinável**, e continua sendo — a comparação com `data_vencimento` aproveita o índice existente `cobranca_aberta_idx`.
- **Sem cache.** A política é lida uma vez por job e uma vez por requisição; cachear introduziria estado compartilhado entre empresas, que é a classe que a RD-11 e a ADR-0008 fecham no banco.
- **Reserva de conexões do `worker`**: pequena e declarada (padrão da biblioteca), porque ele processa um job por vez.

### 12.3 Limites Conhecidos

- **O gargalo é o SMTP**, e ele é serial dentro do job. Paralelizar o envio dentro de uma empresa é possível e foi **adiado** — a granularidade por mensagem já foi podada no pré-refinamento por disputa da trava, que é comportamento provado pelo oráculo.
- **O limite do provedor de e-mail não é tratado aqui.** A tela de saúde do envio e o alerta de limite são da fase de automações; esta fatia apenas **grava o fato** que ela vai ler.
- **Crescimento de `envio_de_cobranca`**: sem expurgo, cresce com o produto de (cobranças em aberto) × (passagens da régua). Uma imobiliária com 500 cobranças e régua diária com intervalo de 2 dias produz da ordem de 90 mil linhas por ano. Não é problema de armazenamento; é o que torna a política de retenção da F7 necessária, e não opcional.
- **Um job por empresa** significa que a empresa com carteira grande domina o tempo do processo. Aceito: o `worker` é um processo de fundo, e nenhuma requisição espera por ele.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|---|---|---|---|
| política de aviso definida | `info` | `empresaId`, `entidade: "politica_de_aviso"` | **sem os valores da política** |
| trabalho da régua iniciado | `info` | `empresaId`, `fila` | — |
| trabalho da régua concluído | `info` | `empresaId`, `candidatas`, `enviadas`, `falhas`, `semDestinatario` | contagens, nunca identidades |
| régua desligada — nada a fazer | `debug` | `empresaId` | — |
| fora da janela de horário | `debug` | `empresaId`, `janelaInicio`, `janelaFim` | — |
| aviso enviado | `info` | `empresaId`, `cobrancaCodigo`, `caminho` | **sem destinatário e sem valor** |
| aviso falhou | `warn` | `empresaId`, `cobrancaCodigo`, `caminho`, `erro` | `erro` passa pela redação já instalada |
| cobrança sem destinatário | `warn` | `empresaId`, `cobrancaCodigo` | — |
| disparo manual recusado por estado | `info` | `empresaId`, `cobrancaCodigo`, `estado` | — |

Padrão JSON, Pino, com a redação de `packages/shared/src/log.ts`. **A leitura não registra linha alguma** — trilha de leitura é ruído por requisição, sem fato novo a registrar (o mesmo critério de `mora.controller.ts`).

### 13.2 Métricas

**Nenhuma métrica exportada nesta fatia**, e a ausência é escopo, não esquecimento: o produto ainda não tem coletor, e a fase de automações é a dona da tela de saúde do envio. O que esta fatia entrega é o **substrato** dela — a tabela `negocio.envio_de_cobranca`, de onde as três medidas do PRD (§10) saem por consulta:

| Medida (PRD §10) | Como se apura hoje |
|---|---|
| nenhuma mensagem indevida | `envio_de_cobranca` ⋈ `cobranca_derivada` — zero linhas com estado `PAGA`/`CANCELADA` no instante do envio |
| nada se perde | contagem de tentativas sem registro = **zero por construção**: quem registra é o mesmo caminho que envia |
| equivalência com o oráculo | a suíte, cenário a cenário (§19) |

### 13.3 Tracing

**Não se aplica** — não há tracing distribuído no produto, e introduzi-lo aqui seria a primeira instalação, fora do escopo. O `empresaId` e o `cobrancaCodigo` nas linhas acima são o que permite correlacionar um envio do começo ao fim.

### 13.4 Alertas

| Alerta | Condição | Severidade | Destino |
|---|---|---|---|
| — | — | — | — |

**Nenhum alerta nesta fatia** (PRD §4.2: a tela de saúde e o alerta de limite do provedor são da fase de automações). O que a F5 vai ler já é gravado aqui.

---

## 14. Feature Flags

### 14.1 Solução

**Nenhuma solução de feature flag é adotada**, e não há flag nesta fatia.

### 14.2 Flags Envolvidas

| Flag | Propósito | Escopo | Default |
|---|---|---|---|
| — | — | — | — |

**N/A — e a confusão que vale evitar**: `politica_de_aviso.ativo` **não é feature flag**. É dado de negócio, por empresa, escrito pelo Admin Empresa sob autorização, e faz parte do contrato publicado. Tratá-lo como flag levaria alguém a procurá-lo numa plataforma de flags, ou a "limpá-lo" quando a feature estabilizar — e ele não sai nunca: é ele que faz a régua nascer desligada (RN-03).

---

## 15. Versionamento de API

### 15.1 Estratégia

**Prefixo no caminho** (`/v1`), como toda a superfície do produto. Nada muda aqui: as quatro rotas nascem em `/v1` e nenhuma rota existente é alterada.

### 15.2 Compatibilidade

Esta fatia é **puramente aditiva** — nenhuma rota, esquema ou campo existente muda de forma ou de significado. Não há descontinuação a anunciar.

⚠️ Duas consequências que valem estar escritas:

1. **`@sysloc/contracts` cresce**, e o crescimento é aditivo — esquemas de **saída** são `z.object` (abertos), de modo que um campo acrescentado no futuro não quebra cliente gerado. A assimetria entrada-fechada/saída-aberta é a convenção do pacote, sem exceção, e a razão está por extenso no cabeçalho de `configuracao-de-mora.ts`.
2. **A superfície da API ainda não congela.** O congelamento é depois da F5; esta fatia leva 82 → 86.

### 15.3 Schemas / Contratos

O documento OpenAPI **deriva** dos esquemas Zod por `esquemaPublicado` (ADR-0016) — nenhuma descrição de corpo ou de resposta é escrita à mão. A validação em CI é a própria suíte: `packages/contracts/test/esquemas.spec.ts` varre **todos** os esquemas do pacote e afirma a convenção por conjunto, e os esquemas novos entram nessa varredura.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline

`pnpm build` · `pnpm lint` (Biome + `shellcheck --severity=error` sobre o script novo) · `pnpm test`. **Meça a suíte por pacote** (`pnpm --filter @sysloc/<pacote> test`): `turbo run test` aborta os pacotes irmãos quando um falha, e a saída agregada não carrega contagem confiável dos interrompidos.

O pacote novo entra no `pnpm-workspace.yaml` por já estar sob `packages/*`, e no grafo do Turborepo pelas dependências declaradas.

### 16.2 Empacotamento

**Nativo, sem Docker.** Node 24 fixado em `.mise.toml`, `tsup`/`tsc --build` por pacote, duas unidades systemd. `nodemailer` entra como dependência de `@sysloc/regua`.

### 16.3 Infraestrutura como Código

`deploy/systemd/*.service` versionados e instalados por `deploy/scripts/instalacao/instalar-unidades.sh`, de forma idempotente (ADR-0005). As duas unidades ganham as variáveis novas **pelo `EnvironmentFile`**, nunca inline — o arquivo é 0600 e não é versionado.

**`sysloc-worker.service` muda de natureza**: ele passa a depender do PostgreSQL, e não só do Redis. A ordenação de unidades precisa refletir isso (`After=`/`Wants=`), sob pena de o processador subir antes do banco e falhar na partida — que é falha correta e ruidosa, mas evitável.

### 16.4 Estratégia de Rollout

**Instalação direta**, como toda a base: um servidor, duas unidades, reinício de serviço. Não há blue-green nem canário — e não há por quê: a régua nasce **desligada em toda empresa**, de modo que o efeito visível do deploy é **zero** até que um Admin Empresa a ligue deliberadamente. É a propriedade de rollout mais forte desta fatia, e ela vem do desenho, não da infraestrutura.

### 16.5 Escalabilidade

Um processo `worker`, um job por vez. A escala é por **empresa**: N empresas produzem N jobs independentes, e a falha do trabalho de uma **não alcança as outras** (RN-10/CA-12) — que é a propriedade que o corte por empresa compra. Escalar horizontalmente é acrescentar consumidores da mesma fila, e a trava do §9.2 já torna isso seguro.

### 16.6 Rollback

`git revert` das migrações **não é o caminho** — migração aplicada não se desfaz por reversão de código. O rollback desta fatia é operacional e tem duas camadas:

1. **Desligar sem deploy**: `ativo = false` na política de cada empresa (ou simplesmente não ligar) para a régua parar de agir. É reversível e não exige reinício.
2. **Reverter o código**: as tabelas novas ficam, sem consumidor. Elas não são referenciadas por nada preexistente, então nenhuma leitura antiga quebra — o que é consequência direta de a fatia ser puramente aditiva.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story (PRD) | Definição Técnica | Componentes Envolvidos |
|---|---|---|
| **US-01** — extrair a regra do documento do contrato | §5.1-E · script de captura em shell, artefato versionado, determinismo por recaptura, nada alterado no legado | `extrair-fonte-do-pdf.sh`, `contrato-pdf-fonte.py`, `verificar-golden.sh`, `PROCEDENCIA.md` |
| **US-02** — política da própria imobiliária | §4.1 (2 rotas) · §6.1 (validações) · §7.2 (`politica_de_aviso`, régua desligada por padrão) · §7.3 (RLS) | `automacao-de-cobranca.ts`, `politica-de-aviso.ts`, `AutomacaoDeCobrancaController/Service`, migrações 0011/0012 |
| **US-03** — o inadimplente avisado automaticamente | §5.1-B · §6.3 RD-01, RD-04, RD-06 · §9.1 (fila) · §12.2 (um predicado) | `tarefas/regua.ts`, `regua.ts`, `janela.ts`, `envio-de-cobranca.ts`, `fila.ts` (shared) |
| **US-04** — disparo manual com concessão própria | §4.1 (rota `POST`) · §11.2 (conjunção) · §6.3 RD-07 | `AutomacaoDeCobrancaController`, `regua.ts`, `catalogo-de-permissoes.ts` (só leitura) |
| **US-05** — saber o que já saiu | §4.1 (rota `GET .../avisos`) · §7.2 (`envio_de_cobranca`) | `envio-de-cobranca.ts`, `esquemaDoEnvioDeCobranca` |
| **US-06** — nenhum aviso para paga ou cancelada | §6.3 RD-02 · §5.1-B passo 5 e §5.1-C passo 4 — **um** teste de admissão, consumido pelos dois caminhos | `regua.ts`, `cobranca_derivada` (ADR-0022) |
| **US-07** — falha não contamina o financeiro | §6.3 RD-09 · §7.4 (unidade por tentativa) — a régua **não tem** escrita em `negocio.cobranca` | `envio-de-cobranca.ts` (grava só o registro) |
| **US-08** — a régua alcança só os locatários da empresa | §7.3 (políticas RLS) · §11.1 (contexto do job) · ADR-0024 | migração 0012, `contexto.ts`, `unidade-de-trabalho.ts`, `tarefas/regua.ts` |
| **US-09** — nenhuma verificação alcança destinatário real | §8 (porta + dois adaptadores, barreira que falha fechado) | `porta-de-email.ts`, `adaptador-smtp.ts` |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|---|---|---|---|
| **Cliente de e-mail (NOVA)** | `nodemailer` | `7.x` (fixada na task) | Única dependência nova. Justificada por **incompatibilidade com o existente** — não há cliente de e-mail no repositório — e por já constar da stack declarada em `decisao-e-stack.md` §4 |
| Tipos da nova | `@types/nodemailer` | par da anterior | `nodemailer` não publica tipos próprios |
| Mensageria | `bullmq` | `5.81.3` — **inalterada** | A linha 5.x é `DECISÃO FECHADA` em `fila.ts`; **não subir para 6.x** |
| Cliente de fila | `ioredis` | `5.11.1` — inalterada | Uma versão do cliente no monorepo inteiro |
| Banco | `postgres.js` + `drizzle-orm` | inalteradas | O `worker` passa a consumi-las **via `@sysloc/db`** |
| Contrato | `zod` | `4.4.3` — inalterada | Fonte única do contrato |
| Interno | `@sysloc/regua` | `workspace:*` | **O pacote novo** — pacotes do monorepo: 4 → 5 |
| Interno | `@sysloc/db`, `@sysloc/shared`, `@sysloc/contracts` | `workspace:*` | Consumidos pelos pacotes e apps novos |

**Nenhuma outra dependência entra.** Em particular: **nada de biblioteca de datas** — a aritmética de calendário desta fatia corre **no banco** (o predicado) e a de relógio corre sobre `HH:MM` (a janela), e as duas proibições de `derivacao-de-cobranca.ts` (`new Date(a,m,d)` e `Date.UTC(`) continuam valendo por serem do pacote `@sysloc/db`.

---

## 19. Estratégia de Testes

> **Resumo**: **39 casos de teste** | Unitários: 6 | Integração: 19 | E2E: 7 | Segurança: 7
> **Padrão**: Vitest com `embedded-postgres` e Redis efêmeros (instância **própria** por execução); E2E por HTTP real em porta reservada; a frente shell com o vocabulário `caso`/`ok`/`afirmar_igual`/`fechar_caso`. Numeração de **CT-601 a CT-639**. ⚠️ **Medido, não estimado**: a suíte ocupa hoje a faixa que termina em **CT-545** (não `~535`) e tem **uma segunda banda, `CT-901`–`CT-910`**, que a leitura ingênua da primeira não revela. A faixa `6xx` está integralmente livre — `grep -rhoP "CT-6\d{2}"` sobre `apps`, `packages` e `deploy` devolve vazio. Rastreabilidade `CA-xx → CT-xxx (RN-xx)` no `describe`/`it`, com seção **INVARIANTES** por arquivo. **Mock evitado por decisão**; **prova de falsificação obrigatória** para toda asserção estática.
>
> ⚠️ **Todo mutante roda pelo script do pacote** (`pnpm --filter @sysloc/<pacote> test`), **nunca** por `vitest run` avulso — as suítes de `apps/*` carregam `@sysloc/db` e `@sysloc/regua` pela fronteira do pacote e leriam o `dist/` da compilação anterior. O modo de falha **inverte a conclusão**: verde lido como *"o mutante sobreviveu"* quando ele nunca foi executado.

**Três normalizações que apliquei como arquiteto** sobre o retorno do gerador, e as razões:

1. **A recusa do disparo manual em estado terminal é `422 CAMPO_INVALIDO`, não `409`.** A convenção está **medida** em `apps/api/src/cobrancas/cobranca.service.ts`, que recusa transição sobre cobrança em estado terminal com `422` e `detalhes: { estadoAtual, transicaoPedida }`. Introduzir `409` criaria uma segunda forma de recusa para a mesma classe de fato.
2. **Nomes de arquivo alinhados à §3**: `decisao.ts` → `janela.ts`, `execucao.ts` → `regua.ts`.
3. **`lerAmbiente` permanece em `apps/worker/src/main.ts`** — extrair para arquivo próprio alargaria o diff sem servir à correção (P5, proibição 5 do Protocolo Antirregressão).

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|---|---|---|
| CA-01 | A regra do documento do contrato extraída e versionada | CT-601, CT-602, CT-603 |
| CA-02 | Duas empresas, cada uma pela própria política | CT-606, CT-607, CT-608, CT-620, CT-627 |
| CA-03 | Empresa sem política não avisa e não registra falha | CT-606, CT-617, CT-623, CT-627 |
| CA-04 | Cobrança elegível é avisada e a tentativa fica registrada | CT-610, CT-614, CT-615, CT-638 |
| CA-05 | Fora da janela de horário, nada é enviado | CT-613, CT-616 |
| CA-06 | Tentativa recente trava o automático | CT-610, CT-611, CT-636 |
| CA-07 | O manual envia fora da janela e com aviso recente | CT-629, CT-636 |
| CA-08 | Paga ou cancelada não gera aviso por caminho nenhum | CT-610, CT-612, CT-630, CT-632, CT-636 |
| CA-09 | Equivalência com o oráculo, uma divergência declarada | CT-611, CT-612, CT-630, CT-636, CT-637 |
| CA-10 | A falha registra a causa e não toca o financeiro | CT-609, CT-611, CT-618, CT-622 |
| CA-11 | O histórico de envios de uma cobrança | CT-609, CT-631, CT-632 |
| CA-12 | A régua de uma empresa não alcança a outra | CT-607, CT-608, CT-621, CT-623, CT-624, CT-631 |
| CA-13 | Sem a ação, o disparo manual é recusado | CT-634, CT-635 |
| CA-14 | Sem a área, configurar e consultar são recusados | CT-633, CT-635 |
| CA-15 | Canal não implementado é recusado na entrada | CT-604, CT-605, CT-628 |
| CA-16 | Locatário sem endereço não interrompe as demais | CT-609, CT-619, CT-636 |
| CA-17 | Nenhuma verificação alcança destinatário real | CT-615, CT-625, CT-626, CT-639 |

**Os 17 critérios de aceite têm cobertura, e nenhum CT referencia critério que não existe no PRD.**

---

### 19.1 Testes Unitários

#### Contrato: `esquemaDaPoliticaDeAvisoNova` (`packages/contracts/test/esquemas.spec.ts`)

Mock: **nenhum** — esquema Zod puro.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-604 | o corpo completo e as bordas exatas de cada faixa são aceitos | CA-15 | O esquema aceita o corpo completo e as bordas fechadas (dias 0 e 90, intervalo 1 e 90, `00:00`/`23:59`) devolvendo objeto **idêntico** ao de entrada, sem coerção nem descarte | 3 corpos: piso, teto e típico | `success: true` e `data` estritamente igual ao corpo — o **controle positivo** sem o qual o CT-605 seria satisfeito por um esquema que recusa tudo | — | — |
| CT-605 | canal, campo ausente, faixa e chave extra são recusados nomeando o campo | CA-15 | Todo corpo que viole o conjunto fechado do canal, a completude do `strictObject`, a faixa ou o formato de hora é recusado com **uma** questão cujo `path` é o do campo ofensor | 14 corpos inválidos, cada linha declarando o `path` esperado | `success: false`, `issues` de comprimento 1, `path` estritamente igual ao declarado; `unrecognized_keys` na chave extra e `invalid_value` no canal | — | — |

#### Domínio: `janela.ts` (`packages/regua/test/janela.spec.ts`)

Mock: **nenhum** — função pura; o instante entra por **parâmetro**.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-613 | a janela decide com bordas inclusivas nos dois extremos | CA-05 | `dentroDaJanela` é `false` no minuto anterior ao início, `true` no minuto exato do início, no meio e no minuto exato do fim, `false` no minuto seguinte, e `true` sempre em `00:00`–`23:59` | 6 linhas: `08:59`, `09:00`, `13:37`, `18:00`, `18:01`, `03:14` em `00:00`–`23:59` | exatamente `false, true, true, true, false, true` por `toBe` contra o literal — nunca `toBeFalsy()`. Um `>` no lugar de `>=` reprova a segunda linha | — | o instante é **parâmetro de produção** (padrão 14), não seam: nenhum ramo, bandeira ou símbolo nasce para o teste; **nunca** relógio falso global nem `if (ehTeste)` |

#### Domínio: `mensagem.ts` (`packages/regua/test/mensagem.spec.ts`)

Mock: **nenhum** — função pura sobre a candidata já lida da view.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-614 | os dois moldes, com assunto, código, valor e nome exatos | CA-04 | `comporAvisoDeCobranca` produz o molde *"A vencer"* para `A_VENCER` e o *"Vencida"* para `VENCIDA`, com o assunto exato de cada um e sem personalização por empresa | duas candidatas: `COB-…-0000001` A_VENCER 1100,00; `COB-…-0000003` VENCIDA 1300,00 | assunto **igual à cadeia inteira** em cada molde; corpos contêm `R$ 1.100,00` / `R$ 1.300,00`, o código e o nome, cada um por asserção própria; **os dois assuntos são diferentes entre si** — é isso que impede um compositor de molde único de passar | — | — |

#### Ponto de entrada: `lerAmbiente` (`apps/worker/test/ambiente.spec.ts`)

Mock: **nenhum** — validação pura sobre um objeto de ambiente recebido por parâmetro.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-625 | **a barreira falha fechado** — sem transporte declarado, o processo recusa a partida | CA-17 | A validação recusa a partida quando `SMTP_URL`, `EMAIL_REMETENTE` ou `DATABASE_URL` estão ausentes ou vazias, nomeando a variável; com todas declaradas devolve o ambiente. **Nunca degrada em silêncio, nunca "tenta mesmo assim"** | 4 ambientes inválidos + 1 completo | as 4 linhas devolvem erro cuja mensagem contém a cadeia exata da variável faltante; a completa devolve as 5 variáveis por `toStrictEqual`. **Nenhuma** devolve ambiente parcial nem transporte "nulo" que aceite mensagens | — | padrão 14 (fail-fast testável): a validação **retorna** erro; abortar é do chamador — é o que a torna verificável sem subprocesso |

#### Ponto de entrada: `lerAmbiente` da **api** (`apps/api/test/ambiente.spec.ts`)

Mock: **nenhum** — mesma natureza do anterior.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|---|
| CT-639 | **a barreira falha fechado também na `api`** — o processo que atende requisição não parte sem transporte | CA-17 | O disparo manual envia **de dentro da `api`** (§5.1-C), logo a `api` é o **segundo** processo capaz de alcançar a caixa de uma pessoa. A validação recusa a partida quando `SMTP_URL` ou `EMAIL_REMETENTE` estão ausentes ou vazias, nomeando a variável, e `VARIAVEIS_EXIGIDAS` passa a contê-las | 2 ambientes inválidos + 1 completo | as 2 linhas devolvem erro cuja mensagem contém a cadeia exata da variável faltante; a completa devolve o ambiente por `toStrictEqual`; `VARIAVEIS_EXIGIDAS` **contém** as duas novas. Mutante que aceita `SMTP_URL` ausente reprova nomeando a variável | — | o arquivo **já existe** e é estendido; nenhum ramo de ambiente nasce para o teste |

> ⚠️ **Por que este caso existe, e por que ele não é redundante com o CT-625.** A barreira da CA-17 deixou de ser propriedade de **um** processo no instante em que o disparo manual passou a enviar da `api`. Sem este caso, a `api` ganharia capacidade de enviar e-mail sem uma única asserção de que ela recusa a partida sem transporte declarado — e a prova ficaria só indireta, pelo CT-626. **A obrigação da barreira é de dois processos, e a §19 tem de tratá-los simetricamente.**

> **Aqui o modo perigoso é o inverso do habitual.** Em quase toda barreira, o risco é recusar demais; nesta, *"tentar mesmo assim"* é o que alcança a caixa de uma pessoa real. Vale igual para os dois pontos de entrada.

### 19.2 Testes de Integração

#### Captura do sistema antigo — **task de PRAZO** (`deploy/scripts/caracterizacao/verificar-golden.sh` e `verificar-captura.sh`)

Setup: árvore versionada e sandbox descartável (diretório temporário, nunca a árvore de trabalho), com `trap limpar EXIT`. Para o CT-603, `/opt/frappe` de pé, em **leitura**.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-601 | o fonte versionado, com forma conferida e em bijeção com o `PROCEDENCIA.md` | CA-01 | O fonte existe como artefato versionado, é legível **sem o sistema antigo de pé**, tem exatamente 752 linhas, e a lista ordenada de artefatos do diretório é idêntica à do manifesto — bijeção nas **duas** direções | existência → contagem de linhas → cabeçalho de procedência → bijeção `ls` × manifesto | contagem exatamente `752`; listas ordenadas idênticas elemento a elemento (11 entradas, contra as 10 atuais); `falhas_totais == 0` e `exit 0` | — |
| CT-602 | **falsificação**: artefato truncado e manifesto sem a entrada reprovam | CA-01 | A asserção do CT-601 é falsificável: reprova sobre cada mutante nomeando o defeito, e passa limpa sobre a árvore íntegra | M1 (truncado a 100 linhas) → M2 (entrada removida) → controle | M1 reprova nomeando `100` obtido contra `752`; M2 reprova nomeando o artefato órfão; controle com `falhas_totais == 0`. Os três desfechos por `afirmar_igual`, **não** por presença de texto | sandbox descartável; molde de CT-013/CT-014 do mesmo arquivo |
| CT-603 | a recaptura é determinística e **nada é alterado** no legado | CA-01 | Recapturar produz artefato byte a byte idêntico ao versionado, e a captura não escreve: a contagem de `Server Script` e o `modified` do documento são idênticos antes e depois | ler controles → capturar 2× → comparar `sha256sum` → reler controles | os três `sha256sum` são a mesma cadeia; os controles do legado são exatamente os mesmos valores. Legado indisponível ⇒ `aviso` explícito, **nunca** verde em silêncio | imitar `capturar.py` e `preparar-site-efemero.sh`: `docker compose exec -T backend bench --site …` em **leitura**, **sem `sudo`**, sem tocar dado. ⚠️ A exigência de `sudo` da `testing-stack.md` vale para `deploy/scripts/instalacao/` — a distinção é por **frente** |

#### Dados: `politica-de-aviso.ts` e `envio-de-cobranca.ts` (`packages/db/test/*.spec.ts`)

Setup: instância efêmera migrada, conectada pelo papel `sysloc_app`; contexto de tenant aberto pela borda; **nenhum `WHERE empresa_id` escrito no teste**.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-606 | nasce desligada, a leitura **não cria linha**, a regravação atualiza a **mesma** linha | CA-03, CA-02 | Leitura de empresa que nunca configurou devolve a política desligada sem inserir — contagem **crua** `0` — e duas gravações deixam a contagem em `1`, nunca `2` | ler → contar → gravar → reler → contar → regravar → reler → contar | passo 1 por `toStrictEqual` na política desligada, nunca exceção nem `undefined`; contagem crua `0`; depois `1` nas duas vezes | primeiro `it` do arquivo — a contagem `0` **afirma** a precondição, e não é reconstituível depois |
| CT-609 | toda tentativa deixa registro, e o histórico sai em ordem decrescente | CA-11, CA-10, CA-16 | Grava-se uma linha por desfecho, com `caminho`, `destinatario` e `causa` — não nula **apenas** quando há falha —, e a listagem devolve exatamente essas linhas por `criado_em` decrescente | registrar `ENVIADA`, `FALHOU`, `SEM_DESTINATARIO` → contar → listar | contagem crua `3`; lista de comprimento `3` estritamente igual a `[t3, t2, t1]` nos quatro campos; `causa` **null** em t1 e a cadeia exata em t2 e t3; instantes decrescem sem empate | cobrança criada pelo caminho real de `criarCobranca` |
| CT-610 | **o predicado**: a tabela de sete estados fecha por igualdade | CA-04, CA-06, CA-08 | Para `{ dias: 10, intervalo: 2 }`, o predicado devolve **exatamente** o conjunto elegível — A_VENCER dentro dos dias e VENCIDA sem `ENVIADA` recente entram; fora dos dias, com `ENVIADA` recente, paga e cancelada ficam fora | semear 7 cobranças + 2 históricos → chamar → comparar conjunto | conjunto **exatamente** `[L1, L3, L5]` por igualdade de lista ordenada — nunca `toContain`, nunca contagem. Um predicado que esquecesse `CANCELADA` devolveria quatro e reprovaria nomeando L7. `valorTotal` idêntico ao publicado pela view, e **`destinatario`, `nomeDoLocatario`, `imovel` e `conjunto` iguais aos das linhas semeadas** — a junção da §5.1-B′ é afirmada aqui, e não só na composição da mensagem | vencimentos derivados de `negocio.data_corrente_da_operacao()` por deslocamento — **nunca** `new Date()` do processo; históricos semeados sob o contexto da empresa com `criado_em` explícito. **Nenhum parâmetro de instante nasce na porta de produção** |
| CT-611 | ⚠️ **a trava conta apenas `ENVIADA`** — `FALHOU` e `SEM_DESTINATARIO` não travam | CA-06, CA-09, CA-10 | Cobrança com tentativa `FALHOU` dentro do intervalo **permanece candidata**; a mesma com `ENVIADA` no **mesmo instante** sai. O desfecho é o **único** discriminador | 3 cobranças equivalentes a −20, uma tentativa cada em −1 → chamar → registrar `ENVIADA` sobre a de `FALHOU` → chamar de novo | primeira: conjunto **exatamente** `[C_falhou, C_sem_destinatario]`; segunda: **exatamente** `[C_sem_destinatario]` — igualdade de lista, nunca comprimento | idem CT-610 |
| CT-612 | a régua consulta a fonte única, **não recalcula estado** e **não lê o relógio do processo** | CA-08, CA-09, CA-05 | Os quatro rótulos de estado não aparecem em posição executável em `packages/regua/src/**` nem no predicado; a lista de arquivos que os carregam continua **exatamente** `['packages/contracts/src/cobranca.ts']`. **E**: `new Date(`, `Date.now(`, `getHours(` e `getMinutes(` têm **zero** ocorrências executáveis em `packages/regua/src/**` e em `apps/worker/src/tarefas/**` | estender a varredura do CT-510 → afirmar lista → afirmar que a consulta lê a **view** → afirmar as **zero** leituras de relógio → mutantes | lista estritamente igual ao arquivo único — nunca `toContain`. Mutante com ternário que recalcula `status`, e mutante com `FROM negocio.cobranca`, reprovam nomeando arquivo e linha; o controle passa com `0` ocorrências. ⚠️ **O terceiro mutante é o do relógio** — trocar `lerHoraCorrenteDaOperacao(tx)` por `new Date().getHours()` **passa em toda a suíte comportamental** (o host está em `America/Sao_Paulo`) e só esta asserção estática o pega. É a única rede do defeito descrito na §5.1-B passo 4 | asserção **estática** ⇒ falsificação obrigatória, pelo script do pacote. Uma segunda derivação escrita na régua **coincidiria** com a da view na quase totalidade dos casos e atravessaria a suíte sem uma recusa — é o defeito de origem do legado |

#### Domínio + dados: `regua.ts` (`packages/regua/test/regua.spec.ts`)

Setup: banco efêmero migrado; adaptador de **captura** injetado pela mesma interface `PortaDeEnvioDeEmail` que a produção implementa; o instante entra por parâmetro.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-615 | envia pelo adaptador de captura e registra `ENVIADA` com o destinatário do locatário | CA-04, CA-17 | Dentro da janela e com política ativa, entrega **exatamente uma** mensagem por candidata, com destinatário igual ao `email` do locatário, e grava `ENVIADA`/`AUTOMATICO` para cada | executar com `agora = 13:00` → conferir capturas → conferir registros | 3 capturas; conjunto ordenado de destinatários **igual** ao dos locatários das elegíveis; contagem crua `3`; os três com `desfecho: 'ENVIADA'`, `caminho: 'AUTOMATICO'`, `causa: null`. As não elegíveis não produzem captura nem registro | o adaptador de captura é **acessório de teste**, nunca um ramo dentro do de produção nem bandeira de ambiente (D5). Molde: `apps/worker/test/eco.spec.ts` |
| CT-616 | fora da janela não envia e **não registra** | CA-05 | Com o instante fora da janela nada é entregue e nenhuma linha nasce; a cobrança volta a ser candidata quando o **mesmo** trabalho roda dentro da janela | `agora = 08:59` → medir → `agora = 09:00` sobre o **mesmo** estado → medir | primeira: capturas `0` e contagem crua `0`. Segunda: 3 capturas e contagem `3` — **o controle positivo é obrigatório**, sem ele o caso seria satisfeito por uma régua que nunca envia | a borda `09:00` liga a decisão pura do CT-613 ao efeito observável |
| CT-617 | empresa que nunca ligou a régua **não avisa e não registra falha** | CA-03 | Para empresa sem linha de política, e para política `ativo: false`, a execução termina em sucesso, com zero mensagens e zero linhas — ausência é régua desligada, **não falha** | executar sem política → gravar `ativo: false` → executar | nos dois arranjos: nenhuma exceção propagada, nenhum `FALHOU` gravado, capturas `0`, contagem crua `0`. No primeiro, `politica_de_aviso` permanece com contagem crua `0` — a régua **não cria** a linha | a empresa tem cobranças que **seriam** elegíveis; sem isso o caso não discrimina |
| CT-618 | a falha registra a causa e **não toca o financeiro** | CA-10 | Quando a porta recusa, grava-se `FALHOU` com causa não vazia, e os **cinco** valores lidos da view — `status`, `diasAtraso`, `valorMulta`, `valorJuros`, `valorTotal` — são exatamente os mesmos de antes | ler os 5 valores → executar com a porta recusando o alvo → reler → conferir registros | os cinco relidos **estritamente iguais** aos do passo 1 — igualdade de cada valor, nunca asserção de presença. O alvo tem `FALHOU` com a causa exata; **as outras duas têm `ENVIADA`** — a falha de uma não interrompe as demais | a porta de captura recusa o destinatário escolhido, pela mesma interface — **nenhum ramo de falha no adaptador de produção** |
| CT-619 | locatário sem endereço gera `SEM_DESTINATARIO`, **não trava** e não interrompe | CA-16 | Não produz mensagem, grava `SEM_DESTINATARIO`, esse registro **não conta** para a trava, e as demais elegíveis são avisadas na mesma execução | semear → executar → conferir → executar de novo | 2 capturas, e o conjunto de destinatários **não contém** cadeia vazia; contagem crua `3` (dois `ENVIADA`, um `SEM_DESTINATARIO` com destinatário vazio e a causa exata); nenhuma exceção propaga. Na segunda execução nasce um **segundo** `SEM_DESTINATARIO` (total `4`), provando que não travou | ⚠️ `negocio.locatario.email` é `NOT NULL` e a borda exige `z.email()` — o estado **não é alcançável por rota alguma**. Semear a linha direto no banco, sob o contexto da empresa, com `email` vazio. **Não** relaxar o `NOT NULL`, **não** exportar construtor de teste, **não** acrescentar `if (ehTeste)` |
| CT-620 | duas empresas com políticas diferentes avisam cada uma pela sua | CA-02 | Políticas **divergentes** sobre carteiras equivalentes produzem conjuntos **diferentes**, e o registro de uma não aparece na outra | gravar políticas → semear carteiras espelhadas → executar A → executar B | A avisa 2, B avisa 0 (a A_VENCER não entra com `dias: 0`; a VENCIDA está travada pelo intervalo de 30). Conjuntos por igualdade de lista ordenada; contagens cruas `3` e `1` | as políticas são escolhidas para produzir conjuntos **diferentes** — conjuntos iguais não distinguiriam *"cada uma pela sua"* de *"uma política única para todas"*, que é o defeito do legado |

#### Processador de fila: `tarefas/regua.ts` (`apps/worker/test/regua.spec.ts`)

Setup: instâncias efêmeras **próprias** de banco e de Redis (ADR-0006); espera por **sondagem com limite de tempo declarado** como constante no topo, nunca `sleep` fixo.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-622 | **a repetição do job não duplica aviso** | CA-10 | Repetido o job dentro do intervalo, o total entregue é o número de candidatas da primeira execução e cada cobrança tem **exatamente um** `ENVIADA` — a segunda passagem as encontra fora do conjunto, sem que guarda alguma tenha sido escrita para isso | enfileirar 10 candidatas → a porta recusa a partir da 5ª → a fila repete → medir | total de entregas **exatamente `10`**, conjunto ordenado de códigos igual ao das dez, nenhum repetido. `GROUP BY cobranca_id HAVING count(*) FILTER (WHERE desfecho='ENVIADA') > 1` devolve `0` linhas. A que falhou tem **um** `FALHOU` e **um** `ENVIADA` | usar `attempts`/`backoff` reais do contrato em `@sysloc/shared` — **nenhuma política de repetição paralela dentro do job**, nenhum ponto de reentrada exposto só para o teste |
| CT-623 | o job sem `empresaId` **falha nomeando o campo** | CA-12, CA-03 | Carga sem `empresaId`, ou com valor que não é UUID, termina em **falha** nomeando o campo, sem abrir contexto e sem gravar — **nunca** roda sem contexto devolvendo vazio como se fosse sucesso | enfileirar `{}` → enfileirar `{ empresaId: 'nao-e-uuid' }` → enfileirar a válida | as duas inválidas terminam falhadas com razão contendo literalmente `empresaId`, e não aparecem entre as concluídas; contagem crua idêntica antes e depois. **O controle válido conclui e produz capturas** — sem ele o caso seria satisfeito por um consumidor que falha sempre | molde do `CT-002` de `eco.spec.ts`. Sem esta recusa o modo de falha é o pior possível: a RLS devolve vazio em silêncio e a régua **parece** ter rodado |

#### Equivalência com o oráculo (`packages/regua/test/equivalencia-com-o-oraculo.spec.ts`)

Setup: banco efêmero; política equivalente `{ ativo: true, dias: 10, intervalo: 2, 00:00–23:59, EMAIL }`; **a tabela de vereditos é constante literal declarada antes do `it`**, nunca computada da execução.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-636 | **a equivalência**, com os dez vereditos escritos **antes** da execução | CA-09, CA-06, CA-07, CA-08, CA-16 | O número de mensagens que o produto entrega em cada cenário, pelos dois caminhos, é **exatamente** o declarado na constante do topo — a tabela inteira, por igualdade de objeto | semear os 10 cenários e os 4 históricos → executar o automático → restaurar → executar o manual cenário a cenário → comparar | o objeto medido é **estritamente igual** à constante: os vinte números batem um a um. Em particular REG-01 automático `1` (a falha de −1 não trava), REG-08 manual `0` (a divergência por vitória), REG-06/07/09 `0` nos dois caminhos. Nenhum `toContain`, nenhum `objectContaining` | vencimentos por deslocamento sobre `data_corrente_da_operacao()`; **PAGA e CANCELADA pelas rotas reais** — nunca escrevendo estado, que não existe como coluna; o locatário sem contato pelo caminho do CT-619 |
| CT-637 | a única divergência é REG-08/manual, e o lado do oráculo é **lido do golden** | CA-09 | Comparadas a tabela do produto e a do oráculo — esta **lida** de `retorno.divergencia_de_estado`, nunca redigitada —, o conjunto de pares divergentes é **exatamente** `[('REG-08','manual')]` | ler o golden → projetar → computar divergências → afirmar | a projeção tem `10` cenários; o conjunto de divergências é estritamente igual a **um** elemento, nomeado; naquele par o oráculo vale `1` e o produto vale `0`; as outras dezenove células coincidem | **Gate 6** — o *expected* do lado do oráculo vem de **fonte externa verificável** (o artefato versionado), não de literal escrito pelo teste. É o que impede a equivalência de **concordar consigo mesma** |

#### Protocolo Antirregressão: o fecho do D32 (`packages/shared/test/protocolo-antirregressao.spec.ts`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup (caminho legítimo) |
|---|---|---|---|---|---|---|
| CT-638 | o contrato da fila tem definição única, e o marcador sai junto com a linha do índice | CA-04 | Nome, opções e tipos de carga têm **uma** definição, em `packages/shared/src/fila.ts`; nenhuma redefinição sobrevive no `worker`; e o marcador `D32` saiu do código **no mesmo commit** em que a linha saiu do índice do `CLAUDE.md` — as **duas pontas** conferidas | afirmar definição única → afirmar consumo pela fronteira → afirmar as duas pontas do índice → afirmar as duas `DECISÃO FECHADA` íntegras → mutantes | a lista de arquivos que **definem** cada símbolo tem **exatamente `1`** elemento; `grep D32` no código devolve `0` e no índice do `CLAUDE.md` devolve `0` — **simultaneamente**. Os dois textos `DECISÃO FECHADA` de `fila.ts` permanecem **byte a byte** idênticos | ⚠️ `apps/worker/src/fila.ts` tem **duas** `DECISÃO FECHADA` convivendo com o `DÉBITO COM GATILHO` do D32: editar sob o **débito** é normal; sob as **decisões**, é **PARAR e escalar** |

### 19.3 Testes End-to-End

Todos em `apps/api/test/automacao-de-cobranca.e2e.spec.ts`, no molde de `mora.e2e.spec.ts`, contra **servidor real em porta reservada**, com banco e Redis efêmeros.

> **A precondição de sessão é a mesma nos sete, e o caminho legítimo é um só**: sessão pela **rota pública** de entrada com a senha da carga (**nenhum cookie montado à mão**); arranjo de chaves pelo caminho real da camada de dados (`escreverAjustes`) sob o contexto da empresa da pessoa; e o efetivo **afirmado por `GET /v1/sessao`** antes dos casos — sem essa afirmação, um `403` seria indistinguível de defeito da rota. **Nenhuma chave nasce no catálogo**, que é fechado e esta fatia não o abre.

#### Fluxo: a política — leitura sem `404`, escrita idempotente (CT-627)
- **Framework**: HTTP real (Fastify em porta reservada) + `embedded-postgres`
- **CA**: CA-02, CA-03
- **Objetivo**: o `GET` de empresa que nunca configurou devolve `200` com a régua desligada — **nunca `404`** — e **não cria linha**; duas chamadas ao `PUT` deixam a contagem crua em `1`.
- **Pré-condições**: primeiro `it` do arquivo — a contagem `0` **afirma** a precondição e não é reconstituível depois; não há rota que apague a política, nem deve haver.
- **Passos**: `GET` com o cookie de A → contar cru → `PUT` primeira → `GET` → contar → `PUT` segunda → `GET` → contar → `GET` com o cookie de B.
- **Validações**: `200` com a política desligada por igualdade de objeto; contagem crua `0`, depois `1` **nas duas vezes** — nunca `2`; releitura estritamente igual ao último corpo; B lê a desligada.

#### Fluxo: o `PUT` recusa e **nada é gravado pela metade** (CT-628)
- **Framework**: idem
- **CA**: CA-15
- **Objetivo**: todo corpo inválido é recusado com `422` e o envelope **inteiro** da ADR-0017 nomeando o campo; a política já gravada permanece **byte a byte** a mesma.
- **Pré-condições**: a referência é gravada pela rota real no primeiro passo — o caso **não depende de ordem**.
- **Passos**: gravar a referência → para cada uma das 14 linhas inválidas, `PUT` e conferir → após **cada** recusa, `GET` e comparar → contar cru → `PUT` com as duas bordas aceitas.
- **Validações**: `422` com o objeto de erro **inteiro** (igualdade, nunca presença de campos) e o campo ofensor nomeado; após cada recusa o `GET` devolve exatamente a referência; contagem crua `1`; as duas bordas respondem `200` — **controle positivo** sem o qual a tabela seria satisfeita por uma validação que recusa tudo. A releitura final é o que separa *"recusado"* de *"aceito com efeito parcial"*.

#### Fluxo: o disparo manual ignora janela **e** trava (CT-629)
- **Framework**: idem, com adaptador de captura injetado
- **CA**: CA-07
- **Objetivo**: o `POST` sobre cobrança VENCIDA com `ENVIADA` dentro do intervalo **e** com o instante fora da janela responde `200`, entrega **uma** mensagem e grava `caminho: 'MANUAL'`.
- **Pré-condições**: sessão com a **conjunção** (área + ação); política com janela que **não** contém o instante; cobrança a −20 com `ENVIADA` a −1.
- **Passos**: semear → `POST` → conferir resposta → conferir capturas → conferir a linha nova.
- **Validações**: `200` (o mesmo código das rotas de transição de `CobrancaController` — o ato **não cria recurso**); **uma** captura com o destinatário do locatário; contagem crua de `1` para `2`, com `caminho: 'MANUAL'`, `desfecho: 'ENVIADA'`, `causa: null`. **As duas condições estão violadas simultaneamente no arranjo**, e é isso que torna o caso discriminante. Convergência declarada com REG-02, REG-04 e REG-10: o manual ignorar janela e trava é **regra, não defeito** — preserva-se.

#### Fluxo: **REG-08** — o manual é recusado sobre cancelada e sobre paga (CT-630)
- **Framework**: idem
- **CA**: CA-08, CA-09
- **Objetivo**: o disparo sobre `PAGA` ou `CANCELADA` é recusado com **`422 CAMPO_INVALIDO`**, sem entregar mensagem e sem gravar linha — a recusa vem do **estado publicado**, não de guarda escrita na régua.
- **Pré-condições**: os estados terminais alcançados pelas **rotas reais** de acusar pagamento e cancelar — nunca escrevendo estado, que não existe como coluna. O efetivo é afirmado por `GET /v1/sessao` **antes**, para que a recusa observada seja provadamente por **estado** e não por autorização.
- **Passos**: medir → `POST` sobre a CANCELADA → `POST` sobre a PAGA → medir de novo → `POST` sobre a VENCIDA de controle.
- **Validações**: as duas primeiras respondem `422` com o envelope **inteiro** e `detalhes.estadoAtual` valendo `CANCELADA` e `PAGA` — a mesma forma que `cobranca.service.ts` já publica. Capturas e contagem crua **idênticas** às de antes: nenhuma linha nasce, **nem sequer `FALHOU`**. O controle VENCIDO responde `200` com **uma** captura nova, sem o qual o caso seria satisfeito por uma rota que recusa tudo.
- ⚠️ **É a divergência por vitória e a razão de ser da fatia.** No legado, `is_cobranca_paga` conhece `Paga` e **não conhece** `Cancelada`; o golden mede automático `0` e manual `1`. Aqui o produto responde `0` nos dois caminhos.

#### Fluxo: o histórico de envios (CT-631)
- **Framework**: idem
- **CA**: CA-11, CA-12
- **Objetivo**: `200` com todas as tentativas em ordem **decrescente**, cada item com instante, caminho, desfecho, destinatário e causa; cobrança de outra empresa responde `404` **indistinguível** de inexistente.
- **Pré-condições**: histórico com as três naturezas de desfecho e instantes distintos, gravado pela porta real; sessão com **apenas a área** — consultar histórico **não é ato sensível** (RN-12).
- **Passos**: `GET` com o cookie de A → conferir corpo item a item → conferir a ordem → `GET` com o cookie de B sobre o **mesmo** código.
- **Validações**: lista de comprimento `3`, estritamente igual a `[SEM_DESTINATARIO, FALHOU, ENVIADA]` nos campos afirmados, com instantes estritamente decrescentes; sob B, `404` com o envelope **inteiro**, idêntico ao de código inexistente. Molde de `recusa-indistinguivel.e2e.spec.ts`.

#### Fluxo: `:codigo` malformado × inexistente (CT-632)
- **Framework**: idem
- **CA**: CA-11, CA-08
- **Objetivo**: nas **duas** rotas que recebem `:codigo`, código malformado é `422` nomeando `codigo` **antes de qualquer acesso a banco**, e código bem formado mas inexistente é `404` — as duas recusas são distintas e nenhuma vaza a outra.
- **Pré-condições**: sessão com a área e, para o `POST`, também a ação — para que a recusa seja provadamente de **forma**, não de autorização.
- **Passos**: 3 códigos malformados × 2 rotas → contar cru → o inexistente × 2 rotas.
- **Validações**: seis chamadas com `422` e o envelope inteiro nomeando `codigo`; duas com `404` e corpo idêntico ao de cobrança de outra empresa; contagem crua idêntica antes e depois das oito chamadas. ⚠️ `CTR-2026-00001` está na tabela **de propósito**: é a série de **contrato**, bem formada para outro recurso, e discrimina um esquema que só confira comprimento.

#### Fluxo: a superfície fecha em **86/71** por dupla medição (CT-635)
- **Framework**: aplicação de produção montada **por inteiro** — a mesma composição que atende, não uma montagem reduzida
- **CA**: CA-13, CA-14
- **Objetivo**: o retrato das exigências **efetivas** é exatamente `{ classe: ['TELA:automacao_de_cobranca'] }` nas três rotas de área e `{ metodo: ['TELA:automacao_de_cobranca','ACAO:enviar_cobranca_manual'] }` no disparo; `semDeclaracao` é vazio; e a superfície fecha em `86`/`71` por **duas medições independentes**.
- **Pré-condições**: base anterior `82` pares / `67` manipuladores (CT-533).
- **Passos**: medir pelo roteador → medir pela composição → afirmar a **igualdade entre as duas** → afirmar `71` manipuladores → afirmar o retrato por igualdade de objeto e `semDeclaracao === []` → mutantes.
- **Validações**: as duas medições devolvem `86` e a igualdade entre elas é afirmada **explicitamente**; retrato estritamente igual ao declarado. Três mutantes obrigatórios: (a) o `POST` declarando **só a ação** reprova nomeando o manipulador que exige **menos** que a classe; (b) rota de área sem declaração reprova em `semDeclaracao`; (c) rota acrescentada sem entrar na contagem reprova nas **duas** medições. ⚠️ **A base é `82`, não `77`** — o `77` vinha da premissa refutada do `HEAD` em dobro, e `cobertura-de-autorizacao.ts` **suprime** o `HEAD`.

### 19.4 Cenários de Erro e Segurança

| Cenário | CA | Objetivo | Trigger | Status / Log Esperado |
|---|---|---|---|---|
| **Isolamento entre empresas nas duas tabelas novas** (CT-607) | CA-02, CA-12 | Sob o contexto de B, nenhuma linha de A é legível, atualizável ou apagável, e toda inserção com `empresa_id` de A é recusada pelo `WITH CHECK` — **a recusa vem do banco** | `SELECT`, `UPDATE`, `DELETE` e `INSERT` cruzados entre as duas empresas | `count(*)` cru `0` nas duas tabelas sob B; `rowCount` `0` nos quatro comandos; **`SQLSTATE 42501`** nas duas inserções; sob A tudo permanece intacto; `relrowsecurity` e `relforcerowsecurity` **`true`** nas duas |
| **As tabelas nascem com RLS forçada e FK composta** (CT-608) | CA-02, CA-12 | Por **introspecção do catálogo**: `empresa_id NOT NULL`, RLS habilitada **e forçada**, exatamente uma política `FOR ALL` com `qual` textualmente **idêntico** a `with_check`, FK composta e `UNIQUE(empresa_id)` | consulta a `pg_class`, `pg_policies`, `pg_constraint`, `pg_enum`, `pg_indexes` | tudo por igualdade de valor ou de lista ordenada; rótulos de enum **estritamente iguais** a `['EMAIL']`, `['AUTOMATICO','MANUAL']` e `['ENVIADA','FALHOU','SEM_DESTINATARIO']`. Mutante A (sem `FORCE`) reprova nomeando a tabela; mutante B (FK simples) reprova com `['cobranca_id']` contra `['cobranca_id','empresa_id']` |
| **O job de uma empresa não alcança a outra** (CT-621) | CA-12 | Executado com `empresaId` de B, nenhuma mensagem vai a destinatário de A e nenhuma linha nasce em A — o contexto é aberto **uma vez na borda**, pelo escritor único (ADR-0024) | tarefa enfileirada na fila **real**, aguardada por sondagem com limite declarado | conjunto de destinatários **exatamente** o de B, interseção com A **vazia**; contagem crua sob A idêntica à inicial; sob B cresce exatamente pelo número de candidatas. O teste **enfileira pela fila real e deixa o consumidor abrir o contexto** — não fixa `app.empresa_id` por fora da barreira, não usa conexão privilegiada |
| **O escritor de contexto continua único** (CT-624) | CA-12 | A lista de arquivos de produção que chamam `contextoDeTenant.executarCom` é **exatamente** `[guarda de contexto da api, borda do job do worker]`; `app.empresa_id` só é executável em `unidade-de-trabalho.ts`; `identidade.empresa` só passa por `abrirAcessoAIdentidade` | varredura estática dos quatro alvos | lista com **exatamente `2`** elementos — nunca `toContain`; `app.empresa_id` com **exatamente `1`**. Mutante com terceira chamada e mutante com `SET LOCAL` escrito à mão reprovam nomeando arquivo e linha. ⚠️ Falsificação **obrigatória**, pelo script do pacote |
| **A suíte não alcança rede** (CT-626) | CA-17 | Nenhum arquivo de teste instancia o adaptador de produção, **nos três lugares onde ele poderia ser instanciado**, e a régua roda inteira com o de captura **mesmo com `SMTP_URL` apontando para destino impossível** — a barreira é **construção**, não configuração | `SMTP_URL=smtp://127.0.0.1:1` + varredura de `packages/regua/test/**`, `apps/worker/test/**` **e `apps/api/test/**`** | a lista de arquivos de teste que importam o adaptador de produção é **`[]`** por igualdade, **na união dos três alvos** — varrer só `packages/regua/test/**` deixaria de fora justamente o pacote de app que passou a enviar (§5.1-C). O mutante prova a discriminação reprovando e nomeando o arquivo, e **um segundo mutante em `apps/api/test/**` é obrigatório**, senão a extensão do alvo não fica provada. Com a `SMTP_URL` hostil, a régua **conclui** e o número de capturas é exatamente o de candidatas — **nenhum erro de conexão aparece, porque nenhuma conexão é tentada** |
| **Sem a área, as quatro rotas recusam e nada muda** (CT-633) | CA-14 | Pessoa sem `TELA:automacao_de_cobranca` é recusada nas quatro rotas, sem efeito algum | sessão de `USUARIO_EMPRESA` com a matriz padrão (apenas `TELA:resumo`), afirmada por `GET /v1/sessao` | as quatro respondem **`403`** com o envelope **inteiro** (igualdade de objeto); política relida estritamente igual; as duas contagens cruas e o comprimento das capturas idênticos. **Nenhuma resposta é `404`** — o que distinguiria recusa de inexistência e vazaria informação |
| **Com a área e sem a ação, só o disparo é recusado** (CT-634) | CA-13 | Sucesso nas três rotas de área e recusa **apenas** no `POST`; acrescentada a ação, o `POST` passa | dois arranjos sobre a **mesma** pessoa, distintos por **exatamente uma** chave | arranjo 1: as três de área com `200`, o `POST` com `403` e envelope inteiro, capturas e contagem crua **inalteradas**. Arranjo 2: `POST` com `200`, capturas **+1** e contagem crua **+1**. A diferença de **uma** chave é o que prende a exigência à ação, e não à área. O efetivo é **reafirmado** por `GET /v1/sessao` após cada ajuste — a sessão relê a versão de permissões quando diverge |

> **Cenários de erro que vivem noutras subseções, por camada**: a barreira de partida (CT-625, em 19.1), a trava que não conta a falha (CT-611), a falha que não toca o financeiro (CT-618), o locatário sem endereço (CT-619), o job sem carga válida (CT-623) e a recusa por estado terminal (CT-630). Cada CT pertence a **exatamente uma** camada — a regra de unicidade vale, e a lista acima é ponteiro, não segunda instância.

### 19.5 Cenários Não Cobertos — e por quê

| Cenário | Motivo |
|---|---|
| O **gatilho de tempo** que aciona a régua por horário | RN-14 e D3 tiram do escopo — a fatia entrega a porta enfileirável; o relógio é da **F5** |
| Carga e desempenho com carteira grande | Fora do escopo; o predicado é consulta única no banco. Ver §12.3 |
| Concorrência entre o job automático e um disparo manual sobre a **mesma** cobrança | A disputa da trava foi **podada no pré-refinamento** (job por mensagem fica para a F5). Registrado como risco, não coberto |
| Entrega **real** de e-mail contra provedor SMTP | RN-15/CA-17 **proíbem** — a barreira falha fechado e a prova é sobre o adaptador de captura |
| Retenção e expurgo de `negocio.envio_de_cobranca` | **F7**, junto do irmão `identidade.tentativa_login` (item 5 da §F7) |
| Composição do documento do contrato a partir do fonte capturado | Sub-fatia **2b**. Aqui só se **extrai** a regra |

### 19.6 Recomendações da geração de testes

1. **Ordem de execução: CT-601..CT-603 primeiro.** É a única janela que fecha e não reabre. ⚠️ Não repita o erro da T1 anterior — a premissa *"exige `sudo` interativo"* é **falsa** para `deploy/scripts/caracterizacao/`.
2. **A tabela de vereditos do CT-636 deve estar escrita antes da primeira execução**, e o CT-637 deve ancorar o lado do oráculo **no golden** — sem essa separação, a equivalência concorda consigo mesma.
3. **Registre a emenda da RD-05 também na §2 do `run-report.md`**, para que uma rodada de correção posterior não a leia como defeito e "conserte" para o texto do PRD.
4. **Todo mutante pelo script do pacote** — nunca `vitest run` avulso (o falso negativo **inverte** a conclusão).
5. **Meça por pacote** e rode `rm -rf /tmp/sysloc-banco-*` entre execuções.
6. **Registre a baseline antes da primeira edição** (P1): o `CT-907` e o `CT-013` do `verificar-golden.sh` reprovam por achado **pré-existente** e não são regressão desta fatia.
7. **Confira os gatilhos do D1 no CT-614 e do D26 no CT-610/CT-611** — a §21.3 já os declara **não disparados**; a conferência é a rede.
8. A **ADR-0024** precisa estar aceita antes de o Gate 2 julgar CT-621, CT-623 e CT-624 — os três a exercitam diretamente. **Ela já está** (`accepted`, 2026-08-11).

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Um envio real escapar durante a verificação** (CA-17/RN-15) | Baixa | **Crítico** — mensagem indevida na caixa de uma pessoa real | Barreira **estrutural**, não configuração, e em **dois processos**: a substituição é feita por `overrideProvider` do arcabouço de teste (`api`) e por parâmetro da borda (`worker`), e o adaptador de produção **recusa a partida** sem transporte declarado nos dois — CT-625 e **CT-639**. O CT-626 prova que a suíte não alcança rede varrendo os **três** alvos. ⚠️ Que o risco tenha **duas** portas de saída, e não uma, é consequência de o disparo manual enviar de dentro da `api` (§5.1-C) — decisão preservada porque o `200` com `desfecho` é propriedade que o PRD exige (US-04, §10.1) |
| **A janela de prazo da CA-01 fechar** — o fonte do PDF vive só no banco legado | Média | **Irreversível** — a sub-fatia 2b fica sem a regra | É a **primeira task** da fatia, e o precedente é a T1 da fatia anterior. ⚠️ Não repita o erro daquela T1: a premissa *"exige `sudo` interativo"* é **falsa** para `deploy/scripts/caracterizacao/` — o acesso é por `docker compose`, e o usuário do host está no grupo `docker` |
| **A trava contar a tentativa falha** (a leitura literal da RN-06) reabrir por descuido numa rodada de correção | **Alta** | Quebra a CA-09 (a métrica nº 1 do PRD) e a CA-10 | `DECISÃO FECHADA` no predicado, com o `REVERTER EXIGE` apontando o oráculo; caso de teste com companheiro negativo; e o registro por extenso na §21 |
| **A repetição do job duplicar aviso** | Média | Alto — o locatário recebe duas cobranças | A idempotência é derivada do predicado (§9.2), e a prova dela é **caso obrigatório** |
| **Empresa nova ligar a régua e disparar sobre carteira grande** no dia da virada | Média | Médio — rajada de mensagens | Consequência aceita e **comunicada**: a régua nasce desligada, e ligá-la é ato deliberado. Entra no handoff e no roteiro da virada (PRD §9) |
| **Editar a `0010` por engano** ao mexer na view | Baixa | Alto — o `sha256sum` de `migrar-banco.sh` aborta a instalação (D20) | A fatia cria migrações **novas**; a `0010` está listada como referência somente leitura na §3.7 |
| **Substituir a exigência de classe por só a ação** no disparo manual | Média | Alto — a rota exigiria menos que a classe, e o `CT-355` reprova | A conjunção inteira é declarada no método, e a razão está na §4.1 e na §11.2 |
| **O `worker` subir antes do banco** e falhar na partida | Média | Baixo — falha ruidosa e correta, mas evitável | Ordenação de unidades systemd (§16.3) |
| **`CT-907` flaky pré-existente** confundir o diagnóstico | **Alta** | Baixo | Falha por **timeout** é o flake conhecido (5000 ms sob disputa de CPU); falha por **asserção** é achado. Rode isolado para discriminar |
| **Disco do host em ~93%** produzir `No space left on device` disfarçado de teste vermelho | **Alta** | Médio | `rm -rf /tmp/sysloc-banco-*` entre execuções |

---

## 21. Observações Técnicas

### 21.1 A emenda declarada à RN-06 e à CA-06 — leia antes de "corrigir" o predicado

**O PRD contradiz o próprio oráculo, e a contradição foi medida.** A RN-06 e a parêntese da CA-06 mandam a trava de intervalo contar **qualquer** tentativa registrada, *"inclusive quando a tentativa recente é uma que falhou"*. O oráculo mede o contrário: `retorno.intervalo` traz o caso `envio_com_erro_nao_bloqueia` com saída **`true`**, e o único cenário com histórico em erro — o **REG-01**, com envio `Erro` em `−1 dia` — **recebe 1 mensagem** no automático.

Aplicar a RN-06 ao pé da letra produziria uma **segunda** divergência contra o oráculo, e a **CA-09** declara **uma só**. Pior: tornaria a **CA-10** inexequível — a repetição do job pularia justamente a cobrança que falhou, e *"a tentativa é repetida sem intervenção de ninguém"* deixaria de valer.

**Decisão: a trava conta apenas a tentativa com desfecho `ENVIADA`** (RD-05). O argumento que decide não é o de custo — é o de finalidade: **o intervalo existe para proteger a caixa do locatário, e a tentativa que falhou não pôs nada nela**. Travar por ela silenciaria a régua por dois dias para quem não recebeu coisa alguma. É também o que o legado faz, e é o que preserva os dois critérios de aceite que a alternativa quebraria.

**A RN-06 e a parêntese da CA-06 ficam, portanto, emendadas por esta spec**, e a emenda vai protegida por marcador `DECISÃO FECHADA` no ponto do predicado — o caso se encaixa em dois dos gatilhos da §3 do Protocolo Antirregressão (a forma escolhida é menos óbvia que a leitura literal do requisito, e a decisão foi escalada ao usuário).

### 21.2 Os dez vereditos, escritos ANTES da execução

A CA-09 exige que a equivalência seja **declarada, não descoberta**. A tabela de vereditos abaixo é o veredito; ela entra no arquivo de teste como constante, e a suíte afirma contra ela.

**Antes dela, o mapeamento da configuração — porque "equivalente" não é óbvio.** O legado tem **sete** campos e **duas trilhas** (uma para *a vencer*, outra para *vencida*); o produto tem **seis** e trilha única, por decisão do PRD (RN-04). Reconstruir esse mapeamento a partir do golden na hora de escrever o CT-636 seria adivinhação, e é assim que uma equivalência passa a concordar consigo mesma:

| Campo do oráculo (`entrada.configuracao_da_regua`) | Valor | Campo do produto | Valor | Por quê |
|---|---|---|---|---|
| `ativo` | `"1"` | `ativo` | `true` | direto |
| `dias_antes_vencimento` | `"10"` | `diasAntesDoVencimento` | `10` | direto |
| `intervalo_dias_vencida` | `"2"` | `intervaloMinimoDias` | **`2`** | **é o valor que discrimina** — REG-04, REG-05 e REG-10 são os únicos cenários com histórico que decide, e os três são `VENCIDA` |
| `intervalo_dias_a_vencer` | `"3"` | — | *(colapsado)* | **não discrimina nenhum cenário**: o único `A_VENCER` com histórico é o REG-01, cuja tentativa é `Erro` e, pela RD-05, não trava com valor algum |
| `horario_a_vencer` · `horario_vencida` | `"00:00:00"` | `janelaInicio`/`janelaFim` | `00:00`–`23:59` | a janela do oráculo **nunca fecha**; a do produto que nunca fecha é o par de bordas, porque `00:00`–`00:00` fecharia tudo menos um minuto |
| `canal_a_vencer` · `canal_vencida` | `"ambos"` | `canal` | `EMAIL` | o produto implementa **um** canal, e a RN-13/CA-15 manda recusar os demais **na entrada**. Todas as linhas de `entrada.historico_de_envio` do golden têm `canal: "email"`, de modo que a contagem de mensagens do oráculo já é a de e-mail |
| `nao_enviar_a_vencer` | `"0"` | — | *(colapsado)* | o equivalente do produto é `diasAntesDoVencimento = 0`, que desliga a trilha *a vencer* sem um campo próprio para isso |
| `prefixo_request_id` (no histórico) | `REQ-AUTO-{AV,VC,EMAIL}-` | — | *(sem equivalente)* | ver a nota abaixo |

⚠️ **A trava do legado é chaveada por trilha, e a do produto não — e isso NÃO é a 11ª divergência.** `retorno.intervalo` traz o par `prefixo_legado_conta_para_vencida: false` e `prefixo_legado_nao_conta_para_a_vencer: true` sobre a **mesma** REG-10, com o **mesmo** histórico: no legado, uma tentativa registrada sob o prefixo `REQ-AUTO-EMAIL-` conta para a trilha *vencida* e não conta para a *a vencer*. É consequência direta das duas trilhas, e some com elas. Os dois casos são **função**, não cenário: nenhum dos dez REG os exercita nas duas trilhas ao mesmo tempo, e o CT-637 compara os **dez cenários**, não as seis linhas de `retorno.intervalo`. Quem for implementar: **não tente reproduzir o prefixo** — ele é artefato do modelo de duas trilhas que o PRD descartou, e reproduzi-lo reintroduziria o defeito de "dois lugares decidem o mesmo fato" que a fatia existe para fechar.

Configuração usada pela suíte, portanto: `ativo = true`, `diasAntesDoVencimento = 10`, `intervaloMinimoDias = 2`, janela `00:00`–`23:59`, canal `EMAIL`.

| Cenário | Estado | Vencimento | Histórico | Automático (oráculo → produto) | Manual (oráculo → produto) | Natureza |
|---|---|---|---|---|---|---|
| REG-01 | A_VENCER | +5 | falha em −1 | 1 → **1** | 1 → 1 | converge (pela RD-05) |
| REG-02 | A_VENCER | +40 | — | 0 → 0 | 1 → 1 | converge — o manual ignora o recorte de dias |
| REG-03 | VENCIDA | −12 | — | 1 → 1 | 1 → 1 | converge |
| REG-04 | VENCIDA | −20 | sucesso em −1 | 0 → 0 | 1 → 1 | converge — o manual ignora a trava |
| REG-05 | VENCIDA | −30 | sucesso em −10 | 1 → 1 | 1 → 1 | converge |
| REG-06 | PAGA | −8 | — | 0 → 0 | 0 → 0 | converge |
| REG-07 | PAGA | −15 | — | 0 → 0 | 0 → 0 | converge — diverge em **template**, não em efeito |
| **REG-08** | **CANCELADA** | −25 | — | 0 → 0 | **1 → 0** | **A ÚNICA DIVERGÊNCIA — por vitória** |
| REG-09 | sem destinatário | +3 | — | 0 → 0 | 0 → 0 | converge |
| REG-10 | VENCIDA | −18 | sucesso em −1 | 0 → 0 | 1 → 1 | converge — o manual ignora a trava |

**O REG-08 é o defeito que a fatia fecha.** No legado, `emailer.is_cobranca_paga` conhece `Paga` e **não conhece** `Cancelada`, e o caminho manual cobra dívida cancelada. Aqui os dois caminhos leem `negocio.cobranca_derivada`, onde `CANCELADA` tem precedência sobre tudo — não existe segundo lugar onde o estado se decida, e é essa unicidade (não uma guarda) que fecha o defeito. **A fatia 2 não porta este defeito.**

**Duas correspondências que exigem tradução, e o motivo:**

- **REG-09** — o legado tem cobrança **sem locatário**; no produto isso é **irrepresentável** (`negocio.cobranca` referencia `contrato`, que referencia `locatario`, todos `NOT NULL`). O estado equivalente mais próximo é **locatário sem endereço de contato**, e é ele que a suíte semeia. ⚠️ Note que ele também é irrepresentável **pela borda** — `negocio.locatario.email` é `NOT NULL` e `esquemaDePessoaNova` exige `z.email()` —, de modo que a RD-11 é guarda contra dado que só chega por migração do legado ou por escrita direta. A precondição da suíte é semeadura no banco, que é caminho legítimo já usado por `banco-efemero.ts`.
- **REG-07** — o legado resolve template `Fechada` no automático e `Vencida` no manual, e **não envia** por nenhum dos dois. A divergência é de **template**, não de efeito, e o produto não a reproduz porque não tem o conceito: nele o molde sai do estado publicado, que é um só. A equivalência é afirmada **sobre o efeito** (0 → 0), que é o que a CA-09 mede.

### 21.3 Os três débitos com gatilho que esta fatia toca

| Débito | Dispara? | O que se faz |
|---|---|---|
| **D32** (F0/T6) — o contrato da fila duplicado | **SIM** — é a primeira fatia que enfileira tarefa de negócio | **Fecha**: nome, opções e tipos de carga descem para `packages/shared/src/fila.ts`; o marcador sai de `apps/worker/src/fila.ts` **no mesmo commit**, e a linha sai do índice do `CLAUDE.md` |
| **D1** (F3/T2) — `MAIOR_VALOR_MONETARIO`/`ESCALA_MONETARIA` duplicados | **NÃO** | **Conferido**: nenhum esquema novo desta fatia tem campo monetário. O valor impresso na mensagem vem da cobrança já publicada. Não há terceiro consumidor monetário — o marcador **fica** |
| **D26** (F3/T8) — `ultimoDiaDoMes`/`ehBissexto` duplicados | **NÃO** | **Conferido**: a aritmética de calendário desta fatia corre **no banco** (o predicado usa `data_corrente_da_operacao()`), e a janela compara `HH:MM`, que é relógio e não calendário. Não há terceiro consumidor — o marcador **fica** |
| **D20** (F3/T7) — a janela para emendar a `0010` | **NÃO** | A fatia cria migrações **novas**; a `0010` não é tocada. O marcador **fica** |
| **D36** (F2/T8) — o carimbo do PDF no cancelamento de contrato | **NÃO aqui** | Fecha na sub-fatia **2b**, e **por construção**: com o PDF derivado sob demanda não existe arquivo preexistente de que o cancelamento possa depender |

### 21.4 ADRs Aplicáveis nesta Feature

Inventário declarativo com **conformidade literal** — a `Decision` de cada ADR abaixo foi aberta e confrontada contra as decisões desta spec, não parafraseada do `INDEX.md`.

| ADR | Classificação | Onde se aplica, e o trecho satisfeito |
|---|---|---|
| **ADR-0005** — rotinas versionadas com instalação idempotente | **PARCIAL** | §16.3 · o script de captura da CA-01 vive no repositório e **não carrega credencial** — *"nenhum entra no repositório carregando credencial"* |
| **ADR-0006** — ambiente de verificação separado do que atende a operação | **APLICÁVEL** | §8, §20 · a suíte sobe instância efêmera própria e **nunca** alcança o ambiente da operação. Para a CA-01, a leitura do legado é **somente leitura** e não executa suíte contra ele |
| **ADR-0008** — isolamento garantido pelo banco | **APLICÁVEL** | §7.2, §7.3 · as duas tabelas nascem com `empresa_id`, **RLS habilitada com `USING` e `WITH CHECK`**, e a FK composta `(id, empresa_id)` como forma de referência entre entidades tenantizadas (`envio_de_cobranca → cobranca`). **Nenhum filtro por empresa é escrito na aplicação** — *"a camada de aplicação não implementa filtro por empresa equivalente: não há dois caminhos para o dado"* |
| **ADR-0009** — fronteira identidade × negócio por schema | **APLICÁVEL** | §4.3, §7.2 · as duas tabelas ficam em `negocio`, com RLS **forçada**; a enumeração de empresas lê `identidade.empresa`, *"sem noção de tenant"*. A cobertura continua sendo consultada no catálogo do sistema — a lista de `papel-de-conexao.spec.ts` vai a 14 |
| **ADR-0011** — cobertura declarada por rota, default que nega | **APLICÁVEL** | §11.2 · as 4 rotas declaram nas **duas dimensões**; `semDeclaracao` continua vazio. **O catálogo fechado não abre** — a área e a ação já existem |
| **ADR-0014** — exclusão lógica para entidade de cadastro | **N/A** | `envio_de_cobranca` **não é cadastro**: nada a referencia e ela não é criada nem nomeada pelo usuário. Ela também não é apagada — mas por ser registro de fato, não por esta ADR. O discriminador dela é *"ser referenciável"*, e o registro não é |
| **ADR-0015** e **ADR-0020** — contador e série declarada | **N/A** | Nenhuma entidade nova tem código legível. A chave exposta de `envio_de_cobranca` é o **UUID**, que é o que a ADR-0017 manda quando não há série |
| **ADR-0016** — o esquema é a fonte única do contrato | **APLICÁVEL** | §4.2, §15.3 · entrada, tipo de resposta e documento publicado derivam do **mesmo** objeto Zod; `esquemaPublicado` traduz, e nenhuma descrição é escrita à mão |
| **ADR-0017** — forma canônica com três classes de chave | **APLICÁVEL** | §4.1, §4.2 · `:codigo` é o **código legível** da cobrança (série declarada); o `id` do envio é **UUID** (sem série). O corpo fala camelCase; a lista devolve `{ itens, total, limite, deslocamento }`; o erro é status semântico mais `{ codigo, mensagem, campo?, detalhes? }` com `codigo` de enum fechado |
| **ADR-0018** — composição de exigências e cobertura por conteúdo | **APLICÁVEL** | §4.1, §11.2 · o disparo manual declara a **conjunção**, e a recusa nomeia a **primeira ausente na ordem declarada**. Nenhum manipulador exige menos que a classe |
| **ADR-0021** — transição governada conforme a natureza do ato | **APLICÁVEL** | §4.1 · o disparo manual é **rota própria** e exige a **chave de ação** do catálogo — primeira classe, por **nomeação do próprio catálogo** (`ACAO:enviar_cobranca_manual` existe e mora em `TELA:automacao_de_cobranca`). ⚠️ Note que o ato **não é transição de estado** da cobrança: ele não move `status`, e a ADR o alcança pela cláusula de **ato de negócio governado pela natureza** |
| **ADR-0022** — o que se grava e o que se deriva | **APLICÁVEL** | §6.3 RD-01, RD-09 · a régua **lê** `cobranca_derivada` e **não escreve estado** em hipótese alguma — *"o estado publicado de um fato financeiro é derivado dos fatos gravados, nunca uma coluna movida por rotina"*. Falha de envio não toca a cobrança nem a mora |
| **ADR-0023** — onde vive a derivação | **APLICÁVEL** | §5.1-B, §12.2 · a elegibilidade **participa de seleção**, logo vive **no banco**. A janela de horário **não** participa de seleção, logo vive na aplicação. E *"objeto derivado com direitos próprios não é admitido"*: nenhum objeto novo com `SECURITY DEFINER` nasce aqui, e a leitura herda a política pelo contexto da transação |
| **ADR-0024** — origem do contexto de tenant sem requisição | **APLICÁVEL** | §4.3, §5.1-B passo 2, §11.1 · o contexto vem da **carga do trabalho**, aberto **uma vez na borda que a recebe**, pelo **mesmo escritor único** da borda HTTP. O `empresaId` é produzido pela **enumeração de tenants**, *"a única leitura legítima sem contexto de empresa"*, e **nunca é aceito de fonte externa** — não há rota que enfileire. O `Cons` de emendar o cabeçalho de `contexto.ts` é cumprido na §3.6 |
| **ADR-0001** — modelo canônico de cobrança bancária | **N/A** | Não há emissão de boleto nesta fatia (F4) |
| **ADR-0010**, **ADR-0013** | **N/A** | Nenhuma mudança em efetivo de permissão nem no alcance da garantia do Master |
| **ADR-0002**, **0003**, **0004** | **deprecated** | Nomeiam primitivas do Frappe |
| **ADR-0007**, **0012**, **0019** | **superseded** | Não citar como vigentes — as vigentes das cadeias são a **0017** e a **0021** |

**Nenhum conflito spec × ADR e nenhum conflito ADR × ADR foi encontrado.**

### 21.5 Candidatos a ADR

A primeira decisão transversal desta fatia já virou ADR antes do tech spec: *"qual é a origem legítima do contexto de tenant quando não há requisição"* foi registrada como **ADR-0024** em 2026-08-11, com esta feature no `Applied in`.

**Duas candidatas confirmadas (5/5) nasceram no `/agent-spec-challenge-spec` de 2026-08-11**, e as duas são a mesma classe: **decisão cuja forma correta parece engano para o próximo leitor**. É exatamente o que o C4 mede, e é o que separa as duas do candidato parcial abaixo.

| Candidata | C1 transversal | C2 tag | C3 reversão | C4 surpreendente | C5 trade-off |
|---|---|---|---|---|---|
| **(a) O domínio declara a porta; o adaptador depende dele** (§3.3.3 — a seta `db → regua`) | ✅ a **F4** terá o adaptador do Sicoob, a sub-fatia **2b** o gerador de PDF: mesma pergunta | ✅ `architecture` | ✅ move tipos entre pacotes e inverte `package.json` | ✅ **a spec precisou escrever *"não corrija a direção"*** | ✅ `@sysloc/db` dono do tipo era a alternativa genuína, e era a leitura original desta spec |
| **(b) O relógio da operação mora no banco** (§5.1-B passo 4) | ✅ a **F5** agenda por horário; a **F4** carimba retorno bancário | ✅ `architecture`, `data` | ✅ | ✅ **o defeito é invisível** — acerta pela `TZ` do host, e nenhum caso comportamental o pega | ✅ `Intl.DateTimeFormat` com `timeZone` fixo, com trade-off medido: duas fontes de tempo × uma ida ao banco |

```bash
/agent-spec-adr-create "o domínio declara a porta; o adaptador depende dele, nunca o contrário"
/agent-spec-adr-create "o relógio da operação mora no banco — a aplicação nunca lê o do processo"
```

⚠️ **Por que estas duas não seguem o adiamento da porta de e-mail abaixo.** O candidato parcial é adiado por **falhar o C5** — as alternativas dele são descartadas por razão de *stack*, não por trade-off. As duas acima passam o C5 com alternativa real, e por isso o precedente não as alcança. Registrá-las apenas aqui as enterraria num artefato de fatia que a fatia seguinte não abre — a mesma falha que a §3-B da `.claude/rules/nao-regressao.md` descreve para débito registrado só no relatório.

Duas outras decisões foram avaliadas e **não** viram ADR:

| Decisão | Critérios | Veredito |
|---|---|---|
| **A porta de saída externa com adaptador de captura e barreira que falha fechado** | C1 ✅ (a F4 terá o Sicoob, a F5 mais saídas) · C2 ✅ (`testing`, `architecture`) · C3 ✅ · C4 ✅ · **C5 ⚠️** | **Candidato a ADR parcial.** Falha o **C5** por margem: as três alternativas do D5 foram consideradas, mas duas delas (`nodemailer` direto, SMTP local) são descartadas por razão de **stack**, não por trade-off genuíno. **Recomendação**: reavaliar na **F4**, quando o adaptador do Sicoob tornar a decisão de fato transversal — aí o trade-off tem dois casos, não um |
| **A trava contar apenas a tentativa bem-sucedida** (RD-05) | C1 ❌ | Não é ADR: é regra **desta** feature, não do projeto. Fica registrada na §21.1 e protegida por `DECISÃO FECHADA` no código, que é a rede correta para ela |

### 21.6 Termos novos de domínio — **canonizados em 2026-08-11**

✅ **Feito.** O `/agent-spec-challenge-spec` rodou sobre esta spec em 2026-08-11 e gravou os dez termos nos dois níveis. **Não os redefina nas tasks nem no código** — os arquivos abaixo são a fonte, e a spec passa a falar o vocabulário deles.

| Nível | Arquivo | Termos |
|---|---|---|
| **Global** | `docs/specs/domain-glossary.md` | **Aviso**, **Régua de cobrança**, **Janela de horário**, **Tentativa de envio**, **Desfecho** — os cinco que a **F4** (retorno bancário) e a **F5** (rotinas agendadas) vão consultar |
| **Feature** | `docs/specs/features/regua-de-cobranca/domain-glossary.md` | **Política de aviso**, **Intervalo mínimo**, **Disparo manual**, **Caminho**, **Candidata ao aviso** — operacionais desta régua |

As duas ambiguidades que a versão anterior desta subseção apontava foram **resolvidas por escrito**, nas seções "Ambiguidades resolvidas" dos dois arquivos:

1. **"cobrança"** é o **fato financeiro**, nunca a mensagem — a mensagem é o **Aviso**. ⚠️ A chave `ACAO:enviar_cobranca_manual` **preserva o nome histórico** e não redefine o termo: o catálogo é fechado desde a F1 e persistido em `acesso_usuario_permissao`, logo não é renomeável. É o mesmo caso, e a mesma resolução, de `ACAO:excluir_cadastro`. **Não "corrija" o nome da chave.**
2. **"régua"** é o **trabalho**; a configuração que ele lê é a **política de aviso**. O pacote `@sysloc/regua`, a fila `regua-de-cobranca` e `executarReguaDaEmpresa` nomeiam o trabalho — coerentes com a resolução —, enquanto a tabela é `politica_de_aviso` e não `regua`.

### 21.7 Fatos operacionais que mordem quem for implementar

- **Rode `pnpm test` antes e depois de qualquer edição** — é a baseline que o Protocolo Antirregressão exige (P1 e P5), e a suíte está em **835 casos**.
- **Meça por pacote**: `turbo run test` aborta os irmãos quando um falha.
- **`rm -rf /tmp/sysloc-banco-*` entre execuções** — o disco do host está em ~93%.
- **`CT-907` é flaky pré-existente**: falha por **timeout** é o flake; por **asserção**, é achado.
- **`verificar-golden.sh` termina REPROVADO no `CT-013`** por achado **pré-existente** (colisão provável de agulha na varredura de credencial). Não é regressão desta fatia — está registrado na §4 do `_run/run-report.md` da fatia `cobranca-e-mora`. Quem tocar o verificador na CA-01 precisa saber disso para não confundir o vermelho herdado com o próprio.
- **Arquivos com `DECISÃO FECHADA` que esta fatia reabre**: `apps/worker/src/fila.ts` (duas) e `packages/db/src/contexto.ts`/`unidade-de-trabalho.ts` (leitura). Editar sob esses marcadores **exige PARAR e escalar** — a emenda ao cabeçalho de `contexto.ts` prevista na §3.6 é acréscimo a docblock, **não** alteração de código sob marcador, e a ADR-0024 é quem a autoriza nominalmente.

---

## 22. Checklist Final

- [x] Variante registrada (**backend**) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-09 mapeadas em 17; CA-01 a CA-17 na 19)
- [x] Resumo técnico claro e objetivo (seção 2)
- [x] Arquitetura definida com componentes e camadas (seção 3)
- [x] Contratos de API definidos com payloads, status codes e schemas (seção 4)
- [x] Fluxos de negócio descritos (seção 5)
- [x] Regras de processamento e validações (seção 6) — RD-01 a RD-17 rastreadas às RN do PRD
- [x] Persistência: tabelas, índices, migrações, transação (seção 7)
- [x] Integrações externas mapeadas (seção 8)
- [x] Sincronização: eventos, idempotência (seção 9)
- [x] Gerenciamento de erros e resiliência (seção 10)
- [x] Segurança: auth, autorização, criptografia, sanitização (seção 11)
- [x] Performance: metas, estratégias, limites (seção 12)
- [x] Logs, métricas, tracing e alertas (seção 13)
- [x] Feature flags (seção 14) — N/A declarado, com a confusão nomeada
- [x] Versionamento de API definido (seção 15)
- [x] Deploy e infraestrutura (seção 16)
- [x] Dependências externas listadas (seção 18) — **uma** nova
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (seção 19, com rastreabilidade CA→CT)
- [x] Riscos técnicos identificados (seção 20)
- [x] Observações técnicas registradas (seção 21) — inventário de ADRs com conformidade **literal**
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (seções 3.4–3.7)
- [x] Pronto para geração das TASKS
