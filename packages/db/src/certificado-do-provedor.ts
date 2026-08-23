/**
 * O **certificado do provedor** de cada empresa — registro com substituição atômica, leitura do
 * vigente, leitura do histórico e obtenção do envelope cifrado.
 *
 * ===========================================================================
 * ESTE MÓDULO NÃO DECIFRA, E A AUSÊNCIA É A DECISÃO (ADR-0032)
 * ===========================================================================
 *
 * `segredo_cifrado` é tratado aqui como **texto opaco**: entra cifrado, sai cifrado, e **nada neste
 * arquivo importa `cifrarSegredo` ou `decifrarSegredo`**. Quem cifra e quem decifra é o módulo de
 * cifra de `@sysloc/shared`; quem os liga é a composição da borda.
 *
 * Inverter isso poria o material **em claro** dentro do pacote que monta consulta — que é exatamente
 * o vetor do achado crítico da fase anterior: o cliente de banco anexa os parâmetros vinculados ao
 * erro (`err.command.args`), e a redação do registrador não os alcança. Com o envelope cifrado, o
 * pior desfecho daquele vetor é um texto que ninguém abre sem a chave, que não vive no banco.
 *
 * Pela mesma razão que {@link ./cobranca.ts}, {@link ./contrato.ts} e
 * {@link ./portador-de-confirmacao.ts} já registram, o SQL mora aqui e não no serviço que chama: a
 * contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço com o executor da
 * unidade de trabalho em mãos escreve `negocio.certificado_do_provedor` numa cadeia sem importar nada
 * de proibido, e o alcance à tabela deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As quatro operações **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ===========================================================================
 * REGISTRAR SUBSTITUI, E A SUBSTITUIÇÃO É UMA UNIDADE DE TRABALHO SÓ (RN-05)
 * ===========================================================================
 *
 * {@link registrarCertificado} anula o vigente anterior (`substituido_em = now()`,
 * `segredo_cifrado = NULL`) e insere o novo **na mesma transação**, recebida por parâmetro. Ou a
 * empresa troca de identidade, ou nada mudou — falha em qualquer ponto **não a deixa pior do que
 * estava**, e o dano que isso evita não tem recurso: ninguém recompõe material vindo de terceiro.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DAS TRÊS INSTRUÇÕES NÃO É LIVRE — leia antes de reordenar
 * ---------------------------------------------------------------------------
 *
 * É **conferir → anular → inserir**, e cada posição fecha um modo de falha diferente:
 *
 *   1. **conferir a vigência primeiro** é o que faz a recusa por certificado vencido (RN-03/CA-06)
 *      acontecer **antes de qualquer escrita**. Conferir depois de anular deixaria a empresa sem
 *      identidade por causa de um material que o produto recusa — o desfazimento salvaria a
 *      transação, mas a ordem passaria a depender de o desfazimento existir, e não da instrução;
 *   2. **anular antes de inserir** é imposto pelo banco, não escolhido: `certificado_do_provedor_vigente_uidx`
 *      é índice único **parcial** sobre `empresa_id` onde `substituido_em IS NULL`, e índice único
 *      parcial **não** aceita `DEFERRABLE`. Inserir primeiro colidiria com o próprio vigente que se
 *      quer substituir, e a renovação legítima morreria em `23505`;
 *   3. **inserir por último** é o que dá sentido a (2) sem abrir a janela do dano: o material do novo
 *      já foi **lido e validado fora desta transação** (§7.4), de modo que, quando a anulação corre,
 *      já se sabe que existe um substituto bom. A anulação nunca acontece antes de o novo ser aceito.
 *
 * ⚠️ **A leitura do material acontece FORA da transação**, e é decisão registrada: o aperto de mão em
 * laço local que abre o PKCS#12 custa poucos milissegundos, mas é I/O, e segurar conexão física
 * durante ele repetiria o achado da T7 da fatia anterior (renderização de ~0,5 s dentro do
 * `sql.begin`). Por isso {@link registrarCertificado} **recebe** o que se leu do material, e não o
 * material.
 *
 * ===========================================================================
 * NADA AQUI CONFERE O QUE O BANCO IMPÕE — e as duas violações sobem intactas
 * ===========================================================================
 *
 *   * **um vigente por empresa** (RN-12) é o índice único parcial. Duas renovações concorrentes da
 *     mesma empresa resolvem-se com uma delas recebendo `23505`, e **não há `SELECT` prévio** para
 *     conferir: leitura-modificação-escrita passa em todo caso feliz e perde a corrida;
 *   * **`segredo_cifrado` presente se e somente se `substituido_em` for nulo** (RN-13) é a `CHECK`
 *     `certificado_do_provedor_segredo_chk`, e a violação sobe como `23514`.
 *
 * As duas **não são traduzidas em bloco**. `CodigoErro` é enum fechado e não tem valor de conflito;
 * acrescentar um alcançaria o contrato publicado e todo consumidor — preço desproporcional para uma
 * corrida entre duas renovações da mesma empresa, ato que acontece cerca de uma vez por ano por
 * Admin. A violação sobe nomeando a restrição no registro, e é aí que o diagnóstico mora. É a mesma
 * escolha, e a mesma razão, de {@link ./comodo.ts}.
 *
 * ⚠️ A **única** recusa nomeada deste módulo é {@link ErroDeCertificadoVencido}, e ela existe porque
 * a vigência é a única das três condições da RN-03 que o banco **não** impõe — nem poderia: a linha
 * permanece no histórico depois de vencer, que é o que a CA-09 exige.
 *
 * ===========================================================================
 * O RELÓGIO É O DO BANCO (ADR-0026), e NENHUM `new Date()` decide comportamento
 * ===========================================================================
 *
 * A vigência é comparada com `negocio.data_corrente_da_operacao()` — o **mesmo** eixo de data que a
 * cobrança usa. A comparação inteira corre **no banco**, na primeira instrução da transação:
 * trazê-la para o processo compararia dois relógios, e a diferença apareceria como certificado aceito
 * num servidor e recusado noutro, sem que nada acusasse.
 *
 * `substituido_em` e `criado_em` saem de `pg_catalog.now()` e do padrão da coluna, pela mesma razão.
 *
 * ⚠️ **Os dois lados da comparação são `date`, e a redução do instante a dia nomeia o fuso na própria
 * instrução** — ver {@link recusarCertificadoVencido}. O que se recusou aqui foi a forma que mistura
 * `timestamptz` com `date`: o servidor promove o `date` à meia-noite do fuso da **sessão**, e o
 * `TimeZone` da sessão não é declarado em ponto algum deste repositório (`abrirConexao` não o envia, e
 * o driver só manda `application_name` na partida). Aquela forma punha o eixo que decide aceitar ou
 * recusar material sob o controle de quem conecta — a *"expressão a fuso de sessão"* que a `Decision`
 * da ADR-0026 proíbe por escrito —, e errava **nos dois sentidos**: aceitava o vencido numa sessão a
 * leste do fuso da operação e recusava o válido numa sessão a oeste. Num host cujo `initdb` já grava
 * `America/Sao_Paulo`, nada disso aparece: a suíte acertava por acidente do host.
 *
 * ⚠️ Este módulo **não declara** o fuso da operação: ele o **importa** de
 * {@link ./fuso-da-operacao.ts}, que é a casa única dele no pacote desde o fecho do `D25 · F4/T7`
 * (T4 da fatia `automacoes-agendadas`, 2026-08-23). Enquanto o literal vivia aqui, ele era a
 * **terceira** declaração executável do mesmo fato — com o corpo de
 * `negocio.data_corrente_da_operacao()` (`migracoes/0010_seguranca_cobranca.sql`) e a constante
 * privada homônima de {@link ./envio-de-cobranca.ts} —, e nada amarrava as três. Restam **duas**: a
 * do banco, imutável, e a do lar único; amarrá-las é o que o `D14` ainda agenda, no marcador que
 * acompanhou o literal até lá.
 *
 * ===========================================================================
 * AS DATAS SAEM COMO `Date`, e não como texto ISO — a diferença tem causa
 * ===========================================================================
 *
 * {@link ./cobranca.ts} projeta as datas dela por `to_char`, porque `competencia`, `data_vencimento`
 * e `pago_em` são colunas **`date`**: o driver as entregaria como `Date` no fuso do **processo**, e
 * reserializá-las desloca a data em um dia para metade dos fusos.
 *
 * As quatro datas desta tabela são `timestamptz`, isto é, **instantes absolutos**. O `Date` que o
 * driver devolve para elas não carrega ambiguidade de fuso alguma, e a serialização em ISO-8601 é
 * determinística onde quer que aconteça. Projetá-las por `to_char` aqui criaria a **terceira**
 * declaração executável do molde de instante que `cobranca.ts` e `envio-de-cobranca.ts` já têm — dois
 * fatos livres para divergir viram três — sem ganho algum. É a mesma escolha, e a mesma razão, de
 * {@link ./portador-de-confirmacao.ts}.
 *
 * ===========================================================================
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008) — sem exceção alguma
 * ===========================================================================
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** A tabela nasce com RLS **forçada**
 * (`migracoes/0016_seguranca_bancaria.sql`): a política decide o que cada leitura enxerga e o que
 * cada escrita pode gravar. Não há aqui um `WHERE empresa_id = …` — a defesa em profundidade que a
 * `Decision` da ADR-0008 rejeita por escrito. Diferente do portador da `0014`, **não há travessia
 * nominal nenhuma**: tudo neste domínio é lido e escrito por alguém com sessão da própria empresa.
 *
 * O `JOIN` com `identidade.usuario` não abre buraco: aquele schema nunca teve política (ADR-0009), e
 * a chave estrangeira **composta** `(registrado_por, empresa_id)` já torna impossível, no banco, um
 * certificado da empresa A registrado por alguém da empresa B.
 *
 * ===========================================================================
 * NÃO HÁ EXCLUSÃO, NEM FÍSICA NEM LÓGICA (ADR-0014 não alcança)
 * ===========================================================================
 *
 * O certificado substituído **permanece** — é o registro que a CA-09 exige, e o que permite explicar
 * uma falha ocorrida depois da troca. O que não permanece é o **segredo** dele. A ADR-0014 governa
 * entidade de **cadastro**, e o discriminador dela é *ser referenciável*: ninguém nomeia nem aponta
 * para um certificado de outro registro, de modo que não há `retirado_em` a declarar e não há
 * predicado de circulação a aplicar por padrão.
 */

import type { Fragment, TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts`. Ele **não é
// filtro** — nenhuma leitura deste arquivo o aplica, porque a tabela já tem política e um segundo
// caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe para a **escrita**, onde
// `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// O fuso da operação tem **casa única** em `./fuso-da-operacao.ts` desde o fecho do `D25 · F4/T7`,
// e as duas instruções deste arquivo o leem de lá. A declaração local que vivia aqui era uma das
// TRÊS cópias executáveis do literal no pacote; o gatilho do débito — o quarto consumidor —
// chegou com a derivação de `proximaEsperada` em `./execucao-de-rotina.ts`. Ele não entra em
// `./index.ts`; ver o cabeçalho de lá.
import { FUSO_DA_OPERACAO } from './fuso-da-operacao.js';

/**
 * O molde do **dia de calendário** que sai deste módulo para quem deriva a vigência.
 *
 * A saída é texto, e não `Date`, pela razão que o cabeçalho já registra sobre as colunas `date`: o
 * driver entregaria um `Date` no fuso do **processo**, e reserializá-lo desloca o dia em um para
 * metade dos fusos — que é exatamente o defeito que esta função existe para não ter. Dia de
 * calendário em `AAAA-MM-DD` é ordenável, comparável e subtraível sem relógio nenhum.
 */
const FORMATO_ISO_DO_DIA = 'YYYY-MM-DD';

/**
 * O que se leu do material, mais o envelope já cifrado — a entrada do registro.
 *
 * Os quatro primeiros campos vêm do que o runtime lê do PKCS#12 (titular, validade nas duas pontas e
 * impressão digital) e **nunca** do que chegou no corpo da requisição: a projeção publicada descreve
 * o material, não o que o Admin digitou.
 *
 * `segredoCifrado` é **texto opaco** para este módulo — ver o cabeçalho. Ele não tem forma declarada
 * aqui de propósito: quem define o envelope é o módulo de cifra, e conferir a forma dele nesta camada
 * criaria uma segunda declaração do formato, livre para divergir da primeira.
 *
 * ⚠️ **Não há `empresaId`**, e a ausência é o mecanismo: a empresa é a do contexto que a unidade de
 * trabalho fixou, e um parâmetro aqui seria a segunda origem de contexto que a ADR-0008 fecha.
 */
export interface DadosDoCertificado {
  readonly titular: string;
  readonly validoDe: Date;
  readonly validoAte: Date;
  readonly impressaoDigital: string;
  /** O **cifrado**, nunca o segredo. Este módulo não sabe o que há dentro dele (ADR-0032). */
  readonly segredoCifrado: string;
  /** O usuário da sessão. A chave estrangeira composta o amarra à empresa do contexto. */
  readonly registradoPor: string;
}

/**
 * O certificado como as portas deste módulo o devolvem — **oito** campos, e nenhum é segredo.
 *
 * O conjunto é enumerado campo a campo, e não derivado da linha do banco: `segredo_cifrado` está a
 * uma coluna de distância, e uma projeção montada por `SELECT *` o carregaria para dentro de toda
 * resposta na primeira vez que alguém acrescentasse um campo. Publicar é ato deliberado — a mesma
 * razão pela qual `esquemaDoCertificado`, em `@sysloc/contracts`, enumera os dele.
 *
 * `estado` e `diasParaVencer` **não** estão aqui, e a ausência é a ADR-0022: eles são derivados da
 * validade contra a data corrente, no instante da leitura, e gravá-los ou projetá-los daqui criaria
 * uma segunda fonte do mesmo fato — que a passagem do tempo faria divergir sozinha.
 *
 * `substituidoEm` **está** aqui, e é o que distingue o vigente do histórico sem uma segunda projeção:
 * duas listas de colunas descrevendo a mesma linha ficariam livres para divergir, e a divergência
 * apareceria como um campo que existe numa leitura e some na outra.
 */
export interface CertificadoGravado {
  readonly id: string;
  readonly titular: string;
  readonly validoDe: Date;
  readonly validoAte: Date;
  readonly impressaoDigital: string;
  /** Autoria é **uma coisa só** — achatar em dois campos convidaria a publicar um sem o outro. */
  readonly registradoPor: { readonly id: string; readonly nome: string };
  readonly registradoEm: Date;
  /** Nulo **é** ser o vigente. Não nulo é o instante em que a substituição aconteceu. */
  readonly substituidoEm: Date | null;
}

/**
 * A validade do certificado terminou antes da data corrente da operação (RN-03/CA-06).
 *
 * É **classe de erro**, e não caminho para dado: ela sai do índice do pacote pelo mesmo critério de
 * `ErroDeUnidadeAninhada` e de `ErroDeContadorForaDaLargura`, para que quem a traduza no envelope da
 * ADR-0017 reconheça a recusa pelo **tipo** — e não pelo texto da mensagem, que amarraria a tradução
 * ao idioma configurado no servidor.
 *
 * Ela carrega `validoAte` porque a CA-06 exige que a recusa informe **a data em que venceu**; a
 * mensagem, essa, não ecoa valor algum, pela razão de sempre: ela pode alcançar o registro
 * estruturado.
 */
export class ErroDeCertificadoVencido extends Error {
  override readonly name: string = 'ErroDeCertificadoVencido';

  /** O fim da validade lido do material — é ele que a borda publica na recusa. */
  readonly validoAte: Date;

  constructor(validoAte: Date) {
    super('a validade do certificado terminou antes da data corrente da operação');
    this.validoAte = validoAte;
  }
}

/**
 * A projeção publicada, escrita **uma vez** e reusada pelas três leituras deste arquivo.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo padrão, e mesma
 * justificativa, de `colunasDaCobranca` em {@link ./cobranca.ts}.
 *
 * ⚠️ **`segredo_cifrado` não está na lista, e a ausência é a asserção.** Ela é o mecanismo inteiro da
 * RN-02: o envelope só sai por {@link obterEnvelopeCifradoDoVigente}, que é uma consulta própria com
 * um consumidor só. Acrescentar a coluna aqui a levaria, de uma vez, ao registro, ao histórico e a
 * toda resposta que os publique.
 *
 * `empresa_id` também não está — o que a porta devolve é o que o contrato publica, e a empresa é a do
 * contexto de quem perguntou.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir num ponto só é o que impede oito traduções livres para divergir.
 */
function colunasDoCertificado(tx: TransactionSql): Fragment {
  return tx`
    c.id,
    c.titular,
    c.valido_de AS "validoDe",
    c.valido_ate AS "validoAte",
    c.impressao_digital AS "impressaoDigital",
    jsonb_build_object('id', u.id, 'nome', u.nome) AS "registradoPor",
    c.criado_em AS "registradoEm",
    c.substituido_em AS "substituidoEm"
  `;
}

/**
 * Registra o certificado da empresa do contexto, **substituindo** o vigente anterior se houver.
 *
 * As três instruções correm na transação recebida, nesta ordem e por estas razões (o cabeçalho as
 * desenvolve): **conferir** a vigência antes de qualquer escrita, **anular** o anterior e **inserir**
 * o novo. Falha em qualquer ponto desfaz as anteriores, e a empresa continua exatamente como estava.
 *
 * ⚠️ **Ela não abre unidade de trabalho** — recebe a de quem chamou (decisão D1). É isso que torna a
 * substituição um commit só; abrir aqui bateria em `ErroDeUnidadeAninhada`, e comitar a anulação
 * separadamente abriria precisamente a janela em que a empresa fica sem identidade e sem substituto.
 *
 * **Não é idempotente, e a não-idempotência é a decisão**: dois envios do mesmo material são duas
 * renovações, e a segunda substitui a primeira. Uma chave de idempotência aqui esconderia a renovação
 * legítima de um certificado reemitido com o mesmo titular.
 *
 * **Não há leitura prévia do vigente.** Saber se existe anterior não muda instrução nenhuma: o
 * `UPDATE` alcança zero linhas quando não há, e conjunto vazio é resultado legítimo — o primeiro
 * registro de uma empresa passa por aqui exatamente como uma renovação.
 */
export async function registrarCertificado(
  tx: TransactionSql,
  dados: DadosDoCertificado,
): Promise<CertificadoGravado> {
  await recusarCertificadoVencido(tx, dados.validoAte);

  // DECISÃO FECHADA — T7 / Gates 1 e 2 · 2026-08-15
  // O QUÊ: a anulação do vigente anterior (`UPDATE`) corre ANTES da inserção do novo (`INSERT`), e a
  //        conferência de vigência corre antes das duas.
  // POR QUÊ: a ordem idiomática — inserir o novo e depois anular o antigo — foi descartada por razão
  //          concreta, não por gosto: `certificado_do_provedor_vigente_uidx` é índice único PARCIAL
  //          sobre `empresa_id` onde `substituido_em IS NULL`; índice único parcial não aceita
  //          `DEFERRABLE`, de modo que a inserção colidiria em `23505` com o próprio vigente que ela
  //          substitui, e a renovação legítima morreria. ⚠️ A §3.2 e o título da §3.4 da task
  //          continuam descrevendo a ordem inversa (`INSERT` do novo e depois `UPDATE`): quem fizer a
  //          arqueologia pela task, e não por aqui, reordena e quebra a renovação.
  // REVERTER EXIGE: provar que a unicidade do vigente por empresa passou a ser adiável até o fim da
  //                 transação (índice único parcial não aceita DEFERRABLE), ou que a inserção do novo
  //                 deixou de colidir com o vigente que ela substitui.
  //
  // A anulação do anterior. **Sem `WHERE empresa_id`** — quem recorta é a política (ADR-0008) —, e
  // sem `LIMIT`: o índice único parcial já garante que `substituido_em IS NULL` alcança no máximo uma
  // linha por empresa, e um limite escrito aqui esconderia o estado impossível em vez de o denunciar.
  //
  // As duas colunas mudam **na mesma instrução**, e a `CHECK` da RN-13 é o que torna qualquer outra
  // combinação irrepresentável: anular o carimbo sem apagar o segredo, ou o contrário, é recusado
  // pelo banco em vez de depender de quem escreveu a instrução ter lembrado das duas.
  await tx`
    UPDATE negocio.certificado_do_provedor
       SET substituido_em = pg_catalog.now(),
           segredo_cifrado = NULL
     WHERE substituido_em IS NULL
  `;

  // A inserção e a leitura da projeção viajam numa instrução só: o `RETURNING` do `INSERT` não
  // alcança `identidade.usuario`, e uma segunda consulta para buscar o autor seria uma ida a mais ao
  // banco dentro da transação — mais tempo de conexão física segurada, pela razão da §7.4.
  const [gravado] = await tx<CertificadoGravado[]>`
    WITH inserido AS (
      INSERT INTO negocio.certificado_do_provedor
                  (empresa_id, titular, valido_de, valido_ate, impressao_digital,
                   segredo_cifrado, registrado_por)
      VALUES (${empresaDoContexto(tx)}, ${dados.titular}, ${dados.validoDe}, ${dados.validoAte},
              ${dados.impressaoDigital}, ${dados.segredoCifrado}, ${dados.registradoPor})
      RETURNING *
    )
    SELECT ${colunasDoCertificado(tx)}
      FROM inserido c
      JOIN identidade.usuario u ON u.id = c.registrado_por
  `;

  if (gravado === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta, e o `JOIN` casa por chave estrangeira que o banco já impôs. O ramo existe porque o
    // tipo do driver admite o arranjo vazio, e um `as` no lugar dele trocaria uma falha nomeada por
    // um `undefined` viajando como se fosse um certificado registrado.
    throw new Error('o certificado do provedor foi gravado e a linha não voltou do INSERT');
  }

  return gravado;
}

/**
 * O certificado **vigente** da empresa do contexto, ou `undefined` quando ela não tem nenhum.
 *
 * *Vigente* é `substituido_em IS NULL`, e nada mais — não há coluna de estado a consultar, porque o
 * estado publicado é derivado da validade no instante da leitura (ADR-0022). Um certificado **vencido
 * continua sendo o vigente**: ele é o que a empresa tem, e é justamente isso que a consulta precisa
 * publicar para que o Admin saiba que precisa renovar.
 *
 * ⚠️ **Nunca devolve `segredo_cifrado`** — ver {@link colunasDoCertificado}. `undefined` significa
 * uma coisa só para quem chama: a empresa do contexto não tem certificado, e é a borda que traduz
 * isso no `404` que a RN-01 exige.
 */
export async function lerCertificadoVigente(
  tx: TransactionSql,
): Promise<CertificadoGravado | undefined> {
  const [vigente] = await tx<CertificadoGravado[]>`
    SELECT ${colunasDoCertificado(tx)}
      FROM negocio.certificado_do_provedor c
      JOIN identidade.usuario u ON u.id = c.registrado_por
     WHERE c.substituido_em IS NULL
  `;

  return vigente;
}

/**
 * Todos os certificados da empresa do contexto, **do mais recente para o mais antigo**.
 *
 * A ordem começa pelo índice `certificado_do_provedor_historico_idx`, e é a ordem em que o histórico
 * é lido: quem pergunta *"com qual material aquela emissão foi assinada?"* começa pelo fim.
 *
 * ⚠️ **`criado_em` sozinho não é ordem total, e por isso ele não decide sozinho.** O padrão da coluna
 * é `now()`, que é `transaction_timestamp()`: duas linhas gravadas na **mesma** unidade de trabalho
 * recebem o instante idêntico, e um `ORDER BY` que parasse ali deixaria a ordem entre elas ao critério
 * do plano. Os dois desempates são escritos: `substituido_em DESC NULLS FIRST` põe o vigente à frente
 * dos substituídos — é o que torna a frase seguinte verdadeira **por construção**, e não por sorte —, e
 * `id DESC` fecha a ordem total, para que a mesma consulta devolva sempre a mesma sequência. O índice
 * segue servindo o prefixo.
 *
 * O conjunto **inclui o vigente** — ele é o primeiro item —, porque o histórico é o registro inteiro
 * da identidade da empresa, e recortá-lo obrigaria quem consulta a somar duas leituras para ter a
 * lista completa.
 *
 * **Não há janela**, e a ausência é deliberada: a coleção cresce cerca de um item por ano por empresa
 * (a validade do material é anual), de modo que um envelope paginado aqui seria complexidade sem
 * caso. **Nunca devolve `segredo_cifrado`** — dos substituídos ele nem existe mais, e do vigente ele
 * só sai por {@link obterEnvelopeCifradoDoVigente}.
 */
export async function lerHistoricoDeCertificados(
  tx: TransactionSql,
): Promise<CertificadoGravado[]> {
  const certificados = await tx<CertificadoGravado[]>`
    SELECT ${colunasDoCertificado(tx)}
      FROM negocio.certificado_do_provedor c
      JOIN identidade.usuario u ON u.id = c.registrado_por
     ORDER BY c.criado_em DESC, c.substituido_em DESC NULLS FIRST, c.id DESC
  `;

  return [...certificados];
}

/**
 * O envelope cifrado do vigente — a **única** operação deste módulo que devolve o segredo guardado.
 *
 * Ela é separada das leituras acima de propósito, e a separação é o mecanismo da RN-02: o envelope
 * não viaja junto da projeção publicada, de modo que nenhuma resposta o carrega por acidente. Quem a
 * chama tem **um** consumidor legítimo — a verificação da identidade no provedor, que decifra fora
 * deste pacote e constrói o cliente mTLS.
 *
 * O que ela devolve é **opaco** aqui (ADR-0032): este módulo não sabe abrir o envelope, e não importa
 * nada que saiba. `undefined` significa que a empresa do contexto não tem certificado vigente, e é a
 * mesma ausência que {@link lerCertificadoVigente} reporta — a borda a traduz no `404` da RN-01
 * **sem tentar identidade alguma**.
 *
 * A coluna é anulável na tabela, mas **não** no vigente: a `CHECK` da RN-13 torna
 * "vigente sem segredo" irrepresentável. É por isso que o tipo devolvido não admite `null` dentro da
 * linha — a única ausência possível é a da própria linha.
 */
export async function obterEnvelopeCifradoDoVigente(
  tx: TransactionSql,
): Promise<string | undefined> {
  const [vigente] = await tx<{ segredoCifrado: string }[]>`
    SELECT segredo_cifrado AS "segredoCifrado"
      FROM negocio.certificado_do_provedor
     WHERE substituido_em IS NULL
  `;

  return vigente?.segredoCifrado;
}

/**
 * As duas pontas do **eixo de data da operação** que a vigência publicada compara (RN-04, ADR-0026).
 *
 * Os dois campos são **dias de calendário** em `AAAA-MM-DD`, e não instantes: quem os consome é uma
 * função pura da aplicação, que subtrai um do outro sem relógio, sem fuso e sem banco.
 */
export interface VigenciaObservada {
  /** O dia em que a validade do material termina, **no fuso da operação**. */
  readonly fimDaValidade: string;
  /** O dia corrente da operação — `negocio.data_corrente_da_operacao()`, sem intermediários. */
  readonly dataCorrente: string;
}

/**
 * Observa a validade de um certificado contra a data corrente da operação — **numa consulta só**.
 *
 * ===========================================================================
 * POR QUE ELA EXISTE, e por que ela devolve DUAS datas em vez de uma
 * ===========================================================================
 *
 * A ADR-0026 manda a aplicação receber *"o instante já resolvido, por parâmetro"*, e a ADR-0023 manda
 * a derivação de apresentação viver na aplicação. Entre as duas sobra uma pergunta que só o banco
 * responde: **em que dia da operação** aquele instante cai. Devolver apenas a data corrente deixaria
 * essa redução para a borda, que precisaria declarar o fuso da operação **fora deste pacote** — um
 * eixo a mais, agora do outro lado da fronteira, e o que ele faria divergir é a coerência entre a
 * recusa do registro (RN-03, aqui ao lado) e o estado publicado na consulta (RN-04): o mesmo
 * certificado recusado por vencido numa rota e anunciado como `VENCENDO` na outra, no mesmo dia.
 *
 * A redução usa **a mesma forma** de {@link recusarCertificadoVencido} — `date` contra `date`, com o
 * fuso escrito na instrução e nenhum operando promovido pelo fuso da **sessão** —, e a partir da
 * **mesma** constante. É isso que torna as duas respostas consistentes por construção.
 *
 * ⚠️ **Ela não decide nada.** Não classifica, não compara e não conhece o limiar de vencimento: quem
 * decide é `derivarEstadoDaVigencia`, na borda, que é pura e por isso exercitável sem banco. Trazer a
 * classificação para cá poria a derivação de apresentação no banco, contra a ADR-0023, e tornaria o
 * limiar de 30 dias um segundo fato executável ao lado de `LIMIAR_DE_VENCIMENTO_EM_DIAS`.
 *
 * Ela **recebe** o executor, como as quatro acima: não abre conexão, não reserva e não devolve
 * executor. E não recebe `empresaId` — ela não lê linha de tabela alguma, apenas expressões.
 */
export async function lerVigenciaObservada(
  tx: TransactionSql,
  validoAte: Date,
): Promise<VigenciaObservada> {
  const [observada] = await tx<VigenciaObservada[]>`
    SELECT to_char((${validoAte}::timestamptz AT TIME ZONE ${FUSO_DA_OPERACAO})::date,
                   ${FORMATO_ISO_DO_DIA}) AS "fimDaValidade",
           to_char(negocio.data_corrente_da_operacao(), ${FORMATO_ISO_DO_DIA}) AS "dataCorrente"
  `;

  if (observada === undefined) {
    // Inalcançável: a consulta é escalar e sem predicado. O ramo existe pela mesma razão do irmão em
    // {@link recusarCertificadoVencido} — o tipo do driver admite o arranjo vazio, e um `as` no lugar
    // dele faria um `undefined` viajar como se fosse o eixo de data da operação.
    throw new Error('o banco não respondeu a data corrente da operação');
  }

  return observada;
}

/**
 * Recusa, **antes de qualquer escrita**, o certificado cuja validade já terminou (RN-03/CA-06).
 *
 * A comparação corre **no banco**, contra `negocio.data_corrente_da_operacao()` — o mesmo eixo de
 * data que a cobrança usa, e o único do produto (ADR-0026). Ela é feita em granularidade de **dia**,
 * como a §6.2 fixa (`VENCIDO` quando `validoAte < hoje`), e não em instante: usar `pg_catalog.now()`
 * aqui criaria um **segundo eixo** de vigência, e o mesmo certificado poderia ser recusado no registro
 * e publicado como vigente na consulta do mesmo dia.
 *
 * ⚠️ **Os dois lados são `date`, e é o único arranjo em que a resposta não depende de quem pergunta.**
 * O fim da validade é um `timestamptz` — um instante — e a data corrente da operação é um `date`; um
 * `<` entre os dois **não** é uma comparação escrita, é uma promoção implícita: o servidor leva o
 * `date` à meia-noite do fuso da **sessão**, que este repositório não declara em lugar nenhum. Por
 * isso a redução do instante a dia acontece **aqui, com o fuso escrito na instrução**, antes do `<`.
 * A forma é a mesma que a `0010` e {@link ./envio-de-cobranca.ts} já usam contra este eixo: `date`
 * contra `date`, sem operando promovido.
 *
 * **Nada disto acontece no processo.** Ler a data corrente e comparar em TypeScript é a forma que a
 * ADR-0026 admite, mas ela obrigaria a converter uma coluna `date` num `Date` do fuso do processo —
 * exatamente o deslocamento de um dia que o cabeçalho de {@link ./cobranca.ts} registra. Deixar a
 * comparação inteira no banco não tem esse custo e não tem relógio a mais.
 */
async function recusarCertificadoVencido(tx: TransactionSql, validoAte: Date): Promise<void> {
  // O fuso vem do lar único do pacote (`./fuso-da-operacao.ts`), e não de um literal escrito aqui:
  // é o que o fecho do `D25 · F4/T7` estabeleceu, e é o que faz esta recusa e a vigência publicada
  // por `lerVigenciaObservada` partirem do MESMO fato executável.
  const [vigencia] = await tx<{ vencido: boolean }[]>`
    SELECT (${validoAte}::timestamptz AT TIME ZONE ${FUSO_DA_OPERACAO})::date
             < negocio.data_corrente_da_operacao() AS vencido
  `;

  if (vigencia === undefined) {
    // Inalcançável: a consulta é escalar e sem predicado. O ramo existe porque o tipo do driver
    // admite o arranjo vazio, e um `as` no lugar dele deixaria a conferência ser pulada em silêncio —
    // que é precisamente o defeito que esta função existe para impedir.
    throw new Error('o banco não respondeu se a validade do certificado já terminou');
  }

  if (vigencia.vencido) {
    throw new ErroDeCertificadoVencido(validoAte);
  }
}
