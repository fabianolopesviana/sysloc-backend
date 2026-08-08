# Tech Alignment — Cadastro de imóveis e pessoas do domínio de locação

- **Feature**: `cadastro-de-imoveis-e-pessoas` · **Versão**: v1 · **Framework**: SDD · **Variante**: `backend`
- **Definição**: `docs/prds/features/cadastro-de-imoveis-e-pessoas/v1/prd.md`
- **Discovery lido**: `docs/specs/features/dominio-locacao/v1/pre-refinement.md` (cobre as duas fatias da fase)
- **ADRs consultadas**: 0006, 0008, 0009, 0010, 0011, 0014, 0015, 0016, 0017
- **Data**: 2026-08-05 · **Status**: decidido

---

## Contexto técnico

Esta é a primeira fatia a introduzir **entidade de negócio** no schema tenantizado. A fundação de
isolamento já existe e é obrigatória: contexto por cadeia assíncrona fixado por transação, política
forçada no banco, referência composta, e uma guarda que consulta o catálogo do sistema e reprova
tabela de negócio nascida fora do padrão. Nada disso se decide aqui — herda-se.

O que esta fatia decide são três coisas que a F1 não precisou enfrentar. Primeira, **composição
transacional**: até agora cada serviço abria a própria unidade de trabalho, e a porta de acesso a
dado recusa aninhamento por decisão fechada; a primeira operação desta fatia — um imóvel com seus
cômodos — já é composta. Segunda, **coerência de valor agregado**: a metragem do imóvel é função dos
cômodos, e onde essa função é avaliada determina se ela pode divergir. Terceira, **visibilidade
condicionada**: a exclusão lógica da ADR-0014 introduz um predicado que toda leitura precisa aplicar,
e predicado repetido é predicado esquecido.

O invariante que atravessa as três: **nenhuma garantia desta fatia pode depender de alguém lembrar**.
É a mesma doutrina que produziu a guarda de catálogo e o `SET LOCAL` sempre emitido.

---

## Soluções técnicas decididas

### D1 · A unidade de trabalho é aberta na borda

**Escolhida**: quem atende a requisição abre a unidade e passa o executor adiante; os serviços novos
**recebem** o executor e não abrem unidade própria.

**Avaliadas**: (a) cada serviço abre a sua — é o padrão da F1, e a primeira composição desta fatia o
quebraria com `ErroDeUnidadeAninhada`; (b) `SAVEPOINT` por transação aninhada — é o `REVERTER EXIGE`
do marcador `DECISÃO FECHADA` em `abrirAcessoAoBanco`, exige prova de que o desfazimento do ramo
interno não deixa efeito gravado, e nenhum ramo desta fatia precisa desfazer sozinho.

**Motivo**: é a saída que o próprio código nomeia como preferível, e o cenário que a justifica —
serviço legítimo chamando outro — é o cenário desta fatia, não uma hipótese.

**Trade-off aceito**: o limite transacional passa a ser decidido na borda, não pelo domínio; e a
assinatura dos serviços novos carrega o executor. **Os serviços da F1 não são convertidos** —
convertê-los é refactor fora do escopo, vedado pelo Protocolo Antirregressão.

### D2 · A metragem total é derivada na leitura

**Escolhida**: nenhum valor agregado é guardado. A metragem total do imóvel é calculada na consulta,
a partir dos cômodos.

**Avaliadas**: (a) guardada e recalculada pela aplicação — é o que o legado faz, e exige que os três
caminhos de escrita desta fatia lembrem de recalcular, com divergência silenciosa como modo de falha;
(b) guardada e mantida por gatilho no banco — coerência por qualquer caminho, ao custo de pôr regra
de domínio fora do alcance da suíte de aplicação, e nada no projeto usa gatilho hoje.

**Motivo**: divergência entre o agregado e as partes deixa de ser possível, em vez de ser prevenida.
O volume real da carteira (dezenas de imóveis) não cobra o preço da desnormalização.

**Trade-off aceito**: agregação a cada leitura. A soma deve ter **um ponto único** de avaliação — se
duas consultas somarem por conta própria, a divergência volta pela porta de trás.

**Regra que não muda com esta escolha**: a normalização do cômodo sem metragem informada para zero
acontece **na escrita**, e não na soma — o registro capturado do legado mostra o valor já normalizado
no cômodo persistido, não apenas no agregado.

### D3 · Leitura por porta única, com inclusão de retirados explícita

**Escolhida**: cada entidade tem uma porta única de leitura que aplica o predicado de circulação por
padrão; incluir os retirados é **parâmetro explícito e nomeado**, nunca o default.

**Avaliadas**: (a) predicado escrito em cada consulta — é exatamente o filtro esquecível que o PRD
nomeia como risco, e o esquecimento é invisível (mostra registro retirado como se estivesse ativo);
(b) impor a circulação por política no banco — misturaria isolamento com visibilidade e tornaria o
retirado inalcançável até pela tela que precisa mostrá-lo, exigindo um caminho de contorno.

**Trade-off aceito**: uma indireção a mais entre o serviço e o executor.

### D4 · A unicidade alcança os registros retirados de circulação

**Escolhida**: as restrições de unicidade por empresa — documento da pessoa e identificador municipal
do imóvel — valem sobre **todos** os registros, inclusive os retirados de circulação.

**Avaliada**: unicidade condicionada aos que estão em circulação. Permitiria recadastrar enquanto o
antigo está retirado, mas a colisão reapareceria na **reativação** — que passaria a falhar por um
conflito criado depois, e num momento em que o usuário não tem como entender a causa.

**Trade-off aceito**: o usuário pode ser recusado por um registro que não enxerga na lista. A
consequência é de contrato e é obrigatória: **a recusa distingue "já existe" de "já existe, retirado
de circulação"**, para que o caminho oferecido seja reativar em vez de recadastrar.

### D5 · Esquema único compartilhado, documento derivado dele

**Escolhida**: o pacote de contratos publica os esquemas de entrada e saída; a API valida com esses
esquemas e o documento publicado é **derivado** deles.

**Avaliadas**: (a) adotar agora a biblioteca de contrato declarada em `decisao-e-stack.md` §4 — daria
cliente tipado ao consumidor, mas as rotas já publicadas pela F1 ficariam numa forma e as novas
noutra (convertê-las é refactor fora do escopo), e o ganho só se realiza quando a superfície congelar,
depois da F5; (b) adiar o pacote para depois — contraria a entrega declarada no PRD e no §F2 do plano
de execução.

**Motivo**: elimina a duplicação que a F1 carrega hoje — o esquema de validação e a descrição
publicada são escritos duas vezes, livres para divergir — sem introduzir dependência nova, e sem
deixar a base com duas formas de declarar rota.

**Trade-off aceito**: o consumidor não recebe cliente pronto; monta as chamadas a partir dos tipos
publicados. **Esta escolha não fecha a porta da biblioteca declarada** — ela a prepara: com o esquema
como fonte única, o contrato tipado pode ser derivado no marco, quando a superfície congelar e a
conversão puder ser feita de uma vez.

> ⚠️ **Divergência declarada**: `decisao-e-stack.md` §4 e o §F2 do plano de execução nomeiam a
> biblioteca de contrato como parte desta entrega. A divergência é deliberada, foi apresentada com o
> custo dos dois lados, e é **candidata a ADR** (abaixo). Não é omissão.

### D6 · O cômodo carrega posição explícita

**Escolhida**: a posição do cômodo é dado próprio, e a leitura devolve na ordem informada.

**Avaliadas**: ordenar por nome (a ordem muda quando o nome muda) e por instante de criação (impede
reordenar sem recriar).

**Motivo**: o registro capturado do legado observa as posições, e a equivalência da metragem é
comparada contra ele. Sem ordem própria, a comparação passaria a depender da ordem de retorno do
banco, que não é garantida por nenhuma cláusula.

### Decisões diretas (determinadas pelo projeto, sem leque)

- **Conferência de documento** — o cálculo de dígito verificador de CPF e CNPJ nasce no pacote
  compartilhado, sem dependência nova: é aritmética de poucas linhas, e o projeto não tem biblioteca
  para isso.
- **A tradução de recusa de validação sai da cópia por controlador** — o débito **D38** (`validar()`
  na terceira cópia) tem gatilho *"a quarta cópia, ou a primeira task cujo escopo já inclua os três
  arquivos"*. Esta fatia cria controladores novos e **dispara o gatilho**: a extração para módulo de
  borda é obrigação herdada, não escolha desta discussão. O marcador sai no mesmo commit.
- **O envelope de erro é importado**, nunca redeclarado — o módulo comum criado no fechamento da F1 é
  a definição única.
- **Nenhuma chave nova no catálogo de permissões** — as áreas e a ação sensível desta fatia já
  existem; precisar de chave nova seria sinal de escopo mal delimitado, não de catálogo incompleto.

---

## Candidatas a ADR

**D5 — esquema compartilhado como fonte única do contrato da API.** É transversal (governa toda rota
de F3, F4 e F5 e a forma do handoff), tem custo de reversão alto (converter a superfície inteira), e
**diverge de um documento de decisão existente** — o que exige registro explícito para que a próxima
fatia não a reabra por achar que foi descuido. Não conflita com a **ADR-0017**, que fixa a *forma* do
contrato (envelope, chave por classe) e não o mecanismo que a produz.

> Registrada como **ADR-0016** em 2026-08-05.

```bash
/agent-spec-adr-create "esquema compartilhado como fonte unica do contrato da api"
```

---

## Restrições e invariantes técnicas

### ADRs Aplicáveis nesta Feature

- ADR-0006 — a suíte de verificação nunca executa contra o ambiente que atende a operação
- ADR-0008 — o isolamento entre empresas é propriedade do banco, não da aplicação
- ADR-0009 — fronteira identidade × negócio por schema, com cobertura verificada no catálogo
- ADR-0010 — efetivo de permissão do perfil com ajustes individuais, transportado na sessão
- ADR-0011 — toda rota declara o que exige, com default que nega
- ADR-0014 — entidade de cadastro do domínio nunca é apagada; cômodo fica fora do alcance
- ADR-0015 — contador sequencial por empresa, com furo aceito e número nunca reusado
- ADR-0016 — o esquema é a fonte única do contrato; validação e documento derivam dele
- ADR-0017 — três classes de chave exposta; sem série declarada, a chave é o UUID

> A **ADR-0012** foi substituída pela **ADR-0017** em 2026-08-05, durante a geração do tech_spec
> desta fatia: a decisão anterior obrigava toda entidade de negócio tenantizada a expor código
> legível, o que estas seis entidades não fazem.

Herdadas, não decididas aqui — toda implementação as respeita:

1. **Isolamento é do banco** (ADR-0008/0009): toda entidade nova nasce com o discriminador de empresa,
   política forçada e referência composta. A guarda de catálogo reprova quem nascer fora do padrão —
   e ela consulta o catálogo, então não há como uma entidade nova escapar por omissão.
2. **O contexto nunca vem da requisição** (ADR-0008): a origem é a sessão, e a fixação acontece por
   transação. Nenhum filtro por empresa é escrito em consulta, serviço ou repositório — a ADR-0008
   rejeita explicitamente a defesa em profundidade.
3. **Toda rota governada declara sua exigência** (ADR-0011), e o padrão nega. A verificação sobre a
   superfície publicada reprova rota que não declare.
4. **Nada é apagado** (ADR-0014): a retirada de circulação é a única forma de remoção destas
   entidades.
5. **Estas entidades não expõem código legível** (**ADR-0017**) — nenhuma delas tem série declarada,
   e sem série a chave exposta é o UUID. A **ADR-0015** governa o contador de quem tem série.
6. **A suíte nunca executa contra o ambiente que atende a operação** (ADR-0006): instância efêmera
   própria, e o helper ignora a variável de ambiente de conexão por construção.
7. **Prova de falsificação obrigatória** para asserção que inspeciona texto de código, e mutante
   sempre invocado pelo script `test` do pacote — nunca por invocação avulsa do runner
   (`.claude/rules/testing-stack.md`).
8. **Protocolo Antirregressão** em toda edição de arquivo existente, com força máxima sobre os
   marcadores `DECISÃO FECHADA` de `unidade-de-trabalho.ts` e `usuario.controller.ts`.
9. **Débito D28** — consumidor novo dos acessórios de teste compartilhados por caminho relativo
   profundo tem gatilho já disparado; a fatia deve verificar o marcador antes de acrescentar o
   próximo consumidor.

---

## Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**

- Onde exatamente a unidade de trabalho é aberta na borda — no manipulador de cada rota ou por um
  mecanismo transversal. A decisão D1 fixa *que* ela é aberta na borda, não o mecanismo.
- Como a porta única de leitura da D3 se materializa (função por entidade, repositório, ou construtor
  de consulta compartilhado) e onde a soma única da D2 vive.
- Se a posição do cômodo (D6) é densa e reatribuída ou apenas monotônica.
- Forma de derivação do documento publicado a partir dos esquemas, e organização interna do pacote
  de contratos.
- Estratégia de migração e ordem das entidades dentro da fatia.

**Dependências de produto — não decididas aqui:**

- **Retenção e anonimização de dado pessoal**: como nada é apagado, documento, endereço e contato são
  retidos indefinidamente. Registrado como dívida na ADR-0014 e como restrição no PRD §9; **não há
  política declarada**, e o TECH_SPEC não deve inventá-la.
- **Comportamento do agregado quando o imóvel tem cômodos e é retirado de circulação** — o PRD não
  distingue, e a fatia trata a retirada apenas no cadastro. Se houver expectativa de produto sobre
  isso, ela precisa vir antes da implementação.
