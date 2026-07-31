/**
 * Superfície pública do pacote.
 *
 * Rastreabilidade: T3 Critério de Conclusão (o pacote é importável pelos demais pacotes do
 * workspace) e T3 §4 (expor em `index.ts` apenas o que outros pacotes consomem) → CT-009.
 *
 * INVARIANTES
 * - CT-009: a resolução do especificador público devolve um módulo que expõe os símbolos de
 *   runtime `CodigoErro`, `ErroDeAplicacao` e `criarLogger`; caminho profundo para arquivo
 *   interno não é resolvível.
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
  it('expõe CodigoErro, ErroDeAplicacao e criarLogger como símbolos de runtime', async () => {
    const resolucao = await resolverEmProcessoNode(ESPECIFICADOR_PUBLICO);

    expect(resolucao.resolveu).toBe(true);
    const publico = resolucao as ResolucaoBemSucedida;

    // Presença (superconjunto), não igualdade de chaves: acrescentar export é retrocompatível.
    expect(publico.tipos.ErroDeAplicacao).toBe('function');
    expect(publico.tipos.criarLogger).toBe('function');
    expect(publico.tipos.CodigoErro).toBe('object');
    expect(publico.codigos).toContain('CAMPO_INVALIDO');
  });

  it('não resolve caminho profundo para arquivo interno', async () => {
    const resolucao = await resolverEmProcessoNode(ESPECIFICADOR_PROFUNDO);

    expect(resolucao.resolveu).toBe(false);
    const rejeitada = resolucao as ResolucaoRejeitada;

    expect(rejeitada.codigo).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    expect(rejeitada.mensagem).toContain('./src/erros.js');
  });
});
