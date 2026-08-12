/**
 * A janela de horário em que a régua pode agir — decisão **pura**, sobre `HH:MM`.
 *
 * ===========================================================================
 * O instante entra por PARÂMETRO, e este arquivo NUNCA lê o relógio do processo
 * ===========================================================================
 *
 * Quem obtém a hora é a borda, do **banco** (ADR-0026): `to_char(now() AT TIME ZONE
 * 'America/Sao_Paulo', 'HH24:MI')`, a mesma fonte de tempo de que sai a data corrente da operação.
 * Nem `new Date()`, nem `Date.now()`, nem `getHours()` aparecem em `packages/regua/src/**`.
 *
 * ⚠️ **Não "otimize" isto para uma leitura local.** O relógio do processo depende da variável `TZ`,
 * que nenhuma das duas unidades systemd declara: hoje ela acerta **por acidente** — o host está no
 * fuso da operação — e, no dia em que o serviço rodar sob UTC, a régua dispara três horas fora da
 * janela que a imobiliária configurou, **sem uma linha vermelha em lugar nenhum**. Nenhum caso
 * comportamental pega esse defeito; a única rede é a asserção estática do CT-612.
 *
 * O parâmetro **não é seam nascido para o teste**: ele é o desenho de produção, e a razão é a RD-06
 * — a janela é propriedade do **job**, não da linha. Ela é conferida uma vez por passagem, não
 * participa da seleção de candidatas (por isso não entra no predicado do banco, ADR-0023) e não
 * discrimina uma cobrança de outra.
 *
 * ===========================================================================
 * A comparação é LEXICOGRÁFICA, e é isso que a torna correta sem converter nada
 * ===========================================================================
 *
 * `HH:MM` de vinte e quatro horas, com preenchimento de zero à esquerda, tem largura fixa e ordem
 * lexicográfica **idêntica** à ordem cronológica — `'08:59' < '09:00' < '13:37'`. Converter para
 * minutos desde a meia-noite daria o mesmo veredito ao custo de uma análise sintática que pode
 * falhar, e cujo modo de falha (`NaN` propagando em comparação, que é sempre falsa) é mudo: a régua
 * simplesmente pararia de enviar. O formato é garantido nas duas pontas — o banco projeta com
 * `to_char(…, 'HH24:MI')` e a política é conferida por expressão ancorada no contrato.
 */

/**
 * Responde se `agora` está dentro da janela, com bordas **inclusivas nos dois extremos**.
 *
 * A inclusividade é conteúdo, medida contra o oráculo: `is_hora_execucao` do sistema antigo devolve
 * verdadeiro **no minuto exato** do horário configurado. Um `>` no lugar do `>=` faria a empresa que
 * configura a janela para as `09:00` perder o minuto de abertura dela — e o CT-613 reprova
 * exatamente essa troca.
 *
 * A janela invertida não é reinterpretada aqui: `'18:00'`–`'09:00'` simplesmente não contém instante
 * algum. Adivinhar *"a noite inteira"* seria pior do que recusar, e quem recusa é a entrada — o
 * `refine` do contrato e o `CHECK` do banco —, antes de o par chegar até aqui.
 */
export function dentroDaJanela(agora: string, inicio: string, fim: string): boolean {
  return agora >= inicio && agora <= fim;
}
