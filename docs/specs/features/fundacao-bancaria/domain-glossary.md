# Glossário de Domínio — Fundação bancária

> Termos específicos desta feature. Os termos que atravessam features — **Certificado do provedor**,
> **Segredo operável**, **Contador sequencial**, **Identificador perante o provedor**, **Meio de
> recebimento**, **Provedor**, **Empresa** — vivem no glossário global
> (`docs/specs/domain-glossary.md`) e **não** se repetem aqui.
>
> Criado pela sessão de challenge de 2026-08-14 sobre `v1/tech_spec.md`.

## Termos

**Estado do certificado**:
A faixa em que um **Certificado do provedor** se encontra, **derivada** da validade dele contra a data
corrente da operação e nunca gravada — *vigente*, *vencendo* (faltam 30 dias ou menos) ou *vencido*.
Muda sozinha com a passagem do tempo, sem que nada seja escrito.
_Evitar_: status do certificado, situação, flag de vencimento, certificado ativo

**Verificação de identidade**:
O ato explícito, disparado pelo **Admin Empresa**, que pergunta ao **Provedor** se ele aceita o
**Certificado do provedor** daquela empresa. Não altera nada e não grava nada; o desfecho recusado é
resposta, não falha.
_Evitar_: teste de conexão, validar certificado, ping no banco, health check da integração

**Renovação por substituição**:
O registro de um **Certificado do provedor** novo sobre uma **Empresa** que já tinha um valendo. O novo
passa a valer no ato; do anterior fica o registro do que ele era, e o **Segredo operável** dele deixa de
existir na mesma unidade de trabalho.
_Evitar_: atualizar certificado, trocar certificado, upload de renovação, editar certificado

**Caminho de reserva**:
A identidade genérica ou de outra empresa que o sistema antigo usava quando a empresa não tinha material
próprio. O termo existe aqui **para nomear o que foi removido**: nesta feature ele não existe no código,
e a ausência é a decisão — a falta de certificado é recusa nomeada, nunca substituição silenciosa.
_Evitar_: fallback, certificado padrão, identidade default, certificado global

## Relacionamentos

- Todo **Certificado do provedor** tem exatamente um **Estado do certificado**, e ele é derivado a cada
  leitura — dois pedidos em dias diferentes podem responder faixas diferentes sem que nada tenha sido
  escrito entre eles.
- Uma **Verificação de identidade** é sobre o **Certificado do provedor** que está valendo, e sobre
  nenhum outro; ela não produz registro nem altera o estado dele.
- Uma **Renovação por substituição** encerra exatamente um **Certificado do provedor** e cria exatamente
  um; a **Empresa** nunca fica sem nenhum entre os dois atos.
- Uma **Empresa** sem **Certificado do provedor** recebe recusa nomeada em qualquer ato contra o
  **Provedor** — não existe **Caminho de reserva**.

## Ambiguidades resolvidas

- "Testar" nomeava tanto a **Verificação de identidade** (ato do Admin contra o provedor) quanto o teste
  automatizado da suíte. Resolvido: o ato do produto é a **Verificação de identidade**; "teste" sem
  qualificação, em artefato de spec, é sempre teste de software.
- "Vencido" era usado tanto para o **Estado do certificado** quanto para a **Cobrança em aberto** cujo
  vencimento passou. Resolvido: são escalas sem parentesco — uma é a validade de um material
  criptográfico, a outra é a data de pagamento de um fato financeiro. Nenhuma regra atravessa as duas.
- "Renovar" era lido como atualizar a linha existente. Resolvido: é **Renovação por substituição** —
  linha nova, e a anterior preservada como histórico sem o segredo. A distinção é o que torna o
  histórico consultável depois da troca.
