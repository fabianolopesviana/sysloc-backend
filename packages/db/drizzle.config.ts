/**
 * Configuração do gerador de migração.
 *
 * Ele é usado APENAS para gerar SQL a partir do schema declarado (`pnpm --filter @sysloc/db
 * gerar-migracao`), nunca para aplicar migração: quem aplica é `deploy/scripts/instalacao/
 * migrar-banco.sh` em operação, e `test/banco-efemero.ts` na verificação — os dois lendo os
 * mesmos arquivos de `migracoes/`.
 *
 * Por isso NÃO existe aqui o bloco `dbCredentials`, e nenhuma coordenada de conexão é lida do
 * ambiente. A ausência é deliberada e tem duas razões que se somam:
 *
 *   1. **ADR-0006** — o gerador que soubesse conectar seria mais um caminho pelo qual a atividade
 *      de desenvolvimento alcança o ambiente que atende a operação. Ele não precisa disso:
 *      `drizzle-kit generate` compara o schema declarado com o histórico em `migracoes/meta/`,
 *      inteiramente fora de linha.
 *   2. **§7.3 da tech spec** — a migração é aplicada pelo papel `sysloc_migracao`, cuja credencial
 *      trafega por `PGPASSFILE` no script de operação (ADR-0005). Declará-la aqui a colocaria numa
 *      variável de ambiente do processo de desenvolvimento, que é exatamente o transporte que a
 *      ADR-0005 proíbe.
 *
 * ---------------------------------------------------------------------------
 * Antes de regerar: `pnpm build` é PRÉ-CONDIÇÃO (desde a T2 da fatia de cadastro)
 * ---------------------------------------------------------------------------
 *
 * `src/esquema/negocio.ts` importa os literais dos enums de `@sysloc/contracts`, cujo `exports`
 * resolve para `dist/` — que o `.gitignore` barra. Em árvore limpa,
 * `pnpm --filter @sysloc/db gerar-migracao` **falha na resolução do módulo**.
 *
 * O `references` do `tsconfig.json` daqui não salva: ele governa `tsc --build` e a suíte, e o
 * drizzle-kit não o consulta. O Turborepo também não, porque `gerar-migracao` **não é tarefa
 * declarada** em `turbo.json` (lá existem apenas `build`, `test` e `lint`) e portanto não tem grafo
 * de dependência a resolver. Rode `pnpm build` na raiz antes, e a falha não acontece.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO se "corrige" à mão na saída do gerador
 * ---------------------------------------------------------------------------
 *
 * A restrição de verificação de `negocio.comodo` sai **totalmente qualificada**:
 * `CHECK ("negocio"."comodo"."metragem" >= 0)`. É a forma que o drizzle-kit emite quando a
 * expressão interpola a coluna, o PostgreSQL a aceita dentro do `CREATE TABLE` (o nome resolve para
 * a tabela em criação), e ela está aplicada e provada na `0005_dominio_locacao.sql`.
 *
 * **Não a encurte para `CHECK (metragem >= 0)`.** O gerador voltaria a emitir a forma qualificada na
 * regeração seguinte, e o diff entre o arquivo versionado e a saída do gerador viraria ruído
 * permanente — o mesmo tipo de divergência silenciosa que a supressão manual dos `CREATE SCHEMA`,
 * logo abaixo, obriga a refazer de propósito e por escrito.
 *
 * ---------------------------------------------------------------------------
 * A SEGUNDA classe de intervenção manual: o delta da migração AUTORAL reemitido
 * ---------------------------------------------------------------------------
 *
 * `meta/` só ganha snapshot em migração **gerada**. Migração **autoral** que altere estrutura
 * declarada em `src/esquema/*.ts` — coluna nova, `CHECK` reescrita, restrição trocada — muda o banco
 * e **não** muda o snapshot. O gerador segue comparando o schema declarado contra o último snapshot,
 * que é anterior a ela, e por isso **reemite o delta inteiro daquela autoral** dentro da gerada
 * seguinte.
 *
 * Medido na T3 da fatia `automacoes-agendadas`: a `0025_estado_ternario_da_entrega.sql` é a primeira
 * autoral do produto a alterar estrutura declarada (`situacao`, `referencia_no_provedor` e as duas
 * `CHECK` de `entrega_da_noticia`), e a geração seguinte — a `0026` — trouxe as **cinco** instruções
 * dela de volta. Elas foram removidas à mão, e **a remoção é obrigatória**: aplicadas em ordem sobre
 * um banco vazio, a `0025` cria `situacao` e a `0026` tentaria criá-la de novo (`42701`, *column
 * already exists*), derrubando `test/banco-efemero.ts` e a suíte inteira junto; sobre o banco
 * durável, o mesmo, porque a `0025` já correu.
 *
 * ⚠️ **As duas correções intuitivas são erradas, e uma delas é DESTRUTIVA.** Diante da suíte
 * vermelha o reflexo é **(a)** editar a `0025` para ela não conflitar — mas migração aplicada é
 * IMUTÁVEL, o instalador a confere por `sha256sum` e a divergência **aborta a instalação sobre o
 * banco durável** —, ou **(b)** regerar a `0026`, que reintroduz em silêncio o delta suprimido. A
 * correta é a terceira: **suprimir na gerada as instruções que a autoral já aplicou, e NÃO tocar o
 * snapshot dela**.
 *
 * ⚠️ **O snapshot da gerada não se toca, e é ELE que fecha o caminho incremental.** O
 * `meta/0026_snapshot.json` registra o estado do schema **declarado**, já com `situacao`,
 * `referencia_no_provedor` e as `CHECK` na forma que a `0025` deixou — medido: o `prevId` dele é o
 * `id` de `meta/0023_snapshot.json`. Daí a separação, que é a mesma que o comentário do
 * `schemaFilter` já faz para o `CREATE SCHEMA` e pela mesma razão — o que fecha o caminho
 * incremental é o snapshot, e o que a geração do zero não tem é ele:
 *
 *   * **geração INCREMENTAL** (o caso normal, com `meta/` intacto): o assunto está fechado. O
 *     gerador parte do snapshot e **não** reemite o delta suprimido; **nada há a refazer**;
 *   * **geração DO ZERO** (`meta/` descartado, ou regeração da própria `0026`): a supressão volta a
 *     ser **manual e obrigatória**, exatamente como a dos dois `CREATE SCHEMA` logo abaixo.
 *
 * O que **não** resolve: pôr o delta de volta na autoral, escrever snapshot à mão para a autoral, ou
 * declarar a gerada como autoral. Os três desfazem a única propriedade que hoje segura o caminho
 * incremental — o snapshot da gerada ser a saída fiel do gerador para o schema declarado.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/esquema/*.ts',
  // DÉBITO COM GATILHO — D5 · F5/T3 · registrado 2026-08-22
  // O QUÊ: a saída do gerador tem DUAS classes de intervenção manual obrigatória, e nenhuma é
  //        automatizada — a supressão dos dois `CREATE SCHEMA` e a supressão do delta de migração
  //        AUTORAL que alterou estrutura declarada (a `0025`, reemitida dentro da `0026`). As duas
  //        estão descritas por extenso no docblock acima, que é o que se lê antes de regerar.
  // QUANDO FECHA: a próxima migração autoral que alterar estrutura declarada em `src/esquema/*.ts`,
  //        ou uma regeração DO ZERO (`meta/` descartado) — nos dois casos a supressão é refeita à
  //        mão, e o docblock acima é onde quem for regerar tem de passar antes.
  // ⚠️ RECORRENTE: o gatilho NÃO extingue o débito. Refeita a supressão, a obrigação volta idêntica
  //        na regeração seguinte, porque a causa é do `drizzle-kit` (snapshot só em migração
  //        gerada) e não deste repositório. **Cumprir o gatilho não autoriza remover este marcador
  //        nem a linha do índice do `CLAUDE.md`** — o que o gatilho pede é reler o docblock acima
  //        antes de aceitar a saída do gerador. Mesma leitura que as linhas `D28 · F0/T5`,
  //        `D20 · F3/T7` e `D51 · F4/T16` do índice já carregam, cada uma pela razão dela.
  // POR QUE NÃO AGORA: automatizar exigiria o `drizzle-kit` aceitar snapshot escrito por migração
  //        autoral, que é comportamento dele e não deste repositório; e o caminho incremental já
  //        está fechado pelo `meta/0026_snapshot.json`, de modo que hoje não há o que refazer.
  // ÍNDICE: docs/specs/features/automacoes-agendadas/v1/_run/run-report.md §2, D5
  out: './migracoes',
  // O que esta linha faz: restringe a `identidade` e `negocio` os schemas do PostgreSQL que o
  // drizzle-kit INTROSPECTA nos comandos `pull` e `push` — o padrão dele é considerar apenas
  // `public`, que aqui não guarda objeto nenhum. É o que a documentação do próprio pacote declara
  // (`drizzle-kit/index.d.ts`, verbete `schemaFilter`).
  //
  // O que ela NÃO faz — e a afirmação contrária já esteve escrita aqui: ela não suprime linha
  // alguma da saída de `generate`. Verificado nesta task: uma geração DO ZERO (diretório de saída
  // vazio) com esta linha intacta emite `CREATE SCHEMA "identidade"` e `CREATE SCHEMA "negocio"`
  // assim mesmo, e o SQL produzido é byte a byte idêntico ao gerado sem ela. Faz sentido: o
  // `generate` é inteiramente fora de linha e não introspecta banco nenhum.
  //
  // Por isso a supressão dos dois `CREATE SCHEMA` é MANUAL e OBRIGATÓRIA a cada regeração do zero.
  // Os schemas nascem do provisionamento (`deploy/scripts/instalacao/provisionar-base.sh`), com
  // dono `sysloc_migracao`; criá-los na migração exigiria conceder ao migrador o privilégio
  // `CREATE` sobre o banco — poder maior do que a tarefa pede (§7.3 da tech spec). O cabeçalho de
  // `migracoes/0000_fundacao.sql` registra a remoção e diz o mesmo; quem regenerar tem de removê-
  // las de novo, e `deploy/scripts/instalacao/verificar-migracao.sh` (T5) é o que reprova se elas
  // voltarem. Uma geração INCREMENTAL não as reemite, porque `migracoes/meta/0000_snapshot.json`
  // já registra os dois schemas como existentes.
  //
  // ---------------------------------------------------------------------------
  // Por que `plataforma` NÃO está nesta lista — e o que muda quando ele tiver tabela
  // ---------------------------------------------------------------------------
  //
  // O terceiro schema do produto (`plataforma`, criado pelo provisionamento e povoado pela
  // `0016_seguranca_bancaria.sql`) fica de fora **de propósito**, e não por esquecimento: hoje ele
  // guarda apenas a sequência do identificador perante o provedor e as duas funções que a cercam,
  // objetos que vivem só em migração autoral. **Nenhum objeto de `plataforma` é declarado no
  // Drizzle**, de modo que não há o que introspectar nem o que comparar — pôr o nome aqui não
  // acrescentaria nada e sugeriria, falsamente, que o gerador governa aquele schema.
  //
  // ⚠️ O que muda quando a PRIMEIRA tabela de `plataforma` for declarada no Drizzle (a notificação
  // crua do provedor, prevista para a fatia (iii)): como nenhum snapshot anterior registra o schema
  // — medido, `meta/0000_snapshot.json` e `meta/0015_snapshot.json` não contêm a cadeia
  // `plataforma` —, o gerador **proporá `CREATE SCHEMA "plataforma"`** já na primeira geração
  // incremental, e a supressão manual descrita acima volta a ser obrigatória naquele arquivo.
  //
  // ⚠️ E acrescentar `plataforma` a esta lista **não** evita isso: como a medição acima registra,
  // `schemaFilter` não suprime linha alguma da saída de `generate` — ele restringe a introspecção de
  // `pull`/`push`. A correção intuitiva é a errada; a correta continua sendo remover o
  // `CREATE SCHEMA` à mão, com `verificar-migracao.sh` (asserção `(e)`) reprovando se ele voltar.
  schemaFilter: ['identidade', 'negocio'],
  verbose: true,
  strict: true,
});
