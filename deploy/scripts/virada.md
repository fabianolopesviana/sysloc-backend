# Virada e desinstalação — runbook

> **Item do marco de entrega**: *"`deploy/scripts/virada.md` escrito, com o gate de desinstalação de
> 5 itens"*. **Escrever é construção; executar não é.**
>
> ⚠️ **Não confunda com o item do `@syslocbr/contracts` publicado**, que é outro e vive em
> `deploy/scripts/publicacao/publicar-contracts.md`. Os dois nasceram na mesma intervenção dirigida
> de 2026-08-27, e numerar este como "item 3" — como a primeira versão fez — fazia os dois
> reivindicarem o mesmo número do checklist.
>
> ⚠️ **NENHUM agente executa este runbook.** Ele é conduzido pelo operador, neste servidor, numa
> sessão que o `plano-execucao.md` classifica como *"operação, não construção: horas, não dias"*.
>
> ⚠️ **A pré-condição que governa tudo**: o primeiro critério de aceitação da F7 é *"app funcionando
> integralmente contra o backend novo"*. O app do cliente hoje fala **ERPNext** — os 35 endpoints do
> dialeto Frappe. Religá-lo é a **F6**, e o fonte React vive na máquina local. **Sem a F6 entregue,
> este runbook não começa.**

---

## 0. O inventário medido — 2026-08-27

Tudo abaixo foi medido neste host, não estimado.

| Alvo | Medição |
|---|---|
| Contêineres do projeto compose `frappe` | **11** |
| Volumes `frappe_*` | **6** (`assets`, `db-data`, `logs`, `redis-cache-data`, `redis-queue-data`, `sites`) |
| Imagens (erpnext / locacao / mariadb / redis) | **4** · ~3,06 GB |
| `/opt/frappe` | **36 MB**, com `docker-compose.yaml` e **7** `override` de backup |
| `run-*.sh` em `/opt/frappe` | **4** (atrasos, vencidas, encerrar-contratos, locacao-automation) |
| Arquivos `*frappe*` em `/usr/local/bin` | **10** (`backup_frappe.sh`, `restore_frappe.sh`, `restore_frappe_check.sh` + 7 `.bak`) |
| Entradas de cron do root | ⚠️ **não medidas** — exigem privilégio (`sudo -n` falha neste host) |
| Disco | 24 G de 128 G usados (**20%**) — ⚠️ o `plano-execucao.md` fala em *"disco em 79%"*; **refutado por medição** |

---

## 1. ⚠️ A armadilha que este runbook existe para evitar

**Dois contêineres NÃO pertencem ao projeto compose `frappe`**, e um deles **tem de sobreviver**:

| Contêiner | Projeto compose | `restart` | Destino |
|---|---|---|---|
| `frappe-*` (os 11) | `frappe` | `unless-stopped` | **param e são removidos** |
| `sysloc-react-1` | **vazio** (subido avulso) | `unless-stopped` | **para e é removido** — é o app ANTIGO |
| `syslocadmin-painel` | **vazio** (subido avulso) | `unless-stopped` | ⚠️ **SOBREVIVE** — é o Painel Master do produto NOVO |

Consequências, e as duas mordem:

1. **`docker compose down` em `/opt/frappe` NÃO alcança o `sysloc-react-1`.** O app antigo continua
   de pé servindo o dialeto ERPNext, e `restart=unless-stopped` **o traz de volta no reboot**.
2. **Um `docker stop $(docker ps -q)` derruba o Painel Master junto.** Nunca use a forma varrida.

---

## 2. O que tem de continuar de pé — confira ANTES e DEPOIS

```bash
systemctl is-active sysloc-api sysloc-worker sysloc-mailpit
systemctl list-timers 'sysloc-rotina-*' --all --no-pager   # esperado: as 6 Rotinas
docker ps --format '{{.Names}}' | grep syslocadmin-painel   # esperado: presente
```

⚠️ **As 6 Rotinas do produto novo já rodam** — medido na fatia `publicacao-e-backup`: 938 passadas em
~13 h 30, zero falhas. A virada **não as liga**; ela desliga as do Frappe, que hoje correm em paralelo
sobre uma base diferente.

---

## 3. A virada — na ordem, e a ordem importa

### 3.1 Parar as rotinas do Frappe **antes** de qualquer outra coisa

```bash
cd /opt/frappe
docker compose stop scheduler queue-short queue-long
docker compose ps --format '{{.Service}}\t{{.State}}'      # os três em `exited`
```

**Por que primeiro**: enquanto o scheduler viver, ele pode disparar cobrança, e-mail ou boleto a
partir da base antiga. Apontar a borda antes de calá-lo abre uma janela em que os **dois** sistemas
agem sobre o mesmo cliente.

### 3.2 Apontar a borda do cliente para o app novo

O vhost já existe versionado — `deploy/nginx/sysloc-app.conf`, entregue e provado pela fatia
`publicacao-e-backup` (bateria `verificar-borda-do-app.sh`, 12 casos / 194 asserções).

```bash
sudo bash deploy/scripts/borda/instalar-borda-do-app.sh
# exige SYSLOC_HOSTNAME_DO_APP, SYSLOC_RAIZ_DO_APLICATIVO e SYSLOC_RAIZ_DO_DESAFIO_ACME
```

⚠️ **`SYSLOC_RAIZ_DO_APLICATIVO` tem de conter o build da F6.** Sem ele o vhost serve `404` — e aí a
virada trocou um app que funcionava por um diretório vazio.

⚠️ **A ordem `ORIGENS_PUBLICAS` → reiniciar a API → recarregar as bordas é IRREVERSÍVEL** e está
escrita em `docs/specs/features/publicacao-e-backup/v1/_run/convergencia-do-host.md` §4. Invertê-la
derruba o login do painel na janela entre os passos.

### 3.3 Parar o app antigo — o passo que o `compose down` não faz

```bash
docker update --restart=no sysloc-react-1   # senão o reboot o traz de volta
docker stop sysloc-react-1
```

### 3.4 Conferir a travessia

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://sysloc.systera.com.br/
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://sysloc.systera.com.br/v1/imoveis
```

⚠️ **Afirme o tipo do conteúdo, nunca só o código.** O modo de falhar medido nesta base é `200` com
o corpo errado — a raiz devolvendo `text/html` do app e `/v1/*` devolvendo `application/json` da API.

---

## 4. Gate de desinstalação — os 5 itens, todos obrigatórios

**Nada é removido antes dos cinco.** A lista é a do `plano-execucao.md`, com o estado medido hoje:

- [x] **Golden files capturados e commitados** — **12** artefatos em
      `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`
- [ ] **Dump final da base antiga e dos segredos preservado** em `/opt/backups/sysloc/`
- [ ] **Checklist de virada executado e conferido** — a §3 acima
- [ ] **Backup do banco NOVO restaurado com sucesso num banco vazio** (`pg_restore --list` + restore
      de teste). ⚠️ O código está entregue e provado (`CT-1107`, com o destino medido em ZERO antes),
      mas as **2 unidades de backup ainda não estão posicionadas** — é a janela assistida (a) da fatia
      `publicacao-e-backup`
- [ ] **`/etc/sysloc/producao` criado** na instalação que passou a atender a operação — medido hoje:
      **NÃO existe**. Enquanto faltar, `verificar-provisionamento.sh` segue liberado a reiniciar a
      fila e reexecutar o provisionamento **contra produção**

⚠️ **O quinto item é o mais fácil de esquecer e o mais caro**: ele arma o guarda da **ADR-0006**.

---

## 5. Desinstalação — só com os 5 verdes

```bash
cd /opt/frappe
docker compose down --volumes --remove-orphans     # os 11 contêineres e os 6 volumes
docker rm -f sysloc-react-1 2>/dev/null || true    # se a §3.3 não o removeu

# ⚠️ As QUATRO imagens do inventário da §0, e as quatro ficam órfãs: o produto novo é NATIVO,
#    sem Docker, e nenhum contêiner não-Frappe as usa (medido em 2026-08-27).
#    ⚠️ `nginx:1.27-alpine` NÃO entra — é a imagem do `syslocadmin-painel`, que sobrevive.
#
#    ⚠️ A forma `docker images -q 'a' 'b'` NÃO funciona e falha em SILÊNCIO: `docker images`
#    aceita no máximo UM argumento posicional, devolve zero IDs, e um `2>/dev/null || true`
#    engoliria as duas falhas — o operador veria sucesso e as imagens continuariam no disco.
#    Medido, e é por isso que aqui se usa `--filter reference=`, que devolveu os IDs.
IDS_A_REMOVER=$(docker images -q \
	--filter 'reference=frappe/erpnext' \
	--filter 'reference=locacao-erpnext' \
	--filter 'reference=mariadb' \
	--filter 'reference=redis')
[ -n "${IDS_A_REMOVER}" ] && docker rmi ${IDS_A_REMOVER}   # a falha APARECE — sem 2>/dev/null

sudo rm -rf /opt/frappe                            # 36 MB, inclui os 4 run-*.sh
sudo rm -f /usr/local/bin/*frappe*                 # os 10 arquivos medidos
sudo crontab -l -u root                            # ⚠️ INSPECIONE antes de editar
sudo crontab -e -u root                            # remova SÓ as entradas do Frappe
```

⚠️ **`docker compose down --volumes` é irreversível e leva a base antiga junto.** O item 2 do gate
existe exatamente para que, nesse instante, o dump já esteja preservado fora do Docker.

⚠️ **A cron do root não foi medida** (exige privilégio). **Liste antes de editar** — há uma entrada
de backup do Frappe às `02:30`, e é dela que o backup novo se deslocou para `02:45`.

---

## 6. Não há janela de rollback, e isso é decisão registrada

O `plano-execucao.md` a tomou com duas razões medidas:

- **o Frappe é single-tenant** — voltar para ele é abandonar a capacidade que justificou a troca;
- **não há migração de dados** — no instante seguinte à virada as duas bases **divergem**, e reverter
  devolveria dados velhos.

> **A rede de segurança deixa de ser uma stack de pé e passa a ser um dump preservado** — que não
> ocupa CPU, não diverge, e continua consultável indefinidamente.

**Consequência aceita**: a partir da virada, defeito no backend novo se corrige **para a frente**.

---

## 7. Depois

Marque os itens do marco no `CLAUDE.md`, regenere o painel
(`bash deploy/scripts/roadmap/atualizar-roadmap.sh`) e registre a sessão. ⚠️ **Defeito encontrado
aqui se corrige como correção — não reabre a construção do backend.**
