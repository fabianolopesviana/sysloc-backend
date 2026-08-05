---
id: 0010
title: Efetivo de permissão calculado do perfil com overrides bidirecionais, transportado na sessão e revalidado por versão
status: accepted
date: 2026-08-04
tags: [auth, security, architecture]
---

# 0010 - Efetivo de permissão calculado do perfil com overrides bidirecionais, transportado na sessão e revalidado por versão

## Context

A ADR-0008 fixa que o dado é escopado pelo banco e a ADR-0009 separa identidade de negócio.
Nenhuma das duas diz **quem pode fazer o quê** dentro de uma empresa. O produto exige três perfis
**mais permissões ajustáveis por usuário** sobre uma matriz de 10 áreas de tela e 7 ações
sensíveis, e exige que revogação bloqueie **na hora**, não no próximo login nem ao fim da sessão de
8 horas.

Entre "consultar o banco a cada requisição" e "confiar na sessão até ela expirar" há um espaço de
decisão que **toda rota das fases seguintes vai herdar sem participar do debate** — e cuja reversão,
depois de N recursos publicados, custa reescrever a autorização de cada um deles.

## Decision

O efetivo de permissão de uma pessoa é o conjunto do seu perfil somado aos overrides dela, com a
**negação vencendo a concessão**. Ele viaja na sessão junto de um contador de versão **por usuário**,
e cada requisição compara esse contador com o corrente: divergiu, o servidor **relê o efetivo e
atende** — em vez de recusar.

## Consequences

**Pros:**
- Autorizar não custa montar o efetivo a cada requisição: a leitura por requisição é um inteiro.
- Revogação reflete na requisição seguinte, sem esperar expiração de sessão.
- O Admin pode **retirar** de uma pessoa algo que o perfil dela concede — impossível em modelo aditivo.
- O perfil segue vivo: corrigir um default alcança quem não tem override sobre aquela chave.
- Mudança de permissão não é erro para o cliente — ninguém vê recusa nem é deslogado.

**Cons:**
- A precedência da negação só existe em código; sem prova dedicada, um caminho de leitura pode ignorá-la e uma permissão retirada continuar valendo.
- Toda escrita que altere perfil ou override precisa incrementar o contador na mesma transação — esquecer é revogação que não reflete.
- A sessão passa a carregar dado que envelhece, e o campo publicado congela junto com a superfície da API.

**Neutros:**
- A matriz por perfil é constante de código; permissão de escopo-empresa (plano, módulo contratado) exigiria um segundo contador, que é acréscimo retrocompatível.
- Ler um inteiro por requisição é a fatia da alternativa "consultar a cada requisição" que esta decisão conserva deliberadamente.

## Alternatives considered

- **Consultar o estado a cada requisição** — a guarda monta o efetivo do banco em todo pedido. Motivo da rejeição: paga a montagem completa por requisição para ganhar a garantia que a comparação de um inteiro já dá, e deixaria a sessão sem o efetivo, obrigando o cliente a uma chamada extra só para desenhar o menu.
- **Override apenas aditivo** — o perfil é piso e o override só soma. Motivo da rejeição: não sabe expressar "retirar uma ação sensível de um Admin Empresa"; para "desmarcar" significar algo, os perfis teriam de ser pisos quase vazios, devolvendo ao Admin o trabalho de marcar tudo pessoa a pessoa.
- **Efetivo materializado no salvamento** — grava-se o conjunto final por pessoa. Motivo da rejeição: o perfil deixa de ser conceito vivo — corrigir um default não alcança ninguém já criado, e a base acumula retratos divergentes sem origem comum.
- **Recusar a requisição quando a versão diverge** — erro que o cliente traduz em "suas permissões mudaram". Motivo da rejeição: trata mudança de permissão como falha, gasta um código do enum fechado da ADR-0007 e transfere ao cliente um retry que o servidor resolve sozinho.
- **Encerrar a sessão na divergência** — a pessoa loga de novo. Motivo da rejeição: apaga a distinção entre **mudar permissão** e **revogar acesso**, que esta arquitetura separa deliberadamente — suspensão e desativação apagam sessões, mudança de permissão não.

## Applied in

- `autorizacao-e-ciclo-de-acesso (v1)` — docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/pre-refinement.md (decisão originada; adoção pendente)
