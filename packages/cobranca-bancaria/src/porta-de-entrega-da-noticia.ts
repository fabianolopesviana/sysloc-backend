/**
 * A porta de **entrega da notícia do provedor** — declarada pelo domínio, satisfeita pelo adaptador.
 *
 * ===========================================================================
 * A direção da dependência parece invertida, e é ela que está certa (ADR-0025)
 * ===========================================================================
 *
 * Quem declara a interface e os tipos que a atravessam é este pacote; é o adaptador do provedor que
 * **importa daqui** para dizer que a satisfaz, e é a borda que escolhe qual implementação injetar. A
 * porta chega a quem a usa **por parâmetro**, nunca por import de módulo concreto. É o que torna
 * literalmente verdadeira a frase *"o domínio não conhece o provedor"*, em vez de meia-verdade, e o
 * que faz trocar de banco não tocar uma linha deste arquivo.
 *
 * ===========================================================================
 * Porta IRMÃ de configuração — as três condições cumulativas da ADR-0001
 * ===========================================================================
 *
 * A emenda de 2026-08-15 admite porta irmã quando as três valem, e as três valem aqui:
 *
 * 1. **Ela não exerce nenhuma das cinco capacidades** que a ADR-0001 nomeia — `obter_token`,
 *    `emitir`, `solicitar_baixa`, `confirmar_baixa` e `consultar` **de título**. Cadastrar a entrega
 *    da notícia e consultar o estado dela não é nenhuma delas: não emite, não baixa, não consulta
 *    título e não toca cobrança alguma.
 * 2. **O consumidor está nomeado e vive fora do núcleo** — o Admin, na área de integrações. É ato de
 *    **configuração**, e não operação de cobrança, que é o sujeito da cláusula do *"apenas"*.
 * 3. **Ela está sujeita na íntegra à cláusula de fecho** — *"nenhum campo, URL ou vocabulário
 *    específico de provedor cruza a porta"*. Ser irmã não isenta dessa cláusula; isenta apenas do
 *    roster de cinco. E aqui ela é **exigível por varredura**, não por boa-fé: o `CT-1032` lê o texto
 *    deste fonte e reprova nomeando o termo e o portador.
 *
 * O precedente literal é `./porta-de-identidade.ts`, que a fatia (i) declarou pelo mesmo caminho e
 * cujo cabeçalho registra a leitura por extenso.
 *
 * ⚠️ **O nome que a ADR-0001 reserva para a porta das operações de cobrança continua nomeando
 * exatamente aquela porta** (`./porta-de-cobranca.ts`, quatro operações). Esta recebe nome próprio, e
 * nenhum símbolo deste módulo o usa — o bloco do `CT-834` varre os fontes deste pacote e reprova
 * nomeando o ofensor.
 *
 * ===========================================================================
 * QUATRO operações, e a segunda é a que DECIDE
 * ===========================================================================
 *
 * `cadastrarEntrega` pede a vaga; `consultarEntrega` lê o estado junto ao provedor, e é ela que
 * decide. A partição não é simetria decorativa: um cadastro recusado *porque a vaga já está ocupada*
 * convive com uma consulta positiva, e nesse caso a entrega **está habilitada** (RN-05) — sem a
 * segunda operação, o produto desabilitaria uma entrega que funciona. *"Habilitada"* exige as duas
 * positivas (RN-01), e é a consulta que prevalece.
 *
 * ⚠️ **Não existe `desabilitarEntrega`, e a ausência é registro — não omissão.** O produto não modela
 * o que não decidiu cumprir: declarar uma terceira assinatura sem quem a implemente publicaria uma
 * promessa que nenhuma chamada cumpre. Pelo mesmo critério, nada aqui altera, substitui ou remove
 * cadastro de terceiro — o produto cadastra **o seu** e o lê.
 *
 * 🛑 **A JUSTIFICATIVA ANTERIOR ERA FALSA, e a correção é de 2026-08-22 (`A1`).** Este parágrafo
 * afirmava, por extenso, que *"o provedor não oferece a operação"*. **Ele oferece.** A documentação
 * oficial declara `PATCH /webhooks/{idWebhook}`, `PATCH /webhooks/{idWebhook}/reativar`, `DELETE` e
 * `/solicitacoes` — e a lista já estava no repositório desde o commit inicial
 * (`.claude/plans/plano-saas.md`, *"Gestão do webhook: `POST/GET/PATCH/DELETE /webhooks`,
 * `/reativar` e `/solicitacoes`"*). A premissa foi escrita **contra informação disponível**.
 *
 * É o corolário que o `CLAUDE.md` registra como precedente de método: *a frase que explica por que
 * algo não pode ser feito envelhece mais rápido que o débito que ela justifica — meça a premissa
 * antes de registrá-la.* Premissa falsa em docblock de porta é **regressão de decisão (R3) latente**:
 * ela não quebra nada hoje, e garante que o próximo agente que precisar de `PATCH` leia *"o provedor
 * não oferece"* e desista.
 *
 * ⚠️ **O que a metade preservada continua protegendo é REAL**: não tocar cadastro de terceiro. Essa
 * cláusula não caiu com a premissa, e a documentação a **reforça** — `PATCH` e `/reativar` sobre
 * webhook alheio seriam interferência na conta do cliente.
 *
 * ⚠️ **E a terceira e a quarta operações NÃO foram declaradas aqui**, embora a análise as tenha
 * pedido: implementá-las exige um desfecho **ternário** na consulta (*habilitada · em validação ·
 * desabilitada*), e o terceiro estado não cabe nem no contrato publicado — `habilitada` é `boolean`,
 * e `ESTADOS_DA_ENTREGA` tem dois valores — nem na tabela, cuja `CHECK` de coerência da migração
 * `0023` **exige** motivo quando a entrega não está habilitada e já foi verificada. As duas coisas
 * são decisão do usuário: mudança de contrato publicado e migração de schema.
 *
 * ✅ **AS DUAS OPERAÇÕES QUE FALTAVAM FORAM DECLARADAS em 2026-08-22** (`D42`), com as duas
 * autorizações que elas exigiam: a **mudança do contrato publicado** (o estado da entrega passou a
 * ser ternário na superfície) e a **migração `0025`** (que instala `situacao` e a referência do
 * cadastro, e reescreve a `CHECK` que tornava o terceiro estado irrepresentável).
 *
 * ⚠️ **Nenhuma rota nasceu.** As quatro operações são mecanismo **interno** da ativação: a tela
 * continua com **um** ato — habilitar — e as **duas** rotas que já existiam. O frontend não sabe que
 * `atualizarEnderecoDaEntrega` e `reativarEntrega` existem, e não deve saber.
 *
 * ⚠️ **A cláusula do cadastro de terceiro virou EXIGÊNCIA DE TIPO, e não mais advertência em prosa.**
 * As duas operações de correção exigem {@link ReferenciaDoCadastroDaEntrega}, e a única forma de
 * obtê-la é uma leitura que **provou** que o cadastro é nosso — `INATIVA` e `ENDERECO_DIVERGENTE` a
 * carregam; `DE_TERCEIRO` deliberadamente **não**. Não há como chamá-las sobre cadastro alheio sem
 * inventar um valor, e é o compilador que o diz. */

import type {
  EntregaParaCadastrar,
  LeituraDaEntrega,
  ReferenciaDoCadastroDaEntrega,
  ResultadoDaOperacaoDeEntrega,
} from './modelo-canonico.js';

/**
 * A porta de entrega da notícia — a única forma de o domínio configurar, junto ao provedor, o canal
 * por onde a notícia chega.
 *
 * As **duas** operações **resolvem** em todos os desfechos e nunca rejeitam: recusa pelo par,
 * indisponibilidade e tempo esgotado são respostas à pergunta do Admin, cada uma distinguida pelo
 * desfecho canônico e pelo motivo que o acompanha. Levantar seria a alternativa idiomática e foi
 * descartada por razão concreta: a borda traduziria a exceção em `500`, e o Admin leria *"o sistema
 * falhou"* onde o fato é *"a vaga está ocupada"* — dois desfechos operacionais opostos (RN-06).
 *
 * Nada de transporte atravessa estas assinaturas: nem endereço, nem teto de tempo, nem cabeçalho, nem
 * credencial de habilitação. Endereço e teto são propriedade de quem constrói o adaptador; o segredo
 * chega opaco (ADR-0032), e só o adaptador o abre.
 */
export interface PortaDeEntregaDaNoticia {
  /** Pede a vaga junto ao provedor. Recusa é desfecho, e o motivo dela vem preservado íntegro. */
  cadastrarEntrega(entrega: EntregaParaCadastrar): Promise<ResultadoDaOperacaoDeEntrega>;
  /**
   * Lê o estado junto ao provedor — é ela que **confirma**, e é ela que prevalece (RN-05).
   *
   * Devolve {@link LeituraDaEntrega}, e não um booleano: as sete situações que ela distingue pedem
   * **atos distintos**, e é ela quem decide qual. Ver o docblock daquele tipo.
   */
  consultarEntrega(
    entrega: EntregaParaCadastrar,
    /**
     * A referência ao cadastro que **este produto** criou antes, se houver.
     *
     * Ela é o que permite distinguir *"o meu cadastro, com o endereço antigo"* de *"o cadastro de
     * outro sistema"* — os dois apontam para URL diferente da atual, e só um deles pode ser
     * corrigido. Sem ela, a leitura de um cadastro alheio é `DE_TERCEIRO`, que é o conservador.
     */
    referenciaConhecida?: ReferenciaDoCadastroDaEntrega,
  ): Promise<LeituraDaEntrega>;
  /**
   * Corrige o endereço de um cadastro **que é nosso** — a saída do impasse do endereço trocado.
   *
   * Sem ela, um endereço que mudou produz um beco sem saída: a vaga fica ocupada pelo cadastro
   * antigo, o cadastro novo é recusado, a consulta não confirma, e o Admin clica em ativar para
   * sempre. O único caminho de saída seria o portal do provedor — fora do sistema, que é exatamente
   * o que esta fatia existe para eliminar.
   *
   * ⚠️ A referência é **obrigatória**, e é o que impede a chamada sobre cadastro de terceiro.
   */
  atualizarEnderecoDaEntrega(
    entrega: EntregaParaCadastrar,
    referencia: ReferenciaDoCadastroDaEntrega,
  ): Promise<ResultadoDaOperacaoDeEntrega>;
  /**
   * Reativa um cadastro **nosso** que o provedor inativou — o caminho de volta do estado morto.
   *
   * ⚠️ Ela é **dedicada**, e não um caso da correção de endereço: o provedor oferece as duas
   * separadamente, e um produto que só soubesse corrigir endereço continuaria sem saída quando a
   * inativação viesse por falha de entrega — que é o cenário mais provável de todos, porque é o que
   * acontece quando o endereço fica fora do ar.
   */
  reativarEntrega(
    entrega: EntregaParaCadastrar,
    referencia: ReferenciaDoCadastroDaEntrega,
  ): Promise<ResultadoDaOperacaoDeEntrega>;
}
