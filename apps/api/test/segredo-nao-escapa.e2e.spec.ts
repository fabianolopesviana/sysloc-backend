/**
 * **A medição que a ADR-0032 exige** — T13 da fatia `fundacao-bancaria`.
 *
 * A `Decision` da ADR-0032 é literal quanto ao MÉTODO, e não apenas quanto ao fato: o segredo
 * operável *"não retorna por superfície alguma do produto — consulta, erro ou diagnóstico —, e a
 * ausência de vazamento é afirmada por **medição da saída real**, nunca por leitura do código"*.
 * Este arquivo é essa medição, e ele **não lê o fonte de nada**: ele envia segredo de verdade pelas
 * três rotas de pé e varre o que **saiu** — corpo de resposta, corpo de erro, arquivo de diário do
 * processo, documento publicado — mais o **estado em repouso** no banco.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | A1    | CT-823 | Os **três** corpos de resposta — registro, consulta e verificação —,
 * | CA-02 |        | serializados **por inteiro** (texto cru, `JSON.stringify` e `util.inspect` do
 * |       |        | objeto desserializado) e acompanhados da **linha de cabeçalho** de cada uma,
 * |       |        | não contêm a senha nem os bytes do material, em forma alguma; e **nenhuma
 * |       |        | linha do arquivo de diário** os carrega depois do registro **aceito** e da
 * |       |        | verificação. O material **de fato circulou** pelas três: a impressão digital
 * |       |        | publicada é a do cofre enviado, e as duas linhas de trilha do caminho de
 * |       |        | sucesso **existem** no diário. |
 * | A2    | CT-830 | Os **dois** envelopes `422` do registro — o do esquema e o da validade já
 * | CA-12 |        | encerrada — não ecoam o material nem a senha, nem em `mensagem`, nem em
 * |       |        | `campo`, nem em `detalhes`, nem no corpo inteiro, nem na linha de cabeçalho,
 * |       |        | medidos na **saída HTTP real** e não presumidos do `ZodError`. O segundo é o
 * |       |        | caminho em que o cofre **abriu** e `cifrarSegredo` correu, e é o único que
 * |       |        | publica `detalhes` — de modo que aquela superfície é varrida **com conteúdo**,
 * |       |        | afirmado por igualdade de chaves antes da varredura. |
 * | A3    | CT-831 | Nenhuma linha do arquivo de diário **do processo real** carrega a senha ou os
 * | CA-12 |        | bytes, nos **três** cenários de recusa do registro — senha que não abre,
 * |       |        | material ilegível e validade encerrada; e as linhas dos três eventos
 * |       |        | **existem**, com os três motivos internos do vocabulário na ordem das
 * |       |        | requisições e as três recusas registradas. |
 * | A4    | CT-832 | O documento publicado das três rotas declara **exatamente** o conjunto de
 * | CA-02 |        | chaves esperado — nenhuma a mais — e **nenhuma** das chaves proibidas, contando
 * | CA-12 |        | também as que aparecem em exemplo. |
 * | A5    | CT-833 | Os bytes gravados em `segredo_cifrado` **diferem** do claro e não o contêm;
 * | CA-02 |        | decifrar com outra chave de 32 bytes **levanta sem devolver nada**; e decifrar
 * | CA-12 |        | com a chave da operação devolve o par **byte a byte** — a coluna guarda o
 * |       |        | segredo, não lixo. |
 * | A8    | CT-935 | A carga da tarefa de emissão em lote tem **exatamente** as chaves
 * | CA-20 |        | `{ empresaId, loteId }`; a varredura dela em texto cru, `JSON.stringify` e
 * |       |        | `util.inspect` devolve `[]` nas três, e a varredura do **corpo de erro da
 * |       |        | fila** — o objeto que a biblioteca levanta, e que carrega a carga serializada
 * |       |        | em `command.args` — devolve `[]` também, enquanto o mesmo varredor acha todas
 * |       |        | as agulhas no objeto de controle. |
 * | A9    | CT-1024 | Nenhum dos **seis** desfechos das rotas tocadas pela fatia
 * | CA-16 |         | `integracao-bancaria-autonoma` — registro **aceito com conversão**, as três
 * | CA-18 |         | recusas dele (formato, senha e validade encerrada), a **ativação** da entrega
 * |       |         | da notícia e a **consulta** do estado — carrega o material ou a senha em
 * |       |         | corpo, linha de cabeçalho, arquivo de diário do processo ou documento
 * |       |         | publicado. Os seis status conferem por igualdade **na ordem**
 * |       |         | (`[201, 422, 422, 422, 200, 200]`), nenhum corpo é vazio, a impressão digital
 * |       |         | publicada é a do cofre enviado, `materialConvertido` é **`true`** — de modo
 * |       |         | que o **processo externo de fato correu** —, e os três motivos internos
 * |       |         | constam do diário na ordem das requisições. |
 * | A6    | os sete | **Cada** varredura é aplicada antes a um objeto de controle onde as agulhas
 * |       |        | foram plantadas canal a canal, e a lista de achados é afirmada por igualdade. |
 * | A7    | os sete | As agulhas são derivadas do dado **que de fato circulou**: a senha é a senha
 * |       |        | real enviada, e os bytes são os bytes reais apresentados. |
 *
 * Rastreabilidade: `A1 → CT-823 (CA-02)` · `A2 → CT-830 (CA-12)` · `A3 → CT-831 (CA-12)` ·
 * `A4 → CT-832 (CA-02, CA-12)` · `A5 → CT-833 (CA-02, CA-12)` · `A8 → CT-935 (CA-20)` ·
 * `A9 → CT-1024 (CA-16, CA-18)` ·
 * `A6/A7 → CT-823, CT-830, CT-831, CT-832, CT-833, CT-935, CT-1024`.
 *
 * ===========================================================================
 * TODA VARREDURA CARREGA CONTROLE POSITIVO — e a razão é medida
 * ===========================================================================
 *
 * Uma varredura que **nunca acha nada** aprovaria um produto vazando tudo: é o **AP-29**
 * (`tautological_assertion`), a causa de rejeição repetida desta fatia e da anterior. Por isso os
 * seis casos aplicam **a mesma** função de varredura ({@link ocorrenciasDe}) a um objeto de
 * controle onde cada agulha está plantada num canal diferente — mensagem, campo aninhado, item de
 * lista, `Buffer` inspecionado —, e afirmam por **igualdade** a lista de achados. Se a busca
 * quebrar, o controle reprova nomeando qual canal deixou de ser alcançado.
 *
 * E as agulhas não são cadeias inventadas: são a **senha real** enviada e os **bytes reais**
 * apresentados, em base64 e em recorte hexadecimal. Derivar a agulha do dado real é o que impede a
 * variante oca — *"procurei uma cadeia que nunca entrou"*.
 *
 * ⚠️ **As agulhas são mutuamente não-substring**, e isso é conteúdo: o recorte do material vai
 * em **hexadecimal**, e não em base64, porque um recorte em base64 seria substring do material
 * completo — o controle positivo passaria a achar duas agulhas no canal de uma, e a igualdade que
 * prova a varredura viraria uma lista escrita para bater com o efeito colateral.
 *
 * ⚠️ **A propriedade tem uma segunda ponta, e ela só apareceu quando dois materiais passaram a
 * circular no mesmo caso**: a agulha também precisa ser deste cofre, e não daquele emissor. O recorte
 * tirado a 64 bytes do começo **não era** — dois cofres da mesma autoridade têm os 107 primeiros
 * bytes idênticos (cabeçalho ASN.1 e os OIDs do PBES2/PBKDF2), de modo que as agulhas hexadecimais
 * dos dois materiais eram a **mesma cadeia**. Quem pegou foi o controle positivo, reprovando por
 * excesso — cada canal achava duas agulhas. O recorte passou a sair da **metade** do cofre, que é
 * chave privada cifrada, e o detalhe está em {@link BYTES_DO_RECORTE}.
 *
 * ===========================================================================
 * ORDEM DAS ASSERÇÕES: o que discrimina vem ANTES da igualdade que fixa
 * ===========================================================================
 *
 * É a `DECISÃO FECHADA — T10 / Gate 1` de `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts`,
 * aplicada aqui pelo mesmo motivo mecânico: o `toEqual` **aborta o caso ao falhar**, de modo que uma
 * asserção posta depois de uma igualdade que já reprovou nunca executa. Por isso, em cada caso, o
 * **controle positivo** e as asserções que discriminam o vazamento vêm antes das igualdades que
 * fixam a forma do corpo, do envelope ou do conjunto de chaves.
 *
 * ===========================================================================
 * A VERIFICAÇÃO CORRE CONTRA O DESTINO INERTE, e a escolha é deliberada
 * ===========================================================================
 *
 * Nenhum par TLS é montado aqui: a aplicação recebe o adaptador **de produção** que a composição
 * escolhe a partir de `ENDERECO_DO_PROVEDOR_BANCARIO`, declarado inerte em `apps/api/vitest.config.ts`
 * (`.invalid`, o domínio que a RFC 6761 garante não resolver). O desfecho, portanto, é `200` com
 * `aceito: false`.
 *
 * Isso **não** enfraquece a medição — fortalece. O claro é aberto **antes** de qualquer decisão de
 * rede (`criarAdaptadorSicoob` abre o invólucro e passa `pfx`/`passphrase` às opções da requisição),
 * de modo que o material e a senha atravessam exatamente o **caminho de falha** da biblioteca — que
 * é onde o achado crítico da fase anterior nasceu: o `bullmq` empurrava `job.data` como argumento de
 * comando Redis, o `ioredis` o anexava ao erro, e a redação não alcançava. Medir o desfecho feliz
 * deixaria de fora justamente a classe de vazamento que motivou a ADR-0032.
 *
 * ⚠️ Nada aqui toca o provedor real (ADR-0006): o destino não resolve por construção.
 *
 * ===========================================================================
 * O DIÁRIO É MEDIDO NOS DOIS CAMINHOS — e o de SUCESSO é o que a ADR-0032 cobra
 * ===========================================================================
 *
 * O CT-831 mede o diário nos **três** caminhos de recusa; o CT-823 o mede no caminho de **sucesso**.
 * Os dois são necessários, e o que os une é a classe que motivou a ADR: o achado crítico da fase
 * anterior nasceu **no caminho em que o segredo estava em uso** — `job.data` empurrado como argumento
 * de comando Redis, anexado ao erro pela biblioteca, sob uma chave que a redação não cobre.
 *
 * ⚠️ **"Em uso" não é sinônimo de "bem-sucedido", e a distinção custou uma rodada.** Das três recusas,
 * duas nascem **antes** de o cofre abrir — a senha não abre, os bytes não são um PKCS#12 — e uma nasce
 * **depois**: a validade encerrada. Nessa terceira, `lerMaterial` já abriu o PKCS#12 com a senha
 * apresentada e `cifrarSegredo` já correu dentro da transação quando o `warn` sai. Ela é, portanto, um
 * caminho de **recusa** com o segredo tão vivo quanto o de sucesso — e enquanto não foi exercitada, a
 * ausência de vazamento nela era afirmada por leitura do código, que é o método que a `Decision`
 * proíbe. **Enumerar superfície não basta: o que fecha é enumerar caminho.**
 *
 * A medição que fixou isto foi feita com dois mutantes, e a diferença entre eles é a prova de que o
 * buraco era de **cobertura de caminho**, não de varredura: o mesmo vazamento, com a mesma chave
 * neutra, **sobrevivia** quando plantado no registro bem-sucedido e **reprovava** quando movido para a
 * recusa. Enquanto o CT-823 não olhasse o diário, a ausência de vazamento naquela superfície era
 * afirmada **por leitura do código** — precisamente o método que a `Decision` proíbe.
 *
 * ⚠️ **Mutante de vazamento em diário neste projeto exige chave NEUTRA.** `RADICAIS_SENSIVEIS` de
 * `packages/shared/src/log.ts` casa por radical **contido** na chave normalizada: uma agulha plantada
 * sob `senhaMUTANTE` é redigida antes de alcançar o arquivo, e o verde resultante é **inconclusivo**,
 * não sobrevivência. Use `argumentos`, `contexto`, `detalhe` — nomes que a redação legitimamente não
 * alcança, que são exatamente os que a biblioteca de terceiro escolheria.
 *
 * ===========================================================================
 * AS SUPERFÍCIES DE SAÍDA, e quais destas seis medições alcança cada uma
 * ===========================================================================
 *
 * A completude é afirmada por enumeração, porque é o que permite reconhecer o que **falta**:
 *
 *   * **corpo HTTP** — CT-823 (as três rotas, em três serializações) e CT-830 (as **duas** recusas
 *     `422` do registro — a do esquema e a da validade encerrada);
 *   * **cabeçalho HTTP** — CT-823 e CT-830, pela mesma {@link superficiesDaResposta}: *"o que saiu"*
 *     inclui a linha de cabeçalho, e não apenas o corpo;
 *   * **arquivo de diário do processo real** — CT-823 no caminho de **sucesso** e CT-831 nos **três**
 *     de recusa, os dois varrendo o arquivo **inteiro**, e não o trecho do caso;
 *   * **documento publicado** — CT-832;
 *   * **estado em repouso** — CT-833, na coluna e nos bytes que ela decodifica;
 *   * **carga de tarefa na fila** — CT-935, nas três serializações da carga **e** no objeto de erro
 *     que a biblioteca de fila levanta com a carga serializada dentro. Ela entrou na enumeração com a
 *     T15, que trouxe as duas filas do produto, e é o fecho do débito `D58` da fatia
 *     `fundacao-bancaria`;
 *   * **diário e `failedReason` do PROCESSO DE TRABALHO** — ⚠️ **medidos, e NÃO aqui**: `CT-944 (e)`
 *     em `apps/worker/test/emissao-em-lote.spec.ts` e `CT-948 (e)` em
 *     `apps/worker/test/conferencia-bancaria.spec.ts`. Ver o item **15** da enumeração de caminhos
 *     abaixo para o que cada um alcança e por que a medição mora lá.
 *
 * ===========================================================================
 * ENUMERAR SUPERFÍCIE NÃO BASTA — a enumeração que fecha é a de CAMINHO
 * ===========================================================================
 *
 * A lista acima diz **onde** se olha; ela não diz **em que ramo do produto** se estava olhando. Foi
 * exatamente aí que a versão anterior deste arquivo falhou: `detalhes` constava como superfície
 * medida, mas a única recusa exercitada era a do esquema — cujo envelope não tem `detalhes` —, de
 * modo que a varredura corria sobre a cadeia literal `'undefined'`. Uma superfície pode estar na
 * lista e ainda assim ser **vácua**, se o caminho que a preenche nunca for percorrido.
 *
 * Por isso a enumeração que vale é esta, por **caminho de saída** — **quinze** ao todo, dos quais
 * **nove são medidos**: oito aqui, e o décimo quinto nas suítes do processo de trabalho. Os treze
 * primeiros são das três rotas do certificado; o décimo quarto é a **fila**, que não é caminho de
 * saída delas e entrou com a T15, quando o produto passou a ter produtor de tarefa; o **décimo
 * quinto** entrou com a T16, quando o produto passou a ter um **segundo** processo capaz de abrir o
 * segredo:
 *
 * ⚠️ **A T9 da fatia `integracao-bancaria-autonoma` acrescentou um EIXO à enumeração, e não um item:**
 * dos caminhos 2 a 5, os que apresentam material em **cifra legada** atravessam agora um **processo
 * externo** de conversão (ADR-0036), que é superfície nova de vazamento — o subprocesso recebe a
 * senha por descritor de arquivo e devolve saída e objeto de erro. O `CT-1019` mede essa superfície
 * **no nível do módulo** (`spawnargs` e a exceção crua, antes de qualquer tradução); o **CT-1024** a
 * mede **na borda**, que é onde se observa o que efetivamente sai ao cliente e ao diário. As duas são
 * necessárias, e nenhuma implica a outra. O CT-1024 acrescenta também os caminhos **16 e 17**, que
 * são as duas rotas da entrega da notícia.
 *
 *   1. registro · `422` do esquema, antes de `criarSegredoOperavel` — **medido** (CT-830, ato 1). O
 *      segredo **não entrou** no produto: o que existe é a cadeia crua que o esquema recusou;
 *   2. registro · `422` `SENHA_NAO_ABRE` — **medido** (CT-831, cenário 1: corpo e diário);
 *   3. registro · `422` `FORMATO_NAO_SUPORTADO` — **medido** (CT-831, cenário 2);
 *   4. registro · `422` `JA_VENCIDO` — **medido** (CT-830 ato 2, no corpo, no `detalhes` **com
 *      conteúdo** e no cabeçalho; CT-831 cenário 3, no diário). É o único ramo de recusa **posterior**
 *      à abertura do cofre e à invocação de `cifrarSegredo`;
 *   5. registro · `201` — **medido** (CT-823, corpo/cabeçalho/diário; CT-833, em repouso);
 *   6. consulta · `200` — **medido** (CT-823);
 *   7. verificação · `200`, com `aceito: false` pelo destino inerte — **medido** (CT-823). A decifra
 *      correu e o claro foi entregue ao cliente TLS.
 *
 * **Os seis NÃO medidos, e a razão de cada um.**
 *
 * ⚠️ **A razão NÃO é comum aos seis, e uma versão anterior deste cabeçalho a generalizava**: nos
 * itens 8 a 11 o segredo operável **não está em escopo** — ele não entrou no produto. Nos itens
 * **12 e 13 ele ESTÁ**, e o que os mantém fora da medição é outra
 * coisa: o 12 é **inalcançável por construção** (ADR-0006), e o 13 **não é alcançável por entrada do
 * cliente**, com a **cifra** — nunca o claro — sendo o que chega ao cliente de banco. Uma frase que
 * dispensasse os seis pela mesma razão dispensaria de medir justamente os dois em que há o que medir,
 * e seria contradita pelo **item 7**, três linhas acima, que escreve por extenso que ali *"a decifra
 * correu e o claro foi entregue ao cliente TLS"*. Não há defeito hoje; o que essa forma criava era
 * **licença escrita para não medir amanhã**, numa fatia de segurança.
 *
 *   8. as três rotas · `401`/`403` da guarda — a recusa acontece **antes** do manipulador, e o corpo
 *      da requisição sequer é lido; nada entra no produto. Quem mede essa recusa é a T14;
 *   9. consulta · `404` da empresa sem certificado — nada é enviado e nada é lido do banco além da
 *      ausência; a forma do envelope é medida pelo `CT-824 (d)` de
 *      `certificado-do-provedor.e2e.spec.ts`;
 *  10. verificação · `404` pela mesma ausência — `lerIdentidadeGuardada` tem **duas** pernas de recusa,
 *      e a conclusão sobrevive intacta nas duas. A do **vigente ausente** recusa **antes** de
 *      `obterEnvelopeCifradoDoVigente`, de modo que nem o envelope cifrado chega a existir no escopo; a
 *      do **envelope ausente** recusa **depois** daquela chamada, e o que ela devolveu foi `undefined`
 *      — estado que a `CHECK` da RN-13 torna irrepresentável. Em nenhuma das duas existe claro: a
 *      decifra só acontece em `verificarIdentidade`, que não chega a correr;
 *  11. verificação · `422` do corpo não vazio — recusa em `validar()`, antes de qualquer leitura;
 *  12. verificação · `200` com `aceito: true` — ⚠️ **aqui o segredo operável ESTÁ em escopo**: este
 *      caminho percorre a **mesma instrução** do item 7 (`verificarIdentidade`), dentro da qual o
 *      envelope é decifrado e o claro é entregue ao cliente mTLS; quem decide entre `true` e `false` é
 *      o par remoto, **depois** disso. O que o mantém fora é ser **inalcançável por construção** neste
 *      arquivo: exigiria par TLS de verdade, e a ADR-0006 proíbe a suíte tocar o ambiente que atende a
 *      operação. Medi-lo pertence a quem montar par próprio, e a razão do item 7 **não se estende a
 *      ele**;
 *  13. registro e verificação · `500` de falha **não traduzida** (o `throw erro` que ambos preservam)
 *      — ⚠️ **aqui o segredo operável também ESTÁ em escopo**, e no registro ele está **em claro**: o
 *      cofre já abriu e `cifrarSegredo` já correu quando uma falha de infraestrutura levanta. O que o
 *      mantém fora é não ser alcançável por entrada do cliente — exige defeito de infraestrutura —, e o
 *      que chega ao cliente de banco é a **cifra**, nunca o claro; ao solicitante sai o envelope
 *      genérico do filtro global, sem campo livre que o corpo alimente;
 *  14. fila · **medido** (CT-935) — ⚠️ **este item era o débito com gatilho `D58` da T13 da fatia
 *      `fundacao-bancaria`, e a T15 o fechou**. Enquanto nenhuma rota enfileirava, não havia carga a varrer e medir teria sido
 *      asserção vácua; a T15 trouxe as duas filas do produto, e com elas a superfície que **motivou** a
 *      ADR-0032 — na fase anterior o segredo em claro alcançou o diário por `err.command.args`, porque
 *      a biblioteca de fila empurra a carga como argumento de comando e a de acesso a anexa ao erro. O
 *      CT-935 mede as duas pontas: as chaves da carga por igualdade, e o objeto de erro **cru** da
 *      biblioteca — o canal mais exposto que existe, e o do achado original. O marcador saiu do código
 *      e a linha saiu do índice do `CLAUDE.md`, no mesmo diff;
 *  15. **processo de trabalho · diário e `failedReason`** — ⚠️ **medido, e por outro arquivo**:
 *      `CT-944 (e)` (`apps/worker/test/emissao-em-lote.spec.ts`) e `CT-948 (e)`
 *      (`apps/worker/test/conferencia-bancaria.spec.ts`). Ele entrou com a **T16**, que fez o
 *      processo de trabalho **decifrar o segredo operável**: a superfície capaz de abrir o segredo
 *      mais forte do produto passou de **um** processo para **dois**, e a ADR-0032 cobra que cada
 *      superfície de saída nova ganhe um caso que a observe de fato. As duas superfícies novas são
 *      alcançadas pelo **mesmo vetor** que originou a ADR: `apps/worker/src/fila.ts` registra
 *      `consumidor.on('failed', … { erro })` com o **objeto de exceção cru**, e a biblioteca de fila
 *      grava a mensagem dele como `failedReason` no servidor.
 *
 *      **O que é medido lá**: o **arquivo de diário inteiro** do processo (registrador com destino em
 *      arquivo, o mesmo parâmetro que a unidade systemd usa) e o **`failedReason` lido do servidor de
 *      fila**, num caminho em que o erro **sobe com o claro em escopo** — o adaptador recebe o
 *      invólucro decifrado e levanta —, com as agulhas derivadas do material e da senha que o arranjo
 *      de fato cifrou e gravou, e com controle positivo canal a canal afirmado por igualdade.
 *
 *      **O que NÃO é medido, e por quê**: o `stdout` daquele processo (o destino é o arquivo, que é o
 *      **outro** destino previsto pela unidade — medir o arquivo mede o mesmo caminho de escrita); e o
 *      trânsito do cofre até o provedor, cuja proteção é o mTLS e não a ausência, como já vale para
 *      as rotas acima.
 *
 *      ⚠️ **A medição mora lá, e não aqui, por razão estrutural**: este arquivo monta a aplicação HTTP,
 *      e o processo de trabalho é outro processo, com outra composição raiz e outro registrador.
 *      Reproduzi-lo aqui mediria uma fiação que a operação não tem.
 *
 *  16. **entrega da notícia · ativação (`200`)** — **medido** (CT-1024). ⚠️ Aqui o segredo operável
 *      **ESTÁ em escopo**: o serviço decifra o envelope do certificado vigente e o entrega ao cliente
 *      mTLS para falar com o provedor. O desfecho medido é o do **destino inerte** — a composição de
 *      produção aponta para `.invalid` (`apps/api/vitest.config.ts`) —, de modo que o claro atravessa
 *      exatamente o **caminho de falha** da biblioteca, que é onde o achado crítico da fase anterior
 *      nasceu. Medir o desfecho feliz deixaria de fora justamente a classe que motivou a ADR-0032;
 *  17. **entrega da notícia · consulta do estado (`200`)** — **medido** (CT-1024). Ela lê das
 *      colunas e **não** fala com o provedor; o que se mede é que a projeção do estado, que carrega o
 *      motivo da recusa, não traz junto nada do cofre da empresa.
 *
 * **O que continua fora do alcance destas seis superfícies, e por quê**: a saída padrão do processo
 * (aqui o registrador tem destino em arquivo, que é o outro destino previsto pela unidade systemd —
 * medir o arquivo mede o mesmo caminho de escrita); o corpo de resposta de rota **fora** desta
 * superfície (o segredo não circula por elas, e a varredura do diário é do arquivo inteiro, o que
 * alcança qualquer linha que o processo emita); e o material em trânsito na rede até o provedor, que
 * é onde o cofre **deve** ir e cuja proteção é o mTLS, não a ausência.
 *
 * ===========================================================================
 * DUAS APLICAÇÕES, e cada uma pela propriedade que só ela oferece
 * ===========================================================================
 *
 * A aplicação da montagem entra por `Test.createTestingModule`, com **um único** provedor
 * substituído — `TOKEN_LOGGER`, por um registrador cujo destino é um **arquivo temporário**. É o
 * caminho legítimo já praticado por `packages/shared/test/log.spec.ts`, e é o mesmo parâmetro
 * `destino` que a unidade systemd usa em operação; sem ele não existe *"arquivo de diário do processo
 * real"* a varrer. `criarAplicacao()` **não ganhou parâmetro**, nada em `apps/api/src` foi tocado, e
 * nenhum outro provedor é substituído.
 *
 * O **CT-832** monta a segunda, e ela é a de produção (`criarAplicacao()`), dentro do próprio caso e
 * fechada em `onTestFinished`: o documento OpenAPI é publicado por `SwaggerModule.setup` lá dentro, e
 * gerá-lo aqui a partir de um `DocumentBuilder` próprio seria escrever à mão a descrição que a
 * ADR-0016 manda derivar — o caso passaria a medir o documento **do teste**, não o do produto.
 *
 * ===========================================================================
 * NENHUM COMPORTAMENTO DE PRODUÇÃO É TOCADO POR ESTA TASK
 * ===========================================================================
 *
 * Se alguma destas seis medições achar vazamento, a correção pertence à task **dona do vetor**, e
 * esta registra o achado. Corrigi-la aqui fecharia **um caminho** deixando os outros abertos, que é
 * literalmente o padrão que a §7 da `.claude/rules/nao-regressao.md` documenta com quatro rodadas.
 *
 * A única escrita da T13 fora de `apps/api/test/` foi **comentário puro**: o marcador do débito com
 * gatilho `D58`, junto de `verificarIdentidade`, em
 * `apps/api/src/integracoes-bancarias/certificado.service.ts`. Ele agendava a medição da superfície
 * `fila` — o item 14 acima —, e **a T15 o cumpriu**: o CT-935 mede, e o marcador saiu do código e do
 * índice do `CLAUDE.md` no mesmo diff. Marcador de débito já resolvido é pior que nenhum, porque
 * mente sobre o estado do código.
 *
 * ===========================================================================
 * MUTANTE EXECUTADO (2026-08-15) — a prova de falsificação do CT-832
 * ===========================================================================
 *
 * Cinco dos seis casos são **comportamentais** — enviam segredo real e observam a saída —, e por
 * isso a exigência de prova de falsificação da `.claude/rules/testing-stack.md` não incide sobre
 * eles; o controle positivo embutido em cada um é a rede que o P4 do Protocolo Antirregressão pede.
 * O **CT-832 é diferente**: ele inspeciona uma **descrição** (o documento publicado), e é asserção
 * dessa natureza que a regra obriga a falsificar. A suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — `apps/api` alcança
 * `@syslocbr/contracts` pela fronteira do pacote e leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `277 passed` (`32` arquivos);
 *   * **M7 · o esquema de saída volta a declarar o segredo** — `senha: z.string().optional()`
 *     acrescentado a `esquemaDoCertificado`, em `packages/contracts/src/integracao-bancaria.ts`:
 *     `1 failed | 276 passed`, **só no CT-832**, e a reprovação é a asserção que discrimina —
 *     *"expected [ 'senha' ] to deeply equal []"*, em `proibidasEntre(declaradas)`. Ela **nomeia a
 *     chave ofensora**, que é o efeito para o qual a ordem das asserções foi escolhida: a igualdade
 *     de conjunto teria abortado o caso exibindo dezessete nomes;
 *   * **por que o campo é opcional, e não obrigatório** — obrigatório muda `z.infer`, e `Certificado`
 *     passaria a exigir a senha de todo produtor: a compilação cai antes de a suíte rodar e o
 *     mutante fica **inconclusivo**. Opcional entra em `properties` sem entrar em `required`, que é
 *     o suficiente para a coleta deste caso enxergar. É o mesmo raciocínio, e o mesmo precedente, do
 *     `MT11-3` registrado em `contrato-publicado.e2e.spec.ts`;
 *   * **reversão** — o fonte foi restaurado do backup, conferido por `git diff` vazio e por `grep`
 *     do mutante (zero ocorrências), o `dist/` foi reconstruído por `pnpm build`, e o controle voltou
 *     a `277 passed`.
 *
 * ===========================================================================
 * MUTANTE EXECUTADO (2026-08-15) — M-D′, o vazamento no CAMINHO DE SUCESSO
 * ===========================================================================
 *
 * O CT-823 é comportamental, e a exigência de falsificação da `.claude/rules/testing-stack.md` não
 * incide sobre ele. Este mutante foi executado assim mesmo, e por outra razão: ele é a **rede do P4**
 * do Protocolo Antirregressão para um defeito **medido** — a superfície `diário × caminho de sucesso`
 * não tinha agulha em escopo, e um vazamento real ali passava verde.
 *
 *   * **M-D′ · a forma exata do achado da fase anterior** — `argumentos: [entrada.senha,
 *     entrada.material]` acrescentado ao `logger.info` do registro **bem-sucedido** de
 *     `certificado.controller.ts`. Chave **neutra**, como a de uma biblioteca de terceiro que anexa o
 *     que recebeu;
 *   * **antes desta correção**: `277 passed` — **o mutante SOBREVIVIA**, com a senha real e o
 *     material inteiro em base64 gravados no arquivo de diário do processo real;
 *   * **depois desta correção**: `1 failed | 276 passed`, **só no CT-823**, e a reprovação nomeia a
 *     linha e as duas agulhas — *"expected [ 'linha 1/senha', …(1) ] to deeply equal []"*, com
 *     `linha 1/senha` e `linha 1/materialEmBase64`;
 *   * **reversão** — o fonte restaurado do backup e conferido por `sha256sum` idêntico, `grep` do
 *     mutante em zero, `git status` do controlador sem modificação e o `dist/` reconstruído.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS (2026-08-15) — M-JV e M-JW, o caminho `JA_VENCIDO`
 * ===========================================================================
 *
 * Pela mesma razão do M-D′, e sobre o caminho que ele deixou de fora: o `JA_VENCIDO` é o único ramo de
 * saída do registro em que o cofre **abriu** e `cifrarSegredo` correu, e nenhuma das cinco medições o
 * exercitava. Os dois mutantes atacam as duas superfícies daquele ramo, e o alvo do vazamento é a
 * **senha que abriu o cofre** — não uma cadeia recusada pelo esquema.
 *
 *   * **M-JV · o segredo no `detalhes` da recusa** — `contexto: segredo.abrir().senha` acrescentado ao
 *     `detalhes` do `ErroDeAplicacao` de `certificado.service.ts`, sob chave **neutra**. Resultado:
 *     `3 failed | 274 passed`, e no CT-830 a reprovação nomeia **quatro** superfícies com a agulha —
 *     *"envelope do vencimento (detalhes)/senhaDoVencido"* mais as três serializações da resposta
 *     (texto cru, json, inspeção). O CT-831 também reprova, em `linha 11/senhaDoVencido`: o filtro
 *     global registra a exceção inteira, de modo que um `detalhes` envenenado alcança o diário. O
 *     `CT-824 (c)` de `certificado-do-provedor.e2e.spec.ts` reprova junto — **rede a mais**, não
 *     divergência, pelo mesmo raciocínio com que o Gate 1 leu o CT-834;
 *   * **M-JW · o segredo no `warn` do ramo** — `argumentos: [segredo.abrir().senha,
 *     segredo.abrir().material.toString('base64')]` acrescentado ao `logger.warn` do `JA_VENCIDO`,
 *     chave **neutra**, na forma exata do achado da fase anterior. Resultado: `1 failed | 276 passed`,
 *     **só no CT-831**, nomeando `linha 10/senhaDoVencido` e `linha 10/materialVencidoEmBase64`;
 *   * **o que o M-JV corrigiu no PRÓPRIO caso** — a primeira execução dele reprovou o CT-830 na
 *     **âncora antivácuo** do `detalhes`, que era uma igualdade de chaves e abortava o caso antes da
 *     varredura: a reprovação nomeava a **chave** (`contexto`) e nunca a **agulha**. A âncora passou a
 *     ser mínima — *"tem conteúdo"* —, e quem fixa a forma é a igualdade de corpo inteiro no fim. É a
 *     mesma lei de ordem que o cabeçalho já declara, aplicada a uma asserção que a violava;
 *   * **reversão** — o fonte restaurado do backup e conferido por `sha256sum` idêntico, `grep` dos dois
 *     mutantes em zero, `git diff` do serviço limitado ao marcador de débito, e o `dist/`
 *     reconstruído; o controle voltou a `277 passed`.
 *
 * ===========================================================================
 * O `D52 · F4/T16` foi MEDIDO na T9, e o gatilho dele NÃO disparou
 * ===========================================================================
 *
 * O marcador de `apps/worker/test/varredura-de-segredo.ts` declara que o gatilho é *"o terceiro
 * consumidor do molde fora de `apps/worker/test/`, ou a primeira alteração das formas buscadas"*, e a
 * recomendação da T9 mandava medir se o CT-1024 exigiria **canal novo de busca** para alcançar a
 * saída e o objeto de erro do processo externo de conversão.
 *
 * **Não exigiu, e a razão é estrutural**: nada da saída do conversor atravessa a fronteira do módulo
 * — ela é lida para classificar e **descartada** (`conversao-do-material.ts`, e o CT-1019 o mede no
 * nível do módulo). Se atravessasse, chegaria ao cliente por **corpo** ou **cabeçalho** e ao operador
 * pelo **arquivo de diário**, e os três já são canais desta suíte: {@link superficiesDaResposta} e
 * {@link superficiesDoDiario}, aplicados pela mesma {@link ocorrenciasDe} de sempre. **Nenhuma forma
 * buscada mudou** e nenhum canal nasceu — o CT-1024 consome o molde tal como ele já estava. O débito,
 * portanto, **não se move**, e endurecer um dos lados deixando o outro para trás — que é exatamente a
 * divergência que o marcador descreve — não chegou a ser tentado.
 *
 * ===========================================================================
 * O CT-1024 é COMPORTAMENTAL, e por isso não ganha mutante
 * ===========================================================================
 *
 * Ele envia segredo real pelas quatro rotas e observa o que saiu; a `.claude/rules/testing-stack.md`
 * escopa a prova de falsificação por execução à asserção **estática**, e o P4 do Protocolo
 * Antirregressão manda, para a comportamental, **declarar em uma linha qual asserção discrimina**.
 *
 * **A asserção que discrimina é `ocorrenciasDe(...) → []` sobre as superfícies de cada desfecho e
 * sobre o arquivo de diário inteiro**, sustentada pelo controle positivo que a antecede: qualquer uma
 * das nove agulhas que apareça em qualquer canal produz um rótulo `<superfície>/<agulha>` na lista, e
 * a igualdade reprova nomeando o canal e a agulha. O par
 * `impressaoDigital` + `materialConvertido: true` é o que impede o verde por vacuidade — o primeiro
 * prova que o cofre circulou, o segundo que o **subprocesso correu**.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila, a credencial, a chave e o MATERIAL (ADR-0006, invariante 3)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias e da memória deste processo. Nenhuma coordenada de conexão é lida
 * do ambiente: o ambiente é **montado** a partir do que os acessórios devolvem. A chave de cifra é
 * sorteada por execução — é isso que permite ao CT-833 conhecer a chave **certa** e exibir uma
 * **outra** de 32 bytes sem que nenhuma das duas exista fora deste processo. O material PKCS#12 é
 * gerado em execução por `packages/cobranca-bancaria/test/material-de-teste.ts`, e nenhum `.pfx`
 * entra na árvore versionada.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { EMPRESA_A, SENHA_DA_CARGA } from '@sysloc/db';
import {
  type CargaDaEmissaoEmLote,
  CodigoErro,
  criarLogger,
  decifrarSegredo,
  ErroDeSegredoAdulterado,
  FILA_DA_EMISSAO_EM_LOTE,
  type Logger,
} from '@sysloc/shared';
import { MAIOR_MATERIAL_CODIFICADO } from '@syslocbr/contracts';
import { Queue } from 'bullmq';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth`, `@sysloc/db`,
//        `@sysloc/shared` e `@sysloc/cobranca-bancaria` por CAMINHO DE ARQUIVO, fora do `exports` e
//        do `files` daqueles manifestos. As dependências de workspace estão declaradas, então não há
//        dependência oculta; o que não existe é FRONTEIRA para os diretórios `test/`.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de quatro pacotes e todos os consumidores,
//        nenhum deles no escopo desta task — que declara `5.2 Arquivos a Modificar: N/A`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import {
  type AutoridadeDeTeste,
  gerarAutoridadeDeTeste,
  gerarMaterialDeTeste,
  type MaterialDeTeste,
} from '../../../packages/cobranca-bancaria/test/material-de-teste.ts';
import { conexaoDeMigracao } from '../../../packages/db/test/banco-efemero.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import {
  comandoFila,
  type FilaEfemera,
  redisEfemero,
} from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import {
  CAMINHO_DA_COBRANCA_BANCARIA,
  SEGMENTO_DAS_EMISSOES,
} from '../src/cobranca-bancaria/cobranca-bancaria.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_LOGGER,
} from '../src/configuracao/ambiente.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DA_CONSULTA,
  SEGMENTO_DA_VERIFICACAO,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import {
  SEGMENTO_DA_ATIVACAO,
  SEGMENTO_DA_ENTREGA_DA_NOTICIA,
} from '../src/integracoes-bancarias/entrega-da-noticia.controller.ts';
import { SEGMENTO_DA_IDENTIDADE } from '../src/integracoes-bancarias/identidade.controller.ts';
import { CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
// O cliente HTTP da CASA COMUM do diretório, sob alias porque esta suíte ainda declara o seu
// {@link pedir} privado, anterior a ela. **O bloco do CT-1024 usa este**, e nunca o privado: o
// `CLAUDE.md` fixa que acessório de suíte se importa, e converter os seis casos anteriores é
// refatoração fora do escopo da T9. O alias é o que permite as duas formas conviverem sem que a
// conversão futura precise renomear as chamadas novas.
import { pedir as pedirNaBorda, type Resposta as RespostaDaBorda } from './acessorios-de-borda.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que gera material, atravessa HTTP e volta ao banco. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, do **registro** — composto das constantes que o controlador publica. */
const ROTA_DO_REGISTRO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DO_REGISTRO}`;

/** Caminho, relativo à raiz, da **consulta**. */
const ROTA_DA_CONSULTA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_CONSULTA}`;

/** Caminho, relativo à raiz, da **verificação** — composto, nunca escrito à mão. */
const ROTA_DA_VERIFICACAO = `${ROTA_DA_CONSULTA}/${SEGMENTO_DA_VERIFICACAO}`;

/**
 * A rota que abre a emissão em lote — composta a partir das constantes que o controlador publica.
 *
 * Ela entra neste arquivo com a T15, que trouxe a superfície `fila` para a enumeração da ADR-0032:
 * é por ela que uma carga de tarefa passa a existir, e é a carga que o CT-935 varre.
 */
const ROTA_DAS_EMISSOES = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}`;

/** Uma competência válida — primeiro dia do mês, que é o que o esquema de entrada exige. */
const COMPETENCIA_DA_EMISSAO = '2026-08-01';

/**
 * As rotas da **entrega da notícia** e a da **identidade**, compostas dos donos dos segmentos.
 *
 * Elas entram neste arquivo com a T9 da fatia `integracao-bancaria-autonoma`: são duas das quatro
 * rotas que a fatia tocou, e o CT-1024 mede o que sai delas. Compostas, e nunca escritas à mão —
 * um caminho literal aqui deixaria de acompanhar o controlador que o publica.
 */
const ROTA_DO_ESTADO_DA_ENTREGA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}`;
const ROTA_DA_ATIVACAO_DA_ENTREGA = `${ROTA_DO_ESTADO_DA_ENTREGA}/${SEGMENTO_DA_ATIVACAO}`;
const ROTA_DA_IDENTIDADE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_IDENTIDADE}`;

/**
 * As três senhas sentinelas do CT-1024 — **famílias textuais distintas, e isso é conteúdo**.
 *
 * Nenhuma é substring de outra, e a propriedade não é estética: o controle positivo planta **uma**
 * agulha por canal e afirma a lista de achados por igualdade. Duas senhas em que uma contivesse a
 * outra fariam o canal de uma achar duas agulhas, e a igualdade que prova a varredura viraria uma
 * lista escrita para bater com o efeito colateral. É a mesma medição que fixou o recorte hexadecimal
 * em {@link BYTES_DO_RECORTE}, aplicada ao outro eixo.
 */
const SENHA_DO_ACEITO_DO_CT1024 = 'senha-sentinela-do-ct1024-aceito-nao-deve-sair';
const SENHA_QUE_NAO_ABRE_DO_CT1024 = 'chave-alheia-que-nao-abre-o-cofre-do-ct1024';
const SENHA_DO_VENCIDO_DO_CT1024 = 'palavra-do-cofre-vencido-do-ct1024-nao-deve-sair';

/** Quantos desfechos o CT-1024 exerce — a âncora que pega a lista truncada antes da varredura. */
const DESFECHOS_DO_CT1024 = 6;

/**
 * Os status dos seis desfechos, **na ordem em que o caso os exerce**.
 *
 * Afirmados por igualdade de arranjo, e não um a um: é a igualdade que pega o desfecho que trocou de
 * lugar — um `422` onde se esperava o registro aceito faria toda varredura abaixo correr sobre um
 * envelope de recusa, medindo outra coisa sem dizer.
 */
const STATUS_DOS_DESFECHOS_DO_CT1024 = [201, 422, 422, 422, 200, 200];

/** A identidade que o arranjo do CT-1024 registra — valores quaisquer dentro do que o esquema exige. */
const NUMERO_DO_CLIENTE_DO_CT1024 = 987_654;
const NUMERO_DA_CONTA_DO_CT1024 = 12_345;
const CODIGO_DA_MODALIDADE_DO_CT1024 = 1;

/**
 * Teto de memória imposto ao servidor de fila durante a medição do corpo de erro, em bytes.
 *
 * Um byte: qualquer instância já ocupa mais que isso, de modo que a recusa é imediata e não depende
 * de quanto o servidor tenha acumulado. A política `noeviction` acompanha porque, com política de
 * despejo, o servidor apagaria chaves em vez de recusar — e o erro que se quer medir não nasceria.
 * É o mesmo arranjo, com a mesma razão, de `apps/api/test/produtor-de-fila.spec.ts`.
 */
const TETO_DE_MEMORIA_BYTES = 1;

/**
 * A área e a ação que a superfície exige — afirmadas no efetivo da sessão, nunca supostas.
 *
 * Literais, e **não** importadas do controlador: derivá-las do SUT faria a asserção concordar com
 * ele, e trocar a exigência declarada deixaria de reprovar caso algum.
 */
const AREA_DAS_INTEGRACOES_BANCARIAS = 'TELA:integracoes_bancarias';
const ACAO_DE_CONFIGURACAO = 'ACAO:configurar_integracao';

/** Quem age: a `ADMIN_EMPRESA` da carga, cujo perfil alcança o catálogo inteiro. */
const QUEM_ADMINISTRA = pessoaSemeada('admin.a@exemplo.com.br');

/** Validade folgada, em dias de calendário — nenhum caso daqui mede vigência. */
const DIAS_DE_VALIDADE = 45;

/**
 * A validade **já encerrada**, em dias de calendário: o material terminou ontem.
 *
 * Ela existe para alcançar o caminho `JA_VENCIDO`, e não para medir vigência — quem mede a régua da
 * validade é o `CT-824 (c)` de `certificado-do-provedor.e2e.spec.ts`, de onde este valor vem. O que
 * este arquivo precisa dela é a **posição** do ramo: é o único caminho de recusa do registro que
 * corre **depois** de o cofre PKCS#12 ter aberto e de `cifrarSegredo` ter sido invocado dentro da
 * transação — isto é, o caminho em que o segredo está mais vivo.
 */
const DIAS_DE_VALIDADE_ENCERRADA = -1;

/** Comprimento da chave do AES-256, em bytes — o que a partida exige da chave de cifra. */
const BYTES_DA_CHAVE_DE_CIFRA = 32;

/**
 * Quanto o recorte do material toma, e de onde — **da metade do cofre**, nunca de um deslocamento
 * fixo perto do começo.
 *
 * O início não é zero de propósito: o começo de um PKCS#12 é cabeçalho ASN.1 comum a qualquer cofre,
 * e uma agulha tirada dali casaria com material que não é este.
 *
 * ⚠️ **O deslocamento fixo de 64 bytes que esta constante tinha era insuficiente, e a medição o
 * refutou**: dois cofres emitidos pela mesma autoridade, com a mesma configuração, têm os **107
 * primeiros bytes idênticos** — o cabeçalho, o OID do PBES2 e o do PBKDF2 —, e a primeira divergência
 * é o **sal** do derivador. Quem pegou isso foi o controle positivo, no instante em que dois materiais
 * passaram a circular no mesmo caso: as duas agulhas hexadecimais eram a **mesma cadeia**, e cada
 * canal do controle achava as duas. Uma agulha assim não prova o que o A7 promete — ela casaria com
 * qualquer cofre daquele emissor.
 *
 * A metade do material cai dentro da chave privada **cifrada**, que é conteúdo daquela emissão e de
 * mais nenhuma; e derivá-la do tamanho, em vez de fixar um deslocamento maior, é o que impede a
 * escolha de envelhecer junto com a versão da ferramenta que emite o cofre.
 */
const BYTES_DO_RECORTE = 32;

/** Quantos bytes de ruído compõem o material ilegível do CT-831 — nada abre isso. */
const BYTES_DO_MATERIAL_ILEGIVEL = 512;

/** A mensagem canônica do `422` — literal, e não lida do SUT. */
const MENSAGEM_DE_REQUISICAO_INVALIDA = 'requisição inválida';

/** A mensagem da recusa por validade encerrada — literal, e não lida do SUT, pela mesma razão. */
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';

/** O campo que a recusa do material nomeia — o do **corpo**, nunca `material` nem `senha`. */
const CAMPO_DO_CORPO = 'corpo';

/** O discriminador que a recusa por vencimento publica dentro de `detalhes`. */
const DISCRIMINADOR_DA_VALIDADE = 'validoAte';

/**
 * Os **três** motivos internos do vocabulário desta trilha — literais, nunca importados.
 *
 * São os três que o operador filtra no journal, e os três aparecem por **medição** neste arquivo: os
 * dois primeiros no cenário de leitura recusada, o terceiro no cenário em que o cofre abriu e a
 * validade já tinha terminado. Um vocabulário observado pela metade deixaria sem agulha em escopo
 * justamente o caminho em que o segredo esteve vivo.
 */
const MOTIVO_DA_SENHA = 'SENHA_NAO_ABRE';
/**
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era esta constante que descrevia o
 * vocabulário anterior. Desde a T2 da fatia `integracao-bancaria-autonoma` a borda de registro passa
 * por `converterMaterialSeNecessario`, e o `ErroDeMaterialIlegivel` **não escapa mais** daquele
 * módulo: quem chega à borda é `ErroDeFormatoDoMaterial`, cujo motivo é `FORMATO_NAO_SUPORTADO` —
 * publicado pela T1 no barril de `@sysloc/cobranca-bancaria`. Traduzi-lo de volta para
 * `MATERIAL_ILEGIVEL` na borda criaria um segundo vocabulário para o mesmo fato, que é o oposto do
 * que o campo único existe para dar ao operador. Nenhuma asserção foi afrouxada: a igualdade de
 * arranjo ordenado dos três motivos segue exata.
 */
const MOTIVO_DO_FORMATO = 'FORMATO_NAO_SUPORTADO';
const MOTIVO_DO_VENCIDO = 'JA_VENCIDO';

/**
 * A entidade que as linhas de trilha desta superfície nomeiam — literal, e **não** importada do
 * controlador.
 *
 * É o eixo pelo qual o CT-823 reconhece, no arquivo de diário, as duas linhas do **caminho de
 * sucesso**. Importá-la do SUT faria a âncora concordar com ele: um controlador que parasse de
 * registrar sob esta entidade deixaria de reprovar, e a varredura de ausência voltaria a passar sobre
 * um trecho sem evento algum.
 */
const ENTIDADE_DA_TRILHA = 'certificado_do_provedor';

/**
 * As chaves que o documento publicado das três rotas **pode** declarar — por extenso, em ordem.
 *
 * É o conjunto derivado dos três esquemas que as rotas usam (`esquemaDoCertificado`,
 * `esquemaDoResultadoDaVerificacao`) mais o envelope de erro da ADR-0017. Ele é escrito à mão, e
 * **não** derivado dos esquemas: derivá-lo faria os dois lados da comparação mudarem juntos, e um
 * campo de segredo acrescentado ao contrato passaria despercebido — que é exatamente o que este caso
 * existe para pegar.
 *
 * A asserção é de **igualdade de conjunto**, e não de ausência: é a igualdade que pega o campo a
 * mais que ninguém pediu.
 */
const CHAVES_ESPERADAS: readonly string[] = [
  'aceito',
  'campo',
  'codigo',
  'detalhe',
  'detalhes',
  'diasParaVencer',
  'estado',
  'id',
  'impressaoDigital',
  // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era esta lista que descrevia a
  // superfície anterior. A T2 da fatia `integracao-bancaria-autonoma` publicou
  // `esquemaDoDesfechoDoRegistroDeCertificado` (§4.4 do tech spec), que estende a projeção do
  // certificado com `materialConvertido` **só na resposta do registro** — declaração do ATO, e não
  // do certificado. A âncora **sobe** e segue sendo igualdade de conjunto: um campo de segredo
  // acrescentado ao contrato continua reprovando aqui, e nenhuma chave saiu.
  'materialConvertido',
  'mensagem',
  'nome',
  'registradoEm',
  'registradoPor',
  'titular',
  'validoAte',
  'validoDe',
  'verificadoEm',
];

/**
 * As chaves que **nenhuma** superfície publicada pode declarar, escritas por extenso.
 *
 * Elas cobrem os nomes pelos quais o segredo operável entra no produto (`material`, `senha`), os
 * nomes pelos quais ele viaja para o cliente TLS nativo (`pfx`, `passphrase`), o nome com que a
 * coluna o guarda nas duas grafias, e os nomes plausíveis de uma exposição futura. A lista é escrita
 * aqui, e não importada de lugar nenhum: ela é a declaração do que se proíbe, não um reflexo do que
 * o produto faz.
 */
const CHAVES_PROIBIDAS: readonly string[] = [
  'chave',
  'chaveDeCifra',
  'envelope',
  'envelopeCifrado',
  'material',
  'passphrase',
  'password',
  'pfx',
  'segredo',
  'segredoCifrado',
  'segredo_cifrado',
  'senha',
];

/** As variáveis que a montagem fixa e o encerramento restaura. */
const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
  'CHAVE_DE_CIFRA_DO_CERTIFICADO',
] as const;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let diretorioDoDiario: string;
let arquivoDoDiario: string;
let registrador: Logger;

/**
 * A chave com que **a aplicação** cifra o segredo nesta execução — sorteada, e não a inerte do
 * arranjo do arcabouço.
 *
 * Ela é montada no ambiente antes de a composição correr, pelo mesmo caminho que `BETTER_AUTH_SECRET`
 * já usa nesta suíte. Sorteá-la é o que permite ao CT-833 apresentar **a chave certa** e **outra**
 * chave de 32 bytes sabendo que as duas diferem e que nenhuma existe fora deste processo.
 */
let chaveDaOperacao: Buffer;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();

  chaveDaOperacao = randomBytes(BYTES_DA_CHAVE_DE_CIFRA);

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
  process.env.CHAVE_DE_CIFRA_DO_CERTIFICADO = chaveDaOperacao.toString('base64');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // O DESTINO DO REGISTRADOR É UM ARQUIVO, e é isso que torna o CT-831 uma medição do diário do
  // processo real em vez de uma inspeção de memória. O caminho é o legítimo — o mesmo parâmetro
  // `destino` que a unidade systemd usa em operação (`packages/shared/test/log.spec.ts`).
  //
  // O nível é `info`, e não o `fatal` do ambiente montado: as recusas do registro saem em `warn` e
  // as linhas de trilha em `info`. Baixar o degrau **acrescenta** o que se captura, que é o que o
  // CT-831 varre; calá-lo faria a varredura de ausência passar sobre um arquivo vazio.
  diretorioDoDiario = await mkdtemp(join(tmpdir(), 'sysloc-diario-'));
  arquivoDoDiario = join(diretorioDoDiario, 'eventos.log');
  registrador = criarLogger({ nivel: 'info', destino: arquivoDoDiario });

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKEN_LOGGER)
    .useValue(registrador)
    .compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_ADMINISTRA.email, SENHA_DA_CARGA);

  // Precondição AFIRMADA, e não suposta: sem estas linhas, um `403` nas rotas do certificado seria
  // indistinguível de um defeito delas — e a varredura passaria sobre um corpo de recusa.
  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;

  expect(sessao.telas).toContain(AREA_DAS_INTEGRACOES_BANCARIAS);
  expect(sessao.acoes).toContain(ACAO_DE_CONFIGURACAO);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await fila?.parar();
  await identidade?.parar();

  if (diretorioDoDiario !== undefined) {
    await rm(diretorioDoDiario, { recursive: true, force: true });
  }

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('o segredo operável não escapa por superfície alguma (T13, ADR-0032)', () => {
  it(
    'CT-823 — os três corpos de resposta, serializados por inteiro, não carregam o material nem a senha',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct823');
      const material = await gerarMaterial(autoridade, 'senha-sentinela-do-ct823-nao-deve-sair');
      const agulhas = agulhasDo(material);

      // O CONTROLE POSITIVO, antes de qualquer afirmação de ausência: sem ele, uma varredura
      // quebrada devolveria lista vazia e este caso aprovaria um produto vazando tudo (AP-29).
      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );

      const linhasAntes = (await lerLinhasDoDiario()).length;

      const registro = await registrarMaterial(material);
      const consulta = await pedir(ROTA_DA_CONSULTA, { cookie });
      const verificacao = await pedir(ROTA_DA_VERIFICACAO, { metodo: 'POST', cookie });

      expect(registro.status).toBe(201);
      expect(consulta.status).toBe(200);
      expect(verificacao.status).toBe(200);

      // A ÂNCORA ANTIVÁCUO: o material **de fato circulou** por estas rotas. Sem ela, um `404` de
      // corpo curto passaria limpo em toda varredura abaixo e o caso não significaria nada. A
      // impressão digital é conferida contra o que o `openssl` declarou, por caminho independente
      // do SUT.
      expect((registro.corpo as CertificadoPublicado).impressaoDigital).toBe(
        material.impressaoDigital,
      );
      expect((consulta.corpo as CertificadoPublicado).impressaoDigital).toBe(
        material.impressaoDigital,
      );
      // E a verificação apresentou a identidade guardada: o desfecho é resposta, e não falha —
      // recusado pelo destino inerte, com o par de campos que o contrato publica.
      expect((verificacao.corpo as ResultadoPublicado).aceito).toBe(false);

      await esvaziar(registrador);

      const linhas = await lerLinhasDoDiario();

      // ⚠️ REGISTROU, e não vazou — a metade positiva vem antes, como no CT-831 e pela mesma razão:
      // um registrador silenciado passaria em qualquer varredura de ausência, e o que este caso
      // precisa provar é que o **caminho de sucesso** produziu linha. São duas, na ordem dos atos: a
      // do registro, que nomeia a impressão digital do material que entrou, e a da verificação, que
      // nomeia o desfecho. A consulta não registra, por decisão do controlador — e a ausência de uma
      // terceira linha é afirmada pela igualdade.
      expect(trilhaDoCertificadoEm(linhas.slice(linhasAntes))).toEqual([
        { entidade: ENTIDADE_DA_TRILHA, impressaoDigital: material.impressaoDigital, aceito: null },
        { entidade: ENTIDADE_DA_TRILHA, impressaoDigital: null, aceito: false },
      ]);

      // A MEDIÇÃO: as três respostas, cada uma em quatro superfícies — o texto cru que saiu do fio, o
      // `JSON.stringify` do objeto desserializado, a inspeção profunda dele e a **linha de
      // cabeçalho** —, mais o arquivo de diário **inteiro**. Um campo novo que carregasse o segredo
      // aninhado escaparia de uma conferência por chave, e não escapa daqui.
      //
      // ⚠️ O diário entra aqui, e não só no CT-831, porque as agulhas deste caso são as do material
      // que ATRAVESSOU o registro aceito e a verificação — que é o caminho em que o segredo está em
      // uso, e é onde o achado crítico da fase anterior nasceu. Medi-lo apenas no caminho de recusa
      // deixava a superfície `diário × sucesso` afirmada por leitura do código (ADR-0032).
      const ocorrencias = [
        ...superficiesDaResposta(`POST ${ROTA_DO_REGISTRO}`, registro),
        ...superficiesDaResposta(`GET ${ROTA_DA_CONSULTA}`, consulta),
        ...superficiesDaResposta(`POST ${ROTA_DA_VERIFICACAO}`, verificacao),
        ...superficiesDoDiario(linhas),
      ];

      // A igualdade com lista vazia, e não `toHaveLength(0)`: é ela que faz a reprovação **nomear**
      // a rota, o canal e a agulha ofensora.
      expect(ocorrenciasDe(ocorrencias, agulhas)).toEqual([]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-830 — os dois envelopes 422 do registro não ecoam o material nem a senha, medidos na saída HTTP real',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct830');
      const material = await gerarMaterial(autoridade, 'senha-sentinela-do-ct830-nao-deve-sair');
      // O SEGUNDO material, e ele é o do caminho que faltava: validade encerrada, senha **certa**.
      // A senha é propositalmente de outra família textual — nenhuma das duas é substring da outra,
      // que é a propriedade de que o controle positivo depende.
      const vencido = await gerarMaterial(
        autoridade,
        'chave-do-cofre-vencido-do-ct830-nao-deve-sair',
        DIAS_DE_VALIDADE_ENCERRADA,
      );
      const agulhas = { ...agulhasDo(material), ...agulhasDoAtoVencido(vencido) };

      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );

      // ATO 1 — a recusa do ESQUEMA. O corpo excedente é composto **do dado real**: a senha e o
      // material que de fato circulariam, repetidos até passar do teto declarado. Um preenchimento
      // de caracteres inventados mediria a recusa do esquema sem pôr agulha nenhuma no que o produto
      // vai recusar.
      //
      // ⚠️ Este ato recusa em `validar()`, **antes** de `criarSegredoOperavel`: o segredo nunca chega
      // a entrar no produto, e é por isso que ele sozinho não bastava — é o caminho em que há
      // **menos** a vazar.
      const semente = `${agulhas.senha}${agulhas.materialEmBase64}`;
      const excedente = semente.repeat(Math.ceil((MAIOR_MATERIAL_CODIFICADO + 1) / semente.length));

      expect(excedente.length).toBeGreaterThan(MAIOR_MATERIAL_CODIFICADO);

      const recusaDoEsquema = await pedir(ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie,
        corpo: { material: excedente, senha: agulhas.senha },
      });

      // ATO 2 — a recusa por VALIDADE ENCERRADA, pela rota real e com o corpo bem formado. É o
      // caminho em que o segredo está mais vivo: `lerMaterial` **abriu** o cofre PKCS#12 com a senha
      // apresentada, `criarSegredoOperavel` já embrulhou o claro e `cifrarSegredo` já correu dentro
      // da transação quando `registrarCertificado` recusa. É também o único ramo de recusa desta
      // superfície que publica `detalhes` — e, portanto, o único que dá **conteúdo** à superfície
      // homônima varrida abaixo.
      const recusaDoVencido = await registrarMaterial(vencido);

      expect(recusaDoEsquema.status).toBe(422);
      expect(recusaDoVencido.status).toBe(422);

      const doEsquema = recusaDoEsquema.corpo as EnvelopeDeErro;
      const doVencido = recusaDoVencido.corpo as EnvelopeDeErro;

      // A ÂNCORA ANTIVÁCUO DA SUPERFÍCIE `detalhes`, e ela vem antes da varredura pela mesma razão
      // que a trilha vem antes no CT-823: `inspect(undefined)` é a cadeia `'undefined'`, e varrer
      // ausência sobre ela é afirmar que não há vazamento num canal que não existe. O `?? {}` está
      // aqui para que um `detalhes` ausente reprove **por asserção**, nomeando a lista vazia, em vez
      // de derrubar o caso com erro de tipo.
      //
      // ⚠️ Ela é DELIBERADAMENTE MÍNIMA — afirma que o canal **tem conteúdo**, e não *qual* —, e a
      // razão foi medida: uma igualdade de chaves aqui aborta o caso antes da varredura, de modo que
      // um vazamento sob chave nova reprovaria nomeando a **chave** e nunca a **agulha**. Foi o que
      // o mutante `M-JV` mostrou na primeira execução. Quem fixa a forma de `detalhes` é a igualdade
      // de corpo inteiro, no fim do caso, depois de o que discrimina já ter corrido.
      expect(Object.keys((doVencido.detalhes ?? {}) as object).length).toBeGreaterThan(0);

      // A MEDIÇÃO, campo a campo nos **dois** envelopes — `mensagem`, `campo` e `detalhes` —, mais o
      // corpo inteiro e a linha de cabeçalho de cada resposta: a saída é **observada**, e não
      // presumida do `ZodError`. A M2 mediu que o Zod 4.4.3 não carrega o valor recusado; o risco não
      // some, ele se desloca para quem registre o corpo cru, e é este caso que transforma o achado de
      // ontem em rede permanente.
      const superficies = [
        { rotulo: 'envelope do esquema (mensagem)', texto: doEsquema.mensagem },
        { rotulo: 'envelope do esquema (campo)', texto: doEsquema.campo ?? '' },
        {
          rotulo: 'envelope do esquema (detalhes)',
          texto: inspect(doEsquema.detalhes, { depth: null }),
        },
        ...superficiesDaResposta(`POST ${ROTA_DO_REGISTRO} (esquema)`, recusaDoEsquema),
        { rotulo: 'envelope do vencimento (mensagem)', texto: doVencido.mensagem },
        { rotulo: 'envelope do vencimento (campo)', texto: doVencido.campo ?? '' },
        {
          rotulo: 'envelope do vencimento (detalhes)',
          texto: inspect(doVencido.detalhes, { depth: null }),
        },
        ...superficiesDaResposta(`POST ${ROTA_DO_REGISTRO} (vencimento)`, recusaDoVencido),
      ];

      expect(ocorrenciasDe(superficies, agulhas)).toEqual([]);

      // E os envelopes são os da ADR-0017, inteiros. As igualdades vêm por último porque abortam o
      // caso ao falhar — a varredura acima é o que discrimina o vazamento, e precisa executar antes.
      expect(recusaDoEsquema.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
        campo: 'material',
      });
      // O do vencimento carrega `detalhes` com a data em que a validade terminou (CA-06) — e a
      // igualdade de corpo inteiro é o que prova que **só** ela está ali.
      // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este esperado que descrevia o
      // contrato anterior. As três causas de recusa do registro ganharam código próprio na T2 da
      // fatia `integracao-bancaria-autonoma` (D4), e a validade encerrada é a terceira delas. A
      // mensagem literal **não mudou**, e a igualdade de corpo inteiro segue exata.
      expect(recusaDoVencido.corpo).toEqual({
        codigo: CodigoErro.CERTIFICADO_COM_VALIDADE_ENCERRADA,
        mensagem: MENSAGEM_DO_CERTIFICADO_VENCIDO,
        campo: CAMPO_DO_CORPO,
        detalhes: { [DISCRIMINADOR_DA_VALIDADE]: vencido.validoAte.toISOString() },
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-831 — os três cenários de recusa registram, e nenhuma linha do arquivo de diário carrega o segredo',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct831');
      const material = await gerarMaterial(autoridade, 'senha-sentinela-do-ct831-nao-deve-sair');
      const materialIlegivel = randomBytes(BYTES_DO_MATERIAL_ILEGIVEL);
      // O material do **terceiro** cenário: o cofre abre com a senha apresentada e a validade já
      // terminou. Ele é o único dos três que atravessa `lerMaterial` com sucesso e chega à
      // transação com o segredo embrulhado — e por isso o único cujo `warn` sai **depois** de
      // `cifrarSegredo` ter corrido.
      const vencido = await gerarMaterial(
        autoridade,
        'chave-do-cofre-vencido-do-ct831-nao-deve-sair',
        DIAS_DE_VALIDADE_ENCERRADA,
      );
      // A quarta agulha é o material que o **segundo** cenário apresenta: bytes que nada abre, mas
      // que circularam pelo corpo tanto quanto o cofre legítimo do primeiro. As três últimas são as
      // do terceiro cenário, sob nomes próprios.
      const agulhas = {
        ...agulhasDo(material),
        materialIlegivelEmBase64: materialIlegivel.toString('base64'),
        ...agulhasDoAtoVencido(vencido),
      };

      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );

      const linhasAntes = (await lerLinhasDoDiario()).length;

      // Cenário 1 — o material é bom, a senha não abre. A senha enviada é a sentinela DO CASO com um
      // sufixo: ela é a que de fato viajou, e é ela que não pode aparecer em linha alguma.
      const comSenhaErrada = await pedir(ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie,
        corpo: { material: agulhas.materialEmBase64, senha: `${agulhas.senha}-alterada` },
      });

      // Cenário 2 — a senha abre cofre nenhum porque os bytes não são um PKCS#12.
      const comMaterialIlegivel = await pedir(ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie,
        corpo: { material: agulhas.materialIlegivelEmBase64, senha: agulhas.senha },
      });

      // Cenário 3 — o cofre ABRE e a validade já terminou. Ele é o caminho em que o segredo está
      // mais vivo de todos os medidos aqui: quando este `warn` sai, o claro já foi aberto pelo
      // adaptador e já foi cifrado dentro da transação. Enquanto ele não fosse exercitado, a
      // ausência de vazamento no diário **deste** ramo era afirmada por leitura do código — o método
      // que a `Decision` da ADR-0032 proíbe.
      const comValidadeEncerrada = await registrarMaterial(vencido);

      expect(comSenhaErrada.status).toBe(422);
      expect(comMaterialIlegivel.status).toBe(422);
      expect(comValidadeEncerrada.status).toBe(422);

      await esvaziar(registrador);

      const linhas = await lerLinhasDoDiario();
      const desdeAqui = linhas.slice(linhasAntes);

      // ⚠️ REGISTROU, e não vazou — as duas metades, e a primeira vem antes: um registrador
      // silenciado passaria em qualquer varredura de ausência, e o que se quer provar é que o
      // journal **tem** o que o operador precisa ler. Os **três** motivos internos, na ordem das
      // três requisições, é o que separa "três linhas saíram" de "cada causa saiu com o motivo
      // dela" — e é a igualdade que faz o vocabulário ser observado inteiro, e não pela metade.
      expect(motivosEm(desdeAqui)).toEqual([MOTIVO_DA_SENHA, MOTIVO_DO_FORMATO, MOTIVO_DO_VENCIDO]);
      // E as três recusas do filtro global, com o código e o status que o cliente recebeu — escritas
      // por extenso, uma por requisição.
      // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este esperado que descrevia o
      // contrato anterior — três causas sob um código só. A T2 da fatia
      // `integracao-bancaria-autonoma` deu **um código por causa** (D4), e a lista passa a nomear os
      // três. Nenhuma asserção foi afrouxada: continua igualdade de arranjo ordenado, com o status
      // de cada uma, e um colapso de duas causas num código só volta a reprovar aqui.
      expect(recusasEm(desdeAqui)).toEqual([
        { codigo: CodigoErro.SENHA_DO_MATERIAL_NAO_ABRE, status: 422 },
        { codigo: CodigoErro.MATERIAL_EM_FORMATO_NAO_SUPORTADO, status: 422 },
        { codigo: CodigoErro.CERTIFICADO_COM_VALIDADE_ENCERRADA, status: 422 },
      ]);

      // A MEDIÇÃO: o arquivo **inteiro**, linha a linha — não apenas o trecho deste caso. Uma linha
      // emitida em outro ponto do processo que carregasse este segredo reprova aqui, e a reprovação
      // nomeia a posição da linha e a agulha.
      expect(ocorrenciasDe(superficiesDoDiario(linhas), agulhas)).toEqual([]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-832 — o documento publicado das três rotas não declara campo de material nem de senha, nem em exemplo',
    async () => {
      // O CONTROLE POSITIVO da coleta, antes de tudo: uma operação de controle que declara `senha`
      // em `properties`, `material` dentro de um exemplo e `pfx` aninhado num exemplo de lista. Sem
      // ele, uma coleta que não descesse aos exemplos devolveria conjunto vazio e o caso aprovaria
      // um documento publicando o segredo.
      const doControle = chavesDeclaradasEm(OPERACAO_DE_CONTROLE);

      expect([...doControle].sort()).toEqual(['id', 'material', 'pfx', 'senha']);
      expect(proibidasEntre(doControle)).toEqual(['material', 'pfx', 'senha']);

      // O documento vem da aplicação de PRODUÇÃO montada — `criarAplicacao()` é quem publica o
      // contrato —, e não de um `DocumentBuilder` escrito aqui: um documento gerado pelo teste
      // descreveria a aplicação do teste (ADR-0016).
      const documento = await documentoDaAplicacaoDeProducao();
      // Os caminhos são os das rotas, sem tradução: nenhuma das três tem parâmetro de caminho, de
      // modo que o documento as escreve exatamente como o cliente as chama.
      const operacoes = [
        operacaoDoDocumento(documento, ROTA_DO_REGISTRO, 'post'),
        operacaoDoDocumento(documento, ROTA_DA_CONSULTA, 'get'),
        operacaoDoDocumento(documento, ROTA_DA_VERIFICACAO, 'post'),
      ];

      const declaradas = chavesDeclaradasEm(operacoes);

      // A asserção que DISCRIMINA vem primeiro, e a ordem é conteúdo: ela reprova **nomeando** a
      // chave de segredo que apareceu, enquanto a igualdade abaixo aborta o caso mostrando o
      // conjunto inteiro. É a mesma razão da `DECISÃO FECHADA — T10 / Gate 1` de
      // `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts`.
      expect(proibidasEntre(declaradas)).toEqual([]);

      // E a IGUALDADE de conjunto, que é o que pega o campo a mais que ninguém pediu — a mera
      // ausência das proibidas deixaria passar um campo novo com nome insuspeito carregando o
      // segredo.
      expect([...declaradas].sort()).toEqual([...CHAVES_ESPERADAS].sort());
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-833 — o material em repouso é cifra, e o banco por si não o reconstitui',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct833');
      const material = await gerarMaterial(autoridade, 'senha-sentinela-do-ct833-nao-deve-sair');
      const agulhas = agulhasDo(material);

      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );

      // O registro corre pela ROTA REAL — nada é gravado por instrução direta. O que a conexão
      // privilegiada faz abaixo é **só ler**.
      expect((await registrarMaterial(material)).status).toBe(201);

      const guardado = await lerSegredoCifradoCru(EMPRESA_A.id);
      const bytesGuardados = Buffer.from(guardado, 'base64');

      // A MEDIÇÃO sobre a coluna, nas duas formas em que ela pode ser lida — o texto do envelope e
      // os bytes que ele decodifica.
      expect(
        ocorrenciasDe(
          [
            { rotulo: 'coluna segredo_cifrado (texto)', texto: guardado },
            {
              rotulo: 'coluna segredo_cifrado (bytes)',
              texto: inspect(bytesGuardados, { depth: null }),
            },
          ],
          agulhas,
        ),
      ).toEqual([]);

      // Os bytes gravados **diferem** do claro e não o contêm em posição alguma: um envelope que
      // apenas prefixasse cabeçalho ao material passaria numa comparação de igualdade.
      expect(bytesGuardados.equals(material.material)).toBe(false);
      expect(bytesGuardados.includes(material.material)).toBe(false);

      // O NEGATIVO: outra chave de 32 bytes não abre, e o desfecho é levantar **sem devolver nada**
      // — nem bytes parciais, nem os originais.
      const outraChave = randomBytes(BYTES_DA_CHAVE_DE_CIFRA);

      expect(outraChave.equals(chaveDaOperacao)).toBe(false);

      const comChaveAlheia = desfechoDe(() => decifrarSegredo(guardado, outraChave));

      expect(comChaveAlheia.devolvido).toBeUndefined();
      expect(comChaveAlheia.erro).toBeInstanceOf(ErroDeSegredoAdulterado);

      // E o COMPANHEIRO que impede o caso de aprovar uma coluna que guardasse lixo: com a chave da
      // operação, o envelope devolve o par **byte a byte** — a mesma senha e o mesmo material que
      // entraram pela rota.
      const aberto = decifrarSegredo(guardado, chaveDaOperacao).abrir();

      expect(aberto.senha).toBe(material.senha);
      expect(aberto.material.equals(material.material)).toBe(true);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-935 — nenhum material e nenhuma senha alcança a carga da tarefa de emissão em lote, nem o corpo de erro da fila',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct935');
      const material = await gerarMaterial(autoridade, 'senha-sentinela-do-ct935-nao-deve-sair');
      const agulhas = agulhasDo(material);

      // O CONTROLE POSITIVO, antes de qualquer afirmação de ausência: sem ele, uma varredura
      // quebrada devolveria lista vazia e este caso aprovaria um produto vazando tudo (AP-29).
      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );

      const linhasAntes = (await lerLinhasDoDiario()).length;

      // O CERTIFICADO É REGISTRADO PELA ROTA REAL — é ele que faz a empresa ter, neste instante, um
      // segredo operável guardado. Sem esta precondição a ausência abaixo seria trivial: não haveria
      // material no produto para escapar por caminho algum.
      const registro = await registrarMaterial(material);

      expect(registro.status).toBe(201);
      expect((registro.corpo as CertificadoPublicado).impressaoDigital).toBe(
        material.impressaoDigital,
      );

      const emissao = await pedir(ROTA_DAS_EMISSOES, {
        metodo: 'POST',
        cookie,
        corpo: { competencia: COMPETENCIA_DA_EMISSAO },
      });

      // A ÂNCORA ANTIVÁCUO do arranjo: a emissão foi **aberta**, e portanto há tarefa a varrer. Um
      // `422` de competência, ou um `403`, faria toda varredura abaixo correr sobre uma fila vazia.
      expect(emissao.status).toBe(201);
      const lote = emissao.corpo as LotePublicado;

      const sonda = new Queue<CargaDaEmissaoEmLote, void>(FILA_DA_EMISSAO_EM_LOTE, {
        connection: { host: '127.0.0.1', port: fila.porta },
      });
      onTestFinished(async () => {
        await sonda.close();
      });
      // O servidor de fila é derrubado ao fim do arquivo, e uma sonda sem ouvinte de `error`
      // derrubaria o processo com `Unhandled error event` em vez de deixar o caso concluir.
      sonda.on('error', () => undefined);

      const tarefas = await sonda.getJobs(['waiting', 'delayed', 'prioritized']);
      const carga = tarefas[0]?.data;

      if (carga === undefined) {
        throw new Error('a emissão em lote respondeu 201 e nenhuma tarefa chegou à fila');
      }

      // AS CHAVES, por igualdade e na ordem em que a borda as monta. É esta linha que reprova no dia
      // em que alguém acrescentar `material`, `senha` ou `envelope` à carga "para o worker não
      // precisar consultar o banco" — a varredura seguinte reprovaria junto, mas esta **nomeia o
      // campo**, e é ela que discrimina a chave nova da chave renomeada.
      expect(Object.keys(carga)).toEqual(['empresaId', 'loteId']);
      expect(carga.loteId).toBe(lote.id);

      // O CORPO DE ERRO DA FILA — o canal do achado crítico da fase anterior, e o mais exposto que
      // existe: com o servidor recusando escrita, a biblioteca levanta um erro que carrega a carga
      // **serializada** em `command.args`. A `Queue` aqui é a CRUA, e não o produtor da aplicação, de
      // propósito: o saneamento do produtor (`DECISÃO FECHADA — T9 / Gate 2`) já é medido pelo
      // CT-739, e medi-lo de novo esconderia o que este caso persegue — que **a carga em si** não
      // tem o que vazar, mesmo no canal que não sanea nada.
      const erroDaFila = await sobMemoriaEsgotada(
        async () => await rejeicaoDe(sonda.add(FILA_DA_EMISSAO_EM_LOTE, carga)),
      );

      expect(erroDaFila).toBeInstanceOf(Error);
      // O CONTROLE POSITIVO DESTE CANAL: o erro **de fato** carrega a carga serializada. Sem esta
      // linha, uma biblioteca que deixasse de anexar o comando faria a varredura abaixo passar por
      // vacuidade — exatamente o modo de falha que o CT-738 existe para impedir do outro lado.
      const comando = (erroDaFila as { command?: { readonly args?: readonly unknown[] } }).command;
      expect(comando?.args).toContain(JSON.stringify(carga));

      await esvaziar(registrador);

      // A MEDIÇÃO: a carga nas três serializações, o erro da fila nas mesmas três, a resposta da
      // rota e o arquivo de diário **inteiro**. Um campo novo que carregasse o segredo aninhado
      // escaparia de uma conferência por chave, e não escapa daqui.
      const ocorrencias = [
        { rotulo: 'carga (texto cru)', texto: String(carga) },
        { rotulo: 'carga (json)', texto: JSON.stringify(carga) },
        { rotulo: 'carga (inspeção)', texto: inspect(carga, { depth: null }) },
        { rotulo: 'erro da fila (texto cru)', texto: String(erroDaFila) },
        {
          rotulo: 'erro da fila (json)',
          texto: JSON.stringify(erroDaFila, Object.getOwnPropertyNames(erroDaFila)),
        },
        { rotulo: 'erro da fila (inspeção)', texto: inspect(erroDaFila, { depth: null }) },
        ...superficiesDaResposta(`POST ${ROTA_DAS_EMISSOES}`, emissao),
        ...superficiesDoDiario(await lerLinhasDoDiario()),
      ];

      // A igualdade com lista vazia, e não `toHaveLength(0)`: é ela que faz a reprovação **nomear** o
      // canal e a agulha ofensora.
      expect(ocorrenciasDe(ocorrencias, agulhas)).toEqual([]);
      // E o diário registrou o ato — sem esta linha, a varredura dele passaria sobre um trecho vazio.
      expect((await lerLinhasDoDiario()).length).toBeGreaterThan(linhasAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1024 — nenhum dos seis desfechos das rotas da fatia carrega material ou senha em corpo, cabeçalho, diário ou documento publicado',
    async () => {
      // ---------------------------------------------------------------------------------------
      // 1. A PRECONDIÇÃO DE PERMISSÃO, afirmada aqui e não só na montagem
      // ---------------------------------------------------------------------------------------
      //
      // O `beforeAll` já a afirma, e reafirmá-la custa uma requisição: sem ela, um `403` nas quatro
      // rotas seria indistinguível de defeito delas, e as varreduras abaixo correriam sobre quatro
      // envelopes de recusa — em que não há segredo a vazar porque nada entrou.
      const sessao = (await naBorda(CAMINHO_DA_SESSAO_CORRENTE, { cookie }))
        .corpo as SessaoPublicada;

      expect(sessao.telas).toContain(AREA_DAS_INTEGRACOES_BANCARIAS);
      expect(sessao.acoes).toContain(ACAO_DE_CONFIGURACAO);

      // ---------------------------------------------------------------------------------------
      // 2. OS MATERIAIS, gerados em execução, e as agulhas do que DE FATO circula
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ O material aceito é pedido **com a segunda embalagem**, e é a LEGADA que o caso apresenta:
      // ela é a que o runtime não abre, e portanto a única que faz o registro atravessar o processo
      // externo de conversão (ADR-0036). Registrar a moderna mediria o caminho em que nenhum
      // subprocesso chega a ser criado — que é justamente a superfície nova desta fatia.
      const autoridade = await gerarAutoridadeDeTeste('ct1024');
      const aceito = await gerarMaterialComEmbalagemLegada(autoridade, SENHA_DO_ACEITO_DO_CT1024);
      const legado = exigirEmbalagemLegada(aceito);
      const vencido = await gerarMaterial(
        autoridade,
        SENHA_DO_VENCIDO_DO_CT1024,
        DIAS_DE_VALIDADE_ENCERRADA,
      );
      const ilegivel = randomBytes(BYTES_DO_MATERIAL_ILEGIVEL);

      // As nove agulhas, **rotuladas por cenário**: as do segundo material não sobrescrevem as do
      // primeiro no mapa, e é o nome que a reprovação exibe que diz qual cofre escapou.
      const agulhas: AgulhasDoCt1024 = {
        senhaDoAceito: aceito.senha,
        materialLegadoEmBase64: legado.toString('base64'),
        recorteDoLegadoEmHexadecimal: recorteEmHexadecimalDe(legado),
        senhaQueNaoAbre: SENHA_QUE_NAO_ABRE_DO_CT1024,
        materialIlegivelEmBase64: ilegivel.toString('base64'),
        recorteDoIlegivelEmHexadecimal: recorteEmHexadecimalDe(ilegivel),
        senhaDoVencido: vencido.senha,
        materialVencidoEmBase64: vencido.material.toString('base64'),
        recorteDoVencidoEmHexadecimal: recorteEmHexadecimalDe(vencido.material),
      };

      // ---------------------------------------------------------------------------------------
      // 3. O CONTROLE POSITIVO, ANTES de qualquer afirmação de ausência
      // ---------------------------------------------------------------------------------------
      //
      // A MESMA função de varredura, sobre um objeto em que cada agulha está plantada num canal
      // diferente — mensagem interpolada, campo aninhado, item de lista e `Buffer` cru inspecionado.
      // Sem ele, uma varredura quebrada devolveria `[]` e este caso aprovaria um produto vazando
      // tudo (AP-29). Ele vem primeiro porque `toEqual` aborta o caso ao falhar.
      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );

      // ---------------------------------------------------------------------------------------
      // 4. O MARCO do diário — a varredura do passo 9 corre sobre o arquivo INTEIRO
      // ---------------------------------------------------------------------------------------
      const linhasAntes = (await lerLinhasDoDiario()).length;

      // ---------------------------------------------------------------------------------------
      // 5. A IDENTIDADE da empresa, pela ROTA REAL — sem ela a ativação recusa antes do desfecho
      // ---------------------------------------------------------------------------------------
      //
      // Afirmada antes de seguir: uma identidade não registrada faria a ativação responder `422` por
      // pré-condição ausente, e o desfecho varrido não seria o pretendido.
      const identidadeRegistrada = await naBorda(ROTA_DA_IDENTIDADE, {
        metodo: 'POST',
        cookie,
        corpo: {
          identificadorDaAplicacao: randomUUID(),
          numeroDoCliente: NUMERO_DO_CLIENTE_DO_CT1024,
          numeroDaContaCorrente: NUMERO_DA_CONTA_DO_CT1024,
          codigoDaModalidade: CODIGO_DA_MODALIDADE_DO_CT1024,
        },
      });

      expect(identidadeRegistrada.status).toBe(201);

      // ---------------------------------------------------------------------------------------
      // 6. OS SEIS DESFECHOS, nesta ordem, **só pela superfície HTTP**
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ A ordem é conteúdo: o registro aceito é o primeiro porque é ele que dá à empresa o
      // certificado vigente de que a ativação depende, e as três recusas vêm antes dela para que os
      // três motivos internos apareçam no diário na ordem em que o passo 10 os afirma.
      //
      // ⚠️ O terceiro é **o caminho que atravessa o processo externo**: senha que não abre sobre o
      // cofre em cifra legada. Com cifra moderna a recusa nasceria no runtime, sem subprocesso
      // algum; com a legada, o runtime falha pela **cifra** antes de conferir a etiqueta, e a senha
      // só se manifesta dentro da conversão — que é quem a apresenta ao conversor.
      const registroAceito = await registrarBytes(legado, aceito.senha);
      const recusaDeFormato = await registrarBytes(ilegivel, aceito.senha);
      const recusaDeSenha = await registrarBytes(legado, SENHA_QUE_NAO_ABRE_DO_CT1024);
      const recusaDeValidade = await registrarBytes(vencido.material, vencido.senha);
      const ativacao = await naBorda(ROTA_DA_ATIVACAO_DA_ENTREGA, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      const consultaDaEntrega = await naBorda(ROTA_DO_ESTADO_DA_ENTREGA, { cookie });

      const desfechos = [
        { rotulo: `POST ${ROTA_DO_REGISTRO} (aceito, com conversão)`, resposta: registroAceito },
        { rotulo: `POST ${ROTA_DO_REGISTRO} (formato)`, resposta: recusaDeFormato },
        { rotulo: `POST ${ROTA_DO_REGISTRO} (senha, pelo conversor)`, resposta: recusaDeSenha },
        { rotulo: `POST ${ROTA_DO_REGISTRO} (validade encerrada)`, resposta: recusaDeValidade },
        { rotulo: `POST ${ROTA_DA_ATIVACAO_DA_ENTREGA}`, resposta: ativacao },
        { rotulo: `GET ${ROTA_DO_ESTADO_DA_ENTREGA}`, resposta: consultaDaEntrega },
      ];

      // ---------------------------------------------------------------------------------------
      // 7. AS ÂNCORAS ANTIVÁCUO — e cada uma pega o que as outras não pegam
      // ---------------------------------------------------------------------------------------
      //
      // A **contagem** pega a lista truncada; a igualdade de **status na ordem** pega o desfecho que
      // trocou de lugar; a **não-vacuidade** pega o corpo vazio, sobre o qual varrer não custa nada e
      // não prova nada; a **impressão digital** prova que o material de fato circulou; e
      // `materialConvertido` prova que o **processo externo correu** — sem ela, a medição de borda
      // desta fatia poderia estar correndo sobre o caminho em que nenhum subprocesso é criado.
      expect(desfechos.length).toBe(DESFECHOS_DO_CT1024);
      expect(desfechos.map(({ resposta }) => resposta.status)).toEqual(
        STATUS_DOS_DESFECHOS_DO_CT1024,
      );
      expect(
        desfechos.filter(({ resposta }) => resposta.texto.length === 0).map(({ rotulo }) => rotulo),
        'desfecho coletado sem corpo algum: varrer o vazio não prova nada',
      ).toEqual([]);
      expect((registroAceito.corpo as CertificadoPublicado).impressaoDigital).toBe(
        aceito.impressaoDigital,
      );
      expect((registroAceito.corpo as DesfechoDoRegistroPublicado).materialConvertido).toBe(true);

      // ---------------------------------------------------------------------------------------
      // 8. A VARREDURA das respostas — desfecho a desfecho, e a falha NOMEIA o desfecho
      // ---------------------------------------------------------------------------------------
      //
      // Desfecho a desfecho, e não sobre a união: uma varredura única diria *"algum corpo vazou"* sem
      // dizer qual, e é o *onde* que separa o defeito do produto do defeito do arranjo. Cada desfecho
      // entra em quatro superfícies — texto cru do fio, `JSON.stringify` e `util.inspect` do
      // desserializado, e a **linha de cabeçalho**.
      for (const { rotulo, resposta } of desfechos) {
        expect(
          ocorrenciasDe(superficiesDaResposta(rotulo, resposta), agulhas),
          `${rotulo} publicou material ou senha`,
        ).toEqual([]);
      }

      // ---------------------------------------------------------------------------------------
      // 9. O DIÁRIO do processo real, o arquivo INTEIRO, uma superfície por linha
      // ---------------------------------------------------------------------------------------
      //
      // É aqui que a saída e o objeto de erro **crus** do conversor chegariam se a redação não os
      // alcançasse: o filtro global registra a exceção, e uma exceção que carregasse o que o
      // subprocesso respondeu levaria junto o que o subprocesso recebeu. O esvaziamento é pelo
      // mecanismo do próprio registrador — nunca por espera fixa.
      await esvaziar(registrador);

      const linhas = await lerLinhasDoDiario();

      expect(ocorrenciasDe(superficiesDoDiario(linhas), agulhas)).toEqual([]);

      // ---------------------------------------------------------------------------------------
      // 10. A TRILHA EXISTE — sem esta linha, a ausência acima poderia ser ausência de LINHA
      // ---------------------------------------------------------------------------------------
      //
      // Os três motivos internos, na ordem das requisições. É a igualdade que separa *"três linhas
      // saíram"* de *"cada causa saiu com o motivo dela"*, e é ela que impede um registrador calado
      // de aprovar toda varredura de ausência.
      //
      // ⚠️ **Ela é também a ÂNCORA DO CAMINHO DO PROCESSO EXTERNO**, e essa é a leitura que importa
      // para o AT-3: o segundo motivo é `SENHA_NAO_ABRE` sobre um cofre em cifra **legada**, e esse
      // par só é produzível **dentro** da conversão. O runtime falha naquele material pela cifra,
      // antes de conferir a etiqueta de autenticação — se o conversor não tivesse corrido, o motivo
      // registrado seria `FORMATO_NAO_SUPORTADO`, e esta igualdade reprovaria nomeando a troca. É
      // por isso que ela não é redundante com o `CT-831`, que exerce o mesmo motivo por outro
      // caminho.
      expect(motivosEm(linhas.slice(linhasAntes))).toEqual([
        MOTIVO_DO_FORMATO,
        MOTIVO_DA_SENHA,
        MOTIVO_DO_VENCIDO,
      ]);

      // ---------------------------------------------------------------------------------------
      // 11. O DOCUMENTO PUBLICADO das três rotas da fatia tocadas por este caso
      // ---------------------------------------------------------------------------------------
      //
      // O CONTROLE POSITIVO da coleta vem antes, e é o mesmo do CT-832: uma operação plausível que
      // declara `senha` em `properties`, `material` num exemplo e `pfx` num exemplo dentro de lista.
      // Sem ele, uma coleta que não descesse aos exemplos devolveria conjunto vazio, e conjunto vazio
      // não contém chave proibida nenhuma — a varredura aprovaria a própria cegueira.
      const doControle = chavesDeclaradasEm(OPERACAO_DE_CONTROLE);

      expect(proibidasEntre(doControle)).toEqual(['material', 'pfx', 'senha']);

      // O documento vem da aplicação de PRODUÇÃO — `criarAplicacao()` é quem publica o contrato —, e
      // não de um `DocumentBuilder` escrito aqui, que descreveria a aplicação do teste (ADR-0016).
      const documento = await documentoDaAplicacaoDeProducao();
      const operacoes = [
        operacaoDoDocumento(documento, ROTA_DO_REGISTRO, 'post'),
        operacaoDoDocumento(documento, ROTA_DA_ATIVACAO_DA_ENTREGA, 'post'),
        operacaoDoDocumento(documento, ROTA_DO_ESTADO_DA_ENTREGA, 'get'),
      ];

      const declaradas = chavesDeclaradasEm(operacoes);

      // A âncora antivácuo do recorte: as três operações existem e declaram campo. `operacaoDoDocumento`
      // já levanta quando a rota some, e esta linha pega o caso em que ela existe e nada declara.
      expect(declaradas.size).toBeGreaterThan(0);
      expect(proibidasEntre(declaradas)).toEqual([]);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// As agulhas, a varredura e o controle positivo
// ---------------------------------------------------------------------------

/** Uma superfície varrida: o texto que saiu e o rótulo que a reprovação vai nomear. */
interface Superficie {
  readonly rotulo: string;
  readonly texto: string;
}

/**
 * As três agulhas de um ato — declaradas como tipo de objeto, e não como `interface`, para que o
 * conjunto possa ser **estendido** por um caso (o CT-831 acrescenta o material ilegível) e continuar
 * atribuível ao mapa que {@link ocorrenciasDe} percorre.
 */
type AgulhasDoAto = {
  readonly senha: string;
  readonly materialEmBase64: string;
  readonly recorteDoMaterialEmHexadecimal: string;
};

/**
 * As agulhas de um ato, derivadas do dado **que de fato circulou** (A7).
 *
 * São três, e a escolha das formas é conteúdo: a senha exatamente como foi enviada, o material
 * exatamente como foi codificado no corpo, e um recorte dele em **hexadecimal** — que é a forma em
 * que bytes crus aparecem numa inspeção de `Buffer` e num despejo de diagnóstico. O recorte não vai
 * em base64 porque seria substring do material completo, e o controle positivo passaria a achar duas
 * agulhas onde plantou uma.
 */
function agulhasDo(material: MaterialDeTeste): AgulhasDoAto {
  return {
    senha: material.senha,
    materialEmBase64: material.material.toString('base64'),
    recorteDoMaterialEmHexadecimal: recorteEmHexadecimalDe(material.material),
  };
}

/**
 * As três agulhas do ato **vencido** — tipo nomeado pela mesma razão de {@link AgulhasDoAto}, e
 * `type` em vez de `interface` pelo mesmo motivo mecânico (atribuibilidade ao mapa que
 * {@link ocorrenciasDe} percorre). Declará-lo, em vez de devolver `Record<string, string>`, é o que
 * faz uma agulha nova do ato vencido precisar ser **nomeada aqui** para existir.
 */
type AgulhasDoAtoVencido = {
  readonly senhaDoVencido: string;
  readonly materialVencidoEmBase64: string;
  readonly recorteDoVencidoEmHexadecimal: string;
};

/**
 * As **nove** agulhas do CT-1024, uma por forma e por cenário, todas nomeadas por extenso.
 *
 * Declarar o tipo, em vez de devolver `Record<string, string>`, é o que faz uma agulha nova precisar
 * ser **nomeada aqui** para existir — a mesma razão de {@link AgulhasDoAto}. E os nomes são por
 * cenário porque quatro materiais circulam no mesmo caso: é o nome da agulha que a reprovação exibe,
 * e é ele que diz qual dos quatro escapou.
 *
 * ⚠️ **As nove são mutuamente não-substring**, e a propriedade é o que sustenta o controle positivo:
 * as três senhas são de famílias textuais distintas, os três base64 são de cofres distintos, e os
 * três recortes saem em **hexadecimal** da METADE de cada cofre — do começo eles seriam do emissor
 * comum, e o controle reprovaria por excesso (ver {@link BYTES_DO_RECORTE}).
 *
 * ⚠️ **O material do primeiro cenário é o da embalagem LEGADA**, e não o moderno do mesmo par: é a
 * legada que o corpo da requisição carregou, e a agulha tem de ser do dado que **de fato circulou**
 * (A7). O convertido que o produto guarda é outro artefato, e este caso não o conhece — quem prova
 * que o guardado é cifra é o CT-833.
 */
type AgulhasDoCt1024 = {
  readonly senhaDoAceito: string;
  readonly materialLegadoEmBase64: string;
  readonly recorteDoLegadoEmHexadecimal: string;
  readonly senhaQueNaoAbre: string;
  readonly materialIlegivelEmBase64: string;
  readonly recorteDoIlegivelEmHexadecimal: string;
  readonly senhaDoVencido: string;
  readonly materialVencidoEmBase64: string;
  readonly recorteDoVencidoEmHexadecimal: string;
};

/**
 * As agulhas do material **vencido**, sob nomes próprios (A7).
 *
 * Elas são um conjunto separado, e não uma segunda chamada de {@link agulhasDo}, porque os dois
 * materiais circulam no **mesmo** caso e as chaves precisam ser distintas: é o nome da agulha que a
 * reprovação exibe, e é ele que diz qual dos dois cofres escapou. A senha vai junto de propósito —
 * ela é a senha que **abriu** o cofre, isto é, a que atravessou `lerMaterial` com sucesso, e é a
 * única deste arquivo de que isso é verdade num caminho de recusa.
 */
function agulhasDoAtoVencido(material: MaterialDeTeste): AgulhasDoAtoVencido {
  return {
    senhaDoVencido: material.senha,
    materialVencidoEmBase64: material.material.toString('base64'),
    recorteDoVencidoEmHexadecimal: recorteEmHexadecimalDe(material.material),
  };
}

/**
 * O recorte do miolo do material, em hexadecimal — a forma em que bytes crus aparecem num despejo.
 *
 * O início é a **metade** do cofre, pela razão medida em {@link BYTES_DO_RECORTE}: um deslocamento
 * fixo perto do começo cai em estrutura comum a qualquer emissão daquela ferramenta, e a agulha
 * deixaria de ser deste material.
 *
 * A guarda é do acessório, e não asserção do SUT: um material curto demais para o recorte produziria
 * uma agulha vazia, e cadeia vazia está contida em qualquer texto — a varredura acharia tudo.
 */
function recorteEmHexadecimalDe(bytes: Buffer): string {
  const inicio = Math.floor(bytes.length / 2);

  if (bytes.length < inicio + BYTES_DO_RECORTE) {
    throw new Error(`o material de teste tem ${String(bytes.length)} bytes, curto para o recorte`);
  }

  return bytes.subarray(inicio, inicio + BYTES_DO_RECORTE).toString('hex');
}

/**
 * As ocorrências das agulhas nas superfícies, rotuladas por `${superfície}/${agulha}`.
 *
 * Cada superfície é buscada em **duas formas**: crua e sem espaço em branco. A segunda existe porque
 * a inspeção de um `Buffer` imprime os bytes em hexadecimal **separados por espaço**
 * (`<Buffer 1a 2b …>`), e sem a normalização um segredo viajando como bytes crus escaparia da busca —
 * exatamente o modo de falha que o controle positivo planta para provar que não escapa.
 *
 * A ordem do resultado é determinística — superfície por superfície, agulha por agulha na ordem
 * declarada —, o que é o que permite afirmá-lo por igualdade em vez de por contenção.
 */
function ocorrenciasDe(
  superficies: readonly Superficie[],
  agulhas: Readonly<Record<string, string>>,
): string[] {
  const achados: string[] = [];

  for (const superficie of superficies) {
    const formas = [superficie.texto, superficie.texto.replace(/\s/g, '')];

    for (const [nome, agulha] of Object.entries(agulhas)) {
      if (formas.some((forma) => forma.includes(agulha))) {
        achados.push(`${superficie.rotulo}/${nome}`);
      }
    }
  }

  return achados;
}

/**
 * O que **saiu** numa resposta: as três serializações do corpo mais a linha de cabeçalho.
 *
 * O cabeçalho está aqui porque *"o que saiu"* é a resposta inteira, e não só o corpo: um segredo
 * devolvido em cabeçalho próprio — ou reeditado num `set-cookie` — sairia pelo fio exatamente como
 * sairia no corpo, e uma varredura que só olhasse o corpo o aprovaria. É superfície de custo marginal
 * zero, já que o transporte coleta os pares de qualquer modo.
 */
function superficiesDaResposta(rotulo: string, resposta: Resposta): Superficie[] {
  return [
    { rotulo: `${rotulo} (texto cru)`, texto: resposta.texto },
    // `?? null` porque `JSON.stringify(undefined)` não devolve cadeia: uma resposta sem corpo JSON
    // produziria `undefined` aqui, e `undefined.includes` derrubaria a varredura com erro de tipo em
    // vez de reprovar por asserção.
    { rotulo: `${rotulo} (json)`, texto: JSON.stringify(resposta.corpo ?? null) },
    { rotulo: `${rotulo} (inspeção)`, texto: inspect(resposta.corpo, { depth: null }) },
    { rotulo: `${rotulo} (cabeçalhos)`, texto: inspect(resposta.cabecalhos, { depth: null }) },
  ];
}

/**
 * O arquivo de diário como superfícies, uma por linha, rotuladas pela **posição**.
 *
 * Definida uma vez e consumida pelos **dois** casos que leem o diário — o CT-823, no caminho de
 * sucesso, e o CT-831, no de recusa —, para que a forma do rótulo que a reprovação exibe seja a mesma
 * nos dois: um vazamento achado num caminho e no outro nomeia a linha do mesmo jeito.
 */
function superficiesDoDiario(linhas: readonly string[]): Superficie[] {
  return linhas.map((texto, posicao) => ({ rotulo: `linha ${String(posicao + 1)}`, texto }));
}

/**
 * O CONTROLE POSITIVO: uma superfície por agulha, cada uma num canal diferente.
 *
 * Os canais são os que uma exposição real usaria — texto de mensagem, campo aninhado num objeto
 * serializado, item de lista, e `Buffer` cru inspecionado. É o quarto que obriga a normalização de
 * espaço em branco de {@link ocorrenciasDe} a existir: sem ela, bytes crus escapariam da busca.
 *
 * Uma agulha por canal, e o mapeamento por nome: assim a lista esperada é
 * {@link rotulosDoControle}, e uma agulha nova sem canal reprova por **falta** em vez de passar
 * despercebida.
 */
function controleComAsAgulhas(agulhas: Readonly<Record<string, string>>): Superficie[] {
  return Object.entries(agulhas).map(([nome, agulha], posicao) => ({
    rotulo: `controle (${nome})`,
    texto: canalDeControle(posicao, agulha),
  }));
}

/** Os rótulos que o controle positivo tem de devolver — um por agulha, na ordem declarada. */
function rotulosDoControle(agulhas: Readonly<Record<string, string>>): string[] {
  return Object.keys(agulhas).map((nome) => `controle (${nome})/${nome}`);
}

/**
 * O canal em que a agulha de controle é plantada, escolhido pela posição dela.
 *
 * São quatro formas, e elas se alternam: mensagem interpolada, campo aninhado em objeto serializado,
 * item de lista, e `Buffer` cru inspecionado. A alternância é o que garante que **todo** conjunto de
 * agulhas exercite mais de um canal, inclusive o dos bytes crus.
 *
 * ⚠️ Uma agulha hexadecimal plantada como `Buffer` só é achada se a varredura normalizar o espaço em
 * branco; uma agulha que não seja hexadecimal cairia fora daquele canal, e por isso o `Buffer` é
 * montado apenas quando o texto é hexadecimal — do contrário o canal seria o da mensagem.
 */
function canalDeControle(posicao: number, agulha: string): string {
  if (/^[0-9a-f]+$/.test(agulha) && agulha.length % 2 === 0) {
    return inspect({ bytes: Buffer.from(agulha, 'hex') }, { depth: null });
  }

  const canais = [
    (valor: string): string => `o registro trouxe ${valor} por engano`,
    (valor: string): string => JSON.stringify({ certificado: { pfx: valor } }),
    (valor: string): string => JSON.stringify({ detalhes: [valor] }),
  ];

  return (canais[posicao % canais.length] as (valor: string) => string)(agulha);
}

// ---------------------------------------------------------------------------
// O documento publicado
// ---------------------------------------------------------------------------

/**
 * A operação de CONTROLE do CT-832 — um documento plausível que declara o segredo de três jeitos.
 *
 * `senha` entra por `properties`, `material` por um exemplo de objeto, e `pfx` por um exemplo dentro
 * de uma lista. É o que prova que {@link chavesDeclaradasEm} desce aos exemplos, e não só aos
 * esquemas — que é justamente o eixo que a CA-02 cobra (*"nem em exemplo"*).
 */
const OPERACAO_DE_CONTROLE = {
  responses: {
    '200': {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { id: { type: 'string' }, senha: { type: 'string' } },
            required: ['id'],
          },
          example: { material: 'MIIK…' },
          examples: [{ pfx: 'MIIK…' }],
        },
      },
    },
  },
} as const;

/**
 * Todos os nomes de campo que um trecho do documento **declara** — em esquema ou em exemplo.
 *
 * A coleta é por nome de campo, e não por texto: a descrição em prosa do `POST` fala, legitimamente,
 * do *"material PKCS#12 em base64 e a senha que o abre"*, e uma varredura textual reprovaria a
 * documentação por dizer o que a rota recebe. O que a CA-02 proíbe é a rota **declarar** o campo.
 */
function chavesDeclaradasEm(no: unknown): Set<string> {
  const achadas = new Set<string>();
  coletarChaves(no, achadas);
  return achadas;
}

function coletarChaves(no: unknown, achadas: Set<string>): void {
  if (Array.isArray(no)) {
    for (const item of no) {
      coletarChaves(item, achadas);
    }
    return;
  }

  if (no === null || typeof no !== 'object') {
    return;
  }

  for (const [chave, valor] of Object.entries(no as Record<string, unknown>)) {
    if (chave === 'properties' && valor !== null && typeof valor === 'object') {
      for (const nome of Object.keys(valor as Record<string, unknown>)) {
        achadas.add(nome);
      }
    }

    if (chave === 'required' && Array.isArray(valor)) {
      for (const nome of valor) {
        if (typeof nome === 'string') {
          achadas.add(nome);
        }
      }
    }

    if (chave === 'example' || chave === 'examples') {
      coletarChavesDeExemplo(valor, achadas);
    }

    coletarChaves(valor, achadas);
  }
}

/** Num exemplo, **toda** chave de objeto é nome de campo — inclusive dentro de lista. */
function coletarChavesDeExemplo(valor: unknown, achadas: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      coletarChavesDeExemplo(item, achadas);
    }
    return;
  }

  if (valor === null || typeof valor !== 'object') {
    return;
  }

  for (const [chave, aninhado] of Object.entries(valor as Record<string, unknown>)) {
    achadas.add(chave);
    coletarChavesDeExemplo(aninhado, achadas);
  }
}

/** As chaves proibidas presentes no conjunto, em ordem — vazio é o desfecho esperado. */
function proibidasEntre(chaves: ReadonlySet<string>): string[] {
  return CHAVES_PROIBIDAS.filter((proibida) => chaves.has(proibida));
}

/**
 * O documento OpenAPI da aplicação de **produção**, montada e fechada dentro do caso.
 *
 * `criarAplicacao()` é quem publica o contrato (`SwaggerModule.setup`), e é por isso que ele não sai
 * da aplicação da montagem — que existe para outra propriedade, o registrador com destino em arquivo.
 * A aplicação é encerrada em `onTestFinished`: uma aplicação viva depois do caso seguraria a porta e
 * a reserva de conexões.
 */
async function documentoDaAplicacaoDeProducao(): Promise<unknown> {
  const porta = await reservarPorta();
  const producao = await criarAplicacao();

  onTestFinished(async () => {
    await producao.close();
  });

  await producao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  const endereco = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}/${CAMINHO_DO_DOCUMENTO}`;
  const resposta = await fetch(endereco, { headers: { connection: 'close' } });
  const texto = await resposta.text();

  if (resposta.status !== 200) {
    throw new Error(`o documento respondeu ${String(resposta.status)}: ${texto}`);
  }

  return JSON.parse(texto) as unknown;
}

/**
 * A operação do documento, ou uma exceção nomeando o que falta.
 *
 * Ausência levanta em vez de devolver `undefined`: uma rota que sumisse do documento produziria
 * conjunto vazio de chaves, e conjunto vazio não contém chave proibida nenhuma — a varredura
 * aprovaria a ausência da rota como se fosse a ausência do segredo.
 */
function operacaoDoDocumento(documento: unknown, caminho: string, metodo: string): unknown {
  const paths = (documento as { paths?: Record<string, Record<string, unknown>> }).paths;
  const operacao = paths?.[caminho]?.[metodo];

  if (operacao === undefined) {
    throw new Error(`o documento não descreve ${metodo.toUpperCase()} ${caminho}`);
  }

  return operacao;
}

// ---------------------------------------------------------------------------
// O diário, o banco e o material
// ---------------------------------------------------------------------------

/** Aguarda o esvaziamento pelo mecanismo do próprio registrador — nunca por espera fixa. */
async function esvaziar(logger: Logger): Promise<void> {
  await new Promise<void>((resolver, rejeitar) => {
    logger.flush((erro) => {
      if (erro) {
        rejeitar(erro);
        return;
      }
      resolver();
    });
  });
}

/** As linhas não vazias do arquivo de diário, na ordem em que foram escritas. */
async function lerLinhasDoDiario(): Promise<string[]> {
  const conteudo = await readFile(arquivoDoDiario, 'utf8');

  return conteudo.split('\n').filter((linha) => linha.trim() !== '');
}

/**
 * Os motivos internos emitidos nas linhas informadas, na ordem em que saíram.
 *
 * O campo é lido do evento estruturado, e não casado no texto: é o `motivo` que o serviço emite, e a
 * ordem é a das requisições — é ela que faz a igualdade discriminar qual causa produziu qual recusa,
 * e não apenas que duas linhas saíram.
 */
function motivosEm(linhas: readonly string[]): string[] {
  return linhas
    .map((linha) => (JSON.parse(linha) as { motivo?: string }).motivo)
    .filter((motivo): motivo is string => motivo !== undefined);
}

/**
 * As linhas de trilha **desta superfície** entre as informadas, na forma normalizada que discrimina
 * qual ato produziu cada uma.
 *
 * O filtro é por `entidade`, e os dois campos devolvidos são os que separam os dois eventos do
 * caminho de sucesso: o registro nomeia a **impressão digital** do material que entrou (e não tem
 * `aceito`), a verificação nomeia o **desfecho** (e não tem impressão digital). Normalizar o ausente
 * como `null` é o que permite afirmar as duas linhas por **igualdade** — e é a igualdade que faz uma
 * linha a mais, uma a menos ou fora de ordem reprovar.
 */
function trilhaDoCertificadoEm(
  linhas: readonly string[],
): { entidade: string; impressaoDigital: string | null; aceito: boolean | null }[] {
  return linhas
    .map(
      (linha) =>
        JSON.parse(linha) as { entidade?: string; impressaoDigital?: string; aceito?: boolean },
    )
    .filter(
      (evento): evento is { entidade: string; impressaoDigital?: string; aceito?: boolean } =>
        evento.entidade === ENTIDADE_DA_TRILHA,
    )
    .map((evento) => ({
      entidade: evento.entidade,
      impressaoDigital: evento.impressaoDigital ?? null,
      aceito: evento.aceito ?? null,
    }));
}

/** O par (código, status) de cada recusa registrada pelo filtro global nas linhas informadas. */
function recusasEm(linhas: readonly string[]): { codigo: string; status: number }[] {
  return linhas
    .map((linha) => JSON.parse(linha) as { codigo?: string; status?: number })
    .filter(
      (evento): evento is { codigo: string; status: number } =>
        evento.codigo !== undefined && evento.status !== undefined,
    )
    .map((evento) => ({ codigo: evento.codigo, status: evento.status }));
}

/**
 * Lê `segredo_cifrado` **cru**, pela conexão do papel **dono** dos objetos.
 *
 * O privilégio é o ponto do caso: a tabela tem `FORCE ROW LEVEL SECURITY`, de modo que nem o dono
 * escapa da política — por isso o contexto é fixado por `set_config` antes da leitura, exatamente
 * como `packages/db/test/certificado-do-provedor.spec.ts` faz. A reserva é de **uma** conexão porque
 * `set_config(…, false)` vale pela sessão.
 *
 * O que este caminho acrescenta ao acesso da aplicação é a força da afirmação: quem alcança o banco
 * com o maior privilégio que o produto usa **ainda assim** não reconstitui o segredo.
 */
async function lerSegredoCifradoCru(empresaId: string): Promise<string> {
  const sql = postgres(conexaoDeMigracao(identidade.banco), { max: 1 });

  try {
    await sql`SELECT set_config('app.empresa_id', ${empresaId}, false)`;

    const [linha] = await sql<{ segredoCifrado: string | null }[]>`
      SELECT segredo_cifrado AS "segredoCifrado"
        FROM negocio.certificado_do_provedor
       WHERE substituido_em IS NULL
    `;

    if (linha?.segredoCifrado === undefined || linha.segredoCifrado === null) {
      throw new Error('a leitura crua não achou o segredo do certificado vigente');
    }

    return linha.segredoCifrado;
  } finally {
    await sql.end();
  }
}

/**
 * Gera um material com a senha sentinela **do caso**, pela autoridade descartável dele.
 *
 * A autoridade é parâmetro, e nasce dentro de cada `it`, porque a limpeza dela é registrada em
 * `onTestFinished` — que o arcabouço só admite de dentro de um caso.
 *
 * A validade é parâmetro com valor padrão folgado: o único caso em que ela importa é o do material
 * cuja vigência já terminou, e ele a declara por {@link DIAS_DE_VALIDADE_ENCERRADA}.
 */
async function gerarMaterial(
  autoridade: AutoridadeDeTeste,
  senha: string,
  diasDeValidade: number = DIAS_DE_VALIDADE,
): Promise<MaterialDeTeste> {
  return await gerarMaterialDeTeste({ autoridade, senha, diasDeValidade });
}

/** Registra o material pela rota real, com a sessão da administradora. */
async function registrarMaterial(material: MaterialDeTeste): Promise<Resposta> {
  return await pedir(ROTA_DO_REGISTRO, {
    metodo: 'POST',
    cookie,
    corpo: { material: material.material.toString('base64'), senha: material.senha },
  });
}

/**
 * Gera o material pedindo, na MESMA chamada, a segunda embalagem: a cifra legada que a AC entrega.
 *
 * As duas embalam o **mesmo** par chave/certificado — mesma série, mesma validade, mesma impressão
 * digital —, e é essa igualdade que dá conteúdo à âncora do CT-1024: a impressão digital publicada
 * pelo registro da legada é a que o `openssl` declarou para o par.
 */
async function gerarMaterialComEmbalagemLegada(
  autoridade: AutoridadeDeTeste,
  senha: string,
): Promise<MaterialDeTeste> {
  return await gerarMaterialDeTeste({
    autoridade,
    senha,
    diasDeValidade: DIAS_DE_VALIDADE,
    comEmbalagemLegada: true,
  });
}

/**
 * Exige a embalagem legada do material, e **levanta** quando ela não veio.
 *
 * O campo é opcional no acessório, e um `?? material.material` silencioso faria o caso registrar a
 * embalagem MODERNA acreditando ter registrado a legada — o registro passaria sem criar subprocesso
 * algum, e a medição de borda da superfície nova desta fatia ficaria vácua sem que nada acusasse.
 */
function exigirEmbalagemLegada(material: MaterialDeTeste): Buffer {
  if (material.materialEmEmbalagemLegada === undefined) {
    throw new Error('o material foi gerado sem a embalagem legada que este caso exige');
  }

  return material.materialEmEmbalagemLegada;
}

/**
 * Registra **bytes arbitrários** pela rota real — o caminho de quem apresenta o que quiser.
 *
 * Ela existe ao lado de {@link registrarMaterial} porque o CT-1024 apresenta, nas quatro requisições
 * de registro, coisas que **não** são o campo `material` de um {@link MaterialDeTeste}: a embalagem
 * legada, bytes que não são cofre algum, e o mesmo cofre com uma senha que não o abre.
 */
async function registrarBytes(bytes: Buffer, senha: string): Promise<Resposta> {
  return await naBorda(ROTA_DO_REGISTRO, {
    metodo: 'POST',
    cookie,
    corpo: { material: bytes.toString('base64'), senha },
  });
}

/**
 * Executa a requisição pelo cliente da **casa comum** e devolve a resposta na forma deste arquivo.
 *
 * Ela é adaptação, e não um segundo cliente: quem fala HTTP é {@link pedirNaBorda}, de
 * `./acessorios-de-borda.ts`. O que muda é só a forma dos cabeçalhos — lá eles vêm como `Headers`,
 * aqui como a lista de pares que {@link superficiesDaResposta} inspeciona —, e converter aqui é o
 * que permite ao bloco novo usar o cliente compartilhado **sem** reescrever a varredura nem os seis
 * casos anteriores, que continuam no {@link pedir} privado.
 */
// DÉBITO COM GATILHO — D40 · F5/T9 · registrado 2026-08-22
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: esta suíte tem DUAS formas de falar HTTP — o `pedirNaBorda` da casa comum
//        (`./acessorios-de-borda.ts`), usado pelo `CT-1024` através desta adaptação, e o `pedir`
//        PRIVADO do arquivo, que os seis casos anteriores ainda usam. Duas formas equivalentes sem
//        critério escrito convidam a próxima task a copiar a privada — que é exatamente o mecanismo
//        que fez o cliente HTTP nascer em quase toda suíte de borda (ver a convenção "acessório de
//        suíte se importa, não se copia" do `CLAUDE.md`).
// QUANDO FECHA: a primeira task autorizada a abrir este arquivo por outra razão converte os SEIS
//        casos remanescentes para `pedirNaBorda` e remove o `pedir` privado. O alias já foi escolhido
//        para que a conversão não precise renomear as chamadas novas.
// POR QUE NÃO AGORA: a §5.2 do card da T9 não prevê a conversão, e reescrever seis casos de prova de
//        segredo é superfície de regressão que ninguém pediu (§4.5 do Protocolo).
// ÍNDICE: docs/specs/features/integracao-bancaria-autonoma/v1/_run/run-report.md §2, D40
async function naBorda(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const resposta: RespostaDaBorda = await pedirNaBorda(base, alvo, opcoes);

  return {
    status: resposta.status,
    texto: resposta.texto,
    corpo: resposta.corpo,
    cookies: resposta.cookies,
    cabecalhos: [...resposta.cabecalhos],
  };
}

/**
 * Executa e devolve o par (o que voltou, o que foi levantado).
 *
 * Existe para que o CT-833 possa afirmar as **duas** metades do desfecho: que a exceção é a esperada
 * e que **nada** foi devolvido. Um `toThrow()` provaria só a primeira.
 */
function desfechoDe(executar: () => unknown): { devolvido: unknown; erro: unknown } {
  try {
    return { devolvido: executar(), erro: undefined };
  } catch (erro) {
    return { devolvido: undefined, erro };
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

interface CertificadoPublicado {
  readonly id: string;
  readonly impressaoDigital: string;
}

/**
 * O desfecho do **registro**, no recorte que o CT-1024 lê dele.
 *
 * Ele é distinto de {@link CertificadoPublicado} porque `materialConvertido` é declaração do **ato**,
 * e não do certificado: a consulta não o publica. Lê-lo é a âncora de que o processo externo de
 * conversão de fato correu — sem ela, a medição de borda desta fatia poderia estar sobre o caminho
 * em que nenhum subprocesso é criado.
 */
interface DesfechoDoRegistroPublicado {
  readonly materialConvertido: boolean;
}

interface ResultadoPublicado {
  readonly aceito: boolean;
  readonly detalhe: string | null;
}

interface EnvelopeDeErro {
  readonly codigo: string;
  readonly mensagem: string;
  readonly campo?: string;
  readonly detalhes?: unknown;
}

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  /** Os pares de cabeçalho que voltaram, na ordem em que o transporte os entrega. */
  readonly cabecalhos: readonly (readonly [string, string])[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    cookies: resposta.headers.getSetCookie(),
    // Os cabeçalhos são coletados aqui e varridos por {@link superficiesDaResposta}: sem eles, *"o
    // que saiu"* seria só o corpo, e um segredo devolvido em cabeçalho próprio passaria limpo.
    cabecalhos: [...resposta.headers],
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = entrada.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial.split(';')[0] ?? '';
}

/**
 * Executa o trabalho com o servidor de fila recusando toda escrita, e devolve o teto ao normal.
 *
 * O `finally` é o que impede um caso vermelho de deixar o servidor inutilizável para os seguintes —
 * a restauração não pode depender do desfecho da medição. Mesmo arranjo, com a mesma razão, de
 * `apps/api/test/produtor-de-fila.spec.ts`.
 */
async function sobMemoriaEsgotada<T>(trabalho: () => Promise<T>): Promise<T> {
  await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory-policy', 'noeviction');
  await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory', String(TETO_DE_MEMORIA_BYTES));

  try {
    return await trabalho();
  } finally {
    await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory', '0');
  }
}

/**
 * O motivo da rejeição da promessa informada.
 *
 * Escrito assim, e não com `rejects.toThrow`, porque o que o CT-935 mede é o **objeto** rejeitado —
 * as propriedades que ele carrega e o que uma serialização dele exibe —, e não apenas que houve
 * rejeição.
 */
async function rejeicaoDe(promessa: Promise<unknown>): Promise<unknown> {
  return await promessa.then(
    (valor) => {
      throw new Error(`a promessa resolveu em vez de rejeitar: ${inspect(valor)}`);
    },
    (erro: unknown) => erro,
  );
}

/** O lote como a rota o publica — apenas o que o CT-935 lê dele. */
interface LotePublicado {
  readonly id: string;
}
