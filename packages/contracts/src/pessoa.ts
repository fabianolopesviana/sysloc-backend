/**
 * O contrato do **cadastro de pessoa** — locador, locatário e fiador.
 *
 * ===========================================================================
 * Um contrato só para os três papéis
 * ===========================================================================
 *
 * Os três são cadastros distintos, com documento único por empresa **cada um** (a mesma pessoa do
 * mundo pode existir nos três papéis), mas a **forma** deles é idêntica: o que os separa é a rota e
 * a tabela, não o corpo. Declarar três esquemas iguais criaria três fontes do mesmo fato, e a
 * primeira emenda a um deles já as faria divergir — que é exatamente o que a ADR-0016 fecha. O papel
 * é parâmetro do serviço (`CadastroDePessoaService`), não do contrato.
 *
 * O termo aqui é o do glossário: **cadastro** é a entidade de negócio; *pessoa*, sozinho, é quem
 * entra no sistema e tem vínculo de acesso (F1). Os símbolos deste arquivo falam do primeiro.
 */

import { z } from 'zod';
import { camposDeEndereco, MAIOR_TEXTO_CURTO } from './comum.js';

/** Os dois tipos de pessoa (RN-11), na ordem em que o enum do banco os declara. */
export const TIPOS_DE_PESSOA = Object.freeze(['PESSOA_FISICA', 'PESSOA_JURIDICA'] as const);

/** União fechada dos tipos de pessoa. */
export type TipoDePessoa = (typeof TIPOS_DE_PESSOA)[number];

/**
 * Corpo fechado da criação e da alteração de um cadastro de pessoa (§4.1).
 *
 * Completo, como todos os desta fatia — não há atualização parcial (§4.1.1).
 *
 * **`documentoPrincipal` chega mascarado e é guardado em dígitos** (§6.2): a máscara é assunto do
 * cliente, e persisti-la faria `123.456.789-09` e `12345678909` serem dois cadastros diferentes sob
 * uma restrição que existe para impedir exatamente isso. A conferência do **dígito verificador**
 * (RN-04) **não** acontece aqui: ela mora em `packages/shared/src/documento.ts`, e trazê-la para
 * este pacote custaria a propriedade que o define — ele é folha, e o frontend o importa sozinho.
 *
 * **`email` é normalizado para minúsculas antes de ser validado**, e não depois: `z.email()`
 * recusaria ` ana@exemplo.com ` por causa dos espaços, e o cliente receberia "endereço inválido"
 * para um endereço que é válido. É o mesmo desenho de `ESQUEMA_DA_PESSOA_NOVA` da F1, e pela mesma
 * razão escrita lá — normalizar em dois pontos deixa os dois livres para divergir.
 *
 * `rg` aceita `null` porque pessoa jurídica não tem um; `empresaId` não aparece, como em nenhum
 * esquema de entrada deste pacote.
 */
export const esquemaDePessoaNova = z.strictObject({
  nome: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
  tipoPessoa: z.enum(TIPOS_DE_PESSOA),
  documentoPrincipal: z
    .string()
    .trim()
    .transform((documento) => documento.replace(/\D/g, ''))
    .pipe(z.string().min(1).max(MAIOR_TEXTO_CURTO)),
  rg: z.string().trim().max(MAIOR_TEXTO_CURTO).nullable(),
  email: z
    .string()
    .trim()
    .transform((endereco) => endereco.toLowerCase())
    .pipe(z.email()),
  telefone: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
  ...camposDeEndereco(),
});

/** O corpo aceito na criação e na alteração de um cadastro de pessoa. */
export type PessoaNova = z.infer<typeof esquemaDePessoaNova>;

/**
 * O cadastro de pessoa como a API o devolve.
 *
 * `documentoPrincipal` volta **em dígitos**, como foi guardado; remascarar é apresentação, e é do
 * cliente. `retiradoEm` é a marca da exclusão lógica (ADR-0014): o cadastro retirado some das
 * listagens padrão e dos seletores, e segue alcançável por `GET /:id` — sem isso a recirculação
 * ficaria inalcançável pela interface.
 */
export const esquemaDaPessoa = z.object({
  id: z.uuid(),
  nome: z.string(),
  tipoPessoa: z.enum(TIPOS_DE_PESSOA),
  documentoPrincipal: z.string(),
  rg: z.string().nullable(),
  email: z.string(),
  telefone: z.string(),
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string().nullable(),
  bairro: z.string(),
  cidade: z.string(),
  estado: z.string(),
  cep: z.string(),
  retiradoEm: z.iso.datetime().nullable(),
});

/** O cadastro de pessoa como a API o devolve. */
export type Pessoa = z.infer<typeof esquemaDaPessoa>;

/**
 * O **locatário** como a API o devolve — o cadastro de pessoa mais o instante da confirmação.
 *
 * ---------------------------------------------------------------------------
 * Crescimento em símbolo NOVO, nunca emenda no esquema compartilhado
 * ---------------------------------------------------------------------------
 *
 * {@link esquemaDaPessoa} serve aos três papéis, e acrescentar `emailConfirmadoEm` a ele publicaria
 * o campo também para **locador e fiador**, que não têm confirmação alguma a publicar — um recurso
 * afirmando um fato que não existe para ele. A extensão nasce, portanto, em símbolo próprio,
 * consumido pelas seis rotas de locatário e por nenhuma outra.
 *
 * E é **um** símbolo, não seis extensões escritas no ponto de uso: `esquemaDaPessoa.extend({…})`
 * repetido em cada rota seria seis declarações do mesmo fato, livres para divergir na primeira
 * emenda — que é exatamente o que a ADR-0016 fecha.
 *
 * ---------------------------------------------------------------------------
 * O que se publica é o INSTANTE, e não um "confirmado: true"
 * ---------------------------------------------------------------------------
 *
 * Pela ADR-0022, grava-se o **fato** e publica-se o que dele se deriva: a coluna guarda
 * `email_confirmado_em`, e o contrato expõe o mesmo instante. Um booleano publicado seria uma
 * segunda representação do mesmo fato — perderia *quando* a confirmação aconteceu, que é o que a
 * tela precisa mostrar, e passaria a poder divergir do instante gravado.
 *
 * `null` é o cadastro cujo endereço ainda não foi confirmado, e ele é o estado em que todo locatário
 * nasce; a alteração do e-mail o devolve a `null`, porque a confirmação é do endereço, não da pessoa.
 */
export const esquemaDoLocatario = esquemaDaPessoa.extend({
  emailConfirmadoEm: z.iso.datetime().nullable(),
});

/** O locatário como a API o devolve — as seis rotas de `/v1/locatarios`. */
export type Locatario = z.infer<typeof esquemaDoLocatario>;
