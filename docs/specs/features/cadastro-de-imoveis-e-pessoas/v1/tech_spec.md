# TECH_SPEC -- Especificação Técnica (Backend)

## 1. Identificação
- **Feature/Projeto**: Cadastro de imóveis e pessoas do domínio de locação
- **Variante**: backend
- **Stack**: Node 24 LTS · TypeScript strict · NestJS 11 + Fastify · Drizzle + postgres.js · PostgreSQL 18 · Zod 4
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-05
- **Versão**: v1
- **Status**: Draft
- **PRD Relacionado**: `docs/prds/features/cadastro-de-imoveis-e-pessoas/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/tech-alignment.md`

---

## 2. Resumo Técnico da Solução

Seis entidades de negócio nascem no schema `negocio` sob o padrão que a F1 instalou — discriminador de
empresa, RLS forçada, restrição `(id, empresa_id)` e chave estrangeira composta —, mais o pacote
`@sysloc/contracts`, que passa a ser a fonte única do contrato: os mesmos esquemas validam a entrada,
tipam a resposta e produzem o documento publicado (ADR-0016).

Três decisões estruturam a implementação. A **unidade de trabalho é aberta na borda** e o executor é
passado adiante, o que torna a composição imóvel+cômodos atômica sem tocar o marcador que recusa
aninhamento. A **metragem total é derivada na leitura**, com um ponto único de avaliação — divergência
entre o agregado e as partes deixa de ser possível. E a **retirada de circulação** passa por uma porta
única de leitura por entidade, com o predicado aplicado por padrão e a inclusão de retirados só por
parâmetro nomeado.

A superfície soma **33 rotas** sob `/v1`, todas declarando exigência dentro do catálogo fechado
existente. A equivalência da metragem é provada contra o golden capturado do sistema antigo.

---

## 3. Arquitetura da Solução

### 3.1 Visão Geral

```
HTTP (Fastify)
  └─ Guarda de contexto (F1) — admite a sessão, publica o contexto de tenant
      └─ Controlador (apps/api/src/<area>/*.controller.ts)
          │  valida com o esquema de @sysloc/contracts
          │  ABRE a unidade de trabalho (D1) e passa o executor adiante
          └─ Serviço (*.service.ts) — regra de domínio, recebe o executor
              └─ Acesso a dado (packages/db/src/<entidade>.ts) — porta única de leitura
                  └─ PostgreSQL — RLS forçada decide o que a consulta enxerga
```

Nenhum filtro por empresa é escrito em consulta, serviço ou repositório: o caminho é um só, e é o
banco (ADR-0008).

### 3.2 Componentes / Módulos

| Componente | Responsabilidade | Camada |
|---|---|---|
| `@sysloc/contracts` | esquemas de entrada e saída das 33 rotas; fonte única do contrato | contrato |
| `ImoveisModule` | conjuntos, imóveis e cômodos — controladores e serviços | apresentação + domínio |
| `CadastrosModule` | locadores, locatários e fiadores, por implementação parametrizada | apresentação + domínio |
| `ConjuntoService` · `ImovelService` · `ComodoService` | regra de domínio de cada agregado; recebem o executor | domínio |
| `CadastroDePessoaService` | serviço único parametrizado pelo papel | domínio |
| `packages/db/src/conjunto.ts` · `imovel.ts` · `comodo.ts` · `cadastro-de-pessoa.ts` | porta única de leitura e escrita por entidade | dados |
| `packages/shared/src/documento.ts` | conferência de CPF e CNPJ (dígito verificador) | compartilhado |
| `apps/api/src/comum/validacao.ts` | tradução de recusa de validação — extração do `validar()` (D38) | borda |

### 3.3 Camadas e Fronteiras

Layered com fronteira de pacote. Dependências correm em uma direção: controlador → serviço → acesso a
dado. O acesso a dado **não** conhece HTTP nem sessão; o serviço **não** abre transação; o controlador
**não** contém regra de domínio. `@sysloc/contracts` não depende de nenhum dos três — é folha, o que é
o que permite ao frontend importá-lo sem arrastar o servidor.

### 3.4 Visão em Árvore

```
apps/api/src/
├── cadastros/
│   ├── cadastro-de-pessoa.service.ts          [N]
│   ├── cadastros.module.ts                    [N]
│   ├── fiador.controller.ts                   [N]
│   ├── locador.controller.ts                  [N]
│   └── locatario.controller.ts                [N]
├── imoveis/
│   ├── comodo.controller.ts                   [N]
│   ├── comodo.service.ts                      [N]
│   ├── conjunto.controller.ts                 [N]
│   ├── conjunto.service.ts                    [N]
│   ├── imoveis.module.ts                      [N]
│   ├── imovel.controller.ts                   [N]
│   └── imovel.service.ts                      [N]
├── comum/
│   ├── validacao.ts                           [N]  (extração do `validar()` — D38)
│   ├── esquema-de-erro.ts                     [R]
│   └── filtro-excecao.ts                      [R]
├── autenticacao/
│   ├── exigencia.decorator.ts                 [R]
│   ├── contexto.guard.ts                      [R]
│   └── senha.controller.ts                    [M]  (passa a importar `validar` de comum/)
├── master/empresa.controller.ts               [M]  (idem)
├── usuarios/usuario.controller.ts             [M]  (idem)
└── app.module.ts                              [M]  (registra os dois módulos novos)

packages/contracts/                            [N]  (pacote novo)
├── package.json                               [N]
├── tsconfig.json                              [N]
├── tsup.config.ts                             [N]
└── src/
    ├── index.ts                               [N]
    ├── comum.ts                               [N]  (janela, envelope de lista, identificador)
    ├── conjunto.ts                            [N]
    ├── imovel.ts                              [N]
    ├── comodo.ts                              [N]
    └── pessoa.ts                              [N]

packages/db/
├── src/
│   ├── esquema/negocio.ts                     [M]  (seis tabelas + três enums)
│   ├── conjunto.ts                            [N]
│   ├── imovel.ts                              [N]
│   ├── comodo.ts                              [N]
│   ├── cadastro-de-pessoa.ts                  [N]
│   ├── index.ts                               [M]  (publica as funções novas)
│   ├── unidade-de-trabalho.ts                 [R]
│   └── catalogo.ts                            [R]
└── migracoes/
    ├── 0005_dominio_locacao.sql               [N]  (gerada)
    └── 0006_seguranca_dominio.sql             [N]  (manual: FORCE + políticas)

packages/shared/src/
├── documento.ts                               [N]
└── index.ts                                   [M]

apps/api/test/
├── cadastro-de-imoveis.e2e.spec.ts            [N]
├── cadastro-de-pessoas.e2e.spec.ts            [N]
├── circulacao-de-cadastro.e2e.spec.ts         [N]
├── contrato-publicado.e2e.spec.ts             [N]
├── cobertura-de-autorizacao.e2e.spec.ts       [M]  (conjuntos esperados crescem)
└── campos-fechados.e2e.spec.ts                [M]

packages/db/test/
├── metragem.spec.ts                           [N]
├── circulacao.spec.ts                         [N]
├── catalogo.spec.ts                           [M]  (CT-008: 2 → 9 tabelas)
├── isolamento.spec.ts                         [M]  (bateria alcança as seis novas)
└── unidade-de-trabalho.spec.ts                [M]  (CT-012: símbolos novos)

packages/shared/test/
├── documento.spec.ts                          [N]
└── superficie-publica.spec.ts                 [M]
```

Legenda: `[N]` Novo &nbsp; `[M]` Modificado &nbsp; `[R]` Referência

### 3.5 Arquivos a Criar

| Arquivo | Descrição | Camada |
|---|---|---|
| `packages/contracts/**` (8 arquivos) | pacote novo; esquemas e tipos das 33 rotas | contrato |
| `packages/db/src/conjunto.ts` | porta única de leitura e escrita de conjunto | dados |
| `packages/db/src/imovel.ts` | idem, mais a soma única da metragem | dados |
| `packages/db/src/comodo.ts` | idem; remoção física, sem circulação | dados |
| `packages/db/src/cadastro-de-pessoa.ts` | porta parametrizada pelos três papéis | dados |
| `packages/db/migracoes/0005_dominio_locacao.sql` | seis tabelas, três enums, restrições e índices | migração |
| `packages/db/migracoes/0006_seguranca_dominio.sql` | `FORCE ROW LEVEL SECURITY` e políticas | migração |
| `packages/shared/src/documento.ts` | conferência de CPF e CNPJ | compartilhado |
| `apps/api/src/comum/validacao.ts` | tradução de recusa de validação (D38) | borda |
| `apps/api/src/imoveis/**` (7 arquivos) | módulo, controladores e serviços de imóveis | apresentação + domínio |
| `apps/api/src/cadastros/**` (5 arquivos) | módulo, três controladores e o serviço parametrizado | apresentação + domínio |
| `apps/api/test/**` (4 arquivos) · `packages/db/test/**` (2) · `packages/shared/test/**` (1) | suítes novas | teste |

### 3.6 Arquivos a Modificar

| Arquivo | Modificação | Motivo |
|---|---|---|
| `packages/db/src/esquema/negocio.ts` | seis tabelas e três enums | as entidades da fatia |
| `packages/db/src/index.ts` | publica as funções de acesso novas | superfície do pacote |
| `packages/shared/src/index.ts` | publica a conferência de documento | superfície do pacote |
| `apps/api/src/app.module.ts` | registra `ImoveisModule` e `CadastrosModule` | wiring |
| `apps/api/src/{usuarios,master,autenticacao}/*.controller.ts` | passam a importar `validar` de `comum/validacao.ts` | fecha o **D38** e remove o marcador |
| `packages/db/test/catalogo.spec.ts` | `tabelasExaminadas` passa de 2 para 9 | a guarda examina as novas |
| `packages/db/test/isolamento.spec.ts` | bateria alcança as seis entidades novas | CT-302 a CT-304 |
| `packages/db/test/unidade-de-trabalho.spec.ts` | `SIMBOLOS_ESPERADOS` cresce | igualdade exata |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` | conjuntos e `ROTAS_PUBLICADAS_EM_PRODUCAO` | 33 rotas novas |
| `apps/api/test/campos-fechados.e2e.spec.ts` | alcança as rotas novas | CT-323 |
| `packages/shared/test/superficie-publica.spec.ts` | acrescenta a asserção da conferência de documento | **presença (superconjunto)** — não reprova |

> **Toda modificação de suíte acima é reprovação esperada, não conserto** — com **uma exceção
> verificada na T3**: `superficie-publica.spec.ts` afirma por **presença**, e não por igualdade de
> conjunto, decisão registrada no próprio arquivo desde a F0 (*"acrescentar export é
> retrocompatível"*). Publicar símbolo novo em `@sysloc/shared` **não o faz reprovar**, a
> atualização é acréscimo, e `SUT_IS_CORRECT_BECAUSE:` **não se aplica** ali. **Não converta aquele
> arquivo para igualdade de conjunto**: seria desfazer uma decisão documentada sem que nada o
> exigisse — exatamente a regressão de decisão (R3) que o Protocolo Antirregressão descreve.
>
> Nas demais linhas da tabela, que de fato usam igualdade exata, a regra segue inteira: o Protocolo
> (§4.2) trata afrouxamento de asserção como regressão de prova, e cada entrada nova em conjunto de
> igualdade exata exige a linha `SUT_IS_CORRECT_BECAUSE:` no comentário, como as da T7 e da T8 já têm.

### 3.7 Arquivos de Referência (somente leitura)

| Arquivo | Motivo da Consulta |
|---|---|
| `packages/db/src/unidade-de-trabalho.ts` | contrato da unidade; marcadores `DECISÃO FECHADA` |
| `packages/db/src/catalogo.ts` | o que a guarda de cobertura exige de tabela nova |
| `packages/db/migracoes/0001_seguranca.sql` | forma canônica de `FORCE` e política |
| `apps/api/src/usuarios/usuario.controller.ts` | padrão de controlador: corpo fechado, sub-recurso, canonização do `:id` |
| `apps/api/src/comum/esquema-de-erro.ts` | envelope de erro — importar, nunca copiar |
| `packages/auth/src/catalogo-de-permissoes.ts` | chaves que as rotas declaram |
| `docs/specs/.../golden/metragem.json` | oráculo da equivalência de metragem |

---

## 4. Contratos de API

### 4.1 Endpoints Expostos

Prefixo `/v1`. Autenticação por sessão em todas (guarda da F1). `Auth` abaixo lista a exigência
declarada além da sessão.

| Ação | Método | Rota | Payload | Resposta | Status | Auth |
|---|---|---|---|---|---|---|
| Criar conjunto | POST | `/conjuntos` | `{ nome }` | conjunto | 201, 422 | `TELA:imoveis` |
| Listar conjuntos | GET | `/conjuntos` | `?limite&deslocamento&incluirRetirados&expandir=imoveis` | `{ itens, total, limite, deslocamento }` | 200, 422 | `TELA:imoveis` |
| Ler conjunto | GET | `/conjuntos/:id` | — | conjunto | 200, 404, 422 | `TELA:imoveis` |
| Alterar conjunto | PUT | `/conjuntos/:id` | `{ nome }` | conjunto | 200, 404, 422 | `TELA:imoveis` |
| Retirar conjunto | POST | `/conjuntos/:id/retirada` | `{}` | conjunto | 200, 404, 422 | + `ACAO:excluir_cadastro` |
| Recircular conjunto | POST | `/conjuntos/:id/recirculacao` | `{}` | conjunto | 200, 404, 422 | + `ACAO:excluir_cadastro` |
| Criar imóvel | POST | `/imoveis` | corpo do imóvel | imóvel | 201, 404, 422 | `TELA:imoveis` |
| Listar imóveis | GET | `/imoveis` | `?limite&deslocamento&incluirRetirados` | envelope de lista | 200, 422 | `TELA:imoveis` |
| Ler imóvel | GET | `/imoveis/:id` | — | imóvel com cômodos e `metragemTotal` | 200, 404, 422 | `TELA:imoveis` |
| Alterar imóvel | PUT | `/imoveis/:id` | corpo do imóvel | imóvel | 200, 404, 422 | `TELA:imoveis` |
| Retirar imóvel | POST | `/imoveis/:id/retirada` | `{}` | imóvel | 200, 404, 422 | + `ACAO:excluir_cadastro` |
| Recircular imóvel | POST | `/imoveis/:id/recirculacao` | `{}` | imóvel | 200, 404, 422 | + `ACAO:excluir_cadastro` |
| Acrescentar cômodo | POST | `/imoveis/:id/comodos` | `{ nomeComodo, metragem?, observacoes? }` | imóvel | 201, 404, 422 | `TELA:imoveis` |
| Alterar cômodo | PUT | `/imoveis/:id/comodos/:comodoId` | idem | imóvel | 200, 404, 422 | `TELA:imoveis` |
| Remover cômodo | DELETE | `/imoveis/:id/comodos/:comodoId` | — | imóvel | 200, 404, 422 | `TELA:imoveis` |
| **Pessoas** — as mesmas 6 formas, ×3 | | `/locadores`, `/locatarios`, `/fiadores` | corpo de pessoa | pessoa | idem | `TELA:cadastros` (+ `ACAO:excluir_cadastro` nas duas de circulação) |

**Total: 33 rotas.** Cômodo não tem rota de leitura própria — ele chega e volta dentro do imóvel, que é
seu agregado; toda escrita de cômodo responde com o imóvel inteiro já recalculado, o que dispensa uma
segunda ida.

### 4.1.1 Exemplo de Payload por Endpoint

**Não há endpoint de atualização parcial nesta fatia.** Todo `PUT` carrega o corpo completo e fechado,
padrão herdado da F1 (`usuario.controller.ts`: *"nenhuma rota desta superfície aceita atualização
parcial"*). Campo ausente num `PUT` é recusa por campo obrigatório, nunca "preservar o valor atual".

```
POST /v1/imoveis
{
  "conjuntoId": "9f1c…", "nomeImovel": "Ap 101",
  "identificadorMunicipal": "12345.678.9012-3", "tipoImovel": "RESIDENCIAL",
  "logradouro": "Rua X", "numero": "100", "complemento": null,
  "bairro": "Centro", "cidade": "São Paulo", "estado": "SP", "cep": "01000000",
  "statusLocacao": "DISPONIVEL", "observacoes": null
}

PUT /v1/imoveis/:id   → o MESMO corpo, completo. Sem campos opcionais implícitos.

POST /v1/imoveis/:id/comodos
{ "nomeComodo": "Sala", "metragem": 25.5, "observacoes": null }
  → `metragem` ausente vale 0 (RN-02); `null` explícito é recusado.

POST /v1/conjuntos/:id/retirada
{}   → corpo vazio e fechado. Nenhum campo é aceito.
```

`empresaId` **não aparece em nenhum corpo**: sai da sessão. Enviá-lo recusa a requisição — é fuga de
tenant, não campo ignorável.

### 4.2 Schemas / DTOs

| Schema | Origem | Campos principais | Versão |
|---|---|---|---|
| `esquemaDoConjunto` | `@sysloc/contracts` (Zod) | `id`, `nome`, `retiradoEm` | v1 |
| `esquemaDoImovel` | idem | `id`, `conjuntoId`, `nomeImovel`, `identificadorMunicipal`, `tipoImovel`, endereço (7), `statusLocacao`, `observacoes`, `comodos[]`, `metragemTotal`, `retiradoEm` | v1 |
| `esquemaDoComodo` | idem | `id`, `nomeComodo`, `metragem`, `posicao`, `observacoes` | v1 |
| `esquemaDaPessoa` | idem (base parametrizada) | `id`, `nome`, `tipoPessoa`, `documentoPrincipal`, `rg`, `email`, `telefone`, endereço (7), `retiradoEm` | v1 |
| `esquemaDaJanela` / `envelopeDeLista` | idem | `limite`, `deslocamento` / `{ itens, total, limite, deslocamento }` | v1 |

O documento publicado é **derivado** desses esquemas (ADR-0016) — nenhuma descrição de saída é escrita
à mão, ao contrário do que a F1 faz hoje.

### 4.3 Eventos Publicados / Consumidos

N/A — a fatia é síncrona. Nenhuma tarefa é enfileirada, e por isso o débito **D32** (primeira fatia a
enfileirar tarefa de negócio) **não dispara** aqui.

---

## 5. Fluxos de Negócio

### 5.1 Fluxo Principal

**Criar imóvel com cômodos** — o fluxo que justifica a D1:

1. Guarda admite a sessão e publica o contexto de tenant a partir dela.
2. Guarda de exigência confere `TELA:imoveis` contra o efetivo da sessão; sem a chave, `403` nomeando
   o exigido.
3. Controlador valida o corpo com o esquema de `@sysloc/contracts`; recusa vira `422` com o campo.
4. Controlador **abre a unidade de trabalho** e passa o executor.
5. `ImovelService` confere que o conjunto informado é alcançável — se não for, `404` indistinguível de
   inexistente — e grava o imóvel.
6. `ComodoService`, **no mesmo executor**, grava os cômodos com posição atribuída.
7. Commit. A resposta é montada pela porta de leitura, com `metragemTotal` derivada.

**Retirar cadastro de circulação:**

1. Guarda confere `TELA:*` **e** `ACAO:excluir_cadastro` — a ação sem a área não existe (RN-02 do catálogo).
2. Controlador canoniza o `:id` (UUID em minúsculas) antes de qualquer consulta.
3. Serviço marca a retirada; nada é apagado.
4. O registro some das listagens padrão e dos seletores; segue alcançável por `GET /:id` e sob
   `incluirRetirados=true`.

### 5.2 Fluxos Alternativos

- **Identificador municipal ou documento repetido** → o banco recusa pela restrição única; o serviço
  traduz em `422 CAMPO_INVALIDO` nomeando o campo e discriminando em `detalhes.conflito` se o registro
  em conflito está `EM_CIRCULACAO` ou `RETIRADO_DE_CIRCULACAO`. A leitura prévia **não** é o mecanismo
  de unicidade — é o banco; a leitura só enriquece a mensagem depois da recusa.
- **Cômodo sem metragem** → normalizado para zero **na escrita**; a coluna é `NOT NULL DEFAULT 0`.
- **Pai de outra empresa** (imóvel apontando conjunto alheio) → `404`, corpo idêntico ao de pai
  inexistente. A existência do registro alheio não é revelada.
- **Mudança de conjunto** → `conjuntoId` é campo do imóvel como qualquer outro, e o `PUT` completo pode
  alterá-lo; corrigir o agrupamento é operação legítima de cadastro. O conjunto de destino passa pela
  **mesma** conferência de alcance da criação — conjunto de outra empresa responde `404`. Não há
  sub-recurso próprio para mover: a operação não tem efeito colateral que justifique nomeá-la.
- **Remoção de cômodo** → linha removida de fato; as posições remanescentes **não** são reatribuídas.
- **Registro retirado em `GET /:id`** → `200` com a marca de retirada. Sem isso a recirculação ficaria
  inalcançável pela interface.

### 5.3 Mapeamento de User Stories → Fluxos

| User Story | Fluxo / Endpoint | Componentes Envolvidos |
|---|---|---|
| US-01 | `POST /v1/conjuntos` | `ConjuntoController` → `ConjuntoService` → `db/conjunto.ts` |
| US-02 | `POST /v1/imoveis` | `ImovelController` → `ImovelService` → `db/imovel.ts` |
| US-03 | `POST /v1/imoveis/:id/comodos` · `GET /v1/imoveis/:id` | `ComodoController`, `ComodoService`, soma única em `db/imovel.ts` |
| US-04 | `PUT /v1/imoveis/:id/comodos/:comodoId` | `ComodoController` → `ComodoService` |
| US-05 | `POST /v1/{locadores,locatarios,fiadores}` | três controladores → `CadastroDePessoaService` → `db/cadastro-de-pessoa.ts` |
| US-06 | mesmas rotas, caminho de recusa | `@sysloc/shared/documento`, restrição única do banco |
| US-07 | `POST /v1/<entidade>/:id/retirada` | controlador da entidade → serviço → porta de escrita |
| US-08 | `GET /v1/<entidade>?incluirRetirados=true` · `POST /:id/recirculacao` | porta única de leitura |
| US-09 | `GET /v1/conjuntos?expandir=imoveis` | `ConjuntoService` → leitura composta em `db/conjunto.ts` |
| US-10 | todas — decorador de exigência | `ExigeChave`, guarda da F1, `cobertura-de-autorizacao.ts` |
| US-11 | todas — política do banco | RLS forçada, FK composta, `unidade-de-trabalho.ts` |

---

## 6. Regras de Processamento

### 6.1 Validações de Input

| Regra | Onde Aplica | Comportamento em Falha |
|---|---|---|
| Corpo fechado (`strictObject`) | todo `POST`/`PUT` | `422 CAMPO_INVALIDO` nomeando o campo |
| `empresaId` no corpo | todo `POST`/`PUT` | `422` — chave desconhecida; nunca ignorado |
| `:id` é UUID, canonizado em minúsculas | toda rota de `:id` | `422` com `campo: 'id'`, sem tocar o banco |
| Documento com dígito verificador válido | criação e alteração de pessoa | `422` com `campo: 'documentoPrincipal'` |
| Enum dentro da lista fechada | `tipoImovel`, `tipoPessoa` | `422` nomeando o campo |
| `statusLocacao` **restrito a `DISPONIVEL` e `INDISPONIVEL`** na entrada | criação e alteração de imóvel | `422` com `campo: 'statusLocacao'` — `LOCADO` existe no enum do banco, mas **só a ativação de contrato o produz** (fatia seguinte) |
| `metragem >= 0` | cômodo | `422` com `campo: 'metragem'` |
| Janela: `limite` entre 1 e o teto, `deslocamento >= 0` | listagens | `422` — pedido acima do teto **recusa**, não trunca |
| Pai alcançável | imóvel→conjunto, cômodo→imóvel | `404 RECURSO_NAO_ENCONTRADO` |

### 6.2 Transformações de Dados

- Documento é **normalizado para dígitos** antes de conferir e de gravar; a máscara não é persistida.
- E-mail é normalizado para minúsculas na borda, num ponto único — mesmo desenho de
  `ESQUEMA_DA_PESSOA_NOVA` da F1, e pela mesma razão escrita lá.
- `metragem` ausente vira `0` **na escrita**; `numeric` volta do driver como texto e é convertida para
  número **na porta de leitura**, num ponto único, para que o consumidor nunca receba texto (CA-16).
- Posição do cômodo é atribuída pelo servidor como **`max(posicao) + 1` dentro da transação**, e as
  posições remanescentes **não são reatribuídas** na remoção. Duas consequências declaradas: duas
  inserções concorrentes no mesmo imóvel colidem no `unique(imovel_id, posicao)` e a transação perdedora
  desfaz — sem perda de dado, num cenário raro (dois usuários editando a planta do mesmo imóvel); e
  remover o **último** cômodo libera aquela posição para o próximo, o que é reuso de posição, não de
  identificador, e nada aponta para posição de cômodo.

### 6.3 Regras de Domínio

| Regra | RN do PRD | Descrição | Erro de Domínio Associado |
|---|---|---|---|
| RN-01 | RN-01 | todo cadastro pertence a uma empresa e só é alcançável nela | `RECURSO_NAO_ENCONTRADO` |
| RN-02 | RN-02 | metragem total é a soma dos cômodos; sem metragem conta zero | — |
| RN-03 | RN-03 | identificador municipal único por empresa, alcançando retirados | `CAMPO_INVALIDO` + `detalhes.conflito` |
| RN-04 | RN-04 | documento válido e único por empresa, por papel | `CAMPO_INVALIDO` + `detalhes.conflito` |
| RN-05 | RN-05 | nada é apagado — exceto cômodo, que é detalhe de composição | — |
| RN-06 | RN-06 | retirado some dos seletores; volta sob parâmetro explícito | — |
| RN-07 | RN-07 | cômodo é detalhe do imóvel, alterável individualmente | — |
| RN-08 | RN-08 | área exigida em toda rota; ação sensível nas de circulação | `ACESSO_NEGADO` |
| RN-09 | RN-09 | locatário nasce com contato simples | — |
| RN-10 | RN-10 | situação de locação é informada, não transita sozinha nesta fatia — e a **entrada aceita apenas `DISPONIVEL` e `INDISPONIVEL`**, para que a fatia de contratos receba o invariante *"`LOCADO` implica contrato ativo"* já válido, em vez de ter de reconciliá-lo | `CAMPO_INVALIDO` |
| RN-11 | RN-11 | tipo de imóvel e de pessoa são listas fechadas | `CAMPO_INVALIDO` |
| RN-12 | RN-12 | estas entidades expõem identificador opaco (ADR-0017) | — |

---

## 7. Persistência de Dados

### 7.1 Banco de Dados Principal

PostgreSQL 18, schema `negocio`. Acesso pelo papel `sysloc_app`; migração pelo `sysloc_migracao`.

### 7.2 Tabelas / Coleções

Todas com `id uuid PK default gen_random_uuid()`, `empresa_id uuid NOT NULL`, `unique(id, empresa_id)`,
RLS habilitada e forçada, e FK composta para o pai.

| Nome | Colunas próprias | Tipos | Constraints | Índices |
|---|---|---|---|---|
| `conjunto` | `nome`, `retirado_em` | text, timestamptz null | — | `(empresa_id, retirado_em)` |
| `imovel` | `conjunto_id`, `nome_imovel`, `identificador_municipal`, `tipo_imovel`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep`, `status_locacao`, `observacoes`, `retirado_em` | uuid, text, enum, timestamptz | `unique(empresa_id, identificador_municipal)`; FK composta `(conjunto_id, empresa_id)` | `(empresa_id, conjunto_id)`, `(empresa_id, retirado_em)` |
| `comodo` | `imovel_id`, `nome_comodo`, `metragem`, `posicao`, `observacoes` | uuid, text, `numeric(10,2) NOT NULL DEFAULT 0`, int | FK composta `(imovel_id, empresa_id)`; `unique(imovel_id, posicao)`; `check(metragem >= 0)` | `(empresa_id, imovel_id, posicao)` |
| `locador` · `locatario` · `fiador` | `nome`, `tipo_pessoa`, `documento_principal`, `rg`, `email`, `telefone`, endereço (7), `retirado_em` | text, enum, timestamptz | `unique(empresa_id, documento_principal)` | `(empresa_id, retirado_em)` |

Enums novos: `tipo_imovel` (`RESIDENCIAL`, `COMERCIAL`, `MISTO`), `status_locacao` (`DISPONIVEL`,
`LOCADO`, `INDISPONIVEL`), `tipo_pessoa` (`PESSOA_FISICA`, `PESSOA_JURIDICA`).

**`comodo` não tem `retirado_em`, de propósito** — é detalhe de composição, e a ADR-0014 o exclui
explicitamente do alcance da exclusão lógica. A ausência da coluna é o que torna a decisão verificável
(CT-317).

**A unicidade não filtra por circulação**: a restrição é total, alcançando os retirados (D4). Uma
restrição parcial faria a reativação colidir.

### 7.3 Migrações

| Versão | Arquivo | Operação |
|---|---|---|
| 0005 | `0005_dominio_locacao.sql` | up — gerada por `drizzle-kit`: enums, seis tabelas, restrições, índices, `ENABLE ROW LEVEL SECURITY` |
| 0006 | `0006_seguranca_dominio.sql` | up — **manual**: `FORCE ROW LEVEL SECURITY` e as políticas `USING`/`WITH CHECK` por tabela |

A separação repete a da F1 e tem razão registrada em `negocio.ts`: o gerador declara RLS mas **não
emite `FORCE`**, e sem `FORCE` o dono ignora a política — a suíte de isolamento ficaria verde sem
provar nada. A expressão da política é a mesma do `0001_seguranca.sql`:
`empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid`, idêntica em `USING` e em
`WITH CHECK`.

### 7.4 Estratégia de Transação e Consistência

Unidade de trabalho aberta **na borda** (D1): `BEGIN` → `SET LOCAL app.empresa_id` → operações →
`COMMIT`. Isolamento `READ COMMITTED` (padrão). Sem bloqueio otimista nem pessimista — nenhuma operação
desta fatia depende de leitura-e-escrita condicional.

Aninhamento continua **recusado** por `ErroDeUnidadeAninhada`; o marcador `DECISÃO FECHADA` que o
instala **não é tocado**. A D1 é a saída que o próprio marcador nomeia como preferível, e por isso não
o contraria.

> **A atomicidade da rota composta não é diretamente falsificável, e a prova é dividida de propósito.**
> Com a validação completa na borda, nenhuma entrada de cliente faz o enésimo cômodo falhar no banco:
> a FK composta aponta para o imóvel criado na mesma transação, a posição é atribuída pelo servidor, e
> os `NOT NULL` e o `check(metragem >= 0)` são barrados pelo esquema antes de a unidade abrir. Um caso
> que tentasse provar o desfazimento pela rota passaria **sem nunca exercitá-lo**. A prova é, portanto,
> a soma de duas: o **CT-325** aborta a unidade a partir do próprio trabalho, na camada de dados, e
> observa que nada sobrou; o **CT-326** enumera os chamadores de `emUnidadeDeTrabalho` e prova que a
> rota usa **uma** unidade só. Nenhuma das duas sozinha cobre o invariante.

Idempotência: as rotas de retirada e recirculação são idempotentes por natureza — repetir a retirada
mantém a marca e responde `200`.

### 7.5 Política de Retenção / Archival

Exclusão lógica por marca de retirada (ADR-0014); nada é removido, exceto cômodo. **Não há política de
retenção ou anonimização de dado pessoal** — documento, endereço e contato são retidos
indefinidamente. É dívida declarada na ADR-0014 e no PRD §9, e o TECH_SPEC **não a inventa**.

---

## 8. Integração com APIs Externas

N/A — a fatia não integra com serviço externo algum. O ViaCEP que o frontend consulta hoje continua
sendo chamada do cliente, fora do alcance do backend.

---

## 9. Sincronização de Dados

### 9.1 Eventos / Filas
N/A — fatia síncrona.

### 9.2 Idempotência
Retirada e recirculação são idempotentes. Criação **não** é: repetir a criação com o mesmo documento ou
identificador municipal é recusa por unicidade, que é o comportamento desejado.

### 9.3 Outbox / Saga
N/A — uma única fonte transacional.

---

## 10. Gerenciamento de Erros

### 10.1 Mapeamento Erro de Negócio → HTTP Status

| Erro | Código | Mensagem | Camada de Origem |
|---|---|---|---|
| Corpo ou parâmetro inválido | `CAMPO_INVALIDO` (422) | requisição inválida | borda |
| Documento inválido | `CAMPO_INVALIDO` (422), `campo: documentoPrincipal` | idem | borda |
| Unicidade violada | `CAMPO_INVALIDO` (422) + `detalhes.conflito` | idem | dados → serviço |
| Cadastro inexistente ou de outra empresa | `RECURSO_NAO_ENCONTRADO` (404) | recurso não encontrado | serviço |
| Sem a área ou a ação exigida | `ACESSO_NEGADO` (403) + `detalhes.exigido` | acesso negado para esta sessão | guarda |
| Sem sessão | `NAO_AUTENTICADO` (401) | — | guarda |

> **O vocabulário de erro é fechado em sete códigos e não tem código de conflito.** `STATUS_POR_CODIGO`
> é `Record<CodigoErro, number>`, então acrescentar valor sem mapear status não compila — e acrescentar
> código é decisão de contrato com efeito no handoff, não escolha de implementação. Por isso a recusa
> por unicidade é `CAMPO_INVALIDO` com o discriminador **`detalhes.conflito`** ∈
> `{ EM_CIRCULACAO, RETIRADO_DE_CIRCULACAO }`. O nome é fixado **aqui**, antes da implementação, porque
> o CT-312 depende dele.

### 10.2 Resiliência

Sem dependência externa, não há retry, circuit breaker nem timeout de terceiro. A resiliência relevante
é transacional: falha em qualquer ponto da composição desfaz a unidade inteira.

### 10.3 Estratégia de Logging de Erros

`@sysloc/shared/log` (Pino) com a redação já instalada. **Nenhum valor de entrada recusado entra na
mensagem de erro** — o padrão vem da F1 (`SENTINELA_REDIGIDO`) e vale aqui com força: documento, e-mail
e endereço são dado pessoal.

---

## 11. Segurança

### 11.1 Autenticação
Sessão por cookie, `better-auth`, com a barreira única de admissão que a F1 instalou. Nenhuma rota nova
é pública.

### 11.2 Autorização
Declarada por rota com `@ExigeChave` (ADR-0011), na dimensão de **chave**, nunca de perfil — é o que
permite ao Admin conceder e retirar por ajuste individual. As 33 rotas declaram; a verificação sobre a
superfície publicada reprova rota governada sem declaração. O contexto de tenant vem da sessão e nunca
do request (ADR-0008); o isolamento é decidido pela política do banco.

As **10 rotas de circulação** declaram a conjunção com `@ExigeChaves(<área>, 'ACAO:excluir_cadastro')`,
**nesta ordem** — `@ExigeChave` no método **SUBSTITUI** a declaração da classe, e declarar ali apenas a
ação faria a área desaparecer daquelas rotas (ADR-0018). A ordem é conteúdo: a recusa nomeia a
**primeira** chave ausente, de modo que quem tem a área e não tem a ação recebe
`detalhes.exigido: 'ACAO:excluir_cadastro'`, como a RN-14 exige. A verificação de cobertura confere
também o **conteúdo** da declaração: nenhum manipulador exige menos do que a classe dele.

### 11.3 Criptografia
N/A nesta fatia — nenhum segredo novo, nenhum dado cifrado em repouso. TLS é da borda, na F7.

### 11.4 Sanitização e Validação
Consulta parametrizada em tudo. A **única** composição de SQL do projeto continua sendo o `SET LOCAL`
da unidade de trabalho, com validação de UUID prévia — e esta fatia não acrescenta nenhuma.

### 11.5 Rate Limiting / Anti-abuse
N/A — o limitador existente é da autenticação. Estas rotas exigem sessão admitida.

### 11.6 Secrets Management
Sem segredo novo. `EnvironmentFile` 0600, como a F0 estabeleceu.

---

## 12. Performance

### 12.1 Metas
- Latência p95: **< 150 ms** por rota simples · p99: **< 400 ms**
- Carteira expandida: **< 500 ms** p95 no volume real
- Throughput: dezenas de requisições por minuto — a operação é de escritório

### 12.2 Estratégias
Índices por `(empresa_id, …)` acompanhando o predicado que a política já aplica. Janela obrigatória nas
listagens, com teto explícito. **A carteira expandida deve ser montada com um número de consultas
independente do número de conjuntos** — uma consulta por nível, não uma por item.

### 12.3 Limites Conhecidos
O volume real é pequeno (3 conjuntos, 22 imóveis, 24 locatários). A metragem derivada agrega a cada
leitura — decisão consciente (D2), cujo custo é desprezível neste volume e que se reavalia se a carteira
crescer uma ordem de grandeza.

---

## 13. Logs e Observabilidade

### 13.1 Logs Estruturados

| Evento | Nível | Campos Chave | Sensibilidade |
|---|---|---|---|
| Cadastro criado | info | `requestId`, `empresaId`, `entidade`, `id` | sem documento, sem contato |
| Retirada / recirculação | info | `requestId`, `empresaId`, `entidade`, `id`, `acao` | — |
| Recusa por unicidade | warn | `requestId`, `empresaId`, `entidade`, `campo`, `conflito` | **nunca o valor do documento** |
| Recusa de autorização | warn | `requestId`, `exigido` | — |

### 13.2 Métricas
N/A nesta fatia — não há coletor instalado. A instrumentação OpenTelemetry declarada na stack chega
quando houver destino para ela.

### 13.3 Tracing
N/A pelo mesmo motivo. O `requestId` já correlaciona.

### 13.4 Alertas
N/A — sem destino de alerta configurado antes da F7.

---

## 14. Feature Flags

N/A — a fatia não tem flag. A superfície entra inteira ou não entra; não há consumidor em produção
antes da virada.

---

## 15. Versionamento de API

### 15.1 Estratégia
Prefixo de caminho `/v1`, já em uso pelas 15 rotas publicadas. Sem mudança.

### 15.2 Compatibilidade
A superfície **não está congelada** — o congelamento acontece no marco de entrega, depois da F5, e
acrescentar rota até lá é legítimo. Nenhuma rota existente é alterada ou removida por esta fatia.

### 15.3 Schemas / Contratos
`@sysloc/contracts` nasce **interno** ao monorepo, versionado pelo workspace; a publicação acontece no
marco. O documento publicado é derivado dos esquemas (ADR-0016) — não há registry externo nem validação
de contrato em CI além da suíte.

---

## 16. Deploy e Infraestrutura

### 16.1 Pipeline
`pnpm build` · `pnpm lint` · `pnpm test` (Turborepo). Sem CI remoto — a verificação é local, como a F0
estabeleceu.

### 16.2 Empacotamento
Nativo, sem contêiner. `tsup` por pacote; o pacote novo segue o mesmo molde dos três existentes.

### 16.3 Infraestrutura como Código
Unidades systemd versionadas em `deploy/` (ADR-0005). Esta fatia **não acrescenta unidade nem timer**.

### 16.4 Estratégia de Rollout
Migração aplicada por `deploy/scripts/instalacao/migrar-banco.sh`, seguida de reinício do serviço da
API. Sem tráfego de produção antes da virada, o rollout é direto.

### 16.5 Escalabilidade
Vertical, instância única. O volume não justifica outra coisa.

### 16.6 Rollback
As migrações `0005` e `0006` são aditivas — nenhuma coluna ou tabela existente é alterada. Rollback é
reverter o binário; o schema novo fica ocioso e inofensivo.

---

## 17. Mapeamento de User Stories para Definições Técnicas

| User Story | Definição Técnica | Componentes Envolvidos |
|---|---|---|
| US-01 | tabela `conjunto` (§7.2); esquema e rotas de conjunto (§4.1) | `db/conjunto.ts`, `ConjuntoService`, `@sysloc/contracts` |
| US-02 | tabela `imovel` com FK composta e unicidade por empresa (§7.2, RN-03) | `db/imovel.ts`, `ImovelService` |
| US-03 | metragem derivada com ponto único de soma (§6.2, D2); tabela `comodo` | `db/imovel.ts`, `db/comodo.ts` |
| US-04 | rota de alteração individual de cômodo; recálculo implícito (§5.2) | `ComodoController`, `ComodoService` |
| US-05 | três tabelas de pessoa; serviço parametrizado (§3.2) | `db/cadastro-de-pessoa.ts`, `CadastroDePessoaService` |
| US-06 | conferência de dígito verificador (§6.1); unicidade do banco (RN-04) | `@sysloc/shared/documento`, restrição única |
| US-07 | marca de retirada (§7.2); exigência de ação sensível (§11.2) | portas de escrita, `ExigeChave` |
| US-08 | porta única de leitura com inclusão explícita (D3, §6.1) | `db/*.ts` |
| US-09 | leitura composta da carteira, consultas por nível (§12.2) | `db/conjunto.ts` |
| US-10 | exigência declarada por rota, verificação sobre a superfície (§11.2) | `exigencia.decorator.ts`, `cobertura-de-autorizacao.ts` |
| US-11 | RLS forçada + FK composta (§7.2, §7.3) | `0006_seguranca_dominio.sql`, `unidade-de-trabalho.ts` |

---

## 18. Dependências Externas

| Tipo | Nome | Versão | Motivo |
|---|---|---|---|
| Framework | NestJS + Fastify | 11.1.28 | já em uso |
| ORM | Drizzle ORM | 0.45.2 | já em uso |
| Driver | postgres.js | já em uso | executor da unidade de trabalho |
| Validação | Zod | 4.4.3 | esquemas do pacote de contratos |
| Documento de API | `@nestjs/swagger` | 11.4.6 | já em uso; passa a receber esquema **derivado** |
| Build | tsup · Turborepo | já em uso | empacota o pacote novo |
| Teste | Vitest + `embedded-postgres` | já em uso | ADR-0006 |

**Nenhuma dependência nova.** A conferência de CPF/CNPJ é implementada no pacote compartilhado — são
poucas linhas de aritmética, e trazer biblioteca para isso não se paga.

---

## 19. Estratégia de Testes

> **Resumo**: 34 casos de teste | Unitários: 2 | Integração: 10 | E2E/rota: 22 (16 E2E + 6 segurança)
> **Padrão**: Vitest; `embedded-postgres` (instância efêmera própria, ADR-0006); HTTP real em **porta
> reservada** (`reservarPorta()`), nunca dinâmica — o arcabouço de identidade confere a origem contra o
> endereço base composto da porta configurada. Mock evitado por decisão. Faixa **CT-300+** para não
> colidir com os 239 CTs existentes.

> **A pirâmide é deliberadamente invertida** (2 unitários, 10 integração, 22 rota/E2E), e a razão é
> regra do projeto: `.claude/rules/testing-stack.md` declara que repositório, rota HTTP e verificador de
> infraestrutura **devem** atravessar fronteira real. Um teste unitário de serviço com repositório
> dublado provaria a dublagem, não o isolamento — que é o objeto principal desta fatia.

### Rastreabilidade: Critérios de Aceite → Testes

| CA (PRD) | Descrição Resumida | Testes |
|---|---|---|
| CA-01 | Cadastrar conjunto | CT-331 |
| CA-02 | Cadastrar imóvel vinculado | CT-325, CT-326, CT-331, CT-332 |
| CA-03 | Identificador municipal único por empresa | CT-310, CT-312 |
| CA-04 | Metragem total somada | CT-305, CT-307, CT-309 |
| CA-05 | Cômodo sem metragem conta zero | CT-305, CT-306 |
| CA-06 | Alterar cômodo isoladamente | CT-308, CT-317 |
| CA-07 | Cadastrar as três pessoas | CT-331, CT-332 |
| CA-08 | Documento inválido recusado | CT-313, CT-314 |
| CA-09 | Documento único por empresa | CT-311, CT-312 |
| CA-10 | Retirada some das escolhas | CT-315, CT-316 |
| CA-11 | Filtro de retirados e volta | CT-315, CT-316 |
| CA-12 | Área de tela exigida | CT-318, CT-319, CT-321 |
| CA-13 | Ação sensível exigida | CT-320 |
| CA-14 | Isolamento entre empresas | CT-300, CT-301, CT-302, CT-303, CT-304, CT-321, CT-323, CT-333 |
| CA-15 | Carteira numa consulta só | CT-307, CT-329, CT-330 |
| CA-16 | Tipos sem conversão no consumidor | CT-305, CT-322, CT-324, CT-327, CT-328 |

### 19.1 Testes Unitários

#### Compartilhado: conferência de documento (`packages/shared/test/documento.spec.ts`)

Mock: nenhum.

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup |
|---|---|---|---|---|---|---|---|
| CT-314 | Tabela de dígito verificador de CPF e CNPJ | CA-08 | a conferência devolve verdadeiro exatamente para as cadeias cujo DV confere, e falso para DV errado, dígitos repetidos, comprimento fora do previsto | tabela de pares (entrada, esperado), com e sem máscara | booleano esperado por entrada; contagem de entradas afirmada; **caso do resto < 2 (DV igual a 0) obrigatório** — é o ramo que a implementação ingênua erra | — | — |

#### Dados: quem abre unidade de trabalho (`packages/db/test/unidade-de-trabalho.spec.ts`)

| CT | Teste | CA | Objetivo | Input | Expected | Mock | Setup |
|---|---|---|---|---|---|---|---|
| CT-326 | Só a borda abre unidade — chamadores enumerados | CA-02 | o conjunto de arquivos de produção que chamam `emUnidadeDeTrabalho` é exatamente o declarado das bordas; nenhum serviço novo aparece | fonte de produção + cópia com o defeito reintroduzido | conjunto igual ao declarado; na cópia defeituosa, `excedentes` contém o arquivo; no fonte íntegro, `excedentes: []` | — | asserção estática → **prova de falsificação obrigatória**; mutante rodado pelo script `test` do pacote, nunca `vitest run` avulso |

### 19.2 Testes de Integração

#### Catálogo e isolamento (`packages/db/test/catalogo.spec.ts`, `isolamento.spec.ts`)

Setup: instância efêmera com as migrações `0000`–`0006` aplicadas; contexto por `contextoDeTenant.executarCom`.

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup |
|---|---|---|---|---|---|---|
| CT-300 | Entidades novas nascem cobertas pela guarda | CA-14 | `excecoes: []` e `tabelasExaminadas` exatamente as **8** tabelas de `negocio` (as 2 herdadas + as 6 novas), em ordem alfabética | consulta ao catálogo | igualdade exata dos dois conjuntos — sem a segunda metade, "nada violou" seria indistinguível de "nada foi olhado" | — |
| CT-301 | Falsificação: entidade sem RLS forçada é nomeada | CA-14 | retirado o `FORCE` de `negocio.imovel`, a mesma asserção reprova com `RLS_NAO_FORCADA` e volta a aprovar restaurado | mutante por DDL em instância dedicada | `excecoes` com uma entrada; controle→mutante→controle | imite `catalogo.spec.ts` CT-009: `conexaoDeMigracao()` contra instância dedicada |
| CT-302 | Leitura escopada pelo banco; contexto ausente lê vazio | CA-14 | sob A, cada tabela devolve só os ids de A, com interseção vazia com B; sem contexto, tudo vazio | leituras cruas nas 7 tabelas sob três contextos | interseção `[]`; contexto ausente e Master devolvem `[]` sem erro | imite `isolamento.spec.ts` CT-003/CT-005: só pela API pública do pacote |
| CT-303 | Gravação cruzada recusada pela política | CA-14 | `INSERT` cruzado falha com `42501` citando a política; `UPDATE`/`DELETE` sobre linha alheia devolvem `count 0`; o estado de B não muda | tentativas sob contexto de A | SQLSTATE e mensagem afirmados; estado de B idêntico caractere a caractere | imite CT-004 (`conferirGravacaoCruzadaRecusada`) |
| CT-304 | Referência cruzada impossível pela FK composta | CA-14 | imóvel só aceita conjunto cujo par `(id, empresa_id)` exista; idem cômodo→imóvel | legítima + duas cruzadas, nos dois sentidos | legítima grava; cruzadas falham com `23503` e o nome da restrição composta | id alheio obtido **lendo no contexto do dono**, nunca por consulta privilegiada |

#### Metragem e circulação (`packages/db/test/metragem.spec.ts`, `circulacao.spec.ts`)

| CT | Teste | CA | Objetivo | Fluxo | Validação | Setup |
|---|---|---|---|---|---|---|
| CT-305 | Os quatro cenários do golden | CA-04, CA-05, CA-16 | metragem derivada é 0, 25.5, 67.75 e 58.5, entregue como `number`, com cômodos batendo um a um na ordem de posição | tabela derivada de `metragem.json` | valores exatos; `typeof === 'number'` (nunca `'string'`, que é o que `numeric` devolve sem conversão) | — |
| CT-306 | Normalização acontece na escrita | CA-05 | cômodo sem metragem persiste `0.00` na coluna, lida crua — e não nulo | cômodo `Deposito` do golden + tentativa direta de gravar nulo | coluna vale `'0.00'`; `INSERT` com nulo falha com `23502`; total 58.5 | — |
| CT-307 | A soma tem ponto único de avaliação | CA-04, CA-15 | leitura do item, listagem e carteira expandida devolvem a mesma metragem nos quatro cenários | três leituras dos mesmos imóveis | os três mapas são profundamente iguais; divergência nomeia as duas leituras que discordam | — |
| CT-309 | Ordem é da posição, não da inserção | CA-04 | cômodos inseridos embaralhados voltam ordenados por posição | inserção na ordem 3, 1, 2 | vetor `['Sala','Quarto','Cozinha']`, **e** asserção de que difere da ordem de inserção — sem ela, uma consulta sem `ORDER BY` passaria por acaso | — |
| CT-317 | Cômodo é removido de fato | CA-06 | `negocio.comodo` não tem coluna de retirada, e o `DELETE` remove a linha; a metragem cai | remoção do `Quarto` (30.25) | zero colunas de retirada no catálogo; contagem 3→2; total 37.5; posições remanescentes seguem 1 e 3 | — |
| CT-325 | Composição atômica com unidade na borda | CA-02, CA-04 | criar imóvel com N cômodos é atômico; dois serviços na mesma unidade não levantam `ErroDeUnidadeAninhada` | variante íntegra e variante que aborta a unidade no terceiro cômodo | íntegra deixa 1 imóvel e 3 cômodos; com o aborto, ambas as contagens voltam ao inicial | **camada de dados**, não pela rota: o erro é lançado pelo próprio `trabalho` dentro da unidade, imitando `unidade-de-trabalho.spec.ts` CT-210 (`DESFAZIMENTO_PEDIDO`) |
| CT-330 | Janela sem repetir nem omitir | CA-15 | total e página vêm da mesma transação; páginas consecutivas cobrem o conjunto exatamente | 5 registros homônimos, limite 2 | `total === 5`; tamanhos 2,2,1; união = os 5, sem repetição — a ordenação tem desempate estável | — |

### 19.3 Testes End-to-End (E2E)

Todos montam a aplicação com `Test.createTestingModule` + `listen` em **porta reservada**, com
identidade efêmera, e obtêm sessão pela rota real de entrada. As permissões são concedidas por
`escreverAjustes`, respeitando `validarCoerenciaDeAjustes` — nunca por atalho.

#### Fluxo: Caminho feliz completo (CT-331)
- **Framework**: HTTP black-box contra servidor real
- **CA**: CA-01, CA-02, CA-07
- **Objetivo**: conjunto criado passa a existir e é oferecido como destino; imóvel nasce vinculado; as três pessoas nascem com documento válido
- **Pré-condições**: sessão com `TELA:imoveis` e `TELA:cadastros`; efetivo afirmado por `GET /v1/sessao` antes do fluxo
- **Passos**: criar conjunto → criar imóvel nele → criar locador, locatário e fiador → ler a carteira
- **Validações**: seis criações em `201`, com os valores enviados e `id` em minúsculas; imóvel aparece sob o conjunto na carteira

#### Fluxo: Alterar cômodo isoladamente (CT-308)
- **CA**: CA-06 · **Objetivo**: alterar um cômodo muda a metragem sem reenviar o imóvel
- **Passos**: alterar `Quarto` de 30.25 para 40.25 → reler o imóvel
- **Validações**: `200`; `metragemTotal === 77.75`; demais cômodos intactos, na mesma ordem

#### Fluxo: Unicidade por empresa (CT-310, CT-311, CT-312)
- **CA**: CA-03, CA-09 · **Objetivo**: repetir na mesma empresa recusa; repetir em outra empresa é aceito; e a recusa distingue retirado de em circulação
- **Validações**: `422` com corpo inteiro afirmado (ADR-0017) e `campo` nomeado; a criação na outra empresa responde `201`; os dois corpos de recusa **diferem** pelo discriminador `detalhes.conflito`

#### Fluxo: Circulação (CT-315, CT-316)
- **CA**: CA-10, CA-11 · **Objetivo**: retirado some da listagem padrão e aparece sob o parâmetro; a retirada não apaga e a recirculação desfaz
- **Validações**: nas cinco entidades, listagem padrão exclui e `incluirRetirados=true` inclui; contagem crua confirma que a linha existe; recirculação zera a marca

#### Fluxo: Carteira expandida (CT-329)
- **CA**: CA-15 · **Objetivo**: a árvore devolvida é idêntica à composição das leituras individuais, sem trazer retirados em nenhum nível
- **Validações**: igualdade profunda; metragens 0, 25.5, 67.75, 58.5; conjunto e imóvel retirados ausentes

#### Fluxo: Contrato publicado (CT-327, CT-328)
- **CA**: CA-16 · **Objetivo**: o documento é derivado dos esquemas que validam a entrada; nenhum campo exige conversão
- **Validações**: propriedades e `required` do documento iguais aos derivados do esquema; com um campo obrigatório acrescentado ao esquema, o documento muda **sem que nenhuma descrição seja editada**; tipos conferidos em toda leitura

#### Fluxo: Identificador canonizado (CT-324) · Corpo fechado (CT-322)
- **CA**: CA-16 · **Objetivo**: as três grafias do UUID alcançam o mesmo recurso com corpos iguais; chave desconhecida recusa
- **Validações**: `id` volta em minúsculas nas três; inválidos em `422` com `campo: 'id'`; corpo com chave extra em `422`, sem a chave em `201`/`200`

### 19.4 Cenários de Erro

| Cenário | CA | Objetivo | Trigger | Status / Log Esperado |
|---|---|---|---|---|
| Sem a área de tela | CA-12 | recusa nomeia a chave exigida, nunca uma genérica | sessão sem `TELA:*` nas 33 rotas | `403` com `detalhes.exigido` igual à chave da área; quem tem a chave não recebe `403` |
| Sem a ação sensível | CA-13 | retirar exige a ação, e a recusa não muda o estado | sessão com a área, sem `ACAO:excluir_cadastro`, nas 10 rotas de circulação | `403` com `detalhes.exigido: 'ACAO:excluir_cadastro'` — **não** a área, que a sessão possui; cadastro segue em circulação |
| Cadastro de outra empresa | CA-14, CA-12 | alheio é indistinguível de inexistente | `GET`/`PUT`/`retirada`/`recirculacao` sobre id de outra empresa | `404` com corpo profundamente igual ao de id inexistente, nas cinco entidades |
| `empresaId` no corpo | CA-14 | fuga de tenant recusada; a empresa gravada é a da sessão | corpo válido + `empresaId` da outra empresa | `422`; nenhuma linha nova; o controle nasce na empresa da sessão e é invisível para a outra |
| Rota nova sem exigência | CA-12 | nenhuma das 33 escapa para o conjunto público | inspeção da superfície publicada | `semDeclaracao` vazio; `publicas` idêntico ao de hoje; `rotasEnumeradas` 33 → 66 |
| Pai de outra empresa | CA-14 | vincular imóvel a conjunto alheio não revela existência | `POST /v1/imoveis` com `conjuntoId` alheio | `404` idêntico ao de conjunto inexistente; controle próprio em `201` |
| Entrada inválida | CA-02, CA-07, CA-16 | recusa nomeia o campo culpado, e nada é gravado | obrigatório ausente, enum fora da lista, metragem negativa, pai inexistente | `422` com `campo` afirmado por variante; pai inexistente em `404`; contagem inalterada |
| Documento inválido | CA-08 | DV incorreto recusado antes de qualquer escrita | CPF/CNPJ com DV errado, dígitos repetidos, comprimento errado | `422` com `campo: 'documentoPrincipal'`; **controle válido obrigatório** — uma conferência que recusasse tudo passaria sem ele |

### Cenários não cobertos (declarados)

Transição automática da situação do imóvel (fatia seguinte) · verificação de e-mail e WhatsApp (fase
posterior) · comportamento do agregado quando o imóvel com cômodos é retirado (ponto em aberto do
tech-alignment) · retenção e anonimização de dado pessoal (sem política declarada) · carga e desempenho
da carteira (teste de carga fora do escopo por doutrina) · concorrência entre duas criações simultâneas
com o mesmo documento (a unicidade do banco resolve; race em MVP não vira caso automatizado) · rotas do
operador do SaaS sobre estes cadastros (fora do escopo).

---

## 20. Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Tamanho da fatia** — 33 rotas, 6 entidades, pacote novo; maior que qualquer run já executado | Alta | Alto | Implementação parametrizada das três pessoas; o task plan deve ordenar por agregado e considerar partir a execução em fases |
| **Consulta N+1 na carteira expandida** — o CT-329 prova a corretude, não o custo | Média | Médio | §12.2 fixa consultas por nível; medir o número de idas ao banco na revisão |
| **Unicidade implementada por leitura prévia** em vez de restrição do banco | Média | Alto | §5.2 fixa que o mecanismo é a restrição; leitura prévia só enriquece a mensagem depois da recusa. Provado pelo par CT-310/CT-312 |
| **Suítes existentes reprovando e sendo "consertadas"** por afrouxamento | Média | Crítico | §3.6 declara as 6 suítes que vão reprovar e por quê; Protocolo Antirregressão exige `SUT_IS_CORRECT_BECAUSE:` em cada entrada nova de conjunto exato |
| **Metragem chegando como texto** ao consumidor (`numeric` volta string pelo driver) | Média | Médio | Conversão num ponto único na porta de leitura; CT-305 e CT-328 afirmam `typeof === 'number'` |
| **D28** — suítes novas serão consumidoras dos acessórios compartilhados por caminho relativo profundo | Alta | Baixo | Gatilho já disparado; ler o marcador antes de acrescentar consumidor |

---

## 21. Observações Técnicas

### ADRs Aplicáveis nesta Feature

- **ADR-0006** — APLICÁVEL (§19): a suíte usa instância efêmera própria; o helper ignora a variável de
  ambiente de conexão por construção.
- **ADR-0008** — APLICÁVEL (§7.2, §7.4, §11.2): o isolamento é do banco. Conforme a `Decision`, **nenhum
  filtro por empresa** é escrito em consulta, serviço ou repositório — a defesa em profundidade que a
  ADR rejeita não é reintroduzida.
- **ADR-0009** — APLICÁVEL (§7.2, §7.3): as seis tabelas nascem em `negocio` com as quatro propriedades,
  e a cobertura é **consultada no catálogo**, nunca lista à mão (CT-300).
- **ADR-0010** — PARCIAL (§11.2): a fatia **consome** o efetivo de permissão; não o altera.
- **ADR-0011** — APLICÁVEL (§4.1, §11.2): as 33 rotas declaram exigência; o default nega, e a
  verificação sobre a superfície publicada reprova rota sem declaração (CT-318).
- **ADR-0014** — APLICÁVEL (§6.3, §7.2): nada é apagado, **exceto cômodo** — que a `Decision` exclui
  nominalmente como detalhe de composição, pelo discriminador "ser referenciável" (CT-317).
- **ADR-0015** — PARCIAL (§7.2): restrição negativa. Nenhuma destas entidades tem série declarada, logo
  nenhum contador é criado nesta fatia.
- **ADR-0016** — APLICÁVEL (§4.2, §15.3): os esquemas de `@sysloc/contracts` são a fonte única; o
  documento é derivado (CT-327). As 15 rotas da F1 seguem com descrição à mão — débito com gatilho
  registrado pela própria ADR.
- **ADR-0018** — APLICÁVEL (§4.1, §11.2): as rotas de circulação declaram a **conjunção** área ∧ ação;
  a recusa nomeia a primeira ausente; a cobertura confere conteúdo, não só existência. Ela nasceu
  **desta fatia**, do defeito medido na T5.
- **ADR-0017** — APLICÁVEL (§4, §6.3, §10.1): a chave exposta é o UUID, porque nenhuma destas entidades
  tem série declarada — conforme a `Decision` literal. O envelope de lista `{ itens, total, limite,
  deslocamento }` e o de erro `{ codigo, mensagem, campo?, detalhes? }` seguem exatamente o texto.

> **A ADR-0012 foi substituída pela ADR-0017 durante a geração deste tech_spec**, em 2026-08-05. O
> conflito era literal: a 0012 obrigava toda entidade de negócio tenantizada a expor código legível, e
> estas seis não têm código. As citações do PRD e do pré-refinamento foram corrigidas.

N/A: **ADR-0001** (cobrança bancária), **ADR-0005** (rotinas agendadas), **ADR-0013** (operador do SaaS
— nenhuma rota nova para o Master).

### Candidatos a ADR

**Nenhum confirmado.** As três decisões desta fatia com alcance transversal já foram registradas:
ADR-0014, ADR-0015 e ADR-0016 (mais a ADR-0017, nascida do conflito). As demais — unidade na borda,
metragem derivada, porta única de leitura, unicidade alcançando retirados, posição do cômodo — são
**feature-scoped**: valem para esta fatia e a seguinte, e nenhuma se aplica a outra feature sem
decisão nova. Falham em C1.

**Candidato a ADR parcial (4/5)** — *"a entrada aceita apenas o subconjunto do enum que o usuário
controla; valor produzido por regra de domínio não é aceitável pelo corpo"*. Levantado na sessão de
challenge ao restringir `statusLocacao` a `DISPONIVEL` e `INDISPONIVEL`.
**C1 transversal**: ✅ — repete na fatia seguinte com `statusContrato`, e provavelmente na F3 com o
status de cobrança. **C2 tag**: ✅ `validation`. **C4 surpreendente**: ✅ — sem registro, alguém
"conserta" o esquema para aceitar o enum inteiro por achar que faltou um valor. **C5 trade-off**: ✅ —
a alternativa (aceitar tudo e reconciliar depois) foi considerada e rejeitada.
**C3 custo de reversão**: ❌ — reverter é alargar um esquema de entrada, mudança pontual e barata.
Registrado aqui; promover a ADR se a fatia seguinte confirmar o padrão com `statusContrato`.

### Débitos com gatilho

- **D38 — dispara aqui e fecha aqui.** Os controladores novos seriam a quarta cópia de `validar()`. A
  extração para `apps/api/src/comum/validacao.ts` é obrigação herdada, e o marcador sai no mesmo
  commit, junto com a linha do índice do `CLAUDE.md`.
- **D28 — já disparado.** As suítes novas de `apps/api/test/` serão consumidoras dos acessórios
  compartilhados por caminho relativo profundo; ler o marcador antes de acrescentar.
- **D32 — não dispara.** A fatia é síncrona e não enfileira tarefa de negócio.
- **D24, D27, D23, D39, D37 — não disparam** nesta fatia (todos condicionados à publicação atrás do
  servidor de borda, ou ao Master).

### Decisões fixadas aqui que os testes pressupõem

1. **Posição do cômodo é monotônica e não reatribuída** na remoção (CT-317).
2. **`GET /:id` de registro retirado responde `200`** com a marca — sem isso a recirculação fica
   inalcançável (CT-316).
3. **Discriminador de unicidade é `detalhes.conflito`** ∈ `{ EM_CIRCULACAO, RETIRADO_DE_CIRCULACAO }`
   (CT-312).
4. **A unidade de trabalho é aberta no manipulador do controlador**, não por mecanismo transversal — é
   o conjunto que o CT-326 enumera, e evita abrir transação em rota que não toca o banco.

### Terminologia canônica

Nove termos foram canonizados no **glossário global** (`docs/specs/domain-glossary.md`) na sessão de
challenge de 2026-08-05: **Conjunto**, **Imóvel**, **Cômodo**, **Locador**, **Locatário**, **Fiador**,
**Metragem total**, **Identificador municipal** e **Retirada de circulação**.

A ambiguidade que motivava o registro: a chave do catálogo chama-se `ACAO:excluir_cadastro` — nome
histórico, fechado desde a F1 e persistido em `acesso_usuario_permissao`, portanto **não renomeável** —
mas a operação que ela governa **não exclui**. O termo do domínio, das rotas (`/retirada`,
`/recirculacao`) e desta spec é **retirada de circulação**; "excluir", "exclusão", "remoção",
"desativação" e "soft delete" são aliases a evitar.

### Sessão de challenge — 2026-08-05

Cinco achados, todos aplicados inline: (1) o CT-300 afirmava **9** tabelas examinadas e **7** novas —
são **8** e **6**, corrigido aqui e no JSON de casos; (2) o CT-325 era **infalsificável** pela rota, e a
prova de atomicidade passou a ser dividida entre ele e o CT-326 (§7.4); (3) mudar o imóvel de conjunto
pelo `PUT` completo era comportamento não declarado — agora está, com a mesma conferência de alcance da
criação (§5.2); (4) `statusLocacao` aceitava `LOCADO` na entrada, o que deixaria a fatia seguinte
herdando imóveis locados sem contrato — a entrada passou a aceitar só os dois valores que o usuário
controla (§6.1, RN-10); (5) a atribuição da posição do cômodo não estava especificada — agora é
`max(posicao) + 1` na transação, com as duas consequências declaradas (§6.2).

---

## 22. Checklist Final

- [x] Variante registrada (backend) na seção 1
- [x] Stack identificada
- [x] TECH_SPEC cobre todo o PRD (US-01 a US-11 mapeadas em §17)
- [x] Resumo técnico claro e objetivo (§2)
- [x] Arquitetura definida com componentes e camadas (§3)
- [x] Contratos de API com payloads, status codes e schemas (§4)
- [x] Fluxos de negócio descritos (§5)
- [x] Regras de processamento e validações (§6)
- [x] Persistência: tabelas, índices, migrações, transação (§7)
- [x] Integrações externas mapeadas (§8 — N/A justificado)
- [x] Sincronização: eventos, idempotência (§9)
- [x] Gerenciamento de erros e resiliência (§10)
- [x] Segurança: auth, autorização, sanitização (§11)
- [x] Performance: metas, estratégias, limites (§12)
- [x] Logs, métricas, tracing e alertas (§13)
- [x] Feature flags (§14 — N/A justificado)
- [x] Versionamento de API definido (§15)
- [x] Deploy e infraestrutura (§16)
- [x] Dependências externas listadas (§18)
- [x] Estratégia de testes via `agent-spec-qa-test-generator` integrada (§19, com rastreabilidade CA→CT)
- [x] Riscos técnicos identificados (§20)
- [x] Observações técnicas e inventário de ADRs registrados (§21)
- [x] Arquivos envolvidos listados — árvore + criar/modificar/referência (§3.4–3.7)
- [x] Pronto para geração das TASKS
