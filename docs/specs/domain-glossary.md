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

## Relacionamentos

- Uma **Cobrança** pode originar um boleto junto a um **Provedor**.
- Todo boleto emitido consome exatamente um valor do **Contador sequencial**.
- Um **Boleto em aberto** pertence a uma **Cobrança** e foi emitido sob uma configuração de um **Provedor**.

## Ambiguidades resolvidas

- "Seu número" era usado tanto para o **Contador sequencial** quanto para o identificador completo enviado ao provedor (prefixo + contador). Resolvido: são conceitos distintos — o contador é o valor incremental; o identificador é a composição enviada.
- "Banco" era usado tanto para a instituição financeira quanto para o banco de dados. Resolvido: a instituição é **Provedor**; banco de dados permanece "banco de dados".
