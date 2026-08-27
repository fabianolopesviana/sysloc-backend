# SCOPE -- MiniSpec (Backend)

> **Variante**: backend
> **Stack**: Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + postgres.js · PostgreSQL 18 · Vitest + embedded-postgres · Bash + systemd + nginx

> ⚠️ **Autonomia do run (§A1).** Onde esta skill manda `AskUserQuestion`, a decisão foi formulada,
> recomendada e adotada, com registro no ponto. Aplica-se à variante (FASE 0.0) e ao **conflito
> spec×ADR da §5.2**, que a FASE 0.2.0 manda escalar — a escalada aconteceu, a espera não.

---

## 1. O que está incluído

- [x] **Cópia de segurança diária do banco de dados**, com retenção **por idade**, verificação de integridade do arquivo produzido e disparo por relógio do sistema operacional na janela já fixada pelo plano.
- [x] **Preservação dos segredos de operação**, em pacote **separado** do dump — a separação é exigência literal da ADR-0032 (§5.2).
- [x] **Restauração provada em base vazia**, executada por procedimento próprio com confirmação explícita, e **conferida**, não presumida.
- [x] **Verificador de shell do backup e da restauração** (`verificar-backup.sh`), que **fecha o `D9 · F0/T2`** — o gatilho dele é literalmente "a próxima fatia que escrever um `verificar-*.sh`".
- [x] **Religação da borda pública do Sysloc**: `location /v1/` **antes** do fallback da aplicação, com o gabarito versionado na árvore e instalação idempotente, espelhando a borda do Painel Master já provada em produção.
- [x] **Fecho do `D23 · F1/T8` na aplicação** — variável de ambiente própria para a **lista de origens públicas**, validada na partida, alimentando a origem confiável; e **remoção do paliativo de tradução de origem** hoje instalado na borda do Master (§5.3).
- [x] **Fecho do `D27 · F1/T6`** — declaração do salto confiável, de modo que o eixo de origem passe a existir e a política de limitação deixe de ser um balde único por caminho para o produto inteiro.
- [x] **Fecho do `D24 · F1/T5`** — restrição da página e do documento do contrato, reconferida **contra medição** antes de virar trabalho.
- [x] **Aplicação da ADR-0037 ao vhost da notícia bancária** (`D27 · F4/T11`) — proteção por tamanho de corpo e concorrência, **sem teto de taxa por origem**.
- [x] **Instalação do roster completo de unidades** — as **6 Rotinas agendadas** hoje ausentes do servidor, e a reconciliação da unidade do processador de trabalho, que no host não declara dependência do banco de dados.
- [x] **Asserção do destino do e-mail** no verificador de borda — hoje nenhum caso, em 1943, afirma para onde o **Aviso** sai, e o ambiente medido aponta para um capturador de desenvolvimento (§5.9).
- [x] **Duas janelas assistidas** como moldura: linha de base no início (P1) e comparação caso a caso no fim (P5), com as **11 baterias** executadas nos dois extremos.

---

## 2. O que está fora do escopo

- [ ] **Publicar o pacote de contratos** que a aplicação do cliente consome — item próprio do marco de entrega, e sem gate de QA a morder.
- [ ] **Prova do percurso do primeiro dia**, `virada.md` e adendos aos documentos de repasse — intervenção dirigida.
- [ ] **Execução da virada e desinstalação do sistema antigo** — sessão operacional futura; o sistema antigo permanece intacto e de pé.
- [ ] **Qualquer código da aplicação do cliente** — gatilho de parada.
- [ ] **Alterar, acrescentar ou remover qualquer rota.** A superfície está congelada; as âncoras `106 / 91 / 20` saem intactas.
- [ ] **Trazer a borda do Painel Master para a árvore versionada** como entrega própria — a fatia só a toca no ponto exato do paliativo que o fecho do `D23` obriga a remover (§5.3).
- [ ] **Retirar o caminho antigo de consulta ao sistema legado** (`sysloc-react-1`) — decisão de topologia ainda não tomada (`[DÚVIDA 4]` do discovery).
- [ ] **Fechar a credencial legível no material público da porta 8300** — consequência do item acima, não decisão desta fatia.
- [ ] **Preservação do dump final da base antiga** — pré-requisito da virada, não da religação, ainda que o mecanismo seja o mesmo.
- [ ] **Limiar de obsolescência de conferência bancária, expurgo de rotina, e demais débitos sem gatilho nesta fatia.**

---

## 3. Definições Técnicas

### 3.1 Visão em Árvore

```
deploy/
├── scripts/
│   └── backup/
│       ├── copiar-base.sh                              [N]
│       ├── preservar-segredos.sh                   [N]
│       ├── restaurar-base.sh                       [N]
│       └── verificar-backup.sh                     [N]
├── nginx/
│   ├── sysloc-app.conf                             [N]
│   └── sysloc-notificacao-bancaria.conf            [M]
├── scripts/
│   ├── borda/
│   │   ├── instalar-borda-do-app.sh                [N]
│   │   ├── instalar-borda-de-notificacao.sh        [R]
│   │   └── verificar-borda-do-app.sh               [N]
│   ├── instalacao/
│   │   └── instalar-unidades.sh                    [M]
│   └── verificacao/
│       └── rodar-baterias.sh                       [R]
└── systemd/
    ├── sysloc-backup-da-base.service               [N]
    ├── sysloc-backup-da-base.timer                 [N]
    └── sysloc-worker.service                       [R]

apps/api/
├── src/
│   ├── configuracao/ambiente.ts                    [M]
│   ├── autenticacao/autenticacao.module.ts         [M]
│   └── main.ts                                     [M]
└── test/
    ├── ambiente.spec.ts                            [M]
    ├── origem-publica.e2e.spec.ts                  [N]
    └── cobertura-de-autorizacao.e2e.spec.ts        [R]

packages/auth/
├── src/autenticacao.ts                             [M]
└── test/bloqueio.spec.ts                           [M]

CLAUDE.md                                           [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.2 Arquivos Envolvidos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `deploy/scripts/backup/copiar-base.sh` | criar | Produz a cópia do banco em formato próprio para restauração seletiva; confere a integridade do arquivo produzido; expurga por **idade**, nunca por contagem nem por nome. |
| `deploy/scripts/backup/preservar-segredos.sh` | criar | Empacota os segredos de operação. **Não inclui a chave de cifra do segredo operável** — separação exigida pela ADR-0032 (§5.2). |
| `deploy/scripts/backup/restaurar-base.sh` | criar | Restaura numa base **vazia**, com listagem prévia do conteúdo, ensaio sem efeito e confirmação explícita antes de escrever. |
| `deploy/scripts/backup/verificar-backup.sh` | criar | Bateria de shell: existência e frescor da cópia do dia, integridade do arquivo, expurgo por idade (com órfãos de idades opostas), separação dos dois pacotes, e a **restauração de fato executada** em base efêmera. Fecha o `D9 · F0/T2`. |
| `deploy/systemd/sysloc-backup-da-base.service` | criar | Unidade de execução da cópia, sem escuta de porta, com ambiente por referência. |
| `deploy/systemd/sysloc-backup-da-base.timer` | criar | Relógio da janela noturna já fixada, com `Persistent=true` (invariante 7). |
| `deploy/scripts/instalacao/instalar-unidades.sh` | modificar | Acrescenta as duas unidades novas ao roster declarado (`UNIDADES`) e o timer ao subconjunto do arranque (`UNIDADES_DO_ARRANQUE`). A cobertura nos dois sentidos já é afirmada pelo `CT-1060`, que passa a exigi-las. |
| `deploy/nginx/sysloc-app.conf` | criar | Gabarito da borda pública do Sysloc, com marcadores substituíveis, no molde de `sysloc-notificacao-bancaria.conf`. `location /v1/` **antes** do fallback; salto real declarado; `Set-Cookie` intacto; `no-store` na sessão; fonte da aplicação não publicada. **Sem tradução de origem** — ela deixa de ser necessária com o `D23` fechado. |
| `deploy/scripts/borda/instalar-borda-do-app.sh` | criar | Instalação idempotente do gabarito acima, recusando marcador não substituído — mesmo contrato de `instalar-borda-de-notificacao.sh`. |
| `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` | criar | Bateria do **estado do host**: roster instalado × declarado nos dois sentidos, relógios habilitados, despachos **não** habilitados, dependência do banco, destino do e-mail. Consome o esqueleto compartilhado do fecho do `D9`. |
| `deploy/scripts/borda/verificar-borda-do-app.sh` | criar | Prova a borda **sem depender do TLS público**: distingue "o salto da frente não está pronto" de "a borda está quebrada". Afirma **tipo do conteúdo**, não apenas código de resposta. |
| `deploy/nginx/sysloc-notificacao-bancaria.conf` | modificar | Aplica a ADR-0037 à entrada de fato de terceiro: teto de corpo e de concorrência, **sem** teto de taxa por origem. Fecha o `D27 · F4/T11` e remove o marcador. |
| `apps/api/src/configuracao/ambiente.ts` | modificar | Declara a variável da **lista de origens públicas** (plural — ver §5.7), conferida na partida como as demais. |
| `apps/api/src/autenticacao/autenticacao.module.ts` | modificar | A origem confiável passa a vir da **lista** de origens públicas declaradas, não do endereço de escuta. Fecha o `D23 · F1/T8` e remove o marcador. |
| `apps/api/src/main.ts` | modificar | **Somente para remover o marcador do `D24 · F1/T5` e registrar a decisão.** A restrição em si é **na borda**, nunca aqui — ver §5.8: retirar `/docs*` do registro da aplicação derrubaria a âncora de superfície e quebraria a bateria `verificar-fundacao.sh`. |
| `packages/auth/src/autenticacao.ts` | modificar | Declara o salto confiável, de modo que o eixo de origem exista. Fecha o `D27 · F1/T6` e remove o marcador. **Não toca o código sob as duas `DECISÃO FECHADA` do arquivo** — o marcador de débito declara literalmente que não as alcança. |
| `packages/auth/test/bloqueio.spec.ts` | modificar | O `CT-236 (c)` hoje **fixa por asserção** o estado compartilhado (`no-trusted-ip|<caminho>`). Passa a fixar o estado com eixo. É alteração de teste com `SUT_IS_CORRECT_BECAUSE:` obrigatório — o teste estava certo para o regime antigo. |
| `apps/api/test/ambiente.spec.ts` | modificar | Elenco de variáveis conferidas na partida cresce com a origem pública. |
| `apps/api/test/origem-publica.e2e.spec.ts` | criar | Prova que a origem pública é aceita e que origem estranha continua recusada — o discriminador que separa o fecho do `D23` de um afrouxamento da conferência. |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | referência | **Não se altera.** As três constantes executáveis saem intactas — é a prova de que a superfície não se moveu. |
| `deploy/scripts/verificacao/rodar-baterias.sh` | referência | Agregador existente; passa a descobrir as duas baterias novas por `find`, sem alteração. |
| `CLAUDE.md` | modificar | Índice de débitos: saem as linhas dos débitos fechados; entram as que a fatia registrar. Estado atual: contagens e superfície. |

### 3.3 Endpoints / Rotas

**N/A — a superfície da API está congelada.** Nenhuma rota nasce, muda ou sai nesta fatia; é o item 2
do marco de entrega e pré-condição do repasse já publicado. O que muda é **quem alcança** a superfície
(a borda) e **sob que proteção** (ADR-0037) — nunca a superfície em si.

A prova disso é executável e **não se altera**: as constantes `ROTAS_PUBLICADAS_EM_PRODUCAO`,
`MANIPULADORES_EXAMINADOS_EM_PRODUCAO` e `PARES_PUBLICOS_DA_SUPERFICIE` de
`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` permanecem em **106 / 91 / 20**.

#### 3.3.1 Exemplo de Payload por Endpoint

**N/A — nenhum verbo de escrita é criado ou alterado.**

### 3.4 Banco de Dados

#### Tabelas

**N/A — nenhuma tabela nasce, muda ou sai.** A fatia **preserva** e **restaura** o banco; não altera o
esquema dele.

#### Migrações

**N/A — nenhuma migração autoral.** ⚠️ Consequência a declarar: o `D5 · F5/T3` é **recorrente** e o
gatilho dele (*"a próxima migração autoral… ou regeração do zero"*) **não dispara aqui**.

#### ⚠️ O que a cópia do banco NÃO carrega — e por que isso decide o desenho da prova

Medido no repositório: os papéis `sysloc_app` (aplicação) e `sysloc_migracao` são criados pelo
**provisionamento** (`provisionar-base.sh`), e as concessões que o esquema depende deles são
declaradas nas migrações (`GRANT … TO "sysloc_app"`, `0001_seguranca.sql` e seguintes). **Papel é
objeto do agrupamento de bases, não da base** — de modo que uma cópia de uma base **não o carrega**.

Consequência direta para o critério de aceite: a restauração é provada **numa base vazia do mesmo
agrupamento**, onde os papéis já existem. Provar contra um agrupamento novo exigiria preservar
também os papéis, e isso **não está no desenho travado pelo plano** — fica declarado aqui como
limite conhecido, não como omissão.

### 3.5 Services / Regras de Negócio

**Nenhuma regra de negócio nasce ou muda nesta fatia** — é infraestrutura. As regras abaixo são
operacionais:

- [ ] **A cópia decide o que expira por idade, nunca por nome nem por contagem.** Herdado do molde já provado do expurgo de material bancário (`CT-1087 (f)`), cuja razão registrada é exatamente esta: filtro por nome deixa órfão acumulando e a suíte verde.
- [ ] **A prova é a restauração.** A existência do arquivo, a integridade dele e a listagem do conteúdo são condições necessárias e **nenhuma delas é a prova**.
- [ ] **A ordem entre as metades é imposta pelo plano de tasks**: preservação **antes** de publicação. A sequência inversa é a única irreversível da fatia.
- [ ] **A conferência de origem não é afrouxada** — ela passa a comparar com a origem pública declarada. Origem estranha continua recusada, e é isso que o caso novo discrimina.
- [ ] **A entrada de fato de terceiro não ganha teto de taxa** (ADR-0037) — a proteção dela é corpo, concorrência e o descarte sem consulta ao terceiro.
- [ ] **Cada Rotina agendada instalada é habilitada pelo relógio, nunca pela unidade de execução** — regra já declarada no instalador (T9 · `automacoes-agendadas`).

### 3.6 Integrações Externas (clientes / eventos)

| Integração | Tipo | Direção | Auth |
|------------|------|---------|------|
| Salto de borda à frente (termina o TLS) | HTTP | consumir (recebe) | nenhuma — o salto é confiável **por declaração**, e é isso que o `D27 · F1/T6` fecha |
| Entrada de fato de terceiro (**Notícia do provedor**) | HTTP | expor | sem sessão, por critério da ADR-0035 — inalterada por esta fatia |
| Agrupamento de bases de dados (cópia e restauração) | processo local | ambos | por arquivo de credencial de modo restrito, fora da árvore versionada |

⚠️ **Nenhuma integração nova.** A fatia não fala com nenhum terceiro que o produto já não alcance.

### 3.7 Logs / Observabilidade (resumo)

- **Logs estruturados**: as unidades novas escrevem no diário do sistema, como as existentes. Nenhum segredo é registrado — a redação já instalada em `packages/shared/src/log.ts` continua valendo e **não é tocada** (o `D23 · F0/T3` está bloqueado por protocolo, não por tempo).
- **Métricas chave**: idade da cópia mais recente; resultado da última restauração provada; próxima execução de cada Rotina agendada.
- **Tracing**: N/A — não há tracing distribuído no projeto (a stack medida não inclui a ferramenta que o plano previa).
- **Alertas**: a unidade de alerta de rotina já existe (`sysloc-alerta-de-rotina@.service`) e entra no roster instalado; a fatia **não cria mecanismo de alerta novo**.

### 3.8 Feature Flags

**N/A — o projeto não usa feature flags**, e introduzi-las aqui seria funcionalidade não mencionada na
INTENT.

### 3.9 Versionamento de API

- **Estratégia**: prefixo no caminho (`/v1`), já vigente.
- **Versão atual**: v1.
- **Política de breaking changes**: **nenhuma mudança de contrato nesta fatia** — a superfície está congelada e o repasse ao frontend já foi publicado contra ela.

### 3.10 Dependências de Pacotes

| Pacote | Versão | Motivo |
|--------|--------|--------|
| — | — | **Nenhuma dependência nova.** As ferramentas de cópia e restauração acompanham o servidor de banco de dados já instalado; o relógio é do sistema operacional; a borda é o servidor já em uso. |

---

## 4. Critérios de Aceite (técnicos)

- [ ] **CA-01** — Um pedido de dados ao endereço público do Sysloc devolve **dado**, e a asserção afirma o **tipo do conteúdo**, não apenas o código de resposta. *(o modo de falhar medido hoje é `200` com o corpo errado — um teste de status aprovaria o defeito)*
- [ ] **CA-02** — A entrada pela borda funciona com a origem pública, e **origem estranha continua recusada**, sem tradução de origem em ponto algum do caminho.
- [ ] **CA-03** — Uma cópia do banco do dia é produzida sem intervenção, na janela fixada, e sobrevive a um reinício do servidor.
- [ ] **CA-04** — Cópias mais antigas que a idade declarada são expurgadas, e o expurgo decide **por idade**, provado com dois órfãos de idades opostas.
- [ ] **CA-05** — **Uma restauração foi executada numa base vazia e conferida** — não a listagem, não a integridade do arquivo: a restauração.
- [ ] **CA-06** — Os segredos de operação são preservados **em pacote separado** daquele que carrega o material cifrado, conforme a ADR-0032, e a separação é afirmada por medição do que cada pacote contém.
- [ ] **CA-07** — As **6 Rotinas agendadas** estão instaladas, habilitadas e com próxima execução conhecida; o roster instalado é **igual em conjunto** ao roster declarado, afirmado nos dois sentidos.
- [ ] **CA-08** — A unidade do processador de trabalho instalada declara dependência do banco de dados, e o conjunto sobe corretamente após reinício.
- [ ] **CA-09** — O eixo de origem existe: duas origens distintas consomem **baldes distintos** do limitador. *(prova que o regime deixou de ser um balde único por caminho para o produto inteiro)*
- [ ] **CA-10** — A entrada de fato de terceiro **não é recusada por taxa** sob rajada legítima, e continua protegida por corpo e concorrência (ADR-0037).
- [ ] **CA-11** — A página e o documento do contrato não são alcançáveis de fora, afirmado por medição contra a borda, não por leitura do código.
- [ ] **CA-12** — **Nada regrediu**: as três constantes de superfície permanecem em `106 / 91 / 20`, a suíte permanece verde com contagem **igual ou maior**, e as baterias foram **executadas** nos dois extremos — não declaradas executáveis. ⚠️ A contagem sai da **descoberta** (`find deploy/scripts -name 'verificar-*.sh'`), afirmada por igualdade de conjunto: eram **11**, a fatia acrescenta **três**, logo **14**.
- [ ] **CA-14** — O destino do e-mail é **afirmado por um caso**, e não herdado do provisionamento: a bateria falha se o produto passar a enviar por servidor diferente do declarado. *(hoje a configuração é silenciosa — §5.9)*
- [ ] **CA-13** — Todo marcador de débito fechado saiu do código **e** do índice do `CLAUDE.md`, conferido **nos dois sentidos** (marcador→registro e índice→marcador), como a §3-B do Protocolo Antirregressão manda no fecho de fatia.

---

## 5. Observações

### 5.1 ADRs Aplicáveis nesta Feature

Inventário sobre as **30 ADRs `accepted`** do índice (as 7 `deprecated`/`superseded` foram ignoradas).

| ADR | Classificação | Ponto do scope afetado |
|---|---|---|
| **ADR-0005** — Rotinas operacionais versionadas com instalação idempotente | **APLICÁVEL** | §3.2 inteira (backup e borda) |
| **ADR-0006** — Ambiente de verificação separado do que atende a operação | **APLICÁVEL** | `verificar-backup.sh` (§3.2), CA-05 |
| **ADR-0037** — Política de limitação de abuso na borda pública | **APLICÁVEL** | `sysloc-app.conf`, `sysloc-notificacao-bancaria.conf`, `packages/auth/src/autenticacao.ts`; CA-09, CA-10 |
| **ADR-0032** — Segredo operável cifrado, nunca retorna, provado por medição | **APLICÁVEL** | `preservar-segredos.sh`; CA-06 — **e é a fonte do conflito da §5.2** |
| **ADR-0035** — Critério para rota de entrada de fato de terceiro sem sessão | **PARCIAL** | só a proteção do vhost dela; o critério da rota não é tocado |
| **ADR-0011** / **ADR-0018** — Cobertura de autorização por rota | **PARCIAL** | só como **invariante a não regredir** (CA-12); nenhuma declaração de rota muda |
| **ADR-0017** — Forma canônica do contrato | **PARCIAL** | o estouro de teto sai como `429 REQUISICAO_RECUSADA`, forma já vigente |
| **ADR-0024** — Origem do contexto de tenant sem requisição | **PARCIAL** | as Rotinas agendadas instaladas dependem dela em execução; **nenhum código delas é tocado** |
| **ADR-0013** — Alcance da garantia do operador do SaaS | **PARCIAL** | a borda passa a servir os dois aplicativos; a garantia é da sessão e não muda |
| 0001, 0008, 0009, 0010, 0014, 0016, 0020, 0021, 0022, 0023, 0025, 0026, 0027, 0028, 0029, 0030, 0031, 0033, 0034, 0036 | **N/A** | nenhuma tabela, rota, contrato, série, derivação, fila ou adaptador é criada ou alterada |

**Conformidade literal** — confrontada contra o texto real da `Decision`, não contra a paráfrase do índice:

- **ADR-0005** manda que *"toda rotina operacional agendada — a definição de agendamento e os scripts que ela invoca — vive no repositório e é posicionada no sistema por um procedimento de instalação idempotente"*, e que *"nenhum script executável de produção permanece fora de controle de versão, e nenhum entra no repositório carregando credencial"*. O scope **conforma**: as duas unidades e os quatro scripts de backup nascem em `deploy/`, instalados por procedimento idempotente; a credencial do banco fica em arquivo de modo restrito **fora** da árvore.
  ⚠️ **Divergência medida, e ela é pré-existente, não introduzida**: `/opt/web/syslocadmin/verificar-borda.sh` é script executável de produção **fora de controle de versão**. A fatia **não o traz para o repositório** — seria entrega não mencionada na INTENT —, mas a divergência fica **declarada** aqui, com o gatilho no §5.4.
- **ADR-0006** manda que *"a suíte de verificação nunca executa contra o ambiente que atende a operação"*, sendo o invariante *"a separação, não um servidor específico"*. O scope **conforma**: a prova de restauração roda contra base **vazia e efêmera**, nunca contra a base durável — o que também é a razão de CA-05 não poder ser satisfeito restaurando "por cima".
- **ADR-0037** decide que *"a borda pública fornece o eixo de origem e não a política"*, que o teto é *"decidido na aplicação, por classe de rota"*, e **ausente por origem** na entrada de fato de terceiro. O scope **conforma** em três pontos: o salto é declarado na borda (§3.2, `sysloc-app.conf`), a política permanece na aplicação (`packages/auth/src/autenticacao.ts`), e o vhost da notícia **não ganha teto de taxa** (CA-10).

### 5.2 ⚠️ CONFLITO spec×ADR — resolvido por conformação (A1)

**O desenho travado do plano colide literalmente com a ADR-0032.**

- **O plano** (`plano-execucao.md` §F7, item 1) manda: *"`pg_dump -Fc` + tar dos segredos → `/opt/backups/sysloc/daily/`"* — os dois artefatos, mesmo destino.
- **A ADR-0032** manda, na `Decision` literal, que o segredo operável é *"guardado cifrado de forma reversível, com a chave vivendo fora da árvore versionada **e fora do mesmo pacote em que o material cifrado é salvaguardado**"*.

A cópia do banco **carrega o segredo operável cifrado** (ele é coluna do banco). O pacote de segredos
**carregaria a chave de cifra**. Preservar os dois lado a lado, no mesmo destino, **reúne chave e
material cifrado no mesmo pacote de salvaguarda** — exatamente o que a ADR proíbe, e o efeito é que a
cifra deixa de proteger qualquer coisa contra quem obtenha o backup.

**Duas saídas, conforme a FASE 0.2.0:** (a) conformar o scope à ADR; (b) superseder a ADR primeiro.

**Adotada: (a) — conformar o scope.** Razão: a ADR-0032 é recente, foi escrita com a cláusula da
salvaguarda **explícita** (não é interpretação extensiva), e o plano não decidiu o ponto — ele
enumerou artefatos, não decidiu coabitação. Conformar custa um destino separado; superseder desfaz
uma garantia por conveniência de arrumação. **A recomendada sob A1 é sempre a conservadora.**

**Consequência para o scope**: `preservar-segredos.sh` produz pacote **sem** a chave de cifra, e a
chave é preservada por caminho próprio, com destino distinto do dump. CA-06 afirma a separação **por
medição do conteúdo de cada pacote**, no molde que a própria ADR-0032 exige (*"por medição da saída
real, nunca por leitura do código"*).

### 5.3 ⚠️ Premissa do insumo REFUTADA por medição — o `D23` não está fechado, está mascarado

A §3 do insumo do pré-refinamento afirma que o `D23 · F1/T8` *"NÃO bloqueia a entrada — a premissa
dele envelheceu"*, concluindo de três medições que *"o proxy repassa o `Host` e a checagem resolve
same-origin dinamicamente"*.

**Isso é falso, e a causa está medida.** A borda do Painel Master (`/opt/web/syslocadmin/nginx/default.conf`)
carrega um bloco de **tradução de origem** — dois `map` mais dois cabeçalhos reescritos no bloco
`/v1/` — cujo próprio comentário diz, textualmente: *"ISTO É PALIATIVO DE BORDA"*, *"sem tradução, o
painel publicado NÃO FAZ LOGIN"*, e *"o fechamento correto do `D23` é uma variável de ambiente própria
para a origem pública… Quando isso existir, os dois `map` abaixo e as duas linhas `proxy_set_header
Origin/Referer` do bloco `/v1/` devem ser REMOVIDOS."*

As três medições do insumo passaram **por causa do paliativo**, não apesar dele. E o marcador do
débito, no código, nomeia esta fatia como dona do fecho: *"fechar exige variável de ambiente própria
para a origem pública, validada na partida como as demais, e essa configuração **pertence à fatia que
publica o serviço**."*

**Por que isso é escopo, e não observação**: sem o fecho, a borda nova do Sysloc precisaria de uma
**segunda cópia do paliativo** — e cópia que diverge é a doença medida deste repositório (o Limiar de
Três existe por isso). Com o fecho, os dois paliativos saem e a conferência de origem passa a operar
como foi desenhada.

⚠️ **O paliativo do Master sai no MESMO diff do fecho.** Deixá-lo dupla a tradução — a origem pública
viraria o endereço de escuta antes de a API comparar com a origem pública — e **quebra a entrada do
painel que hoje funciona**. Isto é regressão da classe R1 e o P5 a pega, desde que a janela assistida
inclua a entrada no painel.

### 5.4 Débitos que esta fatia toca

| Débito | O que a fatia faz | Observação |
|---|---|---|
| `D9 · F0/T2` | **fecha** | O gatilho dispara aqui (bateria nova). Marcador manda fechar **com janela assistida** — a mesma da moldura. **11 cópias** do esqueleto medidas hoje (o `CLAUDE.md` diz 10 — está defasado) |
| `D23 · F1/T8` | **fecha** | §5.3. Sai o marcador e sai o paliativo do Master |
| `D24 · F1/T5` | **fecha** | Premissa reconferida por medição **antes** de virar trabalho |
| `D27 · F1/T6` | **fecha** | Declara o salto confiável; obriga rever o `CT-236 (c)`, que fixa o estado antigo |
| `D27 · F4/T11` | **fecha** | Aplica a ADR-0037 ao vhost da entrada de terceiro |
| `D51 · F4/T16` | **já disparou**, e o gatilho aponta para `apps/api/src/configuracao/ambiente.ts` — arquivo que esta fatia **abre** | Fechar é decisão do task plan; se não fechar, a razão fica registrada |
| `D16 · F5/T8` | idem — depende do fecho do `D51` | mesma decisão |
| `D5 · F5/T3` | **não dispara** | Nenhuma migração autoral (§3.4) |
| `D43 · F4/fechamento` | **não dispara** | Nenhum segundo provedor bancário |

### 5.5 Candidatos a ADR

**Nenhum candidato confirmado.** A única decisão transversal desta fatia — a política de limitação de
abuso na borda — **já foi registrada** como **ADR-0037**, em 2026-08-25, antes da INTENT. As demais
decisões foram avaliadas contra os 5 critérios canônicos:

- **Separar a chave de cifra do pacote do dump** (§5.2) — **0/5 como candidato**: não é decisão nova, é **conformação a uma ADR existente** (ADR-0032). Registrar seria duplicar a decisão dela.
- **Retenção por idade em vez de contagem** — **3/5**: transversal (C1 ✓), tag `data` (C2 ✓), trade-off real (C5 ✓); mas **C3 falha** (reverter é trocar um predicado de expurgo, custo baixo) e **C4 falha** (o repositório já decidiu isso uma vez, com razão registrada no `CT-1087 (f)` — não surpreende quem lê o código). **Candidato parcial**, registrado aqui e não promovido.
- **Espelhar a topologia da borda do Master em vez de manter duas** — **2/5**: **C1 falha** (há exatamente dois aplicativos, e ambos são conhecidos — não é regra para features futuras) e **C4 falha** (convergir topologia é o óbvio; o surpreendente seria divergir). Decisão técnica comum, registrada em §3.2.

### 5.5-b Candidatos a ADR levantados no challenge (2026-08-25)

Avaliados contra os 5 critérios canônicos. **Nenhum confirmado** — os três ficam como parciais:

- **"O destino de efeito externo é afirmado, nunca herdado do provisionamento"** (§5.9) — **4/5**: C1 ✓ (alcança todo efeito externo do produto), C2 ✓ (`cross-cutting`), C4 ✓ (é literalmente a pergunta que o leitor faz), C5 ✓ (trocar o servidor agora foi a alternativa rejeitada, com razão). **C3 falha**: reverter é uma linha de configuração. Registrado, não promovido.
- **"A origem pública confiável é uma lista, não um valor"** (§5.7) — **4/5**: C1 ✓, C2 ✓ (`auth`), C3 ✓ (singular→plural depois mexeria em ambiente, arcabouço e casos), C5 ✓. **C4 falha**: com dois aplicativos sobre a mesma API, o plural é o óbvio — o surpreendente seria o singular.
- **"Restrição de exposição vive na borda quando mover a superfície quebraria a âncora"** (§5.8) — **3/5**: C2 ✓ (`security`), C4 ✓, C5 ✓. **C1 falha** (é consequência do congelamento, que é circunstância desta fase, não regra perene) e **C3 falha**.

### 5.6 Pontos de atenção e restrições técnicas

- **Ordem imposta e irreversível**: preservação **antes** de publicação. O task plan a torna explícita — é a razão registrada de as duas metades viverem na mesma fatia.
- **Duas janelas assistidas** são pré-condição, não etapa: `sudo -n` **falha** neste host (medido), logo nenhum agente executa as baterias privilegiadas sozinho.
- ⚠️ **Divergência de número a resolver na primeira janela**: quantas baterias exigem privilégio. Pelo critério exato do agregador (`exigir_privilegio|EUID -ne 0`) são **3** de 11 — e o próprio agregador diz *"três baterias exigem privilégio"*. O insumo diz **8 de 11**; o `CLAUDE.md` diz *"10 cópias, só 2 sem privilégio"*. **Três fontes, três números.** Mede-se antes de dimensionar o fecho do `D9`.
- **A suíte automatizada não alcança o objeto desta fatia** — não mede borda, relógio do sistema nem restauração. A prova de que ela não alcança é a terceira lacuna da INTENT: **6 Rotinas agendadas ausentes do servidor passaram despercebidas por 1943 casos verdes**.
- **`packages/auth/src/autenticacao.ts` tem duas `DECISÃO FECHADA`** e o marcador do `D27` declara literalmente que **não as alcança**. A edição fica restrita ao ponto do débito; contrariar marcador exige escalada, e sob §A1 a recomendada é sempre preservar.
- **Alterar o `CT-236 (c)` exige a linha `SUT_IS_CORRECT_BECAUSE:`** — o caso está certo para o regime de hoje e passa a fixar o regime novo. Sem a linha, é fraude de gate.
- 🔴 **O produto publicado enviaria e-mail para lugar nenhum, e o registro diria sucesso** — §5.9. É o achado de maior impacto do challenge, e ele muda o que a fatia entrega (CA-14).
- **Premissa que sustenta a fatia inteira**: *o cliente não usa o sistema antigo*. Se deixar de valer, **PARA e escala**.
- **Uma exposição herdada permanece aberta**: o material público da porta 8300 carrega credencial legível enquanto aquele caminho existir. Fechá-la depende de decisão de topologia fora desta fatia.
- **Retenção em dias** e **coexistência com a preservação já existente do sistema antigo** (mesma janela, destino irmão, escrita medida hoje às 02:30) seguem em aberto — entram como primeira medição da janela de baseline.

### 5.7 ⚠️ A origem pública é uma LISTA — medido no arcabouço

A §5.3 estabelece que o `D23` fecha com variável própria para a origem pública. **Ela não pode ser
singular**, e a razão é medida em dois pontos:

1. **São dois aplicativos na mesma API.** `sysloc.systera.com.br` (o app do cliente) e
   `syslocadmin.systera.com.br` (o Painel Master) falam com o **mesmo** processo. Uma origem só faria
   um dos dois parar de entrar — e é exatamente por isso que o paliativo da borda do Master existe:
   ele mapeia **uma** origem para o endereço de escuta, forma que não escala para o segundo hostname.
2. **O arcabouço já aceita o plural.** Medido em `origin-check.mjs` do pacote publicado: a conferência
   é `trustedOrigins.some((origin) => matchesOriginPattern(originHeader, origin))`, sobre valor tratado
   com `Array.isArray`. O produto hoje **não** declara `trustedOrigins` — ele o deixa derivar do
   endereço de retorno, e é isso que o débito descreve.

**Consequência para o scope**: a variável é **plural**, conferida na partida como as demais, e o caso
novo (`origem-publica.e2e.spec.ts`) prova as **duas** origens aceitas **e** a origem estranha recusada.
Provar só a aceitação não discrimina afrouxamento da conferência.

### 5.8 ⚠️ O `D24` fecha na BORDA — fechá-lo na aplicação regride duas coisas

O marcador do `D24` sugere restringir `/docs*` na publicação. **Medido, restringir no registro da
aplicação é regressão dupla:**

1. **Derruba a âncora de superfície.** `CAMINHO_DO_CONTRATO = 'docs'` (`apps/api/src/main.ts`), e o
   elenco da âncora inclui **8 rotas** `GET /docs*` — entre elas `/docs`, `/docs-yaml`, `/docs/LICENSE`
   e `/docs/swagger-ui-init.js`. Elas **contam** nas 106. Removê-las do registro muda a contagem e
   viola o congelamento da superfície (CA-12), que é item do marco de entrega.
2. **Quebra uma bateria existente.** `deploy/scripts/instalacao/verificar-fundacao.sh` consulta
   `/docs` e `/docs/json` **nesses endereços literais**, inclusive na sub-bateria de recuperação após
   reinício. Restringir na aplicação a reprova.

**Portanto**: a aplicação continua registrando `/docs*` como hoje, e **a borda não os publica**. O
efeito pretendido pelo débito — o documento não alcançável de fora — é obtido sem mover a superfície
nem quebrar a bateria. `apps/api/src/main.ts` é tocado **apenas** para retirar o marcador e registrar
a decisão.

### 5.9 🔴 ACHADO CRÍTICO — o produto publicado enviaria e-mail para lugar nenhum

**Medido hoje, no ambiente real do processador de trabalho em execução (`/proc/<pid>/environ`):**

| Variável | Valor medido | O que isso significa |
|---|---|---|
| `NODE_ENV` | `production` | o processo se considera em produção |
| `SMTP_URL` | `smtp://127.0.0.1:1025` | **capturador de e-mail de desenvolvimento** (`sysloc-mailpit.service`, `--smtp 127.0.0.1:1025`) |
| `EMAIL_REMETENTE` | `avisos@sysloc.invalid` | domínio `.invalid` — reservado pela RFC 2606 para **nunca existir** |
| `URL_BASE_DA_CONFIRMACAO` | `https://sysloc.invalid` | o link de confirmação de e-mail aponta para um domínio inexistente |

**Por que isto é da fatia, e não de outra.** O ramo D instala as **6 Rotinas agendadas** — e a
**Régua de cobrança** é uma delas. No instante em que ela passar a correr, cada **Aviso** ao
**Locatário** será entregue ao capturador e **nunca chegará ao destinatário**.

⚠️ **E o modo de falhar é silencioso, que é o pior.** A **Tentativa de envio** registraria
**Desfecho = entregue** — porque o servidor de e-mail local *aceitou* a mensagem. O produto reportaria
sucesso, a trilha diria sucesso, e ninguém receberia nada. É a mesma classe de falha que esta fatia
existe para não ter, e ela **não é acidente**: o capturador é instalado de propósito pelo
provisionamento da F0 (`provisionar-base.sh`), e nenhuma fatia precisou trocá-lo porque **nada era
público**.

**Decisão adotada (A1) — recomendada e conservadora**: **manter o capturador durante esta fatia**, e
**tornar o destino do e-mail um fato AFIRMADO em vez de herdado**. Ou seja:

- A fatia **não** troca o SMTP para um servidor real. Trocar agora arriscaria disparar **Aviso** real a partir de dados de ensaio, e o cliente ainda não usa o produto — o dano da troca precoce é maior e irreversível.
- A fatia **acrescenta ao verificador de borda uma asserção sobre para onde o e-mail sai**, de modo que a configuração deixe de ser silenciosa: hoje nenhum caso, em 1943, afirma o destino do e-mail.
- A troca para o servidor real, com `EMAIL_REMETENTE` e `URL_BASE_DA_CONFIRMACAO` de domínio existente, entra como **item explícito do gate de desinstalação** (a virada), onde já vivem as condições de corte.

**Alternativa rejeitada**: trocar o SMTP nesta fatia. Motivo: dispara efeito externo irreversível
(mensagem entregue a pessoa real) a partir de um ambiente cujos dados ainda são de ensaio — e a
ADR-0029 já trata efeito externo como coisa que sai por fila justamente porque não se desfaz.

⚠️ **Isto NÃO é o mesmo que aceitar o defeito.** O que a fatia entrega é a **prova**: depois dela, o
destino do e-mail é asserido por um caso, e a troca vira uma linha de configuração cuja ausência
**reprova**. Hoje ela é invisível.

### 5.10 Unidade de host fora do roster — declarado, não corrigido

`sysloc-mailpit.service` está instalado em `/etc/systemd/system` e **não** consta do roster
`UNIDADES` de `instalar-unidades.sh`. **Isto não viola o `CT-1060`**: a igualdade que ele afirma é
entre os arquivos versionados em `deploy/systemd/` e o roster, e a unidade do capturador não é
versionada ali — ela é escrita pelo `provisionar-base.sh`, por design da F0.

Fica **declarado** porque a fatia acrescenta duas unidades ao mesmo diretório, e quem for conferir o
conjunto instalado encontrará uma unidade a mais do que o roster prevê. **Não é defeito, e não se
corrige aqui** — corrigir seria entrega não mencionada na INTENT.
