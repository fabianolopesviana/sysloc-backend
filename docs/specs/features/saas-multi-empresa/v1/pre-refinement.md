# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário ou verificado no projeto).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `saas-multi-empresa` — Refactory SaaS multi-empresa do sistema de locação
- **Fonte da ideia**: `/opt/frappe/.claude/plans/plano-saas.md` (plano mestre) + `/opt/frappe/.claude/plans/plano-saas-decisoes.md` (40 decisões fechadas)
- **Autor**: sysloc
- **Data**: 2026-07-27
- **Versão**: v1
- **Status**: Refinado — pronto para próxima etapa
- **Relacionados**:
  - `docs/specs/features/integracao-bancaria-configuravel/v1..v6` — feature adjacente, é o subsistema que a fase F5/F6 vai tenantizar
  - `docs/adr/0001` — Modelo canônico de cobrança bancária com adaptador por provedor
  - `docs/adr/0002` — Versionar estrutura de dados do app em arquivo (é a decisão que a fase F1 executa)

---

## 2. Ideia Resumida (uma frase)

Transformar o sistema de locação de imóveis (Frappe/ERPNext v15 + SPA React), hoje single-tenant e com a credencial do `Administrator` exposta no bundle público, em um SaaS multi-empresa e multi-usuário para 20–300 imobiliárias — com isolamento lógico por empresa verificado por testes, sessão real e painel de administração próprio — executando o plano de backend em fases e entregando ao frontend um contrato de integração completo ao final.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

> Os rumos de alto nível que enquadram a entrega do ponto de vista de produto. As 40 decisões já fechadas no plano **não** foram re-litigadas — o brainstorm explorou como o plano vira entrega no pipeline e como o handoff nasce.

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Fatiamento da entrega — F0–F8 como uma feature ou várias versões | explorar |
| B | Ponto de corte que destrava o frontend | explorar |
| C | Cadência e forma do handoff backend → frontend | explorar |
| D | Contrato de identidade/permissão exposto ao frontend | explorar |
| E | Painel Master — entrega junto ou produto separado | explorar |

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Fatiamento da entrega

**Direções candidatas:**

- **A1 — Uma feature SDD única** cobrindo F0–F8.
  - _Exemplo:_ `saas-multi-empresa/v1/` com um `tech_spec.md` que vai da allowlist do nginx até o webhook do Sicoob, e um `task_plan.md` de ~60–80 tasks.
  - _Viabilidade:_ o pipeline suporta, mas o precedente do repositório é de 13 tasks (`integracao-bancaria-configuravel/v1`). Um tech_spec que cubra nginx, DocTypes, sessão, tenancy, mTLS e cron simultaneamente perde utilidade como contrato de execução.
- **A2 — Uma versão por bloco coeso, sob uma feature guarda-chuva.**
  - _Exemplo:_ `saas-multi-empresa/` → `v1` = F1+F2 · `v2` = F3+F4 · `v3` = F5+F6 · `v4` = F7+F8.
  - _Viabilidade:_ reusa exatamente o padrão já praticado no repositório (`integracao-bancaria-configuravel` v1→v6). Cada versão tem QA e Tech Review próprios e pode gerar handoff.
- **A3 — Features distintas por domínio**, cada uma com seu `v1`.
  - _Exemplo:_ `contencao-seguranca/`, `fundacao-versionavel/`, `multi-tenancy/`, `integracao-por-empresa/`, `automacoes-multi-tenant/`, `painel-master/`.
  - _Viabilidade:_ nomes mais legíveis e glossário por domínio, mas nenhum artefato amarraria F0→F8 — a rastreabilidade do refactory dependeria de um índice mantido à mão.

**Direção escolhida**: **A2 com F0 extraído como TaskCard à parte**. F0 (allowlist no nginx, criar usuário de serviço, rebuild do frontend, revogar credencial do `Administrator`, `developer_mode: 0`, remover `.map` e dumps) é **runbook de operação sobre a produção atual**: não produz contrato, não tem modelagem de domínio e não se beneficia de Tech Review arquitetural. A v1 fica com F1 (versionar os 19 DocTypes e migrar os 6 Server Scripts) + F2 (infraestrutura).

**Podadas / adiadas**: A1 (task_plan grande demais para execução orquestrada e tech_spec sem foco); A3 (perde a rastreabilidade única do refactory; exigiria índice manual).

**Mapa da entrega convergido:**

| Artefato | Fases do plano | Conteúdo |
|---|---|---|
| TaskCard `contencao-credencial-exposta` | F0 | Allowlist nginx, usuário de serviço, rebuild sem sourcemap, revogação da credencial, limpeza de dumps |
| `saas-multi-empresa/v1` | F1 + F2 | 19 DocTypes versionados, 6 Server Scripts migrados, remoção do `frappe-staging`, disco, stack nova, cron versionado |
| `saas-multi-empresa/v2` | F3 + F4 | Sessão nativa, aposentadoria do DocType `Usuario`, `Empresa`/`Acesso Usuario App`/`Execucao Rotina`, enforcement em 7 camadas, auditoria dos 28 `ignore_permissions`, suíte de isolamento |
| `saas-multi-empresa/v3` | F5 + F6 | Configuração e integração bancária por empresa, contador `seu_numero` único do SaaS, webhook Sicoob, reconciliação diária |
| `saas-multi-empresa/v4` | F7 + F8 | Despachante por horário, alertas e tela de saúde, backend do painel Master, virada |
| `painel-master/v1` (feature separada) | — | App React do Master em `syslocadmin.systera.com.br` (ver Ramo E) |

### Ramo B — Ponto de corte que destrava o frontend

**Direções candidatas:**

- **B1 — Um corte só:** frontend começa depois de F8.
  - _Exemplo:_ o desenvolvedor do React fica parado até o backend completar as oito fases.
  - _Viabilidade:_ inviável na prática — F0 **já obriga** a mexer no frontend (rebuild com a credencial do usuário de serviço e `GENERATE_SOURCEMAP=false`).
- **B2 — Dois cortes:** F3 destrava auth/guard/401; F8 destrava permissões e master.
  - _Exemplo:_ com o contrato de login/CSRF em mãos, o frontend executa os itens 1–5 e 7 do §2.2 do plano enquanto o backend roda F4–F7.
  - _Viabilidade:_ F4 não altera o contrato de login, apenas o conteúdo do objeto de sessão — o corte é limpo.
- **B3 — Três cortes:** F0 → F3 → F8.
  - _Exemplo:_ o toque de F0 no frontend vira entrega declarada, não efeito colateral esquecido.
  - _Viabilidade:_ reflete o que a execução impõe; custo é uma instrução curta a mais.

**Direção escolhida**: **B3 — três cortes**, com o primeiro sendo uma instrução de poucas linhas dentro do TaskCard de F0 (não um handoff formal), e os outros dois sendo handoffs gerados pela skill.

| Corte | Gatilho | O que o frontend passa a poder fazer |
|---|---|---|
| 1 | TaskCard F0 concluído | Rebuild com credencial do usuário de serviço e `GENERATE_SOURCEMAP=false` (itens 1 do §2.2) |
| 2 | `v2` concluída (F3+F4) | Sessão por cookie com CSRF, guard de rota real, interceptor 401/403, reescrita do estado de auth, ocultação de URL, menu filtrado por permissão, remoção do gate cosmético (itens 2–7 do §2.2) |
| 3 | `v4` concluída (F7+F8) | Handoff consolidado + contrato dos endpoints do Master, insumo da feature `painel-master/v1` (item 8 do §2.2) |

**Podadas / adiadas**: B1 (ignora que F0 exige rebuild do frontend); B2 (correta em espírito, mas deixa o toque de F0 sem registro).

### Ramo C — Cadência e forma do handoff

**Direções candidatas:**

- **C1 — Handoff único ao fim**, gerado sobre o tech_spec da última versão.
  - _Exemplo:_ `saas-multi-empresa/v4/handoff-frontend.md` como único documento.
  - _Viabilidade:_ a skill `/agent-spec-backend-contract-handoff` consome **um** artefato de spec por execução — o handoff da v4 não enxergaria o contrato de login definido na v2. Contrato incompleto por construção.
- **C2 — Um handoff por versão + um consolidado final.**
  - _Exemplo:_ `v2/handoff-frontend.md` (login, CSRF, 401/403, objeto de sessão) · `v3/handoff-frontend.md` (integração bancária por empresa) · `v4/handoff-frontend.md` consolidado — este é o "handoff completo" pedido.
  - _Viabilidade:_ cada versão fecha com QA e Tech Review, e a skill roda naturalmente sobre o `tech_spec.md` daquela versão. Há precedente no repositório (`integracao-bancaria-configuravel/v1/handoff-frontend.md`).
- **C3 — Contrato de API vivo desde F3**, com o handoff final sendo sua curadoria.
  - _Exemplo:_ um `contrato-api-saas.md` atualizado a cada fase — há precedente (`contrato-verificar-saude-integracao.md`).
  - _Viabilidade:_ funciona, mas cria artefato fora do pipeline, que depende de disciplina manual para não divergir do código.

**Direção escolhida**: **C2**. Entrega o handoff completo pedido sem inventar artefato fora do framework, e cada handoff intermediário destrava trabalho de frontend em paralelo.

**Podadas / adiadas**: C1 (contrato incompleto — perde o login da v2); C3 (artefato fora do pipeline, sujeito a drift).

**Nota de execução** _(corrigida em 2026-07-28)_: a v1 (F1+F2) **gera handoff**. A suposição original era de que versionar DocTypes e montar infraestrutura não tocaria contrato algum; a verificação da seção 12.1 refutou isso. A migração dos 4 Server Scripts de API (`Todos imoveis`, `Atualizar cômodo`, `Automacao cobranca config api`, `Autenticacao`) para `@frappe.whitelist()` **muda** o path chamado pelo frontend, salvo se a v1 decidir preservar os nomes curtos por compatibilidade — decisão que o PRD precisa tomar explicitamente.

### Ramo D — Contrato de identidade e permissão exposto ao frontend

**Direções candidatas:**

- **D1 — Sessão "gorda"**: um endpoint devolve empresa, perfil, as 10 telas liberadas e as 7 ações sensíveis como flags.
  - _Exemplo:_ `{empresa:{id,"nome_fantasia"}, perfil:"Admin Empresa", telas:["resumo","imoveis","financeiro"], acoes:{emitir_boleto:true, cancelar_contrato:false, ...}}`
  - _Viabilidade:_ o DocType `Acesso Usuario App` previsto na F4 (child table de telas + checks das 7 ações) **já é essa estrutura** — é serialização direta, custo próximo de zero.
- **D2 — Sessão magra**: devolve só identidade; o frontend descobre permissão levando 403.
  - _Exemplo:_ o menu mostra todas as 10 áreas e a tela devolve erro ao ser aberta.
  - _Viabilidade:_ contradiz o §2.2 item 6 do plano ("esconder o que não é permitido") e a decisão 38.
- **D3 — D1 acrescido de uma versão do contrato de permissão**, para o menu não ficar obsoleto durante as 8 horas de sessão.
  - _Exemplo:_ o Admin remove "emitir boleto" de um usuário; na requisição seguinte o frontend detecta `versao_permissoes` diferente e recarrega o menu, sem precisar deslogar.
  - _Viabilidade:_ incremento barato sobre D1. Sem ele, um usuário com permissão revogada continua vendo o botão por até 8 horas.

**Direção escolhida**: **D1 como base + D3 como incremento, ambos na v2**. Coerência com a decisão 11 (revogação de empresa bloqueia na hora, matando sessões ativas): seria incoerente garantir imediatismo para empresa e aceitar 8 horas de defasagem para permissão de usuário.

**Podadas / adiadas**: D2 (contradiz decisão 38 e o requisito de ocultar o não-permitido).

### Ramo E — Painel Master

**Direções candidatas:**

- **E1 — Master é a v4**: backend na v4 e app React master descrito como item 8 do handoff consolidado.
  - _Exemplo:_ tudo sob `saas-multi-empresa/v4/`.
  - _Viabilidade:_ coerente com o fatiamento, mas mistura dois produtos num único ciclo de spec.
- **E2 — Backend na v4; o app master vira feature de produto própria.**
  - _Exemplo:_ `docs/specs/features/painel-master/v1/` com PRD próprio — persona distinta (o operador do SaaS), domínio distinto (`syslocadmin.systera.com.br`), ciclo de vida distinto, e alimentado pelo contrato dos endpoints do Master entregue no handoff da v4.
  - _Viabilidade:_ é de fato outro produto — outro app, outro domínio, outra persona. Custo é mais um PRD.
- **E3 — Não construir app master: usar o Desk do Frappe restrito ao papel `Sysloc Master`.** `[provocação]`
  - _Exemplo:_ o Master acessa o domínio e cai no Desk do Frappe com DocPerm apenas em `Empresa` e `Acesso Usuario App`; criar/suspender/reativar empresa passam a ser o formulário nativo mais um botão.
  - _Viabilidade:_ tecnicamente sólido — o Desk exige `System User`, **não** exige `System Manager` nem `Administrator`, então a decisão 16 e a análise da §0.2 do plano continuam de pé. Eliminaria a entrega 8 do §2.2 por inteiro. Custo: a interface é a do Frappe, não a do produto.

**Direção escolhida**: **E2** — o app master é feature de produto própria (`painel-master/v1`), especificada **depois** da v4, consumindo o contrato de endpoints do Master entregue no handoff consolidado.

**Podadas / adiadas**: E1 (mistura dois produtos num ciclo só); E3 (rejeitado — a interface do Desk não atende ao padrão do produto; registrado como alternativa de contingência caso o esforço do app master se mostre proibitivo).

---

## 5. Problema

**Qual é a dor real hoje?**
O sistema atende **uma** imobiliária e é single-tenant por construção — não existe conceito de empresa em nenhum ponto do modelo de dados, das permissões, das automações ou do frontend. Simultaneamente, a segurança está comprometida em nível crítico: a `api_key`/`api_secret` do `Administrator` está em texto claro no bundle JavaScript público, os source maps de produção (16 MB, com `sourcesContent`) expõem todo o código TypeScript, o login é cosmético (`localStorage.getItem('usuario') !== null`) e a senha é reversível, comparada em texto plano.

**Como o problema aparece no dia a dia?**
- Qualquer visitante do site extrai a credencial do bundle e controla o ERPNext inteiro — não é preciso nem abrir o app.
- Uma linha no console do navegador autentica qualquer pessoa na aplicação.
- Não há como cadastrar uma segunda imobiliária: os dados se misturariam, o certificado do Sicoob de uma empresa emitiria boleto pela outra (fallback global RN-10), e o cron de automação rodaria a régua de cobrança de todo mundo junto.
- 19 DocTypes de negócio existem **só no banco** (`custom=1`) e 6 Server Scripts carregam lógica de negócio viva fora do git — não há como adicionar o campo `empresa`, testar isolamento ou reproduzir o ambiente.

**Quem sente o impacto?**
Hoje: o operador do SaaS (risco reputacional e legal de vazamento) e a imobiliária cliente (dados expostos). Amanhã: cada nova imobiliária que não pode ser atendida, e os locatários/locadores cujos dados financeiros circulariam sem isolamento.

**Por que resolver agora?**
A credencial exposta é explorável neste momento. E o crescimento para 20–300 clientes está bloqueado por construção — nenhuma venda nova pode ser atendida sem o refactory.

---

## 6. Objetivo Principal

**Resultado esperado ao final:**
Um SaaS multi-empresa operacional para 20–300 imobiliárias, com telas e dados realmente protegidos, isolamento entre empresas garantido e **provado por suíte de testes**, caminho das telas oculto, painel próprio de administração do SaaS, automações que sabem para qual cliente executar, e um contrato de integração completo entregue ao frontend.

**Mudança de comportamento/estado:**
- De "credencial de administrador pública" para "sessão real com cookie httpOnly, lockout e 2FA para o Master".
- De "um banco, uma imobiliária" para "um banco, N imobiliárias com isolamento lógico verificado em 7 camadas".
- De "19 DocTypes e 6 Server Scripts invisíveis ao git" para "todo o schema e toda a lógica reconstruíveis por `bench migrate` num site vazio".
- De "cron global que varre tudo a cada minuto" para "despachante que consulta apenas quem tem horário agora".
- De "plano em markdown" para "quatro versões de spec executadas com QA e Tech Review, mais handoff auditável para o frontend".

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Operador do SaaS** (Sysloc Master) — cadastra, suspende e reativa empresas, cria o Admin inicial de cada uma. Não acessa nenhum dado de negócio, por construção e por teste.
- **Persona secundária**: **Admin da Empresa** — gestor da imobiliária; tudo dentro da própria empresa mais gestão dos usuários dela.
- **Persona terciária**: **Usuário da Empresa** — acesso conforme liberação por tela e por ação sensível.
- **Persona indireta**: **Locatário** — recebe a régua de cobrança por e-mail (remetente único do SaaS com o nome fantasia da empresa) e acessa o boleto por link `allow_guest`.
- **Contexto de uso**: navegador desktop, SPA React em `sysloc.systera.com.br`; painel do Master em `syslocadmin.systera.com.br` (domínio separado, não divulgado).

---

## 8. Escopo Inicial (resultado da convergência)

O escopo convergido é o **fatiamento da execução do plano**, não uma redefinição do plano:

- [ ] **TaskCard `contencao-credencial-exposta`** (F0) — runbook de contenção sobre a produção atual, na ordem obrigatória: allowlist → usuário de serviço → rebuild → revogação → limpeza.
- [ ] **`saas-multi-empresa/v1`** (F1+F2) — 19 DocTypes versionados no módulo do app, 6 Server Scripts migrados para código, remoção completa do `frappe-staging`, liberação de disco medida, stack nova, cron versionado em `/etc/cron.d`.
- [ ] **`saas-multi-empresa/v2`** (F3+F4) — sessão nativa com CSRF, aposentadoria do DocType `Usuario` e dos dois autenticadores duplicados, DocTypes `Empresa`/`Acesso Usuario App`/`Execucao Rotina`, enforcement em 7 camadas, auditoria dos 28 `ignore_permissions`, suíte de isolamento parametrizada e teste-guarda. **Inclui o objeto de sessão "gordo" com `versao_permissoes` (D1+D3).**
- [ ] **`saas-multi-empresa/v3`** (F5+F6) — integração bancária por empresa, remoção do fallback global de certificado, contador `seu_numero` único do SaaS, webhook Sicoob com API como fonte da verdade, reconciliação diária.
- [ ] **`saas-multi-empresa/v4`** (F7+F8) — despachante por horário, `Execucao Rotina`, alertas e tela de saúde, endpoints do Master, suspensão com encerramento imediato de sessão, virada.
- [ ] **Handoffs** — `v1/handoff-frontend.md` (novos paths dos 4 endpoints migrados de Server Script, **se** a decisão for não preservar compatibilidade — ver 12.1), `v2/handoff-frontend.md` (auth e permissões), `v3/handoff-frontend.md` (integração), `v4/handoff-frontend.md` **consolidado e completo**.
- [ ] **`painel-master/v1`** — feature de produto separada para o app React do Master, especificada após a v4.

---

## 9. Fora do Escopo (podado / adiado)

- **Billing, planos e self-service de assinatura** — declarado fora do escopo de SaaS no plano; o cadastro de empresa é feito pelo Master.
- **API Pix própria (`cob`/`cobv`/`lotecobv`/`pix`)** — adiado (decisão 18). O modelo canônico nasce generalizado para *meio de recebimento*, mas o Pix não é implementado. O sistema já recebe via Pix hoje pelo QR vinculado ao boleto (`codigoCadastrarPIX: 1`).
- **Criptografia por campo e auditoria de acesso técnico** — descartado por decisão explícita (decisão 16). Consequência declarada: quem tem root no servidor ou no banco lê os dados de qualquer empresa.
- **Banco por cliente** — descartado (decisão 2): a escala de 20–300 justifica isolamento lógico, não físico.
- **Migração para o agendador nativo do Frappe (`scheduler_events`)** — recusada (decisão 26) por experiência real de parada silenciosa em produção. Mantém-se o cron do sistema operacional, agora versionado.
- **Fase de ensaio dedicada da virada** — descartada (decisão 40). Mitigação: a migração é exercitada repetidamente durante as v1–v4.
- **Painel Master no Desk do Frappe (E3)** — descartado nesta rodada; registrado como contingência caso o esforço do app próprio se mostre proibitivo.
- **Reenvio retroativo da régua de e-mail na reativação** — descartado (decisão 29): evita que um locatário receba dezenas de avisos vencidos de uma vez, o que, com remetente único do SaaS, provocaria reação de spam atingindo todos os clientes.
- **Status intermediário de pagamento ("Pagamento em confirmação")** — descartado (decisão 19): a API como fonte da verdade (decisão 20) já impede marcar `Paga` a partir de mera intenção de pagamento.

---

## 10. Ancoramento no Projeto (guarda de escopo)

**O que o projeto É**: repositório de deploy Docker Compose de um sistema de locação de imóveis sobre Frappe/ERPNext v15, com app customizado `locacao_automation` (bind-mount de `app-sync/locacao_automation`) e SPA React servida por nginx. Não há `CLAUDE.md` nem `README.md` na raiz — o `README.md` do app está em `app-sync/locacao_automation/README.md`.

**PRDs / specs existentes consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md`):

- `prds/features/integracao-bancaria-configuravel/v1/prd.md` + `specs/features/integracao-bancaria-configuravel/v1/` (SDD completo: tech_spec, task_plan, 13 tasks, tech-alignment, handoff-frontend, plano-frontend) — **adjacente e diretamente impactada**: é o subsistema que a v3 (F5+F6) vai tenantizar. O `handoff-frontend.md` desta feature é o **formato de referência** para os handoffs do refactory.
- `specs/features/integracao-bancaria-configuravel/v2-debits` a `v6-debits` (miniSpecs de incremento e resolução de débito) — **precedente do padrão de versionamento** adotado no Ramo A.
- `specs/features/integracao-bancaria-configuravel/v1/contrato-verificar-saude-integracao.md` — precedente de contrato como artefato próprio (base da direção C3, podada).
- `specs/domain-glossary.md` (global) e `specs/features/integracao-bancaria-configuravel/domain-glossary.md` (feature) — vocabulário a reusar; `Empresa` será termo novo, candidato ao glossário **global**.

**Capacidades reutilizáveis** (apenas para viabilidade):

- **Persistência / identidade**: `User`, sessão nativa (`/api/method/login`, cookie `sid`), `Activity Log`, hash, rate limit, lockout, reset e 2FA — tudo nativo do Frappe, nada a construir (F3).
- **Autorização**: `permission_query_conditions` e `has_permission` são hooks nativos; `hooks.py` hoje tem 16 linhas e usa apenas `doc_events`, então não há base a migrar — só a construir.
- **Integração bancária**: porta `AdaptadorCobrancaBancaria` (ADR-0001) já isola o provedor; `cobranca_sicoob/sincronizacao.py` já implementa a regra de reversão de status (`_status_aberto_para_cobranca()`, linhas 66-71) que a decisão 19 exige; `Cobranca Integracao Sicoob` já prevê `origem_evento='webhook'` (nunca usado); `Cobranca` já tem `numeroIdentificadorBaixa` para idempotência.
- **Testes**: suíte de ~4.400 linhas em 16 arquivos com convenção de rastreabilidade `CA-xx → CT-xxx (RN-xx)` e seção de INVARIANTES por arquivo — os testes novos devem manter a convenção. Execução via `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation`.
- **Framework de specs**: skill `/agent-spec-backend-contract-handoff` já existe e exige `tech_spec.md`/`scope.md`/TaskCard como entrada — foi o que determinou a forma do Ramo C.

**Conflitos / sobreposições detectados**:

- **ADR-0008 não existe neste repositório.** O plano afirma que a adoção de sessão nativa "supera o ADR-0008", mas `docs/adr/` contém apenas `0001` e `0002`, e `grep -rn "0008" docs/` não retorna nada. Ver `[DÚVIDA]` #1.
- **ADR-0002 já é a decisão que a F1 executa** — versionar a estrutura de dados em arquivo. A v1 é a **execução** de um ADR aceito, não uma decisão nova; portanto **não requer ADR novo**.
- **Sobreposição com `integracao-bancaria-configuravel`**: a v3 altera `Configuracao Integracao Bancaria`, `sequencial.py`, `emissao.py` e o fluxo de sincronização — código com spec e testes já estabelecidos. Não é conflito, é evolução; exige que a v3 leia as specs existentes antes de reescrever regras.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` O DocType `Acesso Usuario App` (child table de telas + checks das 7 ações) serializa diretamente para o objeto de sessão consumido pelo frontend, sem camada de tradução — base do custo "próximo de zero" atribuído à direção D1.
- **A v1 (F1+F2) ALTERA o contrato consumido pelo SPA e portanto GERA handoff.** Hipótese anterior refutada por verificação em 2026-07-28 (detalhe na seção 12.1). Os 4 Server Scripts de API expõem `api_method` curtos — `auth_locacao_imoveis`, `all_imoveis`, `atualizar_comodo`, `automacao_cobranca_config_api` — e o bundle publicado chama exatamente esses paths (`"method/all_imoveis"` etc.). Um `@frappe.whitelist()` responde em `/api/method/locacao_automation.<modulo>.<funcao>`, path estruturalmente diferente. Os mesmos 4 nomes estão na allowlist do nginx da TC-001, então a migração também exige reescrever a barreira de rede.
- `[HIPÓTESE]` A feature `painel-master/v1` só pode ser especificada após a v4, porque depende do contrato de endpoints do Master definido em F8.
- `[HIPÓTESE]` O volume atual (15 Cobranças, 1 Contrato, 22 Imóveis, 24 Locatários, 3 Locadores) torna os patches de carimbo da Empresa #1 triviais em tempo de execução — a migração de dados não é gargalo.
- `[HIPÓTESE]` A decisão de planejar tudo antes de executar mantém a credencial do `Administrator` exposta durante todo o período de planejamento. Ver `[DÚVIDA]` #6.

**Decisões já tomadas (fora de negociação)**:

- Isolamento lógico por `empresa`, não banco por cliente (escala 20–300).
- Clientes em `sysloc.systera.com.br`; painel master em `syslocadmin.systera.com.br`.
- Aposentar o DocType `Usuario`; adotar `User` nativo com sessão real por cookie `sid` httpOnly.
- Master SaaS **não pode ser** `Administrator` nem `System Manager` — `permissions.py:85` curto-circuita o hook `has_permission` para o `Administrator`.
- Isolamento exige **as duas** camadas (`permission_query_conditions` + `has_permission`), nunca uma só.
- Confidencialidade garantida **apenas na aplicação**: sem criptografia por campo, sem auditoria de acesso técnico. Root/DBA lê os dados de qualquer empresa.
- Manter o cron do sistema operacional como gatilho das automações — o agendador do Frappe já parou sem aviso em produção.
- Cron versionado no repositório, instalado por script idempotente em `/etc/cron.d`.
- Remover o fallback global de certificado (RN-10): ausência de certificado próprio passa a falhar explicitamente.
- Webhook é gatilho; a API autenticada por mTLS é a fonte da verdade.
- Roteamento do webhook por `seu_numero`; a empresa é derivada do documento encontrado, nunca do payload.
- Contador `seu_numero` é único do SaaS, em linha própria, fora da configuração da empresa.
- URL única de webhook para todas as empresas; bloqueio de empresa suspensa é lógico.
- Notificação bancária de empresa suspensa é registrada sempre e aplicada na reativação.
- Régua de e-mail não é reenviada retroativamente na reativação.
- Senha mínima de 10 caracteres com verificação de força, bloqueio após 5 tentativas, sessão de 8h renovável, 2FA obrigatório para o Master.
- Admin inicial recebe senha temporária do Master com troca obrigatória; demais usuários seguem a mesma mecânica pelo Admin da empresa.
- Permissão por tela (10 áreas) e por ação sensível (7 ações).
- Virada direta, sem fase de ensaio dedicada; stack antiga mantida desligada e intacta como rollback por semanas.
- `frappe-staging` pode ser excluído por completo.
- Manter o Gmail atual, com alerta quando o envio falhar por limite do provedor.
- Os 19 DocTypes vão para o módulo do app, junto com os dois já versionados.
- Planejar todo o refactory antes de iniciar a execução (definido nesta sessão).

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o Admin da imobiliária pode achar a granularidade de 10 telas × 7 ações complexa demais para administrar. → _Mitigação:_ os três perfis (`Sysloc Master`, `Admin Empresa`, `Usuario Empresa`) trazem um default sensato; o ajuste fino por usuário é opcional, não obrigatório.
- **Risco de escopo (explosão)**: oito fases, quatro versões de spec e uma feature adicional de frontend. Cada versão pode gerar débito que vira `vN-debits`, como já ocorreu em `integracao-bancaria-configuravel` (v2, v4 e v6 são todas `-debits`). → _Mitigação:_ fatiamento A2 com gates de QA e Tech Review por versão; nenhuma versão começa sem a anterior verificada; débito anotado é resolvido por `/agent-spec-debt-resolution` em lote.
- **Risco de segurança — janela de exposição**: a decisão de planejar tudo antes de executar mantém a credencial do `Administrator` pública durante o período de planejamento. → _Mitigação:_ o TaskCard de F0 é independente das versões e **pode ser executado a qualquer momento** sem esperar o restante do planejamento. Recomendação explícita: executá-lo assim que estiver gerado.
- **Risco técnico — virada sem ensaio dedicado** (decisão 40, aceita). → _Mitigação declarada:_ a migração é exercitada repetidamente durante v2–v4 para gerar massa de teste, produzindo ensaios de fato; a stack antiga fica desligada e intacta como rollback.
- **Risco técnico — DocType futuro nascendo sem `empresa`**: um DocType criado depois do refactory vazaria silenciosamente entre empresas. → _Mitigação:_ teste-guarda que enumera os DocTypes do módulo e falha se algum não estiver classificado como tenantizado ou global-com-justificativa (previsto na F4).
- **Risco técnico — `seuNumero` truncado pelo Sicoob**: o exemplo da documentação traz `"seuNumero": "00-03"`, muito menor que os 18 caracteres usados em produção. Se o campo truncar, a chave de roteamento do webhook (decisão 24) cai. → _Mitigação:_ validação obrigatória contra um boleto real **antes** de apostar nele como chave (previsto na F6, e é pré-condição da v3).
- **Risco operacional — disco**: 79% de uso, 6 GB livres, para montar uma segunda stack completa. → _Mitigação:_ liberação medida antes e depois na F2, com remoção completa do `frappe-staging`.
- **Risco de privacidade declarado e aceito**: root/DBA lê os dados de qualquer empresa (decisão 16). Sem tratamento — é limite físico, não configurável.

---

## 12.1 Levantamento de pré-condição da v1 (2026-07-28)

> Verificação executada contra a produção real após o encerramento da TC-001, para responder à condição de reconsideração da seção 15.5 — *"a v1 se mostrar puramente mecânica após o levantamento"*. **Conclusão: não é mecânica.** O SDD está confirmado, e os itens abaixo são insumo obrigatório do PRD.

### A. Os 4 endpoints de API mudam de path — a v1 gera handoff

Os 4 Server Scripts ativos de tipo API expõem `api_method` curtos, e o bundle publicado (`main.7154a9e7.js`) chama exatamente esses paths:

| Server Script | `api_method` | Chamada no bundle | Na allowlist do nginx (TC-001) |
|---|---|---|---|
| `Autenticacao` | `auth_locacao_imoveis` | `"method/auth_locacao_imoveis"` | sim |
| `Todos imoveis` | `all_imoveis` | `"method/all_imoveis"` | sim |
| `Atualizar cômodo` | `atualizar_comodo` | `"method/atualizar_comodo"` | sim |
| `Automacao cobranca config api` | `automacao_cobranca_config_api` | `"method/automacao_cobranca_config_api"` | sim |

Migrar para `@frappe.whitelist()` move o endpoint para `/api/method/locacao_automation.<modulo>.<funcao>`. Três consequências que o PRD precisa resolver: (1) o SPA quebra nos 4 endpoints se nada for feito; (2) a allowlist do nginx exige reescrita, `docker restart sysloc-react-1` e revalidação dos AC-02/AC-03/AC-13 da TC-001; (3) há a alternativa de **preservar os paths curtos** por compatibilidade (`override_whitelisted_methods` ou equivalente), que evita (1) e (2) ao custo de manter nomes sem namespace. **É decisão de arquitetura evergreen — candidata a ADR.**

### B. Seis decisões de modelagem no inventário dos 19 DocTypes

| DocType | Registros | Fato apurado | Decisão exigida |
|---|---|---|---|
| `Proprietario` vs `Locador` | 1 vs 3 | 14 campos estruturalmente idênticos (só muda o prefixo do nome/tipo); `modified` com 3 segundos de diferença — clonagem. `Proprietario` tem zero referências no código do app e zero no bundle | Consolidar ou perpetuar a duplicação; destino do registro órfão |
| `Configuracao Integracao Sicoob` | 1 | Referenciado apenas em arquivos `.bak-*`. O código vivo usa `Configuracao Integracao Bancaria` (29 campos, já versionada), canônica pelo ADR-0001 | Versionar um DocType que o ADR-0001 superou, ou descartar |
| `INATIVO` e `INATIVO_2` | 0 e 0 | `custom=0` no módulo antigo, 1 campo (Section Break), **sem arquivo correspondente no app** — estado inconsistente. Um `migrate` em site vazio não os recriaria | Descarte formal, senão o critério de aceitação da F1 ("reconstrói **todo** o schema") fica ambíguo |
| `Verificar scheduler` | 1 | Zero referências no código e no bundle. Resquício da investigação que originou a decisão 26 (recusar o agendador nativo) | Versionar diagnóstico morto ou descartar |
| `Usuario` | 1 | Usado em `usuario_app/service.py:29,41`. A v2 o aposenta (decisão fechada) | Versionar na v1 o que morre na v2, ou antecipar a remoção |
| `Clausulas`, `Fiadores`, `Fiador` | 0, 0, 0 | Nenhum registro | Estrutura viva ou natimorta |

### C. Dois itens de escopo não dimensionados

- **Os Server Scripts são 25, não 6.** Seis estão ativos; **19 estão desativados**, vários com equivalente já em código no app (`Cancelamento em cascata do Contrato` ↔ `contrato_cancelamento/`; `automacao_cobranca_scheduler`, 586 linhas, ↔ `cobranca_automation/`). O plano F1 trata apenas dos ativos. Definir se os 19 são descarte em bloco ou exigem auditoria item a item.
- **`PDF contrato` tem 752 linhas** e **não** possui equivalente no app (`contrato_pdf/service.py` tem 61 linhas e só expõe `abrir_contrato`). Migrar exige decidir estrutura (template, localização, estratégia de teste). Há ainda coexistência a resolver: o Server Script roda em `Contrato After Save` enquanto o app já registra `Contrato on_submit` em `hooks.py`.

### D. Efeito da TC-001 sobre as versões seguintes

A **ADR-0003** (`Custom DocPerm` como fonte única de permissão dos DocTypes de negócio), criada em 2026-07-28 durante a TC-001, é posterior a este pré-refinamento. Ela estabelece que os 9 DocTypes de negócio são regidos exclusivamente por `Custom DocPerm` — portanto **todo papel novo da v2** (`Sysloc Master`, `Admin Empresa`, `Usuario Empresa`) precisará declarar o seu explicitamente. Insumo do PRD da v2, não da v1.

### E. Crontab real do root (coletado em 2026-07-28 — resolve a `[DÚVIDA]` #2)

```cron
30 2 * * *                 /usr/local/bin/backup_frappe.sh                    >> /var/log/frappe-backup.log 2>&1
10 0 * * *                 /opt/frappe/run-cobrancas-vencidas.sh              >> /var/log/frappe-cobrancas-vencidas.log 2>&1
5 2 * * *                  /opt/frappe/run-atualizar-atrasos-cobrancas.sh     >> /var/log/frappe-atualizar-atrasos-cobrancas.log 2>&1
* * * * *                  /opt/frappe/run-locacao-automation.sh
2 0 * * *                  /opt/frappe/run-encerrar-contratos-vencidos.sh     >> /var/log/frappe-encerrar-contratos-vencidos.log 2>&1
0 0,6,9,12,15,18,21 * * *  /usr/local/bin/sincronizar-pagamentos-sicoob.sh
```

**A divergência está resolvida**: `run-cobrancas-vencidas.sh` roda às `10 0`, não `1 0`. Mas a coleta expôs quatro fatos que a documentação não registrava, todos com efeito sobre a F2:

- **São 6 entradas, e 2 apontam para fora de `/opt/frappe`.** `backup_frappe.sh` e `sincronizar-pagamentos-sicoob.sh` vivem em `/usr/local/bin` e **não estão versionados em lugar nenhum** — o levantamento E6 do plano falava apenas em `/opt/frappe/run-*.sh`. Versionar o cron em `deploy/cron/` obriga a decidir o destino desses dois scripts (versionar junto? em que diretório? como o instalador os posiciona em `/usr/local/bin`?).
- **`run-locacao-automation.sh` roda a cada minuto — 1440 execuções/dia — e não usa `flock`.** Se uma execução ultrapassar 60s, a seguinte inicia concorrente sobre o mesmo site. O `sincronizar-pagamentos-sicoob.sh` usa `flock -n`; o de maior frequência, não. Em multi-tenant (F7) o custo por execução cresce com o número de empresas, o que estreita ainda mais essa janela.
- **Os logs têm destino duplicado e nenhuma rotação.** O crontab redireciona para `/var/log/frappe-*.log`, mas os scripts também escrevem no próprio log dentro de `/opt/frappe` — daí os três arquivos de `/var/log` estarem com **0 bytes** enquanto `/opt/frappe/run-locacao-automation.log` acumula **9,7 MB** e `/var/log/sincronizar-pagamentos-sicoob.log`, **1,4 MB**. Não há regra em `/etc/logrotate.d/` para nenhum deles. A F2 prevê "rotação de log" mirando `/var/log`, mas o arquivo que mais cresce está fora de lá.
- **O disco segue em 79% com 5,9 GB livres** — o mesmo estado do levantamento original, confirmando o risco declarado na seção 12 para montar a segunda stack.

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **Onde está o ADR-0008?** O plano afirma que a sessão nativa "supera o ADR-0008", mas `docs/adr/` contém apenas `0001` e `0002`, e não há nenhuma referência a `0008` em `docs/`. É um ADR de outro repositório, uma numeração planejada mas nunca escrita, ou o plano se refere a outra coisa? Sem isso, o ADR de sessão da v2 não tem o que superar formalmente.
2. ~~`[DÚVIDA]` **Qual é o crontab real do root?**~~ **RESOLVIDA em 2026-07-28** por `sudo crontab -l`. O horário correto é `10 0 * * *`. A coleta revelou dois fatos que a documentação omitia — duas entradas fora de `/opt/frappe` e uma execução por minuto sem `flock`. Crontab integral e consequências na seção 12.1.E.
3. `[DÚVIDA]` **`codigoMotivoCancelamento: 2`** aparece no payload de exemplo do Sicoob mas não consta na lista documentada (que começa em 11). Pendência sua junto ao Sicoob (decisão 22, não bloqueia).
4. `[DÚVIDA]` **O `seuNumero` de 18 caracteres retorna íntegro da API do Sicoob?** Pré-condição da v3 — se truncar, a decisão 24 precisa ser revista antes de especificar o webhook.
5. `[DÚVIDA]` **Como o frontend detecta a mudança de `versao_permissoes`?** Header em toda resposta, campo no envelope de erro, ou requisição explícita ao endpoint de sessão? A escolha muda o contrato do handoff da v2.
6. `[DÚVIDA]` **O TaskCard de F0 será executado assim que gerado, ou também espera o planejamento completo?** A resposta define o tamanho da janela de exposição da credencial do `Administrator`.
7. `[DÚVIDA]` **Confirma o nome `saas-multi-empresa` para a feature?** Ele passa a ser o diretório de todas as quatro versões e aparece em todos os handoffs.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**:
  - A2 + F0 extraído — TaskCard de contenção + quatro versões sob `saas-multi-empresa/`.
  - B3 — três cortes de destravamento do frontend (F0, v2, v4).
  - C2 — handoff por versão (v2, v3) mais o consolidado completo na v4.
  - D1 + D3 — objeto de sessão com empresa, perfil, 10 telas, 7 ações e `versao_permissoes`.
  - E2 — app do Master como feature de produto própria (`painel-master/v1`), após a v4.

- **Descartado com justificativa**:
  - A1 (task_plan grande demais, tech_spec sem foco) e A3 (perde rastreabilidade única do refactory).
  - B1 (ignora que F0 já obriga a mexer no frontend).
  - C1 (handoff da última versão não enxerga o contrato de login da v2) e C3 (artefato fora do pipeline, sujeito a drift).
  - D2 (contradiz a decisão 38 e o requisito de esconder o não-permitido).
  - E1 (mistura dois produtos num ciclo de spec) e E3 (interface do Desk não atende ao padrão do produto — mantido como contingência).

- **Adiado**: nada foi adiado para v2 do próprio pré-refinamento. O `painel-master/v1` é sequencial por dependência (precisa do contrato da v4), não adiado por corte de escopo.

- **Provocações que mudaram o rumo**:
  - **"F0 não é feature, é runbook"** — mudou o Ramo A da opção recomendada (A2 puro) para A2 com F0 extraído como TaskCard. F0 não produz contrato nem modelagem; passar por PRD e Tech Review arquitetural seria cerimônia sem retorno.
  - **"F0 já obriga a mexer no frontend"** — matou a direção B1 e criou o terceiro corte.
  - **"A skill de handoff consome uma spec por execução"** — fato do framework que eliminou C1, que era a leitura literal do pedido original ("no final, geração do handoff completo").
  - **"Revogação de empresa bloqueia na hora, mas permissão de usuário levaria 8h"** — incoerência que trouxe D3 para dentro da v2 em vez de deixá-la como débito.
  - **E3 (Desk do Frappe)** — provocação apresentada e rejeitada, mas registrada como contingência com o custo do app próprio explicitado.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** (5 ramos convergidos; 8 fases do plano; 4 versões de spec) | confirmado |
| Personas | **múltiplas personas** (Operador do SaaS, Admin Empresa, Usuário Empresa, Locatário indireto) | confirmado |
| Novidade | **greenfield** para o núcleo (multi-tenancy, identidade e painel Master não existem em nenhuma forma) sobre base existente | confirmado |
| Decisão arquitetural transversal nova? | **sim** — 5 ADRs previstos na §0.8 do plano | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` para cada versão de `saas-multi-empresa`, precedido por um `TaskCard` isolado para a contenção (F0).

**Justificativa**: as duas dimensões decisivas são **múltiplas personas** e **decisão arquitetural nova**. O refactory introduz três perfis com fronteiras de acesso que precisam de critérios de aceitação formais e verificáveis ("o Master não alcança dado de negócio por nenhum caminho" é um CA, não um detalhe de implementação), e produz pelo menos cinco decisões arquiteturais evergreen que sobrevivem à feature. A amplitude (4+) reforça: um `intent.md` de miniSpec não comporta a matriz de 10 telas × 7 ações × 3 perfis nem a rastreabilidade `CA → CT → RN` que a suíte de isolamento exige.

**Exceção deliberada — F0 em TaskCard**: contenção de credencial é uma sequência ordenada de operações de infraestrutura sobre a produção atual, sem modelagem de domínio, sem persona nova e sem decisão arquitetural. Rodar SDD nela seria o desperdício clássico do pipeline.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o miniSpec entrega `intent.md` + `scope.md` sem PRD nem tech_spec formal. Três problemas concretos aqui: (1) não há onde registrar critérios de aceitação por persona — e o requisito central "Master enxerga vazio nos DocTypes de negócio" precisa ser CA rastreável até caso de teste; (2) o `scope.md` não comporta a especificação das 7 camadas de enforcement nem a auditoria nominal dos 28 `ignore_permissions`, que é uma lista finita a percorrer item a item com justificativa escrita; (3) o miniSpec não tem gancho formal para as 5 ADRs. O miniSpec permanece adequado, porém, para eventuais versões `vN-debits` de limpeza — exatamente como já se usou em `integracao-bancaria-configuravel`.

**Por que NÃO TaskCard** (vizinho mais distante) **para as versões**: o TaskCard é uma task isolada, por definição sem PRD e com um único ciclo de execução. A v2 sozinha cria três DocTypes, sete camadas de enforcement, uma suíte de isolamento parametrizada e um teste-guarda — não é uma task, é um programa. O TaskCard é adequado **apenas** para F0, pelas razões da 15.2.

### 15.4 Próximo Passo

```bash
# 1) Contenção — independente das versões, pode ser executada assim que gerada
/agent-spec-taskcard-generate "contenção da credencial exposta: allowlist no nginx, usuário de serviço, rebuild sem sourcemap, revogação da chave do Administrator e limpeza de dumps"

# 2) Primeira versão do refactory (F1 + F2)
#    A estrutura em arquivo já está decidida pelo ADR-0002. MAS a migração dos 4 Server
#    Scripts de API muda o path dos endpoints (seção 12.1) — isso é decisão evergreen e
#    transversal, candidata a ADR própria, a registrar ANTES ou DURANTE este PRD.
/agent-spec-sdd-generate-prd "saas-multi-empresa v1: versionar os 19 DocTypes e migrar os 6 Server Scripts para código; preparar a infraestrutura da stack nova"

# 3) ADRs — registrar ANTES do PRD da versão que os consome, não agora:
#    antes da v2: /agent-spec-adr-create "Sessão nativa do Frappe substitui autenticação por token"
#                 /agent-spec-adr-create "Isolamento multi-tenant row-level com enforcement em camadas"
#    antes da v3: /agent-spec-adr-create "Webhook como gatilho, API como fonte da verdade"
#                 /agent-spec-adr-create "Contador seu_numero único do SaaS"
#                 /agent-spec-adr-create "Modelo canônico generalizado para meio de recebimento"

# 4) Handoffs — ao fechar cada versão que altera contrato consumido pelo SPA
#    /agent-spec-backend-contract-handoff docs/specs/features/saas-multi-empresa/v2/tech_spec.md
#    /agent-spec-backend-contract-handoff docs/specs/features/saas-multi-empresa/v3/tech_spec.md
#    /agent-spec-backend-contract-handoff docs/specs/features/saas-multi-empresa/v4/tech_spec.md   # consolidado
```

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (fatiar ainda mais, ou promover parte a feature própria) se durante a execução emergirem: task_plan de uma versão passando de ~20 tasks; a auditoria dos 28 `ignore_permissions` revelando reescrita de módulo inteiro em vez de filtro pontual; ou o `seuNumero` truncando na API do Sicoob, o que obriga a reabrir a decisão 24 e transforma a v3 num redesenho de roteamento.
- **Downgrade para miniSpec** se: a v1 (F1+F2) se mostrar puramente mecânica após o levantamento — exportar DocTypes e migrar Server Scripts sem decisão de modelagem nova — caso em que `intent.md` + `scope.md` bastam; ou se as versões `vN-debits` de limpeza surgirem, que são miniSpec por natureza.
- **Downgrade para TaskCard** se: alguma versão se reduzir a um único módulo sem contrato novo (improvável para v2–v4).

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados (nenhum rumo extrapolou o escopo; E3 foi rejeitado por padrão de produto, não por escopo)
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
