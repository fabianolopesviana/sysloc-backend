/**
 * Módulo da notícia bancária — a rota `@RotaPublica()` de `/v1/notificacoes-bancarias`.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o que já existe no processo, em vez de abrir recurso próprio
 * ---------------------------------------------------------------------------
 *
 * Duas coisas de infraestrutura chegam por importação, e nenhuma nasce aqui:
 *
 *   * a **unidade de trabalho** (`TOKEN_ACESSO_AO_NEGOCIO`), que nasce em `AutenticacaoModule` — quem
 *     a abre e, o que importa mais, quem a **encerra** no desligamento;
 *   * o **produtor de fila** (`TOKEN_PRODUTOR_DE_FILA`), que nasce em `../comum/fila.module.js`.
 *
 * Abrir aqui um segundo acesso ao banco, ou um segundo `conectarProdutorDeFila`, seria a saída mais
 * curta e a errada: duas reservas para o mesmo papel, dois donos do mesmo recurso, e um desligamento
 * que devolve parte deles. O cabeçalho de `../comum/produtor-de-fila.js` recusa isso por escrito.
 *
 * ⚠️ **Este é o TERCEIRO módulo de área a importar `FilaModule`**, e o crescimento é auditado por
 * igualdade de conjunto em `apps/api/test/alcance-da-fila.spec.ts`: um importador novo **reprova
 * nomeando o arquivo** até que a lista seja revisada por escrito. É o mecanismo funcionando — a
 * contenção da capacidade de enfileirar deixou de ser do contêiner de injeção e passou a ser de
 * revisão, e a rede executável é o que torna essa troca honesta.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão de `CobrancaBancariaModule`
 * ---------------------------------------------------------------------------
 *
 * A notícia age sobre uma cobrança, mas **não pertence à superfície da cobrança bancária**: as três
 * rotas de lá exigem sessão e `TELA:financeiro`, e esta não exige sessão nenhuma. Pendurá-la ali
 * reuniria, sob um registro só, a superfície governada pela área e uma **exceção de segurança** — e a
 * exceção ficaria a um decorador de distância de ser lida como regra. É a mesma decisão, com a mesma
 * razão, que `../confirmacoes/confirmacoes.module.ts` registra sobre `CadastrosModule`.
 *
 * O recurso também é outro: o segmento é `/v1/notificacoes-bancarias`, sem `:id` e sem chave exposta,
 * porque quem envia **não conhece** identificador nosso algum — e não deve conhecer. Quem resolve o
 * par (empresa, cobrança) é a travessia nominal do processo de trabalho, a partir da chave que o
 * próprio produto emitiu e que fez o trajeto de ida e volta (ADR-0035).
 *
 * ⚠️ **Ele não exporta nada**, e a ausência é a decisão: o serviço existe para esta rota, e publicá-lo
 * daria a outro módulo a capacidade de gravar notícia crua por um caminho que a superfície não
 * enumera.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { FilaModule } from '../comum/fila.module.js';
import { NotificacaoBancariaController } from './notificacao-bancaria.controller.js';
import { NotificacaoBancariaService } from './notificacao-bancaria.service.js';

@Module({
  imports: [AutenticacaoModule, FilaModule],
  controllers: [NotificacaoBancariaController],
  providers: [NotificacaoBancariaService],
})
export class NotificacoesBancariasModule {}
