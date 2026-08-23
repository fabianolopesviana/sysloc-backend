/**
 * O fuso da **operação** — casa única do literal, e não a quarta cópia dele.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO EXISTE, E POR QUE ELE NASCE AGORA
 * ---------------------------------------------------------------------------
 *
 * Ele é o fecho do **`D25 · F4/T7`** (fatia `fundacao-bancaria`), cujo gatilho declarado era
 * literal: *"a criação da companheira `negocio.dia_da_operacao(timestamptz) RETURNS date` … OU o
 * **quarto consumidor** do fuso no pacote"*. O quarto chegou com a derivação de `proximaEsperada`
 * de {@link ./execucao-de-rotina.ts}, que precisa converter a hora declarada de uma rotina diária
 * em instante absoluto — e a conversão local↔absoluto só existe com o fuso nomeado na instrução.
 *
 * Antes deste módulo havia **três** declarações executáveis do mesmo fato no pacote, medidas em
 * 2026-08-23: o corpo de `negocio.data_corrente_da_operacao()`
 * (`migracoes/0010_seguranca_cobranca.sql`) e as constantes privadas homônimas de
 * {@link ./envio-de-cobranca.ts} e {@link ./certificado-do-provedor.ts} — nenhuma importável, e
 * nada amarrando as três. Com três, endurecer uma deixa duas para trás; e o que divergiria aqui
 * muda **quem é recusado no registro do certificado**, **que hora a janela da régua enxerga** e
 * **quando uma rotina diária é esperada** — em silêncio, e em sentidos independentes.
 *
 * É o **Limiar de Três** do `CLAUDE.md` aplicado à letra, na mesma topologia — e pelas mesmas
 * razões — de {@link ./contexto-de-escrita.ts} (a expressão da empresa do contexto) e de
 * {@link ./moldes-de-formatacao.ts} (os moldes de `to_char`, cujo fecho do `D7 · F4/T3` é o
 * precedente direto deste). O remédio não é disciplina de quem escreve consulta: é **não haver onde
 * escrever a segunda**.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE **NÃO** FECHA — e a distinção é o `D14 · F3/T5`
 * ---------------------------------------------------------------------------
 *
 * Restam **duas** declarações executáveis, não uma: esta e a do corpo da função no banco. A segunda
 * é imutável (a `0010` está aplicada e conferida por `sha256sum`), e amarrá-la a esta é objeto do
 * marcador `DÉBITO COM GATILHO — D14` abaixo, que **acompanhou o literal até aqui** e cujo gatilho
 * — a primeira migração que redefinir `negocio.data_corrente_da_operacao()` — segue por disparar.
 * O marcador não protege nada: ele **agenda**. Editar este arquivo é normal; o que não se pode é
 * editá-lo sem ler o que ainda falta.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO ENTRA EM `./index.ts`, E A AUSÊNCIA É A DECISÃO
 * ---------------------------------------------------------------------------
 *
 * Módulo **interno do pacote**: quem o importa é a camada de dados, e mais ninguém. Publicá-lo no
 * barril daria a `apps/api` e a `apps/worker` um fuso **para escolher** — e a borda que escolhe fuso
 * é a borda que compõe o segundo relógio, que é exatamente o que a ADR-0026 fecha. A razão é a mesma
 * já escrita em {@link ./moldes-de-formatacao.ts}, e ela tem rede: o `CT-012` audita o barril por
 * **igualdade**, de modo que a publicação apareceria ali como excedente.
 */

/**
 * O fuso em que a operação lê o calendário e o relógio — **do objeto, nunca da sessão**.
 *
 * É o mesmo que `negocio.data_corrente_da_operacao()` fixa no corpo dela (`migracoes/0010`), e a
 * coincidência é obrigatória: a janela de horário, a classificação da cobrança, a vigência do
 * certificado e a próxima passagem esperada de uma rotina diária precisam concordar sobre que dia e
 * que hora são agora. Ele é escrito aqui, e não lido de configuração, porque um fuso configurável
 * seria um segundo eixo alcançável — exatamente o que a ADR-0026 fecha.
 *
 * Quem o consome o aplica **ao valor**, com `AT TIME ZONE` dentro da instrução, e nunca à sessão:
 * o `TimeZone` da conexão não é declarado em ponto algum deste repositório, e depender dele poria o
 * eixo sob o controle de quem conecta.
 */
// DÉBITO COM GATILHO — D14 · F3/T5 · registrado 2026-08-11
// O QUÊ: este literal é a SEGUNDA declaração executável do fuso da operação. A primeira vive no
//        corpo de `negocio.data_corrente_da_operacao()` (`migracoes/0010_seguranca_cobranca.sql`),
//        e NADA amarra as duas — o CT-612 (T8) varre `new Date(` em `packages/regua/src/**` e
//        `apps/worker/src/tarefas/**`, não alcança `packages/db/src/**` e não compara literais.
// QUANDO FECHA: a primeira migração que REDEFINIR `negocio.data_corrente_da_operacao()`. Ali as
//        duas podem divergir em silêncio, e o fecho é uma asserção em
//        `test/coerencia-de-migracoes.spec.ts` — ler `pg_get_functiondef` e afirmar que a
//        definição contém o mesmo literal desta constante, com prova de falsificação (trocar o
//        literal deixa o caso vermelho). É o molde que o CT-608 já usa para a projeção `HH24:MI`.
// POR QUE NÃO AGORA: a `0010` está sob `DECISÃO FECHADA` mais o `DÉBITO COM GATILHO — D20` e vira
//        imutável na primeira aplicação a banco durável, de modo que a divergência não tem por
//        onde nascer nesta fatia. E a ADR-0026 registra nos próprios Cons que nenhum caso
//        comportamental pega esta classe enquanto o host estiver no mesmo fuso da função.
// ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D14
export const FUSO_DA_OPERACAO = 'America/Sao_Paulo';
