---
description: Convenções do contrato publicado em @sysloc/contracts — a direção do dado decide a estritude do esquema, e como a recusa por chave desconhecida é provada. Carregada ao escrever ou revisar esquema do pacote de contratos, e ao gerar spec que defina a entrada ou a saída de uma rota.
paths:
  - "packages/contracts/**"
  - "docs/specs/**"
  - ".claude/skills/agent-spec-*generate*/**"
---

# Contrato Publicado

- **A direção decide a estritude: entrada é fechada, saída é aberta.** Esquema de entrada usa
  `z.strictObject`; esquema de saída usa `z.object`. Por quê: campo desconhecido na entrada é erro
  do cliente e precisa ser recusado nomeando a chave, senão passa em silêncio; campo novo na saída
  precisa poder nascer sem quebrar cliente já publicado — e este pacote é importado pelo frontend.
  A escolha é da direção, nunca do autor do esquema.
  ✅ entrada `z.strictObject({ nome: z.string() })` · saída `z.object({ id: z.uuid(), nome: z.string() })`
  ❌ `z.object` na entrada — aceita chave desconhecida sem recusar

- **A recusa por chave desconhecida é afirmada por `code` e pela lista `keys`.** Por quê: só o
  booleano de insucesso não discrimina *qual* chave foi recusada, e a asserção passa a aprovar
  qualquer falha de esquema — inclusive uma que nada tem a ver com a chave excedente.
  ✅ `expect(erro.code).toBe('unrecognized_keys');` · `expect(erro.keys).toEqual(['empresaId']);`
  ❌ `expect(resultado.success).toBe(false);`
