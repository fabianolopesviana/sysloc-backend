/**
 * O contrato da **integração bancária** — a identidade com que cada empresa se apresenta ao provedor,
 * e o vocabulário de recebimento do produto.
 *
 * ===========================================================================
 * Este módulo é a FONTE ÚNICA, e o que não está aqui não existe para o frontend
 * ===========================================================================
 *
 * A ADR-0016 fixa que a conferência de entrada, o tipo da resposta e o documento publicado derivam do
 * **mesmo** esquema. Somando-se a isso o fato de que `@sysloc/contracts` é o artefato que o React
 * importa no marco de entrega (tech spec §15.3), a consequência é literal: **todo campo declarado
 * aqui chega ao consumidor, e todo campo não declarado não existe para ele**. Publicar é ato
 * deliberado, e por isso a projeção de saída abaixo é enumerada campo a campo em vez de derivada da
 * linha do banco.
 *
 * ===========================================================================
 * O material e a senha ENTRAM e não SAEM — e o mecanismo é a ausência
 * ===========================================================================
 *
 * A RN-02 é a propriedade central desta fatia: o que o Admin envia (o PKCS#12 e a senha que o abre)
 * é cifrado e guardado, e a API publica apenas o que se **lê** dele — titular, validade, impressão
 * digital, autoria e desde quando. Nada aqui garante isso por verificação escrita à mão: garante-se
 * pela **ausência** dos campos em {@link esquemaDoCertificado} somada ao `strictObject`, que
 * converte a tentativa de publicá-los em recusa por chave desconhecida.
 *
 * ---------------------------------------------------------------------------
 * Por que a SAÍDA é `strictObject` aqui, quando a da cobrança é `z.object`
 * ---------------------------------------------------------------------------
 *
 * `esquemaDaCobranca` é aberto de propósito — ali um campo a mais que chegue da view é descartado, e
 * a decisão está registrada no `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM` (razão 1: esquema de saída
 * que recusa não produz `422`, ele levanta na serialização e derruba a rota). **Aqui a mesma
 * propriedade é o ganho, e não o custo.** O campo a mais que pode aparecer nesta projeção não é uma
 * grandeza derivada com resíduo de ponto flutuante: é o segredo do provedor entrando na resposta por
 * uma projeção montada errado. Entre *"a rota cai e o registro acusa"* e *"a senha do certificado
 * viaja ao cliente"*, a queda é o desfecho preferível — e o `strictObject` é o que a torna certa em
 * vez de provável. `registradoPor` é estrito pela mesma razão, um nível abaixo: uma projeção que
 * espalhe a linha do usuário ali dentro é tão capaz de carregar segredo quanto a de cima.
 *
 * Nenhuma das restrições desta saída é de **valor** sobre grandeza derivada — que é a classe que
 * aquele marcador protege. `titular` e `impressaoDigital` saem como texto livre justamente porque o
 * que os produz é o runtime lendo o material, e apertar a forma deles converteria um certificado
 * legítimo de emissor incomum em queda de rota.
 *
 * ===========================================================================
 * A chave exposta é o UUID — não invente código legível para o certificado
 * ===========================================================================
 *
 * A ADR-0017 tem três classes de chave, e a regra é verificável sem julgamento: código textual quando
 * a entidade tem **série declarada**, UUID quando não tem. Não existe série declarada para o
 * certificado — a única série desta fatia é a do {@link ESQUEMA_DO_IDENTIFICADOR_BANCARIO}, que
 * identifica **a cobrança perante o provedor** e não o certificado. Logo, `id` é UUID.
 *
 * ===========================================================================
 * O identificador perante o provedor declara o SaaS, e não a empresa (ADR-0033)
 * ===========================================================================
 *
 * As duas séries anteriores do produto (`CTR-…` e `COB-…`) declaram `(empresa, ano)`. Esta declara **o
 * SaaS**, porque a unicidade é exigida por um terceiro que não conhece a fronteira de empresa: duas
 * imobiliárias emitindo o mesmo número no mesmo mês é o defeito que o sistema antigo já tinha. Por
 * isso o formato **não tem campo de empresa** — são 6 posições de competência e 12 de contador —, e é
 * também por isso que a forma aqui é uma expressão de dígitos crua em vez de um formatador com
 * prefixo: o texto é imposto de fora, não escolhido pelo produto.
 */

import { z } from 'zod';

/**
 * Os meios pelos quais o produto recebe (RN-11), na ordem publicada.
 *
 * ---------------------------------------------------------------------------
 * `PIX` é declarado e **não tem operação** — a lista é vocabulário, não roteador
 * ---------------------------------------------------------------------------
 *
 * A RN-11 declara os dois meios e implementa só o boleto. Declarar o pix agora é o que impede que a
 * fatia que o implementar precise **alargar o vocabulário publicado** — que é mudança de contrato — em
 * vez de acrescentar a operação. Enquanto isso, ela não entra em esquema nenhum desta fatia, e a
 * ausência é deliberada: um campo `meioDeRecebimento` publicado hoje prometeria uma escolha que
 * nenhuma rota aceita.
 *
 * `as const` fecha a união em **compilação**; `Object.freeze` fecha o arranjo em **execução**, e é a
 * segunda metade que sobrevive ao build — sem ela, um consumidor alarga a lista com um `push` e o
 * produto passa a falar de um meio que ninguém decidiu. É a mesma forma, e a mesma razão, de
 * `ESTADOS_DA_COBRANCA` em `cobranca.ts` e de `TIPOS_DE_IMOVEL` em `imovel.ts`.
 */
export const MEIOS_DE_RECEBIMENTO = Object.freeze(['BOLETO', 'PIX'] as const);

/** União fechada dos meios de recebimento. */
export type MeioDeRecebimento = (typeof MEIOS_DE_RECEBIMENTO)[number];

/**
 * Os textos que o desfecho da verificação de identidade pode carregar — **conjunto fechado**.
 *
 * ===========================================================================
 * Por que eles moram AQUI, e não no adaptador que os escolhe
 * ===========================================================================
 *
 * Eles nasceram como constantes privadas de `adaptador-sicoob.ts` (fatia (i), T10), e a restrição
 * *"o texto sai de um conjunto fechado"* existia **só em prosa**: o campo era `string` no domínio e
 * `z.string()` aqui. Era o **D27 · F4/T8** — o único ponto por onde texto arbitrário atravessava a
 * porta com caminho direto até a tela do Admin.
 *
 * Fechá-lo estruturalmente exige **uma** declaração alcançável pelos dois lados, e a direção da
 * dependência decide qual é o lado: o domínio (`@sysloc/cobranca-bancaria`) importa deste pacote, e
 * este pacote é **folha** — não importa nada do produto. Declarar os textos no domínio fecharia o
 * lado do compilador e deixaria o esquema publicado com `z.string()`, porque a seta não volta.
 * Declará-los aqui fecha os dois: o esquema abaixo os enumera em **execução**, e o domínio deriva a
 * união por `typeof` em **compilação**.
 *
 * É a forma, e a razão, de {@link MEIOS_DE_RECEBIMENTO}: vocabulário publicado tem definição única
 * neste pacote (ADR-0016), e quem o consome o **importa** em vez de redeclará-lo. Duas declarações
 * do mesmo texto seriam a forma exata do débito **D14** — dois fatos executáveis dizendo a mesma
 * coisa, livres para divergir, com nada que acuse quando divergirem.
 *
 * ---------------------------------------------------------------------------
 * Nenhum destes textos nomeia a instituição nem cita campo do provedor
 * ---------------------------------------------------------------------------
 *
 * É o que mantém verdadeira a cláusula de vocabulário da ADR-0001 no único campo por onde texto
 * atravessa a porta. Detrito de runtime de transporte — código de erro de biblioteca, texto de
 * OpenSSL, nome de recurso da instituição — não entra aqui e não tem por onde entrar: o conjunto é
 * fechado, e alargá-lo é editar este arquivo.
 *
 * `as const` fecha a união em **compilação**; `Object.freeze` fecha o objeto em **execução**, e é a
 * segunda metade que sobrevive ao build.
 *
 * ⚠️ **O texto de `ACEITE` carrega a ressalva de alcance por escrito, e ela continua aqui.** A sonda
 * da fatia (i) é o aperto de mão mútuo, não a obtenção de credencial de acesso: ela confirma a
 * identidade da empresa e **não** confirma que a emissão está habilitada. Quem retira a ressalva é a
 * fatia que sobe a sonda para o `client_credentials` (o débito **D36 · F4/T10**) — retirá-la antes
 * disso publicaria ao Admin uma afirmação mais larga do que a que foi medida.
 */
export const DETALHES_DA_VERIFICACAO = Object.freeze({
  /** O par completou a conexão e aceitou o certificado — com a ressalva de alcance por escrito. */
  ACEITE:
    'a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
    'Isto confirma a identidade da empresa perante ela; não confirma que a emissão de cobrança já ' +
    'está habilitada, o que depende das credenciais de habilitação',
  /** O par completou a conexão e **não** aceitou o certificado apresentado. */
  RECUSA_PELO_PAR:
    'a instituição não aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
    'Confira se o certificado é o que ela emitiu para esta empresa e se continua válido perante ela',
  /** Não houve conexão: o destino não respondeu ao pedido de ligação, e nada foi apresentado. */
  INDISPONIVEL:
    'não foi possível alcançar a instituição no endereço configurado, e o certificado desta empresa ' +
    'não chegou a ser apresentado. Tente novamente em alguns minutos',
  /** A conexão abriu e o par não concluiu dentro do teto — desfecho distinto dos outros quatro. */
  TEMPO_ESGOTADO:
    'a instituição não concluiu a conferência do certificado dentro do tempo previsto, e por isso ' +
    'esta tentativa não confirma nem recusa a identidade da empresa. Tente novamente',
  /** O ato não chegou a começar: a apresentação do certificado falhou antes de qualquer conexão. */
  NAO_INICIADO:
    'a verificação não chegou a começar: o certificado desta empresa não foi apresentado e nenhuma ' +
    'conexão com a instituição foi tentada. Confira o certificado e a senha registrados para esta ' +
    'empresa e tente novamente',
} as const);

/**
 * Os três estados do certificado (RN-04), na ordem publicada.
 *
 * O estado é **derivado** da validade contra a data corrente da operação, nunca marca gravada:
 * `VENCIDO` quando a validade já passou, `VENCENDO` quando faltam
 * {@link LIMIAR_DE_VENCIMENTO_EM_DIAS} dias ou menos, `VIGENTE` no restante (§6.2). A ordem é
 * conteúdo — ela vai do mais saudável ao pior, e é a ordem em que a projeção e o documento publicado
 * os apresentam.
 *
 * Não há enum do banco correspondente, e a ausência é a decisão: gravar o estado criaria uma segunda
 * fonte do mesmo fato, que a passagem do tempo faria divergir sozinha.
 */
export const ESTADOS_DO_CERTIFICADO = Object.freeze(['VIGENTE', 'VENCENDO', 'VENCIDO'] as const);

/** União fechada dos estados do certificado. */
export type EstadoDoCertificado = (typeof ESTADOS_DO_CERTIFICADO)[number];

/**
 * A partir de quantos dias restantes o certificado é anunciado como **vencendo** (RN-04, §6.2).
 *
 * ---------------------------------------------------------------------------
 * Ela tem definição ÚNICA em todo o monorepo, e isso é asserido
 * ---------------------------------------------------------------------------
 *
 * As três respostas do produto derivam dela — o estado publicado no recurso, o aviso que a tela
 * mostra e a faixa que a rota de consulta anuncia. Duas declarações do mesmo limiar é a **forma exata
 * do débito D14** que a fase anterior deixou aberta sobre o fuso da operação: dois fatos executáveis
 * dizendo a mesma coisa, livres para divergir, com nada que acuse quando divergirem. O tech spec
 * (§4.2) pede explicitamente que ela não se repita, e o **CT-850** é a rede que o P4 do Protocolo
 * Antirregressão exige — ele varre **além deste pacote**, porque a segunda declaração plausível mora
 * justamente do outro lado da fronteira, em quem deriva o estado.
 *
 * Quem precisar do limiar **importa este nome**; quem precisar de outro limiar declara outro nome,
 * com outra razão.
 */
export const LIMIAR_DE_VENCIMENTO_EM_DIAS = 30;

/**
 * Maior tamanho aceito para o material do certificado, **já codificado em base64** — 32 KiB.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ O VALOR ANTERIOR (8192) RECUSAVA O CERTIFICADO REAL DO PROVEDOR
 * ---------------------------------------------------------------------------
 *
 * Medido em **2026-08-20**, ao registrar o material de produção pela primeira vez: o `.pfx` real
 * tem **8.915 bytes**, que viram **11.888 caracteres** em base64 — e o arquivo como a Autoridade
 * Certificadora o entrega (embalagem legada) tem 9.673 bytes, isto é, **12.898** codificados. O
 * registro reprovava com `422` no campo `material`.
 *
 * O texto anterior declarava *"o material medido do provedor tem cerca de 2,6 KB"*, e o teto de
 * 8 KiB foi dimensionado com folga generosa **sobre esse número**. A premissa é que estava errada:
 * o material real é 3,4 vezes maior. É a mesma classe de defeito que a cifra legada do PKCS#12
 * exibiu no mesmo dia — **toda medição desta fatia foi feita sobre material gerado em execução**
 * (`gerarMaterialDeTeste`), que é menor e mais moderno que o do provedor, e nenhuma suíte podia
 * acusar a divergência.
 *
 * O valor novo preserva o critério original — folga de mais de duas vezes sobre o medido — agora
 * sobre a medição certa: 12.898 × 2 ≈ 25,8 KiB, arredondado para **32 KiB**. Continua sendo teto
 * **anti-abuso**, e não regra de domínio; a coluna que o guarda é `text`, sem limite próprio.
 *
 * Ele é **contado sobre o texto codificado**, que é o que chega no corpo, e não sobre os bytes
 * decodificados: contar sobre o decodificado obrigaria a decodificar antes de decidir se aceita, o
 * que é fazer trabalho sobre entrada não conferida.
 */
export const MAIOR_MATERIAL_CODIFICADO = 32768;

/**
 * O maior material **real** já observado, em base64 — a medição que o teto acima precisa cobrir.
 *
 * Existe para que a folga seja **verificável em vez de prometida**: sem ela, o número acima volta a
 * ser uma estimativa que ninguém consegue contestar, e a próxima redução "de conforto" reabre o
 * defeito de 2026-08-20 sem que nada acuse. O caso que a compara com o teto é a rede que o P4 do
 * Protocolo Antirregressão exige.
 *
 * ⚠️ **Não é o tamanho de um material de teste.** É o `.pfx` de produção do provedor, medido no
 * servidor em 2026-08-20 — 9.673 bytes na embalagem da Autoridade Certificadora. Material gerado em
 * execução é bem menor, e usá-lo aqui devolveria o problema que esta constante existe para impedir.
 */
export const MAIOR_MATERIAL_REAL_OBSERVADO = 12898;

/**
 * Maior comprimento aceito para a senha que abre o material — **128 caracteres**.
 *
 * ---------------------------------------------------------------------------
 * O valor é fixado AQUI, e a razão precisa estar escrita
 * ---------------------------------------------------------------------------
 *
 * O tech spec nomeia a constante e não fixa o número (§4.2), de modo que este é o ponto onde a
 * decisão acontece. O teto é **anti-abuso, não regra de domínio**: quem decide se a senha está certa
 * é o material, que só abre com ela — o contrato não tem, e não deve ter, opinião sobre a senha
 * escolhida pelo titular no ato da emissão.
 *
 * O critério do número é, portanto, o do erro assimétrico. Recusar senha **legítima** é o defeito
 * caro: o Admin fica sem como registrar um certificado válido, e a recusa não tem contorno do lado
 * dele. Aceitar senha longa demais custa apenas alguns bytes no envelope cifrado. `128` é o teto que
 * não recusa nada que um gerador de senhas comum produza (os gerenciadores usuais param em 64-100
 * caracteres) e ainda assim mantém a senha uma ordem de grandeza abaixo do material, que é onde o
 * volume da entrada legitimamente mora.
 *
 * Ele **não reusa** `COMPRIMENTO_MINIMO_DE_SENHA` de `@sysloc/auth` nem `MAIOR_TEXTO_CURTO` deste
 * pacote, e a distinção não é estilística: aquela é a senha de uma **pessoa deste produto**, sujeita
 * à política de admissão que nós escrevemos; esta é a senha de um **arquivo de terceiro**, cuja
 * política foi decidida por quem o emitiu. Amarrar as duas faria uma política nossa recusar um
 * arquivo que não é nosso.
 *
 * O piso é `1` — e é declarado no esquema, não aqui, porque *"senha não vazia"* é a mesma exigência
 * de todo campo textual obrigatório do contrato, e não um limite próprio deste material.
 */
export const MAIOR_SENHA_DO_MATERIAL = 128;

/**
 * Quantas posições a competência ocupa no identificador — `AAAAMM`.
 *
 * ---------------------------------------------------------------------------
 * Ela é PUBLICADA porque tem consumidor declarado e existente — não por precaução
 * ---------------------------------------------------------------------------
 *
 * A versão anterior deste docblock dizia que ela não sairia daqui, *"pelo mesmo motivo de
 * `LARGURA_DO_ANO_NO_CODIGO` em `cobranca.ts`"*, porque **quem compõe o identificador trabalharia
 * sobre o número que o contador entrega**. A T6 falsificou a premissa ao escrever a composição: quem
 * compõe precisa da **largura** para preencher o contador à esquerda, e não apenas do número. Sem o
 * símbolo, o consumidor assumiu a dependência assim mesmo — por sondagem em caixa-preta de
 * {@link ESQUEMA_DO_IDENTIFICADOR_BANCARIO}, apoiada numa propriedade que este módulo nunca prometeu
 * (que a menor cadeia de zeros aceita fosse a largura total).
 *
 * O consumidor tem **nome e existe hoje**: `packages/db/src/identificador-bancario.ts`
 * (`comporIdentificadorBancario`, que a preenche à esquerda). É a diferença exata em relação ao
 * débito **D16** — lá o defeito foi publicar afirmando consumidor **inexistente**; aqui publicar é o
 * que dá a este módulo como **saber** que tem um, e como protegê-lo por caso deste lado da fronteira
 * (CT-849), em vez de descobrir a divergência só quando o provedor recusar o número.
 *
 * A comparação com `cobranca.ts` continua valendo, e é ela que explica por que aquelas larguras
 * seguem privadas: lá o formatador mora **no mesmo arquivo** das larguras, de modo que nada precisa
 * atravessar a fronteira do pacote. Aqui o compositor mora em `@sysloc/db` por decisão do tech spec
 * (§ tabela de arquivos), e a dependência é **entre pacotes**.
 *
 * A expressão de {@link ESQUEMA_DO_IDENTIFICADOR_BANCARIO} segue composta destas duas larguras, e é
 * isso que impede a decomposição `6 + 12` de divergir do total de 18: publicar não desamarra nada.
 */
export const LARGURA_DA_COMPETENCIA = 6;

/**
 * Quantas posições o contador ocupa no identificador — o preenchimento é à esquerda, com zeros.
 *
 * Publicada pela mesma razão da largura acima, e para o mesmo consumidor: é ela que a composição usa
 * no preenchimento à esquerda, e é ela que a emissão da fatia (ii) usará para decompor o
 * identificador que o produto devolveu ao provedor.
 */
export const LARGURA_DO_CONTADOR = 12;

/**
 * O identificador da cobrança perante o provedor — **18 posições, todas dígitos** (RN-07).
 *
 * ---------------------------------------------------------------------------
 * A largura é fechada dos DOIS lados, e a forma é crua de propósito
 * ---------------------------------------------------------------------------
 *
 * `{18}` e não `{18,}`: o defeito plausível é o preenchimento à esquerda **errado por uma posição**,
 * e um piso aberto o deixaria passar. A expressão é composta a partir das duas larguras acima, de
 * modo que a decomposição `6 + 12` não possa divergir do total.
 *
 * O esquema confere **forma**, e não semântica: `000000000000000000` é aceito, e a aceitação é
 * deliberada. Validar o mês aqui seria inventar regra que a spec não declara (§4.2 fixa
 * `/^[0-9]{18}$/`), e faria o contrato recusar um identificador que o provedor aceitaria.
 *
 * Não há `trim` nem canonização de caixa — ao contrário de `ESQUEMA_DO_CODIGO_DE_COBRANCA`, que os
 * tem. A diferença é de origem: aquele é **digitado por gente**, no caminho da URL, e a caixa
 * divergente produziria `404` sobre registro existente. Este é **composto pela máquina** a partir de
 * um contador, nunca digitado — espaço em volta aqui não é digitação distraída, é sinal de que a
 * composição saiu errada, e engoli-lo esconderia o defeito em vez de tolerá-lo.
 */
export const ESQUEMA_DO_IDENTIFICADOR_BANCARIO = z
  .string()
  .regex(new RegExp(`^[0-9]{${LARGURA_DA_COMPETENCIA + LARGURA_DO_CONTADOR}}$`));

/**
 * Corpo fechado do registro de certificado (§4.1.1) — **dois** campos, nenhum opcional.
 *
 * ---------------------------------------------------------------------------
 * Não há atualização parcial nesta superfície, e a ausência de `PUT`/`PATCH` é a decisão
 * ---------------------------------------------------------------------------
 *
 * Renovar é **registrar de novo** — inserção que substitui, nunca emenda da linha anterior. Por isso
 * campo ausente é recusa por campo obrigatório, e **nunca** *"preserve o valor atual"*: um
 * `.optional()` em qualquer dos dois campos atravessaria a suíte inteira da borda (o serviço apenas
 * receberia `undefined`) sem uma recusa sequer, e o registro gravaria uma identidade pela metade.
 *
 * `material` é conferido como base64 **antes** do teto, e as duas conferências são distintas na
 * resposta: forma ilegal e tamanho excedido recusam nomeando o mesmo campo, com códigos diferentes.
 * O teto está em {@link MAIOR_MATERIAL_CODIFICADO} e conta o texto codificado, que é o que chega.
 *
 * Nenhuma chave decidida pelo servidor entra aqui — `id`, `titular`, `validoAte`, `estado`,
 * `impressaoDigital` e, sobretudo, `empresaId`. O contexto de empresa vem da **sessão**, nunca do
 * corpo (ADR-0008/0009), e o `strictObject` é o que converte a tentativa em recusa nomeando a chave,
 * sem uma linha de verificação escrita à mão.
 */
export const esquemaDoCertificadoNovo = z.strictObject({
  material: z.base64().max(MAIOR_MATERIAL_CODIFICADO),
  senha: z.string().min(1).max(MAIOR_SENHA_DO_MATERIAL),
});

/** O corpo aceito no registro (e na renovação) do certificado. */
export type CertificadoNovo = z.infer<typeof esquemaDoCertificadoNovo>;

/**
 * O certificado como a API o devolve (§4.1.1) — **nove** campos.
 *
 * A projeção é montada a partir das **colunas** e do que se lê do material, nunca do que chegou no
 * corpo (§5.1, passo 7). Os quatro campos que o `getPeerCertificate()` entrega e que **não** são
 * publicados — número de série e emissor entre eles — ficam de fora porque o PRD lista o que sai, e
 * acrescentar campo aqui é alargar superfície publicada sem caso de uso que a peça.
 *
 * `estado` e `diasParaVencer` são **derivados** contra a data corrente da operação, e por isso a
 * mesma linha do banco pode ser publicada com estados diferentes em dias diferentes — é o oposto de
 * defeito: é o que a RN-04 exige, e o que dispensa rotina que "atualize" estado.
 *
 * `registradoPor` é objeto próprio, e não dois campos achatados (`registradoPorId`,
 * `registradoPorNome`), porque autoria é uma coisa só: achatar convidaria a próxima fatia a publicar
 * um dos dois sem o outro.
 */
export const esquemaDoCertificado = z.strictObject({
  id: z.uuid(),
  titular: z.string(),
  validoDe: z.iso.datetime(),
  validoAte: z.iso.datetime(),
  impressaoDigital: z.string(),
  estado: z.enum(ESTADOS_DO_CERTIFICADO),
  diasParaVencer: z.number().int(),
  registradoPor: z.strictObject({
    id: z.uuid(),
    nome: z.string(),
  }),
  registradoEm: z.iso.datetime(),
});

/** O certificado como a API o devolve. */
export type Certificado = z.infer<typeof esquemaDoCertificado>;

/**
 * A resposta de `POST /v1/integracoes-bancarias/certificados` — o certificado **mais** o desfecho
 * do ato de registrá-lo (§4.4 da tech spec da fatia `integracao-bancaria-autonoma`).
 *
 * ===========================================================================
 * Ele é esquema PRÓPRIO, e `esquemaDoCertificado` NÃO ganhou campo
 * ===========================================================================
 *
 * A razão é **de categoria**. Aquela projeção descreve **o certificado** — titular, validade,
 * impressão digital, autoria. *"Foi convertido"* não é propriedade do certificado: é propriedade do
 * **ato de registrá-lo**. Pô-la lá dentro teria dois custos, e os dois são concretos:
 *
 * 1. a **consulta** (`GET`) devolve a mesma projeção, e passaria a publicar um campo que ali ou é
 *    mentira ou exige coluna nova numa tabela existente — migração que esta fatia não carrega, para
 *    um fato que o PRD **não pede** na consulta;
 * 2. `esquemaDoCertificado` é `z.strictObject` **de propósito**, como salvaguarda contra campo
 *    inesperado na projeção do certificado — *"o campo a mais que pode aparecer aqui é o segredo do
 *    provedor entrando na resposta"*. Alargá-lo por conveniência gastaria exatamente a salvaguarda.
 *
 * **Alternativa considerada e rejeitada** — persistir a conversão no certificado: custa coluna nova
 * em tabela existente e mais uma migração, para responder a uma pergunta que o PRD só faz no
 * instante do registro. Fica registrada: se a consulta vier a precisar do fato, é este o caminho, e
 * ele **não** é reabrir esta decisão.
 *
 * ---------------------------------------------------------------------------
 * A forma é a de `esquemaDaAtivacaoDeContrato`, e o precedente é o argumento
 * ---------------------------------------------------------------------------
 *
 * `contrato.ts` já resolveu esta mesma pergunta: a resposta da ativação é o contrato **estendido**
 * com a declaração de efeito (`efeitos`), e não um envelope novo em volta dele. Derivar por
 * `extend` — em vez de redigitar os nove campos — é o que a ADR-0016 exige: a projeção do
 * certificado tem **uma** definição, e quem a acompanha a importa. Um envelope aninhado teria a
 * mesma expressividade e romperia a forma que a base já usa para "o recurso mais o efeito do ato".
 *
 * ⚠️ **O booleano é fechado nos DOIS sentidos, e nunca ausente**: `false` é resposta, e não omissão.
 * Um campo opcional faria *"não precisou converter"* e *"esta versão não sabe responder"* chegarem
 * ao Admin com a mesma forma.
 */
export const esquemaDoDesfechoDoRegistroDeCertificado = esquemaDoCertificado.extend({
  materialConvertido: z.boolean(),
});

/** O desfecho do registro do certificado, como a API o devolve. */
export type DesfechoDoRegistroDeCertificado = z.infer<
  typeof esquemaDoDesfechoDoRegistroDeCertificado
>;

/**
 * Maior comprimento aceito para o identificador da aplicação perante o provedor — 256.
 *
 * Teto **anti-abuso**, e não regra de domínio: quem decide se o identificador está certo é o
 * provedor, na recusa da credencial. O medido no sistema antigo tem algumas dezenas de caracteres,
 * e o teto guarda folga de mais de quatro vezes sobre ele.
 *
 * ⚠️ **A largura é declarada aqui porque foi medida, e não estimada** — é a lição do
 * `MAIOR_MATERIAL_CODIFICADO`, cujo teto foi dimensionado sobre um número que não era o do material
 * real e recusou o certificado de produção (2026-08-20).
 */
export const MAIOR_IDENTIFICADOR_DA_APLICACAO = 256;

/**
 * O corpo do registro da identidade da empresa perante o provedor — **completo e fechado**.
 *
 * Fechado porque é ENTRADA (`contrato-publicado.md`), e **completo** pela mesma razão do
 * certificado: campo ausente é `422`, nunca "preserve o valor atual". Registrar de novo substitui a
 * identidade inteira, e uma atualização parcial faria a linha nova herdar valor que ninguém
 * reinformou — dado de conta calado é emissão recusada pelo provedor semanas depois.
 */
export const esquemaDaIdentidadeNova = z.strictObject({
  /** O identificador da aplicação. É SEGREDO OPERÁVEL (ADR-0032): entra, cifra e nunca volta. */
  identificadorDaAplicacao: z.string().trim().min(1).max(MAIOR_IDENTIFICADOR_DA_APLICACAO),
  numeroDoCliente: z.number().int().positive(),
  numeroDaContaCorrente: z.number().int().positive(),
  codigoDaModalidade: z.number().int().positive(),
});

/** O corpo aceito no registro (e na substituição) da identidade. */
export type IdentidadeNova = z.infer<typeof esquemaDaIdentidadeNova>;

/**
 * A identidade como a API a devolve — **sem o identificador**, por construção.
 *
 * ⚠️ `strictObject` numa SAÍDA, o que a `contrato-publicado.md` não pede — e é a mesma exceção
 * deliberada de {@link esquemaDoCertificado}, pela mesma razão: o campo a mais que pode aparecer
 * nesta projeção não é grandeza derivada com resíduo, é o **segredo do provedor entrando na
 * resposta** por uma projeção montada errado. Entre *"a rota cai e o registro acusa"* e *"o
 * identificador viaja ao cliente"*, a queda é o desfecho preferível — e o esquema estrito é o que a
 * torna certa em vez de provável.
 */
export const esquemaDaIdentidade = z.strictObject({
  id: z.uuid(),
  numeroDoCliente: z.number().int(),
  numeroDaContaCorrente: z.number().int(),
  codigoDaModalidade: z.number().int(),
  registradoPor: z.strictObject({
    id: z.uuid(),
    nome: z.string(),
  }),
  registradoEm: z.iso.datetime(),
});

/** A identidade como a API a devolve. */
export type Identidade = z.infer<typeof esquemaDaIdentidade>;

/**
 * O desfecho da verificação da identidade no provedor (§4.1.1) — **três** campos.
 *
 * A verificação **recusada pelo provedor é `200` com `aceito: false`**: a pergunta foi respondida, e
 * a resposta é "não". O que produz `404` é a ausência de certificado (CA-08), e isso não passa por
 * este esquema.
 *
 * ---------------------------------------------------------------------------
 * `detalhe` é união FECHADA mais o nulo — o `z.string()` era o débito D27
 * ---------------------------------------------------------------------------
 *
 * Enquanto ele era `z.string().nullable()`, a restrição *"o texto sai de um conjunto fechado de
 * constantes"* vivia só em prosa, e este esquema era o caminho direto por onde texto arbitrário —
 * um código de erro de biblioteca, uma linha de OpenSSL, um nome de recurso da instituição —
 * chegaria à tela do Admin. {@link DETALHES_DA_VERIFICACAO} é a declaração única do conjunto, e o
 * `z.enum` a torna exigível **em execução**, do lado publicado; a união derivada por `typeof` a
 * torna exigível **em compilação**, do lado do domínio.
 *
 * ---------------------------------------------------------------------------
 * `detalhe` é ANULÁVEL, e permanece anulável — a anulabilidade é a decisão
 * ---------------------------------------------------------------------------
 *
 * Hoje a borda o preenche nos **dois** desfechos, e no positivo ele não é ornamento: a sonda desta
 * fatia é o aperto de mão mútuo, não a obtenção de credencial de acesso (§8), e o `detalhe` é onde o
 * alcance exato dessa afirmação chega ao Admin. `detalhe` nulo prometeria *"está tudo pronto para
 * cobrar"*, que é mais do que foi medido.
 *
 * Ele nasce anulável mesmo assim, e o motivo é a fatia **(ii)**: quando a sonda passar a ser o
 * `client_credentials` e a promessa passar a ser inteira, ela zera o `detalhe` no desfecho positivo.
 * Sem o `nullable()` aqui, aquela fatia precisaria **mudar o contrato publicado** para fazer o que já
 * está decidido — e mudança de contrato depois do congelamento da superfície é exatamente o custo que
 * declarar a anulabilidade agora evita.
 */
export const esquemaDoResultadoDaVerificacao = z.strictObject({
  aceito: z.boolean(),
  verificadoEm: z.iso.datetime(),
  detalhe: z.enum(DETALHES_DA_VERIFICACAO).nullable(),
});

/** O desfecho da verificação da identidade no provedor. */
export type ResultadoDaVerificacao = z.infer<typeof esquemaDoResultadoDaVerificacao>;

// ===========================================================================
// A ENTREGA DA NOTÍCIA DO PROVEDOR — o estado publicado e o motivo da recusa
// ===========================================================================

/**
 * Os dois estados da entrega da notícia do provedor, na ordem publicada.
 *
 * ---------------------------------------------------------------------------
 * São DOIS, e a lista existe para que o terceiro não nasça sem ninguém decidir
 * ---------------------------------------------------------------------------
 *
 * O glossário canoniza o termo com exatamente estes dois: *habilitada* e *desabilitada*. Não existe
 * um terceiro — e nomeadamente **não existe** um estado *pendente* ou *em verificação*, porque a
 * ativação é síncrona e não há período em que o produto não saiba responder. Enquanto desabilitada,
 * a conferência periódica continua produzindo o efeito: a ausência é **estado declarado**, nunca
 * silêncio.
 *
 * ⚠️ **`habilitada` sai na projeção como BOOLEANO, e não como este rótulo** — ver
 * {@link esquemaDoEstadoDaEntrega}. Esta lista é o **vocabulário**, e é ela que torna a decisão
 * *"são dois, e só dois"* verificável: um terceiro estado obriga a editar este arquivo, e o esquema
 * publicado a deixar de ser booleano. É a mesma régua de {@link MEIOS_DE_RECEBIMENTO}, que declara o
 * pix sem operação para que a fatia que o implementar **não precise alargar vocabulário publicado**
 * — que é mudança de contrato — e sim acrescentar a operação.
 *
 * `as const` fecha a união em **compilação**; `Object.freeze` fecha o arranjo em **execução**, e é a
 * segunda metade que sobrevive ao build — sem ela, um consumidor alarga a lista com um `push` e o
 * produto passa a falar de um estado que ninguém decidiu.
 */
export const ESTADOS_DA_ENTREGA = Object.freeze([
  'HABILITADA',
  'EM_VALIDACAO',
  'DESABILITADA',
] as const);

/**
 * O estado da entrega, como o produto o nomeia — **três**, e o do meio é o que faltava.
 *
 * ⚠️ **`EM_VALIDACAO` não é habilitada nem desabilitada.** É o estado em que **toda** ação corretiva
 * do produto desemboca — cadastrar, corrigir o endereço e reativar levam os três a ele, e é a
 * documentação do provedor que o diz —, porque a validação do endereço é assíncrona por construção.
 * O booleano {@link esquemaDoEstadoDaEntrega} `habilitada` continua existindo e continua significando
 * o que sempre significou; ele é `false` durante a validação, porque a entrega ainda não entrega.
 *
 * Quem lê a tela deve preferir este campo ao booleano: *"em validação"* e *"desabilitada"* pedem
 * condutas opostas do Admin — a primeira é esperar, a segunda é agir.
 */
export type SituacaoDaEntregaPublicada = (typeof ESTADOS_DA_ENTREGA)[number];

/**
 * Quantas chaves o `diagnostico` da recusa admite — teto **anti-abuso**, e não regra de domínio.
 *
 * ---------------------------------------------------------------------------
 * Ele é generoso DE PROPÓSITO, e a razão é a assimetria do erro
 * ---------------------------------------------------------------------------
 *
 * O que se guarda vem de terceiro, e **não se limita por confiança**: sem teto, quem responde decide
 * sozinho quanto o produto grava e publica. Mas recusar um diagnóstico legítimo é o defeito caro —
 * perde-se exatamente a informação que a RN-02 manda preservar íntegra, e quem opera fica sem saber
 * por que a entrega não subiu. Aceitar um diagnóstico grande custa bytes numa coluna.
 *
 * ⚠️ **O número NÃO é medido contra a recusa real do provedor, e a honestidade disso é a lição do
 * `MAIOR_MATERIAL_CODIFICADO`**: aquele teto foi dimensionado com folga generosa sobre uma premissa
 * que estava errada, e recusou o certificado de produção em 2026-08-20. Aqui não há medição a
 * invocar — a recusa do cadastro nunca foi observada —, e por isso o critério declarado é **a folga
 * larga sobre o plausível**, não a proporção sobre um valor. Uma resposta de erro com mais de três
 * dezenas de campos distintos não é diagnóstico: é payload que ninguém desenhou para ser lido.
 *
 * ---------------------------------------------------------------------------
 * QUEM APLICA o teto: a camada que GRAVA — este arquivo publica o número, e só
 * ---------------------------------------------------------------------------
 *
 * O teto vigora em `limitarDiagnostico`, chamada por `gravarDesfechoDaEntrega` em
 * `packages/db/src/entrega-da-noticia.ts` — o **único** ponto da árvore que escreve
 * `motivo_diagnostico` —, e lá ele **trunca**, pela assimetria argumentada acima: perder parte do
 * diagnóstico é barato, perder a recusa inteira não é.
 *
 * ⚠️ **Não leia esta constante como se o esquema publicado a fizesse valer.** Os dois `.refine()` de
 * {@link esquemaDoMotivoDaRecusa} a repetem, mas esquema de **saída não é `parse`ado em execução**
 * nesta base, e `.refine()` não sobrevive ao `z.toJSONSchema` que gera o documento — ver a nota
 * daquele campo. O número mora aqui porque é contrato publicado; a **vigência** dele é da camada de
 * dados.
 */
export const MAIOR_DIAGNOSTICO_EM_CHAVES = 32;

/**
 * Quantos caracteres o `diagnostico` da recusa admite ao todo — o segundo eixo do teto anti-abuso.
 *
 * Os dois eixos existem porque um sozinho não fecha: trinta e duas chaves comportam um megabyte se
 * uma delas carregar um texto imenso, e um teto só de tamanho comporta milhares de chaves minúsculas
 * — a primeira forma estoura a coluna, a segunda estoura quem percorre o objeto. Cada eixo recusa
 * sozinho, nomeando o mesmo campo.
 *
 * A contagem é sobre a **serialização** do registro, que é a forma em que ele viaja e em que ele é
 * gravado — contar sobre a estrutura obrigaria a percorrê-la para decidir se a aceita, o que é fazer
 * trabalho sobre entrada não conferida. Vale aqui o parágrafo de {@link MAIOR_DIAGNOSTICO_EM_CHAVES}
 * sobre a ausência de medição: 8 KiB é folga larga sobre qualquer corpo de erro plausível, e não
 * proporção sobre um número observado.
 */
export const MAIOR_DIAGNOSTICO_EM_CARACTERES = 8192;

/**
 * O eixo de tamanho do teto, como **predicado total** — ele decide para todo registro, e não apenas
 * para os que sabem virar texto.
 *
 * DECISÃO FECHADA — D17 · F5/T5 · fechado na intervenção dirigida de 2026-08-22
 * O QUÊ: a serialização que mede o teto acontece dentro de `try/catch`, e o valor que não serializa
 *        **reprova o refino** em vez de propagar a exceção.
 * POR QUÊ: `z.record(z.string(), z.unknown())` admite qualquer valor, e `JSON.stringify` **lança**
 *        para `BigInt` e para referência circular. O Zod não captura exceção arbitrária levantada
 *        dentro de um refinamento, de modo que `safeParse` **propagava** em vez de devolver
 *        `{ success: false }` — quebrando o contrato tácito de que `safeParse` não levanta, e
 *        quebrando-o justo no guarda anti-abuso, cujo docblock declara que *"o que chega de terceiro
 *        não se limita por confiança"*. Medido contra o `dist/` de então:
 *        `Do not know how to serialize a BigInt` e `Converting circular structure to JSON`.
 * POR QUE ASSIM, e não enumerando os valores ofensores: a proteção é sobre **o ato de serializar**,
 *        e não sobre uma lista — de modo que ela alcança também o `toJSON` que lança e o `Proxy` que
 *        lança na leitura, sem que ninguém precise prevê-los. Lista de valores proibidos nasceria
 *        incompleta e envelheceria a cada runtime novo.
 * REVERTER EXIGE: provar que nenhum valor não serializável alcança este esquema — o que a abertura
 *        deliberada de `z.unknown()` torna impossível de afirmar.
 *
 * Recusar é a leitura **correta**, e não uma degradação: valor que não vira texto é, por definição,
 * diagnóstico que o produto não pode gravar — a coluna é `jsonb`, e o caminho até ela é serialização.
 */
function cabeNoTetoDeCaracteres(registro: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(registro).length <= MAIOR_DIAGNOSTICO_EM_CARACTERES;
  } catch {
    return false;
  }
}

/**
 * O motivo da recusa do provedor (§4.2) — **três campos de nome do produto, valores dele**.
 *
 * ===========================================================================
 * A conciliação entre a RN-02 e a ADR-0001, exercida nas duas direções
 * ===========================================================================
 *
 * O PRD exige o motivo íntegro; a ADR-0001 proíbe vocabulário de provedor de cruzar a porta. As duas
 * valem juntas porque a cláusula é do **vocabulário**, e vocabulário é **nome**, não valor — a mesma
 * leitura que a emenda de 2026-08-17 aplica à credencial de acesso, e a que o `Neutros` da ADR-0034
 * ancora ao declarar que *"o que o terceiro informou continua preservado como diagnóstico"*.
 *
 * Por isso os três nomes aqui são do produto e nenhum deles nomeia chave alguma do provedor, o que é
 * exigível por varredura sobre as chaves deste `shape`; e por isso o `diagnostico` é **aberto**, o
 * que é exigível pela aceitação, em execução, de um registro cuja chave é do provedor.
 *
 * ---------------------------------------------------------------------------
 * O objeto é FECHADO, e só o portador é aberto — a abertura é local
 * ---------------------------------------------------------------------------
 *
 * `strictObject` aqui, num esquema de saída, é a mesma exceção deliberada de
 * {@link esquemaDoCertificado} e de {@link esquemaDaIdentidade}, aplicada onde ela é barata: os três
 * campos são todos os que existem, e um quarto que apareça nesta projeção é sinal de que quem a
 * montou espalhou o objeto do provedor aqui dentro — que é precisamente a alternativa A2 que o D5
 * rejeitou. O que **precisa** ser aberto é um campo só, e ele é aberto por natureza.
 *
 * ⚠️ **Nenhum ramo do produto lê dentro deste objeto.** Quem decide habilitada/desabilitada é o
 * desfecho canônico da porta, e é isso que torna inócuo um código de recusa que ninguém previu — não
 * há tabela que o traduza nem `switch` que o consulte.
 */
export const esquemaDoMotivoDaRecusa = z.strictObject({
  /** O código que o provedor devolveu, íntegro. */
  codigo: z.string(),
  /** A mensagem que o provedor devolveu, íntegra. */
  mensagem: z.string(),
  /**
   * Os campos que variam por código de recusa — **portador opaco**, sem esquema, e **anulável**.
   *
   * ---------------------------------------------------------------------------
   * O nulo é CONTEÚDO, e ele existe porque a camada de dados o admite
   * ---------------------------------------------------------------------------
   *
   * `null` significa *"o provedor recusou e não mandou campo variável nenhum"* — e é **distinto de
   * `{}`**, que é *"mandou um registro, e ele está vazio (ou o teto o esvaziou)"*. A distinção não é
   * teórica: `negocio.entrega_da_noticia.motivo_diagnostico` é `jsonb` **anulável**, e a `CHECK` de
   * coerência da `0023` amarra a mensagem ao código mas exige do diagnóstico apenas
   * `motivo_diagnostico IS NULL OR motivo_codigo IS NOT NULL` — *código sem diagnóstico é estado
   * permitido por construção*, e `MotivoDaRecusaDoProvedor` de `@sysloc/db` já o declara
   * `Record<string, unknown> | null`.
   *
   * ⚠️ **Publicar este campo como obrigatório seria o contrato mentindo sobre o dado gravado**, e a
   * mentira não teria quem a acusasse: esquema de saída não é `parse`ado em execução. O consumidor
   * leria `motivo.diagnostico` num tipo que o autorizou e receberia `null`. **Esta é a última janela
   * antes do congelamento da superfície** — tornar campo de saída anulável depois quebra cliente
   * publicado —, e por isso o lado que se move é o contrato, que é o único ainda móvel; a `0023` está
   * aplicada e é imutável.
   *
   * ⚠️ **Quem compõe esta projeção NÃO converte o nulo em `{}`.** `?? {}` transformaria *"o provedor
   * não mandou campo nenhum"* em *"mandou um objeto vazio"* — a mesma mentira sobre a origem que o
   * docblock de `ResultadoDaOperacaoDeEntrega` proíbe um nível acima, ao recusar preencher `motivo`
   * com texto do produto quando o provedor não respondeu.
   *
   * ---------------------------------------------------------------------------
   * Os dois `.refine()` são CONFERÊNCIA DE LEITURA, e NÃO são o que faz o teto valer
   * ---------------------------------------------------------------------------
   *
   * Eles são conferidos separadamente para que cada eixo recuse sozinho, e os dois reportam o `path`
   * do **campo**: um refino sem `path` próprio nomearia a raiz, e a recusa chegaria sem dizer o que
   * corrigir. Isso vale **quando alguém chama `parse`/`safeParse` sobre este esquema** — o que hoje
   * nenhum ponto do produto faz, porque saída publicada só atravessa `esquemaPublicado(…, 'output')`,
   * que chama `z.toJSONSchema` e **descarta refino**.
   *
   * ⚠️ **Portanto eles não são a guarda; a guarda é `limitarDiagnostico`**, em
   * `packages/db/src/entrega-da-noticia.ts`, no ponto que grava. Ficam aqui porque **usam as mesmas
   * duas constantes** e assim afirmam uma propriedade real e exigível: *tudo o que a camada de dados
   * deixa passar satisfaz o esquema publicado*. Um teto que divergisse do outro reprovaria essa
   * afirmação. Ler estes refinos como contenção de dado de terceiro é o defeito que a rodada 1 desta
   * task cometeu, e por isso a natureza deles está escrita aqui.
   */
  diagnostico: z
    .record(z.string(), z.unknown())
    .refine((registro) => Object.keys(registro).length <= MAIOR_DIAGNOSTICO_EM_CHAVES, {
      error: `o diagnóstico da recusa excede ${MAIOR_DIAGNOSTICO_EM_CHAVES} chaves`,
    })
    .refine((registro) => cabeNoTetoDeCaracteres(registro), {
      error: `o diagnóstico da recusa excede ${MAIOR_DIAGNOSTICO_EM_CARACTERES} caracteres`,
    })
    .nullable(),
});

/** O motivo da recusa do provedor, como a API o devolve. */
export type MotivoDaRecusa = z.infer<typeof esquemaDoMotivoDaRecusa>;

/**
 * O estado da entrega da notícia do provedor (§4.2) — **três** campos.
 *
 * ===========================================================================
 * `z.object`, e a estritude de `esquemaDoCertificado` NÃO se afrouxa por isto
 * ===========================================================================
 *
 * A `.claude/rules/contrato-publicado.md` fixa que a **direção decide a estritude**: saída é aberta,
 * para que um campo novo possa nascer sem quebrar cliente já publicado. As duas exceções desta fatia
 * — {@link esquemaDoCertificado} e {@link esquemaDaIdentidade} — são estritas por razão escrita e
 * **específica**: *"o campo a mais que pode aparecer naquela projeção é o segredo do provedor
 * entrando na resposta"*, e ali a queda da rota é preferível ao vazamento.
 *
 * **Aqui a classe é outra**: esta projeção não deriva de linha que contenha segredo — ela é composta
 * das colunas do estado —, e a exceção não se propaga por vizinhança. O que permanece fechado é o
 * objeto do motivo, e a abertura fica confinada ao portador que é aberto por natureza.
 *
 * ---------------------------------------------------------------------------
 * A anulabilidade dos dois campos é conteúdo, e não conveniência
 * ---------------------------------------------------------------------------
 *
 * `verificadaEm` é nulo quando **nunca houve tentativa** (CA-19) — é assim que a empresa recém-criada
 * se distingue da que tentou e foi recusada, e as duas têm `habilitada: false`. `motivo` é nulo
 * quando não há recusa a explicar: ou porque a entrega está habilitada, ou porque nunca se tentou, ou
 * porque o provedor não chegou a responder e não houve o que preservar íntegro.
 *
 * ⚠️ **`habilitada` é booleano, e o vocabulário dos dois estados vive em {@link ESTADOS_DA_ENTREGA}.**
 * O booleano é a forma exata de um domínio de dois valores; publicar o rótulo obrigaria o consumidor
 * a comparar cadeia onde uma negação basta. A lista existe para que o terceiro estado não possa
 * nascer sem que este arquivo mude.
 */
export const esquemaDoEstadoDaEntrega = z.object({
  habilitada: z.boolean(),
  /**
   * O estado ternário — **o campo que o consumidor deve ler**, e o booleano acima é a projeção dele.
   *
   * ⚠️ **Campo NOVO numa saída ABERTA**, e é por isso que ele pode nascer sem quebrar cliente já
   * publicado: a `.claude/rules/contrato-publicado.md` fixa que a direção decide a estritude, e
   * saída é aberta exatamente para isto. Nenhum campo saiu, nenhum mudou de tipo, e `habilitada`
   * continua valendo o que sempre valeu — a `CHECK` do banco amarra os dois desde a `0025`.
   */
  situacao: z.enum(ESTADOS_DA_ENTREGA),
  verificadaEm: z.iso.datetime().nullable(),
  motivo: esquemaDoMotivoDaRecusa.nullable(),
});

/** O estado da entrega da notícia, como a API o devolve. */
export type EstadoDaEntrega = z.infer<typeof esquemaDoEstadoDaEntrega>;

/**
 * O corpo da ativação da entrega — **vazio, e FECHADO**.
 *
 * ---------------------------------------------------------------------------
 * O corpo vazio é a decisão, e o `strictObject` é o que a torna exigível
 * ---------------------------------------------------------------------------
 *
 * A empresa vem do **contexto da sessão** (ADR-0008/0009), e o que se cadastra é inteiramente
 * determinado pela identidade já registrada: não sobra nada que o cliente escolha. Um corpo que
 * aceitasse campo abriria caminho para o cliente influenciar o destino da chamada ao provedor, que é
 * a forma canônica do defeito de requisição forjada do lado do servidor.
 *
 * ⚠️ **Ele NÃO é dispensável por ser vazio.** Sem esquema declarado, a rota não teria com o que
 * recusar `{ empresaId: … }`, e a chave passaria em silêncio — a ausência de campos é o que se quer,
 * e o `strictObject` é o que converte a tentativa de acrescentar um em recusa **nomeando a chave**,
 * sem uma linha de verificação escrita à mão.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ A tensão com `ESQUEMA_DO_CORPO_VAZIO` da borda é REAL, e fica declarada
 * ---------------------------------------------------------------------------
 *
 * `apps/api/src/comum/esquema-de-corpo-vazio.ts` publica `ESQUEMA_DO_CORPO_VAZIO`, que é
 * `z.strictObject({})` — a mesma forma. Ele é o fecho do débito **D23**, que juntou **quatro** cópias
 * byte a byte espalhadas por controladores, e o `CT-357` mantém a unificação por igualdade de
 * conjunto. Declarar aqui uma segunda constante da mesma forma **parece** reabrir aquilo, e não
 * reabre — por três razões, e as três são verificáveis:
 *
 * 1. **Os dois não são o mesmo fato.** Aquele é a forma **anônima** que a borda aplica a ato cujo
 *    efeito o servidor decide inteiramente, e nenhuma das quatro rotas que o usam tem elemento de
 *    contrato próprio. Este é elemento **nomeado** da superfície publicada: é dele que o documento
 *    OpenAPI da rota deriva (ADR-0016), e é ele que `@sysloc/contracts` entrega ao frontend. É a
 *    mesma distinção — e a mesma razão — que separa `ResultadoDaVerificacaoDeIdentidade`, do domínio,
 *    de {@link esquemaDoResultadoDaVerificacao}, do contrato: dois fatos distintos que hoje têm a
 *    mesma forma.
 * 2. **A direção da dependência proíbe a alternativa.** Este pacote é **folha** e não importa nada do
 *    produto; `apps/api` importa daqui. Reusar a constante da borda faria a fonte única do contrato
 *    depender da aplicação, que é a aresta que a topologia do monorepo não admite.
 * 3. **O risco que o D23 fechou não existe aqui.** O docblock daquele módulo o escreve por extenso:
 *    *"um objeto estrito vazio não tem variação de comportamento possível, de modo que não havia
 *    defeito ativo"* — o custo era de **superfície**, e ele foi pago juntando as cópias que viviam no
 *    **mesmo** pacote e no mesmo papel. Esta declaração não é uma quinta cópia daquele papel.
 *
 * ⚠️ **Quem consumir esta rota importa ESTE esquema, e não a constante da borda.** Usar as duas para
 * a mesma rota é que criaria o segundo caminho — e é isso, e não a coexistência, que se proíbe.
 */
export const esquemaDaAtivacaoDaEntrega = z.strictObject({});

/** O corpo aceito na ativação da entrega da notícia. */
export type AtivacaoDaEntrega = z.infer<typeof esquemaDaAtivacaoDaEntrega>;
