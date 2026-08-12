/**
 * A porta da **política de aviso** contra banco real — CT-606, da T5 da fatia `regua-de-cobranca`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-03    | CT-606 | `lerPoliticaDeAviso` de uma empresa que **nunca configurou** devolve a régua
 * |          |        | desligada — `{ ativo:false, diasAntesDoVencimento:0, intervaloMinimoDias:1,
 * |          |        | janelaInicio:'00:00', janelaFim:'23:59', canal:'EMAIL' }` por `toStrictEqual`
 * |          |        | —, nunca exceção e nunca `undefined`, e **não cria linha alguma**: a contagem
 * |          |        | CRUA de `negocio.politica_de_aviso` é `0` depois da leitura. |
 * | CA-03    | CT-606 | Duas gravações consecutivas com corpos **diferentes** deixam a contagem crua em
 * | CA-02    |        | `1` nas duas vezes — nunca `2` —, e a releitura é estritamente igual ao
 * |          |        | ÚLTIMO corpo gravado. É o `ON CONFLICT (empresa_id) DO UPDATE` de um comando
 * |          |        | só; um `INSERT` puro levantaria `23505`, e um "ler, decidir, gravar" com a
 * |          |        | restrição ausente deixaria `2`. |
 * | CA-03    | CT-606 | O objeto devolvido por `gravarPoliticaDeAviso` (o `RETURNING`) é
 * |          | (b)    | **estritamente igual** ao que a releitura devolve: a rota publica o que a
 * |          |        | instrução gravou, e não uma segunda consulta que já poderia enxergar outra
 * |          |        | escrita. |
 * | CA-03    | CT-606 | Os dois horários voltam no molde `HH:MM` — `'09:00'`, e **nunca**
 * |          | (c)    | `'09:00:00'` —, e o valor devolvido pela porta **passa** por
 * |          |        | `esquemaDaPoliticaDeAviso`. É a projeção `to_char(coluna, 'HH24:MI')` que a
 * |          |        | T3 declarou obrigatória no cabeçalho da tabela sendo CUMPRIDA aqui. |
 * | CA-03    | CT-606 | `POLITICA_DE_AVISO_AUSENTE` está **congelado**: `Object.isFrozen` é `true`, e
 * |          | (d)    | uma escrita nele não altera o que a leitura seguinte devolve a uma segunda
 * |          |        | empresa sem política. |
 *
 * Rastreabilidade: `CA-03 → CT-606 (RD-03)` · `CA-02 → CT-606 (RD-03)`.
 *
 * ===========================================================================
 * O COMPANHEIRO NEGATIVO JÁ EXISTE, e não é reescrito aqui
 * ===========================================================================
 *
 * O card do CT-606 nomeia como `negative companion` o **CT-607** — a leitura e a gravação sob o
 * contexto da empresa B sobre a política de A. Ele foi escrito pela **T3**, e vive em
 * `test/isolamento.spec.ts`, onde está o arranjo de duas empresas e a bateria de recusa por política.
 * Reescrevê-lo aqui seria uma segunda redação da mesma prova, livre para divergir da que já roda — o
 * defeito que este repositório fecha por lar único em toda parte. **Este arquivo não prova
 * isolamento**, e a ausência é deliberada.
 *
 * ===========================================================================
 * A CONTAGEM CRUA É O ÚNICO DISCRIMINADOR — e a lição é medida
 * ===========================================================================
 *
 * Sem ela, uma leitura que gravasse a linha desligada antes de devolvê-la passaria em todas as
 * asserções de valor: o objeto devolvido seria idêntico. E um `upsert` trocado por inserção por
 * chamada só aparece na contagem — o retorno da segunda gravação seria igualmente correto. É a mesma
 * lição do mutante M1 do CT-538, registrada na porta irmã da mora.
 *
 * A contagem é **crua e sem recorte**: `SELECT count(*) FROM negocio.politica_de_aviso`, sem
 * `WHERE empresa_id` — quem recorta é a política de linha, e escrever o filtro aqui seria o segundo
 * caminho para o dado que a ADR-0008 rejeita. Ela conta a **tabela**, e não a visão de nada: o que se
 * conta são fatos gravados.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada, descartada ao fim. Nenhuma coordenada de conexão é lida
 * do ambiente — a suíte nunca toca o banco que atende a operação. O acesso é pelo papel `sysloc_app`,
 * e o contexto é aberto pela borda (`contextoDeTenant.executarCom` mais `emUnidadeDeTrabalho`), que é
 * o mesmo par que a guarda e o controlador usam em operação.
 */

import { esquemaDaPoliticaDeAviso, type PoliticaDeAvisoNova } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as contextoDeTenant from '../src/contexto.ts';
import { admitirEmpresa } from '../src/empresa.ts';
import {
  gravarPoliticaDeAviso,
  lerPoliticaDeAviso,
  POLITICA_DE_AVISO_AUSENTE,
} from '../src/politica-de-aviso.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas idas ao banco, todas sob unidade de trabalho. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/**
 * Uma reserva de UMA conexão, de propósito: com o pool em um, uma unidade de trabalho que vazasse
 * reserva travaria o caso seguinte em vez de passar despercebida.
 */
const RESERVA_DE_UMA = 1;

/** O contexto da empresa da carga inicial — a que nunca gravou política neste arquivo. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/** Nenhuma linha em `negocio.politica_de_aviso` — o que a leitura NÃO pode alterar. */
const NENHUMA_POLITICA = 0;

/** Uma linha, e uma só, por empresa — o que a `politica_de_aviso_empresa_key` impõe. */
const UMA_POLITICA = 1;

/**
 * O primeiro corpo gravado — a régua ligada, com a janela comercial.
 *
 * Os seis campos divergem, um a um, dos do corpo seguinte: um campo repetido entre os dois deixaria
 * de discriminar se o `SET` do `ON CONFLICT` o esqueceu.
 */
const PRIMEIRA_POLITICA: PoliticaDeAvisoNova = {
  ativo: true,
  diasAntesDoVencimento: 10,
  intervaloMinimoDias: 2,
  janelaInicio: '09:00',
  janelaFim: '18:00',
  canal: 'EMAIL',
};

/** O segundo corpo — todos os cinco campos não enumerados diferentes do primeiro. */
const SEGUNDA_POLITICA: PoliticaDeAvisoNova = {
  ativo: false,
  diasAntesDoVencimento: 3,
  intervaloMinimoDias: 7,
  janelaInicio: '07:30',
  janelaFim: '20:00',
  canal: 'EMAIL',
};

/**
 * A régua desligada, escrita **por extenso** e não derivada de `POLITICA_DE_AVISO_AUSENTE`.
 *
 * Derivá-la da constante que o SUT publica faria a asserção concordar consigo mesma: um padrão
 * alterado por engano passaria a ser esperado automaticamente, e o caso deixaria de afirmar **quais**
 * seis valores a empresa sem política lê. Mesma disciplina de `ROTULOS_DE_ESTADO` em
 * `fonte-unica-do-estado.spec.ts`.
 */
const REGUA_DESLIGADA = {
  ativo: false,
  diasAntesDoVencimento: 0,
  intervaloMinimoDias: 1,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
} as const;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/** O contexto de uma empresa, como a guarda o publica a partir da sessão. */
interface Contexto {
  readonly empresaId: string;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * Quantas linhas de `negocio.politica_de_aviso` o contexto corrente alcança.
 *
 * **Sem `WHERE empresa_id`**, e não pode haver: quem recorta é a política (ADR-0008). O `-1` do ramo
 * impossível existe para que uma contagem que não voltasse reprovasse em vez de virar zero — que é
 * exatamente o valor que o passo 2 espera, e que passaria mascarando a falha.
 */
async function contarPoliticas(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.politica_de_aviso
    `;

    return Number(linha?.total ?? -1);
  });
}

/**
 * Admite uma empresa nova e devolve o contexto dela — a segunda leitora da régua desligada.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido, e ela é a porta pública do pacote — a mesma que o Master usa.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, { nome: `Imobiliária ${marca}`, documento: `9900000000${marca}` }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return { empresaId: criada.id };
}

// ===========================================================================
// CT-606 — a régua nasce desligada, a leitura não cria linha, a regravação atualiza a MESMA linha
// ===========================================================================

describe('CT-606 — a política de aviso nasce desligada e a gravação é um `upsert`', () => {
  it(
    'CT-606 — a leitura devolve a régua desligada sem criar linha, e duas gravações deixam UMA',
    async () => {
      // Passo 1 — a empresa nunca configurou: a leitura devolve a régua desligada, por igualdade
      // estrita. Nem exceção, nem `undefined`, nem um objeto com campos a mais.
      const inicial = await emUnidade(CONTEXTO_DE_A, lerPoliticaDeAviso);

      expect(inicial).toStrictEqual(REGUA_DESLIGADA);

      // Passo 2 — a leitura NÃO escreveu. É a única asserção que separa esta porta de uma que
      // gravasse a linha desligada antes de devolvê-la: o valor devolvido seria idêntico.
      expect(await contarPoliticas(CONTEXTO_DE_A)).toBe(NENHUMA_POLITICA);

      // Passo 3 — a primeira gravação. O `RETURNING` e a releitura têm de dizer a mesma coisa.
      const primeiraGravada = await emUnidade(
        CONTEXTO_DE_A,
        async (tx) => await gravarPoliticaDeAviso(tx, PRIMEIRA_POLITICA),
      );

      expect(primeiraGravada).toStrictEqual(PRIMEIRA_POLITICA);
      expect(await emUnidade(CONTEXTO_DE_A, lerPoliticaDeAviso)).toStrictEqual(PRIMEIRA_POLITICA);
      expect(await contarPoliticas(CONTEXTO_DE_A)).toBe(UMA_POLITICA);

      // Passo 4 — a segunda gravação ATUALIZA a mesma linha. A contagem em `1` é o que discrimina o
      // `ON CONFLICT DO UPDATE` de uma inserção por chamada; a igualdade com o SEGUNDO corpo é o que
      // discrimina o `DO UPDATE` de um `DO NOTHING`, que devolveria vazio e preservaria o primeiro.
      const segundaGravada = await emUnidade(
        CONTEXTO_DE_A,
        async (tx) => await gravarPoliticaDeAviso(tx, SEGUNDA_POLITICA),
      );

      expect(segundaGravada).toStrictEqual(SEGUNDA_POLITICA);
      expect(await emUnidade(CONTEXTO_DE_A, lerPoliticaDeAviso)).toStrictEqual(SEGUNDA_POLITICA);
      expect(await contarPoliticas(CONTEXTO_DE_A)).toBe(UMA_POLITICA);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-606 (c) — os horários voltam `HH:MM`, e o que a porta devolve PASSA no esquema publicado',
    async () => {
      const contexto = await admitirEmpresaNova('01');

      // A régua desligada também é publicada, e é ela que a rota de leitura devolve à empresa nova.
      const desligada = await emUnidade(contexto, lerPoliticaDeAviso);

      expect(esquemaDaPoliticaDeAviso.safeParse(desligada).success).toBe(true);

      const gravada = await emUnidade(
        contexto,
        async (tx) => await gravarPoliticaDeAviso(tx, PRIMEIRA_POLITICA),
      );

      // O valor LITERAL, e não um casamento por expressão: `'09:00:00'` — que é o que o driver
      // devolve sem a projeção `to_char(coluna, 'HH24:MI')` — reprova aqui e no esquema abaixo. A
      // recusa do esquema de SAÍDA não produziria `422` em operação: ela levanta na serialização e
      // derruba a rota de leitura, que é a razão de a obrigação estar declarada na coluna.
      expect(gravada.janelaInicio).toBe('09:00');
      expect(gravada.janelaFim).toBe('18:00');
      expect(esquemaDaPoliticaDeAviso.safeParse(gravada).success).toBe(true);

      const relida = await emUnidade(contexto, lerPoliticaDeAviso);

      expect(relida.janelaInicio).toBe('09:00');
      expect(relida.janelaFim).toBe('18:00');
      expect(esquemaDaPoliticaDeAviso.safeParse(relida).success).toBe(true);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-606 (d) — a régua desligada é congelada, e uma escrita nela não alcança a leitura seguinte',
    async () => {
      expect(Object.isFrozen(POLITICA_DE_AVISO_AUSENTE)).toBe(true);

      // A tentativa de escrita passa pelo tipo do contrato, que não carrega `readonly` — é
      // exatamente o alias mutável que um consumidor recebe na fronteira do serviço, e é contra ele
      // que o congelamento protege. Em modo não estrito a atribuição seria silenciosa; o módulo é
      // ESM, portanto estrito, e ela levanta.
      expect(() => {
        POLITICA_DE_AVISO_AUSENTE.diasAntesDoVencimento = 45;
      }).toThrow(TypeError);

      // O efeito observável: uma SEGUNDA empresa sem política continua lendo a régua desligada
      // íntegra. Sem o congelamento, a escrita acima teria mudado o que TODA empresa nova lê, no
      // processo inteiro — a régua de uma empresa vazando para outra por estado compartilhado.
      const contexto = await admitirEmpresaNova('02');

      expect(await emUnidade(contexto, lerPoliticaDeAviso)).toStrictEqual(REGUA_DESLIGADA);
      expect(await contarPoliticas(contexto)).toBe(NENHUMA_POLITICA);
    },
    LIMITE_DO_CASO_MS,
  );
});
