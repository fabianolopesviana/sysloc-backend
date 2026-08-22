# Tech Alignment — `integracao-bancaria-autonoma` (v1)

| | |
|---|---|
| **Feature** | `integracao-bancaria-autonoma` — F5, fatia (i) |
| **Versão** | v1 |
| **Framework** | SDD |
| **Variante** | **backend** (a tela é implementada fora deste repositório) |
| **Definição** | `docs/prds/features/integracao-bancaria-autonoma/v1/prd.md` (12 US · 20 CA · 15 RN) |
| **Discovery lido** | `pre-refinement.md` (5 ramos, A1/B1/C1/D1/E1) · `insumo-do-pre-refinamento.md` |
| **ADRs consultadas (`Decision` aberta, não a linha-resumo)** | **0001** (+ emendas de 2026-08-15 e 2026-08-17) · **0029** · **0031** · **0032** · **0034** · **0036** · 0008 · 0011 · 0017 · 0018 · 0021 · 0024 (+ emenda de 2026-08-18) · 0025 · 0026 |
| **Data** | 2026-08-21 |
| **Status** | Decidido |

---

## Contexto técnico

Duas frentes com causa comum e substratos disjuntos. A **frente B** acrescenta ao produto uma
capacidade que ele nunca teve — **executar processo externo** (ADR-0036) —, e a varredura confirma que
não há precedente: `child_process` aparece hoje em **cinco arquivos de teste** e em **zero** fonte de
produção. A **frente A** acrescenta uma **porta irmã de configuração**, no molde já provado da
`PortaDeIdentidadeBancaria`, mais estado durável por empresa.

Três invariantes governam tudo o que segue, e nenhuma delas é negociável nesta fatia: o segredo
operável entra opaco, é aberto só dentro da chamada e não retorna por superfície alguma, com ausência
de vazamento **afirmada por medição da saída real** (ADR-0032); nenhum campo, URL ou vocabulário do
provedor cruza a porta, exigível por varredura estática (ADR-0001, cláusula de fecho, cuja
propriedade a emenda de 2026-08-15 declara ser *"do **vocabulário**"*); e o recorte por empresa é do
banco, nunca de comparação em aplicação (ADR-0008, Invariante 1).

O ponto de atrito real não é nenhuma das duas frentes isoladamente: é que **a frente B reverte uma
indistinguibilidade deliberada** que a fatia `fundacao-bancaria` construiu de propósito, e que a
frente A precisa fazer o motivo íntegro do provedor chegar à tela **sem** que o vocabulário dele
atravesse a porta. As duas coisas têm solução ancorada; nenhuma delas é óbvia, e as duas são o que
este documento existe para fixar.

---

## Soluções técnicas decididas

### D1 — A conversão pertence ao domínio da cobrança bancária, não à borda HTTP

**Escolhida: módulo irmão de `leitura-do-material.ts`, em `@sysloc/cobranca-bancaria`.**

A ADR-0036 fixa que a conversão acontece *"na borda de registro"* — o que nomeia o **ato**, não a
camada de transporte. Quem hoje abre o cofre PKCS#12 é `leitura-do-material.ts`, naquele pacote, e é
lá que vive o contrato *"o claro só existe dentro da chamada"*. Converter é a etapa que **precede**
essa abertura, sobre o mesmo insumo e com a mesma disciplina de segredo.

- **Alternativa A2 — o serviço da borda (`apps/api`) executa a conversão.** _Exemplo:_ o serviço
  tenta ler, captura a falha de cifra e invoca o conversor antes de tentar de novo. _Prós:_ é
  literalmente "a borda de registro". _Contras:_ parte em dois pacotes o tratamento do material em
  claro, e dá a `apps/api` a capacidade de executar processo externo — a camada que atende a rede
  passa a ter `child_process` no alcance. _Viabilidade:_ possível, mas alarga a superfície na camada
  errada.
- **Alternativa A3 — `@sysloc/shared`.** _Exemplo:_ um utilitário genérico de invocação de binário.
  _Prós:_ reutilizável. _Contras:_ generalização para um consumidor único (YAGNI), e põe manipulação
  de chave privada no pacote que **todo** processo importa. _Viabilidade:_ rejeitada.

**Trade-off aceito:** o pacote de domínio passa a depender de um binário do host — consequência que a
própria ADR-0036 já registra em `Cons`. O serviço da borda continua **orquestrando** e não ganha
capacidade nova.

### D2 — Um único artefato em claro, e ele é o que a medição prova ser inevitável

**Escolhida: apenas o intermediário toca armazenamento; original e convertido trafegam por fluxo.**

O roteiro provado (`deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh`) mediu que
a **exportação** PKCS#12 exige entrada *seekable* — falha por entrada padrão, por cano e por descritor
—, e é essa medição que torna o intermediário obrigatório. A medição **não** alcança a etapa de
decodificação nem a saída: reduzir os três artefatos a um é possível, e é o que se recomenda.

- **Alternativa A2 — os três em arquivo, como o roteiro de servidor faz.** _Exemplo:_ grava-se o
  recebido, converte-se, lê-se o preparado. _Prós:_ é o caminho já demonstrado ponta a ponta. _Contras:_
  triplica os artefatos em claro; o roteiro grava porque **recebe um caminho**, não porque precise —
  no produto o material chega em memória. _Viabilidade:_ é o fallback se a hipótese abaixo cair.

✅ **MEDIDO em 2026-08-21 neste host** (era hipótese até então; a medição está na §"Medições" ao
fim deste documento): a decodificação **aceita entrada padrão** (3.217 bytes de saída) e a exportação
**aceita saída não-seekable** (2.595 bytes). O **controle reproduz** o achado anterior — exportar
*lendo* de entrada padrão falha com `Could not read any certificates from -in file from <stdin>` —, de
modo que a assimetria é real e é só da entrada da exportação. A degradação para A2 **não é mais
necessária**.

**Guarda de execução, herdada do roteiro e exigida pela ADR-0036** — todas por medição: caminho
absoluto; sem interpretador de comandos; **senha por descritor de arquivo, nunca em `argv`**;
armazenamento apenas em memória compartilhada, com permissão restrita; remoção garantida em **todo**
desfecho, inclusive erro e sinal; teto de tempo; e saída do processo externo **fora do diário**.

**Trade-off aceito:** o intermediário carrega chave privada em claro em memória compartilhada, que
pode ser paginada para área de troca — a garantia é *"não escreve em armazenamento persistente"*, e a
ADR-0036 já a declara nesses termos.

### D3 — A causa da recusa se discrimina por sinal de conteúdo, e a mensagem do terceiro morre no ponto

**Escolhida: casamento por conteúdo da saída do conversor, descartada em seguida — o precedente já
existe neste repositório.**

O caminho ingênuo não funciona, e vale registrar por quê: **não dá para classificar tentando ler o
original**. Material em cifra legada com senha errada falha pela **cifra**, antes de a etiqueta de
autenticação ser conferida — o runtime nunca chega a dizer que a senha não abre. A senha só se
manifesta **dentro** da conversão, que é quem a apresenta.

`leitura-do-material.ts` já resolve exatamente esta classe: casa um **sinal de conteúdo** na mensagem
do runtime, e **descarta a mensagem** — ela não vira causa, não vira propriedade e não entra em texto
nenhum. A mesma **forma** se aplica ao conversor, com a mesma regra de degradação já aceita ali: sinal
que deixe de casar cai no desfecho **mais genérico**, que é a direção segura (perde-se precisão de
diagnóstico, nunca contenção).

⚠️ **O sinal é OUTRO, e reusar a constante existente seria defeito.** Medido em 2026-08-21: o
**executável** diz `Mac verify error: invalid password?`, enquanto a **biblioteca** — que é quem
`leitura-do-material.ts` escuta — diz `mac verify failure`. São produtores diferentes, com redações
diferentes; o casamento normalizado que serve aos dois é o radical `mac verify`. A discriminação está
medida nas duas pontas: material que não é PKCS#12 produz erro de codificação ASN.1 e **não** casa o
radical. Importar `SINAL_DE_SENHA_QUE_NAO_ABRE` para o conversor faria o ramo da senha **nunca
disparar** — e o desfecho degradaria silenciosamente para "formato", que é exatamente o defeito
invertido do `D64`.

- **Alternativa A2 — código de saída do processo.** _Exemplo:_ zero converteu, não-zero falhou.
  _Prós:_ não depende de redação. _Contras:_ **não discrimina** — senha errada e material corrompido
  saem com o mesmo não-zero. _Viabilidade:_ insuficiente sozinho; serve como guarda, não como
  classificador.
- **Alternativa A3 — repassar a saída do conversor como causa da exceção.** _Prós:_ diagnóstico
  máximo. _Contras:_ cria uma superfície nova sobre a qual provar que nenhum segredo viaja — o oposto
  do que `leitura-do-material.ts` decidiu por medição. _Viabilidade:_ **rejeitada**, conflita com a
  doutrina do módulo e com a ADR-0032.

### D4 — As três recusas são discrimináveis pelo código, e a reversão da indistinguibilidade é declarada

**Escolhida: três desfechos distinguíveis pelo *código* do envelope (ADR-0017), não por prosa nem por
discriminante dentro de `detalhes`.** Resolve a **[DÚVIDA] 4** do discovery, na direção que
`plano-execucao.md` §F5(i) já apontava (*"classificar pelo código"*): a tela ramifica sobre valor
fechado, e não sobre texto. O conjunto de códigos é fechado e **extensível por acréscimo explícito** —
há precedente na F1, que acrescentou três. **Quais** códigos, e o mapa exato → TECH_SPEC.

⚠️ **Isto reverte uma decisão deliberada, e a reversão precisa ser escrita como tal.**
`certificado.service.ts` funde hoje `ErroDeSenhaQueNaoAbre` e `ErroDeMaterialIlegivel` numa recusa
única, sob o título *"DUAS CAUSAS, UMA RESPOSTA — e a indistinguibilidade é construída AQUI"*, com a
razão de não dizer ao cliente **qual metade** falhou. Verificado: **não há marcador `DECISÃO FECHADA`
sobre esse trecho** — logo não há gatilho de parada —, mas há decisão anterior, e desfazê-la em
silêncio é regressão de decisão (R3).

**Por que a premissa envelheceu, e não é descuido desfazê-la:** a doutrina da recusa indistinguível
deste repositório existe contra **oráculo de existência** — é o caso de `CREDENCIAL_INVALIDA`, quatro
causas num código só, porque distinguir *"confirmaria ao atacante que a conta existe"*. Aqui não há
atacante a informar: quem pede está **autenticado**, detém `ACAO:configurar_integracao`, e apresentou
**as duas metades** — arquivo e senha. Dizer-lhe qual das duas não serve não revela nada que ele já
não tenha. O custo medido do silêncio, ao contrário, é real: em 2026-08-20 o operador caçou uma senha
errada que não existia.

**Obrigações de antirregressão que acompanham esta decisão** (`.claude/rules/nao-regressao.md`):
1. A declaração `O QUE ESTA MUDANÇA REMOVE` nomeia explicitamente a indistinguibilidade removida.
2. O caso que hoje afirma a mensagem única é **reescrito, nunca apagado** — a contagem de casos não
   cai, e a alteração acompanha a razão (mudança de requisito aprovada no PRD, não asserção afrouxada).
3. O docblock que declara a fusão é **substituído** pela razão nova. Docblock que sobrevive à decisão
   que ele explica é o vetor da R3.

### D5 — O motivo íntegro atravessa como **diagnóstico**, em campo de nome do produto

**Escolhida: tipo canônico com campos nomeados pelo produto, carregando os valores do provedor
verbatim, mais um portador opaco e sem esquema para o que varia por código de recusa.**

A tensão é real: o PRD exige *"mensagem, código e todos os campos que o provedor devolveu"* (RN-02),
e a ADR-0001 proíbe vocabulário do provedor de cruzar a porta. As duas se conciliam porque a cláusula
é **do vocabulário**, e vocabulário é **nome**, não valor — é a mesma leitura que a emenda de
2026-08-17 aplica à credencial de acesso. E há ancoragem direta: a ADR-0034 declara em `Consequences →
Neutros` que *"o que o terceiro informou continua preservado como **diagnóstico** no evento que houve —
inclusive quando o produto não reconhece o que ele disse"*. O precedente de forma é o **recebido cru**
do glossário: guardado exatamente como chegou, *"diagnóstico, nunca fonte de autoridade"*.

**Consequência exigível, e é ela que fecha a classe:** o motivo **não decide nada**. Nenhum ramo do
produto lê dentro dele; o que decide habilitado/desabilitado é o desfecho canônico da porta.

- **Alternativa A2 — publicar o objeto do provedor como tipo declarado.** _Exemplo:_ um esquema com
  os campos do provedor nomeados. _Prós:_ mais explícito para a tela. _Contras:_ **viola** a cláusula
  de fecho da ADR-0001, e a varredura pega: o caso irmão do CT-834 examina as **chaves dos esquemas**
  publicados. _Viabilidade:_ rejeitada.
- **Alternativa A3 — normalizar a recusa num vocabulário do produto.** _Prós:_ nenhum termo de
  terceiro em lugar nenhum. _Contras:_ contradiz o PRD (*motivo completo, sem interpretação*), e a
  premissa do discovery é que os campos **variam por código**. _Viabilidade:_ rejeitada — é decisão
  de produto já fechada.

⚠️ **Nota de varredura:** o portador opaco carrega chaves do provedor **em execução**, e a varredura
é **estática sobre o texto do fonte** — símbolo publicado, membro de tipo e literal de cadeia. Não há
conflito, e a ausência de conflito precisa estar **afirmada por controle positivo**, no molde do
CT-991, que já separa *"o dialeto morreu na fronteira"* de *"a varredura não olhou"*.

**Não é candidata a ADR.** A composição 0001(c) + 0034(Neutros) já responde; uma ADR nova com a mesma
decisão seria churn, pelo critério que o próprio `CLAUDE.md` aplica à ADR-0006.

### D6 — A credencial de acesso passa a ser por **empresa e família de escopo**

**Escolhida: a chave do cache de credenciais ganha a família de escopo.**

Medido: a concessão da família de webhook exige escopos próprios, e os escopos de boleto **obtêm
token mas o gateway recusa**. O cache hoje é indexado **só por empresa** — de modo que, com escopo por
operação e chave inalterada, uma credencial de boleto viva seria apresentada numa chamada de webhook e
a recusa apareceria como falha do produto, intermitente e dependente de ordem.

- **Alternativa A2 — pedir a união dos escopos numa credencial só.** _Exemplo:_ boletos e webhooks no
  mesmo pedido. _Prós:_ cache intocado, uma credencial por empresa. _Contras:_ **não medido** contra a
  conta real; o provedor pode recusar a união ou conceder escopo reduzido em silêncio — e "em
  silêncio" é a forma cara do defeito. Alarga o alcance de toda credencial do produto. _Viabilidade:_
  rejeitada por não-medição e por princípio de menor privilégio.
- **Alternativa A3 — obter credencial fresca a cada ato de webhook, sem cache.** _Prós:_ a ativação é
  rara (uma vez por cliente); o cache não compra nada. _Contras:_ cria um **segundo caminho** de
  obtenção, e o cache é hoje declarado *"a única forma de uma chamada obter credencial"*. _Viabilidade:_
  rejeitada — o ganho é nulo e o custo é a perda de um invariante.

**Trade-off aceito:** o processo passa a reter até duas credenciais vivas por empresa. Custo
desprezível; o esquecimento por invalidação continua valendo para as duas.

### D7 — O registro durável da habilitação é a **própria linha de estado**, não a trilha bancária

**Escolhida: a linha de estado por empresa é o registro do efeito; o diário operacional cobre o
diagnóstico.**

A ADR-0034 classifica: **recusa é efeito** (*"desfecho anômalo, como divergência e recusa"*), e
reconsulta que nada mudou **não é** — que é exatamente a RN-15. Mas o vaso existente da trilha bancária
é ancorado em **cobrança**, com lista fechada de rótulos, e a habilitação não é sobre cobrança alguma.

Com a linha de estado carregando desfecho, instante e autor, a RN-15 fica satisfeita **por
construção**: uma linha por empresa, sem registro novo quando nada muda. E não se perde nada, porque a
RN-04 já decidiu no PRD que *"o desfecho novo substitui o anterior"*.

- **Alternativa A2 — estender a trilha bancária com rótulos novos.** _Contras:_ exige âncora anulável
  para o ato sem cobrança e abre a lista fechada — muda a natureza de um vaso que a ADR-0034 desenhou
  para outra pergunta. _Viabilidade:_ rejeitada.
- **Alternativa A3 — tabela de histórico de tentativas.** _Contras:_ constrói retenção que o produto
  não pediu, e a RN-04 pede o oposto. _Viabilidade:_ rejeitada (YAGNI).

---

## Restrições e invariantes técnicas (herdadas — não são decisão desta fatia)

1. **A reconferência disparada pelo registro do certificado (RN-12) é enfileirada.** A ADR-0029 é
   literal: efeito externo *"cujo resultado **não compõe a resposta do pedido**"* é enfileirado pela
   borda. ⚠️ O caminho tentador — invocar o provedor em linha, dentro de um `try/catch` que engole a
   falha — **é exatamente o que a ADR proíbe**. O processo de trabalho já existe e a carga leva
   identificadores (ADR-0024).
2. **A ativação (cadastrar→confirmar) permanece em linha.** Mesma ADR-0029, cláusula seguinte:
   chamada síncrona cujo retorno o solicitante espera na própria resposta *"permanece em linha, e não
   é exceção"*. É o precedente literal da verificação de identidade.
3. **A consulta de estado NÃO fala com o provedor** — lê o que está persistido. A consulta ao vivo foi
   podada no discovery (C2): a recusa precisa **sobreviver à requisição**.
4. **A tabela nova nasce no schema de negócio**, com dono-empresa, RLS forçada (`USING` e `WITH
   CHECK`) e FK composta. ADR-0031 decide pela contrapositiva: ela **é** dado de empresa, logo não vai
   para o schema de plataforma, cujo roster enumerado não muda.
5. **A porta irmã nasce com as duas operações que têm chamador** — cadastrar e consultar —, e com
   nenhuma a mais. É o critério que o CT-809 já afirma sobre a porta precedente: *"a porta não nasce com
   assinaturas sem quem as chame"*. Conformidade à ADR-0001 pelas três condições cumulativas da emenda
   de 2026-08-15, com a cláusula de vocabulário **exigível por medição**, no molde do CT-809 (b).
6. ⚠️ **A autorização das rotas novas não se apoia na ADR-0021.** O marcador `DECISÃO FECHADA — T12 /
   Gate 2 rodada 1 + Gate 1 rodada 2` de `certificado.controller.ts` fixa que a exigência desta
   superfície apoia-se em **ADR-0011 + ADR-0018**, e que a 0021 entra **apenas como analogia de
   critério**, com a negação de governança na mesma oração. O `REVERTER EXIGE` é uma **emenda da
   ADR-0021** — escalada ao usuário, nunca decisão de executor ou de gate. O achado já voltou por
   caminho novo uma vez; as rotas novas são o próximo caminho.
7. **Nenhuma permissão nova**: as duas rotas sob a área e a ação que já governam o certificado
   (catálogo fechado, ADR-0011).
8. **O produto não oferece desabilitar** — a operação não existe no provedor (medido). Não se modela
   o que não se pode cumprir.
9. **Nada altera cadastro de terceiro.** A vaga ocupada é recusa informada, nunca disputa.
10. **ADR-0032 na íntegra** para material, senha e identificador da aplicação: entram cifrados, não
    retornam por superfície alguma, e a ausência de vazamento é afirmada **por medição da saída real** —
    incluindo a saída e o objeto de erro do processo externo, que é superfície nova.
11. **Nenhum `.pfx` na árvore versionada** (Invariante 3). O material legado que a prova exige é
    **gerado em execução** — é a parte cara, e é a razão de o `D64` ter sobrevivido a duas intervenções.
12. **A identidade perante o provedor já está modelada** e carrega o número do cliente que a
    ativação endereça. Reuso, não campo novo.

---

## Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC:**

- Os **códigos concretos** das três recusas e o mapa causa→código (D4 fixa que são três e
  discrimináveis pelo código; nomeá-los é forma de contrato).
- A **forma do portador opaco** do motivo (D5 fixa a natureza e a proibição de decidir sobre ele).
- O **teto de tempo** do processo externo e a política de repetição — se houver.
- Se a família de escopo é **atributo da operação da porta** ou do adaptador (D6 fixa que a chave do
  cache a incorpora; onde ela é declarada é detalhe do adaptador).

**Dependências de produto / operação — sinalizadas, não decididas aqui:**

- ✅ **[DÚVIDA] 3 RESOLVIDA por medição e por escopo, em 2026-08-21.** Medido: `/usr/bin/openssl`,
  **OpenSSL 3.0.13**, e o **provider `legacy` carrega**. Medido também que o verificador de
  provisionamento **não menciona `openssl`** — logo era mesmo presença de fato. A ADR-0036 assume em
  `Cons` que a pré-condição *"precisa ser afirmada pelo provisionamento"*, e **nenhuma fatia posterior
  tem como fazê-lo** (a F6 é frontend, a F7 é a virada). A afirmação entrou no escopo do PRD (§4.1,
  CA-21): é **acréscimo a um verificador existente**, não arquivo novo — **não toca o `D9`**.
- **`D9 · F0/T2` NÃO é tocado por esta fatia**: a afirmação do `openssl` entra num verificador que já
  existe, e acréscimo a arquivo existente não cria a 12ª cópia do esqueleto. O gatilho do `D9` segue
  disparado por outras razões e a unificação segue pendente — observação, não proposta desta fatia.
- **`D26 · F4/T9`** (ausência de expurgo dos boletos guardados) nomeia **duas** condições de gatilho:
  a chegada da **F5** — que chegou — **ou** a primeira medição do diretório acima de **20 GB**. Medido
  em 2026-08-21: o volume inteiro usa **24 GB de 128 GB**, sistema operacional, `/opt/frappe` e
  dependências incluídos, de modo que a guarda está **ordens de grandeza** abaixo do limiar. O débito
  segue **aberto e sem urgência**, podado deste PRD com a razão registrada.

---

## Medições que sustentam este documento

Todas feitas **neste host** em 2026-08-21, sobre material gerado em execução — nenhum segredo de
produção foi tocado, e nenhum `.pfx` entrou na árvore versionada (Invariante 3).

| # | O que se mediu | Resultado |
|---|---|---|
| M1 | Presença e versão do binário de criptografia | `/usr/bin/openssl`, **OpenSSL 3.0.13**; provider `legacy` **carrega** |
| M2 | O verificador de provisionamento o afirma? | **Não** — presença de fato confirmada |
| M3 | Gerar material em **cifra legada** em execução | ✅ `pbeWithSHA1And40BitRC2-CBC`, em **duas** invocações |
| M4 | O runtime recusa esse material? | ✅ `ERR_CRYPTO_UNSUPPORTED_OPERATION: Unsupported PKCS12 PFX data` — a premissa do `D64` reproduz |
| M5 | Decodificar lendo de **entrada padrão** | ✅ funciona |
| M6 | Exportar escrevendo em **saída padrão** | ✅ funciona |
| M7 | **Controle** — exportar *lendo* de entrada padrão | ✅ **falha**, como já medido: `Could not read any certificates from -in file from <stdin>` |
| M8 | O runtime abre o convertido | ✅ abre |
| M9 | Identidade preservada (titular · série · validade) | ✅ **idênticas**, comparadas por igualdade da tripla |
| M10 | Sinal do conversor com **senha errada** | `Mac verify error: invalid password?` — ⚠️ redação **diferente** da biblioteca |
| M11 | **Controle** — sinal com material que não é PKCS#12 | erro de codificação ASN.1; **não** casa `mac verify` → o par discrimina |
| M12 | Volume da guarda de boletos contra o limiar de 20 GB | 24 GB de 128 GB no volume **inteiro** — ordens de grandeza abaixo |

> ⚠️ **A "parte cara" do `D64` deixou de ser cara, e isto muda o custo da fatia.** O débito sobreviveu
> a duas intervenções porque a prova exigia *"material legado gerado em execução"* e isso era tido
> como caro (`fundacao-bancaria/v1/_run/run-report.md` §2, `D64`). M3 mede o contrário: são **duas
> invocações**, sem material versionado e sem depender do arquivo real da Autoridade Certificadora. O
> arranjo do caso que fecha o `D64` está, portanto, **disponível**.
