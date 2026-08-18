/**
 * Superfície pública do pacote.
 *
 * Rastreabilidade: T3 Critério de Conclusão (o pacote é importável pelos demais pacotes do
 * workspace) e T3 §4 (expor em `index.ts` apenas o que outros pacotes consomem) → CT-009.
 *
 * INVARIANTES
 * - CT-009: a resolução do especificador público devolve um módulo que expõe os símbolos de
 *   runtime `CodigoErro`, `ErroDeAplicacao`, `criarLogger`, `conferirDocumento` e
 *   `somenteDigitos`; caminho profundo para arquivo interno não é resolvível.
 * - CT-009 (T15): a superfície publica também as **duas filas** da cobrança bancária,
 *   `FILA_DA_EMISSAO_EM_LOTE` e `FILA_DA_CONFERENCIA_BANCARIA`. As cargas delas
 *   (`CargaDaEmissaoEmLote`, `CargaDaConferenciaBancaria`) são **interfaces** e não existem em
 *   runtime — quem afirma a publicação delas é `fila.spec.ts`, sobre o texto do barril, e quem
 *   afirma o conteúdo é o compilador. A asserção aqui é de **presença**, como as demais deste caso,
 *   pela decisão registrada logo abaixo.
 * - CT-645: a superfície pública NÃO expõe as quatro peças da política de repetição de tarefa —
 *   `OPCOES_PADRAO_DA_TAREFA` é o único caminho publicado. Acrescentado pela intervenção dirigida
 *   de 2026-08-12 que fechou o `D31 (F3/T7)`; é a rede que faltava para a decisão de não publicá-las.
 *
 * Fronteira real exercida: filesystem. A importação acontece num processo Node de verdade,
 * fora do resolvedor do executor de testes — é o algoritmo de resolução que a aplicação vai
 * usar em operação que precisa honrar o `exports` do manifesto, não uma aproximação. O
 * subprocesso é fixture do teste; nada nele existe no pacote publicado.
 *
 * Em T3 ainda não há um segundo pacote no workspace (as aplicações nascem em T5/T6), então o
 * contexto de resolução é a raiz do próprio pacote — o especificador público é resolvido pelo
 * campo `exports`, exatamente como um consumidor externo o resolveria, e não por caminho
 * relativo ao arquivo de teste.
 *
 * ---------------------------------------------------------------------------
 * Acréscimo da T3 da fatia `cadastro-de-imoveis-e-pessoas` — leia antes de "corrigir"
 * ---------------------------------------------------------------------------
 *
 * (Não confundir com a T3 citada na rastreabilidade acima, que é a da fundação e criou este
 * arquivo.) Aquela task publicou `conferirDocumento` e `somenteDigitos`, e as duas asserções
 * correspondentes entraram abaixo. É **acréscimo consciente**, não conserto: nenhuma asserção
 * existente foi alterada e a contagem de casos do arquivo não mudou.
 *
 * `SUT_IS_CORRECT_BECAUSE:` **não se aplica aqui**, e a distinção importa: aquela linha é exigida
 * quando um teste reprova e é o *teste* que estava errado (Iron Law #5). A task previa que a
 * publicação faria este arquivo reprovar **por igualdade de conjunto** — e ele não reprovou,
 * porque a asserção sempre foi por **presença**, decisão registrada na linha que a acompanha e
 * aqui preservada. Convertê-la em igualdade seria desfazer aquela decisão sem que nada o exigisse.
 */

import { execFile } from 'node:child_process';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const executar = promisify(execFile);

const RAIZ_DO_PACOTE = dirname(import.meta.dirname);

const ESPECIFICADOR_PUBLICO = '@sysloc/shared';
const ESPECIFICADOR_PROFUNDO = '@sysloc/shared/src/erros.js';

interface ResolucaoBemSucedida {
  readonly resolveu: true;
  readonly tipos: Record<string, string>;
  readonly codigos: string[];
}

interface ResolucaoRejeitada {
  readonly resolveu: false;
  readonly codigo: string | undefined;
  readonly mensagem: string;
}

type Resolucao = ResolucaoBemSucedida | ResolucaoRejeitada;

const ROTEIRO = `
  const especificador = process.env.ESPECIFICADOR;
  const resultado = await import(especificador).then(
    (mod) => ({
      resolveu: true,
      tipos: Object.fromEntries(Object.keys(mod).map((chave) => [chave, typeof mod[chave]])),
      codigos: mod.CodigoErro ? Object.values(mod.CodigoErro) : [],
    }),
    (erro) => ({ resolveu: false, codigo: erro.code, mensagem: String(erro.message) }),
  );
  process.stdout.write(JSON.stringify(resultado));
`;

async function resolverEmProcessoNode(especificador: string): Promise<Resolucao> {
  const { stdout } = await executar(process.execPath, ['--input-type=module', '-e', ROTEIRO], {
    cwd: RAIZ_DO_PACOTE,
    env: { ...process.env, ESPECIFICADOR: especificador },
  });

  return JSON.parse(stdout) as Resolucao;
}

describe('CT-009 — superfície pública resolve pelo especificador do pacote', () => {
  it('expõe os símbolos de runtime do pacote, inclusive a conferência de documento', async () => {
    const resolucao = await resolverEmProcessoNode(ESPECIFICADOR_PUBLICO);

    expect(resolucao.resolveu).toBe(true);
    const publico = resolucao as ResolucaoBemSucedida;

    // Presença (superconjunto), não igualdade de chaves: acrescentar export é retrocompatível.
    expect(publico.tipos.ErroDeAplicacao).toBe('function');
    expect(publico.tipos.criarLogger).toBe('function');
    expect(publico.tipos.CodigoErro).toBe('object');
    expect(publico.codigos).toContain('CAMPO_INVALIDO');
    expect(publico.tipos.conferirDocumento).toBe('function');
    expect(publico.tipos.somenteDigitos).toBe('function');
    // As duas filas da cobrança bancária (T15). Elas entram aqui **no mesmo diff** que as publica:
    // sem isso, a superfície do pacote cresceria em silêncio, e o produtor da borda e o consumidor
    // do processo de trabalho passariam a depender de um símbolo que nada afirma existir na
    // fronteira. A asserção é de **tipo**, e não só de presença, porque o nome de fila é cadeia: um
    // símbolo que virasse objeto de configuração quebraria os dois lados sem que a chave sumisse.
    expect(publico.tipos.FILA_DA_EMISSAO_EM_LOTE).toBe('string');
    expect(publico.tipos.FILA_DA_CONFERENCIA_BANCARIA).toBe('string');
  });

  it('CT-645 — a superfície NÃO publica as peças da política de repetição', async () => {
    const resolucao = await resolverEmProcessoNode(ESPECIFICADOR_PUBLICO);

    expect(resolucao.resolveu).toBe(true);
    const publico = resolucao as ResolucaoBemSucedida;

    // O CONTROLE POSITIVO, e ele é indispensável: uma resolução quebrada devolveria `tipos` vazio,
    // e as quatro ausências abaixo passariam sem que nada tivesse sido carregado. Esta linha prova
    // que o módulo resolveu E que o caminho publicado da política existe.
    expect(publico.tipos.OPCOES_PADRAO_DA_TAREFA).toBe('object');

    // A ASSERÇÃO. Por igualdade de conjunto sobre a interseção — quando reprovar, ela nomeia a peça
    // que voltou a ser publicada, em vez de dizer só que "alguma coisa" mudou.
    const PECAS_DA_POLITICA = [
      'TENTATIVAS_POR_TAREFA',
      'ESPERA_ENTRE_TENTATIVAS_MS',
      'TAREFAS_CONCLUIDAS_RETIDAS',
      'TAREFAS_FALHAS_RETIDAS',
    ];
    const publicadas = PECAS_DA_POLITICA.filter((peca) => peca in publico.tipos);

    expect(
      publicadas,
      `peça da política de repetição publicada pelo barrel: ${publicadas.join(', ')} — ` +
        'ela oferece um segundo caminho para montar a política à mão, que é a divergência que o ' +
        'fecho do D32 (F0/T6) eliminou. O caminho publicado é OPCOES_PADRAO_DA_TAREFA.',
    ).toEqual([]);
  });

  it('não resolve caminho profundo para arquivo interno', async () => {
    const resolucao = await resolverEmProcessoNode(ESPECIFICADOR_PROFUNDO);

    expect(resolucao.resolveu).toBe(false);
    const rejeitada = resolucao as ResolucaoRejeitada;

    expect(rejeitada.codigo).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    expect(rejeitada.mensagem).toContain('./src/erros.js');
  });
});
