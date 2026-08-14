# Glossário de Domínio — documentos-e-confirmacao

> Termos **específicos desta feature**. O vocabulário do produto vive em
> `docs/specs/domain-glossary.md`, e é lido primeiro — em conflito, este arquivo sobrescreve, o que
> aqui **não acontece**: nenhum dos dois termos abaixo existe no global.
>
> Os quatro termos desta feature que são vocabulário do **produto** — **Documento do contrato**,
> **Marca de cancelamento**, **Portador de confirmação** e **Veredito de divergência** — foram
> registrados no glossário global, e não se repetem aqui.

## Termos

**Derivado**:
O `SHA-256` do segredo de um **Portador de confirmação** — a única forma dele que o banco guarda, e o eixo pelo qual a apresentação é buscada.
_Evitar_: hash do token, token hasheado, digest, `email_token_hash`

**Representação textual**:
O degrau intermediário entre a composição do **Documento do contrato** e a renderização: a lista ordenada de blocos que a função pura produz, e sobre a qual a igualdade com o oráculo corre.
_Evitar_: AST do documento, modelo do PDF, texto puro, intermediário

## Relacionamentos

- Um **Portador de confirmação** tem exatamente um **Derivado**, e o segredo que o origina não é guardado em lugar nenhum.
- A composição do **Documento do contrato** produz uma **Representação textual**; a porta de renderização a transforma em bytes.
- A **Marca de cancelamento** é parâmetro da composição, logo entra na **Representação textual** — nunca é aplicada depois, sobre os bytes.

## Ambiguidades resolvidas

- "Token" era usado tanto para o segredo que viaja no link quanto para o que o banco guarda. Resolvido: são conceitos distintos e a distinção é o mecanismo inteiro — o que viaja é o segredo do **Portador de confirmação**; o que se guarda é o **Derivado**. O legado chamava a coluna de `email_token_hash` e ela **não continha hash algum** (era o identificador do locatário mais o timestamp, em claro), o que torna o termo herdado ativamente enganoso.
- "Texto do contrato" era usado tanto para a **Representação textual** quanto para o texto extraído de volta do PDF na verificação. Resolvido: a igualdade com o oráculo corre sobre a **Representação textual**; o texto extraído do PDF é usado só para provar que a renderização não perde, reordena nem trunca.
