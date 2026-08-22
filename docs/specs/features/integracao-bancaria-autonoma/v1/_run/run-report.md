# Relatório do Run — integracao-bancaria-autonoma/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: ✅ **10/10 tasks concluídas — FATIA FECHADA** · 3 fases · 41 gates · nenhuma task bloqueada

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Conversão do material do certificado por processo externo | opus | 3 criados, 6 mod | ✅ APROVADO | ✅ APROVADO_COM_OBSERVACOES |
| T2 | Três causas de recusa, desfecho do registro e fecho do `D64` | opus | 0 criados, 13 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Pré-condição de ambiente da conversão, afirmada pelo provisionamento | opus | 0 criados, 1 mod | ✅ APROVADO_COM_OBSERVACOES | — (gates=[qa]) |
| T4 | Estado da entrega da notícia no banco — par de migrações e camada de dados | opus | 5 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T5 | Contrato publicado e porta de entrega da notícia do provedor | opus | 1 criado, 9 mod | ✅ APROVADO_COM_OBSERVACOES (r3) | ✅ **APROVADO** (r3) |
| T6 | Credencial por empresa e família de escopo; o adaptador satisfaz a porta nova | opus | 0 criados, 3 mod | ✅ **APROVADO** (r2) | ✅ APROVADO_COM_OBSERVACOES (r2) |
| T7 | Rotas de ativação e consulta da entrega da notícia | opus | 4 criados, 16 mod | ✅ **APROVADO** (r3) | ✅ **APROVADO** (r3) |
| T8 | Reconferência da entrega enfileirada após o registro do certificado | opus | 2 criados, 20 mod | ✅ **APROVADO** (r2) | ✅ APROVADO_COM_OBSERVACOES (r2) |
| T9 | Varreduras da saída real — nenhum segredo, e o dialeto só dentro do portador | opus | 0 criados, 2 mod | ✅ **APROVADO** | ✅ APROVADO_COM_OBSERVACOES |
| T10 | Degradação declarada, percurso ponta a ponta e fecho do índice | opus | 1 criado, 8 mod | ✅ APROVADO_COM_OBSERVACOES | — (gates=[qa]) |

⚠️ **A T5 levou 3 rodadas**, e nenhuma foi desperdiçada — detalhe na §4. ⚠️ **A T6 levou 2**, e a
segunda veio de um `ALTO`/`security` do Gate 2 que **discordou da classificação do Gate 1**: o mesmo
eixo que o QA marcara `baixo`/`tests` era, de fato, **ausência de garantia em produção** — a lacuna de
teste era sintoma. ⚠️ **A T7 levou 3** — a mais longa da fatia —, e as duas correções vieram de
gates diferentes atacando eixos diferentes: o QA pegou **um caso ausente** (a combinação que separa a
regra de uma disjunção), o TR pegou **uma decisão generalizada demais no docblock**. Nenhuma tocou o
mesmo ponto duas vezes. Detalhe na §4.

**Suítes**: `contracts` **424** · `db` **235** · `cobranca-bancaria` **105** · `api` **371** · `shared` 263 · `worker` **132** · `documentos` 159 · `auth` 89 · `regua` 30 — **1808 casos verdes nos 9 pacotes**

**Fila**: ✅ vazia — a fatia está fechada

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer categoria e médios de categoria anotável não bloqueiam.
>
> ⚠️ **Esta seção nasceu na T1**, e não no fecho da fatia. A razão é executável: o `CT-907` de
> `packages/shared/test/protocolo-antirregressao.spec.ts` exige que **todo campo `ÍNDICE` de marcador
> vivo aponte para arquivo existente**, e a T1 emitiu o primeiro `DÉBITO COM GATILHO` da fatia. Sem
> este arquivo, o marcador nasceria com ponteiro morto e a suíte de `@sysloc/shared` ficaria vermelha.
> A §1 acima é provisória e será regenerada pelo orquestrador; **a §2 é conteúdo e não se sobrescreve.**

### D1 · baixo · tests · T1 · executor

- **Onde:** `packages/cobranca-bancaria/src/conversao-do-material.ts` (junto de `executarOConversor`)
- **Problema:** o estouro de `TETO_DA_CONVERSAO_MS` não tem caso que o exerça. A prova existente
  cobre a **consequência** dele — o intermediário em claro removido no caminho de erro, `CT-1016` —,
  e não o disparo do teto em si.
- **Impacto:** medido como **baixo**. O que o teto protege é a requisição do Admin não ficar
  pendurada por um processo que não termina; o caminho de limpeza que importa (o `finally` que apaga
  o artefato) **está** provado nos três desfechos pelo `CT-1016`, e o desfecho do estouro é o mesmo
  `ErroDeFormatoDoMaterial` que o `CT-1015` já discrimina. O que falta é a prova de que o
  temporizador **dispara**, não a de que o sistema se comporta quando ele dispara.
- **Por que não agora:** os dois únicos arranjos disponíveis são proibidos. **(a)** Parametrizar o
  binário ou o teto no módulo introduziria símbolo *test-only* na produção — Iron Law #6, e em
  arquivo que manipula chave privada, onde um seam exposto torna o ato forjável. **(b)** Pôr no
  `PATH` um executável lento no lugar do `openssl` exigiria escrever `process.env.PATH`, que é
  **estado global do processo do arcabouço**, compartilhado por todos os arquivos da suíte.
- **Gatilho (o que o marcador declara):** quando o módulo ganhar, por outra razão já legítima, um
  ponto de injeção do binário ou do limite — ou quando o repositório adotar arranjo que substitua
  executável do host sem tocar o `PATH` global do arcabouço de teste.
- **O que fazer quando disparar:** um caso que apresente ao módulo um conversor que não termina
  dentro do teto, e afirme (i) a classe da recusa, (ii) que o processo foi encerrado e (iii) que o
  artefato em claro não sobreviveu — as três, e não apenas a primeira.
- **Prova exigida:** comportamental. O caso reprova naturalmente com um módulo sem teto, porque ele
  jamais resolveria; nenhuma prova de falsificação por mutante é devida (a asserção não é estática).

### D2 · baixo · documentation · T3 · QA

- **Onde:** `docs/specs/features/integracao-bancaria-autonoma/v1/tasks/T3.md:125`
- **Problema:** contagem literal de verificadores defasada. O **AT-3** afirma *"a contagem de
  verificadores permanece 10"* e a §3.2 escreve *"hoje conta 10 cópias do esqueleto"* ao lado de
  *"não se admite criar um 12º `verificar-*.sh`"* — as duas frases são **internamente incoerentes**.
  Medido: `ls deploy/scripts/*/verificar-*.sh | wc -l` = **11**. O 11º é
  `deploy/scripts/cobranca-bancaria/verificar-preparacao-do-material.sh`, untracked, criado na fase
  de preparação desta fatia e **anterior** a esta task. O corpo do marcador do `D9 · F0/T2`
  (`verificar-provisionamento.sh:226`) repete o mesmo número.
- **Impacto:** **escrituração vencida, não defeito.** A *intenção* do AT-3 está satisfeita: a task
  não criou verificador algum, acresceu ao arquivo existente, e o marcador do `D9` continua vivo e
  intacto (`grep -c` = 1). O risco é o número errado ser copiado adiante por quem confia na prosa.
- **O que fazer:** atualizar o literal para **11** no AT-3 e na §3.2 da T3 — e no corpo do marcador
  do `D9`, quando alguma task estiver **legitimamente autorizada** a abrir aquele arquivo. Melhor
  ainda: substituir o número por **comando de medição**, que é a forma que o próprio marcador já usa
  noutros pontos (*"a contagem sai do comando, que não envelhece"*).

### D3 · BAIXO · security · T1 · Tech Review · ✅ **FECHADO na intervenção dirigida de 2026-08-22**

> **Como fechou:** `env: {}` declarado no `spawn` de `executarOConversor`, sob marcador
> `DECISÃO FECHADA`. A exigência do débito — *"medir antes de aplicar"* — foi cumprida antes da
> edição: o ciclo completo das duas invocações, `-legacy` incluso, corre com ambiente vazio
> neste host (OpenSSL 3.0.13; decodificar 3039 B, reexportar 2515 B), e o inverso também foi
> medido — com `OPENSSL_MODULES` plantado no ambiente do pai, a herança de antes DERRUBA a
> conversão (`unable to load provider legacy`). Rede do P4: **CT-1050**, comportamental, com
> controle positivo que prova a variável hostil neste host (`@sysloc/cobranca-bancaria` 105 →
> 106). A tabela de guardas do cabeçalho do módulo passou a registrar a sexta guarda.

- **Onde:** `packages/cobranca-bancaria/src/conversao-do-material.ts:~430` (`executarOConversor`)
- **Problema:** o `spawn(CONVERSOR, [...], { shell: false, stdio: [...] })` **não declara `env`**, de
  modo que o subprocesso herda o ambiente completo do processo da API. O cabeçalho do próprio módulo
  enumera cinco guardas e **nomeia o ambiente como superfície legível** — *"`argv` é legível por
  qualquer processo da máquina; ambiente também"* —, mas a guarda correspondente não foi instalada.
- **Impacto:** baixo e **condicionado a comprometimento prévio** do ambiente do serviço (que vive em
  `EnvironmentFile` 0600 sob systemd, não controlável por usuário do produto). **Não há caminho de
  exploração a partir de entrada do Admin.** O que se perde é defesa em profundidade num ponto em que
  o módulo já pagou o custo de todas as outras guardas: a incoerência é entre o `PATH` (blindado por
  caminho absoluto, justamente porque *"pode ser reescrito"*) e o resto do ambiente (herdado) — sobre
  o **mesmo** executável, que é quem manipula a chave privada em claro. O `openssl` lê `OPENSSL_CONF`
  e `OPENSSL_MODULES`; o carregador dinâmico lê `LD_PRELOAD`/`LD_LIBRARY_PATH`.
- **O que fazer:** declarar `env` explícito no `spawn` (ex.: `{ PATH: '/usr/bin' }` ou `{}`) e
  **medir antes de aplicar** — o `-legacy` precisa carregar o provider da cifra fraca, e isso depende
  da instalação do host. A conferência é a que o módulo já pratica: rodar `CT-1014` e `CT-1015` com o
  ambiente restrito e confirmar que a conversão preserva identidade e que a senha errada continua
  classificando como senha. Se alguma variável for necessária, ela entra na lista explícita **com a
  razão em docblock** — melhor registro que a herança silenciosa.

### D4 · BAIXO · project_pattern · T1 · Tech Review

- **Onde:** `packages/cobranca-bancaria/src/conversao-do-material.ts:225-228,575-577` e
  `packages/cobranca-bancaria/src/leitura-do-material.ts:145,434-447`
- **Problema:** a forma textual do sujeito passa a ter **duas derivações de produção** e **três
  declarações do separador** `', '` (a terceira em `test/material-de-teste.ts:113`, ali
  deliberadamente, como oráculo independente do SUT). As duas derivações **não são cópia-e-cola** —
  os tipos de entrada diferem (`PeerCertificate['subject']` vs. cadeia do `X509Certificate`) e não se
  unificam trivialmente —, mas ambas precisam produzir a **mesma** cadeia, porque
  `exigirIdentidadePreservada` compara `lido.titular` (produzido por uma) com
  `formaTextualDoSujeito(origem)` (produzido pela outra).
- **Impacto:** atenuado e **não silencioso** — a divergência é executavelmente detectada: alterar o
  separador em apenas um dos dois faz `exigirIdentidadePreservada` recusar material válido e o
  `CT-1014` reprovar. O custo real é o **modo de falha ser enganoso** (o sintoma seria *"o certificado
  do Admin foi recusado por formato"*, não *"o separador divergiu"*), e o `leitura-do-material.ts:430`
  já advertir que alterar essa forma muda o titular de material **já registrado**. O Limiar de Três
  não disparou (2 consumidores de produção), mas o precedente do repositório registra débito já na
  **segunda** declaração quando nada amarra as duas (`D14 · F3/T5`, `D26 · F3/T8`).
- **O que fazer:** (a) exportar `SEPARADOR_DO_SUJEITO` de `leitura-do-material.ts` — export de
  módulo, **sem tocar o barril nem `MaterialLido`**, portanto sem mexer na superfície que o `CT-806`
  afirma por igualdade — e importá-lo em `conversao-do-material.ts`, deixando duplicada apenas a
  montagem, que os tipos obrigam; **ou** (b) registrar `DÉBITO COM GATILHO` no ponto de
  `formaTextualDoSujeito`, com `QUANDO FECHA` = a terceira derivação de produção, ou a primeira
  alteração do separador — nas três pontas da §3-B.

### D5 · BAIXO · project_pattern · T1 · Tech Review

- **Onde:** `CLAUDE.md`, bloco "Estado atual", linha da suíte
- **Problema:** a emenda desta task escreve que *"`shared` foi **reconferido** na mesma data"*, mas o
  antecedente mais próximo é **2026-08-20** e a reconferência só pôde ocorrer em **2026-08-21** — ela
  foi disparada pela mudança do índice de débito feita por esta task. O fecho da própria frase
  (*"os demais seguem com a medição de 2026-08-20"*) só faz sentido se "a mesma data" for outra.
- **Impacto:** nenhum efeito em código. O custo é o do arquivo: o `CLAUDE.md` entra no contexto de
  **todo** agente em **toda** task, e a próxima sessão que precisar decidir se `shared` está medido ou
  defasado lê uma data que não bate com o motivo declarado da remedição. É escrituração.
- **O que fazer:** trocar *"na mesma data"* por *"em 2026-08-21"*. Uma linha, **sem tocar em nenhum
  dos números** (1744, 100, 254), que estão corretos e conferidos.

### D6 · baixo · documentation · T1 · orquestrador · ✅ **FECHADO na T10 (2026-08-22)**

- **Onde:** `packages/cobranca-bancaria/test/conversao-do-material.spec.ts:607`
- **Problema:** **colisão de identificador de caso de teste.** Existem **dois `CT-1022`
  distintos** nesta fatia, ambos implementados e ambos verdes: (a) o de
  `conversao-do-material.spec.ts:607` — *"o radical do conversor é o do executável"* —,
  **acrescentado** pelo executor da T1; e (b) o de
  `apps/api/test/certificado-do-provedor.e2e.spec.ts:1041` — *"senha errada sobre material legado
  nomeia a senha"* —, que é o **card da §6.6 da T2**, alocado desde a geração do plano.
- **Impacto:** **baixo, e não afeta comportamento** — os dois casos são válidos, discriminam coisas
  diferentes, vivem em pacotes distintos e passam. O custo é de **rastreabilidade**: a §9.3 do
  `task_plan.md` afirma *"cada CT aparece na §6 de exatemente uma task — **verificado**"*, e essa
  garantia deixou de valer. Quem cruzar CA→CT depois encontra duas respostas para o mesmo
  identificador. A causa-raiz é o executor da T1 ter inferido *"CT-1022 é o primeiro livre depois de
  CT-1021"* — premissa falsa, porque a **T2 já detinha `CT-1020` a `CT-1023`**.
- **O que fazer:** renumerar o caso **da T1** (o de `conversao-do-material.spec.ts`) para
  **`CT-1048`** — medido como o primeiro realmente livre: os IDs alocados no plano vão de `CT-1011`
  a `CT-1047`, sem furo depois de `CT-1013`. Atualizar as três ocorrências no arquivo (docblock de
  rastreabilidade, tabela do cabeçalho e o `it`), mais a §6.2/§6.5/§6.6 da `T1.md`. **Não** mexer no
  da T2, que é o legítimo. Cabe na escrituração de fecho da **T10**, junto com a contagem de casos
  da §19 do tech spec.
- **Fecho (T10, 2026-08-22):** renumerado para **`CT-1048`** — **medido** como o primeiro
  identificador realmente livre de todo o repositório na data (varredura de `CT-1[0-9]{3}` sobre
  `apps`, `packages`, `deploy` e `docs`: `CT-1049` já estava em uso pela T5, em
  `packages/db/test/entrega-da-noticia.spec.ts`, e `CT-1048` era o furo). Trocadas as **5**
  ocorrências de `packages/cobranca-bancaria/test/conversao-do-material.spec.ts` e as **6** de
  `T1.md`, com nota nos dois arquivos explicando a premissa falsa de origem — sem ela, a próxima
  leitura "corrige" o número de volta. A contagem do pacote **não se move** (105 antes e depois): o
  caso é o mesmo, com o mesmo corpo e as mesmas asserções.

### D7 · baixo · documentation · T2 · QA

- **Onde:** `docs/specs/features/integracao-bancaria-autonoma/v1/tasks/T2.md:235`
- **Problema:** a §6.3 (card do `CT-1021`) e a §6.4 (tabela de cenários de erro) ainda prescrevem o
  arranjo `['SENHA_NAO_ABRE', 'MATERIAL_ILEGIVEL', 'JA_VENCIDO']`. O motivo interno **real** produzido
  pela borda é `FORMATO_NAO_SUPORTADO`.
- **Impacto:** **o texto da task ficou para trás, não a prova.** A divergência é legítima e está
  declarada por extenso no docblock das constantes do spec (linhas 552-564) e em
  `segredo-nao-escapa.e2e.spec.ts:586`: desde que a borda passa por `converterMaterialSeNecessario`,
  `ErroDeMaterialIlegivel` **não escapa mais daquele módulo** — quem chega é `ErroDeFormatoDoMaterial`.
  A **invariante do card está integralmente preservada** (três motivos distintos, afirmados por
  igualdade de arranjo ordenado, **antes** das comparações de corpo).
- **O que fazer:** atualizar a §6.3 e a linha *"Formato que não abre nem converte"* da §6.4 para
  `FORMATO_NAO_SUPORTADO`, remetendo a `MOTIVO_DO_FORMATO_NAO_SUPORTADO` da T1. **Não alterar o
  teste** — o literal implementado é o motivo real medido.

### D8 · BAIXO · performance · T2 · Tech Review

- **Onde:** `apps/api/src/integracoes-bancarias/certificado.service.ts:424` e `:611` (`prepararMaterial`)
- **Problema:** o material é **aberto duas vezes no caminho comum** (cifra moderna).
  `this.converter(segredo)` → `converterMaterialSeNecessario` já executa `lerMaterial(segredo)` dentro
  de `oRuntimeAbre` para decidir se converte; em seguida `this.ler(paraGuardar)` executa `lerMaterial`
  **de novo sobre exatamente o mesmo invólucro** no caminho não convertido, onde
  `paraGuardar === segredo`. O próprio docblock do teto contabiliza as duas leituras.
- **Impacto:** aperto de mão PKCS#12 feito duas vezes por registro — e este será o caminho **comum**
  depois da renovação. Baixo em valor absoluto (o registro é ato raro de configuração, e o teto de 5 s
  é limite, não custo típico), mas é trabalho **estritamente redundante** e engorda o pior caso
  declarado da rota.
- **O que fazer:** fazer `MaterialPreparado` (`packages/cobranca-bancaria/src/conversao-do-material.ts:238`)
  carregar o `MaterialLido` que `oRuntimeAbre` já obteve no caminho direto — p. ex.
  `{ material, convertido: false, lido }` —, deixando o serviço reler apenas quando
  `convertido === true`. ⚠️ Alterar a assinatura é escopo da **T1**, já fechada: registrar como
  `DÉBITO COM GATILHO` com `QUANDO FECHA: a primeira task autorizada a abrir conversao-do-material.ts`.

### D9 · BAIXO · performance · T2 · Tech Review

- **Onde:** `apps/api/src/integracoes-bancarias/certificado.service.ts:~401` (docblock de `prepararMaterial`)
- **Problema:** o docblock declara o pior caso em **75 s** (5+30+5+30+5) e afirma que ele *"fica abaixo
  do teto de requisição do runtime"*. A afirmação **não é medida** e — mais importante — **não alcança
  a borda**: na F7 a API passa a ser publicada atrás do servidor de borda, cujo `proxy_read_timeout`
  padrão é **60 s**.
- **Impacto:** ⚠️ **nenhum hoje** (a rota do certificado não é publicada pelo vhost atual), mas na F7 o
  Admin recebe **`504` da borda enquanto o subprocesso de conversão continua correndo com o
  intermediário em claro vivo** — que é **exatamente** o desfecho pelo qual a decisão de não acrescentar
  teto de rota foi tomada, chegando **pelo caminho que ela não cobre**. O risco é forward-looking e o
  gatilho é conhecido.
- **O que fazer:** registrar `DÉBITO COM GATILHO` junto do docblock do teto, com
  `QUANDO FECHA: a publicação da API atrás do servidor de borda na F7 — o proxy_read_timeout do vhost
  precisa cobrir os 75 s desta rota, ou a rota precisa deixar de ser síncrona`, com `ÍNDICE` para a §2
  deste run-report. E trocar *"fica abaixo do teto de requisição do runtime"* por uma frase que declare
  o **valor medido**, ou constate que o runtime não impõe teto por padrão. Precedente da mesma classe:
  `D27 · F4/T11` (`deploy/nginx/sysloc-notificacao-bancaria.conf`).

### D10 · BAIXO · code_quality · T2 · Tech Review

- **Onde:** `apps/api/src/integracoes-bancarias/certificado.service.ts:219-220`
- **Problema:** o docblock de `TRILHA_DO_MATERIAL_RECUSADO` diz *"uma para as **duas** causas"*. Ela é
  usada hoje por **três** recusas — vencimento (linha 486) e senha/formato, ambas por `recusaDoMaterial`
  (linha 657). O docblock **imediatamente acima**, o de `MOTIVO_DO_VENCIDO`, já escreve corretamente
  *"os **três** nomes ocupam o mesmo campo"*.
- **Impacto:** baixo, mas **não nulo neste repositório**: a própria task argumenta — com razão — que
  docblock que sobrevive à decisão que ele explica é o vetor da regressão de decisão. Este é resíduo do
  texto de "duas causas" que o resto do arquivo eliminou com cuidado.
- **O que fazer:** `/** A frase que o journal carrega quando a recusa do material acontece — uma para as três causas. */`

### D11 · baixo · documentation · T4 · QA

- **Onde:** `packages/db/src/esquema/negocio.ts:61`
- **Problema:** o parágrafo conserva uma **bicondicional falsa** pré-existente: *"o que **obriga** a
  parceira autoral … é **nascer tabela em `negocio`**"* seguido de *"são exatamente elas que têm
  parceira"*. A árvore falsifica: existem **onze** migrações `*seguranca*.sql`, e a
  `0020_seguranca_webhook_e_carne.sql` é parceira autoral da `0019`, **que cria tabela apenas em
  `plataforma`**. A omissão da `0020` na lista de dez é legítima (a lista declara *onde cada tabela já
  protegida foi protegida*, e a `0020` não protege tabela nascida nela) — o que alcança demais é a
  **bicondicional**.
- **Impacto:** defasagem **herdada da fatia `webhook-e-carne`**, anterior a esta task. ⚠️ **Nada no
  diff da T4 a introduziu ou agravou** — o executor apenas acrescentou a entrada da `0022` que faltava
  e acertou a contagem, sem o que a própria edição dele tornaria o parágrafo contraditório.
- **O que fazer:** ⚠️ **NÃO corrigir dentro desta task** — é texto alheio, pré-existente, e ampliar o
  diff para alcançá-lo contraria a Regra 2 do `CLAUDE.md` (menor delta possível) e a **proibição 5** do
  Protocolo Antirregressão (*"nunca aproveitar que estou aqui"*). Quando alguma fatia futura abrir o
  parágrafo por outra razão, trocar a bicondicional por formulação que acomode a `0020` — p. ex.
  *"o que obriga parceira autoral é o gerador não emitir `FORCE`, política, papel, `GRANT` nem
  função"*, que é a razão que a própria `0020` declara no cabeçalho dela.

### D12 · BAIXO · project_pattern · T4 · Tech Review

- **Onde:** `deploy/scripts/instalacao/verificar-migracao.sh`, cabeçalho ~linhas 200-218 (constante na 237)
- **Problema:** `TABELAS_DE_NEGOCIO_ESPERADAS` recebeu `negocio.entrega_da_noticia` (22 → 23 objetos),
  mas o **log de proveniência** do cabeçalho — *"ATUALIZADA EM 2026-08-14 … ATUALIZADA EM 2026-08-16 …"* —
  parou na `0017`/`0018` e **não registra nem a `0021` nem a `0023`** desta task. O mesmo executor
  atualizou a prosa correspondente nas **duas frentes irmãs** no mesmo diff (`catalogo.spec.ts` 12×,
  `papel-de-conexao.spec.ts` com a cadeia de quem acrescentou o quê). **A terceira frente ficou para trás**
  — e o próprio cabeçalho declara que ela mantém *"a MESMA `TABELAS_DE_NEGOCIO_ESPERADAS`"* em paralelo.
- **Impacto:** **nenhum efeito executável** — a asserção (b) do `CT-031` compara a lista por igualdade e
  segue correta. O custo é de leitura, e é o que a `ancoras-de-superficie.md` nomeia: *"número narrativo
  que fica para trás convida a próxima task a 'corrigir' a âncora executável para o valor errado"*.
- **O que fazer:** acrescentar ao cabeçalho a linha `ATUALIZADA EM 2026-08-22 pela T4 da fatia
  integracao-bancaria-autonoma, no mesmo commit das migrações 0023/0024 …`. ⚠️ **A lacuna da `0021` é
  PRÉ-EXISTENTE** (veio do fecho do `D36 · F4/T10`) e fechá-la é texto alheio que esta task **não** torna
  incoerente — registrar como débito ou mencionar numa cláusula, nunca corrigir ali.

### D13 · BAIXO · code_quality · T4 · Tech Review

- **Onde:** `packages/db/test/unidade-de-trabalho.spec.ts:741-786`
- **Problema:** o bloco de comentário da **T2 da fatia `webhook-e-carne`** documenta os três símbolos
  `esquemaPlataforma.*` e termina em *"Nenhuma entrada anterior sai."* — mas o bloco+entrada da T4 foi
  inserido **entre ele e as entradas que ele descreve**. A linha 762 passa a ser seguida por outro
  comentário, e a única entrada que sucede o bloco da T2 é `'esquemaNegocio.entregaDaNoticia'`. Pior: o
  bloco da T2 abre com *"⚠️ O namespace se chama `esquemaPlataforma`, e não `esquemaNegocio`"* —
  advertência que agora antecede justamente uma entrada `esquemaNegocio`.
- **Impacto:** **nenhum na asserção** (`auditarSuperficie` compara por `includes`/`filter`, ordem
  irrelevante). O custo é de **memória do projeto**: este arquivo é o registro de **por que** cada símbolo
  entrou, e atribuição errada de bloco é exatamente o que faz uma rodada futura reabrir decisão fechada.
- **O que fazer:** mover o bloco da T4 (763-782) junto com `'esquemaNegocio.entregaDaNoticia'` para
  **depois** de `'esquemaPlataforma.plataforma'` (786), restaurando a adjacência — que é a convenção
  uniforme das ~57 seções do arquivo, e a que a **própria T4 seguiu** na segunda inserção (1548-1578).

### D14 · BAIXO · code_quality · T4 · Tech Review

- **Onde:** `packages/db/src/esquema/negocio.ts:54` (116 caracteres) e `:63` (125)
- **Problema:** texto acrescentado a linhas pré-existentes **sem re-quebra do parágrafo**. O `biome.json`
  fixa `lineWidth: 100`, e o docblock ao redor respeita (linhas 14-70 entre 26 e 102). Antes da task o
  arquivo tinha 2 linhas acima de 110; agora tem 4.
- **Impacto:** legibilidade apenas — o Biome **não reflui comentário**, então o lint permanece limpo e o
  desvio só aparece na leitura.
- **O que fazer:** re-quebrar as linhas 53-55 e 62-64 a 100 colunas. ⚠️ **NÃO tocar na linha 2193** (120
  caracteres): ela está **dentro do template `sql` da `CHECK`**, e re-quebrá-la **mudaria o texto emitido
  de uma migração já aplicada**.

### D15 · baixo · documentation · T5 · orquestrador

- **Onde:** `apps/api/test/validacao.spec.ts` (texto do `it` do `CT-357` e mensagem do `expect`) e
  `apps/api/src/comum/esquema-de-corpo-vazio.ts` (docblock)
- **Problema:** **prosa defasada em três pontos** sobre a mesma âncora. A constante
  `IMPORTADORES_DO_CORPO_VAZIO_ESPERADOS` tem **9 entradas** e a medição real dá **9** — a âncora
  executável está **correta e sincronizada**. Mas o texto do `it` diz *"uma definição … e **seis**
  importadores"*, a mensagem de erro diz *"deixaram de ser as **seis** bordas revisadas"*, e o docblock
  do módulo diz *"a definição chegou a quatro cópias … **quatro** importadores"*.
- **Impacto:** ⚠️ **é exatamente a classe que a `.claude/rules/ancoras-de-superficie.md` nomeia** —
  *"número narrativo que fica para trás convida a próxima task a 'corrigir' a âncora executável para o
  valor errado"*. Aqui o risco é concreto e já se materializou **neste run**: ao preparar o alerta da
  T7, o orquestrador leu *"quatro importadores"* no docblock e concluiu, **erradamente**, que importar
  `ESQUEMA_DO_CORPO_VAZIO` na rota nova **quebraria** o `CT-357`. Só a medição da constante desfez o
  engano. Um executor sem essa medição teria evitado o import por uma razão inexistente.
- **O que fazer:** atualizar os três números para **9** (ou substituí-los por *"os importadores
  declarados na constante"*, que **não envelhece**). Fora do escopo de qualquer task desta fatia —
  ninguém a tocou; foi descoberto por medição colateral. Cabe numa fatia que abra `validacao.spec.ts`
  por outra razão, ou na escrituração de fecho.

### D16 · medio · tests · T5 · QA

> **Anotável, não bloqueante**: `categoria: tests` com `smell: semantically_duplicated_test` (AP-26),
> que pertence ao conjunto de manutenibilidade da partição de bloqueio seletivo.

- **Onde:** `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:1696`
- **Problema:** o controle positivo do `CT-1032` é **cópia byte a byte** do controle do `CT-991`, no
  mesmo arquivo — a tupla do AP-26 coincide em **4 dos 4** campos. A cópia é subconjunto estrito do
  original (só perdeu as duas âncoras de `TERMOS_DO_DIALETO` do topo). **O poder de detecção
  acrescentado é ZERO**: os dois blocos exercem a mesma cadeia sobre o mesmo fonte sintético, de modo
  que qualquer defeito no extrator reprova nos dois de forma indistinguível. O comentário justifica a
  cópia dizendo que ela é *"reafirmada aqui para o conjunto de módulos deste caso"* — **factualmente
  falso**: o controle não toca conjunto de módulos algum.
- **Impacto:** ⚠️ **a §6.6 da task mandava o oposto**, no passo 1 do `CT-1032`: *"reafirmar o controle
  positivo que o `CT-991` já implementa, **SEM DUPLICÁ-LO**"*. E há ironia útil ao revisor seguinte: a
  decisão A1 nº 1 do executor **invoca AP-26** como razão para não estender `MODULOS_DA_FATIA` — e ali
  a leitura procede —, mas o mesmo antipadrão foi introduzido no bloco de controle logo abaixo.
- **O que fazer:** remover o caso duplicado do `CT-1032` e deixar o controle viver **uma vez só** no
  `CT-991` (o `describe` do `CT-1032` segue não-vacuoso pelas âncoras que já tem por módulo). Se a
  intenção for registrar a dependência, um comentário de uma linha apontando o `CT-991` basta.
  Alternativa equivalente: extrair o corpo para função nomeada e invocá-la nos dois blocos.

### D17 · baixo · data_handling · T5 · QA · ✅ **FECHADO na intervenção dirigida de 2026-08-22**

> **Como fechou:** o eixo de tamanho virou predicado **total** — a serialização passou para
> `cabeNoTetoDeCaracteres`, que a envolve em `try/catch` e devolve `false` para o valor que não
> serializa. Sob marcador `DECISÃO FECHADA`, com a razão de por que a proteção é sobre o **ato**
> de serializar e não sobre uma lista de valores ofensores: assim ela alcança também o `toJSON`
> que lança e o `Proxy` que lança na leitura, sem que ninguém precise prevê-los. O `path` não
> mudou, como o bloco previa.
>
> **Defeito reproduzido antes da edição**, contra o `dist/` de então — as mesmas duas linhas que
> este bloco registra: `Do not know how to serialize a BigInt` e `Converting circular structure
> to JSON`. **Rede (P4):** o par de casos que o bloco pedia, acrescentado ao `CT-1044` com
> controle positivo (`@sysloc/contracts` 424 → 425).

- **Onde:** `packages/contracts/src/integracao-bancaria.ts:656`
- **Problema:** o teto de tamanho do `diagnostico` **LANÇA** em vez de recusar quando o valor não é
  serializável. O refino mede `JSON.stringify(registro).length`, e como `z.record(z.string(),
  z.unknown())` admite qualquer valor, um `BigInt` ou uma referência circular fazem o `JSON.stringify`
  levantar **dentro** do refino — e o Zod não captura exceção arbitrária de refinamento, de modo que
  `safeParse` **propaga** em vez de devolver `{ success: false }`.
- **Impacto:** ⭐ **medido, não argumentado**, contra o `dist/` compilado desta task:
  `bigint -> safeParse LANÇOU: TypeError Do not know how to serialize a BigInt` e
  `circular -> safeParse LANÇOU: TypeError Converting circular structure to JSON`. Quebra o contrato
  tácito de que `safeParse` não levanta — e a ironia é que o furo mora **justo no guarda anti-abuso**,
  cujo docblock declara que *"o que chega de terceiro não se limita por confiança"*. É **BAIXO** porque
  **nenhum caminho de dado existente produz esses valores**: a projeção vem de coluna `jsonb` do próprio
  produto, e a resposta do provedor chega por `JSON.parse` — nenhuma das duas origens gera `BigInt` nem
  ciclo. Fica anotado porque **este é o contrato publicado que o frontend importa**, e a superfície
  **não se reabre depois do congelamento**.
- **O que fazer:** tornar o refino **total** — envolver a serialização num `try/catch` que devolva
  `false` (valor não serializável é, por definição, diagnóstico que o produto não pode gravar) — ou
  restringir o valor a `z.json()`. O `path` já está correto e não muda. Acrescentar ao `CT-1044` o par
  de casos que hoje não existe: `diagnostico` não serializável **recusa** pelo `path`
  `['motivo','diagnostico']`, em vez de derrubar o chamador.

### D18 · baixo · tests · T5 · QA

> `smell: semantically_duplicated_test` — anotável.

- **Onde:** `packages/contracts/test/esquemas.spec.ts:5062`
- **Problema:** a estritude de `esquemaDoCertificado` ganha caso próprio onde o laço table-driven de
  `VARIANTES_COM_SEGREDO` (linha 4224) **já a afirma** — mesmo alvo, mesma forma de parâmetro, mesmo
  resultado. A tupla coincide em 3 de 4 campos, e o poder de detecção é o mesmo: afrouxar para
  `z.object` reprova nos dois (o docblock registra esse mutante como já executado, `MT-T1-C`).
- **Impacto:** classificado **BAIXO**, e não MÉDIO como o catálogo sugere para AP-26, por uma diferença
  de impacto **real**: diferente do `D16`, esta cópia acrescenta valor de **LOCALIZAÇÃO** — é a rede do
  `AT-9` posta **dentro do bloco onde a tentação de "afrouxar o certificado junto" de fato
  aconteceria**, e custa um caso barato e sem estado.
- **O que fazer:** **manter**, se a co-localização for julgada útil, acrescentando ao comentário o
  ponteiro explícito para o laço do `CT-848` e deixando escrito **qual metade** a redundância acrescenta
  (localização, não detecção). Alternativa: remover e citar o `CT-848` no docblock do `CT-1044` — que é
  o que a §6.5 linha 9 da task já declara.

### D19 · MEDIO · project_pattern · T5 · Tech Review

> **Anotável** — `MEDIO` de categoria `project_pattern`, que está na lista MÉDIO anotável do Gate 2.

- **Onde:** `packages/contracts/src/integracao-bancaria.ts:653` e `:656`
- **Problema:** são os **primeiros `.refine()` de esquema de SAÍDA** do pacote. O gate levantou todos os
  demais — `contrato.ts:232`/`:255`, `cobranca.ts:293`, `carne.ts:96`/`:129`/`:133`,
  `cobranca-bancaria.ts:207`, `automacao-de-cobranca.ts:213` — e **todos os nove** estão em esquema de
  **entrada**, onde o `safeParse` de `apps/api/src/comum/validacao.ts:51` os executa de fato.
- **Impacto:** a diferença **não é estilística**: em saída o `.refine()` é **inerte por construção**
  nesta arquitetura, porque saída só alimenta `z.toJSONSchema` e refinamento **não tem representação em
  JSON Schema**. É a **causa-raiz do P1**, e é a classe de armadilha que se repete — a forma parece uma
  guarda, passa no teste (que chama `safeParse` direto) e não protege nada em produção. O gate fez sweep
  em `.claude/rules/*` e `docs/adr/*`: **nenhuma rule e nenhuma ADR registram a convenção**.
- **O que fazer:** ao resolver o `P1`, registrar no docblock dos dois `.refine()` que eles **não vigoram
  em produção** e nomear onde a restrição de fato mora — ou removê-los, se o teto passar a ser aplicado
  na escrita. Independentemente disso, a convenção merece **uma linha em
  `.claude/rules/contrato-publicado.md`** (candidato a regra já emitido).

### D20 · baixo · documentation · T5 · QA (rodada 2)

- **Onde:** `packages/db/src/entrega-da-noticia.ts:230` (docblock de `limitarDiagnostico`)
- **Problema:** o docblock declara que o descarte é *"por chave inteira, na ordem em que o provedor as
  devolveu (`Object.keys` **preserva a ordem de inserção**)"*. **Em JavaScript isso é falso quando há
  chaves que são índices inteiros** (`'0'`, `'1'`, `'12'`): essas vêm **primeiro**, em ordem numérica
  ascendente, antes das demais na ordem de inserção.
- **Impacto:** se o provedor devolver diagnóstico com chaves numéricas em texto **e** mais de
  `MAIOR_DIAGNOSTICO_EM_CHAVES` entradas, o recorte que sobrevive **não é** *"as primeiras que ele
  mandou"*. O comportamento continua **determinístico** e o dado gravado continua íntegro no valor — o
  que está errado é a **afirmação**, e ela é o tipo de frase em que um agente futuro se apoia. Não
  afeta critério de aceite algum nem o `CT-1049` (que usa `campo0..campo32`, não-inteiras).
- **O que fazer:** ajustar a frase para dizer que a ordem é a de `Object.keys` (inserção para
  não-inteiras; índices inteiros primeiro, em ordem numérica), **ou** declarar explicitamente que a
  hipótese de chave inteira não se aplica ao diagnóstico de um provedor bancário. **Nenhuma mudança de
  código é necessária.**

### D21 · baixo · documentation · T5 · QA (rodada 2)

- **Onde:** `docs/specs/features/integracao-bancaria-autonoma/v1/tasks/T5.md:143`
- **Problema:** dois pontos da §4 divergem do estado real após a correção: **(a)** o **AT-8** descreve o
  teto como algo que *"recusa o que os excede, com o `path` apontando o campo"*, enquanto o mecanismo
  que efetivamente protege o dado passou a **truncar na escrita** (`limitarDiagnostico`) — a recusa
  pelo `path` sobrevive apenas como **conferência de leitura**; **(b)** o **AT-10** registra `contracts`
  em **423**, e a correção levou o pacote a **424**.
- **Impacto:** nenhum invalida o aceite (o AT-8 está satisfeito **nas duas leituras**, e o AT-10 mede
  *"não caiu"*, que se mantém). O custo é que **o registro da task fica mentindo por omissão sobre a
  forma do mecanismo** — que é exatamente o que a rodada seguinte lê. ⚠️ A decisão do executor de **não
  editar** arquivo fora da lista de escopo (A1 nº 3) **está correta em mecanismo**.
- **O que fazer:** na escrituração de fecho, emendar o AT-8 para declarar **as duas pontas** (*"o teto
  vigora truncando na escrita — `CT-1049` —, e o esquema publicado o repete como conferência de
  leitura, recusando pelo `path` — `CT-1044`"*) e atualizar o AT-10 para `contracts` **424**,
  acrescentando `db` 234 → **235**.

### D22 · baixo · documentation · T5 · QA (rodada 3)

- **Onde:** `packages/db/test/entrega-da-noticia.spec.ts:866` (docblock de `comoOProvedorEntrega`)
- **Problema:** o docblock diz *"A distinção é o eixo do **passo 7** e não é cosmética"*, mas o único
  passo que exercita `comoOProvedorEntrega` é o **passo 6** (a armadilha de protótipo). O passo 7 é a
  costura com `esquemaDoMotivoDaRecusa`, que **não usa o acessório**.
- **Impacto:** o ponteiro ficou para trás quando a costura foi **renumerada de 6 para 7** para abrir
  espaço ao passo novo. ⚠️ É *"exatamente a classe de frase em que um agente futuro se apoia para
  decidir o que pode mexer, e ela já aponta para o lugar errado no mesmo diff que a criou"*.
- **O que fazer:** trocar *"o eixo do passo 7"* por *"o eixo do passo 6"*. **Nenhuma asserção muda.**

### D23 · MEDIO · documentation · T6 · QA

> **Anotável** — `MEDIO` de categoria `documentation`, na lista anotável da partição do Gate 1.

- **Onde:** `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:2203`
- **Problema:** a T6 subiu `CAPACIDADES_DO_ADAPTADOR` de **5 para 7** (com o `SUT_IS_CORRECT_BECAUSE`
  exigido), mas o **nome do caso** que afirma essa âncora continua `'aceita as três formas boas e
  devolve as **cinco** capacidades da porta'`.
- **Impacto:** ⚠️ é **exatamente** o modo de falha que a `.claude/rules/ancoras-de-superficie.md` nomeia
  no 3º bullet — número narrativo que fica para trás **no mesmo diff que sobe a constante**, e que
  *"convida a próxima task a 'corrigir' a âncora executável para o valor errado"*. A asserção está
  correta e é igualdade de conjunto; o defeito é a prosa que a rotula.
- **O que fazer:** trocar `cinco` por `sete` no nome do `it`. **Uma palavra.**

### D24 · baixo · tests · T6 · QA

> `smell: happy_path_only`

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1649`
- **Problema:** a guarda de construção do endereço da entrega —
  `resolverDestino(enderecoDaEntrega, CAMPO_DO_ENDERECO_DA_ENTREGA)` — **não é exercitada por caso
  algum**. O `CT-1008` recusa só `enderecoDoProvedor`, e `enderecoDaEntregaDaNoticia` aparece uma única
  vez na suíte, sempre **bem formado**.
- **Impacto:** a garantia existe **sem prova**, e nada reprova se uma refatoração a remover — inclusive
  a metade que faz a mensagem nomear **este** campo e não o outro. É a classe verbatim do
  `D38 · F4/T10`, já rebaixado a BAIXO por razão escrita: nenhum AT nem o card da §6.6 a exige, o
  executor a acrescentou como **craft**, e o valor é configuração de partida do operador, jamais
  entrada de usuário.
- **O que fazer:** ⚠️ **na T7**, onde a composição raiz passa a informar o endereço e a guarda ganha
  consumidor real: estender o `CT-1008` com
  `criarAdaptadorSicoob({ enderecoDoProvedor: <bom>, enderecoDaEntregaDaNoticia: 'http://127.0.0.1:1' })`,
  afirmando por igualdade que a mensagem nomeia `enderecoDaEntregaDaNoticia` e **não ecoa o valor
  recusado**.

### D25 · baixo · tests · T6 · QA

> `smell: happy_path_only` · `criterio_aceitacao_violado: AT-3`

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1866`
- **Problema:** o **AT-3** escreve que *"recusa pelo par, indisponibilidade e tempo esgotado chegam
  distinguidos, nenhuma rejeita"*. O `CT-1043` prova a **recusa** (passos 9 e 10), e **nada prova os
  três ramos restantes** de `executarEntrega`: `desfecho.tipo !== 'RESPONDEU'` (indisponibilidade e
  tempo esgotado) e `enderecoDaEntrega === undefined`, que devolvem o mesmo `{ aceito: false, motivo: null }`.
- **Impacto:** **a §6.5 da própria task mapeia o AT-3 apenas ao passo 10** — o escopo entregue é o
  escopo declarado. E o código é **estruturalmente correto** (`falarComOProvedor` sempre resolve,
  inclusive no lançamento síncrono de `request`, e a porta de cobrança já tem `CT-841`/`CT-842`/`CT-863`
  para a mesma máquina). Falta a **rede do P4** sobre ramo periférico, não comportamento.
- **O que fazer:** caso barato no molde do `CT-841` — `adaptadorComEntrega(await portaSemOuvinte(), …)`
  com `resolves.toEqual({ aceito: false, motivo: null })`, **mais** o eixo do endereço ausente
  afirmando `provedor.chamadas.length === 0`, que é o que **distingue** *"não chamou por falta de
  endereço"* de *"chamou e falhou"*.

### D26 · baixo · tests · T6 · QA ⚠️ `security_flag: missing_secret_redaction_echo_axis`

> `smell: happy_path_only` · `criterio_aceitacao_violado: AT-7`

- **Onde:** `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:2516`
- **Problema:** o passo 11 do `CT-1043` inclui `identificador-da-aplicacao` entre as agulhas e afirma
  lista vazia **com controle positivo** — método correto e exigido pela ADR-0032. **O que não existe é
  a metade que o `CT-951` já pratica para a credencial**: um eixo em que o par **ECOA de volta** o que
  o produto enviou.
- **Impacto:** o pedido de concessão carrega `client_id` (`adaptador-sicoob.ts:1352`), o
  `identificadorDaAplicacao` **é segredo operável** (guardado como `identificadorDaAplicacaoCifrado`,
  cifrado por `cifrarValorOperavel`), e **`lerMotivoDaRecusa` na recusa da concessão corre SEM redator
  para ele** — só a credencial tem `semACredencialDoAto`. O `RECUSA_DA_CONCESSAO` do caso **não o
  ecoa**, de modo que a agulha passa **sem exercitar mecanismo algum**. ⚠️ **Não é violação da
  ADR-0032** (o método dela foi cumprido e saiu limpo) — é a **lacuna do companheiro negativo**.
- **O que fazer:** ⚠️ **na T9**, junto do `CT-1024` (saída real): o par responde a recusa da concessão
  com `error_description` contendo o `identificadorDaAplicacao` **enviado**, e afirma-se que ele **NÃO**
  aparece em `ResultadoDaOperacaoDeEntrega` — pelo molde do `CT-951`. **Se aparecer**, o conserto é
  estender a redação de `lerMotivoDaRecusa` para receber também o identificador, no **mesmo ponto
  único** em que `semACredencialDoAto` já corre antes do desmonte.

### D27 · baixo · documentation · T6 · QA

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1337`
- **Problema:** o docblock de `comporPedidoDeCredencial` afirma *"⚠️ **Falta aqui o identificador da
  aplicação** perante o provedor, e a ausência é medida, não esquecida: o produto **não o modela em
  lugar nenhum**"*, enquanto **o corpo logo abaixo** tem `client_id: identificadorDaAplicacao`
  (linha 1352) com o comentário **oposto** (*"é OBRIGATÓRIO na concessão… fechamento do `D36 · F4/T10`"*).
  **As duas frases se contradizem dentro da mesma função.**
- **Impacto:** o parágrafo ficou para trás no fecho do `D36` (2026-08-20); a T6 reabriu a função
  (parâmetro `familia`, campo `scope`) **sem removê-lo**.
- **O que fazer:** remover o parágrafo — o fato que ele descreve **deixou de existir**, e o comentário
  do corpo já registra o fecho.

### D28 · baixo · documentation · T6 · QA

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:44`, `:204`, `:1341`, `:1433`
- **Problema:** **quatro** docblocks remetem ao *"`DÉBITO COM GATILHO` de `criarAdaptadorSicoob`"*, e o
  marcador **não existe mais** — o docblock daquela função termina com uma linha ` *` vazia, resíduo de
  onde ele estava. Era o `D36 · F4/T10`, fechado em 2026-08-20, e o marcador saiu junto (**corretamente**,
  pela §3-B); o que ficou foram os **quatro ponteiros órfãos**.
- **Impacto:** ⚠️ **pré-existente à T6** — nenhuma das quatro linhas é da assinatura ou do corpo que
  esta task alterou. Escrituração vencida, que a rule fixa em BAIXO e que **nunca bloqueia**.
- **O que fazer:** numa passada de limpeza (**não** nesta task, que não declara o arquivo para isso):
  trocar as quatro remissões por menção direta ao que cada uma quer dizer, e remover a linha ` *` vazia
  que sobrou (linha 1631).

### D29 · BAIXO · architecture · T6 · Tech Review

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1848` (`executarEntrega`)
- **Problema:** `enderecoDaEntregaDaNoticia` ausente produz `{ aceito: false, motivo: null }` **sem
  chamada alguma** ao provedor. E o docblock de `ResultadoDaOperacaoDeEntrega` (T5) fixa que
  `motivo: null` significa *"o provedor não chegou a responder (indisponibilidade, tempo esgotado)"*.
  ⚠️ **Erro de configuração do processo e indisponibilidade do terceiro chegam ao Admin com exatamente
  o mesmo valor**, e nada na porta os distingue.
- **Impacto:** a assimetria com a opcionalidade irmã é o que torna o ponto notável — `enderecoDeAutorizacao`
  ausente **degrada com sentido** (a concessão vai ao destino da API); `enderecoDaEntregaDaNoticia`
  ausente degrada para **falhar sempre, em silêncio**. E a guarda de forma da construção só corre
  **quando o campo está presente**: ela protege contra endereço malformado, **não contra ausente**.
  *"O Admin lê 'o provedor não respondeu' onde o fato é 'esta instalação não foi configurada'. Custo de
  diagnóstico alto e assimétrico: nenhum sinal chega ao par TLS, então nem os registros do provedor nem
  os desta ponta mostram tentativa alguma."*
- **Por que BAIXO e não bloqueante** — o gate registrou que **não há correção possível dentro da T6**:
  tornar o campo obrigatório **quebra quatro construtores** fora do escopo; levantar na operação
  contraria a promessa da porta de *"resolver em todos os desfechos e nunca rejeitar"* (RN-06); e
  acrescentar um terceiro desfecho **mudaria o contrato publicado na T5** e faria o adaptador não
  satisfazer a porta — que é o **AT-3**.
- **O que fazer — na T7:** exigir `enderecoDaEntregaDaNoticia` na **conferência de partida**
  (`apps/api/src/configuracao/ambiente.ts`) sempre que o serviço de entrega for registrado, *"de modo
  que o processo recuse subir mal configurado em vez de recusar cada operação em silêncio"*. Com a
  asserção **onde ela possa falhar** — um caso que suba o módulo sem a variável e exija a recusa de
  partida —, não apenas no docblock.
  ⚠️ **Nota que a T7 herda**: se aquele arquivo for aberto, **o `D51 · F4/T16` dispara** (gatilho:
  *"a primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`"*).

### D30 · BAIXO · code_quality · T6 · Tech Review

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1215` (`semOsSegredosDoAto`) e
  `packages/contracts/src/integracao-bancaria.ts:466` (`identificadorDaAplicacao`)
- **Problema:** a redação substitui **toda ocorrência literal** de cada item de `segredosDoAto`. Até a
  correção do Gate 2, o único valor redigido era a credencial concedida pelo provedor — cadeia longa,
  gerada por ele. A correção acrescentou `identificadorDaAplicacao`, que é **digitado pelo Admin** e
  cujo contrato admite **um caractere** (`z.string().trim().min(1).max(256)`). Com identificador de 1
  ou 2 caracteres, o `split`/`join` trocaria toda ocorrência daquela cadeia no texto do provedor pela
  sentinela, devolvendo um motivo mutilado.
- **Impacto:** **baixo e remoto**, e falha **na direção segura** — redige demais, nunca de menos. O
  efeito é o motivo do provedor chegar corrompido à tela do Admin e a `negocio.entrega_da_noticia.motivo_*`,
  o que atrita com a **passagem verbatim que a ADR-0034 exige**. Nenhum `client_id` real do provedor
  tem essa largura, e por isso não bloqueia.
- **A ironia registrada pelo gate:** o **próprio docblock** da função (`:1186-1190`) declara o critério
  — *"redigir cadeia curta e comum corromperia o motivo sem fechar vazamento algum"* — e o código
  **não o impõe sobre o único valor de origem externa que ele agora redige**.
- **Gatilho:** a próxima task autorizada a abrir qualquer um dos dois arquivos.
- **O que fazer quando disparar — duas saídas, e a (a) é a recomendada:**
  **(a)** no `reduce` de `semOsSegredosDoAto`, ignorar item cujo comprimento fique abaixo de um piso
  declarado — *"a guarda já existe para a cadeia vazia, e o piso é a mesma guarda com um número"*.
  É a menor e **não mexe em contrato publicado**.
  **(b)** elevar o `min(1)` de `identificadorDaAplicacao` para a largura medida do identificador real,
  com a mesma disciplina de medição que `MAIOR_IDENTIFICADOR_DA_APLICACAO` declara logo acima.
- **Prova exigida:** comportamental — um caso com identificador de largura mínima cujo eco no texto do
  provedor **precise atravessar íntegro**, e que reprove com o código atual.

### D31 · baixo · code_quality · T7 · executor

- **Onde:** `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` (junto de `DISCRIMINADOR_DO_CERTIFICADO`)
- **Problema:** as constantes de recusa de pré-condição — `DISCRIMINADOR_DO_CERTIFICADO`,
  `CERTIFICADO_AUSENTE`, `MENSAGEM_DO_CERTIFICADO_VENCIDO`, `MENSAGEM_SEM_IDENTIDADE`,
  `DISCRIMINADOR_DA_IDENTIDADE` e `IDENTIDADE_AUSENTE` — existem **duas vezes**: aqui e em
  `apps/api/src/cobrancas/boleto.service.ts`.
- **Impacto:** elas são **contrato publicado** — o cliente lê a frase e o discriminador —, e duas
  declarações do mesmo contrato são duas regras livres para divergir. É a classe que o Limiar de Três
  do `CLAUDE.md` existe para fechar, um passo antes do gatilho.
- **Por que não agora:** `boleto.service.ts` está fora da lista de arquivos da T7, e mover a
  declaração alteraria **o serviço que emite boleto** — área de cobrança, com suíte própria — por uma
  task cujo escopo declarado é a entrega da notícia (§4.5 do Protocolo).
- **O que a T7 fez sem alargar escopo:** não deixou nascer a terceira cópia das **duas** que já
  estavam no limiar — `MENSAGEM_SEM_CERTIFICADO` e `DISCRIMINADOR_DA_VALIDADE` subiram para
  `certificado.service.ts` nesta task. ✅ **O Limiar de Três foi aplicado onde disparou, e adiado
  onde ainda não disparou** — que é exatamente a leitura certa da regra.
- **Gatilho:** a primeira task autorizada a abrir `apps/api/src/cobrancas/boleto.service.ts` por outra
  razão, ou o **terceiro** consumidor de qualquer uma delas.

### D32 · baixo · tests · T7 · executor

- **Onde:** `apps/api/test/entrega-da-noticia.e2e.spec.ts` (junto de `EmpresaMontada`)
- **Problema:** as três funções existem em número **medido**, e não igual entre si — a contagem
  abaixo saiu de `grep -rln --exclude-dir=dist` sobre `apps` e `packages`, e **corrige o que este
  bloco afirmava na primeira escrituração** (*"duas vezes cada"*, número que eu copiei do marcador
  antes de o Gate 1 medi-lo):
  - ⚠️ **`entrarComSegundoFatorCumprido` — SEIS cópias**: `administracao-de-pessoas.e2e.spec.ts:1784`,
    `ciclo-de-acesso.e2e.spec.ts:1389`, `cobertura-de-autorizacao.e2e.spec.ts:6866`,
    `contexto.e2e.spec.ts:1974`, `recusa-indistinguivel.e2e.spec.ts:1159` e a desta task. **O Limiar
    de Três já havia disparado para ela antes desta fatia existir.**
  - `envelhecerOVigente` — duas (`certificado-do-provedor.e2e.spec.ts` e a desta task).
  - `montarEmpresaComAdmin` — duas formas, e a segunda está **partida** em
    `criarEmpresa`/`admitirAdministrador`/`administradorEmOperacao` em `recusa-indistinguivel.e2e.spec.ts`.
- **Impacto:** ⚠️ **nenhuma pode ser importada de onde está**, e a razão é mecânica: importar de um
  arquivo `.spec.ts` **executa o módulo dele** e registra os casos daquela suíte **dentro da
  importadora**. É a razão pela qual a convenção *"acessório de suíte se importa, não se copia"* do
  `CLAUDE.md` pressupõe a casa compartilhada — e por que a cópia aqui não é desleixo.
- **Por que não agora:** as suítes doadoras estão fora da lista da T7 —
  `certificado-do-provedor.e2e.spec.ts` é declarado **somente leitura** por ela —, e convergir custa
  abrir **cinco** suítes alheias, não duas. Converter centenas de casos de prova alheios num diff que
  já publica duas rotas é superfície de regressão que ninguém pediu (§4.5).
- **Gatilho — e ele é DIFERENTE por função, porque a contagem é diferente:**
  - `entrarComSegundoFatorCumprido`: ⚠️ **o Limiar de Três JÁ DISPAROU** (seis cópias). O gatilho
    vigente é a **primeira task autorizada a abrir qualquer uma das seis suítes** por outra razão.
  - `envelhecerOVigente` e `montarEmpresaComAdmin`: o gatilho segue sendo o Limiar de Três (a
    **terceira** cópia), ou a abertura da suíte doadora.
- **O que fazer quando disparar:** as duas de sessão sobem para `apps/api/test/acessorios-de-borda.ts`
  (a casa já declarada do diretório) e a de vigência ganha casa própria; as suítes existentes passam
  a importar. ⚠️ Ver o candidato a regra **RC-001** (`repeated_fixture`), que ataca a **causa**: o
  acessório precisa **nascer** na casa compartilhada, porque de dentro de um `.spec.ts` ele é
  inimportável por construção — e é isso que torna o Limiar de Três inexequível aqui.

### D33 · MEDIO (anotável) · tests · T7 · QA rodada 2

- **Onde:** `apps/api/test/entrega-da-noticia.e2e.spec.ts:533` (trecho (b) do `CT-1026`)
- **`smell`:** `vague_existence_assertion` (AP-05) — **do conjunto de manutenibilidade**, por isso
  anotável e não bloqueante (`agent-spec-workflow-rules.md`: *"médio de teste no catálogo = anotável"*).
- **Problema:** o carimbo `verificadaEm` do trecho novo é preso só por `typeof === 'string'`. Dentro
  da igualdade profunda ele é **auto-referente** (`verificadaEm: publicado.verificadaEm`), `chavesDe`
  prende apenas a presença da chave, e o `GET` prende a persistência **do mesmo valor, seja ele qual
  for**. Um carimbo gravado como texto que não é data (`'lixo'`, cadeia vazia) **atravessa** as
  asserções do trecho.
- **Impacto:** baixo e circunscrito. A classe **está** coberta pelo `CT-1025`, no mesmo arquivo, para
  o desfecho **positivo** — ele usa o par completo (`typeof` **mais**
  `Number.isNaN(Date.parse(...)) === false`). O que fica sem cobertura é o desfecho **negativo
  gravado**, que é justamente o que o trecho novo acrescenta.
- **⚠️ Não é afrouxamento:** o trecho é **novo** e nenhuma asserção foi removida no diff — é asserção
  nova **aquém da convenção que o próprio arquivo pratica duas linhas antes**. O gate foi explícito ao
  separar as duas coisas, e a distinção importa: afrouxar é R2, ficar aquém é débito.
- **O que fazer:** acrescentar `expect(Number.isNaN(Date.parse(publicado.verificadaEm ?? ''))).toBe(false);`
  ao lado da linha 533. **Uma linha**, não toca produção, e alinha o trecho à convenção do arquivo.
- **Por que não agora — decisão do orquestrador (A1):** o Gate 1 **já aprovou** este `attempt_sha`, e
  é ele que o Gate 2 revisa. Editar entre os dois gates invalidaria a revisão e obrigaria a revalidar
  o Gate 1 — custo desproporcional a uma asserção cujo risco medido já está preso no desfecho irmão.
- **Gatilho:** a primeira task autorizada a abrir `apps/api/test/entrega-da-noticia.e2e.spec.ts` —
  a **T8** o abre por outra razão.

### D34 · baixo · documentation · T7 · QA rodada 2

- **Onde:** `apps/api/test/contrato-publicado.e2e.spec.ts:110` (docblock da prova de falsificação do
  `CT-327`, parêntese do mutante MT11-2)
- **Problema:** a frase diz *"a superfície era de 33 rotas quando esta medição foi feita; hoje são
  **41**, e a âncora `ROTAS_DESCRITAS` é quem carrega o número"*, com `ROTAS_DESCRITAS` valendo **48**.
- **Por que foi ADIADO, e por que os dois gates concordaram:** a defasagem é **anterior a este diff**
  (registro datado de 2026-08-06), e a frase é **auto-desarmante** — ela própria remete o leitor à
  âncora executável, o que **impede** o modo de falha que o repositório teme (a próxima task "corrigir"
  o executável para o valor narrativo). O executor recusou invocando a §4.5 (*não "aproveitar que
  estou aqui"*) e o QA registrou concordância expressa: *"o parêntese é registro histórico de uma
  medição, não afirmação de cardinalidade corrente"*.
- **O que fazer quando disparar:** melhor que atualizar o número é **trocar o parêntese por uma forma
  que não envelheça** — *"hoje o número vive em `ROTAS_DESCRITAS`"*, sem repetir o valor. É a forma
  que o candidato a regra nº 12 recomenda, e a única que fecha a classe em vez da ocorrência.
- **Gatilho:** a primeira task que abrir este docblock por outra razão.

### D35 · MEDIO (bloqueou, corrigido por registro) · architecture · T7 · Tech Review rodada 2 · ✅ **FECHADO em 2026-08-22**

> **Como fechou:** a porta passou a devolver `LeituraDaEntrega`, que **nomeia** as sete situações —
> e com isso *"o provedor não respondeu"* e *"respondeu e não há cadastro nosso"* deixaram de
> chegar iguais à borda. A leitura da **presença** do motivo separa as duas metades: nulo preserva o
> estado anterior, presente é fato do provedor e se grava. Fechado junto com o `D42`, de que era
> pré-requisito técnico. Marcador removido do serviço; linha removida do índice do `CLAUDE.md`.

- **Onde:** `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` (junto do `return`
  final de `apurarDesfecho`)
- **Problema:** `ResultadoDaOperacaoDeEntrega` **não distingue, na consulta**, *"o provedor não
  respondeu"* de *"o provedor respondeu e não há cadastro nosso"* — os dois chegam à borda como
  `{ aceito: false, motivo: null }`, vindos de `consultarEntrega`
  (`packages/cobranca-bancaria/src/adaptador-sicoob.ts:2058`, mais dois caminhos em `executarEntrega`,
  `:1907` e `:1924`). Por isso o discriminador da presença vale **só para o cadastro**, e um cadastro
  **aceito** seguido de consulta que não respondeu grava `habilitada: false` com motivo nulo,
  **sobrescrevendo o estado de uma entrega que pode estar de pé no provedor**.
- **Impacto:** o Admin lê `habilitada: false, motivo: null` para uma entrega que o provedor cadastrou,
  sem nada que a distinga de uma desabilitação real. **Mitigado e medido pelo gate:** (a) nenhum
  consumidor de produção lê a linha fora desta área — a recepção da notícia **não a consulta**, logo
  nada deixa de funcionar; (b) a ativação é idempotente, e o `CT-1035` garante que repetir com vaga
  já ocupada + consulta positiva devolve `habilitada: true`.
- **⚠️ Por que o custo real é o SILÊNCIO, e não o dado errado** — é o achado dentro do achado:
  *"o cabeçalho do service é assertivo e extenso sobre o discriminador, e a próxima task o lerá como
  questão fechada — que é a regressão de decisão (R3) que o protocolo do repositório existe para
  prevenir."* Contradizia a decisão **literal** de `modelo-canonico.ts:578-580`, cuja frase **não é
  qualificada por operação**.
- **⚠️ Por que a correção NÃO foi de lógica** — o gate mediu antes de prescrever: aplicar ao ramo da
  confirmação o mesmo `return undefined` do cadastro **quebraria o caminho PRINCIPAL de
  desabilitação**, que é *"consultei e não há cadastro nosso lá"*. A informação que separa os dois
  casos **não existe na borda**; ela vive na porta.
- **O que foi feito na rodada 3:** o bloco do cabeçalho passou a ser **qualificado** (*"no CADASTRO,
  e só nele"*), com o parágrafo original preservado byte a byte e dois novos declarando o limite e o
  preço; e o marcador foi registrado no ponto. **`apurarDesfecho` não foi tocado** — verificado por
  `diff` filtrado e por `sha256sum` da função ignorando comentários.
- **Gatilho:** a primeira task autorizada a abrir `packages/cobranca-bancaria/src/modelo-canonico.ts`
  ou `adaptador-sicoob.ts` por outra razão.
- **O que fazer quando disparar:** acrescentar um **terceiro estado** — ou um motivo sentinela — **na
  porta**, que é onde a informação que separa os dois casos existe.

### D36 · baixo · documentation · T7 · orquestrador (medido no fecho da rodada 3)

- **Onde:** `CLAUDE.md`, bloco *"Débitos com gatilho ativo"* — o aviso que exige *"linha que passar de
  ~150 caracteres deve ter o excedente movido para a §2"*
- **Problema:** o critério é violado por **35 de 35 linhas**. Medido: a **menor** tem **175**
  caracteres, a maior **356**, a média **276**. Não há uma única linha em conformidade, e nunca houve.
- **Como apareceu:** o executor da rodada 3 formulou a questão como decisão (A1) ao escrever a linha
  do `D35` — *"encurto para os ~150 que o aviso pede?"* — e **mediu antes de decidir**, constatando
  que encurtar só a linha nova perderia o gatilho concreto **sem aproximar o arquivo do critério**.
  Decidiu manter e registrar. ✅ **Concordo**, e a medição independente confirma e reforça: ele
  relatou *"a menor da região passa de 300"*; o mínimo do bloco inteiro é **175**, e o ponto se
  sustenta igual.
- **Impacto:** baixo, e é de **regra**, não de arquivo. Um critério que nenhuma linha observa não
  disciplina ninguém — ele apenas cria uma decisão a re-tomar toda vez que alguém escreve uma linha,
  e o custo é exatamente esse: **uma decisão auto-resolvida por débito registrado**.
- **O que fazer:** ou recalibrar o número para a realidade medida (a mediana da tabela), ou trocar o
  critério de **comprimento** por um de **conteúdo** — que é o que o aviso de fato quer dizer
  (*"ponteiro curto, não relatório"*), e que a §3-B já formula melhor. A segunda é a recomendada:
  contar caracteres é fácil de verificar e fácil de ignorar; o que importa é a linha **apontar** em
  vez de **explicar**.
- **Gatilho:** a próxima task que editar o bloco de débitos do `CLAUDE.md` por outra razão.

### D37 · baixo · code_quality · T8 · executor

- **Onde:** `apps/worker/src/tarefas/reconferencia-da-entrega.ts` (junto de `nadaMudou`)
- **Problema:** a comparação do desfecho **não alcança o `diagnostico`**. Uma recusa cujo código e
  mensagem repetem, e cujo diagnóstico mudou, é lida como *"nada mudou"* — e a linha guardada
  continua exibindo o diagnóstico **anterior**.
- **Impacto:** baixo. O `diagnostico` é hoje informação **de exibição**: nenhum ramo do produto lê
  dentro dele, e o que o Admin vê é a recusa correta com um detalhe defasado. Vira relevante no
  instante em que o primeiro ramo passar a decidir por ele.
- **Por que não agora — e a razão é uma armadilha real, não conveniência:** `limitarDiagnostico` é
  **privado** de `packages/db/src/entrega-da-noticia.ts`, fora da lista da T8. Comparar o **recebido**
  com o **truncado** faria um provedor verboso **regravar a linha em toda reconferência** — quebrando
  a **RN-15** (*cinco reconsultas que nada mudam deixam a linha idêntica, inclusive o instante*)
  justamente onde ela mais importa. A correção ingênua produziria o defeito que a task existe para
  impedir.
- **Gatilho — dois, e qualquer um serve:** (a) `limitarDiagnostico` virar **símbolo publicado** do
  pacote, momento em que o apurado pode ser normalizado **antes** de comparar e o eixo entra sem falso
  positivo; ou (b) o **primeiro ramo do produto que passe a LER dentro do diagnóstico**, quando a
  informação deixa de ser só de exibição.

### D38 · BAIXO · testability · T8 · Tech Review

- **Onde:** `apps/worker/src/main.ts` (junto do `criarAdaptadorSicoob` da entrega) — e, **simetricamente**,
  `apps/api/src/integracoes-bancarias/integracoes-bancarias.module.ts:150`
- **Problema:** **nenhuma asserção prova que a composição raiz passa `enderecoDaEntregaDaNoticia` ao
  adaptador**, em **nenhum dos dois processos**. As três pernas, medidas pelo gate:
  1. o campo é **opcional** na configuração (`adaptador-sicoob.ts:658`) — **remover a linha compila**;
  2. `executarEntrega` devolve `{aceito:false, motivo:null}` **sem tocar a rede** quando ele falta, o
     que faz **toda** tarefa da fila nova levantar;
  3. **nenhuma suíte importa `apps/worker/src/main.ts`** além de `lerAmbiente`.
- **⚠️ A simetria é o achado, e ela reenquadra tudo:** `integracoes-bancarias.module.ts:120-151`
  **documenta a opcionalidade** e afirma que *"aqui ele **não** pode faltar"* — e a linha `:150`
  **também não tem asserção**. A única suíte que passa o campo por fiação
  (`entrega-da-noticia.e2e.spec.ts:312`) o constrói **dentro do próprio dublê da porta**, de modo que
  **nunca alcança** `criarPortaDeEntregaDaNoticia` do módulo real. **São duas ocorrências, e o Limiar
  de Três está a uma de disparar.**
- **Por que BAIXO — e o gate declarou que a classificação é deliberada, não leniência:**
  **(a)** a **garantia EXISTE** em produção — `lerAmbiente` recusa a partida sem a variável, o `CT-643`
  cobra caminho de provisionamento e o `CT-936` varre a recusa: o modo de falha *"faltou a variável"*
  está **fechado**. O que resta aberto é só *"alguém apagou a linha da fiação"*, que exige edição
  deliberada de código sob docblock extenso.
  **(b)** a classe é **preexistente e sistêmica**: *"nenhuma composição raiz de processo desta base é
  provada em ponto algum"*, e a T8 acrescenta a n-ésima ocorrência de um vazio **que ela não criou**.
  **(c)** a perna da API é da **T7** (fecho do `D29`), fora do escopo da T8.
  **(d)** a regressão **não seria muda**: a tarefa termina em `failed` com razão nomeada no servidor
  de fila.
- **Convergência de três agentes independentes:** o **executor** mediu e **não agiu**; o **Gate 1**
  declarou e **recusou classificar** (*"nenhum antipadrão do catálogo a descreve, e forçar um `smell`
  errado seria pior que a anotação"*); o **Gate 2** classificou como `testability`/BAIXO e prescreveu
  **o registro, não o fechamento**. Nenhum dos três combinou com os outros.
- **Gatilho:** o **terceiro** ponto de fiação não provado de porta bancária (hoje **dois**), ou a
  primeira task autorizada a **extrair a composição raiz** deste processo em unidade que a suíte possa
  montar.
- **O que fazer quando disparar:** a casa canônica já existe — `apps/worker/test/ambiente.spec.ts`, que
  **já lê o texto de `main.ts`** por `CAMINHO_DA_COMPOSICAO` e já é a suíte deste processo. Alternativa
  de topologia: extrair `principal()` em unidade testável.
- ⚠️ **Registrado pelo orquestrador nas três pontas** (marcador, índice do `CLAUDE.md` 36 → **37**, e
  este bloco), com `@sysloc/shared` **263** e `@sysloc/worker` **132** revalidados depois — o `CT-907`
  afirma as duas pontas por `fs`.

### D39 · BAIXO · project_pattern · T8 · Tech Review · ✅ **FECHADO na T10 (2026-08-22)**

- **Onde:** `docs/specs/features/integracao-bancaria-autonoma/v1/tasks/T8.md`, §5.2 e `AT-11`
- **Problema:** a §5.2 declara **8** arquivos a modificar; o diff toca **22 paths**. ⚠️ O mais grave é
  que **`apps/api/src/integracoes-bancarias/certificado.controller.ts` não é nomeado em ponto algum do
  card** (`grep -n 'controller' T8.md` devolve **vazio**) — embora a §3.2 exija *"gravar e SÓ ENTÃO
  enfileirar"* e o `CT-1039` exija `201` com a fila derrubada. **As duas coisas são inatingíveis sem
  tocá-lo.** O card pede um comportamento e omite o único arquivo que o entrega.
- **Os demais omitidos são obrigatórios por construção:** o `CT-1039` mora em
  `certificado-do-provedor.e2e.spec.ts`; o dublê de `ProdutorDeFila` em `notificacao-bancaria.e2e.spec.ts`
  **não compila** sem o membro novo; as quatro âncoras de igualdade **reprovariam nominalmente** sem o
  acréscimo — que é o **comportamento desejado** da `ancoras-de-superficie.md`.
- **Mais o `AT-11` defasado**: cobra `api` **354** / `shared` **254** quando o real é **371 / 263**.
- **É defeito de PLANEJAMENTO do card, não conduta do executor** — o gate foi explícito: *"nenhuma das
  mudanças é oportunista, todas são mínimas e o Gate 1 as verificou uma a uma"*. E a checagem de
  presença estrutural devolve **vazio**: nada do que o card declarou faltou.
- **Impacto:** de prosa. O custo é que *"a próxima leitura do card subestima o raio de impacto de uma
  task que atravessa três pacotes, e um gate futuro que confrontasse a §5.2 contra o diff leria desvio
  de escopo onde houve necessidade"*.
- **O que fazer — na T10**, que já é a task de correção de prosa desta fatia: acrescentar
  `certificado.controller.ts` à §5.2 com a modificação (*"extrai o desfecho e o `empresaId` da unidade
  de trabalho para enfileirar DEPOIS do `COMMIT` — alta contenção, marcador `DECISÃO FECHADA — T12`
  permanece intocado"*), acrescentar as âncoras e os decorrentes, e recalibrar o `AT-11`.
  ⚠️ **Não reabrir a T8**: *"o código está certo, o que está errado é o papel."*
- **Fecho (T10, 2026-08-22):** a §5.2 da `T8.md` ganhou **13 linhas** — os 12 arquivos omitidos, com
  a modificação de cada um e a razão de ela ser obrigatória por construção, mais a nota que declara
  por que isto **não** reabre a T8. Os 22 paths foram **medidos** por
  `git diff --name-only <attempt_sha da T7 rodada 3> <attempt_sha da T8 rodada 2>`, e não estimados.
  O `AT-11` foi **recalibrado** para a baseline real (`worker` 126 → 132, `api` 370 → 371, `shared`
  263), nos dois pontos em que ele aparece (§4 e §6.5).

### D40 · BAIXO · project_pattern · T9 · Tech Review

- **Onde:** `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (junto de `naBorda`)
- **Problema:** a suíte passou a ter **duas formas de falar HTTP** — o `pedirNaBorda` da casa comum
  (`./acessorios-de-borda.ts`), que o `CT-1024` usa através da adaptação `naBorda`, e o `pedir`
  **privado** do arquivo, que os **seis** casos anteriores ainda usam. **Nada no código nem na §2
  dizia à próxima task qual usar nem quando convergir.**
- **⚠️ A escolha do executor está CERTA — o que faltava era o registro.** Converter os seis casos é
  refatoração fora da §5.2 e *"superfície de regressão numa suíte de prova de segredo"*. O gate foi
  explícito: a adaptação *"é adaptação, e não um segundo cliente"*, e o alias `pedirNaBorda` **já foi
  escolhido para que a conversão futura não precise renomear as chamadas novas**.
- **Impacto:** de manutenção. *"A próxima task que abrir a suíte encontra duas formas equivalentes sem
  critério escrito e pode copiar a privada — que é exatamente o mecanismo que fez o cliente HTTP e a
  entrada de sessão nascerem em quase toda suíte de borda."*
- **⚠️ Por que NÃO está coberto pelo `D32`:** o gate mediu — o `D32` nomeia
  `entrarComSegundoFatorCumprido`, `envelhecerOVigente` e `montarEmpresaComAdmin`, e **esta suíte não
  é uma das sete que as copiam**. A família é a mesma; o gatilho, não.
- **Gatilho:** a primeira task autorizada a abrir este arquivo por outra razão **converte os seis
  casos remanescentes** para `pedirNaBorda` e **remove o `pedir` privado**.
- ⚠️ **Registrado pelo orquestrador nas três pontas** (marcador, índice do `CLAUDE.md` 37 → **38**, e
  este bloco).

### D41 · baixo · documentation · T10 · QA

- **Onde:** `docs/specs/features/integracao-bancaria-autonoma/v1/tasks/T10.md:141` (§5.2)
- **Problema:** a §5.2 declara **3** arquivos a modificar; o diff tocou **7**. Os quatro a mais —
  `tasks/T1.md`, `tasks/T7.md`, `tasks/T8.md` e `packages/cobranca-bancaria/test/conversao-do-material.spec.ts`
  — são **escrituração de fecho legítima e prescrita** (a renumeração `CT-1022 → CT-1048` do `D6`, as
  omissões da §5.2 da T8 e o `AT-11` do `D39`, o eixo do `CT-1026` da T7), mas **a §5.2 da própria T10
  não os declara**.
- **Impacto:** *"faz o diff parecer alargamento de escopo a quem só lê o card"*. Nenhum risco de código.
- **⚠️ A ironia registrada:** a T10 **corrigiu a §5.2 da T8** por este mesmo defeito, e **repetiu-o na
  própria**. É a mesma classe do candidato a regra nº 12 — registro que fica para trás do fato —, agora
  na task cujo trabalho **era** corrigir registros que ficaram para trás.
- **Gatilho:** a primeira task que abrir o card da T10 por outra razão.
- **O que fazer:** acrescentar as quatro linhas à §5.2, com a razão de cada uma, **no molde da nota que
  a própria T8 recebeu nesta mesma task**.

### D42 · ALTO · architecture · fechamento · intervenção dirigida de 2026-08-22 · ✅ **FECHADO no mesmo dia, com as duas autorizações**

> **Como fechou:** o usuário autorizou as duas coisas que o bloqueavam — **mudar o contrato
> publicado** e **aplicar a migração**. Entregue: a `0025` (coluna `situacao`, a referência opaca ao
> cadastro e a `CHECK` de coerência reescrita para o eixo da situação, mais a amarra
> `habilitada = (situacao = 'HABILITADA')`); `LeituraDaEntrega` com as **sete** situações; as **duas**
> operações que faltavam na porta e no adaptador; o **quadro de decisão de 7 linhas** como a lógica
> da ativação, **dentro da rota que já existia**; e o `D1` e o `D2` na sequência.
>
> **Nenhuma rota nasceu** — a tela continua com um ato e duas rotas, e o frontend não sabe que as
> operações de correção existem. **Provas:** `CT-1054` (o terceiro estado é representável e a amarra
> é do banco), `CT-1055` (a-d) (o quadro linha a linha, a vaga de terceiro medida pelo **efeito**, a
> precedência e a recusa do ato corretivo) e `CT-1056` (a-b) (a promoção que fecha o ciclo
> assíncrono, e as leituras que a reconferência **não** executa).
>
> ⚠️ **Uma divergência declarada em relação ao `A4` do prompt**, com a razão: a referência do
> cadastro **é persistida**. O `A4` a recusara por *"nenhuma migração"* — razão que caiu quando a
> migração foi autorizada. E ela é **necessária**: a linha 5 do quadro fala em *"cadastro nosso
> **pelo idWebhook***", e sem a referência não há como distinguir *"o meu, com o endereço antigo"* de
> *"o de outro sistema"* — os dois têm URL diferente da atual, e o produto não pode tocar o segundo.
> Sem ela a linha 5 é **inalcançável** e o impasse do `A2` continua aberto, que é o que o `D42`
> existia para fechar. Ver o `D44`.

- **Onde:** `packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts` (junto do parágrafo do `A1`)
- **Problema:** a **conformidade do ciclo de vida do webhook com o provedor está incompleta**, e o que
  falta é um bloco só, indivisível: o desfecho da consulta precisa ser **ternário** — *habilitada · em
  validação · desabilitada* —, mais o **indeterminado** de *"o provedor não respondeu"*. Dele dependem
  quatro correções que **não podem ser entregues separadamente**, e a razão de cada dependência está
  medida:
  - **`D1`** (a consulta confirma por *presença de objeto*, e um webhook **inativado** conta como
    ativo — falso positivo no indicador de saúde). Corrigi-lo **sozinho** quebraria toda ativação
    nova: o cadastro recém-criado nasce em `codigoSituacao: 1 - Aguardando validação`, e exigir `3`
    na consulta imediata trocaria um falso positivo por um **falso negativo em 100% dos casos**.
  - **`D2`** (a `url` do registro não é comparada com a nossa). Corrigi-lo **sozinho** produz um
    **beco sem saída**: endereço divergente ⟹ cadastro recusado por vaga ocupada ⟹ consulta não
    confirma ⟹ o Admin clica para sempre, e o único caminho de saída seria o portal do provedor —
    exatamente o que esta fatia existe para eliminar.
  - **`A2` / `A3`** — as duas operações que faltam (`PATCH …/{id}` para corrigir o endereço e
    `PATCH …/{id}/reativar` para o inativado), que são **mecanismo interno da ativação** e não
    acrescentam rota nem ato de tela.
- **Impacto:** hoje o indicador de saúde da entrega é **falso positivo** quando o provedor inativa o
  webhook — o Admin vê *"entrega ativa"* precisamente no cenário em que ela está morta. Nenhuma
  ativação real jamais ocorreu (o `CA-20` nunca rodou), de modo que nada disso está exercido em
  produção.
- **POR QUE NÃO AGORA — e é bloqueio de AUTORIZAÇÃO, não de dificuldade.** O terceiro estado não cabe
  em **duas** superfícies que exigem decisão do usuário, e as duas foram medidas:
  1. **O contrato publicado é binário.** `esquemaDoEstadoDaEntrega` declara `habilitada: z.boolean()`
     e `ESTADOS_DA_ENTREGA` está **congelado** em `['HABILITADA','DESABILITADA']`. Publicar o terceiro
     estado é mudar o contrato que o React importa — e o §0.1 do prompt de correção manda, por
     escrito, **parar e escalar** nesse caso.
  2. **O schema não comporta o terceiro estado.** `negocio.entrega_da_noticia.habilitada` é
     `boolean NOT NULL`, e a `CHECK` de coerência da migração **`0023`** exige
     `(motivo_codigo IS NOT NULL) = (NOT habilitada AND verificada_em IS NOT NULL)` — isto é, uma
     entrega *em validação* (não habilitada, já verificada, **sem motivo**, porque ninguém recusou
     nada) **viola a restrição**. Persistir o estado exige migração `0025`, e migração de schema é
     ação que a regra 5 do `CLAUDE.md` submete a **confirmação prévia do usuário**.
- **O que fazer quando disparar:** na ordem, e nunca fora dela — (1) terceiro desfecho no modelo
  canônico e na porta, com a referência **opaca** ao cadastro viajando pelo tempo do ato (**sem
  persistir**, ver `D44`); (2) as duas operações no adaptador; (3) o **quadro de decisão de 7 linhas**
  do §8.5 do prompt como a lógica da ativação, **dentro da rota que já existe**; (4) só então o `D1` e
  o `D2`. As provas exigidas estão tabeladas no prompt (casos `B`, `C`, `F`, `M`, `N`, `O`, `P`, `S`,
  `T`, `U`, `V`, `X`) — o `O` e o `X` são os que impedem a próxima rodada de colapsar o ternário de
  volta em booleano.
- **⚠️ Sub-item que só existe dentro dele (§8.5.1 do prompt):** quando um cadastro estiver
  **inativado E com url divergente** ao mesmo tempo, a precedência é **corrigir a URL primeiro** —
  reativar mantém a URL antiga, o provedor tentaria validar a errada, falharia e inativaria de novo.
  ⚠️ **É hipótese fundamentada, não medição**: não se sabe se o `PATCH` de atualização é aceito sobre
  webhook inativo. Se ele recusar, a ordem se inverte. **Nunca escrever no docblock que o provedor
  aceita** — seria repetir o erro do `A1`.
- **Gatilho:** a autorização do usuário para **mudar o contrato publicado da entrega** e **aplicar a
  migração `0025`**. Sem as duas, nenhuma das quatro correções acima pode ser entregue sem introduzir
  defeito pior que o que corrige.
- **Prova exigida:** comportamental em todos os casos; nenhuma é estática, e nenhum mutante é devido.
- **ÍNDICE:** este bloco. O marcador vive no docblock da porta, junto da correção do `A1`.

### D43 · BAIXO · project_pattern · fechamento · intervenção dirigida de 2026-08-22

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts` (junto de `comporCadastroDaEntrega`)
- **Problema:** a **tabela de `codigoSituacao` do provedor é desconhecida**. A documentação nomeia
  **dois** valores — `1 - Aguardando validação` e `3 - Validado com sucesso` — e não enumera os
  demais; o `2`, e qualquer outro, seguem sem significado declarado.
- **Impacto:** nenhum hoje, porque **nada lê `codigoSituacao`** — é justamente o que o `D42` viria
  instalar. Quando ele for feito, a conduta conservadora é tratar como ativo **apenas** o valor
  conhecido e qualquer outro como não-ativo, sem inventar taxonomia.
- **Gatilho:** a primeira resposta do provedor à pergunta, **ou** a primeira ocorrência real de um
  valor fora dos dois conhecidos. Também dispara junto com o `D42`.
- **O que fazer:** perguntar ao provedor a tabela completa e registrá-la; até lá, o conservador.

### D44 · BAIXO · documentation · fechamento · intervenção dirigida de 2026-08-22 · ✅ **FECHADO no mesmo dia — e a recomendação foi REVERTIDA, com razão medida**

> **Como fechou:** a referência ao cadastro **é retida e persistida** (`referencia_no_provedor`, da
> `0025`). Este bloco registrava o oposto — que reter fora *"examinado e recusado por desenho"* —, e
> a razão dele era *"nenhuma coluna nova, nenhuma migração"*. **Essa razão caiu** quando o usuário
> autorizou a migração, e o que sobrou foi a necessidade: sem a referência, um cadastro nosso com
> endereço vencido é indistinguível do de terceiro, e como o produto **não pode tocar o de
> terceiro**, o nosso ficaria sem conserto pela tela — o Admin clicaria em ativar para sempre.
>
> ⚠️ **Ela é OPACA, e a opacidade é a garantia**: nada no produto a interpreta, compara ou decide
> por ela. Responde uma pergunta só — *"a vaga é ocupada por um cadastro que eu criei?"* — e é essa
> resposta que autoriza a correção. É o que a mantém dentro da ADR-0001.

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts` (junto de `comporCadastroDaEntrega`)
- **Problema:** o **identificador do cadastro no provedor** (`idWebhook`) é entregue pelo `201` e pela
  consulta, e **descartado** — não é lido, não é retido, não é gravado.
- **Impacto:** nenhum hoje. ⚠️ **A recomendação de "reter" foi EXAMINADA E RECUSADA por desenho** na
  intervenção de 2026-08-22, e a razão é concreta: o fluxo que precisaria dele (`D42`) **já passa por
  uma consulta** — é ela que descobre que a `url` divergiu ou que o cadastro está inativo —, e a
  consulta **devolve** o identificador. Ele vive o tempo do ato, como o material decifrado do
  certificado já vive. **Nenhuma coluna nova, nenhuma migração, nenhum estado de terceiro
  persistido** — e isso é estritamente melhor: identificador de terceiro guardado é mais uma coisa
  que pode ficar obsoleta em silêncio.
- **Gatilho:** o `D42` ser autorizado. Quando ele for feito, o identificador viaja **opaco** pela
  porta e **não** ganha coluna. Este bloco existe para que a recomendação recusada não seja
  redescoberta e adotada por engano.

### D45 · MEDIO · data_handling · fechamento · intervenção dirigida de 2026-08-22 — ⚠️ **ESCALADO AO USUÁRIO, não é decisão de engenharia**

- **Onde:** `plataforma.notificacao_bancaria.recebido` (a coluna `jsonb` do corpo cru)
- **Problema:** o corpo cru da notícia é gravado **inteiro** e guardado por **90 dias**
  (`DIAS_DE_RETENCAO_DO_CRU`), e a documentação oficial do payload revelou que ele carrega **dados
  pessoais de terceiros**: `nomePagador`, `cpfCnpjPagador`, `nomeFantasiaPagador`,
  `cpfCnpjBeneficiario`, `nomePortador`, `cpfCnpjPortador`, `codigoTipoPessoaPagador` e
  `codigoTipoPessoaPortador`.
- **Impacto:** a tabela vive no schema de **plataforma** e, pela ADR-0031, **não tem `empresa_id`** —
  logo não há RLS por empresa sobre ela. ✅ **O que reduz a gravidade, e foi verificado por medição:**
  o cru **não é exposto por rota alguma** — `grep -rn "corpoRecebido\|corpo_recebido"` em
  `apps/api/src` e `packages/contracts/src` volta **vazio**. Não há vazamento cross-tenant pela API; o
  alcance é quem tem o papel da aplicação e o banco.
- **⚠️ Por que NÃO foi corrigido:** a decisão de guardar o cru foi tomada supondo um payload de
  **números e datas** — é o que a tech spec da fatia descreve. Ninguém decidiu armazenar CPF e nome de
  pessoas físicas de todas as empresas numa tabela sem isolamento de tenant; isso é **consequência de
  um payload que não se conhecia**. Aparar campos destruiria o valor de diagnóstico que justifica a
  retenção e esbarra na **ADR-0034**. **É decisão de negócio e de LGPD, não de engenharia.**
- **Sugestões a apresentar, nenhuma implementada:** reduzir a retenção, ou cifrar o `recebido` com o
  mesmo mecanismo do segredo operável (ADR-0032).
- **Gatilho:** a decisão do usuário.


## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

- **Os dois gates discordaram da severidade do mesmo eixo, e o Gate 2 tinha razão.** Na T6, o QA
  registrou a ausência de companheiro negativo no passo 11 do `CT-1043` como `baixo`/`tests`
  (`happy_path_only`, escriturado como `D26`). O Tech Review olhou o mesmo eixo e abriu `ALTO`/`security`,
  com o argumento que se sustentou à medição: *"a lacuna do companheiro negativo é real e é `tests`, mas
  ela é **sintoma**. O fato de produção é que o único ponto de redação do arquivo não é chamado neste
  caminho para o segredo que este caminho de fato carrega — isso é **ausência de garantia em código de
  produção**, e não cobertura de teste faltando."* O caminho de vazamento foi mapeado ponta a ponta, do
  ramo de recusa da concessão até `negocio.entrega_da_noticia.motivo_*` e a tela do Admin. **A lição é
  de método**: quando um teste falta, pergunte primeiro *o que ele provaria*; se a resposta for "uma
  garantia que não existe", o achado não é de `tests`.
- **A correção da T6 fechou pelo compilador, não por convenção.** `semACredencialDoAto` virou
  `semOsSegredosDoAto(texto, segredosDoAto)` com o segundo parâmetro **posicional e obrigatório**, e
  `AtoAutenticado` passou a carregar `segredosDoAto` como campo obrigatório do ramo `FALOU`. O gate
  verificou a propriedade **por execução** (`tsc --build` verde é a prova do *"a omissão não compila"*),
  não por leitura do relato. É a forma mais forte de fechar classe que esta fatia produziu.

- **O processo do Claude Code caiu uma vez**, com os executores de T1 e T3 em voo. Foi medido que **nada havia sido escrito** no working tree, e os dois foram **retomados a partir do transcript** em vez de redespachados — preservando a leitura obrigatória já concluída, sem risco, porque o repositório estava byte a byte como eles o haviam lido. `base_sha` inalterado (`82874d0`).
- **A árvore já continha alterações antes da primeira task** — `preparar-material-do-certificado.sh`, `docs/adr/INDEX.md` e `docs/specs/domain-glossary.md` modificados, mais os artefatos untracked da fase de spec. São produto do discovery desta fatia, **não** de execução de task; o filtro por paths isola cada task e a lista de cada gate foi montada já sem esse resíduo.
- **O guard de recursos de teste não foi conservadorismo ocioso.** O QA da T1 registrou que o `CT-1016` planta um sentinela em `/dev/shm` com **nome literal fixo**: duas execuções simultâneas da suíte daquele pacote colidiriam. Serializar os QAs do lote evitou exatamente isso. Sugestão do gate, para quem revisar depois: randomizar apenas o **sufixo** fecharia a janela sem violar a exigência do card, que prescreve o prefixo literal por extenso.
- **Erro do orquestrador, corrigido por um gate.** Passei `CT-1021` ao QA da T1 como entregável dela; ele é da **T2**. A causa foi extrair CTs por `grep` no arquivo da task, onde o número aparece **apenas como citação** (*"CT-1022 é o primeiro livre depois de CT-1021"*). O gate leu a §6 canônica, constatou a ausência de card e de rastreabilidade, localizou o CT na T2 e **reportou em vez de reprovar**. A lição foi aplicada no gate seguinte: a exigência sai da §6.5/§6.6, nunca de varredura do arquivo inteiro.
- **Dois critérios da T3 precisaram de contexto para não gerar rejeição indevida**, e nenhum é defeito: o **AT-3** traz número defasado (ver D2), e o **AT-6** é condicional cuja hipótese não ocorreu — a extração por `sed`+`eval` funcionou, e o executor marcou o critério com comentário explicando em vez de fingir cumprimento.
- **Duas prescrições de spec foram refutadas por medição, e as duas na direção de menos trabalho, não de mais.** O `CT-1045` **não** exige `sudo` (a §19.7 do tech spec ainda afirma que sim — correção agendada para a T10), e o atrito **A2** não se materializou: o `CT-1017` rodou determinístico em 5 execuções, então **nenhum débito nasceu** e a asserção ficou no valor exato `0o600`. É o precedente de método do repositório operando: medir a premissa antes de registrá-la.
- **Insumo que o Tech Review deixou para a T2, e que ela precisa usar:** o teto de tempo do conversor é de **30 s por invocação**, mas a conversão faz **duas** invocações mais uma leitura do material convertido — o pior caso de `converterMaterialSeNecessario` fica **acima de 60 s**. Não é achado (o teto existe e o valor é deliberado), mas a borda de registro que chamar isto sob uma requisição HTTP precisa **decidir o próprio teto de rota com esse número em mãos**, em vez de herdar o padrão.
- **Um risco de segurança foi avaliado e descartado com razão escrita**, e vale registrar para não ser reaberto: `certificadoDeOrigem` carrega a chave privada em claro no heap do processo do produto. O ganho de corrigir é **nulo** — o mesmo processo já detém, na mesma chamada, o material e a senha que o abrem, de modo que um despejo de heap capaz de ver a chave já teria o par que a produz. O docblock é honesto (*"ela não é retida"*) e a alternativa (terceira invocação com `-nokeys`) está rejeitada por escrito.
- **Uma colisão de ID de caso de teste foi introduzida e detectada no mesmo run** (D6). O executor da T1 acrescentou um `CT-1022` inferindo que era *"o primeiro livre depois de CT-1021"*, sem saber que a T2 já detinha `CT-1020`–`CT-1023`. **É o mesmo erro de raciocínio que o orquestrador cometeu** ao montar a lista de CTs do Gate 1 da T1 (passou `CT-1021`, que é da T2) — e que o QA corrigiu. Nos dois casos a causa é a mesma: **inferir numeração por proximidade em vez de consultar a alocação global**. Fica como lição do run: o ID de CT sai da §6.5/§6.6 da task **e do conjunto alocado no plano**, nunca de "o próximo depois do que eu vi".
- **O Tech Review resolveu um julgamento de `DECISÃO FECHADA` medindo, não opinando.** O executor moveu as três mensagens de recusa para `MENSAGEM_POR_CODIGO`, tabela protegida pela `DECISÃO FECHADA — T9`. O gate abriu o `REVERTER EXIGE` dela — *"provar que NENHUM módulo fora deste arquivo lê a tabela"* — e constatou que a mudança **depende** da publicidade que o marcador registra, em vez de contrariá-la; mediu por grep que **16 módulos** já a leem, 13 deles services. O que foi substituído era docblock comum, não marcador. Citou o precedente inverso (`boleto.service.ts:265`), que mantém literais locais pela razão que aqui deixou de valer.
- **Um risco forward-looking foi capturado antes de existir** (D9): o pior caso de 75 s da rota de registro excede o `proxy_read_timeout` padrão de 60 s do servidor de borda. Hoje é inócuo — a rota não é publicada pelo vhost —, mas na F7 produziria `504` sobre um registro concluído com sucesso do lado do servidor, com o subprocesso ainda vivo. É o tipo de achado que só aparece quando o gate lê a decisão de projeto (não pôr teto na borda) contra o roadmap.
- **O Tech Review da T4 achou uma terceira correção de texto alheio que o executor não declarou** — a cadeia narrativa de `papel-de-conexao.spec.ts`, emendada para incluir a `0021`. Julgou-a **legítima** (sem o elo, a soma não alcança 22, que é o valor que o `toHaveLength` passa a afirmar) e **não abriu achado**, registrando que *"o que falhou foi a completude da declaração, não o critério"*. É a distinção certa: a Regra 3 governa **o que se pode tocar**, e o campo `Garantias removidas` governa **o que se deve declarar** — falhar no segundo com acerto no primeiro é ruído de registro, não desvio de escopo.
- **A granularidade do `CT-1027` foi julgada e aceita, com o custo reconhecido.** Um `it` de ~370 linhas com nove passos tensiona a Iron Law #2, mas: é a convenção da casa com precedente nominal (`CT-940`), a §6.6 a prescreve passo a passo, os passos **partilham estado mutável por desenho**, e — o argumento decisivo — o registro do `MT-E2` **mede** a discriminação: só o passo 3 reprova, **nomeando** `colunas: ['verificada_por']`. O custo real, registrado e não varrido: no `MT-E1` o passo 1 **mascarou** os passos 2-9.
- **A T5 custou 3 rodadas, e o Ledger prova que nenhuma foi desperdiçada.** A métrica de fechamento deu `10 achados totais | 4 originados em rodada >1 | **0 suspeitos de incompletude da rodada 1**` — isto é, **todos** os achados tardios nasceram das **próprias correções**, não de varredura que deixou passar. Os três defeitos fechados eram reais e nenhum seria pego por revisão convencional: **(1)** o teto anti-abuso estava em `.refine()` de esquema de saída, que **nunca é `parse`ado** nesta base — declarado, testado e **inoperante**; **(2)** o contrato publicava `diagnostico` obrigatório enquanto o banco o admitia nulo, divergência entre **duas seções do tech spec que nenhuma task violou**; **(3)** a própria correção media com `DefineProperty` e gravava com `Set`, descartando `__proto__` silenciosamente e **falsificando o docblock que ela mesma escrevera**.
- **A primeira `DECISÃO FECHADA` do run nasceu na T5**, e os dois gates a julgaram legítima. O que a torna boa é o `REVERTER EXIGE`: ele **não** pede *"provar que `__proto__` funciona"* (o que um `if` satisfaria) — pede *"provar que medição e escrita continuam usando a MESMA primitiva, para toda chave que o provedor possa devolver"*, e **recusa nominalmente** o conserto por caso especial. É a diferença entre proteger o sintoma e proteger a classe.

---

## 8. Intervenção dirigida de 2026-08-22 — a sexta, e o que ela mediu

> **Fora do pipeline**, no molde das cinco anteriores (2026-08-09, 2026-08-10, 2026-08-12, 2026-08-16
> e 2026-08-19). Pedida pelo usuário depois de um parecer sobre rodar `/agent-spec-debt-resolution`
> sobre o estoque inteiro. Duas frentes: o **parecer remedido** e uma **lista curta de sete débitos
> de consequência**, dos quais **seis foram fechados e um foi deliberadamente não fechado**.

### 8.1 O parecer sobre a skill — NÃO pela sexta vez, com dois argumentos novos e um que caiu

O parecer da §6.1 do `run-report.md` da `fundacao-bancaria` e da §7.1 do da `webhook-e-carne` é
**reafirmado**. O resumo vigente está no `CLAUDE.md`; aqui fica o que esta rodada mediu de novo.

**O argumento decisivo é novo, e não é sobre custo nem sobre gate — é sobre quem decide.** A skill
apoia a segurança inteira na FASE 3: *"o especialista classifica, o usuário decide"*, e a Onda 1
oferece `Incluir TODOS os recomendados (Recomendado)`. Só que a `.claude/rules/autonomia-do-run.md`
§A1 é de **escopo universal** e manda **não invocar `AskUserQuestion` e adotar a recomendada**. As
quatro ondas de curadoria, mais a pergunta de sobrescrita de diretório, **nunca chegam ao usuário**:
a seleção vira o que uma LLM classificou como `recomendado_corrigir` lendo ~206 mil tokens de §2. As
duas regras estão corretas isoladamente; **a composição delas é que é insegura**, e nenhum dos cinco
pareceres anteriores tinha notado.

**O segundo argumento novo** é o cruzamento que faltava: **166 dos 245 débitos pagáveis (67%)
apontam para arquivo que contém marcador `DECISÃO FECHADA`** — são 383 marcadores em 176 arquivos —,
e **139 deles rodariam só com Gate 1**. A §6.1 já dizia que o match de Critical Path falha em
português; o que faltava era mostrar que os alvos coincidem com o código protegido.

⚠️ **E um argumento CAIU, o que também é resultado**: a §7.1 sustentava que a skill recolheria como
abertos os 39 débitos fechados só no campo `Status:` do corpo. A higienização daquela mesma data os
promoveu, e a medição de 2026-08-22 confirma **zero** blocos nessa condição, inclusive entre os 41
novos desta fatia. O argumento não vale mais e **não deve ser reposto** — o que sustenta o parecer
hoje são os quatro do `CLAUDE.md`, não este.

**As medições desta rodada:**

| Medida | Valor |
|---|---|
| Blocos na §2 / fechados / **abertos** | 544 / 137 / **407** em 14 fatias |
| Elegíveis pelo filtro da skill (`BAIXO`/`MEDIO` abertos) | 411 |
| Destes, **não pagáveis hoje** | **167 (40%)** — 72 gatilho não chegado, 39 spec de fatia fechada, 26 F5/F6/F7, 20 mandam NÃO agir, 11 migração imutável |
| Pagáveis que casam Critical Path por **match textual** | 38 de 245 (**15%**) |
| Pagáveis de área **realmente sensível** | 143 de 245 (**58%**) — falso-negativo de **114** |
| Pagáveis em arquivo com `DECISÃO FECHADA` | **166 (67%)**, dos quais **139 sem Tech Review** |
| Pagáveis que **compartilham arquivo** com outro débito | 160 de 233 (**69%**) — o paralelismo que a skill assume não existe |
| Pagáveis cuja correção **remove ou funde caso de teste** | 18 (6 já exigem `SUT_IS_CORRECT_BECAUSE`) |
| **Suíte completa, cronometrada** | **456 s** (1812 casos, 9 pacotes) — o custo de **uma** rodada de Gate 1 |
| Origem dos 137 fechos | **57 intervenção dirigida** · 40 dentro do run · **21 skill** (todos do repositório Frappe antigo) |

### 8.2 O que foi pago — seis de sete

| Débito | O que fechou | Prova |
|---|---|---|
| **D3 · F5/T1** (esta fatia) | o `spawn` do conversor nasce com **ambiente vazio**, e não com o herdado da API | medido **antes** de aplicar, como o bloco exigia: ciclo completo com `-legacy` corre com ambiente vazio (3039 B → 2515 B); e a herança **derruba** a conversão com `OPENSSL_MODULES` plantado. Rede: `CT-1050`, com controle positivo |
| **D17 · F5/T5** (esta fatia) | o eixo de tamanho do `diagnostico` virou **predicado total** (`try/catch` na serialização) | defeito reproduzido contra o `dist/` de então (`BigInt`, ciclo); rede no `CT-1044`, com controle positivo |
| **D21 · F4/T6** (`fundacao-bancaria`) | a competência é conferida como **valor** (inteiro não-negativo), não só por comprimento do texto | duas pernas novas no `CT-805`: `-20268` e `2026.5`, **ambos de seis caracteres** — os únicos que separam a guarda nova da antiga |
| **D22 · F4/T8** (`emissao-e-conciliacao`) | `MOTIVO_DE_VALOR_ILEGIVEL` separado de `MOTIVO_DE_LIQUIDACAO_INCOMPLETA`, pela **origem do nulo** | linha do **campo ausente** acrescentada ao `CT-950` + asserção de desigualdade entre os dois motivos |
| **D22 · F4/T9** (`webhook-e-carne`) | o alerta do prazo abandonado nomeia as filas que **não assentaram**, mais a contagem | `CT-1007` ganhou a asserção de `pendentes`, campo que o alerta antigo **não publicava** |
| **D34 · F0/T6** (`fundacao-stack-nativa`) | **já estava pago** desde `d346a6f`; faltava a escrituração e a rede | confirmado por `git log -S`; marcador `DECISÃO FECHADA` instalado, com a rede executável agendada pelo gatilho do `D38 · F5/T8` |

**Baseline (P1/P5), caso a caso:** `contracts` 424 → **425**, `cobranca-bancaria` 105 → **106**, e os
outros sete pacotes **inalterados** — total **1812 → 1814**, todos verdes, **nenhum caso removido**.
Os fechos do `D21` e do `D22` acrescentaram asserções a casos existentes, e por isso não movem
contagem; quem procurar casos novos ali não vai achar, e isso é o esperado.

### 8.3 O que NÃO foi pago, e por quê — o `D4 · F1/T2` de `fundacao-multitenancy-identidade`

`semear()` aceita destino arbitrário. As duas correções que o bloco oferece foram **medidas**, e
nenhuma passou no **P3**:

- **Mover o export para subcaminho** custa 13 arquivos de teste em três pacotes, o `exports` do
  manifesto (hoje um caminho só), o barril e a âncora do `CT-012`, que audita a lista **por
  igualdade**. É refactor cross-module — a proibição 5 do Protocolo Antirregressão.
- **Guarda por `NODE_ENV`** fecharia o caminho *"processo de produção"* e deixaria aberto o *script
  ad-hoc contra o banco durável*. Fecha o caso, não a classe.

O P3 manda **não editar** quando `POR QUE ISTO FECHA A CLASSE` não se escreve com convicção, e
nenhuma das duas a sustenta. A medição ficou registrada na §2 daquela fatia para que a próxima
leitura não a refaça.

### 8.4 O que esta rodada ensina sobre triagem de débito

- **Débito pago noutra fatia não volta sozinho para a §2 que o registrou.** O `D34` estava corrigido
  havia três fatias e ninguém sabia. A varredura que o pegou foi ler o **código**, não o relatório —
  e é barata: `git log -S` sobre a frase da correção proposta.
- **O eixo que decide se um débito é pagável não é campo estruturado em lugar nenhum.** Severidade,
  categoria, arquivo e origem são; *"tem gatilho que não chegou"* e *"manda não agir"* vivem em
  prosa, dentro de `Impacto` e `O que fazer`. É por isso que ferramenta que tria pelo cabeçalho
  erra 40% aqui, e é o que a §8.1 mede pelo lado da skill.
- **"Medir antes de aplicar" pagou duas vezes nesta rodada**: no `D3`, a medição autorizou a guarda
  mais restritiva (`env: {}`, e não uma lista de variáveis); no `D4`, ela **desautorizou** as duas
  correções propostas. O mesmo método, dois desfechos opostos — que é o sinal de que ele está
  fazendo trabalho.

---

## 9. O fecho do `D42` — a conformidade do ciclo de vida do webhook, 2026-08-22

> Mesma data da §8, e é a **continuação dela**: o `D42` nasceu bloqueado por duas autorizações, o
> usuário deu as duas no mesmo dia, e o bloco inteiro foi entregue.

### 9.1 O que o desbloqueio mudou

| Antes | Depois |
|---|---|
| a consulta confirmava por **presença de objeto** | ela exige **registro nosso, validado e não inativado**, e distingue **sete** situações |
| desfecho **binário** | **ternário** — habilitada · em validação · desabilitada — mais o indeterminado |
| `habilitada boolean` como única fonte | `situacao` é a fonte, `habilitada` é a projeção, e a `CHECK` da `0025` **amarra as duas** |
| duas operações na porta | **quatro** — as duas de correção são mecanismo **interno** da ativação |
| endereço trocado ⟹ **beco sem saída** | corrigido pela própria ativação, com a referência provando a propriedade |
| webhook inativado ⟹ **"entrega ativa"** | desabilitado, com a **causa que o provedor deu**, verbatim |

### 9.2 As três decisões de desenho que merecem registro

1. **A referência do cadastro é persistida, contra o `A4` do prompt** — e a divergência está medida
   no `D44`: a razão que a recusava (*"nenhuma migração"*) caiu com a autorização, e sem ela a linha
   5 do quadro é inalcançável. Ela é **opaca**: nada a interpreta, e responde uma pergunta só.
2. **As linhas 1 e 6 do quadro foram FUNDIDAS**, e isso mantém o motivo verdadeiro. A alternativa era
   o produto gravar um texto próprio dizendo *"a vaga é de outro sistema"* — o que poria vocabulário
   dele no campo que existe para preservar **verbatim** o do provedor (RN-02). Fundindo, o produto
   pede a vaga e o provedor responde que está ocupada; é essa recusa, íntegra, que o Admin lê.
3. **A leitura `NAO_RESPONDEU` tem duas metades**, discriminadas pela presença do motivo — nulo é
   *"não respondeu"* e preserva o estado; presente é *"respondeu e recusou"* e se grava. É a mesma
   leitura da presença que o cadastro sempre fez, agora estendida à consulta.

### 9.3 O que a reconferência periódica passou a fazer — e o que ela deliberadamente NÃO faz

**Faz:** promove *em validação → habilitada* quando o provedor conclui a validação (é o que fecha o
ciclo assíncrono que a ativação abre), e **desabilita com a causa** quando encontra o cadastro
inativado — que é o cenário do `D1` crítico, e o único jeito de o Admin ficar sabendo sem olhar.

**Não faz:** cadastrar, corrigir endereço ou reativar. Os três são atos de **configuração**, e quem
os dispara é o Admin pela rota de ativação. Uma tarefa de fundo que os executasse mudaria a conta do
cliente junto ao provedor sem ninguém ter pedido, e periodicamente. O dublê da porta **levanta** nas
três, de modo que uma implementação que as chamasse falha em vez de passar despercebida (`CT-1056`).

### 9.4 Custo real, e por que ele foi maior que o desenho

O desenho saiu rápido; o custo foi a **propagação**. Mudar contrato publicado e schema ao mesmo tempo
fez reprovar cerca de **vinte âncoras de superfície** — igualdade de conjunto sobre chaves publicadas,
símbolos do barril, operações da porta, restrições da tabela, capacidades do adaptador, contagem de
variáveis de partida. **Nenhuma foi afrouxada**: cada uma cresceu com `SUT_IS_CORRECT_BECAUSE` escrito
no ponto, e a igualdade (nunca contenção) segue valendo nas duas direções.

É o preço projetado dessas âncoras, e elas funcionaram: **duas vezes** a barreira executável do
`CT-907` pegou o índice de débito dessincronizado — uma por marcador sem linha, outra por linha sem
marcador —, nas duas direções que a §3-B prevê.
