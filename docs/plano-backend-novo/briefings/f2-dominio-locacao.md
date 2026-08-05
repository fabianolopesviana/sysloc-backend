# Briefing de pré-refinamento — F2 · Domínio de locação

> **Entrada para `/agent-spec-pre-refinement`.** Este documento não é a spec: é o material de
> ancoragem para o brainstorm de produto. Ele reúne o que a fase é, o terreno que ela encontra
> pronto, as restrições que não se negociam e — o que mais importa — **as tensões reais que o
> pré-refinamento precisa explorar e convergir com o usuário**.
>
> Feature: `dominio-locacao` · versão `v1` · variante `backend` · fase **F2** do
> `docs/plano-backend-novo/plano-execucao.md`.

---

## 1. O que esta fase é

A F2 constrói **o domínio do negócio**, que até agora não existe. As fases anteriores entregaram
infraestrutura (F0) e fundação de acesso (F1); esta é a primeira que um usuário final enxergaria, e
a primeira em que o produto passa a ter substantivos próprios.

**As 8 entidades:** `Conjunto`, `Imovel`, `Comodo`, `Locador`, `Locatario`, `Fiador`, `Contrato`,
`ContratoFiador`.

O plano de execução (§F2) fixa cinco entregas:

1. Schema com RLS e FK composta, e **código legível por entidade** (`CTR-2026-0001`), único por
   empresa — é o que preserva as telas do frontend, que exibem esse código como título, label de
   select e campo "Identificador".
2. **Tipos reais**: dinheiro em `numeric(15,2)`, datas em `date`/`timestamptz`, status em enum. Com
   isso some a camada de coerção do frontend (`toInt`, `toDouble`, `isTruthy`).
3. Os **3 `Custom Field` de negócio** que a estrutura versionada do Frappe não alcançava passam a
   ser colunas de primeira classe.
4. **Três regras portadas** do Frappe: metragem do imóvel, ativação de contrato (~340 linhas) e
   cancelamento em cascata (~174 linhas).
5. **`@sysloc/contracts`**: os primeiros contratos ts-rest + Zod, no modelo de domínio camelCase.

**Aceitação declarada:** a caracterização de metragem passa contra a implementação nova · criar
`Contrato` da empresa A apontando `Imovel` da B é **recusado pelo banco**, não por validação de
aplicação.

---

## 2. O terreno que a F2 encontra pronto

Isto não é contexto decorativo — muda o desenho da fase, e o brainstorm deve partir daqui.

### 2.1 A fundação de isolamento já existe e é obrigatória

A F1 entregou `empresa_id`, **RLS forçada** (`USING` e `WITH CHECK`) e **FK composta
`(id, empresa_id)`** como padrão de toda tabela de negócio, mais o contexto por `AsyncLocalStorage`
com `SET LOCAL app.empresa_id` por transação. Há uma **guarda de cobertura** que percorre o catálogo
de tabelas e reprova se alguma tabela de negócio nascer sem esses três elementos.

**Consequência para a F2:** as 8 entidades não "recebem" multi-tenancy — elas nascem com ele, e a
guarda existente vai reprovar se não nascerem. O segundo critério de aceitação da fase já é
verificável pelo mecanismo que a F1 instalou.

### 2.2 A autorização das telas da F2 **já está declarada e esperando**

O catálogo de permissões (`packages/auth/src/catalogo-de-permissoes.ts`) é fechado e já contém as
chaves que esta fase vai consumir:

- **Telas:** `TELA:imoveis`, `TELA:cadastros`, `TELA:contratos` — as três áreas da F2.
- **Ações sensíveis:** `ACAO:ativar_contrato`, `ACAO:cancelar_contrato`, `ACAO:excluir_cadastro` —
  **as três ações sensíveis da F2 já existem como chave**, com a área que as comporta declarada no
  `MAPA_ACAO_TELA`.

E existe uma verificação que **impede publicar rota governada sem declarar exigência**, com default
que nega. Ou seja: toda rota nova da F2 tem de declarar qual chave exige, ou a suíte reprova.

**Consequência:** a F2 não decide *como* autorizar — isso está fechado. Ela decide *o que* cada rota
exige, dentro de um catálogo que não pode crescer sem decisão explícita.

### 2.3 O que ainda não existe

`packages/db/src/esquema/negocio.ts` **não tem nenhuma tabela de negócio** hoje — só as tabelas de
acesso e permissão que a F1 criou. As migrações vão de `0000` a `0004`. A F2 abre a `0005`.

E `@sysloc/contracts` **não existe como pacote**. A F2 o cria.

---

## 3. Restrições que não se negociam

Estas vêm do `CLAUDE.md` e das ADRs ativas. Um rumo do brainstorm que as contrarie deve ser podado
com a razão registrada, não discutido.

| Restrição | Origem |
|---|---|
| Multi-tenancy é fundação: `empresa_id`, RLS, FK composta em **toda** tabela de negócio | Invariante 1 |
| O contexto de tenant **nunca** é lido do request | Invariante 2 · ADR-0008 |
| Dinheiro em `numeric(15,2)`, nunca float | Invariante 4 |
| **IDs textuais legíveis preservados** (`CTR-2026-0001`); chave interna é UUID, o código legível é coluna própria, única por empresa | Invariante 5 |
| A API fala o **modelo de domínio camelCase** do `levantamento-frontend.md` §6, não o formato do Frappe | Invariante 6 |
| Envelope de erro canônico `{ codigo, mensagem, campo?, detalhes? }`, `codigo` de enum fechado, **nenhum código novo sem decisão** | ADR-0012 |
| A chave exposta varia por classe de entidade — entidade de negócio expõe o código legível, entidade de identidade expõe o UUID | ADR-0012 |
| Toda rota governada declara exigência, com default que nega | ADR-0011 |
| A suíte nunca executa contra o ambiente que atende a operação | ADR-0006 |

---

## 4. As tensões a explorar — o coração deste briefing

O pré-refinamento **não deve** tratar a F2 como uma lista de 8 tabelas a criar. Estas são as
decisões abertas, e são elas que decidem se a fase cabe num run ou precisa ser partida.

### 4.1 Duas das três regras portadas **não têm golden**

Os artefatos de caracterização capturados do Frappe são seis:
`metragem.json`, `calcular-mora.json`, `marcar-cobrancas-vencidas.json`,
`atualizar-atrasos-cobrancas.json`, `encerrar-contratos-vencidos.json` e `contrato-pdf.txt`.

**Apenas `metragem.json` serve à F2.** As outras cinco são da F3 e da F5. Isso significa que
**ativação de contrato (~340 linhas) e cancelamento em cascata (~174 linhas) serão reimplementadas
sem oráculo capturado** — e são justamente as duas regras mais complexas da fase, com efeito
colateral em cascata sobre outras entidades.

É a tensão mais importante do brainstorm. Direções possíveis:

- **capturar golden agora**, rodando contra o `/opt/frappe` que ainda está de pé (é legítimo e há
  precedente — a caracterização foi feita assim, com `bench backup` e site próprio);
- **derivar a especificação por leitura do código legado** e aceitar equivalência declarada, não
  provada;
- **fatiar de modo que as regras entrem depois**, com as entidades primeiro;
- alguma combinação — por exemplo, capturar só a ativação, que é a que tem cascata.

O usuário precisa escolher, porque a escolha tem custo e prazo: o `/opt/frappe` só existe até a F7.

### 4.2 A fase cabe num run?

A F1 foi partida em duas **com menos escopo do que a F2 tem**. Aqui há 8 entidades, 3 regras
portadas, os IDs legíveis, os 3 campos de negócio e a criação de um pacote novo.

Cortes candidatos, a avaliar:

- **por agregado**: imóveis (`Conjunto`, `Imovel`, `Comodo`) → pessoas (`Locador`, `Locatario`,
  `Fiador`) → contratos (`Contrato`, `ContratoFiador`);
- **por camada**: schema + entidades primeiro, regras portadas depois;
- **por risco**: o CRUD simples numa fatia, as regras com cascata em outra.

O corte por agregado tem um atrativo: `Contrato` **depende** de imóvel e de pessoas, então a
dependência já sugere a ordem. Vale medir se o corte "depois das entidades, antes das regras"
sobrevive ao mesmo teste que rebateu o corte da F1 — isto é, se ele não atravessa a mesma camada.

### 4.3 Quem gera o código legível, e o que acontece sob concorrência

`CTR-2026-0001` é **único por empresa** e é exibido pelo frontend como título. Perguntas de produto,
não de implementação:

- o formato é o mesmo para as 8 entidades, ou cada uma tem o seu prefixo?
- o número reinicia a cada ano (o `2026` sugere que sim)?
- o que o usuário vê se duas criações concorrerem — e o buraco na sequência é aceitável?
- entidade criada e depois excluída **libera** o número?

Há um precedente medido no projeto: a F4 vai precisar de um contador `seu_numero` único do SaaS, e o
plano registra que o mecanismo atual do Frappe **quebraria no primeiro dia multi-empresa**. Vale não
repetir o erro na F2.

### 4.4 Quando `@sysloc/contracts` é publicado

O pacote nasce aqui, mas ele é **entregável do marco de entrega do backend** — é o que o React
importa. Tensão:

- publicá-lo já na F2 significa versioná-lo enquanto F3, F4 e F5 ainda acrescentam rotas;
- deixá-lo interno até a F6 significa que o frontend não pode começar antes.

A superfície da API só congela no **marco**, depois da F5 — então a F2 **acrescenta rotas
legitimamente**. O que se decide aqui é a política de versionamento do pacote, não o congelamento.

### 4.5 `status` calculado no servidor — onde começa

O plano fixa, para a F3, que `status` tem fonte única no servidor (hoje é derivado no cliente por
`normalizeStatus`). Mas `Contrato` **já tem** `statusContrato` no modelo que o frontend enxerga, e a
ativação e o cancelamento de contrato — regras da F2 — são exatamente o que muda esse status.

Vale decidir na F2 se o status do contrato já nasce calculado no servidor, ou se ele espera a F3.

### 4.6 Os 3 `Custom Field` de negócio

O plano os cita sem nomeá-los. O pré-refinamento precisa **descobrir quais são** — a fonte é o
`/opt/frappe`, ainda de pé — e decidir se algum deles carrega regra, ou se são campos simples.

### 4.7 Exclusão: o que "excluir cadastro" faz

`ACAO:excluir_cadastro` é ação sensível declarada, e a decisão 11 do plano registra que **empresa e
pessoa não são apagáveis**. Resta decidir, para as entidades da F2:

- exclusão é física ou lógica?
- o que acontece com um `Imovel` que tem contrato ativo?
- o cancelamento em cascata (a regra portada) e a exclusão são a mesma coisa ou coisas diferentes?

---

## 5. Fora do escopo desta fase

- **Cobrança, mora, régua, PDF e carnê** — são F3, e cinco dos seis goldens são de lá.
- **Integração bancária** — é F4.
- **Automações e agendamento** — é F5.
- **Qualquer código de frontend** — é gatilho de parada do repositório inteiro.
- **Painel Master** — feature própria, posterior à F7.

---

## 6. Débitos com gatilho que esta fase pode disparar

O `CLAUDE.md` mantém o índice; três são relevantes aqui:

- **D38** (`apps/api/src/autenticacao/senha.controller.ts`) — `validar()` está na terceira cópia e
  fecha na **quarta**, ou na primeira task cujo escopo já inclua os três arquivos. **A F2 cria
  controladores novos**, então provavelmente dispara.
- **D32 · F0/T6** (`apps/worker/src/fila.ts`) — dispara na **primeira fatia que enfileirar tarefa de
  negócio**. Só se a F2 enfileirar algo; a princípio ela é síncrona.
- **D28 · F0/T5** — consumidor novo de `packages/shared/test/` por caminho relativo profundo.

Há também um módulo comum novo em `apps/api/src/comum/esquema-de-erro.ts`, criado no fechamento da
F1: **os controladores da F2 devem importar de lá**, não copiar.

---

## 7. Fatos a confirmar durante o pré-refinamento

Marque como `[DÚVIDA]` no artefato o que não se resolver:

1. Quais são os 3 `Custom Field` de negócio, e algum deles carrega regra?
2. A metragem tem golden — as outras duas regras terão? (ver §4.1)
3. O formato do código legível por entidade — existe convenção no Frappe a preservar?
4. `Comodo` é entidade própria ou detalhe de `Imovel`? O nome sugere composição.
5. `ContratoFiador` é tabela de ligação ou tem atributos próprios?
6. Há entidade no frontend que o inventário dos 35 endpoints usa e que **não** está nas 8?

---

## 8. Critérios de saída deste pré-refinamento

O artefato deve permitir decidir, sem reabrir a conversa:

- [ ] se a F2 é **uma fatia ou mais de uma**, e qual o corte, com a razão medida
- [ ] o que se faz sobre a **ausência de golden** para ativação e cancelamento
- [ ] a política do **código legível**: formato, escopo de unicidade, comportamento sob concorrência
- [ ] se `@sysloc/contracts` é publicado nesta fase ou só declarado
- [ ] se o `status` do contrato já nasce calculado no servidor
- [ ] o que "excluir cadastro" significa para cada entidade
- [ ] o framework recomendado (o plano propõe **SDD**; o pré-refinamento pode promover ou rebaixar)
- [ ] se alguma decisão desta fase merece **ADR nova** — em especial o código legível e a política de
      exclusão, que são transversais às fases seguintes

---

## 9. Observações de método

- O `/opt/frappe` **ainda está de pé** e consultá-lo é legítimo — mas o site `frontend` é
  **produção**: nada destrutivo. A caracterização já estabeleceu o padrão seguro (`bench backup` →
  site próprio).
- Este projeto roda **exclusivamente em Opus**, e todo artefato é em **português brasileiro**.
- O pré-refinamento é brainstorm de produto: **sem endpoints, sem schema, sem arquitetura fina**.
  Onde este briefing cita estrutura, é para ancorar viabilidade — não para ser copiado na spec.
