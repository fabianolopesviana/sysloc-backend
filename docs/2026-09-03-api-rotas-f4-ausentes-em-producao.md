# Relatório de Defeito de Produção — API do Painel Master

## As 7 rotas da fatia "Ciclo de vida de Empresa e Admin Empresa" não existem na API publicada

| | |
|---|---|
| **Identificador** | `PROD-2026-09-03-01` |
| **Emitido em** | 2026-09-03 |
| **Emitido por** | Equipe do Painel Master (frontend) — `syslocadmin.systera.com.br` |
| **Destinatário** | Equipe da API (`@sysloc/api`) |
| **Severidade** | **Bloqueante** — a funcionalidade entregue está 100% inacessível em produção |
| **Ambiente medido** | Produção — `https://syslocadmin.systera.com.br` |
| **Instante da medição** | `2026-09-03T13:02:37Z` (todas as sondas deste relatório foram colhidas entre `13:02:37Z` e `13:03:10Z`) |
| **Reprodutível** | Sim, sem credenciais — ver §Anexo A |
| **Componente responsável** | API / implantação. **Não** é o frontend |

---

## 1. Sumário executivo

**As 7 rotas novas descritas em `handoff-frontend.md` (2026-09-02) não estão registradas no processo
da API que atende `https://syslocadmin.systera.com.br/v1`.** Todas as 7 respondem `404` com
`codigo: RECURSO_NAO_ENCONTRADO` — a **mesma resposta, byte a byte**, que a API dá a um caminho
inventado que nunca existiu.

Três fatos estabelecidos por medição, e cada um tem uma sonda própria neste relatório:

1. **As 6 rotas `/v1/master/*` anteriores à fatia continuam funcionando** — respondem `401` sem
   cookie, o que só acontece em rota registrada.
2. **As 7 rotas da fatia respondem `404`**, indistinguível de rota inexistente, **e nenhuma variante
   plausível de nome ou prefixo responde** — logo não é divergência de caminho.
3. **O frontend publicado já chama essas rotas.** O bundle em produção
   (`/assets/index-Bf6kU7kT.js`, publicado em `2026-09-03T12:39:44Z`) contém os caminhos.

**Conclusão:** o artefato da API em execução em produção é **anterior** ao merge da fatia. O código
existe no repositório da API — o próprio `handoff-frontend.md` §14 o rastreia
(`apps/api/src/master/administrador.controller.ts`, `empresa.controller.ts`) e registra a suíte verde
em **455 casos, `exit 0`, medida em 2026-09-02**. O que falta é **implantar**.

> ⚠️ **Este relatório não pede reimplementação.** Pede (A1) implantar o que já existe, (A2) confirmar
> uma mudança aditiva numa oitava rota e (A3) corrigir um defeito de contrato do tratador de erro que
> transformou este incidente de implantação numa mensagem falsa na tela do operador.

---

## 2. Impacto no produto — o que o operador não consegue fazer hoje

| Função entregue | O que o operador vê hoje | Rota que falta |
|---|---|---|
| Listar os administradores de uma empresa | A tela diz **"Esta empresa não existe mais. Ela pode ter sido removida por outro operador."** — sobre uma empresa que existe e está aberta na tela | R1 |
| Reemitir senha provisória pela linha do administrador | Inacessível: o `usuarioId` que a ação consome vem exclusivamente de R1 | R1 (a rota A1 da reemissão **está no ar**) |
| Suspender / reativar um administrador | Inacessível pelo mesmo motivo | R2, R3 |
| Corrigir nome/e-mail de um administrador | Inacessível pelo mesmo motivo | R4 |
| Remover um administrador | Inacessível pelo mesmo motivo | R5 |
| Corrigir nome/documento de uma empresa | Falha | R6 |
| **Excluir uma empresa** | O operador confirma a exclusão, **o diálogo fecha e nada acontece — sem mensagem de erro alguma** | R7 |

### 2.1 Por que a exclusão de empresa falha **em silêncio** — a cadeia completa

Não é um segundo defeito. É o mesmo `404` chegando duas vezes, e o silêncio é consequência
aritmética disso:

1. Ao abrir a empresa, o painel chama **R1**. Recebe `404 RECURSO_NAO_ENCONTRADO`.
2. Pelo contrato (`handoff-frontend.md` §4.1: *"empresa inexistente é `404`, e empresa sem
   administradores é `200` com `itens: []`"*), o painel conclui, **corretamente**, que a empresa
   sumiu, e troca a lista pela superfície "esta empresa não existe mais".
3. O operador clica em "Remover empresa", digita o nome para confirmar, e o painel chama **R7**.
   Recebe `404 RECURSO_NAO_ENCONTRADO`.
4. Pelo contrato (§4.7: R7 não é idempotente; a segunda chamada responde `404`), o painel conclui,
   **corretamente**, que a empresa já não existe, fecha o diálogo e exibe a superfície "esta empresa
   não existe mais".
5. **Só que a tela já estava exatamente nesse estado desde o passo 2.** O diálogo fecha e a tela
   volta a ser idêntica ao que era. Nenhum pixel muda. O operador lê isso como "cliquei e não
   aconteceu nada".

Com a API correta, o passo 2 não acontece: a lista estaria na tela, e o desfecho do passo 4 seria uma
troca visível. **O silêncio é artefato do estado degradado, não um defeito independente do painel.**

---

## 3. Método de diagnóstico — o discriminador `401` × `404`

Todas as sondas foram feitas **sem cookie de sessão**. Isso separa as duas causas possíveis de um
`404` de forma conclusiva:

| Situação | Quem responde primeiro | Status observado |
|---|---|---|
| Rota **registrada**, sem cookie | a guarda de autenticação, antes de qualquer consulta ao banco | **`401 NAO_AUTENTICADO`** |
| Rota **não registrada** | o roteador, antes de qualquer guarda | **`404 RECURSO_NAO_ENCONTRADO`** |

A premissa — *a autenticação precede a busca do recurso* — não é suposta: está **provada por controle
positivo**. `POST /v1/master/usuarios/{id}/senha-provisoria` com um UUID que **não existe no banco**
responde `401`, não `404`. Se o recurso fosse consultado antes da guarda, essa sonda teria dado `404`.

E o inverso está provado por **controle negativo**: um caminho que eu inventei
(`/v1/master/empresas/{id}/rota-que-nao-existe`) responde exatamente o mesmo corpo, com o mesmo
tamanho, que `/v1/master/empresas/{id}/administradores`.

> **O UUID usado em todas as sondas é `3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e`** — o UUID de exemplo do
> próprio `handoff-frontend.md` §4.8. Ele é sintaticamente válido e **não corresponde a nenhuma
> empresa real**. Isso é deliberado: nenhuma sonda deste relatório tocou dado de produção, e nenhuma
> delas é destrutiva (todas param na guarda de autenticação ou no roteador).

---

## 4. Evidência

### 4.1 Rotas pré-existentes — todas registradas (`401`)

```
GET    /v1/sessao                                       401  {"codigo":"NAO_AUTENTICADO",...}
GET    /v1/master/empresas                              401  {"codigo":"NAO_AUTENTICADO",...}
POST   /v1/master/empresas                              401  {"codigo":"NAO_AUTENTICADO",...}
POST   /v1/master/empresas/{id}/admin                   401  {"codigo":"NAO_AUTENTICADO",...}
POST   /v1/master/empresas/{id}/suspensao               401  {"codigo":"NAO_AUTENTICADO",...}
POST   /v1/master/empresas/{id}/reativacao              401  {"codigo":"NAO_AUTENTICADO",...}
POST   /v1/master/usuarios/{id}/senha-provisoria        401  {"codigo":"NAO_AUTENTICADO",...}
```

São exatamente as 6 rotas de negócio do handoff geral do Master, mais `GET /v1/sessao`. **Nenhuma
regressão aqui** — o que está no ar continua no ar.

### 4.2 As 7 rotas da fatia — nenhuma registrada (`404`)

```
GET    /v1/master/empresas/{id}/administradores?limite=25&deslocamento=0   404  RECURSO_NAO_ENCONTRADO   ← R1
POST   /v1/master/usuarios/{id}/suspensao                                  404  RECURSO_NAO_ENCONTRADO   ← R2
POST   /v1/master/usuarios/{id}/reativacao                                 404  RECURSO_NAO_ENCONTRADO   ← R3
PUT    /v1/master/usuarios/{id}                                            404  RECURSO_NAO_ENCONTRADO   ← R4
DELETE /v1/master/usuarios/{id}                                            404  RECURSO_NAO_ENCONTRADO   ← R5
PUT    /v1/master/empresas/{id}                                            404  RECURSO_NAO_ENCONTRADO   ← R6
DELETE /v1/master/empresas/{id}                                            404  RECURSO_NAO_ENCONTRADO   ← R7
```

**7 de 7.** Não é uma rota faltando: é a fatia inteira ausente.

### 4.3 Controle negativo — a resposta é idêntica à de um caminho inventado

```
GET    /v1/master/empresas/{id}/rota-que-nao-existe      404  {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
GET    /v1/qualquer                                      404  {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
DELETE /v1/sessao   (método não suportado em rota viva)  404  {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
```

`content-length: 72` nos três casos e no caso de R1. **A API não distingue "caminho não roteado" de
"recurso de negócio inexistente".** Isso é, por si só, um defeito de contrato — tratado em §7.3.

### 4.4 O `404` é da **aplicação**, não do nginx

Cabeçalhos comparados, mesma requisição, mesmo segundo:

```
── R1 (ausente) ──────────────────       ── GET /v1/master/empresas (viva) ──
HTTP/2 404                               HTTP/2 401
server: nginx                            server: nginx
content-type: application/json; ...      content-type: application/json; ...
content-length: 72                       content-length: 71
cache-control: no-store                  cache-control: no-store
```

As duas respostas carregam `cache-control: no-store` e o envelope JSON do contrato — assinatura da
aplicação. Um `404` do nginx viria como `text/html` sem `no-store`.

**Contraprova de que o proxy está correto:** um caminho **fora** de `/v1` cai no fallback da SPA.

```
GET /v2/qualquer                                  200  text/html   (index.html da SPA)
GET /master/empresas/{id}/administradores         200  text/html   (index.html da SPA)
GET /api/v1/master/empresas/{id}/administradores  200  text/html   (index.html da SPA)
```

⇒ O nginx encaminha `/v1` para a API e serve a SPA para todo o resto. **O proxy reverso está
corretamente configurado. A requisição chega à aplicação, e é a aplicação que responde `404`.**

### 4.5 Descarte de divergência de caminho

Sete variantes plausíveis sondadas. **Nenhuma responde:**

```
GET /v1/master/empresas/{id}/admins                404
GET /v1/master/empresas/{id}/administradores/      404   (barra final)
GET /v1/master/empresas/{id}/usuarios              404
GET /v1/master/administradores?empresaId={id}      404
GET /v1/master/usuarios?empresaId={id}             404
GET /master/empresas/{id}/administradores          200 text/html  (não é a API — é a SPA)
GET /api/v1/master/empresas/{id}/administradores   200 text/html  (não é a API — é a SPA)
```

⇒ **A rota não está publicada sob nome nenhum.** Não é drift de nomenclatura, nem de versionamento,
nem de prefixo.

### 4.6 O frontend publicado já consome essas rotas

```
GET /                       → 200, last-modified: Thu, 03 Sep 2026 12:39:44 GMT
                              referencia /assets/index-Bf6kU7kT.js
GET /assets/index-Bf6kU7kT.js → 200, 307.414 bytes
```

`grep` sobre o bundle publicado encontra `"/administradores?"`, `"/suspensao"`, `"/reativacao"`,
`"/senha-provisoria"` e o literal `"Esta empresa não existe mais"`.

⇒ **O painel está publicado, atual e correto. Ele está esperando o servidor.**

---

## 5. Diagnóstico

**O processo que atende `/v1` em produção executa um build da API anterior ao merge da fatia.**

Isso é o que explica, simultaneamente e sem exceção:

- as 6 rotas antigas vivas (`401`);
- as 7 rotas novas ausentes (`404`);
- nenhuma variante de nome respondendo;
- o `404` vindo da aplicação, não da borda;
- o handoff da própria API afirmando, em 2026-09-02, que as 7 rotas estão implementadas, testadas
  (455 casos, `exit 0`) e rastreadas a arquivo e linha.

### 5.1 Hipóteses e como distingui-las — para a equipe da API executar no host

| # | Hipótese | Como confirmar ou descartar |
|---|---|---|
| H1 | O contêiner/processo da API roda uma imagem/tag anterior ao merge | Comparar o SHA do commit do artefato em execução com o SHA do merge da fatia |
| H2 | A imagem é nova, mas o contêiner não foi recriado (subiu com a camada antiga em cache) | Conferir o `created`/`started` do contêiner contra a data do build |
| H3 | O build saiu de uma branch/tag que não contém a fatia | Conferir a ref usada no pipeline de release |
| H4 | O módulo dos administradores existe no código mas não está registrado no módulo raiz da aplicação | Conferir se `AdministradorController` (e as rotas novas de `EmpresaController`) constam do módulo carregado no bootstrap; conferir o mapa de rotas emitido no log de inicialização |
| H5 | O processo em execução é antigo e o novo nunca substituiu (deploy sem restart efetivo) | Conferir uptime do processo contra a data do último deploy |

**H4 é a única que não é resolvida por reimplantar** — e é a única que também precisa de mudança de
código. As demais são operacionais. O log de inicialização, que lista as rotas mapeadas, distingue as
cinco em um passo: **se `administradores`, `suspensao`, `reativacao` e os verbos `PUT`/`DELETE` de
`usuarios` e `empresas` não aparecerem no mapa de rotas, o artefato não as tem.**

---

## 6. O que já está do lado do frontend — e que, portanto, **não precisa mudar**

O painel implementa o contrato do `handoff-frontend.md` campo a campo. A equipe da API pode conferir
sem abrir o repositório do frontend:

| Rota | Método e caminho emitidos | Query / corpo emitidos | O que o painel consome da resposta `200` |
|---|---|---|---|
| **R1** | `GET /v1/master/empresas/{empresaId}/administradores` | query **fechada**: `limite=25` e `deslocamento=<n>`, e **nada mais** — sem `busca`, sem `estado`, sem cache-buster | `itens[]` (`usuarioId`, `nome`, `email`, `estado`, `criadoEm`, `exclusao{disponivel,motivo,impedimentos,alternativa}`), `total`, `deslocamento` |
| **R2** | `POST /v1/master/usuarios/{usuarioId}/suspensao` | **sem corpo** (o contrato aceita nada ou `{}`; o painel não envia nada) | `sessoesEncerradas` |
| **R3** | `POST /v1/master/usuarios/{usuarioId}/reativacao` | **sem corpo** | apenas o desfecho `200` (o painel **não** espera `sessoesEncerradas` aqui) |
| **R4** | `PUT /v1/master/usuarios/{usuarioId}` | `{"nome": "...", "email": "..."}` — os dois sempre, mesmo quando só um mudou | a **linha inteira** da listagem, com `exclusao` |
| **R5** | `DELETE /v1/master/usuarios/{usuarioId}` | **sem corpo** | `{usuarioId, removido: true}` |
| **R6** | `PUT /v1/master/empresas/{empresaId}` | `{"nome": "...", "documento": "..."}` | `EmpresaListada` — 6 chaves, com `exclusao` |
| **R7** | `DELETE /v1/master/empresas/{empresaId}` | **sem corpo** | `{id, removida: true}` |
| **R8** | `GET /v1/master/empresas` | `limite=200`, `deslocamento=<n>` (até 10 páginas) | as 5 chaves antigas **+ `exclusao`** por item |

**Tratamento de recusa já implementado**, por `codigo` e nunca por `mensagem`:

- `401 NAO_AUTENTICADO` / `CREDENCIAL_INVALIDA` → devolve o operador à entrada;
- `403 ACESSO_NEGADO` → refaz `GET /v1/sessao` e roteia pelas bandeiras `senhaProvisoria` /
  `segundoFatorPendente`;
- `422 CAMPO_INVALIDO` → lê `campo`, e de `detalhes`: `motivo`, `perfilExigido`, `perfilDoAlvo`,
  `impedimentos`, `alternativa`. **A presença de `detalhes.impedimentos` não-vazio é o que discrimina
  "exclusão impedida" (resultado normal) de "campo malformado" (erro)** — o painel depende disso em
  R5 e R7;
- `404 RECURSO_NAO_ENCONTRADO` → superfície própria de recurso inexistente;
- `REQUISICAO_RECUSADA`, `ERRO_INTERNO`, `SERVICO_INDISPONIVEL` → faixa de indisponibilidade.

> Corpo ou query com **campo a mais** é tratado como erro do painel, não como algo a ser ignorado
> pelo servidor. O painel monta cada corpo por desestruturação explícita justamente para que isso
> seja verdade por construção.

---

## 7. Ações exigidas

### 7.1 · A1 — **Bloqueante** · Publicar em produção o artefato da API que contém a fatia

**O que fazer:** implantar, na borda `syslocadmin.systera.com.br`, o build da API que inclui o merge
da fatia "Ciclo de vida de Empresa e Admin Empresa" — o mesmo estado de código que produziu a suíte
verde de 455 casos em 2026-09-02.

**O que mudar no código:** *nada*, salvo se a investigação de §5.1 confirmar a hipótese **H4** (módulo
não registrado no bootstrap). Nesse caso, registrar o controlador dos administradores e as rotas
novas do controlador de empresas no módulo raiz — e acrescentar um caso de suíte que **falhe** se o
mapa de rotas deixar de conter qualquer uma das 7, para que a regressão não possa se repetir em
silêncio.

**Como confirmar que ficou pronto:** rodar o Anexo A. As 7 linhas hoje `404` devem passar a `401`.

---

### 7.2 · A2 — **Alto** · Confirmar a mudança aditiva de R8 no artefato publicado

`handoff-frontend.md` §4.8 declara que cada item de `GET /v1/master/empresas` passou a carregar
`exclusao`. **Não foi possível verificar de fora** — a rota exige sessão autenticada.

**Por que importa:** o painel já mapeia `exclusao` ao ler a carteira. Se o artefato publicado for
anterior à fatia — e §5 conclui que é —, então os itens **não** têm `exclusao`, e o painel produz hoje
um objeto cujos quatro campos são `undefined` sob um tipo que promete `boolean` e lista. Hoje isso é
inofensivo porque nenhum ponto do painel lê esse campo; passa a morder no primeiro leitor.

**O que fazer:** com uma sessão `SYSLOC_MASTER` válida, executar `GET /v1/master/empresas?limite=1` e
verificar que cada item traz as **seis** chaves, `exclusao` inclusive. Se A1 for concluída, isso deve
resolver-se junto — mas precisa ser **confirmado**, não presumido.

**Ponto que não pode escapar:** `POST /v1/master/empresas` (criação) **continua devolvendo cinco
chaves, sem `exclusao`** — é assimetria deliberada do contrato (§4.8), e o painel conta com ela. Não
"uniformizar".

---

### 7.3 · A3 — **Médio, com altíssimo custo de diagnóstico** · O `404` do roteador não pode usar o vocabulário de negócio

**O defeito:** quando nenhuma rota casa com o caminho (ou com o método), a aplicação responde com o
**envelope de negócio**, `codigo: RECURSO_NAO_ENCONTRADO` — o mesmo código que significa, no contrato,
*"a empresa/pessoa que você pediu não existe"*.

**A consequência medida, e o motivo deste relatório existir:** um erro de **implantação** chegou à
tela do operador como uma **afirmação falsa sobre o negócio** — *"Esta empresa não existe mais. Ela
pode ter sido removida por outro operador."* — sobre uma empresa que existe. Nenhum cliente consegue
distinguir os dois casos: os corpos são idênticos byte a byte (§4.3). O painel está classificando
**corretamente** e ainda assim mostrando algo falso, porque o servidor lhe deu informação ambígua.

**O que mudar:** o tratador global de exceções deve envelopar apenas recusas **de negócio**. Um `404`
originado no **roteador** (caminho ou método sem correspondência) deve responder um corpo que **não
carrega a chave `codigo`** do vocabulário fechado.

| | Hoje | Depois |
|---|---|---|
| Rota inexistente | `404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}` | `404` com corpo **sem** a chave `codigo` |
| Empresa/pessoa inexistente numa rota que existe | `404 {"codigo":"RECURSO_NAO_ENCONTRADO",...}` | **inalterado** |

**Por que essa forma exata:** o painel já trata corpo de recusa **sem `codigo` do contrato** como
indisponibilidade genérica, e exibe *"Falha de comunicação"*. Ou seja, a correção faz o painel dizer
uma coisa **verdadeira** — "não consegui falar direito com o servidor" — em vez de uma **falsa** —
"a empresa foi removida". **Nenhuma mudança é necessária no frontend para colher esse benefício.**

**O que essa mudança NÃO é:** não é acrescentar um nono código ao vocabulário. O vocabulário fechado
de 11 códigos (dos quais 8 alcançam o Painel Master) permanece intacto. O que muda é **quem** tem
direito de usá-lo: só o domínio, nunca o roteador.

**Rede exigida:** um caso de suíte que afirme que `GET /v1/caminho-inexistente` responde `404` **sem**
a chave `codigo`, e outro que afirme que o `404` de recurso de negócio ausente **continua** com
`codigo: RECURSO_NAO_ENCONTRADO`. Os dois juntos são o que impede a colisão de voltar.

---

## 8. Critérios de aceite — verificáveis por comando

### Fase 1 — sem credenciais (qualquer pessoa, de qualquer máquina)

Executar o Anexo A. **Aceite:** as 7 linhas hoje `404` respondem `401 NAO_AUTENTICADO`, e as 7
linhas de controle das rotas antigas continuam `401`.

### Fase 2 — com sessão `SYSLOC_MASTER` (na conta de operação)

| # | Verificação | Resultado exigido |
|---|---|---|
| 1 | `GET /v1/master/empresas?limite=1` | `200`; cada item com **seis** chaves, `exclusao` inclusive |
| 2 | `GET /v1/master/empresas/{empresaExistente}/administradores?limite=25&deslocamento=0` | `200` com `{itens, total, limite, deslocamento}` |
| 3 | Mesma rota, empresa **sem** administradores | `200` com `itens: []` — **jamais** `404` |
| 4 | Mesma rota, empresa **inexistente** | `404 RECURSO_NAO_ENCONTRADO` |
| 5 | Mesma rota com `?limite=51` | `422 CAMPO_INVALIDO`, `campo: "limite"` — recusa, não truncamento |
| 6 | Mesma rota com `?busca=x` | `422 CAMPO_INVALIDO`, `campo: "limite"` (cadeia fechada) |
| 7 | `POST /v1/master/usuarios/{adminExistente}/suspensao`, **sem corpo** | `200` com `sessoesEncerradas` |
| 8 | Repetir a sonda 7 sobre quem já está suspenso | `200` com `sessoesEncerradas: 0` — **nunca** conflito |
| 9 | `POST /v1/master/usuarios/{id}/reativacao` | `200`, **sem** a chave `sessoesEncerradas` |
| 10 | `POST /v1/master/usuarios/{id}/suspensao` com corpo `{"estado":"SUSPENSO"}` | `422 CAMPO_INVALIDO`, `campo: "corpo"`. ⚠️ **`{}` e corpo ausente são ACEITOS** — o corpo é vazio *e* fechado: o que se recusa é campo, não o objeto vazio |
| 11 | `PUT /v1/master/usuarios/{id}` com `{nome, email}` | `200` com a **linha inteira**, `exclusao` inclusive |
| 12 | `PUT /v1/master/usuarios/{id}` com `{nome, email, estado}` | `422 CAMPO_INVALIDO`, `campo: "corpo"` |
| 13 | `DELETE /v1/master/usuarios/{id}` sobre alvo **não elegível** | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes.motivo = "EXCLUSAO_IMPEDIDA_POR_REGISTROS"`, `detalhes.impedimentos` **não vazio** e `detalhes.alternativa` |
| 14 | `DELETE /v1/master/usuarios/{id}` repetido sobre o mesmo alvo | `404` — não é idempotente |
| 15 | `PUT /v1/master/empresas/{id}` com `{nome, documento}` | `200` com `EmpresaListada` (6 chaves) |
| 16 | `DELETE /v1/master/empresas/{id}` sobre empresa **não elegível** | `422 CAMPO_INVALIDO`, `campo: "id"`, com `detalhes.impedimentos` não vazio |
| 17 | `GET /v1/caminho-que-nao-existe` (após A3) | `404` **sem** a chave `codigo` |

> ⚠️ **Alerta de ambiente, e ele não é negociável:** o banco desta instalação é o **da operação** —
> não existe base de teste separada, e há **empresa real cadastrada**. As sondas 7 a 16 são
> destrutivas ou têm efeito colateral (encerram sessões, alteram cadastro, apagam em definitivo).
> **Execute-as apenas contra dados criados para o teste, com nome reconhecível, e nunca contra a
> empresa da operação.** As sondas 1 a 6 e 17 são leituras puras e seguras.

---

## 9. O que **não** deve ser alterado

Cada item abaixo já está implementado no painel publicado. Alterá-los no servidor quebra a tela.

1. **Os caminhos das 7 rotas.** Estão fixos no bundle em produção. Renomear qualquer um exige nova
   publicação do frontend, coordenada.
2. **`404` de empresa inexistente em R1 não pode virar `200` com lista vazia.** São dois desfechos com
   telas diferentes: o vazio é onde o painel oferece *"admitir o primeiro administrador"*. Fundi-los
   apaga essa oferta.
3. **A cadeia de consulta fechada de R1.** O painel conta com o `422` de parâmetro desconhecido.
4. **`sessoesEncerradas` ausente na resposta de R3 (reativação).** A ausência é o contrato: publicar
   o campo com `0` afirmaria um encerramento que não houve.
5. **As respostas de R5 e R7 (`{...removido: true}` / `{...removida: true}`).** Descrevem o ato
   consumado. Não devolver a entidade que deixou de existir, e não fundir com a prévia `exclusao`.
6. **A assimetria de `POST /v1/master/empresas`**, que continua sem `exclusao` (§7.2).
7. **`detalhes.impedimentos` como discriminador.** O painel distingue "exclusão impedida" (resultado
   normal, com tela própria e alternativa oferecida) de "campo malformado" (erro) pela **presença de
   uma lista não-vazia** em `detalhes.impedimentos`. Remover, renomear ou esvaziar esse campo faz o
   painel classificar um impedimento legítimo como erro genérico.
8. **O vocabulário fechado de códigos de recusa.** A correção A3 **não** acrescenta código novo.
9. **A conferência de `Origin` em `/v1/auth/*`.** Está correta e é defesa real. **Não** acrescente
   `http://localhost:5173` às origens confiáveis — isso afrouxaria a produção para viabilizar
   desenvolvimento, e o problema já está resolvido do lado do painel, por reescrita de `Origin` no
   proxy de desenvolvimento.

---

## 10. Limites deste levantamento — o que **não** foi verificado, e por quê

Declarado para que nada aqui seja lido como mais forte do que é:

1. **Não houve acesso a sessão autenticada.** Toda medição parou na guarda de autenticação ou no
   roteador. Nada foi lido, criado, alterado ou removido no banco.
2. **Não houve acesso ao repositório da API nem ao host.** As hipóteses de §5.1 são as que a evidência
   externa admite; **distinguir entre elas exige inspeção do artefato em execução**, que só a equipe
   da API pode fazer. O relatório afirma o que produção **responde** — não afirma qual commit está
   rodando.
3. **A presença de `exclusao` em `GET /v1/master/empresas` não pôde ser medida** (§7.2). É inferência
   a partir de §5, marcada como tal, e o critério de aceite Fase 2 #1 existe para confirmá-la.
4. **A afirmação de `handoff-frontend.md` §14 de que a suíte está verde em 455 casos não foi
   reexecutada** — é reproduzida como consta do documento da própria equipe da API.
5. **Nenhuma sonda usou dado real.** O UUID é o de exemplo do handoff e não corresponde a registro
   algum.

---

## Anexo A — Script de sonda reproduzível

Sem credenciais, sem efeito colateral, ~15 segundos. Salve como `sondar-api-master.sh`.

```bash
#!/usr/bin/env bash
# Sonda de publicação das rotas do Painel Master.
# Discriminador: rota registrada responde 401 sem cookie; rota ausente responde 404.
# Nenhuma sonda passa da guarda de autenticação — não há efeito colateral.
set -u
BASE="${1:-https://syslocadmin.systera.com.br}"
UUID='3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e'   # UUID de exemplo do handoff; não existe no banco.

sonda() { # $1=caminho  $2=método  $3=esperado
  local corpo status
  corpo="$(mktemp)"
  status="$(curl -s -o "$corpo" -w '%{http_code}' -X "$2" "$BASE$1" --max-time 20)"
  if [ "$status" = "$3" ]; then printf 'OK   '; else printf 'FALHA'; fi
  printf ' %-7s %-62s esperado=%s obtido=%s %s\n' \
    "$2" "$1" "$3" "$status" "$(head -c 72 "$corpo")"
  rm -f "$corpo"
}

echo "== Controle: rotas pré-existentes (devem responder 401) =="
sonda "/v1/sessao"                                  GET    401
sonda "/v1/master/empresas"                         GET    401
sonda "/v1/master/empresas"                         POST   401
sonda "/v1/master/empresas/$UUID/admin"             POST   401
sonda "/v1/master/empresas/$UUID/suspensao"         POST   401
sonda "/v1/master/empresas/$UUID/reativacao"        POST   401
sonda "/v1/master/usuarios/$UUID/senha-provisoria"  POST   401

echo
echo "== Alvo: as 7 rotas da fatia (esperado 401 DEPOIS da correção; hoje respondem 404) =="
sonda "/v1/master/empresas/$UUID/administradores?limite=25&deslocamento=0" GET    401
sonda "/v1/master/usuarios/$UUID/suspensao"                                POST   401
sonda "/v1/master/usuarios/$UUID/reativacao"                               POST   401
sonda "/v1/master/usuarios/$UUID"                                          PUT    401
sonda "/v1/master/usuarios/$UUID"                                          DELETE 401
sonda "/v1/master/empresas/$UUID"                                          PUT    401
sonda "/v1/master/empresas/$UUID"                                          DELETE 401

echo
echo "== Controle negativo: caminho inventado (deve permanecer 404) =="
sonda "/v1/master/empresas/$UUID/rota-que-nao-existe" GET 404
sonda "/v1/qualquer"                                  GET 404
```

**Leitura do resultado:**

- Todas `OK` ⇒ A1 concluída.
- Alguma das 7 do bloco "Alvo" em `FALHA … obtido=404` ⇒ essa rota continua ausente.
- Alguma do bloco "Controle" em `FALHA` ⇒ **regressão nova** — rota que estava no ar saiu do ar.

---

## Anexo B — Saída bruta integral da medição de 2026-09-03T13:02:37Z

```
GET    /v1/sessao                                                401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
GET    /v1/master/empresas                                       401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
POST   /v1/master/empresas                                       401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
POST   /v1/master/empresas/{uuid}/admin                          401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
POST   /v1/master/empresas/{uuid}/suspensao                      401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
POST   /v1/master/empresas/{uuid}/reativacao                     401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}
POST   /v1/master/usuarios/{uuid}/senha-provisoria               401 {"codigo":"NAO_AUTENTICADO","mensagem":"sessão inválida ou expirada"}

GET    /v1/master/empresas/{uuid}/administradores?limite=25&deslocamento=0
                                                                 404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
POST   /v1/master/usuarios/{uuid}/suspensao                      404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
POST   /v1/master/usuarios/{uuid}/reativacao                     404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
PUT    /v1/master/usuarios/{uuid}                                404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
DELETE /v1/master/usuarios/{uuid}                                404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
PUT    /v1/master/empresas/{uuid}                                404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
DELETE /v1/master/empresas/{uuid}                                404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}

GET    /v1/master/empresas/{uuid}/rota-que-nao-existe            404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
GET    /v1/qualquer                                              404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
DELETE /v1/sessao                                                404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}
OPTIONS /v1/master/empresas/{uuid}/administradores               404 {"codigo":"RECURSO_NAO_ENCONTRADO","mensagem":"recurso não encontrado"}

GET    /v1/master/empresas/{uuid}/admins                         404 {"codigo":"RECURSO_NAO_ENCONTRADO",...}
GET    /v1/master/empresas/{uuid}/administradores/               404 {"codigo":"RECURSO_NAO_ENCONTRADO",...}
GET    /v1/master/administradores?empresaId={uuid}               404 {"codigo":"RECURSO_NAO_ENCONTRADO",...}
GET    /v1/master/usuarios?empresaId={uuid}                      404 {"codigo":"RECURSO_NAO_ENCONTRADO",...}
GET    /v1/master/empresas/{uuid}/usuarios                       404 {"codigo":"RECURSO_NAO_ENCONTRADO",...}
GET    /master/empresas/{uuid}/administradores                   200 text/html  (fallback da SPA)
GET    /api/v1/master/empresas/{uuid}/administradores            200 text/html  (fallback da SPA)
GET    /v2/qualquer                                              200 text/html  (fallback da SPA)
```

Cabeçalhos completos (mesma janela de medição):

```
── GET /v1/master/empresas/{uuid}/administradores?limite=25&deslocamento=0
HTTP/2 404
server: nginx
date: Thu, 03 Sep 2026 13:02:37 GMT
content-type: application/json; charset=utf-8
content-length: 72
vary: Accept-Encoding
cache-control: no-store

── GET /v1/master/empresas
HTTP/2 401
server: nginx
date: Thu, 03 Sep 2026 13:02:37 GMT
content-type: application/json; charset=utf-8
content-length: 71
cache-control: no-store
```

---

## Anexo C — Onde cada rota é chamada no frontend

Repositório do Painel Master, commit `551e882` (2026-09-03).

| Rota | Definição da chamada | Ponto de consumo |
|---|---|---|
| R1 | `src/api/administradores.ts:137` `listarAdministradores` | `src/empresas/EmpresaAberta.tsx:505` |
| R2 | `src/api/administradores.ts:165` `suspenderAdministrador` | `src/empresas/EmpresaAberta.tsx:766` |
| R3 | `src/api/administradores.ts:186` `reativarAdministrador` | `src/empresas/EmpresaAberta.tsx:830` |
| R4 | `src/api/administradores.ts:224` `corrigirAdministrador` | `src/empresas/EmpresaAberta.tsx:957` |
| R5 | `src/api/administradores.ts:245` `removerAdministrador` | `src/empresas/EmpresaAberta.tsx:1280` |
| R6 | `src/api/empresas.ts:166` `corrigirEmpresa` | `src/empresas/EmpresaAberta.tsx:1089` |
| R7 | `src/api/empresas.ts:188` `removerEmpresa` | `src/empresas/EmpresaAberta.tsx:1413` |
| R8 | `src/api/empresas.ts:83` `listarEmpresas` | `src/api/empresas.ts:283` `lerCarteiraCompleta` |
| A1 | `src/api/administradores.ts:106` `reemitirSenhaProvisoria` | `src/empresas/EmpresaAberta.tsx:679` |

Classificação de recusa, ponto único: `src/sessao/ProvedorDeSessao.tsx`, função
`executarOperacaoDeNegocio` (linha 1011) — todo `codigo` do contrato é ramificado ali, uma vez.

---

## Anexo D — Referências documentais

| Documento | Onde | O que estabelece |
|---|---|---|
| `handoff-frontend.md` (2026-09-02) | raiz do repositório do Painel Master | Contrato integral das 7 rotas novas e da alteração aditiva de R8. §3 (entry points), §4.1–4.8 (contratos), §4.9 (matriz), §14 (rastreabilidade até arquivo do backend) |
| `handoff-master-frontend.md` | raiz do repositório do Painel Master | Contrato do Painel Master como um todo; envelope de erro e vocabulário fechado de códigos |
| `prontidao-do-backend-master.md` (2026-08-27) | raiz do repositório do Painel Master | Estado do servidor **antes** da fatia — lista exatamente as 6 rotas de negócio que hoje respondem `401`, o que corrobora §5 |

---

**Fim do relatório.** Dúvidas sobre qualquer ponto do contrato consumido pelo painel podem ser
respondidas com o Anexo C, que aponta a linha exata de cada chamada.
