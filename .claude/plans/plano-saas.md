# Refactory SaaS — Plano Mestre

Sistema de locação de imóveis (Frappe/ERPNext v15 + SPA React) → SaaS multi-empresa.

Três documentos em um arquivo:
- **Parte 0** — Especificação geral (base comum às duas frentes)
- **Parte 1** — Plano de backend (robusto, à prova de falhas)
- **Parte 2** — Plano de frontend (básico; o robusto nasce do handoff da Parte 1)

---

# PARTE 0 — ESPECIFICAÇÃO GERAL

## 0.1 Contexto

O sistema atende hoje **uma** imobiliária. A meta é transformá-lo em SaaS multi-empresa
e multi-usuário para 20–300 clientes, sem billing e sem self-service de assinatura.

O que motivou o projeto, na ordem real de gravidade:

1. **Credencial de `Administrator` exposta publicamente.** O bundle JavaScript contém
   `REACT_APP_ERPNEXT_API_KEY` e `_SECRET` em texto claro, e a chave é a do `Administrator`.
   Qualquer visitante extrai e controla o ERPNext inteiro. A falha de rotas que originou
   o pedido é, na prática, secundária: hoje **não é preciso nem abrir o app**.
2. **Source maps publicados** (16 MB, com `sourcesContent`) — todo o código-fonte
   TypeScript está exposto. Foi por eles que este plano mapeou o frontend.
3. **Login puramente cosmético.** `authRepository.isSignedIn()` é
   `localStorage.getItem('usuario') !== null`. Uma linha no console autentica.
4. **Senha reversível**, comparada em texto plano, em dois autenticadores duplicados.
5. **Nenhuma noção de empresa** em nenhum ponto do sistema — modelo de dados, permissões,
   automações e frontend são single-tenant por construção.

Resultado esperado: telas e dados realmente protegidos, isolamento entre empresas
garantido e testado, caminho das telas oculto, painel master de administração, e
automações que saibam para qual cliente executar.

## 0.2 Estado atual — fatos apurados

**Topologia.** `/opt/frappe` não é um bench: é repositório de deploy Docker Compose.
O bench real vive em `frappe-backend-1:/home/frappe/frappe-bench`. App principal
`locacao_automation`, bind-mount de `/opt/frappe/app-sync/locacao_automation`.
Site único `frontend`, banco `_5e5899d8398b5f7b` (91 MB). SPA React em `sysloc-react-1`
(nginx:1.27-alpine, porta 8300) servindo `/opt/react/sysloc/html`, com proxy `/api/`
para o Frappe (8200). Servidor: 12 vCPU, 31 GB RAM, **disco em 79% com 6 GB livres**.

**Volume real** (base pequena — o sistema está em início de uso):

| Cobranca | Contrato | Imovel | Locatario | Locador | Conjunto | Eventos Sicoob |
|---|---|---|---|---|---|---|
| 15 | 1 | 22 | 24 | 3 | 3 | 520 |

**Bloqueios estruturais:**

| # | Fato | Evidência |
|---|---|---|
| E1 | **19 DocTypes de negócio existem só no banco** (`custom=1`, módulo `Locação de imóveis`) | Confirmado: `select module,count(*) from tabDocType where custom=1` → `('Locação de imóveis', 19)` |
| E2 | **6 Server Scripts ativos com lógica de negócio viva** | `Autenticacao`, `Todos imoveis`, `Atualizar cômodo`, `Automacao cobranca config api` (API); `Cálculo metragem imóvel`, `PDF contrato` (DocType Event) |
| E3 | **28 usos de `ignore_permissions`**, apenas 2 de SQL cru | `sequencial.py:63`, `integracao_bancaria_api/service.py:744` |
| E4 | `hooks.py` tem **16 linhas**: só `doc_events`. Zero `permission_query_conditions`, `has_permission`, `scheduler_events` | `app-sync/locacao_automation/locacao_automation/hooks.py` |
| E5 | Zero `User Permission`, zero `Custom DocPerm`, zero papel customizado. Todo DocPerm é `System Manager` | Tabelas vazias |
| E6 | Automações são **cron do root** chamando `docker exec ... bench execute`, global | `/opt/frappe/run-*.sh` |
| E7 | Contador `seu_numero` vive **dentro da configuração ativa**; já há dois valores divergentes | `ativo=1 → 000000000037`, `ativo=0 → 000000000036`, ambos `numero_cliente=33065` |
| E8 | `developer_mode: 1` em produção; senha do MariaDB root em texto plano no script de backup | `site_config.json`; `/usr/local/bin/backup_frappe.sh` |
| E9 | Frontend **não usa react-router** — roteador caseiro sobre History API | `src/app/providers.tsx` |

**Premissas do Frappe verificadas no código-fonte** (base do isolamento):

| Verificação | Resultado |
|---|---|
| `permission_query_conditions` em listagens | `db_query.py:964` — combinado com **`AND` obrigatório** |
| Único bypass em listagens | `db_query.py:926` — **somente** a flag `ignore_permissions`. Não há escape por papel |
| Acesso a **documento único** | `permissions.py:85` — **`if user == "Administrator": return True`** curto-circuita inclusive o hook `has_permission` |

> ⚠️ Consequência não-óbvia: o **Master SaaS não pode ser `Administrator` nem `System Manager`**.
> Se for, a decisão 16 não se sustenta nem dentro da aplicação. O isolamento exige as
> **duas** camadas (query conditions + has_permission), nunca uma só.

## 0.3 Decisões fechadas (40)

**Escopo e urgência** — 1) contenção da credencial como Fase 0 do refactory, somada a
bloqueio de rede no nginx · 2) escala 20–300 ⇒ isolamento lógico por `empresa`, não banco
por cliente · 3) clientes em `sysloc.systera.com.br`, master em `syslocadmin.systera.com.br`
· 4) fonte React está na máquina local ⇒ plano de frontend é especificação executável.

**Fundações** — 5) converter os 19 DocTypes para arquivo versionado · 6) montar ambiente
novo e virar a chave · 7) URL escondida, restaurando a tela ao recarregar · 8) três perfis
(Master SaaS, Admin Empresa, Usuário) mais permissões ajustáveis por usuário ·
36) DocTypes vão para o módulo do app, junto com os dois já versionados.

**Segurança e acesso** — 13) senha mínima de 10 com verificação de força, hash nativo,
bloqueio após 5 tentativas, sessão de 8h renovável, cookie `httpOnly`+`Secure`+`SameSite`,
2FA opcional para Admin e **obrigatório para o Master**, auditoria de login ·
14) Admin inicial recebe senha temporária do Master, com troca obrigatória ·
39) demais usuários criados pelo Admin da empresa, mesma mecânica ·
15/38) permissão por tela e ação, conforme lista da §0.5 ·
16) confidencialidade garantida **apenas na aplicação** (ver §0.7).

**Domínio e infraestrutura** — 12) stack paralela no mesmo servidor, que **será a nova
produção oficial** · 32) liberar disco antes; **`frappe-staging` pode ser excluído
por completo** · 35) só `sysloc.systera.com.br` existe hoje (SSL via CloudPanel);
`syslocadmin` será criado no projeto · 40) virada direta, sem fase de ensaio dedicada.

**Ciclo de vida da empresa** — 11) revogação bloqueia na hora (sessões ativas mortas) e
preserva os dados · 27) suspensão congela tudo, e a reativação põe em dia ·
37) notificações bancárias de empresa suspensa são **registradas** e aplicadas na
reativação · 29) a régua de e-mail **não** é reenviada retroativamente.

**Integração bancária** — 9) cada empresa com sua própria integração; **remover o
fallback global de certificado (RN-10)** · 33) empresas que dividem conta mantêm cópias
da configuração (ver §0.6) · 17) webhook primário mais reconciliação diária ·
19) baixa marca `Paga` e o estorno reverte respeitando o vencimento · 20) **webhook é
gatilho, a API é a verdade** · 21) URL única de webhook · 23) contador `seu_numero`
**único do SaaS** · 24) roteamento por `seu_numero`, com a empresa derivada do documento ·
18) Pix próprio fica para depois, mas o modelo canônico já nasce generalizado ·
22) esclarecer `codigoMotivoCancelamento: 2` com o Sicoob (ação do usuário, não bloqueia).

**Automações** — 25) despachante consulta só quem tem horário agora · 26) **manter o cron
do sistema operacional** (o agendador do Frappe já parou sem aviso em produção) ·
30) cron versionado no repositório · 28) histórico por empresa, gravado só quando há
trabalho · 31) alerta de rotina atrasada mais tela de saúde · 34) manter o Gmail atual,
**com alerta quando o envio falhar por limite**.

## 0.4 Arquitetura-alvo

**Identidade.** Aposentar o DocType `Usuario`. Adotar o `User` nativo do Frappe com
**sessão real** (cookie `sid` httpOnly via `/api/method/login`), que já entrega hash,
rate limit, lockout, reset, 2FA e `Activity Log`. Isso **supera o ADR-0008**, que definiu
auth exclusivamente por token e é a causa-raiz da credencial no bundle. Exige tratar
CSRF token nos POSTs.

**Tenancy — row-level com enforcement em camadas.**

| Camada | Mecanismo | Protege |
|---|---|---|
| 1 | `permission_query_conditions` por DocType | Listagens e `/api/resource` |
| 2 | `has_permission` hook | Documento individual |
| 3 | `doc_events` `"*"`: `before_insert` carimba `empresa` **do servidor** | Escrita — ignora o que o cliente enviar |
| 4 | `doc_events` `"*"`: `validate` proíbe troca de `empresa` e exige que **todo Link aponte para a mesma empresa** | Cross-tenant via Link (criar Contrato em A apontando Imóvel de B) |
| 5 | Resolução de tenant em função única, que **nunca lê do request** | Falsificação de identidade |
| 6 | Allowlist no nginx | Superfície exposta |
| 7 | Suíte de isolamento parametrizada + teste-guarda | Regressão e DocType novo esquecido |

**Resolução do tenant** — módulo novo `locacao_automation/tenancy/contexto.py`:

```
empresa_atual(obrigatorio=True) -> str | None
perfil_atual() -> str
exigir_acao(acao: str) -> None          # ações sensíveis da §0.5
executar_como_empresa(empresa)          # context manager, uso exclusivo de jobs
```

Fontes válidas, nesta ordem: override explícito de job (`executar_como_empresa`) →
`Acesso Usuario App` de `frappe.session.user`. **Nunca** parâmetro de request.

## 0.5 Perfis, telas e ações (decisão 38)

**Perfis:** `Sysloc Master` (cadastra/suspende empresas; **nenhum** acesso a dado de
negócio) · `Admin Empresa` (tudo na própria empresa + gestão de usuários) ·
`Usuario Empresa` (conforme liberação). Nenhum deles é `System Manager` ou `Administrator`.

**10 áreas de tela:** Resumo · Imóveis · Contratos · Cadastros · Financeiro ·
Automação de cobrança · Integrações bancárias · Multa e juros · Relatórios · Usuários.

**7 ações sensíveis:** emitir boleto · solicitar baixa de boleto · ativar contrato
(gera cobranças) · cancelar contrato · excluir cadastro · configurar integração
bancária · enviar cobrança manual por e-mail.

## 0.6 Conta bancária compartilhada (decisões 9 + 33)

Duas empresas do mesmo dono podem receber na **mesma conta Sicoob** — caso real e
legítimo. Cada uma mantém sua própria cópia da configuração (mesmo `numeroCliente`,
mesmo `client_id`, mesmo certificado).

Isso **funciona sem tratamento especial** por causa da decisão 24: como o roteamento é
por `seu_numero`, único no SaaS inteiro, a notificação duplicada — que virá, pois serão
dois webhooks cadastrados para a mesma conta — encontra a **mesma** cobrança, e a segunda
é descartada por idempotência. Não há como a baixa de A cair em B.

Custo aceito: certificado armazenado e renovado duas vezes.

## 0.7 Limites e riscos declarados

| Risco | Natureza | Tratamento |
|---|---|---|
| **Root/DBA lê os dados de qualquer empresa** | Físico, não configurável | Decisão 16: garantia apenas na aplicação. Sem auditoria de acesso técnico nem criptografia por campo, por escolha explícita |
| **Payload do webhook não é assinado** | Sicoob não oferece assinatura | Neutralizado pela decisão 20: o payload não decide nada; a API autenticada por mTLS decide |
| **Gmail estoura com dezenas de empresas** | Limite do provedor | Decisão 34: alerta ativo quando o envio falhar, para você reagir antes do cliente reclamar |
| **Virada sem ensaio dedicado** | Decisão 40 | Mitigado de graça: a migração será exercitada repetidamente durante F3–F7 para gerar massa de teste |
| **`codigoMotivoCancelamento: 2`** | Não consta na lista documentada | Tratado como motivo desconhecido: registra e não aplica; item 22 aberto com o Sicoob |
| **`seuNumero` pode ser truncado pelo Sicoob** | Não confirmado | Validação obrigatória em F6 antes de apostar nele como chave |

## 0.8 ADRs a produzir

1. **Sessão nativa do Frappe substitui auth por token** — supera o ADR-0008.
2. **Isolamento multi-tenant row-level com enforcement em camadas.**
3. **Webhook como gatilho, API como fonte da verdade.**
4. **Contador `seu_numero` único do SaaS.**
5. **Modelo canônico generalizado para meio de recebimento** (prepara o Pix — decisão 18).

---

# PARTE 1 — PLANO DE BACKEND

Oito fases. Cada uma só começa com a anterior verificada.

## F0 — Contenção de segurança (produção atual)

**A ordem importa: inverter derruba o app.**

1. Allowlist em `/opt/react/sysloc/nginx/default.conf` — é a única camada por onde passa
   `/api/` e está sob controle do projeto. Liberar apenas o que o app usa de fato
   (levantado do bundle): `resource/` de `Atraso, Cobranca, Conjunto, Contrato, Fiador,
   Imovel, Locador, Locatario, Usuario`; `method/` dos 15 endpoints mapeados, incluindo
   `frappe.client.submit`. Bloquear todo o resto — em especial `/api/resource/User` e
   `/api/method/frappe.*` não listados.
2. Criar usuário de serviço com papel próprio e DocPerms mínimos — **nunca**
   `System Manager`.
3. Rebuild do frontend com a credencial do serviço e `GENERATE_SOURCEMAP=false`; deploy.
4. **Só então** revogar `api_key`/`api_secret` do `Administrator` e de `api@dominio.com`.
5. `developer_mode: 0`; remover `*.map` publicados; remover dumps da raiz de `/opt/frappe`
   (`mariadb_all.sql`, `db-data.tar.gz`, `sites.tar.gz`, `redis-*.tar.gz`, `logs.tar.gz`).

**Aceitação:** credencial antiga retorna 401 · `/api/resource/User` barrado no proxy ·
bundle sem chave de `Administrator` · nenhum `.map` servido · app funcionando.
**Rollback:** `default.conf` anterior e `deploy.sh --rollback` (mantém 5 backups).

## F1 — Fundação versionável

1. Exportar os **19 DocTypes** do módulo `Locação de imóveis` para o módulo
   `Locacao Automation` do app, como DocTypes de app (`custom=0`), ao lado dos dois já
   versionados em `.../locacao_automation/locacao_automation/doctype/`.
   Patch de migração de módulo, idempotente.
2. Migrar os **6 Server Scripts ativos** para código Python do app: `Cálculo metragem
   imóvel` e `PDF contrato` viram `doc_events`; os 4 de API viram `@frappe.whitelist()`.
   Desativar os Server Scripts só após equivalência comprovada.
3. Suíte de regressão sobre o comportamento migrado.

**Aceitação:** `bench --site <novo> migrate` reconstrói **todo** o schema num site vazio ·
nenhum `custom=1` remanescente no módulo antigo · Server Scripts desativados e o
comportamento preservado.

## F2 — Infraestrutura

1. **Remover `frappe-staging` por completo** (autorizado — decisão 32): containers,
   volumes e `/opt/frappe-staging`.
2. Liberar disco: rotação de log (`/var/log` com 2,4 GB), prune de imagens e volumes
   órfãos, remoção dos `.bak-*` acumulados em `docker-compose.override.yml.bak-*`,
   `emissao.py.bak-*` e `reference/backups_codex/`. **Medir antes e depois.**
3. Montar a stack nova (compose próprio, portas próprias, banco próprio) — será a
   produção oficial.
4. **Coletar o crontab real do root** (`sudo crontab -l`) — pendência aberta: os dois
   levantamentos divergem no horário do `run-cobrancas-vencidas.sh` (`1 0` contra `10 0`),
   e ambos vieram da documentação, não do crontab. Versionar em `deploy/cron/` com script
   instalador idempotente (decisão 30), usando `/etc/cron.d` em vez do crontab do root.

**Aceitação:** folga de disco medida e suficiente para as duas stacks · stack nova
responde · instalador de cron roda duas vezes sem duplicar entrada.

## F3 — Identidade e sessão real

1. Sessão nativa via `/api/method/login`, cookie `sid` httpOnly; endpoint próprio para
   entregar o CSRF token ao SPA.
2. Aposentar o DocType `Usuario` e **os dois autenticadores duplicados**: o Server Script
   `Autenticacao` e `usuario_app/service.py:17` (`verificar_senha_usuario_app`,
   hoje `allow_guest=True`).
3. Migrar o usuário existente para `User`.
4. Política da decisão 13, incluindo 2FA obrigatório para o Master.
5. ADR superando o 0008.

**Aceitação:** requisição sem sessão retorna 401 · sessão expira em 8h · bloqueio após
5 tentativas · nenhuma credencial de API no bundle · `frappe.session.user` reflete quem
realmente logou (hoje a auditoria sempre grava o usuário de serviço).

## F4 — Multi-tenancy

1. DocTypes novos: **`Empresa`** · **`Acesso Usuario App`** (1 por `User`, com child table
   de telas e checks das 7 ações) · **`Execucao Rotina`**.
2. Campo `empresa` (Link, obrigatório) em todos os DocTypes de negócio; patch carimbando
   a Empresa #1 nos registros existentes.
3. `tenancy/contexto.py` conforme §0.4.
4. Registrar em `hooks.py`: `permission_query_conditions` por DocType (factory),
   `has_permission`, e `doc_events` com `"*"` para carimbo e validação de Links.
5. **Auditoria dos 28 `ignore_permissions`** — cada um vira filtro explícito por empresa
   ou uso documentado do context manager de sistema. É a lista completa e finita de
   exceções; nenhuma sobra sem justificativa escrita.
6. Papéis `Sysloc Master`, `Admin Empresa`, `Usuario Empresa` — nenhum é `System Manager`.
   Master recebe `1=0` nos DocTypes de negócio.
7. **Suíte de isolamento parametrizada**: para cada DocType e cada endpoint whitelisted,
   verifica que a empresa A não lê, escreve nem apaga dado da B. Mais um **teste-guarda**
   que enumera os DocTypes do módulo e **falha** se algum não estiver classificado como
   tenantizado ou global-com-justificativa — impede que um DocType futuro nasça vazando.

**Aceitação:** a suíte de isolamento passa integralmente · Master enxerga vazio nos
DocTypes de negócio · criar documento com `empresa` forjada no payload é ignorado ·
Link cross-tenant é recusado.

## F5 — Configuração e integração por empresa

1. `Configuracao Integracao Bancaria` ganha `empresa`; unicidade passa a ser
   (empresa, provedor, ativo=1). Reescrever `_obter_configuracao_ativa_for_update()`
   (`sequencial.py:63`), que hoje **lança erro se houver mais de uma config ativa** e
   quebraria no primeiro dia multi-empresa.
2. **Remover o fallback global de certificado (RN-10)** — em multi-tenant faria a empresa
   B emitir com o certificado da A. Ausência de certificado próprio passa a falhar
   explicitamente.
3. Contador `seu_numero` sai da configuração e vira **contador único do SaaS**, em linha
   própria. Consolidar pelo maior valor existente (`000000000037`), preservando o formato
   `AAAAMM` + 12 dígitos.
4. `Atraso` e `Automacao Cobranca Config` deixam de ser Single → um registro por empresa.
5. E-mail: remetente único do SaaS com `sender_full_name` da empresa e `reply_to` dela
   (3 pontos de `frappe.sendmail`: `emailer.py:203`, `emailer.py:251`,
   `locatario_email_confirmacao/service.py:101`). Detecção de falha de envio alimentando
   o alerta da decisão 34.
6. Generalizar o modelo canônico para **meio de recebimento** (`boleto` | `pix`),
   aproveitando a porta `AdaptadorCobrancaBancaria` do ADR-0001 — prepara o Pix sem
   implementá-lo (decisão 18).

**Aceitação:** duas empresas emitindo no mesmo mês geram `seu_numero` sem colisão ·
empresa sem certificado próprio recebe erro claro, sem cair em certificado alheio ·
e-mail sai com o nome da empresa correta.

## F6 — Webhook Sicoob e reconciliação

**Endpoint receptor** (`allow_guest`, URL única — decisão 21). Padrão obrigatório:
**persistir o payload cru → responder 200 → processar de forma assíncrona.** Responder
antes de persistir perde a notificação; processar antes de responder arrisca timeout.
O Sicoob aceita **apenas 200/201/204** — qualquer redirect (301/302) reprova o webhook,
o que precisa ser garantido nas três camadas de proxy.

Fluxo de processamento:
1. Tratar a notificação de validação (`{"idWebhook":N,"validacaoWebhook":true}`) —
   obrigatória, sem ela o cadastro falha.
2. Resolver a `Cobranca` por **`seu_numero`**. Não achou ⇒ registrar e **descartar sem
   chamar a API** (impede que notificações forjadas consumam a cota).
3. Derivar a **empresa do documento encontrado** — nunca do payload.
4. Conferir `nossoNumero` e `numeroCliente`; divergência ⇒ registrar e recusar.
5. Idempotência por `numeroIdentificadorBaixa` (campo já existente em `Cobranca`).
6. Converter datas de UTC para America/Sao_Paulo.
7. **Consultar a API** com as credenciais da empresa e decidir a partir dela (decisão 20),
   reusando `cobranca_sicoob/sincronizacao.py`. Estorno reverte via
   `_status_aberto_para_cobranca()` (`sincronizacao.py:66-71`), que já implementa a regra
   da decisão 19.
8. Empresa suspensa ⇒ **registrar sem aplicar** (decisão 37); aplicado na reativação.

**Gestão do webhook:** `POST/GET/PATCH/DELETE /webhooks`, `/reativar` e `/solicitacoes`.
O endpoint de solicitações (situação 3=enviado, 6=erro) é a **terceira rede de segurança**:
permite descobrir e reprocessar o que o Sicoob tentou entregar e falhou.

**Reconciliação:** o polling 7×/dia cai para **1×/dia** sobre o dia anterior.

**Validação prévia obrigatória:** confirmar, consultando um boleto real, que o `seuNumero`
de 18 caracteres retorna **íntegro**. Se truncar, a decisão 24 precisa ser revista.

**Aceitação:** notificação forjada não altera nada · duplicada processa uma vez ·
boleto de outra empresa não é afetado · empresa suspensa acumula e aplica ao reativar.

## F7 — Automações multi-tenant

Gatilho permanece no **cron do sistema operacional** (decisão 26), agora versionado.

1. **Despachante por horário** (decisão 25): o job de 1 minuto faz **uma** consulta —
   quais empresas têm horário configurado para agora — e enfileira só essas. Corrige o
   desperdício atual, em que `runner.py:78-96` varre todas as cobranças abertas a cada
   minuto para só depois checar o relógio, e grava no registro de configuração a cada
   execução (`runner.py:210-215`) — origem do log de 10 MB.
2. Rotinas diárias enfileiram um job por empresa ativa, com **falha isolada** e lock por
   par (empresa, rotina).
3. `Execucao Rotina` gravado **só quando houve trabalho** (decisão 28).
4. **Alerta de rotina atrasada + tela de saúde** (decisão 31), incluindo o alerta de falha
   de envio de e-mail (decisão 34). Existe um DocType legado `Verificar scheduler`,
   desativado — tentativa anterior do mesmo problema; será substituído por este mecanismo.
5. **Reativação** (decisões 27 e 37): rodar uma vez as três rotinas de estado, que já são
   idempotentes por natureza — `marcar_cobrancas_vencidas` e `encerrar_contratos_vencidos`
   comparam datas, e `_calcular_mora()` está documentada no código como *"PURA (sem acesso
   a banco): recalculavel e idempotente"*. **Nenhum caminho especial de reprocessamento.**
   Aplicar as notificações bancárias guardadas. A régua de e-mail **não** é reenviada
   retroativamente (decisão 29).

**Aceitação:** duas empresas com horários distintos rodam cada uma no seu · erro em A não
impede B · rotina parada gera alerta · reativação põe os dados em dia sem disparar e-mail
retroativo.

## F8 — Painel Master e virada

1. Criar `syslocadmin.systera.com.br` com SSL no CloudPanel (decisão 35).
2. App master separado, servido só nesse domínio.
3. Endpoints do Master: criar empresa, suspender, reativar, listar, criar Admin com senha
   temporária (decisão 14). **Nenhum** retorna dado de negócio — com teste que prova.
4. Suspensão: desabilitar os `User` da empresa e **encerrar as sessões ativas na hora**
   (`frappe.sessions.clear_sessions(user, force=True)`), não apenas no próximo login.
5. **Virada** (decisão 40): parar o cron da stack antiga → backup verificado → migrar →
   apontar o domínio → checklist de validação → manter a stack antiga **desligada e
   intacta** por semanas como rollback.

**Aceitação:** Master não acessa nenhum dado de negócio por nenhum caminho · suspensão
derruba sessão em andamento · a stack antiga volta a ser ativável a qualquer momento.

---

# PARTE 2 — PLANO DE FRONTEND (básico)

> Versão preliminar. O plano robusto nasce deste, com prioridade para o **handoff**
> produzido ao fim da Parte 1.

## 2.1 Situação

CRA + React 19.2.6 + TypeScript, **sem react-router**: roteador caseiro em
`src/app/providers.tsx` (History API + `window.location.pathname`), rotas declaradas como
array em `src/app/routes.tsx`. O "guard" é o `publicPaths` de `src/app/App.tsx`, que só
decide se envolve no shell — `route.render()` é chamado **incondicionalmente**.
Fonte apenas na máquina local; deploy por `rsync` via `/home/sysloc/deploy.sh`.

A ausência de router, que é débito arquitetural, **facilita** o requisito de ocultar as
URLs: a navegação já é controlada em código.

## 2.2 Escopo

| # | Entrega | Arquivos-âncora |
|---|---|---|
| 1 | Remover credenciais do bundle; `GENERATE_SOURCEMAP=false` | `src/shared/api/apiConfig.ts`, `.env` |
| 2 | Autenticação por sessão (cookie) com CSRF; trocar `credentials:'omit'` | `src/shared/api/httpClient.ts` |
| 3 | Guard de rota real e interceptor de 401/403 → logout e volta ao login | `src/app/App.tsx`, `httpClient.ts` |
| 4 | Reescrever o estado de auth: sai `localStorage`, entra sessão do servidor | `src/features/auth/services/*` |
| 5 | Ocultar URLs mantendo a base, restaurando a tela ao recarregar (decisão 7) | `src/app/providers.tsx` |
| 6 | Menu e telas filtrados pelas permissões (§0.5); esconder o que não é permitido | `src/features/shell/components/shellMenu.ts` |
| 7 | Remover o "gate de senha" cosmético da tela de Usuários | `src/features/shell/components/usePremiumActions.tsx` |
| 8 | App master separado para `syslocadmin` | novo |

## 2.3 O que o handoff do backend precisa entregar

Contrato de login, logout e obtenção de CSRF · formato do objeto de sessão (empresa,
perfil, telas e ações liberadas) · comportamento esperado em 401 e 403 · formato
padronizado de erro · lista final de endpoints permitidos pela allowlist · contrato dos
endpoints do painel master.

## 2.4 Forma de entrega

Como o fonte está na sua máquina, o plano robusto será uma **especificação executável**:
mudanças descritas por arquivo, com trechos prontos, e uma lista de verificação de
aceitação que você (ou eu, na máquina com o fonte) executa.

---

# VERIFICAÇÃO END-TO-END

| Fase | Como verificar |
|---|---|
| F0 | `curl` com a credencial antiga → 401 · `curl /api/resource/User` pelo proxy → barrado · `grep` no bundle não encontra chave · nenhum `.map` servido |
| F1 | `bench --site <vazio> migrate` reconstrói todo o schema · `bench --site X run-tests --app locacao_automation` verde |
| F2 | `df -h` antes/depois · stack nova responde a `/api/method/ping` · instalador de cron idempotente |
| F3 | Requisição sem cookie → 401 · 6ª tentativa de senha errada bloqueia · `Activity Log` registra o usuário real |
| F4 | **Suíte de isolamento**: usuário de A não alcança nada de B por resource, por método e por Link · teste-guarda falha ao adicionar DocType não classificado |
| F5 | Duas empresas emitem no mesmo mês sem colisão de `seu_numero` · empresa sem certificado falha com erro claro |
| F6 | Payload forjado não altera nada · duplicado aplica uma vez · validação de URL responde 200 · `seuNumero` volta íntegro da API |
| F7 | Duas empresas com horários distintos, cada uma no seu · erro em A não impede B · rotina parada dispara alerta |
| F8 | Master não alcança dado de negócio · suspensão derruba sessão ativa · rollback reativa a stack antiga |

**Testes**: `bench --site <site> run-tests --app locacao_automation`. A suíte atual tem
~4.400 linhas em 16 arquivos, concentrada em integração bancária, e segue o padrão de
rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção de INVARIANTES por arquivo — os testes
novos devem manter essa convenção.

**Pendência aberta de coleta** (F2): crontab real do root, para resolver a divergência
`1 0` vs `10 0` no `run-cobrancas-vencidas.sh`.
