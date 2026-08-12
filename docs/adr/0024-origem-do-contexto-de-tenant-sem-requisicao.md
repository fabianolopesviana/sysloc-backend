---
id: 0024
title: Origem legítima do contexto de tenant quando não há requisição
status: accepted
date: 2026-08-11
tags: [architecture, security, data]
---

# 0024 - Origem legítima do contexto de tenant quando não há requisição

## Context

A ADR-0008 fixa que o isolamento é propriedade do banco e que o contexto que a RLS consome é fixado
por transação com `SET LOCAL`, com origem que **nunca é o request**. Ela não diz qual é a origem
quando **não existe request**: até aqui, todo caminho de escrita nasceu de uma sessão admitida, e o
escritor único do contexto é a guarda que a publica.

O produto passa a executar trabalho fora do ciclo de uma requisição — trabalho enfileirado, rotinas
agendadas e retorno de integração externa. Sem origem declarada, restam dois desfechos, ambos ruins:
o trabalho roda sem contexto e a RLS devolve vazio **em silêncio**, ou cada borda nova inventa a
própria origem — que é exatamente a instalação por ponto que a ADR-0008 existe para impedir.

## Decision

Toda execução que ocorre fora de uma requisição estabelece o contexto de tenant a partir da **carga
do próprio trabalho**, uma única vez, **na borda que a recebe** — pelo mesmo escritor único que a
borda HTTP usa. O identificador de empresa que viaja na carga é produzido por quem **já detinha
direito a ele**: a sessão que enfileirou, ou a enumeração de tenants; ele nunca é aceito de fonte
externa. A enumeração de tenants é a **única** leitura legítima sem contexto de empresa, e vive no
schema sem noção de tenant.

## Consequences

**Pros:**
- O contexto continua **ambiente** e com escritor único por borda — a propriedade que a ADR-0008
  estabelece sobrevive à primeira execução sem sessão, em vez de ganhar exceção.
- A fronteira segue sendo do banco: trabalho sem carga válida não alcança linha alguma.
- A cláusula de procedência impede que a carga vire "o novo request" — uma origem externa não
  consegue escolher a empresa que o trabalho vai processar.
- Bordas futuras (agendamento, retorno de integração) herdam o critério em vez de redecidir.

**Cons:**
- Acrescenta um segundo escritor legítimo a um símbolo cujo cabeçalho hoje nomeia um só — exige
  emenda desse cabeçalho e marcador no ponto, sob pena de o próximo leitor tratar a borda nova como
  violação.
- A procedência do identificador **não é verificável pelo banco**: ela é disciplina de quem enfileira,
  provada por teste, não imposta por estrutura.
- Trabalho enfileirado com carga de uma empresa que deixou de existir falha na borda, não na
  seleção — a falha muda de lugar.

**Neutros:**
- Não altera a forma da carga de nenhuma fila: apenas declara que o identificador de empresa é campo
  obrigatório dela, e de onde ele veio.
- Complementa a ADR-0008 sem substituí-la; a ADR-0009 continua sendo quem define o schema em que a
  enumeração de tenants vive.

## Alternatives considered

- **Sessão de serviço sintética** — o processo de trabalho autentica com credencial própria e herda
  o contexto pelo caminho normal. Motivo da rejeição: cria credencial de longa duração que a barreira
  única de admissão fechou, e atribui ato de auditoria a um usuário que não existe.
- **Papel de banco próprio para o processo de trabalho, sem RLS** — dispensa contexto por completo.
  Motivo da rejeição: **contorna** o isolamento em vez de usá-lo, e ressuscita a varredura
  cross-tenant que a ADR-0008 tornou impossível.
- **Carga do trabalho como origem, sem cláusula de procedência** — mais curta, deixando cada fatia
  decidir de onde o identificador veio. Motivo da rejeição: sem a cláusula, uma borda que aceite o
  identificador de fora reconstitui exatamente o request como origem, com outro nome.
- **Alcance restrito a trabalho enfileirado** — a decisão valeria só para a fila. Motivo da rejeição:
  o retorno de integração externa e a entrada por linha de comando têm o mesmo problema e
  redecidiriam separado, com risco de divergirem.

## Applied in

- `regua-de-cobranca (v1)` — docs/specs/features/regua-de-cobranca/v1/tech-alignment.md (decisão D2 —
  o trabalho por empresa da régua é a primeira execução sem sessão do produto)
