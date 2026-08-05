# Rule candidates — autorizacao-e-ciclo-de-acesso/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [pre_refinement_decision] Modelo fixo em Opus para todo subagente

**Regra que isto sugere:** todo subagente do framework roda em Opus; Sonnet e Haiku são proibidos, mesmo onde a heurística de `gates`/`model` os resolveria.

**O que ela faria (simples):** hoje a regra vive no `CLAUDE.md` como prosa e cada orquestrador precisa lembrar de sobrescrever a heurística do framework. Como regra, a substituição seria mecânica e não dependeria de leitura atenta.

- Evidência: "Este projeto roda **exclusivamente em Opus** — sessão principal e **todo subagente**, executor e gates inclusive." — `pre-refinement.md:322`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Idioma pt-BR em toda interação, não só na documentação

**Regra que isto sugere:** respostas de terminal, perguntas de `AskUserQuestion`, raciocínio exibido e artefatos são todos em português brasileiro.

**O que ela faria (simples):** sem ela, o agente tende a responder em inglês quando o prompt técnico é em inglês; com ela, o idioma não oscila com a origem do contexto.

- Evidência: "**Todas as respostas e interações em português brasileiro**, não só a documentação." — `pre-refinement.md:323`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Protocolo Antirregressão como pré-condição de toda edição

**Regra que isto sugere:** baseline antes e depois, três linhas de declaração por edição, e nenhuma correção reabre o que já foi fechado.

**O que ela faria (simples):** garante que o ciclo de correção de gate não desfaça, sem perceber, o que a rodada anterior fechou — o modo de falha mais caro medido neste repositório.

- Evidência: "O **Protocolo Antirregressão** é pré-condição de toda edição, com força máxima em ciclo de correção de gate." — `pre-refinement.md:324`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Fronteira de repositório: aqui só se faz backend

**Regra que isto sugere:** task que peça implementação de frontend é gatilho de parada, não trabalho a acomodar.

**O que ela faria (simples):** o fonte React vive noutra máquina; sem a regra, um executor tentaria "adiantar" o cliente e escreveria código sobre arquivos que não pode ler.

- Evidência: "**Aqui só se faz backend** — task que peça implementação de frontend é gatilho de parada." — `pre-refinement.md:325`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Nada da fatia anterior se reabre

**Regra que isto sugere:** schema e RLS, FK composta, `SET LOCAL`, `AsyncLocalStorage`, guarda de cobertura, `better-auth`, barreira de admissão e as recusas indistinguíveis da RN-10 são intocáveis nesta fatia.

**O que ela faria (simples):** delimita o que uma correção pode alcançar — sem isso, um executor "melhora" a fundação enquanto conserta outra coisa, e a fatia provada regride.

- Evidência: "**Nada da fatia 1 se reabre**: schema e RLS, FK composta, `SET LOCAL`, `AsyncLocalStorage`, guarda de cobertura, `better-auth`, barreira de admissão…" — `pre-refinement.md:326`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Direções convergidas são fechadas — explorar o como, nunca o se

**Regra que isto sugere:** as quatro direções (B2, C2, D3+D2, E1) não voltam à mesa; inviabilidade contra o terreno é motivo de parar e escalar, não de escolher outra.

**O que ela faria (simples):** impede que a execução reabra um debate de design já resolvido no pré-refinamento, que é onde o custo de rodada de gate nasce.

- Evidência: "**As quatro direções convergidas pela fatia 1 são fechadas** … Explorar **como**, nunca **se**." — `pre-refinement.md:327`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Perfil é default, ajuste é por usuário

**Regra que isto sugere:** os 3 perfis entregam o conjunto padrão e o ajuste individual opera nos dois sentidos sobre ele — nunca um quarto perfil ad hoc.

**O que ela faria (simples):** sem a regra, a tentação diante de um caso particular é criar perfil novo; com ela, o caso particular vira ajuste e o catálogo de perfis não infla.

- Evidência: "**Decisão 8**: 3 perfis **+ permissões ajustáveis por usuário**." — `pre-refinement.md:328`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Revogação bloqueia na hora, sem apagar nada

**Regra que isto sugere:** retirar acesso mata sessão ativa e para automação imediatamente, e nenhum dado é removido junto.

**O que ela faria (simples):** separa "perder acesso" de "perder dado", que é a confusão que leva um executor a implementar revogação como exclusão.

- Evidência: "**Decisão 11**: revogação bloqueia **na hora** — sessões ativas mortas, automações param, **nada é apagado**." — `pre-refinement.md:329`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Onboarding por senha provisória com troca obrigatória

**Regra que isto sugere:** toda pessoa nasce com senha provisória exibida uma vez, entregue fora de banda, com troca obrigatória no primeiro acesso — vale para o Admin criado pelo Master e para os demais criados pelo Admin.

**O que ela faria (simples):** fixa um único mecanismo de primeiro acesso; sem ela cada rota de criação inventaria o seu (link mágico, senha em e-mail, senha escolhida por quem cria).

- Evidência: "**Decisão 14**: o Admin inicial recebe **senha temporária** do Master, com **troca obrigatória** no primeiro acesso." + "**Decisão 39**: os demais usuários … com a mesma mecânica." — `pre-refinement.md:330-331`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Catálogo de permissão fechado em 10 telas e 7 ações

**Regra que isto sugere:** permissão é por área de tela **mais** ação sensível separada, sobre uma lista fechada de 17 chaves — nada fora do catálogo existe.

**O que ela faria (simples):** torna "acrescentar uma permissão" uma mudança de catálogo deliberada em vez de uma string nova solta num handler.

- Evidência: "**Decisões 15 / 38**: permissão **por tela + ações sensíveis separadas**, com a lista fechada de **10 áreas de tela** e **7 ações sensíveis**." — `pre-refinement.md:332`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] A superfície da API congela no marco de entrega

**Regra que isto sugere:** as rotas criadas nesta fatia são as que o `@sysloc/contracts` publica e o React consome; depois do marco, nenhuma fatia acrescenta, remove ou altera rota do app do cliente.

**O que ela faria (simples):** transforma a forma da rota numa decisão de custo alto no momento em que ela é escrita, em vez de algo a ajustar depois.

- Evidência: "**A superfície da API congela no marco de entrega** … O congelamento alcança o app do cliente, não o domínio `/master`." — `pre-refinement.md:333`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [pre_refinement_decision] Os oito invariantes do CLAUDE.md são vinculantes na execução

**Regra que isto sugere:** multi-tenancy como fundação, contexto nunca lido do request e API em camelCase são invariantes de código, verificáveis no gate — não princípios de documentação.

**O que ela faria (simples):** dá ao gate um critério objetivo para reprovar um filtro por empresa escrito na aplicação, em vez de discutir preferência de estilo.

- Evidência: "**Os 8 invariantes do `CLAUDE.md`**, com destaque para o 1 …, o 2 … e o 6 (a API fala camelCase)." — `pre-refinement.md:334`
- Sinal: `pre_refinement_decision` · Origem: `agent-spec-sdd-run-tasks` · 2026-08-04T14:10:00Z

---

## [repeated_fixture] Acessórios de erro SQL nos testes de dados

**Regra que isto sugere:** centralizar `tentar`/`sqlstate`/`nomeDaRestricao` e o tipo `Resultado<T>` num acessório compartilhado de `packages/db/test/`.

**O que ela faria (simples):** o mesmo bloco de quatro utilitários para capturar e ler erro do driver foi copiado literalmente em dois arquivos de teste do mesmo pacote; uma regra apontando o acessório evita que as cópias divirjam quando o nome do campo do driver mudar num bump.

- Evidência: `tentar`, `sqlstate`, `nomeDaRestricao` e `Resultado<T>` duplicados entre dois arquivos de teste de `@sysloc/db` — `packages/db/test/permissao.spec.ts:102` e `packages/db/test/isolamento.spec.ts:262` — T1 / schema da autorização
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-04T14:55:00Z

---

## [repeated_assertion_shape] Recusa do banco afirmada por código e restrição

**Regra que isto sugere:** toda recusa esperada do banco é afirmada pelo par SQLSTATE + nome literal da restrição, nunca só pelo SQLSTATE.

**O que ela faria (simples):** o mesmo par de asserções aparece em três pontos porque um SQLSTATE sozinho não diz qual restrição falou — as tabelas têm mais de uma que produziria o mesmo código; escrever a convenção evita que o próximo caso prove menos do que parece.

- Evidência: par `expect(x.codigo).toBe('<sqlstate>')` + `expect(x.restricao).toBe(<constante>)` em três casos — `packages/db/test/permissao.spec.ts:254`, `packages/db/test/isolamento.spec.ts:1463` e `:1508` — T1 / CT-206 e CT-207
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-04T14:55:00Z

---

## [scope_deviation] Consumidores de símbolo compartilhado na §5.2

**Regra que isto sugere:** task que cria ou altera valor de vocabulário compartilhado enumera na §5.2 os arquivos que consomem o símbolo, derivados por grep do valor antigo.

**O que ela faria (simples):** a T1 mandou acrescentar um valor ao enum de desfecho e listou só os arquivos de schema e migração; os quatro arquivos que traduzem ou fixam aquele rótulo por literal chegaram ao gate como desvio de escopo, embora sem eles a suíte nem fechasse. A regra faria a spec derivar esses arquivos por busca do valor antigo antes de ser fechada, em vez de o executor descobri-los durante a execução.

- Evidência: quatro arquivos de arrasto obrigatório do rótulo novo do enum tocados fora da §5.2 — `packages/auth/src/autenticacao.ts:294`, `packages/auth/test/admissao.spec.ts:528`, `apps/api/test/recusa-indistinguivel.e2e.spec.ts:515`, `packages/db/test/unidade-de-trabalho.spec.ts:284` — T1 / migrações 0003-0004 e schema da autorização
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-04T15:40:00Z

---

## [repeated_assertion_shape] Igualdade de conjunto afirmada por `diferencasDeConjunto`

**Regra que isto sugere:** igualdade de conjunto em teste se afirma com o acessório que NOMEIA excedentes e ausentes, nunca com `contains` nem com booleano.

**O que ela faria (simples):** o mesmo formato de asserção — comparar dois conjuntos e exigir `{ excedentes: [], ausentes: [] }` — já aparece em quatro pontos de três arquivos de teste do pacote, sempre pela mesma razão: uma reprovação que diz só "os conjuntos diferem" obriga a caçar o item e acaba sendo afrouxada na rodada seguinte. Uma regra escrita evitaria que o próximo teste de conjunto nascesse com `contains` e deixasse passar o elemento a mais.

- Evidência: `expect(diferencasDeConjunto(a, b)).toEqual({ excedentes: [], ausentes: [] })` em 4 pontos de 3 arquivos — `packages/auth/test/autorizacao.spec.ts:131`, `packages/auth/test/admissao.spec.ts:343`, `:351`, `:377` — T2 / domínio da autorização em `@sysloc/auth`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-04T16:30:00Z

---

## [convention_drift] Exaustividade sobre enum derivado do schema

**Regra que isto sugere:** todo consumo de união derivada de enum do schema é exaustivo por construção — `Record` completo ou ramo `never` —, nunca por `if`/`switch` sem fecho.

**O que ela faria (simples):** o projeto derivou perfil, desfecho de tentativa, código de erro e efeito de permissão do schema justamente para que o banco seja a fonte de verdade, e três módulos fecham o consumo com `Record` exaustivo comentando que "valor novo deixa de compilar em vez de cair em silêncio" — mas a convenção só existe em comentário, e o cálculo do efetivo a perdeu, tratando o efeito por dois `if` que ignorariam um terceiro valor sem avisar ninguém. A regra escrita obrigaria quem acrescenta valor ao enum a dizer, pelo compilador, o que ele significa em cada consumidor.

- Evidência: consumo de `EfeitoDePermissao` por dois `if` literais (`packages/auth/src/efetivo.ts:85` e `:94`), enquanto `DESFECHO_POR_MOTIVO` (`packages/auth/src/autenticacao.ts:293`), `STATUS_POR_CODIGO` (`packages/shared/src/erros.ts:108`) e `MATRIZ_POR_PERFIL` (`packages/auth/src/matriz-de-perfil.ts:77`) usam `Record` exaustivo sobre a mesma classe de união — T2 / domínio da autorização
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-04T17:20:00Z

---

## [repeated_fixture] Pessoa-alvo e restauração de estado por arquivo de teste

**Regra que isto sugere:** centralizar a escolha da pessoa-alvo e o helper de restauração de estado de permissão num acessório compartilhado do pacote `db`.

**O que ela faria (simples):** os dois arquivos de teste da task escolhem a mesma pessoa da carga (`ACESSOS_DA_EMPRESA_A[1]`) por caminho próprio e escrevem cada um o seu helper de limpeza/restauração (`limparEfetivo` e `restaurarPessoa`), com o mesmo `DELETE` de ajustes mais o mesmo `UPDATE` zerando o contador. Uma regra apontando um acessório único evita que as duas cópias divirjam e passem a restaurar estados diferentes.

- Evidência: mesma pessoa da carga e mesmo par `DELETE`+`UPDATE` de restauração em dois arquivos — `packages/db/test/isolamento.spec.ts:1330` e `packages/db/test/unidade-de-trabalho.spec.ts:682` — T3 / camada de dados da autorização
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-04T18:40:00Z

---

## [repeated_assertion_shape] Leitura de estado sob contexto seguida de igualdade estrutural

**Regra que isto sugere:** padronizar a conferência de estado de permissão como `executarCom(contexto, () => emUnidadeDeTrabalho(lerEstado))` seguida de `toEqual` do objeto inteiro.

**O que ela faria (simples):** o mesmo par — abrir o contexto de tenant, ler o estado da pessoa pela unidade de trabalho e comparar o objeto INTEIRO por igualdade estrutural — aparece cinco vezes no CT-210. É a forma certa (o objeto inteiro discrimina o que a contagem não discrimina), e escrevê-la como convenção evita que a próxima task caia em `toBe(contagem)`.

- Evidência: cinco repetições do par leitura-sob-contexto + `toEqual` do objeto de estado — `packages/db/test/unidade-de-trabalho.spec.ts:1163`, `:1183`, `:1209`, `:1227`, `:1344` — T3 / CT-210, atomicidade do contador
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-04T18:40:00Z

---

## [repeated_fixture] Acessórios de e2e HTTP replicados por arquivo

**Regra que isto sugere:** centralizar `pedir`, `entrar` e `ajustar` num acessório de teste compartilhado de `apps/api/test/`, em vez de recopiá-los por arquivo.

**O que ela faria (simples):** os mesmos três acessórios — requisição HTTP com `Origin`, entrada real por `sign-in/email` extraindo o cookie, e escrita de ajustes sob contexto de tenant — foram recopiados quase palavra por palavra nos dois arquivos novos e já existiam em outros dois. Uma regra apontando o acessório único evitaria que uma correção num deles (por exemplo, o tratamento de cookie repetido) deixe os outros para trás.

- Evidência: helper `ajustar` idêntico em dois arquivos; `pedir`/`entrar` repetidos em quatro — `apps/api/test/autorizacao.e2e.spec.ts:702` e `:740`, `apps/api/test/ponto-de-aplicacao.spec.ts:452` e `:489` — T4 / ponto de aplicação da autorização
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-04T21:10:00Z

---

## [repeated_assertion_shape] Envelope de recusa por permissão asserido à mão

**Regra que isto sugere:** asserção do envelope `ACESSO_NEGADO` por um construtor de esperado (`recusaPorPermissao(chave)`), em vez do literal de três campos repetido caso a caso.

**O que ela faria (simples):** o mesmo objeto `{ codigo, mensagem, detalhes: { exigido } }` é montado à mão em cinco pontos; quando o envelope da ADR-0012 mudar, cinco lugares mudam e um esquecido passa despercebido. Um construtor nomeado mantém a igualdade de objeto inteiro — que é o que dá força à asserção — com um lugar só para atualizar.

- Evidência: literal do envelope de recusa repetido em 5 asserções — `apps/api/test/autorizacao.e2e.spec.ts:351`, `:376`, `:418`, `:468`, `:511` — T4 / recusa por permissão nas duas dimensões
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-04T21:10:00Z

---

## [scope_deviation] Dependência injetada nova e escopo declarado

**Regra que isto sugere:** task que introduz token de injeção novo declara, na lista de arquivos, o módulo provedor e o arquivo de tokens da composição.

**O que ela faria (simples):** a T4 precisou de acesso a `negocio` na guarda e acabou tocando `ambiente.ts` e `autenticacao.module.ts`, nenhum dos dois na lista declarada — o executor seguiu em vez de acionar o gatilho de parada, porque parar por um provider de DI seria desproporcional. A regra tornaria previsível que dependência nova arrasta esses dois arquivos, e o escopo declarado passaria a descrever o que a task de fato entrega.

- Evidência: token `TOKEN_ACESSO_AO_NEGOCIO` criado em `apps/api/src/configuracao/ambiente.ts:225` e provido em `apps/api/src/autenticacao/autenticacao.module.ts:105`, ambos ausentes da §5.2 da T4 — T4 / ponto de aplicação da autorização
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-04T22:00:00Z

---

## [repeated_fixture] Cliente HTTP e entrada de sessão nos e2e da API

**Regra que isto sugere:** centralizar `pedir`, `entrar`, `credencialDeSessao` e a derivação de TOTP num acessório compartilhado dos e2e de `apps/api/test/`.

**O que ela faria (simples):** quatro arquivos de e2e da API redeclaram os mesmos ajudantes de requisição, entrada e segundo fator, cada um com pequenas variações de assinatura; uma regra apontando um acessório único evitaria que uma correção de comportamento (cabeçalho de origem, formato do cookie, janela do TOTP) precisasse ser repetida em quatro lugares e divergisse em silêncio.

- Evidência: `pedir`/`entrar`/`codigoDoSegundoFator`/`credencialDeSessao` redeclarados em 4 arquivos — `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts:571`, `contexto.e2e.spec.ts:1338`, `sessao-restrita.e2e.spec.ts:838`, `autorizacao.e2e.spec.ts:740` — T5 / cobertura de autorização
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-04T23:30:00Z

---

## [convention_drift] Identificação de caso nascido de achado de gate

**Regra que isto sugere:** caso de teste criado por exigência de gate recebe identificador na forma canônica CT — CT novo, ou sufixo por letra sobre o CT da task que o originou.

**O que ela faria (simples):** a convenção escrita manda todo caso levar um `CT-NNN`, mas não diz de onde sai o CT quando o caso não veio do inventário da spec e sim de um achado de gate; na mesma correção, um arquivo resolveu por `CT-236 (c)` e o outro inventou `T6 (P4)`. Com a regra, todo caso nascido de gate continua aparecendo nas contagens e na auditoria de cobertura `CA → CT`, em vez de sumir do inventário.

- Evidência: dois arquivos da mesma rodada de correção com esquemas diferentes — `CT-236 (c)` em `packages/auth/test/bloqueio.spec.ts:844` contra `T6 (P4)` em `packages/auth/test/onboarding.spec.ts:10`, `:14`, `:65` — T6 / casos criados por exigência dos Gates 1 e 2
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-05T02:00:00Z

---

## [convention_drift] Canonicalização de entrada na borda

**Regra que isto sugere:** toda entrada que a aplicação depois compara por igualdade de string é canonizada num ponto único na borda, e a omissão deliberada é sinalizada no ponto omisso.

**O que ela faria (simples):** o projeto já pratica isto sem ter escrito — o e-mail é normalizado para minúsculas na borda porque a coluna guarda minúsculas, e o comentário justifica que normalizar em dois pontos deixa os dois livres para divergir. A mesma propriedade faltava no identificador de rota, e a falta **virou escalada de privilégio dentro da empresa**: o UUID em maiúsculas achava a mesma pessoa no banco (o `uuid_in` do Postgres é insensível à caixa) e escapava da comparação de identidade da aplicação. Escrita, a regra faria a próxima borda nascer canonizada e obrigaria quem decidisse não canonizar a dizer por que, no arquivo onde a decisão vai ser lida.

- Evidência: duas constantes homônimas `ESQUEMA_DO_IDENTIFICADOR` com semânticas divergentes — uma com `.transform(toLowerCase)` e marcador, outra sem transformação e sem nota — enquanto a convenção de normalizar na borda já é praticada para e-mail sem estar escrita em rule ou ADR — `apps/api/src/usuarios/usuario.controller.ts:157`, `apps/api/src/master/empresa.controller.ts:92`, `packages/db/src/empresa.ts:200` — T8 / autorizacao-e-ciclo-de-acesso v1
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-05T00:00:00Z

---

## [repeated_fixture] Caminho de rota composto do dono do segmento

**Regra que isto sugere:** todo caminho de rota usado em teste é composto a partir da constante que declara o segmento no controlador dono, nunca escrito como literal.

**O que ela faria (simples):** seis arquivos de teste repetiram a mesma composição para chegar à rota de troca de senha, cada um importando a constante do controlador dono em vez de escrever o caminho à mão. Foi isso que fez o **desligamento da rota nativa se propagar sem que nenhum literal ficasse para trás**; uma regra escrita garantiria que o próximo teste nasça assim, em vez de depender de quem revisa lembrar.

- Evidência: composição `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}` repetida em 6 arquivos de teste — `apps/api/test/sessao-restrita.e2e.spec.ts:217`, `autenticacao.e2e.spec.ts:361`, `ciclo-de-acesso.e2e.spec.ts:249`, `administracao-de-pessoas.e2e.spec.ts:338`, `contexto.e2e.spec.ts:289`, `cobertura-de-autorizacao.e2e.spec.ts:181` — T9 / troca de senha na forma do produto
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-05T00:00:00Z

---
