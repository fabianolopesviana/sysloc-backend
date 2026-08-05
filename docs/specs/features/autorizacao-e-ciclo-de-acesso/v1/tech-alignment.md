# Tech Alignment — `autorizacao-e-ciclo-de-acesso` v1

| | |
|---|---|
| **Feature** | `autorizacao-e-ciclo-de-acesso` |
| **Versão** | v1 |
| **Framework** | SDD |
| **Variante** | `backend` |
| **Definição** | `docs/prds/features/autorizacao-e-ciclo-de-acesso/v1/prd.md` |
| **Discovery lido** | `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/pre-refinement.md` |
| **ADRs consultadas** | **ADR-0010** (efetivo do perfil com overrides, na sessão, revalidado por versão) · **ADR-0011** (cobertura de autorização declarada por rota, com default que nega — nasceu da decisão D2 abaixo) · **ADR-0008** (isolamento garantido pelo banco) · **ADR-0009** (fronteira identidade × negócio por schema) · **ADR-0012** (forma canônica do contrato, com a chave exposta variando por classe de entidade — substitui a ADR-0007) · **ADR-0006** (ambiente de verificação separado) |
| **Data** | 2026-08-04 |
| **Status** | Decidido |

---

## Contexto técnico

A fatia anterior entregou resolução de contexto de tenant e admissão de sessão, e deixou **duas lacunas nomeadas por escrito no próprio código**, ambas endereçadas a esta fatia. A primeira: o ponto onde a sessão é resolvida **não reavalia estado por requisição** — desativação de pessoa e suspensão de empresa posteriores à entrada mantêm a sessão de pé até o vencimento. A segunda, registrada como advertência: avaliar esse estado ali criaria *"uma segunda definição de recusa ao lado da barreira, livre para divergir dela"*. As duas juntas fixam a forma da solução antes de qualquer alternativa ser considerada — o encerramento tem de acontecer **na origem do evento**, não no ponto de consumo.

O invariante central desta fatia é de **topologia**, não de regra: existe **um** ponto de aplicação da decisão de acesso, e a regra que ele aplica vive **fora** dele. É o padrão que a fatia anterior já estabeleceu e que os dois gates aprovaram — a decisão sobre o alcance da sessão restrita é *consultada* no ponto de aplicação e *definida* em módulo próprio. Regra instalada por ponto de consumo sobrevive até o ponto seguinte esquecer, que é o defeito estrutural que o Protocolo Antirregressão documenta com evidência desta base.

O segundo invariante é de **cobertura**: a ausência de declaração precisa produzir recusa, nunca passagem. É a mesma forma que a fatia anterior deu ao isolamento — *nasce protegida ou reprova a verificação; não há terceiro estado* — e é o que torna a quarta métrica do PRD (ausência de escapatória) verificável em vez de auditável à mão.

---

## Soluções técnicas decididas

### D1 — Ponto de aplicação da autorização: a guarda global existente, com a regra fora dela

**Escolhida**: estender o ponto de resolução de sessão já existente, que passa a **consultar** um módulo de decisão de autorização sem redefinir a regra.

**Rejeitadas**: *segunda guarda encadeada* — separaria responsabilidades ao custo de depender da ordem de execução entre guardas, que é configuração implícita, e reabriria como a segunda alcança a sessão que a primeira resolveu. *Verificação por manipulador* — clareza local máxima e a topologia exata que o Protocolo Antirregressão condena.

**Trade-off aceito**: o ponto de aplicação acumula mais uma responsabilidade. Mitigado pelo mesmo arranjo que já governa a sessão restrita: ele pergunta, não decide.

**Viabilidade**: reusa integralmente a topologia existente e o padrão de decisão externa. Nenhuma leitura nova.

### D2 — Forma da exigência: duas dimensões ortogonais, com default que nega

**Escolhida**: cada rota declara o que exige em **duas dimensões independentes** — perfil e chave do catálogo. Uma rota pode exigir uma, outra, ou ambas. **A ausência de declaração recusa**, e existe marca explícita para a rota que legitimamente não exige permissão alguma.

**Rejeitadas**: *dimensão única com chaves sintéticas para o operador do SaaS* — inflaria um catálogo que o PRD declara fechado em 17 entradas (RN-15). *Exigência só por chave, com as rotas do operador fora da governança* — produziria superfície publicada não governada, o oposto da métrica de ausência de escapatória. *Default que permite* — tornaria o esquecimento uma abertura em vez de uma recusa.

**Trade-off aceito**: toda rota passa a declarar algo, inclusive as que não exigem nada. É o custo que compra a verificação de cobertura.

**Consequência habilitada**: com o default fechado, a cobertura vira propriedade **consultável sobre a superfície publicada** — nenhuma rota sem declaração —, no mesmo espírito da guarda de catálogo da fatia anterior. É o que torna a quarta métrica do PRD mensurável.

**Viabilidade**: reusa o mecanismo de metadado por reflexão já em uso para marcar rota pública.

> **Candidata a ADR** — ver seção própria.

### D3 — Contador de versão de permissões: junto da identidade da pessoa

**Escolhida**: o contador vive do lado da identidade, viajando na leitura por chave primária que já acontece a cada requisição autenticada.

**Rejeitada**: *junto do vínculo de acesso* — mais fiel à letra da ADR-0009, que põe permissão do lado do negócio, ao custo de uma segunda leitura por requisição **e** de um ramo condicional por perfil, porque o operador do SaaS não pertence a empresa alguma e portanto não tem vínculo. O código atual declara não conter nenhum ramo por perfil e trata essa ausência como invariante deliberado.

**Trade-off aceito e justificado contra a ADR-0009**: o contador **não é permissão** — é o marcador que declara que o retrato transportado envelheceu. As permissões em si permanecem do lado do negócio, sob isolamento. A fronteira da ADR-0009 separa *dado de negócio* de *dado de identidade*; um marcador de invalidação de sessão é do segundo tipo.

**Viabilidade**: reusa a leitura única de identidade que a Revisão Técnica da fatia anterior impôs, e que a aplicação consome sem saber montar outra.

### D4 — Transporte do efetivo: no registro de sessão já persistido

**Escolhida**: o efetivo viaja no registro de sessão que já é persistido e já é lido por requisição, e é **reescrito quando a versão diverge** — uma escrita por mudança de permissão, não por requisição.

**Rejeitadas**: *armazenamento de cache próprio* — a infraestrutura existe, mas criaria um segundo lugar de verdade e invalidação distribuída para uma escala de 20 a 300 empresas; over-engineering pelo critério de simplicidade. *Recomputar a cada requisição* — é a alternativa que a **ADR-0010 rejeita nominalmente**. *Transportar sem reescrever de volta* — evitaria escrita no caminho de leitura, ao custo de toda requisição seguinte daquela pessoa recomputar até o próximo login, degenerando na alternativa já rejeitada para quem teve permissão alterada.

**Trade-off aceito**: o registro de sessão cresce, e há uma escrita no caminho de leitura — limitada à requisição em que a divergência é detectada.

### D5 — Invalidação por evento: pelo caminho do próprio arcabouço · decisão direta

**Escolhida**: o encerramento acontece **na origem do evento**, pelo caminho que o arcabouço de identidade publica, encerrando por pessoa; a suspensão da empresa resolve para as pessoas dela.

**Sem leque real.** *Apagar direto no armazenamento* criaria um segundo caminho de escrita sobre dado que não é do produto. *Marcar e recusar no ponto de consumo* é precisamente a segunda definição de recusa contra a qual o código da fatia anterior adverte por escrito, e ainda manteria a sessão de pé — contrariando a RN-04, que exige encerramento imediato e não recusa posterior.

**Trade-off aceito**: suspender uma empresa custa uma operação por pessoa dela. Irrelevante na escala do produto.

### D6 — Conciliação entre a empresa do vínculo e a empresa da pessoa: restrição estrutural

**Escolhida**: a pessoa passa a ser referenciável pelo par **identificador + empresa**, e o vínculo de acesso referencia esse par. O vínculo incoerente — pessoa de uma empresa vinculada a outra — passa a ser **impossível pelo banco**, e não verificado.

**Rejeitadas**: *verificação no banco* — recusa a combinação incoerente, mas é verificação e não impossibilidade, e o custo de mantê-la recai sobre quem escrever a próxima referência. *Manter como registro* — é o que o débito herdado é hoje, e o próprio débito adverte que, sem decisão, a conciliação tende a nascer como validação de aplicação, que é o padrão que a ADR-0008 rejeita nominalmente.

**Trade-off aceito**: acrescenta ao lado da identidade uma restrição de unicidade redundante com a chave primária — exatamente o mesmo arranjo que o lado do negócio já usa para tornar a referência composta escrevível. **Não tenantiza a identidade**: não envolve política de isolamento, apenas unicidade e referência, de modo que a ADR-0009 permanece intacta. A pessoa sem empresa continua existindo e simplesmente não é alvo de vínculo.

### D7 — Desligamento da rota nativa de troca de senha · decisão direta com hipótese

**Escolhida**: a troca de senha passa a existir apenas na forma do produto, e a rota nativa deixa de ser publicada. O caminho **garantido** é a recusa no encaminhador, antes do repasse. **Se** o arcabouço permitir desabilitar a capacidade na própria configuração, esse é o caminho preferível — a rota deixa de existir em vez de ser barrada na borda. `[HIPÓTESE a validar contra a versão instalada]`

**Rejeitada**: *manter a rota nativa e barrar antes da escrita de credencial* — foi podada no discovery por amarrar a defesa à ordem interna de uma dependência de terceiro, medida numa versão específica e livre para mudar a cada atualização.

**Consequência declarada**: o inventário de rotas publicadas pelo encaminhador, hoje fixado por asserção na suíte da fatia anterior, **muda junto**. É alteração deliberada de escopo, e precisa entrar na especificação com esse nome — não como ajuste de teste. O Protocolo Antirregressão trata asserção afrouxada sem justificativa como violação crítica; a justificativa é esta decisão.

---

## Candidatas a ADR

**D2 — cobertura de autorização declarada por rota, com default que nega.** É transversal e evergreen: toda rota das fases seguintes declara o que exige, e a ausência recusa. Estende a ADR-0010 (que decide *como o efetivo é formado e revalidado*) para o eixo que ela não cobre — *como uma rota diz o que exige, e o que acontece quando ela não diz nada*. Custo de reversão alto: mudar o default depois de N rotas publicadas exige revisar todas.

```bash
/agent-spec-adr-create "cobertura de autorizacao declarada por rota com default que nega e verificacao sobre a superficie publicada"
```

> **D6 não é candidata**: estabelece precedente, mas hoje alcança uma única fronteira. Fica registrada aqui; se uma segunda fronteira identidade↔negócio surgir, promova.

---

## Restrições e invariantes técnicas

Herdadas, vinculantes, **não reabertas** por esta decisão:

1. **Um caminho só para o dado** (ADR-0008) — nenhum filtro por empresa na aplicação. O efetivo é montado sob o contexto de tenant já fixado; o isolamento é do banco.
2. **O contexto nunca é lido da requisição** (invariante 2) — vale para tudo que esta fatia acrescentar.
3. **Fronteira por schema** (ADR-0009) — identidade opera sem noção de tenant; toda tabela de negócio nasce isolada e com isolamento forçado, verificado por consulta ao catálogo.
4. **Forma canônica do contrato** (**ADR-0012**, que substituiu a ADR-0007 em 2026-08-04) — modelo de domínio em camelCase, recusa com código de enum fechado e status semântico. Acrescentar código é retrocompatível; renomear não é. **A chave exposta varia por classe de entidade**: negócio tenantizado expõe código legível; identidade — pessoa e empresa — expõe UUID. A clarificação nasceu do conflito literal detectado ao especificar esta fatia.
5. **Migração**: gerada a partir do schema declarado, com SQL à mão apenas para o que o gerador não emite. Migração é imutável — o que não entrar agora custa outra migração sobre um banco que já atende a operação.
6. **Ambiente de verificação separado** (ADR-0006) — a suíte executa contra instância efêmera, nunca contra o que atende a operação.
7. **Baseline antes e depois** (Protocolo Antirregressão) — e nenhuma alteração de código sob marcador de decisão fechada sem escalar.
8. **A superfície congela** no marco de entrega — o que esta fatia publicar é o que será consumido.

Decorrentes das decisões acima:

9. **Ponto de aplicação único** — a decisão de acesso acontece num lugar; a regra vive fora dele. Uma segunda avaliação em qualquer ponto de consumo é regressão de topologia, não otimização.
10. **Default fechado** — rota sem declaração de exigência recusa. A cobertura é consultável sobre a superfície publicada, nunca uma lista mantida à mão.
11. **A negação vence a concessão** (RN-01) — a precedência precisa de prova dedicada com falsificação, porque é a única barreira entre "permissão retirada" e "permissão que continua valendo por outro caminho".
12. **Encerramento na origem do evento** — nunca por reavaliação no ponto de consumo.

---

## Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**

- **Composição da migração única** — quais partes vêm do gerador e quais exigem SQL à mão, e em que ordem. O acréscimo de valor a enum fechado (herdado do `P-T6-1`) tem restrições próprias de ordenação no banco que precisam ser verificadas contra a versão em uso.
- **Onde o módulo de decisão de autorização é publicado** e qual a sua superfície — o plano da fase determina o pacote; a forma da interface, não.
- **Como o catálogo fechado é declarado** de modo que acrescentar uma entrada quebre a compilação de quem trata os casos, no mesmo espírito com que os perfis são hoje derivados do schema em vez de redigitados.
- **Estratégia de prova da precedência da negação** e da cobertura de rotas — o invariante 11 e o 10 exigem prova, e a forma dela é da especificação.
- **Ligação do limitador de taxa** (metade acionável do `P-T6-2`) — o alinhamento não decide parâmetros; a fatia anterior já declarou o limitador como camada adicional e não substituto do bloqueio por conta.

**Dependências de produto — não decididas aqui:**

- Nenhuma. As quatro dúvidas que o discovery deixou abertas foram fechadas no PRD (RN-02, RN-05, RN-11 e o caminho de socorro da US-07).

**Observação fora do escopo desta feature:**

- A **retenção do histórico de tentativas de entrada** (outra metade do `P-T6-2`) permanece endereçada à operação, não a esta fatia. Registrado aqui apenas para que não se perca ao fechar a metade que entra.
