# Refactory SaaS — Checkpoint de Planejamento

> Estado congelado da sessão de planejamento. Documento de trabalho, ainda não é o plano final.
> Próximo passo: revisar decisões (usuário solicitou alterações) e então redigir
> ESPEC-GERAL + PLANO-BACKEND (robusto) + PLANO-FRONTEND (básico).

---

## 1. Objetivo do refactory

Transformar o sistema de locação de imóveis (Frappe/ERPNext + SPA React) em um SaaS
**multi-empresa e multi-usuário**, profissional e seguro. Escopo de SaaS limitado a
isso — sem billing, sem planos, sem self-service de assinatura.

---

## 2. Estado atual — achados da exploração

### Topologia
- `/opt/frappe` **não é um bench**: é repositório de deploy Docker Compose.
  O bench real vive em `frappe-backend-1:/home/frappe/frappe-bench`.
- App principal: `locacao_automation`, bind-mount de `/opt/frappe/app-sync/locacao_automation`.
- Site único: `frontend`, banco `_5e5899d8398b5f7b` (MariaDB 10.6), **91 MB**.
- SPA React: container `sysloc-react-1` (nginx:1.27-alpine) na porta 8300,
  servindo `/opt/react/sysloc/html`, com proxy `/api/` → Frappe (8200).
- Frontend é **CRA + React 19.2.6 + TypeScript**. Fonte **não existe no servidor** —
  só na máquina local do dev; deploy por `rsync` via `/home/sysloc/deploy.sh`.
- Servidor: 12 vCPU, 31 GB RAM (folgado) — **mas disco em 79%, só 6 GB livres**;
  `/var/log` com 2,4 GB (sem rotação de log).

### Achados de segurança (ordenados por gravidade)

| # | Achado | Evidência |
|---|---|---|
| 1 | **API key + secret do `Administrator` em texto claro no bundle público** | `REACT_APP_ERPNEXT_API_KEY:"bc237221b65b5ed"` no `main.3fb69968.js`; confirmado no banco que a key é do `Administrator` |
| 2 | **Source maps de produção publicados** (16 MB, com `sourcesContent`) | `main.3fb69968.js.map` — todo o código-fonte TS foi reconstruído a partir dele |
| 3 | **Login é cosmético** | `authRepository.isSignedIn()` = `localStorage.getItem('usuario') !== null` |
| 4 | **Senha reversível, comparada em texto plano** | DocType `Usuario`, campo `Password` + `get_password()`; Server Script `Autenticacao` e `usuario_app/service.py:44` |
| 5 | **Sem guard de rota, sem tratamento de 401, sem expiração** | `app/App.tsx` chama `route.render()` incondicionalmente; zero ocorrências de `401` nos 122 arquivos |
| 6 | `developer_mode: 1` em produção | `sites/frontend/site_config.json` |
| 7 | Senha do MariaDB root em texto plano | `/usr/local/bin/backup_frappe.sh` |
| 8 | 3 endpoints `allow_guest=True` | `verificar_senha_usuario_app`, `abrir_boleto`, `confirmar_email_locatario` |

### Achados estruturais (bloqueiam o refactory)

| # | Achado | Impacto |
|---|---|---|
| 9 | **20 dos 22 DocTypes existem só no banco** (`custom=1`, criados pela UI) | Sem `.json` versionado não há como adicionar `empresa`, testar isolamento ou reproduzir ambiente. Registrado em `docs/adr/0002` |
| 10 | **6 Server Scripts ativos com lógica de negócio viva** | `Autenticacao`, `Todos imoveis`, `Atualizar cômodo`, `Automacao cobranca config api` (API); `Cálculo metragem imóvel`, `PDF contrato` (DocType Event). Invisíveis ao git/review/testes |
| 11 | **28 usos de `ignore_permissions`** (só 2 de SQL cru) | Ver §4 — é a lista finita e completa dos buracos de isolamento |
| 12 | Zero `permission_query_conditions`, zero `User Permission`, zero papel customizado | Não há base de isolamento a reaproveitar. `hooks.py` tem 16 linhas, só `doc_events` |
| 13 | **Nenhum conceito de empresa/tenant** em nenhum lugar | 0 ocorrências de `empresa\|tenant\|company` nos 122 arquivos do frontend e em nenhum DocType |
| 14 | Automações são **cron do SO** chamando `bench execute` global | Não isola nem escala por empresa. Cron de 1 minuto gera log de 10 MB sem rotação |
| 15 | Configuração Sicoob e certificado são **globais e únicos** | Inclui fallback para `/opt/frappe/secrets/sicoob/certificado.pfx` (RN-10) — **perigoso em multi-tenant** |
| 16 | Singles globais: `Atraso`, `Automacao Cobranca Config`, `Verificar scheduler` | Precisam virar por-empresa |
| 17 | Router caseiro, sem `react-router` | **Facilita** esconder as URLs |
| 18 | Testes concentrados só em integração bancária (~4.400 linhas, 16 arquivos) | Rotinas de cron do domínio sem teste algum |

### Premissa arquitetural VALIDADA no código do Frappe
- `frappe/model/db_query.py:964` — a condição de `permission_query_conditions` é
  combinada com **`AND` obrigatório**.
- `db_query.py:926` — o **único** bypass é a flag `ignore_permissions`.
  **Não há escape por papel, nem para o `Administrator`.**
- Conclusão: o isolamento por `permission_query_conditions` é sólido, e os
  **28 `ignore_permissions` são a lista completa e finita de exceções a auditar**.

---

## 3. Decisões fechadas com o usuário (16)

### Rodada 1 — escopo e urgência
1. **Credencial exposta** → tratada como **Fase 0 do refactory**, *mais* bloqueio de rede
   no nginx (allowlist de endpoints, barrar `/api/resource` genérico).
2. **Escala** → 20–300 empresas ⇒ **isolamento lógico por `empresa`**, não banco por cliente.
3. **URLs de acesso** → clientes em `sysloc.systera.com.br`;
   painel master em **`syslocadmin.systera.com.br`** (separado, não divulgado).
4. **Fonte React** → está na máquina local do usuário ⇒ plano de frontend será
   **especificação executável**, não edição direta.

### Rodada 2 — fundações
5. **DocTypes** → **converter os 20 para arquivo versionado** no app, antes do multi-tenant
   (executa finalmente o ADR-0002). Inclui migrar os 6 Server Scripts ativos para código.
6. **Migração** → **montar ambiente novo e virar a chave** (rollback = não virar).
7. **URL escondida** → **restaura a tela** onde o usuário estava ao recarregar.
8. **Perfis** → **3 perfis** (Master SaaS, Admin Empresa, Usuário)
   **+ permissões ajustáveis por usuário**.

### Rodada 3 — domínio
9. **Sicoob** → **cada empresa com sua própria integração** (certificado, client_id, conta).
   ⇒ **remover o fallback global de certificado (RN-10)** — em multi-tenant ele faria a
   empresa B emitir com o certificado da A.
   - ⚠️ **CORRIGIDO pela rodada 7**: o **contador sequencial NÃO é por empresa** — é
     **único do SaaS** (ver decisão 23). Empresas distintas podem legitimamente
     compartilhar a mesma conta bancária.
10. **E-mail** → **remetente único do SaaS com o nome da empresa**
    (`sender_full_name` = nome fantasia, `reply_to` = e-mail da empresa).
    ⇒ exige SPF/DKIM no domínio.
11. **Revogação** → **bloqueio imediato, dados preservados**: sessões ativas mortas na hora
    (não só no próximo login), automações da empresa param, nada é apagado.
12. **Ambiente** → **stack paralela no mesmo servidor**, que **será a nova produção oficial**
    (não é staging). ⇒ **liberar disco é pré-requisito** (só 6 GB livres).

### Rodada 5 — integração bancária (webhook e Pix)
17. **Webhook Sicoob** → **primário + reconciliação diária**. Webhook vira o caminho
    normal de baixa; o polling cai de 7×/dia para **1×/dia**, reconciliando o dia anterior.
    Motivo decisivo: o polling atual **não escala** — faz 1 chamada de API por cobrança
    aberta; com 300 empresas × ~200 cobranças × 7 rodadas ≈ **420 mil chamadas/dia**,
    cada uma exigindo handshake mTLS com o certificado *daquela* empresa (decisão 9).
    O webhook torna o volume proporcional aos pagamentos ocorridos, não às cobranças
    em aberto, e já chega identificando o boleto — elimina a necessidade de varrer
    empresa por empresa.
    - API já está na **V3** (`patches/v1_0/migrar_configuracao_integracao_bancaria.py:38`),
      que é o requisito do webhook.
    - O DocType `Cobranca Integracao Sicoob` **já prevê** `origem_evento='webhook'` — nunca usado.
18. **Pix próprio (sem boleto)** → **preparar o terreno agora, implementar depois**.
    Generalizar o modelo canônico para *meio de recebimento* (`boleto` | `pix`),
    aproveitando a porta `AdaptadorCobrancaBancaria` do ADR-0001. Não entra no escopo
    do refactory.
    - Esclarecimento registrado: **o sistema já recebe via Pix hoje** — `codigoCadastrarPIX: 1`
      (`adaptadores/sicoob/mapeamento.py:192`) faz o boleto nascer com QR vinculado.
      O que não existe é a **API Pix** (`cob`/`cobv`/`lotecobv`/`pix`), que é contrato,
      escopos, chave e webhook separados.

### Rodada 5b — especificação do webhook fornecida pelo usuário (validada)

Documentação oficial recebida e analisada. **Suficiente para implementar**, com 3 ressalvas.

**Coberto pela documentação:**
- Gestão: `POST /webhooks`, `GET /webhooks`, `PATCH /webhooks/{id}`, `DELETE /webhooks/{id}`,
  `PATCH /webhooks/{id}/reativar`, `GET /webhooks/{id}/solicitacoes`.
- Cadastro: `url` (https, porta 443), `codigoTipoMovimento=7` (Pagamento/baixa operacional),
  `codigoPeriodoMovimento=1` (Movimento Atual D0), `email`. Retorna `idWebhook`.
- **Notificação de validação de URL**: `{"idWebhook":990,"validacaoWebhook":true}`, enviada no
  cadastro, na troca de URL e na reativação. Tratamento é **obrigatório** — sem ele o cadastro falha.
- **Payload de notificação**: `idWebhook`, `tipoMovimento`, `dados{ nossoNumero, seuNumero,
  codigoBarrasBoleto, codigoBarrasBaixa, numeroIdentificadorBaixa, numeroCliente, valorBoleto,
  valorPagamento, dataHoraSituacaoBaixa, dataVencimento, cancelamentoBaixa,
  baixaRealizadaEmContigencia, codigoMotivoCancelamento, ... }`.
- **Contrato de resposta HTTP**: aceita **apenas 200 / 201 / 204**. `202` e `302` **reprovam**
  o webhook ⇒ proibido redirect na rota; resposta tem de ser direta e síncrona.
- **Datas em UTC** (sufixo `Z`) ⇒ converter para America/Sao_Paulo.
- **Auditoria de entrega**: `GET /webhooks/{id}/solicitacoes` por `dataSolicitacao` +
  `codigoSolicitacaoSituacao` (3=enviado, 6=erro no envio) ⇒ **terceira rede de segurança**:
  permite descobrir e reprocessar o que o Sicoob tentou entregar e falhou.

**RISCO CRÍTICO — semântica da baixa operacional:**
> "A baixa operacional não se refere à liquidação final, mas sim do registro da intenção
> de pagamento realizada."

Somado a `cancelamentoBaixa` e aos motivos `11` (fraude), `13` (estorno), `72` (devolução por
fraude), `88` (devolução sem reativação): **o webhook NÃO confirma entrada de dinheiro**.
Marcar `status_cobranca='Paga'` direto pelo webhook faria o sistema calcular **repasse ao
locador sobre pagamento estornável**. ⇒ Exige **estado intermediário** (ex.: `Pagamento em
confirmação`): sai da régua de inadimplência na hora, mas só vira `Paga` após a reconciliação
diária confirmar a liquidação. **Altera o modelo de dados de `Cobranca`** (hoje:
Pendente/Paga/Vencida/Cancelada) e o relatório de repasse. — PENDENTE DE DECISÃO

**LACUNA 1 — ausência total de autenticação na notificação.** Sem HMAC, sem header secreto,
sem mTLS de saída, sem faixa de IPs documentada. Quem descobrir a URL pode forjar baixa de
pagamento. Compensação em camadas proposta: token opaco de alta entropia por empresa na URL
+ conferir `numeroCliente` do payload contra a empresa daquela URL + **tratar o webhook como
gatilho, nunca como fonte da verdade** (confirmar por consulta à API antes de baixar).
— PENDENTE DE DECISÃO

**LACUNA 2 — `codigoMotivoCancelamento: 2`** aparece no payload de exemplo mas **não consta
na lista fornecida** (que começa em 11), e vem junto de `cancelamentoBaixa: false`.
Requer esclarecimento com o Sicoob. — PENDENTE

**INVARIANTE DE ISOLAMENTO (multi-tenant):** ⚠️ **SUPERADA pela rodada 7.**
A resolução passa a ser por `seu_numero` (chave própria, única no SaaS), e a **empresa é
derivada do documento `Cobranca` encontrado** — nunca do payload. Ver decisão 24.

**Infra:** URL precisa ser HTTPS/443 sem redirect. Hoje o CloudPanel é dono de 80/443,
Frappe na 8200 ⇒ exige reverse proxy dedicado, com atenção para não devolver 301/302.
Padrão de processamento: **persistir payload cru → responder 200 → processar assíncrono**
(responder antes de persistir perde a notificação; processar antes de responder arrisca timeout).

### Rodada 6 — decisões do webhook (fecham as pendências da rodada 5b)

19. **Status na baixa** → marcar **`Paga` na hora e reverter em caso de estorno**.
    A reversão respeita o vencimento: se já vencida → `Vencida`; se ainda não vencida →
    `Pendente`.
    - **Reúso direto**: `_status_aberto_para_cobranca()` em
      `cobranca_sicoob/sincronizacao.py:66-71` já implementa exatamente essa regra.
    - **Risco original mitigado pela decisão 20**: como a API é a fonte da verdade, o
      sistema nunca marca `Paga` a partir da mera intenção de pagamento — só marca se a
      consulta retornar liquidado com valor e data. Sobra apenas o estorno posterior à
      liquidação confirmada, que é o caso que a reversão trata.
    - Decidido **não** criar status intermediário.

20. **Confiança no payload** → **webhook é gatilho, API é a verdade**. Ao receber a
    notificação, consultar a API do Sicoob (autenticada por mTLS) para aquele boleto e
    decidir apenas com base nessa resposta. Payload forjado não produz efeito.
    Custo: 1 chamada por pagamento real (irrisório frente às ~420 mil/dia do polling).

21. **Roteamento** → **URL única**. ⚠️ A parte "roteando pelo `numeroCliente`" foi
    **revista na rodada 7** — ver decisão 24. Permanece válido:
    - **Descartar antes de consultar**: notificação que não casa com nenhuma cobrança é
      registrada e descartada **sem** chamar a API — impede que notificações forjadas em
      massa consumam a cota de API.
    - **Suspensão (decisão 11)**: com URL compartilhada não há como desativar o webhook
      de uma empresa no Sicoob ⇒ bloqueio **lógico** (notificação de empresa suspensa é
      registrada e ignorada).

### Rodada 7 — revisão do roteamento (motivada por caso real do usuário)

**Motivação:** `numeroCliente` **não** pode ser exigido único por empresa. Caso legítimo e
comum: duas imobiliárias do mesmo dono que, por decisão dele, recebem na **mesma conta
Sicoob**. A exigência de unicidade da decisão 21 original era inviável na prática.

**Descoberta no código que resolve o problema:** `seu_numero` é gerado pelo **próprio
sistema**, não pelo banco — `gerar_seu_numero()` em `cobranca_sicoob/sequencial.py` monta
`AAAAMM` + sequencial de 12 dígitos com `SELECT ... FOR UPDATE` (18 caracteres, monotônico).
É enviado na emissão (`adaptadores/sicoob/mapeamento.py:180`) e **retorna no payload do
webhook**. É uma chave própria, controlada por nós, que faz o trajeto de ida e volta.

23. **Contador de `seu_numero`** → **único do SaaS** (uma sequência para todas as empresas),
    mantendo o formato atual de 18 caracteres. Garante `seu_numero` único no sistema inteiro,
    sem mudança de formato e sem risco de estourar o limite do campo.
    - ⚠️ **Bug bloqueante identificado**: `_obter_configuracao_ativa_for_update()`
      (`sequencial.py:63`) exige **exatamente uma** configuração ativa e lança
      *"Existe mais de uma Configuracao Integracao Bancaria ativa"*. Com uma config ativa
      **por empresa**, esse código quebra no primeiro dia. Precisa ser reescrito: o contador
      sai da configuração da empresa e passa para um contador dedicado do SaaS.
    - Atenção a contenção: `FOR UPDATE` em linha única serializa a emissão entre todas as
      empresas. Aceitável (emissão é mensal e em lote), mas o contador deve ficar em linha
      própria — não na configuração da empresa.

24. **Chave de roteamento do webhook** → **por `seu_numero`, conferindo o resto**.
    - Busca a `Cobranca` por `seu_numero`.
    - **A empresa é derivada do documento encontrado** — nunca do payload. É esta inversão
      que elimina a necessidade de `numeroCliente` único.
    - Confere `nossoNumero` e `numeroCliente` contra o que está gravado na cobrança e na
      configuração da empresa. Qualquer divergência ⇒ notificação **registrada e recusada**,
      não aplicada (defesa em profundidade).
    - `numeroCliente` deixa de ser chave de roteamento e passa a ser **conferência**.
    - ⇒ **N empresas podem compartilhar a mesma conta Sicoob sem conflito.**
    - **Validação necessária (não bloqueante)**: o exemplo do Sicoob traz
      `"seuNumero": "00-03"`, bem menor que os 18 caracteres usados. Como já se emite em
      produção com 18, consultar um boleto real pela API e confirmar que o campo retorna
      **íntegro, sem truncamento**, antes de apostar nele como chave.

22. **Pendente com o Sicoob** (ação do usuário, não bloqueia o plano): esclarecer o
    `codigoMotivoCancelamento: 2` que aparece no payload de exemplo mas não consta na
    lista documentada.

### Rodada 4 — segurança e acesso
13. **Sessão/senha** → padrão profissional: mínimo 10 caracteres com verificação de força,
    hash nativo do Frappe, bloqueio após 5 tentativas, sessão de 8h renovável por atividade,
    cookie `httpOnly`+`Secure`+`SameSite`, 2FA opcional para Admin Empresa e
    **obrigatório para o Master SaaS**, trilha de auditoria de login.
14. **Onboarding** → **senha temporária gerada pelo Master**, com **troca obrigatória
    no primeiro acesso**.
15. **Granularidade de permissão** → **por tela + ações sensíveis separadas**
    (emitir boleto, dar baixa, cancelar contrato, excluir cadastro).
16. **Confidencialidade** → **garantir apenas na aplicação**. O usuário optou por
    **não** investir em auditoria de acesso técnico nem criptografia por campo.
    ⇒ **Limite a declarar explicitamente no plano**: quem tem acesso root ao servidor
    ou ao banco consegue ler os dados de qualquer empresa. Isso é físico, não configurável.
    Risco assumido conscientemente pelo usuário.

---

## 4. Esboço da arquitetura-alvo (rascunho, sujeito à revisão pendente)

### Identidade
- Aposentar o DocType `Usuario` como fonte de autenticação.
- Adotar o **`User` nativo do Frappe + sessão nativa** (cookie `sid` httpOnly via
  `/api/method/login`), que já entrega hash, rate limit, lockout, reset, 2FA e
  `Activity Log`.
- **Supera o ADR-0008** (que definiu auth exclusivamente por token, nunca por sessão) —
  aquele ADR é a causa-raiz do token no bundle. Exige tratar CSRF token nos POSTs.

### Modelo de tenancy
- Novo DocType **`Empresa`** (versionado): identificação, `status` (Ativa/Suspensa),
  datas, motivo de suspensão. Visível só ao papel Master.
- Novo DocType **`Acesso Usuario App`** (1 por `User`): `usuario`, `empresa`, `perfil`,
  `ativo`, child table de telas permitidas, checks de ações sensíveis.
- Campo `empresa` (Link) em **todos** os DocTypes de negócio.

### Enforcement em camadas (defesa em profundidade)
1. `permission_query_conditions` por DocType — filtro `AND empresa = <atual>`.
   Master SaaS recebe `1=0` nos DocTypes de negócio (garantia na aplicação).
2. `has_permission` hook — valida documento individual.
3. `doc_events` com `"*"`: `before_insert` carimba `empresa` **do servidor**
   (ignora o que vier do cliente); `validate` proíbe troca de `empresa` e
   **valida que todo Link aponta para a mesma empresa** (anti cross-tenant via Link).
4. Resolução de tenant em **função única**, `empresa_atual()`, que **nunca lê do request** —
   só de `frappe.session.user` ou de override explícito de job.
5. Auditoria dos **28 `ignore_permissions`**: cada um vira filtro explícito por empresa
   ou uso documentado de context manager de sistema.
6. nginx: allowlist de DocTypes e métodos; barra `/api/resource/User`, `/api/method/frappe.*`
   não essenciais.
7. **Suíte de isolamento parametrizada** + **teste-guarda** que falha se um DocType novo
   não for classificado explicitamente como tenantizado ou global-com-justificativa.

### Automações
- Runner passa a **iterar empresas ativas** e enfileirar um job por empresa,
  com `executar_como_empresa()`, isolamento de falha, lock por (empresa, rotina)
  e registro em novo DocType `Execucao Rotina`.
- ⚠️ **REVISTO na rodada 8**: a proposta de migrar para `scheduler_events` foi
  **recusada** pelo usuário — ver decisão 26.

### Frontend (esboço)
- Guard real de rota + interceptor de 401 → logout e volta ao login.
- Remover credenciais do bundle; passar a usar sessão por cookie.
- `GENERATE_SOURCEMAP=false` no build de produção.
- Esconder URLs: como o router é caseiro (`app/providers.tsx`), basta parar de
  refletir o path na URL e manter a rota em memória + restauração ao recarregar.
- Menu e telas filtrados pelas permissões do usuário.
- App master separado para `syslocadmin.systera.com.br`.

---

### Rodada 8 — automações (as 4 rotinas não-bancárias)

Contexto: o webhook (decisão 17) resolveu **apenas** `sincronizar_pagamentos_sicoob`.
As outras quatro rotinas não falam com o banco e continuavam sem saber para qual
empresa executar.

| Rotina | Config por empresa? | O que faz |
|---|---|---|
| `run_automation_real` (1×/min) | **Sim** — horários, canais, intervalos | Envia e-mail ao locatário |
| `atualizar_atrasos_cobrancas` (1×/dia) | **Sim** — single `Atraso` (% multa/juros) | Recalcula valores |
| `marcar_cobrancas_vencidas` (1×/dia) | Não — regra universal | Muda status |
| `encerrar_contratos_vencidos` (1×/dia) | Não — regra universal | Encerra contrato, libera imóvel |

**Problema de escala encontrado no runner:** roda a cada minuto e, em *toda* execução,
faz `frappe.get_all("Cobranca")` de todas as cobranças abertas — sem filtro de data —
para só então checar se o horário bate (`runner.py:78-96`). Em 1.438 dos 1.440 minutos
do dia varre a base para nada. E grava no registro de config a cada minuto
(`runner.py:210-215`) — origem do log de 10 MB.

25. **Despacho** → **consulta só quem tem horário agora**. Uma query barata por minuto
    identifica as empresas com horário configurado para aquele minuto; só essas são
    processadas. Corrige o desperdício já existente e escala.
26. **Gatilho** → **manter o cron do sistema operacional**. Justificativa do usuário:
    experiência real de o agendador do Frappe **parar sem aviso**, sem diagnóstico.
    Evidência corroborante: existe o DocType legado `Verificar scheduler` (heartbeat,
    hoje desativado) — tentativa anterior de resolver o mesmo problema.
27. **Suspensão** → **congelar tudo e pôr em dia ao reativar**.
    - ✅ **Mais barato do que se supôs**: as 3 rotinas de estado já são idempotentes
      (`marcar_cobrancas_vencidas` e `encerrar_contratos_vencidos` comparam datas;
      `_calcular_mora()` é documentada no código como *"PURA (sem acesso a banco):
      recalculavel e idempotente"*). "Pôr em dia" = rodá-las uma vez. **Nenhum caminho
      especial de reprocessamento** — o risco levantado inicialmente desaparece.
28. **Histórico** → registro por empresa (`Execucao Rotina`), gravado **só quando houve
    trabalho**, nunca a cada minuto em vazio. Com expurgo automático.

### Rodada 9 — complementos das automações

29. **Régua na reativação** → **não reenviar nada retroativo**. Evita que um locatário
    receba dezenas de avisos vencidos de uma vez — agravado pelo remetente único do SaaS
    (decisão 10), em que a reação de spam atingiria todos os clientes.
30. **Cron versionado no repositório**, instalado por script idempotente em `/etc/cron.d`
    em vez do crontab do root. Resolve o conflito entre a decisão 26 (manter cron) e a
    decisão 12 (ambiente novo reproduzível).
31. **Vigilância** → **alerta de rotina atrasada + tela de saúde das rotinas**
    (última execução, próxima esperada, falhas recentes).
32. **Disco** → **limpar antes de começar**; o usuário autorizou **excluir por completo
    tudo do `frappe-staging`**, que não está em uso.

### Rodada 10 — auditoria pré-redação (solicitada pelo usuário)

O usuário exigiu auditoria de dúvidas, lacunas, ambiguidades e inferências antes da
redação. **Resultado: negativo** — foram encontrados problemas, inclusive em afirmações
do próprio assistente.

**Correções a afirmações anteriores:**
- ❌ **"Não há escape por papel, nem para o `Administrator`"** — **parcialmente errado**.
  Vale para listagens (`db_query.py`), mas `permissions.py:85` faz
  `if user == "Administrator": return True`, curto-circuitando inclusive o hook
  `has_permission` em acesso a documento único.
  ⇒ **O Master SaaS não pode ser `Administrator` nem `System Manager`**, e o isolamento
  exige as **duas** camadas.
- ❌ **"420 mil chamadas/dia"** — premissa inflada. Volume real medido: 15 Cobranças,
  1 Contrato, 22 Imóveis, 24 Locatários, 3 Locadores, 520 eventos Sicoob. O argumento
  contra o polling permanece válido em projeção, mas não por esse número.

**Lacunas encontradas e resolvidas:**
33. **Conta bancária compartilhada** → **cada empresa com sua cópia da configuração**.
    Funciona sem tratamento especial: como o roteamento é por `seu_numero` (decisão 24),
    a notificação duplicada acha a **mesma** cobrança e a segunda é descartada por
    idempotência. Custo aceito: certificado armazenado e renovado duas vezes.
    Evidência do caso: as 2 configs atuais já têm o mesmo `numero_cliente` (33065).
34. **E-mail** → **manter o Gmail atual**, com acréscimo do usuário: **alerta quando as
    cobranças não estiverem sendo enviadas por limite do provedor**. Aproveita
    `Log Envio Cobranca` + fila do Frappe, alimentando a tela de saúde da decisão 31.
35. **Domínio** → **só `sysloc.systera.com.br` existe hoje** (SSL via CloudPanel);
    `syslocadmin.systera.com.br` será criado dentro do projeto.
    Allowlist decidida tecnicamente: fica no nginx do React
    (`/opt/react/sysloc/nginx/default.conf`), única camada por onde passa `/api/` e que
    está sob controle do projeto.
36. **Módulo dos DocTypes** → vão para **o módulo do app**, junto com os 2 já versionados.
    Confirmado no banco: os 19 estão hoje em `Locação de imóveis`, que não pertence ao app.
37. **Notificação bancária de empresa suspensa** → **registrar sempre, aplicar ao
    reativar**. Sem isso, um boleto pago durante a suspensão sumiria (a decisão 27
    congela também a reconciliação).
38. **Telas e ações** → lista fechada: **10 áreas de tela** (Resumo, Imóveis, Contratos,
    Cadastros, Financeiro, Automação de cobrança, Integrações bancárias, Multa e juros,
    Relatórios, Usuários) e **7 ações sensíveis** (emitir boleto, solicitar baixa, ativar
    contrato, cancelar contrato, excluir cadastro, configurar integração, enviar cobrança
    manual).
39. **Usuários dentro da empresa** → **o Admin da empresa cria**, com senha temporária e
    troca obrigatória no primeiro acesso (mesma mecânica da decisão 14).
40. **Virada** → **direta, sem fase de ensaio dedicada**. Risco declarado e aceito.
    Mitigação sem custo: a migração será exercitada repetidamente durante F3–F7 para
    gerar massa de teste, produzindo ensaios de fato.

---

## 5. Status

✅ **40 decisões fechadas.** Planos redigidos em `plano-saas.md` (mesmo diretório):
Parte 0 (especificação geral), Parte 1 (backend, 8 fases), Parte 2 (frontend, básico).

**Pendência de coleta** (não de decisão, resolvida durante a F2):
crontab real do root — os dois levantamentos divergem no horário do
`run-cobrancas-vencidas.sh` (`1 0 * * *` contra `10 0 * * *`), e ambos vieram da
documentação mantida à mão, não do crontab. Obter com `sudo crontab -l`.

**Ação do usuário junto ao Sicoob** (decisão 22, não bloqueia):
esclarecer o `codigoMotivoCancelamento: 2`, que aparece no payload de exemplo mas não
consta na lista documentada (que começa em 11).
