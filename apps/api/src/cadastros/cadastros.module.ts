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
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { CadastroDePessoaService } from './cadastro-de-pessoa.service.js';
import { FiadorController } from './fiador.controller.js';
import { LocadorController } from './locador.controller.js';
import { LocatarioController } from './locatario.controller.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [LocadorController, LocatarioController, FiadorController],
  providers: [CadastroDePessoaService],
})
export class CadastrosModule {}
