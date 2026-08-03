# Glossário de Domínio — fundacao-multitenancy-identidade

> Termos específicos desta feature. Termos canônicos do projeto vivem em `/docs/specs/domain-glossary.md` e têm precedência menor apenas em caso de conflito explícito (não há nenhum hoje).

## Termos

**Sessão restrita**:
Sessão já autenticada que ainda não cumpriu uma exigência de admissão — troca da senha provisória ou configuração do segundo fator — e por isso alcança apenas as rotas que permitem cumpri-la.
_Evitar_: sessão parcial, sessão limitada, sessão pendente, meio-login

## Relacionamentos

- Uma **Sessão restrita** existe enquanto houver **Senha provisória** pendente ou segundo fator exigido e não configurado.
- Cumpridas as exigências, ela se torna sessão plena **sem** nova autenticação.

## Ambiguidades resolvidas

- "Sessão pendente" era usado tanto para a sessão restrita quanto para o desafio de segundo fator ainda não respondido. Resolvido: são estados distintos — no desafio **não existe sessão**; a **Sessão restrita** já é uma sessão válida, com alcance reduzido.
