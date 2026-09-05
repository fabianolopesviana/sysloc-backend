/**
 * Ciclo de vida do **Admin Empresa** e da **Empresa** pelas rotas do Painel Master. T4, T5 e **T6**
 * da fatia `painel-master-administradores`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-01 | CT-1220 | `GET /v1/master/empresas/:id/administradores` responde `200` com o envelope
 * | CA-02 |         | `{itens,total,limite,deslocamento}` e cada item com o conjunto **fechado**
 * |       |         | `{usuarioId,nome,email,estado,criadoEm,exclusao}` — só os `ADMIN_EMPRESA`
 * |       |         | daquela empresa, sem o Usuário Empresa e sem o próprio operador —, e nenhum
 * |       |         | identificador de contrato, de vínculo nem chave de permissão aparece na
 * |       |         | serialização, com esses três semeados e **afirmados presentes** antes da
 * |       |         | chamada. A mesma varredura aplicada a um corpo com as agulhas plantadas
 * |       |         | acusa as três (CONTROLE POSITIVO). (RN-01, RN-13, ADR-0032) |
 * | —     | CT-1220 | As três recusas de borda valem nas **três** rotas: sem cookie é
 * |       | (b)     | `401 NAO_AUTENTICADO`; `:id` malformado é `422 CAMPO_INVALIDO` em `campo:'id'`
 * |       |         | **sem tocar o banco**; e UUID bem formado e inexistente é
 * |       |         | `404 RECURSO_NAO_ENCONTRADO`, com o corpo inteiro por igualdade. As duas
 * |       |         | transições recusam alvo de outro perfil com `422` nomeando `perfilExigido` e
 * |       |         | `perfilDoAlvo`, e a sessão do alvo **continua servindo**. (RN-06, ADR-0017) |
 * | CA-03 | CT-1221 | O `usuarioId` devolvido pela **listagem** é aceito pela reemissão de Senha
 * |       |         | provisória já publicada, e a senha reemitida entra — sem que o caso tenha
 * |       |         | guardado o identificador que a admissão devolveu. A senha anterior recebe
 * |       |         | recusa **indistinguível** da de credencial incorreta. (RN-09, RN-10) |
 * | CA-04 | CT-1222 | `POST /v1/master/usuarios/:id/suspensao` sobre um Admin Empresa com 2 sessões
 * |       |         | responde `{usuarioId, estado:'SUSPENSO', sessoesEncerradas:2}`, a contagem
 * |       |         | crua de `identidade.sessao` vai de **2 a 0**, os dois cookies passam a
 * |       |         | responder `401` e ninguém entra de novo enquanto durar a suspensão. (RN-03,
 * |       |         | RN-05) |
 * | CA-05 | CT-1223 | Suspenso um Admin Empresa, a colega **ativa da mesma empresa** segue operando
 * |       |         | no mesmo instante: a requisição dela responde `2xx` e a contagem crua de
 * |       |         | sessões dela permanece exatamente a mesma. |
 * | CA-06 | CT-1224 | Repetir a suspensão de quem já está suspenso responde `200` com
 * |       |         | `sessoesEncerradas: 0`, e o corpo difere do da primeira chamada **apenas**
 * |       |         | nesse campo — nunca `409`, nunca `422`. (§9.2) |
 * | CA-07 | CT-1225 | `POST /v1/master/usuarios/:id/reativacao` responde `{usuarioId,
 * |       |         | estado:'ATIVO'}`, a contagem de sessões **continua** em `0`, os cookies
 * |       |         | anteriores seguem em `401`, e só uma entrada nova a faz operar de novo.
 * |       |         | (RN-04) |
 * | CA-01 | CT-1244 | A janela declarada CHEGA AO BANCO: com **3** administradores semeados,
 * |       |         | `?limite=2&deslocamento=0` devolve os **2 primeiros** por `nome, id` e
 * |       |         | `?limite=2&deslocamento=2` devolve **o terceiro** — `total: 3` nas duas, a
 * |       |         | união das duas páginas igual ao conjunto, e `limite`/`deslocamento` ecoados
 * |       |         | do que foi pedido. Sem janela, a resposta ecoa o padrão declarado. (ADR-0017) |
 * | CA-01 | CT-1245 | A FRONTEIRA da janela, lida da constante: o teto exato responde `200` e o
 * |       |         | teto **mais um** responde `422 CAMPO_INVALIDO` em `campo:'limite'` — recusa,
 * |       |         | nunca truncamento. `deslocamento` negativo recusa nomeando `deslocamento`, e
 * |       |         | chave desconhecida na cadeia de consulta recusa **nomeando a própria chave**
 * |       |         | (`strictObject`). |
 *
 * | CA-08 | CT-1226 | Cada uma das **cinco** operações sobre `:id` de usuário — suspensão,
 * |       |         | reativação, **correção cadastral**, **remoção definitiva** e reemissão —
 * |       |         | apontada a um `USUARIO_EMPRESA` responde `422 CAMPO_INVALIDO` com
 * |       |         | `campo:'id'` e `detalhes:{perfilExigido:'ADMIN_EMPRESA',
 * |       |         | perfilDoAlvo:'USUARIO_EMPRESA'}`, a linha da pessoa permanece **campo a
 * |       |         | campo** idêntica, a contagem crua de sessões dela não se move e a sessão
 * |       |         | dela **continua servindo**. (RN-06, ADR-0013, ADR-0017) |
 * | CA-09 | CT-1227 | `PUT /v1/master/usuarios/:id` sobre um Admin Empresa **SUSPENSO** altera nome
 * |       |         | e endereço e o devolve com `estado:'SUSPENSO'`; a linha crua relida é igual
 * |       |         | à de antes **em todas as demais colunas** — `ativo`, `perfil`, `empresa_id`,
 * |       |         | `criado_em` e `atualizado_em` inclusive —, a listagem continua trazendo
 * |       |         | `SUSPENSO` e a pessoa continua sem conseguir entrar. (RN-07, ADR-0021) |
 * | CA-10 | CT-1228 | Corrigido o endereço por `PUT`, a entrada com o e-mail **novo** e a Senha
 * |       |         | provisória emitida **antes** da correção responde `200` e leva a contagem
 * |       |         | crua de sessões de `0` a `1` — a credencial ancora no `usuarioId`, não no
 * |       |         | e-mail. A entrada com o e-mail **antigo** recebe o corpo **byte a byte**
 * |       |         | igual ao de um endereço que nunca existiu, e a contagem **não** sobe.
 * |       |         | (RN-08) |
 * | CA-09 | CT-1230 | O corpo do `PUT` é `z.strictObject`: cada uma das **quatro** chaves proibidas
 * |       |         | — `estado`, `ativo`, `perfil`, `empresaId` — enviada junto do corpo válido
 * |       |         | produz `422 CAMPO_INVALIDO`, o esquema a recusa com
 * |       |         | `code:'unrecognized_keys'` e `keys` igual a `[<a chave>]`, e a linha crua
 * |       |         | permanece campo a campo idêntica. Um `z.object` responderia `200`
 * |       |         | **ignorando** a chave. (RN-07, ADR-0021, `contrato-publicado.md`) |
 * | CA-11 | CT-1246 | `PUT /v1/master/usuarios/:id` com o endereço **de outra pessoa** responde
 * |       |         | `422 CAMPO_INVALIDO` com `campo:'email'` e
 * |       |         | `detalhes:{motivo:'EMAIL_JA_REGISTRADO'}`, e **nada é gravado**: as duas
 * |       |         | linhas cruas seguem idênticas campo a campo, inclusive quanto ao `nome`
 * |       |         | **válido** que viajou no mesmo corpo. Nem o corpo da resposta nem o
 * |       |         | **diário do processo** citam o endereço alheio ou o nome da restrição do
 * |       |         | servidor — com a linha da recusa AFIRMADA presente no diário e com a mesma
 * |       |         | varredura acusando os dois num corpo onde foram plantados (CONTROLE
 * |       |         | POSITIVO). (RN-15, ADR-0032, ADR-0017) |
 * | CA-17 | CT-1236 | `DELETE /v1/master/usuarios/:id` sobre um Admin Empresa com **trilha de
 * |       |         | tentativa de entrada** — produzida por entrada real, ainda que malsucedida,
 * |       |         | e **afirmada presente** antes do ato — responde `422` com
 * |       |         | `detalhes:{motivo:'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
 * |       |         | impedimentos:['TENTATIVA_DE_ENTRADA'], alternativa:'SUSPENSAO'}`, a pessoa
 * |       |         | continua na listagem e a trilha continua inteira. (RN-15, RN-16, ADR-0038) |
 * | CA-18 | CT-1237 | `DELETE` sobre um Admin Empresa que **nunca** tentou entrar responde `200`
 * |       |         | com `{usuarioId, removido:true}`, a listagem perde **exatamente** aquele
 * |       |         | identificador — diferença de conjunto `{excedentes:[], ausentes:['<alvo>']}`,
 * |       |         | com o colega intacto —, a linha some de `identidade.usuario` e a credencial
 * |       |         | do alvo recebe recusa **indistinguível**, byte a byte, da de um endereço que
 * |       |         | nunca existiu. (ADR-0038) |
 *
 * | CA-11 | CT-1229 | `PUT /v1/master/empresas/:id` atribuindo à empresa A o documento de B responde
 * |       |         | `422 CAMPO_INVALIDO` com `campo:'documento'` e
 * |       |         | `detalhes:{motivo:'DOCUMENTO_JA_REGISTRADO'}`, e **nada é gravado**: as duas
 * |       |         | linhas da listagem seguem idênticas campo a campo — inclusive quanto ao
 * |       |         | `nome` **válido** que viajou no mesmo corpo. O corpo da recusa não cita o
 * |       |         | documento alheio nem o nome da restrição do servidor. (RN-15, ADR-0017) |
 * | CA-09 | CT-1247 | O corpo do `PUT` de Empresa é `z.strictObject`: cada uma das **três** chaves
 * |       |         | proibidas — `estado`, `suspensaEm`, `empresaId` — enviada junto do corpo
 * |       |         | válido produz `422 CAMPO_INVALIDO`, o esquema a recusa com
 * |       |         | `code:'unrecognized_keys'` e `keys` igual a `[<a chave>]`, e a linha crua de
 * |       |         | `identidade.empresa` permanece campo a campo idêntica. Um `z.object`
 * |       |         | responderia `200` **ignorando** a chave. (RN-07, ADR-0021, ADR-0026,
 * |       |         | `contrato-publicado.md`) |
 * | CA-09 | CT-1248 | `PUT /v1/master/empresas/:id` com corpo VÁLIDO sobre uma empresa **suspensa**
 * |       |         | responde `200` com a linha da **listagem** — o contrato mais `exclusao`,
 * |       |         | afirmada por igualdade de objeto INTEIRO —, trazendo `estado:'SUSPENSA'` e o
 * |       |         | mesmo `criadaEm`; a linha crua relida tem `suspensa_em` **igual ao de antes**
 * |       |         | e `nome`/`documento` de fato trocados, e nenhuma outra coluna se moveu.
 * |       |         | (RN-07, ADR-0021, ADR-0030) |
 * | CA-12 | CT-1231 | Na listagem de empresas, a que tem contrato traz `exclusao` igual a
 * |       |         | `{disponivel:false, motivo:'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
 * |       |         | impedimentos:['REGISTROS_DE_NEGOCIO'], alternativa:'SUSPENSAO'}` e a vazia
 * |       |         | traz `{disponivel:true, impedimentos:[]}` — as duas por igualdade de objeto —,
 * |       |         | e compor a página **não removeu** empresa nem administrador algum. (US-07,
 * |       |         | ADR-0030, ADR-0038) |
 * | CA-13 | CT-1232 | `DELETE /v1/master/empresas/:id` sobre empresa com contrato responde `422`
 * | CA-14 | CT-1233 | com `campo:'id'` e `detalhes:{motivo, impedimentos:['REGISTROS_DE_NEGOCIO'],
 * |       |         | alternativa:'SUSPENSAO'}`; a contagem crua de `identidade.empresa`, o
 * |       |         | contrato e o administrador ficam intactos, e a empresa segue `ATIVA`. Em
 * |       |         | seguida, a `alternativa` **lida do corpo** escolhe a rota seguinte pelo mapa
 * |       |         | declarado, e a suspensão responde `200` com `estado:'SUSPENSA'`. (RN-15,
 * |       |         | ADR-0038) |
 * | CA-15 | CT-1234 | `DELETE` sobre empresa sem registros com administrador virgem responde `200`
 * |       |         | com `{id, removida:true}`; a listagem perde **exatamente** aquele
 * |       |         | identificador — diferença de conjunto `{excedentes:[], ausentes:['<A>']}`,
 * |       |         | com a empresa de **controle** intacta —, a linha da empresa e a do
 * |       |         | administrador somem, e a credencial dele recebe recusa **indistinguível**,
 * |       |         | byte a byte, da de um endereço que nunca existiu. (RN-12, ADR-0038) |
 * | CA-16 | CT-1235 | `DELETE` sobre empresa sem registros cujos 2 administradores incluem um que
 * |       |         | **já tentou entrar** responde `422` com
 * |       |         | `impedimentos:['ADMINISTRADORES_NAO_ELEGIVEIS']`, e a empresa e os **dois**
 * |       |         | administradores continuam existindo — `identidade.usuario WHERE empresa_id` é
 * |       |         | exatamente `2`. A sobrevivência do administrador **virgem** reprova uma
 * |       |         | remoção em laço não atômica. (RN-12, RN-15, RN-16) |
 * | CA-19 | CT-1238 | Listada uma empresa com `exclusao.disponivel:true`, e registrado um contrato
 * |       |         | nela **antes** de o `DELETE` ser chamado, a exclusão responde `422` com
 * |       |         | `impedimentos:['REGISTROS_DE_NEGOCIO']`; nem a empresa nem o administrador
 * |       |         | são removidos, e a listagem seguinte já anuncia a indisponibilidade. O ato é
 * |       |         | **auto-verificado**: o pior caso da divergência é uma recusa que nomeia o
 * |       |         | motivo. (ADR-0030, ADR-0038) |
 * | CA-20 | CT-1239 | Aplicada a mesma varredura aos corpos das **quatro** recusas de exclusão —
 * |       |         | empresa cheia, empresa com administrador inelegível, administrador com trilha
 * |       |         | e administrador com vínculo —, ela não acha nome de tabela, identificador de
 * |       |         | entidade, nome de pessoa do negócio, numeral de contagem nem nome de
 * |       |         | restrição; e cada corpo é afirmado por igualdade contra o envelope canônico,
 * |       |         | com a **classe exata** de cada arranjo. A MESMA varredura, aplicada a um corpo
 * |       |         | com as agulhas plantadas, acusa **todas** por igualdade de lista (CONTROLE
 * |       |         | POSITIVO). (RN-15, ADR-0032, ADR-0013) |
 * | —     | CT-1249 | As **duas** rotas sobre `:id` de Empresa — `PUT` com corpo VÁLIDO e `DELETE`
 * |       |         | — apontadas a um UUID **bem formado e inexistente** respondem
 * |       |         | `404 RECURSO_NAO_ENCONTRADO` com o corpo **exatamente** `{codigo, mensagem}`,
 * |       |         | sem `campo` e sem `detalhes`: a ausência por inexistência é
 * |       |         | **indistinguível** da de alcance nenhum. Nunca `422` — que anunciaria uma
 * |       |         | exclusão impedida sobre o que nunca existiu — e nunca `200 {removida:true}`,
 * |       |         | que diria ao operador que apagou um tenant que não havia. (ADR-0017) |
 *
 * Rastreabilidade: `CA-01 → CT-1220 (RN-01)`, `CA-02 → CT-1220 (RN-13)`,
 * `CA-03 → CT-1221 (RN-09)`, `CA-04 → CT-1222 (RN-03)`, `CA-05 → CT-1223 (RN-03)`,
 * `CA-06 → CT-1224 (§9.2)`, `CA-07 → CT-1225 (RN-04)`, `CA-01 → CT-1244 (ADR-0017)`,
 * `CA-01 → CT-1245 (ADR-0017)`, `CA-08 → CT-1226 (RN-06)`, `CA-09 → CT-1227 (RN-07)`,
 * `CA-10 → CT-1228 (RN-08)`, `CA-09 → CT-1230 (RN-07)`, `CA-11 → CT-1246 (RN-15)`,
 * `CA-17 → CT-1236 (RN-15)`, `CA-18 → CT-1237 (RN-16)`, `CA-11 → CT-1229 (RN-15)`,
 * `CA-09 → CT-1247 (RN-07)`, `CA-09 → CT-1248 (RN-07)`, `CA-12 → CT-1231 (RN-13)`,
 * `CA-13 → CT-1232 (RN-15)`, `CA-14 → CT-1233 (RN-15)`,
 * `CA-15 → CT-1234 (RN-12)`, `CA-16 → CT-1235 (RN-12)`,
 * `CA-19 → CT-1238 (RN-13)`, `CA-20 → CT-1239 (RN-15)`,
 * `— → CT-1249 (ADR-0017)`.
 *
 * ===========================================================================
 * O ALCANCE dos casos da T5 — a perna de Empresa do CT-1227 e do CT-1230 é da T6
 * ===========================================================================
 *
 * A §6.6 da T5 descreve o `CT-1227` e o `CT-1230` sobre `PUT /v1/master/empresas/:id`, que é rota da
 * **T6**: a §5.2 da T5 não lista `empresa.controller.ts`, e a §5.2 da T6 lista as duas rotas de
 * Empresa. A §6.3 da própria T5, na mesma página, descreve os dois sobre o **administrador**
 * (*"editar admin suspenso"*, *"corpo com `estado`, `ativo`, `perfil`, `empresaId`"*). Escrever aqui
 * a perna de Empresa exigiria publicar rota fora do escopo declarado, e a perna escrita contra rota
 * inexistente responderia `404` — verde por motivo errado. Implementados, portanto, sobre as rotas
 * que **esta** task publica: o `CT-1230` roda as **4** chaves proibidas do corpo de usuário; as
 * **2** de empresa (`estado`, `empresaId`) são da T6, que já as declara em `Dados de entrada`. A
 * divergência está declarada no relatório da fatia.
 *
 * ===========================================================================
 * O CT-1247 e a razão de ele existir: as DUAS lacunas que a T6 herdou
 * ===========================================================================
 *
 * **(1) A §6 da T6 não declarava CT de corpo fechado, e a §4 dela exige.** O critério de aceite
 * escreve *"corpo do `PUT` em `z.strictObject`, sem `estado`/`suspensaEm`"*, e nenhum dos oito CTs
 * declarados menciona `strictObject`, `unrecognized_keys` ou chave proibida. As chaves proibidas do
 * corpo de **Empresa** ficavam órfãs nas duas pontas: a T5 não podia cobri-las (não publica a rota,
 * e a divergência está declarada acima) e a T6 não as declarava. O `CT-1247` fecha a lacuna, no
 * molde exato do `CT-1230` — perna de **contrato**, afirmando `code` e `keys`, mais perna de
 * **borda**, afirmando o `422` e a linha crua inalterada.
 *
 * ⚠️ Ele roda **três** chaves, e não duas: `estado` e `empresaId` são as que o card do `CT-1230` da
 * T5 nomeia para esta rota, e `suspensaEm` é a que a §3.1 da T6 nomeia. As duas listas estão certas
 * e são parciais — o `strictObject` recusa **toda** chave desconhecida, e enumerar a união é o que
 * cobre as duas declarações sem escolher entre elas.
 *
 * **(2) A §6.4 da T6 não tinha coluna `CT`.** É a lacuna estrutural que a T5 fechou na própria spec
 * depois de ela ter produzido um achado `ALTO`: cenário declarado em Cenários de Erro sem CT na §6.3
 * fica sem prova, e a rastreabilidade não acusa. Aconteceu **duas vezes** nesta fatia — o
 * `CT-1220 (b)` e o `CT-1246` nasceram assim. Os três cenários da §6.4 da T6 têm CT: a corrida
 * (`CT-1238`), o vazamento (`CT-1239`) e o documento em uso (`CT-1229`).
 *
 * ===========================================================================
 * O CT-1249 e a QUARTA lacuna da família: cenário do CONTRATO não gera CT em lugar nenhum
 * ===========================================================================
 *
 * As três lacunas acima são do mesmo eixo — **CA → CT** — e as três foram fechadas nele: a §6.4
 * ganhou coluna `CT`, o critério de corpo fechado ganhou o `CT-1247`, e a rastreabilidade passou a
 * exigir caso de **sucesso** para critério com verbo de escrita (`CT-1248`). Nenhuma delas alcança
 * esta: o `404` de identificador bem formado e inexistente **não vem de CA nenhum** — ele vem do
 * **contrato publicado**, que declara `@ApiNotFoundResponse` nas duas rotas
 * (`empresa.controller.ts`). A §6.3 deriva casos dos CAs; a §6.4 lista cenários de erro **do
 * domínio**; e a §6.5 confere `CT → caso`, nunca `resposta publicada → CT`. O cenário, portanto,
 * não chegou sequer a ser **declarado**, um degrau antes de ficar sem prova.
 *
 * O custo era medível: `naoEncontrado()` era a única função nova da task **sem asserção alguma**,
 * com dois pontos de chamada em código novo, e **três** mutantes sobreviviam à suíte inteira — a
 * troca por `recusaDeExclusao([])` no ramo de alcance nenhum (`422` sobre o que nunca existiu), o
 * `campo` acrescentado só nesta cópia (que quebra a indistinguibilidade da ADR-0017) e o
 * `200 {removida:true}` sobre identificador inexistente, que sobre um verbo que apaga um **tenant
 * inteiro** faria o operador acreditar que removeu alguma coisa.
 *
 * A regra que fecha a classe, e que a §6.4 da T6 passa a declarar: **toda resposta declarada no
 * contrato do controlador (`@ApiNotFoundResponse` e as irmãs) é cenário e exige CT** — a origem do
 * cenário é a superfície publicada, e não só o critério de aceite.
 *
 * ===========================================================================
 * O CONTRATO semeado vem das funções de domínio, e não das cinco rotas de cadastro
 * ===========================================================================
 *
 * Os cards do `CT-1231`, do `CT-1232` e do `CT-1238` prescrevem semear o contrato *"pela rota real
 * da imobiliária, com sessão de `ADMIN_EMPRESA` daquela empresa"*. Aqui a semeadura usa
 * {@link semearContrato}, o acessório que **já existe** neste arquivo desde a T4 e que os dois gates
 * aprovaram: ele compõe pelas funções de domínio publicadas por `@sysloc/db`, **sob o contexto de
 * tenant real** — que é exatamente a propriedade que a prescrição quer (*"o contexto vem da sessão,
 * nunca da requisição do Master"*), e não a borda HTTP.
 *
 * A divergência é declarada, e a razão é dupla: o `CLAUDE.md` manda **importar o acessório da casa
 * compartilhada em vez de copiá-lo**, e percorrer as cinco rotas de cadastro (entrar como Admin,
 * trocar a senha, criar conjunto, imóvel, locador, locatário e contrato) não acrescenta nada ao que
 * estes casos medem — o contrato é **agulha**, e nenhum campo dele é objeto de asserção. O que os
 * casos exigem do dado é que ele **exista no banco no instante do ato**, e a asserção que o afirma é
 * {@link existeContrato}, lida sob a política de linha da própria empresa.
 *
 * ⚠️ **O que a ordem do `CT-1238` exige, essa sim, é preservado byte a byte**: listar, semear,
 * excluir — nessa sequência, no mesmo caso, sem relógio falso e sem pausa fixa.
 *
 * ===========================================================================
 * O que o CT-1226 discrimina, e por que ele não é o CT-1220 (b) com mais linhas
 * ===========================================================================
 *
 * O `CT-1220 (b)` afirma a recusa por perfil nas **duas** transições que a T4 publicou. A RN-06 vale
 * nas **cinco** operações sobre `:id` de usuário, e a diferença é exatamente a classe de defeito que
 * a §5 do Protocolo Antirregressão persegue: uma barreira instalada por ponto, e não por entrada
 * única, passa em toda rota que o autor lembrou e falha na que ele esqueceu. As três que faltavam —
 * a correção, a **remoção definitiva** e a reemissão — entram aqui, e a tabela é `it.each` para que
 * acrescentar rota sem acrescentar linha fique visível.
 *
 * E as três asserções de **ausência de efeito** são o que separa *"recusou"* de *"recusou antes de
 * agir"*: a linha crua idêntica campo a campo reprova um `PUT` que gravasse e só então recusasse; a
 * contagem de sessões inalterada e a sessão que **continua servindo** reprovam uma suspensão que
 * encerrasse sessões antes de olhar o perfil; e a pessoa ainda existir reprova um `DELETE` que
 * removesse e só então conferisse. Nenhuma delas é implicada pelo `422`.
 *
 * ===========================================================================
 * O que o CT-1244 discrimina, e por que o CT-1220 sozinho não bastava
 * ===========================================================================
 *
 * `limite` e `deslocamento` são ecoados na resposta **a partir do objeto `janela` recebido**, e não
 * do que o banco fez. Um mutante que removesse o argumento `janela` da chamada a
 * `listarAdministradoresDaEmpresa` — página inteira sempre, `LIMIT`/`OFFSET` ignorados — responderia
 * o envelope com os valores certos e passaria nos sete casos anteriores, porque todos semeiam 1 ou 2
 * administradores, abaixo de qualquer teto. **A janela podia estar desligada e a suíte não
 * distinguia.** O que discrimina é a contagem de itens de uma página semeada ACIMA do limite pedido,
 * mais a IDENTIDADE do item da segunda página — que também reprova o mutante que honra `LIMIT` e
 * descarta `OFFSET`.
 *
 * ===========================================================================
 * O que faz o CT-1222 provar o que ele diz provar: a CONTAGEM
 * ===========================================================================
 *
 * Se o caso asserisse apenas `401` na operação seguinte, ele passaria com uma implementação que
 * **marca a pessoa e recusa na guarda** — mantendo a sessão de pé contra a RN-03. A contagem crua de
 * `identidade.sessao` indo a zero é a asserção que discrimina as duas implementações; o `401`
 * sozinho não discrimina nenhuma.
 *
 * A segunda metade da discriminação é o **CT-1223**: a colega ativa da mesma empresa, com sessão
 * viva no mesmo instante. Sem ele, um encerramento **por empresa** — em vez de por pessoa — passaria
 * em todas as asserções do CT-1222 e reprovaria só ali.
 *
 * E o **CT-1224** é o que impede o `0` de ser constante escrita num ramo: ele exige que a repetição
 * devolva o mesmo corpo com o campo medido em zero, o que uma implementação com
 * `if (mudouDeEstado) encerrar()` só alcançaria por acidente — e falharia no dia em que a pessoa
 * tivesse entrado de novo entre as duas chamadas.
 *
 * ===========================================================================
 * O CT-1246 e a razão de ele existir: cenário de erro DECLARADO não gera CT
 * ===========================================================================
 *
 * A §6.4 da T5 declara **três** cenários de erro, e a §6.3 nomeia CT para **dois** deles — o alvo
 * de outro perfil (`CT-1226`) e a exclusão impedida (`CT-1236`). O terceiro, *"e-mail em uso"*
 * (CA-11), ficou sem CT e, por consequência, sem teste: a rastreabilidade confere CT → caso, e um
 * cenário que não vira CT **não é alcançado por ela**. A mesma lacuna já havia acontecido na T4, e
 * lá a cobertura nasceu como perna de um caso existente (`CT-1220 (b)`) — é padrão, não acidente, e
 * está escriturado no relatório da fatia.
 *
 * O ramo é NOVO nesta task (`administrador.service.ts`, `recusaDeEmailEmUso`) e é **publicamente
 * contratado** no `ApiOperation` do `PUT`. O que existia era cobertura de **camada de dados**
 * (`packages/db/test/administrador-do-master.spec.ts`, `CT-1218`), que afirma o **desfecho**
 * `EMAIL_EM_USO` — e não a **tradução** dele em envelope. Uma regressão que trocasse `campo:'email'`
 * por `campo:'id'`, que devolvesse `500`, ou que anexasse a causa do driver ao envelope passaria
 * verde naquela camada.
 *
 * ===========================================================================
 * Por que o CT-1246 monta uma SEGUNDA aplicação — e o que só ela mede
 * ===========================================================================
 *
 * A §6.4 diz, na coluna do log, *"nunca o `detail` do driver"*, e essa é a metade da RN-15 que a
 * resposta **não** prova: o `detail` do PostgreSQL carrega o **valor** da chave recusada — isto é, o
 * endereço da OUTRA pessoa —, e o filtro global registra a exceção inteira por campo nomeado
 * (`erro`), de modo que uma regressão que anexasse o erro do driver como `cause` sairia no diário
 * ainda que o corpo da resposta continuasse limpo (`redigirErro`, de `@sysloc/shared`, desce por
 * `causa` e pelas propriedades próprias). Medir isso exige um registrador **observável**, e a
 * montagem principal desta suíte usa `criarAplicacao()` com `LOG_LEVEL=fatal` e destino padrão.
 *
 * Por isso o caso monta a aplicação real com **o registrador trocado por um cujo destino é arquivo**
 * — o molde é `./segredo-nao-escapa.e2e.spec.ts`, e a montagem vem da casa única
 * (`./aplicacao-instrumentada.ts`), nunca copiada. O precedente de duas montagens na mesma suíte é
 * `./automacao-de-cobranca.e2e.spec.ts`. O cookie do Master é o **mesmo**: a sessão é validada
 * contra o banco, que é o mesmo, e o `Origin` que `pedir` envia é o da base chamada — que é
 * exatamente a que aquela instância declara como confiável.
 *
 * E a asserção sobre o diário **não é de ausência apenas**: a linha da recusa é afirmada
 * **presente**, com `caminho`, `metodo`, `status` e `codigo` do próprio ato. Sem isso, *"o endereço
 * alheio não está no diário"* seria verdade num diário vazio.
 *
 * ===========================================================================
 * Por que a suíte é NOVA, e não mais casos em `ciclo-de-acesso.e2e.spec.ts`
 * ===========================================================================
 *
 * Aquele arquivo é a suíte de uma fatia **fechada**, com doze mutantes escriturados no docblock e
 * contagem de casos protegida. Acrescentar dezenove casos ali arriscaria a regressão de decisão (R3)
 * sobre um registro histórico que não se reescreve. O que se importa de lá é o **molde** — e os
 * acessórios vêm de `./acessorios-de-borda.ts`, a casa compartilhada, nunca copiados.
 *
 * ===========================================================================
 * Cada caso arranja o próprio estado, pelas ROTAS REAIS
 * ===========================================================================
 *
 * Os casos compartilham arquivo, banco e aplicação, e **nenhum herda estado de outro**: cada um que
 * precisa de administrador cria a **própria empresa** pela rota do Master e admite as pessoas dela
 * pela rota do Master, de modo que a ordem de execução não altera desfecho algum. As únicas
 * exceções são o CT-1220, o CT-1220 (b) e o **CT-1226**, que usam a **empresa A da carga** — e usam
 * porque precisam de um `USUARIO_EMPRESA` na mesma empresa, que é justamente o perfil que a rota do
 * Master **não** admite. Nenhum outro caso toca a empresa A, e nenhum dos três a **altera**: o
 * CT-1226 afirma, em cada uma das cinco pernas, que a linha da pessoa é idêntica campo a campo
 * depois da recusa — se uma perna gravasse, o CT-1220 reprovaria em seguida, e é assim que se quer.
 *
 * A única escrita fora da API é a **semeadura do contrato** do CT-1220, e ela existe porque o dado
 * que não pode vazar precisa existir: criar contrato pela interface exigiria entrar como Admin da
 * empresa e percorrer quatro rotas de cadastro, sem nada acrescentar ao que o caso mede. Ela usa as
 * funções de domínio publicadas por `@sysloc/db`, sob o contexto de tenant real — nenhum símbolo de
 * produção nasceu para o teste ver algo (Lei do seam).
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os acessórios devolvem. A aplicação é a **real**
 * (`criarAplicacao`, de `src/main.ts`), e a porta é **reservada** por trava atômica — o arcabouço de
 * identidade confere a origem das requisições com cookie contra o endereço base, composto a partir
 * da porta configurada.
 *
 * O Sysloc Master nasce da carga **sem segundo fator configurado**, e a sessão dele é restrita até
 * que ele o configure: sem cumpri-lo, toda rota deste arquivo responderia `403` da **restrição de
 * sessão** — não da autorização —, e o diagnóstico apontaria para o lugar errado. Por isso ele é
 * cumprido pela via pública real uma única vez, na montagem, e a precondição é **afirmada** no
 * primeiro caso em vez de suposta.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { ChaveDoCatalogo } from '@sysloc/auth';
import {
  ACESSOS_DA_EMPRESA_A,
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  EMPRESA_A,
  emitirNumeroDeContrato,
  esquemaIdentidade,
  garantirContadorDeContrato,
  garantirVinculoDeAcesso,
  lerAnoDaSerieDeContrato,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
} from '@sysloc/db';
import { CodigoErro, criarLogger } from '@sysloc/shared';
import { eq } from 'drizzle-orm';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_LOGGER,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import {
  ESQUEMA_DO_ADMINISTRADOR_ALTERADO,
  MAIOR_PAGINA_DE_ADMINISTRADORES,
  PAGINA_PADRAO_DE_ADMINISTRADORES,
} from '../src/master/administrador.contrato.ts';
import {
  CAMINHO_DO_MASTER,
  ESQUEMA_DA_EMPRESA_ALTERADA,
} from '../src/master/empresa.controller.ts';
import { MAIOR_PAGINA_DE_EMPRESAS } from '../src/master/empresa.service.ts';
import {
  conceder,
  contarSessoesDaPessoa,
  credencialDeSessao,
  entrar,
  entrarComSegundoFatorCumprido,
  pedir,
  type Resposta,
  ROTA_DE_ENTRADA,
  SUFIXO_DO_COOKIE_DE_SESSAO,
} from './acessorios-de-borda.ts';
import { montarAplicacaoInstrumentada } from './aplicacao-instrumentada.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Limite de um caso.
 *
 * Generoso de propósito: os casos executam muitas entradas reais em sequência, e cada uma paga a
 * derivação `scrypt`, que é deliberadamente cara. O teto não é espera — nada aqui dorme.
 */
const LIMITE_CASO_MS = 120_000;

/** Caminho, relativo à raiz, da coleção de empresas do operador. Composto do dono do segmento. */
const CAMINHO_DAS_EMPRESAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;

/** Caminho, relativo à raiz, das rotas do operador que alcançam uma pessoa. */
const CAMINHO_DOS_USUARIOS_DO_MASTER = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/usuarios`;

/**
 * O caminho de uma pessoa **como o diário o registra**: o padrão da rota, com o parâmetro por nome.
 *
 * O filtro global escreve o rótulo da rota (`rotuloDeRota` / `routeOptions.url`), e **não** a URL
 * concreta — o identificador do alvo não viaja por esse campo. Composto do mesmo dono do segmento
 * que {@link edicaoDe}, e não escrito à mão: as duas formas do mesmo caminho ficariam livres para
 * divergir, e o filtro do CT-1246 passaria a não achar linha nenhuma.
 */
const PADRAO_DA_ROTA_DE_UMA_PESSOA = `${CAMINHO_DOS_USUARIOS_DO_MASTER}/:id`;

/** Caminho, relativo à raiz, da rota de sessão do produto. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** A rota de troca de senha **do produto** — a que a sessão restrita alcança. */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/**
 * A rota **da imobiliária** usada para observar se um cookie ainda serve.
 *
 * É uma rota de negócio de verdade, governada por chave do catálogo: ela atravessa a guarda inteira
 * — sessão, restrição e autorização —, e por isso o `2xx` dela diz *"esta pessoa opera"*, e não
 * apenas *"o cookie decodifica"*. `GET /v1/sessao` não serviria: ela é `@NaoExigePermissao`.
 */
const ROTA_DA_IMOBILIARIA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/** O conjunto FECHADO de chaves de um item da listagem (RN-13), em ordem estável. */
const CHAVES_DO_ADMINISTRADOR_PUBLICADO = [
  'criadoEm',
  'email',
  'estado',
  'exclusao',
  'nome',
  'usuarioId',
];

/** As quatro chaves do envelope de lista, em ordem estável (ADR-0017). */
const CHAVES_DO_ENVELOPE = ['deslocamento', 'itens', 'limite', 'total'];

/** A chave de permissão semeada na empresa A — o dado de negócio que **não** pode vazar. */
const CHAVE_SEMEADA: ChaveDoCatalogo = 'TELA:financeiro';

/** Senha que satisfaz a política de força e não é a de ninguém da carga. */
const SENHA_TROCADA = 'brisa9Verde!';

/** Senha que nunca foi de ninguém — o controle da recusa indistinguível do CT-1221 e do CT-1236. */
const SENHA_JAMAIS_EMITIDA = 'nevoa4Prata!';

/**
 * As **cinco** operações do Master sobre `:id` de usuário, e o corpo que cada uma leva (CT-1226).
 *
 * A tabela é o conteúdo do caso: a RN-06 vale em **todas**, e enumerar aqui faz uma rota nova que
 * nasça sem barreira aparecer como linha faltando, em vez de passar despercebida. O corpo do `PUT`
 * é **válido** de propósito — se a barreira de perfil falhasse, a pessoa seria de fato renomeada, e
 * é isso que a releitura da linha crua mede.
 */
const OPERACOES_SOBRE_UMA_PESSOA = [
  { nome: 'POST :id/suspensao', metodo: 'POST', sufixo: '/suspensao' },
  { nome: 'POST :id/reativacao', metodo: 'POST', sufixo: '/reativacao' },
  {
    nome: 'PUT :id',
    metodo: 'PUT',
    sufixo: '',
    corpo: { nome: 'Nome Que Não Deve Ser Gravado', email: 'invasor.rn06@exemplo.com.br' },
  },
  { nome: 'DELETE :id', metodo: 'DELETE', sufixo: '' },
  { nome: 'POST :id/senha-provisoria', metodo: 'POST', sufixo: '/senha-provisoria' },
] as const satisfies readonly {
  readonly nome: string;
  readonly metodo: string;
  readonly sufixo: string;
  readonly corpo?: Readonly<Record<string, unknown>>;
}[];

/**
 * As **quatro** chaves que o corpo da correção cadastral recusa (CT-1230).
 *
 * `estado` e `ativo` porque transição de estado tem rota própria (ADR-0021); `perfil` porque a
 * ADR-0013 o fixa; `empresaId` porque correção cadastral não move pessoa entre empresas. O valor
 * enviado com cada uma é **plausível** — um valor absurdo seria recusado por outra razão, e a linha
 * deixaria de exercitar a chave excedente.
 */
const CHAVES_PROIBIDAS_NA_CORRECAO = [
  { chave: 'estado', valor: 'ATIVO' },
  { chave: 'ativo', valor: true },
  { chave: 'perfil', valor: 'SYSLOC_MASTER' },
  { chave: 'empresaId', valor: '00000000-0000-4000-8000-000000000000' },
] as const;

/**
 * O nome da restrição que o servidor reporta ao recusar o endereço repetido (CT-1246).
 *
 * Ele é **agulha de vazamento**, e não discriminante: quem decide o desfecho é `@sysloc/db`, pelo
 * par (`code`, `constraint_name`), e o que este caso mede é que nem esse nome nem o endereço da
 * outra pessoa — os dois valores que o `detail` do driver carrega — chegam ao cliente ou ao diário.
 *
 * Literal de propósito: a constante de produção é **privada** de
 * `packages/db/src/administrador-do-master.ts`, e importá-la exigiria publicá-la só para o teste
 * enxergar (Lei do seam). O risco de a agulha envelhecer é coberto pelo **controle positivo**, que
 * exige que a varredura acuse as duas quando elas de fato estão no texto.
 */
const RESTRICAO_DO_EMAIL_NO_SERVIDOR = 'usuario_email_unique';

/**
 * As **três** chaves que o corpo da correção cadastral de Empresa recusa (CT-1247).
 *
 * `estado` porque transição de estado tem rota própria (ADR-0021); `suspensaEm` porque o instante é
 * gravado pelo servidor (`coalesce(suspensa_em, now())`, ADR-0026) e aceitá-lo do corpo deixaria o
 * cliente reescrever quando a suspensão teria acontecido; `empresaId` porque a empresa alcançada é a
 * do caminho, e aceitá-la também do corpo criaria uma segunda origem de identidade. O valor enviado
 * com cada uma é **plausível** — um valor absurdo seria recusado por outra razão, e a linha deixaria
 * de exercitar a chave excedente.
 */
const CHAVES_PROIBIDAS_NA_CORRECAO_DE_EMPRESA = [
  { chave: 'estado', valor: 'ATIVA' },
  { chave: 'suspensaEm', valor: '2026-01-01T00:00:00.000Z' },
  { chave: 'empresaId', valor: '00000000-0000-4000-8000-000000000000' },
] as const;

/**
 * As **duas** rotas que esta task publica sobre `:id` de Empresa, e o corpo que cada uma leva
 * (CT-1249).
 *
 * A tabela é o conteúdo do caso: as duas declaram `@ApiNotFoundResponse` no contrato, e enumerar
 * aqui faz uma rota nova sobre `:id` que nasça sem o `404` publicado aparecer como **linha
 * faltando**, em vez de passar despercebida — que é exatamente como este caso veio a faltar.
 *
 * O corpo do `PUT` é **válido** de propósito: um corpo recusado pelo esquema pararia na borda com
 * `422` antes de o manipulador procurar a empresa, e a linha deixaria de exercitar a ausência. O
 * documento é literal e improvável porque nenhuma linha é criada — o `UPDATE` não alcança linha
 * alguma, e a unicidade nunca entra na conta.
 */
const ROTAS_DE_EMPRESA_SOBRE_UM_IDENTIFICADOR = [
  {
    nome: 'PUT /v1/master/empresas/:id',
    metodo: 'PUT',
    corpo: { nome: 'Imobiliária Que Nunca Existiu Ltda', documento: 'DOC-NUNCA-REGISTRADO' },
  },
  { nome: 'DELETE /v1/master/empresas/:id', metodo: 'DELETE' },
] as const satisfies readonly {
  readonly nome: string;
  readonly metodo: string;
  readonly corpo?: Readonly<Record<string, unknown>>;
}[];

/**
 * O nome da restrição que o servidor reporta ao recusar o documento repetido (CT-1229).
 *
 * Agulha de vazamento, e não discriminante — mesma razão de {@link RESTRICAO_DO_EMAIL_NO_SERVIDOR}:
 * a constante de produção é **privada** de `packages/db/src/empresa.ts`, e importá-la exigiria
 * publicá-la só para o teste enxergar (Lei do seam).
 */
const RESTRICAO_DO_DOCUMENTO_NO_SERVIDOR = 'empresa_documento_unique';

/**
 * O nome de uma das duas restrições do vínculo de acesso, como o servidor a reporta (CT-1239).
 *
 * Agulha de vazamento, pela mesma razão das duas acima. A `negocio.acesso_usuario_app` referencia
 * `identidade.usuario` por **duas** restrições e o PostgreSQL não garante qual dispara primeiro —
 * o que a varredura mede é que **nenhuma** delas chega ao cliente, e basta uma agulha para isso,
 * porque o corpo real não cita nome de restrição algum.
 */
const RESTRICAO_DO_VINCULO_NO_SERVIDOR = 'acesso_usuario_app_usuario_id_usuario_id_fk';

/**
 * O numeral que uma recusa **por quantidade** produziria (CT-1239).
 *
 * Ele é agulha porque a RN-15 proíbe a recusa de nomear quantidade — *"existem 3 contratos"* já é
 * dado de negócio numa persona que a ADR-0013 restringe. O valor é `1` porque é o que cada arranjo
 * do caso de fato tem, e porque **nenhuma** das cadeias do envelope canônico o contém: o código, a
 * mensagem, o campo, o motivo, as classes e a alternativa são todos alfabéticos.
 */
const NUMERAL_DE_CONTAGEM = '1';

/**
 * A rota que cada `alternativa` anunciada nomeia (CT-1233).
 *
 * Mapa **declarado**, e não `alternativa.toLowerCase()`: a alternativa é vocabulário de contrato, e
 * derivar o caminho dela por transformação de texto faria o caso aceitar qualquer valor anunciado —
 * inclusive um que não corresponda a rota alguma, que é exatamente o que a CA-14 existe para
 * reprovar. Uma alternativa nova sem entrada aqui reprova na consulta, e não num `404` que o leitor
 * confundiria com defeito da rota.
 */
const SEGMENTO_POR_ALTERNATIVA: Readonly<Record<string, string>> = { SUSPENSAO: 'suspensao' };

/** Os termos do contrato semeado. Nenhum deles é objeto de asserção — o contrato é só a agulha. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: 1500,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: false,
} as const;

// ---------------------------------------------------------------------------------------------
// O elenco da carga alcançado por este arquivo
// ---------------------------------------------------------------------------------------------

/** CT-1220 · o Admin Empresa que a carga traz na empresa A. */
const ADMIN_DA_CARGA_DE_A = '11111111-0000-4000-8000-000000000001';
const ADMIN_DA_CARGA_DE_A_EMAIL = 'admin.a@exemplo.com.br';

/** CT-1220 e CT-1220 (b) · o Usuário Empresa da mesma empresa — o perfil fora do alcance da persona. */
const USUARIO_DA_CARGA_DE_A = '11111111-0000-4000-8000-000000000002';
const USUARIO_DA_CARGA_DE_A_EMAIL = 'usuario.a@exemplo.com.br';

// ---------------------------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------------------------

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

/** O cookie do Master, com o segundo fator já cumprido pela via real. */
let cookieDoMaster: string;

/** Sufixo único por processo, para que documento e endereço nunca colidam entre execuções. */
let proximoDistintivo = 0;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookieDoMaster = await entrarComSegundoFatorCumprido(
    base,
    USUARIO_MASTER.email,
    SENHA_DA_CARGA,
    identidade.autenticacao,
  );
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('ciclo de vida do Admin Empresa pelas rotas do Master (T4)', () => {
  it(
    'CT-1220 — a listagem publica o envelope e EXATAMENTE as chaves do contrato, sem dado de negócio',
    async () => {
      // Precondição AFIRMADA, e não suposta: a sessão do Master já cumpriu o segundo fator, e por
      // isso um `403` adiante só poderia vir da autorização — nunca da restrição de sessão.
      const sessaoDoMaster = await pedir(base, CAMINHO_DA_SESSAO_CORRENTE, {
        cookie: cookieDoMaster,
      });
      expect(sessaoDoMaster.status).toBe(200);
      expect(sessaoDoMaster.corpo).toMatchObject({
        perfil: 'SYSLOC_MASTER',
        senhaProvisoria: false,
        segundoFatorPendente: false,
      });

      // --- Arranjo: o segundo Admin, a chave de permissão e o contrato ------------------------
      const segundo = await admitirAdministrador(EMPRESA_A.id, 'Aurora Andrade');

      await conceder(acessoAoNegocio, ADMIN_DA_CARGA_DE_A, EMPRESA_A.id, [CHAVE_SEMEADA]);

      const contratoId = await semearContrato(EMPRESA_A.id);
      const vinculoId = ACESSOS_DA_EMPRESA_A[0]?.id;

      // As três agulhas EXISTEM antes da chamada. Sem esta afirmação, "não vazou" seria verdade por
      // vacuidade — um corpo não pode conter o que o banco não tem.
      expect(vinculoId, 'a carga não trouxe vínculo na empresa A').toBeDefined();
      expect(await existeContrato(EMPRESA_A.id, contratoId)).toBe(true);
      expect(await contarVinculos(EMPRESA_A.id, vinculoId as string)).toBe(1);
      expect(await contarAjustesDaChave(EMPRESA_A.id, CHAVE_SEMEADA)).toBeGreaterThan(0);

      const agulhas = [contratoId, vinculoId as string, CHAVE_SEMEADA];

      // --- A listagem --------------------------------------------------------------------------
      const resposta = await pedir(base, listagemDe(EMPRESA_A.id), { cookie: cookieDoMaster });
      expect(resposta.status).toBe(200);

      const pagina = resposta.corpo as {
        itens: Record<string, unknown>[];
        total: number;
        limite: number;
        deslocamento: number;
      };

      // O envelope de lista, por igualdade de conjunto de chaves.
      expect(Object.keys(pagina).sort()).toEqual(CHAVES_DO_ENVELOPE);
      expect(pagina.total).toBe(2);
      expect(pagina.itens).toHaveLength(2);

      // --- RN-01: só os `ADMIN_EMPRESA` daquela empresa ----------------------------------------
      //
      // Igualdade de conjunto sobre os endereços, e não contenção: ela reprova nas DUAS direções —
      // o Admin que sumiu e o Usuário Empresa (ou o próprio operador) que apareceu.
      expect(pagina.itens.map((item) => item.email as string).sort()).toEqual(
        [ADMIN_DA_CARGA_DE_A_EMAIL, segundo.email].sort(),
      );

      // --- O conjunto FECHADO de chaves, item a item -------------------------------------------
      //
      // Igualdade profunda sobre as chaves de CADA item, e não do primeiro: um campo acrescentado a
      // um ramo condicional (por exemplo, só para quem está suspenso) escaparia de uma amostra.
      expect(pagina.itens.map((item) => Object.keys(item).sort())).toEqual(
        pagina.itens.map(() => CHAVES_DO_ADMINISTRADOR_PUBLICADO),
      );

      // O item inteiro do recém-admitido, por igualdade — inclusive a prévia de exclusão, que numa
      // pessoa sem registro algum é `disponivel: true` com a lista de impedimentos vazia.
      const doSegundo = pagina.itens.find((item) => item.usuarioId === segundo.usuarioId);
      expect(doSegundo).toEqual({
        usuarioId: segundo.usuarioId,
        nome: 'Aurora Andrade',
        email: segundo.email,
        estado: 'ATIVO',
        criadoEm: expect.any(String),
        exclusao: { disponivel: true, impedimentos: [] },
      });

      // --- E nada de negócio na SERIALIZAÇÃO do corpo ------------------------------------------
      //
      // A busca é sobre o texto cru, e não sobre o objeto: um dado aninhado dentro de um campo que a
      // asserção de chaves não alcança apareceria aqui.
      expect(varrerAgulhas(resposta.texto, agulhas)).toEqual([]);

      // CONTROLE POSITIVO (ADR-0032, AP-29). Sem ele, uma varredura quebrada — expressão que não
      // casa nada, lista de agulhas vazia — aprovaria um produto vazando tudo. As três agulhas são
      // plantadas no MESMO formato de serialização, e as três têm de ser acusadas.
      const corpoComAgulhas = JSON.stringify({
        itens: [{ contratoId, vinculoId, permissao: CHAVE_SEMEADA }],
      });
      expect(varrerAgulhas(corpoComAgulhas, agulhas)).toEqual(agulhas);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1220 (b) — as recusas de borda das três rotas: sem sessão, :id malformado, alvo inexistente e alvo de outro perfil',
    async () => {
      const inexistente = randomUUID();
      const rotas = [
        listagemDe(inexistente),
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${inexistente}/suspensao`,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${inexistente}/reativacao`,
      ];
      const metodos = ['GET', 'POST', 'POST'];

      for (const [indice, rota] of rotas.entries()) {
        const metodo = metodos[indice] as string;

        // --- Sem sessão: a guarda decide ANTES do manipulador --------------------------------
        const semSessao = await pedir(base, rota, { metodo });
        expect(semSessao.status, `sem sessão em ${rota}`).toBe(401);
        expect(semSessao.corpo).toEqual({
          codigo: CodigoErro.NAO_AUTENTICADO,
          mensagem: MENSAGEM_SEM_SESSAO,
        });

        // --- `:id` malformado: `422` nomeando o campo, e NUNCA `404` -------------------------
        //
        // A forma do identificador não pode virar oráculo de existência: se o malformado
        // respondesse `404`, o cliente distinguiria "id inválido" de "id válido e inexistente"
        // apenas pela grafia.
        //
        // ⚠️ **Com cookie**: a guarda global decide ANTES do manipulador, e sem sessão a mesma
        // requisição responderia `401` — que é o eixo da asserção acima, não deste.
        const malformado = await pedir(base, rota.replace(inexistente, 'nao-e-uuid'), {
          metodo,
          cookie: cookieDoMaster,
        });
        expect(malformado.status, `id malformado em ${rota}`).toBe(422);
        expect(malformado.corpo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'id',
        });

        // --- UUID bem formado e inexistente: `404`, corpo inteiro por igualdade --------------
        const ausente = await pedir(base, rota, { metodo, cookie: cookieDoMaster });
        expect(ausente.status, `alvo inexistente em ${rota}`).toBe(404);
        expect(ausente.corpo).toEqual({
          codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
          mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        });
      }

      // --- RN-06: alvo de perfil fora do alcance da persona, nas DUAS transições -------------
      //
      // A recusa nomeia o perfil exigido e o do alvo — e a sessão do alvo **continua servindo**,
      // que é o que reprova uma implementação que encerrasse sessões e só então recusasse.
      const cookieDoUsuario = await entrar(base, USUARIO_DA_CARGA_DE_A_EMAIL, SENHA_DA_CARGA);
      const sessoesAntes = await contarSessoesDaPessoa(identidade.acesso, USUARIO_DA_CARGA_DE_A);

      for (const transicao of ['suspensao', 'reativacao']) {
        const recusada = await pedir(
          base,
          `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${USUARIO_DA_CARGA_DE_A}/${transicao}`,
          { metodo: 'POST', cookie: cookieDoMaster },
        );

        expect(recusada.status, `alvo de outro perfil em ${transicao}`).toBe(422);
        expect(recusada.corpo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'id',
          detalhes: { perfilExigido: 'ADMIN_EMPRESA', perfilDoAlvo: 'USUARIO_EMPRESA' },
        });
      }

      expect(await contarSessoesDaPessoa(identidade.acesso, USUARIO_DA_CARGA_DE_A)).toBe(
        sessoesAntes,
      );
      expect(
        (await pedir(base, CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoUsuario })).status,
      ).toBe(200);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1244 — a janela declarada CHEGA AO BANCO: as duas páginas de um conjunto de 3',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Janela Ltda');

      // Três nomes ASCII e alfabeticamente distintos: a ordenação da consulta é `nome, id`, e é ela
      // que torna a IDENTIDADE do item da segunda página previsível. Acento entraria na conta da
      // colação do servidor e faria o caso medir outra coisa.
      const semeados = [];
      for (const nome of ['Ana Antunes', 'Bento Braga', 'Caio Cunha']) {
        semeados.push(await admitirAdministrador(empresaId, nome));
      }

      // --- Sem janela: a resposta ecoa o PADRÃO declarado -------------------------------------
      //
      // Ele é lido da constante, e não redigitado: um padrão alterado no código sem que ninguém
      // decidisse reprova aqui, e o caso continua válido quando o número mudar por decisão.
      const semJanela = await pedir(base, listagemDe(empresaId), { cookie: cookieDoMaster });
      expect(semJanela.status).toBe(200);
      expect(semJanela.corpo).toMatchObject({
        total: 3,
        limite: PAGINA_PADRAO_DE_ADMINISTRADORES,
        deslocamento: 0,
      });
      expect((semJanela.corpo as { itens: unknown[] }).itens).toHaveLength(3);

      // --- Primeira página: `?limite=2&deslocamento=0` ------------------------------------------
      const primeira = await pedirPagina(empresaId, 'limite=2&deslocamento=0');

      // A CONTAGEM é o que discrimina: com a janela descartada, viriam os três. `total` continua
      // sendo o do conjunto inteiro — é ele que diz ao cliente que existe página seguinte.
      expect(primeira.itens).toHaveLength(2);
      expect(primeira.total).toBe(3);
      expect(primeira.limite).toBe(2);
      expect(primeira.deslocamento).toBe(0);

      // --- Segunda página: `?limite=2&deslocamento=2` -------------------------------------------
      const segunda = await pedirPagina(empresaId, 'limite=2&deslocamento=2');

      expect(segunda.itens).toHaveLength(1);
      expect(segunda.total).toBe(3);
      expect(segunda.limite).toBe(2);
      expect(segunda.deslocamento).toBe(2);

      // A IDENTIDADE do item da segunda página, pela ordenação declarada (`nome, id`). É esta
      // asserção que reprova um mutante que honrasse `LIMIT` e descartasse `OFFSET`: ele devolveria
      // aqui os dois primeiros, e não o terceiro.
      const emailDe = (pagina: { itens: Record<string, unknown>[] }): string[] =>
        pagina.itens.map((item) => item.email as string);

      expect(emailDe(primeira)).toEqual([
        (semeados[0] as AdministradorAdmitido).email,
        (semeados[1] as AdministradorAdmitido).email,
      ]);
      expect(emailDe(segunda)).toEqual([(semeados[2] as AdministradorAdmitido).email]);

      // E a união das duas páginas é o conjunto inteiro, sem repetição nem buraco — a propriedade
      // que a paginação existe para ter, e que nenhuma das duas asserções acima afirma sozinha.
      expect([...emailDe(primeira), ...emailDe(segunda)].sort()).toEqual(
        semeados.map((admitido) => admitido.email).sort(),
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1245 — a fronteira do teto RECUSA em vez de truncar, e a cadeia de consulta é fechada',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Fronteira Ltda');
      await admitirAdministrador(empresaId, 'Nara Nunes');

      // --- Companheiro POSITIVO: o teto exato atravessa ----------------------------------------
      //
      // O par é o que discrimina. O teto é lido da constante, e não redigitado: um teto alargado no
      // código continua reprovando na perna de baixo, porque ela pede `teto + 1` da mesma fonte.
      const noTeto = await pedir(
        base,
        `${listagemDe(empresaId)}?limite=${String(MAIOR_PAGINA_DE_ADMINISTRADORES)}`,
        { cookie: cookieDoMaster },
      );
      expect(noTeto.status).toBe(200);
      expect(noTeto.corpo).toMatchObject({ limite: MAIOR_PAGINA_DE_ADMINISTRADORES });

      // --- O teto MAIS UM: `422` nomeando o campo, e NUNCA uma página truncada -----------------
      //
      // Truncar devolveria `200` com `limite` menor do que o pedido, e o cliente acreditaria ter
      // visto tudo. O corpo inteiro por igualdade é o que impede a recusa de virar outra coisa.
      const acimaDoTeto = await pedir(
        base,
        `${listagemDe(empresaId)}?limite=${String(MAIOR_PAGINA_DE_ADMINISTRADORES + 1)}`,
        { cookie: cookieDoMaster },
      );
      expect(acimaDoTeto.status).toBe(422);
      expect(acimaDoTeto.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'limite',
      });

      // --- `deslocamento` negativo: a recusa nomeia O CAMPO CULPADO ----------------------------
      const negativo = await pedir(base, `${listagemDe(empresaId)}?deslocamento=-1`, {
        cookie: cookieDoMaster,
      });
      expect(negativo.status).toBe(422);
      expect(negativo.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'deslocamento',
      });

      // --- Chave desconhecida: a entrada é FECHADA (`strictObject`) ----------------------------
      //
      // O campo nomeado é **`pagina`** — a própria chave recusada. O que o caso fixa é que a chave
      // inventada é **recusada** — com `z.object` ela seria ignorada em silêncio, e a resposta
      // descreveria uma janela que ninguém pediu — **e** que a recusa diz qual chave corrigir.
      //
      // SUT_IS_CORRECT_BECAUSE: até 2026-09-05 esta expectativa era `campo: 'limite'`, e o
      // comentário acima registrava a estranheza (*"o campo nomeado é `limite`, e não `pagina`"*).
      // O código de produção é que estava errado, e a medição é do contrato **publicado**: a §6.2 do
      // `handoff-frontend.md` promete, com todas as letras, que `limite=50&ordenar=nome` responde
      // `campo: "ordenar"`, e a fixture `listar-contratos/parametro-desconhecido` da §20.2 publica o
      // mesmo. `validarConsulta` (`comum/validacao.ts`) passou a nomear a chave, e a expectativa
      // acompanha o contrato. **Nenhuma asserção foi afrouxada**: o corpo continua comparado
      // INTEIRO por igualdade, e o `campo` ficou mais específico, não menos.
      const chaveInventada = await pedir(base, `${listagemDe(empresaId)}?pagina=2`, {
        cookie: cookieDoMaster,
      });
      expect(chaveInventada.status).toBe(422);
      expect(chaveInventada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'pagina',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1221 — a reemissão da Senha provisória parte da PRÓPRIA LINHA, sem identificador anotado',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Reemissão Ltda');

      // O identificador que a admissão devolve é DESCARTADO de propósito: é isso que faz o caso
      // provar a métrica do PRD — 100% das reemissões originadas da listagem —, em vez de repetir
      // um caso que já existe sobre a rota de reemissão.
      const admitido = await admitirAdministrador(empresaId, 'Rita Rezende');
      const senhaDaAdmissao = admitido.senhaProvisoria;

      const pagina = await listarAdministradores(empresaId);
      expect(pagina.itens).toHaveLength(1);

      const daLinha = pagina.itens[0] as { usuarioId: string; email: string };
      const usuarioIdDaListagem = daLinha.usuarioId;

      const reemissao = await pedir(
        base,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${usuarioIdDaListagem}/senha-provisoria`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );

      expect(reemissao.status).toBe(200);
      const corpo = reemissao.corpo as { usuarioId: string; senhaProvisoria: string };
      expect(Object.keys(corpo).sort()).toEqual(['senhaProvisoria', 'usuarioId']);
      // O identificador aceito é LITERALMENTE o lido da listagem.
      expect(corpo.usuarioId).toBe(usuarioIdDaListagem);

      // A senha reemitida entra.
      const comASenhaNova = await tentarEntrar(daLinha.email, corpo.senhaProvisoria);
      expect(comASenhaNova.status).toBe(200);

      // --- Companheiro negativo: a anterior é recusada de forma INDISTINGUÍVEL ----------------
      //
      // O par é obrigatório: um status igual sozinho não prova indistinguibilidade — é o corpo
      // idêntico, byte a byte, que impede o cliente de descobrir que aquele endereço existe e que
      // aquela senha já foi válida.
      const comASenhaAnterior = await tentarEntrar(daLinha.email, senhaDaAdmissao);
      const comSenhaJamaisEmitida = await tentarEntrar(daLinha.email, SENHA_JAMAIS_EMITIDA);

      expect(comASenhaAnterior.status).toBe(comSenhaJamaisEmitida.status);
      expect(comASenhaAnterior.status).not.toBe(200);
      expect(comASenhaAnterior.texto).toBe(comSenhaJamaisEmitida.texto);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1222 — suspender encerra as 2 sessões no ato, informa 2, e o acesso seguinte é recusado',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Suspensão Ltda');
      const alvo = await prepararAdministrador(empresaId, 'Sara Siqueira');
      const segundoCookie = await entrar(base, alvo.email, SENHA_TROCADA);

      // A contagem crua ANTES do ato. Ela é a precondição do caso, e não um detalhe: sem ela, "foi
      // de 2 a 0" seria uma afirmação sobre um número que ninguém mediu.
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(2);

      // As duas sessões OPERAM antes da suspensão — é o que torna o `401` posterior observável.
      for (const cookie of [alvo.cookie, segundoCookie]) {
        expect((await pedir(base, ROTA_DA_IMOBILIARIA, { cookie })).status).toBe(200);
      }

      const suspensao = await pedir(
        base,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${alvo.usuarioId}/suspensao`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );

      expect(suspensao.status).toBe(200);
      // Objeto INTEIRO por igualdade: um campo a mais no corpo do operador reprova aqui.
      expect(suspensao.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        estado: 'SUSPENSO',
        sessoesEncerradas: 2,
      });

      // A CONTAGEM distingue *encerrada* de *marcada*. O `401` abaixo, sozinho, não discrimina —
      // uma implementação que apenas marcasse a pessoa e recusasse na guarda passaria nele.
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);

      for (const cookie of [alvo.cookie, segundoCookie]) {
        const depois = await pedir(base, ROTA_DA_IMOBILIARIA, { cookie });
        expect(depois.status).toBe(401);
        expect(depois.corpo).toEqual({
          codigo: CodigoErro.NAO_AUTENTICADO,
          mensagem: MENSAGEM_SEM_SESSAO,
        });
      }

      // E ninguém entra de novo enquanto durar a suspensão.
      const entradaNova = await tentarEntrar(alvo.email, SENHA_TROCADA);
      expect(entradaNova.status).not.toBe(200);
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1223 — a colega ATIVA da mesma empresa segue operando no mesmo instante',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária das Duas Sócias Ltda');
      const alvo = await prepararAdministrador(empresaId, 'Célia Cardoso');
      const colega = await prepararAdministrador(empresaId, 'Dora Duarte');

      const sessoesDaColegaAntes = await contarSessoesDaPessoa(identidade.acesso, colega.usuarioId);
      expect(sessoesDaColegaAntes).toBe(1);

      const suspensao = await pedir(
        base,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${alvo.usuarioId}/suspensao`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );
      expect(suspensao.status).toBe(200);
      expect(suspensao.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        estado: 'SUSPENSO',
        sessoesEncerradas: 1,
      });

      // A metade que reprova um encerramento por EMPRESA em vez de por pessoa: a colega opera no
      // mesmo instante, e a contagem dela não se moveu.
      expect((await pedir(base, ROTA_DA_IMOBILIARIA, { cookie: colega.cookie })).status).toBe(200);
      expect(await contarSessoesDaPessoa(identidade.acesso, colega.usuarioId)).toBe(
        sessoesDaColegaAntes,
      );

      // O contraste, na mesma empresa e no mesmo instante: a suspensa não opera e está em zero.
      expect((await pedir(base, ROTA_DA_IMOBILIARIA, { cookie: alvo.cookie })).status).toBe(401);
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1224 — suspender quem já está suspenso confirma sem erro e informa 0 encerradas',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Idempotência Ltda');
      const alvo = await admitirAdministrador(empresaId, 'Iara Ibrahim');
      const rota = `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${alvo.usuarioId}/suspensao`;

      const primeira = await pedir(base, rota, { metodo: 'POST', cookie: cookieDoMaster });
      expect(primeira.status).toBe(200);

      const segunda = await pedir(base, rota, { metodo: 'POST', cookie: cookieDoMaster });

      // Nunca `409`, nunca `422`: repetir a suspensão de quem já está suspenso é confirmação, e não
      // conflito. A idempotência é da forma da operação, sem ramo condicional escrito na borda.
      expect(segunda.status).toBe(200);
      expect(segunda.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        estado: 'SUSPENSO',
        sessoesEncerradas: 0,
      });

      // O corpo difere do da primeira chamada APENAS em `sessoesEncerradas` — o par discrimina uma
      // implementação que mudasse o estado ou o identificador na repetição.
      const primeiroCorpo = primeira.corpo as Record<string, unknown>;
      const segundoCorpo = segunda.corpo as Record<string, unknown>;
      const diferentes = Object.keys(segundoCorpo).filter(
        (chave) => primeiroCorpo[chave] !== segundoCorpo[chave],
      );
      expect(diferentes).toEqual([]);
      // (o zero da primeira chamada é ele próprio medido: a pessoa nunca entrou)
      expect(primeiroCorpo.sessoesEncerradas).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1225 — reativar devolve a capacidade de entrar, e não as sessões encerradas',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Reativação Ltda');
      const alvo = await prepararAdministrador(empresaId, 'Vera Vasques');
      const segundoCookie = await entrar(base, alvo.email, SENHA_TROCADA);

      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(2);

      const suspensao = await pedir(
        base,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${alvo.usuarioId}/suspensao`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );
      expect(suspensao.status).toBe(200);
      expect(suspensao.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        estado: 'SUSPENSO',
        sessoesEncerradas: 2,
      });
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);

      // --- A reativação -------------------------------------------------------------------------
      const reativacao = await pedir(
        base,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${alvo.usuarioId}/reativacao`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );

      expect(reativacao.status).toBe(200);
      // Corpo INTEIRO: `sessoesEncerradas` NÃO existe aqui — a reativação não encerra nem restaura.
      expect(reativacao.corpo).toEqual({ usuarioId: alvo.usuarioId, estado: 'ATIVO' });

      // A contagem CONTINUA em zero. É a asserção que reprova uma implementação que guardasse as
      // sessões para restaurá-las (RN-04) — sem ela, "reativou" e "devolveu o que estava aberto"
      // seriam indistinguíveis.
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);

      for (const cookie of [alvo.cookie, segundoCookie]) {
        expect((await pedir(base, ROTA_DA_IMOBILIARIA, { cookie })).status).toBe(401);
      }

      // Só a entrada NOVA restabelece — e é a capacidade de entrar que a reativação devolveu.
      const cookieNovo = await entrar(base, alvo.email, SENHA_TROCADA);
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(1);
      expect((await pedir(base, ROTA_DA_IMOBILIARIA, { cookie: cookieNovo })).status).toBe(200);
    },
    LIMITE_CASO_MS,
  );
});

describe('correção cadastral e remoção definitiva do Admin Empresa (T5)', () => {
  describe('CT-1226 — a RN-06 vale nas CINCO operações sobre :id de usuário, sem deixar efeito', () => {
    /**
     * O cookie do `USUARIO_EMPRESA` da carga, aberto **uma vez**.
     *
     * Cada perna afirma que ele **continua servindo** depois da recusa. Abri-lo por perna pagaria
     * cinco derivações `scrypt` para observar a mesma propriedade, e a sessão precisa ter sido
     * criada **antes** de qualquer uma das cinco chamadas para que "continua servindo" signifique
     * algo.
     */
    let cookieDoUsuarioDeEmpresa: string;

    beforeAll(async () => {
      cookieDoUsuarioDeEmpresa = await entrar(base, USUARIO_DA_CARGA_DE_A_EMAIL, SENHA_DA_CARGA);
    }, LIMITE_CASO_MS);

    it.each(OPERACOES_SOBRE_UMA_PESSOA)(
      '$nome sobre um USUARIO_EMPRESA recusa com 422 e NÃO deixa efeito',
      async (operacao) => {
        // A linha e a contagem ANTES do ato. Sem elas, "nada mudou" seria afirmação sobre um
        // estado que ninguém mediu.
        const antes = await lerPessoaCrua(USUARIO_DA_CARGA_DE_A);
        expect(antes, 'a carga não trouxe o Usuário Empresa da empresa A').toBeDefined();
        const sessoesAntes = await contarSessoesDaPessoa(identidade.acesso, USUARIO_DA_CARGA_DE_A);

        const recusada = await pedir(
          base,
          `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${USUARIO_DA_CARGA_DE_A}${operacao.sufixo}`,
          {
            metodo: operacao.metodo,
            cookie: cookieDoMaster,
            ...('corpo' in operacao ? { corpo: operacao.corpo } : {}),
          },
        );

        // Envelope INTEIRO por igualdade de objeto: um `detalhes` a mais, ou um campo trocado,
        // reprova aqui. É o envelope da ADR-0017, com código do enum fechado.
        expect(recusada.status, `${operacao.nome} não recusou`).toBe(422);
        expect(recusada.corpo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'id',
          detalhes: { perfilExigido: 'ADMIN_EMPRESA', perfilDoAlvo: 'USUARIO_EMPRESA' },
        });

        // --- A recusa aconteceu ANTES de qualquer efeito ---------------------------------------
        //
        // Três asserções, e cada uma pega uma rota diferente pela mão: a linha idêntica CAMPO A
        // CAMPO reprova o `PUT` que gravasse antes de conferir (e o `DELETE`, que faria a leitura
        // devolver nada); a contagem de sessões inalterada reprova a suspensão que encerrasse
        // antes de conferir; e o cookie que ainda opera reprova as duas juntas do lado do cliente.
        expect(await lerPessoaCrua(USUARIO_DA_CARGA_DE_A)).toEqual(antes);
        expect(await contarSessoesDaPessoa(identidade.acesso, USUARIO_DA_CARGA_DE_A)).toBe(
          sessoesAntes,
        );
        expect(
          (await pedir(base, CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoUsuarioDeEmpresa }))
            .status,
          `${operacao.nome} derrubou a sessão do alvo recusado`,
        ).toBe(200);
      },
      LIMITE_CASO_MS,
    );
  });

  it(
    'CT-1227 — editar um Admin Empresa SUSPENSO muda o cadastro e ele CONTINUA suspenso',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Correção Ltda');
      const alvo = await admitirAdministrador(empresaId, 'Olga Osorio');

      // A suspensão acontece pela PRÓPRIA rota, e não por escrita direta: o que a edição não pode
      // desfazer é o que a produção grava, e não um estado montado à mão.
      const suspensao = await pedir(
        base,
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${alvo.usuarioId}/suspensao`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );
      expect(suspensao.status).toBe(200);
      expect(suspensao.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        estado: 'SUSPENSO',
        sessoesEncerradas: 0,
      });

      // O retrato CRU depois da suspensão — a referência contra a qual a edição é comparada.
      const antes = await lerPessoaCrua(alvo.usuarioId);
      expect(antes?.ativo, 'a suspensão não marcou a coluna').toBe(false);

      // --- A correção cadastral ----------------------------------------------------------------
      const nomeCorrigido = 'Olga Osório Corrigida';
      const emailCorrigido = `olga.${distintivo()}@exemplo.com.br`;

      const edicao = await pedir(base, edicaoDe(alvo.usuarioId), {
        metodo: 'PUT',
        cookie: cookieDoMaster,
        corpo: { nome: nomeCorrigido, email: emailCorrigido },
      });

      expect(edicao.status).toBe(200);
      const corrigido = edicao.corpo as Record<string, unknown>;
      expect(Object.keys(corrigido).sort()).toEqual(CHAVES_DO_ADMINISTRADOR_PUBLICADO);
      expect(corrigido).toMatchObject({
        usuarioId: alvo.usuarioId,
        nome: nomeCorrigido,
        email: emailCorrigido,
        // A metade categórica da ADR-0021: a edição alcança cadastro, e o estado é o de antes.
        estado: 'SUSPENSO',
      });

      // --- A linha crua: TUDO igual, menos nome e e-mail ---------------------------------------
      //
      // Comparação campo a campo contra o retrato de antes, e não `ativo === false` sozinho: a
      // igualdade alcança `perfil`, `empresa_id`, `criado_em` e `atualizado_em` juntos, de modo que
      // uma edição que re-suspendesse por conta própria, que rebaixasse o perfil ou que movesse a
      // pessoa de empresa reprova — nenhuma dessas é implicada por "continua suspenso".
      expect(await lerPessoaCrua(alvo.usuarioId)).toEqual({
        ...antes,
        nome: nomeCorrigido,
        email: emailCorrigido,
      });

      // --- E a superfície continua dizendo o mesmo ---------------------------------------------
      const pagina = await listarAdministradores(empresaId);
      expect(pagina.itens).toHaveLength(1);
      expect(pagina.itens[0]).toMatchObject({
        usuarioId: alvo.usuarioId,
        nome: nomeCorrigido,
        email: emailCorrigido,
        estado: 'SUSPENSO',
      });

      // A prova pelo comportamento, e não pela coluna: quem foi suspenso continua sem entrar. Uma
      // edição que reativasse em silêncio passaria a deixar esta entrada `200`.
      const entrada = await tentarEntrar(emailCorrigido, alvo.senhaProvisoria);
      expect(entrada.status).not.toBe(200);
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1228 — corrigido o e-mail, a pessoa entra com a Senha provisória que JÁ havia recebido',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária do Endereço Errado Ltda');

      // Admitida com o endereço errado e **sem nunca ter entrado**: a senha guardada aqui é a única
      // vez em que a superfície a devolve, e é ela que precisa sobreviver à correção.
      const alvo = await admitirAdministrador(empresaId, 'Ana Ribeiro');
      const emailAntigo = alvo.email;
      const senhaDaAdmissao = alvo.senhaProvisoria;
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);

      // O endereço novo chega em caixa MISTA de propósito: a coluna guarda minúsculas, e uma borda
      // que não normalizasse gravaria `Ana.…@…` — a pessoa deixaria de entrar com o endereço que o
      // operador lhe informou, que é o defeito que esta linha existe para pegar.
      const emailNovoBruto = `Ana.Corrigida.${distintivo()}@Exemplo.COM.BR`;
      const emailNovo = emailNovoBruto.toLowerCase();

      const correcao = await pedir(base, edicaoDe(alvo.usuarioId), {
        metodo: 'PUT',
        cookie: cookieDoMaster,
        corpo: { nome: 'Ana Ribeiro', email: emailNovoBruto },
      });

      expect(correcao.status).toBe(200);
      expect(correcao.corpo).toMatchObject({ usuarioId: alvo.usuarioId, email: emailNovo });

      // --- A credencial sobreviveu: entrada REAL, com a senha de antes da correção --------------
      //
      // Entrada de verdade, e não asserção sobre a coluna `senha_derivada`: uma conta que ancorasse
      // no e-mail e por acaso não tivesse sido tocada passaria numa asserção de coluna, e falharia
      // aqui — é a admissão da sessão que prova que a âncora é o `usuarioId`.
      const comOEnderecoNovo = await tentarEntrar(emailNovo, senhaDaAdmissao);
      expect(comOEnderecoNovo.status).toBe(200);
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(1);

      // --- Companheiro negativo: o endereço ANTIGO deixou de existir ---------------------------
      //
      // A recusa é comparada, byte a byte, com a de um endereço que nunca foi de ninguém: status
      // igual sozinho não prova indistinguibilidade, e um corpo diferente diria ao cliente que
      // aquele endereço já existiu.
      const comOEnderecoAntigo = await tentarEntrar(emailAntigo, senhaDaAdmissao);
      const comEnderecoInexistente = await tentarEntrar(
        `jamais.${distintivo()}@exemplo.com.br`,
        senhaDaAdmissao,
      );

      expect(comOEnderecoAntigo.status).toBe(comEnderecoInexistente.status);
      expect(comOEnderecoAntigo.status).not.toBe(200);
      expect(comOEnderecoAntigo.texto).toBe(comEnderecoInexistente.texto);

      // E a recusa não abriu sessão: a contagem continua em 1, a que a entrada legítima criou.
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  describe('CT-1230 — o corpo da correção é FECHADO: cada chave proibida recusa e nada é gravado', () => {
    it.each(CHAVES_PROIBIDAS_NA_CORRECAO)(
      '`$chave` no corpo recusa a requisição e a linha não muda',
      async ({ chave, valor }) => {
        const empresaId = await admitirEmpresa(`Imobiliária da Chave ${chave} Ltda`);
        const alvo = await admitirAdministrador(empresaId, 'Ivo Iglesias');
        const antes = await lerPessoaCrua(alvo.usuarioId);
        expect(antes).toBeDefined();

        const corpo = {
          nome: 'Ivo Iglesias Corrigido',
          email: `ivo.${distintivo()}@exemplo.com.br`,
          [chave]: valor,
        };

        // --- A perna de CONTRATO: a chave é nomeada onde ela viaja -------------------------------
        //
        // `validar()` publica o `campoPadrao` quando o Zod reporta `path: []`, e é exatamente o que
        // `unrecognized_keys` reporta — o nome da chave viaja em `keys`, e a rule
        // `contrato-publicado.md` manda afirmar `code` **e** `keys`. Afirmar só o `422` aprovaria
        // qualquer falha de esquema, inclusive uma que nada tem a ver com a chave excedente.
        const conferencia = ESQUEMA_DO_ADMINISTRADOR_ALTERADO.safeParse(corpo);
        expect(conferencia.success, `o esquema aceitou \`${chave}\``).toBe(false);
        const problema = conferencia.error?.issues[0] as
          | { code?: string; keys?: readonly string[] }
          | undefined;
        expect(problema?.code).toBe('unrecognized_keys');
        expect(problema?.keys).toEqual([chave]);

        // --- A perna de BORDA: a requisição inteira é recusada -----------------------------------
        const recusada = await pedir(base, edicaoDe(alvo.usuarioId), {
          metodo: 'PUT',
          cookie: cookieDoMaster,
          corpo,
        });

        expect(recusada.status, `\`${chave}\` atravessou`).toBe(422);
        expect(recusada.corpo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'corpo',
        });

        // Nada foi gravado — nem os campos VÁLIDOS que vieram junto. Um `z.object` no lugar do
        // `strictObject` responderia `200` e teria gravado os dois, ignorando a chave excedente.
        expect(await lerPessoaCrua(alvo.usuarioId)).toEqual(antes);
      },
      LIMITE_CASO_MS,
    );
  });

  describe('CT-1246 — o endereço JÁ REGISTRADO recusa a correção nomeando o campo, sem gravar e sem vazar', () => {
    /**
     * A aplicação real com **o registrador trocado** — destino em arquivo, nível `info`.
     *
     * Ela existe por uma razão só, e a razão está no docblock deste arquivo: a metade da RN-15 que
     * fala do **diário** não é observável na montagem principal, que usa `criarAplicacao()` com
     * `LOG_LEVEL=fatal` e destino padrão. O nível é `info` e não `fatal` porque a recusa sai em
     * `warn` (`FiltroExcecaoGlobal`): calá-la faria a varredura de ausência passar sobre um arquivo
     * vazio, que é a aprovação por vacuidade que o controle antivácuo abaixo existe para impedir.
     *
     * A montagem vem da casa única (`./aplicacao-instrumentada.ts`) e **não** é copiada; o
     * precedente de duas montagens na mesma suíte é `./automacao-de-cobranca.e2e.spec.ts`.
     */
    let aplicacaoComDiario: NestFastifyApplication;
    let baseComDiario: string;
    let diretorioDoDiario: string;
    let arquivoDoDiario: string;

    beforeAll(async () => {
      diretorioDoDiario = await mkdtemp(join(tmpdir(), 'sysloc-diario-master-'));
      arquivoDoDiario = join(diretorioDoDiario, 'eventos.log');

      // A porta da montagem principal é restaurada em seguida: `PORT` decide o endereço base que o
      // arcabouço de identidade declara confiável, e é lido **na composição**. Trocá-lo aqui faz a
      // instância nova confiar na origem dela; deixá-lo trocado faria uma montagem futura nascer
      // apontando para uma porta que já não é a que atende.
      const portaDaMontagemPrincipal = process.env.PORT as string;
      const porta = await reservarPorta();
      baseComDiario = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
      process.env.PORT = String(porta);

      aplicacaoComDiario = await montarAplicacaoInstrumentada(porta, [
        { token: TOKEN_LOGGER, valor: criarLogger({ nivel: 'info', destino: arquivoDoDiario }) },
      ]);

      process.env.PORT = portaDaMontagemPrincipal;
    }, LIMITE_DE_MONTAGEM_MS);

    afterAll(async () => {
      await aplicacaoComDiario?.close();

      if (diretorioDoDiario !== undefined) {
        await rm(diretorioDoDiario, { recursive: true, force: true });
      }
    }, LIMITE_DE_MONTAGEM_MS);

    it(
      'o e-mail de OUTRA pessoa recusa em `email`, nada é gravado, e nem a resposta nem o diário citam o endereço alheio',
      async () => {
        const empresaId = await admitirEmpresa('Imobiliária do Endereço Ocupado Ltda');
        const alvo = await admitirAdministrador(empresaId, 'Alice Alencar');
        const ocupante = await admitirAdministrador(empresaId, 'Beto Bezerra');

        // Precondição AFIRMADA: a mesma sessão do Master serve na montagem com diário — a sessão é
        // validada contra o banco, que é o mesmo. Sem esta linha, um `401` adiante seria lido como
        // defeito da rota, e não como o cookie não ter atravessado.
        const sessao = await pedir(baseComDiario, CAMINHO_DA_SESSAO_CORRENTE, {
          cookie: cookieDoMaster,
        });
        expect(sessao.status, 'o cookie do Master não serve na montagem com diário').toBe(200);

        const antesDoAlvo = await lerPessoaCrua(alvo.usuarioId);
        const antesDoOcupante = await lerPessoaCrua(ocupante.usuarioId);
        expect(antesDoAlvo, 'o alvo não foi admitido').toBeDefined();
        expect(antesDoOcupante, 'o ocupante do endereço não foi admitido').toBeDefined();

        const diarioAntes = await linhasDoDiario(arquivoDoDiario);

        // --- A correção que colide -------------------------------------------------------------
        //
        // O `nome` é VÁLIDO de propósito, e ele é metade do que o caso mede: uma implementação que
        // gravasse campo a campo deixaria o nome novo persistido e recusaria só o endereço — o que
        // a releitura da linha crua abaixo reprova.
        const recusada = await pedir(baseComDiario, edicaoDe(alvo.usuarioId), {
          metodo: 'PUT',
          cookie: cookieDoMaster,
          corpo: { nome: 'Alice Alencar Corrigida', email: ocupante.email },
        });

        // --- (i) O envelope INTEIRO por igualdade ----------------------------------------------
        //
        // O campo é `email`, e não `id`: é o que o cliente precisa para corrigir. O `422` sozinho
        // aprovaria uma recusa que nomeasse o campo errado, e o `500` de driver não traduzido
        // aprovaria uma que não traduzisse nada.
        expect(recusada.status).toBe(422);
        expect(recusada.corpo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'email',
          detalhes: { motivo: 'EMAIL_JA_REGISTRADO' },
        });

        // --- (ii) NADA foi gravado, nas DUAS linhas ---------------------------------------------
        //
        // Campo a campo, e nas duas pessoas: a do alvo reprova a gravação parcial do nome válido, e
        // a do ocupante reprova uma implementação que "resolvesse" a colisão mexendo no outro.
        expect(await lerPessoaCrua(alvo.usuarioId)).toEqual(antesDoAlvo);
        expect(await lerPessoaCrua(ocupante.usuarioId)).toEqual(antesDoOcupante);

        // --- (iii) RN-15: nem a resposta nem o DIÁRIO citam o que é da outra pessoa --------------
        //
        // As duas agulhas são exatamente os dois valores que o `detail` do PostgreSQL carrega — o
        // endereço da outra pessoa e o nome da restrição. A varredura é sobre o TEXTO CRU, e não
        // sobre o objeto: um dado aninhado num campo que a igualdade acima não alcança apareceria
        // aqui.
        const agulhas = [ocupante.email, RESTRICAO_DO_EMAIL_NO_SERVIDOR];
        expect(varrerAgulhas(recusada.texto, agulhas)).toEqual([]);

        const linhasNovas = (await linhasDoDiario(arquivoDoDiario)).slice(diarioAntes.length);

        // CONTROLE ANTIVÁCUO do diário: a linha da recusa **está** registrada, e é a deste ato.
        // Sem ela, "o endereço alheio não está no diário" seria verdade num arquivo vazio — e um
        // registrador mudo aprovaria um produto que vaza.
        const daRecusa = linhasNovas
          .map((linha) => JSON.parse(linha) as Record<string, unknown>)
          .filter(
            (evento) => evento.caminho === PADRAO_DA_ROTA_DE_UMA_PESSOA && evento.metodo === 'PUT',
          );

        expect(daRecusa, 'o diário não registrou a recusa deste PUT').toHaveLength(1);
        expect(daRecusa[0]).toMatchObject({
          nivel: 'warn',
          status: 422,
          codigo: CodigoErro.CAMPO_INVALIDO,
          // A linha do diário fala da MESMA recusa que o cliente recebeu — o campo e a classe do
          // motivo, e nada além deles. É a promessa do próprio filtro (*"a linha do journal fala da
          // mesma resposta"*), e ela é o que separa um diário útil de um que só diz que houve `422`.
          erro: { campo: 'email', detalhes: { motivo: 'EMAIL_JA_REGISTRADO' } },
        });

        expect(varrerAgulhas(linhasNovas.join('\n'), agulhas)).toEqual([]);

        // CONTROLE POSITIVO (ADR-0032, AP-29), e ele vale para os DOIS eixos acima porque a função
        // e a lista de agulhas são as mesmas. As duas são plantadas na forma exata em que o
        // vazamento apareceria: o erro do driver anexado como causa, que é por onde `redigirErro`
        // desceria. Sem esta linha, uma varredura quebrada — agulha vazia, comparação que não casa
        // nada — aprovaria um produto vazando tudo.
        const linhaComAgulhas = JSON.stringify({
          nivel: 'warn',
          erro: {
            causa: {
              detail: `Key (email)=(${ocupante.email}) already exists.`,
              constraint_name: RESTRICAO_DO_EMAIL_NO_SERVIDOR,
            },
          },
        });
        expect(varrerAgulhas(linhaComAgulhas, agulhas)).toEqual(agulhas);
      },
      LIMITE_CASO_MS,
    );
  });

  it(
    'CT-1236 — o administrador que JÁ tentou entrar não é removido: 422 com TENTATIVA_DE_ENTRADA',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Trilha Ltda');
      const alvo = await admitirAdministrador(empresaId, 'Tereza Tavares');

      // A trilha nasce de uma entrada REAL, ainda que malsucedida — é assim que a RN-16 a produz na
      // vida real, e escrevê-la à mão provaria a asserção contra um estado que a produção não cria.
      const tentativa = await tentarEntrar(alvo.email, SENHA_JAMAIS_EMITIDA);
      expect(tentativa.status).not.toBe(200);

      // Precondição AFIRMADA: sem ela, "a exclusão foi impedida pela trilha" seria verdade por
      // vacuidade se a trilha não existisse e o impedimento viesse de outra coisa qualquer.
      const trilhaAntes = await contarTentativasDaPessoa(alvo.usuarioId);
      expect(trilhaAntes).toBeGreaterThan(0);

      // A prévia da listagem ANTECIPA o desfecho, e vem da mesma tentativa desfeita (ADR-0030).
      const paginaAntes = await listarAdministradores(empresaId);
      expect(paginaAntes.itens[0]).toMatchObject({
        usuarioId: alvo.usuarioId,
        exclusao: {
          disponivel: false,
          motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
          impedimentos: ['TENTATIVA_DE_ENTRADA'],
          alternativa: 'SUSPENSAO',
        },
      });

      // --- A remoção é recusada ----------------------------------------------------------------
      const recusada = await pedir(base, edicaoDe(alvo.usuarioId), {
        metodo: 'DELETE',
        cookie: cookieDoMaster,
      });

      expect(recusada.status).toBe(422);
      // Envelope INTEIRO por igualdade. A classe é `TENTATIVA_DE_ENTRADA`, e **não**
      // `REGISTROS_DE_NEGOCIO` nem uma classe genérica: é o que faz o vocabulário fechado valer a
      // pena, e é o caso que uma classe única perderia por escrito.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'id',
        detalhes: {
          motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
          impedimentos: ['TENTATIVA_DE_ENTRADA'],
          alternativa: 'SUSPENSAO',
        },
      });

      // --- Nada foi consumido: a pessoa permanece, e a trilha também ---------------------------
      //
      // A ADR-0038 é literal — *"esta decisão nunca destrói auditoria"*. Uma implementação que
      // apagasse a trilha para conseguir remover passaria no `404` seguinte e falharia aqui.
      expect(await contarTentativasDaPessoa(alvo.usuarioId)).toBe(trilhaAntes);
      expect(await lerPessoaCrua(alvo.usuarioId)).toBeDefined();

      const paginaDepois = await listarAdministradores(empresaId);
      expect(paginaDepois.total).toBe(1);
      expect(paginaDepois.itens.map((item) => item.usuarioId)).toEqual([alvo.usuarioId]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1237 — o administrador virgem é removido, e SÓ ele: o colega permanece na listagem',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária dos Dois Virgens Ltda');

      // Os dois são admitidos e **nada mais**: `prepararAdministrador` entraria, e a entrada produz
      // trilha — que é impedimento (RN-16). O caminho feliz só existe enquanto ninguém tentou.
      const alvo = await admitirAdministrador(empresaId, 'Bruno Barros');
      const colega = await admitirAdministrador(empresaId, 'Clara Camargo');

      const antes = await listarAdministradores(empresaId);
      expect(antes.total).toBe(2);
      const identificadoresAntes = antes.itens.map((item) => item.usuarioId as string).sort();
      expect(identificadoresAntes).toEqual([alvo.usuarioId, colega.usuarioId].sort());

      // --- A remoção ---------------------------------------------------------------------------
      const removida = await pedir(base, edicaoDe(alvo.usuarioId), {
        metodo: 'DELETE',
        cookie: cookieDoMaster,
      });

      expect(removida.status).toBe(200);
      // Corpo INTEIRO por igualdade: um campo a mais na resposta do verbo destrutivo reprova aqui.
      expect(removida.corpo).toEqual({ usuarioId: alvo.usuarioId, removido: true });

      // --- Diferença de CONJUNTO, nos dois sentidos --------------------------------------------
      //
      // O colega é o controle: um `DELETE` sem cláusula passaria em `ausentes` e reprovaria em
      // `excedentes`. É a igualdade de conjunto, e não a contenção, que pega as duas direções.
      const depois = await listarAdministradores(empresaId);
      const identificadoresDepois = depois.itens.map((item) => item.usuarioId as string);

      expect({
        excedentes: identificadoresDepois.filter((id) => !identificadoresAntes.includes(id)),
        ausentes: identificadoresAntes.filter((id) => !identificadoresDepois.includes(id)),
      }).toEqual({ excedentes: [], ausentes: [alvo.usuarioId] });
      expect(depois.total).toBe(1);
      expect(identificadoresDepois).toEqual([colega.usuarioId]);

      // A remoção é FÍSICA (ADR-0038): a linha deixou de existir, e não ganhou uma marca de
      // retirada. O colega continua lá — a mesma leitura crua, nos dois sentidos.
      expect(await lerPessoaCrua(alvo.usuarioId)).toBeUndefined();
      expect(await lerPessoaCrua(colega.usuarioId)).toBeDefined();

      // E a credencial do removido deixou de entrar — a cascata alcançou `identidade.conta`.
      //
      // A recusa é comparada BYTE A BYTE com a de um endereço que nunca existiu, e não apenas
      // afirmada diferente de `200`: aquela sozinha passaria para `401`, `403`, `500` **e** `502`
      // igualmente, e um erro do servidor seria lido como *"a credencial foi removida"*. É a mesma
      // forma do CT-1221 e do CT-1228, que é a convenção deste arquivo.
      const entrada = await tentarEntrar(alvo.email, alvo.senhaProvisoria);
      const comEnderecoInexistente = await tentarEntrar(
        `jamais.${distintivo()}@exemplo.com.br`,
        alvo.senhaProvisoria,
      );

      expect(entrada.status).not.toBe(200);
      expect(entrada.status).toBe(comEnderecoInexistente.status);
      expect(entrada.texto).toBe(comEnderecoInexistente.texto);

      // Companheiro do caminho feliz: o colega, que nunca foi tocado, ainda entra com a dele.
      const doColega = await tentarEntrar(colega.email, colega.senhaProvisoria);
      expect(doColega.status).toBe(200);
    },
    LIMITE_CASO_MS,
  );
});

// =============================================================================================
// T6 — a correção cadastral e a REMOÇÃO DEFINITIVA da Empresa, e a prévia por item na listagem
// =============================================================================================

describe('correção cadastral e remoção definitiva da Empresa (T6)', () => {
  it(
    'CT-1229 — o documento de OUTRA empresa recusa a correção nomeando o campo, e NENHUMA das duas muda',
    async () => {
      const alvoId = await admitirEmpresa('Imobiliária do Documento Trocado Ltda');
      const ocupanteId = await admitirEmpresa('Imobiliária do Documento Ocupado Ltda');

      // O retrato de ANTES vem da própria superfície, e não de uma leitura crua: o que a CA-11
      // promete é que a listagem continue dizendo o mesmo, e é isso que se compara.
      const antes = await empresasPorIdentificador([alvoId, ocupanteId]);
      const documentoDoOcupante = String(antes[ocupanteId]?.documento);
      // Precondição AFIRMADA: a listagem trouxe o documento do ocupante, e ele não é vazio — é ele
      // que provoca a colisão E é a agulha da varredura logo abaixo.
      expect(documentoDoOcupante.length).toBeGreaterThan(0);

      // --- A correção que colide ---------------------------------------------------------------
      //
      // O `nome` é VÁLIDO de propósito, e ele é metade do que o caso mede: uma implementação que
      // gravasse campo a campo deixaria o nome novo persistido e recusaria só o documento.
      const recusada = await pedir(base, edicaoDaEmpresa(alvoId), {
        metodo: 'PUT',
        cookie: cookieDoMaster,
        corpo: { nome: 'Nome Que Não Deve Ser Gravado', documento: documentoDoOcupante },
      });

      // Envelope INTEIRO por igualdade de objeto. O campo é `documento`, e não `id`: é o que o
      // cliente precisa para corrigir. O `422` sozinho aprovaria uma recusa que nomeasse o campo
      // errado, e um `500` de driver não traduzido aprovaria uma que não traduzisse nada.
      expect(recusada.status).toBe(422);
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'documento',
        detalhes: { motivo: 'DOCUMENTO_JA_REGISTRADO' },
      });

      // --- NADA foi gravado, nas DUAS linhas ---------------------------------------------------
      //
      // Campo a campo, e nas duas empresas: a do alvo reprova a gravação parcial do nome válido, e a
      // do ocupante reprova uma implementação que "resolvesse" a colisão mexendo na outra. A
      // igualdade alcança `nome`, `documento`, `estado`, `criadaEm` e `exclusao`.
      expect(await empresasPorIdentificador([alvoId, ocupanteId])).toEqual(antes);

      // E a agulha do vazamento: nem o documento alheio nem o nome da restrição do servidor saem no
      // corpo da recusa (RN-15). O controle positivo desta varredura é o CT-1239.
      expect(
        varrerAgulhas(recusada.texto, [documentoDoOcupante, RESTRICAO_DO_DOCUMENTO_NO_SERVIDOR]),
      ).toEqual([]);
    },
    LIMITE_CASO_MS,
  );

  describe('CT-1247 — o corpo da correção de Empresa é FECHADO: cada chave proibida recusa e nada é gravado', () => {
    it.each(CHAVES_PROIBIDAS_NA_CORRECAO_DE_EMPRESA)(
      '`$chave` no corpo recusa a requisição e a linha não muda',
      async ({ chave, valor }) => {
        const empresaId = await admitirEmpresa(`Imobiliária da Chave ${chave} Ltda`);
        const antes = await lerEmpresaCrua(empresaId);
        expect(antes).toBeDefined();

        const corpo = {
          nome: 'Imobiliária Corrigida Ltda',
          documento: `DOC-${distintivo()}`,
          [chave]: valor,
        };

        // --- A perna de CONTRATO: a chave é nomeada onde ela viaja -------------------------------
        //
        // `validar()` publica o `campoPadrao` quando o Zod reporta `path: []`, e é exatamente o que
        // `unrecognized_keys` reporta — o nome da chave viaja em `keys`, e a rule
        // `contrato-publicado.md` manda afirmar `code` **e** `keys`. Afirmar só o `422` aprovaria
        // qualquer falha de esquema, inclusive uma que nada tem a ver com a chave excedente.
        const conferencia = ESQUEMA_DA_EMPRESA_ALTERADA.safeParse(corpo);
        expect(conferencia.success, `o esquema aceitou \`${chave}\``).toBe(false);
        const problema = conferencia.error?.issues[0] as
          | { code?: string; keys?: readonly string[] }
          | undefined;
        expect(problema?.code).toBe('unrecognized_keys');
        expect(problema?.keys).toEqual([chave]);

        // --- A perna de BORDA: a requisição inteira é recusada -----------------------------------
        const recusada = await pedir(base, edicaoDaEmpresa(empresaId), {
          metodo: 'PUT',
          cookie: cookieDoMaster,
          corpo,
        });

        expect(recusada.status, `\`${chave}\` atravessou`).toBe(422);
        expect(recusada.corpo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'corpo',
        });

        // Nada foi gravado — nem os campos VÁLIDOS que vieram junto. Um `z.object` no lugar do
        // `strictObject` responderia `200` e teria gravado os dois, ignorando a chave excedente. A
        // linha CRUA inteira é o que separa "recusou" de "recusou depois de gravar": ela alcança
        // `suspensa_em` e `criada_em`, que uma projeção escolhida de antemão deixaria de fora.
        expect(await lerEmpresaCrua(empresaId)).toEqual(antes);
      },
      LIMITE_CASO_MS,
    );
  });

  it(
    'CT-1248 — a correção de uma empresa SUSPENSA devolve a LINHA DA LISTAGEM, e ela continua suspensa no MESMO instante',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária Corrigida Sob Suspensão Ltda');

      // --- A precondição: ela está SUSPENSA, pela rota própria (ADR-0021) ----------------------
      //
      // O estado entra pela transição publicada, e não por escrita direta: é o mesmo caminho que o
      // operador percorre, e é o único que grava `suspensa_em` como o produto o grava.
      const suspensa = await pedir(base, `${edicaoDaEmpresa(empresaId)}/suspensao`, {
        metodo: 'POST',
        cookie: cookieDoMaster,
      });

      expect(suspensa.status).toBe(200);
      expect(suspensa.corpo).toMatchObject({ id: empresaId, estado: 'SUSPENSA' });

      // O retrato de ANTES, nas duas pontas: a linha da superfície — que é o que a resposta do `PUT`
      // promete repetir — e a linha CRUA, que é onde `suspensa_em` mora.
      const naListagemAntes = (await empresasPorIdentificador([empresaId]))[empresaId];
      const antes = await lerEmpresaCrua(empresaId);

      // Precondições AFIRMADAS, e não supostas: sem elas os valores esperados abaixo viriam do
      // próprio retrato e a igualdade final seria tautológica. `toBeInstanceOf` é o controle
      // antivácuo do instante — dois `undefined` comparados entre si passariam por vacuidade.
      expect(naListagemAntes?.estado).toBe('SUSPENSA');
      expect(naListagemAntes?.exclusao).toEqual({ disponivel: true, impedimentos: [] });
      expect(antes?.suspensaEm).toBeInstanceOf(Date);

      // --- A correção, com corpo VÁLIDO --------------------------------------------------------
      const nomeNovo = 'Imobiliária Já Corrigida Ltda';
      const documentoNovo = `DOC-${distintivo()}`;

      const corrigida = await pedir(base, edicaoDaEmpresa(empresaId), {
        metodo: 'PUT',
        cookie: cookieDoMaster,
        corpo: { nome: nomeNovo, documento: documentoNovo },
      });

      // --- A FORMA publicada, por igualdade de objeto INTEIRO -----------------------------------
      //
      // O contrato anuncia `ESQUEMA_DA_EMPRESA_LISTADA` — a linha da listagem, **com `exclusao`**.
      // Devolver a forma sem a prévia (`paraContrato` no lugar de `paraItemDaListagem`) faria o
      // documento entregue ao cliente prometer um campo que o servidor não entrega, que é a mesma
      // classe de defeito que o Gate 2 da T4 reprovou. Só a igualdade do objeto INTEIRO a pega:
      // `toMatchObject` aprovaria a resposta sem `exclusao`.
      //
      // O esperado é composto a partir do retrato da própria listagem, com **exatamente** os dois
      // campos cadastrais deslocados: `id`, `estado`, `criadaEm` e `exclusao` têm de vir os mesmos,
      // e o `nome`/`documento` têm de vir os novos. Uma resposta que ecoasse o corpo enviado sem
      // gravar, ou que devolvesse a linha antiga, reprova nesta mesma asserção.
      expect(corrigida.status).toBe(200);
      expect(corrigida.corpo).toEqual({
        ...naListagemAntes,
        nome: nomeNovo,
        documento: documentoNovo,
      });

      // --- A RN-07 na metade AFIRMATIVA: o estado não se move ------------------------------------
      //
      // O `CT-1247` prova que o esquema **recusa** a chave `estado` — propriedade do `strictObject`,
      // e não da gravação. Esta é a outra metade: uma implementação que, ao gravar `nome` e
      // `documento`, zerasse ou reescrevesse `suspensa_em`, passaria em todos os casos de recusa e
      // reprovaria só aqui. O instante é comparado com o de antes, e não apenas afirmado não nulo:
      // um instante NOVO que por acaso também é não nulo continua sendo estado movido.
      const depois = await lerEmpresaCrua(empresaId);
      expect(depois?.suspensaEm).toEqual(antes?.suspensaEm);

      // --- E o `UPDATE` de fato PERMANECE -------------------------------------------------------
      //
      // A sonda da prévia corre na mesma unidade, depois da escrita, e desfaz o próprio ensaio no
      // ponto de salvamento dela (ADR-0030). Se esse desfazimento alcançasse o `UPDATE` — ponto de
      // salvamento aberto ANTES da escrita —, a rota responderia `200` sem ter gravado nada. A linha
      // crua INTEIRA, com só os dois campos cadastrais deslocados, é o que separa as duas coisas: é
      // a mesma comparação campo a campo do `CT-1247`, na direção oposta.
      expect(depois).toEqual({ ...antes, nome: nomeNovo, documento: documentoNovo });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1231 — a empresa COM contrato vem indisponível com classe e alternativa; a vazia, disponível',
    async () => {
      const cheiaId = await admitirEmpresa('Imobiliária Cheia Ltda');
      await admitirAdministrador(cheiaId, 'Célia Cardoso');
      await semearContrato(cheiaId);

      const vaziaId = await admitirEmpresa('Imobiliária Vazia Ltda');
      await admitirAdministrador(vaziaId, 'Vera Vilela');

      const itens = await empresasPorIdentificador([cheiaId, vaziaId]);

      // --- O PAR é obrigatório -----------------------------------------------------------------
      //
      // Os dois lados por igualdade de objeto: uma prévia que respondesse sempre `false` passaria só
      // com a primeira metade, e uma que respondesse sempre `true`, só com a segunda. É o par que
      // discrimina — e o `impedimentos: []` da vazia reprova, ainda por cima, uma prévia que
      // devolvesse a lista da anterior.
      expect(itens[cheiaId]?.exclusao).toEqual({
        disponivel: false,
        motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
        impedimentos: ['REGISTROS_DE_NEGOCIO'],
        alternativa: 'SUSPENSAO',
      });
      expect(itens[vaziaId]?.exclusao).toEqual({ disponivel: true, impedimentos: [] });

      // A prévia é ARTEFATO DERIVADO (ADR-0030): compor a página não removeu empresa alguma, e as
      // duas continuam de pé com o administrador delas. Sem esta asserção, uma sonda sem ponto de
      // salvamento passaria em tudo acima e teria apagado os dois tenants.
      expect(await contarUsuariosDaEmpresa(cheiaId)).toBe(1);
      expect(await contarUsuariosDaEmpresa(vaziaId)).toBe(1);
      expect(await lerEmpresaCrua(cheiaId)).toBeDefined();
      expect(await lerEmpresaCrua(vaziaId)).toBeDefined();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1232 e CT-1233 — o DELETE da empresa com contrato recusa, ela segue ATIVA, e a alternativa ANUNCIADA é executável',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária do Contrato Vivo Ltda');
      await admitirAdministrador(empresaId, 'Rita Rocha');
      const contratoId = await semearContrato(empresaId);

      const empresasAntes = await contarEmpresasCruas();
      expect(await existeContrato(empresaId, contratoId)).toBe(true);

      // --- CT-1232: a recusa vem da integridade referencial TRADUZIDA --------------------------
      const recusada = await pedir(base, edicaoDaEmpresa(empresaId), {
        metodo: 'DELETE',
        cookie: cookieDoMaster,
      });

      expect(recusada.status).toBe(422);
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'id',
        detalhes: {
          motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
          impedimentos: ['REGISTROS_DE_NEGOCIO'],
          alternativa: 'SUSPENSAO',
        },
      });

      // --- Nada foi consumido ------------------------------------------------------------------
      //
      // As duas contagens CRUAS, e não só "a empresa ainda aparece": a de `identidade.empresa`
      // reprova uma remoção que tivesse ido adiante em outra empresa, e a do contrato reprova uma
      // implementação que apagasse o registro de negócio para conseguir remover.
      expect(await contarEmpresasCruas()).toBe(empresasAntes);
      expect(await existeContrato(empresaId, contratoId)).toBe(true);
      expect(await contarUsuariosDaEmpresa(empresaId)).toBe(1);

      const naListagem = (await empresasPorIdentificador([empresaId]))[empresaId];
      expect(naListagem?.estado).toBe('ATIVA');

      // --- CT-1233: a alternativa é LIDA do corpo, e é ela que escolhe a rota seguinte ----------
      //
      // O valor não é escrito no caso: ele sai de `detalhes.alternativa` e atravessa o mapa
      // declarado. Um `alternativa` anunciado que não correspondesse a rota alguma reprova na
      // consulta ao mapa, e não num `404` que o leitor confundiria com defeito da rota.
      const anunciada = (recusada.corpo as { detalhes: { alternativa: string } }).detalhes
        .alternativa;
      expect(anunciada).toBe('SUSPENSAO');

      const segmento = SEGMENTO_POR_ALTERNATIVA[anunciada];
      expect(
        segmento,
        `a alternativa anunciada \`${anunciada}\` não nomeia rota alguma`,
      ).toBeTypeOf('string');

      const executada = await pedir(
        base,
        `${CAMINHO_DAS_EMPRESAS}/${empresaId}/${segmento as string}`,
        { metodo: 'POST', cookie: cookieDoMaster },
      );

      expect(executada.status).toBe(200);
      expect(executada.corpo).toMatchObject({ id: empresaId, estado: 'SUSPENSA' });

      // A empresa CONTINUA existindo — a alternativa é executável, não decorativa —, e a superfície
      // confirma o estado novo.
      const depoisDaSuspensao = (await empresasPorIdentificador([empresaId]))[empresaId];
      expect(depoisDaSuspensao?.estado).toBe('SUSPENSA');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1234 — a empresa vazia com administrador virgem é removida, e SÓ ela: a de controle permanece',
    async () => {
      const alvoId = await admitirEmpresa('Imobiliária Descartável Ltda');
      const alvoAdmin = await admitirAdministrador(alvoId, 'Davi Duarte');
      const controleId = await admitirEmpresa('Imobiliária de Controle Ltda');
      await admitirAdministrador(controleId, 'Elisa Esteves');

      const antes = await identificadoresDasEmpresas();
      expect(antes).toContain(alvoId);
      expect(antes).toContain(controleId);
      expect(await contarUsuariosDaEmpresa(alvoId)).toBe(1);

      // --- A remoção ---------------------------------------------------------------------------
      const removida = await pedir(base, edicaoDaEmpresa(alvoId), {
        metodo: 'DELETE',
        cookie: cookieDoMaster,
      });

      expect(removida.status).toBe(200);
      // Corpo INTEIRO por igualdade: um campo a mais na resposta do verbo destrutivo reprova aqui.
      expect(removida.corpo).toEqual({ id: alvoId, removida: true });

      // --- Diferença de CONJUNTO, nos DOIS sentidos --------------------------------------------
      //
      // A empresa de controle é o que faz a asserção valer: um `DELETE` sem cláusula passaria em
      // `ausentes` e reprovaria em `excedentes`. `not.toContain` aprovaria uma listagem que tivesse
      // perdido as duas.
      const depois = await identificadoresDasEmpresas();
      expect({
        excedentes: depois.filter((id) => !antes.includes(id)),
        ausentes: antes.filter((id) => !depois.includes(id)),
      }).toEqual({ excedentes: [], ausentes: [alvoId] });

      // A remoção é FÍSICA (ADR-0038), e alcançou as DUAS instruções num commit só (RN-12): a linha
      // da empresa deixou de existir, e a do administrador dela também — sem marca de retirada.
      expect(await lerEmpresaCrua(alvoId)).toBeUndefined();
      expect(await contarUsuariosDaEmpresa(alvoId)).toBe(0);
      expect(await lerPessoaCrua(alvoAdmin.usuarioId)).toBeUndefined();

      // E a de controle permanece INTEIRA — a empresa e a pessoa dela.
      expect(await lerEmpresaCrua(controleId)).toBeDefined();
      expect(await contarUsuariosDaEmpresa(controleId)).toBe(1);

      // A credencial do administrador removido deixou de entrar — a cascata alcançou
      // `identidade.conta`. A recusa é comparada BYTE A BYTE com a de um endereço que nunca existiu,
      // e não apenas afirmada diferente de `200`: aquela sozinha passaria para `401`, `403`, `500`
      // **e** `502` igualmente, e um erro do servidor seria lido como *"a credencial sumiu"*.
      const entrada = await tentarEntrar(alvoAdmin.email, alvoAdmin.senhaProvisoria);
      const comEnderecoInexistente = await tentarEntrar(
        `jamais.${distintivo()}@exemplo.com.br`,
        alvoAdmin.senhaProvisoria,
      );

      expect(entrada.status).not.toBe(200);
      expect(entrada.status).toBe(comEnderecoInexistente.status);
      expect(entrada.texto).toBe(comEnderecoInexistente.texto);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1235 — empresa com 2 administradores, 1 já tentou entrar: recusa da operação INTEIRA e nada é removido',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária dos Dois Admins Ltda');
      const virgem = await admitirAdministrador(empresaId, 'Fábio Farias');
      const queTentou = await admitirAdministrador(empresaId, 'Gilda Gomes');

      // A trilha nasce de uma entrada REAL, ainda que malsucedida — é assim que a RN-16 a produz na
      // vida real, e escrevê-la à mão provaria a asserção contra um estado que a produção não cria.
      const tentativa = await tentarEntrar(queTentou.email, SENHA_JAMAIS_EMITIDA);
      expect(tentativa.status).not.toBe(200);

      // Precondições AFIRMADAS: sem elas, "a exclusão foi impedida pelo administrador inelegível"
      // seria verdade por vacuidade se a trilha não existisse.
      expect(await contarTentativasDaPessoa(queTentou.usuarioId)).toBeGreaterThan(0);
      expect(await contarTentativasDaPessoa(virgem.usuarioId)).toBe(0);
      expect(await contarUsuariosDaEmpresa(empresaId)).toBe(2);

      // --- A remoção é recusada ----------------------------------------------------------------
      const recusada = await pedir(base, edicaoDaEmpresa(empresaId), {
        metodo: 'DELETE',
        cookie: cookieDoMaster,
      });

      expect(recusada.status).toBe(422);
      // A classe é `ADMINISTRADORES_NAO_ELEGIVEIS`, e **não** `TENTATIVA_DE_ENTRADA`: a RN-15 manda
      // a recusa nomear a classe do impedimento **da empresa**, e publicar aqui a classe fina de uma
      // pessoa atribuiria à empresa um fato que é dela. O operador desce ao detalhe pela listagem de
      // administradores, onde cada item traz a própria prévia.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'id',
        detalhes: {
          motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
          impedimentos: ['ADMINISTRADORES_NAO_ELEGIVEIS'],
          alternativa: 'SUSPENSAO',
        },
      });

      // --- A recusa é da OPERAÇÃO INTEIRA (RN-12) ----------------------------------------------
      //
      // O administrador VIRGEM sobreviver é a asserção que discrimina: uma remoção em laço,
      // pessoa a pessoa e sem atomicidade, teria removido justamente ele — e passaria em toda
      // asserção sobre a empresa e sobre o que tentou entrar.
      expect(await contarUsuariosDaEmpresa(empresaId)).toBe(2);
      expect(await lerPessoaCrua(virgem.usuarioId)).toBeDefined();
      expect(await lerPessoaCrua(queTentou.usuarioId)).toBeDefined();
      expect(await lerEmpresaCrua(empresaId)).toBeDefined();
      expect((await empresasPorIdentificador([empresaId]))[empresaId]?.estado).toBe('ATIVA');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1238 — registro nasce ENTRE a leitura e o ato: a exclusão recusa nomeando o motivo, e nada é removido',
    async () => {
      const empresaId = await admitirEmpresa('Imobiliária da Corrida Ltda');
      const admin = await admitirAdministrador(empresaId, 'Hugo Horta');

      // (1) A LEITURA — a listagem anuncia a exclusão como disponível.
      const lida = (await empresasPorIdentificador([empresaId]))[empresaId];
      expect(lida?.exclusao).toEqual({ disponivel: true, impedimentos: [] });

      // (2) O evento INTERMEDIÁRIO — o registro de negócio nasce depois da leitura e antes do ato.
      // Nenhum relógio falso e nenhuma pausa fixa: a janela é a ORDEM deste caso, não o tempo.
      const contratoId = await semearContrato(empresaId);
      expect(await existeContrato(empresaId, contratoId)).toBe(true);

      // (3) O ATO — auto-verificado: o pior caso da divergência é uma recusa que nomeia o motivo.
      const recusada = await pedir(base, edicaoDaEmpresa(empresaId), {
        metodo: 'DELETE',
        cookie: cookieDoMaster,
      });

      expect(recusada.status).toBe(422);
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'id',
        detalhes: {
          motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
          impedimentos: ['REGISTROS_DE_NEGOCIO'],
          alternativa: 'SUSPENSAO',
        },
      });

      // A informação exibida é a do instante da LEITURA; a que decide é a do instante do ATO. Nada
      // foi removido — nem a empresa, nem o administrador dela.
      expect(await lerEmpresaCrua(empresaId)).toBeDefined();
      expect(await contarUsuariosDaEmpresa(empresaId)).toBe(1);
      expect(await lerPessoaCrua(admin.usuarioId)).toBeDefined();
      expect((await empresasPorIdentificador([empresaId]))[empresaId]?.exclusao).toEqual({
        disponivel: false,
        motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
        impedimentos: ['REGISTROS_DE_NEGOCIO'],
        alternativa: 'SUSPENSAO',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1239 — nenhuma das QUATRO recusas de exclusão nomeia entidade ou quantidade (com CONTROLE POSITIVO)',
    async () => {
      // --- (a) empresa CHEIA -------------------------------------------------------------------
      const cheiaId = await admitirEmpresa('Imobiliária Varrida Cheia Ltda');
      await admitirAdministrador(cheiaId, 'Iara Ipê');
      const contratoId = await semearContrato(cheiaId);
      const nomeDoLocatario = await nomeDoLocatarioDe(cheiaId);
      // Precondição AFIRMADA: a agulha existe e é não vazia. Uma agulha `''` seria encontrada em
      // todo texto pelo `includes`, e a varredura passaria a reprovar os quatro corpos por motivo
      // errado — o oposto exato da vacuidade, e igualmente inútil.
      expect(nomeDoLocatario.length).toBeGreaterThan(0);

      // --- (b) empresa com ADMINISTRADOR INELEGÍVEL --------------------------------------------
      const comAdminId = await admitirEmpresa('Imobiliária Varrida com Admin Ltda');
      const adminDaEmpresa = await admitirAdministrador(comAdminId, 'Joana Jardim');
      expect((await tentarEntrar(adminDaEmpresa.email, SENHA_JAMAIS_EMITIDA)).status).not.toBe(200);

      // --- (c) administrador com TRILHA ---------------------------------------------------------
      const comTrilhaId = await admitirEmpresa('Imobiliária Varrida da Trilha Ltda');
      const comTrilha = await admitirAdministrador(comTrilhaId, 'Karla Klein');
      expect((await tentarEntrar(comTrilha.email, SENHA_JAMAIS_EMITIDA)).status).not.toBe(200);
      expect(await contarTentativasDaPessoa(comTrilha.usuarioId)).toBeGreaterThan(0);

      // --- (d) administrador com VÍNCULO DE ACESSO ---------------------------------------------
      //
      // O vínculo nasce pela função de domínio publicada, sob o contexto de tenant REAL da empresa —
      // que é como as rotas de `/v1/usuarios` o criam. Nenhum símbolo de produção nasceu para o
      // teste enxergar algo.
      const comVinculoId = await admitirEmpresa('Imobiliária Varrida do Vínculo Ltda');
      const comVinculo = await admitirAdministrador(comVinculoId, 'Lúcia Lemos');
      await emUnidade(comVinculoId, async (tx) => {
        await garantirVinculoDeAcesso(tx, comVinculo.usuarioId);
      });
      expect(await contarVinculosDaPessoa(comVinculoId, comVinculo.usuarioId)).toBe(1);

      // --- As quatro recusas REAIS --------------------------------------------------------------
      const recusas = [
        {
          nome: 'empresa cheia',
          resposta: await pedir(base, edicaoDaEmpresa(cheiaId), {
            metodo: 'DELETE',
            cookie: cookieDoMaster,
          }),
          impedimentos: ['REGISTROS_DE_NEGOCIO'],
        },
        {
          nome: 'empresa com administrador inelegível',
          resposta: await pedir(base, edicaoDaEmpresa(comAdminId), {
            metodo: 'DELETE',
            cookie: cookieDoMaster,
          }),
          impedimentos: ['ADMINISTRADORES_NAO_ELEGIVEIS'],
        },
        {
          nome: 'administrador com trilha',
          resposta: await pedir(base, edicaoDe(comTrilha.usuarioId), {
            metodo: 'DELETE',
            cookie: cookieDoMaster,
          }),
          impedimentos: ['TENTATIVA_DE_ENTRADA'],
        },
        {
          nome: 'administrador com vínculo de acesso',
          resposta: await pedir(base, edicaoDe(comVinculo.usuarioId), {
            metodo: 'DELETE',
            cookie: cookieDoMaster,
          }),
          impedimentos: ['VINCULO_DE_ACESSO'],
        },
      ];

      // As agulhas são exatamente o que o `detail` do driver carrega e o que a RN-15 proíbe: nome de
      // tabela, identificador de entidade, nome de pessoa do negócio, numeral de contagem e nome de
      // restrição. Declaradas uma vez, aplicadas aos quatro corpos e ao controle.
      const agulhas = [
        'negocio.contrato',
        'negocio.acesso_usuario_app',
        'identidade.tentativa_login',
        contratoId,
        nomeDoLocatario,
        NUMERAL_DE_CONTAGEM,
        RESTRICAO_DO_VINCULO_NO_SERVIDOR,
      ];

      for (const recusa of recusas) {
        // A presença da CLASSE e a ausência do vazamento são provadas JUNTAS: sem o envelope por
        // igualdade, um corpo vazio passaria na varredura e não diria nada ao operador.
        expect(recusa.resposta.status, `${recusa.nome} não recusou`).toBe(422);
        expect(recusa.resposta.corpo, recusa.nome).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'id',
          detalhes: {
            motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
            impedimentos: recusa.impedimentos,
            alternativa: 'SUSPENSAO',
          },
        });

        // A varredura é sobre o TEXTO CRU, e não sobre o objeto: um dado aninhado num campo que a
        // igualdade acima não alcança apareceria aqui.
        expect(varrerAgulhas(recusa.resposta.texto, agulhas), recusa.nome).toEqual([]);
      }

      // --- CONTROLE POSITIVO (ADR-0032, AP-29) --------------------------------------------------
      //
      // A MESMA função e a MESMA lista, aplicadas a um corpo onde as agulhas foram plantadas na
      // forma exata em que o vazamento apareceria — o erro do driver anexado como causa. Sem esta
      // linha, uma varredura quebrada (agulha vazia, comparação que não casa nada) aprovaria os
      // quatro corpos acima ainda que eles vazassem tudo.
      const corpoComAgulhas = JSON.stringify({
        codigo: CodigoErro.CAMPO_INVALIDO,
        detalhes: {
          tabela: 'negocio.contrato',
          vinculo: 'negocio.acesso_usuario_app',
          trilha: 'identidade.tentativa_login',
          detail: `Key (id)=(${contratoId}) is still referenced from table "negocio.contrato".`,
          locatario: nomeDoLocatario,
          quantidade: NUMERAL_DE_CONTAGEM,
          constraint_name: RESTRICAO_DO_VINCULO_NO_SERVIDOR,
        },
      });
      expect(varrerAgulhas(corpoComAgulhas, agulhas)).toEqual(agulhas);
    },
    LIMITE_CASO_MS,
  );

  describe(
    'CT-1249 — as DUAS rotas sobre `:id` de Empresa respondem o `404` INDISTINGUÍVEL a ' +
      'identificador bem formado e inexistente',
    () => {
      it.each(ROTAS_DE_EMPRESA_SOBRE_UM_IDENTIFICADOR)(
        '$nome com UUID que nunca existiu responde 404 com o envelope canônico, e nada além dele',
        async (rota) => {
          // O identificador é **bem formado** e nunca foi de ninguém: é o que separa este eixo do
          // do `:id` malformado, que responde `422` nomeando o campo (CT-1220 (b)). Se a forma do
          // identificador virasse oráculo de existência, o cliente distinguiria "inválido" de
          // "válido e inexistente" só pela grafia.
          const inexistente = randomUUID();

          const ausente = await pedir(base, edicaoDaEmpresa(inexistente), {
            metodo: rota.metodo,
            cookie: cookieDoMaster,
            ...('corpo' in rota ? { corpo: rota.corpo } : {}),
          });

          // --- O envelope INTEIRO por igualdade de objeto ---------------------------------------
          //
          // Três coisas se provam aqui, e a igualdade é o que prova a terceira:
          //
          // 1. o `status` é `404`, e não `422` — uma empresa que **nunca existiu** não é uma
          //    exclusão impedida, e responder a recusa de impedimento no ramo de alcance nenhum
          //    diria ao operador que há algo ali a ser suspenso;
          // 2. o `status` é `404`, e não `200` — sobre um verbo que remove um **tenant inteiro**, a
          //    diferença entre `404` e um `{removida:true}` é a diferença entre o operador saber
          //    que errou o alvo e acreditar que apagou alguma coisa;
          // 3. o corpo é **exatamente** `{codigo, mensagem}` — **sem** `campo` e **sem**
          //    `detalhes`: um `campo:'id'` acrescentado só nesta recusa daria ao cliente um traço
          //    que a ausência por inexistência não tem, e `toMatchObject` o aprovaria em silêncio.
          //
          // ⚠️ DUAS FONTES, e elas são DIFERENTES — não as funda numa só.
          //    A **ADR-0017** responde pela FORMA do envelope (`{codigo, mensagem, campo?,
          //    detalhes?}`, `codigo` de enum fechado), e é isso que o `toEqual` mede. Ela **não**
          //    exige indistinguibilidade: `campo?` é opcional e PERMITIDO, e um `404` com
          //    `campo:'id'` seria conforme à forma dela — `grep -cE 'indistin|existência|oráculo|
          //    enumera'` no arquivo inteiro da 0017 volta **0**, medido.
          //    A **indistinguibilidade** é doutrina deste produto (53 ocorrências em 29 arquivos de
          //    `apps/api/src`, medido), ancorada em RN e em decisão local de cada fatia — aqui, na
          //    exigência do tech spec de validar `:id` como `z.uuid()` **antes de tocar o banco**,
          //    *"malformado é `422`, nunca `404` (evita oráculo de existência)"*. Atribuí-la à 0017
          //    manda o leitor abrir uma `Decision` onde ela não está.
          //
          // ⚠️ O QUE ESTA IGUALDADE **NÃO** DISCRIMINA: o `404` do arcabouço.
          //    O comentário anterior afirmava que sim — *"se a rota não existisse, o corpo seria
          //    `{message, error, statusCode}`"* — e o produto REFUTA: rota não casada levanta
          //    `NotFoundException`, que é `HttpException`; `FiltroExcecaoGlobal.traduzir` a
          //    encaminha a `recusaDeOutrem(404)`, e `CODIGO_POR_STATUS[404]` é
          //    `CodigoErro.RECURSO_NAO_ENCONTRADO` (`apps/api/src/comum/filtro-excecao.ts`), de modo
          //    que `doNossoCodigo` monta **exatamente** o objeto que este `toEqual` espera — sem
          //    `campo` e sem `detalhes`. Removida ou renomeada qualquer das duas rotas, este caso
          //    permanece VERDE. A prova independente está em `./contexto.e2e.spec.ts`.
          //    Quem prova que as duas rotas EXISTEM é a **âncora de superfície**
          //    (`./cobertura-de-autorizacao.e2e.spec.ts`), e é para lá que este leitor deve ir.
          //    **Não reponha o "bônus"**: ele não invalida o caso — os três mutantes do `TR-P1`
          //    seguem reprovados —, mas anuncia uma discriminação que a asserção não tem.
          expect(ausente.status, `${rota.nome} não respondeu 404`).toBe(404);
          expect(ausente.corpo, rota.nome).toEqual({
            codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
            mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
          });
        },
        LIMITE_CASO_MS,
      );
    },
  );
});

// ---------------------------------------------------------------------------------------------
// Arranjo pelas rotas reais
// ---------------------------------------------------------------------------------------------

/** O caminho da listagem de administradores de uma empresa. Composto, nunca escrito à mão. */
function listagemDe(empresaId: string): string {
  return `${CAMINHO_DAS_EMPRESAS}/${empresaId}/administradores`;
}

/** O caminho do item de usuário — o que `PUT` e `DELETE` atendem. Composto, nunca escrito à mão. */
function edicaoDe(usuarioId: string): string {
  return `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${usuarioId}`;
}

/** O caminho do item de empresa — o que `PUT` e `DELETE` da T6 atendem. Composto, nunca escrito. */
function edicaoDaEmpresa(empresaId: string): string {
  return `${CAMINHO_DAS_EMPRESAS}/${empresaId}`;
}

/** Um documento que nunca colide — a unicidade é do banco, e o caso não a exercita. */
function distintivo(): string {
  proximoDistintivo += 1;

  return `${String(Date.now()).slice(-8)}${String(proximoDistintivo).padStart(3, '0')}`;
}

/** Cria uma empresa pela rota do Master e devolve o identificador dela. */
async function admitirEmpresa(nome: string): Promise<string> {
  const criada = await pedir(base, CAMINHO_DAS_EMPRESAS, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome, documento: `DOC-${distintivo()}` },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de empresa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  return (criada.corpo as { id: string }).id;
}

/** O que a admissão de um Admin Empresa devolve, uma única vez. */
interface AdministradorAdmitido {
  readonly usuarioId: string;
  readonly email: string;
  readonly senhaProvisoria: string;
}

/** Admite um Admin Empresa pela rota do Master. */
async function admitirAdministrador(
  empresaId: string,
  nome: string,
): Promise<AdministradorAdmitido> {
  // O endereço é derivado do DISTINTIVO, e não do nome: nome do elenco carrega acento, e
  // `z.email()` recusa caractere não-ASCII na parte local — a admissão responderia `422` num campo
  // que nada tem a ver com o que o caso mede.
  const email = `admin.${distintivo()}@exemplo.com.br`;
  const admitido = await pedir(base, `${CAMINHO_DAS_EMPRESAS}/${empresaId}/admin`, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome, email },
  });

  if (admitido.status !== 201) {
    throw new Error(`a admissão respondeu ${String(admitido.status)}: ${admitido.texto}`);
  }

  return admitido.corpo as AdministradorAdmitido;
}

/** Um Admin Empresa já operante: senha trocada e uma sessão plena de pé. */
interface AdministradorOperante {
  readonly usuarioId: string;
  readonly email: string;
  readonly cookie: string;
}

/**
 * Admite um Admin Empresa e o leva ao estado **operante**, pelas rotas reais.
 *
 * A pessoa admitida entra em sessão **restrita** — a Senha provisória está pendente —, e nenhuma
 * rota de negócio a alcança nesse estado. A troca de senha é o que a torna plena.
 *
 * ⚠️ **A troca revoga as OUTRAS sessões e preserva a que a executou**
 * (`auth.api.revokeOtherSessions`, em `senha.controller.ts`). É por isso que esta função devolve
 * **uma** sessão de pé, e não zero: quem quiser duas chama `entrar` mais uma vez. Ignorar isso faria
 * a contagem crua dos casos ser 3 onde eles afirmam 2 — e a asserção passaria a descrever o
 * acessório, não o produto.
 */
async function prepararAdministrador(
  empresaId: string,
  nome: string,
): Promise<AdministradorOperante> {
  const admitido = await admitirAdministrador(empresaId, nome);
  const cookieRestrito = await entrar(base, admitido.email, admitido.senhaProvisoria);

  const troca = await pedir(base, ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie: cookieRestrito,
    corpo: { senhaAtual: admitido.senhaProvisoria, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  // A troca pode ROTACIONAR o cookie. Quando ela o faz, o anterior deixa de servir — e usar o
  // anterior faria o caso reprovar num ponto que nada tem a ver com o que ele mede.
  const cookie = troca.cookies.some(ehCookieDeSessao) ? credencialDeSessao(troca) : cookieRestrito;

  return { usuarioId: admitido.usuarioId, email: admitido.email, cookie };
}

/** Reconhece o cookie de sessão pelo **nome**, e não por substring do texto bruto. */
function ehCookieDeSessao(bruto: string): boolean {
  return ((bruto.split(';')[0] ?? '').split('=')[0] ?? '')
    .trim()
    .endsWith(SUFIXO_DO_COOKIE_DE_SESSAO);
}

/** A listagem de administradores de uma empresa, já com o status afirmado. */
async function listarAdministradores(empresaId: string): Promise<{
  itens: Record<string, unknown>[];
  total: number;
}> {
  const resposta = await pedir(base, listagemDe(empresaId), { cookie: cookieDoMaster });

  if (resposta.status !== 200) {
    throw new Error(`a listagem respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as { itens: Record<string, unknown>[]; total: number };
}

/**
 * A listagem de empresas do Master, **inteira**, já com o status afirmado.
 *
 * Ela pede o teto declarado e afirma que a página cobre o total: os casos comparam conjuntos de
 * identificadores, e uma página truncada faria uma empresa que existe parecer removida. A leitura do
 * teto vem da constante de produção, e não de um literal — um teto alargado passaria a ser exercido
 * sem que ninguém editasse este arquivo.
 *
 * ⚠️ Ela **não** pagina: se o total ultrapassar o teto, o acessório lança em vez de devolver meia
 * verdade. Uma suíte que crescer além disso precisa decidir explicitamente o que fazer, e não
 * descobrir por uma asserção de conjunto reprovando por motivo errado.
 */
async function listarEmpresasDoMaster(): Promise<Record<string, unknown>[]> {
  const resposta = await pedir(
    base,
    `${CAMINHO_DAS_EMPRESAS}?limite=${String(MAIOR_PAGINA_DE_EMPRESAS)}`,
    { cookie: cookieDoMaster },
  );

  if (resposta.status !== 200) {
    throw new Error(
      `a listagem de empresas respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  const pagina = resposta.corpo as { itens: Record<string, unknown>[]; total: number };

  if (pagina.itens.length !== pagina.total) {
    throw new Error(
      `a listagem de empresas veio truncada: ${String(pagina.itens.length)} de ${String(pagina.total)}`,
    );
  }

  return pagina.itens;
}

/** Os identificadores de todas as empresas que a listagem publica, na ordem em que ela os devolve. */
async function identificadoresDasEmpresas(): Promise<string[]> {
  return (await listarEmpresasDoMaster()).map((item) => item.id as string);
}

/**
 * Os itens da listagem indexados pelo identificador, restritos aos pedidos.
 *
 * A restrição é o que torna a comparação campo a campo possível num banco compartilhado por dezenas
 * de casos: comparar a página inteira faria um caso reprovar porque **outro** criou uma empresa.
 * Cada identificador pedido é afirmado presente — sem isso, um `undefined` silencioso passaria por
 * `toEqual` entre dois objetos vazios.
 */
async function empresasPorIdentificador(
  identificadores: readonly string[],
): Promise<Record<string, Record<string, unknown>>> {
  const itens = await listarEmpresasDoMaster();
  const indexadas: Record<string, Record<string, unknown>> = {};

  for (const alvo of identificadores) {
    const item = itens.find((candidato) => candidato.id === alvo);

    if (item === undefined) {
      throw new Error(`a listagem de empresas não trouxe ${alvo}`);
    }

    indexadas[alvo] = item;
  }

  return indexadas;
}

/**
 * Uma página da listagem com a cadeia de consulta declarada, já com o status afirmado.
 *
 * Distinta de {@link listarAdministradores} de propósito: aquela existe para o CT-1221, que só quer
 * a linha, e não aceita janela. Fundir as duas faria a assinatura carregar um parâmetro que o
 * chamador de lá não usa.
 */
async function pedirPagina(
  empresaId: string,
  consulta: string,
): Promise<{
  itens: Record<string, unknown>[];
  total: number;
  limite: number;
  deslocamento: number;
}> {
  const resposta = await pedir(base, `${listagemDe(empresaId)}?${consulta}`, {
    cookie: cookieDoMaster,
  });

  if (resposta.status !== 200) {
    throw new Error(`a listagem com ?${consulta} respondeu ${String(resposta.status)}`);
  }

  return resposta.corpo as {
    itens: Record<string, unknown>[];
    total: number;
    limite: number;
    deslocamento: number;
  };
}

/**
 * Uma tentativa de entrada **crua**, sem levantar.
 *
 * Distinta de `entrar`, da casa compartilhada, e a distinção é o objeto do CT-1221: aquela levanta
 * quando a entrada não responde `200`, e aqui a recusa **é** o que se mede — inclusive o corpo dela,
 * comparado byte a byte com o de uma senha que nunca existiu.
 */
async function tentarEntrar(email: string, senha: string): Promise<Resposta> {
  return await pedir(base, ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });
}

// ---------------------------------------------------------------------------------------------
// Observação do estado persistido
// ---------------------------------------------------------------------------------------------

// `contarSessoesDaPessoa` — **importada** de `./acessorios-de-borda.ts` desde 2026-09-02 (fecho do
// débito `D9 · F7/T4`). Ela era declarada aqui, byte a byte igual às de
// `./administracao-de-pessoas.e2e.spec.ts` e `./ciclo-de-acesso.e2e.spec.ts` — três cópias, com o
// Limiar de Três já disparado. **É esta leitura que distingue "encerrada" de "marcada"** (CT-1222),
// e a razão de ela ser crua está no docblock da casa compartilhada. Não a redeclare.

/**
 * A linha crua de `identidade.usuario`, inteira, ou `undefined` quando a pessoa não existe.
 *
 * **Todas as colunas**, e não uma projeção: é a comparação campo a campo que distingue *"recusou"*
 * de *"recusou depois de gravar"* (CT-1226, CT-1230) e *"continua suspenso"* de *"foi re-suspenso"*
 * (CT-1227) — uma projeção escolheria de antemão o que pode ter mudado, e deixaria de fora
 * exatamente a coluna que o defeito moveria. O `undefined` é conteúdo próprio: a remoção da ADR-0038
 * é **física**, e `toBeUndefined()` é o que separa isso de uma marca de retirada (CT-1237).
 *
 * Observação de estado persistido pelo acesso restrito a `identidade` — a mesma via das demais
 * leituras cruas deste arquivo. Nada foi acrescentado à produção para que ela existisse.
 */
async function lerPessoaCrua(usuarioId: string): Promise<Record<string, unknown> | undefined> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select()
    .from(usuario)
    .where(eq(usuario.id, usuarioId));

  return linha as Record<string, unknown> | undefined;
}

/**
 * A linha crua de `identidade.empresa`, inteira, ou `undefined` quando a empresa não existe.
 *
 * **Todas as colunas**, e não uma projeção: é a comparação campo a campo que distingue *"recusou"*
 * de *"recusou depois de gravar"* (CT-1247) — uma projeção escolheria de antemão o que pode ter
 * mudado, e deixaria de fora exatamente a coluna que o defeito moveria, `suspensa_em` inclusive. O
 * `undefined` é conteúdo próprio: a remoção da ADR-0038 é **física**, e `toBeUndefined()` é o que
 * separa isso de uma marca de retirada (CT-1234).
 *
 * Observação de estado persistido pelo acesso restrito a `identidade` — a mesma via das demais
 * leituras cruas deste arquivo. Nada foi acrescentado à produção para que ela existisse.
 */
async function lerEmpresaCrua(empresaId: string): Promise<Record<string, unknown> | undefined> {
  const { empresa } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select()
    .from(empresa)
    .where(eq(empresa.id, empresaId));

  return linha as Record<string, unknown> | undefined;
}

/**
 * Quantas empresas existem no banco, ao todo.
 *
 * É a contagem que separa *"a empresa alvo continua lá"* de *"nenhuma empresa foi removida"*: uma
 * remoção sem cláusula passaria na primeira e reprovaria aqui (CT-1232).
 */
async function contarEmpresasCruas(): Promise<number> {
  const { empresa } = esquemaIdentidade;

  return (await identidade.acesso.identidade.select({ id: empresa.id }).from(empresa)).length;
}

/**
 * Quantas pessoas `identidade.usuario` guarda para **uma** empresa.
 *
 * É ela que mede a atomicidade da RN-12 nos dois sentidos: `2` depois de uma recusa reprova a
 * remoção em laço que teria levado o administrador elegível (CT-1235), e `0` depois do ato prova que
 * as duas instruções correram no mesmo commit (CT-1234).
 */
async function contarUsuariosDaEmpresa(empresaId: string): Promise<number> {
  const { usuario } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.empresaId, empresaId));

  return linhas.length;
}

/**
 * As linhas não vazias do arquivo de diário, na ordem em que foram escritas (CT-1246).
 *
 * Nenhum esvaziamento é necessário e nenhuma espera existe: o destino de arquivo do registrador
 * deste produto é **síncrono** por decisão (`resolverDestino`, em `packages/shared/src/log.ts`), de
 * modo que a linha já está no arquivo quando a resposta chega ao cliente.
 */
async function linhasDoDiario(caminho: string): Promise<string[]> {
  const conteudo = await readFile(caminho, 'utf8');

  return conteudo.split('\n').filter((linha) => linha.trim() !== '');
}

/**
 * Quantas tentativas de entrada a trilha guarda para **uma** pessoa.
 *
 * É ela que torna o `CT-1236` não-vácuo nas duas pontas: afirma que a trilha **existe** antes de a
 * remoção ser tentada — senão o impedimento poderia vir de qualquer outra coisa — e que ela
 * **continua inteira** depois da recusa, que é a garantia literal da ADR-0038 (*"esta decisão nunca
 * destrói auditoria"*).
 */
async function contarTentativasDaPessoa(usuarioId: string): Promise<number> {
  const { tentativaLogin } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: tentativaLogin.id })
    .from(tentativaLogin)
    .where(eq(tentativaLogin.usuarioId, usuarioId));

  return linhas.length;
}

/** Abre uma unidade de trabalho sob o contexto de tenant da empresa informada. */
async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
}

/** O contrato semeado existe, visto sob a política de linha da própria empresa. */
async function existeContrato(empresaId: string, contratoId: string): Promise<boolean> {
  return await emUnidade(empresaId, async (tx) => {
    const linhas = await tx<{ id: string }[]>`
      SELECT id FROM negocio.contrato WHERE id = ${contratoId}
    `;

    return linhas.length === 1;
  });
}

/** Quantos vínculos de acesso com aquele identificador a empresa enxerga. */
async function contarVinculos(empresaId: string, vinculoId: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.acesso_usuario_app WHERE id = ${vinculoId}
    `;

    return Number(linha?.total ?? 0);
  });
}

/**
 * Quantos vínculos de acesso a empresa enxerga para **uma** pessoa (CT-1239).
 *
 * Ela é a precondição afirmada do arranjo do vínculo: sem ela, *"a exclusão foi impedida pelo
 * vínculo"* seria verdade por vacuidade se o vínculo não existisse e o impedimento viesse de outra
 * coisa qualquer.
 */
async function contarVinculosDaPessoa(empresaId: string, usuarioId: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total
        FROM negocio.acesso_usuario_app
       WHERE usuario_id = ${usuarioId}
    `;

    return Number(linha?.total ?? 0);
  });
}

/**
 * O nome do locatário que o contrato semeado trouxe (CT-1239).
 *
 * Ele é **agulha de vazamento**: é dado de negócio de terceiro, e a ADR-0013 restringe o alcance
 * desta persona ao que é dela. Lido do banco em vez de derivado do acessório de semeadura porque é o
 * valor que de fato existe — uma agulha derivada de constante ficaria livre para divergir do que foi
 * gravado, e a varredura passaria a procurar texto que não está em lugar nenhum.
 */
async function nomeDoLocatarioDe(empresaId: string): Promise<string> {
  const nome = await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ nome: string }[]>`
      SELECT nome FROM negocio.locatario LIMIT 1
    `;

    return linha?.nome;
  });

  // Lança em vez de devolver `undefined`, no molde dos demais acessórios de arranjo deste arquivo:
  // uma agulha vazia faria a varredura procurar por `''`, que `includes` encontra em TODO texto — a
  // aprovação por vacuidade que o controle positivo existe para impedir passaria a acontecer no
  // outro sentido, com o controle acusando tudo.
  if (nome === undefined) {
    throw new Error(`a empresa ${empresaId} não tem locatário semeado`);
  }

  return nome;
}

/**
 * Quantos ajustes daquela chave do catálogo a empresa enxerga.
 *
 * ⚠️ A tabela guarda a chave **decomposta** — `tipo` (`TELA`) numa coluna e `chave` (`financeiro`)
 * noutra —, e a agulha do caso é a chave **composta**, que é a forma em que a API a expressaria se
 * vazasse. A recomposição acontece na própria consulta, e não numa constante partida em duas: duas
 * metades escritas à mão ficariam livres para divergir da que a asserção varre.
 */
async function contarAjustesDaChave(empresaId: string, chave: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total
        FROM negocio.acesso_usuario_permissao
       WHERE tipo::text || ':' || chave = ${chave}
    `;

    return Number(linha?.total ?? 0);
  });
}

/**
 * Semeia um contrato na empresa, pelas funções de domínio publicadas por `@sysloc/db`.
 *
 * Ele existe por **uma** razão: ser a agulha do CT-1220. Nenhum campo dele é objeto de asserção — o
 * que o caso mede é que o identificador dele **não** aparece na serialização da listagem do Master.
 * Compô-lo pela interface exigiria entrar como Admin da empresa e percorrer quatro rotas de
 * cadastro, sem nada acrescentar ao que se mede.
 */
async function semearContrato(empresaId: string): Promise<string> {
  const marca = `t4-${distintivo()}`;

  const cadastros = await emUnidade(empresaId, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });
    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-${marca}`,
      tipoImovel: 'RESIDENCIAL',
      logradouro: 'Rua das Acácias',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000000',
      statusLocacao: 'DISPONIVEL',
      observacoes: null,
    });
    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const ano = await emUnidade(empresaId, lerAnoDaSerieDeContrato);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeContrato(tx, ano);
  });

  const contrato = await emUnidade(empresaId, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, ano);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano, numero },
    );
  });

  return contrato.id;
}

/** Os dados de cadastro de uma pessoa do domínio — só o que a criação exige. */
function pessoaDe(nome: string): DadosDaPessoa {
  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: distintivo(),
    rg: null,
    email: `${distintivo()}@exemplo.invalid`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * As agulhas que aparecem no texto, **na ordem em que foram declaradas**.
 *
 * Devolve a lista, e não um booleano: a igualdade sobre a lista é o que permite ao controle positivo
 * afirmar que **as três** foram acusadas — um `some()` passaria acusando uma só, e a varredura
 * quebrada continuaria aprovando um produto vazando as outras duas (AP-29).
 */
function varrerAgulhas(texto: string, agulhas: readonly string[]): string[] {
  return agulhas.filter((agulha) => texto.includes(agulha));
}
