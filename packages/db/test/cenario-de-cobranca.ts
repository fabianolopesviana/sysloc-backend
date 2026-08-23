/**
 * O arranjo mínimo de uma **cobrança lançável** — casa compartilhada, para que a 11ª cópia não nasça.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO EXISTE
 * ---------------------------------------------------------------------------
 *
 * `negocio.envio_de_cobranca` tem chave estrangeira **composta** para `negocio.cobranca`, que a tem
 * para `negocio.contrato`, que a tem para `negocio.imovel` e para duas pessoas — e `negocio.imovel`,
 * para `negocio.conjunto`. Uma suíte que precise de **uma** tentativa de aviso gravada precisa,
 * portanto, da cadeia inteira. A carga inicial não traz contrato nem cobrança (ver `src/semente.ts`),
 * de modo que cada suíte que chegou aqui montou a sua.
 *
 * ⚠️ **Medição de 2026-08-23**: **10** suítes de `packages/db/test/` montam essa cadeia com código
 * próprio — `barreira-de-envio`, `boleto-da-cobranca`, `cobranca`, `contrato`, `documento-de-contrato`,
 * `envio-de-cobranca`, `execucao-da-regua`, `janela`, `roteamento-sem-contexto` e
 * `unidade-de-trabalho` —, e outras **8** fazem o mesmo em `apps/`. Nenhuma casa compartilhada
 * existia. É o **`D21 · F4/T9`** por extenso, e escrever a 11ª aqui o agravaria; importar desta o
 * mantém onde está e dá à próxima um lugar para onde ir.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE MONTA, E O QUE **NÃO** MONTA
 * ---------------------------------------------------------------------------
 *
 * Monta o **mínimo** para que uma cobrança exista e possa ser avisada: conjunto, imóvel, locador,
 * locatário, contrato numerado pela série e cobrança numerada pela série. Tudo pelas **portas de
 * produção**, nunca por `INSERT` cru — é o caminho legítimo que a Iron Law #6 exige, e é o mesmo que
 * as 10 suítes medidas usam.
 *
 * **Não ativa o contrato**, e a ausência é deliberada: `criarCobranca` depende da chave estrangeira,
 * não do estado do contrato — medido no fonte —, e ativar exigiria derivar término e valor total,
 * arrastando duas portas a mais para um arranjo que não as consome. Quem precisar de contrato
 * `ATIVO` (a régua, o encerramento) ativa por fora, com o `contratoCodigo` que este módulo devolve.
 *
 * **Não grava tentativa de aviso, não emite boleto e não registra certificado**: o que cada suíte faz
 * com a cobrança é dela. A casa é do **arranjo**, não do cenário.
 *
 * ---------------------------------------------------------------------------
 * NADA AQUI COMPÕE DATA NO PROCESSO (ADR-0026)
 * ---------------------------------------------------------------------------
 *
 * O vencimento sai de `negocio.data_corrente_da_operacao()` deslocado **no SQL**, e o ano das duas
 * séries sai das próprias portas de leitura do contador. Um `new Date()` aqui faria o arranjo medir a
 * diferença entre dois relógios, que é o defeito que a fatia inteira existe para não ter.
 *
 * O arquivo não termina em `.spec.ts`, então o arcabouço não o executa como caso; o
 * `tsconfig.test.json` continua verificando os tipos dele.
 */

import type { TransactionSql } from 'postgres';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  lerAnoDaSerieDeCobranca,
} from '../src/cobranca.ts';
import { criarConjunto } from '../src/conjunto.ts';
import {
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
} from '../src/contrato.ts';
import { criarImovel } from '../src/imovel.ts';
import type { AcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type Contexto, emUnidadeSobContexto } from './unidade-sob-contexto.ts';

/** Os termos do contrato do arranjo — nenhum deles participa de recorte nas suítes que o consomem. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: 1000,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: false,
} as const;

/** A competência e o valor da cobrança do arranjo — igualmente fora de qualquer recorte. */
const COMPETENCIA = '2026-01-01';
const VALOR_ORIGINAL = 1000;

/** Quantos dias à frente vence a cobrança semeada — longe de qualquer borda de vencimento. */
const DIAS_ATE_O_VENCIMENTO = 30;

/**
 * Um documento único por chamada, dentro do processo.
 *
 * `negocio.pessoa` tem unicidade de documento por empresa, e a mesma suíte pode semear vários
 * cenários: um documento fixo faria a segunda chamada morrer por colisão, longe da causa.
 */
let sequenciaDoCenario = 0;

/** O que o arranjo devolve — o suficiente para avisar, ativar ou emitir por fora. */
export interface CobrancaSemeada {
  /** A empresa sob a qual o cenário foi montado. */
  readonly contexto: Contexto;
  /** O identificador do contrato, para quem precise criar outras cobranças nele. */
  readonly contratoId: string;
  /** O código legível do contrato — a chave que as portas de transição recebem. */
  readonly contratoCodigo: string;
  /** O código legível da cobrança — a chave que `registrarEnvioDeCobranca` recebe. */
  readonly cobrancaCodigo: string;
  /** O endereço do locatário, que é o destinatário natural de um aviso. */
  readonly destinatarioDoLocatario: string;
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
function pessoaDe(nome: string, documento: string, email: string): DadosDaPessoa {
  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: documento,
    rg: null,
    email,
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
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * A leitura sai do mesmo `negocio.data_corrente_da_operacao()` que a visão da cobrança consulta, de
 * modo que o vencimento semeado e o estado derivado partem do mesmo eixo.
 */
async function dataDeslocada(tx: TransactionSql, dias: number): Promise<string> {
  const [linha] = await tx<{ data: string }[]>`
    SELECT to_char(
             negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer),
             'YYYY-MM-DD'
           ) AS data
  `;

  if (linha === undefined) {
    throw new Error('o relógio do banco não devolveu a data corrente da operação');
  }

  return linha.data;
}

/**
 * Semeia a cadeia inteira e devolve uma cobrança pronta para ser avisada.
 *
 * ⚠️ **As duas séries são emitidas pelo protocolo das duas unidades sequenciais** (ADR-0020/0033): a
 * primeira unidade garante o contador e **commita**; a segunda emite o número e grava. Fundir as duas
 * é o desenho que a ADR recusa, e um arranjo que o fizesse montaria o cenário por um caminho que a
 * operação não tem — exatamente o que a Iron Law #6 proíbe.
 */
export async function semearCobrancaDoZero(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  marca: string,
): Promise<CobrancaSemeada> {
  sequenciaDoCenario += 1;
  const sufixo = `${marca}-${String(sequenciaDoCenario)}`;
  const destinatarioDoLocatario = `locatario-${sufixo}@exemplo.invalid`;

  const cadastros = await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${sufixo}` });

    const imovel = await criarImovelDoCenario(tx, conjunto.id, sufixo);

    const locador = await criarPessoa(
      tx,
      'locador',
      pessoaDe(`Locador ${sufixo}`, documentoDaSequencia('7'), `locador-${sufixo}@exemplo.invalid`),
    );
    const locatario = await criarPessoa(
      tx,
      'locatario',
      pessoaDe(`Locatário ${sufixo}`, documentoDaSequencia('8'), destinatarioDoLocatario),
    );

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidadeSobContexto(acesso, contexto, lerAnoDaSerieDeContrato);

  await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });

  const contrato = await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano: anoDoContrato, numero },
    );
  });

  const anoDaCobranca = await emUnidadeSobContexto(acesso, contexto, lerAnoDaSerieDeCobranca);

  await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  const cobranca = await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);
    const dataVencimento = await dataDeslocada(tx, DIAS_ATE_O_VENCIMENTO);

    return await criarCobranca(
      tx,
      {
        contratoId: contrato.id,
        natureza: 'ALUGUEL',
        referencia: `Aluguel do cenário ${sufixo}`,
        competencia: COMPETENCIA,
        dataVencimento,
        valorOriginal: VALOR_ORIGINAL,
      },
      { ano: anoDaCobranca, numero },
    );
  });

  return {
    contexto,
    contratoId: contrato.id,
    contratoCodigo: contrato.codigo,
    cobrancaCodigo: cobranca.codigo,
    destinatarioDoLocatario,
  };
}

/** Um documento de 11 dígitos derivado da sequência — único dentro do processo. */
function documentoDaSequencia(prefixo: string): string {
  return `${prefixo}${String(sequenciaDoCenario).padStart(10, '0')}`;
}

/** O imóvel do cenário — residencial e disponível, porque nada aqui recorta por situação. */
async function criarImovelDoCenario(
  tx: TransactionSql,
  conjuntoId: string,
  sufixo: string,
): Promise<{ readonly id: string }> {
  return await criarImovel(tx, {
    conjuntoId,
    nomeImovel: `Imóvel ${sufixo}`,
    identificadorMunicipal: `IPTU-${sufixo}`,
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
}
