/**
 * `@sysloc/regua` — o **domínio** da régua de cobrança.
 *
 * ---------------------------------------------------------------------------
 * O que este pacote é, e o que ele deliberadamente não conhece
 * ---------------------------------------------------------------------------
 *
 * Ele decide **quem é avisado, quando e com que texto**. O **domínio** — `regua.ts`, `janela.ts`,
 * `mensagem.ts` e as duas portas — não abre transação, não escreve SQL, não fala com SMTP e não lê
 * relógio: as portas chegam por parâmetro (ADR-0025) e o instante chega já resolvido, do banco
 * (ADR-0026). É o que o torna exercitável sem subir processo nenhum.
 *
 * O **pacote**, desde a T6, hospeda também quem fala: `adaptador-smtp.ts` é o adaptador de produção
 * sobre o `nodemailer`. Ele mora aqui pela mesma razão que o capturador — é uma **implementação** da
 * porta que o domínio declarou, e adaptador e interface se leem juntos. A fronteira que continua
 * valendo é de **dependência**, não de vizinhança: nada em `regua.ts` importa o adaptador, e é a
 * composição de cada processo que escolhe qual das duas implementações injetar. A verificação nunca
 * escolhe a de produção, e o CT-626 afirma isso por varredura.
 *
 * A dependência é uma só — `@syslocbr/contracts`, o pacote folha —, e a ausência de `@sysloc/db` é a
 * decisão, não uma omissão: é `@sysloc/db` que importa **daqui** os tipos de porta que ele satisfaz.
 * A aresta de volta fecha um ciclo e o Turborepo aborta antes de compilar qualquer coisa. Ver o
 * cabeçalho de `./porta-de-dados.ts`.
 *
 * ---------------------------------------------------------------------------
 * A superfície é declarada símbolo a símbolo, e não por `export *`
 * ---------------------------------------------------------------------------
 *
 * Mesma decisão, e mesma razão, de `@syslocbr/contracts`: um `export *` publicaria por descuido toda
 * composição interna que um arquivo de `src/` exporte para o vizinho, e retirar depois o que se
 * publicou sem querer é mudança incompatível. Listar é o que mantém a decisão de publicar explícita.
 */

export type { ConfiguracaoDeSmtp } from './adaptador-smtp.js';
export { criarAdaptadorSmtp } from './adaptador-smtp.js';
export { dentroDaJanela } from './janela.js';
export type { MensagemDeAviso } from './mensagem.js';
export { comporAvisoDeCobranca, ErroDeEstadoNaoAvisavel } from './mensagem.js';
export type {
  CandidataAoAviso,
  PortaDeCandidatas,
  PortaDeRegistro,
  TentativaDeEnvio,
} from './porta-de-dados.js';
export type { CapturadorDeEmail, EmailCapturado, PortaDeEnvioDeEmail } from './porta-de-email.js';
export { criarCapturadorDeEmail } from './porta-de-email.js';
// Os tipos de entrada dos dois caminhos são publicados junto das funções: sem eles, a borda não tem
// como nomear o que monta, e o `.d.ts` de `executarReguaDaEmpresa` referenciaria um tipo inalcançável
// de fora do pacote.
export type {
  DisparoManual,
  DispensasDoManual,
  ResultadoDaRegua,
  TrabalhoDaRegua,
} from './regua.js';
export {
  DISPENSAS_DO_DISPARO_MANUAL,
  enviarAvisoDeCobranca,
  executarReguaDaEmpresa,
} from './regua.js';
