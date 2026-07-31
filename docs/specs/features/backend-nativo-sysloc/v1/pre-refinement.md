# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `backend-nativo-sysloc` — **programa** de substituição integral do backend Frappe/ERPNext por um backend nativo Node/NestJS/PostgreSQL
- **Fonte da ideia**: texto livre (invocação de `/agent-spec-pre-refinement`), ancorado em `docs/plano-backend-novo/`, `.claude/plans/` e `docs/adr/`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-07-30
- **Versão**: v1
- **Status**: Refinado — pronto para a próxima etapa
- **Relacionados**:
  - `docs/plano-backend-novo/decisao-e-stack.md` · `docs/plano-backend-novo/plano-execucao.md` · `docs/plano-backend-novo/levantamento-frontend.md`
  - `.claude/plans/plano-saas.md` · `.claude/plans/plano-saas-decisoes.md`
  - `docs/adr/0001-modelo-canonico-cobranca-bancaria-adaptador-por-provedor.md` (sobrevive inteira)
  - **Histórico Frappe, não estado atual**: `docs/specs/features/{saas-multi-empresa, integracao-bancaria-configuravel, contencao-credencial-exposta}` e `docs/prds/features/*`

> **Escopo deste brainstorm**: o discovery de **produto** já estava resolvido (40 decisões fechadas + plano mestre). O que foi explorado aqui é **como entregar** — o recorte em features do agent-spec, a ordem, o peso do processo, a prova de equivalência e a virada.

---

## 2. Ideia Resumida (uma frase)

Substituir integralmente o backend Frappe/ERPNext do sistema de locação de imóveis por um backend nativo Node 24/NestJS/PostgreSQL 18 sem Docker, já nascido multi-empresa, preservando o comportamento que o frontend React entrega ao usuário — e este artefato define **como esse programa é fatiado, ordenado, verificado e virado** dentro do framework agent-spec.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Unidade de recorte: o que vira `{feature}/{version}` no agent-spec | explorar |
| B | Ordem e caminho crítico: desafiar a sequência F0→F7 | explorar |
| C | Peso do processo por fatia: SDD, miniSpec ou TaskCard em cada uma | explorar |
| D | Prova de equivalência: como provar que nada regrediu, com e sem o Frappe | explorar |
| E | Virada e reversibilidade: o que a decisão 40 não cobre | explorar |

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Unidade de recorte

**Direções candidatas:**

- **A1 — Uma feature guarda-chuva, uma versão por fase**: `backend-nativo-sysloc/v1..v8`, cada versão sendo uma fase.
  - _Exemplo:_ `docs/specs/features/backend-nativo-sysloc/v1/` = F0 (stack), `/v2/` = F1 (fundação SaaS), `/v3/` = F2 (domínio).
  - _Viabilidade:_ **conflita com a semântica do framework.** Em `agent-spec-workflow-rules.md`, `{version}` é *nova iteração da mesma feature* — daí a variante `v{N+1}-debits`. Aqui a `v2` falaria de outro assunto; a rastreabilidade `CA-xx → CT-xxx (RN-xx)` fica difusa e o `_run/` de cada versão vira log de coisas sem relação.

- **A2 — Uma feature por fase, cada uma nascendo em `v1`**: nomes de **capacidade**, não de fase.
  - _Exemplo:_
    ```
    caracterizacao-regras-legadas/v1     (tarefa paralela, promovida a fatia)
    fundacao-stack-nativa/v1             (F0)
    fundacao-multitenancy-identidade/v1  (F1)
    dominio-locacao/v1                   (F2)
    cobranca-mora-e-documentos/v1        (F3)
    integracao-bancaria-sicoob/v1        (F4)
    automacoes-agendadas/v1              (F5)
    frontend-religado/v1                 (F6)
    virada-e-desinstalacao/v1            (F7)
    ```
  - _Viabilidade:_ uso canônico do framework. Cada fatia cabe num pipeline completo, tem CA próprios e `_run/` coerente. Nomes de capacidade sobrevivem a reordenação. Nenhum colide com as três features Frappe existentes — por isso `fundacao-multitenancy-identidade` e não `saas-multi-empresa v2`. A cola cross-feature já existe: `docs/specs/domain-glossary.md` (global), as 40 decisões e as ADRs.

- **A3 — Por capacidade de domínio, ignorando as fases**: `multi-tenancy`, `identidade`, `cadastro-imobiliario`, `cobranca`, `banking`; a infra sai do framework.
  - _Exemplo:_ F0 (PostgreSQL, Redis, systemd, `reboot`) viraria `deploy/CHECKLIST-INFRA.md`, sem pipeline nem gates.
  - _Viabilidade:_ mais fiel à palavra "feature", mas deixa a F0 órfã — e ela tem o critério de aceitação mais objetivo do projeto (`reboot` real, sem intervenção manual). Perder isso do pipeline é perder o gate.

**Direção escolhida**: **A2** — uma feature por fase, em `v1`, com nome de capacidade. O `plano-execucao.md` deixa de ser o plano e passa a ser **o índice do programa**, apontando cada fase à sua feature (o agent-spec não tem conceito de "épico").
**Podadas / adiadas**: A1 (usa `{version}` com semântica que o framework não tem) · A3 (deixa a F0 sem gates, perdendo o CA mais objetivo do projeto).

### Ramo B — Ordem e caminho crítico

**Direções candidatas:**

- **B1 — Ordem do plano intacta**: F0→F1→…→F7, caracterização como tarefa paralela sem data.
  - _Exemplo:_ nada muda além do recorte do ramo A.
  - _Viabilidade:_ a ordenação em si é sólida — "stack existe e se prova → fundação SaaS → domínio" está correta, e o argumento de promover multi-tenancy de F4 (retrofit) para F1 (fundação) se sustenta. Mas deixa dois riscos de calendário sem tratamento.

- **B2 — Ordem do plano + duas antecipações**:
  1. **Caracterização puxada para o início**, como fatia própria e curta.
     - _Exemplo:_ `caracterizacao-regras-legadas/v1` roda contra o site `frontend` **em leitura**, captura os golden files e os commita em `docs/specs/features/caracterizacao-regras-legadas/v1/`.
     - _Por quê:_ é o único ativo do projeto com **prazo de validade** — depende de um sistema que será desligado. "Fora do caminho crítico" é verdade em dependência e falso em risco.
  2. **ADR fixando a forma do contrato de API antes da primeira entidade de negócio.**
     - _Exemplo:_ `id` textual legível como chave exposta (`CTR-2026-0001`), corpo camelCase, `status` calculado no servidor, envelope de erro com **código estruturado** e forma de paginação.
     - _Por quê:_ `levantamento-frontend.md` §7.4 fecha com *"o maior risco não é técnico — é decidir o contrato da nova API antes de escrever qualquer linha"*. Hoje o frontend classifica erro do Sicoob **pelo prefixo do texto da mensagem** e extrai campo inválido por regex sobre `"O campo 'X'"` (§7.2 item 10). Não é desenhar os 35 endpoints agora — é fixar a *forma*, que é transversal e cara de reverter.
  - _Viabilidade:_ ambas cabem antes da F1; nenhuma depende de código do backend novo.

- **B3 — Reordenar por vertical (strangler)**: entregar Imóveis fim-a-fim (schema + contrato + frontend religado) antes de Contratos, com os dois backends servindo o mesmo app.
  - _Exemplo:_ nginx dividindo `/api/` por rota — `/api/imoveis/*` para o Node, o resto para o Frappe.
  - _Viabilidade:_ **conflita com decisões fechadas.** Contraria a decisão 6 (ambiente novo e virar a chave) e a 40 (virada direta), exige o fonte do React em iteração fina (está na máquina local — decisão 4) e faria duas autenticações incompatíveis (token de serviço × sessão) conviverem por meses.

**Direção escolhida**: **B2** — ordem do plano mantida, com as duas antecipações.
**Podadas / adiadas**: B1 (não trata o risco de calendário da caracterização nem o do contrato) · B3 (conflita com as decisões 6 e 40; o ganho é obtido mais barato pela antecipação do ADR de contrato).

### Ramo C — Peso do processo por fatia

**Direções candidatas:**

- **C1 — SDD nas 8 fatias**.
  - _Exemplo:_ `fundacao-stack-nativa` ganharia um PRD com histórias de usuário para "instalar PostgreSQL 18" e "ligar AOF no Redis".
  - _Viabilidade:_ cerimônia vazia onde não há persona. O próprio framework registra que o maior desperdício do pipeline é rodar SDD no que caberia mais leve.

- **C2 — Peso por natureza da fatia**:

  | Fatia | Framework | Por quê |
  |---|---|---|
  | `caracterizacao-regras-legadas` | **TaskCard** | 1 objetivo, só dev, sem decisão nova — a `T4.md` já existe quase pronta |
  | `fundacao-stack-nativa` (F0) | **miniSpec** | 8 entregas e CA executáveis, mas zero persona e zero regra de negócio |
  | `fundacao-multitenancy-identidade` (F1) | **SDD** | 3 perfis, matriz 10×7, RLS + FK composta + `AsyncLocalStorage` — decisão arquitetural nova e múltiplas personas |
  | `dominio-locacao` (F2) | **SDD** | 8 entidades, 3 regras portadas, primeiros contratos ts-rest |
  | `cobranca-mora-e-documentos` (F3) | **SDD** | ciclo de cobrança, mora por empresa, régua, PDF de 752 linhas, carnê |
  | `integracao-bancaria-sicoob` (F4) | **SDD** | mTLS, webhook, `seu_numero` único do SaaS — consome a ADR-0001 |
  | `automacoes-agendadas` (F5) | **miniSpec** | porte com CA claros; o gatilho (systemd timers) já está decidido |
  | `frontend-religado` (F6) | **handoff + spec executável** | o fonte do React não está neste servidor — ver direção escolhida abaixo |
  | `virada-e-desinstalacao` (F7) | **miniSpec** | backup/restore em TypeScript + checklist de virada + desinstalação |

  - _Exemplo:_ a F0 entra por `/agent-spec-minispec-generate-intent` — intent = "stack instalada e provada"; scope = as 8 entregas de instalação; CA = `reboot` real com a API respondendo sozinha.
  - _Viabilidade:_ respeita a tabela de decisão do framework e evita PRD onde não há persona. **Nota de gates**: F1 e F4 tocam `auth`/`security`/`crypto`/`db_migrations` — pela heurística de Critical Paths, `[qa, tech_review]` sempre, sem inferência para `[qa]`.

- **C3 — Decidir o peso na entrada de cada fatia**, com um pré-refinamento curto por feature.
  - _Exemplo:_ ao chegar na F3, `/agent-spec-pre-refinement "cobrança, mora e documentos"` recalcula amplitude/personas/novidade com o que já foi construído.
  - _Viabilidade:_ não é alternativa ao C2 — é a **válvula**. O C2 é a proposta registrada hoje; o C3 permite corrigi-la com informação que ainda não existe.

**Achado que alterou a F6**: o pipeline agent-spec **executa tasks neste repositório**, e o fonte do React vive em `/home/fibron/dev/projetos/react/sysloc`, na máquina local do usuário (decisão 4 + `levantamento-frontend.md` §1). Não há como rodar `/agent-spec-*-run-tasks` sobre ele daqui. O framework tem uma skill exatamente para essa fronteira: `agent-spec-backend-contract-handoff`.

**Direção escolhida**: **C2 com C3 como válvula** — a tabela vale como proposta registrada, e cada fatia reavalia o próprio peso ao ser iniciada. Para a **F6**: **handoff + especificação executável** — a fatia produz o handoff de contrato, o `@sysloc/contracts` publicado e a especificação por arquivo; a execução acontece na máquina local do usuário, sem run de tasks aqui (respeita a decisão 4).
**Podadas / adiadas**: C1 (cerimônia sem persona) · trazer o fonte do React para o servidor (mudaria a decisão 4 e o fluxo de deploy por `rsync`) · transformar a F6 em projeto agent-spec próprio no repositório do React (adiado — pode ser reconsiderado na entrada da fatia).

### Ramo D — Prova de equivalência

**Direções candidatas:**

- **D1 — Golden files contra o Frappe vivo** (o previsto na T4): metragem (imóvel sem cômodo, com um, com vários, com metragem nula) e o **texto extraído** do PDF de contrato, nunca os bytes — o artefato carrega metadados de geração que variam a cada execução.
  - _Exemplo:_ captura por `bench execute` no site `frontend`, **somente leitura**, com os golden commitados na fatia de caracterização; o Vitest da F3 compara contra eles.
  - _Viabilidade:_ a `T4.md` já está especificada; o Frappe segue de pé até a F7. Risco: tocar produção — mitigado por ser leitura.

- **D1+ — Ampliar a caracterização às rotinas de estado**: `marcar_cobrancas_vencidas`, `encerrar_contratos_vencidos` e `_calcular_mora()`.
  - _Exemplo:_ capturar entrada/saída das três contra a base atual; `_calcular_mora()` é documentada no próprio código como *"PURA (sem acesso a banco): recalculável e idempotente"*, então comparar é trivial.
  - _Viabilidade:_ custo marginal baixo e fecha o buraco do achado 18 (*testes concentrados só em integração bancária; rotinas de cron do domínio sem teste algum*). Sem isso, a F5 porta comportamento que ninguém verificou — contra o requisito declarado de que **todas** as automações devem funcionar corretamente.

- **D2 — Paridade pelo frontend**: 4 specs Playwright + 391 casos de teste.
  - _Exemplo:_ rodar os 4 specs contra o backend novo antes da virada.
  - _Viabilidade:_ só executável na máquina local → **CA da F6**, não teste contínuo do backend.

- **D3 — Invariantes estruturais nativos**: teste-guarda que falha se alguma tabela de negócio nascer sem RLS, suíte de isolamento parametrizada, teste provando que o Master enxerga vazio nos dados de negócio, `reboot` real.
  - _Exemplo:_ empresa A não lê dado da B **mesmo com a camada de aplicação desligada** — RLS testada direto no banco.
  - _Viabilidade:_ independem do Frappe; são CA da F0 e da F1.

**Direção escolhida**: **D1+ · D2 · D3, com papéis distintos** — D1+ é pré-condição da F3 e da F5; D3 é CA da F0 e da F1; D2 é CA da F6. Os três são complementares, não alternativos.
**Podadas / adiadas**: D1 puro (deixa as rotinas de estado sem oráculo) · caracterizar também a régua de cobrança (`cobranca_automation`, ~700 LOC) — **adiado**: tem efeito colateral de envio de e-mail, exigindo isolar o envio ao capturar contra produção; reavaliar na entrada da F3.

### Ramo E — Virada e reversibilidade

> A **decisão 40** (virada direta, sem fase de ensaio dedicada) está **fechada e não foi re-litigada**. Exploradas apenas as lacunas que ela não cobre.

**Direções candidatas:**

- **E1 — Checklist de virada versionado + janela de rollback por tempo**, como o `plano-execucao.md` define ("desligada e intacta por semanas").
  - _Exemplo:_ `deploy/scripts/virada.md` com a ordem literal — parar as rotinas do Frappe → apontar o CloudPanel para a API nova → smoke dos fluxos → observar por N semanas → desinstalar.
  - _Viabilidade:_ **premissa falsa, derrubada pelo usuário.** O Frappe é **single-tenant**: voltar para ele significa abandonar exatamente a capacidade que justificou a troca de backend. Pior, **não há migração de dados** (F7 item 2 — recadastro pelo app, dados atuais fora de uso), então no instante seguinte à virada as duas bases **divergem**: reverter devolveria dados velhos. A janela não protege nada e ocupa disco que está em 79%.

- **E2 — Critério objetivo por ciclo de negócio: um fechamento mensal completo observado em produção** (emissão em lote → régua de e-mail → baixa via webhook → reconciliação → fechamento).
  - _Exemplo:_ desinstalar só após o primeiro mês inteiro rodar no backend novo sem incidente.
  - _Viabilidade:_ resolveria o problema de *quando*, mas herda a premissa falsa do E1 — continua tratando a stack antiga como destino de rollback viável, o que ela não é.

- **E3 — Gate de pré-requisitos verificáveis, sem espera por tempo.** ← escolhida
  - _Exemplo:_ a desinstalação é autorizada quando **todos** valem: golden files capturados e commitados (metragem, texto do PDF, 3 rotinas de estado) · dump final da base antiga **e** dos segredos preservados em `/opt/backups/sysloc/` · checklist de virada executado e conferido · backup do banco **novo** restaurado com sucesso num banco vazio (`pg_restore --list` + restore de teste).
  - _Viabilidade:_ é o único gate que se sustenta depois de derrubado o E1. A rede de segurança deixa de ser "uma stack de pé" e passa a ser **um dump preservado** — que não ocupa CPU, não ocupa RAM, não diverge, e é a única forma de consultar os dados legados que continua válida indefinidamente.

**Direção escolhida**: **E3, sem janela por tempo** — a desinstalação é liberada pelo gate de pré-requisitos, não por contagem de dias. O valor residual do Frappe após a virada é **zero**: como oráculo das regras legadas ele já foi substituído pelos golden files (fatia de caracterização, ramo D), e como destino de rollback ele nunca serviu — é single-tenant e sua base congela na virada.
**Podadas / adiadas**: **E1** — premissa falsa (rollback para single-tenant com dados divergentes) · **E2** — herda a mesma premissa · desinstalar junto com a virada, no mesmo passo (perde a conferência do checklist e do restore de teste) · desligar na virada e desinstalar após o recadastro (libera CPU/RAM mas não o disco, e o recadastro não depende do Frappe rodando — o dump basta, e os dados atuais estão fora de uso).

---

## 5. Problema

- **Qual é a dor real hoje?** O backend Frappe/ERPNext não tem fundação para o que o produto precisa ser. **Não existe autenticação de usuário**: `isSignedIn()` é `localStorage.getItem('usuario') !== null`, e todo o tráfego real usa uma credencial de serviço compartilhada embutida no bundle público. O backend nunca soube quem está agindo — e sobre essa fundação **multi-tenancy é impossível**.
- **Como o problema aparece no dia a dia?** 20 dos 22 DocTypes existem só no banco, sem `.json` versionado. `bench migrate` já apagou silenciosamente a definição de cadastros por erro no nome derivado da classe do controller, saindo com exit 0. A `saas-multi-empresa/v1` acumulou **9 rodadas de gate só na T1** e ainda não termina — e nem sequer entrega multi-tenancy. 10 fluxos do frontend foram desenhados em torno das limitações do Frappe (joins N+1 no cliente, transações multi-passo sem rollback na UI, `docstatus` como regra de negócio).
- **Quem sente o impacto?** O operador do SaaS (não consegue vender para uma segunda imobiliária), as imobiliárias clientes (dados sem isolamento provado), os locatários e locadores (dados pessoais sob uma credencial pública — LGPD) e o dev (todo trabalho de fundação é pago duas vezes).
- **Por que resolver agora?** O trabalho de reconstruir autenticação é pago nos dois caminhos — permanecer no Frappe não o evita, só adia. A caracterização das regras legadas depende de um sistema que será desligado; adiar encarece.

---

## 6. Objetivo Principal

- **Resultado esperado**: um backend nativo em produção, multi-empresa por construção, com isolamento provado no banco (não só na aplicação), servindo o mesmo app React sem que o usuário final perceba a troca — e o Frappe desinstalado.
- **Mudança de estado**: de single-tenant com autenticação cosmética e schema não versionado, para multi-tenant com RLS, identidade real por usuário, schema em código e automações que sabem para qual empresa executar.
- **Mudança de comportamento (processo)**: o programa de 8 fases deixa de ser um plano em prosa e passa a ser **9 fatias rastreáveis** no agent-spec, cada uma com critérios de aceitação executáveis e gates de QA e Tech Review.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Admin Empresa** — administra a própria imobiliária (imóveis, contratos, cobranças, usuários), com acesso total dentro da empresa.
- **Personas secundárias**:
  - **Sysloc Master** — operador do SaaS; cadastra, suspende e reativa empresas, e **não alcança dado de negócio por nenhum caminho** (com teste que prova).
  - **Usuário Empresa** — acesso conforme liberação na matriz de 10 telas × 7 ações sensíveis.
  - **Dev/operador** — persona das fatias de infraestrutura (F0, F5, F7): instala, opera, faz backup e vira a chave.
- **Contexto de uso**: SPA React em `sysloc.systera.com.br` (desktop, navegador); painel master em `syslocadmin.systera.com.br`, domínio separado e não divulgado; automações rodando por systemd timer no servidor, sem interação humana.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **Recorte em 9 fatias**, cada uma como `{feature}/v1` com nome de capacidade — `caracterizacao-regras-legadas`, `fundacao-stack-nativa`, `fundacao-multitenancy-identidade`, `dominio-locacao`, `cobranca-mora-e-documentos`, `integracao-bancaria-sicoob`, `automacoes-agendadas`, `frontend-religado`, `virada-e-desinstalacao` (Ramo A / A2)
- [ ] **`plano-execucao.md` reposicionado como índice do programa**, apontando cada fase à sua feature (Ramo A)
- [ ] **Ordem F0→F7 mantida**, com a caracterização antecipada para o início como fatia própria (Ramo B / B2.1)
- [ ] **ADR fixando a forma do contrato de API** antes da primeira entidade de negócio: ID textual legível exposto, camelCase, `status` no servidor, código de erro estruturado, forma de paginação (Ramo B / B2.2)
- [ ] **Peso do processo por fatia** conforme a tabela C2, com reavaliação na entrada de cada uma (Ramo C / C2+C3)
- [ ] **F6 entregue como handoff de contrato + `@sysloc/contracts` publicado + especificação executável por arquivo**, sem run de tasks neste repositório (Ramo C)
- [ ] **Caracterização ampliada** para incluir as 3 rotinas de estado idempotentes, além de metragem e texto do PDF (Ramo D / D1+)
- [ ] **Três oráculos com papéis distintos**: golden files (pré-condição de F3 e F5), invariantes estruturais (CA de F0 e F1), paridade Playwright (CA de F6) (Ramo D)
- [ ] **Checklist de virada versionado + gate de desinstalação por pré-requisitos verificáveis**, sem janela de rollback por tempo: golden files commitados, dump final da base antiga e dos segredos preservado, checklist de virada conferido e backup do banco novo restaurado num banco vazio (Ramo E / E3)

> Ponto de partida para as specs de cada fatia — não é definitivo.

---

## 9. Fora do Escopo (podado / adiado)

- **A1 — feature guarda-chuva com uma versão por fase** — _usa `{version}` com semântica que o framework não tem; quebra rastreabilidade e polui o `_run/`._
- **A3 — infra fora do framework** — _deixaria a F0 sem gates, perdendo o CA mais objetivo do projeto (`reboot` real)._
- **B3 — reordenação por vertical (strangler) com dois backends servindo o mesmo app** — _conflita com as decisões 6 e 40; exige o fonte do React em iteração fina; faria duas autenticações incompatíveis conviverem por meses._
- **C1 — SDD nas 8 fatias** — _cerimônia vazia onde não há persona nem história de usuário._
- **Trazer o fonte do React para este servidor** — _mudaria a decisão 4 e o fluxo de deploy por `rsync`._
- **F6 como projeto agent-spec próprio no repositório do React** — _adiado; reavaliar na entrada da fatia, depois que o handoff existir._
- **Janela de rollback por tempo ("desligada e intacta por semanas", E1) e sua variante por ciclo mensal (E2)** — _premissa falsa: o Frappe é single-tenant e sua base congela na virada (não há migração de dados). Reverter devolveria dados velhos num backend que não faz o que o produto precisa. A rede de segurança passa a ser o dump preservado, não a stack de pé._
- **Desinstalar no mesmo passo da virada** — _perde a conferência do checklist e do restore de teste do banco novo._
- **Desligar na virada e desinstalar após o recadastro** — _libera CPU e RAM mas não o disco, e o recadastro não depende do Frappe rodando: os dados atuais estão fora de uso e o dump basta._
- **Caracterizar a régua de cobrança (`cobranca_automation`, ~700 LOC)** — _adiado: efeito colateral de envio de e-mail exige isolar o envio ao capturar contra produção; reavaliar na entrada da F3._
- **Canal WhatsApp implementado** — _fora de negociação (seção 11): campos permanecem no modelo, canal não é implementado._
- **Billing, planos e self-service de assinatura** — _`[fora do escopo do projeto]`; o SaaS foi definido sem eles desde o plano mestre._
- **`painel-master` como produto** — _feature própria, especificada depois da F7: persona distinta, domínio distinto, ciclo de vida distinto._

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend Node/NestJS/PostgreSQL **nativo, sem Docker**; substitui integralmente o Frappe/ERPNext de `/opt/frappe`. Fase 0 não iniciada — `apps/` e `packages/` vazios; o repositório contém só os ativos de planejamento migrados.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md`):
  - `docs/specs/features/saas-multi-empresa/v1` (+ `docs/prds/.../saas-multi-empresa/v1/prd.md`, 8 US e 11 CA) — **histórico Frappe.** Existe para tornar o metadado do Frappe versionável; perde propósito com a decisão de abandonar o Frappe. **Exceção**: a `tasks/T4.md` (caracterização) sobrevive e vira a fatia `caracterizacao-regras-legadas/v1`.
  - `docs/specs/features/integracao-bancaria-configuravel/v1` (+ PRD) — **histórico Frappe.** Fonte de conhecimento de domínio para `integracao-bancaria-sicoob/v1`; a ADR-0001 é o elo vivo entre as duas.
  - `docs/specs/features/contencao-credencial-exposta/{v1, v2-debits, v3-debits}` — **histórico Frappe.** A credencial segue exposta enquanto o Frappe existir; pendência operacional, não fatia deste programa.
  - `docs/specs/domain-glossary.md` — glossário global; é a cola cross-feature das 9 fatias novas.
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: nenhuma neste repositório (vazio). PostgreSQL 18 + Drizzle nascem na F0/F1.
  - **Autenticação / autorização**: nenhuma. `better-auth` para identidade e sessão; autorização 10×7 própria em `@sysloc/auth` (F1).
  - **Outros módulos internos**: `apps/` e `packages/` vazios; `deploy/{systemd,nginx,scripts}` existem como diretórios. O framework agent-spec está completo em `.claude/` (36 skills, 6 rules, 3 agents). ~6.000 linhas de lógica de domínio real a portar de `/opt/frappe` (o restante dos 8.489 LOC de Python é encanamento do Frappe).
  - **ADRs**: **ADR-0001 sobrevive inteira** (agnóstica de stack) e é consumida pela F4. ADR-0005 sobrevive adaptada (systemd). ADR-0006 sobrevive em espírito (`embedded-postgres`). ADR-0004 muda de natureza. **ADR-0002 e ADR-0003 morrem** com o Frappe.
- **Conflitos / sobreposições detectados**: nenhum bloqueante. As três features Frappe **não** são estado atual nem base de versionamento — os nomes escolhidos para as 9 fatias novas não colidem com elas. Sobreposição de domínio esperada e desejada entre `integracao-bancaria-configuravel` (histórico) e `integracao-bancaria-sicoob/v1` (novo), mediada pela ADR-0001.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- [HIPÓTESE] A tabela de peso por fatia (C2) é inferida da tabela de decisão do framework a partir do que se sabe hoje de cada fase; nenhuma fatia foi de fato dimensionada com uma spec em mãos.
- [HIPÓTESE] `caracterizacao-regras-legadas` cabe em um TaskCard porque a `T4.md` já está especificada — se a ampliação D1+ crescer o escopo, pode virar miniSpec.
- [HIPÓTESE] `automacoes-agendadas` (F5) cabe em miniSpec — depende de a "tela de saúde das rotinas" (decisão 31) ser tratada como API aqui e tela na F6.
- [HIPÓTESE] O ADR de forma de contrato satisfaz os 5 critérios canônicos de criação (transversal, tag `architecture`/`http`, custo de reversão alto, surpreendente sem contexto, trade-off real entre imitar o Frappe e falar o modelo de domínio).
- [HIPÓTESE] Os nomes de feature propostos são estáveis; se uma fase for reordenada, o nome de capacidade sobrevive.
- [HIPÓTESE] O Frappe permanece operacional e íntegro até a F7, viabilizando a captura de golden files a qualquer momento antes da F3.

**Decisões já tomadas (fora de negociação)** — restrições travadas pelo usuário que limitam os rumos viáveis:

- Este projeto roda **exclusivamente em Opus** — vale para a sessão principal e para **todo subagente** despachado por qualquer skill do agent-spec, incluindo executor, `agent-spec-qa-validator` e `agent-spec-staff-architecture-review`. **Sonnet e Haiku estão proibidos**, mesmo onde o `SKILL.md` os recomenda ou a heurística de `gates`/`model` do `agent-spec-workflow-rules.md` os resolveria por default. Onde a regra mandar `sonnet`, leia `opus`; onde já mandar `opus[xhigh]`, mantenha.
- **Todas as respostas e interações em português brasileiro** — não só documentação e mensagens de commit.
- As **40 decisões** de `.claude/plans/plano-saas-decisoes.md`.
- A **stack inteira** de `docs/plano-backend-novo/decisao-e-stack.md` §4.
- **Sem Docker**; serviços nativos sob systemd.
- **Multi-tenancy é fundação, não retrofit**: RLS e FK composta antes da primeira entidade de negócio.
- **IDs textuais legíveis preservados** — o frontend os exibe ao usuário como título de contrato, label de select e campo "Identificador".
- **Canal WhatsApp fica só modelado, sem implementação** — os campos permanecem no modelo de domínio; `whatsapp`/`ambos` recusados na validação Zod.
- **O Frappe é desinstalado ao final**; até lá fica de pé.
- **Decisão 40 respeitada**: virada direta, sem fase de ensaio dedicada — não re-litigada neste brainstorm.
- **Não há janela de rollback por tempo** (decidido nesta sessão, ramo E — **revisa o `plano-execucao.md` F7 item 3**, que previa a stack antiga "desligada e intacta por semanas"). Justificativa do usuário: *"não faz sentido o Frappe ficar por semanas, já que ele não é backend SaaS — é inútil de todo jeito após a completa migração para o backend novo."* A desinstalação é liberada por um **gate de pré-requisitos verificáveis**: golden files capturados e commitados · dump final da base antiga e dos segredos preservado em `/opt/backups/sysloc/` · checklist de virada executado e conferido · backup do banco **novo** restaurado com sucesso num banco vazio.
- As specs em `docs/specs/features/` são do backend Frappe antigo: contexto histórico e fonte de conhecimento de domínio, **nunca** estado atual nem base de versionamento. Este projeto começa em `v1`, com nome de feature próprio.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o usuário final não deve perceber a troca ("o frontend praticamente nem deveria sentir"). Se um fluxo mudar de comportamento, a percepção é de regressão, não de melhoria. → **Mitigação**: estratégia C (IDs legíveis preservados, API falando o modelo de domínio que o frontend já usa internamente) + os 4 specs Playwright como CA da F6.
- **Risco de escopo (pode explodir?)**: **alto** — 9 fatias, ~6.000 linhas de domínio a portar, 8 entidades, integração bancária com mTLS e webhook, 67 arquivos de teste do frontend. → **Mitigação**: fatias com CA executáveis e independentes; a F0 não contém uma linha de regra de negócio; `plano-execucao.md` como índice único do programa, evitando que o escopo se redefina dentro de cada fatia.
- **Risco técnico ou operacional**:
  - **Perda do oráculo**: o Frappe é a única fonte da verdade sobre o gerador de contrato de 752 linhas e as rotinas sem teste. → **Mitigação**: caracterização antecipada (B2.1) e ampliada (D1+).
  - **Contrato de API decidido tarde**: cada decisão de forma redefine quais arquivos do frontend mudam. → **Mitigação**: ADR antes da primeira entidade (B2.2).
  - **Disco em 79% (6 GB livres)** com PostgreSQL 18 + Redis + stack antiga coexistindo. → **Mitigação**: decisão 32 autoriza excluir o `frappe-staging` por completo; medir antes e depois.
  - **Redis guardando a fila do BullMQ**, não só cache — queda com jobs enfileirados significaria cobrança não enviada. → **Mitigação**: AOF ligado (`appendfsync everysec`) + jobs idempotentes com reconciliação a partir do Postgres.
  - **Sem rollback para a stack antiga** (ramo E): a partir da virada, defeito no backend novo se corrige para a frente — não há para onde voltar. Isso é consequência aceita, não risco novo: o Frappe é single-tenant e sua base congela na virada, então ele nunca foi um destino de rollback viável. → **Mitigação**: o gate de desinstalação exige o backup do banco **novo** já restaurado com sucesso num banco vazio (prova de que o novo é recuperável) e o dump da base antiga preservado (prova de que o dado legado continua consultável). O risco real desloca-se para a **qualidade dos CA antes da virada** — daí os três oráculos da seção D terem papéis bloqueantes distintos.
  - **Defeito que só aparece no primeiro fechamento mensal** (emissão em lote, régua, reconciliação) chega quando o Frappe já não existe. → **Mitigação**: os golden files das rotinas de estado (D1+) e a suíte da F5 precisam cobrir o ciclo mensal **antes** da virada, já que não haverá observação em produção com rede.
- **Risco de privacidade / segurança / compliance**:
  - **Credencial de API exposta em texto claro** no bundle público da porta 8300 enquanto o Frappe existir, com leitura e escrita nos cadastros de negócio, incluindo dados pessoais de locadores e locatários (**LGPD**). → **Mitigação**: rotação imediata, independente deste programa — pendência operacional com dono e data a definir (`[DÚVIDA]` 8).
  - **Root/DBA lê os dados de qualquer empresa** — físico, não configurável. Risco assumido conscientemente na decisão 16: confidencialidade garantida apenas na aplicação, sem auditoria de acesso técnico nem criptografia por campo.
  - **Payload do webhook Sicoob não é assinado** — sem HMAC, sem header secreto, sem faixa de IPs documentada. → **Mitigação**: decisão 20 (webhook é gatilho, API é a verdade) + roteamento por `seu_numero` com a empresa derivada do documento, nunca do payload.
  - **Segredos fora do repositório**: certificado `.pfx`, senha de banco e chave de cifra em `EnvironmentFile` 0600; `.gitignore` barrando `.env`, `*.pfx` e `secrets/`.

---

## 13. Dúvidas em Aberto

1. [DÚVIDA] `embedded-postgres` já publica binários de **PostgreSQL 18**? Se ainda estiver em 17, os testes rodam em 17 e a produção em 18 — aceitável, mas precisa ser sabido **antes da primeira migration** (verificação pendente da F0).
2. [DÚVIDA] O `seuNumero` de **18 caracteres** retorna íntegro da API do Sicoob, sem truncamento? O exemplo oficial traz `"00-03"`. Se truncar, a **decisão 24 precisa ser revista antes da F4** — é a chave de roteamento do webhook.
3. [DÚVIDA] Existe **allowlist de IP** no lado do Sicoob? O backend novo pode sair pelo mesmo IP, mas precisa ser confirmado. E onde vivem hoje o certificado e as credenciais?
4. [DÚVIDA] `codigoMotivoCancelamento: 2` — aparece no payload de exemplo mas não consta na lista documentada (que começa em 11). Ação do usuário junto ao Sicoob (decisão 22, não bloqueia).
5. [DÚVIDA] Qual é o **crontab real do root**? Os dois levantamentos divergem no horário do `run-cobrancas-vencidas.sh` (`1 0 * * *` contra `10 0 * * *`) e ambos vieram de documentação mantida à mão. Necessário antes da F5.
6. [DÚVIDA] Qual será o **remoto git** deste repositório? O `origin` atual (`fabianolopesviana/frappe-locacao`) é do projeto que será desinstalado.
7. [DÚVIDA] As **ADR-0002 e ADR-0003** devem ser formalmente depreciadas (`/agent-spec-adr-deprecate`) agora que morreram com o Frappe? E a **ADR-0004**, que "muda de natureza" — vira uma ADR nova superando a antiga (`/agent-spec-adr-supersede`) ou é absorvida pelo ADR de forma de contrato?
8. [DÚVIDA] Quem rotaciona a credencial exposta e **quando**? Hoje está registrada como "pendência fora do caminho crítico", sem dono nem data — mas é uma vulnerabilidade ativa com dados pessoais.
9. [DÚVIDA] O disco (79% ocupado, 6 GB livres) comporta PostgreSQL 18 + Redis + a stack Frappe durante toda a janela de rollback? A decisão 32 autoriza excluir o `frappe-staging` — isso já foi feito?
10. [DÚVIDA] A **tela de saúde das rotinas** (decisão 31) é API na F5 e tela na F6, ou entra inteira em uma delas? Muda o peso de processo da `automacoes-agendadas`.

> São **10 dúvidas**, mas nenhuma é bloqueante da próxima etapa: a 1 e a 9 pertencem à F0, a 2/3/4 à F4, a 5 e a 10 à F5, a 6/7/8 são operacionais e paralelas. Nenhuma impede iniciar a caracterização nem o ADR de contrato.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: A2 (uma feature por fase em `v1`, com nome de capacidade) · B2 (ordem mantida + caracterização antecipada + ADR de contrato antes da primeira entidade) · C2 com C3 como válvula (peso por natureza da fatia, reavaliado na entrada) · F6 como handoff + especificação executável · D1+ (caracterização ampliada às 3 rotinas de estado) · D2 e D3 com papéis distintos · E3 (checklist de virada versionado + gate de desinstalação por pré-requisitos verificáveis, sem espera por tempo).
- **Descartado com justificativa**: A1 (semântica de `{version}` incompatível) · A3 (F0 sem gates) · B3 (strangler conflita com as decisões 6 e 40) · C1 (SDD sem persona) · trazer o fonte do React para o servidor (mudaria a decisão 4) · E1 e E2 (janela de rollback por tempo ou por ciclo mensal — premissa falsa: o Frappe é single-tenant e sua base congela na virada).
- **Adiado para depois**: F6 como projeto agent-spec próprio no repositório do React (reavaliar após o handoff) · caracterização da régua de cobrança (reavaliar na entrada da F3) · `painel-master` como feature de produto (após a F7).
- **Provocações que mudaram o rumo**:
  1. *"A caracterização é o único ativo do projeto com prazo de validade."* — tirou-a de "tarefa paralela sem data" e a promoveu a primeira fatia.
  2. *"O maior risco é decidir o contrato da nova API antes de escrever qualquer linha"* (`levantamento-frontend.md` §7.4) — transformou a forma do contrato em ADR antecipada, em vez de decisão embutida na F2.
  3. *"O pipeline executa tasks neste repositório, e o fonte do React não está aqui."* — mudou a natureza da F6 de fase-com-run para handoff + especificação executável, alinhando-a à decisão 4.
  4. *"As rotinas de cron do domínio não têm teste algum"* (achado 18) — ampliou a caracterização além do que a T4 previa.
  5. *"Não faz sentido o Frappe ficar por semanas, já que ele não é backend SaaS"* (usuário, no meio da convergência) — derrubou a janela de rollback por tempo do `plano-execucao.md`. O argumento se reforça com um fato que o plano não conectava: **sem migração de dados, as duas bases divergem no instante seguinte à virada**. A rede de segurança deixou de ser uma stack de pé e virou um dump preservado.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — 5 ramos explorados, 9 fatias no escopo inicial | confirmado (Fase 1 + Fase 2) |
| Personas | **múltiplas** — Sysloc Master, Admin Empresa, Usuário Empresa, dev/operador | confirmado (decisão 38 + plano mestre §0.5) |
| Novidade | **greenfield** — `apps/` e `packages/` vazios; nenhuma linha de código no repositório | confirmado (`CLAUDE.md` — "Fase 0 não iniciada") |
| Decisão arquitetural transversal nova? | **sim** — forma do contrato de API, isolamento por RLS + FK composta + `AsyncLocalStorage`, `better-auth` para identidade com autorização 10×7 própria, webhook como gatilho com API como verdade, contador `seu_numero` único do SaaS, modelo canônico generalizado para meio de recebimento | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — **aplicado por fatia, nunca ao programa inteiro**, conforme a tabela C2 (miniSpec em `fundacao-stack-nativa`, `automacoes-agendadas` e `virada-e-desinstalacao`; TaskCard em `caracterizacao-regras-legadas`; handoff + especificação executável em `frontend-religado`).

**Justificativa**: as duas dimensões decisivas são **personas múltiplas** e **greenfield** — três perfis com uma matriz fechada de 10 telas × 7 ações sensíveis, sobre um repositório sem uma linha de código. Somam-se seis decisões arquiteturais transversais novas, cada uma candidata a ADR. Nada disso cabe em miniSpec. Mas o programa **não roda como um único SDD**: um `task_plan` cobrindo 9 fatias teria dezenas de tasks, sem fase de aceitação intermediária, e o `_run/` viraria ilegível. A recomendação é, portanto, **SDD por fatia de domínio, com o peso rebaixado onde não há persona**.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o miniSpec (`intent` → `scope` → `tasks`) não comporta o PRD com histórias de usuário por perfil que a matriz 10×7 exige, nem a rastreabilidade `US → CA → task` necessária quando três personas têm visões diferentes do mesmo dado. E não tem o gancho de detecção de ADR que as seis decisões transversais deste programa precisam. Ele **é** adequado — e foi escolhido — nas três fatias sem persona (`fundacao-stack-nativa`, `automacoes-agendadas`, `virada-e-desinstalacao`), onde há entregas e CA claros mas nenhuma história de usuário legítima.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por várias ordens de grandeza. Uma única fatia (`dominio-locacao`) já traz 8 entidades, 3 regras portadas e os primeiros contratos ts-rest. TaskCard é adequado apenas em `caracterizacao-regras-legadas`, que é um objetivo único, só dev, sem decisão nova, e cuja `T4.md` já existe praticamente pronta.

### 15.4 Próximo Passo

Há **decisão arquitetural transversal nova** — a forma do contrato da API (ramo B / B2.2). Ela vem antes de qualquer spec de entidade:

```bash
# 1º — a decisão de forma do contrato, transversal a todas as fatias de domínio
/agent-spec-adr-create "forma canonica do contrato da API do backend novo"

# 2º — a fatia com prazo de validade: roda contra o Frappe ainda vivo
/agent-spec-taskcard-generate "caracterizar regras de negocio legadas contra o Frappe vivo — metragem, texto do PDF de contrato e as 3 rotinas de estado idempotentes"

# 3º — a primeira fatia de código: stack instalada e provada, zero regra de negocio
/agent-spec-minispec-generate-intent "fundacao da stack nativa instalada e provada"

# 4º — a fatia que justifica a troca de backend (após 1 e 3)
/agent-spec-sdd-generate-prd "fundacao multi-tenancy e identidade do SaaS"
```

Os passos 1 e 2 são independentes entre si e podem correr em paralelo. O passo 3 não depende de nenhum dos dois. O passo 4 exige o ADR do passo 1 fechado e a F0 aceita.

**Ações paralelas registradas** (não são fatias deste programa): rotacionar a credencial exposta (dúvida 8) · depreciar formalmente as ADR-0002 e ADR-0003 e resolver o destino da ADR-0004 (dúvida 7) · criar o remoto git próprio (dúvida 6).

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (de miniSpec para SDD numa fatia) se:
  - a fatia revelar uma persona que não estava prevista — por exemplo, a tela de saúde das rotinas (decisão 31) trouxer o operador do SaaS como usuário direto da `automacoes-agendadas`;
  - emergir decisão arquitetural transversal não prevista nas seis já mapeadas;
  - a fatia passar de ~10 tasks no `task_plan`, sinal de que o recorte por capacidade ficou grosso demais.
- **Downgrade** (de SDD para miniSpec) se:
  - na entrada da fatia (válvula C3) o escopo se fechar a um único módulo sem decisão nova — por exemplo, a `integracao-bancaria-sicoob` se revelar porte quase mecânico do adaptador existente, com a ADR-0001 já respondendo todas as decisões de forma;
  - a fatia não introduzir nenhuma entidade nem contrato novo, apenas religando o que já existe.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com PRDs/capacidades concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar PRD / INTENT / TaskCard
