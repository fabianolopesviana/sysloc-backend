/**
 * A porta do **certificado do provedor** — CT-810, CT-811, CT-818, CT-819, CT-820, CT-821, CT-822,
 * CT-860 e CT-861, da T7 da fatia `fundacao-bancaria`.
 *
 * ⚠️ **Os dois últimos nascem na rodada 2**, como a rede do bloqueante que o Gate 2 levantou (a
 * vigência decidida ao fuso da **sessão**). Eles saem da faixa dos cards de propósito: `CT-823` a
 * `CT-859` já estão reservados pelos cards das tasks T8 a T14 desta fatia, e reusar um deles
 * produziria duas coisas diferentes com o mesmo identificador — que é o que a rastreabilidade existe
 * para impedir.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-09    | CT-810 | A tabela nasce com `empresa_id NOT NULL`, RLS **habilitada E forçada**, a
 * | A6       |        | restrição única `(id, empresa_id)` e o índice único **parcial** do vigente,
 * |          |        | cuja definição contém **literalmente** `WHERE (substituido_em IS NULL)`. O
 * |          |        | controle positivo é o índice do histórico, lido pela **mesma** medição e
 * |          |        | afirmado como não único e sem predicado. |
 * | CA-09    | CT-811 | É o **banco**, e não a aplicação, que impede duas linhas com
 * | A6       |        | `substituido_em IS NULL` na mesma empresa: o `INSERT` **cru**, que contorna
 * |          |        | a porta, é recusado com `23505` nomeando `…_vigente_uidx`, e a contagem
 * |          |        | final de vigentes continua **1**. |
 * | CA-09    | CT-818 | Companheiro negativo **indivisível** do CT-822: a renovação que falha na
 * | A2       |        | inserção do novo deixa o antigo **vigente** e com o `segredo_cifrado`
 * |          |        | **idêntico byte a byte** ao de antes — e não nulo —, com a contagem de
 * |          |        | linhas inalterada. A anulação nunca sobrevive a uma inserção que não
 * |          |        | aconteceu. |
 * | CA-01    | CT-819 | O registro grava o vigente, e a projeção devolve **exatamente** o que se leu
 * | A4       |        | do material — titular, validade nas duas pontas, impressão digital e
 * |          |        | autoria —, com o conjunto de chaves igual ao publicado e **nenhuma** de
 * |          |        | material ou senha. O envelope **está** no banco (controle positivo por
 * |          |        | `obterEnvelopeCifradoDoVigente`) e mesmo assim não sai na projeção. |
 * | CA-05    | CT-820 | A recusa na **entrada** do registro não move nada do vigente anterior: as
 * | A2       |        | duas capturas cruas da linha inteira — todas as colunas, `criado_em` e
 * |          |        | `substituido_em` inclusive — são **idênticas campo a campo**, e a contagem
 * |          |        | de linhas não muda. |
 * | CA-06    | CT-821 | Validade encerrada antes da data corrente é recusada **na entrada**, com a
 * |          |        | recusa informando a data **exata** de fim do material, e **nenhuma linha
 * |          |        | gravada**. A comparação corre contra `negocio.data_corrente_da_operacao()`,
 * |          |        | nunca contra o relógio do processo (ADR-0026). |
 * | CA-09    | CT-822 | A renovação vale na hora: o vigente passa a ser o novo, o anterior segue
 * | A1 · A3  |        | consultável no histórico com os dados públicos **intactos**, e o
 * |          |        | `segredo_cifrado` dele é `NULL` — tudo na **mesma** unidade de trabalho. |
 * | CA-06    | CT-860 | O desfecho da conferência de vigência **não muda** quando a sessão troca de
 * |          |        | fuso: com `TimeZone` fixado num fuso a **leste** do da operação, o material
 * |          |        | vencido no dia anterior continua recusado, com a data exata, e nada é
 * |          |        | gravado. O fuso efetivo da sessão é lido e afirmado — sem isso o caso
 * |          |        | mediria o fuso padrão do `initdb` do host. |
 * | CA-06    | CT-861 | O sentido oposto do mesmo erro: com `TimeZone` num fuso a **oeste**, o
 * |          |        | material cuja validade termina **hoje** continua sendo aceito e gravado. O
 * |          |        | par é o que discrimina — cada metade sozinha aprovaria uma porta que
 * |          |        | recusasse tudo, ou que aceitasse tudo. |
 *
 * Rastreabilidade: `CA-09 → CT-810 (RN-12)` · `CA-09 → CT-811 (RN-12)` · `CA-09 → CT-818 (RN-05)` ·
 * `CA-01 → CT-819 (RN-02)` · `CA-05 → CT-820 (RN-03)` · `CA-06 → CT-821 (RN-03)` ·
 * `CA-09 → CT-822 (RN-05)` · `CA-06 → CT-860 (RN-03)` · `CA-06 → CT-861 (RN-03)`.
 *
 * ===========================================================================
 * ⚠️ ONDE CADA RECUSA MORA — a tensão de spec desta task, resolvida e declarada
 * ===========================================================================
 *
 * Três dos cards descrevem recusas que **pressupõem a leitura do material** (senha que não abre,
 * material ilegível), e a leitura do material é da **T9**, que não existe. Ao mesmo tempo, a §7.4 da
 * tech spec fixa que ela acontece **fora da transação**, e a §3.4 da task fixa que
 * `registrarCertificado(tx, dados)` recebe o que já foi lido e validado. As duas coisas são
 * verdadeiras ao mesmo tempo, e a consequência é literal: **a senha e a legibilidade do material não
 * são representáveis nesta camada** — o A5 proíbe este módulo de decifrar, e uma leitura que falha
 * nem chega a abrir a unidade de trabalho.
 *
 * A resolução, caso a caso, e o que cada um passou a medir:
 *
 *   * **a vigência mora AQUI.** É a única das três condições da RN-03 que o banco não impõe, e o eixo
 *     de comparação dela é `negocio.data_corrente_da_operacao()` — que está no banco (ADR-0026), do
 *     lado de cá da fronteira. `registrarCertificado` a confere **antes de qualquer escrita** e recusa
 *     com {@link ErroDeCertificadoVencido}, que carrega a data exata. O **CT-821** a exercita inteira;
 *   * **o CT-820 mede o EFEITO da recusa de entrada, que é o que a T7 pode medir.** A CA-05 é *"o que
 *     valia antes continua valendo, inalterado"*, e essa metade é sobre o **banco**: nenhuma coluna
 *     movida, nenhum carimbo, contagem intacta. A recusa que esta camada possui na entrada é a de
 *     vigência, e é com ela que o caso a exercita — sobre uma empresa que **já tem vigente**, que é
 *     onde a CA-05 tem o que perder. O eixo dele é distinto do CT-821, e não uma segunda escrita do
 *     mesmo: lá se afirma que **nada nasceu**, aqui que **o que existia não se moveu**;
 *   * **o CT-818 mede a falha NA INSERÇÃO DO NOVO**, que é o A2 literal e o ponto onde o dano seria
 *     irreversível. Uma falha na leitura do material acontece **antes** de a transação abrir e tem
 *     efeito trivialmente nulo no banco — provar isso seria provar o arranjo, não o SUT (AP-29). A
 *     falha usada é real e chega pelo caminho do boundary: `registradoPor` apontando para usuário de
 *     **outra empresa**, que a chave estrangeira composta da ADR-0008 recusa no `INSERT`, já depois de
 *     o `UPDATE` do anterior ter corrido dentro da transação.
 *
 * **Nada foi simulado, e nenhum símbolo de produção existe para o teste enxergar** (Iron Law #6): não
 * há `lerMaterial` provisório, nada é importado de `@sysloc/shared/segredo-operavel`, e o envelope que
 * o arranjo grava é uma cadeia opaca — que é exatamente o que o módulo sob prova acha que ele é.
 *
 * ===========================================================================
 * POR QUE O PAR É O QUE DETECTA, caso a caso
 * ===========================================================================
 *
 * **CT-810 e o AP-29.** *"Existe um índice"* aprovaria dois defeitos opostos: um índice único sobre
 * `empresa_id` **sem** o predicado impediria a própria renovação (a segunda linha da empresa colidiria
 * com a primeira), e um índice **sem unicidade** permitiria dois vigentes. Por isso o texto literal do
 * predicado é asserido, e por isso o **controle positivo** é obrigatório: o índice do histórico é lido
 * pela mesma consulta e afirmado como **não único e sem predicado**. Sem ele, um detector que
 * respondesse *"contém"* para qualquer definição ficaria verde sobre qualquer coisa.
 *
 * **CT-811.** O `INSERT` **cru**, pela conexão de migração, é o que torna a asserção sobre o **banco**
 * e não sobre o módulo: uma prova que passasse pela porta real aprovaria uma conferência escrita em
 * TypeScript, que é justamente o que a §3.5 proíbe.
 *
 * **CT-818 e CT-822 são indivisíveis.** Sozinho, o CT-822 aprova tanto a implementação correta quanto
 * a que anula o anterior **fora** da unidade de trabalho do inserido — e essa segunda perde o segredo
 * da empresa quando a inserção falha. Ninguém recompõe material vindo de terceiro: é dano sem
 * recurso, e é o CT-818 que o reprova. A asserção decisiva dele **não** é a recusa: é o
 * `segredo_cifrado` lido cru do disco, idêntico ao de antes.
 *
 * **CT-819.** A igualdade do conjunto de chaves reprova o campo acrescentado por descuido; a igualdade
 * dos **valores** reprova a projeção que devolve o conjunto certo com conteúdo errado; e o controle
 * positivo por `obterEnvelopeCifradoDoVigente` é o que separa *"a projeção omite o segredo"* de *"não
 * há segredo nenhum gravado"* — sem ele, uma escrita que jogasse fora o envelope passaria.
 *
 * **CT-820.** Comparar a **linha inteira** lida crua — e não só o `id`, nem só a projeção publicada —
 * é o que faz o caso alcançar as colunas em que o dano mora: `substituido_em` e `segredo_cifrado` não
 * aparecem numa comparação sobre a projeção, e são exatamente as duas que uma recusa mal posicionada
 * moveria. Sobre qual mutante ele efetivamente reprova, e sobre um que **não** é observável desta
 * camada, ver o bloco de mutantes abaixo.
 *
 * **CT-860 e CT-861 medem o DESFECHO, e não a expressão.** Nenhum dos dois lê o texto do SQL: eles
 * fixam um `TimeZone` de sessão diferente do fuso da operação e afirmam o que o registro **faz** —
 * recusar o vencido, aceitar o válido. É por isso que a rede alcança a classe inteira e não a linha:
 * qualquer caminho futuro deste módulo que volte a decidir vigência sob o fuso de quem conecta muda o
 * desfecho de um dos dois e reprova, esteja o defeito nesta expressão ou em outra. Os sete casos
 * anteriores **não conseguem** produzir essa falsificação, e a razão é medida: o `TimeZone` padrão do
 * `initdb` neste host é o próprio fuso da operação, de modo que todos eles acertavam por acidente do
 * host — foi exatamente esse vão que deixou o defeito passar na rodada 1.
 *
 * **E cada um deles carrega o controle que impede o verde vazio.** O fuso efetivo é lido de
 * `current_setting('TimeZone')` **dentro da mesma unidade de trabalho** e afirmado por igualdade: sem
 * essa linha, um `SET LOCAL` que não pegasse deixaria o caso rodando no fuso do host — onde a forma
 * defeituosa também passa —, e o par inteiro viraria decoração. Pela mesma razão o fuso da operação é
 * lido do **catálogo**, e não redigitado: se ele e o da sessão coincidissem, os dois casos
 * continuariam verdes sem discriminar coisa alguma.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — a prova de que cada caso discrimina
 * ===========================================================================
 *
 * Aplicados ao fonte de produção e medidos pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — os pacotes resolvem `"."` para
 * `dist/`, e verde de invocação avulsa se leria como "o mutante sobreviveu", invertendo a conclusão.
 *
 *   * **controle** — árvore íntegra: `25 arquivos, 192 casos, 0 falhas`;
 *   * **MT7-1 · a conferência de vigência não recusa nada** — em `recusarCertificadoVencido`, a
 *     comparação vira `SELECT false AS vencido`: `3 failed | 189 passed`. Reprovam o **CT-821** (*"o
 *     registro aceitou um certificado vencido há dez dias"*), o **CT-820** (*"o registro aceitou um
 *     material que devia recusar"*) e o **CT-860**, cada um pelo seu eixo — nada nasce, o que existia
 *     não muda, e o desfecho não depende do fuso da sessão.
 *     ⚠️ A forma óbvia do mutante (apagar a **chamada**) nem compila: `noUnusedLocals` acusa a função
 *     órfã. É barreira de compilador, não de suíte, e vale saber que existe;
 *   * **MT7-3 · a anulação do segredo some** — o `UPDATE` deixa de zerar `segredo_cifrado`:
 *     `2 failed | 188 passed`. O **CT-822** reprova, e a falha vem do próprio banco (`23514`,
 *     `certificado_do_provedor_segredo_chk`); o **CT-818** reprova junto, porque a recusa observada
 *     deixa de ser a da chave estrangeira e passa a ser a da `CHECK`;
 *   * **MT7-4 · a anulação sobrevive à inserção que não aconteceu** — o `INSERT` passa a correr atrás
 *     de um `SAVEPOINT` cujo `catch` **engole a violação** e devolve a primeira linha do histórico, de
 *     modo que `registrarCertificado` retorna com sucesso e a transação comita com o `UPDATE`
 *     aplicado: `1 failed | 189 passed`, e o único vermelho é o **CT-818**. Ele é o mutante pelo qual
 *     o caso existe, e o desenho não é hipotético — `gravarSobRestricaoDoCodigo`, em
 *     {@link ../src/cobranca.ts}, usa exatamente essa maquinaria para traduzir `23505`;
 *   * **MT7-4, com as metades anteriores suprimidas numa CÓPIA do arquivo de teste** — a asserção
 *     decisiva reprova **por conta própria**: `expected null to be 'envelope-cifrado-opaco-ct818-1'`.
 *     É a medição que prova que ela não depende de as anteriores terem falhado antes — sem ela, a
 *     metade que carrega o dano ficaria escondida atrás da asserção da recusa;
 *   * **MT7-5 · a projeção publica o envelope** — `colunasDoCertificado` ganha
 *     `c.segredo_cifrado AS "segredoCifrado"`: `1 failed | 189 passed`, e o vermelho é o **CT-819**,
 *     com o diff exibindo `"segredoCifrado": "envelope-cifrado-opaco-ct819"` na projeção;
 *   * **MT7-6 · a comparação volta a depender do fuso da SESSÃO** — a redução do instante a dia sai e
 *     a expressão volta a ser `${validoAte}::timestamptz < negocio.data_corrente_da_operacao()`, com o
 *     `date` promovido implicitamente à meia-noite do fuso de quem conecta: `2 failed | 190 passed`, e
 *     os dois vermelhos são o **CT-860** (*"sob sessão a leste o registro aceitou material vencido
 *     ontem"*) e o **CT-861** (*"sob sessão a oeste o registro recusou material que ainda vale"*).
 *     ⚠️ **Os outros 190 casos ficam VERDES sob este mutante** — inclusive o CT-820 e o CT-821, que são
 *     os da vigência. É a medição que mostra por que o defeito atravessou a rodada 1 inteira: o
 *     `TimeZone` padrão do `initdb` neste host é o próprio fuso da operação, e sem um caso que troque
 *     o fuso da sessão **nenhuma** asserção desta camada pode reprovar;
 *   * **reversão** — `src/certificado-do-provedor.ts` e este arquivo foram restaurados e conferidos
 *     idênticos aos originais por `diff -q`, e o controle voltou a `192 passed`.
 *
 * ⚠️ **De onde vem cada contagem**: o **MT7-1** e o **MT7-6** foram medidos na **rodada 2**, sobre a
 * árvore de 192 casos. O **MT7-3**, o **MT7-4** e o **MT7-5** são medições da **rodada 1**, sobre a
 * árvore de 190, e **não foram re-executados** — as contagens deles são as daquela árvore, e estão
 * declaradas como tais em vez de reescritas por conta. Apresentar número não medido como medido é o
 * tipo de imprecisão que faz um bloco de mutantes deixar de ser lido.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ O MUTANTE QUE SOBREVIVEU, e por que ele não vira caso novo
 * ---------------------------------------------------------------------------
 *
 * **MT7-2 · a conferência de vigência acontece DEPOIS da anulação** — a chamada de
 * `recusarCertificadoVencido` desce para depois do `UPDATE`: **`190 passed`, nenhum vermelho.**
 *
 * A razão é estrutural, e é a mesma que torna a substituição segura: as três instruções correm na
 * unidade de trabalho de quem chamou, de modo que o `throw` desfaz o `UPDATE` junto. **O estado
 * durável é idêntico nas duas ordens**, e é isso que decide.
 *
 * ⚠️ **A ordem É observável — só não é observável por comportamento**, e a distinção é o argumento
 * inteiro. Uma sonda que chame `registrarCertificado` dentro da mesma unidade de trabalho, capture a
 * recusa e leia `substituido_em` **ainda dentro da transação** reprova sob o mutante e passa no
 * íntegro, sem forjar estado nenhum — o `throw` é da aplicação, não do banco, e a transação não fica
 * abortada. Isso foi **medido** pelo Gate 1, e a versão anterior deste bloco, que alegava
 * impossibilidade, estava mais forte do que os fatos permitem.
 *
 * O caso mesmo assim **não deve existir**, e a razão é outra: ler o meio da transação mede a **ordem
 * interna das instruções**, e não o comportamento do módulo — é o AP-02, e o preço é um caso que
 * reprova em toda reorganização legítima do corpo da função. A ordem `conferir → anular` é higiene
 * **absorvida pela atomicidade**: nenhum consumidor observa o meio da transação, e a ausência de caso
 * não é vão de cobertura, é consequência da propriedade que a task entrega. O que a ordem
 * `anular → inserir` protege — a anulação que **comita** sem substituto — esse sim é comportamento, e
 * é o MT7-4, que o CT-818 reprova.
 *
 * Por isso as duas ordens estão registradas no ponto do código, onde a tentação de reordenar
 * acontece: o cabeçalho de {@link ../src/certificado-do-provedor.ts} as desenvolve, e a ordem
 * `UPDATE → INSERT` carrega marcador `DECISÃO FECHADA` dentro de `registrarCertificado` — porque a
 * §3.2 e o título da §3.4 da task ainda descrevem a ordem inversa, e quem fizer a arqueologia por
 * elas reordena.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada até a `0016`, descartada ao fim. Nenhuma coordenada de
 * conexão é lida do ambiente. As operações correm pelo papel `sysloc_app` — o mesmo da operação —, e
 * a conexão privilegiada aparece **apenas** onde o card de cada caso a autoriza: a leitura crua da
 * coluna (CT-818, CT-819, CT-820, CT-822) e o `INSERT` cru que contorna a aplicação (CT-811).
 *
 * **Nenhum `WHERE empresa_id` é escrito neste arquivo**, nem nas leituras cruas, nem na limpeza entre
 * casos: quem recorta é a política (ADR-0008). É por isso que a conexão privilegiada precisa fixar
 * `app.empresa_id` antes de qualquer instrução — a tabela tem `FORCE ROW LEVEL SECURITY`, e o dono
 * dela também obedece à política.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  type CertificadoGravado,
  type DadosDoCertificado,
  ErroDeCertificadoVencido,
  lerCertificadoVigente,
  lerHistoricoDeCertificados,
  obterEnvelopeCifradoDoVigente,
  registrarCertificado,
} from '../src/certificado-do-provedor.ts';
import { abrirConexao, type Sql } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { EMPRESA_A, EMPRESA_B, USUARIOS, type UsuarioSemeado } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar os três papéis, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas idas ao banco, todas sob unidade de trabalho. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: unidade de trabalho que vazasse reserva trava o caso seguinte. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O que o catálogo tem de dizer — literais do CASO, nunca derivados do SUT
// ---------------------------------------------------------------------------

/** O schema e a tabela sob prova, escritos uma vez. */
const SCHEMA = 'negocio';
const TABELA = 'certificado_do_provedor';

/** A restrição única que a ADR-0008 cobra de toda tabela tenantizada — o alvo da FK composta. */
const UNICA_COMPOSTA = 'certificado_do_provedor_id_empresa_key';

/** O índice único **parcial** que impõe *um vigente por empresa* (RN-12). */
const INDICE_DO_VIGENTE = 'certificado_do_provedor_vigente_uidx';

/** O índice do histórico — o **controle positivo** do CT-810: mesma medição, resposta oposta. */
const INDICE_DO_HISTORICO = 'certificado_do_provedor_historico_idx';

/**
 * O índice da chave primária.
 *
 * Ele entra no conjunto do CT-810 porque `pg_indexes` **também** lista os índices que sustentam
 * restrição — medido. Omiti-lo faria a igualdade reprovar por um fato do catálogo, e trocá-la por
 * contenção para acomodá-lo seria abrir mão justamente do que o caso existe para pegar: o índice
 * acrescentado por descuido.
 */
const INDICE_DA_CHAVE_PRIMARIA = 'certificado_do_provedor_pkey';

/**
 * O predicado do índice parcial, **como o catálogo o imprime**.
 *
 * É literal do caso, e não lido do SUT: derivá-lo da própria definição faria a asserção concordar com
 * qualquer predicado que a migração declarasse — inclusive com nenhum.
 */
const PREDICADO_DO_VIGENTE = 'WHERE (substituido_em IS NULL)';

/** Como o catálogo imprime a unicidade sobre o par tenantizado. */
const DEFINICAO_DA_UNICA_COMPOSTA = 'UNIQUE (id, empresa_id)';

/** O SQLSTATE da violação de unicidade — a recusa que o CT-811 exige do banco. */
const VIOLACAO_DE_UNICIDADE = '23505';

/** O SQLSTATE da violação de chave estrangeira — a falha de inserção do CT-818. */
const VIOLACAO_DE_REFERENCIA = '23503';

/** A chave estrangeira **composta** da ADR-0008, que o CT-818 faz o banco recusar. */
const REFERENCIA_DO_USUARIO = 'certificado_do_provedor_usuario_empresa_fkey';

// ---------------------------------------------------------------------------
// O que a projeção publica — e o que ela jamais pode publicar
// ---------------------------------------------------------------------------

/**
 * As chaves de {@link CertificadoGravado}, em ordem alfabética — literal do caso.
 *
 * A comparação é por **igualdade de conjunto**, nunca por contenção: contenção deixaria passar
 * exatamente o defeito que este conjunto existe para pegar, que é a coluna acrescentada por descuido à
 * projeção compartilhada pelas três leituras.
 */
const CHAVES_PUBLICADAS = [
  'id',
  'impressaoDigital',
  'registradoEm',
  'registradoPor',
  'substituidoEm',
  'titular',
  'validoAte',
  'validoDe',
] as const;

/** As chaves de autoria — objeto próprio, e fechado no mesmo eixo do conjunto acima. */
const CHAVES_DA_AUTORIA = ['id', 'nome'] as const;

/**
 * Os nomes que **jamais** podem aparecer na projeção, nas grafias plausíveis.
 *
 * A igualdade acima já os exclui; esta lista existe porque é ela que **nomeia o dano** quando a
 * asserção reprova — a diferença entre *"o conjunto mudou"* e *"o segredo do provedor está saindo na
 * resposta"*.
 */
const CHAVES_PROIBIDAS = ['material', 'segredo', 'segredoCifrado', 'senha'] as const;

// ---------------------------------------------------------------------------
// Os fusos de SESSÃO do CT-860 e do CT-861 — um de cada lado do fuso da operação
// ---------------------------------------------------------------------------

/**
 * Um fuso de sessão a **leste** do da operação.
 *
 * Sob ele, a comparação que promove o `date` implicitamente aceitava material vencido: a meia-noite
 * do dia corrente cai **antes**, no eixo absoluto, do que cai no fuso da operação, e o fim de validade
 * da noite anterior passa a parecer futuro.
 */
const FUSO_DE_SESSAO_A_LESTE = 'UTC';

/**
 * Um fuso de sessão a **oeste** do da operação.
 *
 * Sob ele o erro tem o sinal contrário: a meia-noite do dia corrente cai **depois**, e o material que
 * ainda vale hoje, mas termina de madrugada, passava a parecer vencido.
 */
const FUSO_DE_SESSAO_A_OESTE = 'America/Los_Angeles';

/** A função do banco que fixa o eixo de data da operação (ADR-0026) — o `0010` a define. */
const FUNCAO_DA_DATA_CORRENTE = 'data_corrente_da_operacao';

/** Fim de validade **tarde da noite** — no fuso a leste, ele cai no dia seguinte. */
const HORA_TARDE_DA_NOITE = '23:00';

/** Fim de validade **logo depois da meia-noite** — no fuso a oeste, ele cai no dia anterior. */
const HORA_APOS_A_MEIA_NOITE = '00:30';

/** Início de validade, a hora do dia em que nada é ambíguo em fuso nenhum. */
const HORA_DO_MEIO_DIA = '12:00';

// ---------------------------------------------------------------------------
// Os atores da carga inicial — derivados dela, nunca redigitados
// ---------------------------------------------------------------------------

/**
 * O usuário que registra o certificado de cada empresa.
 *
 * Ele é **derivado da carga**, e não um literal reescrito aqui: o par `(usuario, empresa)` que a chave
 * estrangeira composta cobra é o mesmo que `semente.ts` gravou, e copiar o identificador criaria uma
 * segunda declaração livre para divergir da carga que a instância efêmera aplica.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);
  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }
  return usuario;
}

const USUARIO_DE_A = exigirUsuarioDa(EMPRESA_A.id);
const USUARIO_DE_B = exigirUsuarioDa(EMPRESA_B.id);

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

/** A validade de um material bom, relativa à data corrente **do banco** — ver {@link instanteEmDias}. */
let VALIDO_DE: Date;
let VALIDO_ATE: Date;

/** A validade de um material vencido há 10 dias, no mesmo eixo. */
let VENCIDO_DE: Date;
let VENCIDO_ATE: Date;

/**
 * O fuso da operação, **lido do corpo da função no catálogo** — ver {@link lerFusoDaOperacao}.
 *
 * Ele não é redigitado aqui de propósito: o CT-860 e o CT-861 precisam de instantes ancorados na
 * meia-noite **daquele** fuso, e um literal copiado neste arquivo seria uma quarta declaração do mesmo
 * fato, livre para divergir das três que o `DÉBITO COM GATILHO — D25` já nomeia.
 */
let FUSO_DA_OPERACAO: string;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });

  // As quatro datas saem do BANCO, deslocadas a partir de `negocio.data_corrente_da_operacao()` — o
  // mesmo eixo que o SUT compara. Montá-las com `new Date()` faria o caso medir a diferença entre dois
  // relógios, e o `-10` do CT-821 deixaria de significar "dez dias antes da data corrente da operação"
  // para significar "dez dias antes do relógio deste processo" (ADR-0026).
  VALIDO_DE = await instanteEmDias(-30);
  VALIDO_ATE = await instanteEmDias(335);
  VENCIDO_DE = await instanteEmDias(-375);
  VENCIDO_ATE = await instanteEmDias(-10);

  FUSO_DA_OPERACAO = await lerFusoDaOperacao();
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/**
 * Cada caso começa com as duas empresas **sem certificado algum**.
 *
 * A limpeza corre pela porta da aplicação, sob a política, e **sem `WHERE empresa_id`**: quem recorta é
 * o banco (ADR-0008), e escrever o filtro aqui seria o segundo caminho para o mesmo recorte que a
 * `Decision` daquela ADR rejeita — inclusive num arranjo, onde ele mascararia uma política quebrada.
 *
 * Ela existe porque o índice único parcial admite **um** vigente por empresa: sem ela, o segundo caso a
 * registrar na mesma empresa faria uma renovação que nenhum card descreve, e a ordem dos casos passaria
 * a ser conteúdo.
 */
beforeEach(async () => {
  for (const empresa of [EMPRESA_A, EMPRESA_B]) {
    await emUnidade(empresa.id, async (tx) => {
      await tx`DELETE FROM negocio.certificado_do_provedor`;
    });
  }
}, LIMITE_DO_CASO_MS);

// ===========================================================================
// CT-810 — anatomia da tabela: o banco impõe o que a aplicação não confere
// ===========================================================================

describe('CT-810 — a tabela nasce com o isolamento e a unicidade que a aplicação não escreve', () => {
  it(
    'CT-810 — `empresa_id` não nulo, RLS habilitada e forçada, única composta e o índice PARCIAL do vigente',
    async () => {
      // --- (a) A coluna de tenant existe e é obrigatória ----------------------------------------
      expect(await colunaEhObrigatoria('empresa_id'), '`empresa_id` admite nulo').toBe(true);

      // --- (b) RLS habilitada E forçada ---------------------------------------------------------
      //
      // As duas, e não só a primeira: sem `FORCE`, o DONO da tabela ignora a política, e a suíte
      // ficaria verde contra um schema sem isolamento algum (ADR-0008, Cons).
      expect(await estadoDaRls()).toEqual({ habilitada: true, forcada: true });

      // --- (c) A restrição única `(id, empresa_id)` — o alvo da FK composta ----------------------
      //
      // Igualdade de conjunto, e não contenção: a única composta é o que torna possível a referência
      // tenantizada da ADR-0008, e uma restrição a mais aqui mudaria o que o banco impõe.
      expect(await unicasDaTabela()).toEqual([
        { nome: UNICA_COMPOSTA, definicao: DEFINICAO_DA_UNICA_COMPOSTA },
      ]);

      // --- (d) Os índices, por igualdade de conjunto --------------------------------------------
      //
      // Ela é a âncora antivácuo das duas asserções seguintes: uma consulta que não achasse índice
      // nenhum deixaria "o índice do vigente é parcial" verdadeira por vacuidade.
      const indices = await indicesDaTabela();

      expect(Object.keys(indices).sort()).toEqual([
        INDICE_DO_HISTORICO,
        UNICA_COMPOSTA,
        INDICE_DA_CHAVE_PRIMARIA,
        INDICE_DO_VIGENTE,
      ]);

      // --- (e) O índice do vigente é ÚNICO e PARCIAL, com o predicado LITERAL --------------------
      //
      // As duas metades matam mutantes opostos, e nenhuma implica a outra: um índice único sobre
      // `empresa_id` **sem** o predicado impediria a própria renovação (a segunda linha da empresa
      // colidiria com a primeira, mesmo já substituída), e um índice **sem** unicidade permitiria dois
      // vigentes. As duas passariam por "existe um índice".
      const doVigente = indices[INDICE_DO_VIGENTE] ?? '';

      expect(doVigente, 'o índice do vigente não é único').toContain('CREATE UNIQUE INDEX');
      expect(doVigente, 'o índice do vigente não é parcial').toContain(PREDICADO_DO_VIGENTE);

      // --- (f) O CONTROLE POSITIVO: a mesma medição, sobre o índice do histórico -----------------
      //
      // Sem ele, um `toContain` que casasse com qualquer definição ficaria verde sobre qualquer coisa —
      // e é exatamente essa a forma do AP-29. O índice do histórico é lido pela MESMA consulta e é
      // afirmado como o oposto em ambos os eixos: não é único e não tem predicado.
      const doHistorico = indices[INDICE_DO_HISTORICO] ?? '';

      expect(
        doHistorico.length,
        'a medição não achou a definição do índice do histórico',
      ).toBeGreaterThan(0);
      expect(doHistorico).not.toContain('CREATE UNIQUE INDEX');
      expect(doHistorico).not.toContain(PREDICADO_DO_VIGENTE);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-811 — dois vigentes são impossíveis, e quem impede é o BANCO
// ===========================================================================

describe('CT-811 — o segundo vigente da mesma empresa é recusado pelo banco', () => {
  it(
    'CT-811 — o `INSERT` cru que contorna a porta recebe `23505` nomeando o índice parcial',
    async () => {
      // O vigente 1 nasce pela porta real — é o estado que a operação produz.
      await registrar(EMPRESA_A.id, dadosDe('ct811'));

      // O `INSERT` **cru**, pela conexão de migração: ele contorna a aplicação inteira. É isso que
      // torna a asserção sobre o BANCO — se a prova passasse pela porta real, ela aprovaria uma
      // conferência de unicidade escrita em TypeScript, que é justamente o que a §3.5 proíbe.
      const recusa = await capturar(async () => {
        await comConexaoPrivilegiada(EMPRESA_A.id, async (sql) => {
          await sql`
            INSERT INTO negocio.certificado_do_provedor
                        (empresa_id, titular, valido_de, valido_ate, impressao_digital,
                         segredo_cifrado, registrado_por)
            VALUES (${EMPRESA_A.id}, 'Titular cru', ${VALIDO_DE}, ${VALIDO_ATE},
                    'impressao-crua', 'envelope-cru', ${USUARIO_DE_A.id})
          `;
        });
      });

      expect(recusa.ok, 'o banco aceitou um segundo vigente para a mesma empresa').toBe(false);
      expect(recusaDe(recusa.erro)).toEqual({
        codigo: VIOLACAO_DE_UNICIDADE,
        restricao: INDICE_DO_VIGENTE,
      });

      // E o estado final: **um** vigente, não dois. Sem esta linha, o caso ficaria verde sobre um banco
      // que recusasse a segunda linha e perdesse a primeira.
      expect(await contarVigentes(EMPRESA_A.id)).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-818 — a renovação que FALHA deixa o antigo vigente e com o segredo intacto
// ===========================================================================

describe('CT-818 — falha na inserção do novo não deixa a empresa pior do que estava', () => {
  it(
    'CT-818 — o vigente continua sendo o 1 e o `segredo_cifrado` dele é idêntico ao de antes',
    async () => {
      const primeiro = await registrar(EMPRESA_A.id, dadosDe('ct818-1'));

      // O envelope lido CRU do disco, antes da tentativa. É contra ele que a asserção decisiva do caso
      // é escrita — e não contra "não é nulo", que ficaria verde sobre um envelope reescrito.
      const envelopeAntes = await lerSegredoCru(EMPRESA_A.id, primeiro.id);
      const linhasAntes = await contarLinhas(EMPRESA_A.id);

      expect(envelopeAntes, 'o arranjo não gravou envelope algum no vigente').not.toBeNull();

      // A renovação que falha **na inserção do novo**: `registradoPor` aponta para o usuário da empresa
      // B, e a chave estrangeira COMPOSTA da ADR-0008 recusa o par `(usuário de B, empresa A)`. É uma
      // falha real, do banco, no ponto em que o `UPDATE` do anterior já correu dentro da transação —
      // que é exatamente onde o dano seria irreversível se a substituição não fosse atômica.
      const recusa = await capturar(
        async () =>
          await registrar(EMPRESA_A.id, {
            ...dadosDe('ct818-2'),
            registradoPor: USUARIO_DE_B.id,
          }),
      );

      expect(recusa.ok, 'o banco aceitou certificado registrado por usuário alheio').toBe(false);
      expect(recusaDe(recusa.erro)).toEqual({
        codigo: VIOLACAO_DE_REFERENCIA,
        restricao: REFERENCIA_DO_USUARIO,
      });

      // --- O que a empresa tem DEPOIS da falha ---------------------------------------------------
      //
      // (a) o vigente continua sendo o 1, inteiro — a projeção é comparada por igualdade, e não só
      // pelo `id`, para que um carimbo movido apareça.
      expect(await lerVigente(EMPRESA_A.id)).toEqual(primeiro);

      // (b) A ASSERÇÃO DECISIVA: o envelope do 1 continua **idêntico byte a byte**. É esta linha que
      // reprova a implementação em que a anulação sobrevive à inserção que não aconteceu — o dano sem
      // recurso, porque material vindo de terceiro ninguém recompõe. `not.toBeNull()` sozinho não
      // bastaria: um envelope reescrito também não é nulo.
      expect(await lerSegredoCru(EMPRESA_A.id, primeiro.id)).toBe(envelopeAntes);

      // (c) E nada nasceu: a contagem de linhas da empresa é a mesma.
      expect(await contarLinhas(EMPRESA_A.id)).toBe(linhasAntes);
      expect(await lerHistorico(EMPRESA_A.id)).toEqual([primeiro]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-819 — o registro grava o vigente, e a projeção não traz segredo
// ===========================================================================

describe('CT-819 — a projeção devolve o que se leu do material, e nada de segredo', () => {
  it(
    'CT-819 — titular, validade e impressão digital iguais aos do material; conjunto de chaves fechado',
    async () => {
      const dados = dadosDe('ct819');
      const gravado = await registrar(EMPRESA_A.id, dados);
      const vigente = await lerVigente(EMPRESA_A.id);

      if (vigente === undefined) {
        throw new Error('o registro não deixou vigente algum para a empresa');
      }

      // --- (a) O carimbo do registro vem do DISCO ------------------------------------------------
      //
      // A comparação da projeção contra o retorno do registro seria tautológica no `registradoEm` — os
      // dois saem do SUT. Esta linha o ancora na coluna `criado_em` lida crua, que é o valor que o
      // banco de fato guardou.
      expect(vigente.registradoEm).toEqual(await lerCriadoEmCru(EMPRESA_A.id, gravado.id));

      // --- (b) A projeção INTEIRA, campo a campo, contra o que se leu do material -----------------
      //
      // Nenhum campo vem do que "chegou no corpo": titular, validade e impressão digital são o que o
      // material declara, e `registradoPor` é o usuário da sessão resolvido pelo `JOIN`.
      expect(vigente).toEqual({
        id: gravado.id,
        titular: dados.titular,
        validoDe: dados.validoDe,
        validoAte: dados.validoAte,
        impressaoDigital: dados.impressaoDigital,
        registradoPor: { id: USUARIO_DE_A.id, nome: USUARIO_DE_A.nome },
        registradoEm: vigente.registradoEm,
        substituidoEm: null,
      } satisfies CertificadoGravado);

      // O registro e a leitura entregam o MESMO objeto: as três leituras compartilham uma projeção só,
      // e duas listas de colunas descrevendo a mesma linha ficariam livres para divergir.
      expect(gravado).toEqual(vigente);

      // --- (c) O conjunto de chaves, por IGUALDADE ------------------------------------------------
      expect(Object.keys(vigente).sort()).toEqual([...CHAVES_PUBLICADAS]);
      expect(Object.keys(vigente.registradoPor).sort()).toEqual([...CHAVES_DA_AUTORIA]);

      // …e a metade que NOMEIA o dano quando a de cima reprovar. Ela é redundante com a igualdade
      // enquanto o conjunto estiver certo, e existe porque a diferença entre "o conjunto mudou" e "o
      // segredo do provedor está saindo na resposta" é o que se quer ler no vermelho.
      const vazadas = CHAVES_PROIBIDAS.filter((chave) => chave in vigente);

      expect(vazadas, `a projeção publica chave de segredo: ${vazadas.join(', ')}`).toEqual([]);

      // --- (d) O CONTROLE POSITIVO: o envelope ESTÁ no banco -------------------------------------
      //
      // Sem ele, o caso ficaria verde sobre uma escrita que jogasse o envelope fora — a projeção não
      // traria segredo pelo motivo errado. A porta que o devolve é UMA, e é ela que a verificação usa.
      expect(await lerEnvelope(EMPRESA_A.id)).toBe(dados.segredoCifrado);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-820 — a recusa na entrada não move NADA do vigente anterior
// ===========================================================================

describe('CT-820 — recusa na entrada do registro não altera coluna alguma do vigente', () => {
  it(
    'CT-820 — as duas capturas cruas da linha inteira são idênticas, e a contagem não muda',
    async () => {
      const anterior = await registrar(EMPRESA_A.id, dadosDe('ct820'));

      // A linha INTEIRA, lida crua — todas as colunas, `criado_em`, `substituido_em` e
      // `segredo_cifrado` inclusive. Comparar só o `id` deixaria passar o carimbo movido por engano,
      // que é precisamente o dano que a CA-05 existe para impedir.
      const antes = await lerLinhaCrua(EMPRESA_A.id, anterior.id);
      const linhasAntes = await contarLinhas(EMPRESA_A.id);

      // A recusa na ENTRADA — a que esta camada possui (ver o bloco da tensão de spec, no cabeçalho).
      // Ela acontece antes de qualquer escrita, e é isso que o caso mede.
      const recusa = await capturar(
        async () =>
          await registrar(EMPRESA_A.id, {
            ...dadosDe('ct820-vencido'),
            validoDe: VENCIDO_DE,
            validoAte: VENCIDO_ATE,
          }),
      );

      expect(recusa.ok, 'o registro aceitou um material que devia recusar').toBe(false);
      expect(recusa.erro).toBeInstanceOf(ErroDeCertificadoVencido);

      // --- A ASSERÇÃO DO CASO: campo a campo, a linha não se moveu ------------------------------
      //
      // Ela reprova o mutante que anula o anterior ANTES de conferir: aquele devolve a mesma recusa e
      // deixa `substituido_em` preenchido e `segredo_cifrado` nulo no que continuava sendo o vigente.
      expect(await lerLinhaCrua(EMPRESA_A.id, anterior.id)).toEqual(antes);

      // …e nada nasceu nem sumiu ao lado dela.
      expect(await contarLinhas(EMPRESA_A.id)).toBe(linhasAntes);
      expect(await lerVigente(EMPRESA_A.id)).toEqual(anterior);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-821 — certificado vencido é recusado na entrada, com a data exata
// ===========================================================================

describe('CT-821 — validade encerrada antes da data corrente da operação é recusada', () => {
  it(
    'CT-821 — a recusa informa a data exata de fim do material, e nenhuma linha é gravada',
    async () => {
      // A empresa começa **sem** certificado — é a precondição do card, e o `beforeEach` a garante.
      expect(await contarLinhas(EMPRESA_B.id)).toBe(0);

      // A validade é montada a partir de `negocio.data_corrente_da_operacao()`, lida do banco: `-10`
      // significa dez dias antes da data corrente **da operação**, e não do relógio deste processo.
      const vencido: DadosDoCertificado = {
        ...dadosDe('ct821'),
        validoDe: VENCIDO_DE,
        validoAte: VENCIDO_ATE,
        registradoPor: USUARIO_DE_B.id,
      };

      const recusa = await capturar(async () => await registrar(EMPRESA_B.id, vencido));

      expect(recusa.ok, 'o registro aceitou um certificado vencido há dez dias').toBe(false);
      expect(recusa.erro).toBeInstanceOf(ErroDeCertificadoVencido);

      // A DATA EXATA: a recusa carrega o fim da validade do material, que é o que a CA-06 manda
      // informar. Asserir só o tipo do erro deixaria passar uma recusa muda, e a borda não teria o que
      // publicar.
      expect(dataDaRecusa(recusa.erro)).toEqual(vencido.validoAte);

      // E **nenhuma linha gravada**. A contagem crua é o que separa "respondeu com recusa" de
      // "respondeu com recusa e não gravou".
      expect(await contarLinhas(EMPRESA_B.id)).toBe(0);
      expect(await lerVigente(EMPRESA_B.id)).toBeUndefined();

      // --- O CONTROLE POSITIVO, no MESMO arranjo -------------------------------------------------
      //
      // Sem ele, o caso ficaria verde sobre uma porta que recusa TUDO — que é o que um predicado
      // escrito ao contrário produziria. O material bom, na mesma empresa e logo em seguida, grava.
      const bom = await registrar(EMPRESA_B.id, {
        ...dadosDe('ct821-bom'),
        registradoPor: USUARIO_DE_B.id,
      });

      expect(bom.validoAte).toEqual(VALIDO_ATE);
      expect(await contarLinhas(EMPRESA_B.id)).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-822 — renovação: o novo vale, o anterior fica, o segredo dele some
// ===========================================================================

describe('CT-822 — a renovação substitui numa unidade de trabalho só', () => {
  it(
    'CT-822 — o vigente passa a ser o 2, o 1 segue no histórico e o segredo dele é anulado',
    async () => {
      const dadosDoPrimeiro = dadosDe('ct822-1');
      const primeiro = await registrar(EMPRESA_A.id, dadosDoPrimeiro);

      // O segundo material tem titular e impressão digital **distintos** do primeiro: sem isso, "o
      // vigente é o 2" seria indistinguível de "o vigente continua sendo o 1".
      const dadosDoSegundo = dadosDe('ct822-2');
      const segundo = await registrar(EMPRESA_A.id, dadosDoSegundo);

      // --- (a) O vigente é o 2, inteiro ----------------------------------------------------------
      expect(await lerVigente(EMPRESA_A.id)).toEqual(segundo);
      expect(segundo.titular).not.toBe(primeiro.titular);
      expect(segundo.substituidoEm).toBeNull();

      // --- (b) O histórico traz os DOIS, do mais recente para o mais antigo ----------------------
      const historico = await lerHistorico(EMPRESA_A.id);

      expect(historico.map((certificado) => certificado.id)).toEqual([segundo.id, primeiro.id]);

      const anteriorNoHistorico = historico[1];

      if (anteriorNoHistorico === undefined) {
        throw new Error('o histórico não devolveu o certificado substituído');
      }

      // --- (c) Os dados PÚBLICOS do 1 estão intactos ---------------------------------------------
      //
      // A comparação é sobre tudo menos o carimbo da substituição — que é justamente o único campo que
      // a renovação pode ter mudado. Compará-lo junto, contra ele mesmo, seria a tautologia do AP-29;
      // por isso ele sai da igualdade e ganha asserção própria logo abaixo.
      expect(semCarimboDeSubstituicao(anteriorNoHistorico)).toEqual(
        semCarimboDeSubstituicao(primeiro),
      );

      // …e o carimbo foi preenchido: o anterior deixou de ser o vigente por um fato gravado, e não por
      // sumiço. `not.toBeNull()` aqui é a asserção certa — o instante exato é do banco (ADR-0026), e
      // fixá-lo no caso mediria dois relógios.
      expect(primeiro.substituidoEm, 'o registro do 1 já nasceu substituído').toBeNull();
      expect(anteriorNoHistorico.substituidoEm).toBeInstanceOf(Date);

      // --- (d) O SEGREDO DO 1 SUMIU, e o do 2 está lá ---------------------------------------------
      //
      // A primeira linha é a CA-09 inteira: o registro fica, o segredo não. A segunda é o controle que
      // separa "a renovação anulou o do anterior" de "a renovação anulou o de todo mundo".
      expect(await lerSegredoCru(EMPRESA_A.id, primeiro.id)).toBeNull();
      expect(await lerSegredoCru(EMPRESA_A.id, segundo.id)).toBe(dadosDoSegundo.segredoCifrado);

      // E a porta do envelope acompanha: ela devolve o do vigente, que agora é o 2.
      expect(await lerEnvelope(EMPRESA_A.id)).toBe(dadosDoSegundo.segredoCifrado);
      expect(dadosDoSegundo.segredoCifrado).not.toBe(dadosDoPrimeiro.segredoCifrado);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-860 — o vencido continua recusado quando a SESSÃO está num fuso a leste
// ===========================================================================

describe('CT-860 — a recusa por vigência não depende do fuso da sessão (ADR-0026)', () => {
  it(
    'CT-860 — sob `TimeZone` a leste, o material vencido no dia anterior segue recusado e nada é gravado',
    async () => {
      // O controle que dá sentido ao caso: se o fuso da sessão fosse o da operação, os dois seriam a
      // mesma medição e o caso não discriminaria defeito nenhum.
      expect(
        FUSO_DE_SESSAO_A_LESTE,
        'o fuso da sessão coincide com o da operação — o caso não discrimina nada',
      ).not.toBe(FUSO_DA_OPERACAO);

      // A validade termina **tarde da noite do dia anterior**, no fuso da operação: o dia dela é
      // ontem, e ontem é anterior à data corrente — vencido, sem ambiguidade alguma. Num fuso a
      // leste, porém, esse mesmo instante já pertence ao dia de hoje, e é aí que a promoção
      // implícita do `date` à meia-noite da sessão inverte a resposta.
      const fimDaValidade = await instanteNoDiaDaOperacao(-1, HORA_TARDE_DA_NOITE);
      const vencidoOntem: DadosDoCertificado = {
        ...dadosDe('ct860'),
        validoDe: await instanteNoDiaDaOperacao(-366, HORA_DO_MEIO_DIA),
        validoAte: fimDaValidade,
      };

      const registro = await registrarSobFusoDeSessao(
        EMPRESA_A.id,
        FUSO_DE_SESSAO_A_LESTE,
        vencidoOntem,
      );

      // (a) O fuso foi mesmo trocado. Sem esta linha o caso correria no fuso padrão do `initdb` — que
      // neste host é o da operação — e ficaria verde sobre a forma defeituosa, medindo o host.
      expect(registro.fusoEfetivo, 'o `SET LOCAL TimeZone` não pegou na sessão').toBe(
        FUSO_DE_SESSAO_A_LESTE,
      );

      // (b) A asserção do caso: a recusa não mudou, e continua carregando a data exata.
      expect(registro.ok, 'sob sessão a leste o registro aceitou material vencido ontem').toBe(
        false,
      );
      expect(registro.erro).toBeInstanceOf(ErroDeCertificadoVencido);
      expect(dataDaRecusa(registro.erro)).toEqual(fimDaValidade);

      // (c) E nada foi gravado — a contagem crua separa "recusou" de "recusou e não gravou".
      expect(await contarLinhas(EMPRESA_A.id)).toBe(0);
      expect(await lerVigente(EMPRESA_A.id)).toBeUndefined();
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-861 — o válido continua aceito quando a SESSÃO está num fuso a oeste
// ===========================================================================

describe('CT-861 — o outro sentido do mesmo erro: o válido não pode ser recusado', () => {
  it(
    'CT-861 — sob `TimeZone` a oeste, o material que vence hoje de madrugada continua sendo gravado',
    async () => {
      expect(
        FUSO_DE_SESSAO_A_OESTE,
        'o fuso da sessão coincide com o da operação — o caso não discrimina nada',
      ).not.toBe(FUSO_DA_OPERACAO);

      // A validade termina **hoje, logo depois da meia-noite** do fuso da operação: o dia dela é o
      // dia corrente, e a §6.2 fixa `VENCIDO` só quando `validoAte < hoje` — este material vale. Num
      // fuso a oeste, o mesmo instante ainda pertence a ontem, e a forma defeituosa o recusava.
      const fimDaValidade = await instanteNoDiaDaOperacao(0, HORA_APOS_A_MEIA_NOITE);
      const valeHoje: DadosDoCertificado = {
        ...dadosDe('ct861'),
        validoDe: await instanteNoDiaDaOperacao(-365, HORA_DO_MEIO_DIA),
        validoAte: fimDaValidade,
      };

      const registro = await registrarSobFusoDeSessao(
        EMPRESA_A.id,
        FUSO_DE_SESSAO_A_OESTE,
        valeHoje,
      );

      expect(registro.fusoEfetivo, 'o `SET LOCAL TimeZone` não pegou na sessão').toBe(
        FUSO_DE_SESSAO_A_OESTE,
      );

      // A asserção do caso: nenhuma recusa, e o material foi aceito com a validade que ele declara.
      expect(registro.erro, 'sob sessão a oeste o registro recusou material que ainda vale').toBe(
        undefined,
      );
      expect(registro.ok).toBe(true);

      const gravado = registro.gravado;

      if (gravado === undefined) {
        throw new Error('o registro respondeu com sucesso e não devolveu o certificado gravado');
      }

      expect(gravado.validoAte).toEqual(fimDaValidade);

      // E o efeito durável: a linha existe, é o vigente, e é ela mesma.
      expect(await contarLinhas(EMPRESA_A.id)).toBe(1);
      expect(await lerVigente(EMPRESA_A.id)).toEqual(gravado);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// Acessórios — nenhum deles alcança o banco fora de uma unidade de trabalho
// ===========================================================================

/**
 * Executa o trabalho sob o contexto da empresa informada, dentro de uma unidade de trabalho.
 *
 * É o caminho por onde toda operação deste arquivo alcança o banco pelo papel `sysloc_app`:
 * `executarCom` mais `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O registro pela **porta de produção**, sob o contexto da empresa. */
async function registrar(
  empresaId: string,
  dados: DadosDoCertificado,
): Promise<CertificadoGravado> {
  return await emUnidade(empresaId, async (tx) => await registrarCertificado(tx, dados));
}

/** A leitura do vigente pela porta de produção. */
async function lerVigente(empresaId: string): Promise<CertificadoGravado | undefined> {
  return await emUnidade(empresaId, async (tx) => await lerCertificadoVigente(tx));
}

/** A leitura do histórico pela porta de produção. */
async function lerHistorico(empresaId: string): Promise<CertificadoGravado[]> {
  return await emUnidade(empresaId, async (tx) => await lerHistoricoDeCertificados(tx));
}

/** A obtenção do envelope pela porta de produção — a única que devolve o segredo guardado. */
async function lerEnvelope(empresaId: string): Promise<string | undefined> {
  return await emUnidade(empresaId, async (tx) => await obterEnvelopeCifradoDoVigente(tx));
}

/**
 * Quantas linhas a empresa tem — a contagem crua que separa "recusou" de "recusou e não gravou".
 *
 * Ela corre sob a política e **sem `WHERE empresa_id`**: quem recorta é o banco (ADR-0008).
 */
async function contarLinhas(empresaId: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.certificado_do_provedor
    `;

    return totalDe(linha);
  });
}

/** Quantos **vigentes** a empresa tem — o que o índice único parcial limita a um. */
async function contarVigentes(empresaId: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total
        FROM negocio.certificado_do_provedor
       WHERE substituido_em IS NULL
    `;

    return totalDe(linha);
  });
}

/** `count(*)` volta do driver em texto, porque é `bigint`. A conversão tem um lugar só. */
function totalDe(linha: { total: string } | undefined): number {
  if (linha === undefined) {
    throw new Error('a contagem de certificados não devolveu linha');
  }

  return Number(linha.total);
}

/**
 * Um instante deslocado da **data corrente da operação**, calculado pelo banco.
 *
 * `negocio.data_corrente_da_operacao()` é o eixo único de data do produto (ADR-0026), e é contra ele
 * que a porta compara a vigência. Montar as datas do arranjo a partir dele — em vez de a partir de
 * `new Date()` — é o que faz `-10` significar "dez dias antes da data corrente da operação" em vez de
 * "dez dias antes do relógio deste processo", que é uma diferença observável quando os dois divergem.
 */
async function instanteEmDias(dias: number): Promise<Date> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const [linha] = await tx<{ instante: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao() + ${dias}::integer)::timestamptz AS instante
    `;

    if (linha === undefined) {
      throw new Error('o banco não devolveu a data corrente da operação');
    }

    return linha.instante;
  });
}

/**
 * O fuso da operação, extraído do **corpo da função** que o fixa (`negocio.data_corrente_da_operacao`).
 *
 * Ele é lido do catálogo, e não escrito aqui, por duas razões que se somam. A primeira é a do
 * `DÉBITO COM GATILHO — D25`: o fuso já tem três declarações executáveis no pacote, e uma quarta,
 * nascida num arranjo de teste, divergiria sem que nada acusasse. A segunda é que o valor lido é
 * **usado como controle** pelo CT-860 e pelo CT-861 — os dois afirmam que o fuso da sessão que eles
 * fixam é **diferente** deste. Redigitá-lo faria o controle concordar com a cópia em vez de concordar
 * com a função, que é o que decide o comportamento sob prova.
 *
 * A leitura corre pela cadeia da aplicação, sem privilégio: `pg_get_functiondef` é do catálogo público.
 */
async function lerFusoDaOperacao(): Promise<string> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const [linha] = await tx<{ definicao: string }[]>`
      SELECT pg_catalog.pg_get_functiondef(p.oid) AS definicao
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = ${SCHEMA}
         AND p.proname = ${FUNCAO_DA_DATA_CORRENTE}
    `;

    if (linha === undefined) {
      throw new Error(`o catálogo não tem a função ${SCHEMA}.${FUNCAO_DA_DATA_CORRENTE}()`);
    }

    const fuso = /AT TIME ZONE '([^']+)'/.exec(linha.definicao)?.[1];

    if (fuso === undefined) {
      throw new Error(
        `o corpo de ${SCHEMA}.${FUNCAO_DA_DATA_CORRENTE}() não nomeia fuso algum: ${linha.definicao}`,
      );
    }

    return fuso;
  });
}

/**
 * Um instante absoluto ancorado numa **hora do dia no fuso da operação**, deslocado em dias.
 *
 * É o que {@link instanteEmDias} não pode dar: aquele projeta a data corrente em `timestamptz` e cai,
 * ele próprio, no fuso da sessão — serve para "trinta dias atrás", não para "às 23:00 de ontem, no
 * fuso que a operação usa". A conversão `timestamp AT TIME ZONE <fuso>` fixa o instante pelo fuso
 * **nomeado**, de modo que o valor produzido é o mesmo qualquer que seja o `TimeZone` da sessão que o
 * calculou — é exatamente essa independência que os dois casos precisam do arranjo para poderem
 * atribuir ao SUT qualquer variação que observem.
 */
async function instanteNoDiaDaOperacao(dias: number, horaDoDia: string): Promise<Date> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const [linha] = await tx<{ instante: Date }[]>`
      SELECT (((negocio.data_corrente_da_operacao() + ${dias}::integer)::timestamp
                 + ${horaDoDia}::interval) AT TIME ZONE ${FUSO_DA_OPERACAO}) AS instante
    `;

    if (linha === undefined) {
      throw new Error('o banco não devolveu o instante ancorado na data corrente da operação');
    }

    return linha.instante;
  });
}

/** O desfecho do registro feito sob um fuso de sessão fixado — o que o CT-860 e o CT-861 afirmam. */
interface RegistroSobFuso {
  /** O que `current_setting('TimeZone')` respondeu **dentro** da unidade de trabalho do registro. */
  readonly fusoEfetivo: string;
  readonly ok: boolean;
  readonly erro: unknown;
  readonly gravado: CertificadoGravado | undefined;
}

/**
 * Registra sob um `TimeZone` de sessão fixado, **dentro** da unidade de trabalho e antes do registro.
 *
 * `set_config('TimeZone', …, true)` é a forma parametrizável de `SET LOCAL TimeZone`: ele vale até o
 * fim desta unidade de trabalho e **não vaza** para a conexão devolvida à reserva, o que importa
 * porque a reserva é de uma conexão só e o caso seguinte a receberia de volta.
 *
 * O fuso efetivo é lido de volta e devolvido junto com o desfecho, e não é conferido aqui: quem afirma
 * é o caso. Um acessório que reprovasse sozinho esconderia, no vermelho, se o que falhou foi o arranjo
 * ou o SUT.
 */
async function registrarSobFusoDeSessao(
  empresaId: string,
  fusoDaSessao: string,
  dados: DadosDoCertificado,
): Promise<RegistroSobFuso> {
  return await emUnidade(empresaId, async (tx) => {
    await tx`SELECT set_config('TimeZone', ${fusoDaSessao}, true)`;

    const [sessao] = await tx<{ fuso: string }[]>`SELECT current_setting('TimeZone') AS fuso`;

    if (sessao === undefined) {
      throw new Error('a sessão não respondeu qual `TimeZone` está em vigor');
    }

    try {
      const gravado = await registrarCertificado(tx, dados);

      return { fusoEfetivo: sessao.fuso, ok: true, erro: undefined, gravado };
    } catch (erro) {
      // A captura é **dentro** da unidade porque é aqui que o fuso vale; a recusa por vigência é da
      // aplicação e acontece antes de qualquer escrita, de modo que a transação segue sadia e comita
      // vazia. Uma implementação que gravasse antes de recusar comitaria a linha — e é justamente
      // isso que a contagem crua do caso denuncia.
      return { fusoEfetivo: sessao.fuso, ok: false, erro, gravado: undefined };
    }
  });
}

/**
 * Um material lido e um envelope cifrado, variando só o que o caso precisa variar.
 *
 * O envelope é uma cadeia **opaca**, e a opacidade é o ponto: nada aqui cifra coisa alguma, e o módulo
 * sob prova não tem como distinguir este valor de um envelope real — que é exatamente a propriedade
 * que a ADR-0032 fixa. Nenhum símbolo de `@sysloc/shared/segredo-operavel` é importado neste arquivo.
 */
function dadosDe(marca: string): DadosDoCertificado {
  return {
    titular: `CN=Imobiliária ${marca}, OU=Certificado de teste`,
    validoDe: VALIDO_DE,
    validoAte: VALIDO_ATE,
    impressaoDigital: `AA:BB:CC:${marca}`,
    segredoCifrado: `envelope-cifrado-opaco-${marca}`,
    registradoPor: USUARIO_DE_A.id,
  };
}

/**
 * O certificado **sem** o carimbo da substituição — ver o passo (c) do CT-822.
 *
 * Os sete campos são enumerados, e não obtidos por descarte: a enumeração é ela própria a asserção de
 * que a comparação alcança tudo o que a renovação **não** podia mudar. Um campo novo na projeção não
 * entraria em silêncio na comparação — ele apareceria aqui como erro de compilação.
 */
function semCarimboDeSubstituicao(
  certificado: CertificadoGravado,
): Omit<CertificadoGravado, 'substituidoEm'> {
  return {
    id: certificado.id,
    titular: certificado.titular,
    validoDe: certificado.validoDe,
    validoAte: certificado.validoAte,
    impressaoDigital: certificado.impressaoDigital,
    registradoPor: certificado.registradoPor,
    registradoEm: certificado.registradoEm,
  };
}

/** O desfecho de uma chamada que pode recusar — o par que os casos afirmam. */
interface Desfecho {
  readonly ok: boolean;
  readonly erro: unknown;
}

async function capturar(trabalho: () => Promise<unknown>): Promise<Desfecho> {
  try {
    await trabalho();
    return { ok: true, erro: undefined };
  } catch (erro) {
    return { ok: false, erro };
  }
}

/**
 * A data que a recusa por vigência carrega, ou `undefined` quando o erro é de outra natureza.
 *
 * Ela evita o `as` largo sobre `unknown`: um erro de outro tipo produz `undefined`, que a igualdade do
 * caso reprova nomeando a diferença, em vez de acessar campo de um objeto que não o tem.
 */
function dataDaRecusa(erro: unknown): Date | undefined {
  return erro instanceof ErroDeCertificadoVencido ? erro.validoAte : undefined;
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

/**
 * O nome da restrição apontada pelo servidor. O campo se chama `constraint_name` porque é assim que o
 * driver nomeia o campo `n` da resposta de erro do PostgreSQL.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

/** A recusa observada, na forma que os casos afirmam por igualdade. */
function recusaDe(erro: unknown): { codigo: string | undefined; restricao: string | undefined } {
  return { codigo: sqlstate(erro), restricao: nomeDaRestricao(erro) };
}

// ---------------------------------------------------------------------------
// Leituras do catálogo — pela cadeia da APLICAÇÃO, sem privilégio nenhum
// ---------------------------------------------------------------------------

/** `attnotnull` da coluna informada — a obrigatoriedade que a ADR-0008 cobra de `empresa_id`. */
async function colunaEhObrigatoria(coluna: string): Promise<boolean> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const [linha] = await tx<{ obrigatoria: boolean }[]>`
      SELECT a.attnotnull AS obrigatoria
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = ${SCHEMA}
         AND c.relname = ${TABELA}
         AND a.attname = ${coluna}
         AND a.attnum > 0
         AND NOT a.attisdropped
    `;

    if (linha === undefined) {
      throw new Error(`a tabela ${SCHEMA}.${TABELA} não tem a coluna ${coluna}`);
    }

    return linha.obrigatoria;
  });
}

/** `relrowsecurity` e `relforcerowsecurity` da tabela — as duas, nunca só a primeira. */
async function estadoDaRls(): Promise<{ habilitada: boolean; forcada: boolean }> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const [linha] = await tx<{ habilitada: boolean; forcada: boolean }[]>`
      SELECT c.relrowsecurity      AS habilitada,
             c.relforcerowsecurity AS forcada
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = ${SCHEMA}
         AND c.relname = ${TABELA}
    `;

    if (linha === undefined) {
      throw new Error(`a tabela ${SCHEMA}.${TABELA} não existe no catálogo`);
    }

    return { habilitada: linha.habilitada, forcada: linha.forcada };
  });
}

/** As restrições de unicidade da tabela, com a definição que o catálogo imprime. */
async function unicasDaTabela(): Promise<{ nome: string; definicao: string }[]> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const linhas = await tx<{ nome: string; definicao: string }[]>`
      SELECT co.conname                        AS nome,
             pg_catalog.pg_get_constraintdef(co.oid) AS definicao
        FROM pg_catalog.pg_constraint co
        JOIN pg_catalog.pg_class c ON c.oid = co.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = ${SCHEMA}
         AND c.relname = ${TABELA}
         AND co.contype = 'u'
       ORDER BY co.conname
    `;

    return linhas.map((linha) => ({ nome: linha.nome, definicao: linha.definicao }));
  });
}

/** Os índices da tabela, por nome, com a definição literal que o catálogo imprime. */
async function indicesDaTabela(): Promise<Record<string, string>> {
  return await emUnidade(EMPRESA_A.id, async (tx) => {
    const linhas = await tx<{ nome: string; definicao: string }[]>`
      SELECT indexname AS nome, indexdef AS definicao
        FROM pg_catalog.pg_indexes
       WHERE schemaname = ${SCHEMA}
         AND tablename = ${TABELA}
       ORDER BY indexname
    `;

    return Object.fromEntries(linhas.map((linha) => [linha.nome, linha.definicao]));
  });
}

// ---------------------------------------------------------------------------
// Leituras e escritas CRUAS — a conexão privilegiada, só onde o card a autoriza
// ---------------------------------------------------------------------------

/**
 * Abre a conexão de **migração** com o contexto de empresa fixado, e a encerra ao fim.
 *
 * O contexto é obrigatório mesmo com privilégio: a tabela tem `FORCE ROW LEVEL SECURITY`, de modo que
 * o próprio dono obedece à política — sem `app.empresa_id` fixado, a leitura devolveria vazio e o
 * `INSERT` do CT-811 seria recusado pela política em vez de pelo índice, medindo a coisa errada.
 *
 * A reserva é de **uma** conexão porque `set_config(…, false)` vale pela sessão: com mais de uma,
 * nada garante que a instrução seguinte caia na conexão que recebeu o contexto.
 */
async function comConexaoPrivilegiada<T>(
  empresaId: string,
  trabalho: (sql: Sql) => Promise<T>,
): Promise<T> {
  const sql = abrirConexao(conexaoDeMigracao(banco), { maximoDeConexoes: RESERVA_DE_UMA });

  try {
    await sql`SELECT set_config('app.empresa_id', ${empresaId}, false)`;

    return await trabalho(sql);
  } finally {
    await sql.end();
  }
}

/**
 * A linha **inteira** do certificado, lida crua do disco — todas as colunas, sem projeção.
 *
 * É o `SELECT *` que torna a comparação do CT-820 capaz de pegar qualquer coluna movida, inclusive as
 * que a projeção publicada não conhece (`empresa_id`, `segredo_cifrado`, `substituido_em`). Uma
 * comparação sobre a projeção não veria justamente o que o dano toca.
 */
async function lerLinhaCrua(empresaId: string, id: string): Promise<Record<string, unknown>> {
  return await comConexaoPrivilegiada(empresaId, async (sql) => {
    const [linha] = await sql<Record<string, unknown>[]>`
      SELECT * FROM negocio.certificado_do_provedor WHERE id = ${id}
    `;

    if (linha === undefined) {
      throw new Error(`a leitura crua não achou o certificado ${id}`);
    }

    return { ...linha };
  });
}

/** O `segredo_cifrado` lido cru do disco — a coluna que a projeção publicada nunca traz. */
async function lerSegredoCru(empresaId: string, id: string): Promise<string | null> {
  const linha = await lerLinhaCrua(empresaId, id);
  const segredo = linha.segredo_cifrado;

  if (segredo !== null && typeof segredo !== 'string') {
    throw new Error(`a coluna segredo_cifrado do certificado ${id} não é texto nem nulo`);
  }

  return segredo;
}

/** O `criado_em` lido cru do disco — a âncora do `registradoEm` publicado (CT-819). */
async function lerCriadoEmCru(empresaId: string, id: string): Promise<Date> {
  const linha = await lerLinhaCrua(empresaId, id);
  const criadoEm = linha.criado_em;

  if (!(criadoEm instanceof Date)) {
    throw new Error(`a coluna criado_em do certificado ${id} não é um instante`);
  }

  return criadoEm;
}
