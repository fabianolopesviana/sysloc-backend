/**
 * Módulo de cadastro de imóveis — hoje as seis rotas de `/v1/conjuntos`, as seis de `/v1/imoveis` e
 * as três de `/v1/imoveis/:id/comodos`.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * O controlador precisa de uma coisa que já existe no processo: a unidade de trabalho
 * (`TOKEN_ACESSO_AO_NEGOCIO`). Ela nasce em `AutenticacaoModule`, que é quem a abre e — o que importa
 * mais — quem a **encerra** no desligamento (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAoBanco` seria a saída mais curta e a errada: duas reservas de
 * conexões para o mesmo papel, duas donas do mesmo recurso, e um desligamento que só devolve parte
 * delas. Importar o módulo é o que mantém **uma** instância, com dono único — é a mesma decisão, com
 * a mesma razão, que `usuarios/usuarios.module.ts` e `master/master.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é o agregado inteiro, e não um módulo por entidade
 * ---------------------------------------------------------------------------
 *
 * Conjunto, imóvel e cômodo são o **mesmo agregado** (§3.2 da tech spec), e as tasks seguintes
 * acrescentam os controladores e serviços deles **aqui**. Um módulo por entidade multiplicaria por
 * três a mesma importação e o mesmo registro sem separar nada que precise ser separado.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { ComodoController } from './comodo.controller.js';
import { ComodoService } from './comodo.service.js';
import { ConjuntoController } from './conjunto.controller.js';
import { ConjuntoService } from './conjunto.service.js';
import { ImovelController } from './imovel.controller.js';
import { ImovelService } from './imovel.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [ConjuntoController, ImovelController, ComodoController],
  // `ComodoService` depende de `ImovelService` — é dele a leitura que devolve o imóvel recalculado
  // que as três rotas de cômodo respondem. Os dois vivem neste módulo, e é por isso que a injeção
  // resolve sem `exports`: o agregado inteiro (conjunto, imóvel e cômodo) é um módulo só, pela razão
  // registrada acima.
  providers: [ConjuntoService, ImovelService, ComodoService],
})
export class ImoveisModule {}
