# Recuperação do backend Sysloc em máquina nova

> **Escrito em 2026-09-08**, no mesmo dia em que a virada da F7 foi executada e em que se descobriu
> que o backup **nunca havia funcionado em produção**. Ele existe porque a pergunta *"basta rodar o
> restore numa stack em branco?"* tem uma resposta curta e desagradável: **não basta**, e as razões
> abaixo foram todas **medidas neste repositório e neste host** — nenhuma é suposição.
>
> Runbook irmão: `deploy/scripts/virada.md` (a virada e a desinstalação do legado). Este aqui é o
> outro lado — o dia em que a máquina não existe mais.

---

## 0. Leia isto antes de qualquer coisa: o que a cópia NÃO leva

O `sysloc-backup-da-base.timer` produz **dois** artefatos por dia, e eles cobrem **o banco e os
segredos de operação** — nada mais. Nenhum dos itens abaixo está em qualquer cópia, e cada um tem
um caminho de recuperação próprio, declarado na §7:

| Não está na cópia | Por quê | Onde se resolve |
|---|---|---|
| **Os papéis do agrupamento** (`sysloc_app`, `sysloc_migracao`, `sysloc_resolucao`, `sysloc_roteamento`) | `pg_dump` de uma base **não inclui papéis** — eles são objetos do agrupamento. O dump apenas os **referencia** nos `OWNER TO`, e falha se não existirem | §3, passo 3 (`provisionar-base.sh`) |
| **Os privilégios de nível de BASE** (`OWNER`, `REVOKE … FROM PUBLIC`, `GRANT CONNECT`) | a cópia é `pg_dump --format=custom` **sem `--create`** — medido em `copiar-base.sh` | §3, passo 5 (o `CREATE DATABASE` traz os quatro comandos) |
| **Os PDFs de boleto** (`DIRETORIO_DOS_BOLETOS`) | ⚠️ **RESOLVIDO em 2026-09-08**: eles são espelhados na nuvem por `enviar-para-a-nuvem.sh`, **sem retenção** — a ADR-0030 os declara fato de terceiro, e podar por idade o que não se regenera seria perda programada. Nenhum dos dois scripts locais os copia, e isso segue verdade | §7.1 — baixe-os do Drive |
| **A fila (Redis/AOF)** | `/var/lib/redis/sysloc` não entra em cópia nenhuma | §7.2 — as rotinas re-executam pelo relógio |
| **Os builds do React** (`/opt/react/sysloc/html`, `/opt/web/syslocadmin/html`) | são artefato de outro repositório, construído na máquina do time de frontend | §7.3 — redeploy |
| **TLS, CloudPanel e os vhosts que ele gera** | o CloudPanel termina o TLS neste host e tem estado próprio | §7.4 |

> ### ✅ A lacuna que tornava tudo isto teórico FOI FECHADA em 2026-09-08
>
> **O texto anterior desta seção dizia que o acervo vivia só neste host, e que perdida a máquina
> este runbook ficaria sem insumo.** Era verdade, e era medido: zero ocorrências de `rclone`,
> `rsync`, `scp` ou `aws s3` em toda a árvore de `deploy/`. Deixou de ser.
>
> `deploy/scripts/backup/enviar-para-a-nuvem.sh` é o terceiro `ExecStart=` de
> `sysloc-backup-da-base.service` e envia, todo dia às 02:45, **o acervo e os boletos** para o
> Google Drive por `rclone` — sucedendo o `/opt/frappe/backup-offsite-upload.sh` do legado, que
> fazia isso desde 2026-07-23 e morre com a desinstalação. Destino:
> `offsite:sysloc-backups/<host>`, com `acervo/` (guarda de 14 dias, espelhando a local) e
> `boletos/` (**sem poda alguma**).
>
> ⚠️ **A credencial do Drive NÃO está no acervo, e isso é deliberado.** Ela vive em
> `/etc/sysloc-offsite/rclone.conf`, fora de `/etc/sysloc` — que é a raiz que
> `preservar-segredos.sh` empacota por inteiro e que este envio manda para a nuvem. É a cláusula da
> ADR-0032 aplicada ao par (credencial, destino): guardada lá dentro, o token de **exclusão** do
> acervo viajaria para dentro do próprio acervo. **Consequência para este runbook: numa máquina
> nova você REAUTORIZA o Drive — passo 0 da §3 —, em vez de restaurar um token antigo.**

---

## 1. Insumos — o que você precisa ter em mãos

Três arquivos, do **mesmo dia**, e um repositório:

| # | Artefato | Onde ele é produzido | Confere com |
|---|---|---|---|
| 1 | `base-<AAAA-MM-DD>.dump` | `/opt/backups/sysloc/daily/` | `pg_restore --list <arq> \| head` responde sem erro |
| 2 | `segredos-<AAAA-MM-DD>.tar.gz` | `/opt/backups/sysloc/segredos/` | `tar -tzf <arq>` lista `backend.env` |
| 3 | `chave-de-cifra-<AAAA-MM-DD>.env` | `offsite:sysloc-backups/<host>/chave-de-cifra/` (e, no host vivo, `/opt/salvaguarda-da-chave/`) | contém a linha `CHAVE_DE_CIFRA_DO_CERTIFICADO=` |
| 4 | os PDFs de boleto | `offsite:sysloc-backups/<host>/boletos/` | `rclone ls` lista o que existe |
| 5 | o repositório | `git clone git@…:fabianolopesviana/sysloc-backend.git` | — |

> **De onde eles vêm numa máquina nova**: do Google Drive, não deste host — que não existe mais.
> Baixe com um `rclone` autorizado em qualquer máquina:
>
> ```bash
> rclone copy offsite:sysloc-backups/<host>/acervo            ./acervo-recuperado
> rclone copy offsite:sysloc-backups/<host>/boletos           ./boletos-recuperados
> rclone copy offsite:sysloc-backups/<host>/chave-de-cifra    ./chave-recuperada
> rclone copy offsite:sysloc-backups/<host>/kit-de-recuperacao ./kit
> ```
>
> ⚠️ **A chave de cifra vive em prefixo PRÓPRIO, irmão de `acervo/` e nunca dentro dele.** É a
> cláusula da ADR-0032 — *"fora do mesmo pacote em que o material cifrado é salvaguardado"* —, e o
> material cifrado (o certificado do provedor) viaja dentro do dump. Baixar só o `acervo/` e
> esquecer este prefixo é o erro que faz o produto subir, autenticar, cobrar e **falhar na primeira
> emissão de boleto**, meses depois.
>
> ⚠️ **Que os dois prefixos vivam no MESMO destino é decisão do usuário**, de 2026-09-08, tomada com
> o custo apresentado: quem obtiver acesso ao Drive obtém o certificado cifrado **e** a chave. A
> troca foi por recuperação 100% automática, e está registrada no ponto do código.
>
> **`kit-de-recuperacao/` é o seguro contra o pior caso**: ele traz `sysloc-backend.bundle` — o
> repositório INTEIRO, com todo o histórico, que se recupera com `git clone <arquivo>`, sem rede,
> sem GitHub e sem credencial — mais este runbook e os quatro scripts de backup em texto legível.
> Ele existe porque a chave SSH que dá acesso ao GitHub vive **na máquina que este runbook supõe
> perdida**.
>
> O `<host>` é o `hostname` da máquina perdida (`brutus`, hoje) — o envio usa esse nome como
> namespace, de modo que duas máquinas nunca escrevem uma sobre a outra.

> **Por que (2) e (3) são arquivos separados, e por que você precisa dos DOIS**: a **ADR-0032** manda
> a chave de cifra viver **fora do mesmo pacote** em que o material cifrado é salvaguardado, e
> `preservar-segredos.sh` **recusa executar** quando os dois destinos coincidem. O tar traz
> `/etc/sysloc/` inteiro **menos** a linha da chave; a chave vem no arquivo (3). **Sem ela, o
> certificado bancário não se decifra** — o produto sobe, autentica, cobra, e só falha na primeira
> emissão de boleto.
>
> **O prazo de guarda é de 14 dias** (`PRAZO_DE_GUARDA_EM_DIAS=14`). Cópia mais velha que isso já
> não existe no acervo.

---

## 2. A ordem, e por que ela é essa

O passo que quase todo mundo inverte é o **2 antes do 3**. Ele não é preferência:

- `provisionar-base.sh` **gera** a credencial do `sysloc_app` quando `/etc/sysloc/backend.env` **não
  existe** (P06), e a grava no arquivo.
- Quando o arquivo **já existe**, ele **preserva a credencial** que está lá e, no P09,
  **ressincroniza o banco** com um `ALTER ROLE` para que o papel passe a aceitá-la.

Portanto: **restaure os segredos primeiro**, e o papel do banco nasce já casado com o `DATABASE_URL`
que a cópia lhe devolveu. Faça na ordem inversa e você terá um `backend.env` restaurado apontando
para uma senha que o banco não conhece — e a API sobe, tenta conectar e morre.

O segundo ponto de atenção é o **destino da restauração**. `restaurar-base.sh` tem uma guarda que
**recusa escrever na base que o `backend.env` declara** (ADR-0006), e ela **não tem bandeira que a
desligue** — de propósito. Na recuperação você quer, no fim, que a base restaurada **seja** a da
operação; a saída limpa é restaurar num nome próprio e **renomear** depois (passos 5 a 7). Isso não
contorna a guarda: no momento da restauração o destino é de fato outra base.

```
1. sistema operacional e repositório
2. RESTAURAR OS SEGREDOS          ← antes do provisionamento, sempre
3. provisionar-base.sh            ← cria papéis e a base vazia; preserva a credencial
4. pnpm install && pnpm build
5. criar a base de destino e RESTAURAR nela
6. conferir a restauração
7. renomear: a restaurada vira a da operação
8. migrar-banco.sh (idempotente; só age se o repositório estiver à frente do dump)
9. instalar-unidades.sh
10. recriar as duas bordas nginx
11. conferir de ponta a ponta
```

---

## 3. Passo a passo

Tudo abaixo roda **como root** (`sudo`), no host novo. Substitua `<AAAA-MM-DD>` pela data da cópia.

### Passo 0 — reautorizar o Drive (só se você for baixar os insumos aqui)

Se os três arquivos da §1 já estão em mãos, pule. Se você vai buscá-los na nuvem a partir da máquina
nova, o `rclone` dela precisa de autorização própria — o token antigo **não** está no acervo, por
decisão (§0):

```bash
sudo mkdir -p /etc/sysloc-offsite && sudo chmod 700 /etc/sysloc-offsite
sudo rclone config --config /etc/sysloc-offsite/rclone.conf     # crie o remote com o nome exato: offsite
sudo chmod 600 /etc/sysloc-offsite/rclone.conf
sudo rclone --config /etc/sysloc-offsite/rclone.conf ls offsite:sysloc-backups | head
```

O mesmo arquivo é o que a rotina diária vai usar depois do passo 9 — deixá-lo pronto agora poupa uma
volta.

### Passo 1 — sistema e repositório

```bash
# o repositório vive neste caminho por decisão: as unidades systemd o citam literalmente
git clone git@github-sysloc:fabianolopesviana/sysloc-backend.git /opt/sysloc-backend
cd /opt/sysloc-backend
mise install          # fixa Node 24.18.1 — o ExecStart das unidades aponta para o binário concreto
```

> ⚠️ **O caminho `/opt/sysloc-backend` não é negociável sem editar as unidades**: `sysloc-api.service`
> e `sysloc-worker.service` declaram `WorkingDirectory=/opt/sysloc-backend/apps/{api,worker}` e um
> `ExecStart` com o caminho absoluto do node do mise. Clonar noutro lugar exige mudar as duas.

### Passo 2 — restaurar os segredos (ANTES do provisionamento)

```bash
mkdir -p /etc/sysloc
tar -xzf segredos-<AAAA-MM-DD>.tar.gz -C /etc/sysloc --strip-components=1   # confira a estrutura com -tzf antes
chmod 0600 /etc/sysloc/*.env
chown root:root /etc/sysloc/*.env

# a chave de cifra volta ao backend.env, de onde ela foi retirada por nome ao empacotar
cat chave-de-cifra-<AAAA-MM-DD>.env >> /etc/sysloc/backend.env

# confira que cada chave aparece EXATAMENTE uma vez — o provisionamento aborta se houver repetição
grep -oE '^[A-Z_]+=' /etc/sysloc/backend.env | sort | uniq -d    # saída vazia = ok
```

As chaves que o `backend.env` carrega, para conferência (16, medidas nas unidades e no ambiente da
aplicação): `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`, `EMAIL_REMETENTE`, `ORIGENS_PUBLICAS`,
`CHAVE_DE_CIFRA_DO_CERTIFICADO`, `DIRETORIO_DOS_BOLETOS`, `ENDERECO_DE_ESCUTA`, `PORTA`,
`ENDERECO_DO_PROVEDOR_BANCARIO`, `ENDERECO_DE_AUTORIZACAO_BANCARIA`,
`ENDERECO_DA_ENTREGA_DA_NOTICIA`, `PORTA_EXIGIDA_PELO_PROVEDOR`, `NODE_ENV`, `LOG_LEVEL` e o
`migracao.env` à parte, com a credencial do papel **dono** — que por decisão **não** é
`EnvironmentFile` de unidade nenhuma.

### Passo 3 — provisionar os serviços de base

```bash
sudo bash deploy/scripts/instalacao/provisionar-base.sh
sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh
```

Ele instala PostgreSQL 18 (escutando só em `127.0.0.1` e no soquete), a instância própria do Redis 7
com AOF (porta `6380`, dados em `/var/lib/redis/sysloc`) e o Mailpit; cria os **quatro papéis**, a
base `sysloc` (vazia, `OWNER sysloc_app`) e a `sysloc_verificacao`; e ajusta o `pg_hba.conf`.

**Leia a saída linha a linha.** No P06 ele deve dizer `JA-OK … credencial preservada` — é a
confirmação de que o passo 2 valeu. Se disser `CRIADO … credencial gerada em tempo de execução`, o
`backend.env` não estava lá: **pare, restaure-o e rode de novo.**

### Passo 4 — construir

```bash
sudo -u sysloc bash -lc 'pnpm install --frozen-lockfile && pnpm build'
```

> Rode **como o usuário `sysloc`**, não como root: as unidades executam com `User=sysloc`, e um
> `dist/` de dono root é lido, mas o `node_modules` construído por root causa problema de permissão
> na próxima instalação. E `pnpm` só existe no PATH via mise, que é ativado no perfil daquele
> usuário — daí o `bash -lc`.

### Passo 5 — criar a base de destino e restaurar nela

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE DATABASE "sysloc_restaurado" OWNER "sysloc_app";
REVOKE ALL ON DATABASE "sysloc_restaurado" FROM PUBLIC;
GRANT ALL ON DATABASE "sysloc_restaurado" TO "sysloc_app";
GRANT CONNECT ON DATABASE "sysloc_restaurado" TO "sysloc_migracao";
SQL

sudo SYSLOC_BANCO_DE_DESTINO=sysloc_restaurado \
  bash deploy/scripts/backup/restaurar-base.sh /caminho/base-<AAAA-MM-DD>.dump
```

Os quatro comandos SQL **não são decoração**: eles reproduzem exatamente o que
`provisionar-base.sh` faz ao criar a base da operação, e sem eles a base renomeada no passo 7
ficaria com dono errado e com `PUBLIC` mantendo o `CONNECT` que o produto revoga. O `RENAME` do
passo 7 **preserva** dono e ACL, então é aqui que eles precisam estar certos.

O restaurador pede a palavra `RESTAURAR` como confirmação. Ele roda pelo **soquete local, como o
superusuário do agrupamento** — é a correção de 2026-09-08, e a razão está escrita no cabeçalho
dele: o papel da aplicação não tem `CREATE` na base, não pode assumir os donos que o dump declara,
e a conferência final leria **zero linhas** de `negocio.*` sob `FORCE ROW LEVEL SECURITY`,
aprovando uma restauração vazia.

Modos úteis: `… <arquivo> ensaio` percorre tudo sem escrever nada; `… <arquivo> conferir` só compara
um destino já restaurado contra o arquivo.

### Passo 6 — conferir a restauração antes de trocar

A linha de fecho do restaurador diz o que o destino tem e o que lhe falta. **Exija a igualdade**:

```
restauração CONFERIDA — relacoes=<n> linhas=<m>
```

Se relações ou linhas divergirem da origem declarada no arquivo, **pare aqui**: a base da operação
ainda não foi tocada, e é isso que torna esta ordem segura.

### Passo 7 — a restaurada vira a da operação

Com API e worker **ainda não instalados**, não há conexão a derrubar:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
ALTER DATABASE "sysloc"            RENAME TO "sysloc_vazia_da_instalacao";
ALTER DATABASE "sysloc_restaurado" RENAME TO "sysloc";
SQL
```

Guarde a `sysloc_vazia_da_instalacao` até o passo 11 fechar; ela é o desfazimento barato deste
passo. Depois, `DROP DATABASE "sysloc_vazia_da_instalacao";`.

### Passo 8 — migrações (idempotente, e quase sempre um no-op)

```bash
sudo bash deploy/scripts/instalacao/migrar-banco.sh
sudo bash deploy/scripts/instalacao/verificar-migracao.sh
```

O registro do que já foi aplicado mora **no banco** (`identidade.migracao_aplicada`), e por isso ele
**veio dentro do dump** — o cabeçalho do script diz isso com todas as letras: *"o registro precisa
acompanhar o banco em restauração de cópia de segurança"*. Se o repositório estiver na mesma altura
da cópia, este passo não faz nada. Se estiver à frente, ele aplica só o que falta.

> ⚠️ **Não rode este passo ANTES do 5**: ele criaria as tabelas na base vazia, e o restaurador
> recusa destino que não esteja vazio.

### Passo 9 — instalar as unidades

```bash
sudo bash deploy/scripts/instalacao/instalar-unidades.sh
sudo bash deploy/scripts/instalacao/verificar-unidades-agendadas.sh
```

São 17 unidades: `sysloc-api.service`, `sysloc-worker.service`, os 6 pares
`sysloc-rotina-*.{service,timer}`, `sysloc-alerta-de-rotina@.service` e o par
`sysloc-backup-da-base.{service,timer}` (relógio às **02:45** — deslocado do `02:30` do legado por
medição). O instalador **habilita apenas os `.timer` e as duas unidades permanentes**: habilitar um
`.service` de `Type=oneshot` o faria correr **no boot**, fora do horário declarado.

> ⚠️ **`sysloc-backup-da-base.service` tem TRÊS passos, e o terceiro exige o passo 0.** Ele é
> `enviar-para-a-nuvem.sh`, e sem `/etc/sysloc-offsite/rclone.conf` a rotina recusa com desfecho
> **2** — pré-condição, não reprovação —, e o `OnFailure=` alerta todo dia às 02:45. Os dois
> primeiros passos (a cópia e os segredos) terminam normalmente antes dele: **o acervo local fica
> íntegro**, e o que falta é só a cópia fora do host. Confira com:
>
> ```bash
> sudo bash deploy/scripts/backup/enviar-para-a-nuvem.sh --ensaio
> ```
>
> O ensaio percorre o caminho inteiro — guardas, remote, origem — e **não escreve nada** no destino.

### Passo 10 — as duas bordas nginx

O produto é servido por **dois** contêineres `nginx:1.27-alpine`, ambos em `--network host` — que é
a única rede da qual a API, escutando só em `127.0.0.1:3000`, é alcançável:

```bash
# app do cliente — sysloc.systera.com.br, escuta 127.0.0.1:8300
mkdir -p /opt/react/sysloc/nginx /opt/react/sysloc/html
cp /opt/sysloc-backend/deploy/nginx/sysloc-app-interno.conf /opt/react/sysloc/nginx/default.conf
docker run -d --name sysloc-react-1 --network host --restart unless-stopped \
  -v /opt/react/sysloc/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /opt/react/sysloc/html:/usr/share/nginx/html:ro \
  nginx:1.27-alpine

# painel do operador — syslocadmin.systera.com.br, escuta 127.0.0.1:8400
mkdir -p /opt/web/syslocadmin/nginx /opt/web/syslocadmin/html
cp /opt/sysloc-backend/deploy/nginx/syslocadmin-painel.conf /opt/web/syslocadmin/nginx/default.conf
docker run -d --name syslocadmin-painel --network host --restart unless-stopped \
  -v /opt/web/syslocadmin/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /opt/web/syslocadmin/html:/usr/share/nginx/html:ro \
  nginx:1.27-alpine
```

O TLS **não** é destes contêineres: quem ocupa 80/443 neste host é o **CloudPanel**, que termina o
TLS e repassa para `127.0.0.1:8300` e `127.0.0.1:8400`. `deploy/nginx/sysloc-app.conf` existe e é o
caminho para o dia em que o CloudPanel sair — **não o instale enquanto ele estiver lá**, porque
aquele vhost foi escrito para ser a borda mais externa e termina o próprio TLS.

### Passo 11 — conferência de ponta a ponta

```bash
# a aplicação responde, e responde o envelope dela — não a página única
curl -si https://sysloc.systera.com.br/v1/sessao | head -3     # espere 401 + application/json

# as rotas publicadas estão no PROCESSO, não só no dist/ — a rede do PROD-2026-09-03-01
sudo bash deploy/scripts/publicacao/verificar-rotas-publicadas.sh

# a cópia volta a funcionar, e o que ela leva confere com o banco linha a linha
sudo bash deploy/scripts/virada/05-provar-backup.sh

# a suíte da árvore (não toca a base da operação — ADR-0006)
sudo -u sysloc bash -lc 'cd /opt/sysloc-backend && pnpm test'
```

> ⚠️ **`502` não é `404`, e confundi-los já custou um diagnóstico.** Nas primeiras sondas depois de
> um arranque, `502` significa *"a aplicação ainda não subiu"* — a distribuição é o discriminador:
> falha→sucesso **monotônica** nas primeiras é janela de arranque; intermitência espalhada pela
> execução inteira é defeito. Espere por **condição observada**, nunca por `sleep` de valor suposto.

---

## 4. Se o produto sobe mas não faz uma dessas coisas

| Sintoma | Causa quase certa | Onde olhar |
|---|---|---|
| API morre na partida com erro de conexão | passo 2 feito **depois** do 3 — `DATABASE_URL` restaurada, senha do papel gerada nova | rode `provisionar-base.sh` de novo: o P09 ressincroniza |
| API morre na partida por variável ausente | o tar não trouxe todas as chaves, ou a chave de cifra não foi reanexada | `grep -c '=' /etc/sysloc/backend.env` contra a lista da §3, passo 2 |
| Tudo funciona, mas a emissão de boleto falha | `CHAVE_DE_CIFRA_DO_CERTIFICADO` ausente ou de outro dia | o arquivo (3) da §1 tem de ser do **mesmo dia** do tar |
| Aviso de cobrança sai sem o nome da empresa | migração `0028` não aplicada | passo 8 |
| E-mail "envia" e ninguém recebe | `SMTP_URL` apontando para o capturador local (`127.0.0.1:1025`) | `verificar-unidades-agendadas.sh` reprova o `CT-1152` — é o mutante que ele existe para pegar |
| Restauração "passa" com o banco vazio | você concedeu um `GRANT` ao papel da aplicação em vez de usar o superusuário | **desfaça o `GRANT`**; a §0 do `restaurar-base.sh` explica por que isso é a correção errada |

---

## 5. Quanto tempo isso leva

Os passos 1 a 4 dominam o relógio (instalação de pacotes e `pnpm build`). Os passos 5 a 8 são
minutos para uma base deste tamanho — a prova de 2026-09-08 restaurou **34 relações / 164 linhas /
3 schemas / 22 políticas de RLS / 3 donos distintos** em segundos. **Não use esse número como
expectativa**: ele cresce com a operação, e a hora de medi-lo de novo é a próxima vez que
`08-provar-restauracao.sh` rodar.

---

## 6. O que este runbook NÃO prova

**Ele nunca foi executado numa máquina nova.** O que foi executado e provado, em 2026-09-08, é a
**restauração no mesmo agrupamento** (`08-provar-restauracao.sh`, verde) — onde os quatro papéis já
existiam. Os passos 1 a 4 e 9 a 11 estão derivados **da leitura dos scripts e do estado medido deste
host**, e são exatos até onde a leitura alcança; o que falta é a execução real.

**Enquanto isso não for feito, trate este documento como plano, não como garantia.** O ensaio custa
uma máquina descartável e algumas horas, e é a única forma de transformar as duas frases acima numa
só.

---

## 7. Os itens fora da cópia, um a um

### 7.1 — Os PDFs de boleto: baixe-os do Drive

⚠️ **Esta seção dizia "perda, não recuperação" até 2026-09-08, e o texto ficava certo pela razão
errada**: o boleto do provedor continua sendo **fato de terceiro** (ADR-0030, cláusula de exclusão)
e continua **não se recompondo** a partir do banco — o que mudou é que agora existe cópia dele fora
do host. O que sobrevive à restauração do banco segue sendo o **registro** da cobrança, com
`linha_digitavel` e `nosso_numero`: suficiente para o locatário pagar, insuficiente para reemitir o
arquivo. É por isso que a cópia importa.

```bash
# o destino é o que DIRETORIO_DOS_BOLETOS declara no backend.env já restaurado
DIR="$(sudo sed -nE 's/^DIRETORIO_DOS_BOLETOS=//p' /etc/sysloc/backend.env | tail -n1)"
sudo install -d -o sysloc -g sysloc -m 750 "$DIR"
sudo rclone --config /etc/sysloc-offsite/rclone.conf copy \
  "offsite:sysloc-backups/<host>/boletos" "$DIR"
sudo chown -R sysloc:sysloc "$DIR"
```

⚠️ **O espelho na nuvem NUNCA é podado**, e é por isso que ele pode trazer de volta PDFs que já não
existiam no host perdido. A propriedade tem rede permanente: o `CT-1282` de `verificar-backup.sh`
afirma, pelo EFEITO, que a poda de 14 dias alcança o acervo e **não** os boletos.

### 7.2 — A fila (Redis/AOF)

Perde-se o que estava enfileirado e não processado. O dano é limitado por construção: as seis
rotinas são disparadas por **relógio**, e a próxima passagem refaz a apuração — inclusive a
retomada de notícias bancárias paradas em `RECEBIDO`. O que não volta sozinho é um trabalho
enfileirado por ação de usuário entre a última cópia e a queda.

### 7.3 — Os builds do React

Nenhum dos dois está aqui: **este repositório não tem o fonte do frontend**, e é fronteira
declarada. Recuperação: o time roda `docs/deploy-sysloc.sh` da máquina local dele (que faz build →
backup → rsync → valida, e **reprova a publicação** se o bundle carregar `REACT_APP_ERPNEXT_*`), e o
equivalente do Painel Master para `/opt/web/syslocadmin/html`.

### 7.4 — TLS, CloudPanel e DNS

Fora do alcance deste repositório. O que o backend precisa que seja verdade, e que você deve
conferir depois de reerguê-los: o `443` do hostname público encaminha para `127.0.0.1:8300`
(app) e `127.0.0.1:8400` (painel), e `ORIGENS_PUBLICAS` no `backend.env` lista os dois hostnames —
sem isso a conferência de origem recusa o navegador com `ACESSO_NEGADO`.

⚠️ **Os vhosts dos DOIS contêineres estão versionados desde 2026-09-08.** O do Painel Master era o
único do produto que não estava — ele foi copiado para `deploy/nginx/syslocadmin-painel.conf`, com o
corpo **byte a byte** igual ao arquivo em uso e só um cabeçalho acrescentado. O texto anterior desta
seção mandava preservá-lo à parte ou reescrevê-lo no mesmo molde, e **não se repõe**: eram 163
linhas de configuração para reconstruir à mão, sob pressão, no dia em que o servidor caiu.

O DNS do e-mail é do domínio, não do host: SPF, os dois DKIM e o DMARC do Brevo continuam válidos
numa máquina nova, porque a entrega sai por **relay autenticado** e não pelo IP deste servidor —
que, aliás, é o motivo de o envio direto ter sido descartado.
