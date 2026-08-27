/**
 * O pacote de contratos é PUBLICÁVEL, e para o registry certo — CT-1200 a CT-1202.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT      | Invariante |
 * |----------|---------|------------|
 * | F6       | CT-1200 | O manifesto declara publicação para o registry PRIVADO do GitHub, com
 * |          |         | versão real e sem `private` — as quatro condições que separam "publica no
 * |          |         | lugar certo" de "publica no npm público" ou "não publica". |
 * | F6       | CT-1201 | O que sai no tarball é `dist/` e nada mais, e todo caminho de `exports`
 * |          |         | aponta para dentro dele. |
 * | F6       | CT-1202 | Nenhuma credencial de registry pode ser versionada: o `.gitignore` ignora
 * |          |         | `.npmrc`, e não existe `.npmrc` na raiz nem no pacote. |
 *
 * Rastreabilidade: `marco de entrega, item 3 (@sysloc/contracts publicado) → CT-1200..CT-1202`.
 *
 * ---------------------------------------------------------------------------
 * Por que estes invariantes merecem casos
 * ---------------------------------------------------------------------------
 *
 * O erro que este arquivo existe para impedir **não quebra nada aqui dentro**: ele acontece uma vez,
 * fora do repositório, e é irreversível na prática. Publicar um pacote privado no **npm público** não
 * dá erro — dá sucesso, e o contrato inteiro da API fica legível por qualquer pessoa. `npm unpublish`
 * tem janela de 72 h e não desfaz quem já baixou.
 *
 * A barreira anterior era `"private": true`, que barrava **todo** destino — inclusive o certo. Ela foi
 * removida de propósito e substituída por `publishConfig.registry`, que é mais forte porque barra o
 * destino **errado**: sem `--registry` na linha de comando, `pnpm publish` usa o que o manifesto diz.
 *
 * ⚠️ **A colisão que motivou a org.** O GitHub Packages exige que o escopo do pacote case com o dono
 * do repositório. O monorepo vive em `fabianolopesviana/sysloc-backend` e o escopo é `@sysloc` — não
 * casam. Renomear o escopo custaria 191 arquivos importadores e trocaria a identidade do produto por
 * uma limitação de registry; por isso o pacote é publicado sob a organização `sysloc`, e é ela que o
 * campo `repository` nomeia. Se alguém "corrigir" esse campo para o monorepo, a publicação passa a
 * apontar para um repositório cujo dono não casa com o escopo — e o CT-1200 reprova.
 *
 * As asserções são ESTÁTICAS (inspecionam o manifesto e o `.gitignore`), e por isso a prova de
 * falsificação é OBRIGATÓRIA (`.claude/rules/testing-stack.md`). Ela é feita **em processo**, sobre
 * cópias mutadas do objeto lido — nunca escrevendo na árvore de trabalho, que é o que o `CT-1124` de
 * `verificar-backup.sh` cobra de toda asserção estática deste repositório.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DO_PACOTE = join(AQUI, '..');
const RAIZ_DO_REPO = join(RAIZ_DO_PACOTE, '..', '..');

/** O único destino aceitável. Escrito por extenso porque é ele que separa privado de público. */
const REGISTRY_PRIVADO = 'https://npm.pkg.github.com';

/** O dono sob o qual o escopo `@sysloc` é válido no GitHub Packages. */
const DONO_QUE_CASA_COM_O_ESCOPO = 'sysloc';

/**
 * A versão de `zod` que o consumidor de fora TEM de usar.
 *
 * ⚠️ Terceira declaração deliberada — o valor não é lido do manifesto sob prova, senão a asserção
 * mediria consistência do artefato consigo mesmo. `zod` é dependência NORMAL e FIXADA deste pacote:
 * o React que instalar outra versão ganha uma SEGUNDA cópia aninhada, e `instanceof ZodError` deixa
 * de valer entre um esquema daqui e um `z` de lá. O sintoma aparece só do outro lado da Fronteira.
 */
const ZOD_QUE_O_CONSUMIDOR_PRECISA = '4.4.3';

type Manifesto = Record<string, unknown>;

function lerManifesto(): Manifesto {
  return JSON.parse(readFileSync(join(RAIZ_DO_PACOTE, 'package.json'), 'utf8')) as Manifesto;
}

/**
 * Devolve a lista de razões pelas quais este manifesto NÃO publica corretamente.
 *
 * Lista, e não booleano: é ela que nomeia qual das quatro condições caiu, e sem o nome a falha do
 * caso não diz o que consertar.
 */
function problemasDePublicacao(m: Manifesto): string[] {
  const problemas: string[] = [];
  if (m.private === true) problemas.push('`private: true` barra QUALQUER publicação');
  if (typeof m.version !== 'string' || m.version === '0.0.0') {
    problemas.push(`versão não publicável: ${String(m.version)}`);
  }
  const publish = m.publishConfig as Record<string, unknown> | undefined;
  if (publish?.registry !== REGISTRY_PRIVADO) {
    problemas.push(`registry não é o privado: ${String(publish?.registry)}`);
  }
  const deps = m.dependencies as Record<string, string> | undefined;
  if (deps?.zod !== ZOD_QUE_O_CONSUMIDOR_PRECISA) {
    problemas.push(`zod não é a versão que o consumidor precisa casar: ${String(deps?.zod)}`);
  }
  const repo = m.repository as Record<string, unknown> | undefined;
  const url = String(repo?.url ?? '');
  if (!url.includes(`/${DONO_QUE_CASA_COM_O_ESCOPO}/`)) {
    problemas.push(`repository não aponta para o dono que casa com o escopo: ${url}`);
  }
  return problemas;
}

/** Devolve as razões pelas quais o tarball levaria algo além de `dist/`. */
function problemasDoTarball(m: Manifesto): string[] {
  const problemas: string[] = [];
  const files = m.files;
  if (!Array.isArray(files) || files.length !== 1 || files[0] !== 'dist') {
    problemas.push(`files não é exatamente ['dist']: ${JSON.stringify(files)}`);
  }
  const exports = (m.exports as Record<string, unknown> | undefined)?.['.'] as
    | Record<string, string>
    | undefined;
  for (const [condicao, caminho] of Object.entries(exports ?? {})) {
    if (!caminho.startsWith('./dist/')) {
      problemas.push(`exports["."].${condicao} sai de dist/: ${caminho}`);
    }
  }
  if (!exports || Object.keys(exports).length === 0) {
    problemas.push('exports["."] vazio — o consumidor não resolve nada');
  }
  return problemas;
}

describe('CT-1200 — o manifesto publica, e publica no registry PRIVADO', () => {
  it('o manifesto real não tem problema de publicação algum', () => {
    expect(problemasDePublicacao(lerManifesto())).toEqual([]);
  });

  it('antivácuo: o predicado ACUSA um manifesto vazio', () => {
    // Sem isto, um predicado quebrado que sempre devolvesse [] passaria o caso acima.
    // São QUATRO e não cinco: `private` AUSENTE é legítimo — o que barra é `private: true`, e por
    // isso essa condição só aparece no mutante que o repõe.
    expect(problemasDePublicacao({})).toHaveLength(4);
  });

  it.each([
    ['private de volta', { private: true }, '`private: true` barra'],
    ['versão zerada', { version: '0.0.0' }, 'versão não publicável'],
    [
      'registry do npm público',
      { publishConfig: { registry: 'https://registry.npmjs.org' } },
      'registry não é o privado',
    ],
    ['publishConfig removido', { publishConfig: undefined }, 'registry não é o privado'],
    ['zod solto em vez de fixado', { dependencies: { zod: '^4.4.3' } }, 'zod não é a versão'],
    ['zod ausente', { dependencies: undefined }, 'zod não é a versão'],
    [
      'repository apontando para o monorepo',
      {
        repository: {
          type: 'git',
          url: 'git+https://github.com/fabianolopesviana/sysloc-backend.git',
        },
      },
      'não aponta para o dono que casa com o escopo',
    ],
  ])('falsificação: %s reprova nomeando a razão', (_nome, mutacao, agulha) => {
    const problemas = problemasDePublicacao({ ...lerManifesto(), ...mutacao });
    expect(problemas.some((p) => p.includes(agulha))).toBe(true);
  });
});

describe('CT-1201 — o tarball leva dist/ e nada mais', () => {
  it('o manifesto real não vaza nada para fora de dist/', () => {
    expect(problemasDoTarball(lerManifesto())).toEqual([]);
  });

  it.each([
    ['fonte no tarball', { files: ['dist', 'src'] }, "files não é exatamente ['dist']"],
    [
      'files ausente — o tarball levaria o pacote inteiro',
      { files: undefined },
      "files não é exatamente ['dist']",
    ],
    [
      'exports para fora de dist',
      { exports: { '.': { types: './src/index.ts', default: './dist/index.js' } } },
      'sai de dist/',
    ],
  ])('falsificação: %s reprova nomeando a razão', (_nome, mutacao, agulha) => {
    const problemas = problemasDoTarball({ ...lerManifesto(), ...mutacao });
    expect(problemas.some((p) => p.includes(agulha))).toBe(true);
  });
});

describe('CT-1202 — nenhuma credencial de registry pode ser versionada', () => {
  const ignoraNpmrc = (gitignore: string): boolean =>
    gitignore.split('\n').some((linha) => linha.trim() === '.npmrc');

  it('o .gitignore da raiz ignora .npmrc', () => {
    expect(ignoraNpmrc(readFileSync(join(RAIZ_DO_REPO, '.gitignore'), 'utf8'))).toBe(true);
  });

  it('falsificação: um .gitignore sem a linha é acusado', () => {
    expect(ignoraNpmrc('.env\ndist/\nnode_modules/\n')).toBe(false);
  });

  it.each([
    ['a raiz do repositório', RAIZ_DO_REPO],
    ['o pacote de contratos', RAIZ_DO_PACOTE],
  ])('não existe .npmrc em %s', (_onde, raiz) => {
    expect(existsSync(join(raiz, '.npmrc'))).toBe(false);
  });
});
