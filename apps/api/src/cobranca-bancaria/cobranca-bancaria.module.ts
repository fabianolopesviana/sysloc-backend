/**
 * Módulo da cobrança bancária — as **três** rotas de `/v1/cobranca-bancaria`.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o que já existe no processo, em vez de abrir recurso próprio
 * ---------------------------------------------------------------------------
 *
 * Duas coisas de infraestrutura chegam por importação, e nenhuma delas nasce aqui:
 *
 *   * a **unidade de trabalho** (`TOKEN_ACESSO_AO_NEGOCIO`), que nasce em `AutenticacaoModule` — quem
 *     a abre e, o que importa mais, quem a **encerra** no desligamento;
 *   * o **produtor de fila** (`TOKEN_PRODUTOR_DE_FILA`), que nasce em `../comum/fila.module.js`.
 *
 * Abrir aqui um segundo acesso ao banco, ou um segundo `conectarProdutorDeFila`, seria a saída mais
 * curta e a errada: duas reservas para o mesmo papel, dois donos do mesmo recurso, e um desligamento
 * que devolve parte deles. O cabeçalho de `../comum/produtor-de-fila.js` recusa isso por escrito, e a
 * razão da casa única da fila está por extenso em `../comum/fila.module.js`.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão de `CobrancasModule`
 * ---------------------------------------------------------------------------
 *
 * As duas superfícies partilham a área de autorização (`TELA:financeiro`) e nada mais. `/v1/cobrancas`
 * publica atos e leituras **sobre uma cobrança**, com `:codigo` no caminho; esta publica **execuções**
 * — o lote e a apuração —, cuja chave exposta é UUID porque não há série declarada para elas
 * (ADR-0017), e cujo conjunto de alvos é decidido por predicado no banco (ADR-0023).
 *
 * Há uma segunda razão, e ela é de composição: `CobrancasModule` monta o adaptador do provedor e a
 * guarda de bytes, que **nenhuma** das três rotas daqui usa — quem fala com o provedor no lote e na
 * conferência é o processo de trabalho, do outro lado da fila. Fundir os dois faria esta superfície
 * arrastar a construção de um cliente mTLS que ela não invoca.
 *
 * ⚠️ **Ele não exporta nada**, e a ausência é a decisão: os dois serviços existem para estas três
 * rotas, e publicá-los daria a outro módulo a capacidade de abrir lote ou conferência por um caminho
 * que a superfície não enumera.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { FilaModule } from '../comum/fila.module.js';
import { CobrancaBancariaController } from './cobranca-bancaria.controller.js';
import { ConferenciaBancariaService } from './conferencia-bancaria.service.js';
import { EmissaoEmLoteService } from './emissao-em-lote.service.js';

@Module({
  imports: [AutenticacaoModule, FilaModule],
  controllers: [CobrancaBancariaController],
  providers: [EmissaoEmLoteService, ConferenciaBancariaService],
})
export class CobrancaBancariaModule {}
