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

### 3.1 `deploy/nginx/sysloc-notificacao-bancaria.conf` — o vhost (149 linhas)

- `location =` **exato** para `/v1/notificacoes-bancarias` — igualdade, nunca prefixo.
- **Tudo o mais responde `404`, pela própria borda**, sem repassar ao serviço.
- HTTPS na 443, TLS 1.2+. Aponta para a API em `127.0.0.1`.
- ⚠️ **Nenhum redirecionamento**, em hipótese alguma — o Sicoob reprova `3xx`. O bloco em claro
  **recusa** em vez de redirecionar, e há `proxy_redirect off`.
- **Nenhuma credencial** no arquivo (ADR-0005): ele carrega o *caminho* do certificado, nunca o
  material.
- `server_tokens off` e `client_max_body_size 64k`, espelhando `MAIOR_CORPO_ACEITO` de
  `apps/api/src/main.ts`.
- Carrega o marcador `DÉBITO COM GATILHO — D27 · F4/T11` (o vhost publica e **não há limitador**).

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

**Use um subdomínio dedicado.** Por exemplo `webhook.sysloc.systera.com.br` ou
`notificacoes.systera.com.br`. **Não** use `sysloc.systera.com.br`.

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

### A.0 · Decidir o subdomínio e criar o DNS

Escolha o nome (§5) e crie o **registro A** apontando para o IP deste servidor. Confirme:

```bash
dig +short <hostname-escolhido>
```

### A.1 · Descobrir como o CloudPanel organiza os vhosts

⚠️ **Passo obrigatório e ainda não feito** — `/etc/nginx` é 0700 e o run não conseguiu medir.

```bash
sudo ls -la /etc/nginx/
sudo grep -rn "include" /etc/nginx/nginx.conf
```

Você precisa da resposta a **uma** pergunta: *qual diretório de vhosts o `nginx.conf` inclui?*
O instalador assume `/etc/nginx/conf.d`; se for outro, informe em `SYSLOC_DIR_DOS_VHOSTS`.

O instalador **não quebra** se errar: ele **aborta listando os `include` reais**.

### A.2 · Obter o certificado TLS do subdomínio

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

> **Se optar por (b), confira depois:** `sudo grep -rn "server_name <hostname>" /etc/nginx/` deve
> devolver **uma** ocorrência.

### A.3 · Instalar

```bash
sudo SYSLOC_HOSTNAME_DA_NOTIFICACAO=<hostname> \
     SYSLOC_CERTIFICADO_DA_BORDA=/caminho/fullchain.pem \
     SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA=/caminho/privkey.pem \
     bash deploy/scripts/borda/instalar-borda-de-notificacao.sh
```

Alternativa permanente: gravar as três chaves em `/etc/sysloc/backend.env` (modo 0600) —
`HOSTNAME_DA_NOTIFICACAO_BANCARIA`, `CERTIFICADO_DA_BORDA`, `CHAVE_DO_CERTIFICADO_DA_BORDA`.
Se o diretório de vhosts não for o padrão, acrescente `SYSLOC_DIR_DOS_VHOSTS=<dir>`.

⚠️ **Chave duplicada no `backend.env`**: o leitor do instalador toma a **primeira** ocorrência,
enquanto o systemd toma a **última** (débito `D38 · T11` da §2 do run-report). Não duplique chave.

### A.4 · Provar por medição

```bash
sudo bash deploy/scripts/borda/verificar-notificacao-bancaria.sh
```

Deve sair **exit 0, 4/4 frentes**. Se alguma frente reprovar, **não prossiga** — a mensagem nomeia a
asserção.

### A.5 · Provar de fora, do jeito que o provedor verá

De **outra máquina** (não deste servidor):

```bash
curl -i -X POST https://<hostname>/v1/notificacoes-bancarias \
     -H 'content-type: application/json' -d '{}'
# esperado: 204, sem corpo, SEM redirecionamento

curl -i https://<hostname>/docs
curl -i https://<hostname>/v1/auth/get-session
curl -i https://<hostname>/saude
# esperado nos três: 404 da borda
```

⚠️ **Confira que não há `3xx` em nenhuma resposta.** É o requisito do Sicoob.

---

## 8. TRILHA B — o certificado do provedor e o cadastro

### 8.1 O certificado que vence — o item com prazo real

O certificado **mTLS do Sicoob** (não o TLS da borda) vencia em **2026-08-22**, medido em 2026-08-16.
Ele vive **cifrado no banco** (ADR-0032) e **nunca retorna por superfície alguma**.

**A renovação é auto-serviço no produto**: `apps/api/src/integracoes-bancarias/certificado.controller.ts`
já expõe registro, consulta e verificação. O que falta **não é código** — é o `.pfx` novo do Sicoob,
que é conversa com o banco.

**Remeça a validade antes de qualquer coisa** (a rota de consulta devolve a vigência; o material
nunca sai). Se já venceu ou está a vencer, isso é urgente **independentemente do webhook**: emissão e
consulta de situação param sem ele.

### 8.2 Cadastrar o webhook no portal do Sicoob

Ato operacional seu, no portal do provedor. Informe a URL:

```
https://<hostname>/v1/notificacoes-bancarias
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
| **`D27 · F4/T11`** | o vhost publica e **não há limitador de abuso** | **deliberado**. Fecha na F7, quando o eixo de origem existir. Custo por notícia forjada: uma escrita pequena e **zero** consultas ao provedor |
| **`D30`** | a borda repassa `X-Forwarded-For` **acumulado**; `X-Real-IP` é o valor confiável | inofensivo hoje (ninguém consome); importa quando a F7 escrever o limitador |
| **`D29`** | a borda **efêmera do teste** liga `0.0.0.0` em vez do laço local | só afeta a bateria; produz falso negativo, nunca falso positivo |
| **`D31`** | janela residual de microssegundos entre a escrita e o estado `ESCRITA_PENDENTE` | correção sugerida: ligar o estado **antes** de chamar `posicionar_vhost` |
| **`D23`/`D24`/`D27` (F1)** | **não disparam** com host dedicado — medido | ⚠️ **disparam imediatamente** se o webhook for para o host do app |
| **R9** | primeira publicação do produto para fora | mitigado pelo verificador, que afirma por medição |

Detalhe de cada um: §2 do `docs/specs/features/webhook-e-carne/v1/_run/run-report.md`.

---

## 11. Critério de pronto

- [ ] Registro A do subdomínio resolvendo para este servidor
- [ ] Certificado TLS emitido, **sem** colisão de `server_name` (uma ocorrência no `grep`)
- [ ] Instalador rodado, idempotente (rodar duas vezes não muda nada)
- [ ] `verificar-notificacao-bancaria.sh` — **exit 0, 4/4 frentes**
- [ ] Prova de fora: `204` no caminho da notícia, `404` nos quatro vizinhos, **nenhum `3xx`**
- [ ] Configuração de `/opt/frappe` **byte a byte igual** (a asserção 5 do CT-1005 prova)
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
