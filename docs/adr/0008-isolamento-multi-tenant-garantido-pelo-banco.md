---
id: 0008
title: Isolamento multi-tenant garantido pelo banco, não pela aplicação
status: accepted
date: 2026-08-01
tags: [architecture, security, data]
---

# 0008 - Isolamento multi-tenant garantido pelo banco, não pela aplicação

## Context

O produto atende de 20 a 300 empresas sobre **isolamento lógico** — um banco só, com a coluna de
empresa discriminando as linhas. Resta decidir **onde o isolamento é imposto**, e a escolha vale
para toda entidade de negócio que ainda será criada, não para uma feature.

O backend anterior respondia "na aplicação", e a evidência de como isso envelhece está medida: 28
pontos de escape do controle de permissão, cada um uma exceção legítima quando foi escrita. Filtro
instalado **por ponto de acesso** falha silenciosamente — devolve dado alheio sem erro nenhum. Na
escrita vale o mesmo: apontar um contrato da empresa A para um imóvel da B é uma linha válida se
nada estruturalmente o impedir.

## Decision

O isolamento entre empresas é **propriedade do banco**: toda tabela de negócio nasce com
`empresa_id`, **RLS habilitada com `USING` e `WITH CHECK`**, e **chave estrangeira composta
`(id, empresa_id)`** como forma de referência entre entidades tenantizadas. O contexto que a RLS
consome é fixado por transação com `SET LOCAL`, e sua origem **nunca é o request**. A camada de
aplicação **não** implementa filtro por empresa equivalente: não há dois caminhos para o dado.

## Consequences

**Pros:**
- Consulta que esqueça o filtro devolve vazio, não dado alheio — o modo de falha vira visível.
- Referência cruzada entre empresas é **estruturalmente impossível**, recusada pelo banco.
- Um único ponto de imposição, auditável por inspeção do schema, em vez de N pontos de chamada.
- Torna possível provar o isolamento **com a camada de aplicação desligada**.

**Cons:**
- Superusuário e dono da tabela **ignoram RLS por padrão**: exige `FORCE ROW LEVEL SECURITY` e um
  papel de aplicação não-superusuário, sob pena de o isolamento existir só no papel.
- Suíte que conecte com o papel errado fica **verde sem provar nada** — parece sucesso. Todo teste
  de isolamento precisa provar também o papel de conexão.
- Depurar fica menos direto: linha ausente pode ser regra de negócio ou contexto não fixado.

**Neutros:**
- Amarra o projeto ao PostgreSQL nesta capacidade; já é a escolha de stack.
- Não protege contra acesso administrativo ao servidor ou ao banco — limite declarado e aceito.

## Alternatives considered

- **Filtro por empresa na camada de acesso a dados** — todo repositório aplicaria a condição, com
  revisão garantindo a disciplina. Motivo da rejeição: é a abordagem do backend anterior, que
  produziu os 28 escapes; a garantia depende de cada autor futuro lembrar, e a falha é silenciosa.
- **Um banco por empresa** — isolamento físico, sem coluna discriminadora. Motivo da rejeição: não
  escala para 300 clientes em operação, migração e backup; descartado na decisão de escala.
- **Um schema por empresa** — meio-termo. Motivo da rejeição: transfere o problema para resolução
  dinâmica de schema por conexão e torna migração de estrutura uma operação de N passos, sem
  eliminar a necessidade de fixar contexto por transação.
- **RLS somada ao filtro da aplicação**, em defesa em profundidade. Motivo da rejeição: dois
  caminhos para o dado divergem com o tempo, e o filtro redundante ensina a confiar nele; quando
  ele deixa de existir em algum ponto novo, nenhum teste acusa.

## Applied in

- `fundacao-multitenancy-identidade (v1)` — docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md (materializa RLS, FK composta, `SET LOCAL` e a suíte de isolamento)
- `autorizacao-e-ciclo-de-acesso (v1)` — docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md §8 (consome o contexto de tenant estabelecido aqui)
