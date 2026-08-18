/**
 * O **dono único** da conexão com o servidor de fila — quem a abre, quem a provê e quem a devolve.
 *
 * ---------------------------------------------------------------------------
 * Por que ele nasce agora, e por que ele NÃO é um afrouxamento da contenção anterior
 * ---------------------------------------------------------------------------
 *
 * Até a T15 havia **um** produtor de efeito externo na borda — a confirmação de e-mail —, e o
 * provedor da fila morava em `cadastros/cadastros.module.ts`, deliberadamente **fora** de qualquer
 * `exports`. A razão escrita ali é a que continua valendo, palavra por palavra: *"a única superfície
 * que alcança a fila desta aplicação é a desta área; publicá-lo daria a todo controlador do produto
 * a capacidade de enfileirar trabalho, que é justamente a capacidade que se quer enumerável"*.
 *
 * A T15 traz o **segundo** e o **terceiro** produtores (a emissão em lote e a conferência bancária,
 * ADR-0029), em outra área. As três saídas possíveis eram:
 *
 *   1. **Um segundo `conectarProdutorDeFila` no módulo da cobrança bancária** — recusada, e o
 *      cabeçalho de `produtor-de-fila.ts` a recusa por escrito: *"a conexão com o servidor de fila, o
 *      objeto produtor e a política de repetição precisam de um dono, com um encerramento só, ou a
 *      aplicação passa a ter tantas conexões quanto forem os serviços que quiserem enfileirar — e um
 *      desligamento que devolve parte delas"*. Seriam duas reservas, dois donos e um desligamento
 *      pela metade;
 *   2. **`CadastrosModule` exportar o token** — recusada por outra razão: faria o módulo da cobrança
 *      bancária **importar o módulo de cadastros** para alcançar infraestrutura de processo, um
 *      acoplamento que não existe no domínio e que nenhum leitor conseguiria explicar;
 *   3. **a casa própria, que é este arquivo** — adotada. É a mesma forma, com a mesma razão, do
 *      acesso ao banco: ele nasce em `autenticacao/autenticacao.module.ts`, é exportado, e todos os
 *      módulos de área o importam em vez de abrir reserva própria.
 *
 * **A contenção não se perdeu; ela mudou de mecanismo.** Antes, a capacidade de enfileirar era
 * enumerável porque o provedor não saía do módulo; agora, porque ela é a lista — curta e explícita —
 * dos módulos que declaram `imports: [FilaModule]`. Continua sendo uma linha de `grep`, e continua
 * exigindo decisão de quem publica.
 *
 * ⚠️ **E a lista tem rede executável, porque a barreira nova é de REVISÃO.** O mecanismo antigo era
 * do contêiner de injeção — alcançar a fila exigia editar módulo alheio —, enquanto este cabe numa
 * linha no módulo do próprio autor. Quem fixa a lista, por igualdade de conjunto e com o excedente
 * nomeado, é `apps/api/test/alcance-da-fila.spec.ts`: ele afirma quem nomeia `FilaModule`, quem
 * nomeia `TOKEN_PRODUTOR_DE_FILA`, quem chama `conectarProdutorDeFila` e que este módulo **não** é
 * global. Acrescentar um consumidor reprova ali, e é essa reprovação que torna a frase acima
 * verdadeira em vez de aspiracional.
 *
 * ---------------------------------------------------------------------------
 * O encerramento mora aqui porque quem abre é quem devolve
 * ---------------------------------------------------------------------------
 *
 * Enquanto a conexão estiver de pé, o temporizador de reconexão do cliente segura o laço de eventos,
 * e o desligamento gracioso que o ponto de entrada arma deixaria de ser gracioso — viraria morte por
 * temporizador do supervisor. O `onApplicationShutdown` **veio junto** com o provedor, e não ficou
 * para trás: deixá-lo em `CadastrosModule` faria o dono do recurso e o responsável pela devolução
 * serem módulos diferentes, que é o arranjo em que a devolução some numa refatoração futura.
 */

import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Logger } from '@sysloc/shared';
import { type Ambiente, TOKEN_AMBIENTE, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import {
  conectarProdutorDeFila,
  type ProdutorDeFila,
  TOKEN_PRODUTOR_DE_FILA,
} from './produtor-de-fila.js';

@Module({
  providers: [
    {
      provide: TOKEN_PRODUTOR_DE_FILA,
      useFactory: (ambiente: Ambiente, logger: Logger): ProdutorDeFila =>
        conectarProdutorDeFila(ambiente.cadeiaConexaoFila, logger),
      inject: [TOKEN_AMBIENTE, TOKEN_LOGGER],
    },
  ],
  exports: [TOKEN_PRODUTOR_DE_FILA],
})
export class FilaModule implements OnApplicationShutdown {
  constructor(@Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila) {}

  /**
   * Devolve o produtor e a conexão abertos na construção.
   *
   * Quem abre é dono do recurso, e a devolução não é cortesia — ver o cabeçalho. É a mesma razão, e
   * o mesmo lugar (o módulo que provê), do encerramento das duas reservas de conexão em
   * `autenticacao/autenticacao.module.ts`.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.produtor.encerrar();
  }
}
