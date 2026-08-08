# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `dominio-locacao` — o domínio de negócio da locação de imóveis
- **Fonte da ideia**: `docs/plano-backend-novo/briefings/f2-dominio-locacao.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-05
- **Versão**: v1
- **Status**: Pronto para próxima etapa
- **Variante**: `backend`
- **Relacionados**:
  - `docs/plano-backend-novo/plano-execucao.md` §F2 (a fase que esta feature materializa)
  - `docs/specs/features/fundacao-multitenancy-identidade/v1/` (F1, fatia 1 — isolamento e identidade)
  - `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/` (F1, fatia 2 — catálogo de permissões)
  - `docs/specs/features/caracterizacao-regras-legadas/v1/golden/metragem.json` (o único oráculo que serve à F2)
  - `docs/adr/` — **0006, 0008, 0009, 0010, 0011** ativas e vinculantes aqui; mais as que nasceram
    deste pré-refinamento: **ADR-0014** (exclusão lógica), **ADR-0015** (contador sequencial) e
    **ADR-0017** (chave exposta em três classes, substituindo a **ADR-0012**)

---

## 2. Ideia Resumida (uma frase)

Dar ao backend novo os substantivos do negócio — imóveis, pessoas e contratos — nascidos isolados por
empresa, com tipos reais, e com as regras de metragem, ativação e cancelamento portadas do Frappe até
o ponto em que elas ainda são da F2.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Onde a F2 termina e a F3 começa — as regras portadas atravessam cobrança e banco | explorar (prioridade 1) |
| B | Prova sem oráculo — ativação e cancelamento não têm golden, e o Frappe só existe até a F7 | explorar (prioridade 2) |
| C | Identidade visível — o que o usuário vê como identificador de cada classe de entidade | explorar |
| D | Ciclo de vida e exclusão — status no servidor, o que "excluir cadastro" faz | explorar |
| E | Tamanho da entrega — uma fatia ou mais, e por qual eixo cortar | explorar |

> A política de publicação do `@sysloc/contracts` foi tratada como decisão anexa ao ramo E, por decisão
> do usuário na Fase 1 (opção "Os 5, com 1 e 2 primeiro").

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Onde a F2 termina e a F3 começa

**Descoberta que reformulou o ramo** (leitura do código legado em `/opt/frappe`, ainda de pé):

- `contrato_ativacao/service.py` (340 LOC) faz, nesta ordem: `validar_contrato_para_ativacao` →
  imóvel vira `Locado` → `status_contrato = Ativo` → **`gerar_cobrancas_contrato` insere `Cobranca`** →
  **`enfileirar_emissao_boletos_sicoob_contrato`**. Apenas ~70 das 340 linhas tocam somente entidades da F2.
- `contrato_cancelamento/service.py` (174 LOC) **exige o PDF do contrato e bloqueia sem ele**, solicita
  **baixa dos boletos no Sicoob**, cancela as cobranças, carimba "CANCELADO" no PDF, libera o imóvel
  (`Disponível`) e grava `status_contrato = Cancelado`.

Ou seja: as duas regras que o plano de execução atribui à F2 **atravessam a F3 (cobrança e documentos)
e a F4 (integração bancária)**. Portá-las inteiras dentro da F2 é impossível sem arrastar duas fases.

**Direções candidatas:**

- **A1 — Núcleo local agora, efeitos por extensão declarada**: a F2 porta só o que toca entidades dela.
  - _Exemplo:_ ativar `CTR-2026-00021` responde com contrato ativo e imóvel locado, e **não cria nenhuma
    cobrança**; `gerarCobrancasAutomaticamente` é persistido e fica inerte até a F3 ligá-lo.
  - _Viabilidade:_ reusa `ACAO:ativar_contrato` e `ACAO:cancelar_contrato`, que já existem no catálogo
    fechado da F1. Não arrasta F3/F4. Custo: a regra completa só se prova na F3 — registrável como
    `DÉBITO COM GATILHO`, mecanismo que o projeto já opera (`.claude/rules/nao-regressao.md` §3-B).
- **A2 — Regra inteira, puxando `Cobranca` para dentro da F2**: a fase cresce para gerar as parcelas.
  - _Exemplo:_ ativar um contrato de 12 meses cria 12 cobranças no mesmo ato.
  - _Viabilidade:_ contraria o recorte do plano de execução (§F3) e o §5 do briefing, que declara
    cobrança fora do escopo desta fase.
- **A3 — Adiar ativação e cancelamento para uma fatia de transição F2/F3**: F2 entrega entidades e
  metragem; contrato nasce e morre em rascunho.
  - _Exemplo:_ a tela de contratos lista e cria, mas o botão "Ativar" não tem rota até a fase seguinte.
  - _Viabilidade:_ honesto sobre a dependência, mas deixa duas ações que o frontend já chama sem resposta,
    e duas chaves do catálogo declaradas e não usadas por uma fase inteira.

**Direção escolhida**: **A1** — o único que entrega valor visível sem arrastar duas fases. O que a F2
porta de cada regra:

| Regra | O que entra na F2 | O que fica para F3/F4 |
|---|---|---|
| Ativação | validações de admissibilidade · `statusContrato → ativo` · imóvel → `Locado` | geração de cobranças · emissão de boleto Sicoob |
| Cancelamento | `statusContrato → cancelado` · imóvel → `Disponível` | cancelamento das cobranças · baixa Sicoob · carimbo no PDF |

**Decisão embutida — o PDF no cancelamento**: hoje o legado **recusa** cancelar contrato sem PDF anexado.
Decidido com o usuário que isso é **acidente do legado, não regra de negócio**: a exigência existe porque
o legado precisa de um PDF para carimbar "CANCELADO". Sem geração de PDF na F2, exigir anexo bloquearia o
cancelamento sem razão de negócio. A F2 cancela sem exigir documento.

**Podadas / adiadas**: A2 (contraria o recorte do plano de execução §F3 e o §5 do briefing) ·
A3 (deixa `ACAO:ativar_contrato` e `ACAO:cancelar_contrato` declaradas e ociosas por uma fase inteira,
e duas ações que o frontend já chama sem resposta).

### Ramo B — Prova sem oráculo

Dos seis artefatos golden da fatia `caracterizacao-regras-legadas`, **só `metragem.json` serve à F2**.
Os outros cinco são da F3 e da F5. Ativação e cancelamento seriam reimplementadas sem oráculo capturado.

**Direções candidatas:**

- **B1 — Capturar golden completo agora**, num site restaurado de backup, cobrindo inclusive os efeitos
  de cobrança e Sicoob.
  - _Exemplo:_ rodar `ativar_contrato_e_gerar_cobrancas` num site de cópia e gravar o estado de
    `Contrato`, `Imovel` e `Cobranca` antes e depois.
  - _Viabilidade:_ há precedente (a caracterização foi feita assim, com `bench backup` e site próprio).
    Mas a base real tem **1 contrato e 0 fiadores** — os cenários seriam fabricados, não observados; e
    metade do que se capturaria (boleto Sicoob, PDF) **muda de forma** no backend novo (o Sicoob vira
    adaptador por provedor pela ADR-0001; o PDF vira `@react-pdf/renderer`).
- **B2 — Capturar golden só do núcleo local**, incluindo **todos os casos de recusa** de
  `validar_contrato_para_ativacao`.
  - _Exemplo:_ 6–8 cenários de recusa (contrato sem imóvel, imóvel já locado, datas incoerentes…) e 2 de
    sucesso, gravando somente o estado de `Contrato` e `Imovel`.
  - _Viabilidade:_ mesmo mecanismo já provado na caracterização; captura exatamente o que a F2 implementa.
    As validações são o que mais se perde numa reescrita e o que ninguém documentou.
- **B3 — Derivar por leitura e declarar equivalência**: ler as 340 + 174 linhas e escrever as regras como
  critérios de aceitação em pt-BR.
  - _Exemplo:_ "cancelar contrato libera o imóvel" vira CA verificado contra o critério, não contra o legado.
  - _Viabilidade:_ barato, sem prova de equivalência — mas é o único caminho possível para a parte que a F2
    não implementa e a F3 vai herdar.

**Direção escolhida**: **B2 + B3 combinados** — capturar golden novo do que a F2 executa (transições e,
sobretudo, as recusas), e documentar por leitura o que ela adia, para a F3 herdar sem reabrir o legado.

**Podadas / adiadas**: B1 (gastaria captura em efeitos que mudam de forma no backend novo) · B3 isolado
(deixaria as validações de admissibilidade sem oráculo, que é justamente onde a reescrita mais perde).

### Ramo C — Identidade visível

**Descoberta que reformulou o ramo** (consulta ao `/opt/frappe`): o "código legível por entidade" que o
plano descreve **não existe hoje em 6 das 8 entidades**.

| Entidade | Como se identifica hoje no Frappe |
|---|---|
| `Contrato` | `CTR-.YYYY.-.#####` → registro real `CTR-2026-00020` (**5 dígitos**, não 4) |
| `Cobranca` (F3) | `COB-.YYYY.-.#######` (7 dígitos) |
| `Conjunto`, `Imovel`, `Locador`, `Locatario`, `Fiador` | **hash de 10 caracteres** (`e5ecb26d5f`, `ae36025fb3`) |
| `Comodo`, `Fiadores` | child tables — nome gerado pelo Frappe |

Além disso, `Imovel.identificador_municipal` é **obrigatório e único** — é o identificador externo que o
imóvel já tem.

**Direções candidatas:**

- **C1 — Código legível só onde já existe**: `Contrato` na F2, `Cobranca` na F3. As demais expõem UUID; o
  rótulo humano é o nome próprio (`nomeImovel`, `nomeConjunto`, `nome` da pessoa).
  - _Exemplo:_ o select de imóveis mostra "Ap 101 — Ed. Aurora" e carrega UUID; nada muda para o usuário,
    porque hoje ele já carrega o hash `ae36025fb3`.
  - _Viabilidade:_ **contraria a ADR-0012 vigente à época**, que obrigava toda entidade de negócio
    tenantizada a expor código legível — a divergência foi detectada na geração do tech_spec e
    resolvida pela **ADR-0017**, que a substitui com três classes de chave exposta. Um contador por
    empresa, não oito.
- **C2 — Código legível para as 8**, com prefixo por entidade (`IMO-`, `LCT-`, `CNJ-`…).
  - _Exemplo:_ `IMO-2026-00007` no campo "Identificador" da tela de imóveis.
  - _Viabilidade:_ uniforme, mas inventa dado que ninguém pediu e dá ao imóvel um **segundo** identificador
    ao lado do municipal — ambiguidade garantida na tela. Oito contadores transacionais por empresa.
- **C3 — Código legível para o que se cita ao telefone**: contrato e imóvel.
  - _Exemplo:_ `CTR-2026-00021` e `IMO-2026-00007`.
  - _Viabilidade:_ mesmo problema do C2 no imóvel, em menor escala.

**Direção escolhida**: **C1** — o único identificador que o usuário lê e digita hoje é o do contrato.

**Política do sequencial do contrato** (decidida com o usuário):

- **Único por empresa** — o contador do Frappe é global no site e quebraria no primeiro dia multi-empresa,
  o mesmo erro que o plano registra sobre o `seu_numero` da F4.
- **Buraco na sequência é aceitável**; criações concorrentes não esperam uma pela outra.
- **Número nunca é reusado** — contrato excluído ou cancelado não libera o número.
- Formato: `CTR-{ano}-{sequencial}`. `[DÚVIDA]` — se o contador reinicia a cada ano (ver seção 13).

**Podadas / adiadas**: C2 e C3 (criam identificador novo para objetos que ninguém identifica por código
hoje, e no imóvel colidem com o identificador municipal que já é obrigatório e único).

### Ramo D — Ciclo de vida e exclusão

**Descoberta:** **não existe `DELETE` de cadastro de negócio** entre os 35 endpoints do
`levantamento-frontend.md`. O único `DELETE` é de `Usuario`, que é identidade e morreu na F1. A chave
`ACAO:excluir_cadastro` está declarada no catálogo, mas a funcionalidade que ela governa é **nova**, não
portada.

**Direções candidatas — exclusão:**

- **E1 — Exclusão lógica universal**: excluir = retirar de circulação. As pessoas já têm `ativo`; imóvel e
  conjunto ganham o equivalente.
  - _Exemplo:_ um locatário excluído some do select de novo contrato, mas segue legível no contrato de 2024
    que aponta para ele.
  - _Viabilidade:_ alinhado à decisão 11 do plano (empresa e pessoa não são apagáveis); o campo `ativo` já
    existe no modelo que o frontend enxerga (`PessoaItem.ativo`).
- **E2 — Física com recusa por vínculo**: apaga de verdade quando nada aponta; recusa quando há contrato.
  - _Exemplo:_ imóvel cadastrado por engano, sem contrato nenhum, é apagado do banco.
  - _Viabilidade:_ possível, mas o histórico de contrato referencia locador, locatário e imóvel; apagar
    destrói a leitura do passado, e a fronteira "tem vínculo / não tem" muda com o tempo.
- **E3 — Híbrido por classe**: pessoas e conjunto lógicos; imóvel sem contrato pode ser apagado.
  - _Viabilidade:_ duas semânticas para a mesma ação sensível, e o usuário não tem como saber qual vale.

**Direção escolhida**: **E1** — exclusão lógica universal para as entidades de negócio da F2.

**Registro obrigatório para a spec**: **cancelamento em cascata ≠ exclusão**. O cancelamento muda o status
de um contrato e dos dependentes dele; a exclusão retira um cadastro da circulação. São ações distintas,
com chaves distintas (`ACAO:cancelar_contrato` × `ACAO:excluir_cadastro`).

**Direção sobre o status do contrato** (adotada sem contestação do usuário):

- `statusContrato` nasce como **enum persistido na F2**, transicionado **só por operação de domínio**:
  criar → `rascunho`, ativar → `ativo`, cancelar → `cancelado`. O `docstatus` do Frappe morre aqui.
- `encerrado` e `rescindido` ficam para a **F5** (o golden `encerrar-contratos-vencidos.json` é de lá).
- _Motivo:_ ativação e cancelamento são regras **desta** fase e são exatamente o que muda esse status —
  deixá-lo derivado no cliente por mais uma fase contradiria o próprio escopo da F2.

**Podadas / adiadas**: E2 e E3 (destroem ou tornam ambígua a leitura do histórico) · derivação de status no
cliente (contradiz o escopo da fase) · `encerrado`/`rescindido` (adiados para a F5, que tem o oráculo).

### Ramo E — Tamanho da entrega

**Direções candidatas:**

- **F-a — Uma fatia só**: um run com as 6 tabelas, 2 filhas, 3 regras e o pacote novo.
  - _Exemplo:_ um `task_plan` com mais tasks que qualquer fatia já executada neste projeto.
  - _Viabilidade:_ a fatia 2 da F1 teve 9 tasks só para a matriz de permissões; a F1 inteira foi partida em
    duas **com menos escopo do que a F2 tem**.
- **F-b — Duas fatias por agregado**: (i) imóveis e pessoas + metragem + nascimento do `@sysloc/contracts`;
  (ii) contratos + ativação e cancelamento núcleo.
  - _Exemplo:_ a fatia 1 fecha com o CRUD de `Conjunto`, `Imovel`, `Comodo`, `Locador`, `Locatario`,
    `Fiador` e a metragem provada contra o golden; a fatia 2 abre com `Contrato` já podendo apontar para
    eles.
  - _Viabilidade:_ cada fatia é **vertical** (schema → rota → contrato ts-rest → teste), e a dependência
    `Contrato → Imovel + pessoas` já dá a ordem.
- **F-c — Duas por camada** (schema e CRUD de tudo, depois as regras).
  - _Viabilidade:_ **é o corte que a F1 rebateu** — entrega schema sem rota, atravessando a mesma camada.
    Poda com razão registrada.
- **F-d — Três fatias por risco** (cadastros / contrato e vínculos / regras com cascata).
  - _Viabilidade:_ isola bem o risco, mas a terceira fatia herda o mesmo problema do F-c: ela é uma camada,
    não uma vertical.

**Direção escolhida**: **F-b — duas fatias por agregado**, cortando depois de imóveis e pessoas.

> Nota para o corte: o segundo critério de aceitação da fase — *criar `Contrato` da empresa A apontando
> `Imovel` da B é recusado pelo banco* — só é verificável na **fatia 2**. Isso é esperado: é critério da
> fase, não de cada fatia. A fatia 1 é coberta pela guarda de cobertura de catálogo que a F1 instalou.

**Decisão anexa — `@sysloc/contracts`** (adotada sem contestação do usuário): o pacote **nasce interno na
F2 e só é publicado no marco de entrega do backend**. Motivo: a superfície da API só congela depois da F5;
publicar `0.x` que muda a cada fase geraria churn no consumidor sem ganho — o marco declara que o frontend
é implementado **depois** do handoff, então adiar a publicação não bloqueia ninguém.

**Podadas / adiadas**: F-a (escopo maior que qualquer run já executado aqui) · F-c (corte por camada, já
rebatido na F1) · F-d (a terceira fatia recai no corte por camada) · publicação do `@sysloc/contracts` na
F2 (adiada para o marco).

---

## 5. Problema

- **Qual é a dor real hoje?** O backend novo tem fundação (F0) e acesso (F1), mas **não tem negócio**.
  `packages/db/src/esquema/negocio.ts` não tem uma única tabela de negócio: só as de acesso e permissão.
  Nenhuma tela do produto pode ser servida pelo backend novo.
- **Como o problema aparece no dia a dia?** Toda operação real da imobiliária — cadastrar um imóvel,
  registrar um locatário, ativar um contrato — segue dependendo do `/opt/frappe`, que é o sistema que este
  projeto existe para substituir e que carrega os defeitos conhecidos: dinheiro em float, datas em texto,
  `name` como chave primária vazando para o frontend, e uma camada de ~36 mapeadores mais `toInt`,
  `toDouble` e `isTruthy` no cliente só para corrigir tipos.
- **Quem sente o impacto?** O gestor e o operador da imobiliária, hoje; e o projeto inteiro, porque
  **F3, F4 e F5 dependem destas entidades** — cobrança aponta para contrato, integração bancária aponta
  para cobrança, automação percorre contratos.
- **Por que resolver agora?** É a primeira fase que um usuário final enxergaria, e é a única que ainda pode
  consultar o `/opt/frappe` com folga — ele só existe até a F7.

---

## 6. Objetivo Principal

- **Resultado esperado**: o backend novo passa a falar o domínio da locação — imóveis, pessoas e contratos
  — em tipos reais e no modelo camelCase que o frontend já usa internamente, com isolamento por empresa
  garantido pelo banco.
- **Mudança de estado**: sai o `resource/{DocType}` genérico do Frappe, com coerção no cliente e `name`
  como chave; entram entidades próprias, com contrato explícito, código legível onde ele já existia, e
  transição de status decidida no servidor.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: o **operador da imobiliária** — cadastra imóveis, registra locatários e locadores,
  monta e ativa contratos. É quem alcança `TELA:imoveis`, `TELA:cadastros` e `TELA:contratos`.
- **Persona secundária**: o **administrador da empresa** — mesma superfície, mais as ações sensíveis
  `ACAO:ativar_contrato`, `ACAO:cancelar_contrato` e `ACAO:excluir_cadastro`, que a matriz da F1 concede
  ou retira por usuário.
- **Persona terciária**: `[HIPÓTESE]` o **agente do frontend**, que consumirá `@sysloc/contracts` depois do
  marco — não é usuário desta fase, mas é o destinatário do modelo de domínio que ela fixa.
- **Contexto de uso**: aplicação web, em desktop, dentro do horário comercial da imobiliária. O Master **não
  participa** desta fase — o painel dele é feature própria, posterior à F7.

---

## 8. Escopo Inicial (resultado da convergência)

**Fatia 1 — imóveis e pessoas**

- [ ] `Conjunto`, `Imovel`, `Comodo`, `Locador`, `Locatario`, `Fiador` nascendo com `empresa_id`, RLS
      forçada e FK composta `(id, empresa_id)` — a guarda de cobertura da F1 é o verificador
- [ ] Tipos reais: dinheiro em `numeric(15,2)`, datas em `date`/`timestamptz`, flags em `boolean`, status
      em enum — some a coerção do cliente
- [ ] Regra da **metragem** portada e provada contra `golden/metragem.json`, incluindo o caso de metragem
      nula (que o legado normaliza para `0.0`) e o valor sentinela `-1.0`
- [ ] `identificadorMunicipal` do imóvel preservado como **obrigatório e único por empresa**
- [ ] **Exclusão lógica** das entidades de cadastro, sob `ACAO:excluir_cadastro`
- [ ] `@sysloc/contracts` **nasce** como pacote interno do monorepo, com os primeiros contratos ts-rest + Zod
- [ ] Envelope de erro importado de `apps/api/src/comum/esquema-de-erro.ts` — **nunca copiado**

**Fatia 2 — contratos**

- [ ] `Contrato` e o vínculo com fiadores, com FK composta para imóvel e pessoas — é aqui que o critério
      *"contrato da empresa A apontando imóvel da B é recusado pelo banco"* se verifica
- [ ] **Código legível `CTR-{ano}-{sequencial}`**, único por empresa, buraco aceitável, número nunca reusado
- [ ] `statusContrato` como enum persistido, transicionado só por operação de domínio
      (`rascunho` → `ativo` → `cancelado`)
- [ ] **Ativação — núcleo local**: validações de admissibilidade, `statusContrato → ativo`, imóvel → `Locado`
- [ ] **Cancelamento — núcleo local**: `statusContrato → cancelado`, imóvel → `Disponível`, **sem exigir PDF**
- [ ] Os **2 `Custom Field` de negócio da F2**: `gerarCobrancasAutomaticamente` (persistido e inerte até a
      F3) e `pdfContratoArquivo`
- [ ] **Golden novo** das transições e, sobretudo, das **recusas** de admissibilidade da ativação
- [ ] `DÉBITO COM GATILHO` nos dois pontos de extensão, disparando na F3 (cobranças) e na F4 (baixa Sicoob)

---

## 9. Fora do Escopo (podado / adiado)

- **Geração de cobranças na ativação** — é F3; a F2 deixa o ponto de extensão declarado (poda de A2)
- **Emissão e baixa de boleto Sicoob** — é F4; entra pelo adaptador por provedor da ADR-0001 (poda de A2)
- **PDF de contrato e o carimbo "CANCELADO"** — é F3; a exigência de PDF no cancelamento foi classificada
  como acidente do legado e não se preserva
- **Status `encerrado` e `rescindido`** — são F5, que tem o golden `encerrar-contratos-vencidos.json`
- **`Cobranca` e o `pdf_boleto_arquivo`** — o terceiro `Custom Field` de negócio pertence à `Cobranca`,
  que é entidade da F3
- **Código legível para as demais 7 entidades** — poda de C2/C3; a **ADR-0017** fixa que a chave
  exposta é o código legível só onde há série declarada, e o UUID nos demais casos
- **Exclusão física de qualquer entidade** — poda de E2/E3
- **Publicação do `@sysloc/contracts`** — adiada para o marco de entrega do backend
- **Corte por camada ou por risco** — poda de F-c e F-d, pelo mesmo teste que rebateu o corte da F1
- **Qualquer código de frontend** — `[fora do escopo do projeto]`; é gatilho de parada declarado no
  `CLAUDE.md`
- **Painel Master** — `[fora do escopo do projeto]` nesta fase; feature própria, posterior à F7

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend
  Node/NestJS/PostgreSQL nativo, sem Docker, substituindo integralmente o Frappe/ERPNext de `/opt/frappe`.
  Oito invariantes não negociáveis, dos quais os de número **1, 2, 4, 5 e 6** governam diretamente esta fase.

- **Specs e PRDs existentes consultados** (`/docs/specs/**` + `/docs/prds/**`):
  - `fundacao-stack-nativa/v1` — **fundação**; entrega a stack, o ambiente efêmero de teste e o boot
    resiliente. Nada a redefinir aqui.
  - `fundacao-multitenancy-identidade/v1` — **pré-requisito direto**; entrega `empresa_id`, RLS forçada, FK
    composta, contexto por `AsyncLocalStorage` e a **guarda de cobertura de catálogo** que reprova tabela de
    negócio nascida incompleta. É o verificador do segundo critério de aceitação da F2.
  - `autorizacao-e-ciclo-de-acesso/v1` — **pré-requisito direto**; entrega o catálogo fechado de permissões,
    já contendo `TELA:imoveis`, `TELA:cadastros`, `TELA:contratos`, `ACAO:ativar_contrato`,
    `ACAO:cancelar_contrato` e `ACAO:excluir_cadastro`, mais a verificação que recusa rota governada sem
    exigência declarada.
  - `caracterizacao-regras-legadas/v1` — **oráculo parcial**; `golden/metragem.json` serve à F2, os outros
    cinco artefatos são F3/F5.
  - `integracao-bancaria-configuravel/v1..v6` — **adjacente, não sobreposta**; é F4 e opera sobre `Cobranca`.
  - `contencao-credencial-exposta/v1..v3` — adjacente; contenção de credencial do Frappe, sem relação com
    o domínio.
  - `backend-nativo-sysloc/v1` — o guarda-chuva do projeto.
  - **Nenhuma feature existente cobre entidades de locação** — a F2 é greenfield de domínio.

- **Capacidades reutilizáveis** (só para viabilidade):
  - **Persistência**: `packages/db` com Drizzle + `pgSchema('negocio')`; migrações `0000`–`0004` aplicadas,
    a F2 abre a `0005`. O padrão das quatro propriedades por tabela está documentado no cabeçalho de
    `packages/db/src/esquema/negocio.ts`.
  - **Autenticação / autorização**: `packages/auth` — `catalogo-de-permissoes.ts` fechado (10 telas × 7 ações),
    `MAPA_ACAO_TELA`, sessão com `versaoPermissoes` por pessoa. A F2 **não decide como autorizar**; decide
    o que cada rota exige.
  - **Envelope de erro**: `apps/api/src/comum/esquema-de-erro.ts`, criado no fechamento da F1 — os
    controladores da F2 **importam de lá**.
  - **Testes**: Vitest + `embedded-postgres` (ADR-0006), com a convenção `CA-xx → CT-xxx (RN-xx)`.
  - **Legado consultável**: `/opt/frappe` de pé; `bench --site frontend console` é leitura segura, e a
    caracterização já estabeleceu o padrão de escrita segura (`bench backup` → site próprio).

- **Conflitos / sobreposições detectados**:
  1. **O plano de execução §F2 atribui à F2 duas regras que atravessam F3 e F4.** Resolvido pelo ramo A
     (direção A1): a F2 porta o núcleo local e declara os pontos de extensão.
  2. **O plano descreve "código legível por entidade" e o formato `CTR-2026-0001`.** A consulta ao legado
     mostra que o código legível existe só em `Contrato` (e `Cobranca`, F3) e que o formato real tem **5
     dígitos** (`CTR-2026-00020`). Resolvido pelo ramo C (direção C1) — leitura do Invariante 5 como
     *preservar onde existe*. **Isto contrariava a ADR-0012**, que obrigava toda entidade de negócio
     tenantizada a expor código legível; a divergência foi detectada na geração do tech_spec e a
     **ADR-0017** a substituiu, admitindo a classe "entidade de negócio sem série declarada".
  3. **O plano fala em "3 `Custom Field` de negócio" na F2.** São três no site inteiro, mas **um deles é da
     `Cobranca`** (`pdf_boleto_arquivo`), que é F3. A F2 tem **dois**.
  4. **`ContratoFiador` não existe no legado** com esse nome — a child table se chama `Fiadores`.

---

## 11. Premissas e Decisões já tomadas

**Premissas:**

- `[HIPÓTESE]` As validações de `validar_contrato_para_ativacao` são majoritariamente locais (imóvel
  presente e disponível, datas coerentes, valor presente) e portanto capturáveis pelo golden B2. Se alguma
  delas consultar cobrança ou banco, ela cai no ponto de extensão junto com os efeitos — a captura vai
  revelar isso.
- `[HIPÓTESE]` A base real é pequena (3 conjuntos, 22 imóveis, 24 locatários, 3 locadores, 0 fiadores,
  1 contrato, 16 cobranças), então **desempenho não é dimensão de produto** desta fase; corretude e
  isolamento são.
- `[HIPÓTESE]` `Comodo` continua sendo composição de `Imovel` (é child table hoje, com 3 campos), mas ganha
  identidade própria no backend novo porque o frontend já o edita individualmente
  (`method/atualizar_comodo` passa `comodo_name`).
- `[HIPÓTESE]` O vínculo contrato↔fiador continua sendo elo puro — no legado a child table `Fiadores` tem
  **um único campo** (`fiador`, Link obrigatório), sem atributos próprios.
- `[HIPÓTESE]` `Fiador` com zero registros em produção significa que o fluxo de fiador nunca foi exercitado
  de verdade; a F2 o entrega pelo contrato do frontend, não por uso observado.

**Decisões já tomadas (fora de negociação):**

- A F2 porta apenas o **núcleo local** de ativação e cancelamento; cobrança e Sicoob entram por ponto de
  extensão declarado como `DÉBITO COM GATILHO`.
- A exigência de PDF no cancelamento é **acidente do legado** e **não** se preserva.
- Prova das regras: **golden novo do núcleo** (incluindo as recusas) mais **especificação derivada por
  leitura** para o que a F2 adia.
- Código legível **só onde já existe**: `Contrato` nesta fase. As demais entidades expõem UUID.
- Sequencial do contrato: **único por empresa**, **buraco aceitável**, **número nunca reusado**.
- "Excluir cadastro" é **exclusão lógica universal** — nada é apagado do banco.
- `statusContrato` é **enum persistido**, transicionado só por operação de domínio; `docstatus` morre.
- A F2 é **duas fatias, cortadas por agregado**: imóveis e pessoas primeiro, contratos depois.
- `@sysloc/contracts` **nasce interno na F2** e só é publicado no marco de entrega do backend.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: a ativação que não gera cobrança pode parecer "quebrada" para quem
  conhece o sistema atual → **mitigação**: a F2 não é entregue ao usuário final; a virada só acontece na F7,
  com o app inteiro funcionando contra o backend novo. O ponto de extensão fica registrado com gatilho na F3.
- **Risco de escopo (pode explodir?)**: **alto e conhecido**. As duas regras portadas são a porta de entrada
  para arrastar F3 e F4 → **mitigação**: a fronteira do ramo A está escrita na tabela "o que entra / o que
  fica"; qualquer task que crie `Cobranca` ou toque Sicoob é desvio de escopo, e o Gate 2 tem categoria
  própria para isso (`scope_deviation`).
- **Risco técnico ou operacional**: a captura do golden B2 escreve no Frappe. O site `frontend` é
  **produção** → **mitigação**: `bench backup` e site próprio, padrão já provado na
  `caracterizacao-regras-legadas`. Nada destrutivo no site de produção.
- **Risco de perda de conhecimento**: as validações de admissibilidade não estão documentadas em lugar
  nenhum e o `/opt/frappe` só existe até a F7 → **mitigação**: é exatamente o que B2 captura, e a razão de
  ele vir antes de B3.
- **Risco de privacidade / segurança / compliance**: as entidades da F2 carregam **dado pessoal** (CPF/CNPJ,
  RG, endereço, e-mail, telefone de locadores, locatários e fiadores) → **mitigação**: RLS forçada e FK
  composta impedem vazamento entre empresas pelo banco; a exclusão lógica preserva o histórico sem
  reter dado além do necessário. `[DÚVIDA]` retenção e anonimização de dado pessoal não têm política
  declarada no projeto (ver seção 13).
- **Débitos com gatilho que esta fase pode disparar**: **D38** (`validar()` na terceira cópia — a F2 cria
  controladores novos e **provavelmente dispara**), **D28** (consumidor novo de `packages/shared/test/` por
  caminho relativo profundo) e **D32** (só se a F2 enfileirar tarefa de negócio — a princípio ela é síncrona).

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **O sequencial do contrato reinicia a cada ano?** O formato `CTR-.YYYY.-.#####` sugere que sim
   no legado, mas o registro real (`CTR-2026-00020`) não distingue as duas leituras. Decidir na spec — a
   escolha muda a unicidade: `(empresa, ano, sequencial)` ou `(empresa, sequencial)`.
2. `[DÚVIDA]` **`Comodo` ganha rota própria ou só é editado dentro do imóvel?** Hoje há um endpoint
   dedicado (`method/atualizar_comodo`), mas o agregador `all_imoveis` devolve os cômodos aninhados.
3. `[DÚVIDA]` **`identificadorMunicipal` é único por empresa ou globalmente?** Hoje é único no site inteiro
   (constraint do Frappe), o que num SaaS multi-empresa impediria duas imobiliárias de cadastrarem o mesmo
   imóvel — provável defeito a corrigir, não comportamento a preservar.
4. `[DÚVIDA]` **A exclusão lógica esconde o registro dos selects e listas por padrão, ou há uma visão
   "incluir inativos"?** O frontend hoje filtra `["ativo","=",1]` nos selects de contrato, mas lista tudo
   nas telas de cadastro.
5. `[DÚVIDA]` **Existe política de retenção ou anonimização de dado pessoal?** Nada declarado no projeto; a
   exclusão lógica preserva tudo indefinidamente.
6. `[DÚVIDA]` **Os 17 campos de validação de e-mail/WhatsApp do `Locatario` entram na F2?** São estado de
   máquina de comunicação, cujo motor é da F5 — mas as colunas pertencem à entidade que nasce aqui.
7. `[DÚVIDA]` **Há entidade usada pelos 35 endpoints que não está nas 8?** Do inventário, `Atraso` (Single,
   vira por empresa), `Automação de cobrança` (Single), `Log Envio Cobranca` e `ConfiguracaoConta` ficam
   fora — todas de F3/F4/F5. Confirmado que nada de locação escapa; registrado como dúvida apenas porque a
   confirmação é por leitura do inventário, não por varredura do código React (que não existe neste servidor).

> **Nenhuma destas dúvidas é bloqueante.** Todas são decidíveis dentro do PRD/Tech Spec, e nenhuma muda o
> corte em duas fatias nem a fronteira do ramo A.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: A1 (núcleo local com extensão declarada) · PDF no cancelamento
  tratado como acidente do legado · B2+B3 (golden do núcleo + especificação derivada) · C1 (código legível
  só no contrato) · política do sequencial (por empresa, com buraco, sem reuso) · E1 (exclusão lógica
  universal) · status como enum persistido na F2 · F-b (duas fatias por agregado) · `@sysloc/contracts`
  interno até o marco.
- **Descartado com justificativa**: A2 (arrastaria F3 para dentro da F2) · A3 (deixaria duas chaves do
  catálogo ociosas por uma fase) · B1 (capturaria efeitos que mudam de forma no backend novo) · C2 e C3
  (inventam identificador e colidem com o identificador municipal) · E2 e E3 (destroem ou tornam ambígua a
  leitura do histórico) · F-a (escopo maior que qualquer run já executado) · F-c e F-d (corte por camada,
  já rebatido na F1).
- **Adiado**: geração de cobranças e PDF (F3) · baixa Sicoob (F4) · `encerrado` e `rescindido` (F5) ·
  publicação do `@sysloc/contracts` (marco de entrega) · `pdf_boleto_arquivo` da `Cobranca` (F3).
- **Provocações que mudaram o rumo** — três leituras do legado reformularam o briefing:
  1. **As regras "da F2" não são da F2.** Ler `contrato_ativacao` e `contrato_cancelamento` mostrou que
     elas geram cobrança, emitem boleto, exigem PDF e pedem baixa bancária. Sem isso, a fase teria sido
     especificada com uma fronteira que não existe, e o desvio apareceria só na execução.
  2. **O código legível não existe em 6 das 8 entidades.** A premissa "preservar IDs legíveis" virou
     "inventar IDs legíveis" sem que ninguém tivesse decidido isso. O dado real (`e5ecb26d5f` para imóvel,
     `CTR-2026-00020` para contrato) devolveu a decisão ao usuário.
  3. **"Excluir cadastro" não é portado — é novo.** Não existe `DELETE` de cadastro de negócio nos 35
     endpoints. A ação estava no catálogo desde a F1 e ninguém tinha notado que a funcionalidade nunca
     existiu.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** (5 ramos explorados, 9 direções escolhidas) | confirmado |
| Personas | **múltiplas personas** (operador, administrador da empresa; o consumidor do contrato depois) | confirmado |
| Novidade | **greenfield** (o schema de negócio não tem uma única tabela hoje) | confirmado |
| Decisão arquitetural transversal nova? | **sim** — política de exclusão e política de identificador legível/contador por empresa | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — para **cada uma das duas fatias**, executadas em sequência.

**Justificativa**: duas dimensões decidem sozinhas. **Novidade = greenfield**: o domínio inteiro não existe,
e as 8 entidades tornam-se a base sobre a qual F3, F4 e F5 são construídas — errar a forma aqui custa três
fases. **Decisão arquitetural transversal = sim**: a política de exclusão e a política de identificador
legível atravessam todas as fases seguintes e precisam de registro evergreen, não de nota numa task. A
amplitude (5 ramos, 9 direções convergidas) e as múltiplas personas confirmam, mas não são o que decide.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): o miniSpec atende `2-3` rumos, incremento e **nenhuma
decisão arquitetural transversal nova** — falha nos três critérios aqui. Ele entrega `scope.md` em vez de
PRD + Tech Spec, e o que esta fase mais precisa é justamente do que o `scope.md` não comporta: a
rastreabilidade `CA → CT (RN)` sobre regras portadas de um sistema legado, e o espaço para registrar a
fronteira F2/F3 com a precisão que impede o desvio de escopo. Numa fase cujo maior risco é **explodir para
dentro da F3**, a formalização é a mitigação, não a burocracia.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por três ordens de grandeza. TaskCard é
`0-1` rumo, só dev, ajuste pontual, sem decisão arquitetural. Aqui há 6 tabelas, 2 filhas, 3 regras portadas
de um sistema legado, um pacote novo e duas ADRs. Nem o fast-path CRUD se aplica: **não existe pattern de
CRUD estabelecido neste projeto** — a F2 é quem vai estabelecê-lo.

### 15.4 Próximo Passo

```bash
# 1. Registre as duas decisões transversais ANTES do PRD — elas atravessam F3, F4, F5 e F7:
/agent-spec-adr-create "exclusao logica universal para entidades de negocio"
/agent-spec-adr-create "identificador legivel e contador sequencial por empresa"

# 2. Depois, o PRD da PRIMEIRA fatia:
/agent-spec-sdd-generate-prd "cadastro de imoveis e pessoas do dominio de locacao"

# 3. Só quando a fatia 1 fechar, a segunda:
# /agent-spec-sdd-generate-prd "contratos de locacao com ativacao e cancelamento"
```

> **Por que duas ADRs, e por que antes do PRD.** A **exclusão lógica** decide o que "apagar" significa para
> toda entidade de negócio do produto — F3 (cobrança cancelada), F5 (contrato encerrado) e F7 (virada)
> herdam a decisão, e nenhuma ADR existente a cobre. O **identificador legível com contador por empresa**
> tem consumidor já nomeado no plano: a F4 precisa de um `seu_numero` único do SaaS, e o plano registra que
> o mecanismo atual do Frappe **quebraria no primeiro dia multi-empresa** — a política do contador por
> empresa, com buraco aceitável e sem reuso, é a mesma dos dois casos e merece ser decidida uma vez.
>
> A escolha do código legível **só no contrato** foi registrada aqui como aplicação da ADR-0012 — e
> **isso estava errado**: a ADR-0012 obrigava toda entidade de negócio tenantizada a expor código
> legível, e a leitura "a chave varia por classe" veio da linha-resumo do `CLAUDE.md`, não do texto
> da decisão. O conflito foi detectado na geração do tech_spec desta fatia e resolvido pela
> **ADR-0017**, que substitui a 0012 com três classes de chave exposta.
>
> **Uma fatia de cada vez.** Duas fatias significam **dois ciclos completos** de SDD, não dois PRDs escritos
> de uma vez: a fatia 2 herda o `@sysloc/contracts` e o padrão de rota que a fatia 1 estabelece, e
> especificá-la antes disso seria adivinhar.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (partir mais fino) se durante a execução emergirem:
  - a captura do golden B2 revelar que as validações de admissibilidade **consultam cobrança ou banco** —
    a fronteira do ramo A muda, e a fatia 2 precisa ser recortada de novo;
  - as 17 colunas de validação de e-mail/WhatsApp do `Locatario` (dúvida 6) entrarem na fatia 1 — ela passa
    a ter duas naturezas (cadastro e máquina de comunicação) e vira candidata a partir em duas;
  - qualquer task precisar criar `Cobranca` ou tocar Sicoob — é sinal de que a fronteira vazou.
- **Downgrade** (miniSpec) se:
  - as duas ADRs forem recusadas pelo usuário e as decisões couberem no PRD — cai o sinal mais forte de SDD;
  - a fatia 2 chegar com a fatia 1 tendo estabelecido todo o padrão (schema, rota, contrato, teste) e as
    regras se revelarem menores do que a leitura sugere — aí ela é incremento sobre pattern estabelecido.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs/PRDs e capacidades concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar PRD / INTENT / TaskCard
