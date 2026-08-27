# Prompt de ativação — Webhook bancário e a publicação da borda

> **O que este arquivo é.** Um prompt completo e autossuficiente para conduzir, do zero, a
> **ativação do webhook do Sicoob em produção** — a parte operacional que a fatia
> `webhook-e-carne/v1` deixou declaradamente em aberto. Ele carrega o estado medido da máquina, o
> que já está construído, por que o rollout não aconteceu, a decisão do hostname com as razões, o
> passo a passo executável, os riscos medidos e o rollback.
>
> **Como usar.** Entregue o arquivo inteiro a um agente de codificação com acesso ao servidor, ou
> siga-o à mão. Ele é escrito para ser lido **frio**, sem a conversa que o originou.
>
> **Origem.** Fatia `webhook-e-carne/v1`, 12/12 tasks concluídas em 2026-08-19, suíte em 1710 casos
> verdes. A infraestrutura da borda é entrega da **T11**; o que falta aqui é **operação**, não código.
>
> ⚠️ **As medições deste arquivo têm data.** Tudo que está marcado como *medido em 2026-08-19*
> envelhece. Antes de agir, **remeça** — o próprio runbook diz onde e como.

---

## 1. O objetivo, em uma frase

Fazer o Sicoob entregar notificações de pagamento na API nova, por HTTPS, num caminho público
único — e **provar por medição** que só esse caminho responde.

Quando isto estiver pronto, a **CA-20** da fatia está cumprida e o ciclo de cobrança fecha sozinho:
o pagamento acontece, o banco avisa, a cobrança liquida sem ninguém conferir extrato.

---

## 2. Estado medido em 2026-08-19 — remeça antes de agir

| O que | Estado medido | Como remedir |
|---|---|---|
| API nova | de pé, `sysloc-api.service`, `Environment=PORT=3000`, em `127.0.0.1` | `systemctl status sysloc-api` |
| Servidor de borda | `nginx 1.30.3`, atendendo `0.0.0.0:443` e `0.0.0.0:80` | `ss -ltnp \| grep -E ':443\|:80 '` |
| Quem gerencia a borda | **CloudPanel** (`/home/clp` existe) | `ls -d /home/clp` |
| `/etc/nginx` | `drwx------ root root` (**0700** — ilegível sem `sudo`) | `ls -ld /etc/nginx` |
| App atual | `/opt/frappe` servindo `sysloc.systera.com.br` com HTTPS funcional | navegador |
| Rota da notícia | `POST /v1/notificacoes-bancarias` publicada, responde `204` | suíte da fatia |
| Certificado do provedor (mTLS Sicoob) | **vence 2026-08-22** — medido em 2026-08-16 por leitura do material | ver §8 |
| Migrações no banco da operação | **`0020` aplicada** (era `0018` até 2026-08-19) | `SELECT arquivo FROM identidade.migracao_aplicada ORDER BY arquivo DESC LIMIT 1` |
| `plataforma.notificacao_bancaria` | **existe** — o webhook tem onde gravar | `SELECT to_regclass('plataforma.notificacao_bancaria')` |
| `verificar-migracao.sh` | **verde** (2/2 casos) desde 2026-08-19 | `sudo bash deploy/scripts/instalacao/verificar-migracao.sh` |

⚠️ **`/etc/nginx` é 0700.** Isso significa que **nenhum diagnóstico da borda funciona sem `sudo`**, e
foi o que impediu o run de confirmar o diretório de vhosts. Toda inspeção abaixo pressupõe `sudo`.

---

## 3. O que já está construído e verificado (não refazer)

A **T11** entregou três artefatos versionados, aprovados nos dois gates:

### 3.1 `deploy/nginx/sysloc-notificacao-bancaria.conf` — o vhost (248 linhas)

- `location =` **exato** para `/v1/notificacoes-bancarias` — igualdade, nunca prefixo.
- **Tudo o mais responde `404`, pela própria borda**, sem repassar ao serviço.
- HTTPS na 443, TLS 1.2+. Aponta para a API em `127.0.0.1`.
- ⚠️ **Nenhum redirecionamento**, em hipótese alguma — o Sicoob reprova `3xx`. O bloco em claro
  **recusa** em vez de redirecionar, e há `proxy_redirect off`.
- **Nenhuma credencial** no arquivo (ADR-0005): ele carrega o *caminho* do certificado, nunca o
  material.
- `server_tokens off` e `client_max_body_size 64k`, espelhando `MAIOR_CORPO_ACEITO` de
  `apps/api/src/main.ts`.
- ✅ **Tem limitador de abuso desde 2026-08-26** (T10 da fatia `publicacao-e-backup`, aplicando a
  **ADR-0037**): `limit_conn_zone`/`limit_conn` por endereço de origem, no `location` da notícia. O
  débito que registrava a ausência foi pago, e o marcador saiu do arquivo e do índice.
  ⚠️ **NÃO instale teto de taxa (`limit_req`) neste vhost** — o eixo de origem do provedor é um
  endereço só, e o mesmo teto que barra o abuso descartaria a rajada legítima. A ausência é
  asserção: o `CT-1193` conta ZERO diretivas da família em linha ativa do gabarito.

Vetores que o Gate 2 confirmou fechados: `/v1/notificacoes-bancarias/extra`, a barra final, e
`/v1/notificacoes-bancarias/../v1/auth` (que **normaliza antes** do casamento) — todos caem no 404
da borda.

### 3.2 `deploy/scripts/borda/instalar-borda-de-notificacao.sh` — o instalador

Idempotente (ADR-0005): rodar duas vezes produz o mesmo estado. Executa cinco passos, com
desfazimento em qualquer término:

1. **P01** valida pré-condições · **P02** renderiza e valida o vhost isolado ·
   **P03** posiciona · **P04** valida a **configuração inteira** do servidor · **P05** recarrega.
2. ⚠️ **Não toca o vhost que atende `/opt/frappe`.**
3. Se for interrompido entre o P03 e o P04, **restaura o conteúdo anterior** (estado
   `ESCRITA_PENDENTE`, com todos os términos convergindo para a limpeza).
4. Recusa hostname e caminhos malformados **antes** de qualquer escrita, e recusa render
   implausível ainda que o `sed` tenha saído 0.

### 3.3 `deploy/scripts/borda/verificar-notificacao-bancaria.sh` — o verificador (CT-1005)

Frente shell, **4 frentes, 115 asserções**, exit 0 na última execução (2026-08-19). Afirma por
**medição de rede**, não por leitura da configuração:

1. o caminho da notícia **alcança o serviço** (é o **controle antivácuo** — sem ele, uma borda que
   recusasse *tudo* passaria em quatro das cinco asserções);
2. `/docs`, `/v1/auth/*`, `/saude` e caminho inexistente são recusados **pela borda**, sem repasse;
3. **nenhum `3xx`**;
4. o `location` é igualdade exata;
5. a configuração de `/opt/frappe` continua **byte a byte igual**, e nenhum processo do nginx foi
   trocado.

⚠️ **Ele mede contra uma borda efêmera isolada** (nginx real, TLS real, portas altas do SO), e não
contra a borda de produção — porque a **ADR-0006** decide que *"a suíte de verificação nunca executa
contra o ambiente que atende a operação"*. Contra a produção ele só **lê**.

---

## 4. Por que o rollout não aconteceu — as três razões, e uma confusão a desfazer

⚠️ **A ADR-0006 NÃO bloqueia a instalação.** Ela governa a *suíte de verificação*. O **instalador** é
ADR-0005 e existe justamente para rodar contra o servidor real. Se alguém disser que o rollout está
bloqueado por ADR, está confundindo as duas.

As razões reais, todas operacionais:

| # | Razão | De quem é |
|---|---|---|
| 1 | **Qual hostname público atende a notícia** — a `[DÚVIDA] 4` do discovery | **decisão do usuário**; o repositório se recusa a fixar |
| 2 | **Certificado TLS para esse hostname** | emitido pelo CloudPanel, que atende a 443 hoje |
| 3 | **`sudo`** — o instalador exige `EUID 0` e `/etc/nginx` é 0700 | operação |

---

## 5. A decisão do hostname — DECIDIDA, com as razões

**Use um subdomínio dedicado. O nome está FIXADO desde 2026-08-20:**

```
webhooksicoob.sysloc.systera.com.br
```

Decisão do usuário, e o **registro A já foi criado no registro.br** apontando para este servidor.
**Não** use `sysloc.systera.com.br` — a §5.1 diz por quê.

### 5.1 Por que não o hostname do app

A §16.3 do tech spec é literal: *"**nenhum outro caminho** da API responde **por aquele hostname** —
inclusive `/docs`, `/v1/auth/*` e `/saude`"*. É a asserção 2 do `CT-1005`.

No hostname do app essa asserção é **falsa por construção** depois da virada, porque o React precisa
exatamente dessas rotas. E **hoje** seria pior: o vhost responde 404 para tudo que não seja o caminho
da notícia, então apontá-lo para `sysloc.systera.com.br` **derrubaria o app inteiro**.

### 5.2 Por que o subdomínio continua certo DEPOIS da virada

A razão original — reduzir superfície — **enfraquece**: depois da F7 a API está exposta de qualquer
modo. Mas sobram três, e a primeira é técnica e dura:

1. **O provedor recusa `3xx`.** Hostname de aplicação **acumula redirecionamento** ao longo do tempo:
   canônico `www`→apex, HSTS, barra final, redirect de sessão expirada, página de manutenção em
   deploy. Cada um quebra a integração, e quebra **em silêncio** — o banco para de entregar e você
   descobre pela cobrança que não baixou. Um vhost de 149 linhas, verificado por medição, mantém o
   invariante por construção.
2. **O eixo do limitador.** O `D27` registra que limitar por origem **descartaria rajada legítima do
   provedor**, e perder notícia é o dano que a fatia existe para não ter. Com hosts separados, na F7
   você aplica o limitador de usuário no host do app e **deixa o do webhook em paz**. Com host
   compartilhado seria exceção por caminho dentro do mesmo limitador — que quebra numa refatoração
   sem ninguém notar.
3. **A afirmação continua verificável.** A asserção 2 do `CT-1005` só existe em host dedicado.

### 5.3 O que sela a decisão: custo de troca assimétrico

**A URL fica registrada no Sicoob.** Mudá-la depois é outro chamado com o banco. Manter o subdomínio
custa **um registro DNS e um certificado que o CloudPanel renova sozinho**. Manter é barato e
contínuo; mudar é caro e depende de terceiro.

### 5.4 O que mudaria a decisão

Se o Sicoob **não aceitar** subdomínio, ou exigir que o endereço esteja no mesmo domínio registrado
no cadastro da conta. **Pergunte isso a eles** — e pergunte junto com o assunto do certificado (§8),
porque é o mesmo interlocutor e a mesma janela.

---

## 6. As duas trilhas — independentes, e nesta ordem

### TRILHA 0 — o cluster tem de estar em dia ✅ FEITO em 2026-08-19

**Confira antes de qualquer coisa**, e refaça se o repositório tiver avançado desde então:

```bash
sudo bash deploy/scripts/instalacao/verificar-migracao.sh    # esperado: 2/2 casos aprovados
sudo runuser -u postgres -- psql -X -A -t -d sysloc \
  -c "SELECT to_regclass('plataforma.notificacao_bancaria')"  # esperado: o nome da tabela, não vazio
```

⚠️ **Precedente que custou uma sessão, registrado para não se repetir.** No fecho da fatia o
`verificar-migracao.sh` reprovava em 2 de 2 casos, e o banco da operação estava na `0018` — a `0019`
e a `0020` **nunca tinham sido aplicadas**. A causa não era defeito de código: os papéis
`sysloc_resolucao` e `sysloc_roteamento` nascem no **provisionador**, nunca numa migração, e o
`provisionar-base.sh` (passo **P15**, que esta fatia ampliou) não fora reexecutado no cluster. A
`0020` abortava **limpa, dentro da transação**, com `HINT` nomeando script e passo — o guard
funcionou como projetado.

**Por que ninguém pegou durante o run, e é estrutural:** o provisionador exige `sudo`, que nenhum
agente tinha; e o banco efêmero da suíte **cria esses papéis por conta própria**, de modo que os
1710 casos ficam verdes **independentemente do estado do cluster real**. A suíte não consegue, por
construção, medir isto — só as baterias `verificar-*.sh` conseguem, e elas exigem privilégio.

**Sequência que fechou** (a ordem importa: a `0019` renomeia `negocio.cobranca.nosso_numero` para
`numero_do_titulo_no_provedor`, e serviço rodando build antigo quebra contra o schema novo):

```bash
sudo bash deploy/scripts/instalacao/provisionar-base.sh          # idempotente; cria o papel, preserva credenciais
sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh
pnpm build                                                        # o dist/ casa com o fonte ANTES do schema mudar
sudo bash deploy/scripts/instalacao/migrar-banco.sh              # ⚠️ migração de schema em banco durável
sudo systemctl restart sysloc-api sysloc-worker                   # o código em execução volta a casar
sudo bash deploy/scripts/instalacao/verificar-migracao.sh
```

### TRILHA A — publicar a borda (não depende do certificado do Sicoob)

Pode ser feita hoje, **antes da virada**, e é o que permite o webhook ir ao ar com o app velho ainda
de pé: o vhost aponta para a API nova em `127.0.0.1:3000`, sem tocar em nada do Frappe.

### TRILHA B — cadastrar o webhook no provedor

Depende de A pronta (o Sicoob precisa de URL alcançável para o pedido de validação de endereço) **e**
do certificado do provedor válido (§8).

---

## 7. TRILHA A — passo a passo

### A.0 · O subdomínio e o DNS ✅ FEITO em 2026-08-20

O nome está fixado na §5 e o **registro A já foi criado no registro.br**. Confirme a resolução:

```bash
getent ahostsv4 webhooksicoob.sysloc.systera.com.br | awk '{print $1}' | sort -u
curl -s -4 https://ifconfig.me        # o IP público deste servidor; os dois têm de ser iguais
```

⚠️ **Não use `dig`.** Ele **não existe neste host**, nem `host`, nem `nslookup` — medido em
2026-08-20. O `getent` acima consulta o resolvedor do próprio SO e não depende de pacote extra.

### A.1 · Como o CloudPanel organiza os vhosts ✅ MEDIDO em 2026-08-20

**O diretório de vhosts é `/etc/nginx/sites-enabled`**, e não o `conf.d` que o instalador assume:
o `nginx.conf` inclui `sites-enabled/*.conf` (linha 119) e **não inclui `conf.d`**, que existe mas é
morto. ⚠️ **Sem `SYSLOC_DIR_DOS_VHOSTS=/etc/nginx/sites-enabled` o instalador ABORTA** — de
propósito, listando os `include` reais.

Para remedir:

```bash
sudo ls -la /etc/nginx/
sudo grep -rn "include" /etc/nginx/nginx.conf
```

Você precisa da resposta a **uma** pergunta: *qual diretório de vhosts o `nginx.conf` inclui?*
O instalador assume `/etc/nginx/conf.d`; se for outro, informe em `SYSLOC_DIR_DOS_VHOSTS`.

O instalador **não quebra** se errar: ele **aborta listando os `include` reais**.

### A.2 · O certificado TLS do subdomínio ✅ FEITO em 2026-08-20

Criado no CloudPanel como **site estático** (nunca reverse proxy — ver o porquê abaixo), com
Let's Encrypt emitido. Medido em 2026-08-20:

| O que | Medido |
|---|---|
| Emissor | **Let's Encrypt** (`CN = YR1`), `subject CN = webhooksicoob.sysloc.systera.com.br` |
| Vigência | **2026-08-20 → 2026-11-18** |
| Cadeia | fullchain, **3 certificados** |
| Chave | casa com o certificado (mesmo módulo) |
| Certificado | `/etc/nginx/ssl-certificates/webhooksicoob.sysloc.systera.com.br.crt` |
| Chave | `/etc/nginx/ssl-certificates/webhooksicoob.sysloc.systera.com.br.key` |

**Por que estático e não reverse proxy** — é o *modo de falha* na colisão de `server_name`. Se o
vhost do CloudPanel fosse reverse proxy para a API e vencesse a disputa, a **API inteira** ficaria
exposta (`/docs`, `/v1/auth/*`, `/saude`), que é o que a asserção 2 do `CT-1005` proíbe e o que
dispara `D23`/`D24`/`D27` da F1. Estático falha **fechado**; reverse proxy falha **aberto**.

#### ⚠️ A colisão de `server_name` EXISTE, e quem vence é o nosso vhost

O CloudPanel gerou `/etc/nginx/sites-enabled/webhooksicoob.sysloc.systera.com.br.conf`, que
reivindica `80`, `443 ssl` e `443 quic` para o nome. O nosso entra como
`sysloc-notificacao-bancaria.conf` e o glob carrega em ordem alfabética —
`default.conf` → **`sysloc-notificacao-bancaria.conf`** (`-` = 0x2D) → `sysloc.systera.com.br.conf`
(`.` = 0x2E) → `webhooksicoob…`. **O nosso carrega primeiro e vence as duas portas.** O nginx ignora
o segundo em silêncio (`conflicting server name`), então **a prova é a A.5, por medição de fora** —
não a leitura da configuração.

#### ⚠️ O RISCO REAL desta trilha não é a colisão — é a RENOVAÇÃO do certificado

O vhost do CloudPanel força HTTPS com `301` (`if ($scheme != "https") { rewrite ^ ... permanent; }`),
e esse `if` é de nível *server*: roda **antes** do `location ~ /.well-known`. O desafio ACME em claro
é, portanto, redirecionado — a emissão só funcionou porque o Let's Encrypt segue redirects. Com o
nosso vhost dono da 443, `/.well-known/acme-challenge/` cai no `location / { return 404; }` e
**a renovação automática falha por volta de 2026-10-19** (os 60 dias do Let's Encrypt).

Não há arranjo de portas que resolva: o nosso vhost reivindica 80 **e** 443 e ganha as duas.
A correção é **um** `location ^~ /.well-known/acme-challenge/` com webroot configurável no bloco em
claro do gabarito versionado — mudança pequena, mas em artefato aprovado nos dois gates, e por isso
**fora do escopo desta ativação**. Está registrada como débito com gatilho **datado** na §10.

<details>
<summary>O texto original desta seção, quando o certificado ainda não existia</summary>

⚠️ **Aqui mora a única armadilha séria desta trilha — leia antes de clicar.**

Se você criar o subdomínio **como site no CloudPanel** para ele emitir o Let's Encrypt, o CloudPanel
cria o **próprio `server` block** com aquele `server_name`. Passam a existir **dois vhosts para o
mesmo nome**, e qual vence depende da ordem de carga. O instalador **não detecta** essa colisão.

Duas saídas, e a escolha depende do que a A.1 revelar:

- **(a)** Emitir o certificado **por fora** do CloudPanel (`certbot` em modo webroot/standalone) — o
  nosso vhost fica dono único do nome.
- **(b)** Deixar o CloudPanel emitir e depois **neutralizar** o vhost que ele gerou, ficando só com o
  nosso.

Em ambos os casos, anote os caminhos de `fullchain` e `privkey`.

> **Se optar por (b), confira depois:** `sudo grep -rn "server_name webhooksicoob.sysloc.systera.com.br" /etc/nginx/` deve
> devolver **uma** ocorrência.

</details>

### A.3 · Instalar

⚠️ **Recarrega o servidor de borda que atende `/opt/frappe` em produção.** O instalador valida a
configuração **inteira** (P04) antes de recarregar (P05) e desfaz a escrita se qualquer passo
terminar antes disso.

```bash
sudo SYSLOC_HOSTNAME_DA_NOTIFICACAO=webhooksicoob.sysloc.systera.com.br \
     SYSLOC_CERTIFICADO_DA_BORDA=/etc/nginx/ssl-certificates/webhooksicoob.sysloc.systera.com.br.crt \
     SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA=/etc/nginx/ssl-certificates/webhooksicoob.sysloc.systera.com.br.key \
     SYSLOC_DIR_DOS_VHOSTS=/etc/nginx/sites-enabled \
     SYSLOC_RAIZ_DO_DESAFIO_ACME=/home/systera-webhooksicoob-sysloc/htdocs/webhooksicoob.sysloc.systera.com.br \
     bash deploy/scripts/borda/instalar-borda-de-notificacao.sh
```

⚠️ **Colar isto no terminal com quebras de linha costuma falhar** — a continuação `\` se perde e o
`sudo` recebe os argumentos soltos (aconteceu em 2026-08-20). Ponha as variáveis num script e rode
`sudo bash <script>`, ou grave-as no `backend.env`.

⚠️ **`SYSLOC_RAIZ_DO_DESAFIO_ACME` é obrigatória** desde 2026-08-20, e o instalador **aborta** sem
ela. É o webroot de quem administra o certificado — sem ele a borda responde `404` ao desafio de
posse do domínio e a **renovação falha em silêncio**. Ver a §A.6.

⚠️ **Não meça logo depois do P05.** `nginx -s reload` é assíncrono: os workers antigos terminam as
conexões em curso antes de os novos assumirem, e um `curl` imediato é atendido pela configuração
VELHA. Foi o que produziu um falso `404` em 2026-08-20 e custou um ciclo de diagnóstico. Sonde com
limite declarado.

Alternativa permanente: gravar as três chaves em `/etc/sysloc/backend.env` (modo 0600) —
`HOSTNAME_DA_NOTIFICACAO_BANCARIA`, `CERTIFICADO_DA_BORDA`, `CHAVE_DO_CERTIFICADO_DA_BORDA`.
Se o diretório de vhosts não for o padrão, acrescente `SYSLOC_DIR_DOS_VHOSTS=<dir>`.

⚠️ **Chave duplicada no `backend.env`**: o leitor do instalador toma a **primeira** ocorrência,
enquanto o systemd toma a **última** (débito `D38 · T11` da §2 do run-report). Não duplique chave.

### A.6 · Precedência de `server_name` — leia ANTES de achar que entendeu

**Precedência não é uma fila global de sites.** Ela só existe entre vhosts que declaram o **mesmo
`server_name` na mesma porta**. Fora disso não significa nada, e o `000-` do nosso arquivo não
interfere em site nenhum.

Estado medido em 2026-08-20:

| Nome | Quantos vhosts o declaram | Disputa? |
|---|---|---|
| `sysloc.systera.com.br` | 1 (CloudPanel) | não |
| `www.systera.com.br` | 1 (CloudPanel) | não |
| `systera.com.br` | 1 (CloudPanel) | não |
| **`webhooksicoob.sysloc.systera.com.br`** | **2** (CloudPanel **+** o nosso) | **sim** |

**Por que só o nosso disputa**: é o único nome para o qual **duas ferramentas** geram configuração —
o CloudPanel, porque precisamos que ele emita e renove o certificado; e o nosso instalador, porque
precisamos das garantias do vhost versionado. Todo site comum tem um gerador só.

Quando dois vhosts disputam, o nginx **fica com o primeiro que carrega** (ordem lexicográfica do
`include`) e ignora o outro com um `[warn]` que ninguém lê. Perder é **invisível**: o `nginx -t`
passa, o serviço sobe, e o provedor simplesmente deixa de ser atendido.

**As duas defesas, e o que cada uma faz:**

1. **`000-` no nome do arquivo instalado** — torna a precedência **declarada**. Antes ela dependia
   de `sysloc-` ordenar antes de `webhooksicoob…`, o que era verdade **por acidente**. ⚠️ Não remova
   o prefixo: a razão está escrita no instalador, junto da constante.
2. **P03-B, no instalador** — lista todos os vhosts que declaram o hostname, **em ordem de carga**, e
   **aborta** se o primeiro não for o nosso, nomeando quem está vencendo. Também aborta se
   **ninguém** declarar o nome (controle antivácuo). É o que garante que nenhuma inversão futura
   passe em silêncio — inclusive as que não previmos.

**E no futuro?**

- **Site novo comum** (loja, blog, API de terceiro): só o CloudPanel gera aquele nome. **Sem
  disputa**, precedência irrelevante. Nosso vhost não é `default_server` e declara **um** nome só.
- **Segundo webhook** (outro banco): aquele nome terá a **própria** disputa, com o vhost do
  CloudPanel dele, resolvida pelo mesmo padrão. Os dois vhosts do Sysloc **não competem entre si** —
  nomes diferentes, disputas separadas; dois arquivos `000-` não brigam. ⚠️ O que **falta** para
  esse caso é outra coisa: `NOME_DO_VHOST` é fixo, então instalar um segundo hostname
  **sobrescreveria** o primeiro. Ver a §10.

### A.4 · Provar por medição

```bash
sudo bash deploy/scripts/borda/verificar-notificacao-bancaria.sh
```

Deve sair **exit 0, 4/4 frentes**. Se alguma frente reprovar, **não prossiga** — a mensagem nomeia a
asserção.

### A.5 · Provar de fora, do jeito que o provedor verá

De **outra máquina** (não deste servidor):

```bash
curl -i -X POST https://webhooksicoob.sysloc.systera.com.br/v1/notificacoes-bancarias \
     -H 'content-type: application/json' -d '{}'
# esperado: 204, sem corpo, SEM redirecionamento

curl -i https://webhooksicoob.sysloc.systera.com.br/docs
curl -i https://webhooksicoob.sysloc.systera.com.br/v1/auth/get-session
curl -i https://webhooksicoob.sysloc.systera.com.br/saude
# esperado nos três: 404 da borda
```

⚠️ **Confira que não há `3xx` em nenhuma resposta.** É o requisito do Sicoob.

---

## 8. TRILHA B — o certificado do provedor e o cadastro

### 8.1 O certificado do provedor — ⚠️ A PREMISSA DESTA SEÇÃO FOI REFUTADA em 2026-08-20

**Não há certificado nenhum registrado.** `negocio.certificado_do_provedor` tem **0 linhas**, medido
em 2026-08-20 por consulta como `postgres` (que ignora RLS, de modo que não é filtro de tenant).

E não é esquecimento: **o banco da operação está vazio por decisão** — 0 empresas, 0 usuários,
0 imóveis, 0 contratos, 0 cobranças. O `plano-execucao.md` §F7 item 2 registra *"recadastro pelo
app — o usuário confirmou que os dados atuais não estão em uso. Não há migração de dados a fazer."*

**Consequência para a TRILHA B**: ela não está bloqueada por um certificado a vencer, e sim por
**sequenciamento**. O certificado pertence a uma empresa (`empresa_id`), então a ordem é:

1. cadastrar **uma empresa** no produto novo;
2. registrar o **`.pfx` do Sicoob** nela (`certificado.controller.ts` — registro, consulta, verificação);
3. só então cadastrar o webhook no portal.

Cadastrar o webhook antes disso não quebra nada — a notícia chega, é gravada crua e descartada como
órfã pela RN-06, sem consulta ao provedor —, mas também não fecha ciclo nenhum.

<details>
<summary>O texto original, escrito quando se supunha o certificado registrado e a vencer</summary>

O certificado **mTLS do Sicoob** (não o TLS da borda) vencia em **2026-08-22**, medido em 2026-08-16.
Ele vive **cifrado no banco** (ADR-0032) e **nunca retorna por superfície alguma**.

**A renovação é auto-serviço no produto**: `apps/api/src/integracoes-bancarias/certificado.controller.ts`
já expõe registro, consulta e verificação. O que falta **não é código** — é o `.pfx` novo do Sicoob,
que é conversa com o banco.

**Remeça a validade antes de qualquer coisa** (a rota de consulta devolve a vigência; o material
nunca sai). Se já venceu ou está a vencer, isso é urgente **independentemente do webhook**: emissão e
consulta de situação param sem ele.

</details>

### 8.2 Cadastrar o webhook no portal do Sicoob

⚠️ **ANTES DE CADASTRAR, confirme com o Sicoob se o cadastro é ÚNICO por conta.** Se for, e se já
houver um endereço cadastrado hoje, apontá-lo para cá **tira a notícia de quem a recebe agora** — e
o `/opt/frappe` segue operando o ciclo de cobrança real até a F7. Perder baixa em produção é dano
maior que adiar o webhook. Verifique o que está cadastrado hoje antes de sobrescrever.

Ato operacional seu, no portal do provedor. Informe a URL:

```
https://webhooksicoob.sysloc.systera.com.br/v1/notificacoes-bancarias
```

O provedor envia um **pedido de validação de endereço**. O produto já o reconhece **antes de qualquer
roteamento** (US-11) — não é preciso fazer nada além de o endereço estar no ar.

### 8.3 Perguntas para levar ao Sicoob na mesma conversa

1. O `.pfx` novo — prazo e como obtê-lo.
2. **Subdomínio é aceito** como endereço de notificação, ou o endereço precisa estar no domínio do
   cadastro da conta? (§5.4 — é o que poderia mudar a decisão do hostname)
3. Há faixa de IPs de origem das notificações? (habilitaria o limitador do `D27` sem risco de
   descartar rajada legítima)
4. Qual o comportamento de reentrega quando o endereço não responde.

---

## 9. Rollback

**Remover a entrada do vhost e recarregar.** O produto volta a ser inalcançável de fora e **nada mais
precisa ser desfeito**. A migração **não** é revertida — migração é imutável neste projeto.

Não há *feature flag*: a reversibilidade é obtida **por infraestrutura**, e isso é decisão registrada.

---

## 10. Riscos e débitos que vão aparecer

| Item | O que é | Conduta |
|---|---|---|
| **Colisão de `server_name`** | CloudPanel gerando vhost para o mesmo nome (§A.2) | conferir com `grep server_name`; é o risco sério da trilha A |
| **`D27 · F4/T11`** | ✅ **FECHADO em 2026-08-26** — o vhost passou a limitar por **concorrência por origem** (ADR-0037), e segue **sem teto de taxa**, que é decisão e não esquecimento | nada a fazer no rollout. As quatro frentes que o provam vivem em `verificar-notificacao-bancaria.sh` (`CT-1191` a `CT-1194`); o resíduo aceito é que a notícia forjada ainda custa uma escrita pequena no cru, expurgada por idade |
| **`D30`** | a borda repassa `X-Forwarded-For` **acumulado**; `X-Real-IP` é o valor confiável | inofensivo hoje (ninguém consome); importa quando a F7 escrever o limitador |
| **`D29`** | a borda **efêmera do teste** liga `0.0.0.0` em vez do laço local | só afeta a bateria; produz falso negativo, nunca falso positivo |
| **`D31`** | janela residual de microssegundos entre a escrita e o estado `ESCRITA_PENDENTE` | correção sugerida: ligar o estado **antes** de chamar `posicionar_vhost` |
| **`D23`/`D24`/`D27` (F1)** | **não disparam** com host dedicado — medido | ⚠️ **disparam imediatamente** se o webhook for para o host do app |
| **Quem vence a disputa de `server_name`** | ✅ **TRATADO em 2026-08-20** — a precedência era acidental e virou **declarada** (`000-` no nome instalado), e o **P03-B** aborta a instalação se outro vhost vencer, nomeando-o. Ver §A.6 | resta o monitoramento periódico: as defesas agem **na instalação**, e uma inversão criada depois dela só aparece na próxima execução ou por medição de fora |
| **Um hostname só** | `NOME_DO_VHOST` é `readonly` no instalador: rodar com um segundo hostname **sobrescreve** o vhost do primeiro, em vez de criar outro | não é limitação de vhost apenas — a rota é uma (`/v1/notificacoes-bancarias`) e o domínio modela **um** provedor. Multi-banco é mudança de escopo, não de configuração |
| **Renovação do Let's Encrypt** | ✅ **RESOLVIDO em 2026-08-20** — o bloco em claro passou a servir `/.well-known/acme-challenge/` do webroot do gestor do certificado, e o caminho está **provado por medição em produção** (o desafio volta com o conteúdo exato). O contorno é medido junto: inexistente `404`, sob TLS `404`, `/.well-known` de outra coisa `404` | conferir a vigência antes de **2026-10-19**, que é quando a primeira renovação real acontece — a prova de hoje é do caminho, não de uma renovação de verdade |
| **R9** | primeira publicação do produto para fora | mitigado pelo verificador, que afirma por medição |

Detalhe de cada um: §2 do `docs/specs/features/webhook-e-carne/v1/_run/run-report.md`.

---

## 11. Critério de pronto

- [x] Registro A do subdomínio resolvendo para este servidor ✅ 2026-08-20
- [x] Certificado TLS emitido ✅ 2026-08-20 — ⚠️ **COM** colisão de `server_name`, resolvida por ordem de carga a nosso favor e provada por medição (§10)
- [x] Instalador rodado, idempotente ✅ 2026-08-20 — 2ª execução: `0 passo(s) com mudança, 2 já correto(s)`, hash do vhost idêntico
- [x] `verificar-notificacao-bancaria.sh` — **exit 0, 4/4 frentes** ✅ 2026-08-20, antes e depois da instalação
- [x] Prova de fora ✅ 2026-08-20 — `204` na notícia, `404` nos quatro vizinhos, **nenhum `3xx`**; e o `GET` pelo celular devolveu o envelope da **ADR-0017** (`RECURSO_NAO_ENCONTRADO`), que é a API respondendo: o caminho externo fecha ponta a ponta
- [x] Configuração de `/opt/frappe` **byte a byte igual** ✅ 2026-08-20 — provado duas vezes: SHA-256 dos 5 arquivos antes/depois e a frente (d) do CT-1005
- [ ] Certificado **da borda** com vigência conferida — e a conferência repetida antes de 2026-10-19:
      `openssl x509 -in /etc/nginx/ssl-certificates/webhooksicoob.sysloc.systera.com.br.crt -noout -dates`
- [ ] Certificado do provedor **válido** (renovado se preciso)
- [ ] Webhook cadastrado no portal do Sicoob e **validação de endereço respondida**
- [ ] **Uma notificação real recebida e liquidada** — é a medição que o risco R2 espera, e a única
      prova de que o identificador volta íntegro pelo caminho da notícia

---

## 12. Onde está o resto

| O quê | Onde |
|---|---|
| Débitos da fatia (42, nenhum bloqueante) | `docs/specs/features/webhook-e-carne/v1/_run/run-report.md` §2 |
| Notas para revisão humana | idem, §4 |
| Telemetria do run | idem, `_run/workflow-report.md` |
| A task que construiu a borda | `docs/specs/features/webhook-e-carne/v1/tasks/T11.md` |
| O desenho da entrada | `docs/specs/features/webhook-e-carne/v1/tech_spec.md` §16.3, §16.4, §16.6, §19.3-D, §20-R9 |
| ADRs vinculantes | **0005** (instalação idempotente, sem credencial), **0006** (a verificação não roda contra a operação), **0035** (entrada de fato de terceiro), **0011** (rotas com sessão inalcançáveis de fora) |

⚠️ **Citar ADR exige abrir a `Decision`** — o `INDEX.md` e o `CLAUDE.md` são paráfrases e já
divergiram do texto real.
