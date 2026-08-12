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
import type { PoliticaDeAvisoNova } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
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
import {
  criarPessoa,
  type DadosDaPessoa,
  type PessoaCadastrada,
} from '../src/cadastro-de-pessoa.ts';
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

// ===========================================================================
// Auxiliares de semeadura da régua de cobrança — T5 da fatia `regua-de-cobranca`
// ===========================================================================
//
// ⚠️ **São AUXILIARES, e jamais semente automática.** Nada abaixo é invocado por
// {@link bancoEfemero}, e a ausência é a decisão: semear política de aviso por padrão faria toda
// instância nascer com uma linha em `negocio.politica_de_aviso`, e a **contagem crua `0`** do
// CT-606 — que é o único discriminador entre uma leitura que não escreve e um `upsert` escondido
// nela — passaria a valer `1` sem que o SUT tivesse mudado. Um acessório que quebra a asserção que
// ele deveria servir é pior do que acessório nenhum.
//
// Eles moram aqui, e não no arquivo de cada caso, porque se **prevê** mais de um consumidor nesta
// fatia: a do job (T7/T8) e a das rotas (T9/T10) montam a mesma precondição.
// Duas escritas da mesma semeadura ficariam livres para divergir, e a divergência apareceria como
// dois arranjos que dizem montar o mesmo cenário e montam cenários diferentes.
//
// ⚠️ Hoje **só `semearLocatarioSemContato` tem consumidor** (`envio-de-cobranca.spec.ts`). A T5
// não chegou a consumir `semearPoliticaDeAviso`: os dois casos que precisavam de política
// preferiram a porta real `gravarPoliticaDeAviso`, que é a escolha certa quando a política é o
// objeto e não a precondição. Ver o `DÉBITO COM GATILHO — D13` sobre ele.

/**
 * Grava a política de aviso da empresa do contexto **por instrução própria**, sem passar pelo SUT.
 *
 * A distinção é o ponto: `gravarPoliticaDeAviso` (`../src/politica-de-aviso.ts`) é código sob prova,
 * e um arranjo que a use faz o caso depender do que ele mede. Este acessório existe para os casos em
 * que a política é **precondição**, e não objeto — o predicado da T5, a janela do job, as rotas.
 * Quem prova a porta é o CT-606, e ele a chama diretamente.
 *
 * A instrução corre com o papel da aplicação, sob a política de linha, e **não compara `empresa_id`
 * com coisa alguma**: a empresa sai da mesma expressão que as políticas avaliam, e o `WITH CHECK` é
 * quem aceita ou recusa a linha (ADR-0008). Mesmo desenho, e mesma razão, de `registrarPolitica` em
 * `cobranca.spec.ts`.
 *
 * O `ON CONFLICT` existe porque um caso pode gravar a política **depois** de já ter lido sem ela: é o
 * mesmo `upsert` de um comando só que a `politica_de_aviso_empresa_key` foi criada para ser alvo.
 */
// DÉBITO COM GATILHO — D13 · F3/T5 · registrado 2026-08-11
// O QUÊ: este auxiliar nasce SEM consumidor algum — a T5 não o chamou —, e por isso o `ON CONFLICT
//        ON CONSTRAINT politica_de_aviso_empresa_key` que ele escreve NUNCA EXECUTOU. A porta de
//        produção escreve a mesma coisa como `ON CONFLICT (empresa_id)`: duas grafias do mesmo
//        alvo, e só uma tem prova.
// QUANDO FECHA: a primeira suíte que precisar da política como PRECONDIÇÃO sem ser objeto —
//        prevista para a T7/T8 (a janela do job) ou a T9/T10 (as rotas). Ao ganhar o primeiro
//        consumidor, alinhar a cláusula com a da produção (ou declarar por que a grafia por
//        restrição é a certa aqui) e remover este marcador.
// POR QUE NÃO AGORA: removê-lo contraria a §5.2 da T5, que o declara entregável; e alinhar a
//        cláusula sem consumidor seria mexer em SQL que nada exercita — a mudança não teria como
//        ser provada nem refutada nesta task.
// ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D13
export async function semearPoliticaDeAviso(
  tx: TransactionSql,
  politica: PoliticaDeAvisoNova,
): Promise<void> {
  await tx`
    INSERT INTO negocio.politica_de_aviso (
      empresa_id, ativo, dias_antes_do_vencimento, intervalo_minimo_dias,
      janela_inicio, janela_fim, canal
    )
    VALUES (
      nullif(current_setting('app.empresa_id', true), '')::uuid,
      ${politica.ativo}, ${politica.diasAntesDoVencimento}, ${politica.intervaloMinimoDias},
      ${politica.janelaInicio}, ${politica.janelaFim}, ${politica.canal}
    )
        ON CONFLICT ON CONSTRAINT politica_de_aviso_empresa_key
        DO UPDATE
       SET ativo = EXCLUDED.ativo,
           dias_antes_do_vencimento = EXCLUDED.dias_antes_do_vencimento,
           intervalo_minimo_dias = EXCLUDED.intervalo_minimo_dias,
           janela_inicio = EXCLUDED.janela_inicio,
           janela_fim = EXCLUDED.janela_fim,
           canal = EXCLUDED.canal
  `;
}

/**
 * Cria um locatário **sem endereço de contato** — o cadastro que a RD-11 existe para registrar.
 *
 * Ele nasce pela **porta de produção** (`criarPessoa`), e não por `INSERT` cru: o caminho é o mesmo
 * que a rota de cadastro usa por dentro, e é isso que impede o arranjo de montar um estado que a
 * operação não alcança. `negocio.locatario.email` é `NOT NULL` e **aceita a cadeia vazia** — o
 * cabeçalho de `envioDeCobranca`, em `../src/esquema/negocio.ts`, registra por que uma restrição de
 * endereço bem formado tornaria impublicável justamente a linha que a tabela existe para guardar.
 *
 * O endereço é sobrescrito **aqui**, e não deixado a cargo de quem chama, porque é isso que o nome
 * promete: um chamador que passasse `email: 'x@y'` por engano montaria um locatário com contato sob
 * um acessório que diz o contrário, e o caso adiante provaria outra coisa em silêncio.
 */
export async function semearLocatarioSemContato(
  tx: TransactionSql,
  dados: DadosDaPessoa,
): Promise<PessoaCadastrada> {
  return await criarPessoa(tx, 'locatario', { ...dados, email: '' });
}
