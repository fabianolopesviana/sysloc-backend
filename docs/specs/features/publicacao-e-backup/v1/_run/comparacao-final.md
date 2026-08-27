# Comparação final — `publicacao-e-backup/v1` · T11

> **Data da medição**: 2026-08-26 · **Host**: `brutus` · **Identidade**: `sysloc`
> **Revisão do repositório**: `111448f4def9b090886ce91486f553e2c364e7fe` (`main`, mais a árvore da
> fatia ainda não commitada)
>
> **O que este documento é.** É o **P5** do Protocolo Antirregressão
> (`.claude/rules/nao-regressao.md`) materializado: a comparação **caso a caso** contra a linha de
> base da T1 (`_run/linha-de-base.md`), que é o P1. É a metade que dá sentido à outra — *baseline
> sem comparação é medição desperdiçada*, e sem ela o run perde a capacidade de distinguir *"já
> estava vermelho"* de *"eu quebrei"*.
>
> **Veredito, antes de qualquer detalhe: NENHUM caso que estava verde ficou vermelho, nos dois
> eixos.** Nenhum pacote encolheu, nenhuma bateria que saía `0` passou a sair `1`, e nenhum caso
> sumiu.
>
> **Conformidade com a ADR-0006.** Nenhuma medição desta passada executou contra o ambiente que
> atende a operação: as nove suítes sobem instância efêmera própria, e as baterias que exigiriam o
> banco durável degradaram declarando, sem tocá-lo.

---

## 0. Os dois eixos NÃO se somam — leia antes de comparar qualquer número

A §2.2 da linha de base já fixa isto, e a T11 o reafirma porque é aqui que a tentação aparece:

| Eixo | Unidade | Total na T1 | Total na T11 | O que ele alcança |
|---|---|---|---|---|
| Suíte automatizada (Vitest) | **caso** | **1943** | **1987** | o código do produto, contra instância efêmera própria |
| Baterias de shell | **asserção** (`OK`) | **869** (11 baterias, 3 delas sob privilégio) | **1225** (11 baterias executadas, **sem** privilégio) | o **estado do host** — unidades, borda, migração aplicada, ambiente |

⚠️ **Os dois totais de asserção NÃO são comparáveis entre si**, e a razão é nomeada na §1: os
conjuntos executados são **diferentes**. A comparação legítima é **bateria a bateria**, e é a da §1.

---

## 1. As 14 baterias de shell — quadro caso a caso

**Apuração por DESCOBERTA, afirmada antes de qualquer comparação: `14`.** Nunca um número fixo.

```bash
find deploy/scripts -name 'verificar-*.sh' | sort | wc -l    # 14, medido em 2026-08-26
```

⚠️ **Eram 11 na T1, e a fatia acrescentou TRÊS**: `backup/verificar-backup.sh` (T2/T3/T5),
`instalacao/verificar-unidades-agendadas.sh` (T6) e `borda/verificar-borda-do-app.sh` (T9). O
conjunto descoberto é **igual, nos dois sentidos**, à cancela `BATERIAS_DECLARADAS` de
`deploy/scripts/backup/verificar-backup.sh`, que o `CT-1119` afirma por igualdade — não há bateria
descoberta fora da cancela nem linha de cancela sem bateria.

### 1.1 Como cada bateria foi executada, e por que não pelo agregador

`deploy/scripts/verificacao/rodar-baterias.sh` **recusa `EUID != 0`** (linha 74), e `sudo -n` falha
neste host — medido nesta sessão: `sudo: a password is required`. **Não se cria caminho degradado**:
o privilégio é a pré-condição, não o obstáculo. Cada bateria foi executada **diretamente**, uma a
uma, e o veredito foi computado com o **critério literal do agregador** (linhas 170 a 190), para que
a comparação contra a T1 seja de igual para igual:

```bash
ok=$(grep -c '^    OK ' "$log");  falhou=$(grep -c '^    FALHA' "$log")
# PRE-CONDICAO  ⇔  codigo != 0  E  ok == 0  E  falhou == 0  E  frase de pré-condição no diário
# 0 → APROVADA · 2 → SAUDE-DA-SUITE · 124 → ESTOUROU · demais → REPROVADA
```

### 1.2 O quadro

| # | Bateria | T1 · veredito | T1 · OK | T11 · veredito | T11 · OK | T11 · FALHA | Leitura |
|---|---------|---------------|---------|----------------|----------|-------------|---------|
| 1 | `verificar-notificacao-bancaria` | `APROVADA` | 148 | `APROVADA` (0) | **187** | 0 | +39 asserções, todas da **T10** (`CT-1191` a `CT-1194`) |
| 2 | `verificar-captura` | `PRE-CONDICAO` | 0 | `PRE-CONDICAO` (1) | 0 | 0 | **idêntico** — o site efêmero do legado segue de pé por decisão do operador |
| 3 | `verificar-golden` | `APROVADA` | 114 | `APROVADA` (0) | 114 | 0 | inalterado |
| 4 | `verificar-guarda-de-boletos` | `APROVADA` | 13 | `APROVADA` (0) | 13 | 0 | inalterado |
| 5 | `verificar-preparacao-do-material` | `APROVADA` | 11 | `APROVADA` (0) | 11 | 0 | inalterado |
| 6 | `verificar-isolamento-de-verificacao` | `APROVADA` | 38 | `APROVADA` (0) | 38 | 0 | inalterado |
| 7 | `verificar-apuracao-versao` | `APROVADA` | 83 | `APROVADA` (0) | 83 | 0 | inalterado |
| 8 | `verificar-fundacao` | `APROVADA` (root) | 88 | **não executada** | — | — | exige privilégio · **janela (a)** |
| 9 | `verificar-migracao` | `APROVADA` (root) | 118 | **não executada** | — | — | exige privilégio · **janela (a)** |
| 10 | `verificar-provisionamento` | `APROVADA` (root) | 185 | **não executada** | — | — | exige privilégio · **janela (a)** |
| 11 | `verificar-workspace` | `APROVADA` | 71 | `APROVADA` (0) | 71 | 0 | ⚠️ ver §7.1 — esteve **vermelha** no meio da fatia e foi corrigida |
| 12 | `verificar-backup` | **não existia** | — | `SAUDE-DA-SUITE` (2) | **408** | 0 | 24/24 casos sem falha; o `2` é pré-condição de privilégio, **não** reprovação |
| 13 | `verificar-borda-do-app` | **não existia** | — | `SAUDE-DA-SUITE` (2) | **194** | 0 | 12/12 casos sem falha, 1 degradação declarada |
| 14 | `verificar-unidades-agendadas` | **não existia** | — | `SAUDE-DA-SUITE` (2) | **106** | 0 | 8/8 casos sem falha, 3 degradações declaradas |

**Soma dos `OK` das 11 executadas: 1225. `FALHA` somando todas: `0`.**

### 1.3 As três leituras que o quadro exige, e nenhuma delas é "regressão"

1. **Nenhuma bateria que saía `0` saiu `1`.** É o critério de reprovação do fecho (`CT-1197`), e ele
   está satisfeito **item a item**: das oito que a T1 executou sem privilégio, sete saíram `0` de
   novo e a oitava (`verificar-captura`) saiu `PRE-CONDICAO` nas duas medições.
2. **`PRE-CONDICAO` NÃO é vermelho, e contá-la como tal daria falso negativo.** `verificar-captura`
   executou **zero** asserções — abortou antes de provar o que quer que fosse —, e a última linha do
   diário é literalmente a mesma da T1: `ERRO: o site caracterizacao.localhost precisa estar de pé`.
3. **`SAUDE-DA-SUITE` (código `2`) é o idioma que a `testing-stack.md` fixa** para *"o que se prova
   está íntegro, e o único vermelho é a saúde do ambiente deste host"*. As três baterias novas saem
   `2` de forma **estável e declarada**, cada uma nomeando a frente que ficou por medir e o comando
   que a mediria. Confundi-la com reprovação é o que faz vermelho legítimo virar ruído.

### 1.4 As três privilegiadas — declaração, não simulação

`verificar-fundacao`, `verificar-migracao` e `verificar-provisionamento` **não foram executadas
nesta passada**, e este documento **não finge medi-las**. Elas saíram `APROVADA` na janela assistida
da T1 (2026-08-25, 16:08:19), e a fatia **não tocou** o que elas provam pelo eixo do host — com uma
exceção nomeada: `deploy/scripts/instalacao/instalar-unidades.sh` ganhou as 2 unidades do backup, e
é exatamente isso que a **janela (a)** da §8 reexecuta. O comando é
`sudo bash deploy/scripts/verificacao/rodar-baterias.sh --com-agregador` — ⚠️ **com** o argumento,
sem o qual o `verificar-fundacao.sh` fica fora do conjunto (achado `A1` da T1).

---

## 2. Os 9 pacotes da suíte — medidos um a um, e comparados

**Comando**: o script `test` de cada pacote, em série, com instância efêmera própria. ⚠️ O agregador
do monorepo **não** foi usado e não pode ser: ele aborta os pacotes irmãos e a saída agregada não é
confiável.

| Pacote | T1 (2026-08-25) | T11 (2026-08-26) | Δ | Código | A quem o delta pertence |
|--------|-----------------|------------------|---|--------|--------------------------|
| `contracts` | 438 | **438** | 0 | 0 | — |
| `api` | 394 | **410** | +16 | 0 | **T7** (+15: `CT-1160` a `CT-1166`, mais 1 que a tabela do `CT-007` passou a exercitar sozinha) e **+1** anterior à fatia, escriturado na T8 |
| `shared` | 271 | **295** | +24 | 0 | **T5** (+5, até 276) e **T11** (+19: `CT-1196` e `CT-1198`) |
| `db` | 268 | **268** | 0 | 0 | — |
| `worker` | 180 | **180** | 0 | 0 | — |
| `documentos` | 159 | **159** | 0 | 0 | — |
| `auth` | 89 | **93** | +4 | 0 | **T8** (`CT-1167`, `CT-1168` e as 2 pernas do `CT-1170`) |
| `cobranca-bancaria` | 114 | **114** | 0 | 0 | — |
| `regua` | 30 | **30** | 0 | 0 | — |

**Soma conferida**: `438 + 410 + 295 + 268 + 180 + 159 + 93 + 114 + 30` = **1987**.
**Total medido**: **1987**. Os dois números são iguais, e é assim que o `CT-1199` os exige.

**Casos pulados, em quarentena ou marcados como pendentes: `0`** — nenhuma ocorrência de `skipped`
nem de `todo` em nenhum dos nove diários, igual à T1.

⚠️ **Nenhum pacote encolheu.** Contagem que diminui significa teste que sumiu, e é regressão de
prova (**R2**) — a comparação acima é a que a pegaria.

⚠️ **O delta do `shared` desta task é 19, e ele é FINAL**: `CT-1196` contribui **7** (a extração dos
três eixos, as 3 pernas de igualdade e as 3 falsificações) e `CT-1198` contribui **12** (as 6 pernas
dos débitos fechados, as 2 dos homônimos, a contagem do índice e as 3 falsificações). Os dois
entraram como `describe` **novos**: alterar os existentes é protegido pelo `CT-902`, que confere
contagem exata (5 passos, 3 formas, 7 proibições).

**Diários preservados** (não versionados): a medição dos nove e a das baterias ficaram em
`/tmp/claude-1000/-opt-sysloc-backend/4c7c3820-.../scratchpad/`, com um `.log` por item e
`vereditos.txt`/`resumo.txt` carregando o código de saída e a duração de cada um.

---

## 3. A superfície — `106 / 91 / 20`, e agora com rede

**As três constantes executáveis foram LIDAS, nunca redigitadas:**

```bash
grep -nE '^const (ROTAS_PUBLICADAS_EM_PRODUCAO|MANIPULADORES_EXAMINADOS_EM_PRODUCAO|PARES_PUBLICOS_DA_SUPERFICIE)' \
  apps/api/test/cobertura-de-autorizacao.e2e.spec.ts
# 2438:const ROTAS_PUBLICADAS_EM_PRODUCAO = 106;
# 2808:const MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 91;
# 3161:const PARES_PUBLICOS_DA_SUPERFICIE = 20;
```

**A âncora NÃO foi alterada** (decisão 1 do scope): a fatia não publica, remove nem altera rota, e o
congelamento da superfície — item 2 do marco de entrega — segue alcançado.

**O que a T11 acrescenta é a rede que faltava.** O `CT-1196`
(`packages/shared/test/protocolo-antirregressao.spec.ts`) **lê** os três números narrados no
`CLAUDE.md` e as três constantes, e afirma a igualdade **eixo a eixo**. Medido: **nenhuma suíte
fazia isso**, e a linha narrativa já divergiu **quatro vezes** (75/77, 99/84, 103/88, 105/90), mais
uma quinta no nome de um campo (`versao_permissoes` por `versaoPermissoes`), todas refutadas por
medição **depois** de terem sido escritas. A partir de agora a divergência fica **vermelha na
suíte**, com a mensagem nomeando o eixo e os dois valores.

---

## 4. O índice de débito — conferido nos DOIS sentidos

### 4.1 A medição

```bash
# marcadores vivos, no identificador canônico da §3-B
grep -rhoE "DÉBITO COM GATILHO — (D[0-9]+ · F[0-9]+/[A-Za-zç]+[0-9]*)" \
  --exclude-dir=dist --exclude-dir=node_modules apps packages deploy | sort -u    # 39

# linhas da tabela do índice
grep -cE '^\| \*\*(D[0-9]+)\*\* \((F[0-9]+/[A-Za-zç]+[0-9]*)' CLAUDE.md            # 38
```

**39 − 1 = 38, e a subtração está certa**: o trigésimo nono é a **fixture `D99 · F7/T3`**, que vive
só em `packages/shared/test/protocolo-antirregressao.spec.ts` e que o próprio `CT-907` exclui da
varredura por decisão registrada no cabeçalho dele. **Os dois conjuntos são iguais**, e as duas
pontas fecham:

1. **marcador → índice**: todo marcador vivo tem linha na tabela do `CLAUDE.md`;
2. **índice → marcador**: toda linha da tabela tem marcador vivo no código.

### 4.2 Os SEIS débitos que a fatia fechou — cada um pelo **par**, nas duas pontas

| Par | Fechado por | Marcadores | Linhas de índice |
|---|---|---|---|
| `D9 · F0/T2` | T5 | 0 | 0 |
| `D23 · F1/T8` | T7 | 0 | 0 |
| `D27 · F1/T6` | T8 | 0 | 0 |
| `D24 · F1/T5` | T9 | 0 | 0 |
| `D39 · F7/T8` | T9 | 0 | 0 |
| `D27 · F4/T11` | T10 | 0 | 0 |

### 4.3 Os homônimos que sobreviveram — e é isto que discrimina

| Par | Marcadores | Linhas | Por que ele NÃO podia sair junto |
|---|---|---|---|
| `D23 · F0/T3` | ≥ 1 | 1 | o código sob o marcador está protegido por **duas `DECISÃO FECHADA`**; fechar `D23` pelo número o levaria junto, e isso é violação crítica |
| `D26 · F3/T8` | ≥ 1 | 1 | o `D26 · F4/T9` fechou em 2026-08-23, noutra fatia; o par sobrevivente é outro débito |

⚠️ **Nenhum `D27` sobrevive**: a T8 fechou o `D27 · F1/T6` e a T10 fechou o `D27 · F4/T11`. O par
homônimo acabou, e a prosa do `CLAUDE.md` já o registra corretamente — conferido nesta passada.

**O `CT-1198` é a rede permanente disto, e ele NÃO duplica o `CT-907`**: aquele prova a coerência
**genérica** e ficaria **verde** se a fatia tivesse apagado marcador e linha do débito **errado**.

### 4.4 Os dois débitos que a fatia ABRIU

| Par | Onde | Gatilho |
|---|---|---|
| `D40 · F7/T9` | `deploy/scripts/borda/verificar-borda-do-app.sh` (`subir_borda_efemera`) | a terceira borda pública, ou a primeira task autorizada a abrir `verificar-notificacao-bancaria.sh` **para mexer no acessório** — ⚠️ gatilho **emendado** em 2026-08-26 |
| `D41 · F7/T9` | `deploy/scripts/borda/verificar-borda-do-app.sh` (`DESTINO_DECLARADO_DO_EMAIL`) | a troca do `SMTP_URL` para o destino real |

---

## 5. Divergências medidas contra a spec da T11 — declaradas, não silenciadas

O precedente do repositório, confirmado cinco vezes, é que **prescrição de spec é hipótese, não
ordem**: o executor que divergiu **declarando e medindo** teve razão em todas. Estas são as quatro
divergências desta task, todas com o valor medido e o comando que o produziu.

| # | O que a spec dizia | O que a medição diz | Conduta adotada |
|---|---|---|---|
| 1 | §5.6 do `CT-1198`: *"Índice: **41 linhas antes, 36 depois** — contagem afirmada"* | **38** linhas depois (comando na §4.1). O `36` é aritmética de planejamento (`41 − 5`), e o `41` também não confere: a fatia fechou **seis** débitos e **abriu dois** | afirmado **38**. ⚠️ **O índice NÃO foi ajustado para caber no 36** — apagar linha de débito vivo para fechar um número narrativo seria a pior forma da regressão que esta task existe para pegar |
| 2 | §6 e §5.6: **cinco** débitos fechados | **seis** — a §5.6 não contava o `D39 · F7/T8`, fechado pela mesma T9 | o `CT-1198` afirma os **seis** |
| 3 | §1 (Critério de Conclusão): *"**11** baterias"* | **14**, por descoberta — a própria §4 da task já corrige para 14 | afirmado por **igualdade de conjunto** contra o `find`, nunca por número fixo |
| 4 | §4: *"a fatia fecha 5 débitos e o repositório ganhou a ADR-0037 (30 `accepted` de 37 registradas)"* | **37 registradas / 30 `accepted`** — a estimativa da spec **confere**, e foi verificada arquivo a arquivo (3 `deprecated`, 4 `superseded`) | escriturado 37/30 |

---

## 6. Débitos que dispararam e NÃO fecharam — a razão fica registrada

Débito que dispara e não fecha **sem justificativa** vira dívida invisível. Estes são os três casos
desta fatia:

### 6.1 `D51 · F4/T16` — disparou pela SEGUNDA vez, e segue aberto

O gatilho é *"a primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`"*. Ele já
constava como **`JÁ DISPAROU (F5/T7)`** no índice, e a **T7 desta fatia** abriu o arquivo de novo
(para exigir `ORIGENS_PUBLICAS` na partida). **Não fechou**, e a razão é a mesma da primeira vez,
ainda válida: fechá-lo significa subir `ehChaveDeCifraAceitavel` e `ehDiretorioGravavel` para
`packages/shared/src/ambiente.ts`, o que **mexe na partida do processador de trabalho**
(`apps/worker/src/main.ts`) — arquivo fora da lista declarada da T7 e desta T11. A linha do índice
foi atualizada para registrar os **dois disparos**, de modo que a próxima task herde o histórico em
vez de reler o gatilho como futuro.

### 6.2 `D16 · F5/T8` — não dispara, porque depende do anterior

O `QUANDO FECHA` dele é *"o fecho do `D51 · F4/T16`, ou o terceiro ponto de entrada que exigir
`LOG_LEVEL`/`DATABASE_URL`/`REDIS_URL`"*. O `D51` não fechou e nenhum terceiro ponto de entrada
nasceu: **o gatilho não chegou**.

### 6.3 `D40 · F7/T9` — disparou DUAS vezes dentro da própria fatia, e a decisão foi validada

O gatilho, já emendado na T9, disparou de novo na T10. A extração **não** foi feita, e o Gate 2
validou a decisão com razão própria e medida: os dois serviços de trilha **já divergiam antes** (10
argumentos contra 4), o modo de espera **não tem contraparte** na borda que não tem `limit_conn`, e
extrair moveria ~200 linhas de arranjo de rede de **duas** baterias — uma delas fora da lista da
task — **dentro de um ciclo de correção de gate**, que é literalmente a *"correção grande com
regressão embutida"* da §5 do Protocolo.

### 6.4 `D5 · F5/T3` — NÃO dispara

Ele é recorrente e só dispara com **migração autoral** que altere estrutura declarada em
`packages/db/src/esquema/*.ts`, ou com regeração do zero. **Esta fatia não criou migração alguma** —
conferido: `packages/db/migracoes/` não mudou.

---

## 7. Achados de método — o que esta fatia ensina para as próximas

### 7.1 🔴 Uma regressão atravessou os DOIS gates de uma task, e a causa é estrutural

`verificar-workspace.sh` passou várias tasks saindo `1`. A causa: o `CT-003` proíbe IPv4 literal no
`.env.example`, e a **T7** acrescentou um comentário com `http://127.0.0.1:<porta>`. **Os dois gates
da T7 aprovaram** — o QA mediu os nove pacotes Vitest e **não rodou bateria shell alguma**, porque
`.env.example` não é TypeScript e nada no escopo declarado da task apontava para aquela bateria; o
Gate 2 não re-executa suíte.

**Não é desatenção: é lacuna de cobertura cruzada entre as duas frentes de teste.** O repositório
tem duas suítes independentes (Vitest e baterias shell), e o escopo de gate é derivado dos arquivos
declarados na task — um arquivo que **as duas frentes leem** cai no vão entre elas.

Corrigido por intervenção dirigida: o comentário passou a nomear o endereço pela **função** em vez
de escrever os octetos, e **a asserção não foi tocada** — o teste estava certo. A bateria voltou a
`4/4`, desfecho `0`, reconferido nesta passada (§1.2, linha 11).

⚠️ **Mitigação estrutural recomendada, e é o achado mais transferível da fatia**: quando uma task
tocar arquivo de configuração versionado que as baterias shell leem (`.env.example`, `deploy/**`,
`CLAUDE.md`), a **§3.2 dela deve declarar a bateria correspondente como âncora** — exatamente o que
a `.claude/rules/ancoras-de-superficie.md` §5.2 já prescreve para âncoras de superfície, e que aqui
não foi aplicado porque ninguém reconheceu o `.env.example` como âncora.

### 7.2 A premissa da ordem das `location` do nginx foi REFUTADA por medição (T9)

*"A ordem das `location` no arquivo é a política"* é **falsa**: entre `location` de prefixo o nginx
escolhe o **mais longo**, independentemente da ordem em que aparecem. Quem reintroduzir essa frase
comete **regressão de decisão (R3)** — a mais cara, porque nada fica vermelho.

### 7.3 O teste que podia ser silenciado pelo defeito que perseguia (T10)

O `CT-1194` — única prova **comportamental** de que o teto de concorrência barra — nascera com a
guarda desviando para `aviso` quando `chegadas > aceitas`, desfecho que é **fisicamente impossível
com o teto funcionando**. Ou seja: a única prova do teto podia ser silenciada pelo próprio defeito
que ela existe para pegar. **A lição generalizável**: sempre que uma asserção deriva a expectativa
do **próprio artefato sob prova**, ela mede consistência interna e chama isso de correção.

### 7.4 O fecho de um débito pode ter TRÊS pontas, não duas (T10)

`deploy/scripts/borda/prompt-de-ativacao-do-webhook.md` reproduzia o marcador **literal** do
`D27 · F4/T11`, e a varredura do `CT-907` conta `.md` de `deploy/`. A conferência das "duas pontas"
**pressupõe que o marcador viva num lugar só** — documentação operacional que cita o marcador quebra
essa premissa.

---

## 8. Pendências — as DUAS janelas assistidas, que são do operador

**Nenhum agente deste repositório digita senha**, e `sudo -n` falha neste host. As duas janelas
abaixo **não** são defeito da fatia: são os passos cujo executor é o operador. O roteiro literal, com
o comando de cada passo e o valor esperado, está em `_run/convergencia-do-host.md` §4.

### Janela (a) — posicionar o relógio do backup e provar o invariante 7

⚠️ **Fora da faixa `02:30`–`03:15`.** Com `Persistent=true`, atravessar `02:45` reiniciando dispara
a cópia ao voltar.

```bash
sudo bash /opt/sysloc-backend/deploy/scripts/instalacao/instalar-unidades.sh      # PENDENTE-JANELA 1
bash /opt/sysloc-backend/deploy/scripts/instalacao/verificar-unidades-agendadas.sh # esperado 8/8
# PENDENTE-JANELA 3 — o CT-1153, que exige o banco durável (fora da suíte pela ADR-0006)
sudo systemctl reboot                                                             # PENDENTE-JANELA 4
bash /opt/sysloc-backend/deploy/scripts/instalacao/verificar-unidades-agendadas.sh # esperado 8/8, código 0
# e o conjunto completo das 14 baterias, com o argumento — sem ele o verificar-fundacao fica de fora:
sudo bash /opt/sysloc-backend/deploy/scripts/verificacao/rodar-baterias.sh --com-agregador
```

### Janela (b) — publicar as origens e religar a borda · ⚠️ **a ordem é IRREVERSÍVEL**

Sem `ORIGENS_PUBLICAS` em `/etc/sysloc/backend.env` (0600) **a API recusa subir**. Inverter os
passos derruba o login do painel na janela entre eles — o aviso está escrito no próprio vhost.

```bash
# 1) escrever a linha no EnvironmentFile 0600
#    ORIGENS_PUBLICAS=https://sysloc.systera.com.br,https://syslocadmin.systera.com.br
#    ⚠️ NUNCA com curinga: `https://*.systera.com.br` passa na conferência de partida e faz a
#    barreira de origem aceitar QUALQUER origem (medido na T7, dentro do better-auth).
# 2) implantar e REINICIAR a API
# 3) só então recarregar as bordas
```

---

## 9. Declaração do P3 desta task — o que foi editado, e o que saiu

Duas edições em arquivo preexistente, e as três linhas de cada uma:

**`CLAUDE.md`**

- `CAUSA-RAIZ:` o `Estado atual` é cópia manual de números medidos noutra ocasião; ao fim de uma
  fatia que moveu a suíte (`shared` 276 → 295), fez nascer a **ADR-0037** e fechou seis débitos, o
  texto passa a mentir sobre o estado — e ele chega a **todo** agente antes de qualquer arquivo.
- `POR QUE ISTO FECHA A CLASSE:` os três números da superfície e o total do índice deixam de
  depender de disciplina de escrituração: o `CT-1196` e o `CT-1198` os amarram por **igualdade** às
  constantes executáveis e à tabela viva, de modo que a próxima divergência fica **vermelha na
  suíte** em vez de sobreviver a uma leitura desatenta. As contagens por pacote seguem sendo cópia —
  a §2 deste documento é o registro que permite auditá-las.
- `O QUE ESTA MUDANÇA REMOVE:` **nada**. A edição é aditiva: nenhuma advertência histórica, linha de
  índice, número antigo protegido por *"não reponha"* ou item do marco foi apagado.

**`packages/shared/test/protocolo-antirregressao.spec.ts`**

- `CAUSA-RAIZ:` a barreira provava o substrato do protocolo, mas não alcançava duas classes que a
  fatia exercitou: número narrado divergindo da constante executável, e fecho de débito **pelo
  número** em vez de pelo par.
- `POR QUE ISTO FECHA A CLASSE:` as duas asserções leem os arquivos reais e comparam por igualdade,
  não por presença; e cada uma tem falsificação executada (§10) que prova que ela **pode** reprovar.
- `O QUE ESTA MUDANÇA REMOVE:` **nada**. Os dois casos entraram como `describe` **novos**; nenhum
  caso, asserção ou docblock existente foi alterado — só a tabela de INVARIANTES ganhou duas linhas.

---

## 10. Prova de falsificação — executada, com o resultado de cada mutante

As asserções do `CT-1196` e do `CT-1198` são **estáticas** (leem o *texto* dos arquivos por `fs`),
e para essa natureza a `.claude/rules/testing-stack.md` exige a demonstração **por execução**.

⚠️ **Nenhum mutante tocou a árvore de trabalho.** O repositório foi espelhado com **hardlinks** num
diretório temporário (`cp -al`, com `dist/`, `.git` e caches removidos do espelho para que nenhuma
escrita alcançasse o inode original), e cada mutação foi aplicada **no espelho**. Controle: o
espelho **sem mutação** fecha em `295 passed`, idêntico à árvore real. A árvore foi conferida
intacta depois (`git status --porcelain` inalterado).

Cada rodada usou o **script `test` do pacote** — `pnpm --filter @sysloc/shared test` —, nunca
`vitest run` avulso.

| # | Mutante (no espelho) | Saída | Caso que reprovou |
|---|---|---|---|
| 1 | `Superfície: 106 rotas` → `105` | `1` | `CT-1196` · *o eixo **rotas** narrado é igual à constante executável* |
| 2 | `/ 91 manipuladores` → `90` | `1` | `CT-1196` · *o eixo **manipuladores** …* |
| 3 | `` `publicas` em **20** `` → `19` | `1` | `CT-1196` · *o eixo **públicas** …* |
| 4 | linha do homônimo `D23 · F0/T3` removida do índice | `1` | `CT-1198` · *o homônimo `D23 · F0/T3` continua vivo nas duas pontas* (e o `CT-907` acusa **marcador órfão**) |
| 5 | linha de `D9 · F0/T2` **reposta** no índice | `1` | `CT-1198` · *o `D9 · F0/T2` não tem marcador nem linha* (e o `CT-907` acusa **linha órfã**) |
| 6 | marcador de `D27 · F4/T11` **reposto** num fonte | `1` | `CT-1198` · *o `D27 · F4/T11` não tem marcador nem linha* |

Os seis reprovaram, cada um **nomeando o eixo ou o par**, e o restante da suíte permaneceu verde em
todas as rodadas — o que prova que a discriminação é do caso, e não da suíte inteira ficando
vermelha por qualquer razão.
