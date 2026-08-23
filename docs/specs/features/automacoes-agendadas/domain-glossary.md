# Glossário de Domínio — Automações agendadas

> Termos específicos desta feature. Os cross-feature (**Rotina agendada**, **Passagem**) vivem no
> glossário global, em `docs/specs/domain-glossary.md`. Canonizados na sessão de
> `/agent-spec-challenge-spec` de 2026-08-22.

## Termos

**Registro de execução**:
O que uma **Passagem** deixa gravado quando — e só quando — ela produziu efeito, em vocabulário do produto e pertencente à **Empresa**.
_Evitar_: log de execução, histórico do job, auditoria da rotina, run log

**Limiar de atraso**:
O tempo de silêncio a partir do qual uma **Rotina agendada** é considerada parada, derivado da cadência dela e nunca declarado rotina a rotina.
_Evitar_: timeout, SLA, tolerância, threshold, prazo máximo

**Impedimento**:
O que impede uma **Rotina agendada** de produzir efeito e está na alçada do **Admin Empresa** — nunca problema de infraestrutura, que é do **Sysloc Master**.
_Evitar_: erro, falha, bloqueio, pendência, warning

**Despachante**:
O processo efêmero que, a cada disparo do relógio, enumera as **Empresas** ativas e enfileira o trabalho de uma **Rotina agendada** — ele não executa o trabalho.
_Evitar_: scheduler, agendador, orquestrador, dispatcher, worker

## Relacionamentos

- O **Despachante** enfileira; quem executa é o processo de trabalho, e cada execução é uma **Passagem**.
- Uma **Passagem** com efeito produz exatamente um **Registro de execução**; sem efeito, nenhum.
- Uma **Rotina agendada** é considerada parada quando o silêncio dela excede o **Limiar de atraso**.
- Um **Impedimento** é visível ao **Admin Empresa** na leitura de estado; ele nunca vira alerta de operação.

## Ambiguidades resolvidas

- "saúde" era usada tanto para a prontidão de infraestrutura (rota pública, sem sessão) quanto para o estado das rotinas de uma **Empresa** — resolvido: são conceitos distintos, e a segunda não entra sob `/saude`.
- "parada" era usada tanto para a unidade que **falhou** quanto para a rotina que **não executou** — resolvido: a primeira é falha de despacho (alerta de operação), a segunda é ausência medida contra o **Limiar de atraso**.
