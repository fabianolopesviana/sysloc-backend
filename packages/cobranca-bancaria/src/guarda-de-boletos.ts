/**
 * A **guarda de boletos** — os bytes que o provedor devolveu, sob um diretório-base conferido.
 *
 * ===========================================================================
 * POR QUE OS BYTES SE GUARDAM, sendo a ADR-0030 o contrário disso
 * ===========================================================================
 *
 * A ADR-0030 decide que artefato derivado de dado gravado é **composto sob demanda e nunca
 * armazenado** — foi ela que apagou `contrato.pdf_contrato_arquivo` na migração `0013`. Ela tem
 * **cláusula de exclusão**, e a cláusula nomeia este arquivo por escrito: o boleto emitido pelo
 * provedor **não é artefato derivado**, é **fato recebido de terceiro**. Ninguém o recompõe a partir
 * do que o produto guarda — quem o compõe é o banco, com o desenho, o código de barras e a
 * autenticação dele —, de modo que perdê-lo custa uma **re-obtenção** junto ao provedor, e não uma
 * renderização local.
 *
 * Não confundir os dois na F4: o **carnê** é derivado e se compõe sob demanda (fatia (iii), com
 * `@react-pdf/renderer`); o **boleto** é fato e se guarda. Nada aqui compõe PDF.
 *
 * ===========================================================================
 * OS BYTES NÃO SÃO CIFRADOS, e a decisão é declarada — não esquecida
 * ===========================================================================
 *
 * A ADR-0032 cifra o **segredo operável** de terceiro: o material PKCS#12 e a senha que o abre.
 * O boleto não é segredo, e por isso fica em claro:
 *
 * - ele é **documento destinado a ser entregue ao locatário**, por e-mail e por carnê;
 * - a **linha digitável** que ele carrega já é publicada pela API, em `@syslocbr/contracts`;
 * - cifrá-lo protegeria contra um adversário que já tem leitura no filesystem do host — e esse
 *   adversário também teria a `EnvironmentFile` 0600, onde a chave de cifra vive.
 *
 * O que protege o acervo é o **modo do diretório** (0750, dono do serviço), provisionado por
 * `deploy/scripts/instalacao/provisionar-base.sh` e conferido por
 * `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh`.
 *
 * ===========================================================================
 * O NOME É DERIVADO, e a conferência do caminho é o SEGUNDO degrau
 * ===========================================================================
 *
 * Nenhum nome de arquivo é **recebido**: ele é composto a partir do código da cobrança, já
 * canonizado por `ESQUEMA_DO_CODIGO_DE_COBRANCA`, que só admite `COB-{4 dígitos}-{7 dígitos}`. Essa
 * validação é o **primeiro degrau, e não o único** — o segundo é a conferência do caminho
 * **resolvido** contra a base, feita antes de qualquer chamada de `fs`.
 *
 * ⚠️ **Manter os dois não é redundância**, e a razão está no perfil de quem os fura: o primeiro
 * degrau desaparece no dia em que alguém compuser o nome por outro caminho — uma sobrecarga que
 * aceite o nome pronto, um código vindo de coluna que a validação não atravessou, um esquema
 * afrouxado por outra fatia. O segundo continua valendo, porque ele não confia no formato de nada:
 * compara o caminho que o sistema operacional de fato usaria com o único que a base admite. É a
 * diferença entre validar entrada e conter efeito.
 *
 * A comparação é por **igualdade literal** com `<base><separador><nome>`, e não por
 * `startsWith(base)`:
 *
 * - `startsWith` sozinho aprova `/var/lib/sysloc-boletos-alheio/x.pdf` sobre a base
 *   `/var/lib/sysloc-boletos` — o prefixo casa e o diretório é outro;
 * - a igualdade fixa também a **profundidade**: nada de subdiretório, que é por onde
 *   `COB-2026/0000054` entraria se o primeiro degrau fosse contornado.
 *
 * ⚠️ **A recusa nomeia o CAMPO, jamais o valor recebido.** Ecoar o caminho que chegou devolveria ao
 * chamador a confirmação de qual caminho ele conseguiu formar — e a mensagem viaja para registro
 * estruturado e para corpo de resposta. É a mesma disciplina de `leitura-do-material.ts`, medida
 * ali (M4): valor interpolado em texto de mensagem sobrevive em `mensagem` e `pilha`, onde a
 * redação do registrador não o alcança.
 *
 * ⚠️ **A CONFERÊNCIA É LÉXICA, e este é o limite dela — declarado no fecho do `D31 · F4/T9`
 * (2026-08-19).** `resolve` normaliza `.`, `..` e separadores, mas **não resolve vínculos
 * simbólicos**. Uma entrada `COB-2026-0000054.pdf` que fosse um vínculo simbólico **dentro** da
 * base passaria nos dois degraus, e `ler` (`readFile`, que segue vínculos) devolveria os bytes do
 * alvo. `gravar` (`rename`) e `apagar` (`unlink`) **não** têm a exposição — substituem ou removem
 * o próprio vínculo.
 *
 * O que fecha esse caminho **não é este módulo**: é o **modo `0750` com dono do serviço**, já
 * declarado no bloco acima. Plantar a entrada exige escrita no diretório, e quem escreve ali é o
 * próprio processo — nenhum outro código do produto o faz. Por isso o achado é de **declaração
 * ausente**, e não de vulnerabilidade explorável.
 *
 * ⚠️ **`realpath` foi DESCARTADO, e a razão importa mais que a alternativa**: `gravar` opera sobre
 * alvo **inexistente** (é ele que cria o arquivo), e `realpath` sobre caminho que ainda não existe
 * levanta. Endurecer por aí quebraria `gravar` — não tente. Se um dia a exposição deixar de ser
 * teórica, o caminho é conferir o vínculo **em `ler`**, depois de abrir e antes de consumir
 * (`lstat`/`O_NOFOLLOW`), nunca trocar a conferência de caminho por `realpath`.
 *
 * ===========================================================================
 * O EXPURGO DO ACERVO — a quarta operação, e a primeira que DESCOBRE nomes
 * ===========================================================================
 *
 * `expurgarBoletosVencidos` fecha o `D26 · F4/T9`, cujo gatilho literal — *"a **F5**, que traz o
 * agendamento"* — disparou com a fatia `automacoes-agendadas`. Até aqui nada no produto removia o
 * arquivo de uma cobrança encerrada: `apagar` só é chamado no ato da revogação, e o acervo crescia
 * monotonicamente (~1,4 GB/mês projetados).
 *
 * ⚠️ **Ele mora AQUI, e não na borda que o agenda**, e a razão é a mesma que põe as outras três
 * neste arquivo: quem conhece o diretório-base e a conferência de caminho é a guarda. Um expurgo
 * escrito na tarefa seria o **segundo** lugar do produto capaz de apagar boleto — com a sua própria
 * ideia do que é "sob a base" —, e o primeiro a divergir venceria em silêncio.
 *
 * ⚠️ **Ele NÃO conhece o banco, e não recebe código de cobrança.** O critério é a **idade do
 * arquivo**, e nada mais: ligar o expurgo ao estado da cobrança faria este pacote consultar dado —
 * exatamente o que a ADR-0025 lhe nega. A perda é inofensiva por decisão declarada acima (o arquivo
 * é fato recuperável junto ao provedor), e o prazo chega **por parâmetro**, da composição raiz.
 *
 * ---------------------------------------------------------------------------
 * As três propriedades da varredura, e o que cada uma fecha
 * ---------------------------------------------------------------------------
 *
 * 1. **Duas fases: reconhecer tudo, depois remover.** Uma varredura que apagasse enquanto examina
 *    deixaria o acervo meio expurgado ao encontrar a primeira entrada que não consegue conferir —
 *    e a contagem devolvida descreveria um estado que ninguém pediu. Aqui, ou a base inteira é
 *    reconhecível e o expurgo acontece, ou **nada é removido** e a recusa sobe.
 * 2. **`lstat`, jamais `stat`.** A natureza e a idade saem do **próprio** item do diretório. Com
 *    `stat`, um vínculo simbólico plantado na base faria a decisão de apagar depender do `mtime` de
 *    um arquivo **fora** dela — a conferência léxica declarada acima não alcança o alvo do vínculo,
 *    e esta é a primeira operação da guarda que **descobre** nomes em vez de derivá-los do código.
 *    Vínculo simbólico é, por isso, **recusado** com {@link ErroDeBoletoForaDaGuarda}: `gravar`
 *    nunca cria um, de modo que a presença dele significa que alguém escreveu no diretório por
 *    fora, e parar é a resposta conservadora. `unlink` removeria o vínculo e não o alvo, mas
 *    *poderia* — e "o alvo sobreviveu" não é propriedade que se queira depender da chamada certa.
 * 3. **Um instante só para toda a passagem.** O relógio é lido **uma vez**, antes do laço: lido por
 *    item, dois arquivos de idade idêntica poderiam cair em lados diferentes do corte conforme a
 *    duração da varredura.
 *
 * ⚠️ **O corte conta DIAS INTEIROS COMPLETOS, e o truncamento é o mecanismo.** A regra é *"sai o que
 * já completou mais dias do que a retenção"*: com 90 dias de prazo, `91d` sai e `90d` exatos
 * **permanecem**. Comparar instantes crus (`agora - dias × 24h`) poria a borda à mercê dos
 * milissegundos que separam o carimbo do arquivo da leitura do relógio — o arquivo de exatamente
 * `N` dias sairia ou ficaria conforme o atraso da passagem, que é indeterminismo em operação
 * destrutiva.
 *
 * ⚠️ **A varredura alcança o intermediário `.parcial`**, e isso é ganho, não efeito colateral: o
 * cabeçalho de {@link GuardaDeBoletos.gravar} registra que uma falha catastrófica pode deixar para
 * trás lixo "que nenhuma leitura alcança e que nenhum expurgo conhece". Agora conhece — pela idade,
 * como todo o resto, sem ramo especial por nome.
 *
 * ===========================================================================
 * O DIRETÓRIO-BASE CHEGA POR PARÂMETRO — este pacote não lê `process.env`
 * ===========================================================================
 *
 * ADR-0025: o domínio declara a porta, e é o adaptador — a composição raiz — que depende dele. O
 * diretório vem de `DIRETORIO_DOS_BOLETOS`, lido **uma vez** na borda e injetado aqui. Ler o
 * ambiente daqui daria ao produto uma segunda origem de configuração, invisível para quem monta a
 * aplicação e impossível de exercitar com um diretório descartável.
 *
 * ⚠️ **A base NÃO é criada aqui**, e a ausência é deliberada: quem a cria é o provisionamento, com
 * **dono e modo** corretos. Um `mkdir` de conveniência a faria nascer com o modo que o `umask` do
 * processo ditasse — frouxo, e sem que nada acusasse —, e mascararia a instalação incompleta que o
 * verificador de infraestrutura existe para pegar.
 */

import { randomUUID } from 'node:crypto';
import { lstat, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { ESQUEMA_DO_CODIGO_DE_COBRANCA } from '@syslocbr/contracts';

/**
 * A extensão do arquivo guardado.
 *
 * O provedor devolve PDF, e o produto o entrega como PDF — a extensão é **conteúdo do contrato com
 * quem lê o arquivo** (o anexo do e-mail, o carnê da fatia (iii)), e não decoração. Constante
 * nomeada porque o teste a afirma por literal escrito à mão: derivá-la lá poria as duas pontas sob a
 * mesma autoria.
 */
const EXTENSAO_DO_BOLETO = '.pdf';

/**
 * O campo que a recusa nomeia — e o **único** conteúdo que ela tem licença para citar.
 *
 * É o nome com que o código da cobrança já viaja na borda (`validar(esquema, valor, 'codigo')`), de
 * modo que a recusa daqui se lê no mesmo vocabulário do envelope de erro da ADR-0017.
 */
const CAMPO_DO_CODIGO = 'codigo';

/**
 * A mensagem da recusa — fixa, sem interpolação, e a ausência de interpolação é o mecanismo.
 *
 * Ela nomeia o campo e o desfecho. Nenhum valor recebido entra aqui: mensagem viaja para o registro
 * estruturado e, traduzida pela borda, para o corpo da resposta.
 */
const MENSAGEM_DA_RECUSA = `o campo ${CAMPO_DO_CODIGO} não identifica um boleto sob a guarda`;

/**
 * O modo do arquivo gravado: leitura e escrita para o dono, leitura para o grupo, nada para os
 * demais — o par do modo `0750` que o provisionamento aplica ao diretório.
 *
 * Ele é declarado no ato da criação, e não corrigido depois: entre um arquivo criado com o modo do
 * `umask` e o `chmod` seguinte existe uma janela em que os bytes estão legíveis para todo mundo.
 */
const MODO_DO_ARQUIVO = 0o640;

/** O sufixo do arquivo intermediário da gravação atômica. Ver {@link criarGuardaDeBoletos}. */
const SUFIXO_PARCIAL = '.parcial';

/** O que o `fs` do Node responde quando o alvo não existe — o único desfecho que `apagar` engole. */
const CODIGO_DE_AUSENCIA = 'ENOENT';

// DÉBITO COM GATILHO — D15 · F5/T7 · registrado 2026-08-23
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, e não protege a constante abaixo.)
// O QUÊ: `MILISSEGUNDOS_POR_DIA` tem **três** declarações de produção — esta,
//        `packages/db/src/derivacao-de-contrato.ts` e
//        `apps/api/src/integracoes-bancarias/certificado.service.ts` —, e as duas anteriores já
//        divergiam entre si na FORMA do literal (`24 * 60 * 60 * 1000` contra `86_400_000`).
//        Esta rodada alinhou o NOME das três; o que falta é a casa única.
// QUANDO FECHA: o **quarto** consumidor de produção, ou a primeira task autorizada a abrir um dos
//        outros dois arquivos por outra razão. O símbolo sobe para `@sysloc/shared` sob o nome já em
//        uso — medido: os três pacotes já declaram `@sysloc/shared` em `dependencies`, de modo que a
//        subida NÃO acrescenta aresta ao grafo de dependências.
// POR QUE NÃO AGORA: publicar exigiria editar dois arquivos de produção fora da lista desta task, e
//        rodar `@sysloc/api` e `@sysloc/db` inteiros numa rodada de CORREÇÃO declarada aditiva —
//        superfície de regressão desproporcional a um literal. O que a rodada podia fazer sem
//        alargar escopo era tornar as três cópias detectáveis por UM identificador, e é o que fez.
// ⚠️ AS TRÊS CÓPIAS EM TESTE FICAM DE FORA, e a exclusão é decisão do Gate 2: elas declaram o valor
//        à mão de propósito (*"literal do caso, jamais importado do artefato sob prova"*), e
//        importá-las do SUT poria as duas pontas sob a mesma autoria. **Não as migre.** São as três
//        abaixo, medidas em 2026-08-23, e QUAIS elas são importa tanto quanto quantas: o GATILHO se
//        aciona por `grep MILISSEGUNDOS_POR_DIA`, e ele devolve UMA delas.
//          * `packages/db/test/derivacao-de-contrato.spec.ts:667` — **homônima**, e a ÚNICA das três
//            que aquele grep devolve. É ela que vai aparecer na tela de quem acionar o gatilho;
//          * `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts` e
//            `apps/worker/test/manutencao-do-acervo.spec.ts` — declaram sob `MS_POR_DIA`, de modo que
//            o grep do gatilho **não as devolve**. Estão nomeadas aqui para que a ausência delas na
//            busca não seja lida como "já foram migradas".
// ÍNDICE: docs/specs/features/automacoes-agendadas/v1/_run/run-report.md §2, D15

/**
 * Milissegundos de um dia — a unidade em que a idade do arquivo é contada.
 *
 * O nome é o **já em uso** nas outras duas declarações de produção do mesmo conceito, e não um
 * sinônimo: o Limiar de Três pressupõe que quem duplica **saiba contar as cópias**, e um `grep` só
 * as encontra juntas se elas se chamarem igual. Ver o marcador acima.
 */
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * O parâmetro que a recusa do expurgo nomeia — sem valor interpolado, como a irmã acima.
 *
 * A recusa aqui é **defeito de programação da composição**, e não desfecho de negócio: a única
 * origem legítima do prazo é a composição raiz, que o declara por constante.
 */
const CAMPO_DA_RETENCAO = 'diasDeRetencao';

/**
 * A mensagem da recusa por prazo inválido — fixa, e a razão de ela existir é o efeito, não a forma.
 *
 * Um prazo negativo ou fracionário faria a comparação de idade classificar **todo** o acervo como
 * vencido, e a operação é destrutiva: a conferência é a contenção do modo de falha mais caro deste
 * módulo, e o custo dela é uma comparação por passagem.
 */
const MENSAGEM_DA_RETENCAO_INVALIDA = `o campo ${CAMPO_DA_RETENCAO} exige um número inteiro de dias não negativo`;

/**
 * O identificador não alcança um boleto **sob a base** — a recusa da guarda.
 *
 * Ela cobre os **dois** degraus com um tipo só, e a fusão é deliberada: distinguir *"o código não
 * está na forma canônica"* de *"o caminho resolvido escaparia da base"* diria ao chamador **qual**
 * defesa ele contornou, e nenhum consumidor do produto age de forma diferente diante das duas. É a
 * mesma régua pela qual `ErroDeMaterialIlegivel` absorve o estouro do teto em `leitura-do-material.ts`.
 *
 * ⚠️ Ela **não carrega causa e não interpola valor**. O que sai é `campo`; o caminho recebido, nunca.
 *
 * Não é publicada pelo barril: nenhum consumidor de fora do pacote a distingue de outra falha da
 * guarda — o código chega à guarda já validado, e a recusa aqui é defeito de programação, não
 * desfecho de negócio. Publicá-la alargaria a superfície sem consumidor que a peça.
 */
export class ErroDeBoletoForaDaGuarda extends Error {
  override readonly name: string = 'ErroDeBoletoForaDaGuarda';

  /** O campo culpado — e nada além dele. */
  readonly campo: typeof CAMPO_DO_CODIGO = CAMPO_DO_CODIGO;

  constructor() {
    super(MENSAGEM_DA_RECUSA);
  }
}

/**
 * As quatro operações da guarda — três sobre **um** boleto, uma sobre o **acervo**.
 *
 * ⚠️ **Nenhuma delas recebe caminho, e a propriedade é a mesma nas duas classes.** As três primeiras
 * recebem o **código da cobrança** e derivam o nome aqui dentro, num ponto só; a quarta não recebe
 * nome algum — ela **descobre** as entradas sob a base e confere cada uma pela mesma comparação. Um
 * método que aceitasse caminho pronto devolveria ao chamador exatamente o poder que este módulo
 * existe para lhe negar.
 */
export interface GuardaDeBoletos {
  /**
   * Grava os bytes e devolve o **nome do arquivo**, relativo à base.
   *
   * ⚠️ O retorno é **relativo**, e é ele que a coluna `negocio.cobranca.boleto_arquivo` guarda.
   * Devolver o caminho absoluto congelaria o diretório-base **dentro do dado**: mudar a instalação
   * de lugar invalidaria todo registro já gravado, e a coluna passaria a descrever configuração em
   * vez de fato.
   */
  readonly gravar: (codigo: string, bytes: Uint8Array) => Promise<string>;

  /** Devolve os bytes guardados. Levanta {@link ErroDeBoletoForaDaGuarda} se o código não servir. */
  readonly ler: (codigo: string) => Promise<Buffer>;

  /**
   * Remove o arquivo, e é **idempotente**: apagar o que já não está lá é sucesso.
   *
   * A escolha segue a natureza do arquivo — cache recuperável, cuja ausência é inofensiva — e evita
   * que a revogação de um boleto falhe por causa de um expurgo anterior.
   */
  readonly apagar: (codigo: string) => Promise<void>;

  /**
   * Remove os boletos guardados cuja idade **excede** a retenção, e devolve quantos saíram.
   *
   * O critério é a idade do arquivo sob a base conferida, e nada mais — ver *"O EXPURGO DO ACERVO"*
   * no cabeçalho para por que ele não consulta estado de cobrança nem recebe código.
   *
   * O corte conta **dias inteiros completos**: com `diasDeRetencao` igual a `90`, o arquivo de `91`
   * dias sai e o de `90` dias **permanece**. É `ENOENT`-tolerante como {@link apagar}: base ausente e
   * arquivo que sumiu entre a leitura do diretório e a remoção não interrompem a passagem.
   *
   * @param diasDeRetencao Quantos dias inteiros um boleto guardado sobrevive. Chega da composição
   *   raiz (ADR-0025), que é onde o prazo é declarado.
   * @returns Quantos arquivos foram removidos nesta passagem.
   * @throws {ErroDeBoletoForaDaGuarda} Quando alguma entrada sob a base não resolve para um caminho
   *   direto sob ela, ou é um **vínculo simbólico** — cuja conferência léxica não alcança o alvo.
   *   Nesse caso **nada é removido**: o reconhecimento acontece inteiro antes da primeira remoção.
   * @throws {RangeError} Quando o prazo não é um número inteiro de dias não negativo.
   */
  readonly expurgarBoletosVencidos: (diasDeRetencao: number) => Promise<number>;
}

/** Verdadeiro quando a falha do `fs` é *"o alvo não existe"* — sem asserção de tipo. */
function ehAusencia(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null || !('code' in erro)) {
    return false;
  }

  const { code } = erro;
  return code === CODIGO_DE_AUSENCIA;
}

/**
 * Remove o arquivo e diz se ele **estava lá** — a ausência é sucesso, nunca falha.
 *
 * É o ponto único da tolerância a `ENOENT` das duas operações que apagam: {@link
 * GuardaDeBoletos.apagar}, cuja idempotência é decisão declarada, e o expurgo, em que a entrada pode
 * sumir entre o reconhecimento e a remoção. Escrever a tolerância duas vezes deixaria uma delas para
 * trás no dia em que o desfecho benigno mudasse.
 */
async function removerTolerandoAusencia(caminho: string): Promise<boolean> {
  try {
    await unlink(caminho);

    return true;
  } catch (erro) {
    if (!ehAusencia(erro)) {
      throw erro;
    }

    return false;
  }
}

/**
 * Cria a guarda sobre um diretório-base.
 *
 * @param diretorioBase O diretório onde os boletos vivem. Chega da composição raiz (ADR-0025), é
 *   **resolvido uma vez** aqui e não é criado — ver o cabeçalho.
 */
export function criarGuardaDeBoletos(diretorioBase: string): GuardaDeBoletos {
  const base = resolve(diretorioBase);
  // O prefixo é montado uma vez, e trata a raiz do sistema de arquivos sem ramo especial: `resolve`
  // remove o separador final de qualquer caminho, menos o da própria raiz (`/`).
  const prefixoDaBase = base.endsWith(sep) ? base : `${base}${sep}`;

  /**
   * O SEGUNDO degrau, em **ponto único**: o caminho que o sistema operacional de fato usaria,
   * comparado por igualdade literal com o único que a base admite.
   *
   * Ele não confia no formato de nada — nem no esquema do código, nem em quem venha a compor o nome
   * por outro caminho —, e não toca o disco.
   *
   * ⚠️ **É uma função só para as duas classes de operação da interface**, e a unicidade é o
   * mecanismo: com a conferência escrita duas vezes, endurecer a das três operações por código
   * deixaria a da varredura do acervo para trás — que é justamente a que examina nomes **vindos do
   * diretório**, e não derivados.
   */
  function caminhoSobABase(nome: string): string {
    const caminho = resolve(base, nome);

    if (caminho !== `${prefixoDaBase}${nome}`) {
      throw new ErroDeBoletoForaDaGuarda();
    }

    return caminho;
  }

  /**
   * O nome derivado e o caminho conferido — **antes** de qualquer chamada de `fs`.
   *
   * As duas recusas levantam o mesmo tipo, de propósito, e nenhuma delas toca o disco.
   */
  function resolverBoleto(codigo: string): { nome: string; caminho: string } {
    const analise = ESQUEMA_DO_CODIGO_DE_COBRANCA.safeParse(codigo);
    if (!analise.success) {
      throw new ErroDeBoletoForaDaGuarda();
    }

    const nome = `${analise.data}${EXTENSAO_DO_BOLETO}`;

    return { nome, caminho: caminhoSobABase(nome) };
  }

  /**
   * Os nomes das entradas sob a base, ou `undefined` quando a base **não existe**.
   *
   * A distinção importa: a ausência da base é o caso `ENOENT`-tolerante do expurgo (a passagem
   * devolve `0`), e qualquer outra falha do `fs` — permissão, por exemplo — segue adiante, porque
   * engoli-la faria o expurgo relatar `0` removidos num diretório que ele nunca conseguiu ler.
   */
  async function listarABase(): Promise<string[] | undefined> {
    try {
      return await readdir(base);
    } catch (erro) {
      if (ehAusencia(erro)) {
        return undefined;
      }

      throw erro;
    }
  }

  /**
   * Os caminhos, sob a base, que **já completaram** mais dias do que a retenção.
   *
   * É a fase de **reconhecimento**, e ela roda inteira antes da primeira remoção — ver a propriedade
   * 1 do cabeçalho. Nada aqui apaga: o que ela devolve é a lista que a fase seguinte consome.
   */
  async function reconhecerVencidos(
    nomes: readonly string[],
    diasDeRetencao: number,
  ): Promise<string[]> {
    // UMA leitura do relógio para a passagem inteira — propriedade 3 do cabeçalho.
    const agora = Date.now();
    const vencidos: string[] = [];

    for (const nome of nomes) {
      const caminho = caminhoSobABase(nome);
      // `lstat`, e não `stat`: a natureza e a idade saem do PRÓPRIO item do diretório, e não do alvo
      // de um vínculo que a conferência léxica não alcança (propriedade 2 do cabeçalho).
      const marca = await lstat(caminho).catch((erro: unknown) => {
        if (ehAusencia(erro)) {
          // A entrada sumiu entre a leitura do diretório e este exame — uma revogação concorrente,
          // por exemplo. Não é anomalia: ela já não está no acervo.
          return undefined;
        }

        throw erro;
      });

      if (marca === undefined) {
        continue;
      }

      if (marca.isSymbolicLink()) {
        throw new ErroDeBoletoForaDaGuarda();
      }

      // O que não é arquivo comum não é boleto guardado, e não se remove: `gravar` só cria arquivo.
      // Ignorar é a resposta conservadora — apagar diretório aqui seria remoção em massa por uma
      // anomalia que este módulo não produziu.
      if (!marca.isFile()) {
        continue;
      }

      // Dias inteiros COMPLETOS: o truncamento é o que torna a borda determinística. Ver o cabeçalho.
      const diasCompletos = Math.floor((agora - marca.mtimeMs) / MILISSEGUNDOS_POR_DIA);

      if (diasCompletos > diasDeRetencao) {
        vencidos.push(caminho);
      }
    }

    return vencidos;
  }

  return {
    gravar: async (codigo, bytes) => {
      const { nome, caminho } = resolverBoleto(codigo);

      // Gravação em duas etapas: intermediário no MESMO diretório, depois renomeação — que é
      // atômica dentro de um sistema de arquivos. Escrever direto sobre o destino deixaria um PDF
      // pela metade se o processo morresse no meio, e um boleto truncado chega ao locatário sem que
      // nada acuse: o arquivo existe, tem o nome certo e não abre.
      //
      // O nome do intermediário é sorteado porque duas emissões da mesma cobrança podem coincidir
      // (uma reemissão sobre uma tentativa em curso), e um intermediário fixo faria uma
      // sobrescrever a outra no meio da escrita.
      const parcial = `${caminho}.${randomUUID()}${SUFIXO_PARCIAL}`;

      try {
        await writeFile(parcial, bytes, { mode: MODO_DO_ARQUIVO });
        await rename(parcial, caminho);
      } catch (erro) {
        // O intermediário não sobrevive à falha CAPTURADA: deixá-lo no diretório acumularia lixo que
        // nenhuma leitura alcança, porque `ler` e `apagar` só compõem `<codigo>.pdf`. A remoção nunca
        // mascara a falha original — o erro segue adiante.
        //
        // ⚠️ **A morte do processo entre o `writeFile` e o `rename` não passa por aqui** (SIGKILL,
        // OOM, reinício), e o órfão de nome sorteado fica. Quem o alcança é `expurgarBoletosVencidos`,
        // que varre **por idade** e sem filtro de nome — foi por isso que o `D32 · F4/T9` exigia que o
        // expurgo não fosse escrito como varredura de `COB-*.pdf`.
        await unlink(parcial).catch(() => undefined);
        throw erro;
      }

      return nome;
    },

    ler: async (codigo) => readFile(resolverBoleto(codigo).caminho),

    apagar: async (codigo) => {
      const { caminho } = resolverBoleto(codigo);

      await removerTolerandoAusencia(caminho);
    },

    expurgarBoletosVencidos: async (diasDeRetencao) => {
      // A conferência do prazo é a PRIMEIRA coisa, antes de o diretório sequer ser lido: um valor
      // inválido classificaria o acervo inteiro como vencido, e a operação é destrutiva.
      if (!Number.isInteger(diasDeRetencao) || diasDeRetencao < 0) {
        throw new RangeError(MENSAGEM_DA_RETENCAO_INVALIDA);
      }

      const nomes = await listarABase();

      if (nomes === undefined) {
        // A base não existe. Ela NÃO é criada aqui (ver o cabeçalho), e o expurgo é o caminho em que
        // a ausência é benigna: não há acervo a limpar.
        return 0;
      }

      // Reconhecer TUDO antes de remover QUALQUER COISA — propriedade 1 do cabeçalho.
      const vencidos = await reconhecerVencidos(nomes, diasDeRetencao);

      let removidos = 0;
      for (const caminho of vencidos) {
        if (await removerTolerandoAusencia(caminho)) {
          removidos += 1;
        }
      }

      // A contagem é do que ESTE módulo removeu, e não do que ele selecionou: o arquivo que sumiu no
      // intervalo já não estava no acervo, e contá-lo faria a linha do diário relatar trabalho que
      // não aconteceu.
      return removidos;
    },
  };
}
