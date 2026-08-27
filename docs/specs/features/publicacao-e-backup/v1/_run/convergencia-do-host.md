# Convergência do host — `publicacao-e-backup/v1` · T6

> **Data da medição não privilegiada**: 2026-08-26, entre 05:44 e 05:57 · **Host**: `brutus` ·
> **Identidade**: `sysloc` · **Revisão do repositório**: `111448f4def9b090886ce91486f553e2c364e7fe`
> (`main`) · **Janela assistida**: **não houve** — `sudo -n` falha neste host
> (`sudo: a password is required`, medido nesta sessão).
>
> **O que este documento é.** O estado do supervisor de serviços **medido**, com o comando literal
> ao lado de cada valor, e o **roteiro da janela assistida** que ainda falta. Ele é a outra ponta da
> `linha-de-base.md` da T1: aquela mediu o repositório, esta mede o **host**.
>
> **⚠️ Ele registra uma divergência grande contra a §2 da própria task, e a divergência é a favor**
> — o host está muito mais convergido do que a task supunha. Ver a §1.
>
> **Conformidade com a ADR-0006.** Nenhuma medição deste documento executou contra o banco que
> atende a operação. Tudo o que está aqui saiu de `systemctl`, do `journalctl`, do `find` sobre
> `/etc/systemd/system` e do `environ` do processo do processador de trabalho — leituras, sem efeito.

---

## 1. 🔴 A premissa da §2 da task foi REFUTADA por medição

A §2 da T6 declara: *"o repositório entrega **6 timers** de rotina e o host tem **zero**; as **3
unidades** instaladas datam de **31/07 e 01/08**; e o processador de trabalho instalado **não
declara** dependência do banco"*. **Nenhuma das três metades se confirma.**

| Eixo | §2 da task declarava | **Medido em 2026-08-26** | Comando |
|---|---|---|---|
| Relógios de rotina habilitados | **zero** | **os 6**, habilitados, ativos e com próxima execução conhecida | `systemctl list-timers 'sysloc-*' --all --no-pager` |
| Unidades posicionadas | **3**, de 31/07 e 01/08 | **16** — 15 com `mtime` **idêntico**, `2026-08-25 16:25:19`, mais o capturador de 2026-07-31 | `find /etc/systemd/system -maxdepth 1 ! -type d -name 'sysloc-*' -printf '%f\t%TY-%Tm-%Td %TH:%TM:%TS\n' \| sort` |
| Dependência do banco no processador | **ausente** | **presente pelos dois eixos**, e o arquivo instalado é **byte a byte** o versionado | `cmp /etc/systemd/system/sysloc-worker.service deploy/systemd/sysloc-worker.service` · `systemctl show -p After -p Wants --value sysloc-worker.service` |

**A explicação está no `mtime`, e ela é única.** Os 15 arquivos têm o **mesmo segundo** de
modificação — `2026-08-25 16:25:19` —, que é **17 minutos depois** da janela assistida da T1
(`16:08:19`, registrada na `linha-de-base.md`). Posicionar unidade em `/etc/systemd/system` exige
privilégio, e nesta sessão o privilégio não existe. A conclusão que a evidência sustenta é que **o
operador executou `instalar-unidades.sh` naquela janela, fora do pipeline**.

```bash
# a agregação que produz a conclusão: 15 arquivos, UM instante
find /etc/systemd/system -maxdepth 1 ! -type d -name 'sysloc-*' \
  -printf '%TY-%Tm-%Td %TH:%TM:%TS\n' | cut -c1-19 | sort | uniq -c
#       1 2026-07-31 13:19:15     <- sysloc-mailpit.service (provisionamento da F0)
#      15 2026-08-25 16:25:19     <- o instalador, numa passada só
```

### 1.1 As três consequências, e nenhuma delas se redecide

1. **A ordem irreversível da §4 está MOOT.** A §4 manda (1) afirmar o destino do e-mail, (2)
   disparar uma passada controlada com os relógios **parados**, (3) só então habilitá-los. Os
   relógios foram habilitados em 2026-08-25 16:25:19 e as Rotinas correm há mais de **13 horas**. Não
   há mais "primeira passada com os relógios parados" a proteger — o que resta é **medir o efeito
   que já ocorreu**, e é o que a §3 abaixo faz.
2. **O achado §5.9 do `scope.md` MATERIALIZOU-SE.** `sysloc-rotina-aviso-de-cobranca` corre **a cada
   minuto** com desfecho `success`, e `sysloc-mailpit.service` está **ativo**, escutando em
   `127.0.0.1:1025`. **Nenhum e-mail alcançou destinatário real** — o destino é o laço local, e o
   `CT-1152` o afirma por host **e** porta —, mas toda Tentativa de envio que tenha havido registra
   `entregue`, porque o capturador aceita a mensagem.
3. **A lacuna que resta é pequena, e é só do backup.** Faltam **duas** unidades:
   `sysloc-backup-da-base.service` e `sysloc-backup-da-base.timer`, criadas pela **T4** em
   2026-08-25 23:38 e 2026-08-26 00:15 — isto é, **depois** da janela do operador. É por isso que
   elas não estão lá, e é por isso que a ausência delas é **pré-condição de janela** e não
   reprovação (ver §4).

---

## 2. O estado medido, unidade a unidade

**Apuração de referência, afirmada antes de qualquer comparação**: roster declarado pelo instalador
= **17**; posicionadas no host = **16**; exceção declarada = **1** (`sysloc-mailpit.service`).

```bash
# o roster NÃO é redigitado em lugar algum: ele é extraído do instalador
bash deploy/scripts/instalacao/verificar-unidades-agendadas.sh   # ver `array_do_instalador`
```

### 2.1 Os 6 relógios de rotina — todos habilitados, todos com próxima execução futura

```bash
systemctl list-timers 'sysloc-*' --all --no-pager
```

| Relógio | `is-enabled` | `is-active` / `SubState` | Próxima execução (medida às 05:45) |
|---|---|---|---|
| `sysloc-rotina-aviso-de-cobranca.timer` | `enabled` | `active` / `waiting` | 2026-08-26 05:46:00 |
| `sysloc-rotina-retomada-de-noticias.timer` | `enabled` | `active` / `waiting` | 2026-08-26 05:50:00 |
| `sysloc-rotina-vigilancia-das-rotinas.timer` | `enabled` | `active` / `waiting` | 2026-08-26 06:00:00 |
| `sysloc-rotina-encerramento-de-contratos.timer` | `enabled` | `active` / `waiting` | 2026-08-27 00:02:00 |
| `sysloc-rotina-conferencia-de-liquidacao.timer` | `enabled` | `active` / `waiting` | 2026-08-27 03:00:00 |
| `sysloc-rotina-manutencao.timer` | `enabled` | `active` / `waiting` | 2026-08-27 03:30:00 |

**`sysloc-backup-da-base.timer` não está na tabela porque não está no host.** É a 7ª entrada do
roster de relógios, e a única por posicionar.

### 2.2 Nenhum despacho habilitado — o `oneshot` não corre no boot

```bash
for u in $(systemctl list-unit-files 'sysloc-rotina-*.service' --no-legend | awk '{print $1}'); do
  printf '%-50s %s\n' "$u" "$(systemctl is-enabled "$u")"
done
```

Os **6** despachos de rotina e a unidade-modelo `sysloc-alerta-de-rotina@.service` devolvem
`static`, e a interseção com as unidades habilitadas do host é **vazia**. É o que o `CT-1149` afirma.

⚠️ **`is-active` não é consultado na unidade-modelo**: `sysloc-alerta-de-rotina@.service` não tem
instância própria e o supervisor recusa a pergunta (`Unit name … is neither a valid invocation ID nor
unit name`). `is-enabled` responde, e é a leitura correta para ela.

### 2.3 Os 2 permanentes

| Unidade | `is-enabled` | `is-active` / `SubState` |
|---|---|---|
| `sysloc-api.service` | `enabled` | `active` / `running` |
| `sysloc-worker.service` | `enabled` | `active` / `running` |

### 2.4 A dependência do banco — presente pelos dois eixos

```bash
cmp /etc/systemd/system/sysloc-worker.service deploy/systemd/sysloc-worker.service   # sai 0
grep -nE '^(After|Wants)=' /etc/systemd/system/sysloc-worker.service
#   103:After=network.target postgresql.service redis-server@sysloc.service
#   104:Wants=postgresql.service redis-server@sysloc.service
systemctl show -p After  --value sysloc-worker.service | tr ' ' '\n' | grep -x postgresql.service
systemctl show -p Wants  --value sysloc-worker.service | tr ' ' '\n' | grep -x postgresql.service
```

O texto instalado declara as duas diretivas, **e** o supervisor as carregou em memória — o que prova
que o `daemon-reload` correu. Os dois eixos são afirmados em separado pelo `CT-1150`.

### 2.5 O destino do e-mail

```bash
pid=$(systemctl show -p MainPID --value sysloc-worker.service)
tr '\0' '\n' < /proc/$pid/environ | sed -n 's/^SMTP_URL=//p'     # NÃO ecoar em relatório
```

**Medido**: `host=127.0.0.1 porta=1025` — laço local, porta do capturador. `sysloc-mailpit.service`
está `active` e escuta em `127.0.0.1:1025` (`ss -ltn | grep 1025`).

⚠️ **O valor sai do `environ` do PROCESSO em execução, e não de `/etc/sysloc/backend.env`.** São
coisas diferentes — o arquivo descreve a **próxima partida** — e só o primeiro é legível sem
privilégio. A §5.6 da task proíbe afrouxar o modo `0600 root:root` do arquivo, copiá-lo para local
legível ou criar caminho no produto que devolva o valor: nenhuma dessas coisas foi feita.

### 2.6 Nenhuma unidade em falha, nenhum relógio habilitado porém morto

```bash
systemctl list-units --state=failed --no-legend --no-pager 'sysloc-*'   # nenhuma linha
```

---

## 3. O efeito das passadas — a **Dúvida 4** da T1 tem valor medido

> Esta seção é o gatilho do **`D1 · médio · documentation · T1 · QA`**
> (`_run/run-report.md` §2): *"assim que o `CT-1152` (T6) afirmar o destino do e-mail, executar … e
> substituir `PENDENTE-T6` pelo valor na forma declarada"*. O `CT-1152` afirma o destino, e o valor
> está abaixo.

**Valor, na forma que a `linha-de-base.md` §4 exige**: **`produziu efeito`**, com as contagens
abaixo.

⚠️ **A `linha-de-base.md` declara os dois comandos com `sudo`, e o `sudo` é dispensável para o
segundo** — medido nesta sessão: `journalctl -u 'sysloc-rotina-*'` responde à identidade `sysloc`
sem privilégio. A premissa de que a leitura exigia root **caiu por medição**, e é por isso que este
valor existe sem janela.

```bash
# a leitura, sem privilégio, desde o instante da instalação
for u in aviso-de-cobranca conferencia-de-liquidacao encerramento-de-contratos \
         manutencao retomada-de-noticias vigilancia-das-rotinas; do
  printf '%-32s concluidas=%s falhas=%s\n' "$u" \
    "$(journalctl -u "sysloc-rotina-$u.service" --since '2026-08-25 16:25:19' --no-pager | grep -c 'Finished')" \
    "$(journalctl -u "sysloc-rotina-$u.service" --since '2026-08-25 16:25:19' --no-pager | grep -c 'Failed\|failed with result')"
done
```

| Rotina | Passadas concluídas | Falhas | `Result` da última | `ExecMainStatus` |
|---|---|---|---|---|
| `aviso-de-cobranca` | **801** | 0 | `success` | `0` |
| `retomada-de-noticias` | **80** | 0 | `success` | `0` |
| `vigilancia-das-rotinas` | **54** | 0 | `success` | `0` |
| `conferencia-de-liquidacao` | **1** | 0 | `success` | `0` |
| `encerramento-de-contratos` | **1** | 0 | `success` | `0` |
| `manutencao` | **1** | 0 | `success` | `0` |

**Leitura**: **938 passadas** em ~13 h 30 min, **zero** falhas. O `aviso-de-cobranca` corre a cada
minuto — é a cadência declarada no `.timer` versionado, não anomalia.

⚠️ **O que este número NÃO diz.** Ele é o desfecho do **processo**, e não a contagem de Avisos
efetivamente emitidos: essa é a metade do **`CT-1153`**, que compara as Tentativas de envio gravadas
com desfecho `entregue` contra as mensagens que entraram no capturador. Ler as Tentativas exige o
**banco durável**, que a ADR-0006 mantém fora da suíte automatizada, e por isso o `CT-1153` **não
vira bateria** — ele é conduzido na janela (§4, item 3). **Enquanto ele não correr, a igualdade
`entregues == capturadas` não está afirmada.**

⚠️ **A substituição do `PENDENTE-T6` em `linha-de-base.md:349` NÃO foi feita aqui**: aquele arquivo
é artefato da **T1** e está fora da §3.1/§3.2 desta task. O valor está acima, na forma exigida, e a
substituição é do fecho do `D1`. **A T11 (P5) confere que ela aconteceu.**

---

## 4. Roteiro da janela assistida — o que ainda falta, com o comando literal

**Nada abaixo foi executado.** `sudo -n` falha neste host, e o pipeline **não cria caminho
degradado**: o privilégio é a pré-condição, não o obstáculo. São **4 marcas `PENDENTE-JANELA`**.

### PENDENTE-JANELA 1 · posicionar as 2 unidades do backup

Espera: `sysloc-backup-da-base.service` e `sysloc-backup-da-base.timer` no supervisor.
É a frente `[instalacao-em-dia]` da bateria, que hoje degrada com **2** linhas nomeando exatamente
essas duas unidades.

```bash
sudo bash /opt/sysloc-backend/deploy/scripts/instalacao/instalar-unidades.sh
```

⚠️ O instalador é **idempotente por contrato** (`CT-001`/`CT-007` de `verificar-fundacao.sh`) — ele
reposiciona as 15 já presentes sem efeito colateral, e só acrescenta as 2 que faltam.

### PENDENTE-JANELA 2 · conferir o conjunto completo — 8 relógios? não: 7 relógios e 2 permanentes

Depois do item 1, o roster fica **inteiro** e a frente `[instalacao-em-dia]` deixa de degradar. A
conferência é a **própria bateria**, e ela **não** exige privilégio:

```bash
bash /opt/sysloc-backend/deploy/scripts/instalacao/verificar-unidades-agendadas.sh
# esperado depois do item 1: 8/8 casos aprovados, e a única degradação restante
# é [boot-posterior-a-instalacao] — código de saída 2
```

E as leituras diretas, para o registro do operador:

```bash
sudo systemctl list-timers 'sysloc-*' --all --no-pager
sudo systemctl is-enabled sysloc-backup-da-base.timer      # esperado: enabled
sudo systemctl is-enabled sysloc-backup-da-base.service    # esperado: static
sudo systemctl show -p NextElapseUSecRealtime --value sysloc-backup-da-base.timer
```

### PENDENTE-JANELA 3 · fechar o `CT-1153` — as duas contagens, medidas no mesmo intervalo

Espera: a igualdade `Tentativas com desfecho entregue == mensagens no capturador`, no intervalo
declarado. É a única asserção da task que toca o **banco durável**, e por isso **não** virou bateria
(§5.6 da T6). ⚠️ **NUNCA** semear destinatário de teste na base durável, e **NUNCA** alterar
`SMTP_URL` "para medir com segurança" — as duas mudam o objeto sob prova.

```bash
# (a) o carimbo de partida e a contagem do capturador ANTES
INICIO="$(date --iso-8601=seconds)"
curl -sS 'http://127.0.0.1:8025/api/v1/messages?limit=1' | head -c 400   # total do capturador

# (b) a janela de observação — os relógios JÁ estão de pé; não é preciso disparar nada
sleep 300

# (c) a contagem do capturador DEPOIS
curl -sS 'http://127.0.0.1:8025/api/v1/messages?limit=1' | head -c 400

# (d) as Tentativas gravadas no intervalo, do banco durável
sudo -u postgres psql -d sysloc -Atc \
  "SELECT count(*) FROM negocio.tentativa_de_envio
    WHERE desfecho = 'entregue' AND criado_em >= '${INICIO}'::timestamptz;"
```

Reprova com `entregues=<n> capturadas=<m>` e, por Tentativa órfã, o identificador e o destinatário
**redigido ao domínio**. **Zero em ambos também aprova**, e nesse caso o registro declara
`não produziu efeito`.

### PENDENTE-JANELA 4 · provar a sobrevivência a reinício (invariante 7)

Espera: o último arranque do servidor ser **posterior** à instalação das unidades. Hoje ele é
**anterior** — boot em `2026-08-21 21:05:10`, instalação em `2026-08-25 16:25:19` —, e é por isso que
a frente `[boot-posterior-a-instalacao]` degrada com 1 linha.

```bash
stat -c '%y' /proc/1                       # o instante do arranque, sem privilégio
sudo systemctl reboot
# depois do arranque, e sem privilégio:
bash /opt/sysloc-backend/deploy/scripts/instalacao/verificar-unidades-agendadas.sh
# esperado: 8/8 casos aprovados, ZERO degradação, código de saída 0
```

⚠️ **Ele imita o `CT-006` de `verificar-fundacao.sh`**, que já define o protocolo da janela de
reinício deste repositório. Reiniciar derruba a API e o processador de trabalho por alguns segundos —
é ato de janela, com o operador presente.

---

## 5. A bateria que ficou pronta, e o que ela mede sem privilégio

`deploy/scripts/instalacao/verificar-unidades-agendadas.sh` — **8 casos**, `CT-1146` a `CT-1152` e
`CT-1154`. Executada em 2026-08-26 às 08:17, **já com a correção do `TR-P1`** (rodada 2): **8/8 casos sem
falha**, **106 asserções OK**, **3 degradações**, **código de saída 2**. ⚠️ **A medição da rodada 1
dizia 101, e ela está vencida** — as 5 asserções novas são as 4 pernas de falsificação do
discriminador do transitório mais a que preserva o `0` do vazio genuíno, todas no `CT-1148`. **Não a
reponha**; os demais números do parágrafo (8 casos, 3 degradações, código 2) não se moveram.

```bash
bash /opt/sysloc-backend/deploy/scripts/instalacao/verificar-unidades-agendadas.sh; echo "CODIGO=$?"
```

| Frente que este host não permite medir | Linhas de degradação | O que espera |
|---|---|---|
| `[instalacao-em-dia]` | **2** — uma por unidade do backup | PENDENTE-JANELA 1 |
| `[boot-posterior-a-instalacao]` | **1** | PENDENTE-JANELA 4 |
| `[ambiente-do-processador]` | **0** — disponível neste host | — |

⚠️ **Ela NÃO declara exigência de privilégio**, e isso é deliberado:
`deploy/scripts/verificacao/rodar-baterias.sh` classifica a identidade de execução pelo padrão
`exigir_privilegio|EUID.*-ne 0` no fonte, e uma bateria que o declarasse seria lançada como **root** —
onde o `mise` não está no caminho e o `environ` do processador pertence a outro usuário. Ela
**recusa** o superusuário, em vez de exigi-lo.

⚠️ **Ela entrou nas três constantes de superfície de `deploy/scripts/backup/verificar-backup.sh` no
mesmo diff** — `BATERIAS_DECLARADAS`, `CASOS_DECLARADOS_POR_BATERIA` e `CASOS_DECLARADOS_NO_TOTAL`
(87 → 95). Sem isso o `CT-1119` reprova por igualdade de conjunto violada (12 declaradas × 13
descobertas), que é **exatamente o mecanismo que ele existe para exercer**: bateria nova não tem como
nascer invisível ao agregador.
