/**
 * O **recorte do carnê** — o intervalo de competências que `GET /v1/contratos/:codigo/carne` aceita.
 *
 * ---------------------------------------------------------------------------
 * O que este módulo é, e por que ele é tão pequeno
 * ---------------------------------------------------------------------------
 *
 * O carnê **não tem esquema de saída**, e a ausência é decisão de ADR e não esquecimento: a rota
 * devolve **bytes**, e a **ADR-0028** fixa que a rota que os devolve declara três coisas — tipo de
 * mídia, nome sugerido de arquivo e o mesmo envelope de erro — e **nada** sobre a forma do corpo de
 * sucesso. Por isso aqui mora só a **entrada**, e ela é a fonte única de que derivam tanto a
 * conferência da borda quanto a descrição do documento OpenAPI (ADR-0016).
 *
 * ---------------------------------------------------------------------------
 * A entrada é FECHADA (`z.strictObject`), ao contrário da entrada da notícia
 * ---------------------------------------------------------------------------
 *
 * A `.claude/rules/contrato-publicado.md` manda entrada fechada porque *"chave desconhecida na
 * entrada é erro do cliente"*, e aqui o cliente **é** cliente nosso: quem pede o carnê é o frontend
 * que este pacote serve, e ele pode corrigir o pedido. É exatamente a premissa que a entrada de fato
 * de terceiro (`POST /v1/notificacoes-bancarias`) falsifica — lá o remetente é o provedor bancário,
 * que não pode corrigir nada e cujo aviso não se pode perder —, e é por isso que aquela diverge da
 * regra com divergência declarada e esta **não** diverge.
 *
 * ---------------------------------------------------------------------------
 * As três recusas nomeiam o CAMPO pelo `path`, nunca a raiz
 * ---------------------------------------------------------------------------
 *
 * O `422 CAMPO_INVALIDO` promete dizer **qual** campo corrigir, e `path` na raiz não cumpre a
 * promessa. Por isso:
 *
 *   * a forma da competência é conferida **no próprio campo**, de modo que o `path` sai `['de']` ou
 *     `['ate']` por construção — e não por uma escolha escrita à mão;
 *   * a inversão (`de > ate`) é conferida no objeto com `path: ['de']`, porque é o **início** do
 *     intervalo que está adiante do fim;
 *   * a largura excessiva é conferida no objeto com `path: ['ate']`, porque é o **fim** que precisa
 *     recuar para o pedido caber.
 *
 * ---------------------------------------------------------------------------
 * A aritmética do intervalo corre sobre TEXTO, e jamais sobre `Date`
 * ---------------------------------------------------------------------------
 *
 * A competência viaja como `YYYY-MM-DD` da consulta ao JSON e **nunca** passa por `Date` com fuso
 * (§6.2 do tech spec): construir um `Date` aqui reintroduziria o deslocamento de um dia que a
 * projeção por `to_char` da camada de dados existe para evitar — e num par de datas ele viraria um
 * mês inteiro a mais ou a menos na largura. `z.iso.date()` já garantiu a forma e a validade de
 * calendário antes destas expressões correrem, de modo que as fatias posicionais **são** o ano e o
 * mês.
 */

import { z } from 'zod';
// Ela vem do módulo irmão porque descreve o MESMO fato que ele já descreve: a exigência de a
// competência ser o primeiro dia do mês. Redigitar `/-01$/` aqui criaria a segunda fonte do mesmo
// fato que a ADR-0016 elimina — duas expressões livres para divergir sem que nada acuse.
import { COMPETENCIA_NO_PRIMEIRO_DIA } from './cobranca.js';

/**
 * Quantas competências o recorte do carnê pode abranger, contando as duas pontas.
 *
 * **O número não é arbitrário**: o carnê é, por natureza, o caderno de um ano, e o PRD desta fatia
 * fala em *"doze parcelas"*. Ele é o que transforma o pior caso da rota — todos os arquivos ausentes
 * do disco, cada um custando uma consulta ao provedor com teto de 10 s — de *ilimitado* em
 * **declarável** (§12.3 do tech spec: ~130 s). Sem ele, um recorte de dez anos seria um pedido
 * legítimo capaz de segurar um trabalhador do processo por meia hora.
 *
 * Ele é publicado pelo barril porque o **cliente** precisa dele: é com este número que o frontend
 * limita o seletor de intervalo antes de pedir, em vez de descobrir o teto por um `422`.
 */
export const LARGURA_MAXIMA_DO_RECORTE = 12;

/** Quantos meses tem um ano — o fator que converte a diferença de anos em meses. */
const MESES_DO_ANO = 12;

/** Onde o ano começa e termina na cadeia `YYYY-MM-DD`. */
const INICIO_DO_ANO = 0;
const FIM_DO_ANO = 4;

/** Onde o mês começa e termina na cadeia `YYYY-MM-DD`. */
const INICIO_DO_MES = 5;
const FIM_DO_MES = 7;

/**
 * A competência de uma das pontas do recorte — data de calendário no **primeiro dia do mês**.
 *
 * `z.iso.date()` recusa `2026-02-30` e recusa a forma com hora — as duas coisas que um `regex`
 * ingênuo deixaria passar, e as duas que precisam ser verdade antes de a expressão do primeiro dia
 * poder ler os dois últimos dígitos como o dia.
 *
 * A conferência do primeiro dia é **do campo**, e não do objeto como em `esquemaDeCobrancaNova`: lá
 * há uma competência só, e aqui há duas — conferi-las no objeto obrigaria a escolher o `path` à mão
 * e a decidir qual das duas nomear quando as duas estivessem erradas. No campo, o `path` sai
 * `['de']` ou `['ate']` por construção.
 */
const esquemaDaCompetenciaDoRecorte = z.iso
  .date()
  .refine((competencia) => COMPETENCIA_NO_PRIMEIRO_DIA.test(competencia), {
    message: 'a competência precisa ser o primeiro dia do mês',
  });

/** Quantos meses decorreram desde o ano zero — a ordem total sobre a qual o intervalo é medido. */
function mesesAbsolutos(competencia: string): number {
  const ano = Number(competencia.slice(INICIO_DO_ANO, FIM_DO_ANO));
  const mes = Number(competencia.slice(INICIO_DO_MES, FIM_DO_MES));

  return ano * MESES_DO_ANO + mes;
}

/** Quantas competências o recorte abrange, **contando as duas pontas**. */
function larguraDoRecorte(de: string, ate: string): number {
  return mesesAbsolutos(ate) - mesesAbsolutos(de) + 1;
}

/**
 * O recorte de competências do carnê (§4.1) — entrada **fechada**, dois campos, ambos obrigatórios.
 *
 * Não há valor padrão para nenhum dos dois, e a ausência é decisão: um recorte implícito ("o ano
 * corrente", "os próximos doze meses") faria a rota devolver um documento que o cliente não pediu, e
 * o carnê é impresso e entregue a quem paga — não é uma tela que se corrige com um clique. Campo
 * ausente é recusa por campo obrigatório, nomeando-o.
 */
export const esquemaDoRecorteDoCarne = z
  .strictObject({
    de: esquemaDaCompetenciaDoRecorte,
    ate: esquemaDaCompetenciaDoRecorte,
  })
  // A comparação é **lexicográfica sobre o texto**, e ela é correta por construção: `YYYY-MM-DD` com
  // largura fixa e zeros à esquerda ordena como a data ordena. É a mesma razão pela qual a
  // aritmética acima não constrói `Date`.
  .refine(({ de, ate }) => de <= ate, {
    path: ['de'],
    message: 'o início do recorte não pode ser posterior ao fim',
  })
  .refine(({ de, ate }) => larguraDoRecorte(de, ate) <= LARGURA_MAXIMA_DO_RECORTE, {
    path: ['ate'],
    message: `o recorte não pode abranger mais de ${String(LARGURA_MAXIMA_DO_RECORTE)} competências`,
  });

/** O recorte já conferido — o que a borda entrega ao serviço do carnê. */
export type RecorteDoCarne = z.infer<typeof esquemaDoRecorteDoCarne>;
