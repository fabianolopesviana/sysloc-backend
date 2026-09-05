/**
 * Os **recortes das três carteiras na borda** — CT-1265 a CT-1271. Intervenção dirigida de
 * 2026-09-05, pedida pela equipe de frontend e autorizada pela `Decision` da **ADR-0039**
 * (*"dentro do congelamento, acrescentar operação ou campo é permitido; renomear e remover, não"*).
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | ADR-0039 | CT-1265 | `GET /v1/contratos?status=` responde `200` devolvendo **exatamente** os
 * |          |         | contratos daquele estado — igualdade de conjunto sobre os códigos — com
 * |          |         | `total` igual ao tamanho do recorte, e a soma dos quatro recortes igual ao
 * |          |         | `total` da carteira sem filtro. |
 * | ADR-0039 | CT-1266 | `?fimDe=`/`?fimAte=` recorta `dataFimLocacao` com as **duas pontas
 * |          |         | inclusive** (a janela de um dia alcança quem termina naquele dia), cada
 * |          |         | ponta vale sozinha, e o contrato em rascunho — `dataFimLocacao: null` — não
 * |          |         | entra nem na janela mais larga. |
 * | ADR-0039 | CT-1267 | O item da carteira traz `nomeImovel`, `nomeLocador` e `nomeLocatario`
 * |          |         | **iguais aos cadastros criados**, e a leitura por código (`GET
 * |          |         | /v1/contratos/:codigo`) **não** os traz — a assimetria é publicada, e o par
 * |          |         | é o que a fixa. |
 * | ADR-0039 | CT-1268 | `GET /v1/imoveis?statusLocacao=` alcança `LOCADO` — o estado que a entrada
 * |          |         | de imóvel **não** aceita —, devolve exatamente os da situação pedida, e a
 * |          |         | soma das três é a carteira inteira. |
 * | ADR-0039 | CT-1269 | `GET /v1/cobrancas?vencimentoDe=&vencimentoAte=` recorta a **data gravada**:
 * |          |         | a janela de hoje devolve a que vence hoje e **não** a que venceu ontem, e o
 * |          |         | recorte **compõe** com `status` em vez de o substituir — a que vence hoje
 * |          |         | ainda não está vencida. |
 * | ADR-0039 | CT-1270 | As **seis** recusas respondem `422` com o corpo **inteiro por igualdade**
 * |          |         | (`{codigo, mensagem, campo}`), nomeando o parâmetro culpado; e a chave
 * |          |         | desconhecida na cadeia de consulta é recusada **nomeando a própria
 * |          |         | chave** (§6.2 do handoff). |
 * | ADR-0039 | CT-1271 | Com os recortes ligados, a sessão de **B** recebe `200` com `itens: []` e
 * |          |         | `total: 0` nos mesmos pedidos em que a de **A** recebe conjunto não vazio —
 * |          |         | o filtro novo não abre caminho para dado de outra empresa (ADR-0008). |
 *
 * Rastreabilidade: `ADR-0039 §Decision → CT-1265` · `ADR-0039 §Decision → CT-1266` ·
 * `ADR-0039 §Decision → CT-1267` · `ADR-0039 §Decision → CT-1268` ·
 * `ADR-0039 §Decision → CT-1269` · `ADR-0039 §Decision → CT-1270` ·
 * `ADR-0039 §Decision → CT-1271`.
 *
 * ⚠️ **O par NÃO leva `(RN-xx)`, e a razão está por extenso no cabeçalho de
 * `packages/db/test/recortes-de-listagem.spec.ts`**: a numeração `RN-xx` é escopada por fatia, esta
 * intervenção não tem fatia, e um número sem catálogo aponta para regra alheia.
 *
 * ⚠️ **As âncoras de superfície NÃO se movem com esta intervenção**, e a ausência é a decisão: nada
 * aqui publica, remove ou renomeia rota — os recortes são **parâmetros** de rotas que já existiam, e
 * os três números de `./cobertura-de-autorizacao.e2e.spec.ts` (113 / 98 / 20) continuam exatos. É a
 * diferença entre *acrescentar campo* e *acrescentar operação* que a ADR-0039 declara.
 *
 * ===========================================================================
 * O QUE ESTA SUÍTE PROVA QUE AS OUTRAS DUAS NÃO PROVAM
 * ===========================================================================
 *
 * A de esquemas (`packages/contracts/test/esquemas.spec.ts`, CT-1256 a CT-1259) prova a **forma** do
 * recorte; a da porta (`packages/db/test/recortes-de-listagem.spec.ts`, CT-1260 a CT-1264) prova que
 * ele vira **predicado SQL**. O que só aqui se observa é a **fiação**: que o parâmetro sai da cadeia
 * de consulta, atravessa a validação da borda e chega à porta — e que a recusa é `422` com o
 * envelope da ADR-0017, e não uma página vazia sobre um rótulo que não existe.
 *
 * O defeito que esta suíte pega, e que nenhuma das outras duas pegaria: um controlador que valide o
 * parâmetro e **não o repasse** ao serviço. O esquema aprovaria, o predicado continuaria correto, e
 * a rota devolveria a carteira inteira sob um filtro que o cliente acredita ter aplicado.
 *
 * ===========================================================================
 * A PRECONDIÇÃO — montada pelas ROTAS REAIS
 * ===========================================================================
 *
 * Conjunto, imóvel, locador, locatário, contrato, ativação e cancelamento saem, cada um, de um
 * `POST` autenticado: é a preferência **(b)** da Iron Law #6, e o único caminho que atravessa a
 * conferência de entrada, a guarda de autorização e a contabilidade das séries. O cliente HTTP e a
 * entrada de sessão são **importados** de `./acessorios-de-borda.ts`, nunca redeclarados — a
 * convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`.
 *
 * As datas saem do **relógio do banco** (ADR-0026): compostas no processo, o arranjo mediria a
 * diferença entre dois relógios, e o vencimento é justamente o eixo que o `CT-1269` recorta.
 *
 * O banco e a fila são instâncias **efêmeras próprias** (ADR-0006), de modo que a carteira desta
 * empresa contém **só** o que esta montagem semeou — é o que torna a igualdade de conjunto
 * exprimível sem recortes defensivos.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import type { Contrato, ContratoNaCarteira, EstadoDoContrato } from '@syslocbr/contracts';
import { ESTADOS_DO_CONTRATO, SITUACOES_DE_LOCACAO } from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { entrar, pedir } from './acessorios-de-borda.ts';
import { cpfValido } from './documento.ts';

/** Teto da montagem: banco migrado, carga com credencial, fila, aplicação e a cadeia de cadastros. */
const LIMITE_DE_MONTAGEM_MS = 300_000;

/** Teto por caso: cada um atravessa HTTP várias vezes. */
const LIMITE_CASO_MS = 120_000;

/** As coleções sob prova, compostas dos donos dos segmentos — nunca escritas à mão. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;
const COLECAO_DE_IMOVEIS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

/**
 * A mensagem canônica do `422` — literal, e não lida de `MENSAGEM_POR_CODIGO`.
 *
 * Derivá-la da mesma tabela que o SUT usa faria a asserção concordar consigo mesma. É o texto que o
 * cliente lê, e por isso ele é **escrito**.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/** As pessoas da carga que este arquivo usa. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');

/** O valor de toda parcela do cenário — nenhum caso deste arquivo mede dinheiro. */
const VALOR_DA_PARCELA = 1500;

/** As variáveis que a montagem escreve no ambiente do processo e restaura ao fim. */
const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

/** O envelope de lista da ADR-0017, na forma mínima que estes casos leem. */
interface PaginaPublicada {
  readonly itens: readonly ContratoNaCarteira[];
  readonly total: number;
}

/** O envelope de lista de imóveis, na forma mínima que estes casos leem. */
interface PaginaDeImoveisPublicada {
  readonly itens: readonly { readonly id: string; readonly statusLocacao: string }[];
  readonly total: number;
}

/** O envelope de lista de cobranças, na forma mínima que estes casos leem. */
interface PaginaDeCobrancasPublicada {
  readonly itens: readonly { readonly codigo: string; readonly dataVencimento: string }[];
  readonly total: number;
}

/** A cadeia montada por HTTP, com o que os casos precisam nomear. */
interface CadeiaMontada {
  readonly contratoCodigo: string;
  readonly imovelId: string;
  /**
   * Os identificadores das duas partes — guardados pela mesma razão do `imovelId`.
   *
   * Sem eles, o passo 2 do `CT-1267` só teria como afirmar `typeof … === 'string'`, e a asserção por
   * tipo **não discrimina** o defeito que aquele passo persegue: uma troca entre `locadorId` e
   * `locatarioId`, ou um UUID de outro cadastro, passaria verde.
   */
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly nomeImovel: string;
  readonly nomeLocador: string;
  readonly nomeLocatario: string;
}

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookieDeA: string;
let cookieDeB: string;

/** As três cadeias de A: uma em rascunho, uma ativa e uma cancelada. */
let emRascunho: CadeiaMontada;
let ativa: CadeiaMontada;
let cancelada: CadeiaMontada;

/** O término derivado da ativação do contrato ativo, em `YYYY-MM-DD`. */
let terminoDoAtivo: string;

/** Os códigos das três cobranças do contrato ativo, e as datas correspondentes. */
let cobrancaDeOntem: string;
let cobrancaDeHoje: string;
let cobrancaDeAmanha: string;
let ontem: string;
let hoje: string;
let amanha: string;

/** Sequencial do processo — cada cadastro nasce com documento e identificador únicos. */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // A aplicação de PRODUÇÃO. Nenhum provedor é substituído: estas rotas leem o banco e respondem.
  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookieDeA = await entrar(base, ADMIN_DE_A.email, SENHA_DA_CARGA);
  cookieDeB = await entrar(base, ADMIN_DE_B.email, SENHA_DA_CARGA);

  // As três cadeias. A ordem importa só para a legibilidade: nenhuma depende do estado de outra.
  emRascunho = await montarCadeia('rascunho');
  ativa = await montarCadeia('ativa');
  cancelada = await montarCadeia('cancelada');

  terminoDoAtivo = await ativarContrato(ativa.contratoCodigo);
  await ativarContrato(cancelada.contratoCodigo);
  await cancelarContrato(cancelada.contratoCodigo);

  ontem = await dataDeslocada(-1);
  hoje = await dataDeslocada(0);
  amanha = await dataDeslocada(1);

  cobrancaDeOntem = await lancarCobranca(ativa.contratoCodigo, ontem, 'Parcela vencida ontem');
  cobrancaDeHoje = await lancarCobranca(ativa.contratoCodigo, hoje, 'Parcela que vence hoje');
  cobrancaDeAmanha = await lancarCobranca(ativa.contratoCodigo, amanha, 'Parcela que vence amanhã');
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

describe('os recortes de listagem na borda (intervenção de 2026-09-05)', () => {
  it(
    'CT-1265 — ?status= devolve exatamente os contratos do estado, com o total do recorte',
    async () => {
      // --- Passo 1: a carteira SEM filtro — o controle que impede o par de passar por vacuidade --
      const carteiraInteira = await lerContratos(cookieDeA, '');

      expect(carteiraInteira.total).toBe(3);
      expect(
        carteiraInteira.itens.map((item) => item.codigo).sort((a, b) => a.localeCompare(b)),
      ).toEqual(
        [emRascunho.contratoCodigo, ativa.contratoCodigo, cancelada.contratoCodigo].sort((a, b) =>
          a.localeCompare(b),
        ),
      );

      // --- Passo 2: cada estado devolve EXATAMENTE o seu ----------------------------------------
      //
      // O esperado é escrito por estado, e não derivado da resposta: derivá-lo faria a asserção
      // concordar com o que quer que a rota tenha devolvido.
      const ESPERADO_POR_ESTADO: Readonly<Record<EstadoDoContrato, readonly string[]>> = {
        RASCUNHO: [emRascunho.contratoCodigo],
        ATIVO: [ativa.contratoCodigo],
        CANCELADO: [cancelada.contratoCodigo],
        // Sem produtor nesta montagem: `ENCERRADO` é escrito pela rotina agendada da F5. O conjunto
        // vazio aqui é afirmação sobre o predicado, e os três de cima são o controle positivo que
        // impede "vazio" de ser o resultado de um filtro que nunca casa nada.
        ENCERRADO: [],
      };

      let somaDosRecortes = 0;

      for (const estado of ESTADOS_DO_CONTRATO) {
        const pagina = await lerContratos(cookieDeA, `?status=${estado}`);
        const esperado = ESPERADO_POR_ESTADO[estado];

        expect(pagina.itens.map((item) => item.codigo)).toEqual([...esperado]);
        expect(pagina.total).toBe(esperado.length);

        // Todo item devolvido de fato carrega o estado pedido — a asserção que pega um predicado
        // que casasse o parâmetro errado e ainda assim devolvesse uma lista do tamanho esperado.
        for (const item of pagina.itens) {
          expect(item.status).toBe(estado);
        }

        somaDosRecortes += pagina.total;
      }

      // --- Passo 3: a soma dos quatro recortes é a carteira inteira ------------------------------
      expect(somaDosRecortes).toBe(carteiraInteira.total);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1266 — ?fimDe=/?fimAte= é inclusiva nas duas pontas, e o rascunho nunca entra',
    async () => {
      // O término é o que a **ativação derivou**, lido da resposta dela — nunca composto aqui.
      expect(terminoDoAtivo).toMatch(/^\d{4}-\d{2}-\d{2}$/u);

      // --- Passo 1: a janela de UM DIA sobre o término -------------------------------------------
      //
      // É a fronteira que discrimina inclusivo de estrito: com `>` e `<` no predicado, este conjunto
      // seria vazio. E é o caso de uso real — "termina hoje".
      //
      // ⚠️ O conjunto esperado tem **dois** contratos, e não um: o cancelado foi ativado com os
      // mesmos termos, de modo que a ativação derivou o mesmo término — e o cancelamento **não
      // desfaz** as derivações (elas descrevem o que o contrato foi enquanto valeu). É a janela
      // sendo **ortogonal ao estado**, que é a propriedade que o passo 5 exercita por composição.
      const deUmDia = await lerContratos(
        cookieDeA,
        `?fimDe=${terminoDoAtivo}&fimAte=${terminoDoAtivo}`,
      );
      expect(deUmDia.itens.map((item) => item.codigo).sort((a, b) => a.localeCompare(b))).toEqual(
        [ativa.contratoCodigo, cancelada.contratoCodigo].sort((a, b) => a.localeCompare(b)),
      );
      expect(deUmDia.total).toBe(2);

      // --- Passo 2: cada ponta sozinha ----------------------------------------------------------
      const daquiParaFrente = await lerContratos(cookieDeA, `?fimDe=${terminoDoAtivo}`);
      expect(daquiParaFrente.itens.map((item) => item.codigo)).toContain(ativa.contratoCodigo);
      expect(daquiParaFrente.total).toBeGreaterThan(0);

      const ateAqui = await lerContratos(cookieDeA, `?fimAte=${terminoDoAtivo}`);
      expect(ateAqui.itens.map((item) => item.codigo)).toContain(ativa.contratoCodigo);

      // --- Passo 3: a janela ANTERIOR ao término não o alcança -----------------------------------
      //
      // O par com o passo 1 é o que prova que o predicado **compara**, em vez de ignorar as pontas.
      const anterior = await lerContratos(cookieDeA, '?fimDe=1900-01-01&fimAte=1900-12-31');
      expect(anterior.itens).toEqual([]);
      expect(anterior.total).toBe(0);

      // --- Passo 4: o RASCUNHO não entra nem na janela mais larga --------------------------------
      //
      // `dataFimLocacao` é nulo enquanto o contrato não foi ativado, e comparação com nulo não é
      // verdadeira. O controle é a carteira sem filtro, onde ele aparece.
      const semFiltro = await lerContratos(cookieDeA, '');
      expect(semFiltro.itens.map((item) => item.codigo)).toContain(emRascunho.contratoCodigo);

      const maisLarga = await lerContratos(cookieDeA, '?fimDe=1900-01-01&fimAte=2999-12-31');
      expect(maisLarga.itens.map((item) => item.codigo)).not.toContain(emRascunho.contratoCodigo);
      expect(maisLarga.itens.map((item) => item.codigo)).toContain(ativa.contratoCodigo);

      // E o item que a janela devolve declara o término que ela recortou — sem isso, um predicado
      // sobre a coluna errada devolveria o conjunto certo por acaso.
      const doAtivo = maisLarga.itens.find((item) => item.codigo === ativa.contratoCodigo);
      expect(doAtivo?.dataFimLocacao).toBe(terminoDoAtivo);

      // --- Passo 5: os DOIS eixos COMPÕEM, por conjunção -----------------------------------------
      //
      // A mesma janela do passo 1, agora com o estado: o conjunto encolhe de dois para um. Só o
      // passo 1 seria satisfeito por um predicado que ignorasse `status`; só este, por um que
      // ignorasse as pontas. É o par que fixa a conjunção.
      const ativosQueTerminamNoDia = await lerContratos(
        cookieDeA,
        `?status=ATIVO&fimDe=${terminoDoAtivo}&fimAte=${terminoDoAtivo}`,
      );
      expect(ativosQueTerminamNoDia.itens.map((item) => item.codigo)).toEqual([
        ativa.contratoCodigo,
      ]);
      expect(ativosQueTerminamNoDia.total).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1267 — o item da carteira traz os três nomes, e a leitura por código NÃO os traz',
    async () => {
      // --- Passo 1: os três nomes são os dos cadastros que a montagem criou ----------------------
      const carteira = await lerContratos(cookieDeA, '');
      const item = carteira.itens.find((linha) => linha.codigo === ativa.contratoCodigo);

      expect(item).toBeDefined();
      expect({
        nomeImovel: item?.nomeImovel,
        nomeLocador: item?.nomeLocador,
        nomeLocatario: item?.nomeLocatario,
      }).toEqual({
        nomeImovel: ativa.nomeImovel,
        nomeLocador: ativa.nomeLocador,
        nomeLocatario: ativa.nomeLocatario,
      });

      // E **todo** item da página os traz preenchidos: um agregado montado só para a primeira linha
      // passaria na asserção acima e deixaria as demais com o cartão vazio.
      for (const linha of carteira.itens) {
        expect(linha.nomeImovel.length).toBeGreaterThan(0);
        expect(linha.nomeLocador.length).toBeGreaterThan(0);
        expect(linha.nomeLocatario.length).toBeGreaterThan(0);
      }

      // --- Passo 2: os identificadores CONTINUAM no corpo ----------------------------------------
      //
      // O nome é para exibir; o identificador, para navegar. Trocar um pelo outro faria o cartão
      // deixar de ter para onde clicar, e é a troca que uma "simplificação" faria sem que nada
      // acusasse.
      //
      // Os três são afirmados por **igualdade exata**, e não por tipo: `typeof … === 'string'` não
      // distingue uma troca entre `locadorId` e `locatarioId` — nem um UUID de outro cadastro — do
      // valor correto, e é justamente essa troca que este passo existe para pegar.
      expect(item?.imovelId).toBe(ativa.imovelId);
      expect(item?.locadorId).toBe(ativa.locadorId);
      expect(item?.locatarioId).toBe(ativa.locatarioId);
      // E as duas partes são **distintas entre si** no arranjo: sem isto, uma implementação que
      // publicasse o mesmo identificador nos dois campos satisfaria as duas igualdades acima.
      expect(ativa.locadorId).not.toBe(ativa.locatarioId);

      // --- Passo 3: a leitura por CÓDIGO não traz os três ---------------------------------------
      //
      // A assimetria é publicada e deliberada. Sem esta metade, levar os nomes às outras sete rotas
      // — pagando a junção em todo ato de escrita — passaria despercebido.
      const resposta = await pedir(base, `${COLECAO_DE_CONTRATOS}/${ativa.contratoCodigo}`, {
        cookie: cookieDeA,
      });

      expect(resposta.status).toBe(200);

      const contrato = resposta.corpo as Contrato & Record<string, unknown>;

      expect(contrato.codigo).toBe(ativa.contratoCodigo);
      for (const nome of ['nomeImovel', 'nomeLocador', 'nomeLocatario']) {
        expect(Object.keys(contrato)).not.toContain(nome);
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1268 — ?statusLocacao= alcança LOCADO e recorta exatamente a situação pedida',
    async () => {
      // --- Passo 1: a carteira sem filtro -------------------------------------------------------
      const carteiraInteira = await lerImoveis(cookieDeA, '');
      expect(carteiraInteira.total).toBe(3);

      // --- Passo 2: `LOCADO` é o imóvel do contrato ATIVO ----------------------------------------
      //
      // A situação foi escrita pela **ativação**, e não por este caso: é o estado que a entrada de
      // imóvel recusa, e o único que a tela quer contar. Um filtro que lesse `SITUACOES_INFORMAVEIS`
      // responderia `422` aqui.
      const locados = await lerImoveis(cookieDeA, '?statusLocacao=LOCADO');

      expect(locados.itens.map((imovel) => imovel.id)).toEqual([ativa.imovelId]);
      expect(locados.total).toBe(1);
      for (const imovel of locados.itens) {
        expect(imovel.statusLocacao).toBe('LOCADO');
      }

      // --- Passo 3: a soma das três situações é a carteira inteira -------------------------------
      let soma = 0;

      for (const situacao of SITUACOES_DE_LOCACAO) {
        const pagina = await lerImoveis(cookieDeA, `?statusLocacao=${situacao}`);

        for (const imovel of pagina.itens) {
          expect(imovel.statusLocacao).toBe(situacao);
        }

        expect(pagina.total).toBe(pagina.itens.length);
        soma += pagina.total;
      }

      expect(soma).toBe(carteiraInteira.total);

      // --- Passo 4: o imóvel do contrato ativo NÃO aparece como disponível -----------------------
      const disponiveis = await lerImoveis(cookieDeA, '?statusLocacao=DISPONIVEL');
      expect(disponiveis.itens.map((imovel) => imovel.id)).not.toContain(ativa.imovelId);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1269 — a janela de vencimento recorta a data gravada e COMPÕE com o estado',
    async () => {
      // --- Passo 1: as três datas são distintas — sanidade do arranjo ---------------------------
      expect(new Set([ontem, hoje, amanha]).size).toBe(3);

      // --- Passo 2: "vencem hoje" ---------------------------------------------------------------
      //
      // A janela de um dia é a fronteira e é o indicador que motivou o pedido: com `>` e `<` no
      // predicado, este conjunto seria vazio.
      const deHoje = await lerCobrancas(cookieDeA, `?vencimentoDe=${hoje}&vencimentoAte=${hoje}`);

      expect(deHoje.itens.map((cobranca) => cobranca.codigo)).toEqual([cobrancaDeHoje]);
      expect(deHoje.total).toBe(1);
      expect(deHoje.itens[0]?.dataVencimento).toBe(hoje);

      // --- Passo 3: cada ponta sozinha ----------------------------------------------------------
      const daquiParaFrente = await lerCobrancas(cookieDeA, `?vencimentoDe=${hoje}`);
      expect(
        daquiParaFrente.itens.map((cobranca) => cobranca.codigo).sort((a, b) => a.localeCompare(b)),
      ).toEqual([cobrancaDeHoje, cobrancaDeAmanha].sort((a, b) => a.localeCompare(b)));

      const ateAqui = await lerCobrancas(cookieDeA, `?vencimentoAte=${hoje}`);
      expect(
        ateAqui.itens.map((cobranca) => cobranca.codigo).sort((a, b) => a.localeCompare(b)),
      ).toEqual([cobrancaDeOntem, cobrancaDeHoje].sort((a, b) => a.localeCompare(b)));

      // --- Passo 4: a janela COMPÕE com o estado, e não o substitui ------------------------------
      //
      // ⚠️ A cobrança que vence **hoje** ainda não está vencida — a visão compara `data_vencimento`
      // com a data corrente da operação —, e é isso que torna os dois eixos irredutíveis um ao
      // outro. As duas asserções abaixo são o par: a primeira mostra que a janela de hoje não é o
      // mesmo que o recorte por estado; a segunda, que os dois se compõem por conjunção.
      const vencidasAteHoje = await lerCobrancas(
        cookieDeA,
        `?status=VENCIDA&vencimentoAte=${hoje}`,
      );
      expect(vencidasAteHoje.itens.map((cobranca) => cobranca.codigo)).toEqual([cobrancaDeOntem]);
      expect(vencidasAteHoje.total).toBe(1);

      const aVencerAteHoje = await lerCobrancas(
        cookieDeA,
        `?status=A_VENCER&vencimentoAte=${hoje}`,
      );
      expect(aVencerAteHoje.itens.map((cobranca) => cobranca.codigo)).toEqual([cobrancaDeHoje]);
      expect(aVencerAteHoje.total).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1270 — as recusas respondem 422 com o corpo inteiro por igualdade, nomeando o parâmetro',
    async () => {
      const RECUSAS: readonly {
        readonly rotulo: string;
        readonly alvo: string;
        readonly campo: string;
      }[] = [
        {
          rotulo: 'estado de contrato fora da união fechada',
          alvo: `${COLECAO_DE_CONTRATOS}?status=VIGENTE`,
          campo: 'status',
        },
        {
          rotulo: 'janela de término invertida',
          alvo: `${COLECAO_DE_CONTRATOS}?fimDe=2026-12-31&fimAte=2026-01-01`,
          campo: 'fimDe',
        },
        {
          rotulo: 'data de término que não existe no calendário',
          alvo: `${COLECAO_DE_CONTRATOS}?fimAte=2026-02-30`,
          campo: 'fimAte',
        },
        {
          rotulo: 'situação de locação fora da união fechada',
          alvo: `${COLECAO_DE_IMOVEIS}?statusLocacao=VAGO`,
          campo: 'statusLocacao',
        },
        {
          rotulo: 'janela de vencimento invertida',
          alvo: `${COLECAO_DE_COBRANCAS}?vencimentoDe=2026-12-31&vencimentoAte=2026-01-01`,
          campo: 'vencimentoDe',
        },
        {
          rotulo: 'data de vencimento que não existe no calendário',
          alvo: `${COLECAO_DE_COBRANCAS}?vencimentoDe=2026-02-30`,
          campo: 'vencimentoDe',
        },
      ];

      for (const { rotulo, alvo, campo } of RECUSAS) {
        const resposta = await pedir(base, alvo, { cookie: cookieDeA });

        expect(resposta.status, rotulo).toBe(422);
        expect(resposta.corpo, rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo,
        });
      }

      // A chave desconhecida é recusada **nomeando a própria chave**, que é o que a §6.2 do
      // `handoff-frontend.md` publica (*"`limite=50&ordenar=nome` é `422`, com `campo: \"ordenar\"`"*).
      // É o par que separa *"o parâmetro que você inventou não existe"* de *"o seu `limite` está
      // errado"* — os dois são `422 CAMPO_INVALIDO`, e sem o nome da chave o cliente não tem como
      // distinguir os diagnósticos.
      //
      // SUT_IS_CORRECT_BECAUSE: esta expectativa nasceu, em 2026-09-05, fixando `campo: 'limite'` —
      // o campo padrão do ponto de chamada. Ela descrevia o comportamento **medido**, e o
      // comportamento é que divergia do contrato publicado em cinco lugares (§6.1, §6.2, as duas
      // fixtures da §20 e o teste mínimo 15 da §21). O conserto é de produção, em
      // `comum/validacao.ts`; nenhuma asserção foi afrouxada, e o corpo segue comparado INTEIRO.
      const desconhecida = await pedir(base, `${COLECAO_DE_CONTRATOS}?statusDoContrato=ATIVO`, {
        cookie: cookieDeA,
      });

      expect(desconhecida.status).toBe(422);
      expect(desconhecida.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'statusDoContrato',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1271 — com os recortes ligados, a sessão de B não alcança nada de A',
    async () => {
      // O controle positivo: sob A, os três recortes devolvem conjunto NÃO vazio. Sem ele, "B não vê
      // nada" seria satisfeito por três rotas quebradas.
      const contratosDeA = await lerContratos(cookieDeA, '?status=ATIVO');
      const imoveisDeA = await lerImoveis(cookieDeA, '?statusLocacao=LOCADO');
      const cobrancasDeA = await lerCobrancas(cookieDeA, `?vencimentoAte=${hoje}`);

      expect(contratosDeA.total).toBeGreaterThan(0);
      expect(imoveisDeA.total).toBeGreaterThan(0);
      expect(cobrancasDeA.total).toBeGreaterThan(0);

      // E os MESMOS pedidos sob B devolvem o vazio — `200`, nunca `403`: a empresa de B existe e a
      // carteira dela é que está vazia.
      const contratosDeB = await lerContratos(cookieDeB, '?status=ATIVO');
      const imoveisDeB = await lerImoveis(cookieDeB, '?statusLocacao=LOCADO');
      const cobrancasDeB = await lerCobrancas(cookieDeB, `?vencimentoAte=${hoje}`);

      expect({ itens: contratosDeB.itens, total: contratosDeB.total }).toEqual({
        itens: [],
        total: 0,
      });
      expect({ itens: imoveisDeB.itens, total: imoveisDeB.total }).toEqual({ itens: [], total: 0 });
      expect({ itens: cobrancasDeB.itens, total: cobrancasDeB.total }).toEqual({
        itens: [],
        total: 0,
      });
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios do arranjo — todos pelas ROTAS reais, exceto o relógio do banco
// ---------------------------------------------------------------------------

/** Lê a carteira de contratos com a cadeia de consulta declarada. A falha levanta. */
async function lerContratos(credencial: string, consulta: string): Promise<PaginaPublicada> {
  const resposta = await pedir(base, `${COLECAO_DE_CONTRATOS}${consulta}`, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a listagem de contratos${consulta} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as PaginaPublicada;
}

/** Lê a carteira de imóveis com a cadeia de consulta declarada. A falha levanta. */
async function lerImoveis(credencial: string, consulta: string): Promise<PaginaDeImoveisPublicada> {
  const resposta = await pedir(base, `${COLECAO_DE_IMOVEIS}${consulta}`, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a listagem de imóveis${consulta} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as PaginaDeImoveisPublicada;
}

/** Lê a carteira de cobranças com a cadeia de consulta declarada. A falha levanta. */
async function lerCobrancas(
  credencial: string,
  consulta: string,
): Promise<PaginaDeCobrancasPublicada> {
  const resposta = await pedir(base, `${COLECAO_DE_COBRANCAS}${consulta}`, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a listagem de cobranças${consulta} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as PaginaDeCobrancasPublicada;
}

/**
 * Monta conjunto, imóvel, locador, locatário e contrato **pelas rotas**, e devolve os nomes.
 *
 * Os três nomes são compostos **uma vez** e devolvidos ao caso: redigitá-los na asserção faria a
 * suíte comparar duas escritas do mesmo literal, e a igualdade passaria mesmo se a rota devolvesse
 * um nome que não veio do cadastro.
 *
 * `gerarCobrancasAutomaticamente: false` é conteúdo, e não conveniência: a ativação com `true`
 * derivaria as parcelas do contrato inteiro, e o `CT-1269` precisa de **três** cobranças
 * identificáveis, com vencimentos que ele mesmo escolheu.
 */
async function montarCadeia(marca: string): Promise<CadeiaMontada> {
  const conjuntoId = (
    await criarPorRota(CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${marca} ${String(proximo())}` })
  ).id;

  const imovel = corpoDeImovel(conjuntoId, marca);
  const imovelId = (await criarPorRota(CAMINHO_DOS_IMOVEIS, imovel)).id;

  const locador = corpoDePessoa(`Locador ${marca}`);
  const locadorId = (await criarPorRota(CAMINHO_DOS_LOCADORES, locador)).id;

  const locatario = corpoDePessoa(`Locatário ${marca}`);
  const locatarioId = (await criarPorRota(CAMINHO_DOS_LOCATARIOS, locatario)).id;

  const contrato = await criarPorRota(CAMINHO_DOS_CONTRATOS, {
    imovelId,
    locadorId,
    locatarioId,
    fiadoresIds: [],
    dataInicioLocacao: '2026-01-10',
    prazoMeses: 30,
    valorMensal: VALOR_DA_PARCELA,
    diaVencimento: 10,
    gerarCobrancasAutomaticamente: false,
  });

  const contratoCodigo = (contrato as unknown as { codigo?: string }).codigo;

  if (contratoCodigo === undefined) {
    throw new Error('a montagem do contrato não devolveu código legível');
  }

  return {
    contratoCodigo,
    imovelId,
    locadorId,
    locatarioId,
    nomeImovel: imovel['nomeImovel'] as string,
    nomeLocador: locador['nome'] as string,
    nomeLocatario: locatario['nome'] as string,
  };
}

/** Ativa o contrato pela rota real e devolve o término **derivado** pelo servidor. */
async function ativarContrato(codigo: string): Promise<string> {
  const resposta = await pedir(base, `${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
    metodo: 'POST',
    cookie: cookieDeA,
    corpo: {},
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a ativação de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  const publicado = resposta.corpo as { dataFimLocacao?: string | null };

  if (typeof publicado.dataFimLocacao !== 'string') {
    throw new Error(`a ativação de ${codigo} não derivou a data de fim da locação`);
  }

  return publicado.dataFimLocacao;
}

/** Cancela o contrato pela rota real. A falha levanta. */
async function cancelarContrato(codigo: string): Promise<void> {
  const resposta = await pedir(base, `${COLECAO_DE_CONTRATOS}/${codigo}/cancelamento`, {
    metodo: 'POST',
    cookie: cookieDeA,
    corpo: {},
  });

  if (resposta.status !== 200) {
    throw new Error(
      `o cancelamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Lança uma cobrança avulsa pela rota real e devolve o código emitido. */
async function lancarCobranca(
  contratoCodigo: string,
  dataVencimento: string,
  referencia: string,
): Promise<string> {
  const cobranca = await criarPorRota(CAMINHO_DAS_COBRANCAS, {
    contratoCodigo,
    natureza: 'ALUGUEL',
    referencia,
    competencia: `${dataVencimento.slice(0, 7)}-01`,
    dataVencimento,
    valorOriginal: VALOR_DA_PARCELA,
  });

  const codigo = (cobranca as unknown as { codigo?: string }).codigo;

  if (codigo === undefined) {
    throw new Error('o lançamento da cobrança não devolveu código legível');
  }

  return codigo;
}

/** Cria um recurso pela rota real e devolve o corpo publicado. A falha levanta. */
async function criarPorRota(dono: string, corpo: Record<string, unknown>): Promise<{ id: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}`;
  const resposta = await pedir(base, alvo, { metodo: 'POST', cookie: cookieDeA, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as { id: string };
}

/** O corpo completo de um imóvel, com o identificador municipal único por construção. */
function corpoDeImovel(conjuntoId: string, marca: string): Record<string, unknown> {
  const sufixo = String(proximo()).padStart(6, '0');

  return {
    conjuntoId,
    nomeImovel: `Ap ${marca} ${sufixo}`,
    identificadorMunicipal: `IM-${sufixo}`,
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

/** O corpo completo de um cadastro de pessoa, com documento e endereço de contato únicos. */
function corpoDePessoa(nome: string): Record<string, unknown> {
  const numero = proximo();
  const sufixo = String(numero).padStart(6, '0');

  return {
    nome: `${nome} ${sufixo}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(numero),
    rg: null,
    email: `parte.${sufixo}@exemplo.com.br`,
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
 * A data corrente da operação deslocada em `dias` — lida do **relógio do banco** (ADR-0026).
 *
 * É o mesmo eixo com que a visão da cobrança classifica a linha, e é o que permite o `CT-1269`
 * afirmar a composição da janela com o estado sem depender do fuso de quem executa a suíte.
 */
// ⚠️ Cópia privada de `dataDeslocada`, como a da suíte irmã de `packages/db/test/` — a razão de não
// promovê-la nesta intervenção está por extenso lá, e **só lá**.
async function dataDeslocada(dias: number): Promise<string> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

/** Abre uma unidade de trabalho sob o contexto de A — usada só para ler o relógio do banco. */
async function emUnidade<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
}
