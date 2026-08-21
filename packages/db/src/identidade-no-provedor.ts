/**
 * A **identidade da empresa perante o provedor bancário** — leitura e escrita.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELA É, e por que não vive junto do certificado
 * ---------------------------------------------------------------------------
 *
 * É o que falta ao certificado para que o produto obtenha credencial de acesso: o **identificador da
 * aplicação** perante o provedor e os **dados da conta** que a emissão exige. Fecha o
 * `D36 · F4/T10`, e diverge da prescrição dele — que era pendurar os campos no registro do
 * certificado — porque os ciclos de vida diferem: o material vale um ano e é substituído inteiro a
 * cada renovação; a identidade não muda quando ele é trocado. O docblock de `identidadeNoProvedor`
 * em `./esquema/negocio.ts` carrega a razão por extenso.
 *
 * ---------------------------------------------------------------------------
 * O IDENTIFICADOR É SEGREDO; os dados da conta NÃO são
 * ---------------------------------------------------------------------------
 *
 * O identificador da aplicação é segredo operável de terceiro — o produto precisa **usá-lo** para
 * compor o pedido de credencial —, e a ADR-0032 o alcança: entra cifrado e **não retorna por
 * superfície alguma**. Por isso este módulo tem duas leituras separadas, e a separação é a
 * salvaguarda: {@link lerIdentidadeVigente} devolve a projeção **sem** o segredo, que é o que a
 * borda publica; {@link obterEnvelopeCifradoDaIdentidade} devolve o envelope, e existe só para quem
 * vai decifrá-lo para usar. Uma função só, com o segredo dentro, tornaria o vazamento uma questão de
 * alguém lembrar de removê-lo da projeção.
 *
 * Os dados da conta identificam a conta perante o provedor, compõem a emissão e são legítimos na
 * superfície — o sistema antigo faz a mesma distinção.
 */

import { decifrarValorOperavel } from '@sysloc/shared';
import type { Fragment, TransactionSql } from 'postgres';
import { empresaDoContexto } from './contexto-de-escrita.js';

/** O que o registro de uma identidade exige. O identificador chega **já cifrado**. */
export interface DadosDaIdentidade {
  /** O envelope cifrado do identificador da aplicação — nunca o identificador. */
  readonly identificadorDaAplicacaoCifrado: string;
  readonly numeroDoCliente: number;
  readonly numeroDaContaCorrente: number;
  readonly codigoDaModalidade: number;
  /** Quem registrou — amarrado à empresa pela chave composta da ADR-0008. */
  readonly registradoPor: string;
}

/**
 * A identidade **como a superfície a vê** — sem o identificador, por construção.
 *
 * ⚠️ Não acrescente aqui o campo do segredo, nem "só para depurar": esta forma é o que a rota
 * devolve, e a ADR-0032 exige que a ausência de vazamento seja afirmada por medição da saída real.
 */
export interface IdentidadeGravada {
  readonly id: string;
  readonly numeroDoCliente: number;
  readonly numeroDaContaCorrente: number;
  readonly codigoDaModalidade: number;
  readonly registradoPor: { readonly id: string; readonly nome: string };
  readonly registradoEm: Date;
}

/**
 * As colunas da projeção publicável — escritas num lugar só, para as duas consultas.
 *
 * ⚠️ **Fragmento do próprio `tx`, e não `tx.unsafe(<cadeia>)`.** É a forma que `certificado-do-provedor.ts`
 * usa, e a diferença não é estilo: interpolar cadeia crua num template de `postgres.js` produz
 * consulta malformada, e o sintoma é um `500` na borda em vez de erro de compilação — medido em
 * 2026-08-20, na primeira escrita deste módulo.
 */
function colunasPublicaveis(tx: TransactionSql): Fragment {
  return tx`
    i.id,
    i.numero_do_cliente AS "numeroDoCliente",
    i.numero_da_conta_corrente AS "numeroDaContaCorrente",
    i.codigo_da_modalidade AS "codigoDaModalidade",
    jsonb_build_object('id', u.id, 'nome', u.nome) AS "registradoPor",
    i.criado_em AS "registradoEm"
  `;
}

/**
 * Registra a identidade da empresa do contexto, substituindo a vigente.
 *
 * ⚠️ **A ordem `UPDATE` antes de `INSERT` é a mesma de `registrarCertificado`, e pela mesma razão
 * medida**: `identidade_no_provedor_vigente_uidx` é índice único PARCIAL sobre `empresa_id` onde
 * `substituida_em IS NULL`, e índice único parcial **não aceita `DEFERRABLE`**. Inserir primeiro
 * colidiria em `23505` com a própria linha que a inserção substitui, e o registro legítimo morreria.
 * Ver a `DECISÃO FECHADA` de `certificado-do-provedor.ts` — esta função é a segunda ocorrência da
 * mesma topologia, e reordenar aqui quebra do mesmo jeito.
 *
 * A anulação **não leva `WHERE empresa_id`**: quem recorta é a política de isolamento (ADR-0008), e
 * repetir o recorte aqui criaria uma segunda regra de tenant, livre para divergir daquela. As duas
 * colunas mudam na mesma instrução porque a `CHECK` bicondicional torna qualquer outra combinação
 * irrepresentável — o banco recusa, em vez de depender de quem escreveu ter lembrado das duas.
 */
export async function registrarIdentidadeNoProvedor(
  tx: TransactionSql,
  dados: DadosDaIdentidade,
): Promise<IdentidadeGravada> {
  await tx`
    UPDATE negocio.identidade_no_provedor
       SET substituida_em = pg_catalog.now(),
           identificador_da_aplicacao_cifrado = NULL
     WHERE substituida_em IS NULL
  `;

  const [gravada] = await tx<IdentidadeGravada[]>`
    WITH inserida AS (
      INSERT INTO negocio.identidade_no_provedor
                  (empresa_id, identificador_da_aplicacao_cifrado, numero_do_cliente,
                   numero_da_conta_corrente, codigo_da_modalidade, registrado_por)
      VALUES (${empresaDoContexto(tx)}, ${dados.identificadorDaAplicacaoCifrado},
              ${dados.numeroDoCliente}, ${dados.numeroDaContaCorrente},
              ${dados.codigoDaModalidade}, ${dados.registradoPor})
      RETURNING *
    )
    SELECT ${colunasPublicaveis(tx)}
      FROM inserida i
      JOIN identidade.usuario u ON u.id = i.registrado_por
  `;

  if (gravada === undefined) {
    throw new Error('o registro da identidade no provedor não devolveu linha');
  }

  return gravada;
}

/** A identidade vigente da empresa do contexto — **sem** o identificador. `undefined` se não há. */
export async function lerIdentidadeVigente(
  tx: TransactionSql,
): Promise<IdentidadeGravada | undefined> {
  const [vigente] = await tx<IdentidadeGravada[]>`
    SELECT ${colunasPublicaveis(tx)}
      FROM negocio.identidade_no_provedor i
      JOIN identidade.usuario u ON u.id = i.registrado_por
     WHERE i.substituida_em IS NULL
  `;

  return vigente;
}

/**
 * O envelope cifrado do identificador da vigente — para quem vai **usá-lo**, e só para isso.
 *
 * Separada de {@link lerIdentidadeVigente} de propósito: quem publica não chama esta, e quem chama
 * esta não publica o resultado. A ADR-0032 é sobre o segredo não alcançar superfície, e duas
 * funções tornam isso uma propriedade do desenho em vez de uma disciplina de quem escreve.
 */
export async function obterEnvelopeCifradoDaIdentidade(
  tx: TransactionSql,
): Promise<string | undefined> {
  const [vigente] = await tx<{ identificadorCifrado: string }[]>`
    SELECT identificador_da_aplicacao_cifrado AS "identificadorCifrado"
      FROM negocio.identidade_no_provedor
     WHERE substituida_em IS NULL
  `;

  return vigente?.identificadorCifrado;
}

/**
 * A identidade **pronta para uso**, com o identificador em claro.
 *
 * ⚠️ Ela é estruturalmente igual a `IdentidadeDoProvedor` de `@sysloc/cobranca-bancaria`, e a
 * igualdade é deliberada — é assim que o valor atravessa a fronteira sem que este pacote precise
 * conhecer o adaptador. **Não** importamos aquele tipo aqui: `@sysloc/db` não depende de
 * `@sysloc/cobranca-bancaria`, e inverter isso amarraria a camada de dados ao provedor.
 */
export interface IdentidadeParaUso {
  readonly identificadorDaAplicacao: string;
  readonly numeroDoCliente: number;
  readonly numeroDaContaCorrente: number;
  readonly codigoDaModalidade: number;
}

/**
 * Lê a identidade vigente e **decifra** o identificador — o ponto único onde ele existe em claro.
 *
 * Mora aqui, e não em cada processo, porque **seis** caminhos precisam dela: três no trabalhador
 * (emissão em lote, conferência, notícia) e três na borda (reemissão, revogação, consulta de
 * situação). Escrita em cada um seriam seis cópias nascidas juntas, e o Limiar de Três do
 * `CLAUDE.md` estaria estourado de saída.
 *
 * `undefined` quando não há identidade registrada — estado legítimo (a empresa ainda não configurou
 * a integração), e não falha. Quem chama decide o que fazer, como já decide para o certificado.
 *
 * ⚠️ **Nada aqui registra, anexa ou serializa o valor decifrado** (ADR-0032): ele é devolvido a quem
 * vai entregá-lo ao adaptador, e o alcance dele termina no corpo da concessão.
 */
export async function lerIdentidadeParaUso(
  tx: TransactionSql,
  chaveDeCifra: Buffer,
): Promise<IdentidadeParaUso | undefined> {
  const vigente = await lerIdentidadeVigente(tx);
  const envelope = await obterEnvelopeCifradoDaIdentidade(tx);

  // As duas leituras têm de concordar. Discordarem é estado impossível pela `CHECK` bicondicional
  // da migração `0021` — mas conferir custa uma linha e transforma o impossível em ausência
  // declarada, em vez de num `decifrar(undefined)` mais adiante.
  if (vigente === undefined || envelope === undefined) {
    return undefined;
  }

  return {
    identificadorDaAplicacao: decifrarValorOperavel(envelope, chaveDeCifra),
    numeroDoCliente: vigente.numeroDoCliente,
    numeroDaContaCorrente: vigente.numeroDaContaCorrente,
    codigoDaModalidade: vigente.codigoDaModalidade,
  };
}
