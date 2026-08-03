/**
 * Carga inicial — duas empresas, as pessoas delas e os vínculos de acesso.
 *
 * ---------------------------------------------------------------------------
 * Identificadores fixos, e por quê
 * ---------------------------------------------------------------------------
 *
 * Todo identificador desta carga é uma constante literal, exportada. Não é conveniência: a suíte de
 * isolamento afirma **conjuntos exatos** de identificadores ("no contexto de A o resultado é
 * exatamente {A-1, A-2}, e a interseção com os de B é vazia"). Com identificador sorteado a cada
 * execução, a asserção teria de ser derivada do que a própria consulta devolveu — e uma asserção
 * derivada do resultado não discrimina isolamento nenhum.
 *
 * ---------------------------------------------------------------------------
 * Idempotência
 * ---------------------------------------------------------------------------
 *
 * Reexecutar não duplica: cada inserção declara `ON CONFLICT DO NOTHING`, e sem alvo de conflito —
 * assim qualquer restrição de unicidade da tabela (o identificador, o e-mail, o par empresa/pessoa)
 * absorve a repetição, e não apenas a chave primária. É o mesmo contrato dos passos de
 * `provisionar-base.sh`: rodar de novo não muda nada.
 *
 * ---------------------------------------------------------------------------
 * Credencial: só por injeção, nunca por conta própria
 * ---------------------------------------------------------------------------
 *
 * A derivação de senha é do arcabouço de identidade (§11.3), que vive em `@sysloc/auth` — um pacote
 * que depende deste, e que este não pode importar de volta. Por isso a carga **recebe** a função de
 * derivação em vez de escolher uma: quem chama já tem o arcabouço em mãos e passa a função dele.
 *
 * O ganho não é só evitar o ciclo. É que o resultado gravado em `identidade.conta` é produzido pelo
 * **mesmo caminho que a produção usa**, e não por uma cópia que pode divergir dele — inserir hash
 * direto provaria um caminho que não existe.
 *
 * **`semear(cadeia)` sem a função continua não escrevendo credencial alguma.** Isso é contrato, não
 * detalhe: é o que mantém a carga padrão idêntica à de antes desta mudança, e é o que sustenta o
 * bloco de alcance abaixo.
 *
 * ---------------------------------------------------------------------------
 * Alcance desta função — o que ela pode fazer, e o que a barra (D4)
 * ---------------------------------------------------------------------------
 *
 * `semear` está na superfície pública do pacote e **aceita destino arbitrário**: ela abre a conexão
 * por dentro, a partir da cadeia que recebe, e grava carga fixa — duas empresas, seis pessoas
 * (incluindo `master@sysloc.com.br`, com identificador literal) e cinco vínculos. Não há guarda de
 * destino aqui, e a ausência é declarada em vez de suposta. Contraste deliberado com o vizinho:
 * `conexao.ts` fica fora do índice justamente porque "nada fora daqui abre conexão", e esta função
 * é um caminho que abre conexão a partir de fora.
 *
 * Duas razões a mantêm exportada: a §7 da tech spec trata a carga como ponto de operação
 * idempotente, e os casos de isolamento (T3) e de identidade (T6) precisam consumi-la **pelo
 * caminho real** a partir de outro pacote.
 *
 * O que limita o estrago é o parágrafo anterior: a pessoa semeada **não autentica** enquanto
 * ninguém passar a função de derivação. O risco que o D4 projetava para esta task — "a partir dali
 * um `semear()` disparado contra o banco que atende a operação materializa um `SYSLOC_MASTER` com
 * identificador conhecido *e senha conhecida*" — depende, agora, de o chamador **também** fornecer
 * a derivação, o que nenhum caminho de produção faz. A pendência residual (guarda de destino, ou
 * mover o export para um subcaminho próprio do manifesto) segue registrada como **D4** na §2 de
 * `docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md`. Ela **não** ganha
 * o marcador de débito da §3-B de `.claude/rules/nao-regressao.md`: o gatilho declarado ("a T6,
 * quando a carga passar a definir credencial") disparou e foi respondido aqui, e o que sobra não
 * tem gatilho concreto — e, por aquela mesma §3-B, débito sem gatilho fica só no relatório.
 *
 * (O nome literal do marcador não aparece nesta frase de propósito: o `CLAUDE.md` declara um
 * `grep` por ele como **o oráculo** do índice de débitos, e prosa que o cite envenena a contagem.)
 */

import { abrirConexao } from './conexao.js';

/** Empresa da carga inicial. */
export interface EmpresaSemeada {
  readonly id: string;
  readonly nome: string;
  readonly documento: string;
}

/** Pessoa da carga inicial. `empresaId` é nulo apenas para o Sysloc Master. */
export interface UsuarioSemeado {
  readonly id: string;
  readonly email: string;
  readonly nome: string;
  readonly perfil: 'SYSLOC_MASTER' | 'ADMIN_EMPRESA' | 'USUARIO_EMPRESA';
  readonly empresaId: string | null;
  /**
   * Identificador da linha de `identidade.conta` desta pessoa, quando a carga define credencial.
   *
   * É literal, e não sorteado, pela mesma razão de todos os outros identificadores deste arquivo —
   * mas aqui há um motivo a mais, e ele é de correção: `identidade.conta` não tem restrição de
   * unicidade além da chave primária, então o `ON CONFLICT DO NOTHING` da inserção só absorve a
   * repetição se a chave for a MESMA a cada execução. Com identificador sorteado, semear duas vezes
   * criaria duas credenciais para a mesma pessoa — e `banco-efemero.ts` semeia duas vezes de
   * propósito, para provar a idempotência.
   */
  readonly contaId: string;
}

/** Vínculo de acesso da carga inicial — a linha tenantizada sobre a qual o isolamento é provado. */
export interface AcessoSemeado {
  readonly id: string;
  readonly empresaId: string;
  readonly usuarioId: string;
}

/** A primeira das duas empresas. */
export const EMPRESA_A: EmpresaSemeada = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Imobiliária Alfa Ltda',
  documento: '11.111.111/0001-11',
};

/** A segunda. Ela existe para que "não alcança dado alheio" tenha um alheio concreto a alcançar. */
export const EMPRESA_B: EmpresaSemeada = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Imobiliária Beta Ltda',
  documento: '22.222.222/0001-22',
};

export const EMPRESAS: readonly EmpresaSemeada[] = [EMPRESA_A, EMPRESA_B];

/**
 * O operador do SaaS. Nasce sem empresa — e é a restrição `usuario_master_sem_empresa_chk` que
 * torna isso obrigatório, em vez de convenção. É dele a prova negativa do CA-05: contexto sem
 * empresa não casa política nenhuma.
 */
export const USUARIO_MASTER: UsuarioSemeado = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'master@sysloc.com.br',
  nome: 'Operador Sysloc',
  perfil: 'SYSLOC_MASTER',
  empresaId: null,
  contaId: '00000000-cccc-4000-8000-000000000001',
};

export const USUARIOS: readonly UsuarioSemeado[] = [
  USUARIO_MASTER,
  {
    id: '11111111-0000-4000-8000-000000000001',
    email: 'admin.a@exemplo.com.br',
    nome: 'Ana Alves',
    perfil: 'ADMIN_EMPRESA',
    empresaId: EMPRESA_A.id,
    contaId: '11111111-cccc-4000-8000-000000000001',
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    email: 'usuario.a@exemplo.com.br',
    nome: 'Artur Amaral',
    perfil: 'USUARIO_EMPRESA',
    empresaId: EMPRESA_A.id,
    contaId: '11111111-cccc-4000-8000-000000000002',
  },
  {
    id: '22222222-0000-4000-8000-000000000001',
    email: 'admin.b@exemplo.com.br',
    nome: 'Bianca Barros',
    perfil: 'ADMIN_EMPRESA',
    empresaId: EMPRESA_B.id,
    contaId: '22222222-cccc-4000-8000-000000000001',
  },
  {
    id: '22222222-0000-4000-8000-000000000002',
    email: 'usuario.b1@exemplo.com.br',
    nome: 'Bruno Bastos',
    perfil: 'USUARIO_EMPRESA',
    empresaId: EMPRESA_B.id,
    contaId: '22222222-cccc-4000-8000-000000000002',
  },
  {
    id: '22222222-0000-4000-8000-000000000003',
    email: 'usuario.b2@exemplo.com.br',
    nome: 'Beatriz Braga',
    perfil: 'USUARIO_EMPRESA',
    empresaId: EMPRESA_B.id,
    contaId: '22222222-cccc-4000-8000-000000000003',
  },
];

/**
 * Provedor de credencial local do arcabouço de identidade. É o valor que ele grava e procura em
 * `identidade.conta.provedor_id` para a entrada por identificação e senha.
 */
export const PROVEDOR_DE_CREDENCIAL = 'credential';

/**
 * Senha de todas as pessoas da carga, quando a carga define credencial.
 *
 * Literal e exportada pelo mesmo motivo dos identificadores: os casos afirmam desfechos exatos por
 * tentativa (a correta entra, a errada não), e uma senha sorteada tornaria a asserção derivada do
 * próprio dado. Ela satisfaz a política de força de `@sysloc/auth` de propósito — semear uma senha
 * que a própria política recusaria produziria uma conta impossível de trocar de senha depois.
 *
 * **Não é segredo**, porque não há credencial enquanto ninguém passar a derivação (ver o cabeçalho).
 */
export const SENHA_DA_CARGA = 'chuva7Longe!';

/**
 * Dois vínculos na empresa A e três na B — contagens diferentes de propósito.
 *
 * Se as duas empresas tivessem o mesmo número de linhas, uma leitura que devolvesse o conjunto
 * ERRADO ainda passaria por qualquer asserção que se apoiasse só na contagem. Com 2 e 3, contagem e
 * conjunto discriminam.
 */
export const ACESSOS_DA_EMPRESA_A: readonly AcessoSemeado[] = [
  {
    id: '11111111-aaaa-4000-8000-000000000001',
    empresaId: EMPRESA_A.id,
    usuarioId: '11111111-0000-4000-8000-000000000001',
  },
  {
    id: '11111111-aaaa-4000-8000-000000000002',
    empresaId: EMPRESA_A.id,
    usuarioId: '11111111-0000-4000-8000-000000000002',
  },
];

export const ACESSOS_DA_EMPRESA_B: readonly AcessoSemeado[] = [
  {
    id: '22222222-aaaa-4000-8000-000000000001',
    empresaId: EMPRESA_B.id,
    usuarioId: '22222222-0000-4000-8000-000000000001',
  },
  {
    id: '22222222-aaaa-4000-8000-000000000002',
    empresaId: EMPRESA_B.id,
    usuarioId: '22222222-0000-4000-8000-000000000002',
  },
  {
    id: '22222222-aaaa-4000-8000-000000000003',
    empresaId: EMPRESA_B.id,
    usuarioId: '22222222-0000-4000-8000-000000000003',
  },
];

/** O que a carga faz além do mínimo. Tudo aqui é opcional; omitido, a carga é a de sempre. */
export interface OpcoesDeSemente {
  /**
   * Deriva a senha da carga no formato que o arcabouço de identidade grava e confere.
   *
   * Informada, a carga cria uma linha em `identidade.conta` por pessoa. **Omitida, nenhuma
   * credencial é criada** — e é essa a forma que a operação usa (ver o cabeçalho).
   *
   * A função vem de fora porque a derivação mora em `@sysloc/auth`, que depende deste pacote: o
   * ciclo é impossível, e a injeção é o que garante que o resultado gravado venha do mesmo caminho
   * que confere a senha na entrada, em vez de uma reimplementação capaz de divergir dele.
   */
  readonly derivarSenha?: (senha: string) => Promise<string>;
}

/**
 * Aplica a carga inicial pela cadeia de conexão informada — que é a do papel da aplicação.
 *
 * **Semear pelo papel da aplicação é deliberado**, e não a via mais curta: o papel de migração
 * escreveria em `negocio` contornando... nada, porque o `FORCE` também o alcança — mas ele não é o
 * papel que a operação usa. Semear pelo mesmo papel que atende requisição faz a carga inicial
 * atravessar as políticas de verdade: se `WITH CHECK` estivesse errada, a carga falharia aqui, no
 * preparo, em vez de produzir um estado que nenhuma prova consegue explicar.
 *
 * Os vínculos de cada empresa são gravados numa transação própria, com o contexto fixado nela.
 * `set_config(..., true)` é o equivalente de `SET LOCAL` que aceita **parâmetro vinculado** — aqui
 * não há valor vindo de fora, mas usar a forma parametrizável evita compor SQL por concatenação
 * mesmo em código de carga. (A unidade de trabalho da T3 enfrenta o caso oposto, em que o valor vem
 * da sessão e `SET LOCAL` não aceita vínculo; por isso ela valida o identificador antes de compor.)
 *
 * Quem chama não precisa encerrar nada: a reserva de conexões aberta aqui é encerrada aqui, nos
 * dois caminhos.
 */
export async function semear(cadeiaDeConexao: string, opcoes: OpcoesDeSemente = {}): Promise<void> {
  const sql = abrirConexao(cadeiaDeConexao);

  // Fora da transação, e uma vez só: a derivação é deliberadamente cara (§12.1), e derivá-la por
  // pessoa dentro da transação manteria a carga aberta por segundos sem nada ganhar em troca — a
  // senha é a mesma para todas. Fora dela também porque uma derivação que falhe deve falhar antes
  // de qualquer escrita, e não no meio de uma.
  const senhaDerivada =
    opcoes.derivarSenha === undefined ? undefined : await opcoes.derivarSenha(SENHA_DA_CARGA);

  try {
    await sql.begin(async (tx) => {
      for (const empresa of EMPRESAS) {
        await tx`
          INSERT INTO identidade.empresa (id, nome, documento)
          VALUES (${empresa.id}, ${empresa.nome}, ${empresa.documento})
          ON CONFLICT DO NOTHING
        `;
      }

      for (const usuario of USUARIOS) {
        await tx`
          INSERT INTO identidade.usuario (id, email, nome, perfil, empresa_id)
          VALUES (
            ${usuario.id},
            ${usuario.email},
            ${usuario.nome},
            ${usuario.perfil}::identidade.perfil_usuario,
            ${usuario.empresaId}
          )
          ON CONFLICT DO NOTHING
        `;
      }

      if (senhaDerivada !== undefined) {
        for (const usuario of USUARIOS) {
          // `conta_id` é o próprio identificador da pessoa: para credencial local o arcabouço usa a
          // identidade dela no provedor, e aqui o provedor somos nós (ver `esquema/identidade.ts`).
          await tx`
            INSERT INTO identidade.conta (id, usuario_id, conta_id, provedor_id, senha_derivada)
            VALUES (
              ${usuario.contaId},
              ${usuario.id},
              ${usuario.id},
              ${PROVEDOR_DE_CREDENCIAL},
              ${senhaDerivada}
            )
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });

    for (const acessos of [ACESSOS_DA_EMPRESA_A, ACESSOS_DA_EMPRESA_B]) {
      const empresaId = acessos[0]?.empresaId;
      if (empresaId === undefined) {
        continue;
      }

      await sql.begin(async (tx) => {
        await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;

        for (const acesso of acessos) {
          await tx`
            INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
            VALUES (${acesso.id}, ${acesso.empresaId}, ${acesso.usuarioId})
            ON CONFLICT DO NOTHING
          `;
        }
      });
    }
  } finally {
    await sql.end();
  }
}
