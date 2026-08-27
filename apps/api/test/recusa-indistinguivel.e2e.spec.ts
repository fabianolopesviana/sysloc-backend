/**
 * Recusas indistinguíveis: bloqueio, desativação e suspensão. T11 da fatia
 * `fundacao-multitenancy-identidade` — a **última** dela.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-08 | CT-016 | A resposta a uma entrada com credencial **CORRETA** sobre conta **bloqueada**
 * |       |        | é idêntica, campo a campo, à resposta a uma credencial **incorreta** e à de um
 * |       |        | **e-mail inexistente** — mesmo status, mesmo corpo byte a byte, mesmo conjunto
 * |       |        | de chaves do corpo, mesmo conjunto de nomes de cabeçalho e nenhum cabeçalho de
 * |       |        | sessão —, de modo que a resposta **não confirma a existência da conta**. E
 * |       |        | nenhuma das três cria linha em `identidade.sessao`. (RN-06, RN-10) |
 * | CA-13 | CT-017 | Pessoa **desativada** e pessoa de **empresa suspensa**, ambas com credencial
 * |       |        | correta, recebem resposta idêntica à de credencial incorreta, **nenhuma sessão
 * |       |        | é criada**, e a trilha ganha **exatamente três** linhas — todas com desfecho de
 * |       |        | recusa, e ali sim distinguindo o motivo, que é onde ele serve. (RN-10, RN-11) |
 * | CA-08 | CT-016 | Companheiro negativo dos dois: a **mesma** conta, antes do bloqueio, e as
 * | CA-13 | CT-017 | **mesmas** pessoas, antes da desativação e da suspensão, entram com a mesma
 * |       |        | credencial e recebem `200` com cabeçalho de sessão e **uma linha nova** em
 * |       |        | `identidade.sessao`. A diferença observável só existe quando a admissão é
 * |       |        | legítima — sem isso, "todas as recusas são iguais" passaria sobre uma barreira
 * |       |        | que recusa todo mundo. |
 * | CA-03 | CT-223 | Depois de o Master reemitir a Senha provisória de um Admin, a **anterior deixa
 * |       |        | de servir** e a **nova serve** — e a recusa da anterior é **indistinguível**
 * |       |        | da recusa por credencial incorreta, pelo MESMO comparador dos dois casos
 * |       |        | acima. A família da RN-10 ganha, portanto, um quarto membro: credencial
 * |       |        | incorreta, conta bloqueada, recusa de política e **credencial invalidada por
 * |       |        | reemissão**. (RN-09, RN-10) |
 *
 * | CA-14 | CT-926 | Uma sessão da empresa **B** que pede o **histórico bancário**, o **boleto** ou a
 * |       |        | **emissão de boleto** de uma cobrança da empresa **A** recebe, nas três rotas,
 * |       |        | resposta **idêntica em status e byte a byte** à que receberia para um código
 * |       |        | que não existe em empresa alguma — mesmo corpo, mesmo conjunto de chaves do
 * |       |        | corpo e mesmo conjunto de nomes de cabeçalho. E o isolamento é **do banco**: a
 * |       |        | contagem de `negocio.evento_bancario` da MESMA cobrança é `0` sob o contexto de
 * |       |        | B e `2` sob o de A — a mesma instrução, sem uma cláusula que compare
 * |       |        | `empresa_id`. O controle positivo é a dona alcançando a própria cobrança com
 * |       |        | `200` e a trilha inteira. (ADR-0008, ADR-0017) |
 *
 * Rastreabilidade: `CA-08 → CT-016 (RN-06)`, `CA-08 → CT-016 (RN-10)`, `CA-13 → CT-017 (RN-10)`,
 * `CA-13 → CT-017 (RN-11)`, `CA-03 → CT-223 (RN-09)`, `CA-03 → CT-223 (RN-10)`.
 * Acrescida pela T17 da fatia `emissao-e-conciliacao`: `CA-14 → CT-926 (RN-01)`.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-926 mora AQUI, e por que ele não toca a carga
 * ---------------------------------------------------------------------------
 *
 * Pela mesma razão do `CT-223`: o que ele afirma é **indistinguibilidade**, e ela já tem uma
 * definição neste arquivo — {@link observavel}, o comparador que os outros três casos usam. Escrevê-lo
 * em `historico-bancario.e2e.spec.ts` obrigaria a uma segunda definição do que *"duas recusas são
 * iguais"* significa, e duas definições da mesma coisa divergem. O `CT-925 (b)` de lá é a **outra
 * metade** da mesma afirmação — o lado do código que não existe —, e as duas juntas é que a fazem
 * inteira.
 *
 * E ele entra no regime do `CT-223` também no arranjo: as **duas empresas nascem dentro do caso**,
 * pelas rotas do operador. Usar a carga o tornaria refém da ordem — o `CT-017` **suspende a empresa
 * A**, e uma execução em que ele rodasse primeiro impediria a sessão do arranjo de existir. Nenhuma
 * pessoa da carga é tocada, e o único estado compartilhado que o caso mexe é o do Master, desfeito no
 * `finally` pela mesma razão registrada lá.
 *
 * ---------------------------------------------------------------------------
 * O eixo que discrimina é a comparação CRUZADA, e só ela
 * ---------------------------------------------------------------------------
 *
 * As respostas são comparadas **entre si**, e não cada uma contra um literal escrito à mão: dois
 * literais escritos à mão continuariam iguais mesmo se o produto divergisse **em ambos**. O único
 * literal deste arquivo é a **âncora** — uma escrita à mão, sobre uma das respostas, que fixa a
 * forma da ADR-0007. Sem ela, três respostas idênticas e **erradas** passariam; sem a comparação
 * cruzada, três respostas certas e **divergentes** passariam. É o par que prova.
 *
 * Cada resposta de referência vem de um sujeito **arranjado neste arquivo e cuja precondição o
 * próprio caso afirma** antes de exercitar o fluxo. A T7 desta fatia foi reprovada por prova
 * tautológica por dependência de ordem — a referência vinha corrompida por um caso anterior e o
 * mutante sobrevivia à suíte inteira —, e é essa a razão de o elenco abaixo ser **disjunto entre os
 * dois casos** e de cada precondição ser afirmada como igualdade de tupla, e não pressuposta.
 *
 * ---------------------------------------------------------------------------
 * O alcance TEM BORDA, e ela foi MEDIDA (prova de falsificação da T11)
 * ---------------------------------------------------------------------------
 *
 * O que estes casos alcançam é o que **o cliente observa**, e essa superfície é normalizada pelo
 * filtro global da ADR-0007 (`apps/api/src/comum/filtro-excecao.ts`): a recusa de um componente
 * externo entra pelo STATUS, e o código e a mensagem que saem vêm de `CODIGO_POR_STATUS` e
 * `MENSAGEM_POR_CODIGO`. Duas consequências, ambas medidas com mutante aplicado ao produto e
 * revertido em seguida:
 *
 *   * **um status próprio por predicado é observável, e reprova** — trocar a recusa de `401` por
 *     `403` no gancho de entrada de `packages/auth/src/autenticacao.ts` faz os dois casos reprovarem
 *     **na comparação cruzada**, nomeando a divergência (`ACESSO_NEGADO` contra `CREDENCIAL_INVALIDA`,
 *     `403` contra `401`);
 *   * **uma mensagem própria por predicado NÃO é observável — e não é lacuna da prova**: com a
 *     recusa levantando `` `Refused: ${motivo}` `` os dois casos seguem verdes, porque o filtro
 *     **descarta** a mensagem da exceção de origem e responde a canônica do código. O motivo não
 *     chega ao cliente por construção, que é exatamente o que a RN-10 pede. Provar essa metade é
 *     trabalho do filtro, e ele já o tem: o `CT-018 (c)` da T8 afirma que nada do vocabulário do
 *     arcabouço atravessa, e o bloco *"A mensagem que sai é NOSSA, nunca a da exceção de origem"*
 *     no cabeçalho do filtro é a decisão de onde isso vem.
 *
 * ---------------------------------------------------------------------------
 * O elenco é disjunto, e por isso os dois casos rodam em qualquer ordem
 * ---------------------------------------------------------------------------
 *
 * Nenhuma pessoa é sujeito dos dois casos, e as duas empresas são atribuídas a lados opostos: o
 * CT-016 opera **só** em pessoas da empresa B (que permanece ativa), e o CT-017 suspende a
 * **empresa A**. O Sysloc Master, que não pertence a empresa alguma, é a linha de base do CT-017 —
 * é a única pessoa da carga indiferente a qualquer suspensão.
 *
 * A consequência é a que importa: `pnpm --filter @sysloc/api test -- -t "CT-017"` e a execução
 * completa produzem o mesmo resultado, e o mesmo vale na ordem invertida. Um elenco compartilhado
 * faria a linha de base de um caso ser o sujeito recusado do outro — e comparar recusa de política
 * com recusa de política é exatamente a tautologia que este arquivo existe para não cometer.
 *
 * O **CT-223** entra no mesmo regime, e por isso não toca a carga: a empresa e o Admin dele nascem
 * pelas **rotas do Master** (T7), dentro do próprio caso. Nenhuma pessoa da carga tem a senha
 * reescrita, e por isso a reemissão não pode corromper a linha de base de nenhum dos dois casos
 * anteriores.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-223 mora AQUI, e não no arquivo da T7
 * ---------------------------------------------------------------------------
 *
 * Porque o que ele afirma é **indistinguibilidade**, e ela já tem uma definição neste arquivo:
 * {@link observavel}, o comparador que os outros dois casos usam. Escrevê-lo no arquivo de ciclo de
 * vida obrigaria a uma segunda definição do que "duas recusas são iguais" significa — e duas
 * definições da mesma coisa divergem, que é precisamente o defeito que a RN-10 não pode ter.
 * A metade da T7 que **não** é indistinguibilidade (a contenção do alvo ao perfil `ADMIN_EMPRESA`,
 * da ADR-0013) fica lá, como `CT-223 (b)`.
 *
 * ---------------------------------------------------------------------------
 * O estado de desativação e de suspensão é arranjado no caso — e por quê
 * ---------------------------------------------------------------------------
 *
 * **A carga inicial não os define**: `packages/db/src/semente.ts` não escreve `ativo` nem
 * `suspensa_em`, e as duas colunas têm padrão (`true` e nulo). O card afirma o contrário na §6.6, e
 * a divergência está registrada nas pendências desta task.
 *
 * O arranjo é escrito no próprio caso, por acesso direto ao banco, pelo padrão que a **T7** já usa
 * (`banco.update(usuario).set({ ativo: false })`) e que a T10 repetiu para a senha provisória:
 * **observação e escrita de estado de domínio persistido**, não instrumentação do SUT. Não existe
 * caminho de escrita para essas colunas nesta fatia — as rotas de administração que as moveriam são
 * da fatia `autorizacao-e-ciclo-de-acesso` —, e criar rota, bandeira ou símbolo de produção para
 * "desativar pessoa" seria antecipar aquela fatia e vazar código test-only para a produção
 * (Iron Law #6). A partir do arranjo, **tudo** acontece pela rota real.
 *
 * O bloqueio é o caso oposto, e por isso é tratado de modo oposto: ele **tem** caminho de produção,
 * e o CT-016 o percorre — cinco `POST /v1/auth/sign-in/email` com senha errada, atravessando HTTP.
 * Escrever `bloqueado_ate` à mão provaria a leitura da coluna, e não a regra que a preenche.
 *
 * ---------------------------------------------------------------------------
 * O tempo de resposta NÃO é asserido aqui — e onde o eixo está coberto
 * ---------------------------------------------------------------------------
 *
 * O invariante do CT-017 fala em *"nem o corpo nem o tempo de resposta"*. O tempo **não** ganha
 * asserção neste arquivo, por decisão registrada: medida de latência em suíte é refém da máquina,
 * não há retry automático em nenhuma das frentes que absorvesse a intermitência, e uma asserção de
 * relógio aqui seria a primeira fonte de instabilidade da fatia.
 *
 * O eixo já está coberto, e por prova determinística: a `DECISÃO FECHADA — T6 / Gate 2 (P3)` de
 * `packages/auth/src/autenticacao.ts` fixa que a recusa **deriva a senha informada e descarta o
 * resultado** antes de lançar — sem isso a conta bloqueada seria a única resposta em milissegundos
 * de um fluxo dominado pelo `scrypt`, e o tempo enumeraria contas. O terceiro caso de
 * `packages/auth/test/bloqueio.spec.ts` prova essa propriedade contando **quantas vezes a derivação
 * foi chamada e com qual argumento**, que é a causa observável da latência, em vez de medir o
 * relógio. Repeti-la aqui seria duplicação cross-layer (AP-23) trocando prova determinística por
 * prova instável.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A aplicação é a **real** (`criarAplicacao`,
 * de `src/main.ts`) — é ela que atende em operação, e uma remontagem descreveria uma aplicação que
 * ninguém sobe. A porta é **reservada** (trava atômica), e não dinâmica, pela razão que a T8
 * registrou: o arcabouço confere a origem das requisições contra o endereço base, composto a partir
 * da porta CONFIGURADA — com `port: 0` a configurada e a real divergiriam.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { LIMITE_DE_FALHAS_CONSECUTIVAS } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  esquemaIdentidade,
  registrarEventoBancario,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { count, eq } from 'drizzle-orm';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import { decodificarBase32 } from './base32.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Limite de um caso.
 *
 * Generoso de propósito: o CT-016 executa **oito** entradas reais em sequência, e cada uma paga a
 * derivação `scrypt`, que é deliberadamente cara (§12.1). O teto não é espera — nada aqui dorme —,
 * é o teto de um caso que atravessa HTTP e banco muitas vezes.
 */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo `__Secure-` vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A rota de saída do arcabouço — o "sair" que o CT-223 executa antes de reemitir. */
const ROTA_DE_SAIDA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-out`;

/** Caminho, relativo à raiz, da coleção de empresas do operador (T7). Composto, nunca literal. */
const CAMINHO_DAS_EMPRESAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;

/** Caminho, relativo à raiz, da reemissão de Senha provisória pelo operador (T7). */
const CAMINHO_DOS_USUARIOS_DO_MASTER = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/usuarios`;

/**
 * A mensagem canônica do código `CREDENCIAL_INVALIDA`, escrita por extenso.
 *
 * Literal, e **não** importada de `MENSAGEM_POR_CODIGO`: comparar a resposta com a constante que a
 * produziu faria a âncora concordar consigo mesma. Ela é contrato — é o que o cliente lê —, e
 * contrato se escreve à mão no caso.
 */
const MENSAGEM_DE_CREDENCIAL_INVALIDA = 'credencial inválida';

/** Senha que não é a de ninguém da carga. Satisfaz o piso de comprimento do arcabouço. */
const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';

/** E-mail que não existe na carga — a terceira resposta de referência do CT-016. */
const EMAIL_INEXISTENTE = 'ninguem.mora.aqui@exemplo.com.br';

// ---------------------------------------------------------------------------------------------
// O elenco — disjunto entre os dois casos, e por isso independente de ordem
// ---------------------------------------------------------------------------------------------

/**
 * CT-016 · a conta levada ao bloqueio pelas cinco tentativas reais.
 *
 * Da empresa **B**, que este arquivo nunca suspende: se ela fosse da A, uma execução em que o
 * CT-017 rodasse primeiro recusaria as cinco tentativas por `EMPRESA_SUSPENSA` **antes** de a senha
 * ser conferida — o contador jamais andaria, e o caso passaria a provar outra coisa.
 */
const CONTA_QUE_BLOQUEIA = pessoaSemeada('usuario.b2@exemplo.com.br');

/** CT-016 · a conta saudável contra quem a senha ERRADA é informada — a resposta de referência. */
const CONTA_SAUDAVEL_DO_BLOQUEIO = pessoaSemeada('usuario.b1@exemplo.com.br');

/** CT-017 · a pessoa desativada no arranjo. Empresa **B**, que permanece ATIVA (§6.6: "em empresa ativa"). */
const PESSOA_DESATIVADA = pessoaSemeada('admin.b@exemplo.com.br');

/** CT-017 · a pessoa da empresa suspensa. Empresa **A**, e é a A que o caso suspende. */
const PESSOA_DE_EMPRESA_SUSPENSA = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * CT-017 · a conta saudável contra quem a senha ERRADA é informada — a resposta de referência.
 *
 * É o Sysloc Master, e a escolha é deliberada: ele não pertence a empresa alguma, e por isso é a
 * única pessoa da carga **indiferente** à suspensão que este caso aplica. O perfil dele não
 * participa do eixo — a senha informada é a ERRADA, e a tentativa é recusada pelo arcabouço antes de
 * qualquer restrição de sessão ser avaliada.
 */
const CONTA_SAUDAVEL_DA_POLITICA = pessoaSemeada('master@sysloc.com.br');

/**
 * CT-223 · o operador do SaaS — aqui como **ator**, e não como sujeito de recusa.
 *
 * É a mesma pessoa de {@link CONTA_SAUDAVEL_DA_POLITICA}, e a coincidência não quebra a disjunção do
 * elenco: lá ele é a conta contra quem a senha ERRADA é informada, aqui ele é quem chama a rota de
 * reemissão. O que o CT-223 muda no estado dele — o segundo fator e uma sessão — é **desfeito no
 * `finally`**, de modo que a asserção absoluta do CT-017 (`o Master não tem sessão alguma`)
 * continua valendo qualquer que seja a ordem em que os casos rodem.
 */
const MASTER = USUARIO_MASTER;

/** CT-223 · o Admin admitido DENTRO do caso. Ele não existe na carga, e ninguém mais o usa. */
const EMAIL_DO_ADMIN_REEMITIDO = 'admin.reemitido@exemplo.com.br';

// ---------------------------------------------------------------------------------------------
// CT-926 — a recusa entre empresas, sobre as três rotas da fatia `emissao-e-conciliacao` (T17)
// ---------------------------------------------------------------------------------------------

/** As coleções que o arranjo do CT-926 percorre, compostas dos donos dos segmentos. */
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** A rota de troca de senha **do produto** — a que baixa a marca de senha provisória (RN-09). */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A senha definitiva com que os dois Admins do CT-926 passam a operar. */
const SENHA_TROCADA = 'brisa9Verde!';

/** Quantas rotas da fatia `emissao-e-conciliacao` endereçam uma cobrança pelo código. */
const ROTAS_QUE_ENDERECAM_A_COBRANCA = 3;

/**
 * A mensagem canônica de `RECURSO_NAO_ENCONTRADO` e o campo que a recusa nomeia — escritos à mão.
 *
 * Literais, e **não** importados de `MENSAGEM_POR_CODIGO`: comparar a resposta com a constante que a
 * produziu faria a âncora concordar consigo mesma. É a mesma escolha, e a mesma razão, de
 * {@link MENSAGEM_DE_CREDENCIAL_INVALIDA}.
 */
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';
const CAMPO_DO_CODIGO = 'codigo';

/**
 * Um código de cobrança **bem formado** que não existe em empresa alguma — a resposta de REFERÊNCIA
 * do CT-926.
 *
 * O ano é 2099 de propósito: ele passa pela validação de forma da borda, e é isso que se quer —
 * um código malformado seria recusado com `422` antes de qualquer consulta, e mediria a validação em
 * vez da recusa por ausência. O sequencial segue a largura publicada: **sete** dígitos.
 */
const COBRANCA_INEXISTENTE = 'COB-2099-0000001';

/** Os termos do contrato do arranjo — valores quaisquer, dentro das condições de entrada. */
const DATA_DE_INICIO_DO_CONTRATO = '2026-01-15';
const PRAZO_EM_MESES = 12;
const VALOR_MENSAL = 2500;
const DIA_DE_VENCIMENTO = 10;

/** O valor da cobrança do arranjo, e quantos dias à frente ela vence. */
const VALOR_DA_COBRANCA = 1500;
const DIAS_ATE_O_VENCIMENTO = 30;

/** A referência da cobrança — texto livre do operador, e nada o interpreta. */
const REFERENCIA_DA_COBRANCA = 'Competência do período — parcela';

/**
 * Os dois efeitos que a trilha da cobrança do arranjo carrega, **em ordem alfabética**.
 *
 * São **dois**, e não um: o controle antivácuo sob o contexto da empresa dona afirma a contagem em
 * valor exato, e um só não distinguiria *"a política devolveu as linhas desta cobrança"* de *"a
 * política devolveu uma linha qualquer"*.
 *
 * ⚠️ **Alfabética, e não cronológica, porque a ORDEM não é o eixo deste caso** — ela é o do `CT-925`,
 * em `historico-bancario.e2e.spec.ts`, que a produz pelos caminhos reais e a afirma por igualdade de
 * lista ordenada. Aqui os dois nascem na MESMA unidade de trabalho, e `ocorrido_em` é `now()`, que é
 * o instante do **início da transação**: os dois carimbos são idênticos por construção, e a ordem
 * entre eles é a do desempate por identificador — que é sorteado. Afirmá-la aqui seria afirmar o
 * sorteio, e repeti-la seria duplicação cross-layer (AP-23) sobre prova mais frágil.
 */
const EFEITOS_DA_TRILHA: readonly ['BOLETO_EMITIDO', 'BOLETO_REVOGADO'] = [
  'BOLETO_EMITIDO',
  'BOLETO_REVOGADO',
];

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  // Usado **só** pelo CT-926, e só para duas coisas: gravar a trilha da cobrança do arranjo e contar
  // as linhas dela sob cada contexto de tenant. Nenhum outro caso deste arquivo o toca.
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  // As linhas do registro se misturariam ao relatório do arcabouço, e nenhum caso deste arquivo
  // assere sobre elas — quem observa registro é o CT-029 da T9.
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  // Sorteado por execução, como as demais credenciais efêmeras: vive na memória deste processo e
  // morre com ele.
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('recusas indistinguíveis de admissão (T11)', () => {
  it(
    'CT-016 — conta bloqueada com credencial correta recebe recusa indistinguível da de credencial incorreta',
    async () => {
      // --- Precondições AFIRMADAS, nunca herdadas ----------------------------------------------
      // Tupla inteira por igualdade, e não campo a campo: é ela que garante que a conta que vai ser
      // bloqueada e a conta de referência partem do MESMO estado — ativas, sem falha acumulada, sem
      // instante de liberação e em empresa não suspensa. Sem isso, "as respostas são iguais" poderia
      // significar "as duas contas estavam recusadas pelo mesmo motivo".
      expect(await estadoDaConta(CONTA_QUE_BLOQUEIA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(CONTA_SAUDAVEL_DO_BLOQUEIO.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });

      // -----------------------------------------------------------------------------------------
      // Companheiro negativo — a MESMA conta, ainda DESBLOQUEADA, com a credencial correta
      // -----------------------------------------------------------------------------------------
      //
      // Ele vem ANTES do bloqueio, e não depois, porque desbloquear a conta depois exigiria ou
      // esperar quinze minutos ou escrever `bloqueado_ate` à mão — que é justamente o que a
      // precondição privilegiada deste caso proíbe. O bônus é que a entrada bem-sucedida zera o
      // contador (`limparBloqueio`), de modo que as cinco tentativas seguintes partem do zero que a
      // asserção acima afirmou.
      //
      // Sem esta perna, "as três recusas são iguais" passaria sobre uma barreira que recusa TODO
      // MUNDO — a diferença observável precisa existir quando a admissão é legítima.
      const sessoesAntesDaEntrada = await contarSessoes();
      const entradaLegitima = await entrar(CONTA_QUE_BLOQUEIA.email, SENHA_DA_CARGA);

      expect(entradaLegitima.status).toBe(200);
      expect(entradaLegitima.cookies.filter(ehCookieDeSessao)).toHaveLength(1);
      expect(await contarSessoes()).toBe(sessoesAntesDaEntrada + 1);
      expect(await contarSessoesDe(CONTA_QUE_BLOQUEIA.id)).toBe(1);

      // --- 1. o bloqueio, pelas CINCO tentativas reais, atravessando a rota HTTP ----------------
      for (let tentativa = 1; tentativa <= LIMITE_DE_FALHAS_CONSECUTIVAS; tentativa += 1) {
        const falha = await entrar(CONTA_QUE_BLOQUEIA.email, SENHA_ERRADA);
        expect(falha.status, `a ${String(tentativa)}ª tentativa malsucedida`).toBe(401);
      }

      // O bloqueio foi produzido pela REGRA que preenche a coluna, e não por escrita direta nela.
      // O número não é reancorado aqui: `LIMITE_DE_FALHAS_CONSECUTIVAS` é amarrado ao valor da RN-06
      // pelo CT-015 (`packages/auth/test/bloqueio.spec.ts`), que é o dono daquele eixo.
      const bloqueada = await estadoDaConta(CONTA_QUE_BLOQUEIA.id);
      expect(bloqueada).toEqual({
        ativo: true,
        tentativasFalhas: LIMITE_DE_FALHAS_CONSECUTIVAS,
        bloqueadoAte: expect.any(Date),
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      // No FUTURO: é o instante que o predicado `contaBloqueada` lê, e um prazo já vencido faria o
      // passo seguinte exercitar uma conta liberada sem que nada acusasse.
      expect(bloqueada?.bloqueadoAte?.getTime() ?? 0).toBeGreaterThan(Date.now());

      // --- 2, 3 e 4. as três respostas -----------------------------------------------------------
      const sessoesAntesDasRecusas = await contarSessoes();

      // A credencial é a CORRETA. É o que faz a recusa ser da BARREIRA, e não da senha.
      const comContaBloqueada = await entrar(CONTA_QUE_BLOQUEIA.email, SENHA_DA_CARGA);
      const comCredencialIncorreta = await entrar(CONTA_SAUDAVEL_DO_BLOQUEIO.email, SENHA_ERRADA);
      const comEmailInexistente = await entrar(EMAIL_INEXISTENTE, SENHA_DA_CARGA);

      // --- 5. a ÂNCORA, e depois a comparação CRUZADA --------------------------------------------
      //
      // A âncora é o único literal deste eixo, e ela fica sobre a resposta de REFERÊNCIA — a da
      // credencial incorreta, que é a forma que a RN-10 manda todas as outras imitarem. Sem ela,
      // três respostas idênticas e ERRADAS (o `{ statusCode, error, message }` do arcabouço, por
      // exemplo) passariam na igualdade cruzada.
      //
      // Ancorar a referência, e não o sujeito, é deliberado: é o que deixa a comparação cruzada
      // carregar sozinha o peso de julgar a recusa POR BLOQUEIO. Medido na prova de falsificação —
      // com a âncora sobre o sujeito, um mutante que divergisse o bloqueio reprovava no literal
      // antes de a cruzada ser exercitada, e o poder dela ficava sem demonstração.
      expect(comCredencialIncorreta.status).toBe(401);
      expect(comCredencialIncorreta.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // E a cruzada, que é o que prova a INDISTINGUIBILIDADE: cada referência veio de um sujeito
      // arranjado neste caso e com precondição afirmada acima. `observavel` compara status, corpo
      // desserializado, corpo BYTE A BYTE, o conjunto de chaves do corpo (é ele que reprova um
      // `detalhes` ou um `campo` a mais numa das respostas) e o conjunto de nomes de cabeçalho.
      expect(observavel(comContaBloqueada)).toEqual(observavel(comCredencialIncorreta));
      expect(observavel(comEmailInexistente)).toEqual(observavel(comCredencialIncorreta));

      // Nenhuma resposta traz cabeçalho de sessão. A igualdade acima já compara o conjunto de nomes
      // de cabeçalho, mas ela provaria apenas que as três **concordam**: se todas trouxessem cookie,
      // as três continuariam iguais. Esta asserção é o eixo absoluto do critério.
      for (const resposta of [comContaBloqueada, comCredencialIncorreta, comEmailInexistente]) {
        expect(resposta.cookies).toEqual([]);
      }

      // E nenhuma linha nova em `identidade.sessao` — recusa que responde erro mas cria sessão é o
      // defeito que a asserção de resposta sozinha não pega.
      expect(await contarSessoes()).toBe(sessoesAntesDasRecusas);
      expect(await contarSessoesDe(CONTA_SAUDAVEL_DO_BLOQUEIO.id)).toBe(0);
      // A conta bloqueada continua com a ÚNICA sessão do companheiro negativo — nem uma a mais.
      expect(await contarSessoesDe(CONTA_QUE_BLOQUEIA.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-017 — pessoa desativada e empresa suspensa recebem a mesma recusa, e nenhuma sessão é criada',
    async () => {
      // --- Precondições AFIRMADAS antes de qualquer arranjo -------------------------------------
      expect(await estadoDaConta(PESSOA_DESATIVADA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(PESSOA_DE_EMPRESA_SUSPENSA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_A.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(CONTA_SAUDAVEL_DA_POLITICA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        // Nulos porque o Master não pertence a empresa alguma — é o que o torna a linha de base
        // indiferente à suspensão que este caso aplica logo abaixo.
        empresaId: null,
        empresaSuspensaEm: null,
      });

      // -----------------------------------------------------------------------------------------
      // Companheiro negativo — as MESMAS pessoas, ativas e em empresa ativa
      // -----------------------------------------------------------------------------------------
      //
      // Antes do arranjo, e com a MESMA credencial que será usada depois: o único eixo que muda
      // entre esta perna e a recusa é o estado da pessoa e o da empresa dela.
      for (const pessoa of [PESSOA_DESATIVADA, PESSOA_DE_EMPRESA_SUSPENSA]) {
        const sessoesAntes = await contarSessoes();
        const entradaLegitima = await entrar(pessoa.email, SENHA_DA_CARGA);

        expect(entradaLegitima.status, pessoa.email).toBe(200);
        expect(entradaLegitima.cookies.filter(ehCookieDeSessao), pessoa.email).toHaveLength(1);
        expect(await contarSessoes(), pessoa.email).toBe(sessoesAntes + 1);
        expect(await contarSessoesDe(pessoa.id), pessoa.email).toBe(1);
      }

      // --- O arranjo: estado de domínio persistido, pelo padrão que a T7 estabeleceu -------------
      await desativarPessoa(PESSOA_DESATIVADA.id);
      await suspenderEmpresa(EMPRESA_A.id);

      // O arranjo TOMOU EFEITO, e só ele: a desativação não suspendeu empresa nenhuma, e a suspensão
      // não desativou pessoa alguma. Sem estas duas afirmações, um arranjo que errasse o alvo faria
      // as três respostas serem iguais **pelo motivo errado**.
      expect(await estadoDaConta(PESSOA_DESATIVADA.id)).toEqual({
        ativo: false,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(PESSOA_DE_EMPRESA_SUSPENSA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_A.id,
        empresaSuspensaEm: expect.any(Date),
      });

      // --- 1. o estado ANTES das três requisições ------------------------------------------------
      const sessoesAntes = await contarSessoes();
      const trilhaAntes = new Set((await tentativasRegistradas()).map((linha) => linha.id));

      // --- 2. as três requisições ---------------------------------------------------------------
      // As duas primeiras com a credencial CORRETA — é o que faz a recusa ser da BARREIRA.
      const comPessoaDesativada = await entrar(PESSOA_DESATIVADA.email, SENHA_DA_CARGA);
      const comEmpresaSuspensa = await entrar(PESSOA_DE_EMPRESA_SUSPENSA.email, SENHA_DA_CARGA);
      const comCredencialIncorreta = await entrar(CONTA_SAUDAVEL_DA_POLITICA.email, SENHA_ERRADA);

      // --- 3. a âncora e a comparação CRUZADA ----------------------------------------------------
      expect(comCredencialIncorreta.status).toBe(401);
      expect(comCredencialIncorreta.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // A referência é a MESMA nas duas comparações, de propósito: é a resposta da credencial
      // incorreta que a RN-10 manda imitar, e compará-las entre si também provaria que os dois
      // predicados concordam **um com o outro** sem dizer nada sobre o alvo.
      expect(observavel(comPessoaDesativada)).toEqual(observavel(comCredencialIncorreta));
      expect(observavel(comEmpresaSuspensa)).toEqual(observavel(comCredencialIncorreta));

      for (const resposta of [comPessoaDesativada, comEmpresaSuspensa, comCredencialIncorreta]) {
        expect(resposta.cookies).toEqual([]);
      }

      // --- 4. nenhuma sessão nova ---------------------------------------------------------------
      expect(await contarSessoes()).toBe(sessoesAntes);
      // E a contagem por pessoa não se moveu: cada uma continua com a única sessão que a perna
      // legítima criou, e o Master com nenhuma.
      expect(await contarSessoesDe(PESSOA_DESATIVADA.id)).toBe(1);
      expect(await contarSessoesDe(PESSOA_DE_EMPRESA_SUSPENSA.id)).toBe(1);
      expect(await contarSessoesDe(CONTA_SAUDAVEL_DA_POLITICA.id)).toBe(0);

      // --- 5. a trilha registrou as TRÊS tentativas, com desfecho de recusa ----------------------
      //
      // As linhas novas são identificadas por DIFERENÇA de chave primária, e não por ordenação
      // temporal: `ocorrida_em` vem do relógio do banco e duas inserções podem empatar, o que faria
      // uma asserção por ordem depender de desempate arbitrário.
      //
      // Aqui a trilha DISTINGUE o motivo, e é assim que tem de ser: a RN-10 exige indistinguibilidade
      // na RESPOSTA — o motivo fica onde ele serve, que é a auditoria que a operação lê. Uma trilha
      // que gravasse os três com o mesmo desfecho apagaria o sinal de ataque da RN-11.
      const novas = (await tentativasRegistradas())
        .filter((linha) => !trilhaAntes.has(linha.id))
        .map((linha) => ({
          emailInformado: linha.emailInformado,
          usuarioId: linha.usuarioId,
          desfecho: linha.desfecho,
        }))
        .sort((uma, outra) => uma.emailInformado.localeCompare(outra.emailInformado));

      // SUT_IS_CORRECT_BECAUSE: as duas recusas de política passaram a gravar
      // `ACESSO_RECUSADO_POR_POLITICA` porque o VOCABULÁRIO mudou, não porque a asserção tenha
      // afrouxado. A migração `0004` (T1 da fatia `autorizacao-e-ciclo-de-acesso`) fechou o débito
      // `P-T6-1`, separando a recusa de política do que não é decisão de política — que é a mesma
      // coisa que o comentário acima já pedia da trilha, agora um degrau mais fina. A forma da
      // asserção é idêntica: igualdade do arranjo inteiro, com rótulos literais.
      expect(novas).toEqual([
        {
          emailInformado: PESSOA_DESATIVADA.email,
          usuarioId: PESSOA_DESATIVADA.id,
          desfecho: 'ACESSO_RECUSADO_POR_POLITICA',
        },
        {
          emailInformado: CONTA_SAUDAVEL_DA_POLITICA.email,
          usuarioId: CONTA_SAUDAVEL_DA_POLITICA.id,
          desfecho: 'CREDENCIAL_INCORRETA',
        },
        {
          emailInformado: PESSOA_DE_EMPRESA_SUSPENSA.email,
          usuarioId: PESSOA_DE_EMPRESA_SUSPENSA.id,
          desfecho: 'ACESSO_RECUSADO_POR_POLITICA',
        },
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-223 — reemitir a Senha provisória invalida a anterior, e a recusa é indistinguível',
    async () => {
      // O Master entra RESTRITO por segundo fator (RN-08), e sessão restrita não alcança as rotas
      // dele: sem cumpri-lo pela via real, a reemissão responderia `403` da restrição e o
      // diagnóstico apontaria para o lugar errado.
      const cookieDoMaster = await entrarComSegundoFatorCumprido(MASTER.email);

      try {
        // --- Arranjo, pelas rotas reais da T7: empresa nova e Admin novo ----------------------
        //
        // Nada da carga é tocado — ver o cabeçalho. O Admin nasce com a senha provisória e **sem**
        // tê-la trocado, que é a precondição literal do card.
        const empresa = await criarEmpresa(cookieDoMaster);
        const admitido = await admitirAdministrador(
          cookieDoMaster,
          empresa,
          EMAIL_DO_ADMIN_REEMITIDO,
        );

        // --- Linha de base: a Senha provisória INICIAL entra ----------------------------------
        //
        // Sem esta perna, "a anterior deixou de servir" passaria sobre uma credencial que nunca
        // serviu — e a reemissão não teria provado coisa alguma.
        const comInicial = await entrar(admitido.email, admitido.senhaProvisoria);
        expect(comInicial.status).toBe(200);
        expect(comInicial.cookies.filter(ehCookieDeSessao)).toHaveLength(1);

        const saida = await pedir(ROTA_DE_SAIDA, {
          metodo: 'POST',
          cookie: credencialDeSessao(comInicial),
        });
        expect(saida.status).toBe(200);

        // --- A reemissão, pela rota do Master --------------------------------------------------
        const reemissao = await pedir(
          `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${admitido.usuarioId}/senha-provisoria`,
          { metodo: 'POST', cookie: cookieDoMaster },
        );

        expect(reemissao.status).toBe(200);
        const nova = (reemissao.corpo as { senhaProvisoria?: unknown }).senhaProvisoria;
        expect(typeof nova).toBe('string');
        // A senha nova é OUTRA. Sem esta linha, uma reemissão que devolvesse a mesma cadeia faria
        // "a nova entra" passar por vacuidade.
        expect(nova).not.toBe(admitido.senhaProvisoria);

        // --- A anterior deixa de servir, e a recusa é a da família da RN-10 --------------------
        const comAnterior = await entrar(admitido.email, admitido.senhaProvisoria);
        const comCredencialIncorreta = await entrar(admitido.email, SENHA_ERRADA);

        // A ÂNCORA fica sobre a resposta de REFERÊNCIA, pela mesma razão registrada no CT-016: é o
        // que deixa a comparação cruzada carregar sozinha o peso de julgar a recusa por reemissão.
        expect(comCredencialIncorreta.status).toBe(401);
        expect(comCredencialIncorreta.corpo).toEqual({
          codigo: CodigoErro.CREDENCIAL_INVALIDA,
          mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
        });

        // A CRUZADA — o MESMO comparador dos outros dois casos deste arquivo.
        expect(observavel(comAnterior)).toEqual(observavel(comCredencialIncorreta));

        for (const resposta of [comAnterior, comCredencialIncorreta]) {
          expect(resposta.cookies).toEqual([]);
        }

        // --- E a NOVA entra --------------------------------------------------------------------
        const comNova = await entrar(admitido.email, nova as string);
        expect(comNova.status).toBe(200);
        expect(comNova.cookies.filter(ehCookieDeSessao)).toHaveLength(1);
      } finally {
        // O estado do Master volta ao da carga ACONTEÇA O QUE ACONTECER acima — sem segundo fator e
        // sem sessão —, porque o CT-017 afirma, em valor ABSOLUTO, que ele não tem sessão alguma.
        // No `finally`, e não como última instrução: um `expect` que reprove antes deixaria o
        // resíduo e faria outro caso falhar apontando para o lugar errado.
        await desfazerSegundoFator(cookieDoMaster);
        await pedir(ROTA_DE_SAIDA, { metodo: 'POST', cookie: cookieDoMaster });
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-926 — histórico, boleto e emissão de uma cobrança de OUTRA empresa respondem como inexistentes',
    async () => {
      const cookieDoMaster = await entrarComSegundoFatorCumprido(MASTER.email);
      let empresaQueLanca = '';

      try {
        // -----------------------------------------------------------------------------------
        // O arranjo: DUAS empresas novas, cada uma com o próprio Admin — nada da carga é tocado
        // -----------------------------------------------------------------------------------
        //
        // Pelo mesmo regime do `CT-223`, e pela mesma razão: a carga é o elenco dos dois casos
        // anteriores, e o `CT-017` **suspende a empresa A**. Um arranjo que entrasse por uma pessoa
        // da carga passaria a depender da ordem em que os casos rodam — exatamente o que o cabeçalho
        // deste arquivo existe para impedir. As duas nascem pelas rotas reais do operador.
        empresaQueLanca = await criarEmpresa(cookieDoMaster);
        const empresaQuePede = await criarEmpresa(cookieDoMaster);

        expect(empresaQueLanca).not.toBe(empresaQuePede);

        const cookieDeQuemLanca = await administradorEmOperacao(cookieDoMaster, empresaQueLanca);
        const cookieDeQuemPede = await administradorEmOperacao(cookieDoMaster, empresaQuePede);

        // -----------------------------------------------------------------------------------
        // A cobrança da empresa que lança, com TRILHA — tudo pelas rotas reais até a trilha
        // -----------------------------------------------------------------------------------
        const codigo = await cobrancaComTrilha(cookieDeQuemLanca, empresaQueLanca);

        // -----------------------------------------------------------------------------------
        // O CONTROLE POSITIVO: a dona alcança a cobrança, e a trilha tem conteúdo
        // -----------------------------------------------------------------------------------
        //
        // Sem ele, *"as duas respostas de B são iguais"* passaria sobre um código que **não existe
        // para ninguém** — e o caso não teria provado isolamento algum, só que dois `404` se
        // parecem. A contagem é exata, e não `> 0`: é ela que separa *"a política devolveu as linhas
        // desta cobrança"* de *"devolveu uma linha qualquer"*.
        const pelaDona = await pedir(rotaDoHistorico(codigo), { cookie: cookieDeQuemLanca });

        expect(pelaDona.status, `a dona não alcançou a própria cobrança: ${pelaDona.texto}`).toBe(
          200,
        );
        expect(
          (pelaDona.corpo as { itens: readonly { tipo: string }[] }).itens
            .map((evento) => evento.tipo)
            .sort(),
          'a dona não recebeu a trilha que o arranjo gravou',
        ).toEqual([...EFEITOS_DA_TRILHA]);

        // -----------------------------------------------------------------------------------
        // As três rotas, pedidas pela OUTRA empresa — com o código real e com o inexistente
        // -----------------------------------------------------------------------------------
        //
        // A tabela cobre as três rotas que endereçam uma cobrança pelo código, e o tamanho é
        // afirmado ANTES de percorrê-la: uma tabela truncada faria as comparações abaixo passarem
        // sobre menos rotas do que a fatia publica.
        const rotas = rotasQueEnderecamACobranca();

        expect(rotas.length).toBe(ROTAS_QUE_ENDERECAM_A_COBRANCA);

        for (const rota of rotas) {
          const comOCodigoDeOutra = await pedir(rota.alvo(codigo), {
            metodo: rota.metodo,
            cookie: cookieDeQuemPede,
            ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
          });
          const comOCodigoInexistente = await pedir(rota.alvo(COBRANCA_INEXISTENTE), {
            metodo: rota.metodo,
            cookie: cookieDeQuemPede,
            ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
          });

          // A ÂNCORA fica sobre a resposta de REFERÊNCIA — a do código que não existe em empresa
          // alguma, que é a forma que a ADR-0008 manda a outra imitar. Sem ela, duas respostas
          // idênticas e ERRADAS (um `500` de driver nas duas, por exemplo) passariam na cruzada. É a
          // mesma escolha, e a mesma razão, do `CT-016`: ancorar a referência deixa a comparação
          // cruzada carregar sozinha o peso de julgar a recusa POR EMPRESA.
          expect(
            comOCodigoInexistente.status,
            `${rota.rotulo} respondeu ${String(comOCodigoInexistente.status)} ao código inexistente`,
          ).toBe(404);
          expect(comOCodigoInexistente.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
            codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
            mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
            campo: CAMPO_DO_CODIGO,
          });

          // E a CRUZADA, que é o que prova a INDISTINGUIBILIDADE. `observavel` compara status, corpo
          // desserializado, corpo BYTE A BYTE, o conjunto de chaves do corpo — é ele que reprova um
          // `detalhes` presente em apenas uma das duas — e o conjunto de nomes de cabeçalho, que é o
          // que reprova um `content-disposition` sobrando na rota de bytes.
          expect(
            observavel(comOCodigoDeOutra),
            `${rota.rotulo} distingue a cobrança de outra empresa da inexistente`,
          ).toEqual(observavel(comOCodigoInexistente));
        }

        // -----------------------------------------------------------------------------------
        // O ISOLAMENTO É DO BANCO: a trilha não existe sob o contexto da outra empresa
        // -----------------------------------------------------------------------------------
        //
        // As duas contagens são a mesma instrução, sobre a mesma linha, com contextos de tenant
        // diferentes — nenhuma cláusula aqui compara `empresa_id` com coisa alguma (ADR-0008). Sob o
        // contexto de quem pede, a política **esconde** as linhas; sob o de quem lança, elas estão
        // lá. É o par que discrimina: sem a segunda, um `0` viria também de uma trilha que nunca foi
        // gravada, e o caso passaria sem medir isolamento.
        const cobrancaId = await identificadorDaCobranca(empresaQueLanca, codigo);

        expect(await contarEventos(empresaQuePede, cobrancaId)).toBe(0);
        expect(await contarEventos(empresaQueLanca, cobrancaId)).toBe(EFEITOS_DA_TRILHA.length);
      } finally {
        // O estado do Master volta ao da carga ACONTEÇA O QUE ACONTECER acima — sem segundo fator e
        // sem sessão —, porque o `CT-017` afirma, em valor ABSOLUTO, que ele não tem sessão alguma.
        await desfazerSegundoFator(cookieDoMaster);
        await pedir(ROTA_DE_SAIDA, { metodo: 'POST', cookie: cookieDoMaster });
      }
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// O que é comparado entre respostas
// ---------------------------------------------------------------------------------------------

/**
 * Tudo o que um cliente observa de uma resposta de recusa, num objeto só.
 *
 * Os cinco eixos, e por que cada um:
 *
 *   * `status` — o primeiro sinal, e o mais fácil de divergir sem querer (`403` para "desativada");
 *   * `corpo` — o objeto desserializado, que é o que o cliente lê;
 *   * `texto` — o corpo **byte a byte**. Ele pega o que a igualdade de objeto não pega: ordem de
 *     chaves, espaçamento e acentuação diferentes produzem o mesmo objeto e cadeias distintas;
 *   * `chavesDoCorpo` — o CONJUNTO de campos. É este eixo que reprova um `detalhes` ou um `campo`
 *     presente em apenas uma das respostas, que é a forma mais discreta de confirmar a existência
 *     da conta;
 *   * `cabecalhos` — o conjunto de NOMES de cabeçalho, nunca os valores. Nomes são estáveis entre
 *     respostas do mesmo fluxo; valores carregam instante e comprimento, e compará-los produziria
 *     falha por variação que não distingue coisa alguma.
 *
 * Comparar o objeto INTEIRO, e não eixo a eixo, é o que faz a falha nomear qual deles divergiu.
 */
function observavel(resposta: Resposta): Record<string, unknown> {
  return {
    status: resposta.status,
    corpo: resposta.corpo,
    texto: resposta.texto,
    chavesDoCorpo: chavesOrdenadas(resposta.corpo),
    cabecalhos: [...resposta.cabecalhos],
  };
}

/** As chaves de um corpo JSON, ordenadas. Corpo que não seja objeto vira lista vazia. */
function chavesOrdenadas(corpo: unknown): string[] {
  return typeof corpo === 'object' && corpo !== null ? Object.keys(corpo).sort() : [];
}

// ---------------------------------------------------------------------------------------------
// Observação e arranjo do estado persistido
// ---------------------------------------------------------------------------------------------

/** O estado que decide a admissão de uma pessoa, lido do banco pela mesma junção que a barreira usa. */
interface EstadoDaConta {
  ativo: boolean;
  tentativasFalhas: number;
  bloqueadoAte: Date | null;
  empresaId: string | null;
  empresaSuspensaEm: Date | null;
}

/**
 * Lê o estado de admissão persistido de uma pessoa.
 *
 * Observação de estado persistido — a mesma via pela qual a T7, a T8 e a T10 já afirmam precondição.
 * A junção é `LEFT` pela razão que `carregarPessoa` registra: o Master não tem empresa, e com `INNER`
 * ele simplesmente sumiria da consulta.
 */
async function estadoDaConta(usuarioId: string): Promise<EstadoDaConta | undefined> {
  const { empresa, usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({
      ativo: usuario.ativo,
      tentativasFalhas: usuario.tentativasFalhas,
      bloqueadoAte: usuario.bloqueadoAte,
      empresaId: usuario.empresaId,
      empresaSuspensaEm: empresa.suspensaEm,
    })
    .from(usuario)
    .leftJoin(empresa, eq(empresa.id, usuario.empresaId))
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  return linha;
}

/**
 * Desativa a pessoa no arranjo do caso.
 *
 * **Não existe caminho de produção para esta coluna nesta fatia** — o cabeçalho deste arquivo explica
 * por que criar um seria antecipar a fatia `autorizacao-e-ciclo-de-acesso` e vazar símbolo test-only
 * para a produção. É o mesmo padrão que a T7 usa no arranjo dela. A partir daqui, tudo é pela rota
 * real.
 */
async function desativarPessoa(usuarioId: string): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await identidade.acesso.identidade
    .update(usuario)
    .set({ ativo: false })
    .where(eq(usuario.id, usuarioId));
}

/** Suspende a empresa no arranjo do caso, pela mesma razão e pelo mesmo padrão de {@link desativarPessoa}. */
async function suspenderEmpresa(empresaId: string): Promise<void> {
  const { empresa } = esquemaIdentidade;

  await identidade.acesso.identidade
    .update(empresa)
    .set({ suspensaEm: new Date() })
    .where(eq(empresa.id, empresaId));
}

/** Quantas sessões existem no banco inteiro. */
async function contarSessoes(): Promise<number> {
  const [linha] = await identidade.acesso.identidade
    .select({ total: count() })
    .from(esquemaIdentidade.sessao);

  return linha?.total ?? -1;
}

/** Quantas sessões existem para uma pessoa. */
async function contarSessoesDe(usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ total: count() })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linha?.total ?? -1;
}

/** Uma linha da trilha, no que este arquivo observa dela. */
interface TentativaRegistrada {
  id: string;
  emailInformado: string;
  usuarioId: string | null;
  desfecho: string;
}

/** A trilha inteira. O caso identifica as linhas novas por diferença de chave primária. */
async function tentativasRegistradas(): Promise<TentativaRegistrada[]> {
  const { tentativaLogin } = esquemaIdentidade;

  return await identidade.acesso.identidade
    .select({
      id: tentativaLogin.id,
      emailInformado: tentativaLogin.emailInformado,
      usuarioId: tentativaLogin.usuarioId,
      desfecho: tentativaLogin.desfecho,
    })
    .from(tentativaLogin);
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  /** Os NOMES dos cabeçalhos da resposta, ordenados. Nunca os valores — ver {@link observavel}. */
  readonly cabecalhos: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  /**
   * A credencial de sessão a reenviar, no formato `nome=valor`.
   *
   * Chegou com o CT-223, que precisa de sessão para chamar as rotas do Master. Os dois casos
   * anteriores continuam sem informá-la — e a ausência segue significando "requisição sem cookie",
   * que é o regime em que eles exercitam a entrada.
   */
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere. Ele é composto da mesma fonte que o endereço
 * base, e não escrito à mão. O corpo só é desserializado quando o tipo declarado é JSON.
 */
async function pedir(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(caminho, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    cookies: resposta.headers.getSetCookie(),
    cabecalhos: [...resposta.headers.keys()].sort(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<Resposta> {
  return await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });
}

/** O cabeçalho `Set-Cookie` carrega a credencial de sessão do arcabouço. */
function ehCookieDeSessao(bruto: string): boolean {
  const par = bruto.split(';')[0] ?? '';
  return (par.split('=')[0] ?? '').trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO);
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find(ehCookieDeSessao);

  if (cookie === undefined) {
    throw new Error('a resposta não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}

// ---------------------------------------------------------------------------------------------
// O arranjo do CT-223 — tudo pelas rotas reais
// ---------------------------------------------------------------------------------------------

/**
 * Entra e **cumpre a exigência de segundo fator**, pelo caminho público real.
 *
 * O Master nasce da carga sem segundo fator configurado, e a sessão dele é restrita até que ele o
 * configure (RN-08). Nada é forjado: o segredo sai do endereço que a própria resposta do preparo
 * devolveu, e o código é derivado pela função de geração **do arcabouço** — uma cópia do algoritmo
 * provaria que duas implementações concordam, não que a nossa confere o código que ele espera.
 */
async function entrarComSegundoFatorCumprido(email: string): Promise<string> {
  const entrada = await entrar(email, SENHA_DA_CARGA);

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const cookie = credencialDeSessao(entrada);

  const preparo = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/enable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (preparo.status !== 200) {
    throw new Error(
      `o preparo do segundo fator respondeu ${String(preparo.status)}: ${preparo.texto}`,
    );
  }

  const totpURI = (preparo.corpo as { totpURI?: unknown }).totpURI;
  if (typeof totpURI !== 'string') {
    throw new Error('o preparo do segundo fator não devolveu o endereço de configuração');
  }

  const codificado = new URL(totpURI).searchParams.get('secret');
  if (codificado === null) {
    throw new Error('o endereço de configuração do segundo fator não trouxe segredo');
  }

  const { code } = await identidade.autenticacao.api.generateTOTP({
    body: { secret: decodificarBase32(codificado) },
  });

  const ativacao = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`, {
    metodo: 'POST',
    cookie,
    corpo: { code },
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação do segundo fator respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return credencialDeSessao(ativacao);
}

/** Desfaz o segundo fator pela rota pública, devolvendo a pessoa ao estado da carga. */
async function desfazerSegundoFator(cookie: string): Promise<void> {
  const desfeito = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/disable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (desfeito.status !== 200) {
    throw new Error(
      `a desativação do segundo fator respondeu ${String(desfeito.status)}: ${desfeito.texto}`,
    );
  }
}

/** Cria uma empresa pela rota do Master (T7) e devolve o identificador dela. */
async function criarEmpresa(cookieDoMaster: string): Promise<string> {
  const criada = await pedir(CAMINHO_DAS_EMPRESAS, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    // Documento sorteado por execução: ele é único, e um literal faria a segunda execução contra o
    // mesmo banco recusar por duplicidade.
    corpo: { nome: 'Imobiliária do CT-223 Ltda', documento: randomUUID() },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de empresa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  return (criada.corpo as { id: string }).id;
}

/** O que a admissão de administrador devolve, no que este arquivo observa dela. */
interface AdministradorAdmitido {
  readonly usuarioId: string;
  readonly email: string;
  readonly senhaProvisoria: string;
}

/** Admite um administrador pela rota do Master (T7), com a Senha provisória devolvida uma vez. */
async function admitirAdministrador(
  cookieDoMaster: string,
  empresaId: string,
  email: string,
  // O nome é cosmético — nada o assere —, e o parâmetro existe para que o `CT-926` não admita gente
  // batizada com o identificador de outro caso. O padrão preserva, byte a byte, o que o `CT-223`
  // sempre enviou.
  nome = 'Administrador do CT-223',
): Promise<AdministradorAdmitido> {
  const admitido = await pedir(`${CAMINHO_DAS_EMPRESAS}/${empresaId}/admin`, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome, email },
  });

  if (admitido.status !== 201) {
    throw new Error(
      `a admissão de administrador respondeu ${String(admitido.status)}: ${admitido.texto}`,
    );
  }

  const corpo = admitido.corpo as AdministradorAdmitido;

  if (typeof corpo.senhaProvisoria !== 'string' || corpo.senhaProvisoria.length === 0) {
    throw new Error('a admissão de administrador não devolveu Senha provisória');
  }

  return corpo;
}

// ---------------------------------------------------------------------------------------------
// O arranjo do CT-926 — as rotas reais até a trilha, e a camada de dados só onde não há rota
// ---------------------------------------------------------------------------------------------

/** Uma das três rotas que endereçam uma cobrança pelo código, no que o `CT-926` precisa dela. */
interface RotaDaCobranca {
  /** Método e caminho, para a mensagem de falha nomear a rota exata. */
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: (codigo: string) => string;
  readonly corpo?: Record<string, unknown>;
}

/**
 * As **três** rotas da fatia `emissao-e-conciliacao` que endereçam uma cobrança pelo código.
 *
 * Compostas do dono do segmento (`CAMINHO_DAS_COBRANCAS`), e nunca escritas como cadeia crua: um
 * segmento que mudasse no controlador sem passar por aqui faria o caso bater numa rota que não
 * existe e receber `404` da **ausência de manipulador** — que passaria na comparação cruzada pelo
 * motivo errado, e é o modo de falha mais enganoso desta classe de prova.
 *
 * ⚠️ As três são de naturezas diferentes de propósito: uma devolve **lista** (o histórico), uma
 * devolve **bytes** (o boleto) e uma é **ato** (a emissão). Se as três fossem da mesma natureza, um
 * `404` que vazasse existência por um canal exclusivo de uma delas — um `content-disposition` que
 * sobrasse, um `detalhes` que só o ato publica — não teria como aparecer.
 */
function rotasQueEnderecamACobranca(): readonly RotaDaCobranca[] {
  return [
    {
      rotulo: 'GET /v1/cobrancas/:codigo/historico-bancario',
      metodo: 'GET',
      alvo: rotaDoHistorico,
    },
    {
      rotulo: 'GET /v1/cobrancas/:codigo/boleto',
      metodo: 'GET',
      alvo: (codigo) => `${COLECAO_DE_COBRANCAS}/${codigo}/boleto`,
    },
    {
      rotulo: 'POST /v1/cobrancas/:codigo/emissao-de-boleto',
      metodo: 'POST',
      alvo: (codigo) => `${COLECAO_DE_COBRANCAS}/${codigo}/emissao-de-boleto`,
      corpo: {},
    },
  ];
}

/** A rota do histórico bancário, composta a partir do dono do segmento — nunca escrita à mão. */
function rotaDoHistorico(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/historico-bancario`;
}

/**
 * Admite um Admin na empresa informada e o deixa **operando**: senha trocada e sessão plena.
 *
 * A troca é obrigatória (RN-09) e acontece pela rota do produto: sem ela a sessão nasce **restrita**,
 * e toda rota de negócio responderia `403` da restrição — o `404` que o caso mede nunca aconteceria,
 * e a comparação cruzada compararia duas recusas de outra coisa.
 *
 * ⚠️ **Ela custa uma troca de senha por chamada, e o teto é dez por minuto.** Os pedidos desta suíte
 * não declaram `x-forwarded-for`, e o limitador então os conta todos no balde do endereço local —
 * uma chave só para o caminho: a décima primeira troca do mesmo minuto recebe `429`. Este arquivo
 * gasta **duas**, as do `CT-926`. (O ponteiro daqui era o débito `D27` de
 * `packages/auth/src/autenticacao.ts`; ele FECHOU na T8 da fatia `publicacao-e-backup`, e o salto
 * confiável passou a ser declarado. O teto continua valendo AQUI porque a origem destes pedidos
 * segue não sendo apurável, e não porque falte eixo.)
 */
async function administradorEmOperacao(cookieDoMaster: string, empresaId: string): Promise<string> {
  const admitido = await admitirAdministrador(
    cookieDoMaster,
    empresaId,
    `admin.${randomUUID()}@exemplo.com.br`,
    'Administrador do CT-926',
  );

  const restrita = await entrar(admitido.email, admitido.senhaProvisoria);

  if (restrita.status !== 200) {
    throw new Error(`a entrada do Admin respondeu ${String(restrita.status)}: ${restrita.texto}`);
  }

  const cookie = credencialDeSessao(restrita);
  const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie,
    corpo: { senhaAtual: admitido.senhaProvisoria, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  // A resposta pode ou não reemitir a credencial de sessão, e as duas formas são aceitas: o que
  // importa é o cookie que passa a valer, e não por qual das duas ele chegou.
  const reemitido = troca.cookies.find(ehCookieDeSessao);

  return reemitido === undefined ? cookie : (reemitido.split(';')[0] ?? cookie);
}

/**
 * Monta a cobrança do arranjo — conjunto, imóvel, locador, locatário, contrato ATIVO e lançamento —
 * e grava a trilha bancária dela.
 *
 * Tudo pelas **rotas reais**, salvo os dois eventos da trilha. A exceção é deliberada e tem razão
 * medida: o único produtor de evento bancário em produção é a ida ao **provedor** — a rota de emissão
 * e o percurso da conferência —, e satisfazê-lo aqui exigiria a montagem instrumentada com
 * `overrideProvider`, que este arquivo deliberadamente não tem (ver o cabeçalho: a aplicação é a
 * **real**, a que `criarAplicacao()` monta). O que o `CT-926` mede não é **quem grava** o evento, e
 * sim **quem consegue lê-lo**: a trilha é a precondição, e o `CT-925` de
 * `historico-bancario.e2e.spec.ts` é o dono do eixo do produtor.
 *
 * A gravação corre pela mesma função de domínio de `@sysloc/db` que o percurso da conferência chama
 * (`registrarEventoBancario`), sob `contextoDeTenant.executarCom` da empresa dona — escrita de estado
 * de domínio persistido, no mesmo padrão que este arquivo já usa em {@link desativarPessoa} e em
 * {@link suspenderEmpresa}. Nenhum símbolo de produção nasceu para o teste enxergar algo.
 */
async function cobrancaComTrilha(cookie: string, empresaId: string): Promise<string> {
  const conjuntoId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`, cookie, {
      nome: `Edifício ${String(proximo())}`,
    })
  ).id;
  const imovelId = (
    await criarPor(
      `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`,
      cookie,
      corpoDeImovel(conjuntoId),
    )
  ).id;
  const locadorId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCADORES}`, cookie, corpoDePessoa())
  ).id;
  const locatarioId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`, cookie, corpoDePessoa())
  ).id;

  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie,
    corpo: {
      imovelId,
      locadorId,
      locatarioId,
      fiadoresIds: [],
      dataInicioLocacao: DATA_DE_INICIO_DO_CONTRATO,
      prazoMeses: PRAZO_EM_MESES,
      valorMensal: VALOR_MENSAL,
      diaVencimento: DIA_DE_VENCIMENTO,
      // Sem geração automática: o que o caso endereça é **uma** cobrança conhecida, e doze parcelas
      // nascidas da ativação encheriam o conjunto sem acrescentar nada ao que se mede.
      gerarCobrancasAutomaticamente: false,
    },
  });

  if (montagem.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(montagem.status)}: ${montagem.texto}`,
    );
  }

  const contrato = (montagem.corpo as { codigo: string }).codigo;
  const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${contrato}/ativacao`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação de ${contrato} respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  const vencimento = await dataDeslocada(empresaId, DIAS_ATE_O_VENCIMENTO);
  const lancamento = await pedir(COLECAO_DE_COBRANCAS, {
    metodo: 'POST',
    cookie,
    corpo: {
      contratoCodigo: contrato,
      natureza: 'ALUGUEL',
      referencia: REFERENCIA_DA_COBRANCA,
      competencia: `${vencimento.slice(0, 7)}-01`,
      dataVencimento: vencimento,
      valorOriginal: VALOR_DA_COBRANCA,
    },
  });

  if (lancamento.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(lancamento.status)}: ${lancamento.texto}`);
  }

  const codigo = (lancamento.corpo as { codigo: string }).codigo;
  const cobrancaId = await identificadorDaCobranca(empresaId, codigo);

  await emUnidadeDe(empresaId, async (tx) => {
    for (const tipo of EFEITOS_DA_TRILHA) {
      await registrarEventoBancario(tx, { cobrancaId, tipo, origem: 'ATO_DO_ADMIN' });
    }
  });

  return codigo;
}

/** Cria um recurso pela rota informada e devolve o identificador dele. A falha levanta. */
async function criarPor(
  colecao: string,
  cookie: string,
  corpo: Record<string, unknown>,
): Promise<{ readonly id: string }> {
  const resposta = await pedir(colecao, { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 201) {
    throw new Error(
      `a criação em ${colecao} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as { readonly id: string };
}

let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** O corpo completo de um imóvel — os campos que o cadastro exige, com marca única por construção. */
function corpoDeImovel(conjuntoId: string): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    conjuntoId,
    nomeImovel: `Ap ${marca}`,
    identificadorMunicipal: `IM-${marca}`,
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
  };
}

/** O corpo completo de um cadastro de pessoa, com documento e e-mail únicos por construção. */
function corpoDePessoa(): Record<string, unknown> {
  const numero = proximo();
  const marca = String(numero).padStart(6, '0');

  return {
    nome: `Parte ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(numero),
    rg: null,
    email: `parte.${marca}@exemplo.com.br`,
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
 * A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que a visão consulta — nunca de
 * `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha.
 */
async function dataDeslocada(empresaId: string, dias: number): Promise<string> {
  return await emUnidadeDe(empresaId, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

/**
 * O identificador **interno** da cobrança, lido sob o contexto da empresa dona.
 *
 * Por consulta crua, e não por `localizarCobranca`: a porta de dados publica a cobrança pela **chave
 * exposta** — o código legível —, e o UUID **não sai dela** por decisão da ADR-0017. Ele é
 * precondição de observação deste caso, e não superfície: é a chave pela qual as duas contagens de
 * `evento_bancario` perguntam pela **mesma** linha sob contextos de tenant diferentes.
 *
 * A leitura corre sob o contexto da dona porque a política a esconderia da outra — e é exatamente
 * essa a propriedade que o caso mede logo depois.
 */
async function identificadorDaCobranca(empresaId: string, codigo: string): Promise<string> {
  return await emUnidadeDe(empresaId, async (tx) => {
    const [linha] = await tx<{ id: string }[]>`
      SELECT id FROM negocio.cobranca WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`o arranjo não encontrou a cobrança ${codigo}`);
    }

    return linha.id;
  });
}

/**
 * Quantas linhas de `negocio.evento_bancario` a cobrança tem **sob o contexto informado**.
 *
 * A mesma instrução, sobre a mesma linha, com contextos de tenant diferentes: nenhuma cláusula aqui
 * compara `empresa_id` com coisa alguma — quem esconde a linha é a política do banco (ADR-0008), e
 * é exatamente isso que o controle antivácuo do `CT-926` mede.
 */
async function contarEventos(empresaId: string, cobrancaId: string): Promise<number> {
  return await emUnidadeDe(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total
        FROM negocio.evento_bancario
       WHERE cobranca_id = ${cobrancaId}
    `;

    return Number(linha?.total ?? -1);
  });
}

/**
 * Abre a unidade de trabalho sob o contexto da empresa informada.
 *
 * `contextoDeTenant.executarCom` mais `emUnidadeDeTrabalho`: nenhum `SET app.empresa_id` é escrito à
 * mão. É a via de arranjo e de observação de estado persistido, e não um caminho de produção — na
 * borda, quem fixa o contexto é `sobContextoDaSessao`, a partir da sessão (ADR-0008).
 */
async function emUnidadeDe<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
}
