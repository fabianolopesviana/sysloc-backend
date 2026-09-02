/**
 * Módulo do operador do SaaS — as rotas de `/v1/master`: as **seis** do ciclo de vida da empresa e
 * da admissão de administradores, mais as **três** do ciclo de vida do Admin Empresa que a fatia
 * `painel-master-administradores` acrescenta (listagem, suspensão e reativação).
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * O serviço precisa de três coisas que já existem no processo: a instância do arcabouço de
 * identidade, o acesso restrito a `identidade` (que as duas funções de onboarding de `@sysloc/auth`
 * exigem por assinatura) e a unidade de trabalho. As três nascem em `AutenticacaoModule`, que é
 * quem as abre e — o que importa mais — quem as **encerra** no desligamento
 * (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAIdentidade` ou um segundo `abrirAcessoAoBanco` seria a saída
 * mais curta e a errada: duas reservas de conexões para o mesmo papel, duas donas do mesmo recurso,
 * e um desligamento que só devolve metade delas. Importar o módulo é o que mantém **uma** instância
 * de cada, com dono único.
 *
 * A alternativa de subir os dois acessos para a composição raiz — anotada como decisão a rever
 * "quando as rotas de Master e de usuários chegarem" — foi descartada por essa mesma razão: mover o
 * provedor sem mover o gancho de desligamento deixaria o recurso sem dono, e mover os dois é
 * refatoração da fatia anterior sem ganho para esta.
 *
 * ---------------------------------------------------------------------------
 * E ele importa o módulo da FILA desde a T9 da fatia `webhook-e-carne`
 * ---------------------------------------------------------------------------
 *
 * A reativação de uma empresa suspensa **retoma as notícias bancárias retidas** (CA-10), e a
 * retomada sai por fila em vez de correr em linha na resposta (ADR-0029). A capacidade de enfileirar
 * chega pela mesma porta de sempre — `FilaModule`, dono único da conexão —, e **não** por um
 * `conectarProdutorDeFila` escrito aqui: o cabeçalho de `comum/produtor-de-fila.ts` recusa a segunda
 * conexão por escrito, e a lista dos módulos que declaram `imports: [FilaModule]` é justamente o que
 * mantém a capacidade enumerável. Este acréscimo passa pela revisão de
 * `apps/api/test/alcance-da-fila.spec.ts`, que fixa essa lista por igualdade de conjunto.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { FilaModule } from '../comum/fila.module.js';
import { AdministradorController } from './administrador.controller.js';
import { AdministradorService } from './administrador.service.js';
import { EmpresaController } from './empresa.controller.js';
import { EmpresaService } from './empresa.service.js';

@Module({
  // ⚠️ `imports` NÃO muda com a chegada do ciclo de vida do Admin Empresa, e a estabilidade é
  // conteúdo: `apps/api/test/alcance-da-fila.spec.ts` fixa por igualdade de conjunto a lista de
  // módulos que declaram `FilaModule`, e `MasterModule` já está nela por causa da retomada de
  // notícias retidas da reativação de EMPRESA. `AdministradorService` **não enfileira nada** — a
  // reativação de pessoa não tem trabalho retido a retomar —, e ele nem sequer recebe o produtor.
  imports: [AutenticacaoModule, FilaModule],
  controllers: [EmpresaController, AdministradorController],
  providers: [EmpresaService, AdministradorService],
})
export class MasterModule {}
