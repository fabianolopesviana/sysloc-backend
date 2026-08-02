---
id: 0005
title: Rotinas operacionais versionadas no repositório com instalação idempotente
status: accepted
date: 2026-07-29
tags: [build, architecture, security]
---

# 0005 - Rotinas operacionais versionadas no repositório com instalação idempotente

## Context

As rotinas automáticas são disparadas pelo agendador do sistema operacional, e sua configuração existe apenas no servidor. Das seis rotinas ativas, duas invocam scripts que não estão versionados em lugar nenhum, e um deles carrega a credencial do banco de dados em texto plano. Não há como reconstruir o agendamento a partir do repositório, revisar uma alteração antes que ela valha, nem determinar quando um horário mudou — a divergência entre a documentação e o estado real só foi descoberta ao consultar o servidor.

A decisão anterior de manter o agendador do sistema operacional como gatilho — em vez do agendador da aplicação, que já parou silenciosamente em produção — permanece válida. O que esta decisão muda é **onde a configuração vive**, não quem dispara.

## Decision

Toda rotina operacional agendada — a definição de agendamento e os scripts que ela invoca — vive no repositório e é posicionada no sistema por um procedimento de instalação idempotente. Nenhum script executável de produção permanece fora de controle de versão, e **nenhum entra no repositório carregando credencial**: extrair o segredo para configuração não versionada é condição de entrada, não ajuste posterior.

## Consequences

**Pros:**
- O agendamento passa a ser reconstruível e revisável; alterar horário ou destino exige passar por revisão.
- Reinstalar é operação segura: o procedimento é idempotente e executá-lo repetidamente não duplica entrada.
- A condição de entrada elimina, na origem, a classe de exposição que hoje existe no script de backup.

**Cons:**
- A configuração deixa de ser editável direto no servidor; toda mudança passa a exigir repositório e reinstalação.
- Scripts com credencial embutida precisam ser corrigidos antes de entrar, o que adia a adoção deles.
- Passam a existir uma fonte versionada e uma cópia instalada; a divergência entre as duas é possível e não é detectada sozinha.

**Neutros:**
- O agendador do sistema operacional segue como gatilho — esta decisão não reabre aquela escolha.
- Frequência e horário das rotinas não mudam por esta decisão.

## Alternatives considered

- **Agendador apontando direto para o repositório** — as rotinas invocariam os scripts no próprio diretório de trabalho, dispensando cópia e sincronização. Motivo da rejeição: acopla a execução de produção ao estado do diretório de trabalho; uma troca de ramo ou operação de versionamento passaria a alterar o que roda em produção.
- **Versionar apenas a definição de agendamento** — horários e destinos no repositório, scripts permanecendo onde estão. Motivo da rejeição: deixaria executáveis de produção fora de qualquer histórico, mantendo a reconstrutibilidade parcial exatamente onde ela mais importa.
- **Excluir do alcance os scripts que carregam credencial** — adoção imediata mais simples, sem exigir correção prévia. Motivo da rejeição: manteria o backup — última linha de defesa do sistema — como o único componente sem histórico, e trataria a credencial embutida como restrição aceita em vez de defeito a corrigir.

## Applied in

- `saas-multi-empresa (v1)` — decisão D3 do tech-alignment daquela feature. **A feature foi excluída do repositório em 2026-08-01** (plano Frappe abandonado — ver `docs/plano-backend-novo/decisao-e-stack.md` §9); o registro de aplicação fica, o caminho não existe mais.
