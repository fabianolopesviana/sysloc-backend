---
description: Âncoras de superfície publicada — como uma superfície (colunas de tabela ou visão, inventário de rotas, símbolos exportados, catálogo) é provada, quando a âncora nasce e quem a declara. Carregada ao escrever ou revisar teste que afirma conjunto, e ao gerar ou executar task que publica símbolo ou rota.
paths:
  - "apps/**"
  - "packages/**"
  - "docs/specs/**"
  - ".claude/skills/agent-spec-*generate*/**"
  - ".claude/skills/agent-spec-*-run*/**"
---

# Âncoras de Superfície Publicada

- **Superfície publicada é afirmada por igualdade de conjunto, nunca por contenção.** Acompanhe
  sempre de um controle antivácuo. Por quê: `toContain` aprova tanto o item que sumiu quanto o que
  apareceu sem ninguém decidir — as duas direções precisam reprovar; e sem o controle, comparar dois
  conjuntos vazios passa por vacuidade, que é comparar nada com nada.
  ✅ `expect(observados.length).toBe(DECLARADOS.length);`
     `expect(diferencasDeConjunto(observados, DECLARADOS)).toEqual({ excedentes: [], ausentes: [] });`
  ❌ `expect(observados).toContain('campoNovo');`

- **Publicar lista fechada ou constante espelhada obriga a âncora no mesmo diff.** Por quê: sem ela
  a superfície cresce em silêncio — foi assim que a visão declarada *fonte única do estado* ganhou
  duas colunas sem nada forçar revisão, enquanto a tabela que ela deriva tinha a sua âncora.
  ✅ símbolo novo no barril do pacote sai no mesmo commit que o acrescenta ao inventário asserido
  ❌ publicar `ESTADOS_EM_ABERTO` sem nenhuma asserção que fixe o conjunto

- **A §5.2 da task declara os arquivos-âncora que a publicação faz crescer**, derivados por busca
  antes de a spec fechar; e a contagem escrita em prosa sobe no mesmo diff da constante que o teste
  afirma. Por quê: sem a declaração, o executor descobre esses arquivos pela suíte vermelha, toca-os
  por necessidade e os declara como pendência — e os dois gates gastam uma passagem decidindo se foi
  alargamento de escopo. E número narrativo que fica para trás convida a próxima task a "corrigir" a
  âncora executável para o valor errado.
  ✅ `§5.2 — cobertura-de-autorizacao.e2e.spec.ts (inventário de rotas: 92 → 93)`
  ❌ §5.2 listando só o controlador novo, com as três âncoras de igualdade descobertas na execução
