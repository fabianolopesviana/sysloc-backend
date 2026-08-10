# Rule candidates — cobranca-e-mora/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Fixture de módulo por recurso publicado

**Regra que isto sugere:** todo recurso publicado ganha uma constante de módulo no `.spec.ts` (`CORPO_DE_X` para entrada, `X_PUBLICADA` para saída) que os casos remendam com spread, em vez de literais por caso.

**O que ela faria (simples):** os casos novos da cobrança reusam duas fixtures de módulo em cinco `describe` diferentes, e é isso que faz um campo novo do contrato aparecer em todos os casos de uma vez; sem a convenção escrita, o próximo implementador escreve literais por caso e o remendo de um campo passa a divergir entre eles.

- Evidência: `CORPO_DE_COBRANCA` e `COBRANCA_PUBLICADA` remendados por spread em CT-540 a CT-544 — `packages/contracts/test/esquemas.spec.ts:308` — T2 / contrato de tipos da cobrança
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T02:10:00Z

---

## [repeated_assertion_shape] Recusa de esquema afirma success e path do campo

**Regra que isto sugere:** toda recusa de esquema é afirmada pelo par `success === false` + `issues[0].path === [campo]` (ou `issues[0].code`), nunca só por `success === false`.

**O que ela faria (simples):** a mesma dupla de asserções aparece em quatro casos desta task, e é ela que impede uma recusa de chegar ao cliente sem nome de campo — o que a §6.1 do tech spec exige como `422 CAMPO_INVALIDO`; escrita como regra, ela deixa de depender de o autor do próximo esquema lembrar de copiar o formato.

- Evidência: `expect(resultado.success).toBe(false)` seguido de `expect(resultado.error?.issues[0]?.path).toEqual([campo])` em quatro describes — `packages/contracts/test/esquemas.spec.ts:1453` — T2 / contrato de tipos da cobrança
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T02:10:00Z

---

## [convention_drift] Listas-espelho de objetos do schema de negócio

**Regra que isto sugere:** toda criação de tabela ou função em `negocio` atualiza, no mesmo commit, as quatro listas exatas que espelham o schema, e o ponto único que as nomeia vive no cabeçalho do arquivo de esquema.

**O que ela faria (simples):** quatro listas exatas em três frentes precisam crescer junto com o schema, mas nenhuma é descobrível a partir das outras — cada fatia que cria tabela as reencontra por lista vermelha depois do fato, e a da frente shell só é conferida por quem consegue rodar `sudo`. A regra faria o autor da task já declarar os quatro arquivos como impactados.

- Evidência: `TABELAS_LEGITIMAS`, `TABELAS_DE_NEGOCIO_ESPERADAS` (TypeScript e shell) e `SIMBOLOS_ESPERADOS` — duas ausentes da §5.2 da task e alcançadas por reprovação da suíte, repetindo o padrão das migrações `0005` e `0007` — `packages/db/test/catalogo.spec.ts:198` — T3 / schema e migrações da cobrança
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T04:30:00Z

---

## [repeated_fixture] Subida de instância efêmera e acesso ao banco

**Regra que isto sugere:** padronizar num acessório único o par `bancoEfemero()` + `abrirAcessoAoBanco({ maximoDeConexoes })` que toda suíte de `packages/db/test/` repete na abertura.

**O que ela faria (simples):** a mesma abertura de instância efêmera mais reserva de conexão é reescrita à mão em cada bloco de suíte, inclusive duas vezes no mesmo arquivo quando um caso precisa de instância dedicada para mutantes; uma regra apontando o acessório canônico evita que cada suíte escolha um número de conexões e um limite de subida diferentes.

- Evidência: `bancoEfemero()` + `abrirAcessoAoBanco({ maximoDeConexoes: RESERVA_DE_UMA })` repetido na instância principal e na dedicada aos mutantes — `packages/db/test/cobranca.spec.ts:348` — T4 / porta de dados da cobrança
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T05:10:00Z

---

## [repeated_assertion_shape] Leitura crua da visão comparada por objeto inteiro

**Regra que isto sugere:** afirmar os derivados monetários da visão pelo objeto inteiro em cadeia `numeric`, e nunca campo a campo nem por número convertido.

**O que ela faria (simples):** a mesma forma de asserção — ler os cinco derivados como texto e comparar o objeto completo por igualdade — aparece em seis pontos de três casos, sempre pela mesma razão (a cadeia é o que preserva a escala do `numeric(15,2)`, que o número em JavaScript perde); escrita como regra, deixa de depender de cada autor redescobrir o motivo.

- Evidência: `expect(await lerDerivadaCrua(...)).toEqual({ status, dias_atraso, valor_multa, valor_juros, valor_total })` em seis pontos — `packages/db/test/cobranca.spec.ts:497` — T4 / CT-513, CT-524 e CT-526
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T05:10:00Z

---

## [repeated_assertion_shape] Companheiro negativo por interseção vazia

**Regra que isto sugere:** todo caso de isolamento afirma o conjunto próprio por igualdade E a interseção com o conjunto da outra empresa como lista vazia.

**O que ela faria (simples):** o par — igualdade do conjunto próprio, seguida de interseção igual a `[]` — repete-se em quatro pontos e já era o molde do CT-107; escrever a convenção evita que um caso de isolamento futuro afirme só o conjunto próprio, que fica verde mesmo quando a linha alheia atravessa junto.

- Evidência: `expect(intersecao(<lidos>, <ids da outra empresa>)).toEqual([])` nos casos novos de isolamento — `packages/db/test/isolamento.spec.ts:3418` — T3 / visão `negocio.cobranca_derivada`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-10T04:00:00Z

---

## [convention_drift] Lista fechada publicada exige asserção de congelamento

**Regra que isto sugere:** toda constante de lista fechada exportada por `@sysloc/contracts` tem, no CT que a cobre, igualdade contra lista escrita por extenso no teste e asserção de `Object.isFrozen`.

**O que ela faria (simples):** o CT-540 já aplica esse par a `NATUREZAS_DE_COBRANCA` e `ESTADOS_DA_COBRANCA`, mas a convenção não está escrita em rule nem em ADR — só existe como precedente no próprio arquivo de teste. Por isso `ESTADOS_EM_ABERTO`, publicada pelo mesmo módulo e pela mesma razão, entrou congelada e sem ninguém afirmando que está congelada. Com a regra escrita, um `push` de consumidor deixaria de atravessar a suíte em silêncio.

- Evidência: `ESTADOS_EM_ABERTO` publicada sem nenhuma asserção em `packages/contracts/test/`, enquanto os dois irmãos do mesmo módulo têm igualdade por extenso e `Object.isFrozen` no CT-540 — `packages/contracts/src/cobranca.ts:158` — T4 / porta de dados da cobrança
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:00:00Z

---

## [repeated_fixture] Acessório HTTP e de concessão das suítes E2E

**Regra que isto sugere:** centralizar o acessório de requisição HTTP, entrada de sessão e concessão de chaves num utilitário compartilhado das suítes E2E de `apps/api/test/`, em vez de recopiá-lo por arquivo.

**O que ela faria (simples):** toda suíte E2E nova recopia o mesmo trio — `pedir` (requisição com `Origin` e leitura de cookie), `entrar` (login pela rota real) e `conceder` (ajuste de chaves pela camada de dados) — mais a lista `VARIAVEIS_MONTADAS` de restauração de ambiente. Hoje são 12 cópias de `pedir`, 6 de `conceder` e 18 de `VARIAVEIS_MONTADAS`, e a T6 acrescentou uma de cada. A regra evitaria que a próxima suíte copie de novo e que as cópias divirjam em silêncio quando a barreira de admissão ou o cabeçalho conferido mudar.

- Evidência: acessórios `pedir`/`entrar`/`conceder` replicados literalmente entre suítes E2E de `apps/api/test/` — `apps/api/test/mora.e2e.spec.ts:584` — T6 / duas rotas de `/v1/multa-e-juros`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-10T08:20:00Z

---

## [convention_drift] Constante de módulo devolvida por porta

**Regra que isto sugere:** constante de módulo que uma porta devolve como valor da ausência nasce sob `Object.freeze`.

**O que ela faria (simples):** quatro portas de `packages/db/src` congelam o objeto que devolvem quando não há linha, com o docblock *"Congelado — é compartilhado por toda leitura"*, e a quinta nasceu sem congelar porque a convenção só existe no código. O `readonly` do tipo não substitui o congelamento: ele se perde quando o serviço alarga o tipo na borda, e aí um consumidor pode mutar o objeto do processo inteiro.

- Evidência: `POLITICA_AUSENTE` devolvida por referência sem `Object.freeze`, contra 4 precedentes congelados no mesmo pacote (`SEM_FIADORES`, `SEM_COMODOS`, `SEM_IMOVEIS`, `EFEITOS_DA_ATIVACAO`) — `packages/db/src/configuracao-de-mora.ts:119` — T6 / porta da política de mora
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:35:00Z

---

## [convention_drift] Esquema de saída aberto, entrada fechada

**Regra que isto sugere:** esquema de **ENTRADA** é `strictObject` e esquema de **SAÍDA** publicado é `z.object` — a assimetria é a regra, não a exceção.

**O que ela faria (simples):** o pacote de contratos aplica essa divisão em 13 de 13 esquemas, mas ela não está escrita em rule nem em ADR — só é inferível por imitação do arquivo vizinho, e o `DECISÃO FECHADA` que existe cobre a restrição de *escala*, não o fechamento do objeto. O sétimo esquema de saída nasceu fechado, e como nenhuma varredura da suíte olha esquema de saída, a divergência viaja para o documento OpenAPI publicado como `additionalProperties: false`.

- Evidência: `esquemaDaConfiguracaoDeMora` é `strictObject`; os 6 esquemas de saída anteriores do pacote são todos `z.object` — `packages/contracts/src/configuracao-de-mora.ts:117` — T6 / contrato publicado da política de mora
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:35:00Z

---

## [convention_drift] Tipo de escrita separado do de leitura

**Regra que isto sugere:** porta de escrita recebe um tipo `DadosDeX` próprio, nunca o `XPersistido` que a leitura devolve.

**O que ela faria (simples):** as sete portas de escrita do pacote declaram um tipo de entrada dedicado, e a oitava reusou o de saída porque as duas formas coincidem hoje. A separação é o que impede o primeiro campo somente-de-leitura de virar campo exigido no corpo da escrita — foi entrada e saída partilhadas que produziram o furo do `status_locacao` em `alterarImovel`.

- Evidência: `gravarConfiguracaoDeMora(tx, dados: ConfiguracaoDeMoraPersistida)` contra `DadosDaCobranca`, `DadosDoContrato`, `DadosDoImovel`, `DadosDaAlteracaoDoImovel`, `DadosDoConjunto`, `DadosDoComodo` — `packages/db/src/configuracao-de-mora.ts:192` — T6 / porta da política de mora
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-10T08:35:00Z

---
