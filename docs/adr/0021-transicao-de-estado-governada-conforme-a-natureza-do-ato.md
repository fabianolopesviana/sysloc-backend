---
id: 0021
title: Transição de estado de negócio é rota própria, governada conforme a natureza do ato
status: accepted
date: 2026-08-09
tags: [state-management, architecture]
---

# 0021 - Transição de estado de negócio é rota própria, governada conforme a natureza do ato

## Context

A ADR-0019 fixou que toda transição de estado é rota própria governada pela chave de ação sensível
correspondente, e as duas metades da frase têm alcances diferentes que ela não separou. A fatia
`contratos-de-locacao` encontrou o caso na `POST /v1/imoveis/{id}/situacao-de-locacao`: alternar um
imóvel entre `DISPONIVEL` e `INDISPONIVEL` é transição de estado, mas **não existe ação sensível
correspondente** — o catálogo é fechado nas sete chaves da ADR-0011, que não cresce sem decisão
explícita, e a própria 0019 registra isso entre os *Cons*. Cumprir a 0019 ao pé da letra exigiria
criar uma chave contra a ADR-0011, ou reusar `ACAO:excluir_cadastro`, que a 0019 rejeita
nominalmente. A rota foi publicada com a exigência de área apenas, e a divergência ficou aberta
como débito com prazo até o congelamento da superfície da API.

## Decision

Toda transição de estado de entidade de negócio é uma **rota própria** — nunca um campo gravado por
atualização parcial do recurso —, e a governança segue a **natureza do ato**: quando ele é um ato
sensível, a rota exige a chave de ação correspondente do catálogo fechado; quando é **atributo
operacional do cadastro**, que não transfere direito nem move dinheiro nem altera o que outra
entidade pode fazer, a rota exige apenas a área.

**Instâncias declaradas da segunda classe** — a que exige apenas a área:

- a **situação de locação do imóvel** (`contratos-de-locacao`, v1);
- **acusar pagamento de cobrança** (`cobranca-e-mora`, v1) — o ato **registra** dinheiro que se moveu
  fora do sistema; ele não o move;
- **cancelar cobrança** (`cobranca-e-mora`, v1) — o ato tem substituta prevista, logo é reversível, e
  o registro permanece legível pela ADR-0014.

Da **primeira classe** — a que exige a chave de ação do catálogo fechado — são a **ativação de
contrato**, o **cancelamento de CONTRATO** e a **retirada de circulação**, as três com chave própria
já existente (`ACAO:ativar_contrato`, `ACAO:cancelar_contrato`, `ACAO:excluir_cadastro`).

> **Emenda de 2026-08-10.** A redação original desta seção dizia *"ativação, cancelamento e retirada
> de circulação são da primeira"*, sem qualificar de que entidade — e a enumeração espelhava as três
> chaves que existiam à época, todas do domínio de contrato e cadastro. Lida ao pé da letra, ela
> punha o cancelamento de **cobrança** na primeira classe, o que contradiz a exigência publicada
> pelas duas rotas de transição da fatia `cobranca-e-mora`. **A decisão não mudou**: mudou o registro
> dela, que passou a nomear a entidade e a declarar as instâncias novas — que é o que esta ADR pede,
> ao entregar a classificação do ato à fatia (ver o primeiro dos *Cons*). O que a tornou necessária
> é o que a **terceira** das *Alternativas* já previa — a de conviver com a divergência declarada:
> *"um gate futuro leria violação onde houve decisão"* — e leu, no Gate 2 da T7. A evidência que
> sustenta as duas instâncias novas é o **catálogo fechado** — a ADR-0011 é quem o declara fechado, e
> quem o **enumera** é `packages/auth/src/catalogo-de-permissoes.ts` (materializando a decisão 38 do
> `.claude/plans/plano-saas.md`): dentro de `TELA:financeiro` há **duas** ações sensíveis,
> `ACAO:emitir_boleto` e `ACAO:solicitar_baixa_de_boleto`, e **nenhuma** para pagamento ou
> cancelamento de cobrança. Quem fechou o catálogo tinha as operações de cobrança à vista e concedeu
> chave própria só às que falam com o banco.

> **Emenda de 2026-08-22.** As duas metades acima foram redigidas para o ato que **entra pela
> superfície**, e a fatia `automacoes-agendadas` (F5) trouxe o primeiro caso do repositório em que não
> há superfície: o **encerramento de contrato vencido**, disparado por relógio — sem requisição, sem
> sessão e sem ator. **A decisão não mudou**; muda o registro dela, que passa a declarar o alcance de
> cada metade:
>
> - A metade **categórica** — *rota própria, nunca campo gravado por atualização parcial do recurso* —
>   **vale sem exceção**, e aqui é cumprida **por construção**: não há recurso sendo editado, e
>   `status` não existe em `esquemaDeContratoNovo` nem em `esquemaDeContratoAlterado`, de modo que o
>   `strictObject` o recusa por chave desconhecida.
> - A metade da **governança** — *exige a chave do catálogo, ou exige apenas a área* — **pressupõe uma
>   sessão a autorizar**, e sem requisição ela não tem sujeito: a pergunta não fica sem resposta, fica
>   sem antecedente. O que governa a transição sem ator é a **procedência da carga** (ADR-0024) — o
>   identificador de empresa vem de quem já detinha direito a ele, a enumeração de empresas ativas do
>   despachante — e a ausência de qualquer rota que aceite `empresaId` de fora.
>
> **O precedente não é novo, e é da própria F2**: `definirSituacaoDeLocacaoDoImovel` é porta estreita
> cujos chamadores o docblock enumera como *"a ativação e o cancelamento de contrato … e a rota de
> situação de locação"*. A transição `DISPONIVEL → LOCADO` **já ocorre sem passar pela rota própria
> dela**, como efeito interno na mesma unidade de trabalho, e assim passou pelos dois gates. O que a
> F5 acrescenta não é a ausência de rota — é a ausência de **ato de origem**: só o vencimento.
>
> **Instância declarada da terceira classe** — a que não tem governança a exigir porque não tem ator:
>
> - o **encerramento de contrato vencido** (`automacoes-agendadas`, v1), e o efeito que ele produz no
>   imóvel pela mesma porta estreita, na mesma unidade de trabalho.
>
> ⚠️ **O alcance é do ato AUTOMÁTICO, e não do ato equivalente pela tela.** Um encerramento **manual**
> transferiria direito — libera o imóvel para nova locação — e seria da **primeira** classe, sem chave
> correspondente no catálogo fechado da ADR-0011: exatamente o dilema que esta ADR nasceu para
> resolver. Publicá-lo exige decisão nova, e ela **não** está tomada aqui. Esta emenda não cria chave,
> não autoriza rota e **não é fundamento para publicar transição sem exigência**.
>
> **Por que emenda, e não ADR nova**: a decisão é a mesma, e ADR nova com decisão igual é churn — o
> critério do `CLAUDE.md`. **Por que registrar, em vez de conviver**: a **terceira** das *Alternatives*
> abaixo rejeita a convivência porque *"um gate futuro leria violação onde houve decisão"* — e leu, no
> Gate 2 da T7, que foi o que produziu a emenda de 2026-08-10. Deixar sem registro seria repetir a
> escolha que já falhou uma vez nesta mesma ADR.

## Consequences

**Pros:**
- A metade que sempre importou — rota própria, nunca campo em atualização — vale sem exceção, e
  segue impedindo que quem edita o recurso transite o estado dele por tabela.
- A rota de situação de locação deixa de ser divergência declarada e passa a ser conformidade, o que
  destrava o congelamento da superfície para o handoff.
- O catálogo fechado da ADR-0011 continua fechado: nenhuma chave nasce para acomodar atributo
  operacional, e a matriz 10×7 não incha a cada estado novo.

**Cons:**
- Introduz um julgamento onde a 0019 tinha uma regra mecânica: a fatia precisa classificar o ato
  antes de escolher a exigência, e classificar errado para menos afrouxa a autorização.
- Um ato que hoje pareça operacional e amanhã seja sensível exige chave nova **e** mudança da rota
  publicada, que é custo de contrato depois do congelamento.

**Neutros:**
- Quais estados cada entidade tem continua sendo decisão da fatia dela; esta ADR fixa a forma da
  transição e o critério da exigência.
- O teste da natureza do ato é o efeito, não o verbo: `INDISPONIVEL` significa *"não ofereça nas
  buscas"*, e não *"proibido de locar"* — a recusa de alterar imóvel com contrato vigente é o que
  protege o invariante, e ela é de domínio, não de autorização.

## Alternatives considered

- **Criar `ACAO:definir_situacao_de_locacao`** — a leitura literal da 0019. Motivo da rejeição:
  contraria a ADR-0011, que declara o catálogo fechado nas sete chaves, e não poderia ser tomada sem
  supersedê-la também; abriria o precedente de o catálogo crescer por conveniência de cada fatia.
- **Reusar `ACAO:excluir_cadastro`** — aproveitar chave existente de efeito próximo. Motivo da
  rejeição: a 0019 já a rejeita nas Alternativas por serem efeitos diferentes, e quem marca um imóvel
  em reforma passaria a precisar da concessão de excluir cadastro.
- **Manter a 0019 intacta e conviver com a divergência declarada** — deixar a leitura só no docblock
  do controlador. Motivo da rejeição: depois do congelamento o documento entregue ao frontend cita a
  superfície publicada, e a divergência entre ela e o texto da ADR deixa de ser corrigível sem custo
  de contrato; um gate futuro leria violação onde houve decisão.
- **Voltar a situação de locação para o corpo do `PUT`** — se não é ato sensível, seria campo comum.
  Motivo da rejeição: reabriria o defeito que a fatia fechou — a escrita incondicional apagava o
  `LOCADO` em silêncio a cada alteração —, e é justamente a metade da 0019 que sobrevive intacta.

## Applied in

- `contratos-de-locacao (v1)` — `docs/specs/features/contratos-de-locacao/v1/tech_spec.md`
- `cobranca-e-mora (v1)` — `docs/specs/features/cobranca-e-mora/v1/tech_spec.md` (§11.2, a evidência
  do catálogo fechado que classifica os dois atos de transição da cobrança)
