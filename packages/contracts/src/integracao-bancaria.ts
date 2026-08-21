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
