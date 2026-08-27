# Publicar o `@syslocbr/contracts` — roteiro literal

> **Item 3 do marco de entrega**, e entregável da **F6** que cabe neste repositório. O outro
> entregável da F6 daqui — o `handoff-frontend.md` — já está feito desde 2026-08-24.
>
> ⚠️ **Este roteiro tem passos que NENHUM agente executa**: criar organização no GitHub, gerar PAT e
> publicar são ações suas. O que o repositório entrega pronto é o pacote **configurado e provado** —
> `CT-1200` a `CT-1202` em `packages/contracts/test/publicacao.spec.ts`.

---

## 0. Por que existe uma organização no meio disto — e por que ela NÃO se chama `sysloc`

O GitHub Packages exige que o **escopo do pacote case com o login do dono**. O monorepo vive em
`fabianolopesviana/sysloc-backend` e o escopo nasceu `@sysloc` — **não casam**, e publicar assim é
recusado.

As alternativas foram medidas antes da decisão:

| Saída | Custo medido | Veredito |
|---|---|---|
| Consumir por tag git | exige repo espelho com `dist/` commitado e um passo de sincronização por versão | recusada — abandona a decisão de `decisao-e-stack.md` §209 |
| Tarball em Release | em repositório privado o download exige token na URL | recusada — frágil no CI do frontend |
| npmjs.com com org privada `@sysloc` | zero arquivo tocado; ~US$ 7/mês de assinatura | recusada — decisão do usuário, 2026-08-27 |
| Publicar sob a conta `fabianolopesviana` | mesmo rename; nada a criar no navegador | recusada — escopo pessoal, e quem lê o pacote precisaria de acesso ao monorepo |
| **Organização `syslocbr`** | criar org + repo, e renomear o escopo deste pacote | **adotada** — decisão do usuário, 2026-08-27 |

⚠️ **A organização `sysloc` era o plano, e foi REFUTADA POR MEDIÇÃO em 2026-08-27.**
`https://api.github.com/users/sysloc` responde **200**: o login pertence a uma **conta pessoal de
terceiro**, criada em **2019-08-01**, sem relação alguma com este produto. No GitHub, login de
usuário e de organização dividem o mesmo espaço de nomes — com `sysloc` ocupado, **não existe
organização `sysloc` a criar**. Não tente; o formulário recusa.

⚠️ **O rename alcançou SÓ este pacote.** `@sysloc/db`, `@sysloc/auth`, `@sysloc/shared` e os demais
membros do workspace nunca vão a registry algum — são resolvidos por `workspace:*` — e seguem com a
identidade `@sysloc`. Renomeá-los seria churn sem contrapartida.

⚠️ **O monorepo NÃO muda de lugar nem de remote.** Ele continua em
`fabianolopesviana/sysloc-backend`; a org existe para dar ao escopo um dono válido.

---

## 1. Criar a organização e o repositório — no navegador

> ✅ **Feito em 2026-08-27.** A org `syslocbr` existe (`type: Organization`, id `321860267`), criada
> pela conta `fabianolopesviana`, que segue sendo a dona do monorepo. Esta seção fica como registro
> do que foi feito, e do que refazer se a org for perdida.

1. `https://github.com/organizations/plan` → criar a organização **`syslocbr`** (plano gratuito
   serve; pacote privado em org gratuita é permitido). O campo *Organization account name* é o que
   vira o escopo; o *display name* pode continuar `Sysloc`.
2. Dentro dela, criar o repositório **`syslocbr/contracts`**, **privado**, vazio.

⚠️ **Estar logado na conta pessoal é o esperado, não um problema**: uma organização é criada *por*
uma conta pessoal, que vira sua owner. Não há segundo login nem segundo e-mail.

⚠️ **O nome do repositório importa**: é ele que o campo `repository` do manifesto nomeia, e é por ele
que o GitHub Packages associa o pacote. O `CT-1200` reprova se esse campo deixar de apontar para um
caminho sob `/syslocbr/`.

---

## 2. Gerar o PAT

`https://github.com/settings/tokens` → **Tokens (classic)** → escopos:

- `write:packages` — para publicar (é este que você precisa agora);
- `read:packages` — o que o **agente do frontend** vai precisar, num token próprio.

⚠️ **Dois tokens, não um.** Quem consome não precisa de permissão de escrita, e um token de escrita
na máquina que só lê é superfície de ataque sem contrapartida.

---

## 3. Autenticar sem versionar segredo

```bash
# ⚠️ Fora da árvore: no HOME, nunca no repositório.
#    O `.gitignore` já barra `.npmrc`, e o CT-1202 afirma isso — mas a barreira certa é o HOME.
#
# ⚠️ O token entra por LEITURA SILENCIOSA, nunca por atribuição colada. `SEU_PAT=ghp_…` grava o
#    segredo em claro no histórico do shell e o deixa no ambiente pelo resto da sessão.
read -rs -p 'PAT (write:packages): ' SEU_PAT; echo

# ⚠️ O arquivo NASCE 0600, e não vira 0600 depois. A umask deste host é 0002: um `>>` num
#    arquivo inexistente o cria em 0664, e o token viveria legível pelo grupo até o `chmod`
#    seguinte. O subshell com `umask 077` fecha essa janela, e o `[ -e ]` preserva intacto um
#    arquivo que já exista.
#    ⚠️ `install -m 600 /dev/null ~/.npmrc` foi tentado e RECUSADO: ele TRUNCA o arquivo
#    existente. Não o reponha.
( umask 077; [ -e ~/.npmrc ] || : > ~/.npmrc )
chmod 600 ~/.npmrc                              # estreita o que já existia com modo frouxo

# Substituição idempotente: sem isto, reexecutar com um PAT novo EMPILHA duas linhas de token.
# ⚠️ Sem temporário: `printf` de uma substituição TRUNCA o original e por isso PRESERVA o modo
#    0600. A forma com `> ~/.npmrc.novo` foi recusada — o temporário nasceria sob a umask
#    ambiente (0664) carregando tokens de OUTROS registries, e sobreviveria a uma interrupção.
printf '%s\n' "$(grep -v '^//npm.pkg.github.com/:_authToken=' ~/.npmrc)" > ~/.npmrc
printf '//npm.pkg.github.com/:_authToken=%s\n' "$SEU_PAT" >> ~/.npmrc
unset SEU_PAT                                   # o segredo não sobrevive ao bloco

stat -c '%a %n' ~/.npmrc                        # esperado: 600
grep -c '_authToken' ~/.npmrc                   # esperado: 1 — nunca acumula
```

Confira que nada vazou para dentro do repositório:

```bash
git -C /opt/sysloc-backend status --porcelain | grep npmrc && echo 'PARE — há .npmrc na árvore'
```

---

## 4. Publicar

```bash
cd /opt/sysloc-backend

# A rede executável ANTES da ação irreversível.
pnpm --filter @syslocbr/contracts test        # esperado: 455 passed (CT-1200..CT-1202 verdes)

# (a) O que exatamente vai no tarball — 61 arquivos, ~150 kB, só `dist/`.
cd packages/contracts && npm pack --dry-run | tail -5

# (b) ⚠️ PARA ONDE vai — e este é o passo que confere o ATO, não o manifesto.
#     O `npm pack --dry-run` acima mostra CONTEÚDO e não imprime destino algum.
pnpm publish --dry-run --no-git-checks
#     ESPERADO na saída: `Publishing to https://npm.pkg.github.com`
#     ⚠️ Se a linha nomear QUALQUER outro registry — em especial `registry.npmjs.org` —
#        PARE. Não publique. O contrato inteiro da API ficaria público.

# (c) A publicação. O `prepack` roda `tsc --build` sozinho; o registry vem do manifesto,
#     NÃO da linha de comando — mas um `--registry` explícito o sobrepõe, e é por isso que
#     o passo (b) existe: a rede do CT-1200 cobre o manifesto, nunca o comando digitado.
pnpm publish --no-git-checks
```

⚠️ **`npm unpublish` tem janela de 72 h e não desfaz quem já baixou.** O que protege é o
**passo (b)** — o ensaio do próprio `publish`, que imprime o destino sem publicar.

---

## 5. Conferir que publicou

```bash
npm view @syslocbr/contracts --registry https://npm.pkg.github.com version   # esperado: 1.0.0
```

E na interface: `https://github.com/orgs/syslocbr/packages` deve listar `contracts`, marcado
**Private**.

---

## 6. Como o frontend consome — o que passar ao agente da máquina local

No repositório do React, um `.npmrc` **fora do controle de versão**:

```
@sysloc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${TOKEN_DE_LEITURA}
```

E então:

```bash
pnpm add zod@4.4.3            # ⚠️ EXATAMENTE esta versão — ver abaixo
pnpm add @syslocbr/contracts@1.0.0
```

⚠️ **O consumidor DEVE usar `zod@4.4.3`, a mesma que o monorepo declara nos seus quatro pacotes.**
`zod` é dependência **normal e fixada** do `@syslocbr/contracts` — com qualquer outra versão do lado do
React, o gerenciador instala uma **segunda cópia aninhada**, e as duas não se conhecem: `instanceof
ZodError` passa a ser falso entre um esquema do pacote e um `z` local, e o bundle carrega `zod` duas
vezes. O sintoma aparece **só no frontend**, do outro lado da Fronteira, onde nenhum agente deste
repositório pode depurá-lo. O `CT-1200` afirma a versão declarada aqui; casá-la lá é do consumidor.

O pacote é **Zod puro em runtime** — o React importa os esquemas e valida de verdade, não só os
tipos. ⚠️ **Não há cliente ts-rest**, apesar de `decisao-e-stack.md` §4 ainda o listar: ele foi
avaliado e não existe nos manifests. Não o procure.

---

## 7. Versionamento — o que `1.0.0` significa aqui

`1.0.0` é a **superfície congelada**: 106 rotas / 91 manipuladores / 20 públicas, medida pelas três
constantes de `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` e ancorada pelo `CT-1196`.

Enquanto o congelamento valer, **nenhuma versão nova nasce por mudança de rota** — porque não há
mudança de rota. O que ainda pode mover a versão:

- **patch** — correção de esquema que não muda o que o cliente já enviava com sucesso;
- **minor** — campo novo em saída (a saída é aberta por decisão: `.claude/rules/contrato-publicado.md`);
- **major** — só se o congelamento cair, o que exige decisão registrada.

⚠️ Ao subir a versão, suba-a no `package.json` **e** republique. O `CT-1200` reprova `0.0.0`, mas
**não** afirma qual versão é a certa — esse julgamento é humano, e está escrito aqui.
