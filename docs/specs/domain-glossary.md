# Glossário de Domínio — Projeto

> Termos canônicos do projeto, válidos entre features. Termos restritos a uma feature vivem em `/docs/specs/features/{feature}/domain-glossary.md`.

## Termos

**Boleto em aberto**:
Boleto já emitido que ainda pode ser pago ou cobrado — não foi liquidado nem baixado. Operacionalmente: cobrança com boleto gerado e identificador do banco preenchido, cujo estado é pendente ou vencido.
_Evitar_: boleto pendente, boleto ativo, boleto em cobrança, título aberto

**Provedor**:
Instituição financeira que recebe as operações de cobrança bancária, acessada pelo sistema através de um adaptador próprio que traduz o modelo canônico para o formato dela.
_Evitar_: banco, integração, gateway, PSP

**Contador sequencial**:
Número único e contínuo mantido pela imobiliária para identificar cada boleto emitido **perante o provedor**. Nunca reinicia — nem na virada de mês, nem na troca de conta bancária. Compõe o identificador enviado ao provedor junto de um prefixo de competência. É exigência do provedor, não do domínio: não confundir com o contador de uma **Série declarada**, que reinicia quando o escopo dela inclui o ano.
_Evitar_: seu número, sequencial do boleto, numeração, contador de emissão, contador da série

**Empresa**:
A imobiliária atendida pelo produto — a unidade de isolamento de dados do sistema, à qual toda informação de negócio pertence.
_Evitar_: tenant, cliente, organização, conta, inquilino

**Sysloc Master**:
Perfil de quem opera o SaaS: cria e suspende empresas, e não alcança dado de negócio de nenhuma delas.
_Evitar_: administrador do sistema, superusuário, admin global, root

**Admin Empresa**:
Perfil de quem administra uma empresa no dia a dia, cria os usuários dela e ajusta o que cada um alcança.
_Evitar_: administrador, gestor, dono da conta, admin local

**Usuário Empresa**:
Perfil de quem opera as telas liberadas dentro de uma empresa, sem administrar ninguém.
_Evitar_: usuário comum, operador, colaborador, usuário final

**Senha provisória**:
Senha atribuída por quem cria a conta, válida apenas até o primeiro acesso, cuja troca é obrigatória antes de qualquer outra ação.
_Evitar_: senha temporária, senha inicial, senha padrão, senha de primeiro acesso

**Vínculo de acesso**:
Registro que liga uma pessoa a uma empresa e é a base sobre a qual as permissões dela naquela empresa são definidas.
_Evitar_: associação, membership, permissão, papel do usuário

**Área de tela**:
Uma das dez divisões fixas do app pelas quais o acesso é concedido — Resumo, Imóveis, Contratos, Cadastros, Financeiro, Automação de cobrança, Integrações bancárias, Multa e juros, Relatórios, Usuários.
_Evitar_: módulo, seção, página, menu, seção do sistema

**Ação sensível**:
Uma das sete operações de impacto que exigem concessão própria, além da área de tela que as comporta — emitir boleto, solicitar baixa, ativar contrato, cancelar contrato, excluir cadastro, configurar integração, enviar cobrança manual.
_Evitar_: permissão especial, operação crítica, ação restrita, ação privilegiada

**Efetivo de permissão**:
O conjunto de áreas de tela e ações sensíveis que uma pessoa alcança num dado momento — o padrão do perfil dela, acrescido do que lhe foi concedido individualmente e subtraído do que lhe foi retirado.
_Evitar_: permissões do usuário, ACL, conjunto de acesso, escopo, efetivas

**Ajuste individual**:
Concessão ou retirada de uma área de tela ou ação sensível para uma pessoa específica, aplicada sobre o padrão do perfil dela. A retirada vence a concessão.
_Evitar_: override, exceção, permissão extra, customização, ajuste fino

**Conjunto**:
Agrupamento de imóveis administrados sob o mesmo empreendimento — o nível acima do imóvel na carteira da empresa.
_Evitar_: condomínio, edifício, empreendimento, agrupamento, bloco

**Imóvel**:
A unidade locável que a imobiliária administra, pertencente a um conjunto e identificada perante o município por um identificador próprio.
_Evitar_: unidade, propriedade, apartamento, bem

**Cômodo**:
Divisão interna de um imóvel, com nome e metragem, cuja soma compõe a metragem total dele. Não tem vida própria: existe dentro do imóvel e é removido de fato quando a planta é corrigida.
_Evitar_: ambiente, dependência, peça, sala

**Locador**:
A pessoa que cede o imóvel em locação — o lado proprietário do contrato.
_Evitar_: proprietário, senhorio, dono, arrendador

**Locatário**:
A pessoa que toma o imóvel em locação — o lado que ocupa e paga.
_Evitar_: inquilino, arrendatário, morador, cliente

**Fiador**:
A pessoa que garante as obrigações do locatário perante o contrato, sem ocupar o imóvel.
_Evitar_: avalista, garantidor, responsável

**Contrato de locação**:
O acordo que liga um imóvel, um locador e um locatário sob prazo, valor e datas — o documento central do negócio. Tem código legível próprio, quatro estados possíveis e zero ou mais fiadores.
_Evitar_: locação, aluguel, acordo, contrato de aluguel, arrendamento

**Rascunho**:
O estado em que um contrato nasce: ele já existe e já consumiu o número da série, mas ainda não vale. É o único estado em que os termos e os fiadores podem ser corrigidos.
_Evitar_: pendente, em edição, provisório, não efetivado, draft

**Ativação de contrato**:
O ato deliberado que faz um contrato passar a valer: confere as condições de entrada, calcula a data de fim e o valor total, e marca o imóvel como locado. Exige concessão própria, separada da de montar o contrato.
_Evitar_: efetivar, submeter, aprovar, confirmar, assinar, publicar

**Cancelamento de contrato**:
O ato deliberado que faz um contrato vigente deixar de valer e devolve o imóvel à disponibilidade. O contrato permanece na carteira como histórico. Exige concessão própria.
_Evitar_: rescindir, encerrar, anular, desfazer, distratar

**Contrato vigente**:
O contrato ativo que ocupa um imóvel. Um imóvel tem no máximo um, e a exclusividade é garantida pelo banco — não por conferência da aplicação.
_Evitar_: contrato atual, contrato em vigor, locação ativa, contrato válido

**Série declarada**:
O conjunto dos códigos legíveis de uma entidade, com escopo e contador próprios — o do contrato inclui o ano, e por isso reinicia a cada ano. O número nunca é reusado e a sequência admite furo.
_Evitar_: numeração, sequência, autoname, contador sequencial

**Carteira**:
O conjunto dos registros de um tipo que a empresa administra. **Sempre qualificada** — carteira de imóveis, carteira de contratos, carteira de cobranças —, porque desqualificada ela não diz de quê.
_Evitar_: portfólio, base, cadastro geral, "a carteira" sem qualificação

**Metragem total**:
A soma das metragens dos cômodos de um imóvel, calculada pelo servidor a cada leitura e nunca informada diretamente. Cômodo sem metragem informada conta como zero.
_Evitar_: área, área total, metragem do imóvel, tamanho

**Identificador municipal**:
O identificador do imóvel perante a prefeitura, informado no cadastro, obrigatório e único dentro de cada empresa. É o identificador externo do imóvel — não se confunde com a chave que a API expõe.
_Evitar_: inscrição, matrícula, IPTU, cadastro municipal, código do imóvel

**Cobrança**:
O fato financeiro que a imobiliária lança contra um contrato de locação — um valor a receber com competência, vencimento e natureza próprios. Tem código legível próprio, nasce da ativação do contrato ou de lançamento avulso, e nunca é apagada.
_Evitar_: título, fatura, lançamento, conta a receber, débito, parcela

**Cobrança em aberto**:
Cobrança que ainda pode ser paga ou cancelada — não foi liquidada nem cancelada. Operacionalmente: sem data de pagamento e sem instante de cancelamento. É sobre ela, e só sobre ela, que a mora é apurada.
_Evitar_: cobrança pendente, cobrança ativa, em atraso, dívida aberta

**Mora**:
O acréscimo devido pelo atraso de uma cobrança — a multa somada aos juros. É derivada da política vigente enquanto a cobrança está em aberto, e vira carimbo no ato que a liquida.
_Evitar_: atraso, encargo, acréscimo, juros e multa, penalidade

**Configuração de mora**:
A política de multa e juros **de uma empresa** — um par de percentuais, um por empresa. Empresa que nunca a definiu apura mora zero: a ausência e o par zerado são a mesma coisa.
_Evitar_: atraso, parâmetros de multa, regra de juros, política de cobrança

**Carimbo**:
O valor que era derivado e passa a ser gravado no instante do ato que liquida um fato financeiro, junto da configuração que o produziu. Depois de carimbado não muda mais, e mudar a política não o alcança.
_Evitar_: snapshot, congelamento, valor fixado, histórico

**Natureza da cobrança**:
Aquilo que a cobrança cobra, escolhido de uma lista fechada — aluguel, água, condomínio, energia ou outro. É campo próprio, e a distinção nunca se faz interpretando texto.
_Evitar_: tipo, categoria, espécie, classificação, tipo de título

**Competência**:
O mês a que a cobrança se refere, representado sempre pelo primeiro dia dele. Não se confunde com o vencimento, que é quando ela deve ser paga.
_Evitar_: mês de referência, período, mês, data-base

**Referência**:
O rótulo em texto livre que descreve a cobrança para quem a lê — no aluguel, o intervalo do período coberto. É legenda, nunca critério: somar por tipo se faz pela **Natureza da cobrança**.
_Evitar_: descrição, histórico, observação, título, memorando

**Retirada de circulação**:
A operação que tira um cadastro das escolhas e das listagens sem apagá-lo: ele deixa de ser oferecido ao montar um contrato, permanece legível por quem já o referencia, e pode voltar à circulação.
_Evitar_: exclusão, excluir, remoção, desativação, arquivamento, soft delete

**Aviso**:
A mensagem que o sistema entrega ao **Locatário** sobre uma **Cobrança** que vai vencer ou já venceu.
_Evitar_: cobrança (para a mensagem), e-mail de cobrança, notificação, lembrete, comunicado

**Régua de cobrança**:
O trabalho que percorre as cobranças em aberto de uma **Empresa** e decide quais delas recebem **Aviso**.
_Evitar_: régua (desqualificada), automação de cobrança, rotina de cobrança, política de cobrança

**Janela de horário**:
O intervalo do dia, declarado pela **Empresa**, dentro do qual a **Régua de cobrança** tem permissão de entregar **Avisos** — ela diz *quando é permitido*, nunca *quando acontece*.
_Evitar_: horário de envio, agendamento, gatilho de horário, janela de execução

**Tentativa de envio**:
O fato registrado a cada vez que o sistema tenta entregar um **Aviso** — existe mesmo quando nada saiu, e nunca é apagada nem alterada.
_Evitar_: envio (para a tentativa que falhou), log de e-mail, histórico de disparo

**Desfecho**:
O que aconteceu com uma **Tentativa de envio**: entregue, falhou, ou não havia endereço de contato.
_Evitar_: status do envio, resultado, situação da mensagem

## Relacionamentos

- Uma **Cobrança** pode originar um boleto junto a um **Provedor**.
- Uma **Empresa** tem no máximo uma configuração da **Régua de cobrança**, e ela nasce desligada.
- A **Régua de cobrança** é sempre de uma **Empresa** só — não existe percurso que atravesse empresas.
- Um **Aviso** é sobre exatamente uma **Cobrança**, e vai ao **Locatário** do **Contrato de locação** dela.
- Toda entrega de **Aviso** produz exatamente uma **Tentativa de envio**, que tem exatamente um **Desfecho**.
- Uma **Cobrança** paga ou cancelada **nunca** origina **Aviso**, por caminho nenhum.
- Toda **Cobrança** pertence a exatamente um **Contrato de locação**, e o **Locatário** dela é o do contrato — nunca um vínculo próprio.
- Toda **Cobrança** consome, ao nascer, um número da **Série declarada** dela, cujo escopo inclui o ano.
- Uma **Cobrança em aberto** apura **Mora** pela **Configuração de mora** da **Empresa** dela; uma cobrança liquidada publica **Carimbos** e não reapura.
- Uma **Empresa** tem no máximo uma **Configuração de mora**; a ausência dela equivale ao par zerado.
- Toda **Cobrança** tem exatamente uma **Natureza da cobrança**, uma **Competência** e uma **Referência**.
- A **Ativação de contrato** produz zero ou mais **Cobranças**; o **Cancelamento de contrato** cancela as que estiverem em aberto.
- Todo boleto emitido consome exatamente um valor do **Contador sequencial**.
- Um **Boleto em aberto** pertence a uma **Cobrança** e foi emitido sob uma configuração de um **Provedor**.
- Toda informação de negócio pertence a exatamente uma **Empresa**.
- Um **Admin Empresa** e um **Usuário Empresa** pertencem a exatamente uma **Empresa**; um **Sysloc Master** não pertence a nenhuma.
- Uma pessoa tem um **Vínculo de acesso** por **Empresa** em que atua.
- Uma **Senha provisória** pertence a uma conta e deixa de valer na primeira troca.
- O **Efetivo de permissão** de uma pessoa deriva do perfil dela e dos **Ajustes individuais** que ela tem.
- Toda **Ação sensível** pertence a exatamente uma **Área de tela**, e só vale para quem alcança essa área.
- Um **Ajuste individual** existe sobre um **Vínculo de acesso** — logo não existe para quem não pertence a nenhuma **Empresa**, como o **Sysloc Master**.
- Um **Conjunto** agrupa zero ou mais **Imóveis**; um **Imóvel** pertence a exatamente um **Conjunto**.
- Um **Imóvel** tem zero ou mais **Cômodos**, e a **Metragem total** dele é a soma das metragens deles.
- Um **Imóvel** tem exatamente um **Identificador municipal**, único dentro da **Empresa**.
- **Locador**, **Locatário** e **Fiador** são cadastros distintos, cada um com o próprio documento único por **Empresa** — a mesma pessoa pode existir nos três papéis.
- A **Retirada de circulação** alcança **Conjunto**, **Imóvel**, **Locador**, **Locatário**, **Fiador** e **Contrato de locação**; não alcança **Cômodo**, que é removido de fato, nem o vínculo entre contrato e fiador, cuja linha se remove.
- Um **Contrato de locação** liga exatamente um **Imóvel**, um **Locador** e um **Locatário**, todos da mesma **Empresa**, e tem zero ou mais **Fiadores**.
- Um **Contrato de locação** nasce em **Rascunho**, passa a vigorar pela **Ativação de contrato** e deixa de vigorar pelo **Cancelamento de contrato**.
- Um **Imóvel** tem no máximo um **Contrato vigente**; um **Contrato vigente** ocupa exatamente um **Imóvel**.
- Todo **Contrato de locação** consome, ao nascer, um número da **Série declarada** dele — e o consome para sempre, mesmo que a criação seja abortada.
- A **Ativação de contrato** e o **Cancelamento de contrato** são **Ações sensíveis**, ambas dentro da **Área de tela** Contratos.
- A **Retirada de circulação** de um **Contrato de locação** não muda o estado dele nem libera o **Imóvel** — ela é ortogonal ao ciclo de vida.

## Ambiguidades resolvidas

- "Seu número" era usado tanto para o **Contador sequencial** quanto para o identificador completo enviado ao provedor (prefixo + contador). Resolvido: são conceitos distintos — o contador é o valor incremental; o identificador é a composição enviada.
- "Banco" era usado tanto para a instituição financeira quanto para o banco de dados. Resolvido: a instituição é **Provedor**; banco de dados permanece "banco de dados".
- "Usuário" era usado tanto para qualquer pessoa autenticada quanto para o perfil sem poderes administrativos. Resolvido: pessoa autenticada é "pessoa" ou "conta"; o perfil é **Usuário Empresa**.
- "Empresa" e "tenant" apareciam como sinônimos em textos técnicos. Resolvido: o termo do produto é **Empresa**; "tenant" fica restrito à discussão de isolamento no banco, nunca à API nem à interface.
- "Permissão" era usado tanto para uma chave isolada quanto para o conjunto que a pessoa alcança. Resolvido: a chave é uma **Área de tela** ou uma **Ação sensível**; o conjunto é o **Efetivo de permissão**.
- "Excluir cadastro" nomeia a **Ação sensível** do catálogo (chave `ACAO:excluir_cadastro`, fechada desde a F1 e persistida em `acesso_usuario_permissao` — não renomeável), mas a operação que ela governa **não exclui**: ela é a **Retirada de circulação**, e nada é apagado (ADR-0014). Resolvido: a chave preserva o nome histórico; o termo do domínio, das rotas e da documentação é *retirada de circulação*.
- "Metragem" era usada tanto para a metragem de um **Cômodo** quanto para a do imóvel inteiro. Resolvido: a do cômodo é *metragem*; a do imóvel é **Metragem total**, e é derivada, nunca informada.
- "Cadastro" era usado tanto para as entidades de negócio quanto para pessoas do sistema. Resolvido: cadastro é entidade de negócio (**Conjunto**, **Imóvel**, **Locador**, **Locatário**, **Fiador**, **Contrato de locação**); quem entra no sistema é pessoa, com **Vínculo de acesso**.
- "Contador sequencial" nomeava dois números incompatíveis: o do boleto perante o provedor, que **nunca reinicia**, e o de um código legível como `CTR-2026-00001`, que **reinicia a cada ano**. Resolvido: o primeiro continua sendo o **Contador sequencial** (exigência do provedor); o segundo é o contador de uma **Série declarada**, cujo escopo cada série declara.
- "Carteira" nomeava tanto a árvore de conjuntos com os imóveis de cada um quanto a lista de contratos da empresa. Resolvido: **Carteira** é sempre qualificada — de imóveis, de contratos, de cobranças —, e o termo desqualificado não é usado.
- "Novo título" era o texto pelo qual o sistema antigo distinguia uma cobrança que não é aluguel — a **Natureza da cobrança** não existia lá, e a distinção se fazia lendo a **Referência**. Resolvido: são campos distintos, e a natureza é a única que se soma, filtra e agrupa; a referência é legenda.
- "Em aberto" nomeava tanto o **Boleto em aberto** quanto a **Cobrança em aberto**. Resolvido: são níveis diferentes — a cobrança é o fato financeiro; o boleto é o instrumento que um **Provedor** emite para ela. Nem toda cobrança em aberto tem boleto.
- "Atraso" nomeava três coisas: o fato de estar vencida, o valor devido pelo atraso e a política que o calcula. Resolvido: o estado é *vencida*; o valor é a **Mora**; a política é a **Configuração de mora**.
- "Cancelar uma cobrança" e "excluir uma cobrança" eram lidos como a mesma coisa. Resolvido: cancelar é transição de estado que preserva o registro e o código consumido — e é a única que existe. Cobrança **nunca é apagada**, e a **Retirada de circulação** não a alcança: ela é operação sobre cadastro, não sobre fato financeiro.
- "Cancelar" e "encerrar" eram usados como sinônimos para tirar um contrato de vigência. Resolvido: são estados distintos e têm produtores distintos — o **Cancelamento de contrato** é decisão de uma pessoa, com ação sensível própria; o encerramento é consequência do vencimento do prazo, escrito por rotina agendada.
- "Excluir um contrato" era lido tanto como cancelá-lo quanto como tirá-lo das listagens. Resolvido: cancelar é transição de estado que libera o **Imóvel**; **Retirada de circulação** é visibilidade e não libera nada. Um rascunho abandonado se retira, não se cancela.
- "Cobrança" era usado tanto para o **fato financeiro** quanto, coloquialmente, para a mensagem que o sistema envia ao inadimplente. Resolvido: são conceitos distintos — o fato é a **Cobrança**; a mensagem é o **Aviso**. ⚠️ A chave do catálogo `ACAO:enviar_cobranca_manual` preserva o nome histórico (o catálogo é fechado desde a F1 e persistido em `acesso_usuario_permissao` — não renomeável), e **não** redefine "cobrança": o que ela governa é o envio de um **Aviso**. Mesmo caso, e mesma resolução, de `ACAO:excluir_cadastro` acima.
- "Régua" nomeava tanto a **configuração** quanto o **trabalho** que a aplica. Resolvido: o trabalho é a **Régua de cobrança**; a configuração que ele lê é a *política de aviso*, termo do glossário da feature `regua-de-cobranca`. O pacote `@sysloc/regua` e a fila `regua-de-cobranca` nomeiam o trabalho, coerentes com esta resolução.
