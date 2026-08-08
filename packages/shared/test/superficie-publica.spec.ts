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
  });

  it('não resolve caminho profundo para arquivo interno', async () => {
    const resolucao = await resolverEmProcessoNode(ESPECIFICADOR_PROFUNDO);

    expect(resolucao.resolveu).toBe(false);
    const rejeitada = resolucao as ResolucaoRejeitada;

    expect(rejeitada.codigo).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    expect(rejeitada.mensagem).toContain('./src/erros.js');
  });
});
