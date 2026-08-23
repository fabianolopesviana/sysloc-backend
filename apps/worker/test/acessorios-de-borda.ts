/**
 * A unidade de trabalho sob contexto de empresa — **casa compartilhada do arranjo deste diretório**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA EXISTE AQUI, e não em `packages/db/test/`
 * ---------------------------------------------------------------------------
 *
 * `packages/db/test/unidade-sob-contexto.ts` **já é** a casa compartilhada do acessório — para as
 * suítes daquele pacote. Ela **não serve** para este, e a razão é estrutural, não de gosto: aquele
 * módulo resolve `contextoDeTenant` pelo **fonte** (`../src/contexto.ts`), enquanto `apps/worker`
 * resolve `@sysloc/db` pela fronteira publicada, que o `exports` manda para `dist/`. São **dois
 * módulos distintos**, cada um com o próprio `AsyncLocalStorage`: o arranjo fixaria o contexto num, a
 * unidade de trabalho leria o outro, e **toda escrita cairia** em `new row violates row-level
 * security policy`.
 *
 * ⚠️ **Isso foi MEDIDO, e não deduzido**: a suíte `./rotina-agendada.spec.ts` nasceu importando aquele
 * acessório e reprovou exatamente assim, em `criarConjunto`, `registrarCertificado` e
 * `execucao_de_rotina`. É a mesma armadilha de `dist/` que a `.claude/rules/testing-stack.md`
 * documenta para a prova de falsificação, aqui na direção do arranjo.
 *
 * E **não é um alias que a resolveria**: apontar `@sysloc/db` para `src/` neste pacote desarmaria em
 * silêncio a guarda de superfície publicada — a fronteira de monorepo é legítima e vale mais do que a
 * conveniência de reusar aquele arquivo.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELA **NÃO** FAZ, E É DELIBERADO
 * ---------------------------------------------------------------------------
 *
 * Ela **não abre** o acesso ao banco e **não o encerra**: quem o faz é o `beforeAll`/`afterAll` da
 * suíte, que é quem conhece a instância efêmera. `acesso` chega **por parâmetro** porque é o único
 * símbolo local que as declarações locais capturavam — passá-lo é o que torna a casa possível sem
 * estado de módulo, e é a mesma escolha que a ADR-0025 faz para as portas do produto.
 *
 * Ela **não** emite `SET LOCAL` nem toca a variável de sessão: quem a fixa é o escritor único de
 * `packages/db/src/unidade-de-trabalho.ts`, sob duas `DECISÃO FECHADA`, e um atalho escrito aqui seria
 * o contorno que as âncoras de `packages/db/test/` varrem nominalmente.
 *
 * O arquivo não termina em `.spec.ts`, então o arcabouço não o executa como caso; o
 * `tsconfig.test.json` continua verificando os tipos dele. Mesma forma, e mesma razão, de
 * `./varredura-de-segredo.ts`.
 */

// DÉBITO COM GATILHO — D11 · F5/T6 · registrado 2026-08-23
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: esta casa nasce com **um** consumidor. `apps/worker/test/` tem **7** declarações locais de
//        `emUnidade` — medido em 2026-08-23: `regua`, `confirmacao-de-email`, `emissao-em-lote`,
//        `conferencia-bancaria`, `notificacao-bancaria`, `reconferencia-da-entrega` e a que agora
//        importa daqui. As 6 restantes seguem com cópia privada, e endurecer esta deixa as 6 para
//        trás.
// QUANDO FECHA: a primeira task autorizada a abrir uma das 6 suítes por outra razão troca a
//        declaração local por um `import` daqui, e a contagem cai de uma em uma. Fechado quando a
//        última sair.
// POR QUE NÃO AGORA: migrar as 6 é alargamento de escopo num diretório que a T6 não tem autorização
//        para tocar, e a proibição 5 do Protocolo Antirregressão — *"nunca aproveitar que estou
//        aqui"* — vale com força aqui. O que esta casa impede é a **oitava** nascer solta.
// ÍNDICE: docs/specs/features/automacoes-agendadas/v1/_run/run-report.md §2, D11

import type { AcessoAoBanco } from '@sysloc/db';
import { contextoDeTenant } from '@sysloc/db';
import type { TransactionSql } from 'postgres';

/**
 * O contexto de uma empresa **conhecida**, como a guarda o publica a partir da sessão.
 *
 * É o subconjunto não-nulo de `contextoDeTenant.ContextoDeTenant`, cujo `empresaId` é
 * `string | null` porque o processo também opera fora de qualquer empresa. Aqui ele é `string` sem
 * alternativa: toda suíte de borda monta o arranjo **sob uma empresa**, e o identificador dela é
 * usado também fora da unidade. Um `null` atravessando essas posições viraria `WHERE id = NULL`, que
 * não casa linha alguma e faria o arranjo falhar longe da causa.
 */
export interface Contexto {
  readonly empresaId: string;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de **uma** unidade de trabalho.
 *
 * É o par `executarCom` + `emUnidadeDeTrabalho` — o mesmo que a guarda e o controlador usam em
 * operação, e o único caminho legítimo por onde uma suíte deste diretório alcança o banco.
 *
 * ⚠️ Ele monta o **estado**; nunca o contexto da tarefa sob prova, que nasce na borda a partir da
 * carga (ADR-0024). Uma suíte que fixasse o contexto do trabalho por aqui passaria mesmo com a borda
 * não abrindo contexto nenhum — que é o defeito que essas suítes existem para pegar.
 */
export async function emUnidadeSobContexto<T>(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}
