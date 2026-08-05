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
Número único e contínuo mantido pela imobiliária para identificar cada boleto emitido. Nunca reinicia — nem na virada de mês, nem na troca de conta bancária. Compõe o identificador enviado ao provedor junto de um prefixo de competência.
_Evitar_: seu número, sequencial do boleto, numeração, contador de emissão

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

## Ambiguidades resolvidas

- "Seu número" era usado tanto para o **Contador sequencial** quanto para o identificador completo enviado ao provedor (prefixo + contador). Resolvido: são conceitos distintos — o contador é o valor incremental; o identificador é a composição enviada.
- "Banco" era usado tanto para a instituição financeira quanto para o banco de dados. Resolvido: a instituição é **Provedor**; banco de dados permanece "banco de dados".
- "Usuário" era usado tanto para qualquer pessoa autenticada quanto para o perfil sem poderes administrativos. Resolvido: pessoa autenticada é "pessoa" ou "conta"; o perfil é **Usuário Empresa**.
- "Empresa" e "tenant" apareciam como sinônimos em textos técnicos. Resolvido: o termo do produto é **Empresa**; "tenant" fica restrito à discussão de isolamento no banco, nunca à API nem à interface.
- "Permissão" era usado tanto para uma chave isolada quanto para o conjunto que a pessoa alcança. Resolvido: a chave é uma **Área de tela** ou uma **Ação sensível**; o conjunto é o **Efetivo de permissão**.
