/**
 * A **equivalência com o oráculo** — T11 da fatia `regua-de-cobranca`: os dez vereditos escritos
 * antes da execução, e a única divergência contra o sistema antigo ancorada no artefato golden.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-09 | CT-636 | Semeados os dez cenários de referência com a configuração equivalente, o número
 * | CA-06 |        | de mensagens que o produto entrega em cada um, pelos **dois** caminhos, é
 * | CA-07 |        | exatamente o declarado em {@link VEREDITOS_DO_PRODUTO} — a tabela inteira, por
 * | CA-08 |        | igualdade de objeto. Em particular: REG-01 automático `1` (a falha de ontem não
 * | CA-16 |        | trava, RD-05), REG-08 manual `0` (a divergência por vitória) e REG-06, REG-07 e
 * |       |        | REG-09 zerados nos dois caminhos. |
 * | CA-09 | CT-637 | Comparada a tabela do produto medida pelo CT-636 contra a do oráculo — esta
 * |       |        | **lida** de `retorno.divergencia_de_estado` do `regua-de-cobranca.json`, nunca
 * |       |        | redigitada —, a projeção do golden tem **10** cenários e o conjunto de pares
 * |       |        | (cenário, caminho) divergentes é **estritamente** `[('REG-08','manual')]`. Naquele
 * |       |        | par o oráculo vale `1` e o produto vale `0`; as outras dezenove células coincidem. |
 *
 * Rastreabilidade: `CA-09 → CT-636 (RD-05)` · `CA-08 → CT-636 (RD-02)` · `CA-16 → CT-636 (RD-11)` ·
 * `CA-09 → CT-637 (RD-02)`.
 *
 * ===========================================================================
 * AS DUAS SEPARAÇÕES SEM AS QUAIS ESTA PROVA CONCORDA CONSIGO MESMA
 * ===========================================================================
 *
 * Uma prova de equivalência é o lugar clássico onde uma suíte passa a provar nada, e o modo de falha
 * é silencioso: ela fica **verde para sempre**, porque os dois lados da comparação saíram da mesma
 * cabeça. As duas separações que a tornam honesta são:
 *
 * 1. **O lado do PRODUTO é constante literal declarada ANTES do `it`.** {@link VEREDITOS_DO_PRODUTO}
 *    é o *expected*, e vem da §21.2 do tech spec — escrita antes de existir código para medir. Ela
 *    **não se ajusta**: se a equivalência reprovar, o que está errado é o produto (§7 da task).
 * 2. **O lado do ORÁCULO é LIDO do artefato golden**, campo a campo, e não redigitado aqui. É o
 *    Gate 6: o *expected* do lado antigo vem de **fonte externa verificável**, versionada em
 *    `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`. Editar o golden muda o que este
 *    arquivo afirma — que é exatamente a propriedade desejada: ele é **fonte**, não cópia.
 *
 * Sem a segunda, o CT-636 provaria apenas que o produto concorda com uma tabela escrita por quem
 * escreveu o produto. É por isso que o CT-637 existe, e por isso que **nenhum número do golden
 * aparece escrito neste arquivo** — salvo o único par divergente, que é a asserção.
 *
 * ===========================================================================
 * O MAPEAMENTO DA CONFIGURAÇÃO — "equivalente" não é óbvio, e já estava resolvido
 * ===========================================================================
 *
 * O legado tem **sete** campos e **duas trilhas** (uma *a vencer*, outra *vencida*); o produto tem
 * **seis** e trilha única, por decisão do PRD (RN-04). Reconstruir esse mapeamento na hora de
 * escrever o caso seria adivinhação — ele está resolvido na §21.2 do tech spec, e o que dele resulta
 * é {@link POLITICA_EQUIVALENTE}: `intervalo_dias_vencida: "2"` é o valor que discrimina (os três
 * cenários com histórico decisivo são `VENCIDA`); `intervalo_dias_a_vencer` e `nao_enviar_a_vencer`
 * **colapsam** por não discriminarem cenário nenhum; e `horario_*: "00:00:00"` vira a janela
 * `00:00`–`23:59`, que é a que **nunca fecha** no produto.
 *
 * ⚠️ **A trava do legado é chaveada por trilha, e a do produto não — e isso NÃO é a 11ª
 * divergência.** O par `prefixo_legado_conta_para_vencida` / `prefixo_legado_nao_conta_para_a_vencer`
 * de `retorno.intervalo` é consequência direta das duas trilhas e some com elas: os dois casos são
 * **função**, não cenário, e nenhum dos dez REG os exercita nas duas trilhas ao mesmo tempo. Este
 * arquivo compara os **dez cenários**, e não as seis linhas de `retorno.intervalo`. **Não tente
 * reproduzir o prefixo** — reproduzi-lo reintroduziria o defeito de *"dois lugares decidem o mesmo
 * fato"* que a fatia existe para fechar.
 *
 * ===========================================================================
 * AS DUAS TRADUÇÕES OBRIGATÓRIAS, e por que elas não afrouxam a comparação
 * ===========================================================================
 *
 *   * **REG-09** — o legado tem cobrança **sem locatário**; no produto isso é irrepresentável
 *     (`cobranca → contrato → locatario`, todos `NOT NULL`). O equivalente mais próximo é
 *     **locatário sem endereço de contato**, semeado pelo caminho do CT-619
 *     ({@link semearLocatarioSemContato}) — que também é irrepresentável pela borda (`email` é
 *     `NOT NULL` e `esquemaDePessoaNova` exige `z.email()`), de modo que a RD-11 é guarda contra dado
 *     que só chega por migração do legado.
 *   * **REG-07** — o legado resolve o molde `Fechada` no automático e `Vencida` no manual, e **não
 *     envia** por nenhum dos dois. A divergência é de **template**, não de efeito, e o produto não a
 *     reproduz porque não tem o conceito. A equivalência é afirmada sobre o **efeito** (`0` → `0`),
 *     que é o que a CA-09 mede.
 *
 * O golden é o registro do que existia, **não uma exigência de igualdade de bytes**: duas divergências
 * de forma na mensagem são deliberadas (`<br>` e `Boleto indisponivel`), e o que se compara aqui é
 * **quantas mensagens saem**.
 *
 * ===========================================================================
 * COMO CADA LADO É MEDIDO — e por que a ordem das duas passagens é conteúdo
 * ===========================================================================
 *
 * O **automático** roda primeiro, por `executarReguaDaEmpresa` com as **portas reais** do banco (o
 * predicado, o registro e a leitura da política), no mesmo desenho de borda que
 * `packages/db/test/execucao-da-regua.spec.ts` usa e que o job da T8 monta. O **manual** roda depois,
 * cenário a cenário, pela **rota real** de disparo, contra a aplicação com a porta de e-mail
 * substituída de fora.
 *
 * Entre as duas, o histórico é **restaurado ao declarado**: a passagem automática grava tentativas
 * `ENVIADA`, e a trava do predicado conta tentativa de qualquer caminho — deixá-las de pé faria o
 * manual medir um cenário diferente do que a tabela declara. A restauração é afirmada pela contagem
 * crua, e não presumida.
 *
 * Um `500` produziria **zero mensagens** e passaria despercebido em REG-06, REG-07 e REG-08, que são
 * justamente os cenários de recusa — por isso {@link RESPOSTAS_DO_DISPARO_MANUAL} é uma segunda
 * tabela declarada antes da execução, e ela é o que separa *"recusou"* de *"quebrou"*.
 *
 * ===========================================================================
 * ESTA TASK NÃO ACRESCENTA CÓDIGO DE PRODUÇÃO
 * ===========================================================================
 *
 * Nenhum símbolo nasce para o teste enxergar algo. Os estados terminais são alcançados pelas **rotas
 * reais** de pagamento e cancelamento — nunca escrevendo estado, que não existe como coluna (é
 * derivado por `negocio.cobranca_derivada`, ADR-0022) —, os vencimentos saem de
 * `negocio.data_corrente_da_operacao()` por deslocamento, e as duas precondições que porta alguma
 * sabe montar (a tentativa datada no passado e o cadastro sem contato) descem ao SQL e ao acessório
 * do CT-619, exatamente como os arquivos análogos já fazem.
 *
 * De onde vêm o banco, a fila e a credencial: de instâncias efêmeras próprias (ADR-0006). Nenhuma
 * coordenada de conexão é lida do ambiente, e o **oráculo é o artefato versionado** — nunca o sistema
 * antigo em execução.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  type DadosDaPessoa,
  EMPRESA_A,
  lerHoraCorrenteDaOperacao,
  lerPoliticaDeAviso,
  registrarEnvioDeCobranca,
  SENHA_DA_CARGA,
  selecionarCandidatasAoAviso,
} from '@sysloc/db';
import {
  type CapturadorDeEmail,
  criarCapturadorDeEmail,
  executarReguaDaEmpresa,
  type ResultadoDaRegua,
} from '@sysloc/regua';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth`, de `@sysloc/db` e de
//        `@sysloc/shared` por CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos.
//        As dependências de workspace estão declaradas, então não há dependência oculta; o que não
//        existe é FRONTEIRA para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de três pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { semearLocatarioSemContato } from '../../../packages/db/test/banco-efemero.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DA_AUTOMACAO_DE_COBRANCA } from '../src/automacao/automacao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_PORTA_DE_EMAIL,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { montarAplicacaoInstrumentada } from './aplicacao-instrumentada.ts';
import { cpfValido } from './documento.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco migrado, fila, semente e a aplicação instrumentada leva dezenas de segundos. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** O CT-636 monta dois contratos, dez cobranças e atravessa HTTP e banco algumas dezenas de vezes. */
const LIMITE_CASO_MS = 300_000;

// ===========================================================================
// O LADO DO PRODUTO — declarado ANTES da execução, e jamais ajustado a ela
// ===========================================================================

/**
 * Os dez cenários de referência, na ordem do oráculo.
 *
 * A lista é a **fonte** da identidade dos cenários: as tabelas abaixo e a projeção do golden são
 * conferidas contra ela, de modo que um cenário que suma de um dos lados apareça como divergência de
 * conjunto, e não como comparação silenciosa entre conjuntos diferentes.
 */
const CENARIOS = [
  'REG-01',
  'REG-02',
  'REG-03',
  'REG-04',
  'REG-05',
  'REG-06',
  'REG-07',
  'REG-08',
  'REG-09',
  'REG-10',
] as const;

/** Um dos dez cenários — derivado da lista acima, nunca redigitado. */
type Cenario = (typeof CENARIOS)[number];

/** Os dois caminhos comparados, na ordem em que a divergência é procurada. */
const CAMINHOS = ['automatico', 'manual'] as const;

/** Um dos dois caminhos — derivado da lista acima. */
type CaminhoComparado = (typeof CAMINHOS)[number];

/** Quantas mensagens saem por cenário, em cada caminho. */
interface Veredito {
  readonly automatico: number;
  readonly manual: number;
}

/**
 * **A TABELA DE VEREDITOS — o *expected* do lado do produto, escrito ANTES da execução.**
 *
 * Ela vem da §21.2 do tech spec, redigida antes de existir código para medir, e **não se ajusta ao
 * que o produto fizer**: ajustá-la para o medido é fraude de gate, porque a asserção passaria a
 * provar que o produto concorda consigo mesmo (§7 da task).
 *
 * Três números carregam a fatia inteira:
 *
 *   * **REG-01 automático `1`** — a tentativa em erro de ontem **não trava** o intervalo (RD-05). Uma
 *     rodada que "corrija" o predicado para a leitura literal da RN-06 faz este número virar `0`, e é
 *     aqui que ela é pega pela segunda vez (a primeira é o CT-611);
 *   * **REG-08 manual `0`** — a **divergência por vitória**: no legado, `emailer.is_cobranca_paga`
 *     conhece `Paga` e não conhece `Cancelada`, e o caminho manual cobra dívida cancelada. Aqui os
 *     dois caminhos leem a mesma fonte, onde `CANCELADA` tem precedência sobre tudo;
 *   * **REG-06, REG-07 e REG-09 zerados nos dois caminhos** — os dois primeiros por estado terminal,
 *     o terceiro por não haver para onde mandar, e nenhum dos três por falha.
 */
const VEREDITOS_DO_PRODUTO: Readonly<Record<Cenario, Veredito>> = {
  'REG-01': { automatico: 1, manual: 1 },
  'REG-02': { automatico: 0, manual: 1 },
  'REG-03': { automatico: 1, manual: 1 },
  'REG-04': { automatico: 0, manual: 1 },
  'REG-05': { automatico: 1, manual: 1 },
  'REG-06': { automatico: 0, manual: 0 },
  'REG-07': { automatico: 0, manual: 0 },
  'REG-08': { automatico: 0, manual: 0 },
  'REG-09': { automatico: 0, manual: 0 },
  'REG-10': { automatico: 0, manual: 1 },
};

/**
 * O **par divergente** que a fatia admite — e o único.
 *
 * Escrito por extenso porque é a **asserção** do CT-637, e não um dado de arranjo: os dois números
 * são o que se afirma sobre aquela célula, e o do oráculo é conferido contra o valor **lido** do
 * golden pela própria comparação — se o artefato mudar, esta linha deixa de bater.
 */
const DIVERGENCIA_ADMITIDA = {
  cenario: 'REG-08',
  caminho: 'manual',
  oraculo: 1,
  produto: 0,
} as const;

/**
 * O que a rota do disparo manual responde em cada cenário — a segunda tabela declarada.
 *
 * Ela existe porque *"zero mensagens"* é ambíguo: um `500` produziria zero, e passaria despercebido
 * exatamente nos três cenários de recusa. Com ela, `422` é afirmado como **recusa de negócio**, e
 * qualquer outra coisa reprova nomeando o cenário.
 */
const RESPOSTAS_DO_DISPARO_MANUAL: Readonly<Record<Cenario, number>> = {
  'REG-01': 200,
  'REG-02': 200,
  'REG-03': 200,
  'REG-04': 200,
  'REG-05': 200,
  'REG-06': 422,
  'REG-07': 422,
  'REG-08': 422,
  'REG-09': 200,
  'REG-10': 200,
};

/**
 * O resultado **inteiro** da passagem automática — quatro candidatas, três entregas, uma sem contato.
 *
 * Declarado ao lado dos vereditos porque é a outra metade do mesmo fato: as contagens por cenário
 * dizem quem recebeu, e este objeto diz o que a régua devolveu à borda do job, que é o que decide se
 * a fila repete. Uma passagem que entregasse as três mensagens certas e devolvesse contagem errada
 * passaria pela primeira asserção e reprovaria aqui.
 */
const RESULTADO_DA_PASSAGEM_AUTOMATICA: ResultadoDaRegua = {
  candidatas: 4,
  enviadas: 3,
  falhas: 0,
  semDestinatario: 1,
  houveFalha: false,
};

/**
 * A configuração **equivalente** à do oráculo — o mapeamento da §21.2, já resolvido.
 *
 * Ver o cabeçalho deste arquivo para o que colapsa e por quê. A janela `00:00`–`23:59` é a que nunca
 * fecha: `00:00`–`00:00` fecharia tudo menos um minuto.
 */
const POLITICA_EQUIVALENTE = {
  ativo: true,
  diasAntesDoVencimento: 10,
  intervaloMinimoDias: 2,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
} as const;

// ---------------------------------------------------------------------------
// O ARRANJO dos dez cenários — a entrada, também declarada antes da execução
// ---------------------------------------------------------------------------

/** O que fazer com a cobrança depois de lançada, para alcançar o estado do cenário. */
type Transicao = 'NENHUMA' | 'PAGAMENTO' | 'CANCELAMENTO';

/** Um cenário de referência: o deslocamento do vencimento, a transição e o estado que se espera. */
interface CenarioDeReferencia {
  readonly cenario: Cenario;
  /** Dias a somar à data corrente da operação — negativo produz `VENCIDA`. */
  readonly deslocamento: number;
  /** A rota real que leva ao estado terminal, quando há uma. */
  readonly transicao: Transicao;
  /** `true` no único cenário cujo locatário não tem endereço de contato (REG-09). */
  readonly semContato: boolean;
  /** O estado publicado que a precondição precisa alcançar — AFIRMADO, nunca presumido. */
  readonly estado: string;
}

/**
 * Os dez cenários do oráculo traduzidos para o produto (§3.3 da task, §21.2 do tech spec).
 *
 * REG-06 e REG-07 são **dois** cenários e não um: no legado, um tem `pagamento_confirmado` com status
 * `Pendente` e o outro tem status `Paga` — duas formas de dizer o mesmo no modelo antigo. No produto
 * as duas colapsam em `PAGA`, alcançada pela **rota real** de pagamento, e a distinção sobrevive nos
 * vencimentos, que são diferentes.
 */
const CENARIOS_DE_REFERENCIA: readonly CenarioDeReferencia[] = [
  {
    cenario: 'REG-01',
    deslocamento: 5,
    transicao: 'NENHUMA',
    semContato: false,
    estado: 'A_VENCER',
  },
  {
    cenario: 'REG-02',
    deslocamento: 40,
    transicao: 'NENHUMA',
    semContato: false,
    estado: 'A_VENCER',
  },
  {
    cenario: 'REG-03',
    deslocamento: -12,
    transicao: 'NENHUMA',
    semContato: false,
    estado: 'VENCIDA',
  },
  {
    cenario: 'REG-04',
    deslocamento: -20,
    transicao: 'NENHUMA',
    semContato: false,
    estado: 'VENCIDA',
  },
  {
    cenario: 'REG-05',
    deslocamento: -30,
    transicao: 'NENHUMA',
    semContato: false,
    estado: 'VENCIDA',
  },
  {
    cenario: 'REG-06',
    deslocamento: -8,
    transicao: 'PAGAMENTO',
    semContato: false,
    estado: 'PAGA',
  },
  {
    cenario: 'REG-07',
    deslocamento: -15,
    transicao: 'PAGAMENTO',
    semContato: false,
    estado: 'PAGA',
  },
  {
    cenario: 'REG-08',
    deslocamento: -25,
    transicao: 'CANCELAMENTO',
    semContato: false,
    estado: 'CANCELADA',
  },
  {
    cenario: 'REG-09',
    deslocamento: 3,
    transicao: 'NENHUMA',
    semContato: true,
    estado: 'A_VENCER',
  },
  {
    cenario: 'REG-10',
    deslocamento: -18,
    transicao: 'NENHUMA',
    semContato: false,
    estado: 'VENCIDA',
  },
];

/** Uma tentativa já registrada antes da passagem — a precondição que porta alguma sabe montar. */
interface HistoricoDeclarado {
  readonly cenario: Cenario;
  readonly desfecho: 'ENVIADA' | 'FALHOU';
  readonly diasAtras: number;
}

/**
 * Os quatro históricos de `entrada.historico_de_envio` traduzidos para o produto.
 *
 * O de REG-01 é o que discrimina a RD-05: no legado ele é `status: "Erro"`, aqui é `FALHOU` com causa
 * — e **não trava** o intervalo, que é por que REG-01 recebe `1` no automático. Os outros três são
 * entregas: as de `−1` travam o intervalo de dois dias, a de `−10` não.
 */
const HISTORICOS_DECLARADOS: readonly HistoricoDeclarado[] = [
  { cenario: 'REG-01', desfecho: 'FALHOU', diasAtras: 1 },
  { cenario: 'REG-04', desfecho: 'ENVIADA', diasAtras: 1 },
  { cenario: 'REG-05', desfecho: 'ENVIADA', diasAtras: 10 },
  { cenario: 'REG-10', desfecho: 'ENVIADA', diasAtras: 1 },
];

/** A causa gravada na tentativa em erro — o `CHECK` do banco exige causa em toda falha. */
const CAUSA_DA_FALHA_HERDADA = 'conexão recusada pelo transporte';

/** Quantas linhas o histórico declarado tem — afirmado antes e depois da restauração. */
const LINHAS_DO_HISTORICO_DECLARADO = HISTORICOS_DECLARADOS.length;

/**
 * Quantas linhas existem depois da passagem automática.
 *
 * As quatro declaradas mais uma por candidata: três `ENVIADA` e uma `SEM_DESTINATARIO`. É a contagem
 * crua que separa *"a régua entregou três mensagens"* de *"a régua registrou o que fez"*.
 */
const LINHAS_APOS_A_PASSAGEM_AUTOMATICA =
  LINHAS_DO_HISTORICO_DECLARADO + RESULTADO_DA_PASSAGEM_AUTOMATICA.candidatas;

// ===========================================================================
// O LADO DO ORÁCULO — LIDO do artefato golden, nunca redigitado
// ===========================================================================

/** A raiz da árvore versionada — o mesmo idioma de `apps/api/test/ambiente.spec.ts`. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * O artefato golden — o **oráculo** desta prova, capturado do sistema antigo na T1 desta fatia.
 *
 * Nenhuma alteração nele é permitida por esta fatia: ele é o registro do que existia, e o que este
 * arquivo faz é **lê-lo**. Ver a `PROCEDENCIA.md` ao lado dele para como foi capturado.
 */
const CAMINHO_DO_GOLDEN =
  'docs/specs/features/caracterizacao-regras-legadas/v1/golden/regua-de-cobranca.json';

/**
 * A forma do golden que esta prova consome — conferida, e não presumida.
 *
 * O esquema é permissivo quanto ao resto do artefato (que tem outros sete blocos) e **estrito quanto
 * ao que se lê**: se `divergencia_de_estado` sumir, mudar de nome ou trocar o tipo de um dos dois
 * contadores, a leitura levanta nomeando o caminho — em vez de projetar `undefined` e produzir uma
 * comparação que passa por acidente.
 */
const ESQUEMA_DO_ORACULO = z.object({
  retorno: z.object({
    divergencia_de_estado: z.array(
      z.object({
        name: z.string(),
        mensagens_automatico: z.number().int(),
        mensagens_manual: z.number().int(),
      }),
    ),
  }),
});

/**
 * Como o cenário é extraído do `name` do golden (`COB-CARACT-REG-08` → `REG-08`).
 *
 * O sufixo é **derivado** do artefato, e não uma lista de nomes escrita aqui: o que este arquivo
 * declara é a *forma* da chave, e os dez valores continuam vindo do disco.
 */
const CENARIO_NO_NOME = /REG-\d{2}$/u;

/**
 * Projeta `retorno.divergencia_de_estado` como {cenário → {automático, manual}}.
 *
 * **Este é o Gate 6 desta task**: os vinte números do lado antigo entram por aqui, do disco, e não
 * existe neste arquivo um literal que os repita. Um `name` fora do molde levanta — a alternativa
 * seria descartá-lo em silêncio e comparar nove cenários contra dez.
 */
function projetarOraculo(): Record<string, Veredito> {
  const bruto: unknown = JSON.parse(
    readFileSync(`${RAIZ_DO_REPOSITORIO}${CAMINHO_DO_GOLDEN}`, 'utf8'),
  );
  const oraculo = ESQUEMA_DO_ORACULO.parse(bruto);
  const projecao: Record<string, Veredito> = {};

  for (const linha of oraculo.retorno.divergencia_de_estado) {
    const achado = CENARIO_NO_NOME.exec(linha.name);

    if (achado === null) {
      throw new Error(`o cenário do golden não traz o sufixo esperado: ${linha.name}`);
    }

    projecao[achado[0]] = {
      automatico: linha.mensagens_automatico,
      manual: linha.mensagens_manual,
    };
  }

  return projecao;
}

// ---------------------------------------------------------------------------
// Os caminhos das rotas — compostos a partir dos donos, nunca escritos à mão
// ---------------------------------------------------------------------------

const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;
const POLITICA_DE_AVISO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_AUTOMACAO_DE_COBRANCA}`;
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** A rota de aviso de uma cobrança, composta a partir do dono do segmento. */
function rotaDosAvisos(codigo: string): string {
  return `${POLITICA_DE_AVISO}/cobrancas/${codigo}/avisos`;
}

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/**
 * Quem age: a `ADMIN_EMPRESA` da carga, cuja matriz de perfil é o catálogo inteiro.
 *
 * Nenhum ajuste individual é escrito para ela, e o efetivo é **AFIRMADO** por `GET /v1/sessao` antes
 * dos casos: sem isso, um `403` no disparo manual seria indistinguível da recusa por estado que o
 * REG-08 mede, e a tabela de respostas deixaria de significar o que promete.
 */
const QUEM_ADMINISTRA = pessoaSemeada('admin.a@exemplo.com.br');

/** As duas chaves que as rotas desta prova exigem — afirmadas no efetivo, nunca supostas. */
const AREA_DA_AUTOMACAO_DE_COBRANCA = 'TELA:automacao_de_cobranca';
const ACAO_DE_ENVIO_MANUAL = 'ACAO:enviar_cobranca_manual';

/** O valor de toda cobrança do arranjo — nenhum cenário desta prova mede dinheiro. */
const VALOR_DA_PARCELA = 1500;

/** O molde do código de cobrança dentro do assunto do aviso — como ligar captura a cobrança. */
// DÉBITO COM GATILHO — D54 · F3/T11 · registrado 2026-08-12
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege a linha abaixo.)
// O QUÊ: esta é a TERCEIRA cópia do molde de extração do código de cobrança — as outras duas são
//        `packages/db/test/execucao-da-regua.spec.ts` e `apps/worker/test/regua.spec.ts`, com o
//        mesmo nome e o mesmo propósito. Elas JÁ divergem: só esta carrega a flag `u`. A largura
//        SETE é decisão medida, protegida por `DECISÃO FECHADA` em `packages/contracts/src/cobranca.ts`.
// QUANDO FECHA: o QUARTO consumidor do molde, ou a primeira alteração da forma do código de cobrança
//        — endurecer uma cópia (ancorar com `^...$`, alargar o ano, mudar a largura) deixa as outras
//        para trás sem que nada acuse.
// POR QUE NÃO AGORA: fechar exige um módulo de acessório de teste compartilhado entre `apps/` e
//        `packages/`, que é vizinho do D28 acima e está fora do escopo desta task — que não
//        acrescenta uma linha de código de produção.
// ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D54
const CODIGO_NO_ASSUNTO = /COB-\d{4}-\d{7}/u;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let capturador: CapturadorDeEmail;

/**
 * A tabela do produto **medida** pelo CT-636, consumida pelo CT-637 na mesma execução.
 *
 * Ela é a única ponte entre os dois casos, e é medição — nunca a constante declarada. O CT-637 falha
 * nomeadamente se ela não existir, para que a ordem dos dois casos seja uma dependência visível em
 * vez de uma suposição.
 */
let tabelaDoProduto: Record<string, Veredito> | undefined;

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

  // A porta de e-mail é trocada pelo **arcabouço de teste**, sobre o token que a composição já
  // publica: nada em `apps/api/src` ganhou parâmetro, bandeira ou ramo por causa desta prova, e o
  // capturador implementa a MESMA `PortaDeEnvioDeEmail` do adaptador de produção — de dentro, a régua
  // não sabe qual dos dois recebeu. Mesmo mecanismo de `automacao-de-cobranca.e2e.spec.ts`.
  capturador = criarCapturadorDeEmail();

  // A montagem instrumentada tem casa única em `./aplicacao-instrumentada.ts` desde o fecho do
  // débito `D57 · F3/T12`.
  aplicacao = await montarAplicacaoInstrumentada(porta, [
    { token: TOKEN_PORTA_DE_EMAIL, valor: capturador },
  ]);

  cookie = await entrar(QUEM_ADMINISTRA.email, SENHA_DA_CARGA);

  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;

  expect(sessao.telas).toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);
  expect(sessao.acoes).toContain(ACAO_DE_ENVIO_MANUAL);
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

// ===========================================================================
// CT-636 — a EQUIVALÊNCIA, com os dez vereditos escritos ANTES da execução
// ===========================================================================

describe('CT-636 — a equivalência com o oráculo, medida sobre o efeito', () => {
  it(
    'CT-636 — os vinte números do produto batem um a um contra a tabela declarada antes da execução',
    async () => {
      // -------------------------------------------------------------------------------------
      // Passo 1 — os dez cenários, e o estado de cada um AFIRMADO pela rota real
      // -------------------------------------------------------------------------------------
      const codigoPorCenario = await semearOsDezCenarios();

      const estadosObservados: Record<string, string> = {};
      for (const referencia of CENARIOS_DE_REFERENCIA) {
        estadosObservados[referencia.cenario] = (
          await lerCobranca(exigirCodigo(codigoPorCenario, referencia.cenario))
        ).status;
      }

      // O estado é a precondição de tudo o que vem depois, e ele é **derivado** dos fatos gravados —
      // não existe coluna a inspecionar (ADR-0022). Um pagamento que não tivesse pego deixaria o
      // cenário em `VENCIDA`, e o disparo manual responderia `200`: a recusa do REG-06 e do REG-07
      // deixaria de significar o que promete.
      const estadosDeclarados: Record<string, string> = {};
      for (const referencia of CENARIOS_DE_REFERENCIA) {
        estadosDeclarados[referencia.cenario] = referencia.estado;
      }

      expect(estadosObservados).toStrictEqual(estadosDeclarados);

      // -------------------------------------------------------------------------------------
      // Passo 2 — a política EQUIVALENTE, gravada pela rota real
      // -------------------------------------------------------------------------------------
      const gravada = await pedir(POLITICA_DE_AVISO, {
        metodo: 'PUT',
        cookie,
        corpo: { ...POLITICA_EQUIVALENTE },
      });

      expect(gravada.status).toBe(200);
      expect(gravada.corpo).toStrictEqual(POLITICA_EQUIVALENTE);

      // -------------------------------------------------------------------------------------
      // Passo 3 — os quatro históricos declarados, e a contagem crua que os afirma
      // -------------------------------------------------------------------------------------
      await restaurarHistoricoDeclarado(codigoPorCenario);

      // -------------------------------------------------------------------------------------
      // Passo 4 — a passagem AUTOMÁTICA, pelas portas reais do banco
      // -------------------------------------------------------------------------------------
      const capturadorDoAutomatico = criarCapturadorDeEmail();
      const resultado = await passarAReguaDaEmpresa(capturadorDoAutomatico);

      // O resultado INTEIRO por igualdade estrita: é ele que a borda do job consome para decidir se a
      // fila repete, e contagens erradas passariam por uma asserção de presença.
      expect(resultado).toStrictEqual(RESULTADO_DA_PASSAGEM_AUTOMATICA);

      const mensagensDoAutomatico = contarPorCenario(
        capturadorDoAutomatico.capturas,
        codigoPorCenario,
      );

      // Toda tentativa deixou linha, inclusive a que não saiu (RD-08) — a contagem crua é o que
      // separa *"três mensagens saíram"* de *"a régua registrou o que fez"*.
      expect(await contarEnvios()).toBe(LINHAS_APOS_A_PASSAGEM_AUTOMATICA);

      // -------------------------------------------------------------------------------------
      // Passo 5 — o histórico volta ao declarado, ANTES de medir o manual
      // -------------------------------------------------------------------------------------
      //
      // A passagem automática gravou `ENVIADA` para três cenários, e a trava do predicado conta
      // tentativa de qualquer caminho: sem a restauração, o manual mediria um cenário diferente do
      // que a tabela declara. A contagem crua a AFIRMA — restauração presumida seria arranjo mudo.
      await restaurarHistoricoDeclarado(codigoPorCenario);

      // -------------------------------------------------------------------------------------
      // Passo 6 — o disparo MANUAL, cenário a cenário, pela rota real
      // -------------------------------------------------------------------------------------
      const mensagensDoManual: Record<string, number> = {};
      const respostasObservadas: Record<string, number> = {};

      for (const referencia of CENARIOS_DE_REFERENCIA) {
        const codigo = exigirCodigo(codigoPorCenario, referencia.cenario);
        const antes = capturador.capturas.length;

        const resposta = await pedir(rotaDosAvisos(codigo), {
          metodo: 'POST',
          cookie,
          corpo: {},
        });

        respostasObservadas[referencia.cenario] = resposta.status;

        const novas = capturador.capturas.slice(antes);
        const doCenario = novas.filter(
          (captura) => codigoDoAssunto(captura.mensagem.assunto) === codigo,
        );

        // Nenhuma captura alheia: uma régua que compusesse o aviso de uma cobrança e o mandasse com o
        // código de outra apareceria aqui, e não na contagem.
        expect(doCenario.length, referencia.cenario).toBe(novas.length);

        mensagensDoManual[referencia.cenario] = doCenario.length;
      }

      // As respostas por extenso: `422` é recusa de negócio, e qualquer outra coisa — um `500`, em
      // particular — produziria zero mensagens e passaria despercebida nos três cenários de recusa.
      expect(respostasObservadas).toStrictEqual(RESPOSTAS_DO_DISPARO_MANUAL);

      // -------------------------------------------------------------------------------------
      // Passo 7 — os VINTE números, contra a constante escrita antes da execução
      // -------------------------------------------------------------------------------------
      const medido: Record<string, Veredito> = {};
      for (const cenario of CENARIOS) {
        medido[cenario] = {
          automatico: mensagensDoAutomatico.get(cenario) ?? 0,
          manual: mensagensDoManual[cenario] ?? 0,
        };
      }

      // A medição é publicada ANTES de ser julgada, e a ordem é conteúdo: atribuir depois da
      // asserção faria todo defeito de produto abortar o caso aqui, deixando o CT-637 sem a tabela
      // e morrendo no `throw` de dependência — o diagnóstico que ele promete (o par divergente e os
      // dois números) ficaria inalcançável justamente por mutação do produto, que é o que ele existe
      // para nomear.
      tabelaDoProduto = medido;

      expect(medido).toStrictEqual(VEREDITOS_DO_PRODUTO);
    },
    LIMITE_CASO_MS,
  );
});

// ===========================================================================
// CT-637 — a divergência é UMA, e o lado do oráculo é LIDO do golden
// ===========================================================================

describe('CT-637 — a única divergência contra o oráculo é REG-08 no caminho manual', () => {
  it('CT-637 — a projeção do golden tem dez cenários, e o conjunto divergente tem um elemento', () => {
    const produto = tabelaDoProduto;

    // A dependência do CT-636 é declarada, e não suposta: sem esta linha, uma execução isolada deste
    // caso compararia o oráculo contra `undefined` e produziria dez divergências — ou, pior, nenhuma.
    if (produto === undefined) {
      throw new Error('o CT-637 exige a tabela do produto medida pelo CT-636 na mesma execução');
    }

    const oraculo = projetarOraculo();

    // -------------------------------------------------------------------------------------
    // Passo 1 — a projeção tem DEZ cenários, e são os mesmos dez
    // -------------------------------------------------------------------------------------
    //
    // A contagem sozinha não basta: dez chaves quaisquer passariam por ela, e a comparação seguinte
    // percorreria os cenários do produto lendo `undefined` do outro lado.
    expect(Object.keys(oraculo).length).toBe(CENARIOS.length);
    expect(Object.keys(oraculo).sort()).toStrictEqual([...CENARIOS]);
    expect(Object.keys(produto).sort()).toStrictEqual([...CENARIOS]);

    // -------------------------------------------------------------------------------------
    // Passo 2 — as vinte células, e o conjunto dos pares que divergem
    // -------------------------------------------------------------------------------------
    const divergencias: {
      readonly cenario: string;
      readonly caminho: CaminhoComparado;
      readonly oraculo: number;
      readonly produto: number;
    }[] = [];

    // As células que COINCIDIRAM, contadas uma a uma no ramo `else` da comparação — nunca deduzidas
    // de `CENARIOS.length * CAMINHOS.length`, que é aritmética entre constantes deste arquivo e vale
    // o mesmo qualquer que seja o percurso realmente feito.
    let coincidentes = 0;

    for (const cenario of CENARIOS) {
      const doOraculo = oraculo[cenario];
      const doProduto = produto[cenario];

      if (doOraculo === undefined || doProduto === undefined) {
        throw new Error(`o cenário ${cenario} falta em um dos dois lados da comparação`);
      }

      for (const caminho of CAMINHOS) {
        if (doOraculo[caminho] !== doProduto[caminho]) {
          divergencias.push({
            cenario,
            caminho,
            oraculo: doOraculo[caminho],
            produto: doProduto[caminho],
          });
        } else {
          coincidentes += 1;
        }
      }
    }

    // -------------------------------------------------------------------------------------
    // Passo 3 — o conjunto é EXATAMENTE um elemento, nomeado, com os dois números
    // -------------------------------------------------------------------------------------
    //
    // Uma segunda divergência reprova aqui **nomeando o par e os dois valores**, que é a informação
    // que resolve a situação — e é a razão de o conjunto carregar os números em vez de só as chaves.
    // A ausência de divergência também reprova: o REG-08 é a vitória que a fatia existe para provar,
    // e um produto que voltasse a cobrar dívida cancelada esvaziaria esta lista.
    expect(divergencias).toStrictEqual([DIVERGENCIA_ADMITIDA]);

    // E dezenove células foram OBSERVADAS coincidindo — o contador sobe dentro do laço, uma vez por
    // par (cenário, caminho) efetivamente comparado. É por isso que esta linha é a asserção da
    // travessia: um laço que deixe de visitar uma célula qualquer entrega dezoito, e reprova aqui
    // ainda que a igualdade acima continue passando — o que aconteceria, porque tirar do percurso um
    // cenário coincidente não acrescenta nem remove divergência.
    expect(coincidentes).toBe(19);
  });
});

// ---------------------------------------------------------------------------------------------
// Acessórios — o cenário nasce pelas ROTAS REAIS; só o que porta alguma monta desce ao SQL
// ---------------------------------------------------------------------------------------------

/** Um contador local, para que cada cadastro do cenário nasça com identificador único. */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/**
 * Monta os dez cenários e devolve o código de cobrança de cada um.
 *
 * Dois contratos ativos bastam, e a economia é conteúdo: o cenário do REG-09 exige um locatário **sem
 * endereço de contato**, e os outros nove exigem o oposto. Um contrato por cenário multiplicaria por
 * cinco o custo do caso sem acrescentar uma asserção — o que liga captura a cobrança é o código no
 * assunto da mensagem, e não o destinatário.
 */
async function semearOsDezCenarios(): Promise<Map<string, string>> {
  const comContato = await contratoAtivo({ semContato: false });
  const semContato = await contratoAtivo({ semContato: true });
  const codigoPorCenario = new Map<string, string>();

  for (const referencia of CENARIOS_DE_REFERENCIA) {
    const contrato = referencia.semContato ? semContato : comContato;
    const cobranca = await lancarEm(contrato, referencia.deslocamento);

    codigoPorCenario.set(referencia.cenario, cobranca.codigo);

    if (referencia.transicao === 'PAGAMENTO') {
      await pagarCobranca(cobranca.codigo, referencia.deslocamento);
    } else if (referencia.transicao === 'CANCELAMENTO') {
      await cancelarCobranca(cobranca.codigo);
    }
  }

  return codigoPorCenario;
}

/** O código de um cenário, ou uma falha nomeada — o `undefined` do `Map` não vira cadeia vazia. */
function exigirCodigo(codigoPorCenario: ReadonlyMap<string, string>, cenario: string): string {
  const codigo = codigoPorCenario.get(cenario);

  if (codigo === undefined) {
    throw new Error(`o arranjo não semeou a cobrança do cenário ${cenario}`);
  }

  return codigo;
}

/**
 * Monta conjunto, imóvel, locador, locatário e um contrato **ativo**, e devolve o código dele.
 *
 * O endereço do locatário **não** é devolvido, e a ausência é deliberada: o que liga uma captura à
 * cobrança nesta prova é o código que o assunto da mensagem carrega, e não o destinatário — os nove
 * cenários com contato dividem o mesmo contrato, de modo que o endereço não discrimina nada aqui.
 *
 * `gerarCobrancasAutomaticamente: false` é conteúdo, e não conveniência: a ativação com `true`
 * derivaria as parcelas do contrato inteiro, e a carteira montada por trás entraria na passagem
 * automática — as contagens por cenário passariam a depender do calendário.
 *
 * O locatário **sem contato** nasce por {@link semearLocatarioSemContato}, que é o caminho do CT-619:
 * `negocio.locatario.email` é `NOT NULL` e `esquemaDePessoaNova` exige `z.email()`, de modo que o
 * cadastro do REG-09 é irrepresentável pela borda. **Nenhum `NOT NULL` é relaxado** — o acessório
 * grava a cadeia vazia pela porta de produção `criarPessoa`.
 */
async function contratoAtivo(opcoes: { readonly semContato: boolean }): Promise<string> {
  const conjuntoId = (
    await criarPor(CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${String(proximo())}` })
  ).id;
  const imovelId = (await criarPor(CAMINHO_DOS_IMOVEIS, corpoDeImovel(conjuntoId))).id;
  const locadorId = (await criarPor(CAMINHO_DOS_LOCADORES, corpoDePessoa())).id;

  const locatario = corpoDePessoa();
  const locatarioId = opcoes.semContato
    ? await criarLocatarioSemContato(locatario)
    : (await criarPor(CAMINHO_DOS_LOCATARIOS, locatario)).id;

  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie,
    corpo: {
      imovelId,
      locadorId,
      locatarioId,
      fiadoresIds: [],
      dataInicioLocacao: '2026-01-10',
      prazoMeses: 30,
      valorMensal: VALOR_DA_PARCELA,
      diaVencimento: 10,
      gerarCobrancasAutomaticamente: false,
    },
  });

  if (montagem.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(montagem.status)}: ${montagem.texto}`,
    );
  }

  const codigo = (montagem.corpo as { codigo: string }).codigo;
  const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação de ${codigo} respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return codigo;
}

/**
 * Cria o locatário do REG-09 pelo caminho do CT-619, sob o contexto que a guarda publica.
 *
 * O corpo é o **mesmo** dos demais cadastros, e quem zera o endereço é o acessório — que o faz pela
 * porta de produção `criarPessoa`. Nada aqui relaxa o `NOT NULL` da coluna.
 */
async function criarLocatarioSemContato(corpo: CorpoDePessoa): Promise<string> {
  const dados: DadosDaPessoa = { ...corpo, complemento: null, rg: null };
  const criado = await emUnidade(async (tx) => await semearLocatarioSemContato(tx, dados));

  return criado.id;
}

/** Cria um cadastro pela rota real e devolve o identificador dele. A falha levanta. */
async function criarPor(dono: string, corpo: Record<string, unknown>): Promise<{ id: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}`;
  const resposta = await pedir(alvo, { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as { id: string };
}

/** O corpo completo de um imóvel, com o identificador municipal único por construção. */
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

/**
 * O corpo de um cadastro de pessoa — declarado como **alias de objeto**, e não como interface.
 *
 * A diferença não é estilo: só o alias ganha assinatura de índice implícita, e é ela que permite
 * entregá-lo a {@link criarPor} sem um `as` que apagaria a conferência dos campos.
 */
type CorpoDePessoa = {
  nome: string;
  tipoPessoa: 'PESSOA_FISICA';
  documentoPrincipal: string;
  rg: null;
  email: string;
  telefone: string;
  logradouro: string;
  numero: string;
  complemento: null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

/** O corpo completo de um cadastro de pessoa, com documento e endereço de contato únicos. */
function corpoDePessoa(): CorpoDePessoa {
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
 * Lança uma cobrança com o vencimento deslocado em `dias` a partir do **relógio do banco**.
 *
 * O eixo é `negocio.data_corrente_da_operacao()` — o mesmo que a visão consulta para decidir o estado
 * e que o predicado compara —, e nunca `new Date()`: comparar por um eixo e classificar por outro
 * faria a fronteira do vencimento discordar de si mesma nas horas em torno da virada (ADR-0026).
 */
async function lancarEm(contratoCodigo: string, dias: number): Promise<CobrancaPublicada> {
  const datas = await datasEm(dias);
  const resposta = await pedir(COLECAO_DE_COBRANCAS, {
    metodo: 'POST',
    cookie,
    corpo: {
      contratoCodigo,
      natureza: 'ALUGUEL',
      referencia: 'Aluguel do cenário de equivalência',
      competencia: datas.competencia,
      dataVencimento: datas.vencimento,
      valorOriginal: VALOR_DA_PARCELA,
    },
  });

  if (resposta.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as CobrancaPublicada;
}

/** Acusa o pagamento pela rota real — o caminho legítimo até o estado `PAGA`. */
async function pagarCobranca(codigo: string, diasDoPagamento: number): Promise<void> {
  const datas = await datasEm(diasDoPagamento);
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}/pagamento`, {
    metodo: 'POST',
    cookie,
    corpo: { pagoEm: datas.vencimento, valorPago: VALOR_DA_PARCELA },
  });

  if (resposta.status !== 200) {
    throw new Error(
      `o pagamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Cancela pela rota real — o caminho legítimo até o estado `CANCELADA`. */
async function cancelarCobranca(codigo: string): Promise<void> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}/cancelamento`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });

  if (resposta.status !== 200) {
    throw new Error(
      `o cancelamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Lê uma cobrança pela rota real — é dela que sai o `status` publicado, nunca de uma coluna. */
async function lerCobranca(codigo: string): Promise<CobrancaPublicada> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}`, { cookie });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CobrancaPublicada;
}

/**
 * Executa o trabalho sob o contexto da empresa, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação. Nenhum
 * `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008).
 */
async function emUnidade<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * A passagem automática, pelo caminho **da borda**: a política pela porta real e as três injetadas.
 *
 * Mesmo desenho de `packages/db/test/execucao-da-regua.spec.ts` e do job da T8 — a hora vem de
 * `lerHoraCorrenteDaOperacao` (o relógio do banco, ADR-0026), e a política de `lerPoliticaDeAviso`,
 * que traduz a ausência de linha na régua desligada. Montar a política em memória aqui faria a
 * passagem medir uma configuração que o produto não leu.
 */
async function passarAReguaDaEmpresa(email: CapturadorDeEmail): Promise<ResultadoDaRegua> {
  const politica = await emUnidade(lerPoliticaDeAviso);
  const agora = await emUnidade(lerHoraCorrenteDaOperacao);

  return await executarReguaDaEmpresa({
    politica,
    agora,
    candidatas: async () =>
      await emUnidade(async (tx) => await selecionarCandidatasAoAviso(tx, politica)),
    registrar: async (tentativa) =>
      await emUnidade(async (tx) => await registrarEnvioDeCobranca(tx, tentativa)),
    email,
  });
}

/**
 * Apaga as tentativas registradas e regrava as **quatro** do histórico declarado.
 *
 * A restauração corre entre as duas passagens porque a trava do predicado conta tentativa de qualquer
 * caminho: as `ENVIADA` que o automático gravou mudariam o cenário do manual. As duas contagens cruas
 * **afirmam** o estado — a limpeza que não alcançasse linha alguma passaria despercebida, e o manual
 * mediria outra coisa em silêncio.
 *
 * O apagamento é instrução própria porque não existe — nem deve existir — porta de produção que apague
 * tentativa: o registro é o que sustenta a trava, a idempotência da repetição e a auditoria. E o
 * instante de cada tentativa regravada também desce ao SQL, porque `registrarEnvioDeCobranca` **não
 * abre parâmetro de instante** (o carimbo é do banco, ADR-0026) — e é por ele que a trava conta.
 */
async function restaurarHistoricoDeclarado(
  codigoPorCenario: ReadonlyMap<string, string>,
): Promise<void> {
  await emUnidade(async (tx) => {
    await tx`DELETE FROM negocio.envio_de_cobranca`;
  });

  expect(await contarEnvios()).toBe(0);

  for (const historico of HISTORICOS_DECLARADOS) {
    await semearTentativa(exigirCodigo(codigoPorCenario, historico.cenario), historico);
  }

  expect(await contarEnvios()).toBe(LINHAS_DO_HISTORICO_DECLARADO);
}

/**
 * Grava uma tentativa de envio no passado, com `criado_em` explícito.
 *
 * Mesmo desenho, e mesma razão, de `semearTentativa` em `automacao-de-cobranca.e2e.spec.ts`: a
 * instrução corre com o papel da aplicação, sob a política de linha, e **não compara `empresa_id` com
 * coisa alguma** — a empresa sai da mesma expressão que as políticas avaliam, e o `WITH CHECK` é quem
 * aceita ou recusa a linha (ADR-0008).
 */
async function semearTentativa(codigo: string, historico: HistoricoDeclarado): Promise<void> {
  const causa = historico.desfecho === 'ENVIADA' ? null : CAUSA_DA_FALHA_HERDADA;

  const alcancadas = await emUnidade(async (tx) => {
    const resultado = await tx`
      INSERT INTO negocio.envio_de_cobranca (
        empresa_id, cobranca_id, criado_em, caminho, desfecho, destinatario, causa
      )
      SELECT nullif(current_setting('app.empresa_id', true), '')::uuid,
             c.id,
             now() - make_interval(days => ${historico.diasAtras}::integer),
             'AUTOMATICO'::negocio.caminho_do_aviso,
             ${historico.desfecho}::negocio.desfecho_do_aviso,
             'herdado@exemplo.invalid',
             ${causa}
        FROM negocio.cobranca c
       WHERE c.codigo = ${codigo}
    `;

    return resultado.count;
  });

  if (alcancadas !== 1) {
    throw new Error(`o arranjo não conseguiu semear a tentativa da cobrança ${codigo}`);
  }
}

/**
 * Quantas tentativas de envio o contexto da empresa alcança — contagem **crua**, sem recorte.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui: quem recorta é a política (ADR-0008), e a empresa entra
 * pelo contexto, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarEnvios(): Promise<number> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.envio_de_cobranca
    `;

    return Number(linha?.total ?? -1);
  });
}

/**
 * O par competência/vencimento deslocado em `dias` a partir do relógio do banco.
 *
 * O eixo é `negocio.data_corrente_da_operacao()` — o mesmo que a visão consulta —, e não o calendário
 * do processo.
 */
async function datasEm(dias: number): Promise<{ competencia: string; vencimento: string }> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<{ competencia: string; vencimento: string }[]>`
      SELECT to_char(
               date_trunc(
                 'month',
                 negocio.data_corrente_da_operacao() + make_interval(days => ${dias})
               ),
               'YYYY-MM-DD'
             ) AS competencia,
             to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
               'YYYY-MM-DD'
             ) AS vencimento
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu as datas do cenário');
    }

    return linha;
  });
}

/**
 * O código da cobrança lido do **assunto da mensagem que saiu**.
 *
 * É o que liga a captura à cobrança pelo conteúdo entregue, e não por uma lista que o teste mantenha:
 * uma régua que compusesse o aviso de uma cobrança e o entregasse no lugar de outra apareceria aqui.
 */
function codigoDoAssunto(assunto: string): string {
  const achado = CODIGO_NO_ASSUNTO.exec(assunto);

  if (achado === null) {
    throw new Error(`o assunto capturado não traz código de cobrança: ${assunto}`);
  }

  return achado[0];
}

/** Quantas mensagens saíram por cenário, ligadas pelo código que o assunto carrega. */
function contarPorCenario(
  capturas: readonly { readonly mensagem: { readonly assunto: string } }[],
  codigoPorCenario: ReadonlyMap<string, string>,
): ReadonlyMap<string, number> {
  const cenarioPorCodigo = new Map<string, string>();
  for (const [cenario, codigo] of codigoPorCenario) {
    cenarioPorCodigo.set(codigo, cenario);
  }

  const contagem = new Map<string, number>();
  for (const captura of capturas) {
    const codigo = codigoDoAssunto(captura.mensagem.assunto);
    const cenario = cenarioPorCodigo.get(codigo);

    if (cenario === undefined) {
      throw new Error(`saiu mensagem de uma cobrança fora do arranjo: ${codigo}`);
    }

    contagem.set(cenario, (contagem.get(cenario) ?? 0) + 1);
  }

  return contagem;
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

/** O recorte de uma cobrança publicada que esta prova observa. */
interface CobrancaPublicada {
  readonly codigo: string;
  readonly status: string;
}

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, base), {
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
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = entrada.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial.split(';')[0] ?? '';
}
