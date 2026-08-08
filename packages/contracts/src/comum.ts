/**
 * O que **toda** rota desta superfície compartilha: o identificador que chega no caminho, a janela
 * de listagem e o envelope que embrulha a resposta de lista.
 *
 * ---------------------------------------------------------------------------
 * Por que estes três moram num arquivo só
 * ---------------------------------------------------------------------------
 *
 * Nenhum dos três pertence a uma entidade. Declará-los dentro de `imovel.ts` obrigaria `pessoa.ts`
 * a importar do vizinho — ou, o que sempre acontece, a redigitar a mesma forma —, e a ADR-0016 fixa
 * que o esquema é a **fonte única** do contrato. Fonte única com duas cópias não é fonte única.
 *
 * A forma do envelope de lista (`{ itens, total, limite, deslocamento }`) e a decisão de o corpo
 * falar camelCase vêm da **ADR-0017**, que as preserva inteiras da ADR-0012.
 */

import { z } from 'zod';

/**
 * Maior janela que uma listagem aceita, e a janela padrão quando o cliente não pede nenhuma.
 *
 * Os valores repetem os que a F1 fixou em `usuario.service.ts` e `empresa.service.ts` — 200 e 50 —
 * porque a superfície é a mesma para o mesmo cliente, e duas grandezas diferentes de página no
 * mesmo produto seriam uma decisão sem razão que a justificasse.
 *
 * São **exportados** porque o teto é conteúdo do contrato, não detalhe de implementação: quem
 * monta a chamada precisa saber onde ela recusa, e a asserção da fronteira (CT-338) lê o teto
 * daqui em vez de redigitar o número — um teto alargado na constante reprova o caso, que é
 * exatamente o mutante que a prova precisa detectar.
 */
export const MAIOR_PAGINA = 200;

/** A janela usada quando o cliente não declara `limite`. */
export const PAGINA_PADRAO = 50;

/**
 * O identificador exposto por estas entidades, **na forma canônica**.
 *
 * A ADR-0017 fixa que a chave exposta é o **UUID** quando a entidade não tem série declarada — e
 * nenhuma das seis desta fatia tem. A validação é de **forma** e não diz nada sobre existência: um
 * UUID bem formado que não corresponda a registro alcançável segue produzindo `404`.
 *
 * ---------------------------------------------------------------------------
 * A minúscula é imposta AQUI, e não é cosmética
 * ---------------------------------------------------------------------------
 *
 * `z.uuid()` valida a forma e devolve o valor **verbatim** — `3F2504E0-…` passa e sai como
 * `3F2504E0-…`. Do outro lado, o Postgres sempre renderiza `uuid` em minúsculas e `uuid_in` parseia
 * o hexadecimal **sem distinguir caixa**: as duas pontas concordam sobre a *identidade* e discordam
 * sobre a *grafia*, e uma comparação de string entre o `:id` do caminho e o valor lido do banco
 * responde `false` sobre o mesmo registro.
 *
 * Foi por aí que a escalada de privilégio da F1/T8 se tornou contornável, e a correção mora na
 * canonização da borda — o marcador `DECISÃO FECHADA` que a protege está em
 * `apps/api/src/usuarios/usuario.controller.ts`. Publicá-la aqui é o que impede os controladores
 * desta fatia de repetirem a transformação: **normalizar em dois pontos deixa os dois livres para
 * divergir**, e é a repetição, não a transformação, que reabriria o defeito.
 *
 * Este esquema **não protege** o marcador de lá nem o substitui — ver o débito registrado logo
 * abaixo, que é onde a duplicação está escriturada.
 */
// DÉBITO COM GATILHO — D3 · F2/T1 · registrado 2026-08-05
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo. O marcador
//  que PROTEGE é o de `apps/api/src/usuarios/usuario.controller.ts`, e ele não é tocado aqui.)
// O QUÊ: esta é a SEGUNDA definição da canonização do identificador — a primeira vive em
//        `apps/api/src/usuarios/usuario.controller.ts`, sob `DECISÃO FECHADA`. A ADR-0016 fixa que
//        o esquema é a fonte ÚNICA do contrato, e duas definições do mesmo fato são livres para
//        divergir; hoje elas são idênticas, e é a réplica, não a divergência, que está registrada.
// QUANDO FECHA: na primeira task que abrir `usuario.controller.ts` por outra razão — ela troca a
//        cópia de lá pelo consumo deste símbolo. O `REVERTER EXIGE` daquele marcador é satisfeito
//        por construção nessa troca: a canonização não deixa de existir, muda de arquivo.
// POR QUE NÃO AGORA: `usuario.controller.ts` não está entre os arquivos desta task, e o trecho está
//        sob `DECISÃO FECHADA` — tocá-lo aqui seria refactor fora do escopo, vedado pelo Protocolo
//        Antirregressão, sobre justamente o código que o protocolo manda não mover.
// ÍNDICE: docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/_run/run-report.md §2, D3
export const ESQUEMA_DO_IDENTIFICADOR = z.uuid().transform((valor) => valor.toLowerCase());

/** O identificador de um recurso, já canonizado. */
export type Identificador = z.infer<typeof ESQUEMA_DO_IDENTIFICADOR>;

/**
 * A janela de uma listagem.
 *
 * `z.coerce` porque a janela chega na cadeia de consulta, onde tudo é texto; `strictObject` porque
 * parâmetro inventado é erro do cliente, e ignorá-lo faria a resposta descrever uma janela que
 * ninguém pediu.
 *
 * **O teto RECUSA em vez de truncar.** É a mesma decisão da listagem de pessoas da F1, e a razão é
 * a mesma: truncar `limite: 5000` para 200 devolveria 200 registros num envelope que afirma
 * `limite: 200` — o cliente não tem como saber que pediu mais, e um consumidor que confie no
 * `total` acreditaria ter visto a empresa inteira. Recusa é ruidosa; truncar é silencioso e mente.
 */
export const esquemaDaJanela = z.strictObject({
  limite: z.coerce.number().int().min(1).max(MAIOR_PAGINA).default(PAGINA_PADRAO),
  deslocamento: z.coerce.number().int().min(0).default(0),
});

/** A janela pedida, com os padrões já aplicados. */
export type Janela = z.infer<typeof esquemaDaJanela>;

/**
 * A janela de listagem **mais** o parâmetro que alcança o que saiu de circulação (ADR-0014).
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora AQUI, e não em cada controlador
 * ---------------------------------------------------------------------------
 *
 * Ela nasceu declarada dentro de `apps/api/src/imoveis/conjunto.controller.ts` e foi copiada, byte
 * a byte, para `imovel.controller.ts` — a segunda cópia. Os três controladores de pessoa seriam a
 * terceira, a quarta e a quinta **de uma vez**, e é essa aritmética que fecha a discussão: a
 * ADR-0016 declara o esquema a **fonte única** do contrato, e fonte única com cinco cópias não é
 * fonte única. É o mesmo desenho, e a mesma razão, de {@link esquemaDaJanela} e de
 * {@link camposDeEndereco} — o fato do contrato existe num lugar só, e quem precisa dele importa.
 *
 * ---------------------------------------------------------------------------
 * `incluirRetirados` é união fechada de dois LITERAIS, e não `z.coerce.boolean()`
 * ---------------------------------------------------------------------------
 *
 * A coerção do zod é `Boolean(valor)`, e na cadeia de consulta tudo é texto: `?incluirRetirados=false`
 * viraria `true`, porque a cadeia `'false'` não é vazia. O modo de falha seria **mudo** e exatamente
 * o que a ADR-0014 nomeia entre os próprios *Cons* — a listagem mostrando registro retirado como se
 * estivesse ativo. Com a união, qualquer outra grafia é recusada com `422` nomeando o parâmetro, e a
 * ausência vale `false`, que é o padrão seguro.
 *
 * O `transform` entrega **booleano** ao chamador, e não a cadeia: quem consome passa o valor direto
 * às opções de circulação da porta de leitura, sem reinterpretar o texto — e reinterpretar em N
 * pontos é como a coerção errada voltaria pela porta de trás.
 */
export const esquemaDaJanelaComCirculacao = esquemaDaJanela.extend({
  incluirRetirados: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});

/** A janela pedida somada à decisão de circulação, com os padrões já aplicados. */
export type JanelaComCirculacao = z.infer<typeof esquemaDaJanelaComCirculacao>;

/**
 * O envelope de toda resposta de lista — `{ itens, total, limite, deslocamento }` (ADR-0017).
 *
 * É uma **função** sobre o esquema do item, e não quatro envelopes escritos por entidade, pelo
 * mesmo motivo que as constantes acima são únicas: o envelope é um fato do contrato, e reescrevê-lo
 * por recurso deixaria as cópias livres para divergir no dia em que o envelope mudar.
 *
 * `total` é a contagem **na empresa**, não a do que veio nesta página — é o que permite ao cliente
 * saber que existe uma página seguinte sem pedi-la. `limite` e `deslocamento` ecoam a janela
 * efetivamente aplicada.
 */
export function envelopeDeLista<T extends z.ZodType>(esquemaDoItem: T) {
  return z.object({
    itens: z.array(esquemaDoItem),
    total: z.number().int().min(0),
    limite: z.number().int().min(1).max(MAIOR_PAGINA),
    deslocamento: z.number().int().min(0),
  });
}

/** A resposta de lista de `T`, derivada do envelope acima — nunca redigitada. */
export type EnvelopeDeLista<T> = z.infer<ReturnType<typeof envelopeDeLista<z.ZodType<T>>>>;

/** Maior comprimento aceito num campo de texto curto — nome, logradouro, bairro, cidade. */
export const MAIOR_TEXTO_CURTO = 200;

/** Maior comprimento aceito num campo de texto livre — observações. */
export const MAIOR_TEXTO_LIVRE = 2_000;

/**
 * Maior metragem aceita — o maior valor que a coluna `numeric(10,2)` representa (§7.2).
 *
 * ---------------------------------------------------------------------------
 * Este teto não é opinião de domínio: é a capacidade da coluna
 * ---------------------------------------------------------------------------
 *
 * `numeric(10,2)` guarda dez dígitos, dois deles depois da vírgula — logo o maior valor
 * representável é exatamente `99999999.99`. O número está aqui, e não escolhido "por parecer
 * grande", porque é isso que fecha a classe do defeito: sendo o teto **igual** à capacidade da
 * coluna, nenhum valor que o contrato aprove pode estourar o `INSERT`.
 *
 * O defeito que ele fecha era silencioso e caro. `z.number().min(0)` recusa `Infinity` e `NaN`, mas
 * **aprova `1e30`** — verificado com o zod deste pacote. Um corpo com `{"metragem": 1e30}` passava
 * pelo contrato, chegava ao banco e levantava `numeric field overflow` (22003); na borda,
 * `apps/api/src/comum/filtro-excecao.ts` só reconhece `ErroDeAplicacao` e `HttpException`, de modo
 * que a exceção do driver virava **500 registrado como falha do serviço**. Entrada malformada de
 * cliente entrando na trilha em nível `error` é ruído no sinal que a §13 usa para alertar — e a
 * §6.1 manda que erro de cliente saia como `422 CAMPO_INVALIDO` nomeando o campo.
 *
 * Sendo este pacote a **fonte única do contrato** (ADR-0016), a regra que ele implica é geral: todo
 * valor que o contrato aprova tem de ser representável a jusante. As outras três grandezas do
 * pacote já tinham o seu teto ({@link MAIOR_TEXTO_CURTO}, {@link MAIOR_TEXTO_LIVRE},
 * {@link MAIOR_PAGINA}); a metragem era a única sem, e é justamente a que tem contraparte física no
 * banco.
 *
 * Esta constante fecha a **precisão**. A **escala** é a outra metade da mesma declaração de coluna,
 * e mora em {@link ESCALA_DA_METRAGEM} — as duas juntas é que tornam a frase acima verdadeira.
 */
export const MAIOR_METRAGEM = 99_999_999.99;

/**
 * A escala da metragem — duas casas decimais, o `2` de `numeric(10,2)` (§7.2).
 *
 * ---------------------------------------------------------------------------
 * Por que a escala precisa de restrição própria, se o teto já existe
 * ---------------------------------------------------------------------------
 *
 * `numeric(10,2)` declara **precisão e escala**, e {@link MAIOR_METRAGEM} só fecha a primeira.
 * Enquanto a segunda ficou aberta, `25.555` era aprovado pelo contrato, gravado como `25.56` e
 * devolvido ao cliente **diferente do que ele enviou** — sem erro, sem aviso, sem nada que
 * acusasse. Não é o mesmo defeito do teto (aquele estourava o `INSERT` e virava `500`); é o defeito
 * gêmeo e mais silencioso: o valor cabe na coluna e **muda de valor ao entrar nela**.
 *
 * A regra que a ADR-0016 implica é a mesma nos dois casos: todo valor que o contrato aprova tem de
 * ser representável a jusante — e "representável" inclui *representável sem ser alterado*.
 *
 * ---------------------------------------------------------------------------
 * A classe fica fechada, e a enumeração é verificável
 * ---------------------------------------------------------------------------
 *
 * `metragem` é a **única** grandeza decimal de ENTRADA do pacote: toda outra entrada numérica é
 * inteira (`limite` e `deslocamento`, ambos `.int()`). O comando abaixo é a enumeração, e é ele que
 * denuncia a próxima decimal que nascer sem escala declarada:
 *
 * ```bash
 * grep -rn "z\.number()\|z\.coerce\.number()" packages/contracts/src/   # decimal ⇒ precisa de escala
 * ```
 *
 * As ocorrências de SAÍDA (`esquemaDoComodo.metragem`, `esquemaDoImovel.metragemTotal`) ficam de
 * fora, e o marcador logo abaixo carrega o motivo. Ele merece leitura antes de qualquer tentativa de
 * simetrizar entrada e saída: **a justificativa que estava escrita aqui até 2026-08-05 era falsa** —
 * dizia que restringir a saída "faria o contrato recusar o dado do próprio banco", e a medição a
 * derrubou (os 200.001 valores que uma coluna `numeric(10,2)` devolve entre `0.00` e `2000.00`
 * passam em `multipleOf(0.01)` sem uma recusa sequer). A decisão estava certa pelo motivo errado, o
 * que é a matéria-prima da regressão de decisão: quem verificasse a justificativa a acharia
 * infundada e concluiria que a exclusão foi excesso de cautela.
 *
 * ---------------------------------------------------------------------------
 * O resíduo conhecido do mecanismo — visto, medido e MANTIDO
 * ---------------------------------------------------------------------------
 *
 * O resto seguro para decimal do zod aceita `0.30000000000000004` (o que `0.1 + 0.2` produz), que a
 * coluna grava como `0.30`. É a **mesma** tolerância que faz `0.29` e `8.11` passarem — qualquer
 * mecanismo estrito o bastante para recusar aquele recusaria estes, e recusar metragem legítima é o
 * defeito pior. A diferença é de `4e-17`, contra os `0.005` que motivaram esta restrição. Não é
 * descuido a apertar numa rodada futura: é o ponto de operação escolhido.
 *
 * `0.29 + 0.07 + 8.11 = 8.469999999999999` cai **deste** lado — medido, é **aceito**. Ele está aqui
 * porque é uma boa ilustração da tolerância, e porque já esteve escrito no lugar errado: serviu de
 * exemplo da razão (2) do marcador abaixo até 2026-08-05, onde ilustrava uma recusa que ele não
 * produz. Nem toda soma de duas casas que "parece quebrada" é recusada — e é por isso que o exemplo
 * de lá precisa ser medido, não estimado pela aparência do número.
 */
// DECISÃO FECHADA — T1 / Gate 2 · 2026-08-05
// O QUÊ: a restrição de escala vale para os esquemas de ENTRADA e NÃO é replicada nos de SAÍDA
//        (`esquemaDoComodo.metragem`, `esquemaDoImovel.metragemTotal`). A assimetria é deliberada.
// POR QUÊ: por duas razões medidas, e nenhuma delas é "a coluna já garante".
//          (1) Esquema de saída que recusa **não produz `422`** — ele levanta na serialização e
//              derruba a rota. Restringir a saída converte divergência benigna a montante em queda,
//              e divergência a montante se corrige a montante, não se barra aqui.
//          (2) `metragemTotal` **não é coluna**: é soma derivada na leitura (tech spec §6.2), e a
//              acumulação em ponto flutuante sai da escala em cerca de 1% dos casos — 2.230 de
//              200.000 amostras numa medição, 3.475 de 300.000 noutra, independente. O menor caso
//              conhecido, achado por busca exaustiva e MEDIDO contra este esquema:
//              `0.01 + 2.01 = 2.0199999999999996`, **recusado**. Com escala de domínio:
//              `128.42 + 97.05 + 11.76 + 122.33 + 39.69 + 72.05 + 46.31 = 517.6099999999999`,
//              também recusado. Meça qualquer substituto antes de trocá-lo: a aparência do número
//              não diz de que lado ele cai — ver o parágrafo do resíduo, logo acima.
// REVERTER EXIGE: provar as DUAS coisas. Primeira, que a recusa de um esquema de saída tem caminho
//                 que a converta em resposta de erro deliberada em vez de exceção de serialização.
//                 Segunda, que `metragemTotal` deixou de ser soma de ponto flutuante — somada em
//                 decimal exato, ou lida de coluna com escala própria. Enquanto a soma for float, a
//                 restrição na saída derruba cerca de uma em cada noventa leituras de imóvel com
//                 vários cômodos.
export const ESCALA_DA_METRAGEM = 0.01;

/**
 * Os sete campos de endereço, iguais para imóvel e para pessoa.
 *
 * É uma **função** que devolve a forma, e não uma constante compartilhada, porque o objeto de forma
 * do Zod é consumido por composição (`z.strictObject({ ...camposDeEndereco(), … })`) e uma única
 * instância partilhada entre dois esquemas os deixaria acoplados a qualquer emenda futura de um
 * deles.
 *
 * Existe pelo motivo que a ADR-0016 nomeia: as duas entidades guardam o **mesmo** endereço, e
 * declará-lo duas vezes criaria duas fontes do mesmo fato, livres para divergir no dia em que uma
 * das duas ganhar um campo. Não é exportado pelo `index.ts` — é composição interna do contrato, e
 * não superfície que o consumidor precise conhecer.
 *
 * `complemento` é o único que aceita `null`, e é **obrigatório** como todos os outros: esta fatia
 * não tem atualização parcial, e campo ausente num `PUT` é recusa por campo obrigatório, nunca
 * "preserve o que estava lá" (§4.1.1).
 */
export function camposDeEndereco() {
  return {
    logradouro: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
    numero: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
    complemento: z.string().trim().max(MAIOR_TEXTO_CURTO).nullable(),
    bairro: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
    cidade: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
    // A unidade federativa tem duas letras e é canonizada em MAIÚSCULAS **aqui**, que é o ponto
    // único do endereço — esta função. A caixa importa porque `estado` é campo de filtro e de
    // comparação, e `"sp"` guardado ao lado de `"SP"` são duas unidades federativas diferentes para
    // qualquer igualdade de string. A união fechada das 27 UFs seria mais forte ainda, e fica como
    // débito: o TECH_SPEC não a declara, e inventá-la aqui seria decisão de domínio sem fonte.
    estado: z.string().trim().toUpperCase().pipe(z.string().length(2)),
    // A máscara é **removida**, e não recusada — mesmo tratamento de `documentoPrincipal` vinte
    // linhas adiante, e pela mesma razão: a máscara é assunto do cliente e o contrato fala o dado.
    // Recusá-la tinha um consumidor concreto contra: o autocompletar por ViaCEP, que o
    // `levantamento-frontend.md` §2.10 declara **não afetado pela migração**, devolve o CEP
    // mascarado (`"01001-000"`) — e o formulário preenchido por ele seria recusado com `422` sobre
    // um CEP válido. A coluna guarda os oito dígitos (§4.1.1: `"cep": "01000000"`).
    cep: z
      .string()
      .trim()
      .transform((valor) => valor.replace(/\D/g, ''))
      .pipe(z.string().regex(/^\d{8}$/)),
  };
}
