---
id: 0002
title: Versionar estrutura de dados do app em arquivo
status: accepted
date: 2026-07-20
tags: [data, build]
---

# 0002 - Versionar estrutura de dados do app em arquivo

## Context

A estrutura de dados do domínio foi inteiramente criada pela interface administrativa do framework e existe apenas no banco de produção. O repositório não descreve nenhuma dessas estruturas: não há histórico de quem alterou qual campo nem por quê, o código referencia nomes que nada valida, e um ambiente novo criado a partir do repositório não reproduz o sistema — o único caminho é restaurar uma cópia do banco.

O custo disso deixou de ser teórico ao surgir a primeira necessidade de migração de dados por patch. O processo de migração do framework sincroniza as estruturas descritas em arquivo e só então executa os patches. Uma estrutura que existe apenas no banco não participa dessa sincronização, o que força o patch a criá-la programaticamente — sem revisão nem histórico — ou a depender de um passo manual não reproduzível.

## Decision

Toda estrutura de dados criada a partir desta decisão nasce descrita em arquivo no repositório e é aplicada pelo processo de migração do framework. As estruturas já existentes permanecem como estão; sua conversão é iniciativa separada e não é pré-requisito desta decisão.

## Consequences

**Pros:**
- O ambiente passa a ser reproduzível a partir do repositório para toda estrutura nova.
- Alterações de estrutura ganham histórico, autoria e revisão antes de chegar à produção.
- Migrações de dados por patch passam a ter ordenação garantida: a estrutura existe antes do patch que a popula.
- A dívida de estrutura não-versionada para de crescer sem exigir um refactor que ninguém planejou.

**Cons:**
- Introduz custo de processo: alterar a estrutura pela interface administrativa passa a produzir mudança no repositório que precisa ser incorporada.
- Ignorar esse custo cria divergência silenciosa entre banco e arquivo — o risco é de disciplina, não de mecanismo, e nenhuma salvaguarda automática o previne.
- O projeto passa a conviver com dois padrões: estruturas novas versionadas ao lado de estruturas antigas que não são.

**Neutros:**
- O modo de desenvolvimento já está habilitado no ambiente, então não há pré-requisito técnico a provisionar.
- A decisão não impõe prazo nem obrigação de converter o que já existe.

## Alternatives considered

- **Manter o padrão vigente (criação pela interface administrativa)** — seguir criando toda estrutura pelo mesmo caminho das atuais. Motivo da rejeição: preserva consistência aparente, mas mantém a estrutura fora do controle de versão e, no caso concreto que motivou a decisão, deixaria a criação como passo manual não reproduzível ou empurraria a criação para dentro de um patch, sem revisão.
- **Versionar tudo, convertendo também as estruturas existentes** — eliminar a dívida por completo. Motivo da rejeição: cria obrigação de trabalho que nenhuma frente atual cobre, sobre estruturas em produção, e transforma uma decisão de padrão em projeto de migração.
- **Versionar apenas quando houver migração de dados envolvida** — restringir a regra aos casos que exigem patch. Motivo da rejeição: resolve o sintoma imediato e deixa a regra ambígua para os demais casos, sem critério objetivo para quem decide depois.

## Applied in

- `integracao-bancaria-configuravel (v1)` — `docs/specs/features/integracao-bancaria-configuravel/v1/tech-alignment.md` (decisão D1; adoção planejada, implementação pendente)
