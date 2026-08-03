/**
 * Instância efêmera **migrada**, com os dois papéis separados — o ponto de maior alavancagem da
 * fatia.
 *
 * ---------------------------------------------------------------------------
 * O problema que este arquivo existe para resolver
 * ---------------------------------------------------------------------------
 *
 * A ADR-0008 registra o modo de falha nos próprios *Cons*: **"suíte que conecte com o papel errado
 * fica verde sem provar nada"**. Superusuário e dono da tabela ignoram a política — o primeiro
 * sempre, o segundo enquanto não houver `FORCE`. Uma suíte de isolamento conectada por qualquer um
 * dos dois passaria integralmente contra um schema SEM isolamento algum, e ninguém saberia.
 *
 * Por isso o que este helper devolve à suíte é **a cadeia do papel `sysloc_app`**, e apenas ela. A
 * cadeia privilegiada existe — é preciso criar papéis, criar schemas e aplicar migração —, mas fica
 * **confinada**: ela não é campo do objeto devolvido, não é alcançável a partir dele por navegação,
 * e só sai por dois acessórios com nome próprio (`conexaoDeMigracao` e `conexaoSuperusuaria`), cujo
 * uso é greppável em uma linha. O confinamento não é decoração: um campo `cadeiaDeMigracao` no
 * objeto seria escolhido por engano no primeiro `banco.` seguido de autocompletar.
 *
 * ---------------------------------------------------------------------------
 * Ele ENVOLVE `packages/shared/test/postgres-efemero.ts` — não o altera
 * ---------------------------------------------------------------------------
 *
 * A §3.7 da tech spec marca aquele arquivo como somente leitura. Ele é o que a ADR-0006 audita:
 * nenhuma coordenada de conexão do ambiente é lida, por construção. Este helper preserva a
 * propriedade por composição — tudo que ele acrescenta (papéis, schemas, migrações, carga inicial)
 * nasce da instância que aquele subiu, e nada aqui olha para configuração de ambiente.
 *
 * ---------------------------------------------------------------------------
 * O caminho é o mesmo da operação
 * ---------------------------------------------------------------------------
 *
 * Os papéis e os schemas nascem do mesmo SQL que `deploy/scripts/instalacao/provisionar-base.sh`
 * executa (§7.3 da tech spec); as tabelas e a segurança nascem dos MESMOS dois arquivos de
 * `migracoes/` que `migrar-banco.sh` aplica. Nenhum símbolo, bandeira ou ramo condicional é
 * acrescentado a `packages/db/src/**` para que esta montagem exista — os papéis vêm do SQL, não de
 * código de teste, e é isso que impede a prova de ser uma encenação.
 */

import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho DISPARADO nesta task (2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: este import atravessa a fronteira de `@sysloc/shared` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto — é o que obriga o `rootDir` de
//        `tsconfig.test.json` a subir até a raiz do repositório. A dependência de workspace está
//        declarada em `package.json`, então não há dependência oculta; o que não existe é
//        FRONTEIRA.
// QUANDO FECHA: o gatilho registrado era "quando um QUARTO consumidor importar
//        `packages/shared/test/` por caminho relativo profundo". **Este é o quarto** (os três
//        anteriores são `apps/api/test/saude.e2e.spec.ts`, com três imports, e
//        `apps/worker/test/eco.spec.ts`, com dois). Fechar declarando o subpath `"./test"` no
//        `package.json` de `@sysloc/shared` e importando por `@sysloc/shared/test` — o que também
//        dispensa o `rootDir` alargado —, ou extraindo um pacote `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar `packages/shared/package.json` (declarado "somente
//        leitura" na §5.3 desta task), os dois arquivos de teste dos outros pacotes e o índice de
//        débitos do `CLAUDE.md` — que a T1, em execução paralela, está alterando. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { type BancoEfemero, postgresEfemero } from '../../shared/test/postgres-efemero.ts';
import { abrirConexao } from '../src/conexao.ts';
import { semear } from '../src/semente.ts';

/** Papel dono dos objetos e único que aplica migração. Não é superusuário e não atende requisição. */
const PAPEL_MIGRACAO = 'sysloc_migracao';

/** Papel que a aplicação usa para atender requisição. Não é dono de nada. */
const PAPEL_APLICACAO = 'sysloc_app';

/** Os dois schemas da ADR-0009. Criados pelo provisionamento, nunca pela migração. */
const SCHEMAS = ['identidade', 'negocio'] as const;

/** Diretório dos arquivos de migração, resolvido a partir deste módulo. */
const DIRETORIO_MIGRACOES = new URL('../migracoes/', import.meta.url);

/** Padrão dos arquivos que compõem a migração, na ordem em que o número os coloca. */
const PADRAO_MIGRACAO = /^\d{4}_.+\.sql$/;

/**
 * Instância efêmera com estrutura e segurança aplicadas, pronta para a suíte de isolamento.
 *
 * Repare no que ela NÃO tem: nenhum campo com cadeia privilegiada. É a diferença entre "a suíte
 * usa o papel certo" e "a suíte não tem como usar o errado sem dizer o nome disso em voz alta".
 */
export interface BancoMigrado {
  /** Cadeia de conexão do papel `sysloc_app` — a única que a suíte de isolamento deve usar. */
  readonly cadeiaConexao: string;
  /** Porta TCP da instância, sorteada dentro da faixa efêmera. */
  readonly porta: number;
  /** Nome do banco desta instância. */
  readonly banco: string;
  /** Encerra a instância e apaga o diretório de dados. Idempotente. */
  parar(): Promise<void>;
}

/** Cadeias privilegiadas, fora do objeto devolvido. Ver o cabeçalho: o confinamento é o ponto. */
interface CadeiasPrivilegiadas {
  readonly migracao: string;
  readonly superusuaria: string;
}

const privilegiadas = new WeakMap<BancoMigrado, CadeiasPrivilegiadas>();

/**
 * Sobe uma instância efêmera, provisiona os dois papéis e os dois schemas, aplica as duas migrações
 * pelo papel de migração e devolve a cadeia do papel da aplicação.
 *
 * A carga inicial é aplicada **duas vezes**, de propósito: a segunda execução é a prova de
 * idempotência exigida pelo Aceite Técnico (§4) desta task. Ela não é declarativa — se a carga
 * duplicasse, as contagens exatas afirmadas no CT-002 (2 vínculos na empresa A, 3 na B, 5 no total)
 * passariam a 4, 6 e 10, e o caso reprovaria.
 */
export async function bancoEfemero(): Promise<BancoMigrado> {
  const instancia = await postgresEfemero();
  // Credencial descartável, sorteada POR INSTÂNCIA: ela vive apenas na memória deste processo e
  // morre com o diretório de dados. Mesmo contrato da credencial de `postgres-efemero.ts` — nada
  // aqui é lido de configuração nem versionado.
  const senhas: SenhasDosPapeis = {
    [PAPEL_MIGRACAO]: randomBytes(24).toString('base64url'),
    [PAPEL_APLICACAO]: randomBytes(24).toString('base64url'),
  };

  try {
    const banco = await provisionar(instancia, senhas);
    const cadeias = comporCadeias(instancia, banco, senhas);

    await aplicarMigracoes(cadeias.migracao);
    await semear(cadeias.aplicacao);
    await semear(cadeias.aplicacao);

    const migrado: BancoMigrado = {
      cadeiaConexao: cadeias.aplicacao,
      porta: instancia.porta,
      banco,
      parar: () => instancia.parar(),
    };

    privilegiadas.set(migrado, {
      migracao: cadeias.migracao,
      superusuaria: instancia.cadeiaConexao,
    });

    return migrado;
  } catch (erro) {
    // A instância já está de pé neste ponto; sem esta parada ela sobreviveria ao erro, e o
    // diretório de dados e o processo ficariam para trás — o resíduo que a F0 proíbe.
    await instancia.parar();
    throw erro;
  }
}

/**
 * Cadeia do papel **dono** dos objetos. Acesso privilegiado, e por isso um acessório com nome
 * próprio em vez de um campo: quem o usa está declarando que precisa de privilégio, e o `grep` por
 * este nome enumera, em uma linha, todos os pontos da suíte em que isso acontece.
 *
 * Consumidores legítimos: os casos de mutante (CT-002, CT-007 e CT-009), que precisam observar o
 * que o privilégio faz — nunca a suíte de isolamento, cuja conclusão depende de NÃO ter privilégio.
 */
export function conexaoDeMigracao(banco: BancoMigrado): string {
  return exigirPrivilegiadas(banco).migracao;
}

/**
 * Cadeia do **superusuário** do agrupamento, tal como `postgresEfemero()` a devolve. Mesmo contrato
 * do acessório acima, um degrau acima em privilégio: o superusuário ignora a política sempre,
 * inclusive com `FORCE` aplicado.
 */
export function conexaoSuperusuaria(banco: BancoMigrado): string {
  return exigirPrivilegiadas(banco).superusuaria;
}

function exigirPrivilegiadas(banco: BancoMigrado): CadeiasPrivilegiadas {
  const cadeias = privilegiadas.get(banco);
  if (cadeias === undefined) {
    throw new Error(
      'as cadeias privilegiadas só existem para uma instância devolvida por bancoEfemero()',
    );
  }
  return cadeias;
}

/**
 * Executa, com a conexão superusuário, o que `provisionar-base.sh` executa em operação: os dois
 * papéis sem privilégio administrativo e os dois schemas com dono `sysloc_migracao`.
 *
 * Nada aqui cria tabela: isso é da migração, e é a migração que faz as tabelas nascerem do papel de
 * migração sem nenhum `ALTER ... OWNER` (§7.3 da tech spec).
 */
async function provisionar(instancia: BancoEfemero, senhas: SenhasDosPapeis): Promise<string> {
  const sql = abrirConexao(instancia.cadeiaConexao);

  try {
    const [linha] = await sql<{ banco: string }[]>`SELECT current_database() AS banco`;
    if (linha === undefined) {
      throw new Error('a instância efêmera não respondeu qual é o banco corrente');
    }
    const banco = linha.banco;

    for (const papel of [PAPEL_MIGRACAO, PAPEL_APLICACAO] as const) {
      // A senha é composta apenas por caracteres de `base64url` (`[A-Za-z0-9_-]`), então não há
      // aspas a escapar na literal abaixo — e `CREATE ROLE` não aceita parâmetro vinculado, o que
      // torna a composição inevitável. Os quatro `NO*` são o que o CT-001 afirma no catálogo: sem
      // eles o papel da aplicação nasceria capaz de contornar a política que ele deveria obedecer.
      await sql.unsafe(
        `CREATE ROLE "${papel}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION ` +
          `NOBYPASSRLS PASSWORD '${senhas[papel]}'`,
      );
      await sql.unsafe(`GRANT CONNECT ON DATABASE "${banco}" TO "${papel}"`);
    }

    // Nenhum dos dois papéis pertence ao outro: é o `pg_has_role(...,'MEMBER') = false` do CT-001.
    // A ausência de `GRANT ... TO ...` entre eles é a decisão — não há linha a ler, então ela fica
    // escrita aqui.

    for (const schema of SCHEMAS) {
      await sql.unsafe(`CREATE SCHEMA "${schema}" AUTHORIZATION "${PAPEL_MIGRACAO}"`);
    }

    return banco;
  } finally {
    await sql.end();
  }
}

/**
 * Aplica, em ordem, todo arquivo de `migracoes/` — os mesmos que `migrar-banco.sh` aplica.
 *
 * O conteúdo de cada arquivo vai numa consulta só, pelo protocolo simples: é o que permite várias
 * instruções por arquivo, e o servidor as executa numa transação implícita — arquivo que falhe no
 * meio não deixa metade da estrutura de pé.
 */
async function aplicarMigracoes(cadeiaDeMigracao: string): Promise<void> {
  const arquivos = (await readdir(DIRETORIO_MIGRACOES))
    .filter((nome) => PADRAO_MIGRACAO.test(nome))
    .sort();

  if (arquivos.length === 0) {
    throw new Error(
      `nenhum arquivo de migração encontrado em ${DIRETORIO_MIGRACOES.pathname} — a instância ` +
        'subiria sem estrutura alguma e a suíte reprovaria longe da causa',
    );
  }

  const sql = abrirConexao(cadeiaDeMigracao);

  try {
    for (const arquivo of arquivos) {
      const conteudo = await readFile(new URL(arquivo, DIRETORIO_MIGRACOES), 'utf8');
      try {
        await sql.unsafe(conteudo).simple();
      } catch (erro) {
        const motivo = erro instanceof Error ? erro.message : String(erro);
        throw new Error(`migração ${arquivo} falhou: ${motivo}`);
      }
    }
  } finally {
    await sql.end();
  }
}

/** Credencial descartável de cada papel, sorteada por instância. */
type SenhasDosPapeis = Record<typeof PAPEL_MIGRACAO | typeof PAPEL_APLICACAO, string>;

function comporCadeias(
  instancia: BancoEfemero,
  banco: string,
  senhas: SenhasDosPapeis,
): { readonly aplicacao: string; readonly migracao: string } {
  const cadeia = (papel: keyof SenhasDosPapeis): string =>
    `postgresql://${papel}:${encodeURIComponent(senhas[papel])}@127.0.0.1:${instancia.porta}/${banco}`;

  return { aplicacao: cadeia(PAPEL_APLICACAO), migracao: cadeia(PAPEL_MIGRACAO) };
}
