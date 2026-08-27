/**
 * A identidade da empresa perante o provedor bancário — registro e consulta.
 *
 * ---------------------------------------------------------------------------
 * O IDENTIFICADOR ENTRA, CIFRA E NUNCA VOLTA
 * ---------------------------------------------------------------------------
 *
 * O identificador da aplicação é segredo operável de terceiro (ADR-0032): o produto precisa **usá-lo**
 * para compor o pedido de credencial, e por isso ele é cifrado de forma reversível, com a chave
 * vivendo fora da árvore. Ele **não retorna por superfície alguma** — nem na resposta do registro,
 * nem na consulta, nem em erro ou diagnóstico.
 *
 * A cifra usa {@link cifrarValorOperavel}, e **não** o envelope do par material+senha: os dois
 * quadros têm faixas de versão disjuntas justamente para que um não se abra como o outro. A razão de
 * serem separados está no docblock de `identidadeNoProvedor` (ciclos de vida distintos).
 *
 * A chave é a **mesma** do certificado (`CHAVE_DE_CIFRA_DO_CERTIFICADO`), e isso é deliberado: uma
 * segunda chave seria um segundo segredo a distribuir, a rodar e a perder, protegendo dado do mesmo
 * dono, no mesmo banco, contra o mesmo adversário.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type DadosDaIdentidade,
  type IdentidadeGravada,
  lerIdentidadeVigente,
  registrarIdentidadeNoProvedor,
} from '@sysloc/db';
import { CodigoErro, cifrarValorOperavel, ErroDeAplicacao } from '@sysloc/shared';
import type { Identidade, IdentidadeNova } from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { type Ambiente, TOKEN_AMBIENTE } from '../configuracao/ambiente.js';

/** A projeção publicada, montada campo a campo — nunca por espalhamento da linha. */
function publicar(gravada: IdentidadeGravada): Identidade {
  return {
    id: gravada.id,
    numeroDoCliente: gravada.numeroDoCliente,
    numeroDaContaCorrente: gravada.numeroDaContaCorrente,
    codigoDaModalidade: gravada.codigoDaModalidade,
    registradoPor: { id: gravada.registradoPor.id, nome: gravada.registradoPor.nome },
    registradoEm: gravada.registradoEm.toISOString(),
  };
}

@Injectable()
export class IdentidadeNoProvedorService {
  constructor(
    // O ambiente **já validado** na partida — é dele que sai a chave de cifra. Um `process.env` lido
    // aqui escaparia da conferência que recusa chave de comprimento errado.
    @Inject(TOKEN_AMBIENTE) private readonly ambiente: Ambiente,
  ) {}

  async registrar(
    tx: TransactionSql,
    entrada: IdentidadeNova,
    registradoPor: string,
  ): Promise<Identidade> {
    const dados: DadosDaIdentidade = {
      identificadorDaAplicacaoCifrado: cifrarValorOperavel(
        entrada.identificadorDaAplicacao,
        this.ambiente.chaveDeCifraDoCertificado,
      ),
      numeroDoCliente: entrada.numeroDoCliente,
      numeroDaContaCorrente: entrada.numeroDaContaCorrente,
      codigoDaModalidade: entrada.codigoDaModalidade,
      registradoPor,
    };

    return publicar(await registrarIdentidadeNoProvedor(tx, dados));
  }

  async consultar(tx: TransactionSql): Promise<Identidade> {
    const vigente = await lerIdentidadeVigente(tx);

    if (vigente === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        'não há identidade registrada para esta empresa',
      );
    }

    return publicar(vigente);
  }
}
