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
