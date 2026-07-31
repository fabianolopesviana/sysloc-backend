# TASKCARD - Execução Rápida (com Guardrails LLM)

## 1. Identificação
- **ID**: TC-001
- **Nome da Task**: Contenção da credencial exposta em produção
- **model**: opus
- **risk**: high
- **gates**: [qa, tech_review]   <!-- tipo=security + secrets/config: mexe em allowlist de proxy, papéis, DocPerms e revogação de credencial em produção -->
- **Variante**: backend
- **mode**: standard
- **source**: recommended
- **source_note**: recomendado pela §15.4 de `docs/specs/features/saas-multi-empresa/v1/pre-refinement.md` (F0 extraído do plano como TaskCard por ser runbook de operação, não feature)
- **Responsável**: sysloc
- **Data**: 2026-07-27
- **Status**: Concluído (Fase A em 2026-07-27 · Fase B em 2026-07-28 · AC-14 validado pelo usuário em 2026-07-28 — **15/15 ACs fechados**)
- **Dependências**: nenhuma
- **Símbolos públicos criados**: N/A — card única, nenhum símbolo consumido por outras cards
- **Símbolos consumidos de outras tasks**: N/A
- **Relacionados**:
  - `docs/specs/features/saas-multi-empresa/v1/pre-refinement.md` (§8, §15.4 — origem desta TaskCard)
  - `.claude/plans/plano-saas.md` (F0 — Contenção de segurança)
  - `docs/adr/0002-versionar-estrutura-de-dados-do-app-em-arquivo.md`

---

## 2. Contexto

A `api_key`/`api_secret` do usuário `Administrator` está em texto claro no bundle JavaScript público (`REACT_APP_ERPNEXT_API_KEY:"bc237221b65b5ed"` em `main.3fb69968.js`), e a chave foi confirmada em `tabUser` como sendo a do `Administrator`. Três source maps de produção estão publicados (16,7 MB o principal, com `sourcesContent`), expondo todo o código TypeScript. Qualquer visitante extrai a credencial e controla o ERPNext inteiro — não é preciso nem abrir o app.

Esta é a Fase 0 do refactory SaaS, extraída como TaskCard por ser um runbook de operação sobre a produção atual: não introduz modelagem de domínio nem contrato novo.

---

## 3. Objetivo da Task

Fechar a exposição da credencial administrativa em produção, deixando o app funcionando, através de: allowlist de endpoints no proxy do SPA, criação de um usuário de serviço com papel próprio e permissões mínimas (sem `System Manager`), substituição da credencial no bundle publicado, remoção dos source maps, revogação das chaves de API do `Administrator` e do `api@dominio.com`, desligamento do `developer_mode` e remoção dos dumps de banco da raiz do repositório de deploy.

---

## 4. Escopo

### 4.1 Inclui
- [ ] Allowlist de `/api/method/` e `/api/resource/` no `default.conf` do nginx do SPA, com catch-all negando o resto
- [ ] Versionar a configuração do nginx no repositório (`deploy/nginx/react-default.conf`), para que a allowlist tenha histórico e sobreviva a recriação do container
- [ ] Patch versionado criando o papel `Servico App` e os 9 Custom DocPerms (ADR-0002)
- [ ] Criação do usuário de serviço com `api_key`/`api_secret` próprios e papel `Servico App`
- [ ] Substituição da credencial do `Administrator` pela do usuário de serviço no bundle já publicado
- [ ] Remoção dos 3 arquivos `.map` publicados
- [ ] Revogação de `api_key`/`api_secret` do `Administrator` e do `api@dominio.com`
- [ ] `developer_mode: 0` no `site_config.json`
- [ ] Remoção dos 6 dumps de banco/backup da raiz de `/opt/frappe`

### 4.2 Fora do escopo
- [ ] **Rebuild do bundle React a partir do fonte** — o fonte vive apenas na máquina local do usuário. O patch no bundle publicado é contenção; o rebuild com `.env` de serviço e `GENERATE_SOURCEMAP=false` é ação subsequente do usuário (ver seção 11)
- [ ] **Alterar a RN-11** (`_exigir_system_manager` em `integracao_bancaria_api/service.py:251`) — decidido manter intacta; a tela de Integrações Bancárias do SPA fica indisponível até F3, e a configuração é feita pelo Desk nesse intervalo
- [ ] **Sessão real, guard de rota, tratamento de 401** — é F3 (`saas-multi-empresa/v2`)
- [ ] **Aposentar o DocType `Usuario` e os autenticadores duplicados** — é F3
- [ ] **Liberação de disco, remoção do `frappe-staging`, stack nova, cron versionado** — é F2 (`saas-multi-empresa/v1`)
- [ ] **Senha do MariaDB root em texto plano no `backup_frappe.sh`** — não faz parte da superfície pública; tratar em F2

---

## 5. Arquivos Envolvidos

### 5.0 Visão em Árvore

```
/opt/frappe/
├── app-sync/locacao_automation/locacao_automation/
│   ├── patches/v1_0/
│   │   ├── criar_papel_servico_app.py                    [N]
│   │   └── cortar_contador_sequencial.py                 [R]
│   ├── patches.txt                                       [M]
│   └── integracao_bancaria_api/service.py                [R]
├── deploy/nginx/
│   └── react-default.conf                                [N]
├── docs/adr/
│   └── 0002-versionar-estrutura-de-dados-do-app-em-arquivo.md   [R]
├── mariadb_all.sql                                       [removido]
├── db-data.tar.gz                                        [removido]
├── sites.tar.gz                                          [removido]
├── redis-cache-data.tar.gz                               [removido]
├── redis-queue-data.tar.gz                               [removido]
├── logs.tar.gz                                           [removido]
└── SHA256SUMS                                            [M]

/opt/react/sysloc/
├── nginx/default.conf                                    [M]
└── html/static/
    ├── js/main.3fb69968.js                               [M]
    ├── js/main.3fb69968.js.map                           [removido]
    ├── js/453.20a317d1.chunk.js.map                      [removido]
    └── css/main.9b92729f.css.map                         [removido]

frappe-backend-1:/home/frappe/frappe-bench/sites/frontend/
└── site_config.json                                      [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

---

### 5.1 Arquivos Existentes (leitura/referência)
- `app-sync/locacao_automation/locacao_automation/patches/v1_0/cortar_contador_sequencial.py` — **padrão a seguir** para o patch novo: docstring explicando idempotência, indentação por tab, identificadores sem acento, guards `frappe.db.exists` antes de tocar DocType, `execute()` como entrada
- `app-sync/locacao_automation/locacao_automation/patches.txt` — formato de registro sob `[post_model_sync]`
- `docs/adr/0002-versionar-estrutura-de-dados-do-app-em-arquivo.md` — obriga o papel e os DocPerms a nascerem em arquivo versionado, não pela interface administrativa
- `app-sync/locacao_automation/locacao_automation/integracao_bancaria_api/service.py` (linhas 246-255) — `_exigir_system_manager()`, a RN-11 que **não** deve ser alterada; explica por que a tela de Integrações fica indisponível ao usuário de serviço
- `/opt/react/sysloc/nginx/default.conf` — configuração atual do proxy (4 blocos `location` de proxy + `try_files`)

### 5.2 Arquivos a Criar
- `app-sync/locacao_automation/locacao_automation/patches/v1_0/criar_papel_servico_app.py` — patch idempotente que cria o papel `Servico App` e os 9 Custom DocPerms
- `deploy/nginx/react-default.conf` — cópia versionada da configuração do nginx do SPA com a allowlist aplicada

### 5.3 Arquivos a Modificar
- `app-sync/locacao_automation/locacao_automation/patches.txt` — registrar `locacao_automation.patches.v1_0.criar_papel_servico_app` sob `[post_model_sync]`
- `/opt/react/sysloc/nginx/default.conf` — substituir o bloco `location /api/` por allowlist em regex + catch-all `return 403`
- `/opt/react/sysloc/html/static/js/main.3fb69968.js` — trocar `bc237221b65b5ed` e `d221c99298caf0a` pelas credenciais do usuário de serviço
- `sites/frontend/site_config.json` (dentro de `frappe-backend-1`) — `developer_mode: 0`
- `SHA256SUMS` — remover as linhas dos dumps apagados, ou apagar o arquivo se todas as entradas se referirem a eles

---

## 6. Descrição de Execução (COMO fazer)

**A ordem dos passos é obrigatória. Inverter derruba o app em produção.** A allowlist precisa existir antes de a credencial mudar; a credencial do serviço precisa estar no bundle antes de a do `Administrator` ser revogada.

### 6.1 Allowlist no nginx

O bloco `location /api/` atual faz proxy de **tudo**. Substituí-lo por:

1. Um `location` **regex** que casa exatamente a superfície levantada do bundle e faz o `proxy_pass` (regex tem precedência sobre prefix match no nginx, então basta ele vir antes na resolução, não no arquivo).
2. Um `location /api/` prefix que responde `403` para todo o resto.

A superfície real, extraída do bundle publicado, é:

**15 `method/`** — `all_imoveis`, `atualizar_comodo`, `auth_locacao_imoveis`, `automacao_cobranca_config_api`, `frappe.client.submit`, `locacao_automation.cobranca_automation.service.enviar_cobranca_email_manual`, `locacao_automation.cobranca_boleto.service.abrir_boleto`, `locacao_automation.cobranca_sicoob.baixa.solicitar_baixa_boleto_sicoob`, `locacao_automation.cobranca_sicoob.emissao.emitir_boleto_sicoob`, `locacao_automation.contrato_cancelamento.service.cancelar_contrato`, `locacao_automation.contrato_pdf.service.abrir_contrato`, `locacao_automation.integracao_bancaria_api.service.<sufixo>` (9 sufixos: `apurar_boletos_abertos`, `baixar_consolidado_boletos_abertos`, `enviar_certificado`, `obter_configuracao`, `remover_certificado`, `resumir_consolidado_boletos_abertos`, `salvar_configuracao`, `testar_conexao`, `verificar_saude_integracao`), `locacao_automation.locatario_email_confirmacao.service.enviar_confirmacao_email_locatario`, `locacao_automation.usuario_app.service.verificar_senha_usuario_app`.

**9 DocTypes em `resource/`** — `Atraso`, `Cobranca`, `Conjunto`, `Contrato`, `Fiador`, `Imovel`, `Locador`, `Locatario`, `Usuario`. O padrão precisa aceitar sufixo de nome de documento (`/api/resource/Contrato/CT-0001`, `/api/resource/Atraso/Atraso`).

Regras técnicas:
- Escapar o ponto nos nomes de método no regex (`frappe\.client\.submit`).
- Os 9 endpoints de `integracao_bancaria_api.service` **permanecem na allowlist** mesmo indisponíveis ao usuário de serviço: a negação é do Frappe (`PermissionError` da RN-11), não do proxy. Bloqueá-los no nginx trocaria o erro correto por um 403 genérico e quebraria o acesso quando a sessão real chegar em F3.
- `/api/resource/User`, `/api/method/frappe.*` (exceto `frappe.client.submit`), `/api/method/login` e qualquer coisa não listada devem cair no `403`.
- Os blocos `location /assets/`, `/files/`, `/private/files/` e `location /` permanecem inalterados.
- Após editar, validar com `nginx -t` dentro do container antes de recarregar.
- **⚠️ `default.conf` é bind mount de arquivo único** (achado da execução): sobrescrevê-lo troca o inode e o container **continua servindo a config antiga** — `nginx -t` passa, e a allowlist não aplica. Exige `docker restart sysloc-react-1`; `nginx -s reload` **não** basta. Sem esse restart, a verificação de AC-02 dá falso-positivo de "ainda aberto" quando na verdade o arquivo já está correto.

### 6.2 Papel, DocPerms e usuário de serviço

Todos os DocPerms dos 9 DocTypes hoje pertencem exclusivamente a `System Manager` — nenhum outro papel lê nada. O patch cria o papel `Servico App` e um `Custom DocPerm` por DocType.

Permissões por DocType: `read=1`, `write=1`, `create=1`, `delete=1`. Em `Contrato`, adicionalmente `submit=1` (o bundle chama `frappe.client.submit` para ativar contrato). Nenhum outro flag (`report`, `export`, `import`, `share`, `print`, `email`) — o SPA não os usa.

O patch DEVE ser idempotente no mesmo espírito de `cortar_contador_sequencial.py`: verificar `frappe.db.exists("Role", "Servico App")` antes de criar, e `frappe.db.exists("Custom DocPerm", {...})` por DocType antes de inserir. Reexecução não duplica linha nem escala permissão.

O usuário de serviço é criado **fora do patch** (é dado operacional, não estrutura): `user_type = "System User"`, papel `Servico App` como único papel, `enabled = 1`, sem senha utilizável. Gerar `api_key` e `api_secret` com `frappe.generate_hash(length=15)` e registrar o par em local seguro fora do repositório antes de prosseguir — ele é necessário no passo seguinte e o `api_secret` não é recuperável depois.

### 6.3 Bundle e source maps

Fazer backup de `main.3fb69968.js` fora do diretório servido, substituir as duas ocorrências de credencial pelo par do usuário de serviço, e apagar os 3 arquivos `.map` (`static/js/main.3fb69968.js.map`, `static/js/453.20a317d1.chunk.js.map`, `static/css/main.9b92729f.css.map`).

O patch é **temporário por natureza**: o próximo `deploy.sh` sobrescreve `html/` com o build da máquina local. Registrar isso na seção 11.

### 6.4 Validação antes de revogar

Antes de revogar qualquer credencial, exercitar o app com a credencial de serviço: uma listagem (`/api/resource/Imovel`), uma leitura de documento e um método whitelisted. Só prosseguir se responderem 200.

### 6.5 Revogação

Para `Administrator` e `api@dominio.com`, limpar o `api_key` e apagar o segredo da tabela de autenticação:

```python
for usuario in ("Administrator", "api@dominio.com"):
    frappe.db.set_value("User", usuario, "api_key", "")
    frappe.db.delete("__Auth", {"doctype": "User", "name": usuario, "fieldname": "api_secret"})
frappe.db.commit()
```

`api@dominio.com` está sem uso desde 2026-01-20, nunca fez login e sua chave não aparece no bundle — revogar não tem efeito colateral conhecido.

### 6.6 developer_mode e limpeza

`developer_mode: 0` no `site_config.json` do site `frontend`. Em seguida, remover da raiz de `/opt/frappe`: `mariadb_all.sql`, `db-data.tar.gz`, `sites.tar.gz`, `redis-cache-data.tar.gz`, `redis-queue-data.tar.gz`, `logs.tar.gz` (44 MB no total). Eles não estão versionados (o `.gitignore` cobre `*.sql` e `*.tar.gz`), mas `SHA256SUMS` **está** versionado e referencia esses arquivos — atualizar ou remover conforme o conteúdo.

### 6.1 Exemplo de Payload

N/A — sem payload parcial. Esta TaskCard não expõe nem altera endpoint.

---

## 7. Guardrails de Execução (LLM) - DEVE / NÃO DEVE

> Quebrar qualquer item aqui **invalida a task**.

### 7.1 DEVE
- **Obedecer ADR-0002**: o papel `Servico App` e os 9 Custom DocPerms nascem descritos em arquivo versionado (patch registrado em `patches.txt`) e são aplicados pelo `bench migrate` — nunca criados pela interface administrativa
- Seguir o padrão de `cortar_contador_sequencial.py` no patch novo: `execute()` como entrada, docstring explicando a idempotência, indentação por tab, identificadores e comentários sem acento
- Executar os passos **na ordem da seção 6** — allowlist → papel e usuário de serviço → bundle → validação → revogação → limpeza
- Validar `nginx -t` antes de recarregar o proxy
- Fazer backup de `default.conf` e de `main.3fb69968.js` antes de alterá-los, em diretório fora do servido pelo nginx
- Registrar `api_key` e `api_secret` do usuário de serviço em local seguro **antes** de prosseguir para o passo seguinte — o segredo não é recuperável
- Confirmar que o app responde 200 com a credencial de serviço **antes** de revogar a do `Administrator`

### 7.2 NÃO DEVE
- **Não** conceder `System Manager` nem `Administrator` ao usuário de serviço, sob nenhuma circunstância
- **Não** alterar `_exigir_system_manager()` nem qualquer regra da RN-11 em `integracao_bancaria_api/service.py` — está fora do escopo e quebraria CT-029
- **Não** revogar a credencial do `Administrator` antes de a do serviço estar funcionando no bundle publicado
- **Não** tentar reconstruir o bundle a partir do fonte — ele não existe neste servidor
- **Não** alterar `deploy.sh`, os scripts `run-*.sh`, o crontab ou qualquer coisa de F1/F2
- **Não** tocar em `/opt/frappe-staging` — é F2
- **Não** apagar `secrets/` nem qualquer arquivo de certificado
- **Não** ampliar a allowlist além dos 15 métodos e 9 DocTypes levantados; qualquer endpoint adicional precisa ser justificado por evidência no bundle
- **Não** adicionar flags de permissão além dos declarados em 6.2 (`report`, `export`, `import`, `share`, `print`, `email` ficam em 0)

---

## 8. Passos Sugeridos (checklist executável)

**Fase A — reversível (concluída em 2026-07-27):**

- [x] Fazer backup de `/opt/react/sysloc/nginx/default.conf` e de `/opt/react/sysloc/html/static/js/main.3fb69968.js` fora dos diretórios servidos — em `reference/backups-tc001/`
- [x] Reescrever o bloco `location /api/` do `default.conf` com allowlist em regex + catch-all `return 403`
- [x] Copiar a configuração resultante para `deploy/nginx/react-default.conf` no repositório
- [x] Rodar `nginx -t` no container do SPA e recarregar; confirmar que o app continua funcional — **exigiu `docker restart sysloc-react-1`** (ver §6.1)
- [x] Criar `patches/v1_0/criar_papel_servico_app.py` (papel `Servico App` + 9 Custom DocPerms, idempotente)
- [x] Registrar o patch em `patches.txt` sob `[post_model_sync]`
- [x] Rodar `bench --site frontend migrate` e conferir que o papel e os 9 DocPerms existem
- [x] Rodar o patch uma segunda vez e conferir que nada duplicou — `Role = 1 | Custom DocPerm = 9`
- [x] Criar o usuário de serviço com papel `Servico App`, gerar `api_key`/`api_secret` e guardá-los em local seguro — `/opt/frappe/secrets/servico-app-credenciais.txt`
- [x] Substituir as duas credenciais em `main.3fb69968.js` pelo par do usuário de serviço
- [x] Exercitar o app: listagem, leitura de documento e um método whitelisted — todos 200

**Fase B — destrutiva (executada em 2026-07-28 mediante confirmação humana explícita):**

- [x] Apagar os 3 arquivos `.map` publicados — movidos para `reference/backups-tc001/*.bak-tc001` com `chmod 600` (o diretório já tem `.gitignore` com `*`), fora da árvore servida pelo nginx
- [x] Barreira permanente contra source maps: `location ~ \.map$ { return 404; }` no `default.conf`. **Não estava no plano original** e foi necessária: sem ela o `try_files` do `location /` respondia **200 com o `index.html`** em vez de 404, e o AC-05 pede 404 literal. Ganho adicional: um `deploy.sh` futuro sem `GENERATE_SOURCEMAP=false` deixa de reabrir a exposição em silêncio
- [x] Revogar `api_key`/`api_secret` do `Administrator` e do `api@dominio.com` — `api_key` gravada como **`NULL`**, não `""`: a coluna é `UNIQUE` em `tabUser`, e dois usuários com string vazia violariam a constraint. Linhas `api_secret` removidas de `__Auth`
- [x] Confirmar que a credencial antiga retorna 401 — **401** tanto pelo proxy (8300) quanto direto no backend (8200)
- [x] Definir `developer_mode: 0` no `site_config.json` e reiniciar o backend — via `bench set-config -p` (grava `int`, não string); `frappe-backend-1` voltou em ~3s. Backup do config anterior em `reference/backups-tc001/site_config.json.bak-tc001-faseb` (contém a `encryption_key`, `chmod 600`)
- [x] Remover os 6 dumps da raiz de `/opt/frappe` e atualizar `SHA256SUMS` — arquivados em `/opt/backups/frappe/dumps-iniciais-2026-03-06/` (`chmod 600`, dir `700`). O `SHA256SUMS` ficou só com a linha do `docker-compose.yaml`. **5 dos 6 foram arquivados** — ver o incidente do `db-data.tar.gz` na §11

---

## 9. Aceite Técnico (critérios objetivos)

A task estará concluída quando:

- [x] **AC-01** — Requisição a `/api/resource/Imovel` pelo proxy, autenticada com `token bc237221b65b5ed:d221c99298caf0a`, retorna **401** — verificado em 2026-07-28 pelo proxy (8300) **e** direto no backend (8200)
- [x] **AC-02** — Requisição a `/api/resource/User` pelo proxy retorna **403** (barrada pela allowlist, sem chegar ao Frappe)
- [x] **AC-03** — Requisição a `/api/method/frappe.client.get_list` pelo proxy retorna **403**; `/api/method/frappe.client.submit` **não** é barrada pela allowlist
- [x] **AC-04** — `grep -c "bc237221b65b5ed" /opt/react/sysloc/html/static/js/main.3fb69968.js` retorna **0**
- [x] **AC-05** — Nenhum arquivo `.map` existe sob `/opt/react/sysloc/html/static/`; requisição a `/static/js/main.3fb69968.js.map` retorna **404** — os 3 `.map` retornam 404, e um path arbitrário `*.map` também (a barreira é por extensão, não por arquivo)
- [x] **AC-06** — O usuário de serviço **não** possui os papéis `System Manager` nem `Administrator`; `frappe.get_roles(<usuario_servico>)` contém `Servico App`
- [x] **AC-07** — Com a credencial do usuário de serviço, os 9 DocTypes da allowlist respondem **200** em leitura, e `Contrato` aceita `frappe.client.submit`
- [x] **AC-08** — Com a credencial do usuário de serviço, `obter_configuracao` de `integracao_bancaria_api.service` retorna erro de permissão do Frappe (RN-11 intacta), **não** 200 e **não** 403 do nginx
- [x] **AC-09** — `bench --site <site> migrate` executado duas vezes seguidas produz exatamente 1 papel `Servico App` e 9 `Custom DocPerm` — sem duplicação
- [x] **AC-10** — `site_config.json` do site `frontend` tem `developer_mode: 0` — gravado como `int`; `frappe.conf.developer_mode == 0` confirmado no processo após o restart
- [x] **AC-11** — `api_key` de `Administrator` e de `api@dominio.com` está vazio e nenhum registro `api_secret` desses usuários existe em `__Auth` — `api_key` gravada como `NULL` (a coluna é `UNIQUE`; `""` em dois usuários violaria a constraint) e 0 linhas em `__Auth`. O único `api_key` vivo no site é o de `servico-app@dominio.com`
- [x] **AC-12** — Os 6 arquivos de dump não existem na raiz de `/opt/frappe`; `SHA256SUMS` não referencia arquivo inexistente — `sha256sum -c SHA256SUMS` passa com a única linha restante (`docker-compose.yaml`)
- [x] **AC-13** — `deploy/nginx/react-default.conf` existe no repositório e é idêntico ao `default.conf` em uso
- [x] **AC-14** — O SPA continua operacional de ponta a ponta: login, listagem de imóveis, abertura de contrato e emissão de boleto funcionam — validado pelo usuário no navegador em 2026-07-28, após o deploy do bundle `main.7154a9e7.js`. Verificação manual, sem captura de evidência automatizada
- [x] **AC-15** — Um usuário com papel `System Manager` que **não** seja o `Administrator` tem `read=0` nos 9 DocTypes de negócio e `read=1` em `Configuracao Integracao Bancaria` (fora dos 9), conforme **ADR-0003** — o sombreamento do `Custom DocPerm` sobre o `DocPerm` padrão é escopado por DocType e é consequência declarada, não efeito colateral
- [x] Guardrails respeitados (seção 7)

---

## 10. Testes

> Gerado pelo agente `agent-spec-qa-test-generator` em 2026-07-27.
>
> **Fronteira de automação (leia antes de executar)**: 11 dos 21 casos (CT-001 a CT-011) rodam na suíte do app (`docker compose exec -T backend bench --site frontend run-tests --app locacao_automation`). Os 10 restantes (CT-012 a CT-021) são **verificações operacionais**: dependem de nginx real, do bundle publicado, do filesystem do host ou do estado de produção pós-revogação, e **não** rodam em `bench run-tests`. Cada um traz o comando exato — a evidência (saída literal) deve ser registrada na checklist da seção 8 antes de concluir a task.

### 10.1 Testes Existentes a Modificar

- `app-sync/locacao_automation/locacao_automation/tests/test_integracao_bancaria_api.py` — estender a classe `TestSegurancaSystemManager` (hoje em `:452-482`) com o caso CT-010: um usuário cujo papel único é `Servico App` também é recusado pela RN-11. Reusar `_criar_active()` (herdado de `_BaseApiTest`) e parametrizar o helper `_criar_usuario` para aceitar a lista de papéis. **Não** criar arquivo novo para esse caso — a classe que cobre a RN-11 já existe.

### 10.2 Testes a Criar

**Integração / Segurança (`service-integration`)**

- `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` — CT-001 a CT-009, CT-011 e CT-022 a CT-024. Cobre: criação exata do papel e dos 9 Custom DocPerm, idempotência sob reexecução, matriz de flags concedidos, ausência dos 6 flags não-declarados, `role` estritamente igual a `Servico App`, não-alteração de papéis de usuários existentes, efetividade da permissão no motor do Frappe, a distinção entre o DocType built-in `User` e o custom `Usuario`, a caracterização do alcance de privilégio governado pela ADR-0003 e a convergência do patch sobre estado divergente.
  - **Setup (caminho legítimo)** — para CT-007, CT-008 e CT-009, que exigem sessão autenticada como usuário não-Administrator: criar um `User` real com `frappe.get_doc({...}).insert(ignore_permissions=True)`, atribuir o papel com `user.add_roles("Servico App")`, trocar a sessão com `frappe.set_user(usuario)` e restaurar com `self.addCleanup(lambda: frappe.set_user("Administrator"))`. É mecanismo nativo do `FrappeTestCase` (transação com rollback por teste) — nenhum símbolo de produção é criado ou exportado só para o teste. Análogo já no projeto: `tests/test_integracao_bancaria_api.py:452-476` (`TestSegurancaSystemManager._criar_usuario` + `frappe.set_user`).

**Operacional (`e2e` — fora da suíte)**

- CT-012 a CT-021 não têm arquivo de suíte. São comandos executados no host/container, com evidência registrada na seção 8.

### 10.2.1 Detalhamento dos Casos de Teste

#### CT-001 — Patch cria o papel `Servico App` e os 9 Custom DocPerm em uma única execução

- **Tipo**: INTEGRACAO | **Categoria**: caminho_feliz
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Executar `execute()` do patch, partindo de um site sem o papel `Servico App`, cria exatamente 1 Role `Servico App` e exatamente 9 Custom DocPerm (um por DocType da allowlist de negócio), nem a mais nem a menos.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Site de teste sem Role `Servico App` (garantir no `setUp` com `frappe.delete_doc("Role", "Servico App", ignore_permissions=True, force=True)` se existir)
  - Nenhum Custom DocPerm com `role="Servico App"` pré-existente
- **Dados de entrada**: nenhum dado externo — o patch não recebe parâmetros, opera sobre metadados do site. DocTypes alvo: `Atraso`, `Cobranca`, `Conjunto`, `Contrato`, `Fiador`, `Imovel`, `Locador`, `Locatario`, `Usuario`
- **Passos**:
  1. Importar `execute` de `locacao_automation.patches.v1_0.criar_papel_servico_app`
  2. Chamar `execute()` uma vez
  3. Consultar `frappe.db.exists("Role", "Servico App")`
  4. Consultar `frappe.get_all("Custom DocPerm", filters={"role": "Servico App"}, fields=["parent"])`
- **Resultado esperado**: `frappe.db.exists("Role", "Servico App")` é truthy; a lista de Custom DocPerm tem `len == 9` e o conjunto de `parent` é exatamente `{"Atraso","Cobranca","Conjunto","Contrato","Fiador","Imovel","Locador","Locatario","Usuario"}` — sem duplicata, sem DocType a mais ou a menos
- **Negative companion**: → CT-002: estado onde o papel e os 9 DocPerm já existem (patch reexecutado sobre si mesmo) — contagem permanece exatamente 1 Role + 9 Custom DocPerm
- **Critérios validados**: AC-09
- **Obs**: arquivo novo espelhando `test_patch_migracao_config.py` (docstring com rastreabilidade `CA-xx → CT-xxx`, seção INVARIANTES, `FrappeTestCase`). Nenhuma suíte existente cobre criação de Role/Custom DocPerm — é a primeira estrutura de permissão versionada via patch no projeto (ADR-0002).

#### CT-002 — Reexecução do patch não duplica papel nem DocPerms

- **Tipo**: INTEGRACAO | **Categoria**: caso_extremo
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Chamar `execute()` duas vezes seguidas produz o mesmo estado final que chamar uma vez: exatamente 1 Role `Servico App` e 9 Custom DocPerm, com os mesmos flags — reexecução é no-op observável.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: mesmas de CT-001
- **Dados de entrada**: nenhum dado externo
- **Passos**:
  1. Chamar `execute()` (1ª vez)
  2. Capturar snapshot: `frappe.db.count("Role", {"name": "Servico App"})` e a lista completa dos 9 Custom DocPerm com todos os flags, ordenada por `parent`
  3. Chamar `execute()` (2ª vez)
  4. Capturar o mesmo snapshot novamente
- **Resultado esperado**: `frappe.db.count("Role", {"name": "Servico App"}) == 1` após a 1ª e após a 2ª execução; a lista dos 9 Custom DocPerm (nome, role, parent, todos os flags) é idêntica entre os dois snapshots — nenhuma linha nova, nenhum `name` de DocPerm diferente
- **Negative companion**: este é o caso negativo (`ct_id: self`) de CT-001
- **Critérios validados**: AC-09
- **Obs**: espelha `test_ct026_reexecucao_e_idempotente` de `test_patch_migracao_config.py:143-165`. Cobre a idempotência via chamada direta a `execute()`; a validação de AC-09 tal como escrita (`bench migrate` duas vezes) permanece como confirmação operacional no passo 8 da checklist.

#### CT-003 — Matriz de flags concedidos por DocType (read/write/create/delete=1; submit=1 apenas em `Contrato`)

- **Tipo**: INTEGRACAO | **Categoria**: fronteira
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Para cada um dos 9 DocTypes, o Custom DocPerm de `Servico App` tem `read=1, write=1, create=1, delete=1`; e `submit=1` se e somente se o DocType for `Contrato`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: `execute()` já chamado no `setUp`
- **Dados de entrada**: tabela parametrizada por DocType — sem submit: `Atraso`, `Cobranca`, `Conjunto`, `Fiador`, `Imovel`, `Locador`, `Locatario`, `Usuario`; com submit: `Contrato`
- **Passos**:
  1. Para cada DocType, ler `frappe.get_doc("Custom DocPerm", {"parent": doctype, "role": "Servico App"})`
  2. Ler os campos `read`, `write`, `create`, `delete`, `submit`
- **Resultado esperado**: para os 8 sem submit, `(read, write, create, delete, submit) == (1, 1, 1, 1, 0)`; para `Contrato`, `(1, 1, 1, 1, 1)`
- **Negative companion**: → CT-004: consulta dos flags não declarados (`report`/`export`/`import`/`share`/`print`/`email`) nos mesmos 9 registros — todos valem 0
- **Critérios validados**: AC-07
- **Obs**: table-driven — um único método com `self.subTest(doctype=...)`, evitando 9 métodos quase idênticos.

#### CT-004 — Nenhum flag além dos declarados é concedido

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Nos 9 Custom DocPerm de `Servico App`, os flags `report`, `export`, `import`, `share`, `print` e `email` valem 0 em todos os registros — o patch nunca concede permissão além da declarada em §6.2 (guardrail §7.2).
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: `execute()` já chamado
- **Dados de entrada**: 9 DocTypes × 6 flags não declarados = 54 pontos de verificação
- **Passos**:
  1. Para cada um dos 9 Custom DocPerm, ler os 6 campos proibidos
  2. Agregar em `subTest` por combinação DocType × flag
- **Resultado esperado**: para todos os 9 DocPerm e todos os 6 flags, valor `== 0`. Qualquer flag `== 1` falha o teste identificando DocType e flag no `subTest`
- **Negative companion**: → CT-003 (positivo, flags concedidos)
- **Critérios validados**: AC-07
- **Obs**: guarda contra escalonamento silencioso — se o `Custom DocPerm` herdar default 1 do framework para algum flag e o patch esquecer de zerá-lo, este teste pega.

#### CT-005 — Os 9 Custom DocPerm apontam exatamente para o papel `Servico App`

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: O campo `role` de cada um dos 9 Custom DocPerm é exatamente a string `Servico App` — nunca `All`, string vazia, `System Manager` ou `Administrator`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: `execute()` já chamado
- **Dados de entrada**: os 9 Custom DocPerm criados
- **Passos**:
  1. `frappe.get_all("Custom DocPerm", filters={"parent": ["in", DOCTYPES_ALVO]}, fields=["parent", "role"])`
  2. Verificar que a lista tem 9 itens e que `role` de cada item é exatamente `Servico App`
- **Resultado esperado**: 9 registros retornados; `role == "Servico App"` (igualdade estrita) em todos — nenhum valor `All`, vazio ou administrativo
- **Negative companion**: este é o caso negativo (`ct_id: self`) — `role` apontando para `All` ou `System Manager` seria capturado pela mesma assertion de igualdade estrita
- **Critérios validados**: AC-06
- **Obs**: guardrail direto contra o NÃO-DEVE de §7.2 na camada estrutural — se o campo `role` fosse gravado errado (copiar/colar de outro DocPerm), o teste pega antes de qualquer verificação em runtime.

#### CT-006 — Execução do patch não altera papéis de usuários existentes

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Executar o patch cria a estrutura mas não atribui `Servico App` a nenhum usuário existente — `frappe.get_roles("Administrator")` é idêntico antes e depois, e `Servico App` não está entre eles.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: nenhuma — usa o `Administrator` já existente no site de teste
- **Dados de entrada**: papéis do `Administrator` antes/depois
- **Passos**:
  1. Capturar `set(frappe.get_roles("Administrator"))` antes de `execute()`
  2. Chamar `execute()`
  3. Capturar `set(frappe.get_roles("Administrator"))` depois
- **Resultado esperado**: os dois conjuntos são idênticos (`assertEqual`); `System Manager` presente nos dois; `Servico App` ausente nos dois
- **Negative companion**: este é o caso negativo (`ct_id: self`) — estado antes vs. depois
- **Critérios validados**: AC-06
- **Obs**: cobre a metade automatizável de AC-06 — o patch nunca concede papel a usuário algum. Que o usuário de serviço real (criado conforme §6.2) não tenha `System Manager` é verificação operacional, coberta por CT-018 e pela checklist.

#### CT-007 — Usuário com papel único `Servico App` tem permissão efetiva nos 9 DocTypes

- **Tipo**: INTEGRACAO | **Categoria**: caminho_feliz
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Um usuário cujo único papel é `Servico App` satisfaz `frappe.has_permission(doctype, ptype)` para ptype em `{read, write, create, delete}` em cada um dos 9 DocTypes — a permissão do Custom DocPerm é efetiva no motor de permissão do Frappe, não apenas uma linha solta na tabela.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - `execute()` já chamado (Role + DocPerm existem)
  - Usuário de teste criado com papel único `Servico App`, sem `System Manager`
- **Dados de entrada**: table-driven — 9 DocTypes × 4 ptypes (`read`, `write`, `create`, `delete`)
- **Passos**:
  1. Criar usuário de teste com papel único `Servico App`
  2. `frappe.set_user(usuario)`
  3. Para cada par (doctype, ptype): `frappe.has_permission(doctype, ptype)`
- **Resultado esperado**: `frappe.has_permission(doctype, ptype)` retorna `True` para os 36 pares
- **Negative companion**: → CT-008: mesmo usuário, DocType `User` (fora da allowlist) e os 6 ptypes não declarados — `has_permission` retorna falsy em todos
- **Precondição privilegiada**: criar um `User` real via `frappe.get_doc({...}).insert(ignore_permissions=True)`, `user.add_roles("Servico App")`, `frappe.set_user(usuario)` e restaurar com `self.addCleanup(lambda: frappe.set_user("Administrator"))` — mecanismo nativo do `FrappeTestCase`, nenhum símbolo de produção criado só para o teste. Análogo: `tests/test_integracao_bancaria_api.py:452-476`
- **Critérios validados**: AC-07
- **Obs**: valida a precondição de permissão de AC-07 pelo caminho real do framework. O "200 via proxy" literal exige HTTP através do nginx e é coberto por CT-021.

#### CT-008 — Usuário `Servico App` não tem permissão fora da allowlist nem em ptype não declarado

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: O mesmo usuário não satisfaz `frappe.has_permission("User", "read")` (DocType built-in, fora da allowlist), nem `has_permission(doctype, ptype)` para ptype em `{report, export, import, share, print, email}` em nenhum dos 9 DocTypes.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: mesmas de CT-007
- **Dados de entrada**: DocType fora da allowlist (`User`) + 6 ptypes não declarados nos 9 DocTypes
- **Passos**:
  1. Com a sessão do usuário `Servico App` ativa: `frappe.has_permission("User", "read")`
  2. Para cada um dos 9 DocTypes × 6 ptypes não declarados: `frappe.has_permission(doctype, ptype)`
- **Resultado esperado**: `frappe.has_permission("User", "read")` é falsy; todos os 54 pares de ptype não declarado retornam falsy
- **Negative companion**: → CT-007 (positivo)
- **Precondição privilegiada**: idêntica a CT-007 — reusar o mesmo usuário/sessão dentro da mesma classe. Análogo: `tests/test_integracao_bancaria_api.py:452-476`
- **Critérios validados**: AC-07
- **Obs**: o DocType `User` (built-in) é distinto de `Usuario` (custom, na allowlist) — este CT garante que a semelhança de nomes não confundiu a criação do DocPerm. É o mesmo vetor de AC-02, validado na camada de backend em vez do proxy.

#### CT-009 — Permissão de submit é exclusiva de `Contrato`

- **Tipo**: INTEGRACAO | **Categoria**: fronteira
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Um usuário com papel único `Servico App` satisfaz `frappe.has_permission("Contrato", "submit")`, mas não satisfaz `has_permission(doctype, "submit")` para nenhum dos outros 8 DocTypes — o bundle chama `frappe.client.submit` apenas para ativar contrato.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Mesmas de CT-007
  - `Contrato` é `is_submittable` no site de teste (já é, DocType de produção existente)
- **Dados de entrada**: 9 DocTypes consultados com `ptype="submit"`
- **Passos**:
  1. Com sessão do usuário `Servico App`: `frappe.has_permission("Contrato", "submit")`
  2. Para cada um dos outros 8 DocTypes: `frappe.has_permission(doctype, "submit")`
- **Resultado esperado**: `has_permission("Contrato", "submit")` é truthy; falsy para os outros 8
- **Negative companion**: este é o caso negativo (`ct_id: self`) — os 8 DocTypes consultados com `submit`
- **Precondição privilegiada**: idêntica a CT-007. Análogo: `tests/test_integracao_bancaria_api.py:452-476`
- **Critérios validados**: AC-07
- **Obs**: complementa CT-003 (que valida o flag gravado) verificando que o flag é efetivo no motor de permissão.

#### CT-010 — Usuário `Servico App` é recusado pela RN-11 em `integracao_bancaria_api.service`

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_integracao_bancaria_api.py` (modificar — classe `TestSegurancaSystemManager`)
- **Invariant**: Um usuário cujo único papel é `Servico App` (com DocPerms amplos nos 9 DocTypes) continua recebendo `frappe.PermissionError` ao chamar `obter_configuracao` e demais métodos whitelisted — `_exigir_system_manager()` (RN-11) não é contornada por DocPerm de DocType, papel amplo ou existência do papel `Servico App`.
- **Owning layer**: `service-integration` (route-level sobre service) | **Real execution boundary**: `db`
- **Pré-condições**:
  - Patch `criar_papel_servico_app` executado
  - `_criar_active()` chamada (configuração ativa existe, para o método chegar até a verificação de papel e não falhar antes por falta de dado)
  - Usuário de teste com papel único `Servico App`
- **Dados de entrada**: chamada aos 3 métodos já cobertos por CT-029 (`obter_configuracao`, `salvar_configuracao`, `testar_conexao`) sob a nova sessão
- **Passos**:
  1. Criar/obter configuração ativa via `_criar_active()`
  2. Criar usuário de teste com papel único `Servico App`
  3. `frappe.set_user(usuario)`
  4. Para cada método, chamar e capturar exceção
- **Resultado esperado**: os 3 métodos levantam `frappe.PermissionError` — nenhum retorna sucesso, mesmo com o papel tendo DocPerms amplos nos 9 DocTypes
- **Negative companion**: este é o caso negativo (`ct_id: self`); a positiva análoga já existe em `test_ct029_com_role_administrativa_permitido`
- **Precondição privilegiada**: estender `TestSegurancaSystemManager` reusando `self._criar_active()` e parametrizando `_criar_usuario` para atribuir `Servico App`; `frappe.set_user` + `addCleanup`, igual ao teste existente. Análogo: `tests/test_integracao_bancaria_api.py:452-482`
- **Critérios validados**: AC-08
- **Obs**: estende a classe existente, **não** cria arquivo novo. Diferencia-se de CT-029: aquele prova que falta de papel bloqueia; este prova que ter um papel amplo e não administrativo também não basta — fecha exatamente a lacuna que esta TaskCard introduz.

#### CT-011 — Nenhum Custom DocPerm é criado para o DocType built-in `User`

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Após `execute()`, não existe Custom DocPerm com `parent="User"` e `role="Servico App"` — a semelhança entre o custom `Usuario` (na allowlist) e o built-in `User` (barrado por AC-02) nunca é confundida pelo patch.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: `execute()` já chamado
- **Dados de entrada**: consulta pontual — `User` (built-in) e `Usuario` (custom, controle positivo)
- **Passos**:
  1. `frappe.db.exists("Custom DocPerm", {"parent": "User", "role": "Servico App"})`
  2. `frappe.db.exists("Custom DocPerm", {"parent": "Usuario", "role": "Servico App"})` (controle positivo)
- **Resultado esperado**: o primeiro `exists` retorna falsy; o segundo retorna truthy
- **Negative companion**: este é o caso negativo (`ct_id: self`) — consulta por `parent="User"` em vez de `Usuario`
- **Critérios validados**: AC-06
- **Obs**: blast radius alto e barato de testar — um erro de digitação (`"User"` em vez de `"Usuario"`) daria ao usuário de serviço leitura e escrita na tabela de usuários do sistema, exatamente o vetor que AC-02 fecha no proxy.

#### CT-012 — [operacional] Credencial revogada do `Administrator` retorna 401 no proxy

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: nenhum — verificação operacional, fora de `bench run-tests`
- **Invariant**: Após a revogação (§6.5), uma requisição autenticada com a credencial antiga (`bc237221b65b5ed:d221c99298caf0a`) contra qualquer endpoint do proxy retorna 401.
- **Owning layer**: `e2e` | **Real execution boundary**: `http`
- **Pré-condições**: passos §6.1 a §6.5 já executados
- **Dados de entrada**: header `Authorization: token bc237221b65b5ed:d221c99298caf0a`
- **Passos**:
  1. `curl -i -H "Authorization: token bc237221b65b5ed:d221c99298caf0a" https://<host>/api/resource/Imovel`
- **Resultado esperado**: HTTP status **401**
- **Negative companion**: este é o caso negativo (`ct_id: self`) — credencial revogada
- **Critérios validados**: AC-01
- **Obs**: exige nginx real e a credencial já revogada em produção. Registrar o status code retornado como evidência na seção 8.

#### CT-013 — [operacional] `/api/resource/User` barrado pela allowlist (403 do nginx)

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: Uma requisição a `/api/resource/User` pelo proxy retorna 403 do próprio nginx (catch-all), sem repassar ao backend Frappe.
- **Owning layer**: `e2e` | **Real execution boundary**: `http`
- **Pré-condições**: allowlist do nginx (§6.1) aplicada e `nginx -t` validado
- **Dados de entrada**: path `/api/resource/User`
- **Passos**:
  1. `curl -i https://<host>/api/resource/User`
- **Resultado esperado**: HTTP status **403**, vindo do bloco `location /api/` catch-all
- **Negative companion**: este é o caso negativo (`ct_id: self`) — endpoint fora da allowlist
- **Critérios validados**: AC-02
- **Obs**: complementa CT-008, que garante na camada de permissão que mesmo se a requisição chegasse ao Frappe seria negada — as duas camadas fecham a defesa em profundidade.

#### CT-014 — [operacional] `frappe.client.get_list` barrado; `frappe.client.submit` não

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: `/api/method/frappe.client.get_list` retorna 403 do nginx; `/api/method/frappe.client.submit` não é barrado pela allowlist (chega ao Frappe, que decide por permissão).
- **Owning layer**: `e2e` | **Real execution boundary**: `http`
- **Pré-condições**: allowlist aplicada
- **Dados de entrada**: barrado — `frappe.client.get_list`; permitido — `frappe.client.submit`
- **Passos**:
  1. `curl -i https://<host>/api/method/frappe.client.get_list`
  2. `curl -i -H "Authorization: token <servico>" -X POST https://<host>/api/method/frappe.client.submit -d 'doctype=Contrato&name=<ct-teste>'`
- **Resultado esperado**: 1ª chamada retorna HTTP **403** do nginx; 2ª chamada **não** retorna o 403 genérico de allowlist (pode ser 200 ou erro de negócio do Frappe)
- **Negative companion**: este é o caso negativo (`ct_id: self`) — o par barrado/permitido do mesmo AC
- **Critérios validados**: AC-03
- **Obs**: também detecta erro de escaping no regex — um `.` não escapado em `frappe\.client\.submit` casaria mais amplo do que o pretendido.

#### CT-015 — [operacional] Bundle publicado sem a credencial do `Administrator`

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: O arquivo `main.3fb69968.js` servido publicamente não contém a string `bc237221b65b5ed` em nenhuma ocorrência.
- **Owning layer**: `e2e` | **Real execution boundary**: `filesystem`
- **Pré-condições**: passo §6.3 executado
- **Dados de entrada**: arquivo `/opt/react/sysloc/html/static/js/main.3fb69968.js`, padrão `bc237221b65b5ed`
- **Passos**:
  1. `grep -c "bc237221b65b5ed" /opt/react/sysloc/html/static/js/main.3fb69968.js`
- **Resultado esperado**: saída do comando é exatamente `0`
- **Negative companion**: este é o caso negativo (`ct_id: self`) — busca pela credencial que deveria ter sido removida
- **Critérios validados**: AC-04
- **Obs**: rodar o mesmo `grep` para `d221c99298caf0a` (api_secret) como checagem adicional — §5.3 cita as duas credenciais, mas o AC formal só nomeia a `api_key`.

#### CT-016 — [operacional] Nenhum source map publicado; `.map` retorna 404

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: Nenhum arquivo `.map` existe sob `/opt/react/sysloc/html/static/` e uma requisição a `/static/js/main.3fb69968.js.map` retorna 404.
- **Owning layer**: `e2e` | **Real execution boundary**: `filesystem`
- **Pré-condições**: os 3 arquivos `.map` apagados
- **Dados de entrada**: diretório `/opt/react/sysloc/html/static/`; URL `/static/js/main.3fb69968.js.map`
- **Passos**:
  1. `find /opt/react/sysloc/html/static/ -iname '*.map'`
  2. `curl -i https://<host>/static/js/main.3fb69968.js.map`
- **Resultado esperado**: `find` não retorna nenhuma linha; `curl` retorna HTTP status **404**
- **Negative companion**: este é o caso negativo (`ct_id: self`) — ausência do artefato que vazava o código-fonte
- **Critérios validados**: AC-05

#### CT-017 — [operacional] `developer_mode` desligado no `site_config.json`

- **Tipo**: INTEGRACAO | **Categoria**: integridade_dados
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: O `site_config.json` do site `frontend` tem a chave `developer_mode` com valor `0`.
- **Owning layer**: `e2e` | **Real execution boundary**: `filesystem`
- **Pré-condições**: passo §6.6 executado e backend reiniciado
- **Dados de entrada**: `sites/frontend/site_config.json` dentro de `frappe-backend-1`
- **Passos**:
  1. `docker compose exec -T backend cat sites/frontend/site_config.json | grep developer_mode`
- **Resultado esperado**: a saída contém `"developer_mode": 0`
- **Negative companion**: este é o caso negativo (`ct_id: self`) — verifica que o flag de risco foi desligado
- **Critérios validados**: AC-10
- **Obs**: é checagem de configuração de infraestrutura, não de comportamento de código — não cabe em `bench run-tests`.

#### CT-018 — [operacional] `api_key` e `api_secret` de `Administrator` e `api@dominio.com` revogados

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: nenhum — verificação operacional (site de **produção**, não de teste)
- **Invariant**: Após §6.5, `api_key` de `Administrator` e de `api@dominio.com` está vazio, e não existe registro `api_secret` para nenhum dos dois em `__Auth`.
- **Owning layer**: `e2e` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Passo §6.5 executado
  - AC-07 e a validação de §6.4 já confirmados com a credencial de serviço **antes** deste passo
- **Dados de entrada**: usuários `Administrator` e `api@dominio.com`
- **Passos**:
  1. `docker compose exec -T backend bench --site frontend console`
  2. No console: `frappe.db.get_value("User", "Administrator", "api_key")` e o mesmo para `api@dominio.com`
  3. `frappe.db.get_value("__Auth", {"doctype": "User", "name": "Administrator", "fieldname": "api_secret"}, "name")` e o mesmo para `api@dominio.com`
- **Resultado esperado**: `api_key` retorna vazio/`None` para os dois; a consulta em `__Auth` retorna `None` para os dois
- **Negative companion**: este é o caso negativo (`ct_id: self`) — verifica ausência da credencial revogada
- **Critérios validados**: AC-11
- **Obs**: deliberadamente **não** automatizado como teste de suíte — inspeciona dado do site de produção pós-revogação; rodar em `bench run-tests` misturaria dado de teste com estado de produção. É o passo de maior risco da task (§11): executar só depois de CT-012 confirmar 401 e a validação de §6.4 ter passado.

#### CT-019 — [operacional] Dumps removidos e `SHA256SUMS` sem referência órfã

- **Tipo**: INTEGRACAO | **Categoria**: integridade_dados
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: Os 6 arquivos de dump não existem mais na raiz de `/opt/frappe`, e `SHA256SUMS` não referencia nenhum arquivo inexistente.
- **Owning layer**: `e2e` | **Real execution boundary**: `filesystem`
- **Pré-condições**: passo §6.6 executado
- **Dados de entrada**: `mariadb_all.sql`, `db-data.tar.gz`, `sites.tar.gz`, `redis-cache-data.tar.gz`, `redis-queue-data.tar.gz`, `logs.tar.gz`
- **Passos**:
  1. `for f in mariadb_all.sql db-data.tar.gz sites.tar.gz redis-cache-data.tar.gz redis-queue-data.tar.gz logs.tar.gz; do test -e "/opt/frappe/$f" && echo "AINDA EXISTE: $f"; done`
  2. Se `SHA256SUMS` ainda existir: `sha256sum -c /opt/frappe/SHA256SUMS 2>&1 | grep -i 'no such file'`
- **Resultado esperado**: o primeiro comando não imprime nada; o segundo não retorna nenhuma linha `no such file` (ou `SHA256SUMS` foi removido por não ter mais entradas válidas)
- **Negative companion**: este é o caso negativo (`ct_id: self`) — ausência dos 6 arquivos e de referências órfãs
- **Critérios validados**: AC-12

#### CT-020 — [operacional] Config versionada do nginx idêntica à em uso

- **Tipo**: INTEGRACAO | **Categoria**: integridade_dados
- **Arquivo**: nenhum — verificação operacional
- **Invariant**: `deploy/nginx/react-default.conf` existe e é byte-a-byte idêntico ao `default.conf` em uso pelo container do SPA.
- **Owning layer**: `e2e` | **Real execution boundary**: `filesystem`
- **Pré-condições**: passos §6.1 e a cópia para o repositório executados
- **Dados de entrada**: versionado — `deploy/nginx/react-default.conf`; em uso — `/opt/react/sysloc/nginx/default.conf`
- **Passos**:
  1. `diff /opt/frappe/deploy/nginx/react-default.conf /opt/react/sysloc/nginx/default.conf`
- **Resultado esperado**: `diff` não produz saída e retorna código de saída **0**
- **Negative companion**: este é o caso negativo (`ct_id: self`) — ausência de divergência entre versionado e em produção
- **Critérios validados**: AC-13

#### CT-021 — [operacional] Smoke E2E: SPA operacional de ponta a ponta após a contenção

- **Tipo**: E2E | **Categoria**: interacao_usuario
- **Arquivo**: nenhum — smoke test manual
- **Invariant**: Após todos os passos da contenção, o SPA continua funcional para o fluxo completo: login, listagem de imóveis, abertura de contrato e emissão de boleto — a contenção não quebrou nenhuma funcionalidade de negócio.
- **Owning layer**: `e2e` | **Real execution boundary**: `http`
- **Pré-condições**: todos os passos da checklist (§8) concluídos, incluindo revogação e `developer_mode: 0`
- **Dados de entrada**: navegação manual pelo SPA publicado — fluxos de login, listagem, contrato e boleto
- **Passos**:
  1. Abrir o SPA publicado e fazer login
  2. Navegar até a listagem de imóveis (`all_imoveis`)
  3. Abrir um contrato existente (`contrato_pdf.service.abrir_contrato`)
  4. Emitir um boleto (`cobranca_boleto.service.abrir_boleto` ou fluxo Sicoob)
- **Resultado esperado**: os 4 fluxos completam sem 401, 403 ou 500 na aba de rede do navegador; a interface responde normalmente em cada etapa
- **Negative companion**: → CT-002 (garante que o papel e os DocPerms que sustentam este fluxo não regridem em reexecução do patch)
- **Critérios validados**: AC-14
- **Obs**: executar **duas vezes** — imediatamente após §6.4 (antes da revogação) e novamente ao final (após §6.6), conforme a ordem de risco de §11.

#### CT-022 — Sombreamento retira os 9 DocTypes de um `System Manager` não-Administrator (ADR-0003)

- **Tipo**: SEGURANCA | **Categoria**: caracterizacao
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Um usuário cujo papel é `System Manager` e que **não** é o `Administrator` resolve `read` truthy nos 9 DocTypes **antes** de `execute()` e falsy **depois** — porque `get_valid_perms` descarta o `DocPerm` padrão de todo DocType que passe a ter ao menos um `Custom DocPerm`. `Configuracao Integracao Bancaria`, fora dos 9 e sem `Custom DocPerm`, permanece truthy nas duas fases.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Estado limpo do `setUp` (papel `Servico App` e seus `Custom DocPerm` removidos), para que os 9 DocTypes estejam sob o `DocPerm` padrão na fase "antes"
  - `User` real criado e com `add_roles("System Manager")` — nunca o `Administrator`, que curto-circuita a checagem de permissão e não mede nada
- **Dados de entrada**: os 9 DocTypes de negócio + `Configuracao Integracao Bancaria` como controle positivo
- **Passos**:
  1. Criar o usuário `System Manager` e afirmar que ele não é o `Administrator`
  2. Para cada um dos 9 DocTypes: `get_role_permissions(frappe.get_meta(doctype), user=usuario).get("read")` (fase "antes")
  3. `get_role_permissions(...)` para `Configuracao Integracao Bancaria` (fase "antes")
  4. Chamar `execute()` e `frappe.clear_cache()`
  5. Repetir os passos 2 e 3 (fase "depois")
- **Resultado esperado**: fase "antes" — truthy nos 9 e no controle; fase "depois" — falsy nos 9 e **truthy** no controle; `frappe.db.exists("Custom DocPerm", {"parent": "Configuracao Integracao Bancaria"})` falsy
- **Negative companion**: o controle positivo (`Configuracao Integracao Bancaria`) é o negativo dentro do próprio caso — sem ele o teste não distinguiria sombreamento escopado por DocType de uma quebra global de permissão
- **Precondição privilegiada**: `User` real + `add_roles` pelo caminho legítimo, análogo a `TestPermissaoEfetivaServicoApp._criar_usuario_servico_app`. Nenhum símbolo test-only em produção
- **Critérios validados**: AC-15
- **Obs**: teste de **caracterização** — fixa uma consequência deliberada, não um requisito funcional. Se um dia a decisão da ADR-0003 for revista, este é o teste que deve falhar primeiro. Fecha o `BAIXO-003` do QA.

#### CT-023 — Reexecução reconverge flag negado escalado pelo Desk no `Custom DocPerm`

- **Tipo**: SEGURANCA | **Categoria**: seguranca
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: Um `Custom DocPerm` do papel `Servico App` cujos flags foram alterados por fora (`export=1`, `report=1`, `delete=0` — exatamente o que o Role Permissions Manager do Desk grava) volta à matriz declarada em §6.2 na reexecução de `execute()`, **sem** duplicar linha e **sem** trocar o `name` do registro.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: `execute()` chamado uma vez (os 9 registros existem)
- **Dados de entrada**: DocType semeado `Locatario` (dado pessoal — o alvo de exfiltração citado no risco); flags semeados `export=1`, `report=1`, `delete=0`
- **Passos**:
  1. `execute()` e capturar o `name` do `Custom DocPerm` de `Locatario`
  2. `frappe.db.set_value("Custom DocPerm", name, {"export": 1, "report": 1, "delete": 0})` e confirmar que a semeadura pegou
  3. `execute()` (2ª vez)
  4. Reler todos os flags do mesmo `name`; recontar os `Custom DocPerm` do papel; reconsultar o `name` pelo filtro `(parent, role, permlevel)`
- **Resultado esperado**: `(read, write, create, delete, submit) == (1, 1, 1, 1, 0)`; os 6 flags não declarados valem `0` — incluindo `export` e `report`, que estavam em 1; a contagem segue **9**; o `name` reconsultado é o mesmo do passo 1
- **Negative companion**: → CT-002 (reexecução sobre estado íntegro é no-op observável) — juntos provam que a reescrita converge sem duplicar
- **Critérios validados**: AC-07, AC-09
- **Obs**: idempotência (não duplicar) e convergência (reafirmar) são propriedades distintas; CT-002 cobria só a primeira. Como a credencial de `Servico App` é pública por desenho, um `export=1` marcado por engano no Desk viraria exfiltração em massa que nenhum `bench migrate` reverteria.

#### CT-024 — Reexecução reconverge o papel e repromove o usuário rebaixado

- **Tipo**: SEGURANCA | **Categoria**: caso_extremo
- **Arquivo**: `tests/test_patch_criar_papel_servico_app.py` (criar)
- **Invariant**: `desk_access` zerado e `disabled` marcado no Role `Servico App` voltam a `1` e `0` na reexecução; além disso, o usuário que o rebaixamento tornou `Website User` volta a `System User` — a reafirmação passa pela API de documento, porque só o `on_update` do `Role` refaz o `user_type`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**: `execute()` chamado uma vez; usuário real com papel único `Servico App` (nasce `System User`)
- **Dados de entrada**: `desk_access=0` gravado pela API de documento (caminho do Desk, dispara o rebaixamento); `disabled=1` gravado por `db.set_value` (linha editada fora dos hooks)
- **Passos**:
  1. `execute()`; criar usuário com papel único `Servico App`; afirmar `user_type == "System User"`
  2. `papel.desk_access = 0; papel.save()`; afirmar `user_type == "Website User"`
  3. `execute()` e `frappe.clear_cache()`
  4. `frappe.db.set_value("Role", "Servico App", "disabled", 1)`; `execute()`
- **Resultado esperado**: após o passo 3 — `desk_access == 1` e `user_type == "System User"`; após o passo 4 — `disabled == 0` e a contagem de Role segue `1`
- **Negative companion**: → CT-002 (papel íntegro: reexecução não altera nada)
- **Precondição privilegiada**: `User` real + `add_roles`; nenhum símbolo test-only. O rebaixamento é produzido pelo mecanismo real do framework, não forjado
- **Critérios validados**: AC-06, AC-09
- **Obs**: `desk_access=0` é o modo de falha mais caro do papel — derruba a REST API do SPA inteiro com um 403 que não vem da allowlist. Justifica o uso de `save()` em vez de `db.set_value` em `_garantir_papel`.

### 10.3 Cenários Obrigatórios

- [ ] CT-001 — patch cria exatamente 1 papel e 9 Custom DocPerm
- [ ] CT-002 — reexecução do patch é no-op observável (idempotência)
- [ ] CT-003 — matriz de flags concedidos correta; submit só em `Contrato`
- [ ] CT-004 — nenhum flag além dos declarados é concedido
- [ ] CT-005 — `role` dos 9 DocPerm é estritamente `Servico App`
- [ ] CT-006 — patch não altera papéis de usuários existentes
- [ ] CT-007 — permissão efetiva nos 9 DocTypes para o papel de serviço
- [ ] CT-008 — sem permissão em `User` nem em ptype não declarado
- [ ] CT-009 — submit exclusivo de `Contrato`
- [ ] CT-010 — RN-11 recusa o papel `Servico App` na integração bancária
- [ ] CT-011 — nenhum DocPerm para o built-in `User`
- [ ] CT-012 — [operacional] credencial antiga retorna 401
- [ ] CT-013 — [operacional] `/api/resource/User` barrado com 403
- [ ] CT-014 — [operacional] `get_list` barrado, `submit` permitido
- [ ] CT-015 — [operacional] bundle sem a credencial do `Administrator`
- [ ] CT-016 — [operacional] nenhum `.map` publicado; 404 na URL
- [ ] CT-017 — [operacional] `developer_mode: 0`
- [ ] CT-018 — [operacional] chaves de API revogadas nos dois usuários
- [ ] CT-019 — [operacional] dumps removidos, `SHA256SUMS` consistente
- [ ] CT-020 — [operacional] config do nginx versionada idêntica à em uso
- [ ] CT-021 — [operacional] smoke E2E do SPA (antes e depois da revogação)
- [ ] CT-022 — sombreamento retira os 9 DocTypes de um `System Manager` não-Administrator; `Configuracao Integracao Bancaria` intacta (ADR-0003)
- [ ] CT-023 — flag negado escalado pelo Desk volta a 0 na reexecução, sem duplicar
- [ ] CT-024 — `desk_access`/`disabled` do papel reconvergem e o usuário rebaixado volta a `System User`

### 10.4 Padrões de Teste

- **Stack**: Frappe Framework (Python) — app `locacao_automation`, site `frontend`
- **Framework**: `unittest` via `frappe.tests.utils.FrappeTestCase` (transação com rollback automático por teste)
- **Comando**: `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation`
- **Convenção de nomes**: `test_ct{NNN}_{cenario_em_snake_case}`, com docstring de rastreabilidade `CA-xx → CT-xxx (RN-xx)` e seção **INVARIANTES** no topo de cada arquivo
- **Fixture/Setup**: helpers `_criar_active()` e `_criar_usuario()` herdados de `_BaseApiTest`; `setUp` com limpeza idempotente; `self.addCleanup(...)` para restaurar sessão
- **Mocks**: mínimos — os testes exercitam o banco real dentro da transação de teste; troca de sessão via `frappe.set_user`, nunca mock do motor de permissão
- **Table-driven**: `self.subTest(...)` para matrizes DocType × ptype, evitando métodos quase idênticos

### 10.5 Cenários de Erro

| Cenário | Trigger | Expected | Código/Status |
|---|---|---|---|
| Credencial vazada revogada | `curl` com `token bc237221b65b5ed:d221c99298caf0a` | Requisição rejeitada pelo Frappe | HTTP **401** |
| DocType fora da allowlist | `GET /api/resource/User` pelo proxy | Barrado pelo catch-all do nginx, sem chegar ao backend | HTTP **403** |
| Método genérico do framework | `GET /api/method/frappe.client.get_list` | Barrado pelo catch-all do nginx | HTTP **403** |
| Source map removido | `GET /static/js/main.3fb69968.js.map` | Arquivo inexistente | HTTP **404** |
| Papel `Servico App` na integração bancária | `obter_configuracao()` / `salvar_configuracao()` / `testar_conexao()` com sessão do papel de serviço | RN-11 recusa mesmo com DocPerms amplos | `frappe.PermissionError` |
| Papel `Servico App` no DocType `User` | `frappe.has_permission("User", "read")` com sessão do papel de serviço | Sem permissão | falsy |
| Papel `Servico App` em ptype não declarado | `frappe.has_permission(doctype, "export")` nos 9 DocTypes | Sem permissão | falsy |
| Submit fora de `Contrato` | `frappe.has_permission("Cobranca", "submit")` | Sem permissão de submit | falsy |
| Flag não declarado concedido | Leitura de `export`/`import`/`share`/`print`/`email`/`report` nos 9 DocPerm | Nenhum concedido | valor `0` |
| DocPerm criado para o built-in `User` | `frappe.db.exists("Custom DocPerm", {"parent": "User", "role": "Servico App"})` | Não existe | falsy |
| Reexecução do patch | `execute()` chamado 2× | Nenhuma duplicação | 1 Role + 9 DocPerm |

### 10.6 Rastreabilidade: Aceite Técnico → Testes

| # | Critério de Aceite (seção 9) | Teste(s) Correspondente(s) | Tipo |
|---|---|---|---|
| AC-01 | Credencial antiga do `Administrator` retorna 401 | CT-012 | Segurança (operacional) |
| AC-02 | `/api/resource/User` barrado com 403 no proxy | CT-013; apoio de backend em CT-008 | Segurança (operacional) |
| AC-03 | `frappe.client.get_list` barrado; `submit` permitido | CT-014 | Segurança (operacional) |
| AC-04 | Bundle sem `bc237221b65b5ed` | CT-015 | Segurança (operacional) |
| AC-05 | Nenhum `.map` publicado; 404 na URL | CT-016 | Segurança (operacional) |
| AC-06 | Usuário de serviço sem `System Manager`/`Administrator`; papel `Servico App` presente | CT-005, CT-006, CT-011, CT-024 | Segurança |
| AC-07 | Os 9 DocTypes respondem em leitura; `Contrato` aceita submit | CT-003, CT-004, CT-007, CT-008, CT-009, CT-023 | Integração / Segurança |
| AC-08 | `obter_configuracao` retorna erro de permissão do Frappe (RN-11 intacta) | CT-010 | Segurança |
| AC-09 | `bench migrate` 2× produz 1 papel e 9 DocPerm, sem duplicação | CT-001, CT-002, CT-023, CT-024 | Integração |
| AC-10 | `developer_mode: 0` | CT-017 | Integração (operacional) |
| AC-11 | `api_key` vazio e sem `api_secret` em `__Auth` nos dois usuários | CT-018 | Segurança (operacional) |
| AC-12 | Dumps removidos; `SHA256SUMS` sem referência órfã | CT-019 | Integração (operacional) |
| AC-13 | `deploy/nginx/react-default.conf` idêntico ao em uso | CT-020 | Integração (operacional) |
| AC-14 | SPA operacional de ponta a ponta | CT-021 | E2E (operacional) |
| AC-15 | `System Manager` não-Administrator com `read=0` nos 9 e `read=1` fora deles (ADR-0003) | CT-022 | Segurança (caracterização) |

---

## 11. Notas / Observações

### ✅ ESTADO DA EXECUÇÃO — Fase A em 2026-07-27, Fase B em 2026-07-28

> **Leia este bloco antes de qualquer coisa se você está retomando este run.** Ele é a fonte durável do estado; o `_run/run-report.md` traz o detalhe completo, mas é um snapshot regenerável e pode ser sobrescrito por um run futuro.

**Decisão de execução do usuário:** a task rodou em duas fases. A Fase A (reversível) foi executada em 2026-07-27 e aprovada pelos dois gates. A Fase B (destrutiva) exigia confirmação humana explícita, que veio em **2026-07-28** — e foi executada na mesma data.

**No ar em produção (Fase A):** allowlist do nginx ativa · bundle servindo a credencial do usuário de serviço `servico-app@dominio.com` (`api_key=31925d7e0cec526`, segredo em `/opt/frappe/secrets/servico-app-credenciais.txt`) · papel `Servico App` + 9 Custom DocPerm aplicados por `bench migrate` · config versionada em `deploy/nginx/react-default.conf`. Backups de reversão em `/opt/frappe/reference/backups-tc001/`.

**Executado na Fase B (2026-07-28):** chaves do `Administrator` e do `api@dominio.com` revogadas (`api_key = NULL`, `api_secret` fora do `__Auth`) · 3 `.map` retirados da árvore servida **e** barreira `location ~ \.map$ { return 404; }` no nginx · `developer_mode: 0` com backend reiniciado · 5 dumps arquivados em `/opt/backups/frappe/dumps-iniciais-2026-03-06/` e `SHA256SUMS` reduzido à linha do `docker-compose.yaml`. **169 testes verdes** após a Fase B, com `Role = 1 | Custom DocPerm = 9` intactos e a API respondendo 200 com a credencial de serviço.

**A credencial `bc237221b65b5ed` está morta** — 401 pelo proxy e direto no backend.

**AC-14 fechado em 2026-07-28.** O usuário exercitou a aplicação no navegador após o deploy e confirmou o funcionamento. Foi o primeiro deploy pós-TC-001: bundle `main.7154a9e7.js`, publicado com a credencial do usuário de serviço, sem source maps e com o `Administrator` já revogado. Sendo verificação manual, não há evidência automatizada anexada — é a natureza do critério.

**A TaskCard está encerrada: 15 de 15 ACs fechados.**

### ⚠️ Ação obrigatória antes do próximo `deploy.sh`

O `deploy.sh` sobrescreve `html/` com o build da máquina local. Enquanto o `.env` de lá tiver `REACT_APP_ERPNEXT_API_KEY=bc237221b65b5ed`, o próximo deploy publica uma chave **agora revogada** — e o app quebra inteiro com 401 (antes da Fase B, o mesmo deploy apenas reintroduzia a exposição; agora derruba). Antes de deployar:

```
REACT_APP_ERPNEXT_API_KEY=31925d7e0cec526
REACT_APP_ERPNEXT_API_SECRET=<segredo do servico-app — ver /opt/frappe/secrets/servico-app-credenciais.txt>
GENERATE_SOURCEMAP=false
```

### 🔴 Incidente durante a Fase B — perda do `db-data.tar.gz`

Um comando de arquivamento em linha única, colado no terminal com quebras de linha, foi interpretado pelo bash como comandos separados. A primeira linha executou `mv /opt/frappe/mariadb_all.sql /opt/frappe/db-data.tar.gz`, **sobrescrevendo** o `db-data.tar.gz` original (`a98238ee…`, 23 MB — snapshot físico do datadir do MariaDB em 06/03/2026). Não havia outra cópia no host.

- **Preservado**: o conteúdo do `mariadb_all.sql` (`3615f1ad…`), confirmado por hash e pelo cabeçalho `MariaDB dump`; o nome foi restaurado antes do arquivamento.
- **Perdido**: apenas o snapshot físico. O `mariadb_all.sql` é o **dump lógico completo da mesma data**, restaurável, cobrindo o mesmo conteúdo — e o backup diário (`/opt/backups/frappe/daily/`, cron do root às 02:30) cobre o estado atual.
- **Causa**: entrega de um one-liner longo para colar no terminal, formato frágil a quebras de linha. **Lição**: operações destrutivas multi-passo vão em script (`set -euo pipefail`, `mv -n`, guarda contra destino ocupado), nunca em one-liner colável. A retomada usou exatamente esse formato e correu sem incidente.
- Os hashes originais dos 6 dumps permanecem recuperáveis no histórico Git do `SHA256SUMS`.

### Débitos abertos da Fase A (auto-reportados pelo executor, ainda não validados por gate)

- **D1 · alto · architecture — RESOLVIDO em 2026-07-28 pela ADR-0003** (Caminho A: o código do patch permanece como está; o que faltava era governança). A consequência passou a ser (a) decisão registrada com autoridade arquitetural em `docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md`, (b) referenciada no docstring do patch e (c) **observável**, pelo AC-15 e pelo teste de caracterização CT-022. Texto original abaixo, preservado como histórico: `Custom DocPerm` **sombreia** o `DocPerm` padrão: `get_valid_perms` ignora os DocPerm padrão de qualquer DocType que passe a ter ≥1 Custom DocPerm. Após este patch, os 9 DocTypes são regidos **apenas** pelo papel `Servico App`, e um `System Manager` que não seja o `Administrator` perde acesso a eles. Hoje o impacto é nulo (o `Administrator` curto-circuita a checagem; o `api@dominio.com` está sem uso), mas **isso muda o desenho de F3/F4**, que criam usuários e papéis novos. Detalhe integral no docstring de `patches/v1_0/criar_papel_servico_app.py`. A alternativa (`frappe.permissions.add_permission` → materializa os perms padrão, resultando em 18 registros) foi rejeitada por contrariar §6.2 e as asserções de CT-001/CT-005. **Requer decisão humana antes da Fase B.**
- **D2 · médio · tests** — duas asserções literais da §10 se mostraram impossíveis contra o Frappe real e foram substituídas com `SUT_IS_CORRECT_BECAUSE` em `tests/test_patch_criar_papel_servico_app.py` (linhas 158 e 325): (i) `frappe.has_permission("User","read")` retorna `True` para qualquer usuário do site — é o controller do próprio DocType `User`, não algo governado por este patch; (ii) `get_roles("Administrator")` devolve **todos** os papéis do site, então qualquer papel novo aparece nele sem atribuição. **O QA deve julgar se os observáveis substitutos cobrem a invariante declarada.** Se não cobrirem, corrija a §10 desta TaskCard — não afrouxe o teste.
- **D3 · baixo · documentation** — resolvido: o achado do bind mount foi incorporado à §6.1.
- **D4 · baixo · security** — o backup do bundle em `reference/backups-tc001/` contém a credencial exposta; o executor criou um `.gitignore` com `*` dentro do próprio diretório. Confirmar no Tech Review.

### Débitos abertos após a correção do Tech Review (attempt 2, 2026-07-28)

- **D5 · baixo · security** — a allowlist expõe `usuario_app.service.verificar_senha_usuario_app` e `auth_locacao_imoveis` (`allow_guest`) **sem `limit_req`**: força bruta sem atrito a partir da internet. Código pré-existente e §4.2 remete sessão real a F3 — deixado como está deliberadamente. Correção natural quando F3 chegar: `limit_req_zone ... rate=10r/m` + `location` dedicado aos dois endpoints.
- **D6 · baixo · code_quality** — o regex da allowlist em `deploy/nginx/react-default.conf` é uma linha única de 893 caracteres. O Tech Review auditou 22 vetores de bypass (escape de ponto, casamento parcial, `User` vs `Usuario`, traversal, `merge_slashes`, `/api/v2`, caixa) e **todos bloqueiam corretamente** — é legibilidade, não comportamento. Refatorar para `map $uri $api_permitido { ... }` mexeria em produção sem ganho de segurança; adiado.
- **D7 · baixo · tests** — o `setUp` de `_BasePapelServicoApp` apaga o papel `Servico App` e seus `Custom DocPerm` **no site de produção** antes de cada teste (o rollback do `FrappeTestCase` os restaura). O QA recomendou explicitamente manter assim até F2 criar um site de teste dedicado; a alternativa (não limpar) tornaria os testes dependentes do estado de produção.
- **D8 · baixo · project_pattern** — `test_integracao_bancaria_api.py`, `test_boletos_abertos.py` e `test_certificado_api.py` seguem reimplementando um `_criar_usuario` quase idêntico; a correção do TR acrescentou um terceiro helper equivalente em `test_patch_criar_papel_servico_app.py`. Extrair `_criar_usuario_com_papel(email, roles)` continua registrado para uma iteração futura (ver a nota "Débito de teste identificado" mais abaixo).

**Achado adicional do executor** (já no docstring do patch, não é débito): o papel `Servico App` precisou nascer com `desk_access=1` — `User.set_system_user()` rebaixa para `Website User` todo usuário cujos papéis tenham `desk_access=0`, e o usuário de serviço precisa ser `System User` para a REST API responder. A contenção do alcance vem dos DocPerms e da allowlist, não do flag de desk.

---

**Ação obrigatória do usuário após esta task** — o patch aplicado em `main.3fb69968.js` é contenção, não solução: o próximo `rsync` de `/home/sysloc/deploy.sh` sobrescreve `html/` com o build da máquina local e **reintroduz a credencial do `Administrator` e os source maps**. Antes do próximo deploy é obrigatório, na máquina local: trocar `REACT_APP_ERPNEXT_API_KEY`/`_SECRET` no `.env` pelo par do usuário de serviço e definir `GENERATE_SOURCEMAP=false` no build de produção.

**Tela de Integrações Bancárias indisponível até F3** — decisão tomada no refinamento desta TaskCard. Os 9 endpoints de `integracao_bancaria_api.service` chamam `_exigir_system_manager()` (RN-11, `service.py:251`, testada em CT-029) e o usuário de serviço não tem esse papel. Enquanto F3 não entrega sessão real, a configuração da integração Sicoob é feita pelo Desk do Frappe com um usuário `System Manager`. A alternativa — relaxar a RN-11 para aceitar `Servico App` — foi considerada e rejeitada por ampliar o escopo de F0 para dentro de código com spec e testes.

**Por que o usuário de serviço não pode ser `System Manager`** — a credencial dele fica no bundle público. Um `System Manager` com credencial pública é quase equivalente ao problema original: a única proteção seria a allowlist do nginx, e uma camada só não é defesa. Com papel próprio e 9 DocPerms, mesmo que a allowlist seja contornada, o alcance da credencial é o dado de negócio já visível no app.

**Ordem de risco** — o passo mais perigoso é a revogação (6.5): se o bundle ainda estiver servindo a credencial antiga quando ela for revogada, o app inteiro cai. Por isso a validação de 6.4 é bloqueante, e não uma formalidade.

**`SHA256SUMS` órfão** — o arquivo está versionado no git e referencia os dumps que serão removidos. Sem atualizá-lo, fica apontando para arquivos inexistentes.

**Contexto de disco** — a remoção dos dumps libera 44 MB, irrelevante para os 6 GB livres do volume. A motivação aqui é segurança (dump completo do banco na raiz do repositório de deploy), não espaço; a liberação de disco de verdade é F2.

**Numeração dos CTs** — os IDs `CT-001` a `CT-021` da seção 10 são locais a este documento. Ao escrever `test_patch_criar_papel_servico_app.py`, atribuir os próximos números sequenciais reais da suíte (que já passa de CT-029 em `test_integracao_bancaria_api.py`), seguindo a convenção `test_ct{NNN}_{cenario}` observada nos arquivos existentes.

**Débito de teste identificado, deliberadamente não resolvido aqui** — `test_integracao_bancaria_api.py`, `test_boletos_abertos.py` e `test_certificado_api.py` reimplementam um `_criar_usuario` quase idêntico. Extrair um helper compartilhado `_criar_usuario_com_papel(email, roles)` seria a limpeza natural, mas expande o escopo desta task; registrado para uma iteração futura.

### ADRs Aplicáveis nesta Feature
- ADR-0003 — Custom DocPerm como fonte única de permissão dos DocTypes de negócio: **criada por esta task** (attempt 2). Os 9 DocTypes de negócio passam a ser regidos exclusivamente por `Custom DocPerm`; todo papel que precise acessá-los declara o seu explicitamente. Um `System Manager` que não seja o `Administrator` perde acesso a eles; `Configuracao Integracao Bancaria`, fora dos 9, permanece acessível — o fluxo de configuração pelo Desk descrito nesta §11 segue funcionando. Afeta §6.2, §9 (AC-15) e §10 (CT-022)
- ADR-0002 — Versionar estrutura de dados do app em arquivo: o papel `Servico App` e os 9 Custom DocPerms nascem em patch versionado aplicado pelo `bench migrate`, nunca pela interface administrativa (afeta §5.2, §6.2, §7.1 e §8)
- ADR-0001 — N/A: a task não altera o modelo canônico de cobrança bancária nem o adaptador por provedor; a RN-11 é preservada intacta
