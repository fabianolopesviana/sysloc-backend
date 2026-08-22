# QA Context — `integracao-bancaria-autonoma` (v1) · variante **backend**

> Condensado do `tech_spec.md` para consumo dos subagentes de geração de casos.
> **Os 33 CTs já EXISTEM e estão numerados** (`CT-1014`..`CT-1046`). Esta etapa **detalha** os casos
> existentes; **não** cria IDs novos e **não** remapeia CA.

## Stack de teste (medida no repositório)

- **Vitest** + `embedded-postgres` (Postgres real e efêmero). Sem Jest, sem mocks de banco.
- Convenção de rastreabilidade obrigatória: `CA-xx → CT-xxx (RN-xx)`, com seção **INVARIANTES** por arquivo.
- Nome de arquivo: `<alvo>.spec.ts` (unit/integração) e `<alvo>.e2e.spec.ts` (borda), ao lado em `test/`.
- Caso: `describe('<tema> (T<n>)', ...)` + `it('<invariante em pt-BR>', ...)`.
- **Acessório de suíte se importa, não se copia**: `apps/api/test/acessorios-de-borda.ts` publica
  `pedir`, `pedirBytes`, `entrar`, `conceder`, `credencialDeSessao`;
  `packages/db/test/banco-efemero.ts` abre a instância; `packages/db/test/conjuntos.ts` e
  `packages/cobranca-bancaria/test/conjuntos.ts` publicam `diferencasDeConjunto`;
  `packages/cobranca-bancaria/test/material-de-teste.ts` publica `gerarMaterialDeTeste`,
  `gerarAutoridadeDeTeste`, `gerarParDeServidorDeTeste` (tudo gerado em execução por `openssl`);
  `apps/worker/test/varredura-de-segredo.ts` publica o molde de varredura com controle positivo.
- **Nenhum material de certificado versionado** — tudo gerado em execução, em diretório temporário
  próprio, apagado ao fim.
- **Asserção estática exige prova de falsificação** e ela roda pelo **script `test` do pacote**
  (`pnpm --filter @sysloc/<p> test`), nunca por invocação avulsa do executor — sete dos nove pacotes
  resolvem `.` para a saída de build.
- **Baseline por pacote (2026-08-20)**: `api` 354 · `contracts` 399 · `db` 233 · `worker` 126 ·
  `cobranca-bancaria` 93 · `shared` 254 · `documentos` 159 · `auth` 89 · `regua` 30.

## Componentes (camada → responsabilidade)

| Componente | Camada | Responsabilidade |
|---|---|---|
| Conversão do material (`packages/cobranca-bancaria/src/conversao-do-material.ts`, **criar**) | domínio | converter material que o runtime não abre, por processo externo de vida curta; classificar a causa da falha |
| Porta de entrega da notícia (`packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts`, **criar**) | domínio (porta) | declarar `cadastrarEntrega` e `consultarEntrega` — e **só** essas duas |
| Adaptador do provedor (`packages/cobranca-bancaria/src/adaptador-sicoob.ts`, modificar) | adaptador | satisfazer a porta nova; escopo **por família de operação**; traduzir o dialeto na fronteira |
| Cache de credenciais (`packages/cobranca-bancaria/src/credencial-de-acesso.ts`, modificar) | adaptador | reter credencial viva por **(empresa, família de escopo)** |
| Estado da entrega (`packages/db/src/entrega-da-noticia.ts`, **criar**) | dados | ler/gravar o estado por empresa; **nenhuma** comparação de empresa em aplicação |
| Serviço da entrega (`apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts`, **criar**) | aplicação | ciclo cadastrar→confirmar; compor a projeção a partir das colunas |
| Controlador da entrega (`apps/api/src/integracoes-bancarias/entrega-da-noticia.controller.ts`, **criar**) | borda | as duas rotas, com a conjunção de exigências |
| Serviço do certificado (`apps/api/src/integracoes-bancarias/certificado.service.ts`, modificar) | aplicação | converter quando necessário; distinguir as três causas; enfileirar a reconferência |
| Tarefa de reconferência (`apps/worker/src/tarefas/reconferencia-da-entrega.ts`, **criar**) | trabalho | reconsultar o estado fora da requisição, sob contexto de tenant da carga |
| Verificador do provisionamento (`deploy/scripts/instalacao/verificar-provisionamento.sh`, modificar) | infra (shell) | afirmar a pré-condição de ambiente que a conversão exige |

## Fluxos técnicos

**Ativação (`POST /v1/integracoes-bancarias/entrega-da-noticia/ativacao`, `200`, corpo vazio)**
1. Controlador declara `AREA_DAS_INTEGRACOES_BANCARIAS` **+** `ACAO_DE_CONFIGURACAO` e abre a unidade de trabalho.
2. **Dentro da transação, curto**: lê as **duas** pré-condições — envelope cifrado do certificado vigente e identidade pronta. Ausência → recusa **ali**. São **TRÊS** recusas distintas (certificado ausente · certificado com validade encerrada · identidade ausente), na forma do precedente de `exigirCertificadoVigente`/`exigirIdentidadeVigente` de `apps/api/src/cobrancas/boleto.service.ts`: `CAMPO_INVALIDO` com `detalhes` discriminante e **sem `campo`**. **Não é `404`.**
3. **Fora de transação**: cadastrar no provedor → consultar para confirmar (credencial da família de entrega).
4. **Habilitada** só com os **dois** positivos. Cadastro recusado por vaga já ocupada + consulta positiva ⟹ **habilitada** (a consulta prevalece).
5. **Segunda transação**: grava o estado, substituindo o desfecho anterior.
6. Projeção composta **a partir das colunas**, nunca do que veio do provedor.

**Consulta (`GET /v1/integracoes-bancarias/entrega-da-noticia`, `200`)** — lê a linha persistida. **Não fala com o provedor.**

**Conversão do material (no registro do certificado)**
1. Tenta abrir como está. Abriu → nada a converter.
2. Não abriu por cifra não suportada → converte: decodifica lendo de **entrada padrão**; o intermediário em claro vai para **memória compartilhada** com permissão restrita; reexporta lendo o intermediário **de arquivo** (exigência *seekable*, medida) e escrevendo em **saída padrão**, com **a mesma senha**; remove o intermediário em **todo** desfecho, inclusive erro e sinal.
3. Abre o convertido e confere a identidade: **titular, número de série e validade idênticos** aos do recebido. Divergência é recusa.
4. O que se cifra e guarda é o **convertido**.

**Classificação da causa** — leitura direta falha com o sinal da **biblioteca** (`mac verify failure`) ⟹ senha; conversão falha e a saída casa o radical **`mac verify`** ⟹ senha (o executável diz `Mac verify error: invalid password?`); conversão falha sem casar o radical ⟹ formato; material abre mas validade terminou ⟹ validade encerrada. ⚠️ **Importar `SINAL_DE_SENHA_QUE_NAO_ABRE` de `leitura-do-material.ts` para o conversor faria o ramo da senha nunca disparar.** Degradação declarada: sinal que deixe de casar cai no desfecho **mais genérico** (formato).

**Reconferência** — enfileirada pela borda após o registro do certificado, com `empresaId` **na carga** (ADR-0024, emenda de 2026-08-18: quem enfileirou já detinha direito a ele). Melhor-esforço: falha **não** propaga ao registro.

## Invariantes não negociáveis que os casos precisam respeitar

- **Multi-tenancy é do banco**: `empresa_id NOT NULL`, RLS **habilitada e forçada** (`USING` + `WITH CHECK`), FK **composta** `(id, empresa_id)`. `SELECT` cruzado devolve zero; `INSERT` cruzado sai `42501`.
- **Contexto de tenant nunca vem do request**: `AsyncLocalStorage` + `SET LOCAL app.empresa_id`.
- **Segredo não retorna por superfície alguma** — corpo, cabeçalho, diário, documento publicado, `spawnargs` e o **objeto de erro cru** do processo externo. Ausência afirmada por **medição da saída real**, com **controle positivo** (agulhas plantadas canal a canal, lista afirmada por igualdade).
- **Superfície publicada é afirmada por igualdade de conjunto**, com controle antivácuo, e a âncora sobe no **mesmo diff** da publicação.
- **Contrato publicado**: entrada `z.strictObject` (recusa afirmada por `code` **e** lista `keys`), saída `z.object` (recusa por valor afirmada pelo `path` do campo).
- **Relógio é o do banco** — o instante da verificação nasce do banco; nenhum `new Date()` decide comportamento.
- **A senha nunca aparece em `argv` nem em ambiente** — descritor de arquivo.

## Critérios de aceite (CA-01 a CA-21)

- **CA-01** empresa com certificado válido → cadastra, confirma por consulta, apresenta **Habilitada**.
- **CA-02** duas empresas ativam **independentemente**; nenhuma enxerga estado nem motivo da outra.
- **CA-03** consulta informa habilitada/desabilitada e, quando desabilitada, o **motivo completo da última tentativa**.
- **CA-04** o motivo é **íntegro** — mensagem, código e todos os campos que o provedor devolveu —, sem interpretação, tradução ou resumo.
- **CA-05** nova tentativa percorre o mesmo ciclo e o desfecho novo **substitui** o anterior, sem estado preso.
- **CA-06** com a entrega desabilitada, a conferência periódica continua **liquidando e estornando**; o estado é declarado, não omitido.
- **CA-07** vaga ocupada por **sistema de terceiro**: nada daquele cadastro é alterado, desativado ou substituído; recusa informada.
- **CA-08** sem a permissão de configurar a integração bancária, as duas rotas recusam.
- **CA-09** material **no formato em que a AC o entrega** é aceito, com **titular, número de série e validade idênticos**.
- **CA-10** formato que não abre nem converte → recusa nomeia **o formato**, e **não** a senha.
- **CA-11** senha incorreta → recusa nomeia **a senha**, com desfecho **distinto** do de formato.
- **CA-12** validade já encerrada → recusa nomeia **a validade**, distinta das outras duas.
- **CA-13** material que **precisou ser convertido** → a resposta **informa** a conversão.
- **CA-14** material que o produto já abre → **nenhuma conversão** e a resposta **não** informa conversão.
- **CA-15** registro bem-sucedido **reconfere** o estado; reconferência que falha **não** derruba o registro, e o motivo fica registrado.
- **CA-16** em nenhum desfecho do registro ou da habilitação aparecem material ou senha **na saída real**.
- **CA-17** habilitação e recusa constam como **efeito registrado**; reconsulta que nada muda **não** cria registro novo.
- **CA-18** o contrato publicado carrega as duas operações com corpo e resposta completos, o objeto de motivo, e a superfície é declarada.
- **CA-19** empresa que **nunca tentou**: desabilitada, com o discriminador de *"ainda não houve tentativa"*, sem motivo.
- **CA-20** cliente novo se conclui **inteiramente pela tela** — nenhuma etapa exige acesso ao servidor.
- **CA-21** ambiente sem o recurso de conversão → a verificação de provisionamento **reprova nomeando o recurso ausente**.

## Mapa CA → CT (fixado no tech spec §19.5 — não alterar)

| CA | CT | CA | CT |
|---|---|---|---|
| CA-01 | CT-1025, CT-1026, CT-1043, CT-1046 | CA-12 | CT-1021 |
| CA-02 | CT-1027, CT-1028 | CA-13 | CT-1018, CT-1023 |
| CA-03 | CT-1025, CT-1026, CT-1029 | CA-14 | CT-1018, CT-1023 |
| CA-04 | CT-1026, CT-1028, CT-1030, CT-1031, CT-1033 | CA-15 | CT-1039, CT-1040 |
| CA-05 | CT-1034, CT-1035 | CA-16 | CT-1015, CT-1016, CT-1017, CT-1019, CT-1024 |
| CA-06 | CT-1042 | CA-17 | CT-1041 |
| CA-07 | CT-1036 | CA-18 | CT-1024, CT-1032, CT-1033, CT-1038, CT-1044 |
| CA-08 | CT-1037 | CA-19 | CT-1029 |
| CA-09 | CT-1014, CT-1020, CT-1046 | CA-20 | CT-1020, CT-1046 |
| CA-10 | CT-1015, CT-1021, CT-1022 | CA-21 | CT-1045 |
| CA-11 | CT-1015, CT-1021, CT-1022 | | |

## Os 33 casos — ID, invariante fixado, camada, CA (detalhar, não reinventar)

### Unitários (2)
- **CT-1032** — nenhum termo do dialeto do provedor em **posição de símbolo publicado** nos módulos novos; a porta declara **exatamente duas** operações; a varredura, aplicada a um fonte de controle com os termos plantados, os encontra todos · domínio · CA-18
- **CT-1044** — entrada **fechada** recusa chave desconhecida, saída **aberta** a aceita; enum de estados congelado e ordenado; o portador do motivo é **opaco** e não nomeia chave alguma do provedor · contrato · CA-18

> As duas são **estáticas** e exigem prova de falsificação, rodada pelo script `test` do pacote.

### Integração (11)
- **CT-1014** — a conversão preserva a identidade: a tripla é idêntica à do **mesmo** certificado em cifra moderna, com a impressão digital como discriminador · conversão · CA-09
- **CT-1015** — senha e formato produzem `motivo` **distintos**; nada da saída do conversor atravessa a fronteira · conversão · CA-10, CA-11, CA-16
- **CT-1016** — o único artefato em claro é removido em **todo** desfecho — sucesso e os **dois** caminhos de erro · conversão · CA-16
- **CT-1017** — o artefato nasce com permissão restrita, **mesmo com a máscara do processo aberta** · conversão · CA-16
- **CT-1018** — a conversão só corre quando o runtime não abre; o desfecho declara qual caminho correu · conversão · CA-13, CA-14
- **CT-1027** — a relação nova tem RLS **forçada**, política única, restrição única e FK **composta**; o `SELECT` cruzado devolve zero e o `INSERT` cruzado sai `42501` · persistência · CA-02
- **CT-1038** — as três âncoras da superfície vão a **105 / 90 / 20**, por igualdade de conjunto e duas medições independentes · borda · CA-18
- **CT-1040** — a reconferência atualiza a linha; **quando falha, a linha permanece idêntica campo a campo** · trabalho · CA-15
- **CT-1042** — com a entrega **desabilitada**, a conferência liquida e estorna igual — as duas execuções são idênticas · trabalho · CA-06
- **CT-1043** — duas famílias de escopo obtêm **duas** credenciais; duas operações da **mesma** família obtêm **uma** · adaptador · CA-01
- **CT-1045** — a verificação de provisionamento **reprova nomeando o recurso ausente**; controle e mutante com desfechos opostos · shell · CA-21

### E2E (15)
- **CT-1020** — a **rota** aceita material em cifra legada gerado em execução, e a identidade registrada é idêntica — **o caso que fecha o `D64`** · borda · CA-09, CA-20
- **CT-1021** — as **três** causas produzem três códigos distintos — `Set` de tamanho 3, mais os três envelopes por igualdade · borda · CA-10, CA-11, CA-12
- **CT-1022** — senha errada sobre material **legado** nomeia a senha, não o formato · borda · CA-10, CA-11
- **CT-1023** — a resposta declara a conversão como booleano fechado nos **dois** sentidos · borda · CA-13, CA-14
- **CT-1025** — habilitada **só** com os dois positivos; e **com o par derrubado a consulta ainda responde** — prova que ela não fala com o provedor · borda · CA-01, CA-03
- **CT-1026** — um positivo só não basta; na recusa do cadastro a confirmação **não chega a ser alcançada** (contador por igualdade) · borda · CA-01, CA-03, CA-04
- **CT-1029** — a consulta responde nos **três** estados, com o discriminador de *"nunca houve tentativa"* · borda · CA-03, CA-19
- **CT-1030** — o motivo é **igual por igualdade profunda** ao corpo que o provedor devolveu; conjunto de chaves coincide · borda · CA-04
- **CT-1031** — quatro motivos **degenerados** produzem status, estado e forma de corpo idênticos — **o motivo não decide nada** · borda · CA-04
- **CT-1034** — o desfecho novo **substitui** o anterior; o motivo antigo some do corpo, por varredura com controle · borda · CA-05
- **CT-1035** — cadastro recusado por **já existir** + consulta positiva ⟹ **habilitada** · borda · CA-05
- **CT-1036** — vaga de **terceiro**: recusa informada, e **zero** chamadas mutantes ao par · borda · CA-07
- **CT-1039** — o registro **enfileira** e degrada; e o provedor recebe **zero** chamadas durante a requisição · borda · CA-15
- **CT-1041** — cinco reconsultas deixam a linha **idêntica, inclusive o instante**; nenhuma linha nova em vaso algum · borda · CA-17
- **CT-1046** — o percurso do cliente novo se conclui **inteiramente pela tela** · percurso · CA-20, CA-09, CA-01

### Segurança (5)
- **CT-1019** — a superfície **nova** do processo externo não carrega material nem senha — inclusive `spawnargs` e o objeto de erro **cru** · conversão · CA-16
- **CT-1024** — nenhum dos **seis** desfechos das rotas tocadas carrega segredo — corpo, cabeçalho, diário e documento publicado · borda · CA-16, CA-18
- **CT-1028** — duas empresas ativam independentemente; o motivo de uma **não aparece** em resposta alguma da outra · borda · CA-02, CA-04
- **CT-1033** — na **saída real**, o dialeto do provedor aparece **exclusivamente** dentro do portador — varrido com e sem ele · borda · CA-04, CA-18
- **CT-1037** — as duas rotas exigem a permissão **que já existe**; sem ela, envelope de recusa e **zero** efeito; catálogo **inalterado** · borda · CA-08

> **Todo caso de varredura tem controle positivo obrigatório** — o mesmo objeto de função aplicado ao
> alvo e a um controle com as agulhas plantadas canal a canal, com a lista afirmada por **igualdade**.

## Obrigações de antirregressão que a suíte carrega

1. **O `CT-1021` é a REESCRITA** do caso que hoje afirma a mensagem única em
   `apps/api/test/certificado-do-provedor.e2e.spec.ts:451` — nunca um caso novo ao lado dele. O bloco
   permanece no lugar, título e corpo reescritos; a contagem do pacote `api` **não cai**.
2. O docblock que declara a fusão das duas causas em `certificado.service.ts` é **SUBSTITUÍDO**.
3. O marcador do `D64` sai no **mesmo commit** da correção, com a linha dele no índice do `CLAUDE.md`.
4. **Baseline por pacote**, antes e depois.
5. **Nenhum material de certificado na árvore versionada.**

## Atritos declarados (respeitar, não "resolver")

| # | O quê | Conduta |
|---|---|---|
| A1 | **`CT-1045` exige privilégio** (`sudo` interativo) — inexecutável por subagente | execução conduzida com o operador; o gate **audita a saída preservada**. Alternativa recomendada: acrescentar a asserção ao verificador **irmão que roda sem privilégio**. ⚠️ **Não se admite criar um 12º `verificar-*.sh`** |
| A2 | **`CT-1017` pode ser instável** — a janela é a duração do processo externo | se a sondagem não for determinística, **registrar débito com gatilho** e manter o `CT-1016`. ⚠️ Proibido afrouxar a asserção ou expor o caminho do artefato por símbolo de produção |
| N1 | estouro do teto de tempo do processo externo sem prova | débito com gatilho no módulo — não introduzir símbolo *test-only* na produção |
| N4 | corrida entre duas ativações simultâneas da mesma empresa | fora da política — a última gravação vence |

## Paths relevantes

`packages/cobranca-bancaria/src/{conversao-do-material,porta-de-entrega-da-noticia,adaptador-sicoob,credencial-de-acesso,modelo-canonico,leitura-do-material,index}.ts` ·
`packages/db/migracoes/{0023_dominio_entrega_da_noticia,0024_seguranca_entrega_da_noticia}.sql` ·
`packages/db/src/{entrega-da-noticia,esquema/negocio,index}.ts` ·
`packages/contracts/src/integracao-bancaria.ts` · `packages/shared/src/{erros,fila}.ts` ·
`apps/api/src/integracoes-bancarias/{entrega-da-noticia.controller,entrega-da-noticia.service,certificado.service,certificado.controller,integracoes-bancarias.module}.ts` ·
`apps/api/src/comum/produtor-de-fila.ts` · `apps/worker/src/{fila,main}.ts` ·
`apps/worker/src/tarefas/reconferencia-da-entrega.ts` ·
`deploy/scripts/instalacao/verificar-provisionamento.sh` ·
`apps/api/test/{cobertura-de-autorizacao.e2e,certificado-do-provedor.e2e,segredo-nao-escapa.e2e,vocabulario-na-saida-real.e2e}.spec.ts` ·
`packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` · `apps/worker/test/conferencia-bancaria.spec.ts`
