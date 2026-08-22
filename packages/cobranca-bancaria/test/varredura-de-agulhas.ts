/**
 * A **varredura de agulhas** com controle positivo — a casa única do diretório.
 *
 * ---------------------------------------------------------------------------
 * Por que num arquivo próprio — o limiar de três, disparado
 * ---------------------------------------------------------------------------
 *
 * O molde nasceu copiado em `leitura-do-material.spec.ts` (a ausência de segredo nas duas recusas da
 * leitura) e em `adaptador-sicoob.spec.ts` (a ausência de segredo e de detrito nos desfechos da
 * porta), e a suíte da conversão do material seria a **terceira** cópia do mesmo diretório. É o
 * gatilho que o `CLAUDE.md` declara: *"com duas cópias, endurecer uma deixa a outra para trás; com
 * três, elas já divergiram"* — e aqui elas **já tinham divergido**, o que torna a subida corretiva e
 * não profilática. As três divergências medidas antes desta migração:
 *
 * | Eixo | `leitura-do-material.spec.ts` | `adaptador-sicoob.spec.ts` | O que ficou |
 * |---|---|---|---|
 * | profundidade da inspeção | `depth: 10` | `depth: null` | **`null`** — quem esconde o segredo no 11º nível não escapa |
 * | caixa do casamento | sensível | insensível | **insensível** — hexadecimal maiúsculo do runtime não escapa |
 * | rótulo do cenário | ausente | prefixo `cenário/rótulo` | **opcional** — quem não passa cenário lê o rótulo cru |
 *
 * Nos três eixos ficou a forma **mais forte**: a varredura passou a enxergar mais, nunca menos.
 * Fundir na direção contrária seria afrouxar prova de ausência, que é a regressão R2 que
 * `.claude/rules/nao-regressao.md` §4.2 proíbe.
 *
 * ---------------------------------------------------------------------------
 * O que este molde prova, e por que sem o CONTROLE ele não provaria nada
 * ---------------------------------------------------------------------------
 *
 * Ele afirma **ausência** — e ausência é exatamente o que um detector quebrado também devolve. Por
 * isso {@link controleComAsAgulhas} existe e é usado **antes** de cada asserção de ausência: a mesma
 * função de varredura, sobre um objeto que **contém** as agulhas distribuídas por superfícies
 * diferentes, tem de devolvê-las todas. Sem esse par, um detector que nunca acha nada aprovaria um
 * artefato vazando tudo (**AP-29**).
 *
 * As ausências são afirmadas por **igualdade com lista vazia**, e nunca por booleano: assim a
 * reprovação **nomeia** o que vazou e por qual superfície.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar
 * os tipos dele. Mesma forma, e mesma razão, de `conjuntos.ts` ao lado.
 */

import { inspect } from 'node:util';

/** Uma agulha e o rótulo pelo qual a reprovação a nomeia. */
export interface Agulha {
  readonly rotulo: string;
  readonly valor: string;
}

/** Quantos caracteres do recorte de início do material entram como agulha curta. */
const CARACTERES_DO_RECORTE = 32;

/**
 * Todas as superfícies de um valor por onde um segredo poderia sair.
 *
 * São quatro famílias, e cada uma cobre um caminho medido: a **inspeção profunda** (o caminho de
 * `console`, do diagnóstico e do relatório de teste), a **mensagem** e a **pilha** (que a medição M4
 * da fatia `fundacao-bancaria` achou serem o ponto por onde segredo interpolado sobrevive, e onde a
 * redação do registrador **não** o alcança), as **propriedades próprias** — nome e valor —, que é o
 * que um serializador copiaria, e a **serialização JSON**.
 *
 * ⚠️ A profundidade é **ilimitada** de propósito. Um teto numérico faz a varredura parar antes do
 * segredo aninhado fundo, e o verde passa a significar *"não olhei"* em vez de *"não há"*.
 */
export function superficiesDe(alvo: unknown): string[] {
  const superficies: string[] = [
    inspect(alvo, {
      depth: null,
      showHidden: true,
      maxStringLength: null,
      maxArrayLength: null,
      breakLength: Number.POSITIVE_INFINITY,
    }),
  ];

  if (alvo instanceof Error) {
    superficies.push(alvo.message, alvo.stack ?? '');
  }

  if (typeof alvo === 'object' && alvo !== null) {
    for (const nome of Object.getOwnPropertyNames(alvo)) {
      superficies.push(
        nome,
        inspect(Reflect.get(alvo, nome), {
          depth: null,
          maxStringLength: null,
          maxArrayLength: null,
        }),
      );
    }
  }

  try {
    superficies.push(JSON.stringify(alvo) ?? '');
  } catch {
    // Ciclo na estrutura: a inspeção profunda acima já percorreu o objeto inteiro.
  }

  return superficies;
}

/**
 * Os rótulos das agulhas que aparecem em alguma superfície do alvo — **lista**, nunca booleano.
 *
 * Devolver a lista é o que faz a reprovação dizer *qual* segredo vazou; um booleano diria apenas que
 * a asserção caiu.
 *
 * O casamento **ignora a caixa**: o mesmo material sai em hexadecimal maiúsculo de um caminho e
 * minúsculo de outro, e um vazamento que trocasse de caixa passaria por uma comparação sensível.
 *
 * @param cenario Quando informado, prefixa cada rótulo (`cenário/rótulo`), para que uma lista que
 *   soma vários desfechos diga **em qual deles** a agulha apareceu.
 */
export function ocorrenciasDeAgulhas(
  alvo: unknown,
  agulhas: readonly Agulha[],
  cenario?: string,
): string[] {
  const superficies = superficiesDe(alvo).map((superficie) => superficie.toLowerCase());

  return agulhas
    .filter((agulha) =>
      superficies.some((superficie) => superficie.includes(agulha.valor.toLowerCase())),
    )
    .map((agulha) => (cenario === undefined ? agulha.rotulo : `${cenario}/${agulha.rotulo}`));
}

/**
 * As agulhas de um material: as senhas em jogo e os bytes, inteiros e recortados.
 *
 * ⚠️ **As senhas são as REAIS do ato**, e não cadeias decorativas ao lado dele: procurar uma cadeia
 * que nunca entrou no ato é a variante oca desta prova. Quem chama passa a senha que o cofre carrega
 * e, quando houver, a sentinela errada que o caso apresentou.
 *
 * O material entra em **três** serializações porque um vazamento pode escolher qualquer uma: o
 * base64 inteiro pega a cópia integral; os dois recortes pegam o vazamento parcial, em que só o
 * começo do cofre sobrevive numa mensagem truncada.
 */
export function agulhasDe(material: Buffer, senhas: readonly string[]): Agulha[] {
  const base64 = material.toString('base64');
  const hexadecimal = material.toString('hex');

  return [
    ...senhas.map((senha, indice) => ({ rotulo: `senha[${indice}]`, valor: senha })),
    { rotulo: 'material-base64', valor: base64 },
    { rotulo: 'inicio-do-material-base64', valor: base64.slice(0, CARACTERES_DO_RECORTE) },
    { rotulo: 'inicio-do-material-hex', valor: hexadecimal.slice(0, CARACTERES_DO_RECORTE) },
  ];
}

/**
 * Um objeto que **contém** todas as agulhas, cada uma numa superfície diferente.
 *
 * É o controle positivo exigido pelo AP-29: a mesma varredura, sobre ele, tem de devolver a lista
 * inteira. As agulhas são distribuídas de propósito entre mensagem, pilha, propriedade própria e
 * objeto aninhado — se a varredura deixasse de percorrer qualquer uma dessas superfícies, o controle
 * reprovaria **antes** da asserção de ausência.
 *
 * A distribuição vale para qualquer quantidade: com uma agulha só ela vai à mensagem; com duas, a
 * segunda vai à pilha; da terceira em diante, ao par propriedade própria / objeto aninhado.
 */
export function controleComAsAgulhas(agulhas: readonly Agulha[]): Error {
  const [primeira, segunda, ...demais] = agulhas;
  const controle = new Error(`vazamento simulado: ${primeira?.valor ?? ''}`);
  controle.stack = `${controle.stack ?? ''}\n    em rotina falsa (${segunda?.valor ?? ''})`;

  return Object.assign(controle, {
    propriedadePropria: demais.map((agulha) => agulha.valor).join(' '),
    contexto: { certificado: { material: demais.map((agulha) => agulha.valor).join(' ') } },
  });
}
