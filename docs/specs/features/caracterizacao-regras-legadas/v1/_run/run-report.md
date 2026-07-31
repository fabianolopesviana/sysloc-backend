# Relatório do Run — caracterizacao-regras-legadas/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **1/1 task concluída** · 14/14 CTs implementados · `verificar-golden.sh` 4/4 verde · `verificar-captura.sh` avaliado por leitura (site efêmero destruído por exigência do AC-8) · 8/8 critérios de aceite

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| TC-001 | Capturar caracterização das regras legadas | opus | 11 criados, 0 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

Quatro rodadas de execução. O contador de 3 tentativas se esgotou e foi **reaberto por decisão explícita do usuário**, com escopo travado numa correção de ~6 linhas.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado. Os quatro MÉDIOS foram rebaixados por **override explícito do usuário** durante o run, para restringir a última tentativa ao crítico e ao alto. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/caracterizacao-regras-legadas/v1/`.

### D1 · MEDIO · security · TC-001 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/verificar-captura.sh:134`
- **Problema:** consultas somente-leitura ao banco de produção autenticam como root do MariaDB
- **Impacto:** o raio de dano de um erro de interpolação no heredoc SQL passa de "uma base" para "toda a instância" — amplia exatamente a superfície que a ADR-0006 existe para reduzir
- **O que fazer:** ler `db_password` do mesmo `sites/<site>/site_config.json` de onde já se lê `db_name` (linha 1306) e trocar `-u root` por `-u "${base_producao}"`. A credencial root segue necessária em `preparar-site-efemero.sh` para `new-site`/`restore`/`drop-site`, onde o privilégio é de fato exigido

### D2 · MEDIO · code_quality · TC-001 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/capturar.py:137-755`
- **Problema:** ~600 linhas do programa de captura vivem como literal `r'''` dentro do arquivo (~60% dele)
- **Impacto:** fora do alcance de analisador estático, formatador e checagem de sintaxe; erro de sintaxe só aparece em runtime, dentro do container, depois do site efêmero já criado e restaurado
- **O que fazer:** extrair para `deploy/scripts/caracterizacao/programa-captura.py` e carregar com `(Path(__file__).parent / "programa-captura.py").read_text(encoding="utf-8")`

### D3 · MEDIO · best_practices · TC-001 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/verificar-captura.sh:118`, `verificar-golden.sh:308`, `preparar-site-efemero.sh:57`
- **Problema:** nenhuma camada comum — o `awk` de extração da credencial está triplicado e o harness de asserção, duplicado (e já divergente: `verificar-captura.sh` tem `afirmar_contem`, `verificar-golden.sh` não)
- **Impacto:** correção no parser da credencial precisa de três edições e pode receber duas, deixando um script lendo o segredo de um jeito e outro de outro sem que nada acuse
- **O que fazer:** criar `deploy/scripts/caracterizacao/_comum.sh` com `ler_credencial_db`, o harness e os contadores. Atenção: `verificar-golden.sh` precisa continuar funcionando sem `/opt/frappe`, então o `_comum.sh` não pode assumir o compose presente no source

### D4 · MEDIO · project_pattern · TC-001 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/` (todos os scripts)
- **Problema:** ausência da rastreabilidade `CA-xx → CT-xxx (RN-xx)` e da seção de INVARIANTES por arquivo que o `CLAUDE.md` exige
- **Impacto:** a §10.4 prevê portar `verificar-golden.sh` para Vitest na F3/F5; no porte, ninguém saberá qual critério cada caso sustenta sem voltar a uma TaskCard arquivada. É o primeiro artefato de teste do repositório novo — fixa o padrão
- **O que fazer:** bloco INVARIANTES no cabeçalho de cada verificador e anotação por função (`# CT-005 (AC-6) — offsets relativos`). O mapa completo já existe na §10.6 da TaskCard; é transcrição. **Nota: defeito de origem na TaskCard** — a convenção não foi posta nos guardrails §7 nem nos critérios §9

### D5 · BAIXO · security · TC-001 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/verificar-captura.sh:1174`
- **Problema:** o caminho de sucesso do CT-012 imprime `name` e `modified_by` de documentos reais de produção
- **Impacto:** efêmero hoje; basta a verificação rodar sob captura de log (CI, `tee`, `script`) para persistir identificadores de contrato, cobrança e conta de usuário fora do controle previsto
- **O que fazer:** substituir a listagem individual do caminho de sucesso pela contagem agregada que já existe; manter o detalhe nominal apenas em `nao_atribuidas`

### D6 · BAIXO · code_quality · TC-001 · Tech Review
- **Onde:** `deploy/scripts/caracterizacao/verificar-golden.sh:332`
- **Problema:** allowlist do CT-013 ancorada em pares `arquivo:linha`
- **Impacto:** edição rotineira em specs de outras features desloca a linha e reprova por vazamento inexistente
- **O que fazer:** ancorar no caminho do arquivo (ou arquivo + hash do trecho), mantendo a contagem esperada por arquivo como guarda contra ocorrência nova
- **Reafirmado pelo Tech Review na 2ª revisão (P9)** com contexto novo e mais grave do que o registrado aqui: **7 das 13 coordenadas vivem em `.claude/skills/` e em specs de outras features**, que serão editadas durante o programa. Como `verificar-golden.sh` é o pré-requisito nº 1 do gate de desinstalação da F7, o operador desse gate encontraria um verificador vermelho por motivo alheio ao artefato. É o débito de maior prioridade prática desta lista

### D7 · BAIXO · tests · TC-001 · QA
- **Onde:** `deploy/scripts/caracterizacao/verificar-captura.sh:1249`
- **Problema:** a margem entre `DRENO_MAXIMO_S = 30.0` e o dreno medido (~22s) é de 8s, e não há conduta prescrita se um dreno futuro ultrapassar 30s
- **Impacto:** falso-vermelho no CT-012 — escrita legítima do dreno cairia no trecho mordente e seria reportada como não atribuída; quem operar o fluxo não tem no código o critério para distinguir isso de escrita real em produção. Direção de falha segura
- **O que fazer:** registrar a margem no comentário (30s de teto contra ~22s observados) e a conduta: reconferir o `ultima_sincronizacao_sicoob_em` da execução correlata no `run-*.log` antes de tratar como escrita indevida, e re-medir o dreno antes de mexer na constante. Débito de documentação, não de lógica

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

> A TC-001 chegou a ser marcada `Bloqueado` após esgotar as 3 tentativas (regressão no CT-012 introduzida ao corrigir o P1/P2). O usuário reabriu o contador com escopo travado numa correção de ~6 linhas, e a 4ª rodada aprovou nos dois gates.

## 4. Notas para Revisão Humana

- **Os golden estão íntegros e no disco.** Os 6 artefatos de dados bateram por verificação estrutural independente do QA (zero datas absolutas, offsets presentes, re-derivação pela fórmula do CT-011 e bijeção de máscaras do CT-014 aprovadas). O bloqueio é na **prova de conformidade com a ADR-0006**, não na validade da caracterização.
- **Incidente evitado, registrado para não se repetir.** Na tentativa 2 o CT-005 gravou `sitecustomize.py` no `site-packages` do container `frappe-backend-1`, que atende produção, deslocando o relógio em +37 dias para todo processo Python novo daquele container. Durante a janela, o cron do host disparou 70 execuções contra o site de produção. Verificação do orquestrador: **nenhum dano** — sem escrita em `Cobranca`/`Contrato`/`Imovel` após 00:30, `Email Queue` e `Log Envio Cobranca` vazios, `max(modified)` anterior à janela, rotinas diárias com data correta. Foi horário e base sem movimento, não contenção de desenho. Corrigido na tentativa 3.
- **O laço de validação consumiu a janela de backup do ambiente.** `preparar-site-efemero.sh criar` gera um dump completo por execução, sem retenção, e o CT-002/CT-003 o invocam 3 vezes por rodada. Os conjuntos foram de 1 para 24 (209 MB) e depois, após limpeza autorizada, de 2 para 10. A rotação automática do bench já havia descartado o baseline de 2026-03-31 nesse processo — o ambiente ficou sem backup anterior a hoje. Introduzir retenção no `criar` é candidato a fatia própria.
- **Dois gates pegaram classes distintas e nenhum pegaria a do outro.** O QA achou asserções que não podiam falhar; o Tech Review achou um efeito colateral estrutural fora do diff que revisava — foi ler `run-locacao-automation.sh` no ambiente para descobrir. Justifica o custo dos dois em tasks que tocam produção.
- **As quatro rejeições foram da mesma família: asserções que não conseguem falhar.** Tautologia por frase genérica (CT-007), por valor recalculado localmente (CT-003), por ramo `AVISO` (CT-012 na t1) e por janelas que ladrilham o tempo (CT-012 na t3). Nenhuma foi má-fé — cada uma nasceu de uma tentativa legítima de contornar ruído de ambiente vivo com rotinas concorrentes. **Consequência para a F5 (`automacoes-agendadas`), que vai testar exatamente essas rotinas:** vale entrar naquela fatia com regra explícita — toda folga temporal deve ser estritamente menor que a cadência do processo concorrente, com asserção de sanidade que prove a mordida.
- **Correção do Tech Review ao sumário do QA, para o histórico ficar certo.** A direção de falha do CT-012 **não** é "nunca falso-verde": com 30s cobertos em 60s, uma escrita indevida isolada tem ~50% de chance de cair em slot coberto. Não muda o veredito — o modo de falha real (escrita indireta por Server Script/hook/job) produz muitas escritas, e as tábuas determinísticas disparariam junto —, mas a formulação anterior era otimista demais.
- **O `docker` homônimo no `PATH` foi aprovado com ressalva de generalização.** O Tech Review julgou a decisão de desenho, não só o escopo: a alternativa "mais simples" (dar a `capturar.py` um parâmetro de data) criaria símbolo de produção que só o teste usa — violação da Iron Law #6. A troca está certa **porque o alvo é um script descartável que morre na F7**. Se o padrão reaparecer em código que sobrevive ao programa, deve ser tratado como gambiarra.
- **Uso de root do MariaDB para os SELECTs foi considerado e deliberadamente não reportado** pelo Tech Review: o usuário próprio do site tem `ALL PRIVILEGES` no próprio schema, então trocar não reduziria o raio de dano sobre as tabelas que importam, e traria um segundo segredo para dentro do processo. O D1 permanece anotado como melhoria, não como falha.
