/**
 * Política de aviso — a **porta única** de leitura e escrita da régua de cobrança de uma empresa.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS DUAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./configuracao-de-mora.ts}, {@link ./cobranca.ts} e {@link ./contrato.ts} já
 * registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `negocio.politica_de_aviso` numa
 * cadeia sem importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As duas funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * A ESCRITA É UM `upsert` DE UM COMANDO SÓ — e a alternativa é corrida disfarçada
 * ---------------------------------------------------------------------------
 *
 * {@link gravarPoliticaDeAviso} é `INSERT … ON CONFLICT (empresa_id) DO UPDATE`, **uma só ida ao
 * banco**, sem leitura prévia. A forma intuitiva — ler, decidir entre `INSERT` e `UPDATE`, gravar —
 * passaria em todos os casos felizes e perderia escrita sob concorrência: entre o `SELECT` que não
 * achou e o `INSERT`, outra transação grava, e a empresa passaria a ter duas políticas com nada que
 * decida qual vale. É a mesma lei que governa toda unicidade desta base: **quem impede é a
 * restrição, e não a leitura** — aqui `politica_de_aviso_empresa_key`, que existe para ser o alvo do
 * `ON CONFLICT` e não como índice de leitura (ver o cabeçalho da tabela em `./esquema/negocio.ts`).
 *
 * A semântica resultante é **última escrita vence**, e ela é a correta para esta entidade:
 * `esquemaDaPoliticaDeAvisoNova` é `strictObject` de seis campos **sem campo opcional**, de modo que
 * duas escritas concorrentes descrevem, cada uma, um estado final inteiro — não há fusão parcial a
 * que se perder.
 *
 * ---------------------------------------------------------------------------
 * A LEITURA NÃO ESCREVE, e a ausência de linha vira a régua DESLIGADA (RD-03)
 * ---------------------------------------------------------------------------
 *
 * {@link lerPoliticaDeAviso} não cria linha alguma. A empresa que nunca configurou devolve
 * {@link POLITICA_DE_AVISO_AUSENTE}, e a ausência de linha e a régua explicitamente desligada passam
 * a ser **a mesma coisa publicada**. As duas metades da regra têm razão própria, e são as mesmas que
 * o cabeçalho de {@link ./configuracao-de-mora.ts} registra para a RD-21:
 *
 *   * **não criar** — porque uma leitura que grava é uma leitura que muda o que ela mede, e o `GET`
 *     da borda deixaria de ser seguro de repetir. É também o que faz a **contagem crua `0`** do
 *     CT-606 ser o discriminador entre esta forma e um `upsert` escondido na leitura;
 *   * **desligar em vez de faltar** — porque é o que faz a leitura concordar com o que a **passagem
 *     da régua** faz numa empresa sem política: nada. Um `undefined` propagado daqui obrigaria cada
 *     leitor a decidir de novo o que fazer com ele, e o primeiro que decidisse diferente faria a
 *     rota discordar do job sobre o mesmo fato.
 *
 * Os valores desligados são compostos **aqui**, e não por um `COALESCE` sobre uma junção artificial:
 * o que falta é a linha inteira, e não um valor dentro dela. As seis colunas são `NOT NULL` com
 * padrão, então nulo em coluna é irrepresentável — traduzir a ausência da linha é a única tradução
 * que sobra, e ela é mais legível como o ramo explícito abaixo.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS HORÁRIOS SAEM POR `to_char(coluna, 'HH24:MI')` — e isso NÃO é estética
 * ---------------------------------------------------------------------------
 *
 * As colunas são `time`, e o driver devolveria `'09:00:00'`. O contrato publica `janelaInicio` e
 * `janelaFim` no molde `HH:MM` **ancorado nas duas pontas** (`esquemaDaPoliticaDeAviso`), e a âncora
 * recusa a forma com segundos — mas **a recusa de um esquema de SAÍDA não produz `422`**: ela
 * levanta na serialização e derruba a rota de leitura. A obrigação está escrita em CAIXA ALTA no
 * cabeçalho de `politicaDeAviso`, em `./esquema/negocio.ts`, e tem prova executável no **CT-608**
 * (`test/coerencia-de-migracoes.spec.ts`), que lê a mesma linha pelas duas projeções e afirma que a
 * crua reprova o esquema e a `to_char` passa. **Este arquivo é o ponto onde a obrigação é cumprida.**
 *
 * ---------------------------------------------------------------------------
 * O TIPO PUBLICADO É O DO CONTRATO, e não um gêmeo declarado aqui (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * `PoliticaDeAviso` e `PoliticaDeAvisoNova` são **importados** de `@sysloc/contracts`, e não
 * redeclarados no molde de `ConfiguracaoDeMoraPersistida`. A assimetria com a porta irmã é
 * deliberada e tem causa concreta: lá a projeção converte `numeric` em `number`, de modo que o que a
 * porta entrega **não é** a forma do esquema (a linha crua traz texto), e o tipo próprio nomeia essa
 * diferença. Aqui não há conversão nenhuma — os seis campos chegam do driver na forma exata que o
 * contrato publica —, e um gêmeo seria a segunda definição do mesmo fato que a ADR-0016 elimina,
 * livre para divergir na primeira emenda do esquema.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma das duas funções recebe `empresaId` por parâmetro, e nenhuma compara empresa com coisa
 * alguma escrita na aplicação.** A tabela nasce com RLS **forçada**
 * (`migracoes/0012_seguranca_regua.sql`), e não há aqui um `WHERE empresa_id = …` — a defesa em
 * profundidade que a `Decision` da ADR-0008 rejeita por escrito. A leitura alcança, no máximo, a
 * linha da empresa do contexto; a escrita **propõe** o `empresa_id` porque a coluna é `NOT NULL` sem
 * padrão, e o valor sai de {@link empresaDoContexto}, que é a expressão literal das políticas
 * avaliada dentro da própria instrução.
 *
 * O `ON CONFLICT` também é escopado pela política, e não por uma cláusula: a única linha com que a
 * inserção pode colidir é a da empresa do contexto — é a `UNIQUE (empresa_id)` sobre o valor que a
 * própria expressão acabou de propor.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA DECISÃO DE ENVIO EXISTE AQUI (ADR-0022, ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * Este arquivo guarda e devolve **configuração**, e não decide quem é avisado nem quando. O
 * predicado de elegibilidade vive no banco, em {@link ./envio-de-cobranca.ts}; a janela de horário é
 * do job, e é conferida por `dentroDaJanela`, de `@sysloc/regua`. A separação é a decisão D4 da
 * fatia: a janela **não participa de seleção** — ela não discrimina uma cobrança de outra —, e por
 * isso não entra no predicado.
 */

import type { PoliticaDeAviso, PoliticaDeAvisoNova } from '@sysloc/contracts';
import type { Fragment, TransactionSql } from 'postgres';
import { empresaDoContexto } from './contexto-de-escrita.js';

/**
 * O molde em que os dois horários `time` viajam — `HH:MM`, sem segundos.
 *
 * Escrito uma vez e usado nas duas colunas da projeção: duas grafias ficariam livres para divergir, e
 * a divergência apareceria como uma rota de leitura que derruba a requisição em vez de responder.
 */
const FORMATO_DA_HORA_DO_DIA = 'HH24:MI';

/**
 * A política publicada quando a empresa **nunca configurou** — a régua DESLIGADA (RD-03).
 *
 * Constante nomeada, e não um objeto literal no ponto de retorno: ela é **contrato publicado** — é o
 * corpo que `GET /v1/automacao-de-cobranca` devolve a toda empresa nova —, e ter nome é o que deixa
 * explícito que a ausência de linha tem uma tradução declarada, em vez de parecer um valor de
 * conveniência escolhido na hora.
 *
 * Os seis valores são, um a um, os **padrões das colunas** declarados em `./esquema/negocio.ts`:
 * `ativo` desligado, `intervalo_minimo_dias` em `1` (o piso, porque zero desligaria a trava que
 * protege a caixa do locatário) e a janela `00:00`–`23:59`, que é a que nunca fecha — `00:00`–`00:00`
 * fecharia tudo menos um minuto. A coincidência com os padrões é o que faz a empresa que **grava a
 * política vazia** e a que **nunca gravou** lerem a mesma coisa.
 *
 * **Congelado — é compartilhado por toda leitura**, no molde de `POLITICA_AUSENTE`
 * ({@link ./configuracao-de-mora.ts}), `SEM_FIADORES` ({@link ./contrato.ts}) e `SEM_COMODOS`
 * ({@link ./imovel.ts}). {@link lerPoliticaDeAviso} o devolve **por referência**, e o objeto não
 * carrega `readonly` no tipo do contrato: na fronteira do serviço o consumidor recebe um alias
 * mutável do objeto de módulo. Uma escrita nele mudaria a política publicada a **toda** empresa que
 * nunca configurou, no processo inteiro — a régua de uma empresa vazando para outra por estado
 * compartilhado, que é a classe que a ADR-0008 fecha no banco. O congelamento age sobre o **valor** e
 * não sobre o tipo, e por isso vale em qualquer camada, independente da anotação que ela enxergue.
 */
export const POLITICA_DE_AVISO_AUSENTE: PoliticaDeAviso = Object.freeze({
  ativo: false,
  diasAntesDoVencimento: 0,
  intervaloMinimoDias: 1,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
});

/**
 * A projeção publicada, escrita **uma vez** e reusada pela leitura e pelo `RETURNING` da escrita.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada por `unsafe`: ele é montado pelo mesmo
 * mecanismo da consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo
 * padrão, e mesma justificativa, de `colunasDaConfiguracao` em {@link ./configuracao-de-mora.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede duas traduções livres para divergir. E `id` e
 * `empresa_id` **não** estão na lista — o que a porta devolve é o que o contrato publica.
 *
 * Os dois `to_char` são obrigação declarada da coluna, e não escolha de quem consulta — ver o
 * cabeçalho deste arquivo.
 */
function colunasDaPolitica(tx: TransactionSql): Fragment {
  return tx`
    ativo,
    dias_antes_do_vencimento AS "diasAntesDoVencimento",
    intervalo_minimo_dias AS "intervaloMinimoDias",
    to_char(janela_inicio, ${FORMATO_DA_HORA_DO_DIA}) AS "janelaInicio",
    to_char(janela_fim, ${FORMATO_DA_HORA_DO_DIA}) AS "janelaFim",
    canal
  `;
}

/**
 * A linha do driver copiada campo a campo — **o ponto único** da tradução da leitura em contrato.
 *
 * Os campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer coluna
 * que a projeção venha a ganhar, inclusive `empresa_id`. É a mesma decisão de `configuracaoPublicada`
 * e de `cobrancaPublicada`.
 *
 * A cópia tem um segundo efeito, e ele é medido: o objeto que o driver devolve carrega um protótipo
 * próprio, montado a partir da descrição das colunas. Devolvê-lo direto faria a comparação estrita da
 * suíte (`toStrictEqual`, exigida pelo CT-606) reprovar por **classe** do objeto, e não por valor —
 * um vermelho que não fala do defeito que o caso persegue.
 */
function politicaPublicada(linha: PoliticaDeAviso): PoliticaDeAviso {
  return {
    ativo: linha.ativo,
    diasAntesDoVencimento: linha.diasAntesDoVencimento,
    intervaloMinimoDias: linha.intervaloMinimoDias,
    janelaInicio: linha.janelaInicio,
    janelaFim: linha.janelaFim,
    canal: linha.canal,
  };
}

/**
 * Lê a política de aviso da empresa do contexto, **ou a régua desligada** quando ela nunca
 * configurou.
 *
 * Ela **não cria linha alguma** — ver o cabeçalho deste arquivo para as duas razões da RD-03. Não há
 * recorte por empresa escrito aqui: a política do banco é quem o faz, e é ela que garante que a
 * consulta alcança no máximo uma linha.
 */
export async function lerPoliticaDeAviso(tx: TransactionSql): Promise<PoliticaDeAviso> {
  const [linha] = await tx<PoliticaDeAviso[]>`
    SELECT ${colunasDaPolitica(tx)}
      FROM negocio.politica_de_aviso
  `;

  return linha === undefined ? POLITICA_DE_AVISO_AUSENTE : politicaPublicada(linha);
}

/**
 * Grava a política de aviso da empresa do contexto e devolve a que passou a valer.
 *
 * **Uma só ida ao banco**, sem leitura prévia: `ON CONFLICT (empresa_id) DO UPDATE` é o que torna a
 * escrita atômica e a torna correta sob concorrência. Ver o cabeçalho deste arquivo para por que a
 * forma "ler, decidir, gravar" é corrida disfarçada.
 *
 * A cláusula de conflito nomeia a **coluna**, e não a restrição: é `empresa_id` que decide a
 * identidade da política, e nomear a coluna deixa a intenção legível no ponto — uma linha por
 * empresa. Os valores novos vêm de `EXCLUDED`, que é a linha que a inserção **teria** gravado:
 * repetir os parâmetros no `SET` daria dois lugares por onde o valor chega, e o segundo poderia
 * divergir.
 *
 * O `RETURNING` é o que dispensa a leitura de volta: o que a rota publica é exatamente o que a
 * instrução gravou, na mesma unidade de trabalho, e não uma segunda consulta que já poderia enxergar
 * outra escrita.
 *
 * Os dois horários chegam como cadeia `HH:MM` e são gravados em coluna `time` sem cast escrito aqui:
 * o parâmetro viaja sem tipo declarado e o servidor o resolve pela coluna de destino, que é o mesmo
 * caminho das três datas de {@link ./cobranca.ts}. Quem recusa `'24:00'` é o esquema de entrada, na
 * borda, e o **tipo da coluna** é a rede — a comparação da janela é de ordem temporal, e não
 * lexicográfica sobre texto livre.
 */
export async function gravarPoliticaDeAviso(
  tx: TransactionSql,
  dados: PoliticaDeAvisoNova,
): Promise<PoliticaDeAviso> {
  const [linha] = await tx<PoliticaDeAviso[]>`
    INSERT INTO negocio.politica_de_aviso (
      empresa_id, ativo, dias_antes_do_vencimento, intervalo_minimo_dias,
      janela_inicio, janela_fim, canal
    )
    VALUES (
      ${empresaDoContexto(tx)}, ${dados.ativo}, ${dados.diasAntesDoVencimento},
      ${dados.intervaloMinimoDias}, ${dados.janelaInicio}, ${dados.janelaFim}, ${dados.canal}
    )
        ON CONFLICT (empresa_id) DO UPDATE
       SET ativo = EXCLUDED.ativo,
           dias_antes_do_vencimento = EXCLUDED.dias_antes_do_vencimento,
           intervalo_minimo_dias = EXCLUDED.intervalo_minimo_dias,
           janela_inicio = EXCLUDED.janela_inicio,
           janela_fim = EXCLUDED.janela_fim,
           canal = EXCLUDED.canal
     RETURNING ${colunasDaPolitica(tx)}
  `;

  if (linha === undefined) {
    // Inalcançável: o `INSERT … ON CONFLICT DO UPDATE … RETURNING` de uma linha ou devolve a linha
    // ou levanta — o `DO UPDATE` sempre atua, diferente de um `DO NOTHING`, que devolveria vazio na
    // colisão. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse a política vigente.
    throw new Error('a política de aviso foi gravada e a linha não voltou');
  }

  return politicaPublicada(linha);
}
