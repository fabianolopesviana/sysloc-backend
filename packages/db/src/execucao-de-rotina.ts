/**
 * Registro de execução das rotinas agendadas — a gravação sob contexto, a leitura com a derivação
 * corrida **no banco**, o histórico recente limitado por construção e o expurgo por idade.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./politica-de-aviso.ts}, {@link ./envio-de-cobranca.ts} e
 * {@link ./conferencia-bancaria.ts} já registram: a contenção da §11.2 é de **tipo** e não alcança
 * **texto de SQL**. Um serviço de aplicação com o executor da unidade de trabalho em mãos escreve
 * `negocio.execucao_de_rotina` numa cadeia sem importar nada de proibido, e o alcance às tabelas do
 * domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As quatro funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * UM LUGAR, DOIS CONSUMIDORES — e é por isso que a derivação corre no BANCO
 * ---------------------------------------------------------------------------
 *
 * {@link lerEstadoDasRotinas} é a **mesma** derivação que a rotina de vigilância e a rota do Admin
 * consomem (decisão D5 do tech-alignment). A vigilância **filtra** as atrasadas, e filtrar é
 * literalmente a hipótese da `Decision` da ADR-0023 — *"a derivação de um valor não persistido vive
 * no banco quando ela participa de seleção — filtro, ordenação ou paginação"*. Derivar `atrasada` na
 * aplicação quebraria o consumidor que ainda não existe: ele teria de trazer o roster inteiro de
 * cada empresa para a memória antes de decidir o que alertar.
 *
 * O eixo de tempo é o do **banco**, e só ele (ADR-0026). Não há `new Date(`, `Date.now(`,
 * `getHours(` nem `getTime(` em posição executável neste arquivo, e não pode haver: `ocorrida_em`
 * sai do padrão da coluna, o corte do expurgo sai de `now()` do servidor, e a comparação que decide
 * `atrasada` acontece **na mesma consulta** que lê a última execução. Um relógio de processo faria a
 * mesma empresa aparecer atrasada num host e em dia noutro, sem uma linha vermelha em lugar nenhum.
 *
 * ---------------------------------------------------------------------------
 * A GRAVAÇÃO **NÃO** DECIDE se houve efeito (RN-15)
 * ---------------------------------------------------------------------------
 *
 * {@link registrarExecucaoDeRotina} grava o que lhe entregam. Quem decide se a passagem produziu
 * efeito é **quem chama**, com o predicado declarado por rotina (RD-15) — `candidatos > 0` no
 * encerramento, `enviadas + falhas + semDestinatario > 0` na régua, `liquidacoesDescobertas > 0` na
 * conferência. Trazer a decisão para cá obrigaria este módulo a conhecer as rotinas uma a uma, e é o
 * modo mais provável de reintroduzir o **registro de passagem vazia** — o defeito de 12 MB por
 * empresa do sistema antigo, que a RN-15 existe para fechar. A rede de que ele não voltou não é
 * disciplina: é a **ausência** de qualquer predicado de efeito neste arquivo.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008, ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** A tabela nasce com RLS **forçada** e política nominal
 * (`migracoes/0027_seguranca_execucao_de_rotina.sql`), e não há aqui um `WHERE empresa_id = …` sobre
 * relação de `negocio` — a defesa em profundidade que a `Decision` da ADR-0008 rejeita por escrito.
 * O expurgo também não o tem, e é por isso que ele não atravessa tenant: quem recorta o `DELETE` é a
 * política, não uma cláusula.
 *
 * A escrita **propõe** `empresa_id` porque a coluna é `NOT NULL` sem padrão, e o valor sai de
 * {@link empresaDoContexto} — a expressão literal das políticas, avaliada dentro da própria
 * instrução. É a ADR-0024 cumprida ao pé da letra: o contexto foi estabelecido **uma vez, na borda
 * que recebeu o trabalho**, e daqui em diante ele é ambiente, nunca argumento.
 *
 * A **única** leitura fora de `negocio` é a data de admissão da empresa do contexto, em
 * `identidade.empresa` — o schema que por decisão da ADR-0009 nunca teve política. Ali o recorte
 * pela empresa do contexto não duplica caminho nenhum: ele **é** o caminho, exatamente como o
 * cabeçalho de {@link ./contexto-de-escrita.ts} declara e como {@link ./pessoa.ts} já faz.
 *
 * ⚠️ **Nenhum papel de leitura sem contexto nasce aqui**, e a ausência é decisão registrada: a
 * emenda de 2026-08-13 da ADR-0024 admite a travessia nominal para as **duas** leituras legítimas já
 * declaradas, e esta não é uma delas — o agendador percorre as empresas uma a uma e conhece a
 * empresa **antes** do alcance ao dado, nunca como resultado dele.
 *
 * ---------------------------------------------------------------------------
 * O CONTRATO É A FONTE DO ROSTER, DA CADÊNCIA E DO LIMIAR (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * `ROTINAS_PUBLICADAS`, `CADENCIA_DA_ROTINA` e `LIMIAR_DE_ATRASO_POR_CADENCIA` são **importados** de
 * `@syslocbr/contracts`, nunca redigitados: o roster que esta leitura devolve é o mesmo que a rota
 * publica, e o limiar que o banco compara é o mesmo que o alerta da vigilância anuncia. Um número
 * escrito aqui seria a segunda declaração do mesmo fato, livre para divergir na primeira emenda do
 * relógio — que é a classe dos débitos `D38`/`D40`.
 *
 * O tipo do rótulo gravável também vem de lá ({@link RotinaPublicada}). A coincidência entre ele e o
 * enum `negocio.rotina_agendada` **não é presumida**: ela é afirmada em execução pelo `CT-1070`, que
 * lê `pg_enum` e compara o **conjunto** dos três rótulos por igualdade — o vínculo que o docblock de
 * `rotinaAgendada`, em `./esquema/negocio.ts`, nomeia por escrito.
 */

import type { EnvioDeCobranca, EstadoDeRotina } from '@syslocbr/contracts';
import {
  CADENCIA_DA_ROTINA,
  type CodigoDeImpedimento,
  LIMIAR_DE_ATRASO_POR_CADENCIA,
  ROTINAS_PUBLICADAS,
  type RotinaPublicada,
} from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts`. Ele **não é
// filtro** sobre relação de `negocio` — nenhuma leitura deste arquivo o aplica ali, porque a tabela
// já tem política e um segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe
// para a **escrita**, onde `empresa_id` é `NOT NULL` sem padrão, e para a única leitura em
// `identidade`, schema que nunca teve política (ADR-0009) e onde ele É o caminho.
import { empresaDoContexto } from './contexto-de-escrita.js';
// O fuso da operação tem **casa única** em `./fuso-da-operacao.ts` — este módulo é o consumidor cujo
// gatilho fechou o `D25 · F4/T7`, e ele importa em vez de declarar a quarta cópia do literal.
import { FUSO_DA_OPERACAO } from './fuso-da-operacao.js';
// O molde do INSTANTE tem casa única em `./moldes-de-formatacao.ts`, e é importado em vez de
// recopiado — ver o cabeçalho daquele módulo. Ele **não** entra no barril, por decisão registrada lá.
import { FORMATO_ISO_DO_INSTANTE } from './moldes-de-formatacao.js';

/**
 * As contagens de uma passagem, **como a rotina as gravou** — derivadas do contrato (ADR-0016).
 *
 * Não há esquema por rotina: cada uma resume a própria passagem com as contagens que ela produz
 * (decisão D4 do tech-alignment), e o que a `CHECK` do banco fixa é apenas a **espécie** do
 * documento — objeto JSON, e nada além. As chaves nascem em vocabulário do produto no ponto que
 * chama (RN-19/RD-19), e este módulo não as remodela: remodelar aqui criaria o segundo vocabulário
 * para o mesmo fato que a RN-19 proíbe.
 */
export type ResumoDaPassagem = NonNullable<EstadoDeRotina['resumo']>;

/** O que se grava quando uma passagem produziu efeito — ver {@link registrarExecucaoDeRotina}. */
export interface ExecucaoDeRotinaNova {
  /** Qual passagem produziu a linha. Só as rotinas do roster publicado deixam registro. */
  readonly rotina: RotinaPublicada;
  /** O que a passagem contou, em vocabulário do produto. */
  readonly resumo: ResumoDaPassagem;
}

/** Uma linha do histórico recente, já no molde que o contrato publica. */
export interface PassagemRegistrada {
  /** A rotina a que a linha pertence — é por ela que o estado a agrupa. */
  readonly rotina: RotinaPublicada;
  /** O instante da passagem, ISO-8601 UTC composto pelo servidor. */
  readonly ocorridaEm: string;
  /** O resumo daquela passagem, como o banco o guardou. */
  readonly resumo: ResumoDaPassagem;
}

/**
 * Quantas passagens o histórico recente devolve **por rotina** — limite **por construção**.
 *
 * Ele não é parâmetro de quem chama, e a ausência é a decisão D3 do tech-alignment: é o que dispensa
 * a segunda superfície (estado corrente + histórico paginado à parte) e mantém a resposta de tamanho
 * previsível, com no máximo `3 × 5` linhas. O horizonte que a decisão 31 descreve é curto — *"última
 * execução, próxima esperada, falhas recentes"* —, e a retenção de 90 dias já limita o conjunto por
 * cima. Se a tela vier a exigir percurso longo, o caminho é **ampliar a leitura existente**, e não
 * publicar uma janela: a saída é contrato aberto, e é essa assimetria que torna a decisão reversível.
 */
const PASSAGENS_NO_HISTORICO_RECENTE = 5;

/**
 * Por quantos dias o histórico de execução é guardado (RN-16/RD-16).
 *
 * É o mesmo prazo do cru da notícia bancária (`DIAS_DE_RETENCAO_DO_CRU`, em
 * {@link ./notificacao-bancaria.ts}) e o mesmo dos boletos guardados — **um** prazo de retenção no
 * produto, e não três divergentes que ninguém revisa depois.
 */
const DIAS_DE_RETENCAO_DO_HISTORICO = 90;

/**
 * Por quantas horas uma recusa do provedor de e-mail permanece sendo impedimento corrente.
 *
 * A régua passa a cada minuto, de modo que uma tentativa **mais recente** sempre chega logo: se a
 * última tentativa da empresa saiu, o impedimento some sozinho — é essa a propriedade que faz o campo
 * dizer *"o problema é agora"* em vez de *"houve um problema algum dia"*. A janela existe para o caso
 * oposto, o da empresa que parou de tentar: sem ela, uma recusa antiga ficaria pendurada para sempre
 * na tela do Admin, e ele não teria como distinguir a régua quebrada da régua parada.
 */
const HORAS_DA_RECUSA_RECENTE = 24;

/**
 * O desfecho que caracteriza recusa do provedor — o tipo vem do contrato, e não é literal solto.
 *
 * `SEM_DESTINATARIO` **não** entra: ali o provedor não recusou nada, e o que falta é o e-mail do
 * locatário — outro problema, com outra correção, e anunciá-lo como recusa mandaria o Admin
 * procurar no lugar errado. O tipo é derivado de `EnvioDeCobranca['desfecho']`, de modo que um
 * rótulo que deixe de existir no contrato **não compila** aqui, em vez de virar um predicado que
 * nunca casa. Mesmo molde de `DESFECHO_QUE_TRAVA`, em {@link ./envio-de-cobranca.ts}.
 */
const DESFECHO_DE_RECUSA: EnvioDeCobranca['desfecho'] = 'FALHOU';

/**
 * O que a leitura anuncia ao Admin em cada impedimento — **vocabulário do produto** (RD-19).
 *
 * As três mensagens falam de coisas que o Admin **reconhece na própria tela** e consegue resolver
 * sozinho: a régua que ele desligou, o e-mail que o provedor recusou, o certificado que falta. Não há
 * aqui código de terceiro, `SQLSTATE`, nome de tabela nem vocabulário de processo — diagnóstico cru
 * de provedor é registro operacional e obedece à ADR-0034, que o mantém fora da trilha publicada.
 *
 * O tipo é `Record<CodigoDeImpedimento, string>`, e a cobertura total é do **compilador**: um código
 * novo na união fechada do contrato sem mensagem declarada aqui não compila. É a mesma forma de
 * `MENSAGEM_POR_CODIGO`/`STATUS_POR_CODIGO` em `apps/api`.
 */
const MENSAGEM_POR_IMPEDIMENTO: Readonly<Record<CodigoDeImpedimento, string>> = Object.freeze({
  REGUA_DESLIGADA: 'a régua de cobrança está desligada nas configurações da empresa',
  AVISOS_RECUSADOS_PELO_PROVEDOR: 'o provedor de e-mail recusou o último aviso desta empresa',
  INTEGRACAO_BANCARIA_PENDENTE: 'a empresa não tem certificado do provedor vigente',
});

/**
 * Que impedimentos alcançam cada rotina, **na ordem em que eles se sobrepõem**.
 *
 * A ordem é conteúdo: a régua desligada vem antes da recusa do provedor porque uma régua desligada
 * não tenta enviar nada, e anunciar a recusa antiga como o problema corrente mandaria o Admin
 * investigar o provedor quando o que falta é ligar a régua.
 *
 * O encerramento de contratos tem lista **vazia**, e o vazio é a decisão, não uma lacuna: ele não
 * depende de configuração alguma da empresa — só de contrato vencido —, e não há nada que o Admin
 * possa resolver para destravá-lo. O que impede uma rotina por falha de infraestrutura sai pelo
 * journal do operador, nunca por este campo (RD-18).
 *
 * O tipo é `Record<RotinaPublicada, …>` pela mesma razão do mapa acima: publicar uma rotina nova sem
 * decidir que impedimentos a alcançam **não compila**.
 */
const IMPEDIMENTOS_POR_ROTINA: Readonly<Record<RotinaPublicada, readonly CodigoDeImpedimento[]>> =
  Object.freeze({
    AVISO_DE_COBRANCA: Object.freeze([
      'REGUA_DESLIGADA',
      'AVISOS_RECUSADOS_PELO_PROVEDOR',
    ] as const),
    ENCERRAMENTO_DE_CONTRATOS: Object.freeze([] as const),
    CONFERENCIA_DE_LIQUIDACAO: Object.freeze(['INTEGRACAO_BANCARIA_PENDENTE'] as const),
  });

/** Que fatos já gravados foram observados na empresa do contexto — um por código do vocabulário. */
type FatosDeImpedimento = Record<CodigoDeImpedimento, boolean>;

/** A linha que a consulta de estado devolve por rotina, antes de virar recurso publicado. */
interface LinhaDoEstado {
  readonly rotina: RotinaPublicada;
  readonly ultimaExecucao: string | null;
  readonly resumo: ResumoDaPassagem | null;
  readonly proximaEsperada: string;
  readonly atrasada: boolean;
}

/**
 * A cadência publicada de uma rotina do roster, no molde exato do contrato.
 *
 * A leitura de `hora` passa por `'hora' in cadencia` porque, sob `exactOptionalPropertyTypes`, a
 * entrada de uma cadência de intervalo **não tem a chave** — e não a tem com `undefined`. Compor o
 * objeto com `hora: undefined` seria publicar uma chave que o esquema declara ausente.
 */
function cadenciaDaRotina(rotina: RotinaPublicada): EstadoDeRotina['cadencia'] {
  const cadencia = CADENCIA_DA_ROTINA[rotina];

  return 'hora' in cadencia
    ? { tipo: cadencia.tipo, hora: cadencia.hora }
    : { tipo: cadencia.tipo };
}

/**
 * A hora marcada da rotina quando ela é **diária**, e `null` quando ela é de intervalo.
 *
 * É o discriminador que a consulta consome: com hora, a próxima passagem esperada é a próxima
 * ocorrência daquele horário no fuso da operação; sem hora, é o minuto seguinte.
 *
 * ⚠️ **O `switch` é exaustivo de propósito, e o ramo impossível é o ponto do arquivo.** O tipo de
 * `cadencia.tipo` é derivado do roster **publicado**, de modo que publicar uma rotina de relógio novo
 * — `A_CADA_10_MIN`, digamos — faz a atribuição a `never` deixar de compilar **aqui**, obrigando
 * quem publica a dizer o que "próxima esperada" significa para o relógio novo. Sem ele, a cadência
 * nova cairia no ramo do minuto seguinte em silêncio, e a tela anunciaria uma passagem que não vem.
 */
function horaMarcada(rotina: RotinaPublicada): string | null {
  const cadencia = cadenciaDaRotina(rotina);

  switch (cadencia.tipo) {
    case 'DIARIA': {
      if (cadencia.hora === undefined) {
        throw new Error(`a cadência diária da rotina ${rotina} não declara hora`);
      }

      return cadencia.hora;
    }
    case 'A_CADA_MINUTO':
      return null;
    default: {
      const relogioNaoTratado: never = cadencia.tipo;

      throw new Error(`a cadência ${String(relogioNaoTratado)} não tem próxima passagem declarada`);
    }
  }
}

/**
 * O impedimento corrente de uma rotina, **derivado de fato já gravado** — ou `null`.
 *
 * Ele nunca é fabricado: cada código corresponde a uma linha que existe (ou que falta) no banco, e o
 * que esta função faz é escolher, entre os que alcançam a rotina, o **primeiro** que se verificou.
 * `null` é conteúdo — é a rotina sem nada que o Admin precise resolver.
 */
function impedimentoDaRotina(
  rotina: RotinaPublicada,
  fatos: FatosDeImpedimento,
): EstadoDeRotina['impedimento'] {
  const codigo = IMPEDIMENTOS_POR_ROTINA[rotina].find((candidato) => fatos[candidato]);

  return codigo === undefined ? null : { codigo, mensagem: MENSAGEM_POR_IMPEDIMENTO[codigo] };
}

/**
 * Grava **uma** linha de passagem com efeito, com o `empresa_id` vindo do **contexto**.
 *
 * Três propriedades, e nenhuma delas é disciplina de quem chama:
 *
 *   * **a empresa não é parâmetro** — ela sai de {@link empresaDoContexto}, e o `WITH CHECK` da
 *     política aceita ou recusa o valor proposto (ADR-0008/ADR-0024);
 *   * **o instante não é composto na aplicação** — `ocorrida_em` fica com o `DEFAULT now()` da
 *     coluna, que é o relógio do servidor (ADR-0026). Não há parâmetro por onde propô-lo, e a
 *     ausência é o que impede o histórico de ordenar por um relógio que ninguém confere;
 *   * **o resumo não é remodelado** — ele entra como veio, e a `CHECK`
 *     `execucao_de_rotina_resumo_chk` recusa toda espécie que não seja objeto JSON.
 *
 * ⚠️ **`::text::jsonb`, e não `::jsonb` nem parâmetro sem cast.** A razão está medida e registrada em
 * {@link ./notificacao-bancaria.ts}: o driver infere o tipo do parâmetro pelo destino e, vendo
 * `jsonb`, aplica o serializador de JSON à cadeia que já é JSON — o que fica no banco é a *string* do
 * objeto, e o defeito só aparece na leitura. O `::text` fixa o parâmetro em texto, e o segundo cast é
 * o servidor interpretando esse texto como JSON.
 *
 * Ela **não decide se grava** — ver o cabeçalho deste arquivo, seção RN-15.
 */
export async function registrarExecucaoDeRotina(
  tx: TransactionSql,
  dados: ExecucaoDeRotinaNova,
): Promise<void> {
  await tx`
    INSERT INTO negocio.execucao_de_rotina (empresa_id, rotina, resumo)
    VALUES (${empresaDoContexto(tx)},
            ${dados.rotina}::negocio.rotina_agendada,
            ${JSON.stringify(dados.resumo)}::text::jsonb)
  `;
}

/**
 * O histórico recente de **todas** as rotinas do roster, em ordem decrescente dentro de cada uma.
 *
 * O limite é {@link PASSAGENS_NO_HISTORICO_RECENTE} **por rotina**, aplicado no `LATERAL` para que o
 * servidor pare de ler assim que completar as k linhas de cada uma — é o uso do
 * `execucao_de_rotina_historico_idx` para o qual a ordem decrescente do índice é conteúdo. Um `LIMIT`
 * global devolveria k linhas no total, e a rotina que passa a cada minuto engoliria o histórico das
 * diárias.
 *
 * A rotina sem passagem alguma simplesmente **não aparece** no resultado, e é o consumidor que a
 * traduz em arranjo vazio — vazio não é ausência de dado, é ausência de passagem.
 *
 * A ordem entre rotinas é a do roster publicado, fixada pelo `WITH ORDINALITY`: sem ele, o
 * planejador poderia devolver os grupos em qualquer ordem, e a ordem da tela deixaria de ser a ordem
 * da declaração.
 */
export async function lerHistoricoRecenteDeRotinas(
  tx: TransactionSql,
): Promise<readonly PassagemRegistrada[]> {
  return await tx<PassagemRegistrada[]>`
    SELECT roster.rotina,
           to_char(recente.ocorrida_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE})
             AS "ocorridaEm",
           recente.resumo
      FROM unnest(${[...ROTINAS_PUBLICADAS]}::text[])
             WITH ORDINALITY AS roster(rotina, ordem)
      CROSS JOIN LATERAL (
             SELECT execucao.ocorrida_em, execucao.resumo
               FROM negocio.execucao_de_rotina AS execucao
              WHERE execucao.rotina = roster.rotina::negocio.rotina_agendada
              ORDER BY execucao.ocorrida_em DESC
              LIMIT ${PASSAGENS_NO_HISTORICO_RECENTE}
           ) AS recente
     ORDER BY roster.ordem, recente.ocorrida_em DESC
  `;
}

/**
 * Que fatos de impedimento a empresa do contexto exibe **agora** — os três, numa consulta só.
 *
 * Cada coluna é um fato **já gravado**, e nenhuma delas é opinião desta camada:
 *
 *   * `REGUA_DESLIGADA` — a política de aviso com `ativo = false`, **ou ausente**, que é o mesmo
 *     estado publicado (a empresa que nunca configurou lê a régua desligada, ver
 *     {@link ./politica-de-aviso.ts});
 *   * `AVISOS_RECUSADOS_PELO_PROVEDOR` — a tentativa **mais recente** da empresa terminou em recusa,
 *     e ela é recente. Ler a *última* tentativa, e não *"existe alguma recusa na janela"*, é o que faz
 *     um envio bem-sucedido posterior limpar o impedimento sozinho;
 *   * `INTEGRACAO_BANCARIA_PENDENTE` — não há certificado vigente cuja validade alcance a data
 *     corrente da operação, o que cobre de uma vez o ausente e o vencido.
 *
 * ⚠️ **A vigência é comparada em granularidade de DIA, com o fuso escrito na instrução** — `date`
 * contra `date`, sem operando promovido pelo fuso da **sessão**. É a mesma forma, e a mesma razão,
 * de `recusarCertificadoVencido` em {@link ./certificado-do-provedor.ts}: comparar o instante
 * criaria um **segundo eixo** de vigência, e o mesmo certificado poderia ser recusado no registro e
 * anunciado como vigente aqui, no mesmo dia.
 *
 * Os apelidos das colunas são os **próprios códigos** do vocabulário fechado, e a coincidência é o
 * ponto: ela é o que dispensa um mapa de tradução entre a consulta e o contrato — mapa que seria mais
 * um lugar por onde um código novo poderia ser esquecido.
 *
 * Nenhum recorte por empresa é escrito aqui: as três relações têm política, e é ela que decide o que
 * cada leitura enxerga.
 */
async function lerFatosDeImpedimento(tx: TransactionSql): Promise<FatosDeImpedimento> {
  const [fatos] = await tx<FatosDeImpedimento[]>`
    SELECT NOT COALESCE((SELECT politica.ativo FROM negocio.politica_de_aviso AS politica), false)
             AS "REGUA_DESLIGADA",
           COALESCE((
             SELECT tentativa.desfecho = ${DESFECHO_DE_RECUSA}::negocio.desfecho_do_aviso
                      AND tentativa.criado_em
                            > now() - make_interval(hours => ${HORAS_DA_RECUSA_RECENTE}::integer)
               FROM negocio.envio_de_cobranca AS tentativa
              ORDER BY tentativa.criado_em DESC
              LIMIT 1
           ), false) AS "AVISOS_RECUSADOS_PELO_PROVEDOR",
           NOT EXISTS (
             SELECT 1
               FROM negocio.certificado_do_provedor AS certificado
              WHERE certificado.substituido_em IS NULL
                AND (certificado.valido_ate AT TIME ZONE ${FUSO_DA_OPERACAO})::date
                      >= negocio.data_corrente_da_operacao()
           ) AS "INTEGRACAO_BANCARIA_PENDENTE"
  `;

  if (fatos === undefined) {
    // Inalcançável: a consulta é escalar e sem predicado no nível de topo. O ramo existe porque o
    // tipo do driver admite o arranjo vazio, e um `as` no lugar dele faria `undefined` viajar como se
    // fosse "nada impede" — que é justamente o valor que esconderia o impedimento do Admin.
    throw new Error('o banco não respondeu quais impedimentos alcançam as rotinas da empresa');
  }

  return fatos;
}

/**
 * O estado de cada rotina do roster — a última passagem, o atraso e a próxima esperada, **do banco**.
 *
 * ---------------------------------------------------------------------------
 * UMA consulta para as três rotinas, e não uma por rotina
 * ---------------------------------------------------------------------------
 *
 * A última execução sai de um `DISTINCT ON (rotina)` sobre `execucao_de_rotina_historico_idx`, cuja
 * ordem decrescente é exatamente a que a cláusula pede — o servidor lê a primeira linha de cada
 * prefixo e para. O roster viaja como arranjo e vira relação por `unnest`, de modo que a rotina
 * **sem execução alguma** também tem linha: é o `LEFT JOIN` que produz o `ultimaExecucao: null` da
 * empresa recém-admitida, e é por isso que a leitura **não cria linha alguma** para inventar estado —
 * o mesmo molde de `lerPoliticaDeAviso`, que devolve a régua desligada em vez de `404`.
 *
 * ---------------------------------------------------------------------------
 * `atrasada` — e por que a empresa nova NÃO nasce atrasada
 * ---------------------------------------------------------------------------
 *
 * A comparação é `agora - ultima > limiar(cadencia)`, avaliada **no banco**, na mesma consulta que lê
 * a última execução (ADR-0023 + ADR-0026). Sem execução alguma, o eixo passa a ser a **admissão da
 * empresa**: a rotina só é atrasada quando a empresa existe há mais que o limiar. Sem essa cláusula,
 * toda empresa nasceria com as três rotinas atrasadas no primeiro segundo de vida, e o alerta que
 * dispara para todo mundo é o alerta que ninguém lê.
 *
 * ---------------------------------------------------------------------------
 * `proximaEsperada` — o fuso é da OPERAÇÃO, e a conversão é do servidor
 * ---------------------------------------------------------------------------
 *
 * Para a cadência de minuto é o minuto seguinte, truncado. Para a diária é a próxima ocorrência da
 * hora declarada **no fuso da operação** — o mesmo relógio em que o `OnCalendar=` da unidade systemd
 * dispara —, resolvida com `AT TIME ZONE` aplicado ao **valor**, nunca à sessão: o `TimeZone` da
 * conexão não é declarado em ponto algum deste repositório, e depender dele poria a hora anunciada
 * sob o controle de quem conecta.
 *
 * A comparação com o instante corrente é **estrita**: o horário que acabou de chegar já pertence à
 * passagem de hoje, e o que se anuncia é a próxima. O resultado sai em ISO-8601 UTC composto pelo
 * servidor, como todo instante publicado por este pacote.
 */
export async function lerEstadoDasRotinas(tx: TransactionSql): Promise<EstadoDeRotina[]> {
  const rotinas = [...ROTINAS_PUBLICADAS];
  const limiares = rotinas.map(
    (rotina) => LIMIAR_DE_ATRASO_POR_CADENCIA[cadenciaDaRotina(rotina).tipo],
  );
  const horas = rotinas.map(horaMarcada);

  const linhas = await tx<LinhaDoEstado[]>`
    WITH relogio AS (
      SELECT now() AS agora,
             date_trunc('day', now() AT TIME ZONE ${FUSO_DA_OPERACAO}) AS meia_noite_local
    ),
    ultima AS (
      SELECT DISTINCT ON (rotina) rotina::text AS rotina, ocorrida_em, resumo
        FROM negocio.execucao_de_rotina
       ORDER BY rotina, ocorrida_em DESC
    ),
    admissao AS (
      SELECT criada_em
        FROM identidade.empresa
       WHERE id = ${empresaDoContexto(tx)}
    )
    SELECT roster.rotina,
           to_char(ultima.ocorrida_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE})
             AS "ultimaExecucao",
           ultima.resumo,
           to_char(
             CASE
               WHEN roster.hora IS NULL
                 THEN date_trunc('minute', relogio.agora) + make_interval(mins => 1)
               WHEN (relogio.meia_noite_local + roster.hora::time)
                      AT TIME ZONE ${FUSO_DA_OPERACAO} > relogio.agora
                 THEN (relogio.meia_noite_local + roster.hora::time)
                        AT TIME ZONE ${FUSO_DA_OPERACAO}
               ELSE (relogio.meia_noite_local + make_interval(days => 1) + roster.hora::time)
                      AT TIME ZONE ${FUSO_DA_OPERACAO}
             END AT TIME ZONE 'UTC',
             ${FORMATO_ISO_DO_INSTANTE}
           ) AS "proximaEsperada",
           relogio.agora - COALESCE(ultima.ocorrida_em, admissao.criada_em)
             > make_interval(mins => roster.limiar_minutos) AS atrasada
      FROM unnest(${rotinas}::text[], ${limiares}::integer[], ${horas}::text[])
             AS roster(rotina, limiar_minutos, hora)
      CROSS JOIN relogio
      CROSS JOIN admissao
      LEFT JOIN ultima ON ultima.rotina = roster.rotina
  `;

  const porRotina = new Map(linhas.map((linha) => [linha.rotina, linha]));
  const historico = await lerHistoricoRecenteDeRotinas(tx);
  const fatos = await lerFatosDeImpedimento(tx);

  // A ordem de saída é a do roster publicado, e não a que o planejador devolveu: ela é a ordem de
  // declaração do relógio do produto, e é a ordem em que a rota entrega as rotinas.
  return ROTINAS_PUBLICADAS.map((rotina) => {
    const linha = porRotina.get(rotina);

    if (linha === undefined) {
      // Inalcançável enquanto a empresa do contexto existir: o `unnest` produz uma linha por rotina
      // do roster, e o `LEFT JOIN` as preserva. O ramo existe porque um `as` no lugar dele faria uma
      // rotina sumir da leitura em silêncio — e rotina que some da tela é rotina que ninguém vigia.
      throw new Error(
        `o banco não devolveu o estado da rotina ${rotina} para a empresa do contexto`,
      );
    }

    return {
      rotina,
      cadencia: cadenciaDaRotina(rotina),
      ultimaExecucao: linha.ultimaExecucao,
      resumo: linha.resumo,
      proximaEsperada: linha.proximaEsperada,
      atrasada: linha.atrasada,
      impedimento: impedimentoDaRotina(rotina, fatos),
      historicoRecente: historico
        .filter((passagem) => passagem.rotina === rotina)
        .map((passagem) => ({ ocorridaEm: passagem.ocorridaEm, resumo: passagem.resumo })),
    };
  });
}

/**
 * Apaga o histórico com mais de {@link DIAS_DE_RETENCAO_DO_HISTORICO} dias e diz quantas linhas saíram.
 *
 * O corte sai de `now()` **do banco** (ADR-0026): medido pelo relógio do processo, o prazo de
 * retenção passaria a depender de qual máquina executou a tarefa. E ele é **estritamente menor** — a
 * linha de exatamente 90 dias **permanece**, que é o que separa este `<` de um `<=` na borda do
 * prazo.
 *
 * O intervalo sai de `make_interval(days => …::integer)`, e não de `n * interval '1 day'`: o
 * `inferType` do driver devolve `0` para todo `number` de JavaScript, de modo que a segunda forma
 * deixaria o **resolvedor** escolher qual multiplicação de `interval` aplicar. É o idioma que
 * {@link ./notificacao-bancaria.ts} e {@link ./envio-de-cobranca.ts} já usam.
 *
 * **Não há `WHERE empresa_id`, e o expurgo não atravessa tenant**: quem recorta o `DELETE` é a
 * política de linha, com a empresa do contexto (ADR-0008). O vencido de outra empresa não é
 * alcançável daqui — e é o `CT-1072` que o prova, com uma linha vencida numa segunda empresa.
 *
 * A contagem sai de `count` do driver — quantas linhas o **servidor** apagou —, e não do comprimento
 * de uma lista que a aplicação montou: não há `RETURNING`, porque trazer os corpos para descartá-los
 * seria transporte sem consumidor.
 */
export async function expurgarExecucoesVencidas(
  tx: TransactionSql,
): Promise<{ readonly removidos: number }> {
  const resultado = await tx`
    DELETE FROM negocio.execucao_de_rotina
     WHERE ocorrida_em < now() - make_interval(days => ${DIAS_DE_RETENCAO_DO_HISTORICO}::integer)
  `;

  return { removidos: resultado.count };
}
