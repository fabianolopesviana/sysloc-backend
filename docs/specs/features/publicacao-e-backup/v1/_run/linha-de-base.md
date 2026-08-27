# Linha de base — `publicacao-e-backup/v1` · T1

> **Data da medição não privilegiada**: 2026-08-25 · **Host**: `brutus` · **Identidade**: `sysloc`
> **Data da janela assistida (metade privilegiada)**: 2026-08-25, às **16:08:19**, conduzida pelo
> operador · **Revisão do repositório**: `111448f4def9b090886ce91486f553e2c364e7fe` (`main`)
>
> **O que este documento é.** É o P1 do Protocolo Antirregressão (`.claude/rules/nao-regressao.md`)
> materializado: o estado medido **antes da primeira edição** desta fatia, contra o qual a **T11**
> compara caso a caso no P5. Sem ele o run perde a capacidade de distinguir *"já estava vermelho"*
> de *"eu quebrei"* — e é essa confusão que faz um agente "consertar" um teste alheio que estava
> certo.
>
> **Por que ele nasce em duas passadas.** `sudo -n` falha neste host (medido nesta mesma sessão:
> `sudo: a password is required`), e `deploy/scripts/verificacao/rodar-baterias.sh` recusa
> `EUID != 0` na linha 74 com `exit 1`. Não há caminho degradado, e **não se cria um**: o privilégio
> é a pré-condição, não o obstáculo. A metade privilegiada foi conduzida pelo operador na janela
> assistida de **2026-08-25, às 16:08:19**, e está **fundida neste documento** — nenhum valor deste
> registro segue esperando privilégio. O único ainda descoberto é a **Dúvida 4**, marcada
> `PENDENTE-T6`, e a razão dela **não é privilégio: é ordem de segurança** (§4).
>
> **Conformidade com a ADR-0006.** Nenhuma medição desta passada executou contra o ambiente que
> atende a operação. As nove suítes sobem instância efêmera própria (`embedded-postgres`); as
> leituras sobre `/opt/frappe` e `/opt/backups/frappe` são **somente de leitura** e nenhuma tocou o
> site `frontend`, que é produção.

---

## 1. As 11 baterias de verificação de shell

**Apuração de referência, afirmada antes de qualquer comparação: `11`.**

```bash
find deploy/scripts -name 'verificar-*.sh' | sort        # 11 linhas, medido em 2026-08-25
```

⚠️ **O comando da janela é o do bloco abaixo, e ele NÃO é o da §4 da task.** A §4 escreve
`sudo bash deploy/scripts/verificacao/rodar-baterias.sh`, sem argumento — e as linhas **115 a 117**
do script filtram `verificar-fundacao.sh` fora do conjunto quando `--com-agregador` está ausente.
Sem o argumento rodariam **10**, e o `find` acima descobre **11**, que é o conjunto contra o qual o
`CT-1140` afirma igualdade. A forma correta é:

```bash
sudo bash deploy/scripts/verificacao/rodar-baterias.sh --com-agregador
```

**Executado em 2026-08-25, às 16:08:19**, pelo operador, na janela assistida. Cabeçalho literal do
agregador: `repositório: /opt/sysloc-backend (dono: sysloc)` · `baterias: 11`.

| # | Bateria | Como | Veredito | OK | FALHA | Avisos | Duração |
|---|---------|------|----------|----|----|----|----|
| 1 | `verificar-notificacao-bancaria` | `sysloc` | `APROVADA` | 148 | 0 | 0 | 6 s |
| 2 | `verificar-captura` | `sysloc` | `PRE-CONDICAO` | 0 | 0 | 0 | 1 s |
| 3 | `verificar-golden` | `sysloc` | `APROVADA` | 114 | 0 | 0 | 9 s |
| 4 | `verificar-guarda-de-boletos` | `sysloc` | `APROVADA` | 13 | 0 | 0 | 0 s |
| 5 | `verificar-preparacao-do-material` | `sysloc` | `APROVADA` | 11 | 0 | 0 | 9 s |
| 6 | `verificar-isolamento-de-verificacao` | `sysloc` | `APROVADA` | 38 | 0 | 0 | 401 s |
| 7 | `verificar-apuracao-versao` | `sysloc` | `APROVADA` | 83 | 0 | 0 | 12 s |
| 8 | `verificar-fundacao` | **root** | `APROVADA` | 88 | 0 | 0 | 759 s |
| 9 | `verificar-migracao` | **root** | `APROVADA` | 118 | 0 | 0 | 109 s |
| 10 | `verificar-provisionamento` | **root** | `APROVADA` | 185 | 0 | 0 | 39 s |
| 11 | `verificar-workspace` | `sysloc` | `APROVADA` | 71 | 0 | 0 | 409 s |

**Resumo literal do agregador**:

```
RESUMO — 11 bateria(s): 0 com problema, 1 com pré-condição de ambiente ausente
```

**Enum de veredito que o agregador emite** (linhas **186 a 190** do script), e ao qual cada célula
da coluna Veredito pertence: `APROVADA` · `REPROVADA` · `SAUDE-DA-SUITE` · `PRE-CONDICAO`. Os dois
valores que de fato ocorreram — `APROVADA` (10 vezes) e `PRE-CONDICAO` (1 vez) — estão dentro dele.

⚠️ **`verificar-captura` saiu como `PRE-CONDICAO`, e `PRE-CONDICAO` NÃO É REPROVAÇÃO.** Última linha
literal do diário dela:

```
ERRO: o site caracterizacao.localhost precisa estar de pé. Rode "preparar-site-efemero.sh criar"
```

O site efêmero do legado **não foi levantado de propósito**: levantá-lo é operação no ambiente
Frappe, que segue de pé e é produção, e a decisão do operador foi não fazê-lo. Ela executou `0`
asserções — abortou antes de provar o que quer que fosse —, que é exatamente o discriminador
conservador do agregador para separar pré-condição de defeito. **Contá-la como vermelho prévio faz o
P5 da T11 dar falso negativo**, e é por isso que ela está nomeada aqui e **não** na §3.

⚠️ **O achado `A8` NÃO se materializou, e continua registrado como risco latente.** Nenhuma bateria
devolveu `ESTOUROU` (código `124`): a maior duração observada foi **759 s** (`verificar-fundacao`),
contra o limite de `1800` s — **folga de 1041 s**, que é o que dimensiona o risco. O conjunto inteiro
levou **1754 s** (cerca de 29 minutos), somando as 11 durações. A qualificação vive na §5, `A8`.

**Diários da janela**: **`/var/tmp/sysloc-baterias-20260825-160819`** — os **11** `.log` existem, um
por bateria, dono `root`, modo `644`. Sem eles o `CT-1141` não tem par de veredito e diário para
auditar, e eles **não são versionados**.

⚠️ **Por que os diários NÃO foram copiados para dentro deste `_run/`, e qual é o gatilho para
copiá-los.** A §6 da task manda copiá-los *"se a janela ficar distante da revisão"*, e ela não está:
a janela e esta revisão são do **mesmo dia**. A cópia seria viável sem privilégio — o modo é `644`,
legível pelo dono do repositório —, e não foi feita por duas razões medidas: (i) nenhuma regra de
expurgo por idade alcança o diretório neste host (a linha `q /var/tmp … 30d` está **comentada** em
`/usr/lib/tmpfiles.d/tmp.conf`, linha 12, e não há sobreposição em `/etc/tmpfiles.d/`, conferido por
`systemd-tmpfiles --cat-config`), e `/var/tmp` sobrevive a reinício; (ii) versionar 11 diários
acrescentaria arquivos que a §3.1 desta task não declara. **Gatilho para copiar**: a revisão do
Gate 1 acontecer em data diferente da janela, ou o diretório deixar de existir. O comando é
`cp -a /var/tmp/sysloc-baterias-20260825-160819 docs/specs/features/publicacao-e-backup/v1/_run/`.

### 1.1 Quantas baterias exigem privilégio — as três fontes, medidas e reconciliadas

**Valor fixado: `3` de `11` pelo discriminador executável, e `5` de `11` pelo predicado material.**
São dois predicados distintos, e as três fontes divergentes medem coisas diferentes.

```bash
# predicado (a) — o discriminador do agregador, linha 91 de rodar-baterias.sh
find deploy/scripts -name 'verificar-*.sh' | sort | while read -r f; do
  grep -qE 'exigir_privilegio|EUID.*-ne 0' "$f" && echo "PRIVILEGIO $f" || echo "sem-priv   $f"
done
# medido em 2026-08-25: 3 com PRIVILEGIO (fundacao, migracao, provisionamento), 8 sem
```

```bash
# predicado (b) — a bateria toca privilégio por algum eixo material
find deploy/scripts -name 'verificar-*.sh' | sort | while read -r f; do
  grep -qE '(^|[^a-z])sudo |systemctl|runuser|/etc/sysloc|/etc/systemd|/root/' "$f" &&
    echo "TOCA-PRIVILEGIO $f"
done
# medido em 2026-08-25: 5 — as 3 acima MAIS verificar-guarda-de-boletos e verificar-apuracao-versao
```

| Fonte | O que ela diz | O que ela mede de fato | Veredito |
|---|---|---|---|
| `rodar-baterias.sh` linha 75 | *"três baterias exigem privilégio"* | predicado (a) — recusa executar como não-root | **correto** para o que ele faz: `3` |
| Insumo do pré-refinamento, linha 42 | *"8 dos 11 verificadores exigem privilégio administrativo"* | **transplante de universo** — o `8` vem do marcador do `D9`, onde o universo é **10 cópias do esqueleto**, não 11 verificadores | **incorreto**: colou um numerador de um universo em outro |
| `CLAUDE.md`, linha do `D9` | *"são 10 cópias do esqueleto e elas são 10 formas distintas; só 2 rodam sem privilégio"* | paráfrase fiel do marcador em `verificar-provisionamento.sh` (linhas 247 a 251), que nomeia `verificar-workspace.sh` e `verificar-golden.sh` como os 2 | **defasado em duas pontas**: o universo virou **11** (nasceu `verificar-preparacao-do-material.sh`) e o *"só 2 sem privilégio"* é refutado — **6 dos 11** não tocam privilégio por eixo algum |

```bash
# o universo do D9 e o universo dos verificadores COINCIDEM hoje, e são 11 — não 10
grep -rl 'afirmar_igual' deploy/scripts --include='verificar-*.sh' | wc -l   # 11
```

⚠️ **Consequência para o dimensionamento do fecho do `D9 · F0/T2`** (que esta fatia dispara): a
conversão precisa de baseline para **11** dialetos, não 10, e o obstáculo real de baseline alcança
**5** deles (predicado b), não 8. O `scope.md` §5.4 já mede as 11 cópias e está correto; o
`CLAUDE.md` é a cópia defasada. **Nada se "corrige" no `CLAUDE.md` por esta task** — a correção do
índice não está na §3.2 desta task.

---

## 2. Os 9 pacotes, medidos um a um

**Comando, pacote a pacote** — cada um pelo script `test` do próprio pacote, em **série**, com
instância efêmera própria:

```bash
pnpm --filter @sysloc/contracts test
pnpm --filter @sysloc/api test
pnpm --filter @sysloc/shared test
pnpm --filter @sysloc/db test
pnpm --filter @sysloc/worker test
pnpm --filter @sysloc/documentos test
pnpm --filter @sysloc/auth test
pnpm --filter @sysloc/cobranca-bancaria test
pnpm --filter @sysloc/regua test
```

⚠️ **Origem da contagem: o script `test` de cada pacote, isolado.** O agregador do monorepo **não**
foi usado, e não pode ser: ele aborta os pacotes irmãos e a saída agregada não é confiável.

| Pacote | Arquivos | Contagem | Segundos | Veredito |
|--------|----------|----------|----------|----------|
| `contracts` | 2 | **438** | 10 | verde |
| `api` | 43 | **394** | 138 | verde |
| `shared` | 11 | **271** | 39 | verde |
| `db` | 36 | **268** | 73 | verde |
| `worker` | 11 | **180** | 89 | verde |
| `documentos` | 7 | **159** | 12 | verde |
| `auth` | 11 | **89** | 37 | verde |
| `cobranca-bancaria` | 9 | **114** | 85 | verde |
| `regua` | 4 | **30** | 6 | verde |

**Soma conferida**: `438 + 394 + 271 + 268 + 180 + 159 + 89 + 114 + 30` = **1943**.
**Total medido**: **1943**. Os dois números são iguais.

**Casos pulados, marcados como pendentes ou em quarentena: `0`** — nenhuma ocorrência de `skipped`
nem de `todo` em nenhum dos nove diários.

**Diários preservados**: `/var/tmp/sysloc-linha-de-base-20260825-155306/` — um `.log` por pacote,
mais `vereditos.txt` com o código de saída e a duração de cada um. Os nove códigos de saída são `0`.

### 2.1 Divergência entre o `CLAUDE.md` e a suíte — medida, e ela é NULA

O `CLAUDE.md` afirma **1943 casos em 9 pacotes**, com a distribuição
`contracts 438 · api 394 · shared 271 · db 268 · worker 180 · documentos 159 · auth 89 ·
cobranca-bancaria 114 · regua 30`.

**A medição de 2026-08-25 bate com o texto pacote a pacote, e no total.** A suíte é a fonte e o
texto é a cópia; hoje eles coincidem, e **nada há a corrigir**. O registro fica porque a T11 vai
comparar contra estes números, e porque a ausência de divergência é um resultado, não um silêncio.

### 2.2 ⚠️ Os dois eixos de prova NÃO se somam — leia isto antes do P5 da T11

A soma dos `OK` das 11 baterias de shell da §1 é **869 asserções**. A contagem da suíte automatizada
é **1943 casos**. **Os dois números medem coisas distintas e nunca devem ser somados, comparados
entre si, nem substituídos um pelo outro**:

| Eixo | Unidade | Total hoje | O que ele alcança |
|---|---|---|---|
| Suíte automatizada (Vitest) | **caso** | **1943** | o código do produto, contra instância efêmera própria |
| Baterias de shell | **asserção** (`OK`) | **869** | o **estado do host** — unidades, borda, migração aplicada, ambiente |

O P5 da T11 compara **cada eixo com ele mesmo**: `1943` contra a contagem da suíte no fim, e o quadro
por bateria da §1 contra o quadro por bateria do fim. Fundir os dois produziria um total que não é
linha de base de coisa alguma. A razão de existirem os dois está medida: **6 Rotinas agendadas
ausentes do servidor passaram despercebidas por 1943 casos verdes** — a suíte não alcança o host.

---

## 3. Já vermelho antes da primeira edição

**nenhum**

O veredito é **`nenhum`** nos **dois** eixos de prova, e cada um foi medido por execução:

1. **Suíte automatizada** — os nove pacotes saíram verdes, com código de saída `0`, `0` casos
   pulados e `0` marcados como pendentes (§2).
2. **Baterias de shell** — as 11 executaram na janela assistida e o agregador fechou em
   `0 com problema` (§1): dez `APROVADA` e `0` `FALHA` somando todas, contra **869** asserções
   executadas.

⚠️ **A `verificar-captura` NÃO é vermelho — é `PRE-CONDICAO`, e está declarada como tal.** Ela não
rodou porque o site efêmero do legado não estava de pé, por decisão do operador (§1); executou `0`
asserções e não reprovou nada. O agregador a contabiliza em campo próprio
(`1 com pré-condição de ambiente ausente`), e é essa distinção que a §6 da task manda registrar
explicitamente: **contá-la como vermelho prévio faz o P5 da T11 dar falso negativo**, porque no fim
do run ela sairá `PRE-CONDICAO` de novo e a comparação acusaria um vermelho que nunca existiu.

⚠️ **A ausência de vermelho não é a ausência de risco.** Foi de baterias verdes por falta de
execução que vieram os dois defeitos silenciosos de 2026-08-23 — o `CT-647` quebrado havia três
fatias e o banco durável cinco migrações atrás do repositório, nenhum dos dois registrado como
débito. **Bateria que ninguém executa não é rede: é a aparência de uma.** O que sustenta o `nenhum`
acima é que, desta vez, as 11 **foram executadas**.

---

## 4. As quatro dúvidas em aberto do discovery

**Apuração afirmada antes de qualquer leitura: `4` dúvidas.** Três estão **medidas com valor
concreto e o comando literal que o produziu**; a quarta é `PENDENTE-T6` por **ordem de segurança**,
nunca por adiamento — a razão está escrita nela e o comando que a resolve está ao lado.

### Dúvida 1 — coexistência com a preservação já existente do sistema antigo

- **Horário da janela do legado**: `02:30`
- **Destino do legado**: `/opt/backups/frappe/daily`
- **Horário da janela planejada para o backend novo**: `02:30` (`plano-execucao.md` §F7, linha 560)
- **Destino planejado para o backend novo**: `/opt/backups/sysloc/daily/` (idem, linha 557)
- **Veredito**: `mesma janela` · `destino irmão`
- **Retenção praticada pelo legado**: `14` dias
- **Duração medida da janela do legado**: de `02:30:01` a `02:30:44` — entre 36 e 43 segundos, em
  cinco execuções consecutivas
- **Entradas hoje em `/opt/backups/frappe/daily`**: `17` — **16** diretórios de data
  (`2026-08-10` a `2026-08-25`, um por dia, sem furo) mais o vínculo simbólico `latest`

```bash
ls -la /opt/backups/frappe/daily                                   # 16 datas + latest
stat -c '%y %n' /opt/backups/frappe/daily/2026-08-25_02-30-01       # 02:30:38
tail -25 /var/log/frappe-backup.log                                 # 02:30:01 -> 02:30:44, "retencao de 14 dias"
grep -nE 'BACKUP_ROOT|RETENTION_DAYS|-mtime' /usr/local/bin/backup_frappe.sh
grep -rn 'backup_frappe.sh' /opt/frappe/reference/runbook_frappe.md
```

- **Mecanismo disparador**: **entrada na `crontab` do root** — medido na janela assistida, saída
  literal de **linha única**:

```bash
sudo crontab -l | grep -i backup
# 30 2 * * * /usr/local/bin/backup_frappe.sh >> /var/log/frappe-backup.log 2>&1
```

  **Não é timer do systemd e não é `/etc/cron.d`** — e é exatamente por isso que nenhuma leitura sem
  privilégio a encontrava: `systemctl list-timers --all` não lista unidade de backup alguma, e
  `/etc/cron.d/clp` só carrega tarefas do painel de hospedagem, cuja única entrada de backup é
  `15 3` com retenção de `7` dias, que não é esta. A evidência legível sem privilégio já convergia
  para a mesma linha — o runbook do legado (linha 44) e o `contexto_backend.md` (linha 192) a
  registram byte a byte —, e a janela **confirmou por execução** em vez de presumir.

- ⚠️ **Contenção medida, e ela deixou de ser hipótese**: os dois trabalhos partem do **mesmo minuto**
  (`02:30`), no **mesmo volume**, com **destinos irmãos** sob `/opt/backups`. O legado ocupa cerca de
  40 segundos de disco a partir de `02:30:01`. Registrado como achado **`A9`** na §5, com a
  consequência nomeada para a **T4** — e cruzado com o **`A7`**, que é a mesma vizinhança medida pelo
  outro eixo. **A decisão do horário não é desta task**; ela pertence a quem escreve o relógio.

### Dúvida 2 — retenção em dias

- **Valor adotado**: `14` dias
- **Ocupação do disco medida hoje**: `20%` — `24G` usados de `128G`, com `99G` livres

```bash
df -h /                                                      # 128G, 24G usados, 99G livres, 20%
grep -n 'RETENTION_DAYS' /usr/local/bin/backup_frappe.sh /opt/frappe/backup-offsite-upload.sh
```

⚠️ **A premissa do insumo — *"disco em 79%"* — está REFUTADA por medição: são `20%`.** Não há
urgência de espaço, e por isso a retenção é decisão de projeto, não de capacidade.

**Razão da escolha, e a alternativa descartada.** `14` é a retenção que já opera neste host em
**dois** pontos independentes: a cópia local do legado (`RETENTION_DAYS=14` em
`/usr/local/bin/backup_frappe.sh`, com `find -mtime +14`) e o envio para fora do host
(`RETENTION_DAYS=14` em `/opt/frappe/backup-offsite-upload.sh`). Adotar o mesmo número deixa **um
único valor de retenção na cabeça do operador**, em vez de dois regimes convivendo no mesmo
diretório-pai durante a virada. A alternativa considerada foi uma retenção mais curta (`7` dias, que
é a do painel de hospedagem): descartada porque o ganho é de espaço, e espaço é justamente o recurso
que a medição mostra abundante — enquanto o custo é encurtar a janela de recuperação logo na fase em
que os dados do cliente começam a nascer.

### Dúvida 3 — o caminho antigo de consulta ao legado sai ou fica

- **Caminho absoluto**: `/opt/react/sysloc` — `html/` (o material publicado) e `nginx/default.conf`,
  os dois montados no container `sysloc-react-1` (imagem `nginx:1.27-alpine`, porta `8300`)
- **Estado hoje**: em execução, e é **ele** que o endereço público do Sysloc serve
- **Veredito**: **fica** nesta fatia

```bash
docker inspect sysloc-react-1 --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
curl -s http://127.0.0.1:8300/ | md5sum                      # 07251c2ed1ea3e7c3a5cd5782c2b8742
curl -s https://sysloc.systera.com.br/ | md5sum              # 07251c2ed1ea3e7c3a5cd5782c2b8742 — o MESMO material
curl -s https://syslocadmin.systera.com.br/ | md5sum         # a7cbd1bd3f99... — o Painel Master, outro material
```

**Por que fica**: o `scope.md` §2 põe a retirada **fora do escopo**, com a razão registrada — *"decisão
de topologia ainda não tomada"* —, e a §2 dele também deixa fora, como consequência e não como
decisão desta fatia, o fechamento da credencial legível. Esta task **mede**, não decide topologia.

⚠️ **Exposição herdada, medida e que permanece aberta enquanto o caminho existir**: o material
publicado na `8300` carrega **duas** chaves de API do ERPNext embutidas em texto claro
(`REACT_APP_ERPNEXT_API_KEY` e `REACT_APP_ERPNEXT_API_SECRET`), montadas pelo próprio material no
cabeçalho `Authorization: token <chave>:<segredo>`. O comando abaixo **conta** as chaves sem ecoar
valor algum — é assim que ele deve ser reexecutado:

```bash
grep -oE 'REACT_APP_ERPNEXT_API_(KEY|SECRET)' \
  /opt/react/sysloc/html/static/js/main.7154a9e7.js | sort -u | wc -l    # 2
```

⚠️ **Consequência para a religação da borda**: hoje `sysloc.systera.com.br` devolve, byte a byte, o
material da `8300`. A borda nova do Sysloc muda **quem** aquele endereço serve, e isso interage com
a decisão de topologia acima — o registro fica aqui para que a task da borda não a redescubra.

### Dúvida 4 — efeito da primeira passada das Rotinas agendadas sobre dados existentes

- **Valor**: **`produziu efeito`** — 938 passadas em ~13h30, **zero falhas**. Por rotina: `aviso-de-cobranca` 801, `retomada-de-noticias` 80, `vigilancia-das-rotinas` 54, `conferencia-de-liquidacao` 1, `encerramento-de-contratos` 1, `manutencao` 1.
- **Medido em**: 2026-08-26, na T6, com `journalctl -u 'sysloc-rotina-*' --since '-14h' --no-pager`. ⚠️ **SEM `sudo`** — a premissa que prendia esta medição à janela assistida **caiu por medição**: o `journalctl` responde à identidade `sysloc` neste host. Detalhe em `_run/convergencia-do-host.md` §3.
- **Razão da ordem, e ela é de segurança**: esta é a **única** das quatro cuja medição tem
  **consequência externa**. A leitura só pode acontecer **depois** que o `CT-1152` (T6) afirmar o
  destino do e-mail — nunca antes. A §5.9 do `scope.md` mede por que: o ambiente do processador de
  trabalho aponta para um capturador de desenvolvimento (`SMTP_URL=smtp://127.0.0.1:1025`), e o modo
  de falhar é **silencioso** — a Tentativa de envio registraria desfecho **entregue** porque o
  servidor local aceitou a mensagem, e ninguém receberia nada. Medir a primeira passada antes da
  asserção do destino é ligar a Régua de cobrança sem saber para onde o Aviso sai.
- **Forma exigida do valor quando ele for lido**: `produziu efeito` ou `não produziu efeito`, **com
  a contagem observada**.
- **Comando que produz o valor** (executado depois da T6, sob privilégio, na janela):

```bash
sudo systemctl list-timers 'sysloc-*' --all --no-pager        # próxima execução de cada Rotina
sudo journalctl -u 'sysloc-rotina-*' --since '-1h' --no-pager # efeito da primeira passada
```

---

## 5. Achados desta passada

| # | Achado | Onde | Consequência |
|---|--------|------|--------------|
| A1 | O comando da janela na §4 da task roda **10** baterias, não 11 | `rodar-baterias.sh` linhas 115 a 117 · §4 da T1 | a janela usa `--com-agregador`; sem ele o `CT-1140` compararia 10 contra 11 e reprovaria por diferença que não é da suíte |
| A2 | Três fontes divergem sobre quantas baterias exigem privilégio | agregador linha 75 · insumo linha 42 · `CLAUDE.md` (linha do `D9`) | fixado em `3` pelo discriminador executável e `5` pelo predicado material; o `8` do insumo é transplante de universo (§1.1) |
| A3 | O universo do `D9` é **11**, e o `CLAUDE.md` diz **10** | `grep -rl afirmar_igual … \| wc -l` | o fecho do `D9` precisa de baseline para 11 dialetos; o `scope.md` §5.4 já mede certo, o `CLAUDE.md` é a cópia defasada — **não corrigido aqui**, não é arquivo desta task |
| A4 | Contagem da suíte **sem divergência** contra o `CLAUDE.md` | §2.1 | nada a corrigir; o registro existe porque a T11 compara contra estes números |
| A5 | O insumo diz **18** entradas em `/opt/backups/frappe/daily`; medido hoje: **17** (16 datas + `latest`) | §4, Dúvida 1 | consistente com retenção de 14 dias por `-mtime +14`; não é perda de cópia |
| A6 | Premissa do insumo *"disco em 79%"* refutada: medido `20%` | §4, Dúvida 2 | a retenção deixa de ser decisão de capacidade e passa a ser decisão de projeto |
| A7 | O destino planejado do backup novo é **irmão** do destino do legado sob `/opt/backups` | §4, Dúvida 1 | o expurgo por idade precisa ser escopado em `/opt/backups/sysloc/daily`; escopá-lo em `/opt/backups` alcançaria as cópias do legado |
| A8 | O agregador emite **5** vereditos; o enum do `CT-1140` declara **4** — **risco latente, NÃO realizado** | `rodar-baterias.sh` linhas 186 a 190 e 202 | `ESTOUROU` (código `124`) fica fora do enum declarado. **Não ocorreu na janela**: maior duração `759 s` (`verificar-fundacao`) contra limite de `1800 s`, **folga de 1041 s**; conjunto inteiro em `1754 s`. Se um dia ocorrer, o `CT-1140` reprova por valor legítimo do script, e não por defeito do registro |
| **A9** | 🔴 **Colisão de janela medida**: o legado ocupa `02:30` e a fatia planeja `02:30` para a cópia do banco novo | `sudo crontab -l` (`30 2 * * *`) · `plano-execucao.md` §F7 linha 560 | ver o bloco `A9` logo abaixo — **é o achado mais consequente da task** |

### 🔴 A9 — a `[HIPÓTESE]` da janela das 02:30 caiu: é colisão, e ela tem dono

A `[HIPÓTESE]` do pré-refinamento — *"a janela das 02:30 comporta os dois backups sem contenção de
I/O"* — **deixa de ser hipótese e passa a ser colisão medida**:

| Eixo | Legado (`backup_frappe.sh`) | Backend novo (planejado) | Coincidem |
|---|---|---|---|
| Partida | `02:30` (`30 2 * * *`, `crontab` do root) | `02:30` (`plano-execucao.md` §F7, linha 560) | **sim — mesmo minuto** |
| Volume | `/dev/mapper/ubuntu--vg-ubuntu--lv` | o mesmo | **sim** |
| Destino | `/opt/backups/frappe/daily` | `/opt/backups/sysloc/daily/` (linha 557) | **irmãos sob `/opt/backups`** |
| Ocupação medida | `02:30:01` a `02:30:44` — 36 a 43 s, em cinco execuções | ainda não existe | — |

**Consequência nomeada, e ela é da T4.** A T4 é quem escreve o `.timer`, e **a decisão de horário
dela deixa de ser livre**: partir às `02:30` põe a cópia do banco novo dentro da faixa em que o
legado já está lendo o volume e escrevendo o dump do MariaDB. A ordem de grandeza que a medição
sugere é modesta — o legado libera o disco em torno de `02:30:45` —, e é o insumo que a T4 precisa
para escolher entre deslocar a partida, declarar folga explícita ou usar dispersão no relógio.
**Esta task NÃO decide o horário**: decidir por ela seria alargar o escopo da T1.

⚠️ **`A7` e `A9` são a mesma vizinhança, medida por dois eixos — leia os dois juntos.** O `A7` é o
eixo do **espaço** (destinos irmãos sob `/opt/backups`, logo o expurgo por idade precisa ser
escopado em `/opt/backups/sysloc/daily`, nunca em `/opt/backups`); o `A9` é o eixo do **tempo**
(mesmo minuto, mesmo volume). Quem ler só um dos dois **subestima o acoplamento**: a mesma decisão
de topologia — pendurar a cópia nova ao lado da cópia do legado — produz as duas exposições, e
fechar uma delas não fecha a outra.

---

## 6. O que falta, e o comando exato que produz cada valor

**Resta um único item descoberto, e ele não é de privilégio: é de ordem.**

| Item | Marca | Comando que o resolve |
|------|-------|----------------------|
| Efeito da primeira passada das Rotinas (§4, Dúvida 4) | `PENDENTE-T6` | `sudo systemctl list-timers 'sysloc-*' --all --no-pager` e `sudo journalctl -u 'sysloc-rotina-*' --since '-1h' --no-pager`, **depois** do `CT-1152` |

**Fechado na janela assistida de 2026-08-25, às 16:08:19** — nenhum destes três carrega marca de
pendência neste documento:

| Item | Onde entrou | Resultado |
|------|-------------|-----------|
| Veredito das 11 baterias | §1 | `0 com problema`, `1` pré-condição de ambiente |
| Caminho literal dos diários | §1 | `/var/tmp/sysloc-baterias-20260825-160819`, 11 diários |
| Mecanismo disparador da preservação do legado | §4, Dúvida 1 | `crontab` do root, `30 2 * * *` — e daí saiu o `A9` |

⚠️ **Nenhum destes se resolve por contorno.** Não se acrescenta `NOPASSWD`, não se cria caminho sem
privilégio no produto, não se afrouxa modo de arquivo e não se copia ambiente para local legível: o
privilégio é a pré-condição, e é isso que os cards `CT-1140` e `CT-1145` fixam nominalmente. A
leitura sob privilégio imita `verificar-fundacao.sh`, que lê estado do supervisor e ambiente como
root **sem ecoar valor**.
