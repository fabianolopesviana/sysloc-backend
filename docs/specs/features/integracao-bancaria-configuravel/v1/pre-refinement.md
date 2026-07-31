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

- **Nome da Ideia / Feature**: Integração bancária configurável pelo frontend (Sicoob)
- **Fonte da ideia**: texto livre (plano técnico "PLANO A — BACKEND" fornecido pelo usuário)
- **Autor**: neuberagil@icloud.com
- **Data**: 2026-07-20
- **Versão**: v1
- **Status**: Refinado
- **Relacionados**: nenhum PRD/spec anterior neste repositório. Documentação viva do backend em `reference/contexto_backend.md` e `reference/runbook_frappe.md`.

---

## 2. Ideia Resumida (uma frase)

Permitir que o gestor da imobiliária troque conta bancária, titular e certificado digital da integração de boletos por uma tela do app — sem SSH, sem deploy e sem editar DocType pelo Desk do ERPNext — apoiado por um modelo canônico de cobrança bancária que isola o provedor Sicoob atrás de um adaptador.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Autonomia do cliente — até onde vai o autoatendimento na tela | explorar |
| B | Segurança e confiança na troca de configuração | explorar |
| C | Abstração multi-provedor — canônico + adapter agora ou depois | explorar |
| D | Continuidade da operação — não quebrar boletos em voo | explorar |
| E | Visibilidade preventiva — vencimento e saúde da integração | explorar |

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Autonomia do cliente

**Direções candidatas:**

- **A1 — Só o certificado**: a tela troca apenas o `.pfx` + senha; conta, URLs e ambiente seguem no Desk.
  - _Exemplo:_ certificado vence em 30 dias → gestor faz upload do novo e pronto.
  - _Viabilidade:_ menor superfície; reusa o molde de `AtrasoConfigPage.tsx`. Não resolve "trocar de conta", que é metade da dor declarada.
- **A2 — Certificado + dados da conta** (número cliente, conta corrente, modalidade, `client_id`, `scope`, senha).
  - _Exemplo:_ imobiliária migra da conta PJ antiga para a nova → gestor edita 3 campos e reenvia o certificado.
  - _Viabilidade:_ cobre o caso real de troca de titular; os campos já existem na DocType `Configuracao Integracao Sicoob`.
- **A3 — A2 + URLs e ambiente editáveis** (`auth_url`, `api_base_url`, Produção/Homologação).
  - _Exemplo:_ Sicoob publica `/v4` da API → ninguém precisa de deploy.
  - _Viabilidade:_ é o plano original. Risco: gestor não-dev editando URL de API quebra a integração silenciosamente.
- **A4 — A3 com URLs em "Configurações avançadas" colapsado + Testar conexão obrigatório**.
  - _Exemplo:_ a tela mostra por padrão certificado + conta; URLs ficam atrás de um acordeão que só se abre deliberadamente, e salvar exige um teste de conexão bem-sucedido.
  - _Viabilidade:_ mesma superfície técnica de A3; o custo extra é só de layout. Elimina o risco de edição acidental por persona não-dev.

**Direção escolhida**: **A4** — mantém a constante `SICOOB_BOLETOS_URL` fora do código (dívida real, repetida em 4 arquivos) sem expor URL crua ao gestor no fluxo comum.
**Podadas / adiadas**: A1 (não resolve a troca de conta, que é a dor central), A2 (deixaria a URL hardcoded no código), A3 (mesma capacidade de A4, porém sem guarda de UI).

### Ramo B — Segurança e confiança na troca

**Direções candidatas:**

- **B1 — Validação no upload**: só aceita se o `.pfx` abrir com a senha; mostra titular, documento e validade extraídos antes de gravar.
  - _Exemplo:_ gestor sobe o certificado errado → a tela mostra "Titular: FULANO LTDA — 12.345.678/0001-90. É esta a conta?" e ele percebe o engano antes de confirmar.
  - _Viabilidade:_ `cryptography 47.0.0` já está no venv do bench; zero dependência nova.
- **B2 — B1 + Testar conexão antes de ativar**: a configuração nova só passa a valer depois de uma solicitação de token real bem-sucedida.
  - _Exemplo:_ salvar deixa a configuração em rascunho; o botão "Testar e ativar" executa o `client_credentials` e só então marca `ativo`.
  - _Viabilidade:_ o endpoint `testar_conexao` já estava previsto no plano; o "só ativa se passar" é regra de produto adicional.
- **B3 — B2 + trilha de auditoria** (quem trocou, quando, impressão digital do certificado anterior e do novo).
  - _Exemplo:_ boleto sai com titular errado → dá para saber que a troca ocorreu em 12/08 pelo usuário X, saindo do certificado com fingerprint `A1B2…` para `C3D4…`.
  - _Viabilidade:_ o Frappe já grava `modified_by` e versões da DocType; o campo de impressão digital SHA-256 já constava do plano, então o registro custa pouco.

**Direção escolhida**: **B2 + B3** — validação no upload, ativação condicionada a teste bem-sucedido e registro histórico da troca.
**Podadas / adiadas**: B1 isolado (insuficiente — validar o arquivo não prova que o provedor aceita as credenciais).

### Ramo C — Abstração multi-provedor

**Direções candidatas:**

- **C1 — Canônico + adaptador completo** cobrindo emitir, baixar, consultar, confirmar e sincronizar.
  - _Exemplo:_ `emissao.py` deixa de montar `numeroCliente` inline; monta um `BoletoCanonico` e o adaptador Sicoob traduz.
  - _Viabilidade:_ refatoração ampla sobre ~2.500 linhas em produção. O retorno aparece quando entrar o segundo banco.
- **C2 — Só desacoplar configuração e HTTP**: uma única fonte de configuração, URL vinda do dado, certificado materializado — mas os módulos continuam falando o JSON do Sicoob.
  - _Exemplo:_ ninguém mais tem `SICOOB_BOLETOS_URL` hardcoded nem `_obter_configuracao_ativa` duplicado em 5 arquivos, embora o payload siga montado inline.
  - _Viabilidade:_ entrega toda a dor visível ao cliente com fração do risco; mantém a dívida de acoplamento.
- **C3 — Faseado**: C2 primeiro (destrava a tela), canônico completo como segunda entrega.
  - _Exemplo:_ v1 entrega a tela funcionando; v2 troca as entranhas sem o cliente perceber.
  - _Viabilidade:_ reduz o risco de refatorar boleto em produção, ao custo de tocar os mesmos arquivos duas vezes.

**Direção escolhida**: **C1** — decisão explícita do usuário, mantendo o acordo prévio de que canônico + adapter cobrem toda a operação.
**Podadas / adiadas**: C2 (deixa a dívida de acoplamento intacta), C3 (o faseamento foi proposto e recusado — o usuário optou por entrega única).

> **Provocação registrada (não acatada)**: o gestor não percebe diferença entre C1 e C2 — o valor de C1 é futuro (segundo banco) e de manutenibilidade. `[HIPÓTESE]` Como o ganho é interno, o risco de regressão sobre boleto em produção é a variável dominante desta decisão, e deve ser tratado explicitamente na estratégia de testes.

### Ramo D — Continuidade da operação

**Direções candidatas:**

- **D1 — Fallback para o `.pfx` legado** enquanto não houver upload.
  - _Exemplo:_ após o `migrate`, a integração continua usando `/run/secrets/sicoob/certificado.pfx` até o primeiro upload pela tela.
  - _Viabilidade:_ nada quebra na migração. Sem isso, o `migrate` seria um corte seco em produção.
- **D2 — D1 + regra explícita para boletos em voo**: o que acontece com boletos já emitidos quando a conta ou o certificado muda.
  - _Exemplo:_ boleto emitido pela conta A é baixado depois da troca para a conta B → a baixa pode ir para a conta errada ou falhar.
  - _Viabilidade:_ é a lacuna de produto que o plano original não respondia. Exige decisão de comportamento, não só de código.
- **D3 — D2 + janela de rollback**: guardar o certificado anterior por N dias para desfazer a troca.
  - _Exemplo:_ gestor troca por engano na sexta e restaura na segunda.
  - _Viabilidade:_ hoje o File privado antigo é deletado no upload novo (padrão de `salvar_pdf_privado`). Manter exige mudar esse padrão e definir política de retenção de material criptográfico.

**Direção escolhida**: **D1 + D2**, com D2 detalhado assim: antes de confirmar a troca, a tela informa quantos boletos abertos foram emitidos pela conta atual e oferece **três** caminhos ao gestor:
1. **Aceitar a troca** — prossegue normalmente.
2. **Não aceitar a troca** — cancela a operação e mantém a configuração atual.
3. **Aceitar a troca gerando um PDF consolidado** — o sistema monta um PDF único com **todos** os boletos em aberto e o abre, seguindo o padrão de abertura de PDF já existente no app.

Para cobranças abertas que ainda não tenham PDF salvo, o consolidado é gerado com o que existe e a tela **lista explicitamente as cobranças que ficaram de fora**, para o gestor tratá-las antes de confirmar.

**Podadas / adiadas**: D3 (adiado — retenção de certificado antigo é decisão de segurança que merece discussão própria).

> _Viabilidade verificada no código:_ `pypdf` (`PdfReader`/`PdfWriter`) já está no venv, usado em `contrato_cancelamento/pdf_utils.py`; `cobranca_boleto/service.py::abrir_boleto` já é o padrão de streaming de PDF via `frappe.local.response`. O consolidado reusa duas capacidades existentes, sem dependência nova.

### Ramo E — Visibilidade preventiva

**Direções candidatas:**

- **E1 — Badge na tela**: indicador de "vence em X dias" ao abrir a configuração.
  - _Exemplo:_ ao entrar na tela, o gestor vê "Certificado válido até 12/03/2027 — vence em 45 dias".
  - _Viabilidade:_ o campo `dias_para_vencer` já estava previsto no contrato do endpoint. Custo quase zero.
- **E2 — E1 + notificação ativa** por e-mail ao responsável em 30, 15 e 7 dias antes do vencimento.
  - _Exemplo:_ verificação diária no scheduler dispara e-mail de aviso.
  - _Viabilidade:_ reusa o scheduler existente (`run-locacao-automation.sh`) e o envio de e-mail (`locatario_email_confirmacao`).
- **E3 — Painel de saúde da integração** (último token bem-sucedido, última emissão, últimos erros).
  - _Exemplo:_ tela com histórico de eventos da integração e taxa de erro recente.
  - _Viabilidade:_ `Cobranca Integracao Sicoob` já registra eventos, mas isto é produto adjacente. `[fora do escopo do projeto]` nesta feature.

**Direção escolhida**: **E1** — badge de vencimento na tela de configuração.
**Podadas / adiadas**: E2 (adiado — notificação ativa fica para versão futura), E3 (`[fora do escopo do projeto]` — vira feature própria de observabilidade da cobrança).

> **Provocação registrada (não acatada)**: E1 só avisa quem abre a tela; certificado vencido em silêncio interrompe a emissão de boletos, o que é perda de receita, não de conveniência. `[HIPÓTESE]` Se a rotina de acompanhamento da imobiliária não incluir abrir essa tela mensalmente, o vencimento pode passar despercebido — ver dúvida 4 na seção 13.

---

## 5. Problema

- **Qual é a dor real hoje?** A configuração da integração bancária não é operável pelo cliente. Trocar conta, titular ou certificado exige acesso SSH com root ao servidor (o `.pfx` mora em `/opt/frappe/secrets/sicoob/certificado.pfx`, dono `root`, montado somente leitura nos serviços) ou edição direta de DocType pelo Desk do ERPNext. Não existe endpoint nem tela.
- **Como o problema aparece no dia a dia?**
  - A imobiliária muda de conta bancária ou de titular e a emissão de boletos fica travada até alguém com acesso ao servidor intervir.
  - O certificado digital vence e ninguém percebe até a emissão de boletos começar a falhar.
  - A URL da API do Sicoob está hardcoded (`SICOOB_BOLETOS_URL`) e repetida em `emissao.py`, `baixa.py`, `consulta.py` e `confirmacao_baixa.py` — qualquer mudança de versão da API exige alteração de código e deploy.
- **Quem sente o impacto?** O gestor da imobiliária (bloqueado, dependente de terceiro), o time técnico (interrupções operacionais para tarefas de configuração) e, indiretamente, os locatários que deixam de receber boletos.
- **Por que resolver agora?** A integração já roda em produção e funciona; o gargalo passou a ser exclusivamente operacional. Cada troca de conta é hoje um incidente que exige acesso privilegiado ao servidor.

---

## 6. Objetivo Principal

- **Qual é o resultado esperado ao final?** Trocar conta, titular ou certificado digital passa a ser uma operação de tela, executável pelo próprio gestor da imobiliária, com validação e teste de conexão antes de entrar em vigor.
- **Qual mudança de comportamento/estado deve acontecer?**
  - Operações de configuração deixam de exigir SSH, root ou acesso ao Desk do ERPNext.
  - A configuração da integração deixa de ser parcialmente código e passa a ser integralmente dado.
  - O núcleo da cobrança deixa de falar "Sicoob": passa a existir um modelo canônico de cobrança bancária com um adaptador traduzindo para o formato do provedor.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **gestor da imobiliária** — o dono da conta bancária, não-técnico. Configura sozinho. Implica linguagem sem jargão, validação forte e mensagens de erro de negócio (nunca stacktrace).
- **Persona secundária**: administrador técnico (System Manager) — acessa a mesma tela, incluindo a seção de configurações avançadas (URLs, ambiente, parâmetros do provedor).
- **Contexto de uso**: web, dentro do app de locação. Uso pontual e de baixa frequência (troca de conta, renovação anual de certificado), o que reforça a necessidade de a tela ser autoexplicativa — o gestor não terá familiaridade acumulada com ela.

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] Tela de configuração da integração bancária com certificado, dados da conta e seção "Configurações avançadas" colapsada contendo URLs e ambiente (**A4**)
- [ ] Upload de certificado `.pfx` com validação de senha e exibição de titular, documento, emissor e validade extraídos antes de gravar (**B1**)
- [ ] Ativação condicionada a "Testar conexão" bem-sucedido — configuração não entra em vigor sem token real obtido (**B2**)
- [ ] Registro de auditoria da troca: quem trocou, quando, impressão digital do certificado anterior e do novo (**B3**)
- [ ] Modelo canônico de cobrança bancária + adaptador Sicoob cobrindo emitir, baixar, consultar, confirmar e sincronizar (**C1**)
- [ ] Remoção da constante `SICOOB_BOLETOS_URL` do código; URL base vira dado configurável (**C1/A4**)
- [ ] Unificação da validação de "exatamente uma configuração ativa", hoje duplicada em 5 arquivos (**C1**)
- [ ] Fallback para o certificado legado enquanto não houver upload — nada para de funcionar antes da primeira troca pela tela (**D1**)
- [ ] Confirmação de troca com boletos em aberto, oferecendo três caminhos: aceitar, não aceitar, ou aceitar gerando PDF consolidado de todos os boletos em aberto (**D2**)
- [ ] PDF consolidado inclui as cobranças com PDF disponível e lista explicitamente as que ficaram de fora (**D2**)
- [ ] Badge de vencimento do certificado na tela de configuração (**E1**)
- [ ] Uma configuração ativa por provedor (regra de unicidade preservada e generalizada)
- [ ] Atualização de `reference/contexto_backend.md` e `reference/runbook_frappe.md` ao final

> Ponto de partida para o PRD/Tech Spec — não é definitivo.

---

## 9. Fora do Escopo (podado / adiado)

- **Notificação ativa de vencimento do certificado por e-mail (E2)** — _adiado_: o badge na tela foi considerado suficiente para a primeira versão. Reavaliar se ocorrer um vencimento não percebido.
- **Painel de saúde da integração (E3)** — `[fora do escopo do projeto]` nesta feature: último token, última emissão e histórico de erros constituem produto adjacente de observabilidade da cobrança.
- **Janela de rollback / retenção do certificado anterior (D3)** — _adiado_: hoje o File privado antigo é deletado no upload novo. Manter cópias de material criptográfico é decisão de segurança que merece discussão própria.
- **Múltiplas contas bancárias por titular/imóvel** — _podado_: cada proprietário receber na própria conta ampliaria o escopo para emissão, sequencial e conciliação. Mantém-se uma configuração ativa por provedor.
- **Segundo provedor bancário concreto** — _podado_: o modelo canônico é preparado para outros provedores, mas apenas o adaptador Sicoob é implementado nesta versão.
- **Remoção da DocType legada `Configuracao Integracao Sicoob`** — _adiado_: preservada como fallback; sua exclusão é frente separada.
- **Faseamento do refactor canônico (C3)** — _podado por decisão do usuário_: entrega única.

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É**: backend Frappe/ERPNext auto-hospedado em `/opt/frappe`, com app de negócio customizado `locacao_automation` (locação de imóveis: contratos, cobranças, boletos, PDFs, automações agendadas). Não há `CLAUDE.md` nem `README.md` na raiz; a documentação viva do projeto é `reference/contexto_backend.md` e `reference/runbook_frappe.md`.
- **PRDs / specs existentes consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md`): **nenhum artefato de spec existe neste repositório** — esta é a primeira feature a passar pelo pipeline agent-spec aqui. Sem duplicação e sem conflito com spec anterior.
- **Capacidades reutilizáveis** (apenas para viabilidade):
  - **Persistência**: DocTypes customizadas do Frappe no módulo "Locação de imóveis" — `Configuracao Integracao Sicoob` (configuração ativa `2dd758f872`), `Cobranca`, `Cobranca Integracao Sicoob` (registro de eventos com chaves de idempotência).
  - **Autenticação / autorização**: papéis do Frappe; a configuração atual é `read/write/create` restrita a System Manager. Campos `Password` são criptografados nativamente (`get_password`).
  - **Criptografia / certificado**: `cryptography 47.0.0` e `requests-pkcs12` já presentes no venv do bench (`custom-images/erpnext-pdf/requirements-extra.txt`) — leitura de metadados PKCS#12 e mTLS sem dependência nova.
  - **PDF**: `pypdf` (`PdfReader`/`PdfWriter`) já em uso em `contrato_cancelamento/pdf_utils.py`; `pdf_arquivo/service.py` (`salvar_pdf_privado`, `obter_pdf_privado_bytes`) e `cobranca_boleto/service.py::abrir_boleto` (streaming de PDF) — base pronta para o PDF consolidado.
  - **Agendamento e e-mail**: scheduler ativo (`run-locacao-automation.sh`, `run-cobrancas-vencidas.sh`, `run-atualizar-atrasos-cobrancas.sh`) e módulo `locatario_email_confirmacao` — relevante caso E2 seja retomado.
  - **Outros módulos internos**: `cobranca_sicoob/` (auth, emissão, baixa, confirmação de baixa, consulta, sincronização, sequencial, rotina de pagamentos), `contrato_ativacao/` e `contrato_cancelamento/` (consumidores externos da emissão), `cobranca_automation/`, `cobranca_atraso/`, `cobranca_vencimento/`, `config/`.
  - **Frontend**: telas de configuração com molde pronto (`AtrasoConfigPage.tsx`, `FinanceiroAutomacaoPage.tsx`); `apiRequest` é JSON-only e não há hoje nenhum código de upload de arquivo.
- **Conflitos / sobreposições detectados**: nenhum conflito com spec existente. Sobreposição interna esperada: os 5 arquivos que hoje duplicam `_obter_configuracao_ativa` e os 4 que repetem `SICOOB_BOLETOS_URL` serão convergidos para uma fonte única.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- [HIPÓTESE] A troca de conta bancária ou de certificado é operação de baixa frequência (renovação anual do certificado, mudança societária eventual) — daí a ênfase em uma tela autoexplicativa em vez de otimizada para uso repetido.
- [HIPÓTESE] O gestor da imobiliária tem posse do arquivo `.pfx` e da respectiva senha no momento da troca, obtidos junto ao emissor do certificado (ICP-Brasil).
- [HIPÓTESE] O comportamento do Sicoob ao receber baixa ou consulta de um boleto emitido sob outra conta/certificado é a origem do risco tratado em D2 — o comportamento exato do provedor ainda não foi confirmado (ver dúvida 1).
- [HIPÓTESE] Preservar as assinaturas `@frappe.whitelist()` e o shape das respostas atuais é suficiente para que o frontend existente continue funcionando sem alteração durante a refatoração canônica.
- [HIPÓTESE] O contador `ultimo_sequencial_seu_numero` é global por configuração ativa e não precisa ser reiniciado ao trocar de conta bancária (ver dúvida 2).

**Decisões já tomadas (fora de negociação)**:

- O certificado digital vira **File privado do Frappe** (`is_private: 1`), anexado à configuração, entrando no backup do site.
- O modelo canônico + adaptador cobrem **toda a operação** (emitir, baixar, consultar, confirmar, sincronizar), não apenas a configuração — entrega única, sem faseamento.
- A tela terá **Testar conexão**, **alerta de vencimento do certificado** e **URL base como campo editável**, pré-preenchido com o valor atual; a constante fixa é removida do código.
- Backend primeiro, frontend depois — o frontend depende dos endpoints.
- Endpoints via `@frappe.whitelist()`, **não** via Server Script.
- Nenhum log ou retorno pode conter a senha ou os bytes do certificado.
- Permissão restrita a System Manager.
- O arquivo temporário usado para o mTLS é criado com permissão `0600` e removido no `finally`, inclusive em caso de erro.
- Não derrubar o ambiente: nada de `pkill`; restart pelos serviços do compose (`backend`, `scheduler`, `queue-short`, `queue-long`).
- Ao final, atualizar `reference/contexto_backend.md` e `reference/runbook_frappe.md`.
- A URL base fica em seção "Configurações avançadas" colapsada, não no fluxo principal da tela.
- Configuração nova só entra em vigor após "Testar conexão" bem-sucedido.
- Troca com boletos em aberto exige confirmação com três opções, incluindo a geração de PDF consolidado.
- Uma configuração ativa por provedor.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: a tela é usada raramente, então o gestor chega a ela sem familiaridade e com uma tarefa de alto risco financeiro nas mãos. → _mitigação_: exibir os metadados extraídos do certificado (titular, documento, validade) como confirmação visual antes de gravar; exigir teste de conexão bem-sucedido; usar linguagem de negócio nas mensagens de erro.
- **Risco de escopo**: o PDF consolidado de boletos em aberto é uma capacidade nova, não prevista no plano original, e traz subquestões próprias (ordenação, cabeçalho, cobranças sem PDF). → _mitigação_: comportamento já delimitado (incluir o que existe, listar as ausentes); manter fora dele qualquer formatação sofisticada ou envio por e-mail.
- **Risco técnico ou operacional**: refatoração canônica ampla sobre ~2.500 linhas de código de boleto em produção, com consumidores externos (`contrato_ativacao`, `contrato_cancelamento`) e rotinas agendadas. Regressão silenciosa aqui gera boleto errado ou baixa não conciliada. → _mitigação_: preservar assinaturas e shape das respostas; validar primeiro por operações de leitura (consulta) antes das de escrita; verificar um ciclo completo do scheduler; backup do app antes da alteração, conforme o hábito registrado em `reference/backups_codex/`.
- **Risco de migração**: o `migrate` que cria a configuração canônica pode deixar a integração sem configuração ativa se o patch falhar parcialmente. → _mitigação_: patch idempotente; fallback para o certificado legado enquanto não houver upload; conferência explícita do sequencial migrado antes de considerar concluído.
- **Risco de privacidade / segurança / compliance**: material criptográfico (certificado e senha) passa a trafegar pela API e a ser gravado pela aplicação, onde antes era arquivo de sistema com dono root. → _mitigação_: File sempre privado; senha em campo `Password` criptografado; arquivo temporário `0600` removido no `finally`; nenhum log ou resposta contendo senha ou bytes do certificado; permissão restrita a System Manager. **Ponto de atenção adicional**: o certificado passa a entrar no backup do site — o backup precisa ter o mesmo nível de proteção que o arquivo tinha antes.
- **Risco de operação continuada**: o app é bind-mount; alterações de código só têm efeito após restart de `backend`, `scheduler`, `queue-short` e `queue-long`. Esquecer um deles produz comportamento inconsistente entre a API e as rotinas agendadas. → _mitigação_: restart dos quatro serviços como passo obrigatório e verificável.

---

## 13. Dúvidas em Aberto

1. ~~[DÚVIDA] **Como o Sicoob se comporta ao receber baixa, consulta ou confirmação de um boleto emitido sob outra conta/certificado?**~~ — **RESOLVIDO no nível de produto (2026-07-20)**: independentemente do comportamento do provedor, o fluxo é o mesmo — a tela informa "existem N boletos abertos emitidos pela conta atual" e exige confirmação explícita com três opções (aceitar, não aceitar, aceitar gerando PDF consolidado). Nenhuma salvaguarda adicional além do aviso. **Não é mais bloqueante para o PRD.**

   **Investigação técnica remanescente (não-bloqueante)**: o comportamento real do Sicoob altera apenas a **redação do aviso** exibido ao gestor:
   - Se o provedor continua aceitando baixa/consulta dos boletos antigos → aviso informativo: _"N boletos foram emitidos pela conta atual."_
   - Se o provedor rejeita → aviso de advertência: _"N boletos emitidos pela conta atual podem não ser baixados automaticamente após a troca"_ — e a opção de PDF consolidado passa de conveniência a saída recomendada.

   [HIPÓTESE] O desenho escolhido pelo usuário (gerar PDF completo de todos os boletos em aberto **antes** de trocar) sugere o segundo cenário: consolidar só faz sentido se houver risco de perder o acesso prático a esses boletos depois da troca. Confirmar durante a Tech Spec para definir a redação final.
2. [DÚVIDA] **O contador `ultimo_sequencial_seu_numero` deve ser reiniciado ao trocar de conta bancária?** Se o "seu número" é único por conta no provedor, manter o contador global pode gerar colisão ou lacuna na nova conta.
3. [DÚVIDA] **Qual o critério exato de "boleto em aberto"** para a contagem exibida na confirmação de troca — situação canônica `EMITIDO` e `VENCIDO`, ou apenas os não liquidados e não baixados independentemente do vencimento?
4. [DÚVIDA] **Existe rotina periódica em que o gestor abriria a tela de configuração?** Se não, o badge de vencimento (E1) pode nunca ser visto a tempo e a notificação ativa (E2) deixa de ser adiável.
5. [DÚVIDA] **Há limite de tamanho ou formato esperado para o `.pfx`** além de "PKCS#12 válido"? O plano menciona recusar arquivo com "tamanho fora de faixa" sem definir a faixa.
6. [DÚVIDA] **O ambiente de Homologação do Sicoob está disponível e credenciado?** O campo `ambiente` só tem valor prático se houver credenciais de homologação para testar a troca sem afetar produção.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: A4 (autonomia com avançado colapsado), B2+B3 (validação, ativação condicionada e auditoria), C1 (canônico + adaptador completo), D1+D2 (fallback legado e confirmação de troca com três opções, incluindo PDF consolidado), E1 (badge de vencimento).
- **Descartado com justificativa**: A1/A2/A3 (insuficientes ou sem guarda de UI), B1 isolado (validar arquivo não prova aceitação pelo provedor), C2/C3 (usuário optou por entrega única do canônico), E3 (produto adjacente de observabilidade), múltiplas contas por titular (explosão de escopo em emissão, sequencial e conciliação).
- **Adiado para v2/v3**: E2 (notificação ativa de vencimento por e-mail), D3 (janela de rollback e retenção do certificado anterior), remoção da DocType legada `Configuracao Integracao Sicoob`, segundo provedor bancário concreto.
- **Provocações que mudaram o rumo**:
  - Expor URL de API a persona não-dev → nasceu A4 (seção "Configurações avançadas" colapsada), que não existia no plano original.
  - "O que acontece com boletos já emitidos quando a conta muda?" → revelou a maior lacuna do plano original e gerou D2, incluindo a capacidade nova de PDF consolidado, proposta pelo usuário em cima da provocação.
  - Verificação de viabilidade do PDF consolidado no código → confirmou reuso de `pypdf` e do padrão de abertura de PDF, removendo a incerteza técnica da opção antes de ela entrar no escopo.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** (5 ramos explorados, 5 com direção escolhida no escopo inicial) | confirmado |
| Personas | **múltiplas personas** (gestor da imobiliária como primária, não-técnico; administrador técnico como secundária, com acesso à seção avançada) | confirmado |
| Novidade | **greenfield** dentro de projeto existente (camada `cobranca_bancaria/` nova, DocType canônica nova, módulo de API novo, tela nova) | inferido |
| Decisão arquitetural transversal nova? | **sim** — adoção de modelo canônico + porta/adaptador para provedores bancários, que passa a reger todo o fluxo de cobrança | inferido |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa**: as duas dimensões decisivas são **amplitude (5 rumos convergidos, todos entrando no escopo inicial)** e **decisão arquitetural transversal nova (modelo canônico + porta/adaptador)**, reforçadas por **múltiplas personas** — um gestor não-técnico operando material criptográfico e dados bancários, mais um administrador técnico com visão ampliada. A refatoração atravessa oito módulos em produção, cria uma DocType nova com migração de dados, altera o fluxo de emissão de boletos e introduz um contrato de API novo consumido por um frontend a ser construído em seguida. Esse conjunto exige PRD (para fixar o comportamento de produto do fluxo de troca com boletos em aberto) e Tech Spec formal (para fixar o contrato dos endpoints antes do handoff ao frontend).

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): miniSpec comporta 2-3 rumos e nenhuma decisão arquitetural transversal nova. Aqui há 5 rumos convergidos, uma persona não-técnica cujo fluxo de erro precisa ser especificado em nível de produto (o que o gestor vê quando a senha está errada, quando existem boletos em aberto, quando o teste de conexão falha) e a adoção de um padrão canônico/adaptador que rege toda a cobrança dali em diante. Além disso, o backend precisa entregar um contrato estável para uma frente de frontend independente — um handoff que o miniSpec não formaliza com a mesma precisão.

**Por que NÃO TaskCard** (vizinho mais distante): TaskCard pressupõe ajuste pontual, uma única persona e nenhuma decisão nova. Esta feature toca `cobranca_sicoob/` inteiro (~2.500 linhas em produção), cria três estruturas novas (camada canônica, DocType, módulo de API), tem migração de dados com patch idempotente e uma capacidade de produto inédita (PDF consolidado de boletos em aberto). Rodar como TaskCard perderia toda a rastreabilidade entre requisito e task, justamente num fluxo que movimenta dinheiro.

### 15.4 Próximo Passo

```bash
# 1) Registre PRIMEIRO a decisão arquitetural transversal — ela é evergreen
#    e será referenciada pelo PRD, pela Tech Spec e pelos gates:
/agent-spec-adr-create "modelo canonico de cobranca bancaria com adaptador por provedor"

# 2) Em seguida, gere o PRD da feature:
/agent-spec-sdd-generate-prd "integracao bancaria configuravel pelo frontend"
```

> **Estado das dúvidas**: a nº 1 foi **resolvida no nível de produto** — o fluxo de confirmação de troca está fechado e independe do comportamento do provedor. **Nenhuma dúvida bloqueante permanece**; o PRD pode ser gerado.
>
> Restam 5 dúvidas não-bloqueantes (nºs 2 a 6) mais a investigação técnica remanescente da nº 1, que afeta apenas a redação do aviso ao gestor. Todas devem ser carregadas para a Tech Spec como questões abertas com plano de investigação — em especial a **nº 2 (reinício do contador `ultimo_sequencial_seu_numero` ao trocar de conta)**, que tem potencial de gerar colisão de "seu número" na conta nova e merece resposta antes da implementação do adaptador.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (já está no topo — sinais de que o escopo deveria ser **quebrado em mais de uma feature**):
  - Se a resposta à dúvida 1 exigir tratamento de conciliação de boletos órfãos entre contas, isso vira feature própria.
  - Se surgir um segundo provedor bancário concreto durante a execução, o adaptador deixa de ser exercício de abstração e vira entrega paralela com escopo próprio.
  - Se o PDF consolidado crescer para envio por e-mail, agrupamento por locatário ou formatação customizada, separe-o em feature independente.
- **Downgrade** para miniSpec se:
  - O usuário reverter a decisão sobre C1 e optar pelo faseamento (C3): a Fase 1 isolada (configuração única, URL como dado, certificado materializado, tela) cabe confortavelmente em miniSpec, sem decisão arquitetural transversal.
  - O escopo for reduzido a "só trocar o certificado" (A1), eliminando o refactor canônico e o fluxo de boletos em aberto.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com capacidades concretas
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar PRD / Tech Spec
