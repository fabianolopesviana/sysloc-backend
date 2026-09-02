/**
 * O contrato do **Admin Empresa** publicado pelas rotas de `/v1/master` — a **fonte única** dos
 * esquemas e, por derivação, dos tipos.
 *
 * ---------------------------------------------------------------------------
 * Os TIPOS derivam dos esquemas — a `Decision` da ADR-0016 tem TRÊS derivados, não dois
 * ---------------------------------------------------------------------------
 *
 * *"a conferência de entrada, **o tipo da resposta** e o documento publicado derivam dele. Nenhuma
 * descrição de contrato é escrita à mão em paralelo ao esquema. Uma camada de contrato adicional é
 * permitida desde que **derive** do esquema — nunca que o duplique."*
 *
 * Este módulo nasceu porque o do meio faltava. Até a rodada 1 da T4, o controlador declarava os seis
 * esquemas e o serviço redigitava, **à mão e em outro arquivo**, os seis tipos correspondentes — e
 * nada ligava as duas declarações. A divergência não era hipótese: `impedimentos` era
 * `z.array(z.string())` no esquema publicado e `readonly ClasseDeImpedimento[]` no tipo, de modo que
 * o documento entregue ao cliente era **mais frouxo que o contrato real**, e nenhuma ferramenta tinha
 * como acusar. É literalmente a frase do `Context` da ADR-0016.
 *
 * Aqui existe **uma** declaração por fato: cada `ESQUEMA_*` é o objeto, e o tipo ao lado é
 * `z.infer` dele. O molde é o de `@syslocbr/contracts` — `esquemaDoImovel` → `Imovel`,
 * `envelopeDeLista(esquemaDoImovel)` → `EnvelopeDeLista<Imovel>` —, combinadores gêmeos sobre a mesma
 * declaração, nunca uma segunda digitação.
 *
 * ---------------------------------------------------------------------------
 * Os esquemas são LOCAIS, e NÃO vêm de `@syslocbr/contracts` (ADR-0039)
 * ---------------------------------------------------------------------------
 *
 * A escolha é a da tech spec (§4.2) e tem razão declarada na **ADR-0039**: são **duas superfícies com
 * públicos e ciclos distintos**, e o pacote de contratos é o que *"entrega à aplicação da
 * imobiliária"* — o operador do SaaS não é aquele cliente e não consome aquele pacote. Importar dali
 * o envelope e a janela amarraria a política de página desta superfície à daquela, e uma mudança
 * feita para o frontend da imobiliária passaria a mover o painel do operador sem que ninguém
 * decidisse. **O `P1` do Gate 2 não é sobre a localidade dos esquemas** — ela foi julgada correta; é
 * sobre a derivação dos tipos, que é o que este módulo instala.
 *
 * ---------------------------------------------------------------------------
 * Por que num MÓDULO PRÓPRIO, e não dentro do controlador ou do serviço
 * ---------------------------------------------------------------------------
 *
 * Os dois lados precisam do mesmo fato: o controlador precisa do **esquema** (para
 * `esquemaPublicado`), o serviço precisa do **tipo** (para declarar o que devolve). Deixá-lo no
 * controlador obrigaria o serviço a importar da borda — inversão da direção do grafo desta base.
 * Deixá-lo no serviço faria a camada de orquestração passar a importar `zod`, que ela hoje não
 * importa, e misturaria contrato com regra no arquivo que o cabeçalho declara ser só de orquestração.
 * Um módulo de contrato é o que o molde de `@syslocbr/contracts` já é, em escala local — e é onde a
 * T5 e a T6 acrescentam as quatro rotas restantes do mesmo recurso, sem redeclarar chave nenhuma.
 *
 * ---------------------------------------------------------------------------
 * As duas grandezas de `readonly` são deliberadas
 * ---------------------------------------------------------------------------
 *
 * `impedimentos` e `itens` declaram `.readonly()` **no esquema**, e não no tipo: é o que faz
 * `z.infer` produzir `readonly T[]`, preservando byte a byte a garantia que os tipos escritos à mão
 * tinham. A consequência no documento publicado é a palavra `readOnly: true` no campo, que é
 * verdadeira — nenhuma das duas viaja no sentido cliente → servidor.
 */

import type { ClasseDeImpedimento } from '@sysloc/db';
import { z } from 'zod';

// DÉBITO COM GATILHO — D12 · F7/T4 · registrado 2026-09-02
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: a FORMA da janela desta superfície — o par de constantes mais o `z.strictObject` com
//        `z.coerce` e `.default(...)` — é a SEGUNDA cópia dentro de `apps/api/src/master/`. A
//        primeira é `empresa.controller.ts` com `MAIOR_PAGINA_DE_EMPRESAS`/
//        `PAGINA_PADRAO_DE_EMPRESAS` (`empresa.service.ts`). ⚠️ Os **valores** já divergem de
//        propósito (ver o docblock abaixo: 50/25 aqui, 200/50 lá, por medição); o que se repete é a
//        forma, e são duas formas livres para divergir no dia em que a janela mudar de mecanismo.
// QUANDO FECHA: a TERCEIRA declaração da mesma forma em `apps/api/src/master/`, ou a primeira task
//        autorizada a abrir `empresa.controller.ts` por outra razão — aí a forma sobe para casa
//        única do módulo `master/`, com o teto e o padrão por parâmetro.
//        ⚠️ **JÁ DISPAROU (F7/T6)** — a T6 abriu `empresa.controller.ts` para publicar o `PUT` e o
//        `DELETE` de `/empresas/:id`. Adiado por §A1: fechá-lo exigiria reescrever
//        `ESQUEMA_DA_JANELA` de rota **entregue**, refatoração fora da causa-raiz que o §4.5 do
//        Protocolo proíbe. Quem abrir este arquivo de novo lê que **é a segunda vez**, e não que o
//        gatilho ainda não veio.
// POR QUE NÃO AGORA: são DUAS, e o Limiar de Três do `CLAUDE.md` não disparou. Subi-la hoje
//        obrigaria a editar `empresa.controller.ts`, que publica rota já entregue e sem defeito que
//        o motive — o Protocolo Antirregressão proíbe refatorar fora da causa-raiz. E importar
//        `esquemaDaJanela` de `@syslocbr/contracts` é o que a **ADR-0039** recusa por escrito.
// ÍNDICE: docs/specs/features/painel-master-administradores/v1/_run/run-report.md §2, D12
/**
 * Maior página que a listagem de administradores devolve. Pedido acima disso é **recusado**, nunca
 * truncado em silêncio.
 *
 * ---------------------------------------------------------------------------
 * O teto é 50, e NÃO os 200 da listagem de empresas — o número saiu de MEDIÇÃO
 * ---------------------------------------------------------------------------
 *
 * A §12.3 da tech spec mandava *"medir uma vez a latência no teto e registrar"*, e a rodada 1 herdou
 * o 200 do irmão sem medir. A medição foi feita em 2026-09-02, em instância efêmera migrada, com uma
 * empresa de 200 Admin Empresa **elegíveis** (o caminho mais caro: o `DELETE` do ensaio remove de
 * fato antes de a sentinela desfazê-lo), cronometrando a unidade inteira — a página mais a sonda
 * item a item — três vezes por teto:
 *
 * | itens | latência (ms) |
 * |---|---|
 * | 200 | 885 · 697 · 674 |
 * | 50  | 167 · 179 · 181 |
 * | 25  | 92 · 141 · 100 |
 * | 10  | 39 · 35 · 37 |
 *
 * O custo é **linear em ~3,4 ms por item**, porque a prévia é o próprio ato (ADR-0038) e não pode
 * ser derivada de contagem. Sob o teto herdado, um `GET` do painel custava ~0,7 s de transação de
 * leitura para compor uma página que a persona não tem: o operador olha **uma empresa por vez**, e
 * uma imobiliária tem um punhado de Admin Empresa. Cinquenta é uma ordem de grandeza acima do
 * plausível e custa ~0,18 s; o padrão de 25 custa ~0,1 s, comparável a qualquer listagem sem sonda.
 *
 * **Nada fica inalcançável**: `deslocamento` continua alcançando o conjunto inteiro, e o teto recusa
 * em vez de truncar — o cliente que pedir mais recebe `422` nomeando o campo, e não uma página que
 * mente sobre o próprio tamanho.
 */
export const MAIOR_PAGINA_DE_ADMINISTRADORES = 50;

/** Tamanho de página quando quem chama não declara um. Ver a tabela de medição acima. */
export const PAGINA_PADRAO_DE_ADMINISTRADORES = 25;

/**
 * A janela da listagem.
 *
 * `limite` e `deslocamento` são campos do envelope de lista, e por isso são declaráveis: publicá-los
 * na resposta e ignorá-los no pedido faria a resposta afirmar uma janela que o cliente não pediu — e
 * deixaria a segunda página inalcançável. O teto é explícito, e pedido acima dele **recusa** em vez
 * de truncar em silêncio: truncar faria o cliente acreditar que viu tudo.
 *
 * `z.coerce` porque a janela chega na cadeia de consulta, onde tudo é texto; `strictObject` porque
 * parâmetro inventado é erro do cliente (`.claude/rules/contrato-publicado.md`: **entrada fechada**).
 */
export const ESQUEMA_DA_JANELA = z.strictObject({
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAIOR_PAGINA_DE_ADMINISTRADORES)
    .default(PAGINA_PADRAO_DE_ADMINISTRADORES),
  deslocamento: z.coerce.number().int().min(0).default(0),
});

/** A janela pedida, com os padrões já aplicados — derivada do esquema, nunca redigitada. */
export type JanelaDaListagem = z.infer<typeof ESQUEMA_DA_JANELA>;

/**
 * O vocabulário **fechado** de impedimentos da RN-15, como o contrato o publica.
 *
 * ---------------------------------------------------------------------------
 * Ele é amarrado ao domínio nas DUAS direções, e nenhuma delas é comentário
 * ---------------------------------------------------------------------------
 *
 * `as const satisfies readonly ClasseDeImpedimento[]` fecha uma: um valor que não seja classe do
 * domínio **não compila** aqui. A outra é fechada onde ela importa — `paraContratoDoAdministrador`
 * atribui `elegibilidade.impedimentos`, que é `readonly ClasseDeImpedimento[]`, ao campo derivado
 * deste enum; uma classe do domínio **ausente** desta tupla faz aquela atribuição falhar. As duas
 * juntas tornam o conjunto igual, e não apenas contido.
 *
 * A ordem é alfabética e não é conteúdo: o que o cliente lê é o conjunto.
 *
 * ---------------------------------------------------------------------------
 * PUBLICADO desde a T6 — e a razão é a amarra, não a conveniência
 * ---------------------------------------------------------------------------
 *
 * A superfície de **Empresa** ({@link ./empresa.controller.js}) publica a mesma prévia por item e
 * precisa do mesmo enum no documento. Ela consome esta tupla em vez de escrever a própria porque
 * **só aqui** o conjunto está amarrado ao domínio nas duas direções: uma cópia com
 * `as const satisfies` teria a primeira amarra e **não** a segunda — esquecer uma classe do domínio
 * compilaria, e o documento entregue ao cliente prometeria menos do que o servidor cumpre. É
 * literalmente o defeito que o `P1` do Gate 2 da T4 reprovou, um degrau acima.
 *
 * ⚠️ **O nome do módulo diz `administrador`, e o alcance desta tupla é maior**: ela é o vocabulário
 * da RN-15, comum às duas superfícies do Master. Movê-la para casa própria é churn enquanto forem
 * dois consumidores no mesmo diretório; o que não se admite é a segunda declaração.
 */
export const CLASSES_DE_IMPEDIMENTO = [
  'ADMINISTRADORES_NAO_ELEGIVEIS',
  'AUTORIA_EM_REGISTRO',
  'REGISTROS_DE_NEGOCIO',
  'TENTATIVA_DE_ENTRADA',
  'VINCULO_DE_ACESSO',
] as const satisfies readonly ClasseDeImpedimento[];

/**
 * A prévia de exclusão publicada por item (US-07, ADR-0030).
 *
 * `motivo` e `alternativa` são opcionais porque **só existem quando a exclusão está indisponível**:
 * publicá-los sempre obrigaria a inventar um motivo para quem não tem impedimento algum, e o cliente
 * teria de olhar `disponivel` para saber se deve ler os outros dois. A ausência já diz isso.
 *
 * `impedimentos` carrega **classes** do vocabulário fechado da RN-15 — nunca o nome da entidade,
 * nunca a quantidade, nunca o `detail` do driver: a ADR-0013 restringe o alcance desta persona ao que
 * é dela, e *"existem 42 cobranças"* já é dado de negócio. A união fechada é o que faz o **documento
 * publicado** dizer isso; até a rodada 1 ele dizia `string`, e prometia menos do que o servidor
 * cumpre.
 */
export const ESQUEMA_DA_EXCLUSAO = z.object({
  disponivel: z.boolean(),
  motivo: z.string().optional(),
  impedimentos: z.array(z.enum(CLASSES_DE_IMPEDIMENTO)).readonly(),
  alternativa: z.string().optional(),
});

/** A prévia de exclusão, derivada do esquema — nunca redigitada. */
export type ExclusaoDoAdministrador = Readonly<z.infer<typeof ESQUEMA_DA_EXCLUSAO>>;

/**
 * O Admin Empresa como o contrato o publica — o conjunto **fechado** de chaves da RN-13.
 *
 * Nenhum dado de negócio entra nele: a persona alcança identificação e estado, e nada de contrato,
 * imóvel, vínculo ou permissão. O `CT-1220` assere as seis chaves por igualdade de conjunto, de modo
 * que um campo acrescentado aqui reprova antes de vazar.
 *
 * Símbolo publicado do módulo porque ele é a fonte da descrição das rotas que a T5 acrescenta ao
 * mesmo recurso: uma segunda declaração das mesmas seis chaves seria a divergência que a ADR-0016
 * existe para impedir.
 */
export const ESQUEMA_DO_ADMINISTRADOR_DO_MASTER = z.object({
  usuarioId: z.uuid(),
  nome: z.string(),
  email: z.email(),
  estado: z.enum(['ATIVO', 'SUSPENSO']),
  criadoEm: z.iso.datetime(),
  exclusao: ESQUEMA_DA_EXCLUSAO,
});

/** O Admin Empresa publicado, derivado do esquema — nunca redigitado. */
export type AdministradorDoContrato = Readonly<z.infer<typeof ESQUEMA_DO_ADMINISTRADOR_DO_MASTER>>;

/**
 * Os dois estados publicados de um Admin Empresa.
 *
 * **Calculado no servidor a partir de `ativo`**, e nunca uma coluna própria: duas fontes para o mesmo
 * fato divergem. A tradução acontece em `paraContratoDoAdministrador`, e só lá (§6.2). O tipo sai do
 * **campo do esquema**, e não de uma união escrita ao lado dele.
 */
export type EstadoDoAdministrador = AdministradorDoContrato['estado'];

/** O envelope de lista, derivado do esquema do item — nunca redigitado (ADR-0017). */
export const ESQUEMA_DA_PAGINA = z.object({
  itens: z.array(ESQUEMA_DO_ADMINISTRADOR_DO_MASTER).readonly(),
  total: z.number().int().min(0),
  limite: z.number().int().min(1).max(MAIOR_PAGINA_DE_ADMINISTRADORES),
  deslocamento: z.number().int().min(0),
});

/** A página de administradores, derivada do envelope — na forma canônica de lista da ADR-0017. */
export type PaginaDeAdministradores = Readonly<z.infer<typeof ESQUEMA_DA_PAGINA>>;

/** O que a suspensão devolve — o estado novo mais a **prova medida** do encerramento. */
export const ESQUEMA_DA_SUSPENSAO = z.object({
  usuarioId: z.uuid(),
  estado: z.literal('SUSPENSO'),
  /** Quantos registros de sessão foram apagados **neste ato**. Zero na repetição. */
  sessoesEncerradas: z.number().int().min(0),
});

/** O corpo da suspensão, derivado do esquema — nunca redigitado. */
export type SuspensaoDoAdministrador = Readonly<z.infer<typeof ESQUEMA_DA_SUSPENSAO>>;

/**
 * O que a reativação devolve. Ela devolve a capacidade de **entrar**, e nada além (RN-04).
 *
 * Não há `sessoesEncerradas` aqui, e a ausência é conteúdo: a reativação não encerra nem restaura
 * sessão. Publicar o campo com zero sugeriria que houve um encerramento medido.
 */
export const ESQUEMA_DA_REATIVACAO = z.object({
  usuarioId: z.uuid(),
  estado: z.literal('ATIVO'),
});

/** O corpo da reativação, derivado do esquema — nunca redigitado. */
export type ReativacaoDoAdministrador = Readonly<z.infer<typeof ESQUEMA_DA_REATIVACAO>>;

// ===========================================================================================
// R4 e R5 — a correção cadastral e a remoção definitiva (T5)
// ===========================================================================================

/**
 * Maior comprimento aceito para o nome da pessoa.
 *
 * É a **segunda** declaração do mesmo teto — `empresa.controller.ts` tem `MAIOR_NOME`, privado, que
 * a admissão de administrador já aplica ao mesmo campo da mesma coluna. Duas, e não três: o Limiar
 * de Três do `CLAUDE.md` não disparou, e subir o teto para casa comum hoje obrigaria a editar um
 * controlador que publica rota entregue sem defeito que o motive. O valor é o mesmo de propósito —
 * a admissão e a correção escrevem em `identidade.usuario.nome`, e um teto maior aqui deixaria a
 * borda aceitar o que a outra recusa, sobre a mesma coluna.
 */
const MAIOR_NOME_DE_PESSOA = 200;

/**
 * O corpo da correção cadastral do Admin Empresa (R4, US-06, RN-08).
 *
 * ---------------------------------------------------------------------------
 * O que ele NÃO aceita é o conteúdo da decisão
 * ---------------------------------------------------------------------------
 *
 * `estado`, `ativo`, `perfil` e `empresaId` **não existem** aqui, e o `strictObject` os recusa
 * nomeando a chave em vez de descartá-los em silêncio:
 *
 * - `estado`/`ativo` — a **ADR-0021** é categórica na primeira metade: transição de estado acontece
 *   em **rota própria**, nunca como campo gravado por uma atualização de cadastro. As rotas são
 *   `POST /v1/master/usuarios/:id/suspensao` e `.../reativacao`, e elas existem. Um `z.object` no
 *   lugar deste responderia `200` **ignorando** a chave, e o operador acreditaria ter reativado
 *   alguém que continua suspenso — é o que o `CT-1230` reprova.
 * - `perfil` — fixo por decisão da **ADR-0013**: o Master governa `ADMIN_EMPRESA`, e nada além
 *   disso. Aceitá-lo do corpo seria a elevação de privilégio que o `D7` da fatia anterior fechou.
 * - `empresaId` — a pessoa não muda de empresa por correção cadastral; mudá-la seria mover dado
 *   entre tenants pela borda.
 *
 * ⚠️ **É `PUT` com corpo COMPLETO, e não atualização parcial**: os dois campos são obrigatórios. É a
 * forma canônica do repositório (`@Put(':id')` em 5 manipuladores, `@Patch` em nenhum), e ela evita
 * a ambiguidade de "ausente" significar ora *"não mexa"*, ora *"apague"*.
 *
 * A normalização do endereço é a **mesma** da admissão, e mora num lugar só por rota: a coluna
 * guarda minúsculas, e uma correção que gravasse `Ana@…` deixaria a pessoa sem entrar com `ana@…` —
 * a credencial ancora no `usuarioId`, mas a **admissão** da sessão procura pelo endereço.
 */
export const ESQUEMA_DO_ADMINISTRADOR_ALTERADO = z.strictObject({
  nome: z.string().trim().min(1).max(MAIOR_NOME_DE_PESSOA),
  // Normaliza **antes** de validar, e não depois: `z.email()` recusaria ` ana@exemplo.com ` por
  // causa dos espaços, e o cliente receberia "endereço inválido" para um endereço que é válido.
  email: z
    .string()
    .trim()
    .transform((endereco) => endereco.toLowerCase())
    .pipe(z.email()),
});

/** Os dados da correção cadastral, derivados do esquema — nunca redigitados. */
export type AdministradorAlterado = Readonly<z.infer<typeof ESQUEMA_DO_ADMINISTRADOR_ALTERADO>>;

/**
 * O que a remoção definitiva devolve (R5, US-08, ADR-0038).
 *
 * ⚠️ **Não confunda com {@link ESQUEMA_DA_EXCLUSAO}, e não troque um pelo outro**: aquele é a
 * **prévia** — o artefato derivado que a listagem publica por item, dizendo se o ato *seria* aceito
 * (ADR-0030) —, e este é o **ato consumado**. São fatos diferentes sobre momentos diferentes, e
 * fundi-los faria a resposta do `DELETE` carregar um `disponivel` que já não descreve nada.
 *
 * O corpo existe porque a rota responde `200`, e não `204`: uma resposta sem corpo obrigaria o
 * cliente a inferir o alvo do ato a partir da requisição que ele mandou, e o eco do `usuarioId` é o
 * que fecha o par pedido/efeito na mesma forma dos dois corpos de transição acima. `removido` é
 * `z.literal(true)` pela mesma razão que `estado` é literal ali: o desfecho é único — a recusa sai
 * pelo envelope de erro, nunca por um `removido: false`.
 */
export const ESQUEMA_DA_REMOCAO = z.object({
  usuarioId: z.uuid(),
  removido: z.literal(true),
});

/** O corpo da remoção definitiva, derivado do esquema — nunca redigitado. */
export type RemocaoDoAdministrador = Readonly<z.infer<typeof ESQUEMA_DA_REMOCAO>>;
