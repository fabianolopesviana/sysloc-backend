# TASKCARD - Execução Rápida (com Guardrails LLM)

## 1. Identificação
- **ID**: TC-001
- **Nome da Task**: Capturar a caracterização das regras de negócio legadas contra o Frappe vivo
- **model**: opus
- **risk**: medium
- **gates**: [qa, tech_review]   # tipo=padrao_novo — artefato é a rede de referência de duas fases futuras; toca o ambiente que atende a operação para gerar o dump
- **Variante**: backend
- **mode**: standard
- **source**: recommended
- **source_note**: o discovery vive no pré-refinamento do **programa** (`docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md`), não sob esta feature. A §15.4 recomenda literalmente `/agent-spec-taskcard-generate` para esta fatia, e a §4 (ramo B / B2.1) a promove a primeira fatia a executar.
- **Responsável**: sysloc
- **Data**: 2026-07-30
- **Status**: Concluído
- **Dependências**: —
- **Símbolos públicos criados**: `deploy/scripts/caracterizacao/capturar.py`; `deploy/scripts/caracterizacao/preparar-site-efemero.sh`; os 6 artefatos golden sob `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`
- **Símbolos consumidos de outras tasks**: N/A — card única
- **Relacionados**:
  - `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` — ramos B (antecipação) e D (ampliação D1+)
  - _(a especificação original de metragem e PDF vinha da T4 do plano Frappe `saas-multi-empresa`, **excluído do repositório em 2026-08-01**; o que esta task herdava dela já está absorvido e ampliado aqui — ver §6.4, AC-2 e §7)_
  - `docs/plano-backend-novo/plano-execucao.md` — § Caracterização e § F7 (gate de desinstalação)

---

## 2. Contexto

O backend Frappe será desinstalado, e com ele desaparece a única fonte da verdade sobre seis regras de negócio: duas vivem apenas no banco, como Server Scripts criados pela UI (achado E2), e três rotinas de estado não têm teste algum (achado 18). Sem referência capturada com o original ativo, a F3 porta um gerador de contrato de 752 linhas e a F5 porta as rotinas sem ter contra o que comparar.

Esta é a fatia com **prazo de validade** do programa: não depende de nada, mas depende de um sistema que morre. O gate de desinstalação da F7 exige estes golden files commitados.

---

## 3. Objetivo da Task

Produzir a rede de referência de comportamento — seis artefatos golden versionados **no repositório novo** — capturados contra o Frappe original ainda ativo, num site efêmero restaurado do dump de produção. Nenhuma regra é migrada nesta task: a entrega é exclusivamente a referência.

---

## 4. Escopo

### 4.1 Inclui
- [ ] Site efêmero restaurado do dump de produção, com os Server Scripts habilitados e verificados
- [ ] Script de captura versionado, idempotente e re-executável
- [ ] Golden da **regra de agregação de metragem** (Server Script `Cálculo metragem imóvel`, `Imovel` / `Before Save`) — 4 cenários
- [ ] Golden do **documento de contrato** (Server Script `PDF contrato`, `Contrato` / `After Save`) — texto extraído, nunca bytes
- [ ] Golden de `marcar_cobrancas_vencidas()` — `cobranca_vencimento/service.py`
- [ ] Golden de `encerrar_contratos_vencidos()` — `contrato_encerramento/service.py`, incluindo o caminho `ignorado / contrato_sem_imovel`. O caminho `contrato_sem_name` **não** entra: `frappe.get_all` sempre devolve `name` preenchido para documento existente, então o branch é inalcançável pelo caminho real — forjá-lo produziria golden de um comportamento que a produção nunca exibe. Registrar a exclusão e o motivo no `PROCEDENCIA.md`
- [ ] Dois scripts de verificação da captura, com superfícies deliberadamente separadas: um que exige o Frappe de pé (morre com a F7) e um offline, que continua válido depois da desinstalação
- [ ] Golden de `atualizar_atrasos_cobrancas()` — `cobranca_atraso/service.py`, o wrapper que toca banco
- [ ] Golden de `_calcular_mora()` — os 6 casos canônicos **portados** de `tests/test_cobranca_atraso.py::TestCalcularMora`, sem re-execução
- [ ] Manifesto de procedência dos golden (data, site, origem do dump, versão do app)
- [ ] Teardown do site efêmero ao final

### 4.2 Fora do escopo
- [ ] Migrar, reescrever ou corrigir qualquer regra — a entrega é a referência, não a implementação
- [ ] Caracterizar a régua de cobrança (`cobranca_automation`, ~700 LOC) — adiado por ter efeito colateral de envio de e-mail; reavaliar na entrada da F3
- [ ] Escrever os testes que **consomem** os golden — pertencem à F3 (`cobranca-mora-e-documentos`) e à F5 (`automacoes-agendadas`)
- [ ] Qualquer escrita no site `frontend` além do `bench backup`, que apenas produz arquivo
- [ ] Corrigir defeitos observados durante a captura — a referência reflete o comportamento atual, **inclusive defeitos**

---

## 5. Arquivos Envolvidos

### 5.0 Visão em Árvore

```
/opt/sysloc-backend/
├── deploy/
│   └── scripts/
│       └── caracterizacao/
│           ├── preparar-site-efemero.sh                      [N]
│           ├── capturar.py                                   [N]
│           ├── verificar-captura.sh                          [N]
│           └── verificar-golden.sh                           [N]
└── docs/
    └── specs/features/caracterizacao-regras-legadas/v1/
        └── golden/
            ├── PROCEDENCIA.md                                [N]
            ├── metragem.json                                 [N]
            ├── contrato-pdf.txt                              [N]
            ├── marcar-cobrancas-vencidas.json                [N]
            ├── encerrar-contratos-vencidos.json              [N]
            ├── atualizar-atrasos-cobrancas.json              [N]
            └── calcular-mora.json                            [N]

/opt/frappe/                                                  (somente leitura)
├── docker-compose.yaml                                       [R]
└── app-sync/locacao_automation/locacao_automation/
    ├── cobranca_vencimento/service.py                        [R]
    ├── contrato_encerramento/service.py                      [R]
    ├── cobranca_atraso/service.py                            [R]
    └── tests/test_cobranca_atraso.py                         [R]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

---

### 5.1 Arquivos Existentes (leitura/referência)

- `/opt/frappe/app-sync/locacao_automation/locacao_automation/cobranca_vencimento/service.py` — 32 LOC. `marcar_cobrancas_vencidas()`: filtra `Cobranca` com `status_cobranca="Pendente"` e `data_vencimento < hoje`, grava `"Vencida"`, retorna `{ok, data_execucao, total_atualizadas, cobrancas[]}`. É o contrato de retorno que vira golden.
- `/opt/frappe/app-sync/locacao_automation/locacao_automation/contrato_encerramento/service.py` — 75 LOC. `encerrar_contratos_vencidos()`: filtra `Contrato` com `data_fim_locacao < hoje` e `status_contrato="Ativo"`; libera o `Imovel` (`status_locacao="Disponível"`, `contrato_ativo=""`) e encerra o contrato. **Tem dois caminhos de `ignorado`** — `contrato_sem_name` e `contrato_sem_imovel` — que nenhum teste toca hoje.
- `/opt/frappe/app-sync/locacao_automation/locacao_automation/cobranca_atraso/service.py` — 151 LOC. `_calcular_mora()` é declarada no próprio código como *"Funcao PURA (sem acesso a banco): recalculavel e idempotente"*; `atualizar_atrasos_cobrancas()` é o wrapper que lê a config `Atraso` e persiste. É o wrapper que não tem cobertura.
- `/opt/frappe/app-sync/locacao_automation/locacao_automation/tests/test_cobranca_atraso.py` — 122 LOC. `TestCalcularMora` traz os **6 casos canônicos a portar**: exemplo canônico 2074,67 · juros de um mês igual à taxa mensal · juros lineares sem composição · juros não incidem sobre a multa · multa única independe dos dias · total é a soma das partes.
- `/opt/frappe/docker-compose.yaml` — serviço `backend` (onde o bench roda) e a chave `MYSQL_ROOT_PASSWORD` no serviço `db`, necessária ao `bench new-site`. **Ler a chave do arquivo em runtime; nunca copiar o valor para código, log ou artefato versionado.**
- _(a T4 do plano Frappe `saas-multi-empresa` fixava a forma de cada caracterização por natureza da regra — valor versionado para regra de agregação, texto extraído para regra que gera documento. O plano foi **excluído do repositório em 2026-08-01**; as duas formas estão fixadas aqui, na §6.4 e no AC-2, e não dependem mais dele.)_
- `docs/adr/0006-ambiente-de-verificacao-separado-do-que-atende-a-operacao.md` — a decisão que obriga o site efêmero.

### 5.2 Arquivos a Criar

- `deploy/scripts/caracterizacao/preparar-site-efemero.sh` — cria e destrói o site de captura. Idempotente: se o site já existe, derruba antes de recriar. Subcomandos `criar` e `destruir`.
- `deploy/scripts/caracterizacao/capturar.py` — script único de captura, executado dentro do container contra o site efêmero. Monta os dados sintéticos, dispara cada regra, normaliza o volátil e grava os artefatos golden.
- `deploy/scripts/caracterizacao/verificar-captura.sh` — os 10 casos que **exigem o site efêmero de pé** (CT-001 a CT-009, CT-012). Roda entre `capturar.py` e o teardown; torna-se inexecutável depois da F7, por construção.
- `deploy/scripts/caracterizacao/verificar-golden.sh` — os 4 casos **offline** (CT-010, CT-011, CT-013, CT-014), que só leem os artefatos versionados. Continua válido depois da desinstalação do Frappe e é o candidato natural a virar `*.spec.ts` na suíte Vitest quando a F0 criar o workspace.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/PROCEDENCIA.md` — manifesto: data e hora da captura, site usado, origem e timestamp do dump, versão do app, lista dos campos mascarados por artefato e o motivo de cada máscara.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/metragem.json` — 4 cenários da regra de agregação.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf.txt` — texto extraído do PDF gerado, com os campos voláteis mascarados.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/marcar-cobrancas-vencidas.json` — retorno da rotina + estado resultante das cobranças.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/encerrar-contratos-vencidos.json` — retorno da rotina + estado resultante de contratos e imóveis, cobrindo `encerrado` e os dois `ignorado`.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/atualizar-atrasos-cobrancas.json` — retorno do wrapper + valores de mora persistidos.
- `docs/specs/features/caracterizacao-regras-legadas/v1/golden/calcular-mora.json` — os 6 casos canônicos, cada um com entradas e saída exata.

### 5.3 Arquivos a Modificar

- Nenhum. Nenhum arquivo de `/opt/frappe` é editado — o acesso é de leitura, e a única escrita no site `frontend` é o `bench backup`, que produz arquivo sem alterar dado.

---

## 6. Descrição de Execução (COMO fazer)

### 6.1 Ambiente de captura

A captura **não executa contra o site `frontend`** (ADR-0006). O fluxo é:

1. `bench --site frontend backup` — gera dump novo em `sites/frontend/private/backups/`. O backup mais recente ali é de 2026-03-31 e está velho demais para servir de oráculo.
2. `bench new-site caracterizacao.localhost` com a senha root lida de `docker-compose.yaml` em runtime.
3. `bench --site caracterizacao.localhost restore <dump mais recente>` — os Server Scripts vêm no dump, porque vivem no banco.
4. Habilitar `server_script_enabled` no `site_config.json` do site efêmero e **verificar** que os dois Server Scripts alvo estão presentes e com `disabled = 0`. Sem essa verificação, a captura produziria golden de um sistema onde a regra não roda — o pior resultado possível, porque parece sucesso.
5. Ao final, `bench drop-site caracterizacao.localhost --force` (subcomando `destruir`).

Tudo roda dentro do container `backend`, via `docker compose --project-directory /opt/frappe -f docker-compose.yaml -f docker-compose.override.yml exec -T backend bench …`. O backup do host (`/opt/backups/frappe/daily/`) **não serve**: pertence ao `root` e o `sudo` deste host exige senha.

Espaço: o banco tem 91 MB e há 6,4 GB livres. O site efêmero é destruído ao final justamente porque o disco está em 78%.

### 6.2 As duas regras que vivem só no banco

Confirmado por consulta ao `Server Script` do site `frontend`:

| Server Script | `script_type` | `reference_doctype` | `doctype_event` |
|---|---|---|---|
| `Cálculo metragem imóvel` | DocType Event | `Imovel` | **Before Save** |
| `PDF contrato` | DocType Event | `Contrato` | **After Save** |

Consequência prática: **não se chama a regra — dispara-se o evento.** Para metragem, salvar um `Imovel` com a configuração de cômodos desejada e ler o campo agregado resultante. Para o contrato, salvar um `Contrato` e recuperar o PDF anexado.

### 6.3 Os 4 cenários de metragem

Um `Imovel` por cenário, cada um salvo e lido de volta: **(a)** sem nenhum cômodo · **(b)** com exatamente um cômodo · **(c)** com vários cômodos · **(d)** com vários cômodos onde ao menos um tem metragem nula. O golden guarda, por cenário, a configuração de entrada e o valor agregado produzido.

### 6.4 O documento de contrato

Capturar o **texto extraído** do PDF, nunca os bytes — o artefato carrega metadados de geração que variam a cada execução e a comparação binária acusaria diferença onde não há. Mascarar os campos voláteis (data e hora de geração, identificadores gerados) com um marcador estável e registrar cada máscara no `PROCEDENCIA.md`.

### 6.5 As três rotinas de estado

Para cada uma: montar o estado de entrada, chamar a função, e gravar **duas coisas** — o valor de retorno e o estado resultante das entidades afetadas. Só o retorno não basta: `marcar_cobrancas_vencidas` devolve uma contagem, mas o que a F5 precisa reproduzir é qual cobrança mudou para qual status.

Cobrir explicitamente os caminhos negativos que hoje não têm teste: em `encerrar_contratos_vencidos`, um contrato **sem imóvel** (produz `ignorado / contrato_sem_imovel`) ao lado dos contratos que encerram normalmente.

### 6.6 Determinismo (requisito de qualidade do artefato)

As três rotinas dependem de `nowdate()`. Um golden com datas absolutas expira no dia seguinte. Portanto: os dados sintéticos nascem com datas **relativas** à data de captura (vencida = `hoje - N`, a vencer = `hoje + N`), e o golden grava os **offsets**, não as datas absolutas. A data de captura fica registrada no `PROCEDENCIA.md`. Assim o teste da F5 reconstrói o mesmo cenário em qualquer dia.

### 6.7 `_calcular_mora` — portar, não re-executar

Os 6 casos já estão provados em `TestCalcularMora`. Extrair deles as entradas (`valor_original`, `dias_atraso`, `multa_percentual`, `juros_percentual`) e o resultado esperado, e gravar em `calcular-mora.json`. Não há ganho em re-executar uma função pura já coberta — o valor está em trazer os números canônicos para o repositório que sobrevive.

### 6.8 Exemplo de Payload

N/A — sem payload parcial. Esta TaskCard não expõe endpoint.

---

## 7. Guardrails de Execução (LLM) - DEVE / NÃO DEVE

> Quebrar qualquer item aqui **invalida a task**.

### 7.1 DEVE

- **Obedecer ADR-0006** — a captura executa exclusivamente no site efêmero. O site `frontend` recebe apenas `bench --site frontend backup`, que produz arquivo e não altera dado.
- **Obedecer ADR-0005** — os dois scripts nascem versionados no repositório e são idempotentes: re-executar `preparar-site-efemero.sh criar` derruba o site anterior antes de recriar, e `capturar.py` sobrescreve os golden sem duplicar.
- Verificar, **antes de capturar**, que os dois Server Scripts existem no site efêmero com `disabled = 0` e que `server_script_enabled` está ligado. Falhar ruidosamente se qualquer condição não valer.
- Gravar datas como **offsets relativos** à data de captura nos golden das três rotinas (§6.6).
- Capturar o contrato como **texto extraído**, nunca bytes (§6.4).
- Registrar no `PROCEDENCIA.md` toda máscara aplicada, com o motivo.
- Destruir o site efêmero ao final, mesmo em caso de falha na captura.
- Ler `MYSQL_ROOT_PASSWORD` de `docker-compose.yaml` em runtime.

### 7.2 NÃO DEVE

- **Não escrever, atualizar nem apagar nenhum registro no site `frontend`.** É produção.
- **Não copiar o valor de `MYSQL_ROOT_PASSWORD`** para código, log, mensagem de erro ou qualquer arquivo versionado.
- **Não corrigir defeito observado.** Se a regra original produz um resultado que parece errado, o golden registra o resultado errado e o `PROCEDENCIA.md` anota a observação. Corrigir aqui destrói a prova de equivalência.
- Não migrar, reescrever nem "melhorar" nenhuma das seis regras.
- Não comparar o PDF por bytes nem versionar o binário.
- Não criar abstração genérica de captura "para regras futuras" — são seis regras conhecidas e finitas.
- Não deixar o site efêmero de pé (disco em 78%).
- Não introduzir dependência nova no app Frappe.

---

## 8. Passos Sugeridos (checklist executável)

- [ ] **1.** Escrever `preparar-site-efemero.sh` com os subcomandos `criar` e `destruir`; validar que `criar` roda duas vezes seguidas sem erro
- [ ] **2.** Rodar `bench --site frontend backup` e confirmar o dump novo em `sites/frontend/private/backups/`
- [ ] **3.** `criar` o site efêmero, restaurar o dump, ligar `server_script_enabled`
- [ ] **4.** **Gate de sanidade**: confirmar que `Cálculo metragem imóvel` e `PDF contrato` existem no site efêmero com `disabled = 0`. Abortar se falhar
- [ ] **5.** Escrever `capturar.py` com um bloco por regra e a normalização de datas em offsets
- [ ] **6.** Capturar metragem — 4 cenários (§6.3)
- [ ] **7.** Capturar o texto do PDF de contrato, com as máscaras registradas (§6.4)
- [ ] **8.** Capturar `marcar_cobrancas_vencidas()` — retorno + estado resultante
- [ ] **9.** Capturar `encerrar_contratos_vencidos()` — incluindo `contrato_sem_imovel`
- [ ] **10.** Capturar `atualizar_atrasos_cobrancas()` — retorno + mora persistida
- [ ] **11.** Portar os 6 casos de `TestCalcularMora` para `calcular-mora.json` (§6.7)
- [ ] **12.** Escrever `PROCEDENCIA.md` com data, site, dump de origem, versão do app, todas as máscaras e a exclusão justificada do caminho `contrato_sem_name`
- [ ] **13.** Escrever `verificar-captura.sh` (CT-001 a CT-009, CT-012) e `verificar-golden.sh` (CT-010, CT-011, CT-013, CT-014)
- [ ] **14.** Rodar `verificar-captura.sh` — **com o site ainda de pé**. Dez dos catorze casos leem o site efêmero e se tornam inexecutáveis depois do teardown
- [ ] **15.** Rodar `verificar-golden.sh` — offline, valida os artefatos versionados
- [ ] **16.** `destruir` o site efêmero e confirmar o disco liberado. O CT-003 (teardown garantido e idempotente) é o único caso que roda neste momento, em fluxo próprio

> **Ordem obrigatória**: `criar` → `capturar` → `verificar-captura` → `verificar-golden` → `destruir`. Inverter os passos 14 e 16 inutiliza dez dos catorze casos.

---

## 9. Aceite Técnico (critérios objetivos)

A task estará concluída quando:

- [ ] **AC-1** — Os 4 cenários da regra de metragem estão capturados e versionados, cada um com configuração de entrada e valor agregado produzido
- [ ] **AC-2** — A referência do documento de contrato está capturada como **texto extraído**, com as máscaras de campo volátil registradas no `PROCEDENCIA.md`; nenhum byte de PDF foi versionado
- [ ] **AC-3** — `marcar_cobrancas_vencidas()`, `encerrar_contratos_vencidos()` e `atualizar_atrasos_cobrancas()` têm golden com **retorno e estado resultante**, e o de encerramento cobre `encerrado` e `contrato_sem_imovel`
- [ ] **AC-4** — Os 6 casos canônicos de `_calcular_mora()` estão em `calcular-mora.json` com entradas e saída exata
- [ ] **AC-5** — Toda captura ocorreu no site efêmero; o site `frontend` recebeu apenas `bench backup` (ADR-0006 respeitada)
- [ ] **AC-6** — Os golden das três rotinas gravam datas como **offsets relativos**, reproduzíveis em qualquer dia
- [ ] **AC-7** — `capturar.py` re-executado produz golden **idênticos** (passo 13) e `preparar-site-efemero.sh criar` roda duas vezes sem erro
- [ ] **AC-8** — O site efêmero foi destruído e o `PROCEDENCIA.md` registra data, site, dump de origem, versão do app e as máscaras
- [ ] Guardrails respeitados (seção 7)
- [ ] Nenhuma quebra nos fluxos existentes do site `frontend`

---

## 10. Testes

> Gerado pelo agente `agent-spec-qa-test-generator` em 2026-07-30. 14 casos — 3 unitario, 9 integracao, 2 seguranca.

### 10.1 Testes Existentes a Modificar

Nenhum teste existente impactado — o repositório `/opt/sysloc-backend` está com `apps/` e `packages/` vazios (Fase 0 não iniciada) e não possui suíte. A suíte legada de `/opt/frappe` (`tests/test_cobranca_atraso.py`) é **lida como referência** para portar os 6 casos canônicos (§6.7), nunca modificada — o repositório Frappe não é editado por esta task (§5.3).

### 10.2 Testes a Criar

**Integração — exigem o site efêmero de pé**

- `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — 10 casos: CT-001, CT-002, CT-003, CT-004, CT-005, CT-006, CT-007, CT-008, CT-009, CT-012
  - **CT-001** — Gate de sanidade aborta a captura quando os Server Scripts alvo não estão ativos no site efêmero
    - **Setup (caminho legítimo)**: Montar o estado exclusivamente no site efêmero `caracterizacao.localhost`, pelo caminho real do bench no próprio site (`bench --site caracterizacao.localhost set-value 'Server Script' '<nome>' disabled 1`, `bench --site caracterizacao.localhost set-config server_script_enabled 0`), restaurando o estado ao final do cenário. É proibido: (a) tocar o site `frontend` — ADR-0006; (b) acrescentar flag, branch ou parâmetro test-only dentro de `capturar.py` ou de `preparar-site-efemero.sh` para simular a condição (Iron Law #6). O gate deve ser exercitado pelo estado real do banco, que é o mesmo caminho que o modo de falha real percorreria. _(análogo no projeto: `NENHUM`)_
  - **CT-002** — `preparar-site-efemero.sh criar` é idempotente — duas execuções consecutivas deixam exatamente um site
  - **CT-003** — Teardown garantido — o site efêmero é derrubado mesmo quando a captura falha, e `destruir` é idempotente
    - **Setup (caminho legítimo)**: Reaproveitar a precondição legítima do CT-001 (Server Script desabilitado no site efêmero pelo caminho do bench) — a captura falha pelo caminho real do gate de sanidade, sem nenhum hook de injeção de falha. É proibido acrescentar variável de ambiente, flag `--simular-falha` ou branch test-only aos scripts (Iron Law #6); o modo de falha já existe e é alcançável pelo estado do banco. _(análogo no projeto: `CT-001 — usar a mesma receita de desabilitar o Server Script no site efêmero`)_
  - **CT-004** — Determinismo — a segunda execução de `capturar.py` no mesmo site produz os 6 golden byte a byte idênticos
  - **CT-005** — Offsets relativos — os golden das rotinas não contêm data absoluta e não mudam com o relógio deslocado
    - **Setup (caminho legítimo)**: Deslocar o relógio percebido pelo processo na FRONTEIRA, fora do código: `libfaketime`/`LD_PRELOAD` no comando que invoca `capturar.py` dentro do container, ou executar o container com a data ajustada. É PROIBIDO acrescentar parâmetro `--hoje`, `--data-base` ou variável de ambiente lida por `capturar.py` para simular a data — isso seria código test-only vazando no artefato de produção (Iron Law #6) e ainda por cima invalidaria o próprio golden (a captura real passaria a poder rodar com data falsa). Caminho alternativo legítimo, se o deslocamento de relógio não estiver disponível no container: re-executar a captura em um dia real diferente (ex.: no dia seguinte) e comparar os `sha256` — mais lento, mesmo poder de detecção. _(análogo no projeto: `NENHUM`)_
  - **CT-006** — Metragem — os 4 cenários existem e cada agregado do golden bate com o campo persistido no site efêmero
  - **CT-007** — Metragem — o golden distingue os cenários e registra o cenário degenerado sem correção
  - **CT-008** — As três rotinas de estado — o golden grava retorno E estado resultante, e o estado bate com o banco
  - **CT-009** — Caminhos ignorados cobertos — `contrato_sem_imovel` e `vencimento_futuro` estão no golden com estado inalterado
  - **CT-012** — ADR-0006 — o site `frontend` recebe apenas `bench backup` e sai do fluxo sem uma única escrita

**Unitários — offline, só leem os artefatos versionados**

- `deploy/scripts/caracterizacao/verificar-golden.sh` (criar) — 4 casos: CT-010, CT-011, CT-013, CT-014
  - **CT-010** — Documento de contrato — texto extraído, zero bytes de PDF versionados, campos voláteis mascarados
  - **CT-011** — `calcular-mora.json` porta os 6 casos canônicos com entradas e saída exata, conferidas contra a fórmula documentada
  - **CT-013** — `MYSQL_ROOT_PASSWORD` não vaza para nenhum arquivo versionado nem para a saída dos scripts
    - **Setup (caminho legítimo)**: Ler o valor em runtime da mesma fonte que os scripts usam (`/opt/frappe/docker-compose.yaml`), mantê-lo apenas em variável de shell não exportada, nunca ecoá-lo, e não gravá-lo em arquivo temporário. As mensagens de falha citam arquivo e linha, nunca o valor. É proibido criar arquivo de fixture com a senha ou parametrizar os scripts com um `--password` de teste. _(análogo no projeto: `NENHUM`)_
  - **CT-014** — `PROCEDENCIA.md` completo e em bijeção com as máscaras efetivamente aplicadas nos golden

### 10.2.1 Detalhamento dos Casos de Teste

#### CT-001 — Gate de sanidade aborta a captura quando os Server Scripts alvo não estão ativos no site efêmero

- **Tipo**: Integração | **Categoria**: tratamento_erro
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: Se `Cálculo metragem imóvel` ou `PDF contrato` estiver ausente do site efêmero ou com `disabled != 0`, ou se `server_script_enabled` não for `1` no `site_config.json` do site efêmero, `capturar.py` termina com exit code diferente de zero, nomeia em stderr o Server Script (ou a flag) e a condição violada, e não cria nem modifica nenhum arquivo sob `golden/`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Site efêmero `caracterizacao.localhost` criado e restaurado do dump de produção
  - Snapshot do estado inicial dos dois Server Scripts e do `site_config.json` para restauração ao final
  - Working tree limpo em `docs/specs/features/caracterizacao-regras-legadas/v1/golden/` antes de cada cenário
- **Dados de entrada**: Table-driven: 4 estados do site efêmero, um por linha. Só o estado (a) deve permitir a captura prosseguir.
- **Passos**:
  1. Para cada linha da tabela: aplicar o estado no site efêmero pelo caminho do bench
  2. Registrar `sha256sum` de todos os arquivos hoje presentes em `golden/` (pode ser conjunto vazio na primeira execução)
  3. Executar `capturar.py`, capturando exit code, stdout e stderr
  4. Comparar exit code e stderr com o esperado da linha
  5. Recalcular os `sha256sum` de `golden/` e comparar com o registro anterior
  6. Restaurar o estado original do site efêmero antes da próxima linha
- **Resultado esperado**: Linha (a): exit code 0 e os 6 artefatos golden gravados. Linhas (b), (c) e (d): exit code diferente de zero (sugerido 2); stderr contém, respectivamente, a substring `Cálculo metragem imóvel`, a substring `PDF contrato` e a substring `server_script_enabled`, cada uma acompanhada da condição violada (`disabled=1`, `ausente`, `desligado`); e o conjunto de `sha256sum` de `golden/` é byte a byte igual ao registrado antes da execução — nenhum arquivo criado, alterado ou truncado.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: site efêmero com `Cálculo metragem imóvel` em `disabled = 1`; com `PDF contrato` inexistente; e com `server_script_enabled` removido do `site_config.json`. Asserção: exit code != 0 (sugerido 2), stderr contendo literalmente o nome do Server Script ou `server_script_enabled` e a condição violada, e `git status --porcelain docs/specs/features/caracterizacao-regras-legadas/v1/golden/` vazio (nenhum golden criado ou alterado)
- **Precondição privilegiada**: Montar o estado exclusivamente no site efêmero `caracterizacao.localhost`, pelo caminho real do bench no próprio site (`bench --site caracterizacao.localhost set-value 'Server Script' '<nome>' disabled 1`, `bench --site caracterizacao.localhost set-config server_script_enabled 0`), restaurando o estado ao final do cenário. É proibido: (a) tocar o site `frontend` — ADR-0006; (b) acrescentar flag, branch ou parâmetro test-only dentro de `capturar.py` ou de `preparar-site-efemero.sh` para simular a condição (Iron Law #6). O gate deve ser exercitado pelo estado real do banco, que é o mesmo caminho que o modo de falha real percorreria. Análogo: `NENHUM`
- **Critérios validados**: AC-1; AC-2
- **Obs**: EXISTING_SUITE = NO_SUITE_FOUND porque `/opt/sysloc-backend` não tem nenhuma suíte (Fase 0 não iniciada; `apps/` e `packages/` vazios) e a suíte legada `/opt/frappe/.../tests/` pertence ao app que será desinstalado — estender lá jogaria a verificação fora do repositório que sobrevive. Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Este é o caso de maior valor da task: a §11 da TaskCard classifica o Server Script inativo como "o modo de falha mais perigoso, porque se parece com sucesso". A assertion sobre `sha256sum` inalterado é o que distingue "abortou" de "abortou depois de já ter escrito meio golden".

#### CT-002 — `preparar-site-efemero.sh criar` é idempotente — duas execuções consecutivas deixam exatamente um site

- **Tipo**: Integração | **Categoria**: caminho_feliz
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: `preparar-site-efemero.sh criar` executado duas vezes consecutivas termina com exit code 0 nas duas execuções e deixa exatamente uma instância de `caracterizacao.localhost` operante — a segunda execução derruba a anterior antes de recriar, sem intervenção manual, sem prompt interativo e sem tocar o site `frontend`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Container `backend` do Frappe de pé
  - Dump recente presente em `sites/frontend/private/backups/` (produzido pelo passo 2 da §8)
  - Nenhum site `caracterizacao.localhost` pré-existente na primeira execução
- **Dados de entrada**: Nenhum parâmetro. O script lê `MYSQL_ROOT_PASSWORD` de `/opt/frappe/docker-compose.yaml` em runtime.
- **Passos**:
  1. Executar `preparar-site-efemero.sh criar` e registrar exit code
  2. Executar `preparar-site-efemero.sh criar` uma segunda vez, sem passo intermediário, e registrar exit code
  3. Listar os diretórios de site (`ls -1 sites/`) e contar ocorrências de `caracterizacao.localhost`
  4. Executar `bench --site caracterizacao.localhost execute frappe.db.get_default --kwargs '{"key":"country"}'` para provar que o site responde
  5. Confirmar que `sites/frontend` continua presente
- **Resultado esperado**: Exit code 0 nas duas execuções. `ls -1 sites/ | grep -c '^caracterizacao.localhost$'` retorna exatamente 1. Nenhum diretório residual do tipo `caracterizacao.localhost.old`, `.bak` ou `.tmp` em `sites/`. O comando `bench --site caracterizacao.localhost execute ...` retorna exit 0 (site restaurado e operante após a segunda criação). `sites/frontend` continua presente e `bench --site frontend execute frappe.db.count --kwargs '{"dt":"Contrato"}'` responde normalmente.
- **Negative companion**: → CT-003: invocar `destruir` com o site já inexistente, e abortar a captura no meio do fluxo — `destruir` retorna exit 0 com `site inexistente, nada a fazer` em stdout, e o site é derrubado mesmo quando `capturar.py` falha — ver CT-003
- **Critérios validados**: AC-7
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Corresponde ao passo 1 da §8 ("validar que `criar` roda duas vezes seguidas sem erro") e é o teste direto da idempotência exigida pela ADR-0005. A assertion `execute` após a segunda criação é o que impede o falso verde de um script que "não erra" porque derruba e não recria.

#### CT-003 — Teardown garantido — o site efêmero é derrubado mesmo quando a captura falha, e `destruir` é idempotente

- **Tipo**: Integração | **Categoria**: tratamento_erro
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: Ao término do fluxo — inclusive quando `capturar.py` aborta com exit diferente de zero — o site `caracterizacao.localhost` deixa de existir, o exit code do fluxo permanece diferente de zero (a falha não é engolida pelo teardown), e uma segunda chamada de `preparar-site-efemero.sh destruir` com o site já inexistente termina com exit 0 sem invocar `drop-site` sobre nenhum outro site.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Site efêmero criado (CT-002 aprovado)
  - `Cálculo metragem imóvel` com `disabled = 1` no site efêmero (receita do CT-001)
  - Espaço em disco medido antes do fluxo (`df -h`), para conferir a liberação
- **Dados de entrada**: Fluxo completo com falha induzida pelo estado real do banco.
- **Passos**:
  1. Registrar `df --output=avail -k /` antes do fluxo
  2. Executar o fluxo completo (criar → capturar → destruir) e registrar o exit code propagado
  3. Confirmar que `capturar.py` retornou exit != 0
  4. Listar `sites/` e contar `caracterizacao.localhost`
  5. Executar `preparar-site-efemero.sh destruir` uma segunda vez e registrar exit code e stdout
  6. Registrar `df --output=avail -k /` após o fluxo
  7. Grepar o log consolidado do fluxo por invocações de `drop-site`
- **Resultado esperado**: O fluxo propaga exit code diferente de zero (a falha da captura não é mascarada pelo teardown). `ls -1 sites/ | grep -c '^caracterizacao.localhost$'` retorna 0. A segunda chamada de `destruir` retorna exit 0 e imprime em stdout a substring `site inexistente`. O espaço disponível após o fluxo é maior ou igual ao medido antes (o site efêmero não deixou resíduo). No log consolidado, toda ocorrência de `drop-site` tem como argumento `caracterizacao.localhost` — zero ocorrências com `frontend`.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: captura abortada no meio (Server Script desabilitado, reaproveitando a precondição do CT-001) e `destruir` invocado sobre site inexistente. Asserção: `ls -1 sites/ | grep -c '^caracterizacao.localhost$'` == 0 após o fluxo; exit code do fluxo != 0; segunda chamada de `destruir` → exit 0 e stdout contendo `site inexistente`; `sites/frontend` presente e zero ocorrências de `drop-site` com `frontend` no log
- **Precondição privilegiada**: Reaproveitar a precondição legítima do CT-001 (Server Script desabilitado no site efêmero pelo caminho do bench) — a captura falha pelo caminho real do gate de sanidade, sem nenhum hook de injeção de falha. É proibido acrescentar variável de ambiente, flag `--simular-falha` ou branch test-only aos scripts (Iron Law #6); o modo de falha já existe e é alcançável pelo estado do banco. Análogo: `CT-001 — usar a mesma receita de desabilitar o Server Script no site efêmero`
- **Critérios validados**: AC-7; AC-8
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. É o negative companion do CT-002 e cobre o guardrail §7.1 ("destruir o site efêmero ao final, mesmo em caso de falha na captura") somado à restrição de disco em 78% da §6.1. A assertion sobre o exit code propagado é essencial: um `trap` mal escrito derruba o site E devolve 0, escondendo a falha da captura.

#### CT-004 — Determinismo — a segunda execução de `capturar.py` no mesmo site produz os 6 golden byte a byte idênticos

- **Tipo**: Integração | **Categoria**: caminho_feliz
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: `capturar.py` executado uma segunda vez contra o mesmo site efêmero, sem recriar o site, produz os 6 artefatos golden com `sha256` idêntico ao da primeira execução — o que só é possível se o script reconstrói do zero o estado sintético que ele mesmo cria, em vez de depender de um site virgem.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Site efêmero de pé e gate de sanidade aprovado (CT-001 linha (a))
  - Primeira execução de `capturar.py` concluída com exit 0
  - Os 6 golden presentes em `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`
- **Dados de entrada**: Nenhum parâmetro. A segunda execução ocorre no MESMO site já mutado pela primeira (cobranças já marcadas `Vencida`, contratos já `Encerrado`, imóveis já salvos).
- **Passos**:
  1. Registrar `sha256sum` dos 6 artefatos após a primeira execução
  2. Executar `capturar.py` uma segunda vez, sem derrubar nem recriar o site efêmero
  3. Recalcular `sha256sum` dos 6 artefatos e comparar par a par
  4. Rodar `git diff --exit-code -- docs/specs/features/caracterizacao-regras-legadas/v1/golden/metragem.json ... calcular-mora.json` (os 6, excluindo `PROCEDENCIA.md`)
- **Resultado esperado**: Exit code 0 na segunda execução. O `sha256` de cada um dos 6 arquivos (`metragem.json`, `contrato-pdf.txt`, `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json`, `atualizar-atrasos-cobrancas.json`, `calcular-mora.json`) é idêntico ao da primeira execução. `git diff --exit-code` sobre esses 6 caminhos retorna 0. `PROCEDENCIA.md` é o único arquivo autorizado a diferir, e apenas nos campos de data/hora da captura.
- **Negative companion**: → CT-005: mesma captura com o relógio do processo deslocado em +37 dias — os 3 golden das rotinas seguem com `sha256` idêntico e nenhum literal de data absoluta — ver CT-005
- **Critérios validados**: AC-7
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Corresponde ao passo 13 da §8. A cláusula "sem recriar o site" é deliberada e é onde este teste ganha poder de detecção: se `capturar.py` apenas insere documentos sintéticos sem apagar os da execução anterior, a segunda rodada verá o dobro de candidatos e `total_atualizadas` mudará — o teste pega. Um `capturar.py` que só funcione em site virgem passa no passo 13 se o operador recriar o site entre as rodadas, e o defeito só apareceria na F5.

#### CT-005 — Offsets relativos — os golden das rotinas não contêm data absoluta e não mudam com o relógio deslocado

- **Tipo**: Integração | **Categoria**: fronteira
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: Os golden das três rotinas de estado gravam datas exclusivamente como offsets inteiros relativos à data de captura: capturar com o relógio do processo deslocado em +37 dias produz `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json` e `atualizar-atrasos-cobrancas.json` com `sha256` idêntico ao da captura sem deslocamento, e nenhum dos três contém literal de data no formato `AAAA-MM-DD`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Captura de referência concluída (CT-004 aprovado) com os `sha256` dos 3 arquivos registrados
  - Site efêmero ainda de pé
  - Mecanismo de deslocamento de relógio disponível no boundary (ou, na ausência dele, o caminho alternativo do dia seguinte)
- **Dados de entrada**: Mesma captura, relógio deslocado. Os dados sintéticos nascem com datas relativas (`vencida = hoje - N`, `a vencer = hoje + N`), então o cenário reconstruído no dia deslocado é equivalente ao da referência.
- **Passos**:
  1. Registrar `sha256sum` dos 3 golden de rotina da captura de referência
  2. Executar `capturar.py` com o relógio do processo deslocado em +37 dias
  3. Recalcular `sha256sum` dos 3 arquivos e comparar com o registro
  4. Rodar `grep -cE '[0-9]{4}-[0-9]{2}-[0-9]{2}'` em cada um dos 3 arquivos
  5. Inspecionar os campos de data: confirmar chaves de offset inteiro e o marcador de data de execução
- **Resultado esperado**: O `sha256` de `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json` e `atualizar-atrasos-cobrancas.json` é idêntico ao da captura de referência. `grep -cE '[0-9]{4}-[0-9]{2}-[0-9]{2}'` retorna 0 em cada um dos três. Os campos de data aparecem como offset inteiro (ex.: `"vencimento_offset_dias": -12`, `"data_fim_locacao_offset_dias": -5`) e o `data_execucao` devolvido pelas rotinas aparece como o marcador estável `<DATA_EXECUCAO>`. Em `atualizar-atrasos-cobrancas.json`, o campo `dias_atraso` de cada resultado é idêntico entre as duas capturas (ele é derivado do offset, não da data absoluta).
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: relógio do processo deslocado em +37 dias em relação à captura de referência. Asserção: `sha256` dos 3 arquivos idêntico ao da captura de referência; `grep -cE '[0-9]{4}-[0-9]{2}-[0-9]{2}'` nos 3 arquivos retorna 0; o campo `data_execucao` devolvido pelas rotinas aparece normalizado como o marcador `<DATA_EXECUCAO>`
- **Precondição privilegiada**: Deslocar o relógio percebido pelo processo na FRONTEIRA, fora do código: `libfaketime`/`LD_PRELOAD` no comando que invoca `capturar.py` dentro do container, ou executar o container com a data ajustada. É PROIBIDO acrescentar parâmetro `--hoje`, `--data-base` ou variável de ambiente lida por `capturar.py` para simular a data — isso seria código test-only vazando no artefato de produção (Iron Law #6) e ainda por cima invalidaria o próprio golden (a captura real passaria a poder rodar com data falsa). Caminho alternativo legítimo, se o deslocamento de relógio não estiver disponível no container: re-executar a captura em um dia real diferente (ex.: no dia seguinte) e comparar os `sha256` — mais lento, mesmo poder de detecção. Análogo: `NENHUM`
- **Critérios validados**: AC-6; AC-7
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Este é o teste que dá poder ao AC-6: sem ele, "gravar offsets" é afirmação de código, não propriedade verificada. Note que a restrição de offsets vale APENAS para os 3 golden de rotina — o `Contrato` sintético usado para o PDF deve, ao contrário, nascer com datas ABSOLUTAS FIXAS, porque o texto do PDF renderiza as datas do contrato e um contrato com data relativa quebraria o CT-004 (o texto mudaria a cada dia). Isso está registrado em `recomendacoes`.

#### CT-006 — Metragem — os 4 cenários existem e cada agregado do golden bate com o campo persistido no site efêmero

- **Tipo**: Integração | **Categoria**: caminho_feliz
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: `metragem.json` traz exatamente 4 cenários (sem cômodo, um cômodo, vários cômodos, vários cômodos com ao menos um de metragem nula) e, para cada um, o valor agregado gravado no golden é igual ao valor efetivamente persistido no campo agregado do `Imovel` correspondente no site efêmero — prova de que o valor veio do evento `Before Save` do Server Script, e não de um cálculo do próprio script de captura.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Gate de sanidade aprovado — `Cálculo metragem imóvel` presente com `disabled = 0` (CT-001 linha (a))
  - `capturar.py` executado com exit 0
  - Site efêmero ainda de pé, com os 4 `Imovel` sintéticos ainda presentes
- **Dados de entrada**: Os 4 cenários da §6.3, um `Imovel` cada, cada um salvo e lido de volta.
- **Passos**:
  1. Carregar `metragem.json` e contar os cenários
  2. Conferir que o conjunto de chaves de cenário é exatamente o esperado
  3. Para cada cenário, ler do site efêmero o campo agregado do `Imovel` referenciado via `bench --site caracterizacao.localhost execute frappe.db.get_value`
  4. Comparar o valor lido do banco com o valor gravado no golden
  5. Conferir que cada cenário traz também a configuração de cômodos de entrada
- **Resultado esperado**: `len(cenarios) == 4` e o conjunto de chaves é exatamente `{sem_comodo, um_comodo, varios_comodos, varios_comodos_com_metragem_nula}`. Para cada cenário, `cenario.valor_agregado` é igual, em comparação exata sobre a representação normalizada, ao valor retornado por `frappe.db.get_value("Imovel", cenario.imovel_ref, <campo agregado>)` no site efêmero. Cada cenário traz um campo com a lista de cômodos de entrada (nome e metragem de cada um), não vazio exceto em `sem_comodo`. No cenário `um_comodo`, `valor_agregado` é igual à metragem do único cômodo informado.
- **Negative companion**: → CT-007: cenário com cômodo de metragem nula e cenário sem nenhum cômodo — o golden registra o valor exato devolvido pela regra, sem substituição por 0 nem correção, e os 4 agregados não são todos iguais — ver CT-007
- **Critérios validados**: AC-1
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. A comparação golden-vs-banco é a única forma de provar que a regra rodou: um `capturar.py` que computasse a soma em Python e gravasse o resultado produziria um golden bonito e inútil. O expected value vem do banco (fonte externa ao check), não de literal escrito pelo teste — Gate 6 satisfeito. A assertion `um_comodo == metragem do cômodo` é a âncora anti-tautologia mínima.

#### CT-007 — Metragem — o golden distingue os cenários e registra o cenário degenerado sem correção

- **Tipo**: Integração | **Categoria**: caso_extremo
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: O golden de metragem prova que a regra computou por cenário e não que um campo estático foi lido: os 4 agregados apresentam ao menos 3 valores distintos entre si, `varios_comodos` é estritamente maior que `um_comodo`, e o cenário com cômodo de metragem nula grava exatamente o valor devolvido pela regra — sem substituição por 0, sem preenchimento default e sem correção pelo script de captura.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - CT-006 aprovado (os 4 cenários existem e batem com o banco)
  - Site efêmero ainda de pé
- **Dados de entrada**: Os mesmos 4 cenários do CT-006; o foco aqui são os dois degenerados.
- **Passos**:
  1. Extrair os 4 valores agregados do golden e contar valores distintos
  2. Comparar `varios_comodos` com `um_comodo`
  3. Ler do banco o valor bruto do campo agregado do cenário `varios_comodos_com_metragem_nula`, sem coerção de tipo
  4. Comparar o valor bruto com o gravado no golden, distinguindo `null` de `0` e de `""`
  5. Calcular a soma aritmética dos cômodos não nulos do cenário e, se divergir do agregado, exigir a observação correspondente no `PROCEDENCIA.md`
- **Resultado esperado**: `len(set([c.valor_agregado for c in cenarios])) >= 3`. `varios_comodos.valor_agregado > um_comodo.valor_agregado`. O valor do cenário `varios_comodos_com_metragem_nula` no golden é idêntico ao valor bruto do banco preservando o tipo — se o banco devolve `null`, o golden grava `null` (não `0`); se devolve `0`, grava `0` (não `null`). Quando o agregado desse cenário difere da soma aritmética dos cômodos não nulos, existe no `PROCEDENCIA.md` uma linha de observação nomeando o cenário e a divergência observada. Nenhum dos 4 cenários tem o campo `valor_agregado` ausente da estrutura.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: Imovel sem nenhum cômodo e Imovel com cômodo de metragem nula — os dois inputs degenerados da §6.3. Asserção: `len(set(valores_agregados)) >= 3`; `varios_comodos > um_comodo`; para o cenário nulo, `golden.valor_agregado` idêntico ao valor bruto lido do banco, inclusive se for `null` ou `0`, e a divergência em relação à soma aritmética dos cômodos não nulos registrada como observação no `PROCEDENCIA.md`
- **Critérios validados**: AC-1
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Negative companion do CT-006. A assertion de valores distintos é a rede contra o modo de falha silencioso mais provável depois do Server Script inativo: os 4 cenários virem todos `0` ou todos `null` e o golden parecer completo. Note que este caso NÃO exige que a regra esteja "certa" — o guardrail §7.2 manda registrar o defeito, e é exatamente isso que a assertion sobre o tipo bruto garante: proíbe o script de captura de "melhorar" o valor.

#### CT-008 — As três rotinas de estado — o golden grava retorno E estado resultante, e o estado bate com o banco

- **Tipo**: Integração | **Categoria**: integridade_dados
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: Para cada uma das três rotinas de estado, o golden grava tanto o valor de retorno completo quanto o estado resultante das entidades afetadas, e cada campo de estado gravado é igual ao valor efetivamente persistido no site efêmero imediatamente após a execução — só o retorno não reproduz o cenário na F5.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - `capturar.py` executado com exit 0 (CT-001 linha (a))
  - Site efêmero ainda de pé, com os documentos sintéticos ainda presentes
  - Os 3 golden de rotina gravados
- **Dados de entrada**: Table-driven por rotina — 3 linhas, cada uma com o contrato de retorno e o conjunto de campos de estado a conferir.
- **Passos**:
  1. Para cada linha: carregar o golden correspondente e conferir a presença de TODAS as chaves de retorno listadas
  2. Conferir que o golden traz uma seção de estado resultante além do retorno
  3. Para cada entidade citada no estado resultante, ler o valor atual no site efêmero via `frappe.db.get_value`
  4. Comparar campo a campo o valor do golden com o valor do banco
  5. Conferir a coerência interna do retorno: os totais batem com o tamanho das listas
- **Resultado esperado**: Os 3 golden trazem todas as chaves de retorno listadas, sem nenhuma faltando. `marcar-cobrancas-vencidas.json`: `ok == true`; `total_atualizadas == len(cobrancas)`; para cada nome em `cobrancas[]`, `Cobranca.status_cobranca == "Vencida"` no banco; e ao menos uma `Cobranca` sintética fora dessa lista continua com `status_cobranca == "Pendente"`. `encerrar-contratos-vencidos.json`: `total_candidatos == len(resultados)`; `total_encerrados == len([r for r in resultados if r.acao == "encerrado"])`; para cada `acao == "encerrado"`, no banco `Contrato.status_contrato == "Encerrado"`, `Imovel.status_locacao == "Disponível"` e `Imovel.contrato_ativo == ""`. `atualizar-atrasos-cobrancas.json`: `total_candidatas == len(resultados)`; `total_atualizadas + total_ignoradas == total_candidatas`; para cada `acao == "atualizada"`, os três valores `valor_multa`, `valor_juros` e `valor_total` do golden são iguais aos persistidos na `Cobranca`, e `data_ultima_atualizacao_atraso` aparece normalizada como `<DATA_EXECUCAO>` (offset 0).
- **Negative companion**: → CT-009: contrato vencido sem imóvel associado e cobrança `Vencida` com vencimento futuro — as entradas `ignorado/contrato_sem_imovel` e `ignorada/vencimento_futuro` estão no golden e as entidades correspondentes permanecem inalteradas no banco — ver CT-009
- **Critérios validados**: AC-3
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Consolida as 3 rotinas num único caso parametrizado (padrão 6 da doutrina) porque a invariante é a mesma; os caminhos negativos, que têm invariante própria, ficam no CT-009. A assertion "uma Cobranca fora da lista continua Pendente" é a âncora que impede o falso verde de uma rotina que marcasse tudo. Todos os expected values vêm do banco ou do contrato de retorno das funções legadas — nenhum literal auto-setado (Gate 6).

#### CT-009 — Caminhos ignorados cobertos — `contrato_sem_imovel` e `vencimento_futuro` estão no golden com estado inalterado

- **Tipo**: Integração | **Categoria**: teste_negativo
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: Os golden das rotinas cobrem os caminhos que hoje não têm teste algum: `encerrar-contratos-vencidos.json` contém ao menos uma entrada `{acao: "ignorado", motivo: "contrato_sem_imovel"}` cujo contrato permanece `status_contrato = "Ativo"` no banco, ao lado de ao menos uma entrada `acao: "encerrado"`; e `atualizar-atrasos-cobrancas.json` contém ao menos uma entrada `{acao: "ignorada", motivo: "vencimento_futuro"}` cuja cobrança permanece com `valor_multa` e `valor_juros` inalterados.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Dados sintéticos incluem um `Contrato` vencido, `Ativo`, com `imovel` vazio
  - Dados sintéticos incluem uma `Cobranca` marcada `Vencida` com `data_vencimento` no futuro (offset positivo)
  - Valores de `valor_multa`/`valor_juros` dessa cobrança registrados antes da execução da rotina
- **Dados de entrada**: Os dois inputs degenerados que hoje nenhum teste do app legado toca.
- **Passos**:
  1. Carregar `encerrar-contratos-vencidos.json` e filtrar `resultados[]` por `acao == "ignorado"`
  2. Conferir que ao menos uma tem `motivo == "contrato_sem_imovel"` e traz o `name` do contrato
  3. Ler no banco o `status_contrato` desse contrato
  4. Conferir que existe ao menos uma entrada `acao == "encerrado"` no mesmo golden
  5. Carregar `atualizar-atrasos-cobrancas.json` e filtrar por `acao == "ignorada"` e `motivo == "vencimento_futuro"`
  6. Ler no banco `valor_multa` e `valor_juros` dessa cobrança e comparar com os valores pré-rotina
- **Resultado esperado**: Em `encerrar-contratos-vencidos.json`: `total_ignorados >= 1` e existe ao menos um resultado com `acao == "ignorado"` e `motivo == "contrato_sem_imovel"`, contendo o campo `name` do contrato; no banco, esse `Contrato` tem `status_contrato == "Ativo"` (não foi encerrado) e nenhum `Imovel` foi liberado por causa dele. No mesmo golden, `total_encerrados >= 1`. Em `atualizar-atrasos-cobrancas.json`: existe ao menos um resultado com `acao == "ignorada"` e `motivo == "vencimento_futuro"`; no banco, essa `Cobranca` tem `valor_multa` e `valor_juros` exatamente iguais aos registrados antes da rotina, e `data_ultima_atualizacao_atraso` continua vazia.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: `Contrato` vencido e `Ativo` com o campo `imovel` vazio; `Cobranca` com `status_cobranca = "Vencida"`, `pagamento_confirmado = 0` e `data_vencimento` no futuro. Asserção: `total_ignorados >= 1` com `motivo == "contrato_sem_imovel"`; o contrato correspondente segue `status_contrato == "Ativo"` no banco; `total_ignoradas >= 1` com `motivo == "vencimento_futuro"`; a cobrança correspondente segue com `valor_multa` e `valor_juros` iguais aos de antes da rotina
- **Critérios validados**: AC-3
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Negative companion do CT-008 e o caso que fecha o buraco declarado na §5.1 ("dois caminhos de `ignorado` que nenhum teste toca hoje"). O caminho `contrato_sem_name` NÃO é coberto aqui e está registrado em `cenarios_nao_cobertos` com a justificativa — ele é inalcançável pelo caminho real. Deletar este caso deixaria a suíte verde com um golden que só documenta o caminho feliz, exatamente o que a F5 não pode receber (sanidade do Gate 7).

#### CT-010 — Documento de contrato — texto extraído, zero bytes de PDF versionados, campos voláteis mascarados

- **Tipo**: Unitário | **Categoria**: integridade_dados
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-golden.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: `contrato-pdf.txt` é texto decodificável em UTF-8 que não começa com a assinatura `%PDF-`, nenhum arquivo versionado sob `golden/` é binário, e nenhum campo volátil de geração sobrevive no texto — em particular, a data de captura registrada no `PROCEDENCIA.md` não aparece em nenhuma posição do arquivo, e há ao menos um marcador estável no formato `<NOME_DO_CAMPO>` no lugar dela.
- **Owning layer**: `unit` | **Real execution boundary**: `filesystem`
- **Pré-condições**:
  - Os 7 arquivos de `golden/` gravados e adicionados ao índice do git
  - `PROCEDENCIA.md` com a data de captura registrada
- **Dados de entrada**: Somente os arquivos versionados. Nenhuma execução contra o Frappe.
- **Passos**:
  1. Rodar `git ls-files docs/specs/features/caracterizacao-regras-legadas/v1/golden/` e conferir a lista de 7 arquivos
  2. Rodar `file --mime-type` em cada um
  3. Ler os 5 primeiros bytes de `contrato-pdf.txt`
  4. Decodificar `contrato-pdf.txt` como UTF-8 estrito
  5. Extrair a data de captura do `PROCEDENCIA.md` e grepar por ela (formato ISO e formato brasileiro) dentro de `contrato-pdf.txt`
  6. Grepar por padrão de hora `HH:MM:SS` em `contrato-pdf.txt`
  7. Contar os marcadores no formato `<[A-Z_]+>` em `contrato-pdf.txt`
- **Resultado esperado**: `git ls-files` sobre `golden/` retorna exatamente 7 caminhos e nenhum com extensão `.pdf`, `.bin` ou `.zip`. `file --mime-type` de cada um dos 7 começa com `text/`. Os 5 primeiros bytes de `contrato-pdf.txt` são diferentes de `%PDF-`. A decodificação UTF-8 estrita do arquivo não levanta erro. `grep -F` pela data de captura (nos formatos `AAAA-MM-DD` e `DD/MM/AAAA`) retorna 0 ocorrências em `contrato-pdf.txt`. `grep -cE '[0-9]{2}:[0-9]{2}:[0-9]{2}'` retorna 0. A contagem de marcadores `<[A-Z_]+>` é maior ou igual a 1.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: um `golden/` que contenha bytes de PDF (arquivo `.pdf`, ou `contrato-pdf.txt` iniciado por `%PDF-`) ou texto com timestamp de geração literal. Asserção: o check falha com exit != 0 nomeando o arquivo ofensor e a posição da ocorrência; `git ls-files` sobre `golden/` retorna 0 arquivos com extensão `.pdf` e `file --mime-type` de todos os 7 arquivos começa com `text/`
- **Critérios validados**: AC-2
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-golden.sh` (check offline — sobrevive à desinstalação do Frappe e é o candidato natural a virar `.spec.ts` na F0). O grep é pela data DE CAPTURA especificamente, e não por qualquer data: o texto do contrato contém legitimamente as datas do `Contrato` sintético, que devem ser absolutas e fixas (ver `recomendacoes`) — grepar toda data daria falso positivo e forçaria mascarar o que é conteúdo de negócio. Não há snapshot de `IMPLEMENTATION_DETAIL` aqui: o artefato é um golden de caracterização, classe `PRODUCT_CONTRACT` para a prova de equivalência da F3, e as assertions deste caso são específicas, não diff cego (Gate 5).

#### CT-011 — `calcular-mora.json` porta os 6 casos canônicos com entradas e saída exata, conferidas contra a fórmula documentada

- **Tipo**: Unitário | **Categoria**: integridade_dados
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-golden.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: `calcular-mora.json` contém os 6 casos canônicos de `TestCalcularMora`, cada um com `valor_original`, `dias_atraso`, `multa_percentual`, `juros_percentual` e a saída exata `{valor_multa, valor_juros, valor_total}`; e cada saída satisfaz a fórmula documentada em `_calcular_mora` — multa = arredondar(v × m / 100), juros = arredondar(v × (j / 100) / 30 × dias), total = arredondar(v + multa + juros), todos com `ROUND_HALF_UP` a 2 casas.
- **Owning layer**: `unit` | **Real execution boundary**: `filesystem`
- **Pré-condições**:
  - `calcular-mora.json` gravado e versionado
- **Dados de entrada**: Os 6 casos canônicos, portados sem re-execução (§6.7). Entradas na ordem (valor_original, dias_atraso, multa_percentual, juros_percentual).
- **Passos**:
  1. Carregar `calcular-mora.json` e contar os casos
  2. Para cada caso, conferir a presença das 4 entradas e das 3 saídas
  3. Comparar cada saída com o valor esperado do teste-fonte
  4. Re-derivar cada saída pela fórmula documentada (`Decimal` com `ROUND_HALF_UP`, 2 casas, mês comercial de 30 dias) e comparar
  5. Conferir as 3 relações estruturais: linearidade, independência da multa e soma das partes
- **Resultado esperado**: `len(casos) == 6`. Valores exatos: `(2000.0, 52, 2, 1) → {valor_multa: 40.00, valor_juros: 34.67, valor_total: 2074.67}`; `(2000.0, 30, 2, 1) → {40.00, 20.00, 2060.00}`; `(2000.0, 60, 2, 1) → {40.00, 40.00, 2080.00}`; `(2000.0, 52, 50, 1) → {1000.00, 34.67, 3034.67}`; `(2000.0, 5, 2, 1) → {40.00, 3.33, 2043.33}`; `(2000.0, 500, 2, 1) → {40.00, 333.33, 2373.33}`; `(1234.56, 17, 2, 1) → {24.69, 7.00, 1266.25}`. Relações: `juros(60 dias) == round(juros(30 dias) × 2, 2)` = 40.00; `juros(multa 50%) == juros(multa 2%)` = 34.67; `multa(5 dias) == multa(500 dias)` = 40.00; para todo caso, `valor_total == round(valor_original + valor_multa + valor_juros, 2)`. Cada valor do golden é idêntico ao re-derivado pela fórmula, com tolerância 0.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: um golden com menos de 6 casos, com valor divergente do teste-fonte, ou com juros incidindo sobre a multa (`valor_juros` diferente entre multa 2% e multa 50%). Asserção: o check falha com exit != 0 nomeando o caso e imprimindo esperado vs. encontrado; em particular, `caso(2000.0, 52, 50, 1).valor_juros == 34.67`, idêntico ao de `caso(2000.0, 52, 2, 1)` — se divergirem, o golden registrou juros sobre a multa e é inválido
- **Critérios validados**: AC-4
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-golden.sh`. Os valores esperados foram re-derivados da fórmula documentada em `_calcular_mora` (fonte externa ao check — Gate 6, origem (b)/(c)) e conferem com as assertions de `TestCalcularMora`. Os 6 casos-fonte fazem 7 invocações distintas de `_calcular_mora` no total (dois testes invocam duas vezes); o golden deve preservar as 7 tuplas para não perder a evidência de linearidade e de independência da multa — este ponto está em `recomendacoes` porque o AC-4 fala em "6 casos" e a leitura literal poderia descartar tuplas.

#### CT-012 — ADR-0006 — o site `frontend` recebe apenas `bench backup` e sai do fluxo sem uma única escrita

- **Tipo**: Segurança | **Categoria**: seguranca
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-captura.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: Após o fluxo completo (backup → criar → capturar → destruir), o site `frontend` permanece sem escrita: as contagens de `Cobranca`, `Contrato` e `Imovel` e o `max(modified)` de cada uma são idênticos aos medidos antes do fluxo; e nos dois scripts versionados a única invocação de `bench` com `--site frontend` é o subcomando `backup`.
- **Owning layer**: `service-integration` | **Real execution boundary**: `db`
- **Pré-condições**:
  - Medição pré-fluxo tomada no site `frontend` em modo estritamente somente-leitura (`frappe.db.count` e `max(modified)`)
  - Fluxo completo ainda não executado
- **Dados de entrada**: Doctypes de negócio tocadas pelas três rotinas e pelos dois Server Scripts.
- **Passos**:
  1. Antes do fluxo: registrar `count` e `max(modified)` de `Cobranca`, `Contrato` e `Imovel` no site `frontend`
  2. Executar o fluxo completo
  3. Após o fluxo: registrar as mesmas 6 métricas e comparar par a par
  4. Rodar `grep -nE -- '--site[ =]+frontend' deploy/scripts/caracterizacao/*` e classificar o subcomando de cada ocorrência
  5. Rodar `grep -n 'frontend' deploy/scripts/caracterizacao/capturar.py`
- **Resultado esperado**: As 6 métricas do site `frontend` (count e max(modified) de `Cobranca`, `Contrato` e `Imovel`) são idênticas antes e depois do fluxo — diff textual vazio. Toda ocorrência de `--site frontend` nos scripts versionados tem `backup` como subcomando; zero ocorrências de `new-site`, `restore`, `drop-site`, `set-config`, `set-value`, `execute` ou `console` associadas a `frontend`. `capturar.py` não contém nenhum literal `frontend` como site alvo. O site alvo usado por `capturar.py` é `caracterizacao.localhost`, verificável no log da execução.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: um script alterado para invocar `bench --site frontend set-value`, `restore`, `drop-site`, `set-config`, `execute` ou `console`, ou um `capturar.py` que aponte o site alvo para `frontend`. Asserção: o check falha com exit != 0 imprimindo o arquivo e o número da linha da invocação ofensora; e, no plano de dados, qualquer divergência de contagem ou de `max(modified)` no site `frontend` reprova o fluxo nomeando a doctype divergente
- **Critérios validados**: AC-5
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-captura.sh`. Este é o guardrail de maior blast radius da task — `/opt/frappe` é produção viva. O check tem duas metades deliberadas: a estática pega o erro antes de rodar, e a medição pré/pós pega escrita por caminho indireto (Server Script, hook, job) que o grep não veria. As leituras no site `frontend` são `count` e `max(modified)`, estritamente não-destrutivas e compatíveis com ADR-0006, que restringe execução de verificação, não observação. Se o revisor preferir zero contato com o `frontend`, a alternativa é comparar o dump pré/pós — registrada em `recomendacoes`.

#### CT-013 — `MYSQL_ROOT_PASSWORD` não vaza para nenhum arquivo versionado nem para a saída dos scripts

- **Tipo**: Segurança | **Categoria**: seguranca
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-golden.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: O valor de `MYSQL_ROOT_PASSWORD`, lido de `/opt/frappe/docker-compose.yaml` em runtime, não aparece em nenhum arquivo versionado do repositório nem no stdout/stderr dos dois scripts, e os scripts não contêm nenhum literal de senha — a obtenção é exclusivamente por leitura em runtime.
- **Owning layer**: `unit` | **Real execution boundary**: `filesystem`
- **Pré-condições**:
  - Os dois scripts versionados e executados ao menos uma vez com stdout e stderr capturados em arquivo fora do repositório
  - `docker-compose.yaml` legível
- **Dados de entrada**: O valor da senha lido em runtime, usado apenas como agulha de busca.
- **Passos**:
  1. Ler a senha em runtime para variável de shell local
  2. Rodar `git grep -F -- "$SENHA"` na árvore versionada do repositório
  3. Rodar `grep -cF -- "$SENHA"` nos logs capturados de `preparar-site-efemero.sh criar`, `destruir` e de `capturar.py`
  4. Rodar `grep -nE '(PASSWORD|password|senha)[[:space:]]*=[[:space:]]*["'\''][^"'\'']+' deploy/scripts/caracterizacao/`
  5. Rodar `grep -n 'set -x' deploy/scripts/caracterizacao/`
  6. Conferir que os scripts referenciam `docker-compose.yaml` como fonte da senha
- **Resultado esperado**: `git grep -F -- "$SENHA"` retorna 0 ocorrências (exit 1 do grep) em toda a árvore versionada, incluindo `golden/` e `PROCEDENCIA.md`. `grep -cF -- "$SENHA"` retorna 0 em cada um dos logs dos dois scripts. Zero literais de senha atribuídos nos scripts. Zero ocorrências de `set -x` em `preparar-site-efemero.sh` e `capturar.py` (o rastreio do shell ecoaria o argumento `--mariadb-root-password`). Ao menos uma referência a `docker-compose.yaml` presente em `preparar-site-efemero.sh`, provando a leitura em runtime. Nenhuma mensagem de falha do próprio check imprime o valor da senha.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: script com a senha embutida em literal, ou com `set -x` ativo fazendo o shell ecoar `--mariadb-root-password <valor>`, ou `PROCEDENCIA.md` registrando a senha. Asserção: o check falha com exit != 0 nomeando o arquivo e a linha, SEM reimprimir o valor da senha na mensagem de erro
- **Precondição privilegiada**: Ler o valor em runtime da mesma fonte que os scripts usam (`/opt/frappe/docker-compose.yaml`), mantê-lo apenas em variável de shell não exportada, nunca ecoá-lo, e não gravá-lo em arquivo temporário. As mensagens de falha citam arquivo e linha, nunca o valor. É proibido criar arquivo de fixture com a senha ou parametrizar os scripts com um `--password` de teste. Análogo: `NENHUM`
- **Critérios validados**: GUARDRAIL-7.2
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-golden.sh` para a metade estática e `verificar-captura.sh` para a metade de logs. Cobre o guardrail §7.2 ("não copiar o valor de `MYSQL_ROOT_PASSWORD` para código, log, mensagem de erro ou qualquer arquivo versionado") e a ADR-0005, que faz da extração do segredo condição de entrada, não ajuste posterior. Não há AC numerado correspondente — o item entra pelo checkbox "Guardrails respeitados (seção 7)" da §9; recomendo promovê-lo a AC próprio (registrado em `recomendacoes`). A assertion sobre `set -x` é o vazamento mais provável na prática: um `-x` deixado ligado durante o debug do script publica a senha no log da rotina.

#### CT-014 — `PROCEDENCIA.md` completo e em bijeção com as máscaras efetivamente aplicadas nos golden

- **Tipo**: Unitário | **Categoria**: integridade_dados
- **Arquivo**: `deploy/scripts/caracterizacao/verificar-golden.sh` (criar) — `existing_suite: NO_SUITE_FOUND`
- **Invariant**: `PROCEDENCIA.md` registra data e hora da captura, o site usado, o caminho e o timestamp do dump de origem e a versão do app Frappe; e o conjunto de marcadores de máscara documentados é exatamente igual ao conjunto de marcadores presentes nos 6 golden — nem máscara aplicada e não documentada, nem documentada e ausente.
- **Owning layer**: `unit` | **Real execution boundary**: `filesystem`
- **Pré-condições**:
  - Os 7 arquivos de `golden/` gravados, incluindo o `PROCEDENCIA.md`
- **Dados de entrada**: Somente os arquivos versionados.
- **Passos**:
  1. Carregar `PROCEDENCIA.md` e extrair os 6 campos obrigatórios
  2. Conferir que nenhum deles está vazio e que a data/hora casa com o formato ISO-8601
  3. Conferir que o site registrado é `caracterizacao.localhost` e que `frontend` não aparece como site de captura
  4. Extrair o conjunto de marcadores documentados na seção de máscaras
  5. Extrair, por regex, o conjunto de marcadores presentes nos 6 golden
  6. Calcular o diff simétrico dos dois conjuntos
  7. Conferir que cada máscara documentada tem um motivo não vazio
- **Resultado esperado**: Os 6 campos obrigatórios estão presentes e não vazios; a data/hora da captura casa com `AAAA-MM-DDTHH:MM:SS`; o site registrado é `caracterizacao.localhost` e a string `frontend` aparece no manifesto apenas como origem do dump, nunca como site de captura; o caminho do dump aponta para `sites/frontend/private/backups/` e traz o timestamp do arquivo; a versão do app traz um identificador de commit. O diff simétrico entre `set(marcadores documentados)` e `set(marcadores extraídos por `<[A-Z_]+>` dos 6 golden)` é o conjunto vazio. Cada máscara listada tem um motivo com ao menos uma frase — nenhuma linha de máscara com motivo em branco ou `TODO`.
- **Negative companion**: este é o caso negativo (`ct_id: self`) — entrada inválida: um golden com o marcador `<DATA_GERACAO>` que o `PROCEDENCIA.md` não lista, ou um `PROCEDENCIA.md` que lista `<NUMERO_CONTRATO>` sem que ele apareça em nenhum golden, ou um campo obrigatório do manifesto vazio. Asserção: o diff simétrico dos dois conjuntos é não vazio e o check falha com exit != 0 imprimindo os marcadores órfãos de cada lado; campo obrigatório vazio reprova nomeando o campo
- **Critérios validados**: AC-8; AC-2
- **Obs**: Arquivo novo proposto: `deploy/scripts/caracterizacao/verificar-golden.sh`. A bijeção é o que dá dente ao AC-8: uma lista de máscaras escrita à mão diverge do que o script realmente mascarou já na primeira alteração, e a F3 receberia um manifesto mentiroso. Deletar a assertion de diff simétrico deixaria o caso reduzido a "o arquivo tem seções" — teste oco (Gate 7, sanidade).

### 10.3 Cenários Obrigatórios

- [ ] CT-001 — Gate de sanidade aborta a captura quando os Server Scripts alvo não estão ativos no site efêmero
- [ ] CT-002 — `preparar-site-efemero.sh criar` é idempotente — duas execuções consecutivas deixam exatamente um site
- [ ] CT-003 — Teardown garantido — o site efêmero é derrubado mesmo quando a captura falha, e `destruir` é idempotente
- [ ] CT-004 — Determinismo — a segunda execução de `capturar.py` no mesmo site produz os 6 golden byte a byte idênticos
- [ ] CT-005 — Offsets relativos — os golden das rotinas não contêm data absoluta e não mudam com o relógio deslocado
- [ ] CT-006 — Metragem — os 4 cenários existem e cada agregado do golden bate com o campo persistido no site efêmero
- [ ] CT-007 — Metragem — o golden distingue os cenários e registra o cenário degenerado sem correção
- [ ] CT-008 — As três rotinas de estado — o golden grava retorno E estado resultante, e o estado bate com o banco
- [ ] CT-009 — Caminhos ignorados cobertos — `contrato_sem_imovel` e `vencimento_futuro` estão no golden com estado inalterado
- [ ] CT-010 — Documento de contrato — texto extraído, zero bytes de PDF versionados, campos voláteis mascarados
- [ ] CT-011 — `calcular-mora.json` porta os 6 casos canônicos com entradas e saída exata, conferidas contra a fórmula documentada
- [ ] CT-012 — ADR-0006 — o site `frontend` recebe apenas `bench backup` e sai do fluxo sem uma única escrita
- [ ] CT-013 — `MYSQL_ROOT_PASSWORD` não vaza para nenhum arquivo versionado nem para a saída dos scripts
- [ ] CT-014 — `PROCEDENCIA.md` completo e em bijeção com as máscaras efetivamente aplicadas nos golden

### 10.4 Padrões de Teste

- **Framework**: Nenhum instalado. Os checks desta task são scripts executáveis de verificação em Bash (`set -euo pipefail`) com asserções sobre JSON via `python3 -c` — mesma linguagem e mesmo ambiente dos artefatos que eles verificam. Vitest + embedded-postgres é o alvo futuro (F0), e `verificar-golden.sh` foi desenhado para ser portado para lá na F3/F5.
- **Stack**: Bash 5 + Python 3 (os dois artefatos executáveis desta task rodam dentro do container `backend` do Frappe, contra o site efêmero `caracterizacao.localhost`). O repositório alvo `/opt/sysloc-backend` está com `apps/` e `packages/` vazios, sem `package.json`, sem `pnpm-workspace.yaml` e sem `vitest.config.ts` — Fase 0 não iniciada. A stack alvo declarada no CLAUDE.md (Node 24 · TypeScript · Vitest + embedded-postgres) ainda NÃO existe e não pode ser usada nesta task.
- **Comando**: `bash deploy/scripts/caracterizacao/verificar-captura.sh   (exige o site efêmero de pé — rodar entre `capturar.py` e `preparar-site-efemero.sh destruir`)`
- **Convenção de nomes**: um bloco por `CT-NNN`, com o ID literal no nome da função/label — preserva a rastreabilidade `CT → teste` que o QA audita.
- **Fixture/Setup**: dados sintéticos criados pelo caminho real do bench no site efêmero (`bench --site caracterizacao.localhost`), nunca no site `frontend`.
- **Mocks**: nenhum. A captura observa comportamento real — mock aqui invalidaria o oráculo.

### 10.5 Cenários de Erro

| Cenário | Trigger | Expected | Código/Status |
|---------|---------|----------|---------------|
| CT-001 — Gate de sanidade aborta a captura quando os Server Scripts alvo não estão ativos | site efêmero com `Cálculo metragem imóvel` em `disabled = 1`; com `PDF contrato` inexistente; e com `server_script_enabled` removido do `site_config.json` | exit code != 0 (sugerido 2), stderr contendo literalmente o nome do Server Script ou `server_script_enabled` e a condição violada, e `git status --porcelain docs/specs/features/caracterizacao-regras-legadas/v1/ | exit code != 0 |
| CT-003 — Teardown garantido — o site efêmero é derrubado mesmo quando a captura falha, e  | captura abortada no meio (Server Script desabilitado, reaproveitando a precondição do CT-001) e `destruir` invocado sobre site inexistente | `ls -1 sites/ / grep -c '^caracterizacao.localhost$'` == 0 após o fluxo; exit code do fluxo != 0; segunda chamada de `destruir` → exit 0 e stdout contendo `site inexistente`; `sites/frontend` presente e zero oc | exit code != 0 |
| CT-009 — Caminhos ignorados cobertos — `contrato_sem_imovel` e `vencimento_futuro` estão  | `Contrato` vencido e `Ativo` com o campo `imovel` vazio; `Cobranca` com `status_cobranca = "Vencida"`, `pagamento_confirmado = 0` e `data_vencimento` no futuro | `total_ignorados >= 1` com `motivo == "contrato_sem_imovel"`; o contrato correspondente segue `status_contrato == "Ativo"` no banco; `total_ignoradas >= 1` com `motivo == "vencimento_futuro"`; a cobrança corres | exit code != 0 |
| CT-012 — ADR-0006 — o site `frontend` recebe apenas `bench backup` e sai do fluxo sem uma | um script alterado para invocar `bench --site frontend set-value`, `restore`, `drop-site`, `set-config`, `execute` ou `console`, ou um `capturar.py` que aponte o site alvo para `frontend` | o check falha com exit != 0 imprimindo o arquivo e o número da linha da invocação ofensora; e, no plano de dados, qualquer divergência de contagem ou de `max(modified)` no site `frontend` reprova o fluxo nomean | exit code != 0 |
| CT-013 — `MYSQL_ROOT_PASSWORD` não vaza para nenhum arquivo versionado nem para a saída d | script com a senha embutida em literal, ou com `set -x` ativo fazendo o shell ecoar `--mariadb-root-password <valor>`, ou `PROCEDENCIA.md` registrando a senha | o check falha com exit != 0 nomeando o arquivo e a linha, SEM reimprimir o valor da senha na mensagem de erro | exit code != 0 |

### 10.6 Rastreabilidade: Aceite Técnico → Testes

| # | Critério de Aceite (seção 9) | Teste(s) Correspondente(s) | Tipo |
|---|------------------------------|----------------------------|------|
| 1 | **AC-1** — 4 cenários de metragem capturados e versionados | CT-001, CT-006, CT-007 | Integração |
| 2 | **AC-2** — Contrato como texto extraído, máscaras registradas, zero bytes de PDF | CT-001, CT-010, CT-014 | Integração, Unitário |
| 3 | **AC-3** — 3 rotinas com retorno E estado resultante, incluindo caminho ignorado | CT-008, CT-009 | Integração |
| 4 | **AC-4** — 6 casos canônicos de _calcular_mora com entradas e saída exata | CT-011 | Unitário |
| 5 | **AC-5** — Captura só no site efêmero; frontend recebe apenas bench backup (ADR-0006) | CT-012 | Segurança |
| 6 | **AC-6** — Golden das rotinas com offsets relativos, reproduzíveis | CT-005 | Integração |
| 7 | **AC-7** — Re-execução produz golden idênticos; preparar-site-efemero.sh idempotente | CT-002, CT-003, CT-004, CT-005 | Integração |
| 8 | **AC-8** — Site efêmero destruído; PROCEDENCIA.md completo | CT-003, CT-014 | Integração, Unitário |

---

## 11. Notas / Observações

**A referência reflete o comportamento atual, inclusive defeitos.** Aceito deliberadamente e herdado da T4 original: o objetivo é portar sem alterar comportamento; corrigir defeito herdado é escopo de outra fatia. Observações vão para o `PROCEDENCIA.md`, não para o código.

**Descoberta que alterou o escopo do pré-refinamento.** O ramo D do `pre-refinement.md` listava `_calcular_mora()` como uma das 3 rotinas a caracterizar. A análise encontrou 6 testes já existentes em `tests/test_cobranca_atraso.py::TestCalcularMora` cobrindo exatamente essa função. O buraco real é `atualizar_atrasos_cobrancas()`, o wrapper que toca banco. Escopo ajustado com o usuário: portar os 6 casos (barato, sem re-execução) **e** caracterizar o wrapper.

**Por que o backup do host não serve.** `/opt/backups/frappe/daily/` pertence ao `root` e o `sudo` deste host exige senha. O `bench backup` dentro do container resolve sem elevação e produz um dump mais fresco — o mais recente no volume é de 2026-03-31.

**Por que o gate de sanidade do passo 4 é bloqueante.** Se os Server Scripts não estiverem ativos no site restaurado, a captura roda, não falha, e produz golden de um sistema onde a regra nunca executou. É o modo de falha mais perigoso desta task, porque se parece com sucesso.

**Cenário deliberadamente não coberto.** O caminho `ignorado / contrato_sem_name` de `encerrar_contratos_vencidos()` é código morto na prática — `frappe.get_all` sempre devolve `name` preenchido para documento existente. Forjá-lo exigiria manipular o retorno da query, produzindo golden de um comportamento que a produção nunca exibe. Registrado no `PROCEDENCIA.md`, não capturado. Achado do `agent-spec-qa-test-generator`, que também apontou a divergência original entre a §4.1 (pedia os dois caminhos) e o AC-3 (exigia um) — a §4.1 foi corrigida.

**Duas superfícies de verificação, propositalmente separadas.** `verificar-captura.sh` depende do Frappe vivo e morre com a F7; `verificar-golden.sh` é offline e sobrevive. A separação é o que permite revalidar os golden anos depois, quando o oráculo já não existir.

**Esta task destrava o fim do programa.** O gate de desinstalação da F7 (`plano-execucao.md`) exige estes golden commitados como primeiro item.

### ADRs Aplicáveis nesta Feature

- ADR-0006 — a suíte de verificação nunca executa contra o ambiente que atende a operação
- ADR-0005 — rotinas operacionais versionadas no repositório com instalação idempotente
