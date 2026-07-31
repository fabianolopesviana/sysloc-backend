# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: `saas-multi-empresa` v1 — Fundação versionável e ambiente de execução
- **Responsável/Autor**: sysloc
- **Data**: 2026-07-29
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - `docs/specs/features/saas-multi-empresa/v1/pre-refinement.md` — discovery que originou esta versão; a seção 12.1 traz o levantamento de pré-condição verificado contra a operação real
  - `docs/adr/0002-versionar-estrutura-de-dados-do-app-em-arquivo.md` — decisão que esta versão executa
  - `docs/adr/0004-endpoints-herdados-de-server-script-preservam-nome-curto.md` — decisão que rege o contrato dos endpoints migrados
  - `docs/specs/features/contencao-credencial-exposta/v1/` — versão anterior concluída; sua barreira de rede precisa ser preservada por esta

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?**
  A fundação do sistema não é reconstruível. A estrutura de dados do domínio existe apenas dentro do ambiente em operação, criada pela interface administrativa, e seis regras de negócio ativas — incluindo a geração do documento de contrato — vivem no mesmo lugar, fora de qualquer histórico de revisão. Não há como criar um ambiente equivalente do zero, revisar uma mudança antes que ela valha, nem descobrir quando e por que uma regra passou a se comportar de outro jeito.

- **Como funciona atualmente?**
  Dezenove cadastros do domínio existem só no ambiente de execução. Seis regras de negócio ativas também. A configuração das rotinas automáticas existe apenas na configuração do servidor, com duas rotinas apontando para arquivos que não estão em lugar nenhum do repositório. Um ambiente de homologação obsoleto ocupa espaço num disco que já está em 79% de uso. Qualquer alteração nessa fundação é feita direto no ambiente que atende a imobiliária, sem etapa de revisão.

- **Por que isso precisa ser resolvido agora?**
  As versões seguintes deste refactory introduzem três perfis de acesso, isolamento entre empresas e um painel próprio de administração. Nenhuma delas é viável sobre uma fundação que não se reproduz: não se testa isolamento em um ambiente que não pode ser recriado, e não se revisa uma regra de acesso que não está escrita em lugar nenhum. Esta versão é pré-condição das demais.

- **Quem sofre o impacto do problema?**
  Hoje, quem mantém o sistema — que trabalha sem rede de proteção e sem capacidade de reproduzir o ambiente. Indiretamente, a imobiliária em operação, cujo risco de parada aumenta a cada mudança feita direto no ambiente vivo.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?**
  Tornar a fundação do sistema reconstruível e revisável: estrutura de dados e regras de negócio descritas no repositório, rotinas automáticas descritas junto, e um ambiente novo preparado para receber as versões seguintes.

- **Qual mudança de comportamento esta feature deve gerar?**
  Passa a ser possível criar um ambiente completo a partir do repositório, sem nenhuma configuração manual. Toda alteração na fundação passa a ter etapa de revisão e histórico. A fundação deixa de ser algo que só existe num servidor.

- **Qual o resultado final esperado do ponto de vista do usuário?**
  Para quem mantém: um ambiente reproduzível e uma fundação auditável. Para a imobiliária: **nada muda** — nenhuma funcionalidade nova, nenhuma alteração de uso, nenhuma interrupção. A ausência de mudança percebida é o resultado esperado, não um efeito colateral.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)
- [ ] Estrutura de dados do domínio descrita no repositório e aplicável a um ambiente vazio, de forma repetível
- [ ] Regras de negócio hoje ativas apenas no ambiente de execução passam a viver no repositório, com comportamento preservado
- [ ] Cadastros sem uso comprovado são descartados, junto com os registros que contiverem
- [ ] Os endpoints já consumidos pelo aplicativo continuam respondendo pelos mesmos nomes após a migração
- [ ] Remoção do ambiente de homologação obsoleto, com espaço liberado medido antes e depois
- [ ] Ambiente novo montado e isolado, sem assumir a operação real nesta versão
- [ ] Rotinas automáticas descritas no repositório, incluindo as duas hoje ausentes dele, com procedimento de instalação repetível

### 4.2 O que está explicitamente fora do escopo
- [ ] Qualquer funcionalidade nova para a imobiliária — esta versão não entrega comportamento visível a quem opera
- [ ] Perfis de acesso, isolamento entre empresas e identidade de usuário — pertencem à versão seguinte
- [ ] A passagem da operação real para o ambiente novo — ocorre após a v2, não aqui
- [ ] Alteração no aplicativo web usado pela imobiliária — a decisão registrada em ADR mantém o contrato atual, justamente para evitá-la
- [ ] Cadastros com uso comprovado, mesmo que hoje estejam vazios — permanecem íntegros
- [ ] Configuração de integração bancária por empresa e rotinas por empresa — pertencem a versões posteriores

---

## 5. Usuários & Personas

- **Quem é o usuário principal?**
  **Mantenedor do sistema** — quem escreve o código, opera o servidor e responde pela continuidade do serviço. Hoje acumula os dois papéis.

- **Qual é seu objetivo ao usar essa feature?**
  Poder reconstruir o ambiente do zero, revisar qualquer mudança antes que ela valha, e preparar o terreno das versões seguintes sem expor a operação atual.

- **Quais dores/dificuldades essa feature resolve pra ele?**
  Elimina a dependência de configuração manual irreprodutível, tira as regras de negócio de onde não podem ser revisadas nem testadas, e recupera margem de disco para que dois ambientes coexistam.

- **Persona indireta**: **Imobiliária em operação** — usa o sistema diariamente para emitir cobranças, gerir contratos e imóveis. Não recebe nada novo nesta versão e não deve perceber que ela aconteceu. Sua presença aqui existe para transformar "não pode quebrar" em critério verificável.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como mantenedor, quero que a estrutura de dados do domínio seja reconstruível a partir do repositório, para criar um ambiente completo sem depender de configuração manual.
- **US-02**: Como mantenedor, quero que toda regra de negócio ativa viva no repositório, para poder revisá-la, testá-la e conhecer seu histórico de mudanças.
- **US-03**: Como mantenedor, quero descartar os cadastros sem uso comprovado, para que a fundação versionada não perpetue duplicação e resíduo.
- **US-04**: Como mantenedor, quero que os endpoints já consumidos pelo aplicativo continuem respondendo pelos mesmos nomes, para que esta versão não exija alteração no aplicativo nem na barreira de rede.
- **US-05**: Como mantenedor, quero remover o ambiente de homologação obsoleto e medir o espaço liberado, para ter margem comprovada antes de manter dois ambientes.
- **US-06**: Como mantenedor, quero um ambiente novo montado e isolado do atual, para prepará-lo com calma sem expor a operação.
- **US-07**: Como mantenedor, quero as rotinas automáticas descritas no repositório e instaláveis por um procedimento repetível, para que o agendamento deixe de existir apenas na configuração do servidor.
- **US-08**: Como imobiliária em operação, quero que nada do meu uso diário mude durante esta versão, para continuar emitindo cobranças e gerindo contratos sem interrupção.

---

## 6. Regras de Negócio (alto nível)

- RN-01 -- Nenhuma regra de negócio ativa pode existir apenas no ambiente de execução. Toda regra ativa vive no repositório e é revisável.
- RN-02 -- Um cadastro só é considerado sem uso quando reúne três ausências: nenhuma referência no código, nenhuma referência no aplicativo e nenhum vínculo estrutural com cadastro em uso. **Cadastro vazio mas vinculado a cadastro em uso não é sem uso** — a ausência de registros não é critério suficiente.
- RN-03 -- Descartar um cadastro sem uso implica descartar deliberadamente os registros que ele contiver. É decisão consciente de perda, não efeito colateral.
- RN-04 -- Os endpoints já consumidos pelo aplicativo preservam os nomes atuais após a migração; endpoints criados a partir de agora nascem com identificação completa. A lista de nomes preservados é fechada.
- RN-05 -- Aplicar a estrutura versionada é repetível: aplicá-la de novo não duplica cadastro nem altera dado existente.
- RN-06 -- O ambiente novo não assume a operação real nesta versão. A operação permanece no ambiente atual até depois da versão seguinte.
- RN-07 -- Instalar as rotinas automáticas é repetível: executar o procedimento duas vezes não duplica nenhuma rotina.
- RN-08 -- Uma regra migrada só substitui a original depois que a equivalência de comportamento for comprovada. As duas nunca ficam ativas ao mesmo tempo.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal
1. O mantenedor descreve no repositório a estrutura de dados que hoje só existe no ambiente de execução.
2. O sistema passa a poder aplicar essa descrição a um ambiente vazio, criando a estrutura completa sem intervenção manual.
3. O mantenedor transfere para o repositório as regras de negócio que hoje vivem no ambiente, uma a uma, comprovando que cada uma produz o mesmo resultado antes de desativar a original.
4. O mantenedor descarta os cadastros sem uso comprovado, ciente de que os registros neles se perdem.
5. O mantenedor remove o ambiente de homologação obsoleto e registra quanto espaço foi liberado.
6. O mantenedor monta o ambiente novo, isolado, e confirma que ele responde sem receber operação real.
7. O mantenedor descreve as rotinas automáticas no repositório e confirma que instalá-las duas vezes não as duplica.
8. Durante todo o processo, a imobiliária continua operando no ambiente atual sem perceber diferença.

### 7.2 Fluxos Alternativos
- Caso uma regra migrada **não** reproduza o comportamento original, a regra original permanece ativa e a migração daquela regra não é concluída — nunca se desativa a original em favor de uma equivalência não comprovada.
- Caso um cadastro candidato a descarte revele qualquer uso durante a verificação, ele deixa de ser candidato e é preservado, mesmo estando vazio.
- Caso o espaço liberado não seja suficiente para dois ambientes coexistirem, o ambiente novo não é montado nesta versão e a limitação é registrada como impedimento.
- Caso alguma funcionalidade em uso apresente comportamento diferente durante a versão, a alteração responsável é revertida antes de qualquer avanço.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] CA-01: DADO um ambiente vazio QUANDO a estrutura descrita no repositório é aplicada ENTÃO todos os cadastros do domínio passam a existir, sem nenhuma intervenção manual.
- [ ] CA-02: DADO que a estrutura já foi aplicada uma vez QUANDO ela é aplicada novamente ENTÃO nenhum cadastro é duplicado e nenhum dado existente é alterado.
- [ ] CA-03: DADO o sistema ao final desta versão QUANDO se verifica onde vive cada regra de negócio ativa ENTÃO nenhuma delas existe apenas no ambiente de execução.
- [ ] CA-04: DADO uma regra de negócio migrada para o repositório QUANDO ela é exercitada nas mesmas condições de antes ENTÃO produz resultado observável idêntico ao da regra original.
- [ ] CA-05: DADO os cadastros identificados como sem uso QUANDO a versão é concluída ENTÃO eles não existem mais, e todo cadastro com uso comprovado permanece íntegro — inclusive os vazios que sustentam o cadastro de contrato.
- [ ] CA-06: DADO o aplicativo em uso pela imobiliária QUANDO ele aciona os endpoints migrados ENTÃO recebe resposta pelos mesmos nomes de antes, sem que o aplicativo tenha sido alterado.
- [ ] CA-07: DADO o espaço em disco medido antes da remoção QUANDO o ambiente de homologação obsoleto é removido ENTÃO a medição posterior comprova folga suficiente para dois ambientes coexistirem.
- [ ] CA-08: DADO o ambiente novo montado QUANDO a versão é concluída ENTÃO ele responde de forma isolada e a operação real permanece integralmente no ambiente atual.
- [ ] CA-09: DADO o procedimento de instalação das rotinas automáticas QUANDO executado duas vezes seguidas ENTÃO nenhuma rotina aparece duplicada.
- [ ] CA-10: DADO as rotinas automáticas em execução QUANDO comparadas com as descritas no repositório ENTÃO coincidem em horário e destino, incluindo as duas que hoje não constam do repositório.
- [ ] CA-11: DADO a imobiliária operando normalmente QUANDO a versão é concluída ENTÃO emissão de cobrança, gestão de contrato e as rotinas automáticas funcionam como antes, sem interrupção percebida.

---

## 9. Restrições & Considerações

- **Decisões arquiteturais já tomadas, fora de negociação**: descrever a estrutura de dados em arquivo versionado (ADR-0002) e preservar os nomes dos endpoints já consumidos pelo aplicativo (ADR-0004). Não reabrir nenhuma das duas.
- **Barreira de rede da versão anterior**: a contenção concluída anteriormente estabeleceu uma barreira entre a internet e o sistema, com critérios de aceite próprios. Esta versão não pode enfraquecê-la; a decisão de preservar os nomes dos endpoints existe justamente para não exigir mexer nela. `[DELEGAR_TECH_SPEC]`
- **Regra de acesso dos cadastros do domínio**: uma decisão anterior estabeleceu como a permissão desses cadastros é governada. Ela afeta a versão seguinte, não esta, mas nenhuma alteração aqui pode contrariá-la.
- **Espaço em disco**: 5,9 GB livres com o disco em 79%. A montagem do ambiente novo depende de liberação prévia comprovada.
- **Volume de dados**: a base é pequena (dezenas de registros por cadastro), então migração de dados não é gargalo de tempo. Isso não reduz o cuidado com a regra migrada — a geração do documento de contrato é a maior concentração de lógica a transferir.
- **Rotina de maior frequência**: uma das rotinas automáticas executa a cada minuto e não possui proteção contra execução sobreposta. A versão precisa considerar esse comportamento ao descrevê-la no repositório. `[DELEGAR_TECH_SPEC]`
- **Registro de execução das rotinas**: hoje há destino duplicado e nenhuma política de descarte, com arquivos crescendo sem limite. `[DELEGAR_TECH_SPEC]`
- **Duas rotinas fora do repositório**: apontam para arquivos que não estão versionados em lugar algum. Descrevê-las exige decidir onde passam a viver. `[DELEGAR_TECH_SPEC]`
- **Ausência de ambiente de teste dedicado**: a suíte de verificação roda hoje contra o ambiente que atende a imobiliária. Enquanto assim for, todo exercício de verificação carrega risco sobre a operação real. `[DELEGAR_TECH_SPEC]`
- **Divergência assumida com o plano original**: o plano previa que o ambiente novo assumiria a operação já nesta fase. Fica decidido que ele apenas é montado aqui e assume depois da versão seguinte, reduzindo a exposição desta versão.

---

## 10. Métricas de Sucesso

- **Reconstrução completa a partir do repositório**: um ambiente vazio recebe a estrutura de dados inteira sem nenhuma intervenção manual. Hoje esse número é zero — não é possível.
- **Regras de negócio fora do repositório**: de seis regras ativas vivendo apenas no ambiente de execução para **zero**.
- **Folga de disco comprovada**: espaço livre medido antes e depois da remoção do ambiente obsoleto, com margem suficiente para dois ambientes coexistirem.
- **Regressão percebida pela imobiliária**: **zero** ocorrências. Emissão de cobrança, gestão de contrato e rotinas automáticas seguem idênticas do ponto de vista de quem opera.

---

## 11. Roadmap / Fases

- **Fase 1 — Fundação versionável**: estrutura de dados do domínio descrita no repositório e aplicável de forma repetível; regras de negócio ativas transferidas para o repositório com equivalência comprovada; cadastros sem uso descartados; contrato dos endpoints preservado.
- **Fase 2 — Ambiente de execução**: remoção do ambiente de homologação obsoleto com medição de espaço; montagem do ambiente novo isolado; rotinas automáticas descritas no repositório com instalação repetível.
- **Fora desta versão**: a passagem da operação real para o ambiente novo, que ocorre depois da versão seguinte.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01      | Estrutura de dados reconstruível a partir do repositório | CA-01, CA-02 |
| US-02      | Regras de negócio ativas vivendo no repositório | CA-03, CA-04 |
| US-03      | Descarte dos cadastros sem uso comprovado | CA-05 |
| US-04      | Contrato dos endpoints preservado após a migração | CA-06 |
| US-05      | Ambiente obsoleto removido com espaço medido | CA-07 |
| US-06      | Ambiente novo montado e isolado | CA-08 |
| US-07      | Rotinas automáticas versionadas e instaláveis de forma repetível | CA-09, CA-10 |
| US-08      | Operação da imobiliária sem regressão nem interrupção | CA-11 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-08)
- [x] Critérios de aceite claros (CA-01 a CA-11)
- [x] Tabela de rastreabilidade preenchida
- [x] Pronto para criar o TECH_SPEC (COMO)
