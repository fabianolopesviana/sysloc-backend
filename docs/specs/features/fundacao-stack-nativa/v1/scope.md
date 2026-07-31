# SCOPE -- MiniSpec (Backend)

> **Variante**: backend
> **Stack**: Node
> **INTENT de origem**: `docs/specs/features/fundacao-stack-nativa/v1/intent.md`
> **Tech Alignment**: não existe para esta feature — decisões técnicas propostas neste SCOPE
> **Design**: N/A — variante backend não tem design

## 1. O que está incluído

- [ ] **Ferramental fixado por arquivo versionado**: versão do runtime e das ferramentas de linha de comando declaradas no repositório, de modo que qualquer máquina reproduza o mesmo conjunto.
- [ ] **Monorepo com espaço de trabalho**: raiz com gerenciador de pacotes por workspace, orquestrador de build, formatador/linter único e configuração de TypeScript estrita compartilhada.
- [ ] **Três pacotes iniciais**: o serviço de aplicação, o processador de trabalho em segundo plano e um pacote compartilhado de tipos e utilidades. Nenhum outro pacote do layout-alvo nasce aqui.
- [ ] **Serviço de aplicação** com duas verificações de saúde (rasa e profunda — §3.3) e a descrição do contrato publicada, ainda sem operação de negócio.
- [ ] **Processador de trabalho em segundo plano** consumindo de uma fila persistente, com uma tarefa trivial de ida e volta que serve de prova.
- [ ] **Tratamento global de erro** no formato fixado pela ADR-0007, nascendo conforme em vez de ser retrofitado.
- [ ] **Provisionamento dos serviços de base** (banco de dados relacional, servidor de fila com persistência em disco, capturador de e-mail de desenvolvimento) por script **versionado e idempotente**.
- [ ] **Unidades de serviço do sistema operacional** para o serviço de aplicação e para o processador, com reinício automático e ordem de dependência declarada, instaladas por script **versionado e idempotente**.
- [ ] **Verificação automatizada** com instâncias **efêmeras próprias** de banco de dados e de fila, descartadas ao fim da execução (§3.6 e ADR-0006).
- [ ] **Ciclo de trabalho do desenvolvedor**: um comando que levanta serviço de aplicação, processador e capturador de e-mail em painéis observáveis.
- [ ] **Apuração e registro da divergência de versão** entre o banco usado na verificação e o que atende a operação (critério de saída — INTENT §4.8).
- [ ] **Prova de recuperação**: encerrar o processo do serviço de aplicação e após reinício completo do servidor, ambos voltando sem intervenção.

---

## 2. O que está fora do escopo

- [ ] **Qualquer estrutura de dados de domínio** — nenhuma tabela de negócio, nenhuma migração de domínio, nenhuma entidade de locação.
- [ ] **Isolamento entre empresas e identidade de usuário** — fatia seguinte (`fundacao-multitenancy-identidade`); nascem antes da primeira entidade de negócio.
- [ ] **Os demais pacotes do layout-alvo** (`db`, `contracts`, `domain`, `banking`, `auth`) — nascem quando houver conteúdo para eles.
- [ ] **Publicação externa da aplicação** — nesta fatia ela responde localmente; não há vhost, domínio nem certificado. `deploy/nginx/` permanece vazio.
- [ ] **Rotinas agendadas de negócio e seus disparadores** — fatia `automacoes-agendadas`. Nenhum disparador temporal é instalado aqui.
- [ ] **Rastreamento distribuído e métricas exportadas** — apenas o registro estruturado de eventos entra (§3.7); a exportação para coletor externo fica para quando houver o que observar.
- [ ] **Backup e restauração** — fatia `virada-e-desinstalacao`.
- [ ] **Qualquer alteração no ambiente que atende a operação hoje**, exceto a janela de indisponibilidade combinada do reinício.
- [ ] **Versionamento do contrato da aplicação** — decisão diferida (§3.9), porque ainda não há recurso de negócio publicado.

---

## 3. Definições Técnicas

### 3.1 Visão em Árvore

```
/opt/sysloc-backend/
├── .mise.toml                                      [N]
├── package.json                                    [N]
├── pnpm-workspace.yaml                             [N]
├── turbo.json                                      [N]
├── biome.json                                      [N]
├── tsconfig.base.json                              [N]
├── vitest.config.ts                                [N]
├── mprocs.yaml                                     [N]
├── .env.example                                    [N]
├── .gitignore                                      [M]
├── apps/
│   ├── api/
│   │   ├── package.json                            [N]
│   │   ├── tsconfig.json                           [N]
│   │   ├── src/
│   │   │   ├── main.ts                             [N]
│   │   │   ├── app.module.ts                       [N]
│   │   │   ├── configuracao/
│   │   │   │   └── ambiente.ts                     [N]
│   │   │   ├── saude/
│   │   │   │   ├── saude.controller.ts             [N]
│   │   │   │   ├── saude.service.ts                [N]
│   │   │   │   └── saude.module.ts                 [N]
│   │   │   └── comum/
│   │   │       └── filtro-excecao.ts               [N]
│   │   └── test/
│   │       └── saude.e2e.spec.ts                   [N]
│   └── worker/
│       ├── package.json                            [N]
│       ├── tsconfig.json                           [N]
│       ├── src/
│       │   ├── main.ts                             [N]
│       │   ├── fila.ts                             [N]
│       │   └── tarefas/
│       │       └── eco.ts                          [N]
│       └── test/
│           └── eco.spec.ts                         [N]
├── packages/
│   └── shared/
│       ├── package.json                            [N]
│       ├── tsconfig.json                           [N]
│       ├── src/
│       │   ├── index.ts                            [N]
│       │   ├── erros.ts                            [N]
│       │   └── log.ts                              [N]
│       └── test/
│           ├── postgres-efemero.ts                 [N]
│           ├── redis-efemero.ts                    [N]
│           └── ambiente-efemero.spec.ts            [N]
└── deploy/
    ├── systemd/
    │   ├── sysloc-api.service                      [N]
    │   └── sysloc-worker.service                   [N]
    └── scripts/
        └── instalacao/
            ├── provisionar-base.sh                 [N]
            ├── instalar-unidades.sh                [N]
            ├── verificar-fundacao.sh               [N]
            └── apurar-versao-banco.sh              [N]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.2 Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `.mise.toml` | criar | Fixa a versão do runtime e das ferramentas de linha de comando |
| `package.json` | criar | Raiz do workspace; scripts `build`, `test`, `lint`, `dev` |
| `pnpm-workspace.yaml` | criar | Declara `apps/*` e `packages/*` |
| `turbo.json` | criar | Grafo de tarefas e cache de build entre pacotes |
| `biome.json` | criar | Formatação e lint únicos do repositório |
| `tsconfig.base.json` | criar | TypeScript estrito compartilhado; cada pacote estende |
| `vitest.config.ts` | criar | Configuração da verificação automatizada e do workspace de testes |
| `mprocs.yaml` | criar | Painéis do ciclo de desenvolvimento (aplicação, processador, capturador de e-mail) |
| `.env.example` | criar | Documenta as variáveis exigidas **sem valor real** — o arquivo com valores nunca é versionado |
| `.gitignore` | modificar | Acrescentar o diretório de dados efêmeros da verificação, se não coberto |
| `apps/api/package.json` | criar | Manifesto do serviço de aplicação |
| `apps/api/tsconfig.json` | criar | Estende o base |
| `apps/api/src/main.ts` | criar | Ponto de entrada; adaptador HTTP, publicação do contrato, desligamento gracioso |
| `apps/api/src/app.module.ts` | criar | Composição raiz do serviço |
| `apps/api/src/configuracao/ambiente.ts` | criar | Leitura e validação das variáveis de ambiente; falha na partida se faltar alguma |
| `apps/api/src/saude/saude.controller.ts` | criar | Expõe as duas verificações de saúde (§3.3) |
| `apps/api/src/saude/saude.service.ts` | criar | Consulta banco e fila para a verificação profunda |
| `apps/api/src/saude/saude.module.ts` | criar | Wiring do módulo de saúde |
| `apps/api/src/comum/filtro-excecao.ts` | criar | Tratamento global de erro no formato da ADR-0007 |
| `apps/api/test/saude.e2e.spec.ts` | criar | Verifica as duas rotas de saúde e o formato de erro |
| `apps/worker/package.json` | criar | Manifesto do processador |
| `apps/worker/tsconfig.json` | criar | Estende o base |
| `apps/worker/src/main.ts` | criar | Ponto de entrada; conecta à fila e registra os processadores |
| `apps/worker/src/fila.ts` | criar | Conexão e configuração da fila; nomes e opções de repetição |
| `apps/worker/src/tarefas/eco.ts` | criar | Tarefa trivial de ida e volta que serve de prova |
| `apps/worker/test/eco.spec.ts` | criar | Enfileira e verifica que a tarefa foi consumida e concluída |
| `packages/shared/package.json` | criar | Manifesto do pacote compartilhado |
| `packages/shared/tsconfig.json` | criar | Estende o base |
| `packages/shared/src/index.ts` | criar | Superfície pública do pacote |
| `packages/shared/src/erros.ts` | criar | Tipo do corpo de erro e enum de códigos, conforme ADR-0007 |
| `packages/shared/src/log.ts` | criar | Registro estruturado de eventos, com correlação por requisição |
| `packages/shared/test/postgres-efemero.ts` | criar | Sobe e derruba instância efêmera de banco para a verificação |
| `packages/shared/test/redis-efemero.ts` | criar | Sobe e derruba instância efêmera de fila para a verificação (§3.6) |
| `packages/shared/test/ambiente-efemero.spec.ts` | criar | Prova que as duas instâncias efêmeras sobem, respondem e são descartadas |
| `deploy/systemd/sysloc-api.service` | criar | Unidade do serviço de aplicação: reinício sempre, dependências declaradas, segredos por arquivo externo |
| `deploy/systemd/sysloc-worker.service` | criar | Unidade do processador, mesmas propriedades |
| `deploy/scripts/instalacao/provisionar-base.sh` | criar | Instala e configura os serviços de base; idempotente |
| `deploy/scripts/instalacao/instalar-unidades.sh` | criar | Posiciona e habilita as unidades; idempotente |
| `deploy/scripts/instalacao/verificar-fundacao.sh` | criar | Executa a bateria de aceitação da §4 e devolve código de saída |
| `deploy/scripts/instalacao/apurar-versao-banco.sh` | criar | Apura a versão do banco na verificação e a que atende a operação; grava o registro exigido pela INTENT §4.8 |

> **Legenda de Ações:** `criar` | `modificar` | `remover`

### 3.3 Endpoints / Rotas

| Método | Rota | Descrição | Auth | Status Codes |
|--------|------|-----------|------|--------------|
| GET | `/saude` | **Rasa** — o processo está vivo e respondendo. Não toca banco nem fila. Consumida pelo supervisor do sistema operacional | Nenhuma | `200` |
| GET | `/saude/pronto` | **Profunda** — banco e fila alcançáveis. Usada na prova de aceitação do reinício. Devolve o estado de cada dependência | Nenhuma | `200`, `503` |
| GET | `/docs` | Descrição do contrato da aplicação, publicada e navegável. Ainda sem operação de negócio | Nenhuma | `200` |

**Decisão de nomenclatura de rota**: as rotas nascem em português, coerentes com o contrato que a ADR-0007 fixou (o corpo de erro usa `codigo`/`mensagem` e o enum em português). Adotar `/health` aqui e `/contratos`, `/cobrancas` adiante produziria um contrato bilíngue sem ganho.

**Separação rasa × profunda**: a rasa é o que o supervisor do sistema operacional consulta para decidir reinício — se ela consultasse o banco, uma oscilação do banco derrubaria a aplicação em cascata. A profunda existe porque o critério de aceitação do reinício exige provar que **as dependências subiram**, não apenas que o processo responde.

#### 3.3.1 Exemplo de Payload por Endpoint

N/A — sem payload parcial. Esta fatia não expõe nenhum verbo `POST`, `PUT` ou `PATCH`; as três rotas são de leitura e sem corpo de requisição.

### 3.4 Banco de Dados

#### Tabelas

| Tabela | Colunas | Tipos | Constraints | Índices |
|--------|---------|-------|-------------|---------|
| — | — | — | — | — |

**N/A — nenhuma tabela nesta fatia.** A INTENT exclui explicitamente estrutura de dados de domínio, e a fundação de isolamento entre empresas (que define como toda tabela de negócio nasce) é a fatia seguinte. Criar tabela aqui a faria nascer antes das regras de isolamento — exatamente o retrofit que o programa se propôs a evitar.

#### Migrações

| Versão | Arquivo | Descrição |
|--------|---------|-----------|
| — | — | — |

**N/A — nenhuma migração nesta fatia.** A ferramenta de migração e o pacote que a hospeda (`packages/db`) nascem na fatia seguinte, junto da primeira estrutura que precisa deles. A verificação desta fatia prova que o banco sobe e aceita conexão, não que tem esquema.

### 3.5 Services / Regras de Negócio

**N/A — nenhuma regra de negócio nesta fatia**, por exclusão explícita da INTENT. Os únicos componentes com lógica são infraestruturais:

- [ ] Leitura e validação das variáveis de ambiente na partida — o processo falha ruidosamente se faltar configuração, em vez de subir e quebrar no primeiro uso.
- [ ] Verificação profunda de saúde — consulta banco e fila e agrega o resultado.
- [ ] Tarefa trivial de ida e volta — recebe um valor, devolve o mesmo valor, registra a conclusão. Existe para provar que o caminho fila → processador funciona de ponta a ponta.
- [ ] Tratamento global de erro — traduz exceção em corpo no formato da ADR-0007.

### 3.6 Integrações Externas (clientes / eventos)

| Integração | Tipo | Direção | Auth |
|------------|------|---------|------|
| Servidor de fila com persistência em disco | Fila | Ambos (aplicação enfileira, processador consome) | Local, sem rede externa |
| Banco de dados relacional | Conexão direta | Consumir | Local, via socket; credencial em arquivo de ambiente fora do repositório |
| Capturador de e-mail de desenvolvimento | SMTP | Expor (recebe) | Nenhuma — só em desenvolvimento, sem exposição externa |

**Instâncias efêmeras na verificação (ADR-0006).** A suíte **não** usa as instâncias provisionadas que atendem (ou virão a atender) a operação. Sobe as suas próprias, com diretório de dados temporário e porta dinâmica, e as descarta ao fim:

- **Banco**: instância efêmera por execução, com o binário empacotado pela dependência de teste.
- **Fila**: instância efêmera por execução, iniciada a partir do binário já provisionado no sistema, com diretório e porta próprios. Optou-se por reaproveitar o binário instalado em vez de acrescentar uma dependência de teste equivalente à do banco, porque o binário já existe por força do provisionamento e a dependência extra traria mais superfície do que resolve.

Isso mantém a ADR-0006 válida **sem exceção e sem depender de disciplina**: depois da virada, quando as instâncias provisionadas passarem a atender a operação, a suíte continua isolada sem precisar de nenhuma mudança — que é precisamente a alternativa que a ADR rejeitou ("fixar o ambiente novo como o de verificação... faria a regra se autodestruir").

### 3.7 Logs / Observabilidade (resumo)

- **Logs estruturados**: registro em formato estruturado, com nível configurável por ambiente e identificador de correlação por requisição. Nenhum segredo, credencial ou identificador de pessoa entra no registro.
- **Métricas chave**: N/A nesta fatia — não há operação de negócio a medir. O que se observa aqui é binário: os serviços estão de pé ou não, e isso é respondido pelas rotas de saúde e pelo supervisor do sistema operacional.
- **Tracing**: fora do escopo (§2). A instrumentação distribuída entra quando houver fluxo com mais de um salto que valha correlacionar.
- **Alertas**: N/A nesta fatia — o mecanismo de alerta (rotina atrasada, falha de envio) é da fatia `automacoes-agendadas`. Aqui, o reinício automático pelo supervisor é a única resposta a falha.

### 3.8 Feature Flags

| Flag | Propósito | Default |
|------|-----------|---------|
| — | — | — |

**N/A — nenhuma bandeira de funcionalidade nesta fatia.** Não há comportamento de negócio a ativar ou desativar; a única variação é entre ambiente de desenvolvimento e de operação, resolvida por variável de ambiente e não por bandeira.

### 3.9 Versionamento de API

- **Estratégia**: **decisão diferida** — ver justificativa abaixo.
- **Versão atual**: não aplicável nesta fatia.
- **Política de breaking changes**: não aplicável nesta fatia.

**Por que diferir.** A ADR-0007 fixou a *forma* do contrato (chave exposta, corpo em camelCase, `status` no servidor, envelope de erro, paginação), mas deliberadamente não fixou versionamento. Decidir a estratégia agora, sobre três rotas de infraestrutura que nenhum cliente consome, seria escolher sem informação: as três rotas desta fatia não fazem parte do contrato de negócio e não seriam versionadas de qualquer forma. A decisão pertence à fatia que publicar o primeiro recurso de negócio (`dominio-locacao`), quando houver consumidor real e o custo de errar for visível. Registrado aqui para não passar por esquecimento.

### 3.10 Dependências de Pacotes

| Pacote | Versão | Motivo |
|--------|--------|--------|
| Runtime da aplicação | 24 LTS | Fixado em `decisao-e-stack.md` §4 |
| Framework do serviço de aplicação + adaptador HTTP | corrente | Composição raiz, injeção de dependência e publicação do contrato |
| Biblioteca de fila + cliente do servidor de fila | corrente | Enfileiramento e consumo com persistência |
| Validação de esquema | corrente | Validação das variáveis de ambiente na partida |
| Registro estruturado de eventos | corrente | §3.7 |
| Arcabouço de verificação | corrente | Execução da suíte |
| Banco efêmero para verificação | corrente | Instância descartável por execução (§3.6) |
| Gerenciador de pacotes por workspace, orquestrador de build, formatador/linter, empacotador, executor de TypeScript, gerenciador de versões de ferramenta, multiplexador de processos | corrente | Ferramental fixado em `decisao-e-stack.md` §4 |

> As versões concretas de cada pacote são resolvidas na execução e travadas pelo arquivo de bloqueio do gerenciador. A composição — quais pacotes — está fixada em `decisao-e-stack.md` §4 e não se rediscute aqui (INTENT §5).

---

## 4. Critérios de Aceite (técnicos)

- [ ] **CA-1** — A partir do repositório limpo, a sequência documentada de instalação e construção termina sem erro e sem passo manual não previsto.
- [ ] **CA-2** — `GET /saude` responde `200` sem consultar banco nem fila.
- [ ] **CA-3** — `GET /saude/pronto` responde `200` com o estado de cada dependência quando ambas estão alcançáveis, e `503` quando qualquer uma não está.
- [ ] **CA-4** — A descrição do contrato está publicada e navegável.
- [ ] **CA-5** — Uma tarefa enfileirada é consumida pelo processador e concluída, com registro do término.
- [ ] **CA-6** — A verificação automatizada passa, subindo instância efêmera **própria** de banco **e** de fila, e nenhuma das duas é a instância provisionada que atende a operação (ADR-0006).
- [ ] **CA-7** — As instâncias efêmeras são descartadas ao fim da execução, sem deixar diretório de dados nem processo órfão.
- [ ] **CA-8** — Encerrar o processo do serviço de aplicação faz o supervisor do sistema operacional trazê-lo de volta sem intervenção.
- [ ] **CA-9** — Após reinício completo do servidor, o serviço de aplicação e o processador voltam sozinhos, **e o ambiente que atende a operação também volta sozinho**. Nenhuma intervenção manual em nenhum dos dois.
- [ ] **CA-10** — Tarefa enfileirada antes de uma parada do servidor de fila continua presente após ele voltar.
- [ ] **CA-11** — Os dois scripts de instalação executados duas vezes seguidas não duplicam entrada, não sobrescrevem configuração já correta e terminam com sucesso (idempotência — ADR-0005).
- [ ] **CA-12** — Nenhum script versionado carrega credencial; os segredos vivem em arquivo de ambiente com permissão restrita, fora do repositório (ADR-0005, condição de entrada).
- [ ] **CA-13** — Um erro provocado devolve corpo no formato da ADR-0007 (`codigo`, `mensagem`, `campo` opcional, `detalhes` opcional) com status HTTP semântico — não o formato padrão do framework.
- [ ] **CA-14** — A divergência de versão entre o banco da verificação e o que atende a operação está apurada e **registrada em arquivo versionado**, antes de qualquer definição de estrutura de dados (INTENT §4.8).
- [ ] **CA-15** — O processo falha na partida, com mensagem que nomeia a variável ausente, quando falta configuração obrigatória.
- [ ] **CA-16** — Nenhuma alteração no ambiente que atende a operação, exceto a janela de indisponibilidade combinada do reinício.

---

## 5. Observações

### ADRs Aplicáveis nesta Feature

- ADR-0005 — rotinas operacionais versionadas no repositório com instalação idempotente
- ADR-0006 — ambiente de verificação separado do ambiente que atende a operação
- ADR-0007 — forma canônica do contrato da API do backend novo

### Conformidade literal confrontada

**ADR-0005 (APLICÁVEL na parte de instalação; a parte de agendamento só se materializa em `automacoes-agendadas`).** A `Decision` exige que *"toda rotina operacional agendada — a definição de agendamento e os scripts que ela invoca — vive no repositório e é posicionada no sistema por um procedimento de instalação idempotente. Nenhum script executável de produção permanece fora de controle de versão, e nenhum entra no repositório carregando credencial: extrair o segredo para configuração não versionada é condição de entrada"*. Confronto: as unidades de serviço e os quatro scripts de instalação nascem versionados em `deploy/` (§3.2); os dois instaladores são idempotentes (CA-11); nenhum carrega credencial, que vive em arquivo de ambiente com permissão restrita fora do repositório (CA-12). **Sem divergência.** Nenhum disparador temporal é instalado aqui — a parte "agendada" da ADR fica sem objeto nesta fatia, e isso está declarado em §2.

**ADR-0006 (APLICÁVEL, e é a decisão que mais moldou este SCOPE).** A `Decision` exige que *"a suíte de verificação nunca executa contra o ambiente que atende a operação. Qual ambiente concreto cumpre o papel de verificação varia ao longo do tempo — o invariante é a separação, não um servidor específico"*. Confronto: a suíte sobe instâncias efêmeras próprias de banco **e** de fila (§3.6), com diretório e porta próprios, descartadas ao fim (CA-6, CA-7). O servidor é fisicamente o mesmo, mas o *ambiente* de verificação é separado — que é o invariante que a ADR fixa. **Sem divergência.** A ADR rejeitou explicitamente *"fixar o ambiente novo como o de verificação"* porque *"esse ambiente passa a atender a operação após a virada, o que faria a regra se autodestruir"*: a escolha por instâncias efêmeras é justamente o que impede essa autodestruição — depois da virada nada muda na suíte.

**ADR-0007 (PARCIAL).** A `Decision` fixa cinco regras de forma. Confronto item a item nesta fatia: o **envelope de erro** (`codigo`, `mensagem`, `campo?`, `detalhes?` com status HTTP semântico) é aplicável e nasce conforme em `filtro-excecao.ts` e `packages/shared/src/erros.ts` (CA-13) — é transversal e barato agora, caro depois. O **corpo em camelCase** é aplicável às respostas de saúde. As outras três regras — chave textual legível, `status` calculado no servidor e forma de paginação — **não têm objeto nesta fatia**, porque não há recurso de negócio; passam a valer em `dominio-locacao`.

**ADR-0001, ADR-0002, ADR-0003, ADR-0004 — N/A.** A 0001 trata de cobrança bancária, que esta fatia não toca. A 0002 exige que estrutura de dados nova nasça descrita em arquivo — sem objeto aqui, porque §2 exclui qualquer estrutura de domínio; volta a valer na fatia seguinte. A 0003 e a 0004 são específicas do arcabouço legado (permissão por metadado e nomes curtos de endpoints herdados) e não têm equivalente no backend novo.

### Candidatos a ADR

**Candidato a ADR confirmado (5/5) — "Provisionamento de serviço de base é versionado e idempotente"**
Tags: `build`, `architecture`.
- **C1 transversal** — vale para todo serviço de base que o programa vier a provisionar, não só os três desta fatia.
- **C2 tag-alvo** — `build` e `architecture`.
- **C3 custo de reversão alto** — abandonar exige refazer a instalação à mão em todo ambiente e perder a reconstrutibilidade que a ADR-0006 pressupõe.
- **C4 surpreendente sem contexto** — um leitor futuro pergunta por que não se instalou pelo gerenciador de pacotes do sistema e pronto.
- **C5 trade-off real** — foram consideradas e rejeitadas duas alternativas: versionar só as unidades da aplicação (perde reconstrutibilidade) e documentar sem automatizar (contraria a ADR-0005 na letra).

Observação: esta decisão **estende** a ADR-0005, que hoje fala apenas de *rotina agendada*. Se o usuário quiser registrá-la, cabe avaliar se é ADR nova ou substituição da 0005 com escopo ampliado — decisão da `/agent-spec-adr-create` ou `/agent-spec-adr-supersede`, não deste SCOPE.

**Candidato a ADR parcial (4/5) — "Verificação usa instâncias efêmeras próprias de todo serviço com estado"**
Tags: `testing`.
- Passam C1, C2, C3 e C5 (alternativas rejeitadas: espaço lógico dedicado na instância instalada; substituto em memória).
- **Falha C4** — o *porquê* já está registrado na ADR-0006; o leitor futuro que perguntar "por que efêmero?" encontra a resposta lá. Isto é aplicação concreta de uma decisão existente, não decisão nova.

**Candidato a ADR parcial (3/5) — "Saúde rasa e profunda em rotas separadas"**
Tags: `observability`.
- Passam C1, C2 e C5.
- **Falha C3** — reverter é local e barato.
- **Falha C4 parcialmente** — o padrão é suficientemente comum para não surpreender. Registrado como decisão técnica em §3.3, sem promover a ADR.

### Pontos de atenção

- **A prova central desta fatia (CA-9) exige janela de indisponibilidade combinada.** Não é passo automatizável nem repetível à vontade: reinicia o servidor que atende a operação hoje. Precisa ser agendado com quem usa o sistema, e a execução da fatia deve deixar todo o resto pronto **antes** de consumir a janela.
- **O disco opera acima de 75%.** O provisionamento acrescenta serviços ao lado do ambiente legado. `provisionar-base.sh` deve medir o espaço antes e falhar com mensagem clara se não couber, em vez de deixar o sistema pela metade.
- **CA-14 é pré-requisito da fatia seguinte, não desta.** A apuração da versão do banco precisa estar feita e registrada antes de alguém escrever a primeira migração — por isso é critério de saída daqui, mesmo sem consumidor imediato.
- **A tarefa trivial de ida e volta não é código descartável.** Ela é a única prova de que o caminho fila → processador funciona, e continua sendo executada pela suíte depois que houver tarefas reais. Não deve ser removida quando a primeira tarefa de negócio nascer.
- **`deploy/nginx/` permanece vazio nesta fatia** — está no layout-alvo, mas a publicação externa é da fatia de virada.
- **Nenhum termo de domínio novo.** O glossário global (`Boleto em aberto`, `Provedor`, `Contador sequencial`) não tem interseção com esta fatia, que é puramente infraestrutural. Não há terminologia a canonizar e não se recomenda rodar o stress-test de spec por esse motivo.

### Restrições técnicas herdadas da INTENT

- A composição da base está fixada em `decisao-e-stack.md` §4 e não se rediscute.
- Instalação nativa no sistema operacional, sem camada de conteinerização; serviços gerenciados pelo próprio sistema operacional com reinício automático.
- Nada sobe manualmente — recuperação automática após queda e após reinício é requisito.
- O servidor é compartilhado com o ambiente que atende a operação, e nada nesta fatia pode degradá-lo.
- O servidor de fila persiste em disco: perder seu conteúdo significa trabalho não executado, não cache frio.
