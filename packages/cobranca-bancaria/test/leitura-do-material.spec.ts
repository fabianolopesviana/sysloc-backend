/**
 * Verificação da **leitura do material PKCS#12** — CT-806, CT-807, CT-808 e CT-862 da fatia
 * `fundacao-bancaria`.
 *
 * ⚠️ **O CT-862 nasce na rodada 3**, como a rede do bloqueante que o Gate 2 levantou (a guarda de
 * `projetarMaterial` inalcançável exatamente no caso que ela declarava cobrir). Ele sai da faixa dos
 * cards de propósito, pelo mesmo motivo — e com o mesmo precedente — do `CT-860`/`CT-861` da T7:
 * `CT-801` a `CT-853` já estão reservados pelos cards das tasks desta fatia, e reusar um deles
 * produziria duas coisas diferentes com o mesmo identificador. `CT-862` é o primeiro livre depois do
 * `CT-861`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-01    | CT-806 | Material legível com a senha correta devolve **titular, validade nas duas
 * |          |        | pontas e impressão digital**, iguais aos do material gerado — e a leitura
 * |          |        | acontece por aperto de mão em laço local, em porta dinâmica. |
 * | CA-01    | CT-806 | O conjunto de chaves de `MaterialLido` é **exatamente** o publicado:
 * |          | (b)    | `serialNumber` e o emissor **não** saem. |
 * | CA-01    | CT-806 | O acessório gera **duas** autoridades e emite material por cada uma, e duas
 * |          | (c)    | leituras sucessivas devolvem cada uma o seu material — as impressões digitais
 * |          |        | diferem. É a capacidade de que o CT-840 e o CT-843 (T10) dependem. |
 * | CA-05    | CT-807 | Senha que não abre levanta recusa nomeada, com motivo interno
 * |          |        | `SENHA_NAO_ABRE`, **distinta** de "ilegível" — e a exceção não carrega a
 * |          |        | senha nem os bytes do material, medido sobre a saída real. |
 * | CA-01    | CT-808 | Material ilegível levanta recusa nomeada, com motivo interno
 * |          |        | `MATERIAL_ILEGIVEL`, **distinta** de "senha inválida", e **nenhum byte** do
 * |          |        | material entra na exceção. |
 * | CA-01,05 | CT-806 | O ponto de escuta e a ligação são encerrados ao fim do ato — nenhum soquete
 * |          | CT-807 | sobrevive ao caso, no desfecho feliz **e** nos dois de recusa. |
 * |          | CT-808 | |
 * | CA-01    | CT-862 | Par que **não apresenta certificado** (objeto vazio) e soquete **destruído**
 * |          |        | (nulo) — as duas formas degeneradas que `getPeerCertificate()` documenta e
 * |          |        | que o `@types/node` esconde — saem como `ErroDeMaterialIlegivel`, e **nunca**
 * |          |        | como falha do runtime fora do mapa da borda. |
 *
 * Rastreabilidade: `CA-01 → CT-806, CT-808, CT-862 (RN-02, RN-03)` · `CA-05 → CT-807 (RN-03)`.
 *
 * ⚠️ **Onde o A6 morde de verdade, medido — e a §6.5 da task foi corrigida para dizê-lo.** Ela
 * atribuía *"os recursos são encerrados, inclusive em falha"* só ao CT-807 e ao CT-808, e hoje lê
 * `A6 → CT-806 (exercício), CT-807/CT-808 (guarda de ordem)`; a medição mostra que, nos dois
 * caminhos de recusa, **nenhum recurso chega a ser aberto**: o runtime interpreta o material ao
 * construir o ponto de escuta, e a recusa precede o `listen` — vale para senha errada (`mac verify
 * failure`), para bytes que não são PKCS#12 (`wrong tag`) e até para chave de porte insuficiente
 * (`ee key too small`). Logo a conferência ali afirma uma ausência que hoje é verdadeira **por
 * construção**, e continua valendo a pena: ela reprova no dia em que alguém inverter a ordem e abrir
 * a porta antes de validar. Quem de fato exerce o encerramento é o **CT-806**, o único caminho em que
 * ponto de escuta e ligação existem — e o mutante que remove o `finally` reprova nele, nomeando os
 * três soquetes sobreviventes.
 *
 * ---------------------------------------------------------------------------
 * A varredura de ausência tem CONTROLE POSITIVO, e sem ele não provaria nada
 * ---------------------------------------------------------------------------
 *
 * O CT-807 e o CT-808 afirmam **ausências**, e ausência é exatamente o que um detector quebrado
 * também devolve. Por isso a **mesma** função de varredura é aplicada, no mesmo caso, a um objeto de
 * controle que **contém** as agulhas — e ela tem de devolvê-las todas. Sem esse par, um detector que
 * nunca acha nada aprovaria um adaptador vazando tudo (**AP-29**), que foi a causa das duas únicas
 * rejeições da fatia anterior.
 *
 * As ausências são afirmadas por **igualdade com lista vazia**, e nunca por booleano: assim a
 * reprovação **nomeia** o que vazou e por qual superfície, em vez de dizer apenas que algo está
 * errado.
 *
 * ⚠️ **A senha varrida é a senha REAL do cofre**, e não uma cadeia decorativa ao lado dele: o
 * acessório a recebe por parâmetro e o caso a reusa como agulha. Procurar uma cadeia que nunca
 * entrou no ato é a variante oca desta prova.
 *
 * ⚠️ **O molde da varredura saiu deste arquivo em 2026-08-21** e mora em `./varredura-de-agulhas.ts`,
 * a casa compartilhada do diretório — o Limiar de Três disparou quando a suíte da conversão do
 * material virou a terceira consumidora. As asserções daqui não mudaram; a varredura importada é
 * **mais forte** que a cópia que havia aqui em dois eixos medidos (profundidade ilimitada e
 * casamento insensível à caixa), e a razão está por extenso no cabeçalho de lá.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo NÃO prova, e onde a propriedade vizinha mora
 * ---------------------------------------------------------------------------
 *
 * Ele prova que os dois desfechos são **distintos** aqui dentro. A **indistinguibilidade na
 * resposta** ao Admin é da T11, e o precedente de método — não da propriedade — é
 * `apps/api/test/recusa-indistinguivel.e2e.spec.ts`, onde o que se protege é enumeração de conta e o
 * oráculo inclui o tempo. Aqui a classe é outra, e o tempo **não** entra no invariante.
 *
 * Nenhum caso alcança o provedor real (ADR-0006): a fronteira é o laço local, em porta que o próprio
 * processo abre.
 *
 * ---------------------------------------------------------------------------
 * O CT-862 instrumenta o RUNTIME, e não o produto — a distinção é a lei do seam
 * ---------------------------------------------------------------------------
 *
 * `projetarMaterial` é função **interna**, e nada dela é exportado: exportá-la para o caso alcançá-la
 * alargaria a superfície de produção por conveniência de teste, que é exatamente o que a lei do seam
 * proíbe. O que o CT-862 substitui é `TLSSocket.prototype.getPeerCertificate` — **API do runtime**,
 * fronteira externa do módulo —, de modo que o SUT roda inteiro pelo caminho real: ponto de escuta
 * aberto com o material de verdade, ligação de verdade, aperto de mão de verdade, e só a resposta do
 * par é a forma degenerada que o runtime documenta.
 *
 * ⚠️ **Não há caminho sem instrumentar, e a razão é do protocolo, não de preguiça.** As duas formas
 * degeneradas nascem de condições que o SUT não expõe: o par é o **próprio processo**, e ele foi
 * construído com `pfx`, de modo que sempre apresenta certificado; e a destruição do soquete entre o
 * `secureConnect` e a leitura acontece dentro de `lerMaterial`, sobre uma ligação que não sai da
 * função. Alcançá-las de fora exigiria um seam no produto — o que a lei proíbe — ou negociar cifra
 * anônima, que o runtime não oferece.
 *
 * Como o dublê é inevitável, valem as duas obrigações da stack de teste: o caso afirma **o número de
 * chamadas** do espião (uma por cenário, e nenhum argumento), e cerca os cenários com **leitura limpa
 * antes e depois** — a de antes é a âncora antivácuo (sem instrumentação o mesmo segredo **resolve**,
 * logo o `ErroDeMaterialIlegivel` do meio vem do cenário e não de um arranjo quebrado), e a de depois
 * prova que a instrumentação foi **desfeita**, e não vazou para os casos vizinhos.
 *
 * ---------------------------------------------------------------------------
 * Os seis mutantes que provam que estes casos PODEM falhar
 * ---------------------------------------------------------------------------
 *
 * Medidos pelo script do pacote (`pnpm --filter @sysloc/cobranca-bancaria test`, nunca `vitest run`
 * avulso), um a um, e revertidos:
 *
 * 1. **A tradução devolve sempre `ErroDeMaterialIlegivel`** — a distinção entre as duas causas some.
 *    Reprova no **CT-807**: *"expected `ErroDeMaterialIlegivel` to be an instance of
 *    `ErroDeSenhaQueNaoAbre`"*.
 * 2. **A projeção publica `serialNumber`.** Reprova no **CT-806**: *"expected { …(5) } to deeply
 *    equal { …(4) }"*.
 * 3. **A mensagem interpola a senha e o material**, como um diagnóstico ingênuo faria. Reprova no
 *    **CT-807 e no CT-808**: a varredura devolve `['senha[0]', …]` em vez de `[]`, **nomeando** o
 *    que vazou.
 * 4. **O `finally` deixa de encerrar ponto de escuta e ligação.** Reprova no **CT-806**:
 *    *"expected 3 to be +0"*.
 * 5. **Os dois motivos são unificados** (`MOTIVO_DA_SENHA_QUE_NAO_ABRE = 'MATERIAL_ILEGIVEL'`) — a
 *    distinção que o par existe para afirmar some, sem que tipo nenhum mude. Reprova no **CT-807** e
 *    no **CT-808**; o que importa é o **CT-808**, que com a forma anterior da asserção de distinção
 *    ficava **inteiramente verde** sob este mesmo mutante. Hoje: *"expected `'MATERIAL_ILEGIVEL'` not
 *    to be `'MATERIAL_ILEGIVEL'`"*, na comparação dos motivos na origem.
 * 6. **A guarda de `projetarMaterial` volta a ser avaliada DEPOIS da projeção** — que é o defeito
 *    literal da rodada 2, o código como o Gate 2 o encontrou. Reprova no **CT-862**, e a lista de
 *    desfechos **nomeia** o que aconteceu: `'par sem certificado (objeto vazio) → fora do mapa:
 *    TypeError'` no lugar de `'… → ErroDeMaterialIlegivel'`. Os CT-806, CT-807 e CT-808 ficam
 *    **inteiramente verdes** sob ele — é a medição que mostra por que a prosa do docblock não bastava
 *    como rede.
 */

import { randomBytes } from 'node:crypto';
import type { PeerCertificate } from 'node:tls';
import { TLSSocket } from 'node:tls';
import type { SegredoOperavel } from '@sysloc/shared';
import { criarSegredoOperavel } from '@sysloc/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  ErroDeMaterialIlegivel,
  ErroDeSenhaQueNaoAbre,
  lerMaterial,
} from '../src/leitura-do-material.ts';
import { gerarAutoridadeDeTeste, gerarMaterialDeTeste } from './material-de-teste.ts';
import { agulhasDe, controleComAsAgulhas, ocorrenciasDeAgulhas } from './varredura-de-agulhas.ts';

/**
 * Teto de um caso inteiro: gerar duas chaves RSA, emitir o material e completar o aperto de mão.
 *
 * A geração é o trecho lento, e o teto é folgado por causa dela — não por causa da leitura, que custa
 * milissegundos. O risco registrado na §20 do tech spec diz que, sob disputa de CPU, o modo de falha
 * do aperto de mão em laço local é **tempo esgotado**, e não resultado errado.
 */
const LIMITE_DO_CASO_MS = 60_000;

/** Quanto se espera pela liberação dos soquetes antes de reprovar — sondagem, nunca `sleep` fixo. */
const LIMITE_DA_LIBERACAO_MS = 2_000;

/** Intervalo entre sondagens da liberação. */
const INTERVALO_DA_SONDAGEM_MS = 10;

/** As chaves que `MaterialLido` publica — escritas por extenso, jamais derivadas do SUT. */
const CHAVES_PUBLICADAS = ['impressaoDigital', 'titular', 'validoAte', 'validoDe'] as const;

/**
 * O que `getPeerCertificate()` devolve e o produto **não** publica (A2).
 *
 * A igualdade de chaves acima já reprovaria qualquer acréscimo; esta lista existe para que a
 * reprovação **nomeie** o campo indevido, que é o desfecho útil quando alguém acrescenta o
 * `serialNumber` "porque estava ali".
 */
const CHAVES_NAO_PUBLICADAS = [
  'serialNumber',
  'issuer',
  'emissor',
  'raw',
  'modulus',
  'pubkey',
  'subject',
  'fingerprint256',
] as const;

/** A senha real do cofre do caso feliz — improvável, para servir de agulha. */
const SENHA_DO_COFRE = 'senha-real-do-cofre-9f3a1c7e4b';

/** A senha deliberadamente errada do CT-807 — também improvável, e também varrida. */
const SENHA_SENTINELA_ERRADA = 'senha-sentinela-que-nao-abre-4d2b8e';

/** A impressão digital tal como o runtime a formata: 32 pares hexadecimais separados por `:`. */
const FORMA_DA_IMPRESSAO_DIGITAL = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * Quantos soquetes o processo mantém vivos agora — o que discrimina recurso liberado de vazado.
 *
 * O casamento é pelo **prefixo**, e não pelos nomes exatos: `getActiveResourcesInfo()` devolve
 * `TCPServerWrap` para o ponto de escuta e `TCPSocketWrap` para cada ligação nesta versão do runtime
 * (medido), e o nome exato é detalhe interno que já mudou de grafia entre versões. O prefixo é o que
 * separa soquete de temporizador sem depender disso.
 */
function soquetesVivos(): number {
  return process.getActiveResourcesInfo().filter((recurso) => recurso.startsWith('TCP')).length;
}

/**
 * Fixa a linha de base de soquetes e **reprova ao fim do caso** se algum tiver sobrado (A6).
 *
 * A conferência mora em `onTestFinished` porque é ali que ela alcança também o caminho de falha: um
 * ponto de escuta que sobrevivesse à recusa seguraria porta e material decifrado na memória do
 * processo. A espera é **sondagem com limite nomeado** — o descarte do soquete completa no laço de
 * eventos seguinte, e um `sleep` fixo seria a forma instável de esperar por isso.
 */
function exigirRecursosEncerrados(): void {
  const linhaDeBase = soquetesVivos();

  onTestFinished(async () => {
    const prazo = Date.now() + LIMITE_DA_LIBERACAO_MS;
    while (soquetesVivos() > linhaDeBase && Date.now() < prazo) {
      await new Promise((resolver) => setTimeout(resolver, INTERVALO_DA_SONDAGEM_MS));
    }

    expect(soquetesVivos()).toBe(linhaDeBase);
  });
}

/**
 * O que `getPeerCertificate()` devolve **de verdade** — e que o `@types/node` não descreve.
 *
 * A documentação do runtime declara duas formas degeneradas: **objeto vazio** quando o par não
 * apresentou certificado, e **nulo** quando o soquete já foi destruído. O tipo publicado é
 * `PeerCertificate`, não-nulo e com `subject` obrigatório — foi essa mentira do tipo que deixou o
 * defeito passar pelo `tsc`, e por isso o cenário do caso é escrito contra a forma real.
 */
type RetornoDegeneradoDoRuntime = Record<string, never> | null;

/**
 * As duas formas degeneradas, cada uma com o rótulo pelo qual a reprovação a nomeia.
 *
 * A segunda não é hipótese: é a que o Gate 2 nomeou como alcançável em produção — soquete destruído
 * entre o `secureConnect` e a leitura —, e ela lança no **acesso ao objeto**, não no acesso ao campo.
 */
const RETORNOS_DEGENERADOS: readonly {
  readonly rotulo: string;
  readonly retorno: RetornoDegeneradoDoRuntime;
}[] = [
  { rotulo: 'par sem certificado (objeto vazio)', retorno: {} },
  { rotulo: 'soquete destruído (nulo)', retorno: null },
];

/**
 * A única conversão larga do arquivo, isolada num ponto e nomeada.
 *
 * Ela existe porque o tipo do runtime **não admite** as duas formas que o runtime devolve. Escrever a
 * conversão aqui, uma vez, é o que evita espalhá-la pelos cenários — e é o que deixa explícito que o
 * caso mede a realidade, não o que o `.d.ts` promete.
 */
function comoOTipoNaoDescreve(retorno: RetornoDegeneradoDoRuntime): PeerCertificate {
  return retorno as unknown as PeerCertificate;
}

/**
 * Nomeia o desfecho pelo **tipo do domínio**, e nunca pelo conteúdo da falha.
 *
 * Falha fora do mapa sai como `fora do mapa: <name>` — só o nome da classe, jamais `message` ou
 * `stack`: a disciplina de A4 vale também para o que o teste imprime ao reprovar.
 */
function nomeDoDesfecho(falha: unknown): string {
  if (falha instanceof ErroDeMaterialIlegivel) {
    return 'ErroDeMaterialIlegivel';
  }
  if (falha instanceof ErroDeSenhaQueNaoAbre) {
    return 'ErroDeSenhaQueNaoAbre';
  }

  return falha instanceof Error ? `fora do mapa: ${falha.name}` : `fora do mapa: ${typeof falha}`;
}

/**
 * Roda o ato inteiro pelo caminho real, com o par respondendo a forma degenerada pedida.
 *
 * O espião é **restaurado no `finally`**, aconteça o que acontecer: instrumentação que sobrevive ao
 * cenário contaminaria os casos vizinhos, e o vermelho apareceria longe da causa.
 */
async function desfechoComOParApresentando(
  retorno: RetornoDegeneradoDoRuntime,
  segredo: SegredoOperavel,
): Promise<{ readonly desfecho: string; readonly chamadas: readonly unknown[][] }> {
  const espiao = vi
    .spyOn(TLSSocket.prototype, 'getPeerCertificate')
    .mockReturnValue(comoOTipoNaoDescreve(retorno));

  // As chamadas são COPIADAS antes do `finally`: `mockRestore()` esvazia o registro do espião, e uma
  // referência viva ao arranjo original chegaria vazia à asserção — verde por acidente.
  const copiarChamadas = (): unknown[][] =>
    espiao.mock.calls.map((argumentos) => [...(argumentos as unknown[])]);

  try {
    await lerMaterial(segredo);
    return { desfecho: 'resolveu', chamadas: copiarChamadas() };
  } catch (falha) {
    return { desfecho: nomeDoDesfecho(falha), chamadas: copiarChamadas() };
  } finally {
    espiao.mockRestore();
  }
}

/** Executa e devolve a exceção — falhando quando a chamada resolve onde se esperava recusa. */
async function capturarRecusa(trabalho: () => Promise<unknown>): Promise<unknown> {
  try {
    await trabalho();
  } catch (falha) {
    return falha;
  }

  throw new Error('a leitura do material resolveu onde o caso exige recusa');
}

describe('leitura do material por aperto de mão em laço local', () => {
  it('CT-806 — leitura correta devolve titular, validade nas duas pontas e impressão digital', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    exigirRecursosEncerrados();

    const autoridade = await gerarAutoridadeDeTeste('Sysloc Teste A');
    const gerado = await gerarMaterialDeTeste({
      autoridade,
      senha: SENHA_DO_COFRE,
      titular: { pais: 'BR', organizacao: 'Locadora Modelo SA', nomeComum: '11222333000181' },
      diasDeValidade: 200,
    });

    const lido = await lerMaterial(
      criarSegredoOperavel({ material: gerado.material, senha: gerado.senha }),
    );

    // Âncora antivácuo: o oráculo veio do `openssl`, por caminho independente do SUT, e tem
    // conteúdo. Sem ela, uma leitura vazia comparada a um oráculo vazio passaria por acerto.
    expect(gerado.titular).toBe('C=BR, O=Locadora Modelo SA, CN=11222333000181');
    expect(gerado.impressaoDigital).toMatch(FORMA_DA_IMPRESSAO_DIGITAL);
    expect(gerado.validoAte.getTime()).toBeGreaterThan(gerado.validoDe.getTime());

    // O objeto inteiro, por igualdade — nunca presença de campo.
    expect(lido).toEqual({
      titular: gerado.titular,
      validoDe: gerado.validoDe,
      validoAte: gerado.validoAte,
      impressaoDigital: gerado.impressaoDigital,
    });

    // A2 — igualdade de CONJUNTO das chaves: é o que impede o campo a mais de entrar sem que
    // ninguém veja, e a lista de proibidos é o que faz a reprovação nomear o intruso.
    expect(Object.keys(lido).sort()).toEqual([...CHAVES_PUBLICADAS]);
    expect(CHAVES_NAO_PUBLICADAS.filter((chave) => chave in lido)).toEqual([]);

    // A forma da impressão digital é a do runtime, e não uma normalização do produto.
    expect(lido.impressaoDigital).toMatch(FORMA_DA_IMPRESSAO_DIGITAL);

    // A7 — a SEGUNDA autoridade, e material emitido por ela. A capacidade que o CT-840 e o CT-843
    // da T10 exigem é exercitada aqui, e não apenas declarada: sem isto, aquela task descobriria um
    // acessório quebrado no meio do caminho.
    const segundaAutoridade = await gerarAutoridadeDeTeste('Sysloc Teste B');
    const geradoPelaSegunda = await gerarMaterialDeTeste({
      autoridade: segundaAutoridade,
      senha: SENHA_DO_COFRE,
      titular: { pais: 'BR', organizacao: 'Locadora Vizinha SA', nomeComum: '99888777000166' },
    });

    const lidoDaSegunda = await lerMaterial(
      criarSegredoOperavel({
        material: geradoPelaSegunda.material,
        senha: geradoPelaSegunda.senha,
      }),
    );

    // Duas leituras sucessivas no mesmo processo devolvem cada uma o SEU material — a asserção de
    // desigualdade é o que pega a implementação que reaproveitasse estado do ato anterior.
    expect(lidoDaSegunda).toEqual({
      titular: 'C=BR, O=Locadora Vizinha SA, CN=99888777000166',
      validoDe: geradoPelaSegunda.validoDe,
      validoAte: geradoPelaSegunda.validoAte,
      impressaoDigital: geradoPelaSegunda.impressaoDigital,
    });
    expect(lidoDaSegunda.impressaoDigital).not.toBe(lido.impressaoDigital);
    expect(segundaAutoridade.certificadoEmPem).not.toBe(autoridade.certificadoEmPem);
  });

  it('CT-807 — senha que não abre: recusa nomeada, distinta, e sem carregar a senha nem os bytes', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    exigirRecursosEncerrados();

    const autoridade = await gerarAutoridadeDeTeste('Sysloc Teste A');
    const gerado = await gerarMaterialDeTeste({ autoridade, senha: SENHA_DO_COFRE });

    const falha = await capturarRecusa(() =>
      lerMaterial(
        criarSegredoOperavel({ material: gerado.material, senha: SENHA_SENTINELA_ERRADA }),
      ),
    );

    // A3 — a recusa é nomeada, e é DISTINTA da outra causa. As duas asserções não são
    // redundantes: a segunda pega a implementação que faz uma classe herdar da outra.
    expect(falha).toBeInstanceOf(ErroDeSenhaQueNaoAbre);
    expect(falha).not.toBeInstanceOf(ErroDeMaterialIlegivel);

    const motivo = falha instanceof ErroDeSenhaQueNaoAbre ? falha.motivo : '(outro erro)';
    expect(motivo).toBe('SENHA_NAO_ABRE');

    // DECISÃO FECHADA — T9 / Gate 1 · 2026-08-15
    // O QUÊ: a distinção entre os dois motivos é afirmada comparando os motivos NA ORIGEM, e nunca
    //        por `expect(motivo).not.toBe('<o outro literal>')`. Vale nas DUAS ocorrências — esta e
    //        a do CT-808.
    // POR QUÊ: a forma anterior, prescrita pela §6.6 da task e corrigida junto com esta linha, era
    //          IMPLICADA pela igualdade literal logo acima, que aborta o caso ao falhar; e o
    //          `motivo` vem de um ternário que degrada para '(outro erro)', literal que também a
    //          satisfazia. Medido no mutante 5: unificados os dois motivos no SUT, o CT-808 ficava
    //          INTEIRAMENTE verde e o CT-807 reprovava na linha de cima — nunca nela.
    // REVERTER EXIGE: exibir um estado do SUT em que a forma proposta reprove e esta não, isto é,
    //                 que ela não seja implicada por nenhuma asserção anterior do mesmo caso.
    expect(new ErroDeSenhaQueNaoAbre().motivo).not.toBe(new ErroDeMaterialIlegivel().motivo);

    const agulhas = agulhasDe(gerado.material, [SENHA_SENTINELA_ERRADA, gerado.senha]);

    // Controle positivo (AP-29): a MESMA varredura, sobre um objeto que contém as agulhas em
    // quatro superfícies diferentes, devolve todas elas. Sem isto, a lista vazia abaixo seria
    // compatível com um detector cego.
    expect(ocorrenciasDeAgulhas(controleComAsAgulhas(agulhas), agulhas)).toEqual(
      agulhas.map((agulha) => agulha.rotulo),
    );

    // A4 e A5 — medido sobre a saída real, nunca por leitura do código (ADR-0032).
    expect(ocorrenciasDeAgulhas(falha, agulhas)).toEqual([]);
  });

  it('CT-808 — material ilegível: recusa nomeada, distinta, e sem devolver conteúdo', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    exigirRecursosEncerrados();

    const bytesQueNaoSaoMaterial = randomBytes(200);

    const falha = await capturarRecusa(() =>
      lerMaterial(
        criarSegredoOperavel({ material: bytesQueNaoSaoMaterial, senha: SENHA_DO_COFRE }),
      ),
    );

    expect(falha).toBeInstanceOf(ErroDeMaterialIlegivel);
    expect(falha).not.toBeInstanceOf(ErroDeSenhaQueNaoAbre);

    const motivo = falha instanceof ErroDeMaterialIlegivel ? falha.motivo : '(outro erro)';
    expect(motivo).toBe('MATERIAL_ILEGIVEL');

    // A mesma garantia de distinção, na mesma forma falsificável — a razão está por extenso na
    // DECISÃO FECHADA do CT-807. É **este** caso que o mutante 5 discrimina: com os dois motivos
    // unificados, tudo o mais aqui permanece verde.
    expect(new ErroDeSenhaQueNaoAbre().motivo).not.toBe(new ErroDeMaterialIlegivel().motivo);

    const agulhas = agulhasDe(bytesQueNaoSaoMaterial, [SENHA_DO_COFRE]);

    // Controle positivo (AP-29), pela mesma razão do caso anterior.
    expect(ocorrenciasDeAgulhas(controleComAsAgulhas(agulhas), agulhas)).toEqual(
      agulhas.map((agulha) => agulha.rotulo),
    );

    expect(ocorrenciasDeAgulhas(falha, agulhas)).toEqual([]);
  });

  it('CT-862 — par sem certificado e soquete destruído saem como recusa nomeada, nunca como falha do runtime', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    exigirRecursosEncerrados();

    const autoridade = await gerarAutoridadeDeTeste('Sysloc Teste A');
    const gerado = await gerarMaterialDeTeste({ autoridade, senha: SENHA_DO_COFRE });
    const segredo = criarSegredoOperavel({ material: gerado.material, senha: gerado.senha });

    // Âncora antivácuo: SEM instrumentação, este mesmo segredo resolve. Sem ela, uma recusa vinda de
    // arranjo quebrado — material ruim, senha trocada — seria lida como a recusa que o caso persegue.
    expect((await lerMaterial(segredo)).titular).toBe(gerado.titular);

    const observados: { readonly rotulo: string; readonly desfecho: string }[] = [];
    const chamadasPorCenario: number[] = [];
    const argumentosPorCenario: (readonly unknown[][])[] = [];

    for (const cenario of RETORNOS_DEGENERADOS) {
      const { desfecho, chamadas } = await desfechoComOParApresentando(cenario.retorno, segredo);
      observados.push({ rotulo: cenario.rotulo, desfecho });
      chamadasPorCenario.push(chamadas.length);
      argumentosPorCenario.push(chamadas);
    }

    // O desfecho de CADA forma degenerada, por igualdade e nomeado. É a asserção que discrimina: com
    // a guarda avaliada depois da projeção, o objeto vazio sai como `fora do mapa: TypeError` e o
    // nulo também — e a lista diz qual das duas caiu.
    expect(observados).toEqual([
      { rotulo: 'par sem certificado (objeto vazio)', desfecho: 'ErroDeMaterialIlegivel' },
      { rotulo: 'soquete destruído (nulo)', desfecho: 'ErroDeMaterialIlegivel' },
    ]);

    // O dublê é inevitável, então o número de chamadas e os argumentos são asseridos (stack de
    // teste): o SUT lê do par **uma vez** por ato, e sem argumento — `getPeerCertificate(true)`
    // devolveria a cadeia detalhada e alargaria o que se projeta.
    expect(chamadasPorCenario).toEqual([1, 1]);
    expect(argumentosPorCenario).toEqual([[[]], [[]]]);

    // A instrumentação foi DESFEITA: a mesma leitura volta a resolver com o material de verdade. Sem
    // esta linha, um `mockRestore()` que deixasse de rodar contaminaria os casos vizinhos, e o
    // vermelho apareceria longe da causa.
    expect((await lerMaterial(segredo)).impressaoDigital).toBe(gerado.impressaoDigital);
  });
});
