---
id: 0001
title: Modelo canônico de cobrança bancária com adaptador por provedor
status: accepted
date: 2026-07-20
tags: [architecture, data, http]
---

# 0001 - Modelo canônico de cobrança bancária com adaptador por provedor

## Context

A integração de boletos foi construída acoplada ao Sicoob: os módulos de operação montam o payload do provedor inline, interpretam o JSON cru da resposta e carregam a URL da API como constante repetida em quatro arquivos. A validação de "exatamente uma configuração ativa" está duplicada em cinco. Não há fronteira entre a regra de negócio da cobrança e o dialeto do banco, então qualquer mudança de provedor — ou de versão da API do provedor atual — exige alteração de código em toda a superfície e novo deploy. O mesmo acoplamento impede tornar a configuração (credenciais, URLs, certificado) um dado operável, porque parte dela vive no código.

## Decision

Toda a operação de cobrança bancária passa a trafegar em tipos canônicos agnósticos de provedor. O núcleo conversa apenas com a porta `AdaptadorCobrancaBancaria` (`obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar`); cada provedor implementa essa porta num adaptador próprio, responsável por toda a tradução de/para o formato do banco. Nenhum campo, URL ou vocabulário específico de provedor cruza a porta.

> **Emenda de 2026-08-15.** O *"apenas"* acima era exaustivo na data em que foi escrito: a única
> travessia que existia entre o produto e o provedor era a **operação de cobrança** — obter
> credencial de acesso, emitir, baixar, consultar título —, e uma porta bastava para descrevê-la. A
> fatia `fundacao-bancaria` (v1) institui depois uma **segunda** porta para o mesmo provedor,
> `PortaDeIdentidadeBancaria`, que responde à pergunta *"esta identidade serve?"* e não emite, não
> baixa e não consulta título algum; o consumidor dela é o **Admin na área de integrações**, e não o
> núcleo de cobrança. Lida ao pé da letra, a cláusula do *"apenas"* somada ao roster de cinco
> operações levaria quem a citasse a **fundir ou suprimir** essa porta. **A decisão não mudou**:
> mudou o registro dela, que passa a declarar o **sujeito** da exclusividade e o **critério** que
> separa uma porta irmã legítima de um contorno da fronteira:
>
> 1. **O sujeito do *"apenas"* é a operação de cobrança bancária** — não a fronteira inteira com o
>    provedor. O que a cláusula garante, e continua verdadeiro, é que **nenhuma** das cinco operações
>    nomeadas acima fica alcançável por fora da porta que esta ADR reserva.
> 2. **Uma porta irmã de configuração é conforme**, e o é por três condições cumulativas: (a) não
>    exerce nenhuma das cinco operações; (b) tem consumidor nomeado **fora** do núcleo de cobrança; e
>    (c) está sujeita **na íntegra** à mesma cláusula de vocabulário desta `Decision` — *"nenhum
>    campo, URL ou vocabulário específico de provedor cruza a porta"* —, que é propriedade do
>    **vocabulário** e não do número de operações. Ser porta irmã isenta do roster de cinco; não
>    isenta da cláusula, e a conformidade a ela é exigível por medição.
> 3. **O nome `AdaptadorCobrancaBancaria` permanece reservado** para a porta das cinco operações, que
>    nasce na fatia `integracao-bancaria-configuravel` (ii). Nenhuma porta irmã o usa, para que
>    aquela fatia não precise inventá-lo nem renomear o que a anterior deixou.
>
> Daí que a exclusividade que esta ADR sustenta é de **critério**, e não de contagem de portas:
> travessia que exerça qualquer das cinco operações por fora do adaptador do provedor continua
> proibida, por mais que se apresente com outro nome — e porta que não as exerça não vira exceção,
> porque nunca esteve sob o *"apenas"*.
>
> O que tornou a emenda necessária foi o **Gate 2 da T8 da fatia `fundacao-bancaria`**, que abriu
> esta `Decision` para julgar e mediu o vão: concordou com o mérito — a porta nova é conforme, e a
> cláusula de vocabulário está satisfeita —, e reprovou o **registro**, porque a justificativa morava
> só na §21.3 do tech spec daquela fatia e num docblock, e nenhum dos dois é lido por quem cita uma
> ADR abrindo a `Decision` dela. É exatamente o custo que a emenda de 2026-08-10 da ADR-0021 já
> registrava — *"um gate futuro leria violação onde houve decisão"*.

> **Emenda de 2026-08-17** (a decisão que ela registra foi **escalada ao usuário e decidida por ele
> em 2026-08-16**). A porta que esta ADR reserva — `AdaptadorCobrancaBancaria` — **nasce com QUATRO
> operações**, e não cinco: `emitir`, `solicitarRevogacaoDeBoleto`, `confirmarRevogacaoDeBoleto` e
> `consultarSituacao`. A obtenção da credencial de acesso acontece **dentro** do adaptador do
> provedor e **não cruza a porta**. Ela nasceu assim na fatia `emissao-e-conciliacao` (v1), e a
> justificativa completa está na **§21.1(1)** do tech spec dela
> (`docs/specs/features/emissao-e-conciliacao/v1/tech_spec.md`). **A decisão não mudou**: mudou o
> registro dela — quatro razões, a última medida só agora:
>
> 1. **A cláusula de fecho prevalece sobre o parentético.** A mesma `Decision` termina com *"Nenhum
>    campo, URL ou vocabulário específico de provedor cruza a porta"*, e uma credencial de acesso
>    `client_credentials` **é** vocabulário do provedor. Declarar `obter_token` na porta satisfaria o
>    parentético contradizendo a cláusula que o item 2 da emenda de 2026-08-15 declara ser
>    *"propriedade do **vocabulário**"* — e é a cláusula, não o parentético, que aquela emenda torna
>    exigível por medição.
> 2. **O que a exclusividade proíbe é o "por fora", e dentro do adaptador não é por fora.** O item 1
>    da emenda de 2026-08-15 fixa que o garantido é que nenhuma das cinco capacidades fique
>    *"alcançável **por fora** da porta que esta ADR reserva"*. A obtenção de credencial é exercida
>    pelo adaptador, para si mesmo, e por nenhum outro caminho.
> 3. **Assinatura sem chamador é o defeito que a fatia (i) recusou por escrito**, ao adiar esta porta
>    — *"seria escolher quatro assinaturas sem quem as chame, e a fatia (ii) as reescreveria contra a
>    API real"*. Declarar hoje uma operação que nenhum consumidor do domínio chama reintroduziria o
>    mesmo defeito.
> 4. **O roster do parentético nunca foi assinatura — é descrição de capacidade —, e a grafia é a
>    prova.** Ele é de **2026-07-20**, escrito sobre o substrato Frappe, em `snake_case`:
>    `obter_token`, `solicitar_baixa`, `confirmar_baixa`, `consultar`. **Nenhum** dos nomes
>    implementados o casa literalmente além de `emitir`. Uma leitura **literal**, nome a nome, nunca
>    teve como ser satisfeita — o que confirma que o parentético sempre descreveu **capacidades**, e
>    não a lista de membros de uma interface. Razão medida pelo **Gate 2 da T7 da fatia (ii)**, e não
>    anotada antes.
>
> **Correção ao item 3 da emenda de 2026-08-15.** Onde ali se lê *"O nome
> `AdaptadorCobrancaBancaria` permanece reservado para a porta das **cinco operações**, que nasce na
> fatia `integracao-bancaria-configuravel` (ii)"*, leia-se: **o nome permanece reservado para a porta
> de cobrança bancária, que nasceu na fatia (ii) com as quatro operações acima**. O texto de 2026-08-15
> fica preservado byte a byte, como manda a prática desta ADR; é esta linha que vale. A frase original
> descrevia com *"cinco"* exatamente o artefato que a fatia (ii) veio a criar com quatro — e o restante
> do roster de cinco **não** foi reescrito de propósito, pela razão do parágrafo seguinte.
>
> ⚠️ **O roster de cinco NÃO encolheu, e a distinção decide a conformidade.** O que a exclusividade
> alcança continua sendo as **cinco capacidades** nomeadas na `Decision` — obter credencial, emitir,
> solicitar baixa, confirmar baixa, consultar —, e nenhuma delas fica alcançável por fora do adaptador
> do provedor. O que se conta em **quatro** é a **superfície da interface**. Ler *"quatro"* como
> redução do alcance inverte a emenda de 2026-08-15, que declara a exclusividade *"de critério, e não
> de contagem"*.

## Consequences

**Pros:**
- A regra de negócio da cobrança deixa de mudar quando o provedor ou a versão da API muda.
- Suportar um segundo banco passa a ser escrever um adaptador, não editar o fluxo de cobrança.
- Configuração (credenciais, URLs, certificado) vira dado, viabilizando operação por tela em vez de deploy.
- Elimina a constante de URL repetida em quatro arquivos e a validação de configuração ativa duplicada em cinco.
- O enum canônico de situação do boleto substitui a interpretação ad-hoc de strings do provedor espalhada pelos módulos.

**Cons:**
- Introduz uma camada de indireção com um único provedor implementado — custo de abstração pago antes do benefício.
- Exige refatoração ampla sobre código de boleto em produção, com risco de regressão em fluxo que movimenta dinheiro.
- Mapeamento canônico incompleto pode perder informação do provedor; mitigado preservando o texto cru da situação ao lado do valor canônico.

**Neutros:**
- Campos sem equivalente canônico ficam num escape de parâmetros por provedor, mantendo o núcleo agnóstico sem bloquear especificidades.
- As assinaturas expostas ao frontend e o shape das respostas permanecem inalterados — a mudança é interna.

## Alternatives considered

- **Desacoplar apenas configuração e HTTP** — unificar a fonte de configuração e mover a URL para dado, mantendo os módulos falando o JSON do provedor. Motivo da rejeição: entrega o ganho operacional visível, mas preserva o acoplamento que torna cada mudança de provedor um refactor completo; a dívida seria paga depois com o mesmo custo, sobre código já em produção.
- **Faseamento: desacoplar agora, canonizar depois** — entregar a tela primeiro e o modelo canônico numa segunda etapa. Motivo da rejeição: implica tocar os mesmos arquivos de cobrança duas vezes, dobrando a exposição a regressão no fluxo mais sensível do sistema.
- **Adaptador sem modelo canônico** (tradução direta provedor-a-provedor) — Motivo da rejeição: sem um vocabulário neutro, cada novo provedor multiplicaria as traduções em vez de somar uma; o custo cresceria de forma quadrática.

## Applied in

- `integracao-bancaria-configuravel (v1)` — `docs/specs/features/integracao-bancaria-configuravel/v1/pre-refinement.md` (adoção planejada; implementação pendente)
