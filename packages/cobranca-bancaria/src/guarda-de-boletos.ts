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
 * - a **linha digitável** que ele carrega já é publicada pela API, em `@sysloc/contracts`;
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

// DÉBITO COM GATILHO — D26 · F4/T9 · registrado 2026-08-17
// O QUÊ: **não há expurgo** do diretório dos boletos. Nada aqui, nem em lugar nenhum do produto,
//        remove o arquivo de uma cobrança encerrada — só `apagar`, chamado no ato da revogação.
// QUANDO FECHA: a **F5**, que traz o agendamento (`systemd timer`), ou a **primeira medição do
//        diretório acima de 20 GB**. Projeção: 300 empresas × ~47 boletos/mês × ~100 KB ≈ 1,4 GB/mês.
// POR QUE NÃO AGORA: o arquivo é **cache recuperável** — a re-obtenção da CA-08 torna a perda
//        inofensiva —, e expurgo é rotina agendada, que é da F5 pela fronteira F4/F5 do discovery.
//        Antecipá-la aqui criaria a primeira rotina agendada da fatia sem a maquinaria que a F5 traz.
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D26

import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { ESQUEMA_DO_CODIGO_DE_COBRANCA } from '@sysloc/contracts';

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
 * As três operações sobre os bytes do boleto — e nada mais.
 *
 * Todas recebem o **código da cobrança**, jamais um caminho: é o que mantém a composição do nome
 * dentro da guarda, num ponto só. Um método que aceitasse caminho pronto devolveria ao chamador
 * exatamente o poder que este módulo existe para lhe negar.
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
    const caminho = resolve(base, nome);

    // O SEGUNDO degrau: o caminho que o sistema operacional de fato usaria é comparado, por
    // igualdade literal, com o único que a base admite. Ele não confia no formato de nada — nem no
    // esquema acima, nem em quem venha a compor o nome por outro caminho.
    if (caminho !== `${prefixoDaBase}${nome}`) {
      throw new ErroDeBoletoForaDaGuarda();
    }

    return { nome, caminho };
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
        // O intermediário não sobrevive à falha: deixá-lo no diretório acumularia lixo que nenhuma
        // leitura alcança e que nenhum expurgo conhece. A remoção nunca mascara a falha original —
        // o erro segue adiante.
        await unlink(parcial).catch(() => undefined);
        throw erro;
      }

      return nome;
    },

    ler: async (codigo) => readFile(resolverBoleto(codigo).caminho),

    apagar: async (codigo) => {
      const { caminho } = resolverBoleto(codigo);

      try {
        await unlink(caminho);
      } catch (erro) {
        if (!ehAusencia(erro)) {
          throw erro;
        }
      }
    },
  };
}
