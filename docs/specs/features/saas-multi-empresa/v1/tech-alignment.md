# Tech Alignment — saas-multi-empresa v1

- **Feature**: `saas-multi-empresa` · **Versão**: v1 · **Framework**: SDD · **Variante**: backend
- **Definição**: `docs/prds/features/saas-multi-empresa/v1/prd.md`
- **Discovery lido**: `docs/specs/features/saas-multi-empresa/v1/pre-refinement.md` (com o levantamento de pré-condição da §12.1)
- **ADRs consultadas**: ADR-0001, ADR-0002, ADR-0003, ADR-0004 (`docs/adr/INDEX.md`)
- **Data**: 2026-07-29 · **Status**: Decidido

---

## Contexto técnico

A fundação do domínio não é reproduzível: dezenove cadastros existem apenas como estado do ambiente em operação, e seis regras de negócio ativas vivem no mesmo lugar, fora de controle de versão. A invariante que esta versão precisa estabelecer é a **reconstrutibilidade**: aplicar a descrição do repositório a um ambiente vazio produz a fundação completa, e aplicá-la de novo é no-op observável.

O ADR-0002 já fixou que a estrutura nasce descrita em arquivo; o ADR-0004 fixou que os endpoints herdados preservam seus nomes. O que resta decidir é **como** atravessar da situação atual para a desejada sem janela de inconsistência e sem regressão silenciosa — em particular na migração de regras cuja única especificação hoje é o próprio comportamento em produção.

O projeto já tem o caminho parcialmente trilhado: dois cadastros versionados no formato-alvo, três patches idempotentes registrados no ciclo de migração e uma suíte com teste de idempotência. A migração da configuração bancária é precedente direto — foi feita em **dois patches deliberadamente separados**, o primeiro copiando e o segundo desativando o legado, para não derrubar o que ainda não tinha sido portado. Essa separação é o padrão que esta versão reusa em escala.

---

## Soluções técnicas decididas

### D1 — Transferência dos cadastros para arquivo e descarte dos sem uso

**Por que decidir**: sair de "estado do ambiente" para "arquivo versionado" exige que a descrição em arquivo e a marca de propriedade do cadastro mudem juntas. Se divergirem, a aplicação seguinte recria o cadastro no formato antigo ou sobrescreve o novo.

**Solução recomendada: D1-b — exportação programática seguida de patch de convergência.** A descrição de cada cadastro é extraída do ambiente atual por rotina de exportação, revisada e versionada; um patch idempotente converge a marca de propriedade e descarta os cadastros sem uso. Reusa o formato dos dois cadastros já versionados e o padrão dos três patches existentes, incluindo o guard de idempotência no início.

Caminhos avaliados:
- **D1-a — transcrição manual da descrição**: escrever a descrição de cada cadastro à mão a partir da inspeção do ambiente.
  - _Exemplo:_ abrir cada um dos dezenove e reproduzir campos e ordem. · _Prós:_ nenhuma ferramenta nova; força revisão campo a campo. · _Contras:_ dezenove oportunidades de divergência silenciosa entre arquivo e ambiente; erro só aparece na primeira reconstrução.
  - _Viabilidade:_ não requer nada novo, mas o custo de erro é alto e a verificação é a própria reconstrução.
- **D1-b — exportação programática + patch de convergência** (recomendada): a descrição sai do ambiente por rotina; o patch converge propriedade e descarta resíduo.
  - _Exemplo:_ o mesmo desenho do patch que migrou a configuração bancária, generalizado para o conjunto. · _Prós:_ fidelidade garantida na origem; convergência repetível e testável pelo padrão de idempotência já existente na suíte. · _Contras:_ a descrição exportada carrega ruído do ambiente que precisa de curadoria antes de virar fonte.
  - _Viabilidade:_ reusa formato, padrão de patch e padrão de teste já provados no projeto. Nada novo é introduzido.
- **D1-c — manter a marca atual e versionar como conjunto de dados de configuração**: preservar os cadastros como estado exportável em vez de estrutura de aplicação.
  - _Exemplo:_ tratá-los como dado a carregar, não como definição. · _Prós:_ transição menor. · _Contras:_ contraria o ADR-0002, que fixou estrutura descrita em arquivo como definição; mantém a fundação dependente de carga em vez de reconstrução.
  - _Viabilidade:_ **conflita com ADR-0002** — descartada por isso, não por mérito técnico.

**Trade-off aceito**: a curadoria da descrição exportada é trabalho manual real e é onde mora o risco desta decisão. Aceito porque a alternativa (transcrição) tem o mesmo trabalho com fidelidade pior.

**Ordem imposta**: o descarte só ocorre **depois** que a convergência dos cadastros preservados estiver verificada. Descartar antes deixaria o conjunto num estado que nenhuma reconstrução reproduz.

### D2 — Comprovação de equivalência das regras migradas (RN-08)

**Por que decidir**: as regras a migrar não têm especificação escrita — sua única definição é o comportamento atual. Sem uma referência capturada **antes** da migração, "equivalência" vira leitura comparada de código, que não é verificável e não sobrevive à revisão.

**Solução recomendada: D2-b — caracterização capturada antes da migração, com granularidade por natureza da regra.** Antes de tocar em qualquer regra, captura-se o comportamento observável atual como referência versionada. A regra migrada é aceita quando reproduz essa referência. A granularidade difere pela natureza:
- Regra de agregação (a de metragem, com uma dezena de linhas): referência é o valor produzido para um conjunto de entradas representativas. Verificação direta, custo baixo.
- Regra que gera documento (a de contrato, com centenas de linhas): a referência é o **conteúdo extraído** do artefato produzido, não os bytes. Artefatos desse tipo carregam metadados de geração que variam a cada execução, então comparação binária acusa diferença onde não há.

Caminhos avaliados:
- **D2-a — comparação por leitura de código**: migrar e revisar lado a lado.
  - _Exemplo:_ conferir se a lógica transposta confere com a original. · _Prós:_ nenhum trabalho prévio. · _Contras:_ não é verificável nem repetível; não detecta divergência em caminho não exercido; a RN-08 exige comprovação, e leitura não comprova.
  - _Viabilidade:_ não satisfaz a RN-08 do PRD. Descartada.
- **D2-b — caracterização capturada antes, verificação contra a referência** (recomendada): ver acima.
  - _Exemplo:_ o mesmo papel que os testes de caracterização já cumprem na suíte atual. · _Prós:_ transforma a equivalência em critério objetivo; a referência sobrevive como rede de regressão para as versões seguintes. · _Contras:_ exige capturar a referência com a regra original ainda ativa, o que adiciona uma etapa antes da migração.
  - _Viabilidade:_ reusa a suíte e o padrão de teste existentes. Nenhuma tecnologia nova.
- **D2-c — execução em paralelo comparando saídas em operação**: manter as duas regras ativas e comparar resultados reais por um período.
  - _Exemplo:_ ambas rodando, divergências registradas. · _Prós:_ compara contra tráfego real, não contra amostra escolhida. · _Contras:_ as duas regras ativas ao mesmo tempo produzem efeito colateral em dobro — no caso da regra que gera documento, dois artefatos por gravação. **Contraria a RN-08**, que proíbe as duas ativas simultaneamente. O volume atual (um contrato) tornaria a amostra irrelevante de qualquer forma.
  - _Viabilidade:_ conflita com a RN-08 do PRD. Descartada.

**Trade-off aceito**: a referência capturada reflete o comportamento atual, inclusive eventuais defeitos. Aceito deliberadamente — o objetivo desta versão é migrar sem alterar comportamento; corrigir defeito herdado é escopo de outra.

### D3 — Onde vivem as rotinas agendadas e os scripts fora do repositório

**Por que decidir**: duas das seis rotinas apontam para scripts que não estão versionados em lugar nenhum. Versionar apenas a definição de agendamento deixaria metade da configuração fora do repositório e a reconstrutibilidade incompleta.

**Solução recomendada: D3-a — repositório como fonte única, instalador idempotente posiciona no sistema.** Tanto a definição de agendamento quanto os scripts invocados passam a viver no repositório; um procedimento de instalação idempotente os posiciona onde o sistema operacional espera. Nenhum script executável permanece fora de controle de versão.

Caminhos avaliados:
- **D3-a — repositório como fonte única + instalador** (recomendada): ver acima.
  - _Exemplo:_ o instalador roda duas vezes e o resultado é idêntico, sem entrada duplicada (é o CA-09). · _Prós:_ reconstrutibilidade completa; reinstalar é operação segura; alteração de rotina passa por revisão. · _Contras:_ introduz uma etapa de instalação que hoje não existe — configuração deixa de ser editada direto no servidor.
  - _Viabilidade:_ requer um diretório de implantação novo; o projeto já tem esse tipo de diretório para a configuração de rede, então o padrão existe.
- **D3-b — agendador aponta direto para o repositório**: manter os scripts apenas no repositório e referenciá-los de lá.
  - _Exemplo:_ a rotina invoca o caminho do repositório diretamente. · _Prós:_ elimina a etapa de cópia; uma fonte só, sem sincronização. · _Contras:_ acopla a execução de produção à presença e ao estado do diretório de trabalho do repositório — uma troca de ramo ou operação de versionamento passa a poder alterar o que roda em produção. Risco desproporcional ao ganho.
  - _Viabilidade:_ tecnicamente simples, operacionalmente frágil. Descartada.
- **D3-c — versionar só a definição de agendamento**: os scripts permanecem onde estão, sem versionamento.
  - _Exemplo:_ apenas os horários e destinos vão para o repositório. · _Prós:_ mudança mínima. · _Contras:_ deixa dois executáveis de produção fora de qualquer histórico — exatamente o problema que esta versão existe para resolver. Reconstrutibilidade fica parcial.
  - _Viabilidade:_ contraria o objetivo da versão. Descartada.

**Trade-off aceito**: a configuração de agendamento deixa de ser editável direto no servidor. É o custo pretendido — a edição direta é a causa do problema atual.

**Alcance transversal**: esta decisão governa toda rotina operacional futura, não só as seis atuais. **Candidata a ADR.**

### D4 — Execução sobreposta da rotina de maior frequência

**Decisão direta** (o projeto já determina): a rotina de maior frequência recebe **trava de execução no próprio script**, no mesmo mecanismo que a rotina de sincronização já usa hoje. Não há decisão aberta — existe padrão no projeto e ele resolve o caso.

Alternativas descartadas por ancoragem, não por mérito: trava no interior da aplicação (introduz coordenação onde o problema é de invocação, e não protege contra invocação concorrente vinda do agendador) e redução da frequência (altera comportamento operacional, o que esta versão não se propõe a fazer).

**Trade-off aceito**: a execução que encontrar a trava ocupada é descartada, não enfileirada. Coerente com uma rotina que roda a cada minuto — a próxima janela chega antes de qualquer enfileiramento valer a pena.

### D5 — Destino da suíte de verificação

**Por que decidir**: a suíte roda hoje contra o ambiente que atende a imobiliária, e parte dela manipula estrutura de permissão antes de reconstruí-la. É o maior raio de dano do repositório, registrado como débito na versão anterior. Esta versão monta um ambiente novo isolado — a oportunidade de resolver aparece de graça.

**Solução recomendada: D5-a — o ambiente novo passa a ser o destino da suíte assim que responder.** A verificação deixa de tocar o ambiente que atende a imobiliária. Não requer infraestrutura adicional: o ambiente já está no escopo da versão por outro motivo.

Caminhos avaliados:
- **D5-a — suíte no ambiente novo** (recomendada): ver acima.
  - _Exemplo:_ a verificação de reconstrução do zero (CA-01) só é honesta num ambiente que pode ser destruído; o ambiente novo é exatamente isso. · _Prós:_ elimina o maior raio de dano do repositório; torna a verificação de reconstrução verificável de verdade; custo incremental zero. · _Contras:_ enquanto o ambiente novo não responder, a suíte continua onde está.
  - _Viabilidade:_ reusa o ambiente que a versão já monta. Nada novo.
- **D5-b — manter a suíte no ambiente atual**: adiar para depois da virada.
  - _Exemplo:_ seguir como hoje até a operação migrar. · _Prós:_ nenhuma mudança de procedimento. · _Contras:_ mantém o débito por mais três versões e desperdiça o ambiente isolado que já estará montado. A verificação de reconstrução ficaria sem lugar honesto para acontecer.
  - _Viabilidade:_ possível, mas descarta um ganho gratuito.
- **D5-c — terceiro ambiente dedicado só a verificação**: montar um ambiente exclusivo.
  - _Exemplo:_ um ambiente a mais, só para a suíte. · _Prós:_ isolamento máximo. · _Contras:_ um terceiro ambiente num disco com folga apertada, para um ganho que o segundo já entrega. Over-engineering.
  - _Viabilidade:_ o disco não comporta com conforto. Descartada.

**Trade-off aceito**: existe uma janela, entre o início da versão e o ambiente novo responder, em que a suíte continua rodando onde roda hoje. Aceito por ser transitório e por já ser o estado atual.

**Alcance transversal**: onde a verificação roda afeta toda feature futura. **Candidata a ADR.**

---

## Candidatas a ADR

Duas decisões extrapolam esta feature e são candidatas a registro próprio. Recomendo criá-las antes do TECH_SPEC, para que ele as consuma prontas:

```
/agent-spec-adr-create "Rotinas operacionais versionadas no repositório com instalação idempotente"
/agent-spec-adr-create "Ambiente de verificação separado do ambiente que atende a operação"
```

A skill de ADR revalida os critérios canônicos — nenhuma das duas foi criada aqui.

---

## Restrições e invariantes técnicas

Toda implementação desta versão respeita:

1. **Reconstrutibilidade** — aplicar a descrição do repositório a um ambiente vazio produz a fundação completa (CA-01), e reaplicar é no-op observável (CA-02). Vale para cadastros e para rotinas agendadas.
2. **Idempotência de convergência** — todo patch desta versão pode rodar duas vezes sem duplicar nem corromper. Padrão já estabelecido nos três patches existentes.
3. **Nenhuma regra ativa em dois lugares** (RN-08) — a original só é desativada após a equivalência comprovada, e nunca coexistem ativas. Espelha a separação em dois passos do precedente da configuração bancária.
4. **Critério de descarte pelas três ausências** (RN-02) — código, aplicativo e vínculo estrutural. Cadastro vazio vinculado a cadastro em uso não é descartável.
5. **Contrato dos endpoints preservado** (ADR-0004) — a lista de nomes preservados é fechada; endpoints novos nascem com identificação completa.
6. **Barreira de rede intacta** — a decisão de preservar os nomes existe para não exigir alteração na barreira estabelecida pela versão anterior. Nenhuma solução aqui pode enfraquecê-la nem invalidar seus critérios de aceite.
7. **Governança de permissão inalterada** (ADR-0003) — os cadastros de negócio seguem regidos como está; alterações nessa área pertencem à versão seguinte.
8. **Ambiente novo não recebe operação real** (RN-06) — vale até depois da versão seguinte.
9. **Sem alteração no aplicativo** — consequência direta do ADR-0004; qualquer solução que exija tocar o aplicativo está fora desta versão.

---

## Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**
- Granularidade dos patches de convergência: um patch para o conjunto ou um por cadastro. Envolve rastreabilidade de falha contra volume de arquivos, e depende do desenho final da suíte.
- Composição do conjunto de entradas que serve de referência na caracterização (D2) — quais casos representam cobertura suficiente para cada regra.
- Forma de extração do conteúdo do artefato gerado para comparação (D2), dado que a comparação é de conteúdo, não de bytes.
- Ordem de execução entre a regra migrada e a regra de ativação já registrada no ciclo de eventos do cadastro de contrato — hoje há lógica em dois momentos distintos do ciclo, e a migração precisa preservar a ordem observável.
- Destino e política de descarte dos registros de execução das rotinas, hoje com destino duplicado e sem limite de crescimento.

**Dependências de produto (não decididas aqui):**
- Nenhuma. As decisões de produto necessárias já estão fechadas no PRD: personas, critério e consequência do descarte (RN-02, RN-03), momento da virada (RN-06) e ausência de funcionalidade nova.

**Observação fora do escopo (não vira proposta):**
- A rotina de maior frequência executa 1440 vezes por dia para um volume de dados pequeno. Revisar essa cadência é oportunidade real de eficiência, mas alteraria comportamento operacional e está fora do que esta versão se propõe. Registrado para consideração futura.
