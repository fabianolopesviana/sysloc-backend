/**
 * O conjunto padrão de chaves de cada perfil — a matriz que a **ADR-0010** chama de *default*.
 *
 * ---------------------------------------------------------------------------
 * Por que constante de código, e não linha de banco
 * ---------------------------------------------------------------------------
 *
 * A ADR-0010 fixa o perfil como conceito **vivo**: corrigir um default alcança, na requisição
 * seguinte, todo mundo que não tem ajuste individual sobre aquela chave. Materializar o efetivo por
 * pessoa no salvamento — a alternativa que a ADR rejeita — faria a base acumular retratos
 * divergentes sem origem comum, e corrigir um default não alcançaria ninguém já criado.
 *
 * A contrapartida é que a matriz vive no código e muda por implantação, não por tela. É deliberado:
 * ela é o vocabulário do produto, e não dado de tenant.
 *
 * ---------------------------------------------------------------------------
 * `Record<Perfil, …>`: o compilador é quem exige a entrada
 * ---------------------------------------------------------------------------
 *
 * `Perfil` é derivado de `identidade.perfil_usuario`. Anotar a matriz como `Record<Perfil, …>` é o
 * que faz um perfil novo no enum do schema **não compilar** enquanto não ganhar conjunto padrão
 * aqui — em vez de nascer alcançando o vazio por omissão, que é uma falha silenciosa e do lado
 * errado da segurança, porque ninguém a nota até alguém reclamar de tela faltando.
 */

import { CHAVES_DE_ACAO, CHAVES_DE_TELA, type ChaveDoCatalogo } from './catalogo-de-permissoes.js';
import type { Perfil } from './perfis.js';

/**
 * O conjunto padrão de cada perfil.
 *
 * ---------------------------------------------------------------------------
 * `SYSLOC_MASTER` é VAZIO — isto é estrutural, não esquecimento
 * ---------------------------------------------------------------------------
 *
 * As 17 chaves do catálogo são áreas e ações **do app da imobiliária**, e o operador do SaaS não
 * alcança dado de negócio por caminho nenhum (RN-13, decisão 16). Ele alcança as rotas dele pela
 * **dimensão de perfil** da ADR-0011 (`PERFIL:SYSLOC_MASTER`), nunca por chave — e é exatamente
 * essa separação que impede o catálogo, declarado fechado, de inchar com chave sintética para as
 * operações do operador.
 *
 * Some-se que ele **não pode nem ter ajuste individual**: eles vivem em
 * `negocio.acesso_usuario_permissao`, presa ao vínculo de acesso, que é tenantizado — e o Master
 * não pertence a empresa alguma. O efetivo dele é, portanto, **sempre** este conjunto vazio, e
 * `GET /v1/sessao` devolve `telas: []` e `acoes: []` para ele (§4.2 da tech spec).
 *
 * ---------------------------------------------------------------------------
 * `ADMIN_EMPRESA` é o catálogo inteiro — e por que derivado, não redigitado
 * ---------------------------------------------------------------------------
 *
 * A decisão 38 lhe dá *"tudo na própria empresa + gestão de usuários"*. Derivar do catálogo é o que
 * faz uma chave nova nascer alcançável pelo Admin sem edição aqui; redigitar a lista faria o
 * contrário — a chave nova nasceria fora do alcance do Admin, e ninguém na empresa poderia
 * concedê-la a ninguém, porque conceder é ação da área `Usuários`, que só o Admin alcança. O
 * "tudo" é da empresa dele: o alcance a outra empresa é impossível pelo banco (RLS e chave
 * estrangeira composta, ADR-0008), não por ausência de chave.
 *
 * ---------------------------------------------------------------------------
 * `USUARIO_EMPRESA` começa só no Resumo — o menor privilégio que ainda deixa entrar
 * ---------------------------------------------------------------------------
 *
 * A decisão 38 o descreve como *"conforme liberação"*, e a US-09 é toda sobre o Admin conceder e
 * retirar área por área. O padrão, então, é o **piso**: a pessoa entra e vê o Resumo; tudo o mais
 * é ajuste individual, concedido por quem administra.
 *
 * A escolha do piso mínimo é de segurança, e a assimetria do erro é o que a decide: um padrão largo
 * demais entrega, a toda pessoa criada, alcance que ninguém pediu — e o Admin só descobre quando já
 * foi usado. Um padrão estreito demais produz um pedido ao Admin, que resolve em um clique. Não é
 * conjunto vazio porque a pessoa precisa de alguma tela para que entrar signifique alguma coisa; o
 * Resumo é a área de chegada e não comporta ação sensível nenhuma — nenhuma entrada do mapa
 * ação→tela aponta para ela —, de modo que o piso não carrega nada de irreversível.
 *
 * O contraste com o Master é o que este comentário existe para preservar: **as duas quase-ausências
 * têm causas opostas**. A do Master é estrutural e definitiva — ele nunca alcança nada daqui. A do
 * Usuário é o ponto de partida de um conjunto que o Admin faz crescer.
 */
export const MATRIZ_POR_PERFIL: Readonly<Record<Perfil, readonly ChaveDoCatalogo[]>> =
  Object.freeze({
    SYSLOC_MASTER: Object.freeze([] as readonly ChaveDoCatalogo[]),
    ADMIN_EMPRESA: Object.freeze([...CHAVES_DE_TELA, ...CHAVES_DE_ACAO]),
    USUARIO_EMPRESA: Object.freeze(['TELA:resumo'] as readonly ChaveDoCatalogo[]),
  });
