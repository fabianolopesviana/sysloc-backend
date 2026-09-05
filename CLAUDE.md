# Sysloc Backend

SaaS multi-empresa de gestão de locação de imóveis. Backend em Node/NestJS/PostgreSQL,
**nativo, sem Docker**. Substitui integralmente o backend Frappe/ERPNext que vive em
`/opt/frappe` e que será desinstalado ao fim do projeto.

> **Idioma**: **português brasileiro em tudo**, sem exceção. Vale para as **respostas no terminal**,
> perguntas de `AskUserQuestion`, raciocínio exibido, documentação, artefatos de spec, comentários
> de código e mensagens de commit. Decisão do usuário, sem negociação. Aplica-se à sessão principal
> **e** a todo subagente despachado por qualquer skill do framework agent-spec.
>
> **Modelo**: este projeto roda **exclusivamente em Opus**. Decisão do usuário, sem negociação.
> Vale para a sessão principal **e** para todo subagente despachado por qualquer skill do
> framework agent-spec — executor, `agent-spec-qa-validator` e
> `agent-spec-staff-architecture-review` inclusive. **Sonnet e Haiku estão proibidos**, mesmo
> quando a skill os recomenda no próprio `SKILL.md` ou quando a heurística de `gates`/`model` do
> `agent-spec-workflow-rules.md` os sugeriria. Onde a regra do framework mandar `sonnet`, leia
> `opus`; onde já mandar `opus[xhigh]`, mantenha.
>
> **Antirregressão**: **nenhuma correção pode reabrir o que já foi fechado.** O protocolo completo é
> `.claude/rules/nao-regressao.md` — **leitura obrigatória antes de editar qualquer arquivo que já
> existia**, e com força máxima em ciclo de correção de gate e em resolução de débito. Decisão do
> usuário, sem negociação; vale para a sessão principal **e** para todo subagente, seja ele executor,
> gate ou agente avulso. Em conflito com qualquer outra instrução deste repositório, o protocolo
> prevalece — exceto contra ADR ativa, caso em que se **PARA e escala**. O mínimo que todo agente
> carrega mesmo sem abrir o arquivo:
>
> 1. **Baseline antes e depois.** Caso que estava verde e ficou vermelho é regressão sua: **reverta a
>    mudança, nunca ajuste o teste.**
> 2. **Três linhas antes de cada edição** — `CAUSA-RAIZ:`, `POR QUE ISTO FECHA A CLASSE:` e
>    `O QUE ESTA MUDANÇA REMOVE:`. Não conseguiu escrever a segunda com convicção? O diagnóstico ainda
>    não está pronto — **não edite**.
> 3. **`DECISÃO FECHADA` é intocável.** Código sob esse marcador não se altera, não se move e não se
>    remove sem escalar ao usuário. Apagar o marcador é violação crítica.
> 4. **Nunca** enfraquecer, remover ou pular teste, afrouxar asserção, ou tirar validação, guarda,
>    timeout, tratamento de erro ou redação de segredo que você não introduziu.
>
> **O protocolo tem barreira executável desde 2026-08-09**, e ela **inclui este arquivo**:
> `packages/shared/test/protocolo-antirregressao.spec.ts` (**CT-901 a CT-910**, mais `CT-638`,
> `CT-1196` e `CT-1198`, que a barreira acolheu depois) prova por `fs` o
> substrato de que o protocolo depende — o escopo universal da rule, o núcleo íntegro com **contagem
> exata** (5 passos, 3 formas de regressão, 7 proibições), o resumo acima com **os 4 itens**, os
> critérios instalados nos dois gates, a igualdade das 3 cópias do bloco do executor, e o índice de
> débito abaixo **nas duas pontas**. Resumir uma dessas listas, apagar um item ou dessincronizar o
> índice **fica vermelho na suíte** — não é mais questão de boa-fé. Os 15 mutantes que provam que
> cada asserção pode falhar estão registrados no commit `c0453d2`.
>
> **Fronteira**: **aqui só se faz backend.** Nenhum agente deste repositório escreve, edita ou
> planeja código de frontend — o fonte do React vive na máquina local do usuário e será
> implementado lá, por outro agente, a partir do handoff que esta base produz. Decisão do usuário,
> sem negociação. O ponto exato onde o trabalho daqui termina está definido logo abaixo, e é
> **gatilho de parada**: task que peça implementação de frontend, **PARE e escale**.

---

## Regras de comportamento (não negocie)

1. **Incerteza → leia o arquivo ou rode `grep`. Nunca chute.** Se não achou (função, campo, API, arquivo), diga que não achou.
2. **Menor delta possível.** Resolva só o pedido. Oportunidade de melhoria fora do escopo → reporte separado, não execute sem pedir.
3. **Não toque em código fora do escopo sem autorização explícita.** Viu algo errado → sinalize, não conserte por conta própria.
4. **"Funciona" só com evidência.** Ao afirmar que algo funciona, mostre o output do comando/teste. Não rodou → diga "não rodei".
5. **Ações destrutivas exigem confirmação prévia.** Migração de schema, delete em massa, mudança de CI/auth → confirme antes de executar.

---

## Estado atual

> **Índice, não relatório.** O painel fase a fase vive em `docs/plano-backend-novo/roadmap.md`, que é
> **gerado** por `deploy/scripts/roadmap/atualizar-roadmap.sh` (gancho `PostToolUse`) — não o edite à
> mão, e não duplique aqui o que ele já diz. O detalhe de cada fatia (débitos, achados, decisões) vive
> na `_run/` dela. Aqui fica **só o que morde quem não abriu nenhum dos dois.**

**F0 a F5 concluídas.** A **F5 fechou em 2026-08-23**, com **21/21 tasks** nas duas fatias —
(i) `integracao-bancaria-autonoma/v1` (10/10) e (ii) `automacoes-agendadas/v1` (11/11), esta última
fechando com `GET /v1/automacao-de-cobranca/rotinas`. ⚠️ **Essa é a ÚLTIMA rota que este repositório
publica**: com a F5 fechada, **nenhuma fase restante acrescenta, remove ou altera rota**, e o
**congelamento da superfície** — segundo item do marco de entrega — está alcançado. ⚠️ **EMENDA de
2026-09-02 (ADR-0039), com o texto acima preservado**: o alcance das duas frases é a superfície da
**imobiliária** — a que o `@syslocbr/contracts` entrega ao app do cliente —, e nela nada foi
acrescentado, removido ou alterado desde a `GET /v1/automacao-de-cobranca/rotinas`. A superfície do
**operador do SaaS** fica **FORA** do congelamento, e a fatia `painel-master-administradores`
publicou **7** rotas nela (T4, T5 e T6): por isso as âncoras executáveis, que contam as **duas**
superfícies, medem hoje **113 rotas / 98 manipuladores / 20 públicas**. Elas *"se movem mesmo quando
só o painel do operador cresce"* — a `Cons` literal daquela ADR, e **não** violação do marco. ⚠️ **Se
este texto voltar a dizer que a F5 falta, foi regressão de índice, não fase reaberta.** A F4 fechou em
**2026-08-19**, com 43/43 tasks nas três fatias — (i) `fundacao-bancaria` em 2026-08-15 (14/14),
(ii) `emissao-e-conciliacao` em 2026-08-18 (17/17) e (iii) `webhook-e-carne` em 2026-08-19 (12/12).
São **147 tasks** aprovadas nos dois gates — as **126** do fecho da F4 mais as **21** da F5.
⚠️ **A (iii) É o carnê** — se este texto voltar a dizer que ela falta, foi regressão de índice, não
fatia reaberta.

- **Superfície: 113 rotas / 98 manipuladores**, `semDeclaracao` vazio, `publicas` em **20**. Medido
  na **T7 da fatia `painel-master-administradores`**, em **2026-09-02**, pelo `CT-1240`, com as **duas
  medições independentes** cuja igualdade entre os eixos é afirmada à parte do valor esperado — e
  **medidas**, nunca derivadas da aritmética `106 + 7`. ⚠️ **As sete rotas novas são as do ciclo de
  vida do Master** (`GET /v1/master/empresas/:id/administradores`, `PUT`/`DELETE` de
  `/v1/master/empresas/:id`, `POST` de suspensão e reativação, `PUT` e `DELETE` de
  `/v1/master/usuarios/:id`), e as sete **exigem sessão** — por isso `publicas` **não** mudou.
  ⚠️ **O CONGELAMENTO NÃO FOI VIOLADO, e a ADR-0039 é quem diz por quê**: ele alcança a superfície
  que o `@syslocbr/contracts` entrega à imobiliária, e **nenhuma rota dela foi tocada**; a do
  **operador do SaaS** fica fora dele. Estas âncoras contam as **duas**, e por isso se movem quando
  só o painel do operador cresce. ⚠️ **O `106 / 91 / 20` era o da T10 da fatia
  `automacoes-agendadas`**, medido em 2026-08-23 pelo `CT-1095` — a última rota da superfície da
  imobiliária —, e **não se repõe**. ⚠️ **Não conte à mão: os três números são
  constantes EXECUTÁVEIS** de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` —
  `ROTAS_PUBLICADAS_EM_PRODUCAO`, `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` e
  `PARES_PUBLICOS_DA_SUPERFICIE` —, de modo que a suíte é a fonte e este texto é a cópia.
  ⚠️ **E desde 2026-08-26 a cópia não depende mais de disciplina**: o `CT-1196`
  (`packages/shared/test/protocolo-antirregressao.spec.ts`, T11 da fatia `publicacao-e-backup`)
  **lê** os três números desta linha e as três constantes, e afirma a igualdade eixo a eixo — a
  próxima divergência fica **vermelha na suíte**, em vez de sobreviver a uma leitura desatenta.
  As três foram reconferidas naquela data e **nenhuma se moveu**; a fatia não publica rota.
  ⚠️ **E desde 2026-09-02 ele lê as QUATRO ocorrências normativas, e não só esta**: a prosa da F5, este
  bullet, o item 2 do marco de entrega e a menção das rotas `GET /docs*` no bloco de débitos. A T7 da
  fatia `painel-master-administradores` mediu que as outras três divergiam em silêncio — que é
  exatamente o defeito que o caso nasceu para pegar —, e cada par (ocorrência, eixo) tem hoje perna
  própria e falsificação própria. ⚠️ **A menção de `91 manipuladores` na auditoria de drift do handoff
  é HISTÓRICA** (medição de 2026-08-24) e **não se reescreve**: ela não é ocorrência normativa, e
  atualizá-la apagaria o registro do que foi medido naquela data.
  **O número da F2 era 75, não 77** — não "corrija" para 77, a
  premissa do `HEAD` duplicado foi refutada por medição. **E o 99/84 era o da (ii)** — não o
  reponha; **o 103/88 era o do fecho da F4** (`CT-1004`), medido em 2026-08-20, e **o 105/90 era o da
  T7 da fatia `integracao-bancaria-autonoma`** (`CT-1038`), medido em 2026-08-22 — nenhum dos três se
  repõe.
- **Suíte: 2138 casos**, 9 pacotes — `contracts` **487** · `api` **463** · `shared` **309** · `db` **301** ·
  `worker` **180** · `documentos` 159 · `auth` **95** · `cobranca-bancaria` **114** · `regua` 30.
  ⚠️ **Os três primeiros se moveram na intervenção dirigida dos RECORTES DE LISTAGEM**, em
  2026-09-05, e os deltas são **+32** (`contracts`), **+5** (`db`) e **+7** (`api`). Ela atende ao
  pedido da equipe de frontend e é autorizada pela `Decision` da **ADR-0039** — *"dentro do
  congelamento, acrescentar operação ou campo é permitido"* —, entregando **cinco** parâmetros novos
  em rotas que já existiam (`?status=`, `?fimDe=`/`?fimAte=` em `GET /v1/contratos`;
  `?statusLocacao=` em `GET /v1/imoveis`; `?vencimentoDe=`/`?vencimentoAte=` em `GET /v1/cobrancas`)
  e **três campos** no item da carteira de contratos (`nomeImovel`, `nomeLocador`, `nomeLocatario`).
  ⚠️ **NENHUMA rota foi publicada, removida ou renomeada, e as três âncoras de superfície NÃO se
  moveram** — seguem em `113 / 98 / 20`. Quem procurar aqui um quarto número de âncora não vai
  achar: a diferença entre *acrescentar campo* e *acrescentar operação* é o que a ADR-0039 declara.
  ⚠️ **Os 32 do `contracts` são `CT-1256` a `CT-1259`** em `packages/contracts/test/esquemas.spec.ts`
  (as tabelas `it.each` produzem as pernas restantes), e a âncora
  `QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA` subiu de **18 para 20** — mover o valor de uma constante que
  um caso já afirmava **não** acrescenta caso. Os **5** do `db` são `CT-1260` a `CT-1264`, no arquivo
  NOVO `packages/db/test/recortes-de-listagem.spec.ts`; os **7** do `api` são `CT-1265` a `CT-1271`,
  no arquivo NOVO `apps/api/test/recortes-de-listagem.e2e.spec.ts`.
  ⚠️ **Três casos EXISTENTES do `api` mudaram de valor esperado e NÃO são casos novos**: o `CT-327`
  (`contrato-publicado.e2e.spec.ts`, cuja tabela passou a apontar a **listagem** para
  `esquemaDoContratoNaCarteira`, mantendo as outras sete rotas em `esquemaDoContrato`) e o `CT-418`
  e o `CT-415` (`contratos.e2e.spec.ts`, cujas igualdades de corpo inteiro acolheram os três nomes).
  Os três carregam a linha `SUT_IS_CORRECT_BECAUSE` no ponto, **nenhuma asserção foi afrouxada** e
  nenhuma chave saiu — a do `CT-415` ficou **mais forte**, porque passou a afirmar a assimetria
  entre a listagem e a leitura por código. **Não os reponha.**
  ⚠️ **A correção do CAMPO DA CHAVE DESCONHECIDA, no mesmo dia, NÃO moveu contagem alguma** — o
  `api` saiu 463 antes e depois. Ela nasceu de uma medição da equipe de frontend e o defeito era de
  **conformidade com o contrato publicado**: a chave desconhecida na cadeia de consulta era recusada
  nomeando o `campoPadrao` do ponto de chamada (`'limite'`), enquanto a **§6.2 do
  `handoff-frontend.md`** promete desde 2026-08-24 que ela nomeia **a própria chave**, e a fixture
  `listar-contratos/parametro-desconhecido` da §20.2 publica o mesmo. `campo: "limite"` é
  indistinguível da recusa de um `limite` de fato inválido, de modo que **nenhum** cliente conseguia
  classificar as duas. O conserto é `validarConsulta`, em `apps/api/src/comum/validacao.ts`, e as
  **oito** bordas de listagem passaram a chamá-la; as sete constantes `CAMPO_DA_CONSULTA = 'limite'`
  e o literal inline de `master/empresa.controller.ts` sumiram. ⚠️ **Dois casos EXISTENTES mudaram de
  valor esperado e NÃO são casos novos** — o `CT-1245` (`master-administradores.e2e.spec.ts`, agora
  `campo: 'pagina'`) e o `CT-1270` (`recortes-de-listagem.e2e.spec.ts`, agora
  `campo: 'statusDoContrato'`) —, os dois com `SUT_IS_CORRECT_BECAUSE` no ponto e com o corpo ainda
  comparado INTEIRO por igualdade. **Não os reponha.** ⚠️ **O CORPO não foi tocado**: chave
  desconhecida em `POST`/`PUT` continua nomeando `'corpo'`, e isso **diverge da §6.1** do mesmo
  handoff — divergência **medida, declarada e em aberto** (19 asserções em 10 suítes), fora do
  escopo do que a equipe pediu. ⚠️ **O carnê (`CAMPO_DO_RECORTE = 'recorte'`) também ficou fora, por
  decisão registrada** no docblock dele — a razão e o custo da troca estão escritos lá.
  ⚠️ **Os seis pacotes restantes foram remedidos um a um na mesma data e NENHUM se moveu**,
  inclusive os quatro que consomem o barril do `db` e o `shared`, cuja barreira do protocolo lê esta
  linha. ⚠️ **A medição do `cobranca-bancaria` na linha de base ANTES foi contaminada** por uma
  edição em voo (o `tsc --build` dele reprovou sobre um tipo pela metade); a referência é o **114**
  escriturado, e a medição DEPOIS bate com ele.
  ⚠️ **O `api` foi de 455 a 456 na correção dirigida do incidente `PROD-2026-09-03-01`**, em
  2026-09-03, e o delta é **1**: o **`CT-1250`**, em `apps/api/test/saude.e2e.spec.ts` — o `404` do
  **roteador** e o `404` de **negócio** medidos na mesma aplicação, com os corpos afirmados
  **diferentes entre si**. ⚠️ **O `CT-005` do mesmo arquivo mudou de valor esperado e NÃO é caso
  novo**: ele passou a esperar `REQUISICAO_RECUSADA` onde esperava `RECURSO_NAO_ENCONTRADO`, com a
  linha `SUT_IS_CORRECT_BECAUSE` no ponto — o propósito dele (o envelope da ADR-0007 substitui o
  formato do arcabouço) é preservado inteiro, e o valor que ele fixava é que estava errado desde
  sempre. **Não o reponha.** Os outros oito pacotes **não foram remedidos por esta correção**, que
  só toca `apps/api`, um script de `deploy/` e este arquivo; o `shared` foi, porque esta linha vive
  num arquivo que ele lê, e **não se moveu** (309).
  ⚠️ **O `api` foi de 446 a 455 e o `shared` de 295 a 309 na T7 da fatia
  `painel-master-administradores`**, em 2026-09-02, e os dois deltas são **9** e **14**.
  ⚠️ **Os 14 vermelhos de `cobertura-de-autorizacao.e2e.spec.ts` FECHARAM nesta task, e o `api` não
  cresceu 14**: aqueles casos já eram contados no total de 446 — o que a T7 fez foi levá-los ao verde
  movendo as âncoras para a superfície **medida**. Os 9 novos são o `CT-1240` (1), a perna de
  conteúdo do `CT-1241` (1) e as **7** pernas da `it.each` dele, uma por rota. ⚠️ **Não procure um
  quarto número de âncora**: `ROTAS_PUBLICADAS_NO_MUTANTE` também subiu (100 → 107, medido), e mover
  o valor de uma constante que um caso já afirmava **não** acrescenta caso.
  ⚠️ **Os 14 do `shared` são todos do `CT-1196` estendido**, em
  `packages/shared/test/protocolo-antirregressao.spec.ts`: ele passou de **3** eixos × 1 ocorrência
  para **10** pares (ocorrência, eixo), com uma perna de igualdade e uma de falsificação por par,
  mais a perna antivácuo — `1 + 10 + 10 = 21`, contra os `1 + 3 + 3 = 7` de antes. ⚠️ **Eles entraram
  como PERNAS em casos existentes**, e a contagem de `describe` do arquivo **não se moveu** (o
  `CT-902` a confere em valor exato). Os outros sete pacotes **não foram remedidos por esta task**,
  que só toca `apps/api/test`, `packages/shared/test` e este arquivo.
  ⚠️ **As três escriturações da T4, da T5 e da T6 que dizem *"as três âncoras (`106 / 91 / 20`) sobem
  na T7"* estão CUMPRIDAS** — elas são registro daquelas tasks e ficam como estão; o que vale é este
  parágrafo. Não as leia como pendência, e **não reponha `106 / 91 / 20`**.
  ⚠️ **O `api` foi de 444 a 446 na RODADA 3 da T6 da fatia `painel-master-administradores`**, em
  2026-09-02, e o delta é **2** — as duas pernas do **`CT-1249`**, uma por rota (`PUT` e `DELETE` de
  `/v1/master/empresas/:id`), no mesmo arquivo. ⚠️ **Ele nasceu do `P1` do Gate 2**, que mediu que
  `naoEncontrado()` era a **única função nova da task sem asserção alguma**, com dois pontos de
  chamada em código novo e o `404` **publicado** no `@ApiNotFoundResponse` das duas rotas: três
  mutantes sobreviviam aos 444 casos — `recusaDeExclusao([])` no ramo de alcance nenhum (`422` sobre
  o que nunca existiu), `campo` acrescentado só nesta cópia (quebrando a indistinguibilidade da
  ADR-0017) e `200 {removida:true}` sobre identificador inexistente, que num verbo que apaga um
  **tenant inteiro** faria o operador acreditar que removeu algo. **Nenhum dos três era real.** Os
  outros oito pacotes **não foram remedidos por esta rodada** — ela só acrescenta caso e escritura.
  ⚠️ **O `api` foi de 433 a 444 na T6 da fatia `painel-master-administradores`**, em 2026-09-02, e o
  delta é **11**, todo em `apps/api/test/master-administradores.e2e.spec.ts`: **10** da rodada 1 —
  o **`CT-1247`** rende **3** (uma por chave proibida no corpo da correção de Empresa: `estado`,
  `suspensaEm`, `empresaId`), o **`CT-1232` e o `CT-1233` convivem num caso só** (o segundo
  **consome** o corpo de recusa que o primeiro produziu, e separá-los faria a alternativa deixar de
  ser lida do anúncio), e `CT-1229`, `CT-1231`, `CT-1234`, `CT-1235`, `CT-1238` e `CT-1239` rendem
  **1** cada — mais **1** da rodada 2: o **`CT-1248`**, o `PUT` de Empresa **aceito**.
  ⚠️ **Ele nasceu do `ALTO-001` do Gate 1**, que mediu que as **duas únicas** chamadas ao
  `PUT /v1/master/empresas/:id` em toda a suíte esperavam `422`: a rota de escrita não tinha caso de
  sucesso, e três mutantes sobreviviam aos 443 casos — devolver a forma **sem `exclusao`** (o
  documento prometendo o que o servidor não entrega, que é a classe que o Gate 2 da T4 reprovou),
  zerar `suspensa_em` ao gravar as colunas cadastrais (o `CT-1247` mede o **esquema**, não a
  gravação), e abrir o ponto de salvamento da sonda **antes** do `UPDATE` (`200` sem ter gravado).
  **Nenhum dos três era real** — o caso passou de primeira —, e as três asserções dele são a rede.
  ⚠️ **A rodada 1 da T6 NÃO escriturou o delta dela**, e é por isso que esta linha dizia 2057 com
  `api` 433 até 2026-09-02: **2057 era o valor CORRETO depois da T5**, e não um número defasado —
  não o reponha, e não o leia como erro da T5. ⚠️ **Os 14 vermelhos de
  `cobertura-de-autorizacao.e2e.spec.ts` continuam sendo os MESMOS 14**, no mesmo arquivo e pela
  mesma causa — a superfície foi a **113 / 98** com as duas rotas desta task, e as três âncoras
  (`106 / 91 / 20`) sobem na **T7**, de uma vez. Os outros sete pacotes **não foram remedidos por
  esta task**; o `shared` foi, porque esta linha vive num arquivo que ele lê, e **não se moveu**
  (295).
  ⚠️ **O `api` foi de 432 a 433 na RODADA 2 da T5 da mesma fatia**, em 2026-09-02, e o delta é **1**:
  o **`CT-1246`**, no mesmo arquivo — o endereço já registrado recusa a correção nomeando `email`,
  **nada é gravado** nas duas linhas (o `nome` válido que viajou junto inclusive), e nem a resposta
  nem o **diário do processo** citam o endereço alheio ou o nome da restrição do servidor.
  ⚠️ **Ele nasceu do `ALTO-001` do Gate 1**, que mediu o que a §6.4 (Cenários de Erro) não força: o
  cenário «e-mail em uso» era o único dos três sem CT, e cenário sem CT **não é alcançado pela
  rastreabilidade** — a mesma lacuna já havia produzido o `CT-1220 (b)` na T4. A partir desta rodada
  a §6.4 da T5 tem **coluna de CT**. ⚠️ **Ele é o único caso desta suíte que monta uma SEGUNDA
  aplicação** (registrador trocado por um com destino em arquivo, pela casa
  `apps/api/test/aplicacao-instrumentada.ts`): é a única forma de observar o diário, porque a
  montagem principal roda com `LOG_LEVEL=fatal`. **Não o "simplifique" removendo a montagem** — a
  metade da RN-15 que fala do diário deixa de ter prova, e o `detail` do driver carrega o endereço
  da outra pessoa. Os outros oito pacotes **não foram remedidos por esta rodada**, que só toca
  `apps/api/test`, esta linha e a spec da task.
  ⚠️ **O `api` foi de 419 a 432 na T5 da fatia `painel-master-administradores`**, em 2026-09-02, e o
  delta é **13, não 6** — todo em `apps/api/test/master-administradores.e2e.spec.ts`, e a diferença
  é que **dois dos seis CTs são `it.each`**, e cada linha da tabela conta como caso: o **`CT-1226`**
  rende **5** (uma por operação do Master sobre `:id` de usuário — suspensão, reativação, correção,
  remoção e reemissão), o **`CT-1230`** rende **4** (uma por chave proibida no corpo da correção —
  `estado`, `ativo`, `perfil`, `empresaId`), e `CT-1227`, `CT-1228`, `CT-1236` e `CT-1237` rendem
  **1** cada. ⚠️ **Não "corrija" o `api` para 425**: 425 é a projeção que a task fez contando um caso
  por CT, e ela é anterior à medição. ⚠️ **Os 14 vermelhos de
  `cobertura-de-autorizacao.e2e.spec.ts` continuam sendo os MESMOS 14, no mesmo arquivo e pela mesma
  causa** — a superfície foi a **111 / 96** com as duas rotas desta task, e as três âncoras
  (`106 / 91 / 20`) sobem na T7, de uma vez. Os outros oito pacotes **não foram remedidos por esta
  task**, que só toca `apps/api` e este índice.
  ⚠️ **O `api` foi de 417 a 419 na RODADA 2 da mesma T4**, em 2026-09-02, e o delta é **2**, os dois
  no mesmo arquivo: o **`CT-1244`** (a janela declarada CHEGA AO BANCO — 3 semeados, as duas páginas
  de `limite=2`, a identidade do item da segunda pela ordenação `nome, id` e a união igual ao
  conjunto) e o **`CT-1245`** (a fronteira do teto lida da constante, `deslocamento` negativo e a
  chave desconhecida recusada pelo `strictObject`). ⚠️ **Eles nasceram do `P3` do Gate 2**, que mediu
  que nenhum dos sete casos anteriores enviava `limite` ou `deslocamento` — a janela podia estar
  **desligada** e a suíte não distinguia. O `shared` (295) e o `db` (296) foram remedidos na mesma
  rodada e **nenhum se moveu**: a constante `LINHAS_DO_INDICE_NO_FECHO_DA_FATIA` subiu a 41, e mudar
  o VALOR de uma constante que um caso já afirmava não acrescenta caso. **Não "corrija" o `api` para
  417** — é a contagem da rodada 1.
  ⚠️ **O `api` foi de 410 a 417 na T4 da fatia `painel-master-administradores`**, em 2026-09-02, e o
  delta é **7**, todo no arquivo NOVO `apps/api/test/master-administradores.e2e.spec.ts`: os **6**
  CTs da task (`CT-1220` a `CT-1225`) mais o **`CT-1220 (b)`**, que é a rede das recusas de borda —
  sem sessão, `:id` malformado, alvo inexistente e alvo de perfil fora do alcance da persona, com o
  corpo inteiro por igualdade nas quatro. ⚠️ **A `§6.3` da task lista SEIS**; o sétimo cobre a
  `§6.4` (Cenários de Erro), que não tinha CT nomeado, e a divergência é declarada. ⚠️ **O `api`
  fica VERMELHO em 14 casos de `cobertura-de-autorizacao.e2e.spec.ts` até a T7** — a superfície foi a
  **109 / 94** com as três rotas novas, e as três âncoras (`106 / 91 / 20`) sobem lá, de uma vez com
  as quatro da T5 e da T6. Os outros oito pacotes **não foram remedidos por esta task**, que só toca
  `apps/api` e o índice de débito.
  ⚠️ **O `db` foi de 291 a 296 na T2 da fatia `painel-master-administradores`**, em 2026-09-01, e o
  delta é **5**, todo em `packages/db/test/catalogo.spec.ts`, nos **dois `describe` NOVOS** das
  guardas de catálogo — cada um com instância **dedicada**, porque o `CREATE`/`DROP` dos dois casos
  negativos vazaria para `tabelasExaminadas` do `CT-300` e do `CT-009`: o `CT-1215` (o vocabulário
  de impedimentos IGUAL ao conjunto que o catálogo pode opor à remoção, por diferença de conjunto
  vazia nas duas direções), o `CT-1216` (a dependência nova acusada **por nome**), o `CT-1242` (as
  **23** tabelas de `negocio` com caminho de chave estrangeira até `identidade.empresa` por colunas
  não nulas) e as **DUAS pernas** do `CT-1243`.
  ⚠️ **A segunda perna do `CT-1243` NÃO é redundante, e a distinção é o caso**: a primeira cria uma
  tabela sem chave estrangeira nenhuma; a segunda cria uma tabela **com** a chave estrangeira para a
  empresa, por coluna **anulável** — e ela é a única que falsifica a exigência de LIGAÇÃO
  OBRIGATÓRIA. Sem ela, apagar a conferência de `attnotnull` da travessia deixaria a suíte inteira
  verde, e uma tabela com `empresa_id` anulável passaria pela guarda, que é exatamente o vetor do
  risco Crítico da fatia. **Não a colapse na primeira, e não "corrija" o `db` para 295** — é a
  contagem de antes dela.
  ⚠️ **Os outros oito pacotes foram remedidos um a um na mesma data e NENHUM se moveu**, inclusive
  os quatro que consomem o barril do `db` (`api` 410, `worker` 180, `cobranca-bancaria` 114,
  `auth` 95): a T2 só toca **comentário** no fonte de produção, promovendo ao presente a referência
  que o docblock de `IMPEDIMENTOS_DE_EXCLUSAO` fazia no futuro.
  ⚠️ **O `db` foi de 268 a 291 na T1 da fatia `painel-master-administradores`**, em 2026-09-01, e o
  delta é **23**, todo no arquivo NOVO `packages/db/test/administrador-do-master.spec.ts`: os 14 CTs
  da task (`CT-1204` a `CT-1214` e `CT-1217` a `CT-1219`), mais as **7 pernas** da `it.each` do
  `CT-1210` (uma por origem de impedimento, e não uma por caso), o **`CT-1210 (b)`** — que afirma
  que as DUAS restrições de `negocio.acesso_usuario_app` recebem a mesma classe —, o
  **`CT-1210 (c)`**, a falha FECHADA de uma dependência `23503` que o vocabulário não conhece, e o
  **`CT-1206 (b)`**, que nasceu na **rodada 2 do Gate 2**: é a rede do recorte por perfil que o `P1`
  obrigou a pôr na instrução de `encerrarSessoesDoAdministrador` — sobre um `USUARIO_EMPRESA` com 2
  sessões a função devolve `0` e a contagem crua delas continua `2`, enquanto `lerAdministrador`,
  que por decisão NÃO recorta, alcança a mesma pessoa e devolve o `perfil` que a borda usará para
  recusar. ⚠️ **Não "corrija" o delta para 22 nem o `db` para 290**: são a contagem da rodada 1,
  anteriores ao `CT-1206 (b)`.
  ⚠️ **Os outros oito pacotes foram remedidos um a um na mesma data e NENHUM se moveu**, inclusive
  os quatro que consomem o barril do `db` (`api` 410, `worker` 180, `cobranca-bancaria` 114,
  `auth` 95) e o `shared` (295), cuja barreira do protocolo acolheu a linha nova do índice de
  débito — e os cinco foram **remedidos de novo na rodada 2**, com os mesmos números.
  ⚠️ **Uma execução do `db` saiu 289 quando a contagem dele era 290** — a que falhou corria
  em paralelo com outra suíte no mesmo host, e as três seguintes foram feitas **sob a mesma
  contenção** e saíram verdes. **Não "corrija" o `db` para 289.**
  ⚠️ **O `auth` foi de 93 a 95 na correção dirigida de 2026-08-31**, e o delta é **2**, todo no
  arquivo NOVO `packages/auth/test/composicao-da-autenticacao.spec.ts`: o **`CT-1203`** em duas
  pernas — o controle antivácuo que ancora a varredura nos três pontos de composição conhecidos, e
  a igualdade que exige `origensPublicas` em **todo** ponto. ⚠️ **A segunda perna NÃO procura o nome
  no arquivo, e a distinção é o caso**: a primeira versão o fazia e **não discriminava** — o mutante
  que retirava o campo da chamada sobrevivia, porque o nome seguia escrito na guarda de ausência
  poucas linhas acima. Ela conta as chaves e afirma sobre o **bloco de argumentos**. Não a
  "simplifique" de volta para um `includes` no fonte inteiro. O `api` foi remedido na mesma data e
  **não se moveu** (410).
  ⚠️ **O `contracts` foi de 438 a 455, e o delta é 17** — todo em
  `packages/contracts/test/publicacao.spec.ts`, o arquivo NOVO que o commit `acba8bb` acrescentou ao
  preparar o pacote para o GitHub Packages (`CT-1200` a `CT-1202`, com as tabelas `it.each`
  produzindo as pernas restantes). ⚠️ **Aquele commit NÃO escriturou a contagem**, e por isso esta
  linha dizia 1987 com `contracts` 438 até 2026-08-27 — **não reponha nenhum dos dois**.
  ⚠️ **O rename do escopo para `@syslocbr/contracts`, em 2026-08-27, NÃO moveu contagem alguma**: os
  nove pacotes foram remedidos um a um, antes e depois, pelo script `test` de cada um, e os nove
  saíram idênticos caso a caso, com código `0` e `skipped`/`todo` em zero. A troca é nominal.
  ⚠️ **Os NOVE foram remedidos um a um em 2026-08-26, na T11 da fatia `publicacao-e-backup`** — o P5
  do Protocolo, comparado **caso a caso** contra a linha de base da T1 (`_run/linha-de-base.md` §2).
  **Nenhum pacote caiu**, os nove saíram com código `0`, e `skipped`/`todo` somam **zero** nos nove
  diários. O quadro completo, com o delta de cada pacote atribuído aos CTs que o produziram, está em
  `docs/specs/features/publicacao-e-backup/v1/_run/comparacao-final.md`.
  ⚠️ **A T11 levou `shared` de 276 a 295**, e o delta é **19**, todo em
  `packages/shared/test/protocolo-antirregressao.spec.ts`: **7** do `CT-1196` (a extração dos três
  eixos, as 3 pernas de igualdade e as 3 falsificações, uma por eixo) e **12** do `CT-1198` (as **6**
  pernas dos débitos fechados, as **2** dos homônimos, a contagem do índice com a prosa amarrada a
  ela, e as 3 falsificações). ⚠️ **Os dois entraram como `describe` NOVOS**: alterar os existentes é
  protegido pelo `CT-902`, que confere contagem exata. **Os outros oito não se moveram** — a T11 só
  acrescentou casos ao `shared` e escriturou documento.
  ⚠️ **A T8 da fatia `publicacao-e-backup` levou `auth` de 89 a 93**, e o delta é **4**, todo em
  `packages/auth/test/bloqueio.spec.ts`: o `CT-1167`, o `CT-1168` e as **duas pernas** do `CT-1170`
  — a declaração de `SALTOS_CONFIAVEIS` lida **na instância** e afirmada não vazia, e a perna que a
  amarra ao endereço medido na borda. ⚠️ **O `CT-1169` NÃO é um quinto caso**: ele entrou como
  **perna 4** do `CT-236 (c)`, que já existia, e perna nova em caso existente não move contagem.
  ⚠️ **O `api` foi de 409 a 410 sem que esta task o movesse**: a divergência é **anterior** a ela —
  vem da escrituração da T7 —, e os quatro arquivos de `apps/api/test/` que a T8 tocou mudaram só
  comentário. Os três foram medidos em 2026-08-26 pelo script `test` de cada pacote; o `shared`
  **não se moveu** (276).
  ⚠️ **Os NOVE foram remedidos um a um em 2026-08-26**, pelo script `test` de cada pacote, na T7 da
  fatia `publicacao-e-backup`. Dois números da linha anterior estavam defasados e **não se repõem**:
  o `api` dizia **394** (é a contagem antes desta task) e o `shared` dizia **271** (é anterior à T5
  da mesma fatia, que o levou a 276 e não escriturou). O total dizia 1943 pela soma dos dois.
  ⚠️ **A T7 levou `api` de 394 a 409**, e o delta é **15**: os **9** do bloco novo de
  `apps/api/test/ambiente.spec.ts` (o `CT-1160` em 2 pernas, o `CT-1161` em 5, o `CT-1162` e o
  `CT-1163`), os **5** do arquivo novo `apps/api/test/origem-publica.e2e.spec.ts` (`CT-1164` e
  `CT-1165` em 2 pernas cada, mais o `CT-1166`), e **1** que ninguém escreveu: a tabela do `CT-007`
  percorre `VARIAVEIS_EXIGIDAS`, de modo que `ORIGENS_PUBLICAS` passou a ser exercitada por ela
  sozinha. **Não procure o décimo quinto num arquivo novo.** Os outros oito pacotes foram remedidos
  na mesma data e **nenhum se moveu**, inclusive `auth`, cuja fábrica mudou de assinatura.
  ⚠️ **A T11 da fatia `automacoes-agendadas` levou `db` de 265 a 268**, e o delta é **3**, todo do
  `CT-1096` em `packages/db/test/cobranca.spec.ts` — a rede antirregressão da RN-14: a comportamental
  (a Cobrança lida como `VENCIDA` com `negocio.execucao_de_rotina` medida em ZERO **antes** da
  leitura), a perna estática sobre os **cinco** fontes da fatia, e a falsificação dela. ⚠️ **Ela NÃO
  vive em `derivacao-de-cobranca.spec.ts`**, que a §5.2 da task declarava: aquela suíte é **pura por
  decisão registrada** no próprio docblock (*"não há instância efêmera"*), e a perna comportamental
  exige banco — a divergência foi declarada e medida. Os outros **oito pacotes foram remedidos um a
  um em 2026-08-23, pelo script `test` de cada um, e NENHUM se moveu**, inclusive os três que
  consomem os fontes que a task tocou (`api`, `worker`, `cobranca-bancaria`): as duas escriturações
  de débito daquela task são **comentário**.
  ⚠️ **A T10 da fatia `automacoes-agendadas` levou `api` de 389 a 394**, e o delta é **5**: os quatro
  casos do arquivo novo `apps/api/test/rotinas-agendadas.e2e.spec.ts` (`CT-1091` a `CT-1094` — a
  leitura, o isolamento entre empresas, os impedimentos e o envelope de erro) mais o **`CT-1095`**,
  que é a **âncora de superfície** e vive em `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`.
  ⚠️ **Os `shared` 267 → 271 NÃO são dela**: eles vêm da T9 da mesma fatia, que rodou em paralelo e
  acrescentou um arquivo àquele pacote — as duas contagens foram medidas em 2026-08-23, uma a uma,
  pelo script `test` de cada pacote. Os outros sete pacotes **não foram remedidos por esta task** e
  nenhuma das duas a alcança.
  ⚠️ **A T8 da mesma fatia levou `worker` de 159 a 180**, e o delta é **21**, todo dele: **16** casos
  em `apps/worker/test/despachante.spec.ts` — o `CT-1075` em **5 pernas** (`it.each` sobre as cinco
  formas de despacho, que é o que prova que o filtro da enumeração vale em TODAS), o `CT-1078` em
  **3** (a comportamental, a perna estática e a falsificação dela), o **`CT-1079 (b)`** em **3** (os
  três termos lidos, a amarra entre a folga da retomada e a cadência declarada do timer, e a
  falsificação com os três mutantes), e um cada para `CT-1076`, `CT-1077`, `CT-1079`, `CT-1080` e
  `CT-1081` — mais **5** do `CT-1062` em
  `apps/worker/test/ambiente.spec.ts` (os três fontes lidos, a exceção afirmada por igualdade, o
  controle positivo das quatro agulhas e as **duas** falsificações: a do arquivo sem exceção e a que
  prova que a exceção é da **LINHA**, e não do arquivo). Os demais pacotes foram **remedidos um a um**
  em 2026-08-23 e **nenhum se moveu** — o `db` acolheu os dois símbolos novos do barril e o
  despachante em `ABRIDORES_LEGITIMOS` **sem** acrescentar caso, e o `api` não se moveu com a saída do
  marcador `D13`. ⚠️ **Não "corrija" o `worker` para 176 nem para 177**: a primeira é a contagem antes
  do `CT-1062 (c)` e a segunda é a de antes do `CT-1079 (b)`, os dois acrescentados na mesma task.
  ⚠️ **E o fecho do `P1`/`P2` do Tech Review NÃO moveu a contagem** além desses 3: a linha que nomeia a
  empresa na falha entrou como **asserção** no `CT-1076`, e a partida recusada por nome herdado do
  protótipo entrou como **sétima linha** da tabela do `CT-1077` — as duas dentro de casos que já
  existiam.
  ⚠️ **A T7 da fatia `automacoes-agendadas` levou `worker` de 154 a 159 e `cobranca-bancaria` de 108 a
  114**, e o segundo delta é **6, não 5**: os 5 casos do `CT-1087` (o expurgo por idade, a base
  ausente, o vínculo simbólico, a porta legítima e o prazo inválido) mais o **`CT-1087 (f)`**, que
  nasceu na **rodada 2 do Gate 2** — ele prova que o reconhecimento decide **por idade, nunca por
  nome**, e é a rede da propriedade sobre a qual o `D32 · F4/T9` foi fechado. **Sem ele, um filtro por
  extensão instalado no expurgo deixaria a suíte verde e os `.parcial` órfãos voltariam a acumular.**
  Não o colapse no caso principal: os dois órfãos têm idades opostas de propósito, e é o par que
  discrimina. O `db` **não** se moveu — a T7 estendeu a âncora do `CT-326` sem acrescentar caso.
  ⚠️ **O `worker` foi de 142 a 154 na T6 da fatia `automacoes-agendadas`**, e o delta é **12**: os 6
  casos do consumidor das quatro rotinas por empresa (`CT-1082` a `CT-1086`, o `CT-1083` em duas
  pernas), as **4 pernas do `CT-1089 (T6)`** — a metade de `safeParse` que a §3 da T2 delegou a esta
  task, porque `@sysloc/shared` não depende de `zod` e o `strictObject` nasce na borda — e o
  **`CT-1085 (b)`** e o **`CT-1085 (c)`**, que nasceram nos ciclos dos gates e são as **duas pernas do
  mesmo discriminador**: a repetição da tarefa refazendo a passada sobre a conferência que a ativação
  anterior deixou aberta, e a primeira ativação que encontra apuração concorrente e **não** trabalha.
  ⚠️ **Elas convivem por construção** — apagar o ramo do no-op deixava a suíte verde enquanto só a
  primeira existia; não colapse as duas em uma. **Não procure o `CT-1089 (T6)` em
  `packages/shared/test/fila.spec.ts`**: lá vivem as pernas estáticas do mesmo CT, e as duas metades
  convivem por decisão registrada. ⚠️ **As escriturações das rodadas 1, 2 e 3 diziam `worker` 148/1893,
  152/1897 e 153/1898, e as três estavam defasadas** — são anteriores aos ciclos de correção dos gates; não as
  reponha. Medidos pelo script `test` do pacote. Os demais foram **remedidos
  um a um** na **segunda intervenção dirigida de 2026-08-22** (a da conformidade do adaptador com a
  documentação do provedor), pelo script `test` de cada pacote. ⚠️ **As DUAS intervenções daquele dia
  somaram 20 casos**, e é por isso que o total saltou de 1812: a primeira acrescentou o `CT-1050`
  (`cobranca-bancaria`) e uma perna do `CT-1044` (`contracts`); a segunda, o `CT-1051` (`worker`, 3
  pernas), o `CT-1052` (`api`, 10 pernas do endereço e do contato da entrega), o `CT-1053`
  (`cobranca-bancaria`, 2) e os casos que as variáveis novas fizeram nascer nas tabelas de partida dos
  dois processos. ⚠️ **E o fecho do `D42`, no mesmo dia, acrescentou mais 8**: o `CT-1054`
  (`db` 235 → 237, o terceiro estado da entrega e a amarra que o banco impõe), o `CT-1055` (`api`
  385 → 389, o quadro de decisão da ativação linha a linha) e o `CT-1056` (`worker` 138 → 140, a
  promoção que fecha o ciclo assíncrono). Vários fechos das duas rodadas acrescentaram **asserções a
  casos existentes**, e esses não movem contagem — não "corrija" nenhum pacote para cima procurando
  os casos do `D21`, do `W1`, do `D1` ou do `D2`.
  ⚠️ **O `worker` foi de 140 a 142 na correção do flaky do `CT-1056 (b)`, em 2026-08-22, e NÃO houve
  caso novo**: o caso era um `for` sobre três leituras e virou `it.each`, de modo que **um** caso
  passou a contar como **três**. As asserções são as mesmas, uma a uma. A razão da divisão está no
  docblock de `montarConsumidor` (`apps/worker/test/reconferencia-da-entrega.spec.ts`) — chamá-lo em
  laço deixa consumidores concorrentes na mesma fila. **Não reagrupe os três num laço para "voltar"
  a 140.**
  ⚠️ **A T1 da F5 levou `cobranca-bancaria` de 93 a 100, e as tasks seguintes dela a 105;
  a T7 levou `api` de 357 a 370; a T8 levou `worker` de 126 a 132 e `api` a 371; a T10 acrescentou o
  `CT-1042` (`worker` → 133) e o `CT-1046`, e a T9 os dois casos dela — juntas, `api` de 371 a 374.**
  O total acompanha **no mesmo diff**: número narrativo que fica para trás convida a próxima task a
  "corrigir" a contagem para o valor errado.
  ⚠️ **A Fase 1 da fatia `automacoes-agendadas` (F5, fatia (ii)) somou 18, e os TRÊS deltas são
  finais** — as três tasks estão concluídas e aprovadas nos dois gates. Remedidos um a um pelo script
  `test` de cada pacote em 2026-08-23: `contracts` **425 → 438** (T1), `shared` **263 → 267** (T2) e
  `db` **237 → 238** (T3). ⚠️ **O total é 1860, e ele foi CONFERIDO somando os nove pacotes** — não
  1856: quem chegar a 1856 esqueceu os 4 do `shared`. ⚠️ **O delta do `db` é UM caso, o `CT-1073`**,
  a perna de isolamento de `negocio.execucao_de_rotina` em `packages/db/test/isolamento.spec.ts`; as
  três guardas de cobertura que a mesma task moveu (`catalogo`, `papel-de-conexao`,
  `unidade-de-trabalho`) **cresceram em asserção, não em caso** — não procure casos novos nelas.
  ⚠️ **A T4 da mesma fatia somou 12, todos no `db` (238 → 250), e o delta é FINAL** — medido pelo
  script `test` do pacote em 2026-08-23, com as suítes de `api` (389), `worker` (142) e
  `cobranca-bancaria` (108) remedidas **sem alteração** porque a task tocou fonte que elas consomem.
  São o `CT-1070` (2 casos), o `CT-1071` (1) e o `CT-1072` (1), mais as **oito pernas do `CT-1074`**
  — atraso, admissão, roster, próxima esperada, histórico recente, impedimento, recusa do provedor e
  a janela de 24 h. ⚠️ **As duas últimas nasceram na rodada 3**, no ciclo de correção do Gate 2, e é
  por isso que o `db` foi de 248 a 250: elas provam a derivação de `AVISOS_RECUSADOS_PELO_PROVEDOR`,
  que a T6 consome antes de a T10 existir. As duas âncoras que a task elevou (`CT-012`, no barril, e
  `CT-624 (b)`, no elenco que lê `identidade.empresa`) **cresceram em elenco, não em caso** — e a
  perna da borda do dia do certificado e a da precedência dos impedimentos **cresceram em asserção**.
  Não procure casos novos em nenhuma delas.
  ⚠️ **A T5 da mesma fatia somou 15, também todos no `db` (250 → 265), e o delta é FINAL** — medido
  pelo script do pacote em 2026-08-23. São **13** da suíte nova
  `packages/db/test/encerramento-de-contratos.spec.ts` (os 9 CTs `CT-1061` e `CT-1063` a `CT-1069`,
  mais o `CT-1097`, com as tabelas `it.each` produzindo as pernas restantes) e **2** do `CT-1061` em
  `packages/db/test/fonte-unica-do-estado.spec.ts` — a varredura do relógio do processo nos dois
  fontes novos do pacote e o controle que prova que ela pode falhar. **Não procure os 2 na suíte
  nova**: eles moram na guarda que a mesma task elevou.
  ⚠️ **A escrituração anterior dizia 1843 com `contracts` 425 e `shared` 263, e os três estavam
  defasados** — ela foi escrita enquanto a T1 e a T2 ainda corriam; **não a reponha.**
  ⚠️ **A linha anterior dizia `api` 370 e `worker` 126, e as duas estavam defasadas** — a T8 já as
  havia movido e a escrituração não acompanhou; não as "corrija" de volta. ⚠️ **O `api` da linha
  anterior a essa dizia 354, e antes dela 1744/1801 no total** — todos defasados pela mesma razão.
  ⚠️ **Meça por pacote** (`pnpm --filter @sysloc/<p> test`): o `turbo run test` aborta os pacotes
  irmãos e a saída agregada não é confiável.
- ⚠️ **Publicar não é construir, e o incidente `PROD-2026-09-03-01` mediu o custo disso.** Em
  2026-09-03 as **7** rotas do Painel Master responderam `404` em produção estando na árvore,
  compiladas no `dist/` e **verdes na suíte**: o processo em memória subira em **2026-08-27 16:29**
  e nunca fora substituído, enquanto o `dist/` no disco era de **2026-09-02 11:05**. ⚠️ **Não
  procure defeito no código, e não reimplemente rota alguma** — as cinco hipóteses do relatório
  foram medidas e **quatro caíram**: o módulo raiz já registrava os dois controladores (H4), não há
  migração nova, não há variável de ambiente nova, e o `pnpm build` deu **cache hit** contra o
  `HEAD`. A causa é **H5**, e o conserto foi `systemctl restart sysloc-api`. ⚠️ **A suíte não tinha
  como pegar isto, e essa é a lição**: ela prova a **árvore**, e o defeito era do **processo**. A
  rede que passou a existir é `deploy/scripts/publicacao/verificar-rotas-publicadas.sh` — 5 casos
  (`CT-1251` a `CT-1255`), sem credencial e sem efeito colateral, pelo discriminador `401` × `404`
  com controle positivo, controle de regressão e antivácuo. **Rode-a depois de todo deploy**; ela
  reprovou com o defeito real antes do reinício (7 falhas no `CT-1252`, as 7 do controle verdes),
  e saiu **5/5, zero falhas**, depois dele — A1, A2 e A3 estão em produção desde
  **2026-09-03 10:45:16**.
  ⚠️ **`502` NÃO é `404`, e confundi-los custou um diagnóstico**: na primeira execução pós-reinício
  as **3 primeiras** sondas deram `502` e foram lidas como *"o reinício não pegou"*. **Era falso, e
  a medição é conclusiva**: `NRestarts=0`, `Result=success`, e o journal registra a aplicação no ar
  **6,3 s** depois do arranque, contra o `sleep 5` do roteiro — as sondas seguintes, **todas**,
  deram `401`. A distribuição é o discriminador: falha→sucesso **monotônica** nas 3 primeiras é
  janela de arranque; intermitência real espalharia as falhas pela execução inteira. ⚠️ **E não há
  pool atrás da borda** — `/opt/web/syslocadmin/nginx/default.conf:93` é
  `proxy_pass http://127.0.0.1:3000`, endereço literal **sem bloco `upstream`**, com um processo só
  escutando: a hipótese de *"instância morta atrás de upstream com mais de um alvo"* está
  **refutada por medição**, não por argumento. A bateria passou a **aguardar a prontidão** por
  condição observada (nunca por `sleep` de valor suposto) e a tratar `502`/`503`/`504`/transporte
  como categoria própria — *"a aplicação não respondeu; isto NÃO é rota ausente"*.
  ⚠️ **A ADR-0040 nasceu daqui**: o `404` do **roteador** não fala o vocabulário de negócio.
- **F7, item 1 — a fatia `publicacao-e-backup/v1` fechou em 2026-08-26, com 11/11 tasks.** Entrega
  a cópia do banco (`pg_dump -Fc`), a preservação dos segredos em tar, a **restauração conferida em
  base vazia**, as 2 unidades do relógio das **02:45** (deslocadas do `02:30` do legado por medição —
  achado `A9` da T1), a borda pública do app e a proteção da entrada de terceiro (**ADR-0037**).
  ⚠️ **A janela assistida (b) FOI EXECUTADA em 2026-08-27, pelo operador, e NÃO se repõe como
  pendente.** `ORIGENS_PUBLICAS=https://sysloc.systera.com.br,https://syslocadmin.systera.com.br`
  está em `/etc/sysloc/backend.env` (linha 24, arquivo 600 root), e a API foi reiniciada às
  **15:34:38** — passando a executar o `dist/` de 14:25:57, que é o primeiro a **exigir** a variável.
  O worker foi reiniciado às 15:38:00 pela mesma razão. ⚠️ **Havia um descompasso latente e ele era
  grave**: o `dist/` no disco já exigia a variável enquanto os processos em memória eram de
  2026-08-25, de modo que o próximo `restart` — ou o `reboot` da janela (a) — **derrubaria a API sem
  volta**, violando o invariante 7. A conferência de origem foi medida depois, e ela **discrimina**:
  as duas origens públicas e a derivada da escuta atravessam, `http://localhost:5173` e
  `https://evil.example.com` recebem `ACESSO_NEGADO`, e requisição **sem** `Origin` atravessa — é o
  que faz teste de integração em node funcionar por túnel sem configuração.
  ⚠️ **A janela assistida (a) FOI EXECUTADA em 2026-08-27, pelo operador. NÃO sobra janela
  alguma.** As 2 unidades do backup foram posicionadas, as 12 unidades das rotinas foram
  reinstaladas com o nome novo do pacote (fecho do `D50`), e o servidor foi reiniciado às
  **16:28:56** — depois disso `verificar-unidades-agendadas.sh` saiu **8/8 casos, ZERO degradação,
  código 0**, com a asserção que só o reboot produz: *"o conjunto de pé é POSTERIOR ao último
  arranque — ele sobe sozinho"*. ⚠️ **É o invariante 7 provado com reboot REAL**, e não por
  argumento: API, worker, capturador e o relógio do backup subiram sozinhos às 16:29:18–22, sem
  comando manual. O `CT-1153` fechou no mesmo passo, com **0 envios e 0 mensagens** no intervalo
  declarado — e o total de envios de todos os tempos, medido junto, também é **0**, que é o controle
  que torna o zero conclusivo em vez de janela quieta por acaso.
  ⚠️ **A consulta do `CT-1153` estava ERRADA no roteiro e foi corrigida na execução**: ela nomeava
  `negocio.tentativa_de_envio` e `desfecho = 'entregue'`, e **nenhum dos dois existe** — a tabela é
  `negocio.envio_de_cobranca` e o enum tem `ENVIADA`/`FALHOU`/`SEM_DESTINATARIO`. Quem a rodasse
  receberia `relation does not exist` com a janela já aberta. A leitura agora é
  `deploy/scripts/publicacao/contar-envios-do-intervalo.mjs`, que lê a cadeia de conexão do
  EnvironmentFile dentro do processo. Quadro de fecho em `_run/comparacao-final.md`.
- ⚠️ **ADRs emendadas — não cite a `Decision` sem ler a emenda**: a **0001** (a cláusula do *"apenas
  uma porta"* não alcança a porta de identidade), a **0017** (o contador é a **0033**, não a 0015) e a
  **0021** (emendada **duas vezes** — a de 2026-08-10 nomeia a entidade nas classes de ato; a de
  **2026-08-22** declara o alcance de cada metade da `Decision` quando **não há requisição**: a
  categórica vale sem exceção, a de governança pressupõe sessão e não tem sujeito sem ela) e a
  **0038** (emendada em **2026-09-02**, no 2º `Cons`: o retorno ao ponto de salvamento **não** libera
  os bloqueios de **relação**, mas **libera** os de **linha** — a entrada de um administrador da
  própria página atravessa em **8 ms** com a unidade aberta, medido na T4 da fatia
  `painel-master-administradores`, com controle positivo de `55P03` após 5 014 ms contra um `DELETE`
  vivo. ⚠️ **Não reponha a frase larga**: ela superestima o custo da sonda-em-savepoint, e as duas
  outras pontas dela — o docblock de `ensaiarExclusao` em `packages/db` e o de `listar` em
  `apps/api/src/master/administrador.service.ts` — foram precisadas na mesma passada).
  ⚠️ **A 0024 também está emendada duas vezes** — ver a linha dela na tabela de leitura obrigatória.
  **Não cite como vigentes**: 0007, 0012, 0015 e 0019 — todas superseded.
- ⚠️ **Precedente de método, confirmado cinco vezes**: *prescrição de gate é hipótese, não ordem* — o
  executor que divergiu **declarando e medindo** teve razão em todas. E o corolário que custou duas
  fases: *a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que
  ela justifica* — meça a premissa antes de registrá-la.
- **Dívida**: **499 débitos abertos** — **656** blocos na §2 dos **25** `run-report.md` do
  repositório, **157** já com marca de fecho, e **23** fatias com ao menos um aberto.
  **Remedido em 2026-09-02**, na triagem de débito da fatia `painel-master-administradores`, pelo
  mesmo critério de sempre: bloco é `^### D`, fechado é o cabeçalho que carrega `✅`.
  ⚠️ **O número anterior (488 em 17 fatias, sobre 628 blocos, 140 fechados) NÃO se repõe**, e a
  diferença é **medida e integralmente explicada**: (i) ele é de 2026-08-26 e varria **24**
  relatórios, sem o desta fatia; (ii) os **+17 fechados** são exatamente os que a triagem de
  2026-09-02 fechou (`D2`, `D3`, `D4`, `D5`, `D9`, `D13`, `D15`, `D16`, `D17`, `D19`, `D20`, `D21`,
  `D26`, `D27`, `D28`, `D29`, `D30`). ⚠️ **O "17 fatias" do número antigo não é comparável ao "23"
  deste**: aquele não declarava critério de contagem de fatia, e este conta **fatia cujo relatório
  tem ao menos um bloco sem `✅`** — reproduza com
  `for f in docs/specs/features/*/*/_run/run-report.md; do grep '^### D' $f | grep -vc '✅'; done`.
  **Remedido na T11 da fatia `publicacao-e-backup`, em 2026-08-26**, varrendo os **24**
  `run-report.md` do repositório, com o critério e o comando escritos aqui para que a próxima
  medição seja reproduzível: bloco é `^### D`, e fechado é o cabeçalho que carrega `✅`.
  ⚠️ **O número anterior (407 em 14, sobre 544 blocos, 137 fechados) NÃO se repõe, e a diferença tem
  duas partes medidas**: (i) ele é de 2026-08-22 e não contempla `automacoes-agendadas` (**27**
  blocos) nem `publicacao-e-backup` (**46**); (ii) o critério dele era mais frouxo — aceitava
  `RESOLVIDO`/`FECHADO` sem `✅` — medido pelo MESMO comando do critério novo, trocando só a
  agulha (`grep -rh '^### D' docs/specs/features/*/*/_run/run-report.md | grep -cE '✅|RESOLVIDO|FECHADO'`),
  dá **147** fechados e **481** abertos. ⚠️ **O par anterior dizia 149/476 e NÃO era reproduzível**
  por comando nenhum — foi remedido em 2026-08-26. Os 8 blocos
  restantes da diferença são escrituração posterior nas demais fatias, **não reconciliada bloco a
  bloco** — quem quiser fechá-la roda o comando acima por fatia.
  ⚠️ **O número anterior (372 em 13, sobre 499 blocos) estava defasado por uma razão só**: é anterior
  à fatia `integracao-bancaria-autonoma`, que acrescentou 41 blocos. **Não o reponha.** E ⚠️ **o
  número anterior a esse (~280 em 10) estava defasado por outra**, medida em 2026-08-19: **39
  débitos já pagos registravam o fecho só no campo `Status:` do corpo**, invisíveis a quem tria pelo
  cabeçalho — todos promovidos naquela data, e **hoje são zero**; a triagem por cabeçalho voltou a
  ser confiável, e é a que estes números usam. São ~89% `BAIXO`, mas **não** "quase todos de prosa":
  por alvo são 138 de teste, 107 de produção, 87 de doc e 78 de infra. E **~167 não são pagáveis
  hoje** (72 com gatilho que não chegou, 39 mirando spec de fatia fechada, 26 dependentes de
  F5/F6/F7, 20 que mandam NÃO agir, 11 em migração imutável).
  O parecer, reafirmado **seis vezes** e medido, é **NÃO rodar `/agent-spec-debt-resolution`** sobre
  o estoque. As razões vigentes, remedidas em 2026-08-22:
  1. **A curadoria humana da skill é desligada por construção aqui.** Ela apoia a segurança na FASE 3
     — *"o especialista classifica, o usuário decide"* —, e a `autonomia-do-run.md` §A1, de escopo
     universal, manda **não invocar `AskUserQuestion` e adotar a recomendada**. A recomendada da Onda
     1 é `Incluir TODOS os recomendados`. As duas regras estão certas isoladamente; a composição
     entrega a seleção a uma LLM sem ninguém no circuito.
  2. **O `gates: [qa]` default desliga o Gate 2 onde o código é protegido**: só **15%** das tasks
     casariam Critical Path por match textual (a rule é em inglês, a árvore é pt-BR), contra **58%**
     de área realmente sensível; e **67% dos pagáveis apontam para arquivo que contém marcador
     `DECISÃO FECHADA`** — 139 deles rodariam só com QA.
  3. **A extração da FASE 1 não tem campo para gatilho nem adiamento**, e por isso os ~167 não
     pagáveis viram task assim mesmo — incluídas 11 sobre `.sql` já aplicado, cujo `sha256sum` aborta
     a instalação.
  4. **O precedente empírico é contrário**: a T4 de `integracao-bancaria-configuravel/v4-debits`
     **introduziu** um vazamento (pendente parcial com senha commitado enquanto a API dizia *"nenhuma
     alteracao foi feita"*), o QA **não tinha como pegar**, e quem pegou foi o Tech Review — ligado
     só porque aquele path casava Critical Path em inglês.
  ⚠️ **Um argumento antigo CAIU e não deve ser reposto**: o de que a skill recolheria como abertos os
  débitos fechados só no corpo. A higienização de 2026-08-19 o resolveu, e a medição de 2026-08-22
  confirma **zero** nessa condição.
  O caminho que funciona é a **intervenção dirigida**: ela responde por **57 dos 137** fechos, contra
  **21** da skill — e esses 21 são todos do repositório Frappe antigo, com suíte de 113–169 testes.
  Detalhe na §6 do `_run/run-report.md` da `fundacao-bancaria`, na §7 do da `webhook-e-carne` e na §8
  do da `integracao-bancaria-autonoma`.

---

## O ponto exato onde o trabalho deste repositório termina

**MARCO DE ENTREGA DO BACKEND.** Alcançado o marco, gera-se o handoff e **encerra-se a construção
aqui**. É a materialização da **Fronteira** declarada no topo, e a lista abaixo é a definição
operacional dela — não uma meta aproximada.

O marco está alcançado quando **todos** os sete itens forem verdadeiros:

- [x] **F1 a F5 concluídas** — **147 tasks** aprovadas nos dois gates, suíte verde (2004 casos),
      critérios de aceitação verificados. A F5 fechou em **2026-08-23**; o checkbox só foi marcado em
      **2026-08-27**, e a defasagem era de escrituração, não de fase. Estado por fase:
      `docs/plano-backend-novo/roadmap.md`
- [x] **Superfície da API congelada** desde **2026-08-23**, hoje em **113 rotas / 98 manipuladores /
      20 públicas** — a última publicada **na superfície da imobiliária** foi
      `GET /v1/automacao-de-cobranca/rotinas`, na T10 da fatia `automacoes-agendadas`. Nenhuma fatia
      posterior acrescenta, remove ou altera rota **dela**, e é isso que torna o handoff confiável.
      ⚠️ **EMENDA de 2026-09-02 (ADR-0039), com o valor anterior registrado**: o congelamento alcança
      a superfície que o `@syslocbr/contracts` entrega à imobiliária; a do **operador do SaaS** fica
      **fora** dele, e acrescentar operação ali **não reabre o marco**. As **7** rotas da fatia
      `painel-master-administradores` são todas do painel do operador, e por isso os três números
      acima subiram de `106 / 91 / 20` sem que garantia alguma dada ao cliente mudasse — as âncoras
      contam as **duas** superfícies, e é a `Cons` literal daquela ADR. ⚠️ **Os três números são
      constantes EXECUTÁVEIS** de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`, e o `CT-1196`
      afirma a igualdade entre elas e as **quatro** ocorrências normativas deste arquivo — a
      divergência fica vermelha na suíte
- [x] **`@syslocbr/contracts` publicado** — hoje na **`1.1.0`**, no GitHub Packages da organização
      `syslocbr`, **privado**, confirmado por `npm view` e pela API do GitHub
      (`"visibility": "private"`). É o artefato que o React importa para trocar tipos (Zod;
      ⚠️ **não** há cliente ts-rest — ver a nota da Stack).
      ⚠️ **A `1.0.0` é de 2026-08-27 e a `1.1.0` de 2026-09-05**, esta última na intervenção dos
      **recortes de listagem**: as duas convivem no registry, e o acréscimo é **aditivo** — três
      símbolos novos (`esquemaDoContratoNaCarteira`, `esquemaDaJanelaDeContratos`,
      `esquemaDaJanelaDeImoveis`) e dois campos opcionais em `JanelaDeCobrancas`. Nenhum símbolo foi
      renomeado ou removido, e `Contrato` continua sendo o que as outras sete rotas de contrato
      devolvem. ⚠️ **Publicar não é construir**: a paridade entre o registry e a árvore só valeu
      depois do `pnpm build` **e** do `systemctl restart sysloc-api` daquela data — o processo em
      memória era de **2026-09-03 10:45:16** e o `dist/` de **2026-09-05 15:52:20**, e o documento
      servido por ele ainda descrevia o item da carteira com **14** campos. Medido antes e depois no
      mesmo processo (14 → **17** campos, e as três descrições passando a nomear os seis parâmetros),
      com o reinício às **15:53:57**, `Result=success`, `NRestarts=0`, e
      `verificar-rotas-publicadas.sh` em **5/5 casos, zero falhas**.
      ⚠️ **O escopo é `@syslocbr`, e NÃO `@sysloc`** — o GitHub Packages exige que o escopo case com
      o login do dono, e `sysloc` pertence a **conta pessoal de terceiro criada em 2019**, medido por
      API em 2026-08-27 (`api.github.com/users/sysloc` → 200). Não existe organização `sysloc` a
      criar; a saída planejada foi **refutada por medição**, e o rename alcançou **164 arquivos**.
      ⚠️ **Só ESTE pacote mudou de escopo.** `@sysloc/db`, `@sysloc/auth`, `@sysloc/shared` e os
      demais membros nunca vão a registry algum — são resolvidos por `workspace:*` — e seguem em
      `@sysloc`. **Não os "corrija".** O roteiro literal, com a tabela das saídas medidas e o que
      refazer se a org for perdida, está em `deploy/scripts/publicacao/publicar-contracts.md`
- [x] **`handoff-frontend.md` gerado** em 2026-08-24 — `docs/plano-backend-novo/handoff-frontend.md`,
      **3755 linhas**, medido contra a superfície **já congelada**. Carrega o modelo de domínio
      camelCase, o envelope de erro da **ADR-0017** com os **11 códigos**, a autenticação por sessão,
      a sessão gorda com `versaoPermissoes`, o catálogo 10×7 que gera o menu, o contrato das **81
      rotas de tela** uma a uma, seção dedicada ao **Habilitar webhook** e o **mapa
      endpoint-a-endpoint** dos 35 caminhos ERPNext. Cobre a §2 **e a §8** de
      `levantamento-frontend.md` — as 8 áreas sem correspondente no legado entraram com contrato
      completo, e as 10 decisões de comportamento viraram seção própria.
      ⚠️ **As §0 a §18 foram escritas à mão, por decisão expressa do usuário, SEM a skill
      `/agent-spec-backend-contract-handoff`** — não existe `_run/` delas, e não é omissão.
      ⚠️ **As §19 a §23 são de 2026-08-24 e SÃO da skill**, invocada pelo usuário sobre o documento
      pronto: a matriz de estados de tela (§19), **90 fixtures** JSON (§20), 44 testes mínimos (§21),
      as duas `[HIPÓTESE]` e as **quatro precisões** que a auditoria acrescentou (§22) e a procedência
      da ampliação (§23). ⚠️ **A ampliação é ADITIVA — o diff não remove uma linha sequer**, e a única
      alteração fora dela são 4 linhas novas no mapa de leitura da §0. **A auditoria de drift daquela
      passagem não achou divergência alguma** entre o documento e o código: 91 manipuladores
      extraídos dos decoradores, iguais à constante executável; 11 códigos de erro; catálogo 10×7;
      `MAIOR_PAGINA`/`PAGINA_PADRAO` em 200/50. ⚠️ **Os números desta frase são a MEDIÇÃO DE
      2026-08-24 e NÃO se reescrevem**: ela é registro histórico do que a auditoria daquela data
      encontrou, e não ocorrência normativa da superfície corrente — atualizar `91` para o valor de
      hoje apagaria o registro de que documento e código **coincidiam** naquele momento. A superfície
      corrente vive no bullet `Superfície` do `Estado atual`, que é o que o `CT-1196` amarra às
      constantes executáveis. ⚠️ **As quatro precisões da §22.4 são de campo de
      envelope, não de rota**: o `422` de ação sem área é `campo: "permissoes"` (não `"ajustes"`), o
      de perfil com ajustes a perder é `campo: "perfil"`, o de auto-alvo é `campo: "id"`, e **429 não
      existe em rota de negócio nem na rota pública** — só sob `/v1/auth` e em `POST /v1/sessao/senha`.
      ⚠️ **O campo da sessão é `versaoPermissoes` (camelCase)**: esta linha escreveu
      `versao_permissoes` até 2026-08-24, e o snake_case foi refutado por medição em
      `apps/api/src/autenticacao/sessao.controller.ts`. Não o reponha
- [x] **`handoff-master-frontend.md` gerado** em 2026-08-21 — o Painel Master é **aplicativo
      separado** (`syslocadmin.systera.com.br`, build próprio), o backend dele está **completo** (6
      rotas), e o handoff é autossuficiente. ⚠️ O handoff do Sysloc apenas **menciona** que ele
      existe e está pronto; não mistura as telas
- [x] **Backup e restauração entregues e provados** — item 1 da F7, **fechado em 2026-08-27** na
      janela assistida (a), executada pelo operador. O código já estava entregue e provado pela
      fatia `publicacao-e-backup/v1` (11/11 tasks, 2026-08-26): a restauração que REPRODUZ a origem
      é o `CT-1107`, com o destino medido em ZERO antes, e a bateria `verificar-backup.sh` fecha em
      **408 asserções / 24 casos**. O que faltava era de host, e caiu:
      `sysloc-backup-da-base.service` (`static`) e `.timer` (`enabled`) estão posicionadas, e
      `verificar-unidades-agendadas.sh` saiu **8/8 casos, ZERO degradação, código 0**.
      ⚠️ **O horário é `02:45`, não `02:30`** — deslocado por medição do achado `A9` (o legado ocupa
      `02:30` na `crontab` do root, mesmo volume)
- [x] **`deploy/scripts/virada.md` escrito** em **2026-08-27** (commit `5709c5f`, **195 linhas**),
      com o gate de desinstalação de 5 itens, o inventário medido do legado, a ordem dos passos da
      virada e as armadilhas de `docker` medidas neste host. ⚠️ **Escrever é deste marco; EXECUTAR
      não** — a virada é sessão operacional futura, e depende do frontend pronto
- [x] **`/opt/frappe` intacto e de pé** — medido em 2026-08-27: diretório presente e 6 contêineres
      ativos. ⚠️ **É condição preservada, não tarefa cumprida**: o item está marcado porque nada
      deste marco o tocou, e a virada não acontece aqui

### O que **não** se faz aqui, em nenhuma hipótese

Nenhum código React. Nenhum arquivo na máquina local do usuário. Nenhum dos ~100 arquivos de
religação, vazamento, fluxo ou teste que a F6 dimensiona. Os 4 specs Playwright **rodam na máquina
local**, não aqui. Roteiro por arquivo do fonte React também não: **este servidor não tem o fonte**,
e escrever sobre código que não se pode ler é adivinhação com aparência de spec.

### O que fica para depois do marco

A **execução** da virada e a **desinstalação** do Frappe. As duas só podem acontecer neste servidor
— é onde o `/opt/frappe` e o CloudPanel existem —, e as duas exigem o frontend já funcionando, pois
o primeiro critério de aceitação da F7 é *"app funcionando integralmente contra o backend novo"*.

Serão uma **sessão operacional futura** neste servidor, conduzida pelo runbook, nos moldes da janela
de reinício da F0: horas, não dias; operação, não construção. **Isso não reabre a construção do
backend** — defeito encontrado na virada se corrige como correção, não como fatia nova.

---

## ⚠️ Leitura obrigatória antes de qualquer implementação

Nesta ordem. **Nenhum destes é dispensável** — o plano de execução referencia decisões apenas
pelo número, e sem os dois arquivos de `.claude/plans/` essas referências ficam sem conteúdo.

| # | Arquivo | O que carrega |
|---|---|---|
| 1 | `docs/plano-backend-novo/decisao-e-stack.md` | A decisão, a **stack completa** com justificativas, o layout do monorepo, a estratégia de compatibilidade com o frontend, o inventário do que porta e do que morre, o destino das ADRs |
| 2 | `docs/plano-backend-novo/plano-execucao.md` | As **8 fases** (F0–F7), entregas e critérios de aceitação executáveis |
| 2b | `docs/plano-backend-novo/roadmap.md` | **Onde estamos** — o que cada fase é, em que fatias ela se parte e o estado de cada uma. O painel é **gerado** por `deploy/scripts/roadmap/atualizar-roadmap.sh` e um gancho `PostToolUse` o roda sozinho quando um `_run/*state.yaml` muda; **não edite o que está entre marcadores** |
| 3 | `.claude/plans/plano-saas-decisoes.md` | As **40 decisões fechadas** — o plano de execução as cita por número |
| 4 | `.claude/plans/plano-saas.md` | Arquitetura-alvo, os 3 perfis, as **10 telas × 7 ações sensíveis**, a especificação do webhook Sicoob |
| 5 | `docs/plano-backend-novo/levantamento-frontend.md` | O frontend React: inventário dos **35 endpoints**, o **modelo de domínio que a API deve falar**, os acoplamentos a remover |
| 6 | `docs/adr/` | ADRs. **40 registradas, 33 `accepted`** (remedido em **2026-09-03**, na correção dirigida do incidente `PROD-2026-09-03-01`, contando o campo `status:` de cada arquivo — 3 `deprecated`, 4 `superseded`; o número anterior — 39/32, de 2026-09-02 — é anterior à **0040**, nascida daquele incidente; o anterior a esse — 37/30, de 2026-08-26 — é anterior à **0038** e à **0039**, as duas nascidas na fatia `painel-master-administradores`; e o anterior a esse — 36/29, de 2026-08-22 — é anterior à **0037**, que nasceu na T10 da fatia `publicacao-e-backup` e é a política de limitação de abuso na borda pública): 0001, 0005, 0006, 0008, 0009, 0010, 0011, 0013, 0014, 0016, 0017, 0018, 0020, 0021, 0022, 0023, 0024, 0025, 0026, 0027, 0028, 0029, 0030, 0031, 0032, 0033, **0034** (o que o provedor informou consta como diagnóstico, e a trilha registra efeito ou anomalia com vocabulário do produto), **0035** (o critério que autoriza uma rota de entrada de fato de terceiro sem sessão) e **0036** (material legado que o runtime recusa é convertido por processo externo na borda de registro, e é isso que torna o percurso do cliente novo possível pela tela) e **0037** (a borda pública declara teto de concorrência por endereço de origem; o teto de **taxa** é decisão por vhost, e o da notícia bancária o dispensa por medição — o eixo de origem do provedor é um endereço só, e o mesmo teto que barra o abuso descartaria a rajada legítima) e **0038** (a exclusão de entidade de **identidade** é física e condicionada a não haver registro que dela dependa; a exclusão lógica da ADR-0014 alcança o cadastro de negócio, e não esta) e **0039** (o congelamento da superfície publicada alcança **a superfície que o pacote de contratos entrega à aplicação da imobiliária**; a do **operador do SaaS** fica fora dele, e acrescentar operação ali não reabre o marco — ⚠️ mas *"as asserções que fixam o tamanho da superfície contam **todas** as operações publicadas, das duas superfícies"*, de modo que elas **se movem** quando só o painel do operador cresce, e a contagem narrada sobe no mesmo passo) e **0040** (o direito de usar o vocabulário de recusa de **negócio** é do domínio, nunca do **roteador**: caminho ou método sem correspondência responde `REQUISICAO_RECUSADA` com o status de origem preservado, e o discriminador é a **ausência de rota casada** — ⚠️ o envelope da 0017 **não muda**, a chave `codigo` continua presente e **nenhum** código é acrescentado ao vocabulário; ⚠️ e o `404` de um componente que **casou** rota, como o encaminhador de `/v1/auth`, **continua** `RECURSO_NAO_ENCONTRADO` — a fronteira é *casou rota*, não *é do domínio*). **Vinculantes para a F2**: 0006, 0008, 0009, 0011, 0013, 0014, 0016, 0017, 0018, 0020, 0021 e 0033. **Vinculantes para a sub-fatia 2b da F3**: 0008, 0011, 0016, 0017, 0018, 0021, 0022, 0023, 0024, 0025 e 0026, mais as **quatro que nasceram dela** — a **0027** (uma rota de negócio dispensa sessão só quando o ato é do titular do dado, e sempre com portador de segredo), a **0028** (a rota que devolve bytes permanece no contrato, declarando mídia, nome do arquivo e o mesmo envelope de erro), a **0029** (efeito externo cujo resultado não compõe a resposta sai por fila, nunca em linha na borda) e a **0030** (artefato derivado de dado gravado é composto sob demanda e nunca armazenado — com **cláusula de exclusão**: fato recebido de terceiro, como o boleto do provedor, não é derivado e está fora do alcance dela). As **0002, 0003 e 0004** morreram com o Frappe — `deprecated` desde 2026-08-04, porque nomeiam primitivas dele (DocType, fixture, `Custom DocPerm`, Server Script). Há **três cadeias de supersede**, e nas três só a última se cita: a forma canônica do contrato da API é **0007 → 0012 → 0017**, vigente a **0017** (três classes de chave exposta: código legível quando há série declarada, UUID quando não há); a transição de estado é **0019 → 0021**, vigente a **0021** (rota própria sempre; a chave de ação só quando o ato é sensível — atributo operacional do cadastro exige apenas a área); e a política de série sequencial é **0015 → 0033**, vigente a **0033** desde 2026-08-14 (**cada série declara o próprio escopo** — contrato e cobrança em `(empresa, ano)`, o identificador perante o provedor pelo **SaaS** —, com furo aceito e número nunca reusado). ⚠️ **A 0033 nasceu de um conflito que o challenge da `fundacao-bancaria` pegou ao abrir a `Decision`**: a 0015 abria com *"todo contador sequencial deste produto é único por empresa"*, quantificador universal que o contador bancário falsifica. **Não cite a 0015 como vigente, e não "corrija" o contador para ser por empresa.** A **0020** segue vigente e é complementar, não concorrente: a 0033 fixa o *escopo*, a 0020 o *mecanismo*. **Vinculantes para a fatia (i) da F4** (`fundacao-bancaria`): 0001, 0005, 0006, 0008, 0009, 0011, 0013, 0016, 0017, 0018, 0025, 0026 e 0029, mais as **três que nasceram dela** — a **0031** (tabela sem dono-empresa vive em schema próprio da plataforma, sem `empresa_id`), a **0032** (segredo operável de terceiro é cifrado de forma reversível, nunca retorna por superfície alguma, e a ausência de vazamento se prova **por medição da saída real**) e a **0033**. ⚠️ **A ADR-0001 foi EMENDADA em 2026-08-15** (texto original preservado byte a byte), porque a cláusula do *"apenas"* uma porta ficara incompleta diante da porta de **identidade** — que é ato de configuração, não de cobrança; a emenda ataca o **contorno por renomeação**, e não a contagem de portas. ⚠️ **E foi EMENDADA DE NOVO em 2026-08-17**, também com o texto original preservado: a porta que ela reserva nasce com **quatro** operações, e não cinco — a obtenção da credencial de acesso é `client_credentials`, **vocabulário do provedor**, e acontece **dentro** do adaptador (decisão do usuário de 2026-08-16, §21.1(1) do tech spec da fatia `emissao-e-conciliacao`). O **roster de cinco capacidades não encolheu**; o que se conta em quatro é a superfície da interface. **Não "corrija" a porta para cinco. Não cite a `Decision` dela sem ler as DUAS emendas.** ⚠️ **A ADR-0017 foi EMENDADA em 2026-08-16**, também com o texto original preservado: a `Decision` dela remetia o contador à **ADR-0015**, morta desde 2026-08-14 — leia ali `ADR-0033`. A substituição já constava do `Consequences → Neutros` da própria 0017, e a emenda existe porque **é a `Decision` que se abre ao citar**, de modo que a correção estava no lugar onde o leitor de uma citação não passa. **Não cite a `Decision` dela sem ler a emenda.** ⚠️ **A ADR-0024 foi EMENDADA DUAS VEZES** — em 2026-08-13 e em **2026-08-18** —, as duas com o texto original preservado byte a byte, e a de 2026-08-18 é a **terceira ocorrência desta classe no repositório** (depois da ADR-0021 e da própria 0024 em 2026-08-13): a de **2026-08-13** declara as **duas** leituras legítimas sem contexto de empresa e o discriminador que separa uma delas de um contorno do isolamento (função `SECURITY DEFINER` de papel `NOLOGIN` de propósito único, política nominal, `GRANT` mínimo, `EXECUTE` revogado de `PUBLIC` e a função **sem parâmetro de empresa**); a de **2026-08-18** declara o **alcance da cláusula da carga** — ela leva o identificador de empresa quando **quem enfileirou já detinha direito a ele** (toda fila anterior a ela, e nada nelas muda), e na **entrada de fato de terceiro** (ADR-0035) a empresa é o **resultado** da travessia nominal, de modo que o campo **não existe** na carga. Pôr `empresaId` na carga da entrada de terceiro seria **violação, não conformidade**: o único valor disponível na borda viria do recebido. **Não "corrija" a carga da fila do webhook para levar empresa. Não cite a `Decision` dela sem ler as DUAS emendas.** ⚠️ **Citar ADR exige abrir a `Decision`** — esta linha e o `INDEX.md` são paráfrases, e já divergiram do texto real |

Por fase: a **F4** exige `docs/specs/features/integracao-bancaria-configuravel/`; a **F6** exige
o levantamento do frontend (item 5).

**O critério que separa a ADR que morre da que sobrevive é o substrato.** A 0002, a 0003 e a 0004
nomeiam primitivas do Frappe — DocType, fixture, `Custom DocPerm`, `Server Script` — e vão junto com
elas. A 0004 entrou nesse conjunto em 2026-08-04, por aplicação do mesmo critério: a `Decision` dela
preserva nomes curtos de endpoints herdados de Server Script por aliases registrados no app, e nada
disso existe fora do Frappe. A 0006 não nomeia
mecanismo nenhum: a decisão é *"a suíte de verificação nunca executa contra o ambiente que atende a
operação; qual ambiente concreto cumpre o papel varia ao longo do tempo — o invariante é a separação,
não um servidor específico"*, e uma das alternativas que ela rejeita **antecipa literalmente esta
migração**. Ela é o que a **T4 da F0 materializa** (instâncias efêmeras próprias, `embedded-postgres`)
e o que impede a suíte de tocar o banco que opera enquanto `/opt/frappe` seguir de pé. Não superseder:
uma ADR nova com a mesma decisão seria churn.

---

## Stack

Detalhe e justificativa em `decisao-e-stack.md` §4. Resumo:

**Node 24.18.1 · TypeScript strict · NestJS 11 + Fastify 5 · Drizzle + drizzle-kit + postgres.js ·
PostgreSQL 18 · Zod 4 · better-auth · BullMQ + ioredis + Redis 7 · nodemailer · Pino ·
Vitest + embedded-postgres · pnpm 11 + Turborepo + Biome + mise + mprocs**

Específicos deste domínio: **`node:https`** (o mTLS do Sicoob — ⚠️ o cliente é o **nativo**, e o
`undici` foi **avaliado e recusado**; a razão está no docblock de `adaptador-sicoob.ts`),
**`node:crypto` `X509Certificate`** (leitura de `.pfx`), **@react-pdf/renderer** (contrato e carnê),
**systemd timers** (agendamento).

> ⚠️ **A stack acima é a MEDIDA, e diverge da planejada.** `decisao-e-stack.md` §4 ainda lista
> **ts-rest**, **OpenTelemetry**, **tsup**, **pdf-lib** e **undici** — nenhum deles existe hoje nos
> manifests, no `.mise.toml` ou em `import` de `src/`. Não os cite como se estivessem instalados, e
> não os introduza sem decisão: o pacote de contratos é Zod puro, e o `@syslocbr/contracts` que o
> frontend importa **não** publica cliente ts-rest.

---

## Invariantes — não negociáveis

> **Invariante 0 — nada regride.** O Protocolo Antirregressão (`.claude/rules/nao-regressao.md`) é
> pré-condição de toda edição e vale para todo agente e subagente. Os oito invariantes abaixo dizem
> *o que* o sistema tem de ser; o invariante 0 diz que **nenhum deles pode ser desfeito por uma
> correção posterior** — inclusive os que já custaram rodadas de gate para serem estabelecidos.

1. **Multi-tenancy é fundação, não retrofit.** Toda tabela de negócio nasce com `empresa_id`,
   **RLS habilitada** (`USING` e `WITH CHECK`) e **FK composta `(id, empresa_id)`**. Referência
   cross-tenant é impossível pelo banco, não impedida por validação de aplicação.
2. **O contexto de tenant nunca é lido do request.** `AsyncLocalStorage` + `SET LOCAL
   app.empresa_id` por transação.
3. **Nenhum segredo versionado.** Certificado `.pfx`, senha de banco e chave de cifra vivem fora
   do repositório (`EnvironmentFile` 0600). O `.gitignore` barra `.env`, `*.pfx`, `secrets/`.
4. **Dinheiro em `numeric(15,2)`**, nunca float.
5. **IDs textuais legíveis** (`CTR-2026-00001` — **cinco** dígitos) preservados — o frontend os exibe
   como título de contrato, label de select e campo "Identificador". Chave interna é UUID; o código
   legível é coluna própria, única por empresa.
   > **A largura é cinco, e este texto já disse quatro.** O valor é **medido** no sistema antigo
   > (`autoname` = `CTR-.YYYY.-.#####`, série viva em 20), e a divergência foi descoberta ao ler o
   > dado em vez de estimar. O `plano-execucao.md` §F2 **ainda escreve quatro** — corrigi-lo não
   > pertence a nenhuma fatia aberta, e a proteção local é o marcador `DECISÃO FECHADA` no ponto do
   > código que fixa o formato (`packages/contracts/src/contrato.ts`, a partir da T2 da fatia
   > `contratos-de-locacao`). Não "corrija" para quatro.
6. **A API fala o modelo de domínio camelCase** que o frontend já usa internamente
   (`levantamento-frontend.md` §6) — não o formato do Frappe.
7. **Tudo sobe sozinho após reboot.** Unit systemd por serviço, `Restart=always`,
   `Persistent=true` nos timers. É critério de aceitação da F0, testado com `reboot` real.
8. **Redis com AOF ligado** — ele guarda a fila do BullMQ, não só cache.

---

## Convenções

- **Testes**: Vitest com `embedded-postgres` (Postgres real e efêmero). A convenção de
  rastreabilidade `CA-xx → CT-xxx (RN-xx)` com seção de INVARIANTES por arquivo vem do backend
  antigo e **deve ser mantida**. A stack de teste completa — as duas frentes (shell e Vitest),
  fronteiras de execução real e a **prova de falsificação obrigatória** — está em
  `.claude/rules/testing-stack.md`.
- **Antirregressão**: `.claude/rules/nao-regressao.md`. Ao fechar um defeito que já tinha voltado,
  ou que um gate rejeitou duas vezes, deixe no ponto do código o marcador **`DECISÃO FECHADA`** com
  os campos `O QUÊ` / `POR QUÊ` / `REVERTER EXIGE`. É o que impede a rodada seguinte de reabrir o
  que você acabou de fechar. O marcador **irmão e oposto** é o **`DÉBITO COM GATILHO`** (§3-B da
  mesma rule): não protege, **agenda** — ver o bloco abaixo.
- **Limiar de três.** Ao **terceiro** consumidor, o símbolo duplicado sobe para casa compartilhada
  em vez de ganhar a terceira cópia. Por quê: com duas cópias, endurecer uma deixa a outra para
  trás; com três, elas já divergiram — a terceira cópia de `CODIGO_NO_ASSUNTO` nasceu com a flag
  `u` diferente das anteriores. É o gatilho que os débitos deste repositório já usam de fato
  (D1, D26, D3), e escrevê-lo evita que cada fatia o redecida.
- **Acessório de suíte se importa, não se copia.** Antes de escrever num arquivo de teste um
  acessório de arranjo — cliente HTTP, entrada de sessão, montador de corpo, abertura de instância
  efêmera —, procure a casa compartilhada do diretório (os `.ts` sem `.spec` ao lado, no molde de
  `apps/api/test/documento.ts` e `base32.ts`): se existir, importe; se não existir, crie-a. Por quê:
  o Limiar de Três acima pressupõe que **quem duplica sabe contar as cópias**, e quem escreve uma
  suíte nova copia de **uma** vizinha — para ele é a segunda cópia, nunca a enésima, e o gatilho
  nunca dispara. É o que fez o cliente HTTP e a entrada de sessão nascerem em quase toda suíte de
  borda, cada cópia livre para divergir.
  ✅ `import { pedir, entrar } from './acessorios-de-borda.ts';`
  ❌ redeclarar `async function pedir(...)` no topo da suíte nova porque a vizinha também o declara
- **Superfície publicada**: `.claude/rules/ancoras-de-superficie.md` — igualdade de conjunto com
  controle antivácuo, âncora no mesmo diff da publicação, e a §5.2 declarando o que vai crescer.
- **Contrato publicado**: `.claude/rules/contrato-publicado.md` — entrada fechada
  (`z.strictObject`), saída aberta (`z.object`); a direção decide a estritude.
- **Autonomia do run**: `.claude/rules/autonomia-do-run.md` — autorização **permanente** do usuário,
  de escopo universal como o Protocolo Antirregressão. Nenhum agente pausa aguardando resposta (a
  resposta é **sempre a opção recomendada**, e quem decide registra a recomendação e a razão), o
  limite de 3 tentativas **não** bloqueia o run, e o relatório de fecho de uma task é seguido, **na
  mesma resposta**, pelo despacho da próxima. Só não revoga o *dever de escalar* de `DECISÃO
  FECHADA`/ADR: ali o que cai é a **espera**, nunca o rigor — e a recomendada é sempre a conservadora.
- **Lint/format**: Biome. Sem ESLint, sem Prettier.
- **Commits**: Conventional Commits em pt-BR — ver a skill `agent-spec-semantic-commit`.
- **Specs**: o framework agent-spec está em `.claude/` (37 skills, 10 rules, 4 agents). Features
  novas seguem o pipeline SDD/miniSpec/TaskCard com os gates de QA e Tech Review.

---

## Débitos com gatilho ativo

> **Bloco derivado e transitório** — espelha os marcadores `DÉBITO COM GATILHO` que existem hoje no
> código (`.claude/rules/nao-regressao.md` §3-B). Fechou um débito? Remova o marcador **e** a linha
> daqui. Removeu o último marcador? **Apague este bloco inteiro.** A condição é verificável:
>
> ```bash
> # vazio ⇒ este bloco não deve mais existir (o `dist/` é build e espelharia o fonte)
> grep -rl --exclude-dir=dist "DÉBITO COM GATILHO" apps packages deploy
> ```

São **44**, e a tabela abaixo é a lista viva — ela, e não este parágrafo, é a fonte.

⚠️ **O identificador é o par `Dnn · F{n}/{origem}`, nunca o número sozinho** — a sequência corre
dentro da §2 da fatia que registrou cada débito. Hoje convivem **dois `D1`**, **TRÊS `D3`**, **QUATRO
`D12`**, **dois `D37`**, **dois `D40`**, **dois `D43`** e **dois `D49`**, todos legítimos e todos
débitos diferentes. ⚠️ **O terceiro `D3` nasceu em 2026-09-02**, na triagem de débito da fatia
`painel-master-administradores` (origem **T2**) — não o confunda com o `D3 · F2/T1`
(`cadastro-de-imoveis-e-pessoas`) nem com o `D3 · F3/T1` (`regua-de-cobranca`). ⚠️ **O quarto `D12`
nasceu em 2026-09-02**, na rodada 2 da T4 da fatia
`painel-master-administradores` — não o confunda com o `D12 · F3/T4` (`regua-de-cobranca`), o
`D12 · F3/T10` (`documentos-e-confirmacao`) nem o `D12 · F5/T6` (`automacoes-agendadas`). ⚠️ **O par de `D1` nasceu em 2026-09-01**, com a T1 da fatia
`painel-master-administradores`: as duas fatias que o carregam são de fases diferentes (`F5` e
`F7`), e é a origem — nunca o número — que as separa.
⚠️ **A lista acima foi REMEDIDA em 2026-08-23** contra a tabela abaixo, e a anterior estava
defasada nos dois sentidos: ela citava `D28`, que tem uma entrada só desde sempre, e omitia `D23` e
`D43`. **Não reponha o `D28`.**
⚠️ **Os DOIS `D27` deixaram esta lista em 2026-08-26, e nenhum dos dois se repõe.** O da F1/T6 saiu
com a T8 da fatia `publicacao-e-backup`: `packages/auth/src/autenticacao.ts` passou a declarar
`SALTOS_CONFIAVEIS` em `advanced.ipAddress` a partir do endereço **medido** na borda que já opera, e
a chave do limitador deixou de ser uma só por caminho para o produto inteiro — a rede permanente é o
`CT-1167`, o `CT-1168` e o `CT-1170`, mais a perna 4 do `CT-236 (c)` (`CT-1169`), todos em
`packages/auth/test/bloqueio.spec.ts`. O da F4/T11 saiu com a **T10** da mesma fatia, aplicando a
**ADR-0037** à borda da notícia bancária: `deploy/nginx/sysloc-notificacao-bancaria.conf` passou a
declarar `limit_conn_zone`/`limit_conn` por endereço de origem, e **continua sem teto de taxa** —
a ausência é decisão, não esquecimento, e virou asserção. ⚠️ **Não instale `limit_req` naquele
vhost**: o eixo de origem do provedor é um endereço só, e o mesmo teto que barra o abuso descarta a
rajada legítima. A rede permanente são o `CT-1191` (a rajada de 30 que atravessa inteira), o
`CT-1192` (o par de fronteira 65 536 / 65 537), o `CT-1193` (a família `limit_req` com contagem
ZERO, com prova de falsificação nos dois mutantes) e o `CT-1194` (o par simultâneo/sequencial),
todos em `deploy/scripts/borda/verificar-notificacao-bancaria.sh`.
⚠️ **O `D24 · F1/T5` e o `D39 · F7/T8` deixaram esta lista em 2026-08-26**, com o fecho pela T9 da
fatia `publicacao-e-backup`. O primeiro fechou **NA BORDA**: `deploy/nginx/sysloc-app.conf` recusa
`/docs`, `/docs/json` e `/docs-yaml` antes de qualquer repasse, e `apps/api/src/main.ts` **continua
registrando os três** — restringir na aplicação derrubaria as 8 rotas `GET /docs*` das **113** da
âncora de superfície e reprovaria `verificar-fundacao.sh`. ⚠️ **O total dizia `106` até 2026-09-02**,
e ele subiu com as 7 rotas do painel do operador (T7 da fatia `painel-master-administradores`,
ADR-0039); o que **não** mudou são as 8 rotas de documentação, nem o fato de a restrição viver na
borda. O segundo fechou porque a borda que
faltava passou a **apensar** `$proxy_add_x_forwarded_for`. **Não reponha nenhum dos dois**, e não
"corrija" a restrição do contrato para a aplicação. A rede permanente são o `CT-1182`, o `CT-1183`,
o `CT-1187` e o `CT-1188`, todos em `deploy/scripts/borda/verificar-borda-do-app.sh`.
⚠️ **O `D23 · F1/T8` deixou esta lista em 2026-08-26**, com o fecho pela T7 da fatia
`publicacao-e-backup`: `ORIGENS_PUBLICAS` passou a ser variável exigida na partida, e a origem
confiável deixou de derivar só do endereço de escuta. Sobrou o `D23 · F0/T3`
(`fundacao-stack-nativa`), sozinho — o par repetido acabou, e a lista de homônimos acima já não o
cita. **Não o reponha.** O paliativo de tradução de origem saiu de
`/opt/web/syslocadmin/nginx/default.conf` no mesmo passo.
⚠️ **O `D9` deixou esta lista em 2026-08-26**, com o fecho do `D9 · F0/T2`
(`fundacao-stack-nativa`) pela T5 da fatia `publicacao-e-backup`: as **12** baterias passaram a
carregar `deploy/scripts/verificacao/esqueleto-de-assercao.sh` por `source`, e cada símbolo do
vocabulário tem **uma** definição. ⚠️ **O `QUANDO FECHA` dele dizia que só 2 das 10 rodavam sem
privilégio, e a medição de 2026-08-26 refutou os dois números**: são **12** baterias e **9** rodam sem
privilégio — as 9 foram executadas antes e depois, uma a uma, com contagem idêntica. **Não reponha a
linha.** A rede permanente é o `CT-1125` (a auditoria do esqueleto) mais o `CT-1126` (a tabela
`bateria → casos` medida antes da extração), os dois em `deploy/scripts/backup/verificar-backup.sh`.
⚠️ **O `D26` deixou esta lista em 2026-08-23**, com o fecho do `D26 · F4/T9` pela T7 da fatia
`automacoes-agendadas` — sobrou o `D26 · F3/T8` (`cobranca-e-mora`), sozinho. **Não o reponha.**
⚠️ **O `D13` deixou esta lista em 2026-08-23**, com o fecho do `D13 · F4/T6` (`webhook-e-carne`) pela
T8 da mesma fatia: a rotina `RETOMADA_DE_NOTICIAS` é quem reprocessa a notícia parada em `RECEBIDO`.
Sobrou o `D13 · F4/T6` (`emissao-e-conciliacao`), sozinho — ele era a outra metade do **primeiro par
INTEIRO repetido** do repositório, e o que os separava era só o caminho do `ÍNDICE`, como a §3-B
prevê. **Não reponha o de `webhook-e-carne`.**
⚠️ **O `D12` passou a TER TRÊS entradas em 2026-08-23**, com a emissão do `D12 · F5/T6`
(`automacoes-agendadas`) pela T11: ele é a **metade (b)** do achado da T6 — a conferência bancária
abandonada por esgotamento das repetições —, e nasceu como marcador porque a T11 **não** a
implementou. **Não o confunda** com o `D12 · F3/T4` (`regua-de-cobranca`) nem com o `D12 · F3/T10`
(`documentos-e-confirmacao`). A regra completa está na §3-B
da `.claude/rules/nao-regressao.md`, que é permanente — este bloco é transitório e some quando o
último marcador sair.
⚠️ **O `D32 · F5/T7` teve UMA das TRÊS metades paga em 2026-09-01, e por isso NÃO saiu da lista** —
a T3 da fatia `painel-master-administradores` subiu `entrarComSegundoFatorCumprido` das **seis**
cópias privadas de `apps/api/test/` para `apps/api/test/acessorios-de-borda.ts`, e as seis suítes
passaram a importar. **Não reponha a cópia**, e **não apague o marcador pelo número**: as outras
duas metades — `envelhecerOVigente` e `montarEmpresaComAdmin` — seguem abertas no mesmo bloco, com o
Limiar de Três ainda por disparar, e um fecho por número as levaria junto. Por isso o total do
índice continua em **39**, e a constante `LINHAS_DO_INDICE_NO_FECHO_DA_FATIA`
(`packages/shared/test/protocolo-antirregressao.spec.ts`, `CT-1198`) **não se moveu**.

> **Esta tabela é um ÍNDICE, não um relatório.** Cada linha é um **ponteiro curto**; impacto medido,
> o que fazer e prova exigida vivem **só** na §2 do `run-report.md` da fatia que o registrou, para
> onde o campo `ÍNDICE` do marcador aponta. É o que a §3-B manda (*"marcador que copia o relatório
> inteiro apodrece"*), e a razão é medida: este arquivo entra no contexto de **todo** agente, em toda
> task. **Linha que passar de ~150 caracteres deve ter o excedente movido para a §2.**

| Débito | Onde | Dispara quando |
|---|---|---|
| **D28** (F0/T5) | `grep -rln --exclude-dir=dist "D28 · F0/T5" apps packages deploy` — a contagem sai do comando, que não envelhece | **JÁ DISPAROU (F1/T2)** — consumidor novo de `packages/shared/test/` por caminho relativo profundo |
| **D23** (F0/T3, fatia `fundacao-stack-nativa`) | `packages/shared/src/log.ts` (cabeçalho) | ⚠️ **BLOQUEADO por protocolo, não por tempo** — extrair `redacao.ts` moveria código sob as duas `DECISÃO FECHADA` do arquivo; fecha só se elas caírem pelo próprio `REVERTER EXIGE`, ou por autorização expressa do usuário |
| **D37** (F1/T8, fatia `autorizacao-e-ciclo-de-acesso`) | `apps/api/src/master/empresa.controller.ts` | a **primeira comparação do `:id` do Master com identidade da sessão** — o esquema de lá não canoniza a caixa do UUID |
| **D3** (F2/T1, fatia `cadastro-de-imoveis-e-pessoas`) | `packages/contracts/src/comum.ts` | a **primeira task que abrir `usuario.controller.ts` por outra razão** — `ESQUEMA_DO_IDENTIFICADOR` tem duas definições |
| **D44** (F2/T10, fatia `contratos-de-locacao`) | `apps/api/src/imoveis/imovel.service.ts` (`definirSituacaoDeLocacao`) | a fatia que criar no banco a **restrição pareando `contrato.status='ATIVO'` com `imovel.status_locacao`** — hoje nada fecha a janela da guarda |
| **D26** (F3/T8, fatia `cobranca-e-mora`) | `packages/db/src/derivacao-de-cobranca.ts` (`ultimoDiaDoMes`) | o **terceiro consumidor de aritmética de calendário do pacote** — `ultimoDiaDoMes` e `ehBissexto` sobem para módulo próprio |
| **D20** (F3/T7, fatia `cobranca-e-mora`) | `packages/db/migracoes/0010_seguranca_cobranca.sql` (bloco da emenda) | **JÁ DISPAROU (2026-08-18)** — a `0010` foi aplicada ao banco durável; o arquivo é imutável e o marcador NÃO sai (removê-lo mudaria o `sha256sum` e abortaria a migração) |
| **D3** (F3/T1, fatia `regua-de-cobranca`) | `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh` (`consultar_o_legado`) | o **quarto consumidor** do caminho de leitura autenticada do legado, ou a **primeira alteração das garantias de transporte da credencial** — hoje são três cópias e endurecer uma deixa as outras para trás |
| **D12** (F3/T4, fatia `regua-de-cobranca`) | `packages/regua/src/mensagem.ts` (a desestruturação de `ESTADOS_DA_COBRANCA`) | a **primeira task que abrir `packages/contracts/src/cobranca.ts`** por outra razão — ali nasce `ESTADOS_AVISAVEIS` como tupla `as const` e a escolha do molde deixa de depender de posição |
| **D14** (F3/T5, fatia `regua-de-cobranca`) | `packages/db/src/fuso-da-operacao.ts` (`FUSO_DA_OPERACAO`) | a **primeira migração que redefinir `negocio.data_corrente_da_operacao()`** — o fuso tem duas declarações executáveis e nada as amarra |
| **D49** (F3/T10, fatia `regua-de-cobranca`) | `apps/worker/test/ambiente.spec.ts` (docblock do `CT-643`) | a **escalada que autorize mover o bloco sob `DECISÃO FECHADA — T8 / Gate 1 rodada 2`**, ou o **terceiro processo** que precisar da maquinaria — hoje o detector de exigência de ambiente tem duas cópias e endurecer uma deixa a outra para trás |
| **D54** (F3/T11, fatia `regua-de-cobranca`) | `apps/api/test/equivalencia-com-o-oraculo.spec.ts` (`CODIGO_NO_ASSUNTO`) | o **quarto consumidor** do molde de extração do código de cobrança, ou a **primeira alteração da forma do código** — hoje são três cópias e elas já divergem na flag `u` |
| **D12** (F3/T10, fatia `documentos-e-confirmacao`) | `packages/documentos/src/mensagem-de-confirmacao.ts` | a **terceira** mensagem de e-mail do produto (o boleto, na F4) — ali `MensagemDeEmail` e a porta de envio sobem para `@sysloc/shared` |
| **D13** (F4/T6, fatia `emissao-e-conciliacao`) | `packages/db/src/boleto-da-cobranca.ts` (junto de `ErroDeCobrancaNaoAlcancada`) | a fatia que criar no banco a **restrição pareando `linha_digitavel` com `nosso_numero`** — hoje a linha meio preenchida é representável. Mesma classe do D44 · F2/T10 |
| **D34** (F4/T11, fatia `emissao-e-conciliacao`) | `packages/cobranca-bancaria/src/emissao-em-lote.ts` (junto de `guarda.gravar`) | ⚠️ **gatilho EMENDADO em 2026-08-19** (a metade da fatia (iii) venceu e foi refutada: dá observabilidade, não reconciliação) — vigente é **persistir o identificador enviado antes da chamada**, ou ampliar o modelo canônico |
| **D49** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/tarefas/carga-da-tarefa.ts` (cabeçalho) | a **primeira task autorizada a abrir `regua.ts` ou `confirmacao-de-email.ts`** — a tradução de `ZodError` em nome de campo tem três cópias no processo |
| **D50** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/tarefas/emissao-em-lote.ts` (junto de `dadosDaEmissao`) | o **terceiro consumidor** da projeção do pedido de emissão, ou a primeira alteração dos campos que ela leva ao provedor — hoje são duas cópias |
| **D51** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/main.ts` (junto de `ehChaveDeCifraAceitavel`) | ⚠️ **JÁ DISPAROU DUAS VEZES (F5/T7 e F7/T7)** — a **primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`**, ou o terceiro processo que exigir as mesmas variáveis — as duas conferências de forma têm duas definições |
| **D52** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/test/varredura-de-segredo.ts` (cabeçalho) | o **terceiro consumidor** do molde de varredura com controle positivo fora de `apps/worker/test/`, ou a primeira alteração das formas buscadas — hoje são duas cópias |
| **D53** (F4/T16, fatia `emissao-e-conciliacao`) | `packages/shared/src/log.ts` (junto de `redigirErro`) | a **próxima superfície que decifre o segredo operável**, ou a primeira exceção do produto que anexe campo próprio fora de `RADICAIS_SENSIVEIS` — o eixo por nome de chave não a alcança |
| **D58** (F4/T16, fatia `emissao-e-conciliacao`) | `apps/worker/src/tarefas/emissao-em-lote.ts` (junto da assinatura de `comReentranciaBenigna`) | o **terceiro consumidor** do discriminador, ou a primeira alteração do contrato do sentinela — `<T>` é irrestrito e a reserva de `undefined` vive só no docblock |
| **D21** (F4/T9, fatia `webhook-e-carne`) | `apps/api/test/retomada-de-retidas.spec.ts` (junto de `semearCobranca`) | a **primeira task autorizada a abrir as duas suítes irmãs** da notícia bancária — o arranjo da cobrança com boleto e certificado tem três cópias |
| **D43** (F4/fechamento, fatia `webhook-e-carne`) | `deploy/scripts/borda/instalar-borda-de-notificacao.sh` (junto de `NOME_DO_VHOST`) | o produto receber notícia de um **segundo provedor bancário** — o nome do vhost é fixo e o segundo hostname sobrescreveria o primeiro |
| **D1** (F5/T1, fatia `integracao-bancaria-autonoma`) | `packages/cobranca-bancaria/src/conversao-do-material.ts` (junto de `executarOConversor`) | o módulo ganhar ponto de injeção legítimo do binário ou do teto — o estouro do teto não tem prova |
| **D31** (F5/T7, fatia `integracao-bancaria-autonoma`) | `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` (junto de `DISCRIMINADOR_DO_CERTIFICADO`) | a **primeira task autorizada a abrir `apps/api/src/cobrancas/boleto.service.ts`**, ou o terceiro consumidor — as 6 constantes de recusa de pré-condição têm duas cópias |
| **D32** (F5/T7, fatia `integracao-bancaria-autonoma`) | `apps/api/test/entrega-da-noticia.e2e.spec.ts` (junto de `EmpresaMontada`) | ⚠️ **metade PAGA na F7/T3** (`entrarComSegundoFatorCumprido`, 6 cópias → 1); vigente é o Limiar de Três de `envelhecerOVigente` e `montarEmpresaComAdmin` |
| **D37** (F5/T8, fatia `integracao-bancaria-autonoma`) | `apps/worker/src/tarefas/reconferencia-da-entrega.ts` (junto de `nadaMudou`) | `limitarDiagnostico` virar símbolo publicado de `@sysloc/db`, ou o primeiro ramo do produto que LEIA dentro do `diagnostico` — a comparação do desfecho não o alcança |
| **D38** (F5/T8, fatia `integracao-bancaria-autonoma`) | `apps/worker/src/main.ts` (junto de `criarAdaptadorSicoob` da entrega) | o **terceiro** ponto de fiação não provado de porta bancária — hoje são dois —, ou a extração da composição raiz em unidade testável |
| **D40** (F5/T9, fatia `integracao-bancaria-autonoma`) | `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (junto de `naBorda`) | a **primeira task autorizada a abrir a suíte** — ela tem duas formas de falar HTTP, e a privada convida a ser copiada |
| **D43** (F5/fechamento, fatia `integracao-bancaria-autonoma`) | `packages/cobranca-bancaria/src/adaptador-sicoob.ts` (junto de `comporCadastroDaEntrega`) | a resposta do provedor sobre a tabela de `codigoSituacao`, ou o primeiro valor fora dos **dois** documentados — ⚠️ **emendado**: o `D42` fechou e o campo passou a ser LIDO |
| **D16** (F5/T8, fatia `automacoes-agendadas`) | `apps/worker/src/despachante.ts` (junto de `lerAmbienteDoDespacho`) | o fecho do `D51 · F4/T16`, ou o **terceiro** ponto de entrada que exigir `LOG_LEVEL`/`DATABASE_URL`/`REDIS_URL` — hoje são duas declarações no mesmo processo |
| **D17** (F5/T8, fatia `automacoes-agendadas`) | `apps/worker/test/despachante.spec.ts` (junto de `executarDespachante`) | o **terceiro** consumidor do lançador de subprocesso com ambiente explícito — hoje são duas cópias privadas |
| **D15** (F5/T7, fatia `automacoes-agendadas`) | `packages/cobranca-bancaria/src/guarda-de-boletos.ts` (junto de `MILISSEGUNDOS_POR_DIA`) | o **quarto consumidor de produção**, ou a primeira task autorizada a abrir `derivacao-de-contrato.ts` ou `certificado.service.ts` — hoje são 3 cópias, já com o nome alinhado |
| **D12** (F5/T6, fatia `automacoes-agendadas`) | `packages/db/src/conferencia-bancaria.ts` (junto de `abrirConferencia`) | a fatia que fixar o **limiar de obsolescência** da conferência em andamento — é decisão de produto, e a forma viável é a varredura na `MANUTENCAO` |
| **D11** (F5/T6, fatia `automacoes-agendadas`) | `apps/worker/test/acessorios-de-borda.ts` (cabeçalho) | a **primeira task autorizada a abrir uma das 6 suítes** de `apps/worker/test/` com `emUnidade` local — medido: 7 declarações, e a casa nasceu com 1 consumidor |
| **D40** (F7/T9, fatia `publicacao-e-backup`) | `deploy/scripts/borda/verificar-borda-do-app.sh` (junto de `subir_borda_efemera`) | a **terceira borda pública**, ou abrir `verificar-notificacao-bancaria.sh` **para mexer no acessório** — gatilho emendado 2×, razão na §2 |
| **D41** (F7/T9, fatia `publicacao-e-backup`) | `deploy/scripts/borda/verificar-borda-do-app.sh` (junto de `DESTINO_DECLARADO_DO_EMAIL`) | a **troca do `SMTP_URL` para o destino real** — o `CT-1152` afirma o outro lado da mesma chave e o ponteiro entre os dois é de mão única |
| **D1** (F7/T1, fatia `painel-master-administradores`) | `packages/db/src/administrador-do-master.ts` (junto de `lerAdministrador`) | o **terceiro** leitor da linha de `identidade.usuario` — hoje são duas projeções, com `lerAlvoDeReemissao` |
| **D8** (F7/T4, fatia `painel-master-administradores`) | `apps/api/src/master/administrador.service.ts` (junto de `recusaPorPerfil`) | a **terceira** cópia do envelope de recusa por perfil — hoje são duas, com `empresa.service.ts` |
| **D12** (F7/T4, fatia `painel-master-administradores`) | `apps/api/src/master/administrador.contrato.ts` (junto de `MAIOR_PAGINA_DE_ADMINISTRADORES`) | ⚠️ **JÁ DISPAROU (F7/T6)** — a T6 abriu `empresa.controller.ts`; adiado por §A1, razão na §2. Volta a disparar na **terceira** declaração da FORMA da janela em `apps/api/src/master/` |
| **D22** (F7/T6, fatia `painel-master-administradores`) | `apps/api/src/master/empresa.controller.ts` (junto de `ESQUEMA_DA_EMPRESA`) | a primeira task autorizada a abrir este arquivo **para reformar a publicação do contrato** — as 6 descrições à mão viram `esquemaPublicado(...)`, usado por 15 dos 22 controladores |
| **D19** (F7/T5, fatia `painel-master-administradores`) | **2 marcadores** — `apps/api/src/master/administrador.service.ts` (`MOTIVO_DO_EMAIL_EM_USO`) e `administrador.contrato.ts` (`MAIOR_NOME_DE_PESSOA`) | ⚠️ **o Limiar de Três JÁ DISPAROU nos dois (3 cópias cada, medido)** — abrir `usuarios/usuario.service.ts` (o literal) ou `usuarios/usuario.controller.ts` (o teto) por outra razão; adiado por escopo, razão na §2 |
| **D3** (F7/T2, fatia `painel-master-administradores`) | `packages/db/test/catalogo.spec.ts` (junto de `tabelasQueAlcancamAEmpresaEmUmSalto`) | o **terceiro** consumidor do predicado de ligação obrigatória, ou a primeira alteração do que *"obrigatória"* significa — hoje são 2 cópias e a sincronia vive só em prosa |
| **D5** (F5/T3, fatia `automacoes-agendadas`) | `packages/db/drizzle.config.ts` (junto de `out`) | ⚠️ **RECORRENTE — o gatilho NÃO o extingue**: a próxima migração **autoral** que alterar estrutura declarada em `src/esquema/*.ts`, ou uma regeração **do zero**; a supressão é manual nos dois casos e volta na seguinte |

---

## Comandos

Existem a partir da T1. `mprocs` chega na T7.

```bash
mise install                              # fixa Node 24 e ferramentas
pnpm install
pnpm build                                # Turborepo
pnpm lint                                 # Biome + turbo run lint
pnpm test                                 # Vitest + instâncias efêmeras (turbo run test)
pnpm --filter @sysloc/<pacote> test       # subset de um pacote só
bash deploy/scripts/<área>/verificar-<alvo>.sh   # verificadores de infraestrutura (shell)
```

**Rode `pnpm test` antes e depois de qualquer edição** — é a baseline que o Protocolo Antirregressão
exige (`.claude/rules/nao-regressao.md`, P1 e P5).

---

## Contexto do backend antigo

`/opt/frappe` ainda está **de pé e operando** — só é desligado na F7. Consultá-lo é legítimo
(`docker compose exec -T backend bench --site frontend ...`), mas:

- O site `frontend` é **produção**. Nada destrutivo.
- A **caracterização das regras de negócio** já rodou, e os **10 artefatos golden** estão versionados:
  os 6 da captura original, os 2 de contrato (fatia `contratos-de-locacao`) e o
  `regua-de-cobranca.json`, capturado pela **T1 da fatia `cobranca-e-mora`** em 2026-08-10. **Não há
  mais captura pendente.**
- A credencial de API do ERPNext segue **exposta em texto claro** no bundle público da porta
  8300 enquanto ele existir. Pendência aberta.
