# Relatório do Run — virada-e-desinstalacao/v1

> Relatório para revisão humana. Telemetria de pipeline vive em `_run/workflow-report.md` — que
> **não existe nesta fatia**, e a ausência é a decisão: ela não passou pelo pipeline SDD/miniSpec.
> Ver `source_note` em `_run/operacao_state.yaml`.

## 1. Resumo do Run

Status: 1/2 tasks concluídas · a **virada** foi executada em 2026-09-08; a **desinstalação** não tem
data e está atrás do gate de 5 itens da §4 de `deploy/scripts/virada.md`.

Esta fatia é **operação, não construção**, e por isso não tem tabela de tasks com gates: o que a
compõe são as duas metades do próprio runbook. O detalhe medido da virada está no bullet dela no
`CLAUDE.md`, e o dos scripts em `deploy/scripts/virada/`.

## 2. Débitos Técnicos Não Resolvidos

### D1 · baixo · project_pattern · fechamento · intervenção dirigida (envio para fora do host)

- **Onde:** `deploy/scripts/backup/enviar-para-a-nuvem.sh` (junto de `RAIZ_DO_BACKUP_PADRAO`)
- **Problema:** as coordenadas do acervo local passaram a ter **três** declarações independentes —
  `RAIZ_DO_BACKUP_PADRAO` em `copiar-base.sh`, `preservar-segredos.sh` e agora
  `enviar-para-a-nuvem.sh` —, e `DESTINO_DA_CHAVE_PADRAO` tem **duas**, nos dois últimos. O
  **Limiar de Três** do `CLAUDE.md` disparou com a terceira, em 2026-09-08.
- **Impacto:** medido, e é assimétrico. Enquanto os três concordam, nada acontece; no dia em que a
  raiz do acervo mudar, quem alterar duas das três produz um estado em que a cópia é **escrita**
  num lugar e **enviada** de outro — e o envio sai `0`, porque a origem que ele lê existe e está
  vazia ou velha. É a mesma classe de falha silenciosa que custou os doze dias de backup quebrado:
  o comando termina bem e o artefato não está onde se pensa.
- **O que fazer:** subir as coordenadas para uma casa comum dos três — no molde de
  `deploy/scripts/verificacao/esqueleto-de-assercao.sh`, que já é carregado por `source` pelas
  baterias e é o precedente do repositório para exatamente isto (fecho do `D9 · F0/T2`). Os três
  scripts passam a lê-las de lá, e cada coordenada tem **uma** definição.
- **Prova exigida:** uma asserção que conte as declarações e afirme **1** por coordenada, com
  controle positivo que planta uma segunda e a vê reprovar. A rede de hoje é indireta: o `CT-1280`
  e o `CT-1289` exercitam o alvo com as coordenadas **injetadas por ambiente**, de modo que a
  divergência entre os três literais não é alcançada por nenhum caso.
- **Por que não agora:** pagá-lo edita os três scripts de backup no mesmo dia em que os dois
  primeiros foram corrigidos (a cópia e a restauração pelo superusuário) e o terceiro nasceu. A §5
  do Protocolo Antirregressão é literal quanto a isso — *"um bloqueante, uma mudança"* —, e um diff
  que mexa nos três ao mesmo tempo é o que reabre o que acabou de fechar.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada. A desinstalação **não** é bloqueio: ela está deliberadamente não
executada, com o gate de 5 itens satisfeito desde 2026-09-08 — é irreversível, e o legado hoje está
desativado e reversível em dois comandos.

## 4. Notas para Revisão Humana

- **A virada encontrou dois defeitos que não eram dela**, e os dois eram de produção: o backup nunca
  funcionara (doze dias, doze falhas) e a restauração estava quebrada pela mesma causa. Estão
  escriturados no bullet do marco de entrega no `CLAUDE.md`.
- **O envio para fora do host nasceu de uma pergunta do usuário**, não de spec: *"se queimar, terei
  tudo para restaurar?"*. A resposta medida era **não** — o acervo vivia só nesta máquina, a chave
  de cifra não saía dela, e o vhost do Painel Master não era versionado. Os três foram fechados na
  mesma sessão.
- **Uma decisão de segurança foi tomada pelo usuário com o custo apresentado**: a chave de cifra
  sobe para um prefixo próprio do **mesmo** destino do acervo. Satisfaz a letra da ADR-0032
  (pacotes distintos) e não o espírito (quem obtiver o destino obtém os dois). As alternativas
  oferecidas — guardá-la fora de qualquer nuvem, ou numa segunda conta — foram recusadas em favor
  de recuperação 100% automática. A razão está registrada no ponto do código.
