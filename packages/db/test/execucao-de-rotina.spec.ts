/**
 * A porta do **registro de execução das rotinas agendadas** contra banco real — CT-1070, CT-1071,
 * CT-1072 e CT-1074, da T4 da fatia `automacoes-agendadas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-12    | CT-1070 | `registrarExecucaoDeRotina` grava **uma** linha por chamada, com o
 * |          |         | `empresa_id` do **contexto corrente** — a função não recebe identificador de
 * |          |         | empresa —, `ocorrida_em` vinda do `now()` do BANCO (entre dois instantes
 * |          |         | lidos do próprio servidor) e `resumo` recuperável como o MESMO objeto, com
 * |          |         | as chaves do vocabulário do produto na mesma grafia. |
 * | CA-12    | CT-1070 | O conjunto de rótulos de `negocio.rotina_agendada` é EXATAMENTE
 * |          | (b)     | `{AVISO_DE_COBRANCA, ENCERRAMENTO_DE_CONTRATOS, CONFERENCIA_DE_LIQUIDACAO}`
 * |          |         | — sem vigilância e sem expurgo, que são manutenção e não gravam registro — e
 * |          |         | ele é o MESMO conjunto de `ROTINAS_PUBLICADAS`, do contrato. |
 * | CA-12    | CT-1071 | A `CHECK (jsonb_typeof(resumo) = 'object')` recusa array, número, cadeia,
 * |          |         | booleano e `null` JSON com `code = '23514'` e `constraint_name =
 * |          |         | 'execucao_de_rotina_resumo_chk'`; o controle positivo `{}` é ACEITO, e a
 * |          |         | contagem final é exatamente `1`. A forma do registro não depende de
 * |          |         | disciplina da aplicação. |
 * | CA-13    | CT-1072 | `expurgarExecucoesVencidas` remove **só** `ocorrida_em < now() -
 * |          |         | make_interval(days => 90)`, com `now()` do BANCO: das cinco linhas de borda
 * |          |         | sai **uma** (91 dias) e a de **90 dias exatos PERMANECE** — o corte é
 * |          |         | estritamente menor. A linha vencida de uma SEGUNDA empresa permanece: o
 * |          |         | expurgo não atravessa tenant, porque quem recorta é a política. |
 * | CA-03    | CT-1074 | `atrasada` é `(agora - ultimaExecucao) > LIMIAR_DE_ATRASO_POR_CADENCIA[cadência]`
 * | CA-14    |         | calculado **no banco**, com o limiar vindo do CONTRATO — os cinco cenários de
 * |          |         | borda dão exatamente `[false, true, false, true, false]`. |
 * | CA-03    | CT-1074 | Rotina **sem execução alguma** só é atrasada quando a empresa existe há mais
 * | CA-14    | (b)     | que o limiar: a empresa de 5 min NÃO está atrasada e a de 48 h ESTÁ. É o par
 * |          |         | que discrimina a regra de um SUT que devolvesse `false` sempre que falta
 * |          |         | execução. |
 * | CA-14    | CT-1074 | O roster devolvido é IGUAL a `ROTINAS_PUBLICADAS` — em ordem e em conjunto —,
 * |          | (c)     | com `ultimaExecucao: null`, `resumo: null` e `historicoRecente: []` nas que
 * |          |         | nunca executaram; a leitura **não cria linha alguma** (contagem crua `0`
 * |          |         | depois dela) e o corpo devolvido **passa** em `esquemaDoEstadoDasRotinas`. |
 * | CA-14    | CT-1074 | `proximaEsperada` é a próxima ocorrência da cadência DECLARADA sobre o
 * |          | (d)     | instante do banco: para a diária, o relógio da OPERAÇÃO marca exatamente a
 * |          |         | hora declarada em `CADENCIA_DA_ROTINA`, no futuro e dentro de 24 h; para a de
 * |          |         | minuto, é o minuto seguinte truncado. |
 *
 * Rastreabilidade: `CA-12 → CT-1070 (RD-15)` · `CA-12 → CT-1071 (RD-19)` ·
 * `CA-13 → CT-1072 (RD-16)` · `CA-03 → CT-1074 (RD-17)` · `CA-14 → CT-1074 (RD-17)`.
 *
 * ===========================================================================
 * O ESPERADO VEM DO CONTRATO, e não de um literal escrito aqui
 * ===========================================================================
 *
 * `ROTINAS_PUBLICADAS`, `CADENCIA_DA_ROTINA` e `LIMIAR_DE_ATRASO_POR_CADENCIA` são importados de
 * `@sysloc/contracts`, e as idades de borda do CT-1074 são **derivadas do limiar**, não digitadas:
 * `limiar − margem` e `limiar + margem`. Reescrevê-las como números soltos cegaria o caso à
 * divergência entre o contrato e a derivação — que é exatamente o que ele existe para pegar. Pelo
 * mesmo motivo, o fuso da operação é **lido do banco** (`./relogio-da-operacao.ts`), e não copiado.
 *
 * ⚠️ **A única exceção é o conjunto de rótulos do enum**, no CT-1070 (b), escrito por extenso *e*
 * comparado ao contrato. Só o contrato não bastaria: remover uma rotina dos dois lugares deixaria os
 * dois de acordo entre si e o caso verde. Só o literal também não: ele não amarraria o banco ao
 * roster que a rota publica. São duas asserções porque são duas afirmações diferentes.
 *
 * ===========================================================================
 * A CONTAGEM CRUA É O DISCRIMINADOR, e ela é SEM RECORTE
 * ===========================================================================
 *
 * Toda contagem deste arquivo é `SELECT count(*) FROM negocio.execucao_de_rotina`, **sem
 * `WHERE empresa_id`**: quem recorta é a política de linha, e escrever o filtro aqui seria o segundo
 * caminho para o dado que a `Decision` da ADR-0008 rejeita — inclusive num arranjo, onde ele
 * mascararia uma política quebrada. É ela que separa *"a leitura devolveu nulos"* de *"a leitura
 * devolveu nulos **e não gravou nada**"*, e *"o expurgo respondeu 1"* de *"o expurgo respondeu 1 e
 * apagou exatamente uma linha"*.
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

import {
  CADENCIA_DA_ROTINA,
  CODIGOS_DE_IMPEDIMENTO,
  type EstadoDeRotina,
  esquemaDoEstadoDasRotinas,
  LIMIAR_DE_ATRASO_POR_CADENCIA,
  ROTINAS_PUBLICADAS,
  type RotinaPublicada,
} from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registrarCertificado } from '../src/certificado-do-provedor.ts';
import { admitirEmpresa } from '../src/empresa.ts';
import { registrarEnvioDeCobranca } from '../src/envio-de-cobranca.ts';
import {
  expurgarExecucoesVencidas,
  lerEstadoDasRotinas,
  type ResumoDaPassagem,
  registrarExecucaoDeRotina,
} from '../src/execucao-de-rotina.ts';
import { gravarPoliticaDeAviso } from '../src/politica-de-aviso.ts';
import { ACESSOS_DA_EMPRESA_A, EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { type CobrancaSemeada, semearCobrancaDoZero } from './cenario-de-cobranca.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import { lerFusoDaOperacao } from './relogio-da-operacao.ts';
import { type Contexto, emUnidadeSobContexto } from './unidade-sob-contexto.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas idas ao banco, todas sob unidade de trabalho. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/**
 * Uma reserva de UMA conexão, de propósito: com o pool em um, uma unidade de trabalho que vazasse
 * reserva travaria o caso seguinte em vez de passar despercebida.
 */
const RESERVA_DE_UMA = 1;

/** O molde em que os instantes atravessam para comparação — o mesmo que a porta publica. */
const FORMATO_ISO = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** O `SQLSTATE` da violação de restrição de verificação, e o nome da que fixa a espécie do resumo. */
const VIOLACAO_DE_CHECK = '23514';
const RESTRICAO_DO_RESUMO = 'execucao_de_rotina_resumo_chk';

/** Os três rótulos que a coluna aceita — ver a advertência do cabeçalho sobre por que são literais. */
const ROTULOS_DO_ENUM = [
  'AVISO_DE_COBRANCA',
  'ENCERRAMENTO_DE_CONTRATOS',
  'CONFERENCIA_DE_LIQUIDACAO',
];

/** Nenhuma linha em `negocio.execucao_de_rotina` — o que a leitura NÃO pode alterar. */
const NENHUMA_EXECUCAO = 0;

/**
 * Quantas passagens o histórico recente devolve **por rotina** — a âncora do limite por construção.
 *
 * O número é escrito aqui de propósito, e não importado do SUT: o limite **não** sai de
 * `@sysloc/db` (ele é mecanismo interno, e publicá-lo daria à borda um tamanho de página para
 * escolher), de modo que a suíte é o único lugar onde a decisão fica registrada de forma executável.
 * Um caso que derivasse o esperado da própria implementação concordaria com ela seja qual for o
 * valor — inclusive com um limite removido por engano.
 */
const PASSAGENS_ESPERADAS_NO_HISTORICO = 5;

const CONTEXTO_DE_A: Contexto = { empresaId: EMPRESA_A.id };
const CONTEXTO_DE_B: Contexto = { empresaId: EMPRESA_B.id };

/**
 * Um resumo por rotina, com as chaves do **vocabulário do produto** (RN-19/RD-19).
 *
 * Os três conjuntos de chaves são disjuntos de propósito: um campo repetido entre duas rotinas
 * deixaria de discriminar se a gravação trocasse os resumos entre elas. E as quatro chaves do aviso
 * são as de `ResultadoDaRegua` — `candidatas`, `enviadas`, `falhas`, `semDestinatario` —, não um
 * segundo vocabulário para o mesmo fato.
 */
const PASSAGENS: readonly { rotina: RotinaPublicada; resumo: ResumoDaPassagem }[] = [
  { rotina: 'ENCERRAMENTO_DE_CONTRATOS', resumo: { candidatos: 2, encerrados: 2, preservados: 0 } },
  {
    rotina: 'AVISO_DE_COBRANCA',
    resumo: { candidatas: 4, enviadas: 3, falhas: 0, semDestinatario: 1 },
  },
  { rotina: 'CONFERENCIA_DE_LIQUIDACAO', resumo: { liquidacoesDescobertas: 4 } },
];

/**
 * Quanto se afasta do limiar, em minutos, para produzir as duas bordas de cada cadência.
 *
 * Ela existe para que as idades semeadas sejam **derivadas do contrato** (`limiar ± margem`) em vez
 * de digitadas: com o limiar de 15 min saem 14 e 16; com o de 26 h, 25 h e 27 h. Trocar o limiar no
 * contrato move as duas bordas junto, e o caso continua medindo a borda — que é o que ele afirma.
 *
 * O tipo é `Record<…, number>` sobre o tipo de cadência **publicado**, de modo que uma cadência nova
 * no roster sem margem declarada aqui não compila.
 */
const MARGEM_DA_BORDA: Readonly<Record<EstadoDeRotina['cadencia']['tipo'], number>> = {
  A_CADA_MINUTO: 1,
  DIARIA: 60,
};

/** Quantos minutos tem um dia — usado para envelhecer empresa e ler a folga da diária. */
const MINUTOS_POR_DIA = 24 * 60;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

/** O fuso da operação, lido do corpo da função canônica no catálogo — nunca redigitado. */
let fusoDaOperacao: string;

/** Sufixo de documento das empresas que os casos admitem — único por empresa admitida. */
let empresasAdmitidas = 0;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });

  fusoDaOperacao = await emUnidade(CONTEXTO_DE_A, lerFusoDaOperacao);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/**
 * Cada caso começa com as duas empresas da carga inicial **no estado em que a empresa nasce**.
 *
 * A limpeza corre pelo papel da aplicação, sob a política, e **sem `WHERE empresa_id`**: quem recorta
 * é o banco (ADR-0008), e escrever o filtro aqui mascararia uma política quebrada. Ela existe porque
 * os casos afirmam contagens exatas e conjuntos completos — sem ela, a ordem dos casos passaria a ser
 * conteúdo. As empresas que os casos admitem por conta própria não precisam de limpeza: cada uma é
 * usada por um caso só.
 *
 * ⚠️ **São as TRÊS relações que os casos deste arquivo escrevem sob contexto, e não apenas a da
 * task.** O CT-1074 (f) grava política de aviso e certificado do provedor na empresa A para montar a
 * linha de controle e o certificado vencido; limpar só o histórico deixaria o caso seguinte que
 * usasse `CONTEXTO_DE_A` herdando régua ligada e certificado vencido **sem nada anunciar**, e a
 * causa da falha ficaria longe de onde ela aparece. Hoje o acoplamento não existe — (f) é o último
 * caso —, e é exatamente por isso que ele se fecha agora: a precondição de cada caso passa a não
 * depender de quem correu antes, em vez de não depender por acidente da ordem.
 */
beforeEach(async () => {
  for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
    await emUnidade(contexto, async (tx) => {
      await tx`DELETE FROM negocio.execucao_de_rotina`;
      await tx`DELETE FROM negocio.certificado_do_provedor`;
      await tx`DELETE FROM negocio.politica_de_aviso`;
    });
  }
});

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco, e ele **não é a 15ª cópia do
 * acessório**: o par `executarCom` + `emUnidadeDeTrabalho` mora em
 * {@link ./unidade-sob-contexto.ts}, casa compartilhada do diretório, e o que fica aqui é a
 * aplicação parcial do `acesso` — o único símbolo local que as 15 declarações medidas capturavam.
 * A medição, e por que as outras 14 **não** foram migradas, estão no docblock daquele módulo.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await emUnidadeSobContexto(acesso, contexto, trabalho);
}

/** Quantas linhas de `negocio.execucao_de_rotina` o contexto corrente alcança — sem recorte escrito. */
async function contarExecucoes(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.execucao_de_rotina
    `;

    // O `-1` do ramo impossível existe para que uma contagem que não voltasse reprovasse em vez de
    // virar zero — que é justamente o valor que alguns passos esperam, e que passaria mascarando.
    return Number(linha?.total ?? -1);
  });
}

/** O instante corrente **do banco**, no molde publicado — o eixo contra o qual `ocorrida_em` é medida. */
async function instanteDoBanco(contexto: Contexto): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ agora: string }[]>`
      SELECT to_char(now() AT TIME ZONE 'UTC', ${FORMATO_ISO}) AS agora
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu o instante corrente');
    }

    return linha.agora;
  });
}

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido, e ela é a porta pública do pacote — a mesma que o Master usa.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  empresasAdmitidas += 1;
  const documento = `88${String(empresasAdmitidas).padStart(12, '0')}`;

  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) => await admitirEmpresa(tx, { nome: `Imobiliária ${marca}`, documento }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return { empresaId: criada.id };
}

/**
 * Recua a admissão da empresa em N minutos, **pelo relógio do banco**.
 *
 * `identidade.empresa` nunca teve política (ADR-0009), e por isso o `WHERE id = …` aqui não é o
 * segundo caminho que a ADR-0008 recusa: ali ele **é** o caminho. O deslocamento sai de `now()` do
 * servidor — compor o instante em JavaScript faria o arranjo medir a diferença entre dois relógios.
 */
async function envelhecerEmpresa(contexto: Contexto, minutos: number): Promise<void> {
  const alcancadas = await emUnidade(contexto, async (tx) => {
    const resultado = await tx`
      UPDATE identidade.empresa
         SET criada_em = now() - make_interval(mins => ${minutos}::integer)
       WHERE id = ${contexto.empresaId}
    `;

    return resultado.count;
  });

  if (alcancadas !== 1) {
    throw new Error(`o arranjo não conseguiu envelhecer a empresa ${contexto.empresaId}`);
  }
}

/**
 * Semeia uma execução com idade controlada, **derivada de `now()` do banco**.
 *
 * A porta de produção não abre parâmetro de instante — `ocorrida_em` é o padrão da coluna —, e abrir
 * um para servir a este arranjo daria a quem chama o poder de escolher quando a passagem aconteceu.
 * Por isso o arranjo emite o `INSERT` direto, com a **mesma** expressão de empresa que as políticas
 * avaliam: nada aqui compara `empresa_id` com valor escrito na aplicação.
 */
async function semearExecucaoEm(
  contexto: Contexto,
  rotina: RotinaPublicada,
  minutosAtras: number,
): Promise<void> {
  const alcancadas = await emUnidade(contexto, async (tx) => {
    const resultado = await tx`
      INSERT INTO negocio.execucao_de_rotina (empresa_id, rotina, ocorrida_em, resumo)
      VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
              ${rotina}::negocio.rotina_agendada,
              now() - make_interval(mins => ${minutosAtras}::integer),
              '{}'::jsonb)
    `;

    return resultado.count;
  });

  if (alcancadas !== 1) {
    throw new Error(`o arranjo não conseguiu semear a execução de ${rotina}`);
  }
}

/** O estado de UMA rotina do roster, para o caso que afirma sobre ela. */
function estadoDe(estados: readonly EstadoDeRotina[], rotina: RotinaPublicada): EstadoDeRotina {
  const estado = estados.find((candidato) => candidato.rotina === rotina);

  if (estado === undefined) {
    throw new Error(`a leitura não devolveu a rotina ${rotina}`);
  }

  return estado;
}

/** O limiar de atraso da rotina, **vindo do contrato** — nunca um número escrito no caso. */
function limiarDe(rotina: RotinaPublicada): number {
  return LIMIAR_DE_ATRASO_POR_CADENCIA[CADENCIA_DA_ROTINA[rotina].tipo];
}

/** A margem de borda da cadência da rotina — ver {@link MARGEM_DA_BORDA}. */
function margemDe(rotina: RotinaPublicada): number {
  return MARGEM_DA_BORDA[CADENCIA_DA_ROTINA[rotina].tipo];
}

/**
 * Um instante deslocado em dias a partir da **data corrente da operação**, para o arranjo do
 * certificado.
 *
 * Ele sai do banco, e não de um `Date` do processo: o eixo contra o qual `registrarCertificado`
 * recusa material vencido é `negocio.data_corrente_da_operacao()`, e montar a validade com o relógio
 * deste processo faria o arranjo medir a diferença entre dois relógios. Mesma forma, e mesma razão,
 * do acessório homônimo de `./certificado-do-provedor.spec.ts`.
 */
async function instanteEmDias(contexto: Contexto, dias: number): Promise<Date> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ instante: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao()
                + make_interval(days => ${dias}::integer))::timestamptz AS instante
    `;

    if (linha === undefined) {
      throw new Error('o banco não devolveu a data corrente da operação deslocada');
    }

    return linha.instante;
  });
}

/**
 * O texto que o Admin lê em cada impedimento — a **âncora** do que a leitura publica.
 *
 * Escrito por extenso aqui, e não importado do SUT: as mensagens não saem de `@sysloc/db` (são
 * mecanismo interno da derivação), de modo que a suíte é o único lugar onde o texto publicado fica
 * registrado de forma executável. Um caso que derivasse o esperado da própria implementação
 * concordaria com ela seja qual for o texto — inclusive com um código de erro de terceiro que
 * vazasse para a tela.
 */
const MENSAGEM_DA_REGUA_DESLIGADA =
  'a régua de cobrança está desligada nas configurações da empresa';
const MENSAGEM_DA_INTEGRACAO_PENDENTE = 'a empresa não tem certificado do provedor vigente';
const MENSAGEM_DA_RECUSA_DO_PROVEDOR = 'o provedor de e-mail recusou o último aviso desta empresa';

/**
 * A janela, em horas, dentro da qual uma recusa do provedor ainda é impedimento corrente.
 *
 * ⚠️ **Esta é a âncora executável de `HORAS_DA_RECUSA_RECENTE`**, e ela não existia: o número é
 * decisão de produto do SUT, que **não** o publica (é mecanismo interno da derivação). Sem um caso
 * que envelheça a recusa para além dela, trocar `24` por `240` — ou **remover** o termo da janela —
 * não moveria um único caso, e o impedimento ficaria pendurado na tela do Admin indefinidamente.
 */
const HORAS_DA_RECUSA_RECENTE = 24;

/** Quanto se envelhece a recusa para atravessar a janela — uma hora além dela, e não um dia. */
const HORAS_ALEM_DA_JANELA = HORAS_DA_RECUSA_RECENTE + 1;

/** E uma hora aquém dela — a outra metade do par que fixa a janela em 24 h, e não "alguma janela". */
const HORAS_DENTRO_DA_JANELA = HORAS_DA_RECUSA_RECENTE - 1;

/** O cenário da janela tem **uma** tentativa, e a contagem do `UPDATE` é o que o afirma. */
const UMA_TENTATIVA = 1;

/** O diagnóstico da tentativa que falhou — o que a régua grava em `causa` quando não sai. */
const CAUSA_DA_RECUSA = 'o provedor recusou a mensagem';

/**
 * O vocabulário de PROCESSO que a mensagem publicada não pode conter (RD-19, ADR-0034).
 *
 * A varredura é sobre o texto que o Admin lê: nome de tabela, código de erro do servidor, jargão de
 * exceção e sentinela de linguagem são diagnóstico operacional, e a trilha publicada fala do produto.
 */
const VOCABULARIO_DE_PROCESSO = [
  'null',
  'undefined',
  'error',
  'exception',
  'sqlstate',
  'constraint',
  'negocio.',
  'jsonb',
  'timestamptz',
];

/** Que termos de processo aparecem na mensagem — lista, e não booleano, para nomear o achado. */
function processoNaMensagem(mensagem: string): string[] {
  const texto = mensagem.toLowerCase();

  return VOCABULARIO_DE_PROCESSO.filter((termo) => texto.includes(termo));
}

/**
 * Grava **uma** tentativa de aviso sobre a cobrança do cenário, pela porta de produção.
 *
 * É `registrarEnvioDeCobranca`, e não um `INSERT` cru: é o mesmo caminho que a régua usa, e é ele
 * que propõe o `empresa_id` do contexto e deixa `criado_em` com o `now()` do banco. A `causa` é
 * pareada com o desfecho pelo critério que o próprio banco impõe — a bicondicional de
 * `envio_de_cobranca_causa_chk` recusaria o par incoerente, e o arranjo morreria longe da causa.
 */
async function semearTentativa(
  cenario: CobrancaSemeada,
  desfecho: 'ENVIADA' | 'FALHOU',
): Promise<void> {
  await emUnidade(cenario.contexto, async (tx) => {
    await registrarEnvioDeCobranca(tx, {
      cobrancaCodigo: cenario.cobrancaCodigo,
      caminho: 'AUTOMATICO',
      desfecho,
      destinatario: cenario.destinatarioDoLocatario,
      causa: desfecho === 'FALHOU' ? CAUSA_DA_RECUSA : null,
    });
  });
}

/**
 * Envelhece **todas** as tentativas da empresa do contexto, pelo relógio do BANCO.
 *
 * A porta não abre parâmetro de instante — `criado_em` é o padrão da coluna —, e abrir um para servir
 * a este arranjo daria a quem chama o poder de escolher quando a tentativa aconteceu, que é
 * exatamente o instante pelo qual a janela conta. O deslocamento sai de `now()` do servidor, e não
 * há `WHERE empresa_id`: quem recorta é a política (ADR-0008).
 */
async function envelhecerTentativas(contexto: Contexto, horas: number): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const resultado = await tx`
      UPDATE negocio.envio_de_cobranca
         SET criado_em = now() - make_interval(hours => ${horas}::integer)
    `;

    return resultado.count;
  });
}

/**
 * Põe o fim da validade do certificado vigente no **dia da operação** deslocado em `dias`.
 *
 * ⚠️ **O instante é ancorado ao MEIO-DIA do fuso da operação, e isso não é estética.** A forma
 * intuitiva — `data_corrente_da_operacao()::timestamptz` — promove o `date` à meia-noite do fuso da
 * **sessão**, que este repositório não declara em ponto algum; sob uma sessão a leste, a mesma linha
 * cairia no dia anterior quando o SUT a reduz pelo fuso da operação, e o arranjo passaria a medir a
 * diferença entre dois fusos em vez da borda que o caso persegue. O meio-dia é o ponto mais distante
 * de qualquer virada de dia, e o fuso vem do **banco** ({@link ./relogio-da-operacao.ts}), nunca de
 * um literal escrito aqui.
 *
 * Não há `WHERE empresa_id`: quem recorta é a política (ADR-0008).
 */
async function posicionarValidadeDoCertificado(contexto: Contexto, dias: number): Promise<void> {
  const alcancados = await emUnidade(contexto, async (tx) => {
    const resultado = await tx`
      UPDATE negocio.certificado_do_provedor
         SET valido_ate = ((negocio.data_corrente_da_operacao()
                              + make_interval(days => ${dias}::integer)) + time '12:00')
                            AT TIME ZONE ${fusoDaOperacao}
       WHERE substituido_em IS NULL
    `;

    return resultado.count;
  });

  if (alcancados !== 1) {
    throw new Error('o arranjo não encontrou um certificado vigente para posicionar');
  }
}

/** O impedimento que a leitura anuncia hoje para a rotina de aviso da empresa do contexto. */
async function impedimentoDoAviso(contexto: Contexto): Promise<EstadoDeRotina['impedimento']> {
  const estados = await emUnidade(contexto, lerEstadoDasRotinas);

  return estadoDe(estados, 'AVISO_DE_COBRANCA').impedimento;
}

/** A régua ligada, com a janela que nunca fecha — o que o cenário da recusa precisa ter antes. */
async function ligarARegua(contexto: Contexto): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    await gravarPoliticaDeAviso(tx, {
      ativo: true,
      diasAntesDoVencimento: 5,
      intervaloMinimoDias: 1,
      janelaInicio: '00:00',
      janelaFim: '23:59',
      canal: 'EMAIL',
    });
  });
}

/**
 * A régua desligada **com política gravada** — e não pela ausência dela.
 *
 * A distinção importa para a perna da precedência: o que se quer é a empresa que **tem** política e a
 * desligou, com a recusa recente ainda gravada, para que os dois fatos de impedimento valham ao mesmo
 * tempo. Apagar a linha produziria o mesmo `REGUA_DESLIGADA` publicado (a ausência é traduzida nele),
 * mas por um caminho diferente do que a tela do Admin exercita.
 */
async function desligarARegua(contexto: Contexto): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    await gravarPoliticaDeAviso(tx, {
      ativo: false,
      diasAntesDoVencimento: 5,
      intervaloMinimoDias: 1,
      janelaInicio: '00:00',
      janelaFim: '23:59',
      canal: 'EMAIL',
    });
  });
}

// ===========================================================================
// CT-1070 — a passagem com efeito grava UM registro, sob o contexto, com o resumo preservado
// ===========================================================================

describe('CT-1070 — a gravação da passagem com efeito', () => {
  it(
    'CT-1070 — grava uma linha por rotina, com a empresa do contexto e o resumo intacto',
    async () => {
      // Passo 1 — o eixo de tempo é o do BANCO, lido antes e depois: `ocorrida_em` tem de cair no
      // intervalo. Um instante composto na aplicação escaparia dele por diferença de relógio.
      const antes = await instanteDoBanco(CONTEXTO_DE_A);

      // Passo 2 — a chamada NÃO recebe identificador de empresa. É a asserção do `empresa_id` mais
      // abaixo que prova de onde ele veio: do `SET LOCAL` da unidade de trabalho.
      for (const passagem of PASSAGENS) {
        await emUnidade(CONTEXTO_DE_A, async (tx) => await registrarExecucaoDeRotina(tx, passagem));
      }

      const depois = await instanteDoBanco(CONTEXTO_DE_A);

      // Passo 3 — releitura por consulta CRUA, sem recorte por empresa: quem recorta é a política.
      const gravadas = await emUnidade(CONTEXTO_DE_A, async (tx) => {
        return await tx<
          { rotina: RotinaPublicada; empresaId: string; ocorridaEm: string; resumo: unknown }[]
        >`
          SELECT rotina::text AS rotina,
                 empresa_id AS "empresaId",
                 to_char(ocorrida_em AT TIME ZONE 'UTC', ${FORMATO_ISO}) AS "ocorridaEm",
                 resumo
            FROM negocio.execucao_de_rotina
        `;
      });

      // Uma linha por rotina, e nada além: a contagem crua é o que separa "gravou" de "gravou uma
      // vez". Um `INSERT` repetido por engano apareceria aqui, e não nas igualdades abaixo.
      expect(gravadas).toHaveLength(PASSAGENS.length);
      expect(await contarExecucoes(CONTEXTO_DE_A)).toBe(PASSAGENS.length);

      for (const passagem of PASSAGENS) {
        const linhas = gravadas.filter((linha) => linha.rotina === passagem.rotina);

        expect(linhas).toHaveLength(1);

        const [linha] = linhas;

        if (linha === undefined) {
          throw new Error(`a releitura não trouxe a linha de ${passagem.rotina}`);
        }

        // O resumo volta PROFUNDAMENTE IGUAL, com as mesmas chaves na mesma grafia. Uma remodelagem
        // — camelCase virando snake_case, número virando texto — reprova aqui.
        expect(linha.resumo).toEqual(passagem.resumo);
        // O `empresa_id` é o da empresa do contexto, e a função não o recebeu por parâmetro.
        expect(linha.empresaId).toBe(EMPRESA_A.id);
        // O instante está no intervalo medido pelo relógio do BANCO. A comparação é lexicográfica, e
        // é exata neste molde: ISO-8601 UTC de largura fixa ordena como o instante que representa.
        expect(linha.ocorridaEm >= antes).toBe(true);
        expect(linha.ocorridaEm <= depois).toBe(true);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1070 (b) — o enum tem exatamente os três rótulos, e eles são o roster publicado',
    async () => {
      const rotulos = await emUnidade(CONTEXTO_DE_A, async (tx) => {
        const linhas = await tx<{ rotulo: string }[]>`
          SELECT e.enumlabel AS rotulo
            FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
           WHERE n.nspname = 'negocio'
             AND t.typname = 'rotina_agendada'
        `;

        return linhas.map((linha) => linha.rotulo);
      });

      // Controle antivácuo: sem ele, um tipo inexistente devolveria conjunto vazio e as duas
      // igualdades abaixo passariam por vacuidade contra um esperado também vazio.
      expect(rotulos.length).toBe(ROTULOS_DO_ENUM.length);

      // Igualdade de CONJUNTO — invariante sob reordenação, que é o que a T3 declarou por escrito no
      // docblock de `rotinaAgendada`. Acrescentar `VIGILANCIA_DAS_ROTINAS` ou `EXPURGO_DO_HISTORICO`
      // ao enum reprova aqui, e é essa reprovação que impede o retorno do registro de manutenção que
      // produzia 12 MB por empresa no sistema antigo.
      expect(diferencasDeConjunto(rotulos, ROTULOS_DO_ENUM)).toEqual({
        excedentes: [],
        ausentes: [],
      });

      // E o mesmo conjunto é o roster que a rota publica: é esta asserção — e não a de cima — que
      // amarra o banco ao contrato, e que reprova se um dos dois lados ganhar rotina sem o outro.
      expect(diferencasDeConjunto(rotulos, [...ROTINAS_PUBLICADAS])).toEqual({
        excedentes: [],
        ausentes: [],
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1071 — a espécie do resumo é imposta pelo BANCO, não por disciplina da aplicação
// ===========================================================================

describe('CT-1071 — o banco recusa resumo que não seja objeto JSON', () => {
  /** Os cinco tipos de documento `jsonb` que não são objeto, mais o `null` JSON. */
  const RECUSADOS = ['[]', '[1,2]', '42', '"texto"', 'true', 'null'];

  /** O controle positivo: o objeto vazio é documento válido e ACEITO. */
  const ACEITO = '{}';

  /**
   * Emite o `INSERT` cru com o resumo pedido, sob o contexto informado.
   *
   * É `INSERT` direto, e não a porta, porque a porta só aceita objeto — o que esta bateria prova é
   * que a rede NÃO depende disso: mesmo quem escrevesse SQL à mão esbarra na `CHECK`. Cada tentativa
   * corre na **própria** unidade de trabalho: a violação aborta a transação, e uma instrução seguinte
   * na mesma unidade falharia com `25P02`, escondendo a causa real.
   */
  async function gravarResumoCru(contexto: Contexto, resumo: string): Promise<void> {
    await emUnidade(contexto, async (tx) => {
      await tx`
        INSERT INTO negocio.execucao_de_rotina (empresa_id, rotina, resumo)
        VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                'AVISO_DE_COBRANCA'::negocio.rotina_agendada,
                ${resumo}::text::jsonb)
      `;
    });
  }

  it(
    'CT-1071 — as seis espécies erradas são recusadas com 23514, e só o objeto entra',
    async () => {
      // Passo 1 — controle positivo PRIMEIRO, na mesma conexão e sob o mesmo contexto: ele prova que
      // quem recusa abaixo é a `CHECK`, e não a política de linha nem um privilégio ausente.
      await gravarResumoCru(CONTEXTO_DE_A, ACEITO);

      expect(await contarExecucoes(CONTEXTO_DE_A)).toBe(1);

      // Passo 2 — as seis recusas, cada uma nomeada pelo par (`code`, `constraint_name`), que é o
      // contrato do protocolo. Casar pelo texto da mensagem seria casar com a localização do servidor.
      for (const resumo of RECUSADOS) {
        await expect(gravarResumoCru(CONTEXTO_DE_A, resumo)).rejects.toMatchObject({
          code: VIOLACAO_DE_CHECK,
          constraint_name: RESTRICAO_DO_RESUMO,
        });
      }

      // Passo 3 — a contagem final é o discriminador: sem ela, uma `CHECK` ausente que produzisse
      // erro por outra razão (um cast malfeito, digamos) passaria nas seis asserções acima enquanto
      // deixasse linhas gravadas.
      expect(await contarExecucoes(CONTEXTO_DE_A)).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1072 — o expurgo corta em 90 dias exatos, contra o relógio do banco, e não atravessa tenant
// ===========================================================================

describe('CT-1072 — o expurgo do histórico por idade', () => {
  /** As cinco idades de borda, em dias e segundos, medidas contra `now()` do BANCO. */
  const BORDAS = [
    { rotulo: '91 dias', dias: 91, segundos: 0, sobrevive: false },
    { rotulo: '90 dias exatos', dias: 90, segundos: 0, sobrevive: true },
    { rotulo: '90 dias menos 1 segundo', dias: 90, segundos: -1, sobrevive: true },
    { rotulo: '89 dias', dias: 89, segundos: 0, sobrevive: true },
    { rotulo: '0 dias', dias: 0, segundos: 0, sobrevive: true },
  ];

  /** A idade da linha da segunda empresa — vencida com folga, para que só a política a proteja. */
  const DIAS_DA_LINHA_DE_B = 120;

  it(
    'CT-1072 — sai só a de 91 dias, a de 90 exatos permanece, e a linha de B é intocada',
    async () => {
      // Passo 1 — a linha vencida da SEGUNDA empresa. Ela é a perna que impede um `DELETE` sem
      // contexto de passar: apagada, o expurgo teria atravessado tenant.
      await emUnidade(CONTEXTO_DE_B, async (tx) => {
        await tx`
          INSERT INTO negocio.execucao_de_rotina (empresa_id, rotina, ocorrida_em, resumo)
          VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                  'AVISO_DE_COBRANCA'::negocio.rotina_agendada,
                  now() - make_interval(days => ${DIAS_DA_LINHA_DE_B}::integer),
                  '{}'::jsonb)
        `;
      });

      // Passo 2 — semeadura e expurgo correm na MESMA unidade de trabalho, e a escolha é conteúdo:
      // `now()` é o instante do início da transação, de modo que a linha de "90 dias exatos" só é
      // exatamente de 90 dias se o corte for medido pelo mesmo relógio que a semeou. Em transações
      // separadas, o `now()` do expurgo seria posterior e a borda deixaria de ser a borda — o caso
      // passaria a aprovar tanto o `<` quanto o `<=`, que é justamente o que ele existe para separar.
      const apuracao = await emUnidade(CONTEXTO_DE_A, async (tx) => {
        const semeadas: { rotulo: string; ocorridaEm: string; sobrevive: boolean }[] = [];

        for (const borda of BORDAS) {
          const [linha] = await tx<{ ocorridaEm: string }[]>`
            INSERT INTO negocio.execucao_de_rotina (empresa_id, rotina, ocorrida_em, resumo)
            VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                    'AVISO_DE_COBRANCA'::negocio.rotina_agendada,
                    now() - make_interval(days => ${borda.dias}::integer,
                                          secs => ${borda.segundos}::integer),
                    '{}'::jsonb)
            RETURNING to_char(ocorrida_em AT TIME ZONE 'UTC', ${FORMATO_ISO}) AS "ocorridaEm"
          `;

          if (linha === undefined) {
            throw new Error(`o arranjo não conseguiu semear a borda de ${borda.rotulo}`);
          }

          semeadas.push({
            rotulo: borda.rotulo,
            ocorridaEm: linha.ocorridaEm,
            sobrevive: borda.sobrevive,
          });
        }

        const removidos = await expurgarExecucoesVencidas(tx);

        const sobreviventes = await tx<{ ocorridaEm: string }[]>`
          SELECT to_char(ocorrida_em AT TIME ZONE 'UTC', ${FORMATO_ISO}) AS "ocorridaEm"
            FROM negocio.execucao_de_rotina
           ORDER BY ocorrida_em
        `;

        return {
          removidos,
          semeadas,
          sobreviventes: sobreviventes.map((linha) => linha.ocorridaEm),
        };
      });

      // A contagem devolvida é a do SERVIDOR — quantas linhas o `DELETE` alcançou.
      expect(apuracao.removidos).toEqual({ removidos: 1 });

      // E o conjunto sobrevivente é IGUAL ao das quatro que deviam ficar, por igualdade e não por
      // contenção: contenção aprovaria tanto a linha a mais quanto a linha a menos.
      const esperados = apuracao.semeadas
        .filter((linha) => linha.sobrevive)
        .map((linha) => linha.ocorridaEm);

      expect(apuracao.sobreviventes.length).toBe(esperados.length);
      expect(diferencasDeConjunto(apuracao.sobreviventes, esperados)).toEqual({
        excedentes: [],
        ausentes: [],
      });

      // A de 90 dias EXATOS permanece — é ela que discrimina `<` de `<=`, e sem esta asserção o caso
      // aprovaria os dois. Ela é nomeada, e não deduzida da contagem.
      const noventaExatos = apuracao.semeadas.find((linha) => linha.rotulo === '90 dias exatos');

      expect(noventaExatos).toBeDefined();
      expect(apuracao.sobreviventes).toContain(noventaExatos?.ocorridaEm);

      // O commit preservou o que o expurgo poupou, e a empresa B segue com a linha vencida dela.
      expect(await contarExecucoes(CONTEXTO_DE_A)).toBe(esperados.length);
      expect(await contarExecucoes(CONTEXTO_DE_B)).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1074 — `atrasada` e `proximaEsperada` derivadas NO BANCO, a partir da cadência publicada
// ===========================================================================

describe('CT-1074 — a derivação do atraso e da próxima passagem esperada', () => {
  /**
   * Os cinco cenários de borda, com a idade da execução **derivada do limiar do contrato**.
   *
   * A empresa dos quatro primeiros é envelhecida além de qualquer limiar, para que o eixo em jogo
   * seja o da execução — e não o da admissão. O quinto não tem execução alguma, e ali o eixo é
   * justamente a admissão.
   */
  const CENARIOS: readonly {
    rotina: RotinaPublicada;
    comExecucao: boolean;
    passos: number;
    atrasada: boolean;
  }[] = [
    { rotina: 'AVISO_DE_COBRANCA', comExecucao: true, passos: -1, atrasada: false },
    { rotina: 'AVISO_DE_COBRANCA', comExecucao: true, passos: 1, atrasada: true },
    { rotina: 'ENCERRAMENTO_DE_CONTRATOS', comExecucao: true, passos: -1, atrasada: false },
    { rotina: 'ENCERRAMENTO_DE_CONTRATOS', comExecucao: true, passos: 1, atrasada: true },
    { rotina: 'CONFERENCIA_DE_LIQUIDACAO', comExecucao: false, passos: 0, atrasada: false },
  ];

  /** A idade da empresa dos cenários com execução — bem além do maior limiar publicado. */
  const IDADE_DA_EMPRESA_VELHA = 2 * MINUTOS_POR_DIA;

  /** A idade da empresa recém-admitida do quinto cenário. */
  const IDADE_DA_EMPRESA_NOVA = 5;

  it(
    'CT-1074 — os cinco cenários de borda dão exatamente [false, true, false, true, false]',
    async () => {
      const observados: boolean[] = [];

      for (const [posicao, cenario] of CENARIOS.entries()) {
        const contexto = await admitirEmpresaNova(`atraso-${posicao}`);

        if (cenario.comExecucao) {
          await envelhecerEmpresa(contexto, IDADE_DA_EMPRESA_VELHA);
          // A idade sai de `limiar ± margem`, com o limiar vindo do CONTRATO — 14 e 16 min para a
          // cadência de minuto, 25 h e 27 h para a diária.
          await semearExecucaoEm(
            contexto,
            cenario.rotina,
            limiarDe(cenario.rotina) + cenario.passos * margemDe(cenario.rotina),
          );
        } else {
          await envelhecerEmpresa(contexto, IDADE_DA_EMPRESA_NOVA);
        }

        const estados = await emUnidade(contexto, lerEstadoDasRotinas);

        observados.push(estadoDe(estados, cenario.rotina).atrasada);
      }

      // Igualdade booleana sobre a lista inteira, e não "é verdadeiro-ish" caso a caso: a lista é o
      // que discrimina um SUT que sempre responde `false` de um que compara contra o limiar certo.
      expect(observados).toEqual(CENARIOS.map((cenario) => cenario.atrasada));
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (b) — sem execução, o eixo é a admissão: 5 min não atrasa, 48 h atrasa',
    async () => {
      const rotina: RotinaPublicada = 'CONFERENCIA_DE_LIQUIDACAO';

      const nova = await admitirEmpresaNova('admissao-nova');
      await envelhecerEmpresa(nova, IDADE_DA_EMPRESA_NOVA);

      const antiga = await admitirEmpresaNova('admissao-antiga');
      await envelhecerEmpresa(antiga, IDADE_DA_EMPRESA_VELHA);

      const estadoDaNova = estadoDe(await emUnidade(nova, lerEstadoDasRotinas), rotina);
      const estadoDaAntiga = estadoDe(await emUnidade(antiga, lerEstadoDasRotinas), rotina);

      // As DUAS pernas, e é o par que discrimina: só a primeira aprovaria um SUT que devolvesse
      // `false` sempre que falta execução — e a rotina que nunca correu jamais alertaria.
      expect(estadoDaNova.atrasada).toBe(false);
      expect(estadoDaAntiga.atrasada).toBe(true);

      // Nenhuma das duas tem execução: o que mudou entre elas é só a idade da empresa.
      expect(estadoDaNova.ultimaExecucao).toBeNull();
      expect(estadoDaAntiga.ultimaExecucao).toBeNull();
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (c) — o roster é igual ao publicado, com nulos, e a leitura não cria linha',
    async () => {
      const contexto = await admitirEmpresaNova('roster');

      const estados = await emUnidade(contexto, lerEstadoDasRotinas);

      // A ORDEM é conteúdo: é a ordem de declaração do relógio do produto, e é a que a rota entrega.
      expect(estados.map((estado) => estado.rotina)).toEqual([...ROTINAS_PUBLICADAS]);
      // E a igualdade de conjunto, dita à parte, com controle antivácuo.
      expect(estados.length).toBe(ROTINAS_PUBLICADAS.length);
      expect(estados.length).toBeGreaterThan(0);
      expect(
        diferencasDeConjunto(
          estados.map((estado) => estado.rotina),
          [...ROTINAS_PUBLICADAS],
        ),
      ).toEqual({ excedentes: [], ausentes: [] });

      for (const estado of estados) {
        const cadencia = CADENCIA_DA_ROTINA[estado.rotina];

        // A empresa nunca teve passagem: os três campos da ausência são nulos ou vazios, e nenhum
        // deles é erro — é o molde de `lerPolitica`, que devolve o estado em vez de `404`.
        expect(estado.ultimaExecucao).toBeNull();
        expect(estado.resumo).toBeNull();
        expect(estado.historicoRecente).toEqual([]);
        // A cadência devolvida é a DECLARADA no contrato, campo a campo — e a chave `hora` só existe
        // nas diárias, de modo que a comparação também prova que ela NÃO nasce nas de intervalo.
        expect(estado.cadencia).toEqual(
          'hora' in cadencia
            ? { tipo: cadencia.tipo, hora: cadencia.hora }
            : { tipo: cadencia.tipo },
        );
      }

      // A leitura NÃO escreveu. É a única asserção que separa esta porta de uma que gravasse linha
      // para inventar estado: o objeto devolvido seria idêntico nos dois casos.
      expect(await contarExecucoes(contexto)).toBe(NENHUMA_EXECUCAO);

      // E o que a porta devolve PASSA no esquema publicado — o mesmo objeto que a rota valida.
      expect(esquemaDoEstadoDasRotinas.safeParse({ itens: estados }).success).toBe(true);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (d) — a próxima esperada é a da cadência declarada, no fuso da OPERAÇÃO',
    async () => {
      const contexto = await admitirEmpresaNova('proxima');

      // ⚠️ **A derivação e a verificação correm na MESMA unidade de trabalho, e a escolha é
      // conteúdo** — a mesma que o CT-1072 faz por escrito, e pela mesma razão. `now()` é
      // `transaction_timestamp()`: numa segunda transação ele é **sempre** posterior, e a de minuto
      // — `date_trunc('minute', agora) + 1 min` — deixaria de estar no futuro toda vez que a borda
      // do minuto caísse entre o COMMIT de uma e o BEGIN da outra. O caso reprovaria com o SUT
      // íntegro, por sorte do relógio.
      //
      // Com um relógio só, a asserção fica **mais forte**, e não mais frouxa: `proximaEsperada` é
      // comparada contra EXATAMENTE o instante que o SUT usou para compô-la, de modo que nenhum
      // deslocamento é tolerado. A alternativa — alargar a folga ou trocar `>` por `>=` — acomodaria
      // o efeito em vez de eliminar a fonte, e é o afrouxamento que o Protocolo Antirregressão veda.
      const apurados = await emUnidade(contexto, async (tx) => {
        const estados = await lerEstadoDasRotinas(tx);
        const observados: {
          rotina: RotinaPublicada;
          horaLocal: string;
          segundoUtc: string;
          noFuturo: boolean;
          dentroDaFolga: boolean;
        }[] = [];

        for (const estado of estados) {
          const cadencia = CADENCIA_DA_ROTINA[estado.rotina];

          const [linha] = await tx<
            {
              horaLocal: string;
              segundoUtc: string;
              noFuturo: boolean;
              dentroDaFolga: boolean;
            }[]
          >`
            SELECT to_char(${estado.proximaEsperada}::timestamptz AT TIME ZONE ${fusoDaOperacao},
                           'HH24:MI') AS "horaLocal",
                   to_char(${estado.proximaEsperada}::timestamptz AT TIME ZONE 'UTC',
                           'SS.MS') AS "segundoUtc",
                   ${estado.proximaEsperada}::timestamptz > now() AS "noFuturo",
                   ${estado.proximaEsperada}::timestamptz
                     <= now() + make_interval(mins => ${'hora' in cadencia ? MINUTOS_POR_DIA : 1}::integer)
                     AS "dentroDaFolga"
          `;

          if (linha === undefined) {
            throw new Error(`o banco não avaliou a próxima esperada de ${estado.rotina}`);
          }

          observados.push({ rotina: estado.rotina, ...linha });
        }

        return observados;
      });

      // Controle antivácuo, e cobertura do roster: sem ele, uma leitura que devolvesse arranjo vazio
      // faria o laço abaixo não asserir nada e o caso passaria sem medir rotina alguma.
      expect(apurados.map((observado) => observado.rotina)).toEqual([...ROTINAS_PUBLICADAS]);

      for (const observado of apurados) {
        const cadencia = CADENCIA_DA_ROTINA[observado.rotina];

        // Sempre no futuro, e dentro de um período da cadência: uma passagem anunciada no passado, ou
        // daqui a uma semana, reprova. As duas são avaliadas contra o `now()` da própria derivação.
        expect(observado.noFuturo).toBe(true);
        expect(observado.dentroDaFolga).toBe(true);

        if ('hora' in cadencia) {
          // A hora esperada vem do CONTRATO, e o relógio em que ela é lida é o da OPERAÇÃO. É esta
          // asserção que reprova um SUT que compusesse o instante em UTC: às 00:02 de São Paulo
          // corresponde 03:02 em UTC, e a comparação acusaria a diferença.
          expect(observado.horaLocal).toBe(cadencia.hora);
        } else {
          // A cadência de minuto anuncia o minuto SEGUINTE, truncado: segundo e milissegundo zerados.
          expect(observado.segundoUtc).toBe('00.000');
        }
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (e) — o histórico recente é limitado POR ROTINA e vem em ordem decrescente',
    async () => {
      const contexto = await admitirEmpresaNova('historico');
      const comExcesso: RotinaPublicada = 'AVISO_DE_COBRANCA';
      const vizinha: RotinaPublicada = 'CONFERENCIA_DE_LIQUIDACAO';

      // Duas passagens além do limite, com idades distintas: é o excedente que torna o limite
      // observável, e as idades distintas são o que torna a ordem observável.
      const idades = [...Array(PASSAGENS_ESPERADAS_NO_HISTORICO + 2).keys()];

      for (const minutosAtras of idades) {
        await semearExecucaoEm(contexto, comExcesso, minutosAtras);
      }

      await semearExecucaoEm(contexto, vizinha, 1);

      const estados = await emUnidade(contexto, lerEstadoDasRotinas);
      const comExcedente = estadoDe(estados, comExcesso);
      const daVizinha = estadoDe(estados, vizinha);

      // O limite é POR CONSTRUÇÃO: nenhum parâmetro o pediu, e as duas passagens excedentes ficaram
      // de fora. Sem esta asserção, um `LIMIT` removido devolveria as sete e nada acusaria.
      expect(comExcedente.historicoRecente).toHaveLength(PASSAGENS_ESPERADAS_NO_HISTORICO);

      // Ordem DECRESCENTE, afirmada sobre a lista inteira e não por amostragem: a comparação
      // lexicográfica é exata neste molde de instante.
      const instantes = comExcedente.historicoRecente.map((passagem) => passagem.ocorridaEm);

      expect(instantes).toEqual([...instantes].sort().reverse());

      // E são as CINCO MAIS RECENTES, não cinco quaisquer: a mais nova encabeça a lista e coincide
      // com `ultimaExecucao`, que sai de outra consulta — as duas leituras têm de concordar.
      expect(comExcedente.ultimaExecucao).toBe(instantes[0]);

      // O limite é por rotina, e não global: com sete passagens de uma rotina, a vizinha continua
      // trazendo a dela. Um `LIMIT` no topo da consulta faria a rotina de minuto engolir o histórico
      // das diárias, e é esta perna que o reprova.
      expect(daVizinha.historicoRecente).toHaveLength(1);
      expect(daVizinha.ultimaExecucao).toBe(daVizinha.historicoRecente[0]?.ocorridaEm);

      // A terceira rotina não teve passagem alguma, e o vazio é conteúdo — ausência de passagem, não
      // ausência de dado.
      const semPassagem = estados.filter(
        (estado) => estado.rotina !== comExcesso && estado.rotina !== vizinha,
      );

      expect(semPassagem).toHaveLength(ROTINAS_PUBLICADAS.length - 2);

      for (const estado of semPassagem) {
        expect(estado.historicoRecente).toEqual([]);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (f) — o impedimento é derivado de fato já gravado, e é `null` quando nada impede',
    async () => {
      // --- 1. A empresa sem NADA configurado: os dois impedimentos que a configuração dela produz --
      //
      // Nenhum deles é fabricado: `REGUA_DESLIGADA` sai da política ausente (que é o mesmo estado
      // publicado da régua desligada) e `INTEGRACAO_BANCARIA_PENDENTE`, da ausência de certificado
      // vigente. A empresa recém-admitida é o arranjo mínimo dos dois.
      const semConfiguracao = await admitirEmpresaNova('impedimento');
      const doIsolada = await emUnidade(semConfiguracao, lerEstadoDasRotinas);

      expect(estadoDe(doIsolada, 'AVISO_DE_COBRANCA').impedimento).toEqual({
        codigo: 'REGUA_DESLIGADA',
        mensagem: MENSAGEM_DA_REGUA_DESLIGADA,
      });
      expect(estadoDe(doIsolada, 'CONFERENCIA_DE_LIQUIDACAO').impedimento).toEqual({
        codigo: 'INTEGRACAO_BANCARIA_PENDENTE',
        mensagem: MENSAGEM_DA_INTEGRACAO_PENDENTE,
      });

      // O encerramento de contratos não depende de configuração alguma da empresa, e por isso nada o
      // impede — a lista vazia do mapa é decisão, não lacuna. Sem esta perna, um SUT que devolvesse o
      // mesmo impedimento para todas as rotinas passaria nas duas asserções acima.
      expect(estadoDe(doIsolada, 'ENCERRAMENTO_DE_CONTRATOS').impedimento).toBeNull();

      // O código pertence ao vocabulário FECHADO do contrato, e a mensagem fala do PRODUTO: nada de
      // nome de tabela, código do servidor ou jargão de exceção (RD-19, ADR-0034).
      for (const estado of doIsolada) {
        const impedimento = estado.impedimento;

        if (impedimento === null) {
          continue;
        }

        expect(CODIGOS_DE_IMPEDIMENTO).toContain(impedimento.codigo);
        expect(impedimento.mensagem.length).toBeGreaterThan(0);
        expect(processoNaMensagem(impedimento.mensagem)).toEqual([]);
      }

      // --- 2. A LINHA DE CONTROLE: com régua ligada e certificado vigente, nada impede -------------
      //
      // Ela é obrigatória: sem ela, um SUT que devolvesse impedimento sempre passaria em tudo acima.
      // Os dois fatos são gravados pelas PORTAS de produção — nunca fabricando o estado.
      await emUnidade(CONTEXTO_DE_A, async (tx) => {
        await gravarPoliticaDeAviso(tx, {
          ativo: true,
          diasAntesDoVencimento: 5,
          intervaloMinimoDias: 1,
          janelaInicio: '08:00',
          janelaFim: '18:00',
          canal: 'EMAIL',
        });
      });

      const registrador = ACESSOS_DA_EMPRESA_A[0]?.usuarioId;

      if (registrador === undefined) {
        throw new Error('a carga inicial não tem usuário da empresa A');
      }

      const validoDe = await instanteEmDias(CONTEXTO_DE_A, -30);
      const validoAte = await instanteEmDias(CONTEXTO_DE_A, 335);

      await emUnidade(CONTEXTO_DE_A, async (tx) => {
        await registrarCertificado(tx, {
          titular: 'Imobiliária Alfa',
          validoDe,
          validoAte,
          impressaoDigital: 'aa:bb:cc:dd:ee:ff',
          segredoCifrado: 'envelope-cifrado-de-teste',
          registradoPor: registrador,
        });
      });

      const semImpedimento = await emUnidade(CONTEXTO_DE_A, lerEstadoDasRotinas);

      expect(semImpedimento.map((estado) => estado.impedimento)).toEqual(
        ROTINAS_PUBLICADAS.map(() => null),
      );

      // --- 2b. A BORDA DO DIA: o certificado que vence HOJE ainda vale --------------------------
      //
      // ⚠️ Esta perna existe porque a derivação do impedimento é a **segunda** declaração executável
      // de *"certificado vigente e não vencido"* no pacote — a primeira é `recusarCertificadoVencido`,
      // em `./certificado-do-provedor.ts`, que recusa o registro quando `valido_ate < hoje`. O fecho
      // do `D25` eliminou a divergência do **fuso**; o que sobra livre para divergir é a **forma da
      // comparação**, e a borda é o eixo dela: com `>` no lugar de `>=`, o certificado que vence hoje
      // seria anunciado como pendente aqui e **aceito** no registro, no mesmo dia. Nenhuma outra
      // asserção deste arquivo separa os dois operadores.
      await posicionarValidadeDoCertificado(CONTEXTO_DE_A, 0);

      expect(
        estadoDe(await emUnidade(CONTEXTO_DE_A, lerEstadoDasRotinas), 'CONFERENCIA_DE_LIQUIDACAO')
          .impedimento,
      ).toBeNull();

      // --- 3. O certificado VENCIDO volta a impedir — a derivação é de vigência, não de existência --
      //
      // O arranjo empurra a validade para ontem **no eixo da operação**, e não apaga a linha: é o par
      // que separa "não há certificado" de "há, e ele venceu". Sem esta perna, um SUT que só
      // conferisse a existência da linha passaria — e a empresa com certificado vencido veria a
      // conferência anunciada como saudável.
      await posicionarValidadeDoCertificado(CONTEXTO_DE_A, -1);

      const comVencido = await emUnidade(CONTEXTO_DE_A, lerEstadoDasRotinas);

      expect(estadoDe(comVencido, 'CONFERENCIA_DE_LIQUIDACAO').impedimento).toEqual({
        codigo: 'INTEGRACAO_BANCARIA_PENDENTE',
        mensagem: MENSAGEM_DA_INTEGRACAO_PENDENTE,
      });
      // E a régua, que continua ligada, segue sem impedimento: o vencimento do certificado não
      // contamina a rotina que não depende dele.
      expect(estadoDe(comVencido, 'AVISO_DE_COBRANCA').impedimento).toBeNull();
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (g) — a recusa impede quando é a ÚLTIMA tentativa, e a ENVIADA posterior a limpa',
    async () => {
      // O arranjo vem da casa compartilhada: `envio_de_cobranca` tem FK composta para `cobranca`, que
      // a tem para `contrato`, e a carga inicial não traz nenhum dos dois. Ver o docblock de
      // `./cenario-de-cobranca.ts` para por que ele nasceu em vez de virar a 11ª cópia local.
      const contexto = await admitirEmpresaNova('recusa');
      const cenario = await semearCobrancaDoZero(acesso, contexto, 'recusa');

      // A régua LIGADA é precondição, e não detalhe: com ela desligada o `REGUA_DESLIGADA` venceria
      // por precedência e a recusa nunca apareceria. É esta linha que torna as asserções seguintes
      // uma prova da **ordem** declarada em `IMPEDIMENTOS_POR_ROTINA` — inverter as duas entradas do
      // mapa deixa este caso vermelho.
      await ligarARegua(contexto);

      // Controle: régua ligada, nenhuma tentativa gravada, nada impede. Sem ele, um SUT que
      // anunciasse a recusa sempre passaria nas duas asserções seguintes.
      expect(await impedimentoDoAviso(contexto)).toBeNull();

      // --- (a) a última tentativa é RECUSA, e ela é recente: o impedimento é anunciado ------------
      await semearTentativa(cenario, 'FALHOU');

      expect(await impedimentoDoAviso(contexto)).toEqual({
        codigo: 'AVISOS_RECUSADOS_PELO_PROVEDOR',
        mensagem: MENSAGEM_DA_RECUSA_DO_PROVEDOR,
      });
      expect(processoNaMensagem(MENSAGEM_DA_RECUSA_DO_PROVEDOR)).toEqual([]);

      // --- a PRECEDÊNCIA, com os DOIS fatos verdadeiros ao mesmo tempo -----------------------------
      //
      // ⚠️ É aqui — e **só** aqui — que a ordem de `IMPEDIMENTOS_POR_ROTINA` é observável: enquanto a
      // régua está ligada, o primeiro fato é falso e a lista poderia estar em qualquer ordem sem que
      // nada mudasse. Com a régua desligada **e** a recusa ainda sendo a última e recente, os dois
      // fatos valem, e o que se anuncia é o primeiro da lista. Inverter as duas entradas do mapa
      // deixa esta asserção vermelha — e a inversão mandaria o Admin investigar o provedor quando o
      // que falta é ligar a régua.
      await desligarARegua(contexto);

      expect(await impedimentoDoAviso(contexto)).toEqual({
        codigo: 'REGUA_DESLIGADA',
        mensagem: MENSAGEM_DA_REGUA_DESLIGADA,
      });

      // E religando a régua a recusa REAPARECE: é o que prova que o fato dela não sumiu no passo
      // acima, e que quem decidiu foi a precedência, não o desaparecimento do segundo fato.
      await ligarARegua(contexto);

      expect(await impedimentoDoAviso(contexto)).toEqual({
        codigo: 'AVISOS_RECUSADOS_PELO_PROVEDOR',
        mensagem: MENSAGEM_DA_RECUSA_DO_PROVEDOR,
      });

      // --- (b) uma tentativa ENVIADA POSTERIOR limpa o impedimento sozinha ------------------------
      //
      // É a perna que discrimina *"a última tentativa"* de *"existe alguma recusa"*, e **nenhuma outra
      // a substitui**: um predicado `EXISTS (… desfecho = 'FALHOU' …)` passa em (a) e reprova aqui,
      // deixando o impedimento pendurado para sempre depois que o provedor voltou a aceitar. É
      // literalmente a propriedade que o docblock de `lerFatosDeImpedimento` afirma existir.
      await semearTentativa(cenario, 'ENVIADA');

      expect(await impedimentoDoAviso(contexto)).toBeNull();
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1074 (h) — a recusa fora da janela de 24 h deixa de impedir, e dentro dela volta',
    async () => {
      // ⚠️ **Empresa e cenário PRÓPRIOS, com UMA única tentativa**, e a escolha é conteúdo: o
      // reposicionamento absoluto (`criado_em = now() - X`) aplicado a duas linhas as deixaria com o
      // mesmo instante, e o `ORDER BY criado_em DESC LIMIT 1` do SUT passaria a escolher entre
      // empatadas — o caso ficaria não determinístico, que é o defeito que a rodada 2 fechou no
      // CT-1074 (d). Com uma linha só, "a última" é inequívoca e a janela é o único eixo em jogo.
      const contexto = await admitirEmpresaNova('janela');
      const cenario = await semearCobrancaDoZero(acesso, contexto, 'janela');

      await ligarARegua(contexto);
      await semearTentativa(cenario, 'FALHOU');

      // --- (c) ALÉM da janela: a recusa envelhecida não impede mais -------------------------------
      //
      // É a âncora executável de `HORAS_DA_RECUSA_RECENTE`, que o SUT não publica. Sem ela, remover o
      // termo `criado_em > now() - make_interval(hours => …)` da subconsulta — ou trocar 24 por 240 —
      // não moveria um único caso, e uma recusa de meses atrás seguiria anunciada como corrente.
      expect(await envelhecerTentativas(contexto, HORAS_ALEM_DA_JANELA)).toBe(UMA_TENTATIVA);
      expect(await impedimentoDoAviso(contexto)).toBeNull();

      // --- e DENTRO dela, a mesma linha volta a impedir --------------------------------------------
      //
      // O par é o que separa *"a janela existe"* de *"a janela é esta"*: sem esta segunda metade, uma
      // janela de um minuto passaria na asserção acima. O deslocamento é absoluto e sobre a mesma
      // única linha, de modo que só a idade dela mudou.
      expect(await envelhecerTentativas(contexto, HORAS_DENTRO_DA_JANELA)).toBe(UMA_TENTATIVA);
      expect(await impedimentoDoAviso(contexto)).toEqual({
        codigo: 'AVISOS_RECUSADOS_PELO_PROVEDOR',
        mensagem: MENSAGEM_DA_RECUSA_DO_PROVEDOR,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});
