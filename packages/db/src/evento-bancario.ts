/**
 * Trilha bancária — o registro do **efeito** perante o provedor e a leitura dela por cobrança.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./envio-de-cobranca.ts} e
 * {@link ./certificado-do-provedor.ts} já registram: a contenção da §11.2 é de **tipo** e não alcança
 * **texto de SQL**. Um serviço de aplicação com o executor da unidade de trabalho em mãos escreve
 * `negocio.evento_bancario` numa cadeia sem importar nada de proibido, e o alcance às tabelas do
 * domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As duas funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * A TRILHA REGISTRA EFEITO, NUNCA TENTATIVA (ADR-0034)
 * ---------------------------------------------------------------------------
 *
 * {@link registrarEventoBancario} é chamada **apenas** quando algo mudou de fato — boleto emitido,
 * boleto revogado, emissão recusada, cobrança liquidada, liquidação estornada, divergência de valor.
 * São exatamente os **seis** rótulos de `TIPOS_DE_EVENTO_BANCARIO`, e a lista fechada é a declaração
 * que a ADR-0034 exige de cada integração (*"cada integração declara quais desfechos são anômalos
 * para ela; a ADR fixa o critério, não a lista"*).
 *
 * **A conferência que encontrou tudo como estava NÃO chama esta função.** É por isso que
 * `CONFERENCIA` é *origem* e não *tipo*: quem confere aparece na trilha como **produtor** do efeito
 * que houve, nunca como um evento próprio. A medição que sustenta a decisão está no `Context` da
 * ADR: `1.837` dos `1.864` eventos do sistema antigo — **98,6%** — são consultas que nada mudaram, e
 * é a rota de histórico (US-08) que fica ilegível quando elas entram.
 *
 * ⚠️ A ADR **exclui do próprio alcance** o registro operacional de diagnóstico: *"nenhuma leitura
 * desta ADR autoriza apagar o segundo"*. A linha de `debug` do Pino segue livre para registrar todo
 * contato com o provedor — a fronteira é entre o que o produto **publica** como trilha e o que ele
 * guarda para depurar, e este arquivo é só a primeira metade.
 *
 * ---------------------------------------------------------------------------
 * `diagnostico` É TEXTO OPACO, e a inocuidade vem de NADA o interpretar (ADR-0001, RN-15)
 * ---------------------------------------------------------------------------
 *
 * A coluna guarda o que o provedor informou **tal como informado**, reconhecido ou não. Ela não vira
 * regra nem estado: nenhum ramo do produto a lê para decidir coisa alguma, e é essa ausência — não
 * uma previsão de quais motivos podem chegar — que torna o motivo desconhecido inócuo. Um `switch`
 * sobre este campo, em qualquer camada, reintroduz o vocabulário do provedor na decisão do produto,
 * que é o que a `Decision` da ADR-0001 fecha.
 *
 * Ela também **não é pareada com `tipo` por nenhuma `CHECK`**, e a ausência é decisão da T2: uma
 * bicondicional congelaria no banco o mapeamento tipo→carga, que é do adaptador e muda com o
 * provedor — ver o cabeçalho de `eventoBancario` em {@link ./esquema/negocio.ts}.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** A tabela nasce com RLS **forçada**
 * (`migracoes/0018_seguranca_emissao_e_conciliacao.sql`), de modo que a política é avaliada com os
 * direitos de quem consulta. Acrescentar `empresaId` à assinatura seria escrever em código a
 * comparação que a política já faz — a "defesa em profundidade" que a `Decision` da ADR-0008 rejeita
 * por escrito, e o segundo caminho para o mesmo dado que ela nomeia.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é `NOT NULL`
 * e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal das políticas
 * avaliada dentro da própria instrução. E o evento que apontasse para cobrança de **outra** empresa é
 * impossível sem que nada aqui o confira: a chave estrangeira composta
 * `evento_bancario_cobranca_empresa_fkey` recusa o par que não existe.
 *
 * Por isso {@link lerTrilhaDaCobranca} devolve **lista vazia** tanto para a cobrança sem trilha
 * quanto para a de outra empresa — as duas ausências são deliberadamente **indistinguíveis**, e a
 * borda (T14) traduz a segunda no mesmo `404` que `localizarCobranca` já produz, **num ponto único**.
 * Traduzi-la aqui daria ao cliente a informação de que aquele identificador existe em algum lugar.
 *
 * ---------------------------------------------------------------------------
 * AS DUAS CHAVES, E POR QUE ELAS SÃO DIFERENTES (ADR-0017)
 * ---------------------------------------------------------------------------
 *
 * A **escrita** recebe o `cobrancaId` — o UUID interno —, e a **leitura** recebe o `codigo`. A
 * assimetria não é descuido, e cada ponta tem a sua razão:
 *
 *   * quem grava um efeito **já leu a cobrança** para descobrir que algo mudou, e o que a linha
 *     guarda é a chave estrangeira **composta** `(cobranca_id, empresa_id)` — é ela, e não uma
 *     conferência escrita aqui, que recusa a cobrança inexistente e a de outra empresa;
 *   * quem lê a trilha é a **borda**, e o que chega na borda é a chave exposta (ADR-0017), porque é
 *     ela que a rota nomeia. A tradução acontece **dentro da instrução**, por junção — nenhum
 *     símbolo publicado deste pacote entrega o UUID interno de uma cobrança, e não deve entregar:
 *     abrir esse caminho seria alargar `LinhaDeCobranca` com uma chave que rota nenhuma aceita, ou
 *     criar uma consulta de tradução avulsa, que é um segundo caminho para o mesmo recorte.
 *
 * É o mesmo desenho de `lerEnviosDaCobranca` em {@link ./envio-de-cobranca.ts}, cujo docblock já
 * declara a prática: *"a cobrança é alcançada pelo código (ADR-0017), com a junção fazendo a
 * tradução"*.
 *
 * ---------------------------------------------------------------------------
 * O RELÓGIO É O DO BANCO (ADR-0026), e o DINHEIRO CONVERTE NO PONTO ÚNICO
 * ---------------------------------------------------------------------------
 *
 * Não há `new Date()` neste arquivo, e não pode haver: `ocorrido_em` nasce do `DEFAULT now()` da
 * tabela, e não há parâmetro por onde propô-lo. Ele é **carimbo de ato** — o instante em que o efeito
 * foi registrado —, e não relógio de decisão de negócio: nada nesta trilha decide comportamento, de
 * modo que a ADR-0026 incide aqui apenas na proibição do segundo relógio.
 *
 * `valor_informado` é `numeric(15,2)` e **chega do driver em texto**; quem o converte em número é
 * {@link eventoPublicado}, no **ponto único** da tradução da consulta em contrato, com o nulo
 * atravessando intacto. É a mesma escolha, e a mesma razão medida, de `cobrancaPublicada` em
 * {@link ./cobranca.ts}: *"sem esta função o JSON sairia com `"1266.25"` entre aspas e nada
 * acusaria"*.
 *
 * ⚠️ **É esta a convenção do pacote, e é a que as leituras seguintes desta fatia (T4 a T6) devem
 * seguir**: cadeia na **escrita** (o valor que o provedor declarou entra tal como veio, sem passar
 * por ponto flutuante) e **número na projeção publicada**, convertido numa função nomeada que copia
 * campo a campo. O precedente contrário que este arquivo citava — `CandidataAoAviso.valorTotal` — não
 * é análogo: aquele é tipo de **porta de domínio**, sem contraparte publicada em esquema Zod, de modo
 * que ali não há assimetria alguma a resolver. Aqui há: `esquemaDoEventoBancario.valorInformado` é
 * `z.number().nullable()`, e uma linha em cadeia empurraria a conversão para a borda — um segundo
 * lugar onde `numeric` vira JSON, livre para divergir do primeiro.
 */

// Os tipos vêm do contrato e **nada é redigitado** (ADR-0016): `TipoDeEventoBancario` e
// `OrigemDoEventoBancario` são as uniões que governam os dois enums do banco, e `EventoBancario` é o
// recurso publicado — de que {@link LinhaDeEventoBancario} deriva, campo a campo, pelo compilador.
import type {
  EventoBancario,
  OrigemDoEventoBancario,
  TipoDeEventoBancario,
} from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem lar único em `./contexto-de-escrita.ts`; ele **não é
// filtro** (nenhuma leitura deste arquivo o aplica, porque a tabela já tem política), e existe só para
// a escrita, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// O molde do instante tem **casa única** em `./moldes-de-formatacao.ts`, e é importado em vez de
// recopiado — este arquivo foi o terceiro consumidor, e é ele que fez o limiar de três disparar. Ver
// o cabeçalho daquele módulo.
import { FORMATO_ISO_DO_INSTANTE } from './moldes-de-formatacao.js';

/**
 * O efeito a registrar — o que a camada de cima informa, e nada além disso.
 *
 * **Não há `empresaId`, e a ausência é o mecanismo** (ADR-0008): o recorte é da política, e um campo
 * aqui seria a comparação de empresa escrita na aplicação. Também não há `ocorridoEm`: o instante é
 * fato do banco (ADR-0026), e um parâmetro daria a quem chama — e a quem verifica — o poder de
 * escolher quando o efeito aconteceu.
 *
 * `cobrancaId` é o **UUID interno** da cobrança, e não o código legível: a linha guarda a chave
 * estrangeira composta, e a tradução da chave exposta (ADR-0017) acontece de fora, em quem já leu a
 * cobrança para produzir o efeito.
 */
export interface EventoBancarioNovo {
  readonly cobrancaId: string;
  readonly tipo: TipoDeEventoBancario;
  readonly origem: OrigemDoEventoBancario;
  /**
   * O que o provedor informou, **tal como informado** — opaco, e nada o lê para decidir (RN-15).
   *
   * Omitido é o mesmo que ausente: nem todo efeito traz texto do provedor, e nem todo texto acompanha
   * recusa (uma liquidação pode carregar a observação que o extrato trouxe).
   */
  readonly diagnostico?: string | null;
  /**
   * O valor que o provedor declarou, **em cadeia** — `numeric(15,2)`, nunca ponto flutuante.
   *
   * Omitido é o mesmo que ausente: só os eventos que carregam valor o preenchem.
   */
  readonly valorInformado?: string | null;
}

/**
 * Uma linha da trilha, na projeção que o contrato publica — **cinco campos**.
 *
 * Ela **é** `EventoBancario`, e não uma redigitação dele: um campo novo no recurso publicado faz
 * {@link eventoPublicado} deixar de compilar, que é o alarme desejado — em vez de uma linha que a
 * rota publica com o campo faltando. E não há divergência de tipo campo a campo: o que a camada de
 * dados entrega é exatamente o que o esquema publica, com `valorInformado` já em número (ver o
 * cabeçalho deste arquivo).
 *
 * **Não há `id`** — nada aponta para um evento isolado, não há rota que o leia, altere ou apague, e o
 * recurso publicado tampouco o traz. E não há `empresaId`: a coluna de tenant não é publicada.
 */
export type LinhaDeEventoBancario = EventoBancario;

/**
 * O que a consulta de fato lê — igual a {@link LinhaDeEventoBancario} **menos** o tipo do dinheiro.
 *
 * `ocorridoEm` já sai formatado pelo servidor e `diagnostico` atravessa o nulo intacto; o que muda de
 * um tipo para o outro é `valorInformado`, que chega do driver **em texto** porque é assim que
 * `numeric(15,2)` sai dele sem perda. Declarar os dois tipos é o que impede a cadeia crua de escapar
 * pela porta: quem sai daqui é {@link LinhaDeEventoBancario}, e a travessia obriga a passar por
 * {@link eventoPublicado}. Mesmo desenho de `LinhaBrutaDeCobranca` em {@link ./cobranca.ts}.
 */
interface LinhaBrutaDoEvento extends Omit<EventoBancario, 'valorInformado'> {
  readonly valorInformado: string | null;
}

/**
 * O evento copiado campo a campo — **o ponto único** da tradução da consulta em contrato.
 *
 * Os cinco campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer
 * coluna que a projeção venha a ganhar — a começar por `empresa_id` e pelo `id` que o recurso
 * declaradamente não expõe. Mesma decisão de `envioPublicado` em {@link ./envio-de-cobranca.ts}.
 *
 * A cópia tem um segundo efeito, e ele é medido: o objeto que o driver devolve carrega protótipo
 * próprio, montado a partir da descrição das colunas, e devolvê-lo direto faria a comparação estrita
 * da suíte reprovar por **classe** do objeto em vez de por valor.
 *
 * É também **o ponto único da conversão de `numeric`**, no molde de `cobrancaPublicada`: `Number(…)`
 * sobre o texto do driver é o que faz o valor chegar ao consumidor como número, e sem ele o JSON
 * sairia com `"1234.56"` entre aspas — contra `esquemaDoEventoBancario.valorInformado`, que é
 * `z.number()` — **e nada acusaria**. O nulo atravessa **intacto**: `Number(null)` é `0`, e um efeito
 * que não carrega valor passaria a declarar que o provedor informou zero, que é o oposto de "não
 * informou".
 */
function eventoPublicado(linha: LinhaBrutaDoEvento): LinhaDeEventoBancario {
  return {
    tipo: linha.tipo,
    origem: linha.origem,
    ocorridoEm: linha.ocorridoEm,
    diagnostico: linha.diagnostico,
    valorInformado: linha.valorInformado === null ? null : Number(linha.valorInformado),
  };
}

/**
 * Registra **um efeito** na trilha bancária da cobrança.
 *
 * ---------------------------------------------------------------------------
 * CHAMAR ESTA FUNÇÃO É AFIRMAR QUE ALGO MUDOU (ADR-0034)
 * ---------------------------------------------------------------------------
 *
 * Ela não é registro de contato, de tentativa nem de varredura: cada chamada é um fato que a operação
 * vai ler para entender *por que uma cobrança está assim*. A conferência que perguntou por trinta
 * cobranças e encontrou tudo como estava chama esta função **zero vez** — quem conta a passada é o
 * recurso da conferência, que descreve a execução, não o histórico do fato de negócio.
 *
 * ---------------------------------------------------------------------------
 * O que a instrução NÃO tem, e cada ausência é decisão
 * ---------------------------------------------------------------------------
 *
 *   * **`ocorrido_em` não aparece na lista de colunas**: ele nasce do `DEFAULT now()` da tabela
 *     (ADR-0026). Abrir um parâmetro de instante daria a quem chama o poder de escolher quando o
 *     efeito aconteceu, e é por esse instante que a trilha ordena — mesma decisão de
 *     `registrarEnvioDeCobranca`;
 *   * **nenhuma comparação de empresa**, nem no `VALUES` nem em predicado algum: `empresa_id` é
 *     *proposto* por {@link empresaDoContexto} e *aceito ou recusado* pelo `WITH CHECK` da política
 *     (ADR-0008);
 *   * **nenhuma conferência de que a cobrança existe**. Quem a impõe é a chave estrangeira composta
 *     `evento_bancario_cobranca_empresa_fkey`, que recusa tanto o identificador inexistente quanto o
 *     de outra empresa — e recusa **toda** escrita, inclusive as que ainda não existem. Uma leitura
 *     prévia escrita aqui seria uma segunda conferência, livre para divergir da do banco, e perderia
 *     a corrida com uma cobrança apagada entre o `SELECT` e o `INSERT`;
 *   * **nenhum `UPDATE` e nenhum `DELETE`**, aqui nem em lugar nenhum do produto: a linha é registro
 *     de fato, e a ADR-0014 não a alcança (o discriminador dela é *ser referenciável*).
 *
 * O molde do carimbo vem de `./moldes-de-formatacao.ts` **por importação**, e não por uma terceira
 * grafia da mesma cadeia: o instante que a trilha publica, o que a cobrança publica e o que a
 * tentativa de envio publica precisam ter a mesma forma, e três grafias divergem sem que nada acuse.
 * Este arquivo é o terceiro consumidor, e é ele que fez o limiar de três disparar.
 *
 * Ela devolve `void`: o que a camada de cima faz com o efeito registrado é lê-lo pela trilha, e um
 * retorno existiria apenas para ser conferido contra o que a própria chamada acabou de informar.
 */
export async function registrarEventoBancario(
  tx: TransactionSql,
  evento: EventoBancarioNovo,
): Promise<void> {
  await tx`
    INSERT INTO negocio.evento_bancario
                (empresa_id, cobranca_id, tipo, origem, diagnostico, valor_informado)
    VALUES (${empresaDoContexto(tx)},
            ${evento.cobrancaId},
            ${evento.tipo}::negocio.tipo_de_evento_bancario,
            ${evento.origem}::negocio.origem_do_evento_bancario,
            ${evento.diagnostico ?? null},
            ${evento.valorInformado ?? null})
  `;
}

/**
 * Lê a trilha **inteira** de uma cobrança, do efeito mais recente para o mais antigo.
 *
 * ---------------------------------------------------------------------------
 * NÃO HÁ JANELA, e a ausência é conteúdo
 * ---------------------------------------------------------------------------
 *
 * A trilha é pequena **por construção**, e é esse o ganho medido da ADR-0034: `1.864` eventos do
 * legado viram `27` quando só o efeito entra. Paginar um conjunto dessa ordem acrescentaria ao
 * contrato um envelope que ninguém precisa e à leitura um segundo eixo de ordenação para desempatar
 * páginas. Se a trilha um dia crescer, o que a fez crescer é registro de tentativa — e a correção é
 * remover o registro, não paginar o sintoma.
 *
 * ---------------------------------------------------------------------------
 * A COBRANÇA É ALCANÇADA PELO **CÓDIGO**, com a junção fazendo a tradução (ADR-0017)
 * ---------------------------------------------------------------------------
 *
 * O parâmetro é a chave **exposta** — `COB-{ano}-{7 dígitos}` —, que é a que a rota nomeia e a única
 * que a borda tem em mãos: nenhum símbolo publicado deste pacote entrega o UUID interno de uma
 * cobrança, e `LinhaDeCobranca` publica `codigo`, `contratoCodigo` e `locatarioId`, jamais `id`.
 * Receber o UUID aqui deixaria a função **inalcançável** de fora, e a saída seria uma das duas que a
 * ADR-0017 fecha: publicar a chave interna no recurso, ou escrever uma consulta de tradução avulsa —
 * um segundo caminho para o mesmo recorte.
 *
 * A junção é o tradutor, e ela **não** carrega cláusula de empresa: a política forçada recorta as
 * duas relações, e `evento_bancario.cobranca_id` só pode apontar para cobrança da mesma empresa
 * porque a chave estrangeira é composta. Mesmo desenho, e mesmas duas razões, de
 * `lerEnviosDaCobranca` em {@link ./envio-de-cobranca.ts}.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM É CONTEÚDO, e o desempate por `id` sai DE GRAÇA — medido
 * ---------------------------------------------------------------------------
 *
 * `ocorrido_em DESC` é a ordem em que a trilha é **exibida** — o cabeçalho de `eventoBancario`, em
 * {@link ./esquema/negocio.ts}, a declara assim —, e é a do índice `evento_bancario_trilha_idx`
 * `(empresa_id, cobranca_id, ocorrido_em DESC)`, que é quem serve o **acesso**: a política fornece a
 * primeira coluna e a junção a segunda (o `cobranca_id` chega do lado externo do laço, já resolvido
 * pelo código).
 *
 * O desempate por `id DESC` não é ornamento: `now()` é o instante do **início da transação**, de modo
 * que dois efeitos gravados na mesma unidade de trabalho — a liquidação e a divergência de valor da
 * mesma cobrança, por exemplo — carregam carimbos idênticos, e o desempate é o que impede duas
 * leituras da mesma trilha de devolverem ordens diferentes. É o mesmo mecanismo de
 * `lerEnviosDaCobranca`, com uma razão a menos (não há janela a paginar aqui) e uma medida a mais.
 *
 * ⚠️ **A medida, porque a premissa contrária é intuitiva e é falsa.** A §12.2 da tech spec diz que o
 * índice "cobre a leitura da trilha sem ordenação em memória", o que sugeriria que acrescentar `id`
 * ao `ORDER BY` custaria um `Sort`. O `EXPLAIN` na instância efêmera mostra que **o `Sort` existe nas
 * duas formas**, com o mesmo custo (`16.39..16.40` na consulta com a junção) e o mesmo `Index Scan
 * using evento_bancario_trilha_idx` no lado interno do `Nested Loop`: o planejador não deriva a
 * ordenação do prefixo do índice porque a igualdade da primeira coluna vem da expressão
 * `current_setting` da política — expressão `STABLE`, que não entra na classe de equivalência como
 * constante. O desempate, portanto, é determinismo **sem preço** — e sem ele a ordem entre empates
 * seria a de um `Sort`, que não é estável.
 *
 * ⚠️ **A ressalva de alcance, para que a medida não seja lida por mais do que ela é**: o `EXPLAIN`
 * correu sobre instância efêmera com meia dúzia de linhas, e os custos denunciam tabela
 * essencialmente vazia. Ele prova que **o `Sort` aparece** — que é o que a §12.2 negava —, e **não**
 * é evidência forte sobre a forma do plano em volume. A conclusão sobrevive assim mesmo porque a
 * trilha é pequena **por construção** (é o conteúdo da ADR-0034), e não porque o volume tenha sido
 * medido. A anotação correspondente está na própria §12.2, para que quem ler a tech spec sem abrir
 * este arquivo não continue com a premissa falsificada.
 *
 * ---------------------------------------------------------------------------
 * A LISTA VAZIA TEM DUAS CAUSAS, DELIBERADAMENTE INDISTINGUÍVEIS (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * A cobrança não tem trilha, ou é de outra empresa e a política a esconde. Não há aqui `empresa_id`
 * em predicado nenhum, e não há recusa nomeada: quem traduz a ausência em `404` é a borda, **num
 * ponto único**, com o mesmo corpo que `localizarCobranca` já produz.
 */
export async function lerTrilhaDaCobranca(
  tx: TransactionSql,
  codigo: string,
): Promise<readonly LinhaDeEventoBancario[]> {
  const linhas = await tx<LinhaBrutaDoEvento[]>`
    SELECT ev.tipo,
           ev.origem,
           to_char(ev.ocorrido_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "ocorridoEm",
           ev.diagnostico,
           ev.valor_informado AS "valorInformado"
      FROM negocio.evento_bancario ev
      JOIN negocio.cobranca c ON c.id = ev.cobranca_id
     WHERE c.codigo = ${codigo}
     ORDER BY ev.ocorrido_em DESC, ev.id DESC
  `;

  return linhas.map(eventoPublicado);
}
