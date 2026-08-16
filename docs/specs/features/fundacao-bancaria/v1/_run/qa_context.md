# QA Context — `fundacao-bancaria` / v1

> Extrato denso do `tech_spec.md` para consumo do `agent-spec-qa-test-generator`.
> **Fonte canônica**: `docs/specs/features/fundacao-bancaria/v1/tech_spec.md` §19 (Estratégia de
> Testes). Este arquivo condensa; em divergência, o tech spec vence.
>
> ⚠️ **`_run/test-cases.json` está DEFASADO** em relação ao tech spec final: ele registra 37 casos,
> aponta a cifra para `packages/cobranca-bancaria/src/cifra.ts` e supõe duas colunas cifradas — três
> colocações que a §19.0 do tech spec reverteu no challenge de 2026-08-14. A redistribuição para as
> tasks sai da **§19**, nunca do JSON.

---

## 1. A fatia em uma tela

Fatia **(i) de 3** da F4. Instala três coisas que a fase inteira consome e **nenhuma emissão**:

1. **Identidade por empresa** — `negocio.certificado_do_provedor`, dado da empresa com RLS
   **forçada**, guardando material PKCS#12 e senha num **envelope único** cifrado com AES-256-GCM,
   cuja chave vive fora da árvore versionada (ADR-0032).
2. **Fundação numérica** — schema **`plataforma`** (ADR-0031), com a sequência do identificador
   bancário e a função `SECURITY DEFINER` **sem parâmetro** que a consome. A ausência de parâmetro
   **é** a declaração de escopo (ADR-0033).
3. **Pacote `@sysloc/cobranca-bancaria`** (pacotes 6 → 7) — modelo canônico com meio de recebimento
   (`BOLETO` | `PIX`, o pix sem operação) e a porta `PortaDeIdentidadeBancaria` com **uma** operação.

Superfície publicada: **89/74 → 92/77**, em três rotas do Admin da empresa.

**Duas propriedades atravessam tudo**: o segredo **não retorna por superfície nenhuma**, e a
garantia é **medida sobre a saída real** — nunca lida no código. **Não há identidade de reserva**.

---

## 2. Componentes e onde o SUT mora

| Componente | Arquivo | Camada |
|---|---|---|
| Cifra e invólucro opaco do segredo | `packages/shared/src/segredo-operavel.ts` | Transversal |
| Redação do registrador (3 radicais novos) | `packages/shared/src/log.ts` | Transversal |
| Contrato (esquemas, enums, limiares) | `packages/contracts/src/integracao-bancaria.ts` | Contrato |
| Migração estrutural (gerada) | `packages/db/migracoes/0015_dominio_bancario.sql` | Migração |
| Migração de segurança (manual) | `packages/db/migracoes/0016_seguranca_bancaria.sql` | Migração |
| Guarda de admissão de `plataforma` | `packages/db/src/catalogo-de-plataforma.ts` | Dados |
| Contador e composição do identificador | `packages/db/src/identificador-bancario.ts` | Dados |
| Registro/consulta/histórico do certificado | `packages/db/src/certificado-do-provedor.ts` | Dados |
| Modelo canônico e porta | `packages/cobranca-bancaria/src/{modelo-canonico,porta-de-identidade}.ts` | Domínio |
| Leitura do material | `packages/cobranca-bancaria/src/leitura-do-material.ts` | Adaptador |
| Adaptador mTLS | `packages/cobranca-bancaria/src/adaptador-sicoob.ts` | Adaptador |
| Borda (3 rotas) | `apps/api/src/integracoes-bancarias/*` | Borda HTTP |

---

## 3. Stack de teste (`stack_discovery`)

- **Linguagem**: TypeScript 7.0.2 sobre Node 24.18.1 — monorepo pnpm/Turborepo. Bash nos
  verificadores de infraestrutura.
- **Arcabouço**: **Vitest 4.1.10**. Integração e banco com **`embedded-postgres`** (instância
  efêmera **própria** por execução, com os papéis reais `sysloc_app`/`sysloc_migracao` e RLS
  **forçada**); E2E por **HTTP real** em porta dinâmica sobre `apps/api` (NestJS + Fastify).
- **Comando**: `pnpm --filter @sysloc/<pacote> test` — **sempre por pacote**. `turbo run test` aborta
  os pacotes irmãos quando um falha. Rode `rm -rf /tmp/sysloc-banco-*` entre execuções (disco do
  host em ~96%; `No space left on device` **se disfarça de teste vermelho**).
- **Mock**: **nenhum, por decisão do projeto**. Nenhum caso desta fatia usa dublê. Substitui-se o
  **destino** (servidor TLS real em porta dinâmica no lugar do provedor), nunca a lógica sob prova.
- **Convenção**: `CA-xx → CT-8xx (RN-xx)` com seção de INVARIANTES por arquivo, no cabeçalho de cada
  `*.spec.ts`. `describe`/`it`, título do `it` começando por `CT-8xx — `.
- **Faixa desta fatia**: **CT-801 a CT-838**, sem lacuna e sem sufixo. `CT-9xx` é do protocolo
  antirregressão; o maior identificador de fatia hoje é `CT-740`.
- **Prova de falsificação obrigatória** para asserção **estática**: CT-809, CT-829, CT-832, CT-834,
  CT-835, CT-836. Mutante aplicado, suíte rodada **pelo script do pacote** (`pnpm --filter … test`,
  que faz `tsc --build` antes), reprovação demonstrada **nomeando o item ofensor**, mutante
  revertido. ⚠️ `vitest run` avulso é **INVÁLIDO** para trabalho de mutante — os pacotes resolvem
  `"."` para `dist/`, e o mutante ficaria no fonte sem alcançar o que executa.

---

## 4. Critérios de Aceite (PRD) e regras de negócio

| CA | Descrição |
|---|---|
| CA-01 | Registro aceito publica titular, validade e impressão digital |
| CA-02 | Nenhuma resposta devolve o material ou a senha |
| CA-03 | Dias restantes e faixa, contra a data corrente da operação |
| CA-04 | ≤ 30 dias é *vencendo*; validade passada é *vencido* |
| CA-05 | Senha que não abre recusa, e o que valia antes continua valendo, **inalterado** |
| CA-06 | Certificado vencido recusado **na entrada**, com a data em que venceu |
| CA-07 | O teste contra o provedor informa o desfecho e **não altera nada** |
| CA-08 | Teste sem certificado recusa nomeando empresa e ausência, **sem identidade de outra origem** |
| CA-09 | Renovação: o novo vale, o anterior segue consultável, o segredo dele deixa de existir |
| CA-10 | Duas empresas no mesmo mês nunca colidem, e o contador avança para as duas |
| CA-11 | Operação desfeita não devolve o número ao contador |
| CA-12 | Nada de segredo em registro, erro ou diagnóstico |
| CA-13 | Nenhum termo do provedor no vocabulário publicado |
| CA-14 | Boleto e pix previstos; pix **sem operação** |

| RN | Regra |
|---|---|
| RN-01 | Certificado próprio sempre; **não existe identidade de reserva** |
| RN-02 | Material e senha entram e **não saem** |
| RN-03 | Só aceito se a senha abrir, o titular for legível e a validade não tiver passado |
| RN-04 | Estado **derivado** da validade contra a data corrente, nunca marca gravada |
| RN-05 | Registrar substitui; o segredo do anterior é descartado **no mesmo ato** |
| RN-06 | Verificação é ato explícito e **não altera nada** |
| RN-07 | 18 posições: 6 de competência + 12 de contador, único no SaaS, sem reinício |
| RN-08 | Número entregue **nunca** é reaproveitado, mesmo com a operação desfeita |
| RN-09 | O contador **não é dado de empresa nenhuma**: ninguém o **enxerga**, **influencia** ou **alcança** |
| RN-10 | Vocabulário próprio: nenhum nome de campo, código ou termo do provedor |
| RN-11 | Meio de recebimento cobre boleto e pix; pix **declarado sem operação** |
| RN-12 | Unicidade do **vigente por empresa** imposta pelo **banco** (índice único parcial) |
| RN-13 | `segredo_cifrado` presente **se e somente se** `substituido_em` for nulo (`CHECK`) |

---

## 5. Contratos das três rotas

| Ação | Método | Rota | Corpo | Resposta | Status | Auth |
|---|---|---|---|---|---|---|
| Registrar/renovar | `POST` | `/v1/integracoes-bancarias/certificados` | `{ material, senha }` **completo, `strictObject`** | `CertificadoPublicado` | `201`, `401`, `403`, `422` | Sessão + `TELA:integracoes_bancarias` **e** `ACAO:configurar_integracao` |
| Consultar vigente | `GET` | `/v1/integracoes-bancarias/certificado` | — | `CertificadoPublicado` | `200`, `401`, `403`, `404` | Sessão + `TELA:integracoes_bancarias` |
| Verificar identidade | `POST` | `/v1/integracoes-bancarias/certificado/verificacao` | vazio (`ESQUEMA_DO_CORPO_VAZIO`) | `ResultadoDaVerificacao` | `200`, `401`, `403`, `404`, `422` | Sessão + `TELA:integracoes_bancarias` |

Projeção publicada (`strictObject`): `id`, `titular`, `validoDe`, `validoAte`, `impressaoDigital`,
`estado`, `diasParaVencer`, `registradoPor{id,nome}`, `registradoEm`. **Nenhum campo carrega
`material` ou `senha`, e nunca carregará.**

`ResultadoDaVerificacao`: `aceito`, `verificadoEm`, `detalhe` (**anulável, mas preenchido nos DOIS
desfechos** — o positivo carrega o alcance do que foi medido).

Envelope de erro (ADR-0017): `{ codigo, mensagem, campo?, detalhes? }`, `codigo` de enum **fechado**.
`23505` do índice único parcial **sobe intacto** → `500`, nunca traduzido.

---

## 6. Fronteiras de execução real (`real_execution_boundary`)

| Fronteira | Onde | Como |
|---|---|---|
| `database` | `packages/db/test/*` | `embedded-postgres`, papéis reais, migrado até a `0016` |
| `http` | `apps/api/test/*.e2e.spec.ts` | Fastify+NestJS em porta dinâmica, sessão obtida por entrada real |
| `tls` (laço local) | `packages/cobranca-bancaria/test/*` | `tls.createServer` em `listen(0)`, material PKCS#12 **gerado em execução** |
| `filesystem` | material de teste, arquivo de diário do CT-831 | diretório temporário, **nunca versionado** |
| `none` | cifra, composição do identificador, vocabulário | função pura |

⚠️ **Nada toca o provedor real** (ADR-0006). ⚠️ **Nenhum `.pfx` entra no repositório** — o
`.gitignore` já barra `*.pfx`, e o material é gerado em `test/material-de-teste.ts`.

---

## 7. Mapa CA → CT (§19 do tech spec, canônico)

| CA | Testes |
|---|---|
| CA-01 | CT-806, CT-808, CT-819, CT-836 |
| CA-02 | CT-803, CT-823, CT-832, CT-833, CT-836 |
| CA-03 | CT-824, CT-836 |
| CA-04 | CT-824, CT-825 |
| CA-05 | CT-807, CT-820 |
| CA-06 | CT-821 |
| CA-07 | CT-826, CT-827, CT-836 |
| CA-08 | CT-828, CT-836 |
| CA-09 | CT-810, CT-811, CT-818, CT-822, CT-836 |
| CA-10 | CT-804, CT-814, CT-816 |
| CA-11 | CT-814, CT-817 |
| CA-12 | CT-803, CT-829, CT-830, CT-831, CT-832, CT-833 |
| CA-13 | CT-809, CT-834 |
| CA-14 | CT-835 |

**Sete casos não apontam CA** e provam regra de negócio ou propriedade estrutural: CT-802 e CT-805
(companheiros negativos de CT-801 e CT-804), CT-812 e CT-813 (ADR-0031), CT-815 (RN-09), CT-837 e
CT-838 (ADR-0011/0018).

---

## 8. Distribuição CT → arquivo → task

| Arquivo de teste | CTs | Task |
|---|---|---|
| `packages/shared/test/segredo-operavel.spec.ts` `[N]` | CT-801, CT-802, CT-803 | T2 |
| `packages/shared/test/log.spec.ts` `[M]` | CT-829 | T3 |
| `packages/contracts/test/esquemas.spec.ts` `[M]` | — (casos do esquema novo, sem CT numerado) | T1 |
| `packages/db/test/catalogo-de-plataforma.spec.ts` `[N]` | CT-812, CT-813 | T5 |
| `packages/db/test/identificador-bancario.spec.ts` `[N]` | CT-804, CT-805, CT-814, CT-815, CT-816, CT-817 | T6 |
| `packages/db/test/certificado-do-provedor.spec.ts` `[N]` | CT-810, CT-811, CT-818, CT-819, CT-820, CT-821, CT-822 | T7 |
| `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` `[N]` | CT-809, CT-834, CT-835 | T8 |
| `packages/cobranca-bancaria/test/leitura-do-material.spec.ts` `[N]` | CT-806, CT-807, CT-808 | T9 |
| `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` `[N]` | **lacuna — ver §10** | T10 |
| `apps/api/test/ambiente.spec.ts` `[M]` | — (casos das variáveis novas, sem CT numerado) | T11 |
| `apps/api/test/certificado-do-provedor.e2e.spec.ts` `[N]` | CT-824, CT-825 (T11) · CT-826, CT-827, CT-828 (T12) | T11/T12 |
| `apps/api/test/segredo-nao-escapa.e2e.spec.ts` `[N]` | CT-823, CT-830, CT-831, CT-832, CT-833 | T13 |
| `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` `[M]` | CT-836, CT-837, CT-838 | T14 |
| `apps/api/test/contrato-publicado.e2e.spec.ts` `[M]` | — (as três rotas no documento) | T14 |

**Reconciliações de colocação feitas nesta distribuição** (a §19.2 agrupa CT-816 e CT-817 sob o
cabeçalho de `certificado-do-provedor.spec.ts`, e a §19.4(b) agrupa CT-814 e CT-815 sob o mesmo):
os quatro são do **contador**, e a §3.5 declara literalmente que
`packages/db/test/identificador-bancario.spec.ts` cobre *"Não-reuso, avanço fora do desfazimento,
**ausência de escopo por empresa**, forma das 18 posições"*. **A §3.5 é a autoridade sobre em que
arquivo cada invariante mora**; os invariantes dos casos são preservados na íntegra.

---

## 9. Antipadrões que esta fatia tem obrigação de não cometer

- **AP-29 (`tautological_assertion`)** — foi a **única** causa de rejeição repetida da fatia
  `regua-de-cobranca` (T11 e T12). Asserção que não pode falhar pelo defeito que persegue.
- **Aprovação vazia** — consulta que não acha nada passando por "está tudo certo". Por isso a guarda
  de `plataforma` devolve **o conjunto examinado** junto do veredito (CT-812), e a contagem é
  afirmada **antes** da propriedade.
- **Prova por leitura de código** em vez de medição da saída real — a ADR-0032 proíbe expressamente.
  CT-823, CT-829 a CT-833 observam **a saída**, nunca a declaração.
- **Companheiro negativo ausente** — o par CT-818/CT-822 é **indivisível**: sozinho, o CT-822 aprova
  tanto a implementação correta quanto a que *"anula primeiro e insere depois"*, que perde o segredo
  da empresa quando a inserção falha. Quem cortar um dos dois por escopo tem de cortar os dois.
- **Troca de igualdade por presença** — crescimento de lista esperada é o caminho legítimo; trocar
  `toEqual` por `toContain` é regressão de prova (R2).

---

## 10. Lacuna conhecida — `adaptador-sicoob.spec.ts`

A §3.5 declara o arquivo (*"Aperto de mão aceito e recusado contra servidor TLS real em porta
dinâmica"*), e a §19 **não enumera nenhum CT para ele** — a faixa CT-801 a CT-838 está inteira
distribuída nos demais arquivos. Os CT-826/827/828 provam o desfecho **na borda** (`apps/api`), não
no nível do pacote.

**Resolução**: gerar os casos faltantes a partir de **CT-839**, preservando as decisões da spec —
cliente construído **por chamada** e descartado no fim do ato (D6-b), teto de tempo como **constante
nomeada** (10 s), **sem repetição automática**, **sem disjuntor**, endereço vindo de
`ENDERECO_DO_PROVEDOR_BANCARIO`, indisponibilidade degradando para recusa nomeada e **nunca** para
erro genérico, e nenhum termo do provedor cruzando a porta.

---

## 11. ADRs vinculantes (abrir a `Decision`, nunca a linha-resumo)

`0001` (parcial — vocabulário do provedor não cruza a porta; as cinco operações chegam com a fatia
que as exerce), `0006`, `0008`, `0009`, `0011`, `0013`, `0016`, `0017`, `0018`, `0020`, `0021`,
`0023`, `0025`, `0026`, `0029`, `0031`, `0032`, **`0033`**.

⚠️ **A `0015` está `superseded-by:0033` desde 2026-08-14 — não a cite como vigente**, e não
"corrija" o contador para ser por empresa.
