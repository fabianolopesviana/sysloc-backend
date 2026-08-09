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

**Retirada de circulação**:
A operação que tira um cadastro das escolhas e das listagens sem apagá-lo: ele deixa de ser oferecido ao montar um contrato, permanece legível por quem já o referencia, e pode voltar à circulação.
_Evitar_: exclusão, excluir, remoção, desativação, arquivamento, soft delete

## Relacionamentos

- Uma **Cobrança** pode originar um boleto junto a um **Provedor**.
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
- "Cancelar" e "encerrar" eram usados como sinônimos para tirar um contrato de vigência. Resolvido: são estados distintos e têm produtores distintos — o **Cancelamento de contrato** é decisão de uma pessoa, com ação sensível própria; o encerramento é consequência do vencimento do prazo, escrito por rotina agendada.
- "Excluir um contrato" era lido tanto como cancelá-lo quanto como tirá-lo das listagens. Resolvido: cancelar é transição de estado que libera o **Imóvel**; **Retirada de circulação** é visibilidade e não libera nada. Um rascunho abandonado se retira, não se cancela.
