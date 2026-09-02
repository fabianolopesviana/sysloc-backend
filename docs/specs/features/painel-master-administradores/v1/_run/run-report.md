# Relatório do Run — painel-master-administradores/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule
> mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **8/8 tasks concluídas** — as **três fases fechadas**. Suíte **verde nos 9 pacotes**,
`skipped`/`todo` em **zero**: `contracts` 455 · `api` **455** · `shared` **309** · `db` 296 ·
`worker` 180 · `documentos` 159 · `auth` 95 · `cobranca-bancaria` 114 · `regua` 30 — total **2093**
(P1 era 2070). `pnpm build` e `pnpm lint` limpos. ⚠️ **Os 14 vermelhos por desenho de
`cobertura-de-autorizacao.e2e.spec.ts` FECHARAM na T7**, sem virar casos novos, e nenhum caso verde
ficou vermelho em pacote algum.

**Superfície publicada: 113 rotas / 98 manipuladores / 20 pares públicos**, pelos dois eixos
independentes — as 7 rotas novas do Painel Master exigem sessão, e por isso `publicas` **não** se
moveu. ⚠️ Uma **quarta** âncora acompanhou: `ROTAS_PUBLICADAS_NO_MUTANTE` 100 → **107**.

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Camada de acesso do Master | opus | 2 criados, 6 mod | ✅ APROVADO (r2) | ✅ APROVADO (r2) |
| T2 | Guardas de catálogo | opus | 0 criados, 3 mod | ✅ APROVADO (r2) | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Fecho do `D32 · F5/T7` | opus | 0 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T4 | R1–R3 do Admin Empresa | opus | 4 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES (r2) | ✅ APROVADO_COM_OBSERVACOES (r2) |
| T5 | R4–R5 do Admin Empresa | opus | 0 criados, 7 mod | ✅ APROVADO_COM_OBSERVACOES (r2) | ✅ APROVADO_COM_OBSERVACOES |
| T6 | R6–R7 da Empresa | opus | 0 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES (r3) | ✅ APROVADO_COM_OBSERVACOES (r3) |
| T7 | Âncoras de superfície e as 4 ocorrências normativas | opus | 0 criados, 4 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T8 | Escrituração — ADR-0014 e handoff do Master | opus | 0 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES (r2) | — (gates=[qa]) |

**A Fase 3 rodou em lote paralelo (T7 ∥ T8)** — o único da fatia, e os 6 guards foram
**re-verificados um a um** no despacho, não herdados da coluna do plano.

## 2. Débitos Técnicos Não Resolvidos

### D1 · baixo · project_pattern · T1 · executor

- **Onde:** `packages/db/src/administrador-do-master.ts` (junto de `lerAdministrador`)
- **Problema:** `lerAdministrador` e `lerAlvoDeReemissao` (`packages/db/src/empresa.ts`) leem a
  **mesma linha** de `identidade.usuario`, pela **mesma chave**, em duas projeções diferentes. São
  duas cópias da mesma leitura.
- **Impacto:** baixo hoje, e conhecido: com duas cópias, endurecer uma deixa a outra para trás — se
  a coluna mudar de nome ou se a projeção precisar recortar campo, os dois pontos têm de mudar
  juntos e nada os amarra. O nome físico continua num pacote só, então a mudança é local; o que se
  perde é a garantia de que ela alcança as duas.
- **O que fazer:** ao aparecer o **terceiro** leitor da linha da pessoa em `identidade`, subir a
  leitura para casa única, com cada chamador declarando os campos de que precisa (o molde é
  `colunasDaEmpresa`/`colunasDoAdministrador`: um fragmento por projeção, sobre uma consulta só).
- **Por que não agora:** o **Limiar de Três** do `CLAUDE.md` não disparou — são duas cópias.
  Unificá-las hoje obrigaria `lerAlvoDeReemissao` a publicar `id`, `ativo`, `empresaId` e
  `criadoEm`, que a rota de reemissão de senha provisória **não usa**: alargar a projeção de uma
  rota já publicada para poupar seis linhas custa mais que a duplicação.
- **Gatilho:** o terceiro leitor. Marcador `DÉBITO COM GATILHO — D1 · F7/T1` no ponto do código,
  linha correspondente no índice do `CLAUDE.md`.

### D2 · baixo · code_quality · T2 · Tech Review

- **Onde:** `packages/db/test/catalogo.spec.ts:2098` (`verificarCoberturaDoCriterioDeExclusao`)
- **Problema:** a guarda de cobertura nasce no arquivo de **teste** sem registrar por que não vive em `src/catalogo.ts`, como a sua irmã. Ela é gêmea estrutural de `verificarCoberturaDeIsolamento` — mesmo par `examinadas`/`excecoes`, mesmo motivo fechado, e o próprio docblock declara *"Mesmo desenho de `CoberturaDeIsolamento`, e pela mesma razão"*. A irmã vive em **produção** (`packages/db/src/catalogo.ts:281`), é exportada pelo barril e é consumida fora da suíte pelo verificador de infraestrutura, que a importa do `dist` e a roda contra o banco real após a migração (`deploy/scripts/instalacao/verificar-migracao.sh:437`).
- **Impacto:** baixo, de manutenção. O próximo agente encontra duas guardas de catálogo idênticas em forma e opostas em domicílio, sem nada que decida a questão — e resolve a assimetria de um dos dois jeitos errados: promove a guarda para `src/` "por simetria", ampliando superfície publicada sem consumidor, ou a duplica lá quando alguém quiser conferir a cobertura contra o banco de produção.
- **O que fazer:** acrescentar ao cabeçalho do `describe` duas ou três linhas com a razão — o modelo de ameaça que a própria guarda declara é *"uma fatia futura em `negocio`"*, isto é, uma **migração deste repositório**, e a instância efêmera aplica todas elas; a deriva do banco implantado, que motiva a irmã a viver em produção, não é o vetor aqui. Registrar o gatilho que mudaria isso: o dia em que `verificar-migracao.sh` precisar conferir a cobertura do critério de exclusão contra o banco real, a função sobe para `src/catalogo.ts` e entra no barril. **ADRs referenciadas:** 0009, 0038.

### D3 · baixo · project_pattern · T2 · Tech Review

- **Onde:** `packages/db/test/catalogo.spec.ts:2122` e `:2231` (as duas cópias do predicado de ligação obrigatória)
- **Problema:** a subconsulta `COALESCE((SELECT bool_and(a.attnotnull) …), false)` aparece **idêntica** na travessia por ponto fixo e na consulta de um salto. O docblock da segunda é explícito — *"A conferência de obrigatoriedade é a mesma da guarda, **e tem de ser**"* — declara a obrigação de sincronia e **não instala mecanismo nenhum** que a sustente.
- **Impacto:** baixo, e a direção da falha é **segura**: se a cópia do salto único perder a conferência de `attnotnull`, o conjunto de um salto cresce, as sete transitivas caem a menos de sete e o `CT-1242` fica **vermelho**. Nenhum vetor silencioso. O custo é de rastreabilidade — a obrigação de sincronia vive só em prosa e some do radar assim que a fatia fechar.
- **O que fazer:** emitir marcador `DÉBITO COM GATILHO` junto de `tabelasQueAlcancamAEmpresaEmUmSalto`, com `QUANDO FECHA` = *o terceiro consumidor do predicado de ligação obrigatória, ou a primeira alteração do que "obrigatória" significa*, `POR QUE NÃO AGORA` = *extrair um fragmento SQL compartilhado hoje acoplaria as duas consultas que a rodada 2 separou de propósito, e são duas cópias*, e o `ÍNDICE` apontando para esta §2; mais a linha no bloco de débitos do `CLAUDE.md`. **Alternativa igualmente aceitável**: extrair o predicado para uma constante de string SQL do arquivo — ela **não** reintroduz circularidade, porque o que a rodada 2 precisou manter independente é a **travessia** (ponto fixo × salto único), não a definição de aresta.

### D4 · baixo · documentation · T3 · QA

- **Onde:** `apps/api/test/acessorios-de-borda.ts:380` (docblock de `entrarComSegundoFatorCumprido`)
- **Problema:** o docblock declara a **prova errada** da inalcançabilidade do ramo tolerante que a promoção removeu — *"foi MEDIDO, não argumentado: a contagem daquela suíte não se moveu na baseline caso a caso da T3"*. A **conclusão está certa**, mas o instrumento citado não a sustenta: contagem idêntica prova apenas que nenhum caso sumiu.
- **Impacto:** o que discrimina é a suíte sair **verde** — `credencialDeSessao(ativacao)` levanta quando a credencial não vem, e é chamada dentro do `beforeAll` de `entrega-da-noticia`, de modo que um ramo alcançável reprovaria os 15 casos **sem mover a contagem deles**. Medido na validação: 15 casos, **15 PASSED**. Registrar o instrumento fraco num docblock permanente é o que a `.claude/rules/testing-stack.md` adverte — *"prova inconclusiva é pior que prova ausente, ela consta como feita"*.
- **O que fazer:** trocar a frase por *"os 15 casos daquela suíte saíram VERDES — o levantamento de `credencialDeSessao` acontece no `beforeAll`, e um ramo alcançável os reprovaria todos sem mover a contagem"*. A afirmação sobre a baseline permanece, mas como prova de que nada sumiu, não de que o ramo era morto.

### D5 · baixo · documentation · T3 · QA

- **Onde:** `apps/api/test/entrega-da-noticia.e2e.spec.ts:1677` (o marcador `D32 · F5/T7` reduzido)
- **Problema:** a **sétima cópia semântica** do acessório não está registrada. `apps/api/test/campos-fechados.e2e.spec.ts:1057` declara `entrarComoOperadorDoSaaS` — **mesmo fluxo** (entrar → `two-factor/enable` → `generateTOTP` → `two-factor/verify-totp`), outro nome. Não tocá-la foi **correto** (fora da §5.2; abrir suíte alheia não declarada é o que a §4.5 do Protocolo proíbe). O que falta é o registro: o marcador diz que o acessório *"tinha SEIS escritas privadas e hoje tem UMA"*, verdade pelo **nome** e falso pelo **comportamento**.
- **Impacto:** um agente futuro lerá que a convergência fechou. É falha de **escrituração**, não de código.
- **O que fazer:** acrescentar ao bloco `⚠️ PAGO` do marcador: *"⚠️ resta UMA cópia semântica sob outro nome — `entrarComoOperadorDoSaaS` em `./campos-fechados.e2e.spec.ts` —, fora da §5.2 da T3; ela converte quando a primeira task autorizada a abrir aquela suíte chegar."*

### D6 · baixo · documentation · T3 · QA

- **Onde:** `apps/api/test/percurso-do-cliente-novo.e2e.spec.ts:91` e `apps/api/test/rotinas-agendadas.e2e.spec.ts:140`
- **Problema:** duas justificativas de docblock ficaram **vencidas** pela promoção. A primeira diz que montar a empresa pelas rotas do Master *"custaria a SÉTIMA escrita de `entrarComSegundoFatorCumprido`"* e que *"fechá-lo exigiria abrir cinco suítes alheias"* — as duas premissas caíram com a T3. A segunda diz o mesmo.
- **Impacto:** não tocá-las foi **correto** (fora da §5.2), mas é exatamente o precedente que este repositório já pagou duas fases para aprender: *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica"*. A decisão de arranjo de cada uma continua defensável por outra razão (o custo de `montarEmpresaComAdmin`, que segue aberto); é a **razão escrita** que precisa mudar.
- **O que fazer:** gatilho — a primeira task autorizada a abrir `percurso-do-cliente-novo.e2e.spec.ts` ou `rotinas-agendadas.e2e.spec.ts`. Trocar o custo citado: hoje é só a **terceira** escrita de `montarEmpresaComAdmin`, porque a do segundo fator se importa da casa compartilhada.

### D7 · baixo · project_pattern · T3 · Tech Review

- **Onde:** `apps/api/test/administracao-de-pessoas.e2e.spec.ts:457`, `ciclo-de-acesso.e2e.spec.ts:360`, `cobertura-de-autorizacao.e2e.spec.ts:4001`, `contexto.e2e.spec.ts:1106` e `recusa-indistinguivel.e2e.spec.ts:716,800`
- **Problema:** com a promoção, cinco suítes passam a exercitar **dois clientes HTTP dentro do mesmo caso** — o compartilhado (`pedir` de `acessorios-de-borda.ts`, alcançado por dentro do acessório importado) na metade do arranjo que emite a credencial de Master, e o `pedir` **privado** da própria suíte no resto. Eles divergem hoje em `redirect: 'manual'`, no campo `cabecalhos` do retorno e no repasse de `opcoes.cabecalhos` — inócuo no caminho exercitado, e é por isso que a baseline não se moveu.
- **Impacto:** baixo e diferido. É o risco que o `D40 · F5/T9` nomeia — *"ela tem duas formas de falar HTTP, e a privada convida a ser copiada"* —, agora **dentro de um mesmo caso** e não entre suítes: endurecer o compartilhado (um tempo-limite, um cabeçalho novo) deixa as cinco cópias privadas para trás em silêncio, e nenhuma asserção acusa porque cada suíte segue verde medindo uma borda ligeiramente diferente. ⚠️ **O `D40 · F5/T9` NÃO cobre isto** — ele é nominalmente escopado a `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (junto de `naBorda`), e nenhuma das cinco é ela.
- **O que fazer:** gatilho — a próxima task autorizada a abrir uma das cinco **por outra razão** converte o `pedir` dela para o compartilhado. ⚠️ **NÃO converter os cinco agora**: seria a refatoração cruzada que a §4.5 do Protocolo proíbe e que o limite declarado no docblock de `acessorios-de-borda.ts` reserva ao caminho normal do `CLAUDE.md`. Marcador no código é opcional — o gatilho é difuso e o docblock da casa compartilhada já declara a doutrina.

### D8 · baixo · project_pattern · T4 · executor

- **Onde:** `apps/api/src/master/administrador.service.ts` (junto de `recusaPorPerfil`)
- **Problema:** o envelope de **recusa por perfil** tem **duas** cópias — `apps/api/src/master/empresa.service.ts` e `apps/api/src/master/administrador.service.ts`. São a mesma forma de `422` nomeando `perfilDoAlvo` (RN-06), escritas duas vezes.
- **Impacto:** baixo hoje, e conhecido: com duas cópias, endurecer uma deixa a outra para trás — se o envelope ganhar campo ou o código mudar, os dois pontos têm de mudar juntos e nada os amarra.
- **O que fazer:** ao aparecer a **terceira** cópia, subir o envelope para casa única do módulo `master/`. **Por que não agora:** o **Limiar de Três** do `CLAUDE.md` não disparou — são duas.
- **Gatilho:** a terceira cópia. Marcador `DÉBITO COM GATILHO — D8 · F7/T4` no ponto do código, linha correspondente no índice do `CLAUDE.md` (39 → **40** pares), e `LINHAS_DO_INDICE_NO_FECHO_DA_FATIA` em **40** no mesmo diff — as três pontas conferidas pelo orquestrador.

### D9 · medio · code_quality · T4 · QA

- **Onde:** `apps/api/test/master-administradores.e2e.spec.ts:868` (`contarSessoesDaPessoa`)
- **Problema:** o corpo é **idêntico linha a linha** ao de `apps/api/test/administracao-de-pessoas.e2e.spec.ts:1450` — só o docblock difere. A convenção *"Acessório de suíte se importa, não se copia"* do `CLAUDE.md` é literal sobre exatamente esta situação, e a casa compartilhada **existe** (`apps/api/test/acessorios-de-borda.ts`): o executor a usou corretamente para `pedir`, `entrar`, `entrarComSegundoFatorCumprido`, `conceder` e `credencialDeSessao` — este é o **único** acessório que ele copiou em vez de promover.
- **Impacto:** é a razão pela qual a convenção existe, dita por ela mesma: *"quem escreve uma suíte nova copia de UMA vizinha — para ele é a segunda cópia, nunca a enésima, e o gatilho do Limiar de Três nunca dispara"*. ⚠️ **Atenuante medido**: a função fecha sobre a variável de arquivo `identidade` (a instância efêmera), de modo que promovê-la exige recebê-la por parâmetro — **não é um `move` mecânico**. Anotável por ser `code_quality`.
- **O que fazer:** promover `contarSessoesDaPessoa` para `acessorios-de-borda.ts`, recebendo o acesso a `identidade` por parâmetro (no molde de `pedir`, que recebe `base`), e importá-la nas duas suítes. **Alternativa aceitável**: emitir `DÉBITO COM GATILHO` junto da declaração, com gatilho na terceira cópia, no mesmo molde do `D8 · F7/T4`.

### D10 · baixo · code_quality · T4 · QA

- **Onde:** `apps/api/test/master-administradores.e2e.spec.ts:880` (`emUnidade`)
- **Problema:** é a **nona** declaração privada do mesmo acessório em `apps/api/test/` — as outras oito estão em `equivalencia-com-o-oraculo.spec.ts:1172`, `boleto-da-cobranca.e2e.spec.ts:2411`, `rotinas-agendadas.e2e.spec.ts:1024`, `retomada-de-retidas.spec.ts:875`, `historico-bancario.e2e.spec.ts:1188`, `notificacao-bancaria.e2e.spec.ts:1142`, `recusa-indistinguivel.e2e.spec.ts:1576`, mais as variantes `emUnidadeDeA` e `emUnidadeDe`.
- **Impacto:** é a mesma classe do `D11 · F5/T6`, que a fatia `automacoes-agendadas` registrou para o lado do `worker`; o Limiar de Três disparou há muito no lado do `api` **sem que nada o escriturasse**. `BAIXO` por dois fatores medidos: o padrão é **sistêmico e anterior** a esta task (8 precedentes tolerados), e a assinatura desta cópia é **diferente** das demais (recebe `empresaId` e fixa o contexto de tenant), de modo que ela não é um `move` da vizinha.
- **O que fazer:** **fora do escopo desta task.** O caminho é o do `D11 · F5/T6` no `worker`: promover `emUnidade` para `acessorios-de-borda.ts` numa passada dirigida, com o acesso ao banco e o `empresaId` por parâmetro, e converter as nove declarações em import. **Gatilho:** a primeira task autorizada a abrir uma das nove suítes.

### D12 · baixo · project_pattern · T4 · Tech Review

> ⚠️ **Este bloco PERMANECE, e mudou de natureza na rodada 2.** Ele deixou de ser "anotável a pagar" e passou a ser o **destino do campo `ÍNDICE`** do marcador `DÉBITO COM GATILHO — D12 · F7/T4`, que o executor emitiu junto de `MAIOR_PAGINA_DE_ADMINISTRADORES`. Removê-lo deixaria o marcador órfão — a §3-B da `nao-regressao.md` chama isso de mentira. As três pontas concordam: índice do `CLAUDE.md` com **41** pares, prosa *"São **41**"*, e `LINHAS_DO_INDICE_NO_FECHO_DA_FATIA = 41`.

- **Onde:** `apps/api/src/master/administrador.service.ts:92,95` (`MAIOR_PAGINA_DE_ADMINISTRADORES` / `PAGINA_PADRAO_DE_ADMINISTRADORES`) e `apps/api/src/master/administrador.controller.ts:117-127` (`ESQUEMA_DA_JANELA`)
- **Problema:** a janela e o par de constantes nascem como **segunda cópia byte a byte** dentro de `apps/api/src/master/` — a primeira é `empresa.controller.ts:143-151` com `MAIOR_PAGINA_DE_EMPRESAS`/`PAGINA_PADRAO_DE_EMPRESAS` (`empresa.service.ts:134,137`), **mesmos valores 200/50**. Dois nomes livres para divergir.
- **Impacto:** registro, não defeito — é **exatamente** a situação que o executor reconheceu e escriturou para o envelope de recusa por perfil (`D8 · F7/T4`): duas cópias, Limiar de Três não disparado, terceira prevista para T5/T6. A escrituração foi feita para uma e **omitida para a outra, no mesmo arquivo e no mesmo diff**. O custo é a próxima task não saber que a duplicação existe e criar a terceira sem que o gatilho dispare.
- **O que fazer:** marcador `DÉBITO COM GATILHO` junto de `MAIOR_PAGINA_DE_ADMINISTRADORES`, no molde do `D8` logo abaixo. **Gatilho:** a terceira declaração da mesma forma, ou a primeira task autorizada a abrir `empresa.controller.ts` por outra razão. ⚠️ Isso move `LINHAS_DO_INDICE_NO_FECHO_DA_FATIA` de 40 para **41**, a linha do índice e a prosa *"São **41**"* — as três pontas no mesmo diff, que o `shared` já verifica.

### D13 · baixo · documentation · T4 · executor (medido na rodada 2)

- **Onde:** `packages/db/src/administrador-do-master.ts` (docblock de `ensaiarExclusao`)
- **Problema:** a frase *"`ROLLBACK TO SAVEPOINT` não libera bloqueios"* é **mais larga do que a medição sustenta**. A medição da rodada 2 da T4 (instância efêmera migrada, 200 Admin Empresa elegíveis, com a unidade da listagem **ainda aberta** e 203 bloqueios de relação retidos) mostrou que a entrada de um administrador da própria página — `INSERT` em `identidade.sessao`, que toma `FOR KEY SHARE` na linha — **atravessou em 8 ms**. O controle positivo discrimina: contra um `DELETE` **vivo** na mesma linha, o mesmo `INSERT` esperou o teto inteiro e foi recusado com `55P03` após **5 014 ms**.
- **Impacto:** o retorno ao ponto de salvamento **libera** o bloqueio de **linha**; o que fica até o commit são os de **relação**, que não conflitam com a entrada. A frase, como está, faz o próximo leitor superestimar o custo — e foi exatamente ela que sustentou o impacto declarado no `P2` do Tech Review, que a medição **refutou**.
- **O que fazer:** precisar a frase para *"não libera os bloqueios de **relação**; os de **linha** são liberados"*, com a medição ao lado. **Gatilho:** a primeira task autorizada a abrir `packages/db/src/administrador-do-master.ts` — corrigi-la na T4 exigiria abrir `packages/db`, fora do escopo daquela task. A divergência está declarada no docblock de `listar` (`apps/api/src/master/administrador.service.ts`) enquanto isso.

### D14 · baixo · documentation · T4 · executor (achado pré-existente)

- **Onde:** `apps/api/test/validacao.spec.ts` (o nome do `it` do `CT-357`)
- **Problema:** o nome do caso diz *"seis importadores"* desde quando já eram **nove**; com a T4 são **dez**. A constante `IMPORTADORES_DO_CORPO_VAZIO_ESPERADOS` está correta e a asserção é por igualdade de conjunto — é só o **nome** que envelheceu.
- **Impacto:** nenhum funcional. O custo é de leitura: quem grepa pelo número no nome do caso não o encontra na constante.
- **O que fazer:** trocar o número no nome do `it` para o valor lido da constante, em vez de literal. **Por que não na T4:** tocá-lo perturbaria a comparação **nome a nome** da baseline, que é o instrumento do P5 do Protocolo naquela rodada. **Gatilho:** a primeira task que abrir `validacao.spec.ts` por outra razão.

### D15 · baixo · documentation · T4 · QA

- **Onde:** `docs/specs/features/painel-master-administradores/v1/tasks/T4.md`, §6.6 (e a tabela da §6.3)
- **Problema:** o **Detalhamento dos Casos de Teste** segue com os **6 cards** originais enquanto a suíte tem **9 casos** — a rodada 1 acrescentou `CT-1220 (b)` (cobrindo a §6.4, que a spec descrevia sem nomear CT) e a rodada 2 acrescentou `CT-1244` e `CT-1245` (exigidos pelo `TR-P3`).
- **Impacto:** não há contradição — a §4 e a §5.1 os declaram —, há **lacuna**: o card é a especificação canônica contra a qual um gate confere `Invariant` e `Resultado esperado`, e para esses três CTs a conferência teve de partir do docblock da suíte em vez do card. Não afeta comportamento; é escrituração de spec.
- **O que fazer:** acrescentar à §6.6 os cards de `CT-1244` (a janela declarada **chega ao banco** — as duas páginas de um conjunto de 3, com identidade do item da segunda) e `CT-1245` (a fronteira do teto **recusa** em vez de truncar, mais a cadeia de consulta fechada), e incluir os três casos na tabela da §6.3. O checklist da §8 (*"§6.6 — 6 cards"*) sobe para **9** no mesmo diff.

### D16 · baixo · code_quality · T4 · Tech Review

- **Onde:** `apps/api/src/master/administrador.contrato.ts:182,205,225,236,250`
- **Problema:** o `Readonly<>` dos seis tipos derivados é **raso** — congela apenas o primeiro nível —, e o que ele substituiu era **profundo**. As interfaces que a rodada 2 removeu declaravam `readonly` em **todos** os níveis: `ExclusaoDoAdministrador` tinha `readonly disponivel`/`motivo`/`alternativa`, e `PaginaDeAdministradores` tinha `readonly itens: readonly AdministradorDoContrato[]` com o elemento ele próprio inteiramente readonly. Hoje `AdministradorDoContrato['exclusao']` tem os três campos **mutáveis**, e `itens` é array readonly de objetos mutáveis. ⚠️ A declaração `Garantias removidas` do executor cita a consequência de `exactOptionalPropertyTypes` em `motivo`/`alternativa`, mas **não cita esta** — são efeitos **distintos** da mesma troca.
- **Impacto:** **nenhum em execução** — a serialização é idêntica e `paraContratoDoAdministrador` constrói o objeto literal de uma vez, sem mutar a prévia depois. O custo é de **compilação**: uma escrita acidental em `contrato.exclusao.disponivel` na T5/T6 deixa de ser erro de tipo, exatamente na superfície que ganhará `PUT` parcial e exclusão. É perda de **rede estática**, não de comportamento.
- **O que fazer:** ⚠️ **não refatore para um `DeepReadonly`** — ele não existe nesta base, criá-lo é abstração antecipada, e o Protocolo proíbe refatorar fora da causa-raiz. O suficiente é **escriturar**: acrescentar ao parágrafo *"As duas grandezas de readonly são deliberadas"* (linhas 43-51) que o `Readonly<>` é **raso por construção**, que os campos aninhados de `exclusao` e os elementos de `itens` deixaram de ser `readonly` na troca pelo `z.infer` (ADR-0016), e que a alternativa — redigitar os modificadores à mão — é justamente o que a ADR **proíbe**. Nota: `@syslocbr/contracts` **não** usa o wrapper (`packages/contracts/src/imovel.ts:263`), de modo que o módulo local já é **mais estrito** que o molde canônico.

### D17 · baixo · documentation · T5 · QA

- **Onde:** `docs/specs/features/painel-master-administradores/v1/tasks/T6.md`, §6 (o critério vive na §4, linha 69)
- **Problema:** as **2 chaves de Empresa** do caso de corpo fechado ficaram **sem dono**. O `CT-1230` da T5 tinha, na §6.6, a descrição sobre `PUT /v1/master/empresas/:id` — rota da **T6** —, e o executor da T5 corretamente implementou apenas as **4 chaves de usuário**, porque a §5.2 da T5 não lista `empresa.controller.ts`. Mas a **§6 da T6 não tem CT de corpo fechado**: ela traz `CT-1229`, `CT-1231`, `CT-1232`, `CT-1233`, `CT-1234`, `CT-1235`, `CT-1238` e `CT-1239`, e **nenhuma menção** a `strictObject`, `unrecognized_keys` ou chave proibida.
- **Impacto:** o critério de aceite da T6 (§4, linha 69 — *"Corpo do `PUT` em `z.strictObject`, sem `estado`/`suspensaEm`"*) **existe e não tem CT que o cubra**. As duas chaves proibidas do corpo de Empresa ficam órfãs: a T5 não pode cobri-las e a T6 não as declara.
- **O que fazer:** acrescentar à §6.3/§6.6 da **T6** um CT de corpo fechado para `PUT /v1/master/empresas/:id`, no molde exato do `CT-1230` da T5 — perna de **contrato** afirmando `code: 'unrecognized_keys'` e `keys: [<chave>]`, mais perna de **borda** afirmando o `422` e a linha crua inalterada —, cobrindo as chaves que a §4 da T6 nomeia. ⚠️ **Não é correção da T5** — é lacuna a carregar para o refinamento da T6 **antes** de despachá-la, e o orquestrador a carregou.

### D18 · baixo · tests · T5 · QA (rodada 2)

- **Onde:** `apps/api/test/master-administradores.e2e.spec.ts:446` (`RESTRICAO_DO_EMAIL_NO_SERVIDOR`)
- **Problema:** a **segunda agulha** da varredura da RN-15 é o literal `'usuario_email_unique'`, escrito **à mão** no teste. ⚠️ **O valor está CORRETO hoje** — conferido pelo gate contra `RESTRICAO_DO_EMAIL` em `packages/db/src/administrador-do-master.ts:204`, e são idênticos. O que **não existe** é amarra. `smell: magic_strings` (AP-19).
- **Impacto:** se a restrição for renomeada em produção, o eixo do **nome da restrição** deixa de ser agulha de vazamento e **nada acusa** — o controle positivo continua verde, porque ele **planta o mesmo literal que a lista busca**, de modo que ele prova a **varredura**, não a **atualidade da agulha**. ⚠️ A **primeira** agulha (o e-mail do ocupante) é derivada de dado **real** e não sofre disso, e é ela que carrega o risco material — por isso o achado é `BAIXO`. O docblock **declara** a escolha e a razão (importar a constante exigiria publicá-la só para o teste, o que seria seam — Iron Law #6): é débito **declarado**, não descuido.
- **O que fazer:** quando alguma task for autorizada a abrir `packages/db/src/administrador-do-master.ts` por outra razão, avaliar publicar `RESTRICAO_DO_EMAIL` no barril de `@sysloc/db` (ela já é discriminante de **produção**, não símbolo de teste) e importá-la aqui; **ou**, mantendo o literal, acrescentar uma perna que leia o nome da restrição do próprio `information_schema` da instância efêmera e o compare com a constante do teste. **Nenhuma das duas é exigível na T5** — o custo hoje seria alargar superfície de pacote fora do escopo.
### D19 · medio · project_pattern · T5 · Tech Review

- **Onde:** `apps/api/src/master/administrador.service.ts:112` e `:495` (`MOTIVO_DO_EMAIL_EM_USO`) · `apps/api/src/master/administrador.contrato.ts:259` e `:266` (`MAIOR_NOME_DE_PESSOA`)
- **Problema:** o **Limiar de Três disparou nos dois símbolos, e os dois docblocks registram uma contagem FALSA como justificativa para não subi-los**.
  - **(i)** `MOTIVO_DO_EMAIL_EM_USO = 'EMAIL_JA_REGISTRADO'`: o docblock afirma *"São **duas** declarações do literal, e o Limiar de Três não disparou"* — mas o literal já vivia em **dois** pontos de produção **antes** desta task, `master/empresa.service.ts:353` e `usuarios/usuario.service.ts:380`, os três no mesmo envelope `{campo:'email', detalhes:{motivo:'EMAIL_JA_REGISTRADO'}}`. **Esta é a terceira.**
  - **(ii)** `MAIOR_NOME_DE_PESSOA = 200`: o docblock afirma ser *"a **segunda** declaração do mesmo teto"*, citando só `empresa.controller.ts:79` — mas `usuarios/usuario.controller.ts:111` já declarava `MAIOR_NOME = 200` **sobre a mesma coluna** `identidade.usuario.nome`. **Esta também é a terceira.**
- **Impacto:** duplo, e o segundo é o que **perpetua**. (a) Três literais de contrato e três tetos de coluna livres para divergir — e o de `email` é valor sobre o qual **o cliente ramifica em três rotas**. (b) ⚠️ **A contagem falsa está escrita no código como justificativa**, de modo que o próximo agente que abrir qualquer um dos dois docblocks lerá *"são duas, o limiar não disparou"* e criará a **quarta** cópia com a mesma convicção. É a classe que o `CLAUDE.md` já registra: *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica — meça a premissa antes de registrá-la"*. ⚠️ **O executor contou a vizinha de quem copiou, não o conjunto** — literalmente o modo de falha que a convenção descreve ao se enunciar.
- **O que fazer:** ⚠️ **NÃO extraia nada agora** — subir os símbolos hoje obrigaria a editar `usuario.service.ts`, `usuario.controller.ts` e `empresa.controller.ts`, que publicam rotas entregues **sem defeito que o motive**, e o Protocolo proíbe refatorar fora da causa-raiz. **O que se corrige é o registro, em dois passos:** (1) corrigir as duas frases para a contagem **medida**, dizendo que o limiar **disparou** e que a extração está adiada por escopo; (2) emitir `DÉBITO COM GATILHO` em cada ponto, no molde do `D8`/`D12`, com `QUANDO FECHA` = a primeira task autorizada a abrir `usuarios/usuario.service.ts` (para o literal) ou `usuarios/usuario.controller.ts` (para o teto) por outra razão.

### D20 · baixo · scope_deviation · T5 · Tech Review

- **Onde:** a §5.2 do gabarito de task (SDD/miniSpec/TaskCard) — a ocorrência é `apps/api/test/contexto.e2e.spec.ts:798` e `CLAUDE.md`
- **Problema:** publicar rota **obriga** a tocar arquivos que a §5.2 **nunca lista** — as âncoras de conjunto (`contexto.e2e.spec.ts`), a de tamanho (`cobertura-de-autorizacao.e2e.spec.ts`) e a contagem do `CLAUDE.md`. É a **13ª ocorrência consecutiva** do `D26 · F2/T6`.
- **Impacto:** **nenhum risco técnico nesta task** — a conduta do executor foi correta em todos os pontos: a âncora **sobe** em vez de virar contenção, a igualdade segue exata nos dois sentidos, o conjunto público não se moveu, nenhuma entrada saiu, e a divergência foi declarada com `SUT_IS_CORRECT_BECAUSE` completo. **O achado não é sobre ele.** O custo é de processo e **cumulativo**: 13 tasks consecutivas gastaram parágrafo de justificativa para a mesma omissão estrutural, e cada gate precisa **reconfirmar** que a mudança fora de escopo é legítima em vez de a §5.2 tê-la previsto.
- **O que fazer:** nada nesta task. O alvo é o **gabarito**: acrescentar à §5.2 a linha condicional *"toda task que publica, remove ou altera rota lista aqui as âncoras de inventário (`contexto.e2e.spec.ts`, `cobertura-de-autorizacao.e2e.spec.ts`) e o índice de contagem do `CLAUDE.md`"*, fechando o `D26 · F2/T6` **na origem** em vez de na décima quarta anotação.

### D21 · baixo · adr_compliance · T5 · Tech Review

- **Onde:** `docs/adr/0038-alcance-da-exclusao-logica-e-fisica-na-identidade.md`, o **2º `Cons`**
- **Problema:** o `Cons` diz *"a verificação prévia toma bloqueios que o retorno ao ponto de salvamento não libera antes do fim da transação"*, e a **medição desta mesma fatia refuta a leitura universal**: com a unidade da listagem **aberta** e 203 bloqueios de **relação** retidos, o `INSERT` em `identidade.sessao` (que toma `FOR KEY SHARE` na linha) atravessou em **8 ms**; o controle positivo discrimina — contra um `DELETE` **vivo**, o mesmo `INSERT` esperou o teto e caiu em `55P03` após **5 014 ms**. O `ROLLBACK TO SAVEPOINT` **libera** o bloqueio de **linha** — que é o que decidiria a disponibilidade de acesso do cliente final — e retém só os de **relação**, que não conflitam com DML.
- **Impacto:** ⚠️ **NÃO é violação da `Decision`** — a `Decision` da 0038 está **integralmente honrada** pelo diff; o campo impreciso é `Cons`. Baixo e diferido, mas o `Cons` é o campo que uma fatia futura abre **para decidir se replica a sonda-em-savepoint** noutra superfície: lido como está, ele *overstates* o custo e pode custar a rejeição de um padrão medido como **barato**. O código de produção **já não propaga** a imprecisão — `administrador.service.ts` declara que não repete a frase larga e registra a medição no ponto de uso.
- **O que fazer:** ⚠️ **decisão do usuário** — gate não emenda ADR. Encaminhar uma **emenda** ao campo `Cons` pela skill própria, com o texto original **preservado byte a byte** (como as emendas da 0001, 0017, 0021 e 0024 já fazem), trocando a frase por *"toma bloqueios de RELAÇÃO que o retorno ao ponto de salvamento não libera antes do fim da transação; o bloqueio de LINHA é liberado pelo retorno, e a entrada de um administrador da própria página atravessa em ~8 ms com a unidade aberta (medido, T4 desta fatia)"*. ⚠️ **Se a emenda for feita, o `D13` fecha no mesmo passo** — ele é a outra ponta da mesma frase, em `packages/db`.

### D22 · baixo · adr_compliance · T6 · executor

- **Onde:** `apps/api/src/master/empresa.controller.ts` (marcador junto de `ESQUEMA_DA_EMPRESA`)
- **Problema:** as **seis** descrições de contrato do arquivo — `ESQUEMA_DA_EMPRESA`, `ESQUEMA_DA_PAGINA`, `ESQUEMA_DA_SUSPENSAO`, `ESQUEMA_DA_REATIVACAO`, `ESQUEMA_DO_ADMINISTRADOR_ADMITIDO` e `ESQUEMA_DA_SENHA_REEMITIDA` — são JSON-Schema escrito **à mão**, em paralelo ao esquema Zod, contra a metade categórica da `Decision` da **ADR-0016** (*"Nenhuma descrição de contrato é escrita à mão em paralelo ao esquema"*). O derivador `esquemaPublicado(...)` existe e é usado por **15 dos 22** controladores.
- **Impacto:** baixo e **contido**. A divergência é **pré-existente** e **não cresce para arquivo novo**: `administrador.contrato.ts` e `administrador.controller.ts` nasceram conformes (T4/T5), e as **três** descrições que a T6 acrescentou (`ESQUEMA_DA_EXCLUSAO`, `ESQUEMA_DA_EMPRESA_LISTADA` e `ESQUEMA_DA_REMOCAO`) seguem a forma local **por prescrição do critério de aceite §4 da T6**, não por escolha do executor. ⚠️ **As três acrescentadas mitigam o eixo que o `P1` do Gate 2 da T4 reprovou**: `ESQUEMA_DA_EMPRESA_LISTADA` é **composto** de `ESQUEMA_DA_EMPRESA` (uma declaração das cinco chaves, não duas) e o `enum` de `impedimentos` **importa** `CLASSES_DE_IMPEDIMENTO` de `administrador.contrato.ts`, que é a única declaração amarrada ao domínio nas duas direções — o documento publicado não promete `string` onde o contrato real é união fechada.
- **O que fazer:** converter as seis para `esquemaPublicado(<esquema Zod>, 'output')`, o que exige **antes** declarar os esquemas Zod correspondentes (hoje só os de entrada existem). **Gatilho:** a primeira task autorizada a abrir `master/empresa.controller.ts` **para reformar a publicação do contrato** — a T6 o abriu para publicar duas rotas, e isso **não** dispara o gatilho: converter reescreveria a descrição publicada de seis rotas em produção sem que critério de aceite algum o peça, e o Protocolo Antirregressão proíbe refatorar fora da causa-raiz (§4.5). Quando ela chegar, a baseline das seis rotas se mede antes e depois.

### D25 · baixo · performance · T6 · QA

- **Onde:** `apps/api/src/master/empresa.service.ts:379` (`listarEmpresas`)
- **Problema:** o teto de **200** foi mantido sobre uma sonda com o **dobro** de instruções por item, e o efeito sobre terceiros ficou **por medir**. ⚠️ **A manutenção do teto SE SUSTENTA** — `MAIOR_PAGINA_DE_EMPRESAS = 200` é contrato de rota **entregue**, e baixá-lo passaria a recusar com `422` um `?limite=200` que hoje responde `200`: mudança de comportamento em superfície publicada que nenhuma CA pede, vedada pelo §4.5. **A extrapolação do efeito colateral é que não se sustenta.**
- **Impacto:** a latência é do próprio operador e escolhida por ele, mas a **retenção de bloqueio não é** — a listagem corre numa transação só e cada sonda toma bloqueio de linha em `identidade.empresa` **e** `identidade.usuario` do tenant sondado, até **200 tenants numa página**. A medição da T4 que fundamenta o *"benigno"* (~3,4 ms/item, entrada concorrente em 8 ms) foi feita sobre a listagem de **administradores**, com teto **50** e **uma** instrução por item; a de empresa executa **duas**, e o próprio executor registra que o número é **piso, não teto**. **É analogia, não medição.** `BAIXO` porque a §3.4 da task manda expressamente *"a medição já foi feita — não a repita"*, e o executor cumpriu a outra metade: **registrou a divergência**.
- **O que fazer:** **gatilho** — a primeira task autorizada a mexer na janela de `GET /v1/master/empresas`, **ou** o primeiro relato de contenção em `identidade.usuario`, mede a página de 200 com uma entrada concorrente em curso (reaproveitando o arranjo já usado na T4 para medir os 8 ms), e só então decide entre manter o teto, reduzir o **padrão** (que **não** é contrato, ao contrário do teto) ou compor a prévia **por lote**. **Nada a mudar em código.**

### D26 · medio · code_quality · T6 · QA (rodada 3)

- **Onde:** ⚠️ **DUAS pontas** — `apps/api/test/master-administradores.e2e.spec.ts:2450` (o docblock do `CT-1249`) **e** `docs/specs/features/painel-master-administradores/v1/tasks/T6.md`, §6.3, campo **Observações** do `CT-1249` (*"A mesma igualdade também reprova o `404` do arcabouço, cujo corpo é `{message, error, statusCode}`"*, medido no diff da rodada 3, linha `+186`). **A segunda ponta foi achada pelo Tech Review**, que a acrescentou ao mesmo débito em vez de abrir um `Dnn` novo — um número a mais para o mesmo defeito polui o índice. ⚠️ **Corrigir só o docblock do teste deixa o CARD afirmando a discriminação inexistente — e o card é o artefato que uma fatia futura lê para derivar CTs.**
- **Problema:** o **"bônus" declarado é FALSO**, e o gate o refutou lendo o fonte. O comentário afirma: *"a igualdade também discrimina o `404` do arcabouço — se a rota não existisse, o corpo seria `{message, error, statusCode}` e este caso ficaria verde por motivo errado"*. **O produto refuta**: rota não casada levanta `NotFoundException`, que é `HttpException`; `FiltroExcecaoGlobal.traduzir` a encaminha a `recusaDeOutrem(404)`; `CODIGO_POR_STATUS[404] = CodigoErro.RECURSO_NAO_ENCONTRADO` (`apps/api/src/comum/filtro-excecao.ts:79`) e `doNossoCodigo` monta o corpo com `MENSAGEM_POR_CODIGO`, **sem `campo` e sem `detalhes`** — isto é, **exatamente** o objeto que o `toEqual` do caso espera. A prova independente está no mesmo pacote (`contexto.e2e.spec.ts:1613-1622`).
- **Impacto:** **removida ou renomeada qualquer das duas rotas, o `CT-1249` permanece VERDE**. ⚠️ **Isto NÃO invalida o caso** para o que o Gate 2 pediu — os três mutantes do `TR-P1` seguem reprovados, e a **existência** da rota é coberta por outro mecanismo (a âncora de superfície). **O defeito é a frase, não a asserção**: ela informa ao próximo leitor uma discriminação que o caso **não tem**. É o corolário que o `CLAUDE.md` já registra cinco vezes — *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica: meça a premissa antes de registrá-la"*.
- **O que fazer:** substituir o parágrafo do "bônus" pelo que é **medido**: o `404` de rota inexistente sai por `CODIGO_POR_STATUS[404]` no **mesmo** envelope, de modo que esta igualdade **não distingue** *"rota ausente"* de *"recurso ausente"* — quem prova a existência das duas rotas é a **âncora de superfície**, e é para lá que o leitor deve ser apontado. **Nada precisa mudar na asserção.** Precedente de forma e severidade: o `TR-P3` desta mesma task, que o Gate 2 classificou como **registro**, não como defeito de prova.

### D27 · baixo · code_quality · T6 · Tech Review (rodada 3)

- **Onde:** `apps/api/test/master-administradores.e2e.spec.ts` (docblock do `CT-1249`, ~:2450, e a tabela de CTs, :165) e `docs/specs/.../tasks/T6.md` (§6.3 e checklist)
- **Problema:** a frase *"É a indistinguibilidade que a **ADR-0017** exige"* **atribui à `Decision` dela algo que o texto não diz**. O gate abriu a `Decision` e a emenda de 2026-08-16: ela fixa a **forma** — *"o erro é status HTTP semântico mais `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` de enum fechado"* — e **`campo?` é opcional e PERMITIDO**. Um `404` com `campo:'id'` seria **conforme** à forma canônica. `grep -n 'indistin|existência|oráculo|enumera'` no arquivo inteiro da 0017 volta **vazio**.
- **Impacto:** **nenhum** sobre comportamento ou cobertura — o código cumpre a 0017 na forma **e** cumpre a doutrina. ⚠️ A doutrina da recusa indistinguível **existe e é forte** neste produto (20+ pontos em `apps/api/src`), mas está ancorada em **RN e em decisões locais de cada fatia**, não na 0017. O custo é o **vão de citação** que as próprias emendas da 0017 e da 0001 existem para fechar: quem seguir a regra do repositório (*"citar ADR exige abrir a `Decision`"*) abre a 0017, **não acha a exigência**, e fica sem saber se pode acrescentar `campo` a um `404` — ou **"corrige" a ADR**.
- **O que fazer:** na mesma passagem que fechar o `D26`, **separar as duas afirmações**: a 0017 responde pela **forma** do envelope (é o que o `toEqual` mede); a **indistinguibilidade** é doutrina do produto, e o parágrafo deve nomear a **RN/decisão que a fixa** em vez da 0017. ⚠️ **NÃO tocar `empresa.service.ts:984`**, que carrega a mesma atribuição — está **fora do delta**, é rota **entregue** e aprovada em rodadas anteriores; **anotar, não editar** (§4.5 do Protocolo).

### D28 · baixo · tests · T7 · QA
- **Onde:** `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts:6950`
- **Problema:** o bloco «AS TRÊS ÂNCORAS — duas medições independentes» é repetido **verbatim em 14 casos** do mesmo arquivo (`CT-213`, `CT-318`, `CT-355`, `CT-427`, `CT-533`, `CT-635`, `CT-732`, `CT-836`, `CT-937`, `CT-972`, `CT-1004`, `CT-1038`, `CT-1095` e agora `CT-1240`). `smell: semantically_duplicated_test` (AP-26).
- **Impacto:** desde que todas as âncoras passaram a apontar para as MESMAS constantes, as 14 cópias afirmam exatamente o mesmo sobre a superfície corrente — o que cada caso ainda tem de próprio é apenas a partição da sua fatia. Pela tupla do AP-26 coincidem 3 dos 4 campos; só o nome difere. ⚠️ **NÃO é duplicata de teste inteiro** — o `CT-1240` acrescenta a partição nova, a disjunção entre as partições e o `paresDoMaster()` intocado, que nenhum outro caso afirma —, e é convenção **pré-existente** imposta por `.claude/rules/ancoras-de-superficie.md`, não defeito introduzido pela T7. Fica anotado porque a próxima fatia que publicar rota acrescenta a **15ª** cópia, e cada uma é superfície livre para divergir.
- **O que fazer:** extrair o bloco de fecho para um acessório local do arquivo — `afirmarAsTresAncoras(aplicacaoReal)` — que faça as duas medições, afirme a igualdade entre os eixos e compare as quatro grandezas contra as constantes. Cada CT de fatia passa a chamá-lo e a manter apenas as asserções da **própria** partição. ⚠️ **Não colapsar os 14 casos num só**: cada um é a âncora datada da sua fatia, e a falha precisa nomear qual fatia moveu a superfície.

### D29 · BAIXO · project_pattern · T7 · Tech Review
- **Onde:** `CLAUDE.md:526` (item 2 do marco de entrega)
- **Problema:** a fórmula «⚠️ **EMENDA de 2026-09-02 (ADR-0039), com o texto original preservado**» é usada sobre uma frase que **foi de fato editada** no mesmo diff — `em **106 rotas / 91 manipuladores**` → `hoje em **113 rotas / 98 manipuladores**`, «a última publicada» → «a última publicada **na superfície da imobiliária**», «altera rota» → «altera rota **dela**». No **mesmo diff**, a ocorrência da prosa da F5 aplica a fórmula corretamente: o período original fica intacto e a emenda vem depois dele.
- **Impacto:** baixo e documental — o registro substantivo **não** se perdeu (o `106 / 91 / 20` está preservado duas linhas abaixo, e a qualificação da ADR-0039 está correta). O risco é o do **idioma deste repositório**: a fórmula tem sentido preciso e praticado (nove ADRs a usam como blockquote apensado ao texto conservado, e o próprio `CLAUDE.md` a qualifica como «byte a byte»), de modo que um agente futuro pode concluir que aquele período é congelado e evitar movê-lo na próxima fatia que publique rota — quando movê-lo é **obrigatório**: o molde `marco.rotas` do `CT-1196` exige literalmente `hoje em **N rotas` naquela sentença.
- **O que fazer:** trocar, no item 2 do marco de entrega, «com o texto original preservado» por «com o valor anterior registrado» (ou equivalente). A frase já entrega isso; é só o rótulo que promete demais. ⚠️ **Nenhuma asserção muda** — o molde do `CT-1196` ancora em `congelada** desde **<data>**, hoje em **`, e nenhuma das palavras propostas o toca.

### D30 · medio · documentation · T8 · QA (rodada 2)
- **Onde:** `docs/plano-backend-novo/handoff-master-frontend.md:519` (e `:841`, e `docs/specs/features/painel-master-administradores/v1/tasks/T8.md:110`)
- **Problema:** as **duas referências cruzadas novas** apontam para a **§3**, e a regra do `campo` foi escrita na **§2**. O discriminador entrou em `### Envelope de erro — idêntico em toda recusa` (linha 116), que está sob `## 2. Base da API e formato geral` (linha 62); a `## 3` do documento (linha 158) é `Fluxo de sessão`.
- **Impacto:** de **navegação**, não de conteúdo — a regra em si está correta e foi conferida no fonte, e o texto local de cada ocorrência é autossuficiente (a §4.2 enumera as três recusas ali mesmo; a §4.9 explica na própria célula *"pois a chave desconhecida não tem o que nomear"*). ⚠️ O próprio documento já fixou a convenção contrária em duas passagens anteriores, que citam a **§2** para exatamente este bloco (linhas 186 e 1092) — é drift interno de citação. Como este handoff é lido por outro agente, em outra máquina, uma remissão que leva à seção errada custa uma busca a cada leitura.
- **O que fazer:** trocar `§3` por `§2` nas linhas 519 e 841 do handoff e na §7 do `T8.md` (linha 110). ⚠️ **Alternativa equivalente e mais robusta a renumeração futura**: citar o subtítulo em vez do número — «pela regra do *Envelope de erro* (§2)».

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

- **A base de `SIMBOLOS_ESPERADOS` era 216 e foi conferida, não presumida** (`CT-012`,
  `packages/db/test/unidade-de-trabalho.spec.ts`): a T1 publica 12 símbolos de runtime e a âncora
  subiu para **228** no mesmo diff da publicação. Os 12 são as 7 funções de
  `administrador-do-master.ts`, `IMPEDIMENTOS_DE_EXCLUSAO` e as 4 de `empresa.ts`. **`interface` e
  `type` não entram** no conjunto, e a mecânica interna da exclusão (`RecusaDeExclusao`,
  `classeDoImpedimento`, `ensaiarExclusao`, `semDeixarEfeitoNaRecusa`) **não é reexportada pelo
  barril** por decisão registrada nos dois pontos — ela existe para `empresa.ts` reusá-la dentro do
  pacote.
- **As 25 restrições de `IMPEDIMENTOS_DE_EXCLUSAO` foram MEDIDAS contra `pg_constraint`** numa
  instância efêmera migrada, em 2026-09-01, e não derivadas do schema à mão: 28 chaves estrangeiras
  alcançam `identidade.usuario` e `identidade.empresa`, das quais **3 são `ON DELETE cascade`**
  (`conta`, `dois_fatores`, `sessao`) e **25 são `no action`** — 8 sobre a pessoa e 17 sobre a
  empresa. A guarda de igualdade contra o catálogo é a T2 (`CT-1215`/`CT-1216`).
- **Um caso além dos 14 da §6 foi acrescentado**: o `CT-1210 (c)`, que fecha o segundo cenário da
  §6.4 (*"restrição `23503` sem classe no mapa deve falhar fechada"*), para o qual a §6.6 não
  trazia card. Ele cria uma dependência descartável pelo papel de migração, prova que a prévia
  **levanta** em vez de devolver `{ elegivel: true }`, e mede o controle **antes e depois** do
  `DROP` — de modo que a inversão é atribuível à restrição nova.
- **Divergência declarada entre a §6.2 e a §6.6 da task, e como foi resolvida**: a tabela da §6.2
  fala em *"as 8 restrições … `it.each`"* e o card da §6.6 fala em *"as 7 origens … tabela de 7
  linhas"*. As duas restrições que `negocio.acesso_usuario_app` opõe nascem da **mesma linha** de
  arranjo, e o PostgreSQL não garante qual dispara — não há como semeá-las separadamente. A
  `it.each` ficou com as **7 origens** (o card), e o par ganhou perna própria, o `CT-1210 (b)`, que
  afirma que as **duas** recebem a mesma classe no vocabulário. Sem ela, classificar só uma faria
  metade das recusas degradar para erro genérico e a `it.each` seguiria verde.
- **Três arquivos fora da §5.2 foram tocados, os três por instrução expressa da §7 da task**: o
  `CLAUDE.md` (linha do índice de débito e o total narrado, 38 → 39), o
  `packages/shared/test/protocolo-antirregressao.spec.ts` (a constante
  `LINHAS_DO_INDICE_NO_FECHO_DA_FATIA`, que o docblock dela manda mover *"no mesmo diff"* em que um
  débito nasce) e este próprio relatório, que o campo `ÍNDICE` do marcador precisa alcançar
  (`CT-907`). As três edições são **aditivas**: nenhuma linha de débito existente sai, e nenhuma
  asserção é alterada.
- ⚠️ **Uma execução do `db` saiu 289/290 e as outras QUATRO saíram 290/290** — a que falhou corria
  **em paralelo** com a suíte de `cobranca-bancaria` no mesmo host, e a identidade do caso não foi
  preservada (a saída foi truncada na captura). As três execuções seguintes foram feitas de
  propósito **sob a mesma contenção** — uma em paralelo com `api`, outra com `worker` — e as três
  saíram verdes, o que caracteriza flake de contenção de CPU/IO, não instabilidade do SUT. Fica
  registrado em vez de omitido: se o 289 voltar, a primeira coisa a fazer é capturar o nome do caso
  antes de qualquer conserto.
- **A medição de latência da prévia sob o teto de página (§12.3 do tech spec) NÃO foi feita nesta
  task** — ela é da borda, que entra na Fase 2. O que esta task entrega é a declaração da retenção
  de bloqueios no docblock de `ensaiarExclusao`, como a §7.4 exige.
