/**
 * Módulo da área de cadastros de pessoa — locador, locatário e fiador.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * Os controladores que chegam na task seguinte precisam de uma coisa que já existe no processo: a
 * unidade de trabalho (`TOKEN_ACESSO_AO_NEGOCIO`). Ela nasce em `AutenticacaoModule`, que é quem a
 * abre e — o que importa mais — quem a **encerra** no desligamento (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAoBanco` seria a saída mais curta e a errada: duas reservas de
 * conexões para o mesmo papel, duas donas do mesmo recurso, e um desligamento que só devolve parte
 * delas. Importar o módulo é o que mantém **uma** instância, com dono único — é a mesma decisão, com
 * a mesma razão, que `imoveis/imoveis.module.ts`, `usuarios/usuarios.module.ts` e
 * `master/master.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é a área inteira, e não um módulo por papel
 * ---------------------------------------------------------------------------
 *
 * Os três papéis são servidos por **um** serviço parametrizado (`CadastroDePessoaService`), e os três
 * controladores que a task seguinte publica entram **aqui**. Um módulo por papel multiplicaria por
 * três a mesma importação e o mesmo registro sem separar nada que precise ser separado — e negaria,
 * na composição, a parametrização que o serviço afirma.
 *
 * ---------------------------------------------------------------------------
 * Ele nasceu SEM controlador, e a T9 acrescentou os três
 * ---------------------------------------------------------------------------
 *
 * A T8 entregou o acesso a dado e o domínio; o módulo nasceu ali porque é ele que dá lar ao serviço
 * na composição raiz — e porque um módulo que nascesse junto com as 18 rotas juntaria, no mesmo diff,
 * o registro da área e a publicação da superfície, que é exatamente o acúmulo que o corte entre as
 * duas tasks existe para evitar.
 *
 * Com os três controladores registrados, a superfície publicada cresce em **18 pares** e **18
 * manipuladores** — seis por papel. As quatro âncoras de contagem de
 * `test/cobertura-de-autorizacao.e2e.spec.ts` e a de `test/contexto.e2e.spec.ts` sobem junto, que é a
 * revisão que a ADR-0011 exige de quem publica rota: *"a superfície cresce por decisão de quem
 * publica rota, nunca em silêncio"*.
 *
 * Os três compartilham **um** provedor: `CadastroDePessoaService`, parametrizado pelo papel. É a
 * composição que torna verdadeira a afirmação da T8 — um serviço, três montagens —, e é por isso que
 * o papel entra por argumento na construção de cada controlador, e não por um provedor por papel.
 *
 * ---------------------------------------------------------------------------
 * Ele é o DONO do produtor de fila da aplicação (ADR-0029)
 * ---------------------------------------------------------------------------
 *
 * A confirmação de endereço de e-mail é o primeiro efeito externo que a borda HTTP dispara, e a
 * ADR-0029 manda que ele saia **por fila**. Isso faz da `api` produtora, e a conexão com o servidor
 * de fila precisa de um dono — quem a abre é quem a **encerra**, e o gancho de desligamento abaixo é
 * o par da fábrica acima. É a mesma decisão, com a mesma razão, que `automacao/automacao.module.ts`
 * registra para a porta de saída de e-mail.
 *
 * ⚠️ **O provedor fica fora de qualquer `exports`**, e a contenção é o ponto: a única superfície que
 * alcança a fila desta aplicação é a desta área. Publicá-lo daria a todo controlador do produto a
 * capacidade de enfileirar trabalho, que é justamente a capacidade que se quer enumerável.
 *
 * ⚠️ **Ele não abre um segundo acesso ao banco.** A unidade de trabalho continua vindo de
 * `AutenticacaoModule`, pela razão dos parágrafos acima — o que nasce aqui é a conexão com a fila,
 * que nenhum outro módulo abre.
 */

import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Logger } from '@sysloc/shared';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import {
  conectarProdutorDeFila,
  type ProdutorDeFila,
  TOKEN_PRODUTOR_DE_FILA,
} from '../comum/produtor-de-fila.js';
import { type Ambiente, TOKEN_AMBIENTE, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { CadastroDePessoaService } from './cadastro-de-pessoa.service.js';
import { ConfirmacaoDeEmailService } from './confirmacao-de-email.service.js';
import { FiadorController } from './fiador.controller.js';
import { LocadorController } from './locador.controller.js';
import { LocatarioController } from './locatario.controller.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [LocadorController, LocatarioController, FiadorController],
  providers: [
    CadastroDePessoaService,
    ConfirmacaoDeEmailService,
    {
      provide: TOKEN_PRODUTOR_DE_FILA,
      useFactory: (ambiente: Ambiente, logger: Logger): ProdutorDeFila =>
        conectarProdutorDeFila(ambiente.cadeiaConexaoFila, logger),
      inject: [TOKEN_AMBIENTE, TOKEN_LOGGER],
    },
  ],
})
export class CadastrosModule implements OnApplicationShutdown {
  constructor(@Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila) {}

  /**
   * Devolve a conexão com o servidor de fila aberta na construção.
   *
   * Quem abre é dono do recurso, e a devolução não é cortesia: enquanto a conexão estiver de pé, o
   * temporizador de reconexão do cliente segura o laço de eventos, e o desligamento gracioso que o
   * ponto de entrada arma deixaria de ser gracioso — viraria morte por temporizador do supervisor.
   * É a mesma razão, e o mesmo lugar (o módulo que provê), do encerramento das duas reservas de
   * conexão em `autenticacao/autenticacao.module.ts`.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.produtor.encerrar();
  }
}
