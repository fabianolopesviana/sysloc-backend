# Briefing de pré-refinamento — F3 · fatia 2 · sub-fatia **2b** · Documentos e confirmação

> **Entrada para `/agent-spec-pre-refinement`.** Este documento não é a spec: é o material de
> ancoragem do brainstorm de produto. Ele reúne o que a sub-fatia é, o terreno que ela encontra
> pronto — que mudou muito em 2026-08-12 —, o que **já está fechado e não se reabre**, e as
> **tensões que o pré-refinamento precisa explorar e convergir com o usuário**.
>
> Feature prevista: **`documentos-e-confirmacao`** · versão `v1` · variante `backend` ·
> **sub-fatia 2b de 2** da fatia 2 da F3.
>
> ⚠️ **Salve em `docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md`.** O
> `regua-e-documentos/v1/pre-refinement.md` é a **entrada dos dois runs** e **não se sobrescreve** —
> ele é registro histórico da partição, e a sub-fatia 2a já fechou sob ele.
>
> **Leitura obrigatória, nesta ordem:**
> 1. `docs/specs/features/regua-e-documentos/v1/pre-refinement.md` — o pré-refinamento partilhado.
>    A **§8 (sub-fatia 2b)** é o escopo convergido, a **§3-B** são os seis fatos medidos, a **§11** são
>    as decisões fora de negociação, a **§13** são as sete dúvidas em aberto e a **§15** é a
>    recomendação de framework a **re-confirmar**, não a refazer.
> 2. `docs/plano-backend-novo/briefings/f3-fatia2-regua-e-documentos.md` — o briefing da fatia 2
>    inteira, de onde este recorta. As §§4.4, 4.7 e 4.8 tratam do que é 2b.
> 3. `docs/specs/features/regua-de-cobranca/v1/_run/run-report.md` — o que a sub-fatia **2a**
>    entregou, e os sete débitos que ela deixou.
> 4. `docs/specs/features/caracterizacao-regras-legadas/v1/golden/PROCEDENCIA.md` — por que cada
>    máscara do golden existe, e por que a **ordem das guardas é dado, não detalhe**.

---

## 0. O que mudou desde que o pré-refinamento partilhado foi escrito

Ele é de **2026-08-11**. A sub-fatia 2a fechou em **2026-08-12**, e três coisas dela mudam o terreno
desta:

1. **A janela de prazo fechou bem.** A T1 da 2a extraiu o fonte do Server Script `PDF contrato` do
   banco do Frappe. Ele está versionado em
   `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf-fonte.py` — **759 linhas**
   com cabeçalho de procedência, capturadas byte a byte. A `[DÚVIDA] 1` — *"quanto das 752 linhas
   sobrevive à tradução?"* — **deixou de ser dúvida e virou medição**, e a §4.1 abaixo a traz feita.
2. **A superfície é outra.** A 2a levou a API de **82/67 a 86/71 rotas/manipuladores**, com
   `semDeclaracao` vazio, fechado por **dupla medição independente** (CT-635). A estimativa de rotas
   da 2b (`[DÚVIDA] 6`) agora se conta **sobre 86**, não sobre 82.
3. **A suíte é outra.** **1004 casos**, medidos **por pacote** e monotônicos. É esta a baseline do P1
   do Protocolo Antirregressão para quem executar esta sub-fatia.

Some-se o que a 2a **não** fez, e que por isso não é herança sua: nenhuma das 12 tasks do
`task_plan.md` dela nomeia migração de dado da configuração `Single` — a `[DÚVIDA] 4` do
pré-refinamento partilhado **era pergunta da 2a**, e não volta aqui.

---

## 1. O que esta sub-fatia é

**É o que sai.** A 2a entregou o que *age* — a régua que decide, enfileira e registra. Esta entrega o
que o cliente **recebe**: o contrato em PDF e o e-mail que confirma o endereço do locatário.

O corte entre as duas é **objeto × natureza de prova**, e os dois critérios coincidem: a 2a tinha
oráculo executável de 51 KB (`regua-de-cobranca.json`); a 2b tem **oráculo textual** de 174 linhas
(`contrato-pdf.txt`) para o PDF e **nenhum oráculo** para a confirmação de e-mail — porque ali o
comportamento legado é o defeito, e portá-lo seria reintroduzi-lo.

**Esta sub-fatia fecha a F3.** Ao fim dela, quatro das cinco fases que o marco de entrega exige estão
concluídas, e entre aqui e o handoff sobram **F4 e F5**.

---

## 2. O que já está fechado — não reabrir

Isto entra no brainstorm como **restrição**, não como rumo. Reabrir qualquer item é regressão de
decisão (R3) na acepção da `.claude/rules/nao-regressao.md`.

| Fechado | Onde está registrado |
|---|---|
| **O corte 2a × 2b**, e a ordem 2a → 2b | pré-refinamento partilhado §4 Ramo A, §15.2 |
| **O carnê é F4**, não F3 — a fonte de cada página é o boleto emitido | pré-refinamento da fase; `roadmap.md` §F4 item 6 |
| **WhatsApp não é implementado** — `whatsapp`/`ambos` são **recusados** na validação, não aceitos em silêncio | `plano-execucao.md` §F3 item 7 |
| **O defeito do token de confirmação se fecha no porte** — decisão do usuário, registrada | pré-refinamento partilhado §11 |
| **O carimbo "CANCELADO" vira composição na renderização**, e o cancelamento apenas grava estado | pré-refinamento partilhado §3-B.2, §8 |
| **Nenhuma linha de React**, inclusive a página `validacao-email` que recebe o link | `CLAUDE.md` → Fronteira; **task que peça frontend é gatilho de parada** |
| **`@RotaPublica()` já existe e já é usado** — a pergunta não é *como declarar*, é *sob que critério* | pré-refinamento partilhado §3-B.5 |
| **A ADR de granularidade da fila foi podada** com justificativa | pré-refinamento partilhado §9 |

E duas decisões de **framework**, que o pré-refinamento deve **re-confirmar contra a §15.5**, não
refazer do zero: **SDD** é a recomendação vigente para a 2b, e as **duas ADRs são pré-requisito
dela** — o critério para uma rota de negócio dispensar sessão, e o que o contrato publica para uma
rota que devolve bytes. O único caminho legítimo de downgrade está escrito na §15.5: se a tradução
colapsar em poucas cláusulas **e** as duas decisões forem absorvidas ao abrir o `Decision` integral da
**ADR-0016** e da **ADR-0017**, a 2b vira miniSpec. **Abrir o texto das ADRs, nunca a linha-resumo** —
as linhas do `CLAUDE.md` e do `INDEX.md` são paráfrases e já divergiram do real.

---

## 3. Restrições que não se negociam

- **Português brasileiro em tudo**, e **Opus** em toda sessão e todo subagente.
- **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) — baseline antes e depois, as três
  linhas antes de cada edição, `DECISÃO FECHADA` intocável, nenhuma prova enfraquecida.
- **Multi-tenancy pelo banco**: `empresa_id`, RLS forçada, FK composta. Vale também para o que esta
  sub-fatia gravar sobre confirmação de e-mail.
- **A API fala o modelo de domínio camelCase** (ADR-0016/0017), e o contrato é derivado do esquema.
- **Transição de estado governada pela ADR-0021** — rota própria sempre; chave de ação só quando o ato
  é sensível.
- **Baseline medida**: suíte **1004** por pacote; superfície **86 rotas / 71 manipuladores** com
  `semDeclaracao` vazio. Toda contagem nova se compara com estas.
- **O `/opt/frappe` está de pé e o site `frontend` é produção** — leitura por
  `docker compose exec -T backend bench --site frontend console` é o padrão seguro, e **não exige
  `sudo`** (a exigência de `sudo` vale para `deploy/scripts/instalacao/`, que toca o SO).

---

## 4. As tensões a explorar — o coração deste briefing

Cada tensão traz o que **já está medido** e a pergunta que **sobra**. O que está medido não se
re-mede; o que sobra é o que o brainstorm converge com o usuário.

### 4.1 O tamanho real da tradução do PDF — medido, e maior do que "21 cláusulas" sugere

O pré-refinamento partilhado mediu o fonte **de fora** (21 cláusulas, `def` = 0). Com o arquivo
extraído em mãos, a medição de dentro, feita em 2026-08-12 sobre `golden/contrato-pdf-fonte.py`:

| Sinal | Contagem |
|---|---|
| Linhas (com cabeçalho de procedência) | **759** |
| `if` / `elif` / `else:` | **83 / 33 / 11** |
| Condicional em expressão (ternário) | **14** |
| `for` | **10** |
| `try:` | **10** |
| Menções a `fiador` | **38** |
| Menções a `pj` (pessoa jurídica) | **15** |
| Menções a `rg` | **6** |

**A leitura**: são ~127 pontos de ramificação em código em linha reta, e os assuntos se concentram em
três eixos — **com fiador × sem**, **PJ × PF**, **com RG × sem**. Não é boilerplate de arcabouço; é
**regra de composição jurídica**, e é ela que dimensiona a sub-fatia.

**O que sobra para o brainstorm** — e é a tensão central da 2b:

- **Como se corta a tradução?** Por cláusula (21 unidades), por bloco de qualificação (partes,
  endereço, garantia, cláusulas, encerramento), ou por eixo condicional (fiador / natureza da pessoa)?
  A escolha decide a decomposição em tasks e o gatilho de upgrade da §15.5.
- **O golden de 174 linhas é a saída de UM contrato.** Ele exercita **um** caminho pelos três eixos.
  Provar igualdade sobre ele **não prova** os outros caminhos. A pergunta de produto é: os demais
  caminhos entram como **divergência declarada sem oráculo**, como **captura nova** no legado enquanto
  ele está de pé, ou como **fora do escopo desta versão**? Há um precedente forte para a segunda
  opção: a 2a capturou o 11º artefato golden justamente porque a janela fechava.

### 4.2 O destino do `pdfContratoArquivo` — a `[DÚVIDA] 2` agora tem medição dos dois lados

O pré-refinamento partilhado dizia que isto é *"verificável no `levantamento-frontend.md`: se o React
lê o campo, ele permanece nulo; se não lê, sai."* Verificado em 2026-08-12:

- **O React não lê o campo.** O `levantamento-frontend.md` não o nomeia em lugar nenhum. O que existe é
  o consumo **de bytes por endpoint** — `method/locacao_automation.contrato_pdf.service.abrir_contrato`
  (linha 92) — e `shared/pdf/pdfEndpoints.ts`, 89 linhas de `fetch` cru para binários com URL
  autenticada (linha 180).
- **O backend novo já o carrega**: coluna `pdf_contrato_arquivo` na migração **`0007_dominio_contrato.sql`**,
  e o campo `pdfContratoArquivo` em `packages/db/src/contrato.ts` na leitura, na projeção, na inserção e
  na alteração. Há também asserção de catálogo em `packages/db/test/catalogo.spec.ts` sobre a **ausência**
  dele numa superfície de saída.

**O que sobra**: some do modelo ou permanece nulo? A resposta tem custo assimétrico e o brainstorm
precisa pesá-lo com o usuário. **Removê-lo é mexer em migração já aplicada** — o mesmo terreno do
**D20**, cujo gatilho é exatamente *"a primeira aplicação da `0010` a banco durável"*. Mantê-lo nulo é
carregar um campo que **mente sobre o que o sistema faz** para sempre. Há uma terceira via a
considerar: manter a coluna e **fechar a escrita**, deixando o campo como registro histórico do que o
legado gravou.

### 4.3 O carimbo, a ordem das guardas, e o que o golden vai reprovar

Medido na §3-B.2 do pré-refinamento partilhado: o carimbo vive em
`contrato_cancelamento/pdf_utils.py` como **marca d'água real** (`PdfReader`, `merge_page`), aplicada
pelo `service.py` (174 linhas) sobre os **bytes já armazenados**, sobrescrevendo `pdf_contrato_arquivo`.
Sob PDF derivado sob demanda, isso deixa de ser merge de página e vira **composição** — e é o que faz o
**D36 (F2/T8) fechar por construção**.

**O que sobra** é a `[DÚVIDA] 3`, e ela é a mais traiçoeira desta sub-fatia: **removida a guarda de
PDF do cancelamento, qual mensagem passa a sair no cenário `contrato_sem_imovel`?** Os dois cenários
foram capturados **separadamente** no golden porque a **ordem das guardas é dado**. Sem veredito
escrito antes da execução, o golden reprova por um motivo que ninguém previu — foi assim que a 2a
acertou a sua única divergência (`REG-08`, por vitória): **os dez vereditos foram escritos antes de
rodar**. Repita o método.

### 4.4 A confirmação de e-mail — portar fechando o defeito, e declarar a divergência

Medido na §3-B.3: em `locatario_email_confirmacao/service.py` (222 LOC), o `email_token_hash`
**não é hash** (valor em claro, comparação por igualdade simples), o token **não é aleatório** (ID do
locatário + timestamp sem pontuação), e o **ID viaja no próprio link**. **O token é forjável.**

A decisão de fechar o defeito no porte já está tomada (§2). **O que sobra**:

- **Que forma a divergência declarada toma?** Não há oráculo a contrariar aqui — o comportamento certo
  é o que o legado não faz. O registro precisa dizer o que se abandonou e por quê, no molde da
  divergência declarada da 2a.
- **A `[DÚVIDA] 7`**: a rota pública precisa de limitador de taxa **nesta** sub-fatia? O **D27**
  registra que o limitador **não tem eixo de origem confiável** até a publicação atrás do servidor de
  borda, que é F7. As mitigações alternativas estão na mesa — expiração curta, token de uso único,
  ambas — e a escolha é de produto, não de infraestrutura.
- **Onde o e-mail de confirmação nasce**: ele é disparado por ação do operador, por evento do cadastro
  do locatário, ou pelos dois? O legado tem 222 linhas para responder isto, e a resposta muda a
  superfície.

### 4.5 As duas fronteiras que este backend nunca atravessou

São as **duas ADRs** pré-requisito, e o brainstorm precisa levantar o **critério de produto** de cada
uma — a forma técnica é do tech-alignment.

1. **Rota pública de negócio.** Hoje só a autenticação dispensa sessão. A confirmação de e-mail é a
   primeira rota de **negócio** que precisa disso, porque quem clica no link **não tem sessão e nunca
   terá** — o locatário não é usuário do sistema. O critério a escrever é *sob que condições* um ato de
   negócio pode ser exercido sem sessão, e **o que ele carrega em troca** (portador de segredo com
   expiração? uso único? escopo mínimo?). O `semDeclaracao` **continua vazio** — a rota entra em
   `publicas`, que é partição declarada.
2. **Resposta binária no contrato.** O PDF sai como **bytes**. A `[DÚVIDA] 5` mediu que o grep por
   `ts-rest` nos `package.json` volta **vazio** e que não há uso de `contentType` nos contratos — logo
   a escolha é entre **E-b1** (o contrato publica a resposta binária) e o piso **E-b2** (exceção
   declarada e provada). A verificação de como o contrato é publicado hoje pertence ao
   **tech-alignment**; o que o brainstorm decide é se o PDF é **cidadão de primeira classe do contrato**
   — porque, se for, a **F4 herda** a decisão para o boleto e para o carnê.

### 4.6 A natureza da prova, que é o que separa esta sub-fatia da anterior

A 2a foi provada contra um oráculo executável, par a par. Aqui a prova é **igualdade sobre texto
normalizado** contra `contrato-pdf.txt` (174 linhas), e a **normalização é a decisão**: o que ela
tolera (espaços, quebras, ordem de linhas em bloco) determina se a prova pega defeito ou o esconde. A
normalização precisa ser **declarada, fechada e provada por falsificação** — mutante que a viole tem
de reprovar nomeando o ponto.

**O que sobra**: qual é o critério de aceitação quando o PDF novo é **melhor** que o legado (por
exemplo, corrige um endereço mal formatado)? Vira divergência declarada por vitória, como a `REG-08`
da 2a, ou o porte fica fiel ao defeito? A 2a já criou o precedente — use-o.

### 4.7 A superfície, e quanto ela ainda cresce

Estimativa `[HIPÓTESE]` do pré-refinamento partilhado para a 2b: **3 rotas** — o PDF, o disparo da
confirmação e a confirmação pública. Sobre **86**, e não sobre 82. Vale o que valeu na 2a: o número
entra no PRD, e a medição é a **dupla medição independente com a igualdade entre os dois eixos
afirmada** (o CT-635 é o precedente, e ele traz três mutantes). ⚠️ **Não propague a premissa refutada
do `HEAD` em dobro** — o número da F2 era **75, não 77**.

### 4.8 O que esta sub-fatia obriga o handoff a carregar

O link de confirmação aponta para uma página que **não existe neste repositório** — `validacao-email`
é React, é F6, e é implementada na máquina local. Isto precisa entrar no artefato **como registro
explícito**, não como suposição: o backend define o formato do link, e alguém do outro lado terá de
honrá-lo. É o mesmo raciocínio que fez a F6 existir como fase de contrato e mapa, não de código.

---

## 5. Fora do escopo desta sub-fatia

Herdado da §9 do pré-refinamento partilhado, e vale integralmente: **carnê e emissão de boleto** (F4),
**o gatilho de tempo da régua** (F5), **a tela de saúde e o disparo de alerta** (F5), **canal
WhatsApp** (recusa declarada), **retenção e expurgo do log de envio** (F7, junto do
`identidade.tentativa_login`), **cache do PDF derivado** (adiado, entra sem mudar o contrato),
**publicar o `@sysloc/contracts`** (item do marco), **SPF/DKIM** (operação), e **qualquer linha de
React**.

Acrescente-se o que a 2a já entregou e portanto **não é trabalho aqui**: a régua, a política de aviso
por empresa, o log de envio, o predicado de elegibilidade e as 4 rotas de `/v1/automacao-de-cobranca`.

---

## 6. Débitos com gatilho que esta sub-fatia pode disparar

Confira cada um **contra o marcador no código**, não contra esta lista — ela é ponteiro.

| Débito | Por que ele olha para cá |
|---|---|
| **D36** (F2/T8) | **fecha por construção** — sem arquivo preexistente, o cancelamento não pode depender dele. É entrega, não risco |
| **D1** (F3/T2) | o PDF **imprime valor monetário** — candidato a terceiro consumidor de `MAIOR_VALOR_MONETARIO`/`ESCALA_MONETARIA` |
| **D26** (F3/T8) | o contrato **imprime datas e prazos** — candidato a terceiro consumidor de aritmética de calendário |
| **D12** (F3/T4) | dispara se alguma task abrir `packages/contracts/src/cobranca.ts` por outra razão |
| **D57** (F3/T12) | dispara na **terceira suíte** que precisar da montagem instrumentada — a e2e da rota pública é candidata natural |
| **D27** (F1/T6) | não dispara aqui, mas **é insumo da `[DÚVIDA] 7`**: é ele que registra por que o limitador não tem eixo de origem antes da F7 |

---

## 7. Fatos a confirmar durante o pré-refinamento

Cada um com o comando que o resolve. **Premissa que dimensiona trabalho merece ser medida antes de ser
registrada** — foi assim que a T1 da fatia 1 ficou parada por uma exigência de `sudo` que quatro
comandos derrubariam.

1. **Quantos caminhos distintos os três eixos condicionais produzem** no fonte extraído, e quantos deles
   o golden de 174 linhas exercita.
   `grep -nE "^\s*(if|elif)" docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf-fonte.py`
2. **Se `contrato_pdf/service.py` (61 linhas) faz mais do que servir o arquivo armazenado** — o
   briefing da fatia 2 afirma que não, e sob PDF derivado essas 61 linhas viram a rota de bytes.
3. **Como o e-mail de confirmação é disparado hoje** (ação do operador × evento de cadastro), lendo
   `locatario_email_confirmacao/service.py`.
4. **Se o contrato publicado hoje sabe declarar resposta binária** — insumo da ADR, e a `[DÚVIDA] 5` já
   mediu que `ts-rest` não está instalado e que `contentType` não aparece.
5. **Se a normalização do texto do PDF tem precedente neste repositório** — a fatia
   `caracterizacao-regras-legadas` comparou texto extraído antes, e o `PROCEDENCIA.md` registra o método.

---

## 8. Critérios de saída deste pré-refinamento

O artefato só está pronto quando:

- [ ] Salvo em `docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md`, com o
      `regua-e-documentos/v1/pre-refinement.md` **intacto**;
- [ ] As **sete dúvidas** da §13 do partilhado aparecem **resolvidas, herdadas ou explicitamente
      transferidas** ao tech-alignment — nenhuma some sem menção;
- [ ] O **corte da tradução do PDF** tem direção escolhida, com o dimensionamento derivado dela;
- [ ] O **destino do `pdfContratoArquivo`** tem veredito, com o custo de migração pesado;
- [ ] A **ordem das guardas do cancelamento** tem veredito **escrito antes de qualquer execução**;
- [ ] A **divergência declarada** da confirmação de e-mail está redigida, com o que se abandona e por quê;
- [ ] As **duas ADRs** aparecem no §15.4 **antes** do comando do framework, com título proposto;
- [ ] A recomendação de framework está **re-confirmada contra a §15.5** do partilhado — mantida em SDD
      ou rebaixada com a razão medida;
- [ ] Nenhum rumo de frontend entrou no escopo; a página `validacao-email` está registrada como
      **handoff**;
- [ ] Toda inferência está marcada `[HIPÓTESE]`, e toda medição traz o comando que a produziu.

---

## 9. Observações de método

- **O golden é o oráculo; o Python é o porquê.** Ler `contrato-pdf-fonte.py` serve para entender a
  intenção da cláusula — nunca para decidir o que é certo. O que é certo está em `contrato-pdf.txt`, e
  onde ele silencia, a decisão é **declarada**, não deduzida.
- **Escreva os vereditos antes de executar.** Foi o que fez a equivalência da 2a fechar com uma única
  divergência, e ela foi por **vitória**.
- **O pré-refinamento é brainstorm de produto**: sem endpoints, sem schema, sem arquitetura fina. Onde
  este briefing cita estrutura, é para ancorar viabilidade — **não para ser copiado na spec**.
- **Dois fatos operacionais que mordem quem rodar a suíte**: o **`CT-907` é flaky pré-existente**
  (falha por *timeout* é o flake; falha por *asserção* é achado), e o **disco do host está em ~93%** —
  rode `rm -rf /tmp/sysloc-banco-*` entre execuções, porque `No space left on device` se disfarça de
  teste vermelho. Meça **por pacote** (`pnpm --filter @sysloc/<pacote> test`): o `turbo run test`
  aborta os pacotes irmãos quando um falha.
- **Um achado pré-existente segue aberto**: o `verificar-golden.sh` termina REPROVADO no **`CT-013`**
  (credencial na árvore versionada, apontando `senha.spec.ts`, `pessoa.ts` e `semente.ts`). **Não é
  regressão de nenhuma fatia** — provado em worktree limpo. Causa provável, não confirmada: colisão de
  agulha.
- **Esta é a última sub-fatia da F3.** O que ela deixar aberto atravessa para F4, F5 e para o handoff —
  e o handoff é a fronteira em que este repositório **para**.
