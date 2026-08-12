---
id: 0026
title: O relógio da operação mora no banco — a aplicação nunca lê o do processo
status: accepted
date: 2026-08-11
tags: [architecture, data]
---

# 0026 - O relógio da operação mora no banco — a aplicação nunca lê o do processo

## Context

Decisões de negócio dependem de *que dia é hoje* e *que horas são*: a transição de uma cobrança para
vencida, a janela de horário em que um aviso pode sair, o ano do escopo de uma série. Cada uma dessas
leituras precisa de uma origem declarada, e até aqui o produto tinha três candidatas em uso
simultâneo.

Ler do processo depende da variável `TZ`, que nenhuma unidade de serviço declara: hoje acerta por
acidente — o host está no mesmo fuso da operação — e passaria a errar em silêncio sob UTC, sem uma
linha vermelha em lugar nenhum. Ler do banco por expressão a fuso de **sessão** apenas muda o
problema de lugar: a virada do dia passa a depender de quem conectou, e a mesma linha apareceria
vencida para um cliente e em dia para outro. E manter dois relógios faz os dois discordarem
exatamente na virada da meia-noite, que é quando a resposta muda.

## Decision

Toda leitura de tempo que decide comportamento de negócio vem do **banco**, através de função cujo
fuso é propriedade do **objeto** — nunca do relógio do processo, nunca de expressão a fuso de sessão.
A aplicação recebe o instante já resolvido, por parâmetro, e a decisão que o consome é pura.

## Consequences

**Pros:**
- Uma fonte de tempo só: nada diverge na virada do dia, porque não há segundo relógio para divergir.
- O fuso deixa de ser alcançável por quem consulta — nem por variável de ambiente, nem por
  configuração de sessão, nem por argumento.
- A decisão que consome a hora fica pura e verificável sem relógio nem processo de pé.
- Trocar host, fuso do sistema operacional ou forma de execução não muda comportamento.

**Cons:**
- **Nenhum caso comportamental pega a violação** enquanto o host estiver no mesmo fuso da função: a
  única rede é asserção estática, e por isso ela exige prova de falsificação.
- Custa uma ida ao banco em caminho que às vezes não teria nenhuma.
- Um precedente da base **diverge e permanece**: `lerAnoDaSerieDeContrato` deriva de `current_date`,
  que é fuso de sessão, enquanto o leitor irmão da cobrança usa a função de fuso fixado. Esta ADR
  **não aciona correção** — o registro é a rede, e a assimetria já está descrita no docblock de
  `packages/db/src/cobranca.ts`.
- Código que precisaria só de um carimbo aproximado paga o mesmo preço, ou tem de justificar exceção.

**Neutros:**
- Não alcança carimbo de auditoria persistido, cujo valor já vem do servidor por padrão de coluna.
- Não fixa **qual** é o fuso — fixa que ele é propriedade do objeto que serve o valor.
- Complementa a ADR-0023, que decide **onde** vive a derivação, dizendo de que relógio ela parte.

## Alternatives considered

- **Relógio do processo com `TZ` declarada nas unidades de serviço** — mais barato, sem ida ao banco.
  Motivo da rejeição: transfere a correção para configuração de implantação, que não é versionada
  junto do comportamento nem verificada por ninguém, e mantém dois relógios vivos.
- **Fuso fixo no código da aplicação**, resolvendo o instante do processo com a zona escrita à mão.
  Motivo da rejeição: acerta o fuso e não resolve a duplicidade — os dois relógios continuam
  existindo e voltam a discordar na virada da meia-noite, que é quando a decisão importa.
- **Expressão de tempo do banco a fuso de sessão**, sem função própria. Motivo da rejeição: o relógio
  já seria único, mas o fuso passaria a ser escolha de quem conecta — a mesma linha mudaria de estado
  conforme a conexão.

## Applied in

- `cobranca-e-mora (v1)` — packages/db/migracoes/0010_seguranca_cobranca.sql (`negocio.data_corrente_da_operacao()`,
  onde a função nasceu, e a view `cobranca_derivada` que a consome)
- `regua-de-cobranca (v1)` — docs/specs/features/regua-de-cobranca/v1/tech_spec.md §5.1-B passo 4 (a
  hora da janela lida pela borda, com a rede estática no CT-612)
