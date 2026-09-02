/**
 * Cria o PRIMEIRO `SYSLOC_MASTER` do produto — o único ato de identidade que não
 * pode nascer pela API.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE EXISTE
 * ---------------------------------------------------------------------------
 * O cadastro público está desligado (`disableSignUp`) e pessoas nascem por ato
 * do Master ou do Admin de uma empresa (`criarPessoa`, server-side). O primeiro
 * Master, portanto, não tem quem o crie: é o ovo e a galinha, e sem ele nenhuma
 * empresa pode ser admitida. Medido em 2026-08-20, numa base recém-provisionada.
 *
 * ⚠️ Ele NÃO é `semente.ts`. Aquela é carga de TESTE — grava duas empresas
 * fictícias e uma pessoa de identificador literal — e rodá-la contra o banco da
 * operação contamina a base. Este script cria UMA pessoa, com os dados que
 * recebe, pelo MESMO caminho que a rota do Master usa.
 *
 * ---------------------------------------------------------------------------
 * SEGREDO (ADR-0005)
 * ---------------------------------------------------------------------------
 * A cadeia de conexão e o segredo de sessão chegam por ENTRADA PADRÃO, em JSON —
 * nunca por `argv`, nunca por variável exportada. A Senha provisória sai UMA
 * ÚNICA VEZ na saída padrão, como a rota faz (RN-07): nenhuma consulta posterior
 * a recupera.
 */
import { abrirAcessoAIdentidade } from '../../../packages/db/dist/index.js';
import { criarAutenticacao, criarPessoa } from '../../../packages/auth/dist/index.js';

const [, , nome, email] = process.argv;
if (!nome || !email) {
  console.error('uso: criar-sysloc-master.mjs <nome> <email>  (config por stdin)');
  process.exit(2);
}

let entrada = '';
for await (const parte of process.stdin) entrada += parte;
const { cadeiaDeConexao, segredoDeSessao, enderecoBase, prefixoDasRotas, origensPublicas } =
  JSON.parse(entrada);

// `origensPublicas` é campo OBRIGATÓRIO de `criarAutenticacao` desde a T7 da fatia
// `publicacao-e-backup`, e ele NÃO tem valor padrão por decisão registrada. Este arquivo é `.mjs`
// e não passa pelo `tsc`, de modo que o campo faltando não aparece na construção — some só na hora
// do uso, com `opcoes.origensPublicas is not iterable`, e a hora do uso é justamente a recuperação
// de uma base nova. A guarda troca isso por uma recusa que se lê.
if (!Array.isArray(origensPublicas) || origensPublicas.length === 0) {
  console.error('config sem `origensPublicas` — rode este script pelo `criar-sysloc-master.sh`');
  process.exit(2);
}

const acesso = abrirAcessoAIdentidade({ cadeiaDeConexao });

// Idempotência: já havendo um Master, não se cria um segundo em silêncio.
const existentes = await acesso.identidade.execute(
  "SELECT email FROM identidade.usuario WHERE perfil = 'SYSLOC_MASTER'",
);
const linhas = Array.isArray(existentes) ? existentes : (existentes?.rows ?? []);
if (linhas.length > 0) {
  console.log(`JA-OK  já existe SYSLOC_MASTER: ${linhas.map((l) => l.email).join(', ')}`);
  console.log('       nada foi criado. Para uma senha nova, use a rota de senha provisória.');
  process.exit(0);
}

const autenticacao = criarAutenticacao({
  acesso,
  segredoDeSessao,
  enderecoBase,
  prefixoDasRotas,
  origensPublicas,
});

const criada = await criarPessoa(autenticacao, acesso.identidade, {
  nome,
  email,
  perfil: 'SYSLOC_MASTER',
  empresaId: null,
});

console.log('CRIADO SYSLOC_MASTER');
console.log(`       id:    ${criada.usuarioId}`);
console.log(`       email: ${email}`);
console.log('');
console.log('  ⚠️  A SENHA PROVISÓRIA aparece UMA ÚNICA VEZ. Guarde-a agora:');
console.log(`      ${criada.senhaProvisoria}`);
process.exit(0);
