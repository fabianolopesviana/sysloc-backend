/**
 * Schema `negocio` — toda tabela daqui nasce isolada, ou não nasce.
 *
 * ---------------------------------------------------------------------------
 * As quatro propriedades, e por que são quatro (ADR-0008 e ADR-0009)
 * ---------------------------------------------------------------------------
 *
 * Toda tabela deste arquivo declara, sem exceção:
 *
 *   1. **`empresa_id` não nulo** — é a coluna que a política compara;
 *   2. **`enableRLS()`** — sem isso a política existe e não é consultada;
 *   3. **restrição única `(id, empresa_id)`** — é o alvo que torna a chave estrangeira composta
 *      escrevível: o PostgreSQL exige unicidade no par referenciado;
 *   4. **chave estrangeira composta `(id_alheio, empresa_id)`** em toda referência a outra entidade
 *      tenantizada — é o que torna a referência cruzada entre empresas *estruturalmente impossível*,
 *      e não apenas verificada.
 *
 * Falta a quinta, que **não mora neste arquivo**: `FORCE ROW LEVEL SECURITY` e as políticas
 * `USING`/`WITH CHECK` vivem em migração de segurança escrita à mão. São **seis**, e quem
 * acrescentar tabela aqui precisa saber qual delas emendar — a resposta é sempre *nenhuma*, e a
 * lista existe para dizer onde cada tabela já protegida foi protegida:
 *
 *   * `migracoes/0001_seguranca.sql` — as duas tabelas herdadas da F1 (`acesso_usuario_app` e
 *     `acesso_usuario_permissao`);
 *   * `migracoes/0006_seguranca_dominio.sql` — as seis entidades do domínio de locação
 *     (`conjunto`, `imovel`, `comodo`, `locador`, `locatario`, `fiador`);
 *   * `migracoes/0008_seguranca_contrato.sql` — o contrato e o vínculo de fiador (`contrato` e
 *     `contrato_fiador`), mais o mecanismo de emissão da série declarada (ADR-0020);
 *   * `migracoes/0010_seguranca_cobranca.sql` — a cobrança e a configuração de mora (`cobranca` e
 *     `configuracao_de_mora`), mais a view `cobranca_derivada`, a data corrente da operação e a
 *     segunda série declarada do produto;
 *   * `migracoes/0012_seguranca_regua.sql` — a política de aviso e o registro de envios
 *     (`politica_de_aviso` e `envio_de_cobranca`), mais os três tipos enumerados da régua;
 *   * `migracoes/0014_seguranca_confirmacao.sql` — o portador da confirmação de endereço
 *     (`portador_de_confirmacao`), mais a função `SECURITY DEFINER` que o resolve **sem** contexto
 *     de empresa (ADR-0024);
 *   * `migracoes/0016_seguranca_bancaria.sql` — o certificado do provedor
 *     (`certificado_do_provedor`), mais os objetos do schema `plataforma`: a sequência do
 *     identificador perante o provedor e a função `SECURITY DEFINER` **sem parâmetro** que a avança
 *     (ADR-0031 e ADR-0033).
 *
 * São sete porque **gerado e autoral nunca convivem no mesmo arquivo** — uma regeração futura da
 * gerada sobrescreveria o trecho autoral em silêncio. O que **obriga** a parceira autoral não é a
 * predecessora ser gerada: é **nascer tabela em `negocio`**, porque o gerador não emite `FORCE` nem
 * política. Toda migração que criar tabela aqui leva junto uma parceira autoral própria — nunca um
 * acréscimo à `0001`, à `0006`, à `0008`, à `0010`, à `0012`, à `0014` ou à `0016`, que descrevem
 * schemas já aplicados e são, portanto, imutáveis. ⚠️ A `0010` tem, além disso, o
 * `DÉBITO COM GATILHO — D20` no ponto da emenda que ela já sofreu: **leia-o antes de qualquer
 * tentativa de tocá-la**.
 *
 * O diretório de migrações é a conferência da regra, e ele recusa a forma mais larga dela: a
 * `0002_campos_do_arcabouco.sql` e a `0003_autorizacao.sql` são **geradas e não têm parceira** —
 * nenhuma das duas cria tabela, elas só alteram o que já existia —, e a `0004_desfecho_de_recusa.sql`
 * é **autoral avulsa**, sem gerada a quem se parear. Só a `0000`, a `0005`, a `0007`, a `0009`, a
 * `0011`, a `0013` e a `0015` criam tabela em `negocio`, e são exatamente elas que têm parceira. Ler
 * o gatilho como "toda gerada ganha uma parceira" produziria uma migração de segurança vazia, sem
 * `FORCE` nem política a declarar.
 *
 * A `0013` é, além disso, a primeira **destrutiva** do produto: ela remove
 * `contrato.pdf_contrato_arquivo` (ADR-0030) e **não tem descida**. Reverter o esquema exige
 * restauração de backup, que é o item 1 da F7 e ainda não está entregue.
 *
 * O gerador de migração declara RLS e a política que se declare aqui, mas **não emite `FORCE`** — e
 * sem `FORCE` o dono das tabelas ignora a política, o que faria a suíte de isolamento ficar verde
 * sem provar nada (ADR-0009, seção Neutros). A autoridade sobre o estado real é a consulta ao
 * catálogo, não a declaração: é a guarda da T4 que reprova a tabela que nasça sem qualquer uma das
 * propriedades.
 *
 * ---------------------------------------------------------------------------
 * Acrescentar objeto aqui move QUATRO listas-espelho, e elas não têm ponto único
 * ---------------------------------------------------------------------------
 *
 * A rede de verificação afirma o conjunto EXATO de objetos de `negocio` — nunca "contém", porque
 * `toContain` deixaria passar a tabela que nascesse sem isolamento. O preço é que cada objeto novo
 * precisa entrar em quatro listas escritas por extenso, em quatro arquivos, e as três últimas fatias
 * descobriram isso por reprovação da suíte, uma de cada vez. Elas ficam nomeadas aqui porque este é
 * o arquivo que se abre para criar o objeto:
 *
 *   * `TABELAS_LEGITIMAS` — `test/catalogo.spec.ts` (o conjunto examinado pela guarda de cobertura);
 *   * `TABELAS_DE_NEGOCIO_ESPERADAS` — `test/papel-de-conexao.spec.ts` **e**, com o mesmo nome e
 *     conteúdo, `deploy/scripts/instalacao/verificar-migracao.sh` (as duas frentes de teste);
 *   * `SIMBOLOS_ESPERADOS` — `test/unidade-de-trabalho.spec.ts` (a superfície publicada do pacote).
 *
 * A lista acima envelhece; o comando que as encontra, não:
 *
 * ```bash
 * grep -rln --exclude-dir=dist "TABELAS_DE_NEGOCIO_ESPERADAS\|TABELAS_LEGITIMAS\|SIMBOLOS_ESPERADOS" packages deploy
 * ```
 *
 * É a mesma mecânica de comando-que-não-envelhece que o índice de débitos do `CLAUDE.md` usa. Este
 * parágrafo **não** é permissão para afrouxar qualquer uma das quatro: crescimento de lista esperada
 * é o caminho legítimo, troca de igualdade por presença é regressão de prova.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO existe aqui, de propósito
 * ---------------------------------------------------------------------------
 *
 * Nenhum filtro por empresa em consulta, em repositório ou em serviço. A ADR-0008 rejeitou
 * explicitamente a defesa em profundidade "RLS somada ao filtro da aplicação": dois caminhos para o
 * mesmo dado divergem com o tempo, e o filtro redundante ensina a confiar nele — quando ele deixar
 * de existir num ponto novo, nenhum teste acusa. Há um caminho só, e ele é o banco.
 */

import {
  CAMINHOS_DO_AVISO,
  CANAIS_DE_AVISO,
  DESFECHOS_DO_AVISO,
  ESTADOS_DA_COBRANCA,
  ESTADOS_DO_CONTRATO,
  NATUREZAS_DE_COBRANCA,
  SITUACOES_DE_LOCACAO,
  TIPOS_DE_IMOVEL,
  TIPOS_DE_PESSOA,
} from '@sysloc/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { empresa, usuario } from './identidade.js';

/**
 * O schema em si. Como o de identidade, ele NÃO é criado pela migração: vem do provisionamento,
 * com dono `sysloc_migracao` e uso concedido ao `sysloc_app` (§7.3 da tech spec).
 */
export const negocio = pgSchema('negocio');

/**
 * Natureza da permissão registrada. União fechada: área de tela ou ação sensível — as duas classes
 * que a matriz da fatia seguinte enumera. O enum vive no schema de negócio porque só é usado aqui.
 */
export const tipoPermissao = negocio.enum('tipo_permissao', ['TELA', 'ACAO']);

/**
 * O que a linha de permissão FAZ com a chave que ela nomeia — o que torna o ajuste **bidirecional**
 * representável: a mesma tabela concede e retira.
 *
 * União fechada de dois valores, e não uma coluna booleana: o vocabulário do banco é o mesmo que a
 * API publica, e um `boolean concedida` obrigaria a traduzir `false` para "negada" em toda leitura —
 * a tradução de vocabulário que o schema de identidade já recusa para `perfil_usuario`.
 *
 * A coluna é **não nula e sem padrão**: quem escreve um ajuste declara o efeito dele. Um padrão
 * escolheria por omissão entre conceder e negar, que é exatamente a decisão que não pode ser
 * implícita.
 */
export const efeitoPermissao = negocio.enum('efeito_permissao', ['CONCEDIDA', 'NEGADA']);

/**
 * Vínculo de acesso: a pessoa que alcança o sistema de uma empresa.
 *
 * A referência a `identidade.empresa` é simples porque a tabela apontada **não é tenantizada** —
 * ela não tem `empresa_id` a casar.
 *
 * A referência a `identidade.usuario`, essa, **é composta**, e a razão não é simetria com o schema
 * de negócio: é que o par `(usuario_id, empresa_id)` desta tabela afirma um fato — *"esta pessoa
 * pertence a esta empresa"* — que o banco tem como conferir, porque `identidade.usuario` carrega a
 * própria `empresa_id`. Sem a referência composta, a coerência entre as duas pontas dependia de
 * validação de aplicação, e a ADR-0008 tira exatamente essa decisão da aplicação. É a conciliação
 * estrutural do débito **D5** (decisão D6 do tech-alignment), provada pelo CT-207.
 *
 * A pessoa **sem empresa** (o Sysloc Master) continua existindo e simplesmente não é alvo de
 * vínculo: `MATCH SIMPLE`, que é o padrão, só aplica a referência quando **nenhuma** das colunas
 * referenciadoras é nula — e aqui as duas são não nulas, de modo que a referência vale sempre e
 * nunca encontra o par `(master, NULL)`.
 */
export const acessoUsuarioApp = negocio
  .table(
    'acesso_usuario_app',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      // A referência SIMPLES permanece, ao lado da composta abaixo. Ela é implicada pela composta e
      // não recusa nada que a composta já não recuse — mas retirá-la seria remover uma garantia que
      // esta task não introduziu, e o Protocolo Antirregressão (§4.3) proíbe isso. O custo é uma
      // verificação a mais por escrita numa tabela de baixíssimo volume.
      usuarioId: uuid('usuario_id')
        .notNull()
        .references(() => usuario.id),
      criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta da tabela-filha. Redundante com a chave primária no
      // que diz respeito à unicidade de `id` — e é justamente essa redundância que o PostgreSQL
      // exige para aceitar a referência ao par.
      unique('acesso_usuario_app_id_empresa_key').on(tabela.id, tabela.empresaId),
      // Uma pessoa tem no máximo um vínculo por empresa. O índice que a §12.2 pede para
      // `(empresa_id, usuario_id)` é o desta restrição.
      unique('acesso_usuario_app_empresa_usuario_key').on(tabela.empresaId, tabela.usuarioId),
      // A conciliação estrutural do D5 — ver o cabeçalho desta tabela. O alvo é
      // `usuario_id_empresa_key`, declarada em `identidade.ts`; ela **não** tenantiza aquela tabela,
      // é apenas o que o PostgreSQL exige para aceitar a referência ao par.
      foreignKey({
        name: 'acesso_usuario_app_usuario_empresa_fkey',
        columns: [tabela.usuarioId, tabela.empresaId],
        foreignColumns: [usuario.id, usuario.empresaId],
      }),
    ],
  )
  .enableRLS();

/**
 * Tabela-filha do vínculo de acesso: um **ajuste** por linha — a permissão que foi concedida a esta
 * pessoa além do padrão do perfil dela, ou retirada dele.
 *
 * Ela nasceu estrutural e vazia na fatia anterior, para tornar a chave estrangeira composta
 * verificável com dado real (CA-04). É esta task que a torna **escrevível com significado**: a
 * coluna `efeito` diz o que a linha faz, e a unicidade do trio impede que duas linhas digam coisas
 * opostas sobre a mesma chave.
 */
export const acessoUsuarioPermissao = negocio
  .table(
    'acesso_usuario_permissao',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      acessoId: uuid('acesso_id').notNull(),
      tipo: tipoPermissao('tipo').notNull(),
      chave: text('chave').notNull(),
      /** Conceder ou retirar. Sem padrão: ver o comentário de {@link efeitoPermissao}. */
      efeito: efeitoPermissao('efeito').notNull(),
    },
    (tabela) => [
      unique('acesso_usuario_permissao_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A unicidade que torna o CONFLITO IRREPRESENTÁVEL: um vínculo tem, no máximo, uma linha por
      // chave. Concessão e negação da mesma chave para a mesma pessoa não coexistem porque o banco
      // recusa a segunda, e não porque alguém se lembrou de conferir antes de gravar.
      //
      // A consequência é sobre a regra que lê, e não sobre esta tabela: a precedência da negação
      // **nunca precisa arbitrar dado inconsistente** — ela nunca encontra o par contraditório que
      // teria de desempatar. Regra que arbitra é regra que pode arbitrar errado; regra que nunca
      // encontra o caso não tem como. Provado pelo CT-206.
      //
      // `empresa_id` fica FORA do trio de propósito: ele é funcionalmente determinado por
      // `acesso_id`, que a chave estrangeira composta abaixo amarra a um único vínculo — e um
      // vínculo pertence a uma empresa só. Acrescentá-lo alargaria a chave sem recusar nada a mais.
      unique('acesso_usuario_permissao_acesso_tipo_chave_key').on(
        tabela.acessoId,
        tabela.tipo,
        tabela.chave,
      ),
      // ESTA é a chave estrangeira composta da ADR-0008. Ela recusa, no banco, apontar uma
      // permissão da empresa A para um vínculo da empresa B: o par `(acesso_id, empresa_id)` teria
      // de existir em `acesso_usuario_app (id, empresa_id)`, e não existe.
      //
      // Note que `empresa_id` NÃO ganha uma chave estrangeira própria para `identidade.empresa`:
      // ela seria implicada por esta, que só aceita pares já existentes no pai — e o pai já
      // referencia a empresa. Uma segunda restrição sobre a mesma coluna custaria uma verificação
      // a cada escrita sem recusar nada que esta já não recuse.
      foreignKey({
        name: 'acesso_usuario_permissao_acesso_empresa_fkey',
        columns: [tabela.acessoId, tabela.empresaId],
        foreignColumns: [acessoUsuarioApp.id, acessoUsuarioApp.empresaId],
      }),
      index('acesso_usuario_permissao_empresa_acesso_idx').on(tabela.empresaId, tabela.acessoId),
    ],
  )
  .enableRLS();

// ===========================================================================
// O domínio de locação — as seis entidades de cadastro da fatia
// ===========================================================================
//
// Os três enums abaixo derivam dos literais de `@sysloc/contracts`, e a direção da dependência é
// deliberada: o contrato é **folha** (ADR-0016), e é ele que o frontend importa no marco de entrega
// do backend. Declarados aqui e importados de lá, o contrato precisaria conhecer `@sysloc/db` — e o
// React arrastaria `drizzle-orm` e `postgres` para saber o tipo de um imóvel. Declarados lá e
// consumidos aqui, o custo é zero: o servidor já depende de tudo.
//
// Redigitar os literais seria a segunda fonte do mesmo fato, que é exatamente o que a ADR-0016
// fecha: o dia em que o contrato ganhar um tipo de imóvel, o banco o recusaria sem que nada
// acusasse antes da primeira gravação em operação.
//
// **Nenhuma das SEIS entidades de cadastro tem contador sequencial** (ADR-0015): nenhuma delas expõe
// código legível — a chave exposta é o UUID, e a ADR-0015 só se aplica a série declarada. O
// `identificador_municipal` do imóvel não é série do produto: é dado do cliente, informado por ele.
//
// **O contrato, esse, TEM** — ele é a primeira entidade do produto com série declarada, e a única
// até aqui. O `codigo` dele (`CTR-{ano}-{5 dígitos}`) é emitido pelas duas funções
// `SECURITY DEFINER` de `migracoes/0008_seguranca_contrato.sql`, com escopo `(empresa, ano)`, cujo
// avanço não participa do desfazimento (ADR-0020). Nada disso é declarável em Drizzle: o que mora
// aqui é a coluna `codigo` e a unicidade `(empresa_id, codigo)` que a torna estável.
//
// Os dois candidatos que NÃO são série ficam nomeados, porque o bloco acima sozinho não os alcança
// e é aqui que quem procurar vai olhar:
//
//   * **`imovel.identificador_municipal`** — parece código legível e não é série NOSSA. Quem o emite
//     é a prefeitura; o produto apenas o guarda e o torna único por empresa. Não há número a
//     reservar, e a ADR-0015 governa a emissão, não o armazenamento;
//   * **`comodo.posicao`** — é atribuída pelo servidor (`max(posicao) + 1`, §6.2 da tech spec), o
//     que é a única coisa que ela tem em comum com uma série. Ela **não** é série no sentido da
//     ADR-0015: aquela decisão ancora no *código legível citável fora do sistema* — o `CTR-2026-0001`
//     de um e-mail —, e a posição não identifica registro nenhum, apenas **ordena parte dentro do
//     agregado**. Daí decorrem as duas diferenças que o leitor apressado toma por violação: o escopo
//     é o **imóvel** e não a empresa, e remover o último cômodo **libera a posição** para o próximo.
//     O reuso é consistente justamente porque nada aponta para posição de cômodo — é o mesmo
//     discriminador da ADR-0014, que exclui o cômodo por não ser referenciável. Numa série da
//     ADR-0015 o reuso seria proibido porque o número foi citado fora do sistema; aqui, não há
//     citação possível a preservar.

/** Os três tipos de imóvel (RN-11). Ordem e valores vêm do contrato, nunca redigitados. */
export const tipoImovel = negocio.enum('tipo_imovel', TIPOS_DE_IMOVEL);

/**
 * As três situações de locação.
 *
 * O enum do banco tem os **três** valores, embora a entrada da API aceite só dois: `LOCADO` é
 * produzido pela ativação de contrato, que é fatia seguinte, e a coluna precisa poder guardá-lo. A
 * assimetria mora no contrato (`SITUACOES_INFORMAVEIS`), não aqui.
 */
export const statusLocacao = negocio.enum('status_locacao', SITUACOES_DE_LOCACAO);

/** Os dois tipos de pessoa (RN-11), comuns a locador, locatário e fiador. */
export const tipoPessoa = negocio.enum('tipo_pessoa', TIPOS_DE_PESSOA);

/**
 * Os sete campos de endereço, iguais para imóvel e para os três cadastros de pessoa.
 *
 * É uma **função** que devolve as colunas, e não uma constante compartilhada, porque cada tabela
 * precisa das **próprias** instâncias de construtor de coluna — uma instância partilhada seria
 * atribuída a duas tabelas e a segunda sobrescreveria a primeira. É a mesma forma, e pela mesma
 * razão de fonte única, que `camposDeEndereco()` de `@sysloc/contracts` adota do lado do contrato.
 *
 * `complemento` é o único anulável, exatamente como no contrato.
 */
function camposDeEndereco() {
  return {
    logradouro: text('logradouro').notNull(),
    numero: text('numero').notNull(),
    complemento: text('complemento'),
    bairro: text('bairro').notNull(),
    cidade: text('cidade').notNull(),
    estado: text('estado').notNull(),
    cep: text('cep').notNull(),
  };
}

/**
 * Agrupamento de imóveis — condomínio, edifício, loteamento.
 *
 * É a raiz do agregado de imóveis, e por isso a referência a `identidade.empresa` é **simples**: a
 * tabela apontada não é tenantizada, não tem `empresa_id` a casar. Mesmo caso de
 * `acesso_usuario_app`.
 *
 * `retirado_em` é a marca da exclusão lógica (ADR-0014): nulo enquanto o conjunto está em
 * circulação, o instante da retirada depois. Nada é apagado.
 */
export const conjunto = negocio
  .table(
    'conjunto',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      nome: text('nome').notNull(),
      retiradoEm: timestamp('retirado_em', { withTimezone: true }),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta de `imovel`. Redundante com a chave primária quanto à
      // unicidade de `id` — e é essa redundância que o PostgreSQL exige para aceitar a referência
      // ao par.
      unique('conjunto_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A listagem padrão esconde o que saiu de circulação (§12.2): o índice cobre o par que ela
      // filtra, e não `empresa_id` sozinho.
      index('conjunto_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
    ],
  )
  .enableRLS();

/**
 * O imóvel — a entidade central do cadastro.
 *
 * `empresa_id` **não** ganha chave estrangeira própria para `identidade.empresa`: ela seria
 * implicada pela composta abaixo, que só aceita pares já existentes em `conjunto`, e o conjunto já
 * referencia a empresa. Uma segunda restrição sobre a mesma coluna custaria uma verificação a cada
 * escrita sem recusar nada que esta já não recuse — o mesmo desenho de `acesso_usuario_permissao`.
 *
 * **A unicidade do identificador municipal é TOTAL, e não parcial** (decisão D4 da tech spec): ela
 * alcança também o imóvel retirado de circulação. Uma restrição parcial
 * (`WHERE retirado_em IS NULL`) pareceria mais permissiva e criaria um defeito na direção oposta —
 * dois imóveis passariam a poder ocupar o mesmo identificador, e a **recirculação** do retirado
 * colidiria com o que nasceu depois dele, num ponto em que o usuário não tem como desfazer nada. A
 * ADR-0014 registra a consequência entre os *Cons*: o registro retirado continua ocupando o valor.
 */
export const imovel = negocio
  .table(
    'imovel',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      conjuntoId: uuid('conjunto_id').notNull(),
      nomeImovel: text('nome_imovel').notNull(),
      identificadorMunicipal: text('identificador_municipal').notNull(),
      tipoImovel: tipoImovel('tipo_imovel').notNull(),
      ...camposDeEndereco(),
      /**
       * Sem padrão, de propósito: quem cria o imóvel declara a situação dele. Um padrão escolheria
       * por omissão entre disponível e indisponível, que é decisão do usuário, não do schema —
       * mesmo critério de `efeito` em {@link efeitoPermissao}.
       */
      statusLocacao: statusLocacao('status_locacao').notNull(),
      observacoes: text('observacoes'),
      retiradoEm: timestamp('retirado_em', { withTimezone: true }),
    },
    (tabela) => [
      unique('imovel_id_empresa_key').on(tabela.id, tabela.empresaId),
      unique('imovel_empresa_identificador_municipal_key').on(
        tabela.empresaId,
        tabela.identificadorMunicipal,
      ),
      // ESTA é a chave estrangeira composta da ADR-0008. Ela recusa, no banco, apontar um imóvel da
      // empresa A para um conjunto da empresa B: o par `(conjunto_id, empresa_id)` teria de existir
      // em `conjunto (id, empresa_id)`, e não existe. É recusa ESTRUTURAL — nenhuma validação de
      // aplicação é consultada no caminho.
      foreignKey({
        name: 'imovel_conjunto_empresa_fkey',
        columns: [tabela.conjuntoId, tabela.empresaId],
        foreignColumns: [conjunto.id, conjunto.empresaId],
      }),
      index('imovel_empresa_conjunto_idx').on(tabela.empresaId, tabela.conjuntoId),
      index('imovel_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
    ],
  )
  .enableRLS();

/**
 * Cômodo — **detalhe de composição do imóvel**, e não entidade de cadastro própria.
 *
 * ---------------------------------------------------------------------------
 * A coluna que NÃO existe aqui, e a ausência é a decisão
 * ---------------------------------------------------------------------------
 *
 * Não há `retirado_em`. A ADR-0014 exclui o cômodo **nominalmente** do alcance da exclusão lógica:
 * o discriminador dela é *ser referenciável*, e nada aponta para cômodo — corrigir a planta é
 * remover a parte, não retirar um cadastro de circulação. Não há leitura do passado a preservar.
 *
 * A **ausência** da coluna é o que torna a decisão verificável: o CT-317 consulta o catálogo e
 * afirma que ela não está lá. Acrescentá-la "por simetria" com as outras cinco desfaria a decisão
 * em silêncio, e a guarda de cobertura não acusaria — ela não cobra `retirado_em` de ninguém.
 *
 * `metragem` é `NOT NULL DEFAULT 0` porque a RN-02 diz que metragem ausente **vale zero**: o
 * contrato já aplica o padrão na entrada, e o `NOT NULL` é o que impede que um caminho futuro grave
 * a ausência como nulo — a soma que produz a metragem total do imóvel teria de decidir de novo o
 * que fazer com ela. O `check` repete no banco o piso que o contrato declara.
 */
export const comodo = negocio
  .table(
    'comodo',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      imovelId: uuid('imovel_id').notNull(),
      nomeComodo: text('nome_comodo').notNull(),
      metragem: numeric('metragem', { precision: 10, scale: 2 }).notNull().default('0'),
      /**
       * Ordem do cômodo dentro do imóvel. Atribuída pelo servidor, nunca informada pelo cliente —
       * aceitá-la daria a ele o poder de colidir com a `unique(imovel_id, posicao)` de outro cômodo.
       *
       * **Não é série no sentido da ADR-0015**, apesar de ser sequencial e atribuída pelo servidor:
       * ela ordena parte dentro do agregado, não identifica registro citável fora do sistema. Ver o
       * bloco da ADR-0015 no cabeçalho desta seção — é lá que a distinção está por extenso, com a
       * razão de o escopo ser o imóvel e de a última posição poder ser reusada.
       */
      posicao: integer('posicao').notNull(),
      observacoes: text('observacoes'),
    },
    (tabela) => [
      unique('comodo_id_empresa_key').on(tabela.id, tabela.empresaId),
      // Dois cômodos do mesmo imóvel não ocupam a mesma posição. `empresa_id` fica FORA do par de
      // propósito: ele é funcionalmente determinado por `imovel_id`, que a chave estrangeira
      // composta abaixo amarra a um único imóvel — e um imóvel pertence a uma empresa só.
      // Acrescentá-lo alargaria a chave sem recusar nada a mais. Mesmo desenho de
      // `acesso_usuario_permissao_acesso_tipo_chave_key`.
      unique('comodo_imovel_posicao_key').on(tabela.imovelId, tabela.posicao),
      foreignKey({
        name: 'comodo_imovel_empresa_fkey',
        columns: [tabela.imovelId, tabela.empresaId],
        foreignColumns: [imovel.id, imovel.empresaId],
      }),
      check('comodo_metragem_nao_negativa_chk', sql`${tabela.metragem} >= 0`),
      index('comodo_empresa_imovel_posicao_idx').on(
        tabela.empresaId,
        tabela.imovelId,
        tabela.posicao,
      ),
    ],
  )
  .enableRLS();

/**
 * As colunas de um cadastro de pessoa — locador, locatário e fiador.
 *
 * As três tabelas têm a **mesma forma**: o que as separa é a rota e o papel, não o corpo (a mesma
 * pessoa do mundo pode existir nos três papéis, e o documento é único **por papel** dentro da
 * empresa). Escrever quinze colunas três vezes criaria três fontes do mesmo fato, e a primeira
 * emenda a uma delas já as faria divergir — é a razão pela qual `@sysloc/contracts` tem **um**
 * `esquemaDePessoaNova` para os três.
 *
 * As restrições ficam de fora desta função, e não é descuido: cada tabela nomeia as suas com o
 * próprio nome, e é esse nome que a resposta de erro do PostgreSQL devolve — derivá-lo por
 * interpolação tornaria o nome ilegível no ponto em que ele importa (o `grep` que responde "quem
 * recusou esta escrita?").
 */
function camposDeCadastroDePessoa() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id),
    nome: text('nome').notNull(),
    tipoPessoa: tipoPessoa('tipo_pessoa').notNull(),
    /** Guardado em **dígitos**, sem máscara (§6.2) — é o contrato que a remove na entrada. */
    documentoPrincipal: text('documento_principal').notNull(),
    /** Anulável: pessoa jurídica não tem um. */
    rg: text('rg'),
    email: text('email').notNull(),
    telefone: text('telefone').notNull(),
    ...camposDeEndereco(),
    retiradoEm: timestamp('retirado_em', { withTimezone: true }),
  };
}

/**
 * Locador — quem cede o imóvel.
 *
 * A unicidade do documento é **total**, alcançando o retirado de circulação, pela mesma razão
 * escrita no cabeçalho de {@link imovel}: parcial, a recirculação colidiria.
 */
export const locador = negocio
  .table('locador', camposDeCadastroDePessoa(), (tabela) => [
    unique('locador_id_empresa_key').on(tabela.id, tabela.empresaId),
    unique('locador_empresa_documento_key').on(tabela.empresaId, tabela.documentoPrincipal),
    index('locador_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
  ])
  .enableRLS();

/**
 * Locatário — quem ocupa o imóvel. Mesma forma do locador, MAIS uma coluna; ver
 * {@link camposDeCadastroDePessoa}.
 *
 * ---------------------------------------------------------------------------
 * `email_confirmado_em` mora SÓ aqui, e é FATO — não estado (ADR-0022)
 * ---------------------------------------------------------------------------
 *
 * Ela é a primeira coluna que quebra a simetria das três tabelas de pessoa, e a assimetria é a
 * decisão: quem confirma endereço de correio é o **locatário**, porque é ele quem recebe cobrança e
 * é dele que a rota sem sessão trata (ADR-0027). Acrescentá-la a `camposDeCadastroDePessoa()` a
 * daria também ao locador e ao fiador, criando duas colunas que nenhum caminho de escrita preenche
 * — e uma coluna que ninguém move é convite para alguém inventar o que ela significa.
 *
 * O que se grava é o **instante da confirmação**, e não um `boolean confirmado`: o estado publicado
 * é derivado do fato (ADR-0022), de modo que não existe rotina que "vire a bandeira" e possa deixar
 * de rodar. Nulo significa *nunca confirmou*; preenchido, *confirmou naquele instante* — e a
 * reapresentação do mesmo portador **não o reescreve** (RN-10), que é o que torna o ato único.
 *
 * `timestamptz` porque é um ATO, e o relógio é o do banco (ADR-0026) — mesmo desenho de
 * `envio_de_cobranca.criado_em`. Sem `defaultNow()`: o padrão faria toda pessoa nascer confirmada.
 */
export const locatario = negocio
  .table(
    'locatario',
    {
      ...camposDeCadastroDePessoa(),
      emailConfirmadoEm: timestamp('email_confirmado_em', { withTimezone: true }),
    },
    (tabela) => [
      unique('locatario_id_empresa_key').on(tabela.id, tabela.empresaId),
      unique('locatario_empresa_documento_key').on(tabela.empresaId, tabela.documentoPrincipal),
      index('locatario_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
    ],
  )
  .enableRLS();

/** Fiador — quem garante o contrato. Mesma forma do locador; ver {@link camposDeCadastroDePessoa}. */
export const fiador = negocio
  .table('fiador', camposDeCadastroDePessoa(), (tabela) => [
    unique('fiador_id_empresa_key').on(tabela.id, tabela.empresaId),
    unique('fiador_empresa_documento_key').on(tabela.empresaId, tabela.documentoPrincipal),
    index('fiador_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
  ])
  .enableRLS();

// ===========================================================================
// O contrato de locação — a primeira entidade com série declarada e ciclo governado
// ===========================================================================

/**
 * Os quatro estados do contrato (RD-02). Ordem e valores vêm do contrato, **nunca redigitados**.
 *
 * A direção da dependência é a mesma dos três enums do cadastro, e pela mesma razão (ADR-0016):
 * redigitar os literais seria a segunda fonte do mesmo fato, e o dia em que o contrato ganhasse um
 * estado o banco o recusaria sem que nada acusasse antes da primeira gravação em operação.
 *
 * A ORDEM é conteúdo, e não estética: um enum do PostgreSQL guarda a ordem dos rótulos, e é ela que
 * governa comparação e ordenação do tipo. Reordenar aqui mudaria o significado de `ORDER BY status`
 * sem tocar em consulta nenhuma.
 */
export const statusContrato = negocio.enum('status_contrato', ESTADOS_DO_CONTRATO);

/**
 * O contrato de locação.
 *
 * `empresa_id` **não** ganha chave estrangeira própria para `identidade.empresa`: ela seria
 * implicada pelas três compostas abaixo, que só aceitam pares já existentes nos pais, e os pais já
 * referenciam a empresa. Uma segunda restrição sobre a mesma coluna custaria uma verificação a cada
 * escrita sem recusar nada que estas já não recusem — o mesmo desenho de {@link imovel}.
 *
 * `data_fim_locacao` e `valor_total_contrato` são **anuláveis** porque são derivados na ativação
 * (RD-10): o contrato nasce `RASCUNHO` com os dois nulos, e declará-los obrigatórios obrigaria a
 * criação a inventar valores que só a ativação decide.
 *
 * `gerar_cobrancas_automaticamente` é `NOT NULL DEFAULT true`, mesmo desenho de `comodo.metragem`: o
 * contrato já aplica o padrão na entrada, e o `NOT NULL` é o que impede um caminho futuro de gravar
 * a ausência como nulo — quem lesse a coluna teria de decidir de novo o que fazer com ela.
 *
 * **A unicidade do código é TOTAL, e não parcial**: ela alcança o contrato retirado de circulação,
 * pela mesma razão escrita no cabeçalho de {@link imovel} para o identificador municipal. Parcial, a
 * recirculação de um retirado colidiria com o que nasceu depois dele — e aqui o preço seria maior,
 * porque o código é a referência citada fora do sistema que a ADR-0015 existe para manter estável.
 */
export const contrato = negocio
  .table(
    'contrato',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      /**
       * A chave **exposta** (ADR-0017): o contrato tem série declarada, então o UUID não trafega.
       *
       * O valor é emitido pelas duas funções `SECURITY DEFINER` de
       * `migracoes/0008_seguranca_contrato.sql`, com escopo `(empresa, ano)` e avanço fora do
       * desfazimento (ADR-0020) — nada disso é declarável aqui. O que esta coluna traz é o lugar do
       * número e, com a restrição abaixo, a unicidade que o torna referência estável.
       */
      codigo: text('codigo').notNull(),
      imovelId: uuid('imovel_id').notNull(),
      locadorId: uuid('locador_id').notNull(),
      locatarioId: uuid('locatario_id').notNull(),
      /**
       * Sem padrão, de propósito: quem cria o contrato declara o estado dele — o serviço grava
       * `RASCUNHO`. Um padrão escolheria por omissão o ponto de partida do ciclo de vida, que é
       * decisão de domínio e não do schema. Mesmo critério de `status_locacao` em {@link imovel}.
       */
      status: statusContrato('status').notNull(),
      /**
       * Data de calendário, e não instante: o valor viaja como `YYYY-MM-DD` da consulta até o JSON,
       * sem passar por `Date` com fuso (§6.2). O `mode` padrão de `date()` é `'string'`, que é
       * exatamente isso — trocá-lo por `'date'` reintroduziria o fuso no caminho.
       */
      dataInicioLocacao: date('data_inicio_locacao').notNull(),
      prazoMeses: integer('prazo_meses').notNull(),
      /** Dinheiro em `numeric(15,2)`, nunca ponto flutuante — invariante 4 do projeto. */
      valorMensal: numeric('valor_mensal', { precision: 15, scale: 2 }).notNull(),
      diaVencimento: integer('dia_vencimento').notNull(),
      /** Anulável: derivado na ativação (RD-10). */
      dataFimLocacao: date('data_fim_locacao'),
      /** Anulável: derivado na ativação (RD-10). */
      valorTotalContrato: numeric('valor_total_contrato', { precision: 15, scale: 2 }),
      gerarCobrancasAutomaticamente: boolean('gerar_cobrancas_automaticamente')
        .notNull()
        .default(true),
      // ---------------------------------------------------------------------------
      // A coluna que SAIU daqui, e a ausência é a decisão (ADR-0030)
      // ---------------------------------------------------------------------------
      //
      // Havia `pdf_contrato_arquivo text`, herdada do legado, que guardava o CAMINHO do documento
      // composto e gravado. A migração `0013` a removeu, e nada a substitui: o documento do contrato
      // é **composto no instante do pedido** e nunca armazenado, de modo que não existe caminho de
      // escrita dele — a coerência entre artefato e cadastro vem da **ausência de cópia**, e não de
      // uma rotina de invalidação que precisaria alcançar todo caminho de escrita presente e futuro.
      //
      // A ausência não é economia de espaço: é o que torna irrepresentável a pré-condição
      // *"sem PDF, não cancela"* que o legado criou para proteger o carimbo que gravaria sobre o
      // arquivo (o débito **D36** da fatia `contratos-de-locacao`). Uma coluna de caminho
      // reintroduzida aqui "por conveniência de cache" reabre a decisão inteira — a ADR-0030 registra
      // que reaproveitamento por cache é compatível, mas cópia **durável** como fonte de verdade é a
      // reversão dela, e o caminho legítimo seria superseder a ADR.
      //
      // A ausência é medida por introspecção no `CT-712` (`packages/db/test/contrato.spec.ts`), que
      // consulta o catálogo do PostgreSQL — nunca o texto desta declaração.
      retiradoEm: timestamp('retirado_em', { withTimezone: true }),
    },
    (tabela) => [
      // O alvo das chaves estrangeiras compostas de `contrato_fiador`, e o que a guarda de cobertura
      // de `src/catalogo.ts` cobra de toda tabela deste schema.
      unique('contrato_id_empresa_key').on(tabela.id, tabela.empresaId),
      unique('contrato_empresa_codigo_key').on(tabela.empresaId, tabela.codigo),
      // As TRÊS chaves estrangeiras compostas da ADR-0008. Cada uma recusa, no banco, apontar um
      // contrato da empresa A para um imóvel, um locador ou um locatário da empresa B: o par
      // `(alheio_id, empresa_id)` teria de existir no pai, e não existe. É recusa ESTRUTURAL —
      // nenhuma validação de aplicação é consultada no caminho.
      foreignKey({
        name: 'contrato_imovel_empresa_fkey',
        columns: [tabela.imovelId, tabela.empresaId],
        foreignColumns: [imovel.id, imovel.empresaId],
      }),
      foreignKey({
        name: 'contrato_locador_empresa_fkey',
        columns: [tabela.locadorId, tabela.empresaId],
        foreignColumns: [locador.id, locador.empresaId],
      }),
      foreignKey({
        name: 'contrato_locatario_empresa_fkey',
        columns: [tabela.locatarioId, tabela.empresaId],
        foreignColumns: [locatario.id, locatario.empresaId],
      }),
      // Os três limites de RD-08 repetidos no banco. O contrato de entrada já os declara, e é ele
      // que produz a recusa com nome de campo; estes são o que impede um caminho de escrita futuro
      // — carga, correção manual, fatia nova — de gravar o que a regra não admite.
      check('contrato_dia_vencimento_chk', sql`${tabela.diaVencimento} BETWEEN 1 AND 28`),
      check('contrato_prazo_positivo_chk', sql`${tabela.prazoMeses} > 0`),
      check('contrato_valor_mensal_positivo_chk', sql`${tabela.valorMensal} > 0`),
      // ---------------------------------------------------------------------------
      // A vigência única por imóvel — ÍNDICE PARCIAL, e a forma NÃO é escolha de estilo
      // ---------------------------------------------------------------------------
      //
      // É `uniqueIndex(...).where(...)`, e não `unique(...)`, porque **o PostgreSQL não admite
      // restrição única parcial**: `ALTER TABLE … ADD CONSTRAINT … UNIQUE (…) WHERE …` não existe na
      // gramática. Só `CREATE UNIQUE INDEX … WHERE` alcança a condição.
      //
      // Quem "corrigir" isto para restrição, por consistência com as vizinhas, **remove a condição**
      // — e a tabela passa a impedir dois contratos em QUALQUER estado sobre o mesmo imóvel, o que
      // quebra montar contrato novo depois de cancelar o anterior, que é o fluxo normal do negócio.
      // A conversão é silenciosa: o schema fica "mais uniforme" e o defeito só aparece no primeiro
      // recontrato.
      //
      // Ele é o MECANISMO da RN-09, não uma otimização: é o que torna a dupla locação
      // irrepresentável, pela mesma escolha estrutural do isolamento entre empresas — recusa do
      // banco, não conferência da aplicação.
      //
      // `empresa_id` fica FORA do índice de propósito: ele é funcionalmente determinado por
      // `imovel_id`, que a chave estrangeira composta acima amarra a um único imóvel — e um imóvel
      // pertence a uma empresa só. Acrescentá-lo alargaria a chave sem recusar nada a mais. Mesmo
      // desenho de `comodo_imovel_posicao_key`.
      //
      // Ele **não** satisfaz a guarda de cobertura, e não precisa: ela cobra restrição NOMEADA sobre
      // `(id, empresa_id)`, que é `contrato_id_empresa_key`. As duas coexistem sem se substituir.
      //
      // DECISÃO FECHADA — T3 · 2026-08-09
      // O QUÊ: a vigência única por imóvel é ÍNDICE ÚNICO PARCIAL
      //        (`uniqueIndex(...).where(sql`status = 'ATIVO'`)`), e não `unique(...)`.
      // POR QUÊ: o PostgreSQL não admite restrição única parcial — não existe `ADD CONSTRAINT …
      //          UNIQUE (…) WHERE …`. Converter para restrição, "por consistência" com as seis
      //          vizinhas deste arquivo, **remove a condição junto**, e a tabela passa a impedir dois
      //          contratos em QUALQUER estado sobre o mesmo imóvel — o que quebra montar contrato
      //          novo depois de cancelar o anterior, que é o fluxo normal do negócio. A conversão é
      //          silenciosa: o schema fica mais uniforme e o defeito só aparece no primeiro
      //          recontrato, em operação.
      // REVERTER EXIGE: exibir uma forma de restrição do PostgreSQL que aceite predicado parcial —
      //                 ou provar que impedir dois contratos em qualquer estado sobre o mesmo imóvel
      //                 é a regra pretendida, o que contraria a RN-09 e o ciclo de vida da ADR-0019.
      uniqueIndex('contrato_imovel_vigente_uidx').on(tabela.imovelId).where(sql`status = 'ATIVO'`),
      // A listagem padrão esconde o que saiu de circulação (§12.2): o índice cobre o par que ela
      // filtra, e não `empresa_id` sozinho.
      index('contrato_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
      index('contrato_empresa_imovel_idx').on(tabela.empresaId, tabela.imovelId),
    ],
  )
  .enableRLS();

/**
 * Vínculo entre contrato e fiador — **vínculo puro**, e não entidade de cadastro.
 *
 * ---------------------------------------------------------------------------
 * A coluna que NÃO existe aqui, e a ausência é a decisão
 * ---------------------------------------------------------------------------
 *
 * Não há `retirado_em`. A ADR-0014 exclui do alcance da exclusão lógica *"vínculo ou concessão, cuja
 * linha representa estado de relacionamento"*, e o discriminador dela é **ser referenciável** —
 * nada aponta para uma linha de `contrato_fiador`. Substituir a lista de fiadores de um rascunho
 * **remove** e **insere** linhas, que é o mecanismo legítimo, o mesmo do ajuste bidirecional da
 * matriz de permissões (§7.5).
 *
 * A **ausência** da coluna é o que torna a decisão verificável: o CT-430 consulta o catálogo e
 * afirma que ela não está lá, com as seis entidades de cadastro como controle positivo.
 * Acrescentá-la "por simetria" com elas desfaria a decisão em silêncio, e a guarda de cobertura
 * **não acusaria** — ela não cobra `retirado_em` de ninguém. É o mesmo desenho, e a mesma razão, do
 * que {@link comodo} já registra.
 *
 * A tabela não tem coluna livre alguma além das quatro: medido no sistema antigo, a tabela-filha
 * `Fiadores` tem **um único campo**, `fiador` — nenhum percentual, nenhuma data, nenhuma ordem de
 * negócio. Inventar uma aqui seria inventar regra que ninguém declarou.
 */
export const contratoFiador = negocio
  .table(
    'contrato_fiador',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      contratoId: uuid('contrato_id').notNull(),
      fiadorId: uuid('fiador_id').notNull(),
    },
    (tabela) => [
      unique('contrato_fiador_id_empresa_key').on(tabela.id, tabela.empresaId),
      // O mesmo fiador não entra duas vezes no mesmo contrato. `empresa_id` fica FORA do par pela
      // mesma razão do índice de vigência: ele é funcionalmente determinado por `contrato_id`.
      unique('contrato_fiador_contrato_fiador_key').on(tabela.contratoId, tabela.fiadorId),
      // As duas chaves estrangeiras compostas da ADR-0008 — ver o comentário gêmeo em
      // {@link contrato}.
      foreignKey({
        name: 'contrato_fiador_contrato_empresa_fkey',
        columns: [tabela.contratoId, tabela.empresaId],
        foreignColumns: [contrato.id, contrato.empresaId],
      }),
      foreignKey({
        name: 'contrato_fiador_fiador_empresa_fkey',
        columns: [tabela.fiadorId, tabela.empresaId],
        foreignColumns: [fiador.id, fiador.empresaId],
      }),
      index('contrato_fiador_empresa_contrato_idx').on(tabela.empresaId, tabela.contratoId),
    ],
  )
  .enableRLS();

// ===========================================================================
// A cobrança — o fato financeiro, e a segunda entidade com série declarada
// ===========================================================================
//
// Os dois enums abaixo derivam dos literais de `@sysloc/contracts`, pela mesma razão e na mesma
// direção dos quatro anteriores (ADR-0016): o contrato é **folha**, e é ele que o frontend importa
// no marco de entrega. A ORDEM dos rótulos é conteúdo — um enum do PostgreSQL guarda a ordem, e é
// ela que governa comparação e ordenação do tipo.
//
// **O que NÃO é declarável aqui**, e por isso vive em `migracoes/0010_seguranca_cobranca.sql`: a
// view `negocio.cobranca_derivada` (ADR-0022 e ADR-0023 — o estado publicado e a mora são
// derivados, e a derivação que participa de seleção e compõe aritmética monetária vive no banco), a
// função `negocio.data_corrente_da_operacao()` e as duas funções `SECURITY DEFINER` da série
// `COB-{ano}-{7 dígitos}` (ADR-0015 e ADR-0020). O que mora aqui são as duas TABELAS, e só elas.

/** As cinco naturezas de cobrança (RD-03). Ordem e valores vêm do contrato, nunca redigitados. */
export const naturezaCobranca = negocio.enum('natureza_cobranca', NATUREZAS_DE_COBRANCA);

/**
 * Os quatro estados da cobrança (RD-04). Ordem e valores vêm do contrato, nunca redigitados.
 *
 * **Nenhuma coluna deste arquivo tem este tipo, e a ausência é a decisão.** O estado é DERIVADO dos
 * fatos gravados (ADR-0022) e avaliado num lugar só — a view `negocio.cobranca_derivada` —, que é o
 * que impede as três derivações divergentes do mesmo estado que o legado carrega. O tipo existe
 * porque é a coluna `status` da VIEW que o carrega: publicar o estado como texto solto abriria a
 * porta para valor fora da união, e a união é o que a ADR-0021 governa por rota própria.
 */
export const statusCobranca = negocio.enum('status_cobranca', ESTADOS_DA_COBRANCA);

/**
 * A cobrança — só **fatos** e **carimbos**.
 *
 * ---------------------------------------------------------------------------
 * As quatro colunas que NÃO existem aqui, e cada ausência é uma decisão
 * ---------------------------------------------------------------------------
 *
 *   * **`status`** — o estado é derivado (ADR-0022), e a coluna seria a segunda fonte do mesmo
 *     fato: bastaria uma escrita esquecida para uma cobrança vencida constar como `A_VENCER`. É
 *     exatamente o defeito do legado, que avalia o estado em três lugares e diverge nos três;
 *   * **coluna de mora em aberto** — `valor_multa`, `valor_juros`, `dias_atraso` e `valor_total`
 *     mudam sozinhos com a passagem do dia e com a política vigente. Gravá-los obrigaria a uma
 *     rotina que os movesse, e a ADR-0022 rejeita nominalmente o estado publicado movido por
 *     rotina. O que se grava é o CARIMBO, no ato que liquida — e ele é outra coisa: é o valor que
 *     foi efetivamente cobrado, com a configuração que valia naquele instante;
 *   * **`locatario_id`** — sai da junção com o contrato. A tabela-filha do legado guarda as duas
 *     pontas e admite que elas discordem; aqui a incoerência é **estruturalmente impossível**,
 *     porque não há segunda ponta a divergir;
 *   * **`retirado_em`** — a cobrança não circula, ela **transita de estado**. Nada é apagado
 *     (RD-12) e o cancelamento é `cancelado_em`, que é fato datado e não marca de retirada. A
 *     ADR-0014 alcança entidade de cadastro; esta não é uma.
 *
 * Os seis campos de conciliação bancária (`nosso_numero`, `linha_digitavel`, `codigo_barras`,
 * `data_credito`, `valor_creditado`, `boleto_arquivo`) nascem **nulos e sem produtor**: nenhuma
 * rota desta fatia os escreve, e nenhum esquema de `@sysloc/contracts` os publica. É a F4 que os
 * preenche, e tê-los aqui desde já é o que evita uma migração de coluna sobre tabela com dado.
 */
export const cobranca = negocio
  .table(
    'cobranca',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      /**
       * A chave **exposta** (ADR-0017): a cobrança tem série declarada, então o UUID não trafega.
       *
       * O valor é emitido pelas duas funções `SECURITY DEFINER` de
       * `migracoes/0010_seguranca_cobranca.sql`, com escopo `(empresa, ano)` e avanço fora do
       * desfazimento (ADR-0020) — nada disso é declarável aqui. O ano do escopo é o da **emissão**,
       * nunca o da competência: um contrato de treze meses atravessa a virada do ano.
       */
      codigo: text('codigo').notNull(),
      contratoId: uuid('contrato_id').notNull(),
      natureza: naturezaCobranca('natureza').notNull(),
      /**
       * Rótulo livre — o período que a parcela cobre, no formato do oráculo. É campo DISTINTO de
       * {@link naturezaCobranca} de propósito: fundi-los reproduziria o defeito do legado, em que
       * filtrar por tipo de título exigia casar texto.
       */
      referencia: text('referencia').notNull(),
      /**
       * Mês de competência, sempre no primeiro dia — a restrição abaixo o impõe.
       *
       * Data de calendário, e não instante: o `mode` padrão de `date()` é `'string'`, e o valor
       * viaja como `YYYY-MM-DD` da consulta até o JSON, sem passar por `Date` com fuso. Mesmo
       * desenho de `data_inicio_locacao` em {@link contrato}.
       */
      competencia: date('competencia').notNull(),
      dataVencimento: date('data_vencimento').notNull(),
      /** Dinheiro em `numeric(15,2)`, nunca ponto flutuante — invariante 4 do projeto. */
      valorOriginal: numeric('valor_original', { precision: 15, scale: 2 }).notNull(),
      /** Fato: nulo enquanto a cobrança não foi paga. */
      pagoEm: date('pago_em'),
      valorPago: numeric('valor_pago', { precision: 15, scale: 2 }),
      /** Fato: nulo enquanto a cobrança não foi cancelada. É `timestamptz` porque é um ATO. */
      canceladoEm: timestamp('cancelado_em', { withTimezone: true }),
      /** Carimbo (ADR-0022): a multa efetivamente cobrada no ato do pagamento. */
      multaAplicada: numeric('multa_aplicada', { precision: 15, scale: 2 }),
      /** Carimbo (ADR-0022): os juros efetivamente cobrados no ato do pagamento. */
      jurosAplicados: numeric('juros_aplicados', { precision: 15, scale: 2 }),
      /** Carimbo da configuração VIGENTE no pagamento — é o que faz RD-10 valer sem reescrita. */
      multaPercentualAplicado: numeric('multa_percentual_aplicado', { precision: 5, scale: 2 }),
      jurosPercentualAplicado: numeric('juros_percentual_aplicado', { precision: 5, scale: 2 }),
      /** Conciliação bancária — nasce nula, sem produtor nesta fatia. Ver o cabeçalho. */
      nossoNumero: text('nosso_numero'),
      linhaDigitavel: text('linha_digitavel'),
      codigoBarras: text('codigo_barras'),
      dataCredito: date('data_credito'),
      valorCreditado: numeric('valor_creditado', { precision: 15, scale: 2 }),
      /**
       * Guarda **caminho**, nunca bytes.
       *
       * ⚠️ O desenho gêmeo que este comentário citava — `contrato.pdf_contrato_arquivo` — **deixou
       * de existir** (migração `0013`, ADR-0030), e a coluna daqui **não** o segue: o boleto é
       * **fato recebido de terceiro**, e a `Decision` da ADR-0030 o exclui por escrito do alcance
       * dela (*"boleto emitido pelo provedor … não é artefato derivado"*). Ninguém o recompõe, e
       * guardá-lo é o único caminho. Não confundir os dois na F4: o carnê é derivado e se compõe sob
       * demanda; o boleto é fato e se guarda.
       */
      boletoArquivo: text('boleto_arquivo'),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta de quem vier a apontar para a cobrança, e o que a
      // guarda de cobertura de `src/catalogo.ts` cobra de toda tabela deste schema.
      unique('cobranca_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A unicidade do código é **TOTAL**, e não parcial: ela é o que torna o número emitido uma
      // referência estável (ADR-0015). Aqui não há sequer o que tornar parcial — não existe
      // `retirado_em` —, e é por isso que a decisão precisa estar escrita: quem trouxer exclusão
      // lógica para esta tabela no futuro não pode acompanhá-la de um `WHERE retirado_em IS NULL`.
      unique('cobranca_empresa_codigo_key').on(tabela.empresaId, tabela.codigo),
      // A chave estrangeira composta da ADR-0008 — a ÚNICA da tabela, porque o locatário sai da
      // junção com o contrato. Ela recusa, no banco, apontar uma cobrança da empresa A para um
      // contrato da empresa B: o par `(contrato_id, empresa_id)` teria de existir no pai, e não
      // existe. É recusa ESTRUTURAL — nenhuma validação de aplicação é consultada no caminho.
      //
      // `empresa_id` não ganha chave estrangeira própria para `identidade.empresa`: ela seria
      // implicada por esta, e o contrato já referencia a empresa por três caminhos. Mesmo desenho
      // de {@link imovel} e de {@link contrato}.
      foreignKey({
        name: 'cobranca_contrato_empresa_fkey',
        columns: [tabela.contratoId, tabela.empresaId],
        foreignColumns: [contrato.id, contrato.empresaId],
      }),
      check('cobranca_valor_positivo_chk', sql`${tabela.valorOriginal} > 0`),
      // A competência é o MÊS, e o primeiro dia é a forma canônica dele. Sem esta restrição, duas
      // parcelas do mesmo mês poderiam gravar dias diferentes e nenhuma comparação por competência
      // as juntaria.
      check(
        'cobranca_competencia_no_primeiro_dia_chk',
        sql`extract(day from ${tabela.competencia}) = 1`,
      ),
      // Paga E cancelada é IRREPRESENTÁVEL — não conferido pela aplicação, recusado pelo banco. O
      // estado publicado é derivado dos dois carimbos com `CANCELADA` na frente (RD-04), e sem esta
      // restrição a precedência estaria escondendo uma linha incoerente em vez de descrever uma
      // coerente.
      check(
        'cobranca_desfecho_unico_chk',
        sql`${tabela.pagoEm} IS NULL OR ${tabela.canceladoEm} IS NULL`,
      ),
      // ---------------------------------------------------------------------------
      // O carimbo é EQUIVALENTE ao pagamento, e não apenas implicado por ele
      // ---------------------------------------------------------------------------
      //
      // A forma é `(pago_em IS NULL) = (<carimbo> IS NULL)` para os quatro carimbos **e** para
      // `valor_pago`, e a igualdade cobra as duas direções de uma vez:
      //
      //   * carimbo sem pagamento seria valor cobrado de uma cobrança que ninguém pagou;
      //   * pagamento sem carimbo seria um pagamento cujo valor efetivo se perdeu — e ele NÃO é
      //     recuperável depois, porque a configuração de mora pode ter mudado (RD-10). É a metade
      //     que uma implicação simples (`carimbo ⇒ pagamento`) deixaria aberta, e é a que dói.
      //
      // `valor_pago` entra na mesma restrição, e não numa segunda: ele é carimbo do mesmo ato, e
      // separá-lo admitiria a linha meio carimbada que esta restrição existe para recusar.
      check(
        'cobranca_carimbo_coerente_chk',
        sql`(${tabela.pagoEm} IS NULL) = (${tabela.multaAplicada} IS NULL)
        AND (${tabela.pagoEm} IS NULL) = (${tabela.jurosAplicados} IS NULL)
        AND (${tabela.pagoEm} IS NULL) = (${tabela.multaPercentualAplicado} IS NULL)
        AND (${tabela.pagoEm} IS NULL) = (${tabela.jurosPercentualAplicado} IS NULL)
        AND (${tabela.pagoEm} IS NULL) = (${tabela.valorPago} IS NULL)`,
      ),
      // A ordenação padrão da carteira (§12.2): o índice cobre o par que ela percorre, e não
      // `empresa_id` sozinho.
      index('cobranca_empresa_vencimento_idx').on(tabela.empresaId, tabela.dataVencimento),
      // O filtro por contrato e a cascata do cancelamento (RD-13).
      index('cobranca_empresa_contrato_idx').on(tabela.empresaId, tabela.contratoId),
      // A carteira em ABERTO — a leitura mais frequente do produto. É índice PARCIAL, e a condição
      // é o que o torna pequeno; convertê-lo em índice total o faria crescer com todo o histórico
      // pago, que é justamente o que ele não precisa varrer.
      //
      // **Ele não é alcançável pelo predicado `status` da visão `cobranca_derivada`**: `status` é
      // uma expressão `CASE`, e o provador de implicação de predicado do PostgreSQL não a decompõe,
      // de modo que ele não consegue provar que `status = 'VENCIDA'` implica os dois `IS NULL`
      // daqui. Quem consulta a visão acompanha o filtro por `status` dos fatos que este índice
      // cobre (`AND pago_em IS NULL AND cancelado_em IS NULL`) — redundante para a semântica,
      // decisivo para o planejador. A medição com `EXPLAIN (ANALYZE, BUFFERS)` que fixa isto está
      // por extenso no comentário homônimo de `migracoes/0009_dominio_cobranca.sql`, e não é
      // recopiada aqui: cópia de justificativa apodrece quando o original é corrigido.
      index('cobranca_aberta_idx')
        .on(tabela.empresaId, tabela.dataVencimento)
        .where(sql`pago_em IS NULL AND cancelado_em IS NULL`),
    ],
  )
  .enableRLS();

/**
 * A política de mora da empresa — **uma linha por empresa**, e a unicidade é o mecanismo.
 *
 * `configuracao_de_mora_empresa_key` não é conveniência de leitura: é o alvo do `ON CONFLICT` que
 * torna a escrita da política um `upsert` de um comando só. Sem ela, a escrita teria de ler antes
 * de gravar — e leitura-antes-de-gravar é corrida disfarçada: entre o `SELECT` que não achou e o
 * `INSERT`, outra transação grava, e a empresa passaria a ter duas políticas com nada que decida
 * qual vale.
 *
 * `empresa_id` ganha chave estrangeira **simples** para `identidade.empresa` porque esta tabela não
 * tem pai tenantizado a quem se referir pelo par — mesmo caso de {@link conjunto} e dos três
 * cadastros de pessoa.
 *
 * Os dois percentuais são `NOT NULL DEFAULT 0`, mesmo desenho de `comodo.metragem`: **a ausência de
 * política e a política zerada são a mesma coisa** (RD-21), e o nulo obrigaria todo leitor a decidir
 * de novo o que fazer com ele. A apuração da view fecha o outro lado da mesma decisão pelo
 * `COALESCE` do `LEFT JOIN` — empresa sem linha alguma apura zero, e a cobrança **continua
 * constando** na carteira.
 */
export const configuracaoDeMora = negocio
  .table(
    'configuracao_de_mora',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      /** Percentual da multa, aplicado UMA vez sobre o valor original (RD-07). */
      multaPercentual: numeric('multa_percentual', { precision: 5, scale: 2 })
        .notNull()
        .default('0'),
      /** Percentual de juros **ao mês**, simples, base de mês comercial de 30 dias (RD-07). */
      jurosPercentual: numeric('juros_percentual', { precision: 5, scale: 2 })
        .notNull()
        .default('0'),
    },
    (tabela) => [
      unique('configuracao_de_mora_id_empresa_key').on(tabela.id, tabela.empresaId),
      // Uma linha por empresa — ver o cabeçalho: é o alvo do `ON CONFLICT`, e não um índice de
      // leitura.
      unique('configuracao_de_mora_empresa_key').on(tabela.empresaId),
      // O piso e o teto no BANCO, além do contrato de entrada. O contrato é quem produz a recusa
      // com nome de campo; esta restrição é o que impede um caminho de escrita futuro — carga,
      // correção manual, fatia nova — de gravar percentual que a regra não admite. Mesmo desenho
      // dos três limites de {@link contrato}.
      check(
        'configuracao_de_mora_faixa_chk',
        sql`${tabela.multaPercentual} BETWEEN 0 AND 100 AND ${tabela.jurosPercentual} BETWEEN 0 AND 100`,
      ),
    ],
  )
  .enableRLS();

// ===========================================================================
// A régua de cobrança — a política que ela obedece, e o registro de toda tentativa
// ===========================================================================
//
// Os três enums abaixo derivam dos literais de `@sysloc/contracts`, pela mesma razão e na mesma
// direção dos seis anteriores (ADR-0016): o contrato é **folha**, e é ele que o frontend importa no
// marco de entrega. Declará-los aqui obrigaria o contrato a importar `@sysloc/db` para falar de
// canal, de caminho e de desfecho. A ORDEM dos rótulos é conteúdo — um enum do PostgreSQL guarda a
// ordem, e é ela que governa comparação e ordenação do tipo.
//
// **O que NÃO é declarável aqui**, e por isso vive em `migracoes/0012_seguranca_regua.sql`: o
// `FORCE ROW LEVEL SECURITY`, as duas políticas `FOR ALL` e os três `GRANT USAGE ON TYPE`. O que
// mora aqui são as duas TABELAS e os três tipos, e só eles.

/** O único canal de aviso implementado (RN-13). Ordem e valores vêm do contrato, nunca redigitados. */
export const canalDeAviso = negocio.enum('canal_de_aviso', CANAIS_DE_AVISO);

/** Como a tentativa nasceu — a passagem da régua ou o disparo manual. Valores vindos do contrato. */
export const caminhoDoAviso = negocio.enum('caminho_do_aviso', CAMINHOS_DO_AVISO);

/** As três naturezas de desfecho de uma tentativa (RD-08). Valores vindos do contrato. */
export const desfechoDoAviso = negocio.enum('desfecho_do_aviso', DESFECHOS_DO_AVISO);

/**
 * A política de aviso da empresa — **uma linha por empresa**, e a régua nasce DESLIGADA.
 *
 * ---------------------------------------------------------------------------
 * `ativo` nasce `false`, e o padrão é a decisão
 * ---------------------------------------------------------------------------
 *
 * Toda empresa do produto — inclusive as que já existem quando a migração roda — passa a ter uma
 * régua possível. Um padrão `true` faria a fatia entrar em produção enviando mensagem para a caixa
 * de locatário de toda empresa que nunca pediu isso, e o dano de um aviso indevido não se desfaz.
 * A ausência de linha e a régua explicitamente desligada são a **mesma coisa publicada** (RD-03), de
 * modo que o padrão desligado é também o que faz a leitura concordar com o que a passagem da régua
 * faz numa empresa sem política: nada.
 *
 * ---------------------------------------------------------------------------
 * `politica_de_aviso_empresa_key` é o alvo do `ON CONFLICT`, não índice de leitura
 * ---------------------------------------------------------------------------
 *
 * Mesma razão registrada em {@link configuracaoDeMora}, e ela não envelheceu: sem a unicidade, a
 * escrita teria de ler antes de gravar — e leitura-antes-de-gravar é corrida disfarçada. Entre o
 * `SELECT` que não achou e o `INSERT`, outra transação grava, e a empresa passaria a ter duas
 * políticas com nada que decida qual vale.
 *
 * `politica_de_aviso_id_empresa_key` existe pela ADR-0008 ainda que **nada a referencie hoje**: a
 * forma de referência entre entidades tenantizadas é a chave estrangeira composta, e ela precisa de
 * destino. A guarda de cobertura de `src/catalogo.ts` a cobra de toda tabela deste schema.
 *
 * `empresa_id` ganha chave estrangeira **simples** para `identidade.empresa` porque esta tabela não
 * tem pai tenantizado a quem se referir pelo par — mesmo caso de {@link configuracaoDeMora} e de
 * {@link conjunto}.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS HORÁRIOS SÃO `time`, E A PROJEÇÃO DELES É `to_char(coluna, 'HH24:MI')`
 * ---------------------------------------------------------------------------
 *
 * **Quem for escrever a porta de leitura desta tabela precisa ler este parágrafo antes.** O contrato
 * publica `janelaInicio` e `janelaFim` no molde `HH:MM` **ancorado nas duas pontas**
 * (`esquemaDaPoliticaDeAviso`, em `packages/contracts/src/automacao-de-cobranca.ts`), e o driver
 * devolve uma coluna `time` como `'08:00:00'`. A âncora recusa essa forma — e a recusa de um esquema
 * de SAÍDA **não produz `422`**: ela levanta na serialização e **derruba a rota de leitura**.
 *
 * A projeção correta é, portanto, parte da declaração desta coluna, e não detalhe de quem consulta:
 *
 * ```sql
 * SELECT to_char(janela_inicio, 'HH24:MI') AS "janelaInicio",
 *        to_char(janela_fim,    'HH24:MI') AS "janelaFim"
 * ```
 *
 * A alternativa — guardar os horários como `text` — foi descartada: a coluna `time` é o que dá ao
 * `politica_de_aviso_janela_chk` uma comparação de **ordem temporal** em vez de comparação
 * lexicográfica sobre texto livre, e é ela que recusa `'24:00'` e `'8:0'` no próprio tipo.
 *
 * A obrigação tem prova executável no **CT-608** (`test/coerencia-de-migracoes.spec.ts`): o caso lê
 * a mesma linha pelas duas projeções e afirma que a crua **reprova** `esquemaDaPoliticaDeAviso` e a
 * `to_char` **passa**. Não é comentário pedindo boa-fé — é asserção que fica vermelha se a projeção
 * se perder.
 *
 * ---------------------------------------------------------------------------
 * Os dois `CHECK` são a REDE, nunca a primeira linha de defesa
 * ---------------------------------------------------------------------------
 *
 * As faixas e a ordem da janela também são conferidas pelo Zod, na borda, e a ordem importa: quem
 * recusa primeiro é o esquema de entrada, com `422` nomeando o campo. Estas restrições existem para
 * impedir que um caminho de escrita futuro — carga, correção manual, fatia nova — grave o que a
 * regra não admite. Mesmo desenho dos três limites de {@link contrato} e do de
 * {@link configuracaoDeMora}.
 *
 * O piso de `intervalo_minimo_dias` é **1**, e não 0: zero desligaria a trava que protege a caixa do
 * locatário, e desligar a régua se faz por `ativo`, nunca por valor de borda de um campo que
 * significa outra coisa. O piso de `dias_antes_do_vencimento` é **0**, e ali o zero tem significado
 * legítimo — avisar no próprio dia do vencimento.
 */
export const politicaDeAviso = negocio
  .table(
    'politica_de_aviso',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      /** A régua nasce desligada em toda empresa — ver o cabeçalho. */
      ativo: boolean('ativo').notNull().default(false),
      /** Quantos dias antes do vencimento a cobrança `A_VENCER` passa a ser elegível (RD-04). */
      diasAntesDoVencimento: integer('dias_antes_do_vencimento').notNull().default(0),
      /** O intervalo mínimo entre dois avisos da MESMA cobrança — a trava da RD-05. */
      intervaloMinimoDias: integer('intervalo_minimo_dias').notNull().default(1),
      /** Início da janela de horário. Projetada por `to_char(…, 'HH24:MI')` — ver o cabeçalho. */
      janelaInicio: time('janela_inicio').notNull().default('00:00'),
      /**
       * Fim da janela. O par padrão é `00:00`–`23:59`, e não `00:00`–`00:00`: a janela que nunca
       * fecha é a das duas bordas, porque `00:00`–`00:00` fecharia tudo menos um minuto.
       */
      janelaFim: time('janela_fim').notNull().default('23:59'),
      /** Enum de UM valor: o canal que o produto não implementa é irrepresentável (RN-13). */
      canal: canalDeAviso('canal').notNull().default('EMAIL'),
    },
    (tabela) => [
      unique('politica_de_aviso_id_empresa_key').on(tabela.id, tabela.empresaId),
      // Uma linha por empresa — ver o cabeçalho: é o alvo do `ON CONFLICT`, e não índice de leitura.
      unique('politica_de_aviso_empresa_key').on(tabela.empresaId),
      check(
        'politica_de_aviso_faixa_chk',
        sql`${tabela.diasAntesDoVencimento} BETWEEN 0 AND 90 AND ${tabela.intervaloMinimoDias} BETWEEN 1 AND 90`,
      ),
      // Janela invertida é RECUSADA, e não reinterpretada: `18:00`–`09:00` poderia ser lido como "a
      // noite inteira", e adivinhar seria pior do que recusar — o cliente que trocou os dois campos
      // de lugar receberia uma régua enviando de madrugada, sem nada que acusasse o engano.
      //
      // A comparação é `>=`, e não `>`: a janela de um minuto (`09:00`–`09:00`) é legítima.
      check('politica_de_aviso_janela_chk', sql`${tabela.janelaFim} >= ${tabela.janelaInicio}`),
    ],
  )
  .enableRLS();

/**
 * O registro de **toda** tentativa de envio — o que sustenta a trava, o histórico e a auditoria.
 *
 * ---------------------------------------------------------------------------
 * A linha nunca é apagada nem alterada, e a ausência de `retirado_em` é decisão
 * ---------------------------------------------------------------------------
 *
 * Não há `UPDATE` nem `DELETE` sobre esta tabela em lugar nenhum do produto: ela é registro de
 * **fato**. A ADR-0014 não a alcança, e não por exceção — o discriminador dela é *"ser
 * referenciável"*, e o registro não é. Retenção e expurgo vão para a **F7**, junto de
 * `identidade.tentativa_login`, que tem exatamente a mesma natureza.
 *
 * ---------------------------------------------------------------------------
 * `destinatario` é NOT NULL e aceita cadeia vazia — é o caso `SEM_DESTINATARIO`
 * ---------------------------------------------------------------------------
 *
 * O locatário sem endereço produz uma tentativa que **não travou o laço** e **foi registrada assim
 * mesmo** (RD-11). Um `NULL` obrigaria todo leitor a decidir de novo o que fazer com ele, e uma
 * restrição de endereço bem formado tornaria impublicável justamente a linha que a tabela existe
 * para registrar.
 *
 * ---------------------------------------------------------------------------
 * `envio_de_cobranca_causa_chk` é BICONDICIONAL — as duas incoerências, não uma
 * ---------------------------------------------------------------------------
 *
 * `(desfecho = 'ENVIADA') = (causa IS NULL)` recusa **as duas** direções de uma vez:
 *
 *   * **sucesso com causa** seria um envio que deu certo carregando o diagnóstico de uma falha, e o
 *     histórico passaria a exibir motivo de erro em linha entregue;
 *   * **falha sem causa** é a metade que dói, e é a que uma implicação simples deixaria aberta: a
 *     tentativa que não saiu sem dizer por quê é exatamente a linha que a RD-10 existe para
 *     produzir, e ela não é recuperável depois — o transporte já respondeu e ninguém guardou.
 *
 * Mesma forma, e mesma razão, de `cobranca_carimbo_coerente_chk` em {@link cobranca}.
 *
 * ---------------------------------------------------------------------------
 * Os DOIS índices, e por que o da trava é PARCIAL
 * ---------------------------------------------------------------------------
 *
 * `envio_de_cobranca_trava_idx` cobre `(empresa_id, cobranca_id, criado_em DESC)` **apenas onde
 * `desfecho = 'ENVIADA'`**, porque é exatamente o conjunto que a trava consulta (RD-05): ela conta
 * só a tentativa entregue, e um índice que carregasse as falhas seria maior sem servir ao predicado.
 * `envio_de_cobranca_historico_idx` cobre as mesmas colunas **sem** a condição, porque o histórico lê
 * **todas** — e por isso os dois não são redundantes: um índice parcial é inalcançável pela consulta
 * que não repete a condição dele, como a medição registrada em `migracoes/0009_dominio_cobranca.sql`
 * já mostrou para `cobranca_aberta_idx`.
 *
 * A ordem `criado_em DESC` é conteúdo nos dois: as duas leituras querem a tentativa **mais recente**
 * primeiro — a trava para comparar com o intervalo mínimo, o histórico para exibir.
 */
export const envioDeCobranca = negocio
  .table(
    'envio_de_cobranca',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      cobrancaId: uuid('cobranca_id').notNull(),
      /**
       * O instante da tentativa, pelo relógio do BANCO (ADR-0026) — nunca pelo do processo.
       *
       * É por ele que o histórico ordena e a trava conta o intervalo, e é `timestamptz` porque é um
       * ATO. Mesmo desenho de `cobranca.cancelado_em`.
       */
      criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
      caminho: caminhoDoAviso('caminho').notNull(),
      desfecho: desfechoDoAviso('desfecho').notNull(),
      /** Cadeia **vazia** quando não havia endereço — ver o cabeçalho. */
      destinatario: text('destinatario').notNull(),
      /** Nula quando a mensagem saiu, preenchida quando não saiu — a bicondicional abaixo é a rede. */
      causa: text('causa'),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta de quem vier a apontar para o registro, e o que a
      // guarda de cobertura de `src/catalogo.ts` cobra de toda tabela deste schema.
      unique('envio_de_cobranca_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A chave estrangeira COMPOSTA da ADR-0008 — a única da tabela. Ela recusa, no banco, um
      // registro da empresa A apontando para cobrança da empresa B: o par `(cobranca_id, empresa_id)`
      // teria de existir no pai, e não existe. É recusa ESTRUTURAL — nenhuma validação de aplicação
      // é consultada no caminho, e é por isso que a forma simples (`REFERENCES cobranca(id)`) não
      // serve nem "por enquanto": ela aceitaria o apontamento cruzado em silêncio.
      foreignKey({
        name: 'envio_de_cobranca_cobranca_empresa_fkey',
        columns: [tabela.cobrancaId, tabela.empresaId],
        foreignColumns: [cobranca.id, cobranca.empresaId],
      }),
      check(
        'envio_de_cobranca_causa_chk',
        sql`(${tabela.desfecho} = 'ENVIADA') = (${tabela.causa} IS NULL)`,
      ),
      // A trava da RD-05 — índice PARCIAL, ver o cabeçalho. Convertê-lo em índice total o faria
      // crescer com todo o histórico de falhas, que é justamente o que ele não precisa varrer.
      index('envio_de_cobranca_trava_idx')
        .on(tabela.empresaId, tabela.cobrancaId, tabela.criadoEm.desc())
        .where(sql`desfecho = 'ENVIADA'`),
      // O histórico da cobrança (§4.1), que lê TODAS as tentativas.
      index('envio_de_cobranca_historico_idx').on(
        tabela.empresaId,
        tabela.cobrancaId,
        tabela.criadoEm.desc(),
      ),
    ],
  )
  .enableRLS();

// ===========================================================================
// O portador da confirmação de endereço — o que resolve um ato SEM sessão
// ===========================================================================

/**
 * O portador que autoriza a confirmação de endereço de correio do locatário (ADR-0027).
 *
 * ---------------------------------------------------------------------------
 * Não há coluna do segredo em claro, e a AUSÊNCIA é a decisão
 * ---------------------------------------------------------------------------
 *
 * O que chega ao locatário é um segredo aleatório que só o correio dele conhece; o que esta tabela
 * guarda é o **derivado** dele. Quem lê o banco inteiro — dump, réplica, backup, operador de
 * suporte — não consegue montar um pedido que confirme endereço nenhum, porque não existe coluna de
 * onde extrair o segredo. Acrescentá-la "para depurar" desfaz a propriedade inteira em uma linha, e
 * nenhuma outra guarda a substitui.
 *
 * ---------------------------------------------------------------------------
 * `derivado` é UNIQUE GLOBAL, e não por empresa — deliberado (ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * A resolução acontece **antes** de existir contexto de tenant: é ela que descobre a empresa, e não
 * o contrário. Uma unicidade por empresa (`unique(empresa_id, derivado)`) admitiria duas linhas com
 * o mesmo derivado em empresas diferentes, e a função `SECURITY DEFINER` que as resolve teria de
 * desempatar — desempate que só poderia vir do pedido, que é exatamente a segunda origem de contexto
 * que a ADR-0024 fecha. Com a unicidade global a colisão é **impossível de passar em silêncio**, e o
 * empate deixa de existir em vez de ser resolvido.
 *
 * Repare que não há restrição `unique(empresa_id, …)` nenhuma aqui, e nem por isso o isolamento
 * afrouxa: ele vem da política de `0014_seguranca_confirmacao.sql` e da chave estrangeira composta
 * abaixo, como em toda tabela deste arquivo.
 *
 * ---------------------------------------------------------------------------
 * Os TRÊS instantes, e por que nenhum deles é `boolean`
 * ---------------------------------------------------------------------------
 *
 *   * `expira_em` — **não nulo**. O prazo é do banco, e a comparação vive no `WHERE` da função
 *     `SECURITY DEFINER` (ADR-0026): portador vencido produz zero linhas, indistinguível de
 *     inexistente, de modo que a recusa é propriedade do banco e não um `if` na borda que alguém
 *     pode reordenar;
 *   * `consumido_em` — anulável, e o portador consumido **permanece** (RN-10). Ele não é apagado nem
 *     invalidado pelo consumo: a reapresentação dentro da validade precisa continuar resolvendo,
 *     senão a pré-visualização de link pelo provedor de correio queimaria a confirmação antes de o
 *     locatário clicar. **Uso único é o EFEITO, não a RESOLUÇÃO** — a unicidade é imposta pelo
 *     `UPDATE … WHERE consumido_em IS NULL RETURNING`, nunca por filtro na resolução;
 *   * `invalidado_em` — anulável; o reenvio marca os anteriores (RN-09), e **esse** filtro está no
 *     `WHERE` da função. É o que impede um portador antigo de continuar valendo depois de o
 *     locatário pedir outro.
 *
 * Nenhum deles é `boolean`: grava-se o **fato** e deriva-se o estado (ADR-0022).
 *
 * ---------------------------------------------------------------------------
 * O que NÃO existe aqui
 * ---------------------------------------------------------------------------
 *
 * Não há `retirado_em`. A ADR-0014 não alcança esta tabela: o discriminador dela é *ser
 * referenciável*, e nada aponta para uma linha de portador. Ela nunca é apagada, mas por outra razão
 * — a RN-10 precisa distinguir *"já foi usado"* de *"nunca existiu"*. Retenção e expurgo vão para a
 * **F7**, junto de `identidade.tentativa_login` e `negocio.envio_de_cobranca`, que têm a mesma
 * natureza.
 */
export const portadorDeConfirmacao = negocio
  .table(
    'portador_de_confirmacao',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      locatarioId: uuid('locatario_id').notNull(),
      /** O DERIVADO do segredo — nunca o segredo. Ver o cabeçalho. */
      derivado: text('derivado').notNull(),
      expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
      /** Nulo enquanto não foi consumido. A linha consumida PERMANECE (RN-10). */
      consumidoEm: timestamp('consumido_em', { withTimezone: true }),
      /** Nulo enquanto vale. O reenvio marca os anteriores (RN-09). */
      invalidadoEm: timestamp('invalidado_em', { withTimezone: true }),
      /** O instante da emissão, pelo relógio do BANCO (ADR-0026) — nunca pelo do processo. */
      criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta de quem vier a apontar para o portador, e o que a
      // guarda de cobertura de `src/catalogo.ts` cobra de toda tabela deste schema.
      unique('portador_de_confirmacao_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A unicidade GLOBAL do derivado — ver o cabeçalho. Ela é também o índice pelo qual a função
      // `SECURITY DEFINER` da `0014` busca: a resolução é uma leitura por chave única, e não uma
      // varredura.
      unique('portador_de_confirmacao_derivado_key').on(tabela.derivado),
      // A chave estrangeira COMPOSTA da ADR-0008 — a única da tabela. Ela recusa, no banco, um
      // portador da empresa A apontando para locatário da empresa B: o par
      // `(locatario_id, empresa_id)` teria de existir no pai, e não existe. É recusa ESTRUTURAL, e é
      // por isso que a forma simples (`REFERENCES locatario(id)`) não serve nem "por enquanto" —
      // ela aceitaria o apontamento cruzado em silêncio, e aqui o preço seria confirmar o endereço
      // de uma pessoa de outra empresa.
      foreignKey({
        name: 'portador_de_confirmacao_locatario_empresa_fkey',
        columns: [tabela.locatarioId, tabela.empresaId],
        foreignColumns: [locatario.id, locatario.empresaId],
      }),
      // A leitura por locatário (a invalidação em massa do reenvio, RN-09) — é ela que o índice
      // cobre, e não `empresa_id` sozinho.
      index('portador_de_confirmacao_empresa_locatario_idx').on(
        tabela.empresaId,
        tabela.locatarioId,
      ),
    ],
  )
  .enableRLS();

// ===========================================================================
// O certificado do provedor — o que guarda derivado de segredo E histórico
// ===========================================================================

/**
 * O certificado com que a empresa se apresenta ao provedor bancário.
 *
 * ---------------------------------------------------------------------------
 * `segredo_cifrado` guarda o CIFRADO, e a bicondicional o amarra ao histórico
 * ---------------------------------------------------------------------------
 *
 * O que a empresa envia é um arquivo protegido por senha; o que esta coluna guarda é o resultado da
 * cifra dele, e a chave que a desfaz **não vive no banco** — ela é variável de ambiente do processo
 * (ADR-0032). Quem lê o banco inteiro — dump, réplica, backup, operador de suporte — não consegue
 * apresentar-se ao provedor em nome de empresa nenhuma.
 *
 * A `CHECK` de `certificado_do_provedor_segredo_chk` é uma **bicondicional**, e não duas condições
 * soltas: `(segredo_cifrado IS NULL) = (substituido_em IS NOT NULL)`. Ela torna dois estados
 * inexistentes de uma vez — *"substituído e ainda guardando o segredo"* (o material que ninguém mais
 * usa continuaria no banco, alargando o que um vazamento alcança) e *"vigente sem segredo"* (a
 * empresa apareceria configurada e nenhuma emissão funcionaria). É a RN-13, imposta pelo banco:
 * escrever a substituição **é** apagar o segredo, num único `UPDATE`, porque a transação que fizesse
 * só metade seria recusada.
 *
 * ---------------------------------------------------------------------------
 * Um VIGENTE por empresa — índice único PARCIAL, não restrição
 * ---------------------------------------------------------------------------
 *
 * `substituido_em` nulo **é** a definição de vigente: não há coluna de bandeira, e não há rotina que
 * "vire" nada. `certificado_do_provedor_vigente_uidx` cobre `empresa_id` apenas onde a coluna é
 * nula, de modo que dois vigentes na mesma empresa são **irrepresentáveis** (RN-12) — a segunda
 * gravação é recusada pelo banco, e não por uma leitura-antes-de-gravar que perderia a corrida.
 *
 * A forma é `uniqueIndex(...).where(...)` pela mesma razão registrada em {@link contrato}, e ela não
 * é escolha de estilo: **o PostgreSQL não admite restrição única parcial**. Quem "corrigir" para
 * `unique('…').on(tabela.empresaId)`, por consistência com a vizinha, remove a condição junto — e a
 * empresa passa a não poder trocar de certificado nunca mais, porque o histórico disputaria com o
 * vigente. O defeito só apareceria na primeira renovação, em operação.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO existe aqui, de propósito
 * ---------------------------------------------------------------------------
 *
 *   * **não há `retirado_em`.** A ADR-0014 não alcança esta tabela: o discriminador dela é *ser
 *     referenciável*, e nada aponta para uma linha de certificado. A linha substituída **permanece**,
 *     porque é o histórico de com qual material cada emissão foi assinada — e `substituido_em` já
 *     responde por "saiu de uso" sem tomar emprestada a semântica da exclusão lógica;
 *   * **não há coluna da senha em claro, nem do arquivo original.** O que se guarda é o cifrado, mais
 *     os três fatos que a leitura do `.pfx` extrai (`titular`, `valido_de`, `valido_ate`) e a
 *     `impressao_digital`, que é o que identifica o material sem o revelar;
 *   * **não há coluna de estado de validade.** Vencido é `valido_ate` no passado, derivado no
 *     instante da leitura (ADR-0022) — nenhuma rotina precisa rodar para a verdade continuar
 *     verdadeira.
 */
export const certificadoDoProvedor = negocio
  .table(
    'certificado_do_provedor',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      /** O titular declarado pelo próprio material, lido do `.pfx` — nunca digitado. */
      titular: text('titular').notNull(),
      validoDe: timestamp('valido_de', { withTimezone: true }).notNull(),
      validoAte: timestamp('valido_ate', { withTimezone: true }).notNull(),
      /** Identifica o material sem o revelar — é o que permite conferir "é este mesmo" num log. */
      impressaoDigital: text('impressao_digital').notNull(),
      /** O CIFRADO, nunca o segredo. Nulo se e somente se substituído — ver o cabeçalho. */
      segredoCifrado: text('segredo_cifrado'),
      /** Quem registrou. Amarrado à empresa pela chave composta abaixo, nunca só pelo `id`. */
      registradoPor: uuid('registrado_por').notNull(),
      /** O instante do registro, pelo relógio do BANCO (ADR-0026) — nunca pelo do processo. */
      criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
      /** Nulo **é** ser o vigente. Preenchê-lo é, pela `CHECK`, apagar o segredo no mesmo ato. */
      substituidoEm: timestamp('substituido_em', { withTimezone: true }),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta de quem vier a apontar para o certificado, e o que a
      // guarda de cobertura de `src/catalogo.ts` cobra de toda tabela deste schema.
      unique('certificado_do_provedor_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A chave estrangeira COMPOSTA da ADR-0008 — a única da tabela, e ela aponta para
      // `identidade.usuario`, que carrega `usuario_id_empresa_key` desde a `0003`. Ela recusa, no
      // banco, um certificado da empresa A registrado por usuário da empresa B: o par
      // `(registrado_por, empresa_id)` teria de existir no pai, e não existe. A forma simples
      // (`REFERENCES usuario(id)`) não serve nem "por enquanto" — ela aceitaria o apontamento
      // cruzado em silêncio, e aqui o preço seria uma trilha que atribui a instalação do material
      // de uma imobiliária a alguém de outra.
      foreignKey({
        name: 'certificado_do_provedor_usuario_empresa_fkey',
        columns: [tabela.registradoPor, tabela.empresaId],
        foreignColumns: [usuario.id, usuario.empresaId],
      }),
      // A RN-13 como bicondicional — ver o cabeçalho. Os dois estados que ela torna inexistentes
      // são independentes, e escrevê-la como duas `CHECK` soltas deixaria passar exatamente um
      // deles conforme qual fosse esquecida.
      check(
        'certificado_do_provedor_segredo_chk',
        sql`(${tabela.segredoCifrado} IS NULL) = (${tabela.substituidoEm} IS NOT NULL)`,
      ),
      // A RN-12: um vigente por empresa, imposto pelo banco. ÍNDICE PARCIAL, e a forma não é
      // escolha de estilo — ver o cabeçalho e a `DECISÃO FECHADA — T3 · 2026-08-09` de
      // {@link contrato}, que registra a mesma armadilha por extenso.
      uniqueIndex('certificado_do_provedor_vigente_uidx')
        .on(tabela.empresaId)
        .where(sql`substituido_em IS NULL`),
      // O histórico da empresa (§4.1): o mais recente primeiro, que é a ordem em que ele é lido.
      index('certificado_do_provedor_historico_idx').on(tabela.empresaId, tabela.criadoEm.desc()),
    ],
  )
  .enableRLS();
