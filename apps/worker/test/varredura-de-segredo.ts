/**
 * A varredura de segredo das suítes deste processo, com o **controle positivo** que a torna capaz de
 * falhar — acessório de verificação da T16 da fatia `emissao-e-conciliacao`.
 *
 * ===========================================================================
 * POR QUE ELE EXISTE, e por que ele nasce compartilhado
 * ===========================================================================
 *
 * A T16 fez o processo de trabalho **decifrar o segredo operável** (`decifrarSegredo` nas duas
 * bordas), de modo que a superfície capaz de abrir o segredo mais forte do produto passou de **um**
 * processo para **dois**. A ADR-0032 é literal quanto ao método — *"a ausência de vazamento é afirmada
 * por **medição da saída real**, nunca por leitura do código"* — e literal quanto ao gatilho: *"cada
 * superfície de saída nova cobra um caso que a observe de fato"*.
 *
 * São **duas** superfícies novas, e as duas são alcançadas pelo mesmo vetor que originou a ADR-0032:
 * `apps/worker/src/fila.ts` registra `consumidor.on('failed', … { erro })` **com o objeto de exceção
 * cru**, e qualquer erro levantado enquanto o claro está em escopo chega ali sem passar por asserção
 * nenhuma — o **diário do processo** por um lado, e o **`failedReason` gravado no servidor de fila**
 * pelo outro.
 *
 * As duas suítes de borda deste processo (`emissao-em-lote.spec.ts` e `conferencia-bancaria.spec.ts`)
 * medem exatamente isso, e mediriam com a **mesma** função. Escrevê-la duas vezes criaria a
 * **terceira** cópia do molde no repositório — a primeira é privada de
 * `apps/api/test/segredo-nao-escapa.e2e.spec.ts` —, e é o limiar de três do `CLAUDE.md` que manda o
 * símbolo subir para casa compartilhada em vez de ganhar a terceira cópia. Ver o
 * `DÉBITO COM GATILHO — D52` abaixo para o que ainda falta unificar, e por que não agora.
 *
 * ===========================================================================
 * TODA VARREDURA CARREGA CONTROLE POSITIVO — e a razão é medida
 * ===========================================================================
 *
 * Uma varredura que **nunca acha nada** aprovaria um produto vazando tudo: é o **AP-29**
 * (`tautological_assertion`), a causa de rejeição repetida desta fatia e da anterior. Por isso quem
 * usa {@link ocorrenciasDe} aplica antes **a mesma função** a {@link controleComAsAgulhas} — um
 * objeto em que cada agulha está plantada num canal diferente (mensagem interpolada, campo aninhado
 * de objeto serializado, item de lista, `Buffer` cru inspecionado) — e afirma a lista de achados por
 * **igualdade** contra {@link rotulosDoControle}. Se a busca quebrar, o controle reprova nomeando
 * qual canal deixou de ser alcançado.
 *
 * E as agulhas não são cadeias inventadas: são a **senha real** e os **bytes reais** que o arranjo
 * cifrou e gravou no banco, e que a borda de fato decifrou. Derivar a agulha do dado real é o que
 * impede a variante oca — *"procurei uma cadeia que nunca entrou"*.
 *
 * ⚠️ **As agulhas são mutuamente não-substring**, e isso é conteúdo: o recorte do material vai em
 * **hexadecimal**, e não em base64, porque um recorte em base64 seria substring do material completo —
 * o controle positivo passaria a achar duas agulhas no canal de uma, e a igualdade que prova a
 * varredura viraria uma lista escrita para bater com o efeito colateral.
 */

import { inspect } from 'node:util';
import type { Logger } from '@sysloc/shared';

// DÉBITO COM GATILHO — D52 · F4/T16 · registrado 2026-08-18
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: `ocorrenciasDe`, o controle positivo e o recorte hexadecimal existem DUAS vezes: aqui e
//        privados em `apps/api/test/segredo-nao-escapa.e2e.spec.ts`. Endurecer a busca de um lado —
//        acrescentar uma normalização, um canal de controle — deixa o outro para trás, e a
//        divergência sai como medição que aprova num processo o que reprovaria no outro.
// QUANDO FECHA: o TERCEIRO consumidor fora de `apps/worker/test/`, ou a primeira alteração das
//        formas buscadas por {@link ocorrenciasDe}.
//        ⚠️ **A candidata registrada era a fatia (iii), do carnê, e a previsão foi REFUTADA por
//        medição na T8 dela (2026-08-19)**: o `CT-990` de `./notificacao-bancaria.spec.ts` é o
//        QUARTO consumidor — e é o quarto **dentro** desta casa, ao lado de `./emissao-em-lote.spec.ts`,
//        `./conferencia-bancaria.spec.ts` e `./ambiente.spec.ts`. Consumidor de dentro **importa** o
//        molde em vez de copiá-lo, então ele não move o gatilho: as cópias continuam sendo duas, e o
//        limiar de três do `CLAUDE.md` segue sem disparar. A previsão sai daqui porque a frase que
//        nomeia a fatia futura envelhece antes do débito que ela justifica.
// POR QUE NÃO AGORA: a casa comum seria `packages/shared/test/`, e a cópia de `apps/api` carrega
//        acessórios que só fazem sentido lá (as superfícies de uma resposta HTTP, as agulhas do ato
//        vencido, a operação de controle do documento publicado). Subir só a metade comum obrigaria
//        a reescrever aquele arquivo inteiro, que está fora da lista da T16.
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D52

/**
 * Quantos bytes do material entram no recorte hexadecimal — 16, que dão 32 dígitos.
 *
 * O recorte sai da **metade** do cofre, e não do começo: material gerado pela mesma ferramenta
 * compartilha o cabeçalho, de modo que o recorte do começo deixaria de ser *deste* segredo e passaria
 * a ser *daquele emissor* — o controle positivo reprovaria por excesso, achando duas agulhas no canal
 * de uma. É a mesma medição registrada em `apps/api/test/segredo-nao-escapa.e2e.spec.ts`.
 */
const BYTES_DO_RECORTE = 16;

/** O par em claro do arranjo, tal como ele o cifrou — a origem das agulhas. */
export interface SegredoDoArranjo {
  readonly material: Buffer;
  readonly senha: string;
}

/** Uma superfície varrida: o texto que saiu e o rótulo que a reprovação vai nomear. */
export interface Superficie {
  readonly rotulo: string;
  readonly texto: string;
}

/**
 * As três agulhas de **um** segredo do arranjo, derivadas do dado que de fato circulou.
 *
 * O `rotulo` entra no nome de cada agulha porque um caso varre o diário **inteiro**, onde as linhas
 * de mais de um cenário convivem: sem ele, as agulhas do segundo cenário sobrescreveriam as do
 * primeiro no mapa, e a varredura passaria a olhar por menos do que circulou.
 */
export function agulhasDoSegredo(
  rotulo: string,
  segredo: SegredoDoArranjo,
): Record<string, string> {
  return {
    [`senha de ${rotulo}`]: segredo.senha,
    [`material de ${rotulo} em base64`]: segredo.material.toString('base64'),
    [`recorte de ${rotulo} em hexadecimal`]: recorteEmHexadecimalDe(segredo.material),
  };
}

/**
 * O recorte do miolo do material, em hexadecimal — a forma em que bytes crus aparecem num despejo.
 *
 * A guarda é do acessório, e não asserção do SUT: um material curto demais para o recorte produziria
 * uma agulha vazia, e cadeia vazia está contida em qualquer texto — a varredura acharia tudo.
 */
function recorteEmHexadecimalDe(bytes: Buffer): string {
  const inicio = Math.floor(bytes.length / 2);

  if (bytes.length < inicio + BYTES_DO_RECORTE) {
    throw new Error(
      `o material do arranjo tem ${String(bytes.length)} bytes, curto para o recorte`,
    );
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
export function ocorrenciasDe(
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
 * O arquivo de diário como superfícies, uma por linha, rotuladas pela **posição**.
 *
 * Uma linha por superfície, e não o arquivo inteiro numa só: é o que faz a reprovação apontar **em
 * que linha** o segredo saiu, em vez de dizer apenas que ele está em algum lugar do arquivo.
 */
export function superficiesDoDiario(linhas: readonly string[]): Superficie[] {
  return linhas.map((texto, posicao) => ({ rotulo: `linha ${String(posicao + 1)}`, texto }));
}

/**
 * O CONTROLE POSITIVO: uma superfície por agulha, cada uma num canal diferente.
 *
 * Uma agulha por canal, e o mapeamento por nome: assim a lista esperada é {@link rotulosDoControle},
 * e uma agulha nova sem canal reprova por **falta** em vez de passar despercebida.
 */
export function controleComAsAgulhas(agulhas: Readonly<Record<string, string>>): Superficie[] {
  return Object.entries(agulhas).map(([nome, agulha], posicao) => ({
    rotulo: `controle (${nome})`,
    texto: canalDeControle(posicao, agulha),
  }));
}

/** Os rótulos que o controle positivo tem de devolver — um por agulha, na ordem declarada. */
export function rotulosDoControle(agulhas: Readonly<Record<string, string>>): string[] {
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

/**
 * Aguarda o esvaziamento pelo mecanismo do próprio registrador — nunca por espera fixa.
 *
 * Sem ele, a leitura do arquivo correria antes de o registrador ter escrito, e a varredura de
 * ausência passaria sobre um arquivo que ainda não recebeu a linha que ela existe para olhar.
 */
export async function esvaziarDiario(logger: Logger): Promise<void> {
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
