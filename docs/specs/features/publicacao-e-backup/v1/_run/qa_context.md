# QA Context — publicacao-e-backup/v1

> Gerado em 2026-08-25 a partir de `intent.md` + `scope.md` (pós-challenge). Se o `scope.md` for
> editado após esta data, este arquivo está STALE — regenere-o ou consulte INTENT/SCOPE direto.

## Stack de teste (medida, não suposta)

- **Vitest** + **embedded-postgres** (Postgres real e efêmero). 9 pacotes, **1943 casos verdes**.
- Rodar por pacote: `pnpm --filter @sysloc/<p> test`. ⚠️ `turbo run test` aborta pacotes irmãos — saída agregada não é confiável.
- **Convenção obrigatória**: `CA-xx → CT-xxx (RN-xx)`, com seção INVARIANTES por arquivo. IDs `CT-` são globais e sequenciais no repositório — o maior hoje é **CT-1097**, logo os novos começam em **CT-1098**.
- **Duas frentes** (`.claude/rules/testing-stack.md`): Vitest para o que o processo observa; **shell** para o que só é observável inspecionando SO, git ou filesystem (`deploy/scripts/*/verificar-*.sh`).
- **Prova de falsificação OBRIGATÓRIA** para asserção **estática** (que inspeciona texto do código): a mesma função roda sobre o alvo real (controle) e sobre um mutante plantado em `mktemp -d`, onde precisa reprovar. Asserção **comportamental** NÃO se falsifica por execução — declara-se qual asserção discrimina.
- **Mutation testing está FORA da stack** por decisão registrada (2026-08-16).
- Agregador de baterias: `deploy/scripts/verificacao/rodar-baterias.sh` — descobre por `find deploy/scripts -name 'verificar-*.sh'` (**bateria fora de `deploy/scripts/` é invisível a ele**).

## Critérios de aceite (do SCOPE §4)

CA-01 borda devolve dado com **tipo de conteúdo** asserido (o modo de falhar medido é `200` com corpo errado) · CA-02 origem pública aceita e origem estranha recusada, **sem tradução de origem** · CA-03 cópia diária automática que sobrevive a reinício · CA-04 expurgo **por idade** (dois órfãos de idades opostas) · CA-05 **restauração executada e conferida** em base vazia · CA-06 segredos em pacote **separado** do dump (ADR-0032) · CA-07 6 Rotinas agendadas instaladas, igualdade de conjunto nos dois sentidos · CA-08 unidade do worker declara dependência do banco; sobe após reinício · CA-09 **duas origens consomem baldes distintos** do limitador · CA-10 entrada de terceiro **não recusada por taxa** sob rajada · CA-11 `/docs*` inalcançável de fora, por medição contra a borda · CA-12 nada regrediu (superfície `106/91/20`, suíte verde, 11 baterias executadas) · CA-13 marcadores de débito saem do código **e** do índice, conferidos nos dois sentidos · CA-14 **destino do e-mail afirmado por um caso**.

## Decisões do SCOPE que as tasks herdam

1. **Superfície CONGELADA** — nada nasce, muda ou sai. `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` **não se altera**; `ROTAS_PUBLICADAS_EM_PRODUCAO=106`, `MANIPULADORES_EXAMINADOS_EM_PRODUCAO=91`, `PARES_PUBLICOS_DA_SUPERFICIE=20`.
2. **Ordem de segurança**: preservação **antes** de publicação. A inversa é irreversível.
3. **ADR-0032** — a chave de cifra NÃO vive no mesmo pacote em que o material cifrado é salvaguardado. Provado **por medição do conteúdo de cada pacote**, nunca por leitura de código.
4. **ADR-0006** — a verificação nunca roda contra o ambiente que atende a operação: restauração em base **vazia e efêmera**, jamais na durável.
5. **ADR-0037** — a borda dá o **eixo de origem**, a política fica na aplicação, e a entrada de fato de terceiro **não tem teto de taxa**.
6. **ADR-0005** — script executável de produção vive no repositório, instalado por procedimento idempotente, **sem credencial versionada**.
7. **Origem pública é LISTA** — dois aplicativos na mesma API; `origin-check.mjs` usa `Array.isArray` + `.some()`.
8. **`/docs*` restringe-se na BORDA** — na aplicação derrubaria a âncora (8 rotas `GET /docs*` contam nas 106) e reprovaria `verificar-fundacao.sh`, que consulta `/docs` e `/docs/json` literais.
9. **Expurgo decide por IDADE, nunca por nome** — molde provado no `CT-1087 (f)`.
10. **Papel de banco é objeto do agrupamento, não da base** — a cópia não o carrega; restauração provada em base vazia do **mesmo** agrupamento.

## Componentes (nome → responsabilidade em 1 linha)

- `copiar-base.sh` — produz a cópia do banco, confere integridade, expurga por idade.
- `preservar-segredos.sh` — empacota segredos **sem** a chave de cifra (ADR-0032).
- `restaurar-base.sh` — restaura em base vazia, com ensaio e confirmação explícita.
- `verificar-backup.sh` — bateria shell: frescor, integridade, expurgo por idade, separação dos pacotes, restauração de fato executada. **Fecha o `D9 · F0/T2`**.
- `sysloc-backup-da-base.{service,timer}` — relógio da janela noturna, `Persistent=true`.
- `instalar-unidades.sh` — roster declarado; `CT-1060` afirma igualdade **nos dois sentidos** entre `deploy/systemd/*` e `UNIDADES`.
- `sysloc-app.conf` + `instalar-borda-do-app.sh` + `verificar-borda-do-app.sh` — borda pública do app: `location /v1/` **antes** do fallback, salto real declarado, `/docs*` não publicado, `Set-Cookie` intacto.
- `ambiente.ts` / `autenticacao.module.ts` — lista de origens públicas conferida na partida; origem confiável deixa de derivar do endereço de escuta (**fecha `D23`**).
- `packages/auth/src/autenticacao.ts` — declara o salto confiável; o eixo de origem passa a existir (**fecha `D27 · F1/T6`**).

## Paths relevantes

- Criar: `deploy/scripts/backup/{copiar-base,preservar-segredos,restaurar-base,verificar-backup}.sh` · `deploy/systemd/sysloc-backup-da-base.{service,timer}` · `deploy/nginx/sysloc-app.conf` · `deploy/scripts/borda/{instalar-borda-do-app,verificar-borda-do-app}.sh` · `apps/api/test/origem-publica.e2e.spec.ts`
- Modificar: `deploy/scripts/instalacao/instalar-unidades.sh` · `deploy/nginx/sysloc-notificacao-bancaria.conf` · `apps/api/src/configuracao/ambiente.ts` · `apps/api/src/autenticacao/autenticacao.module.ts` · `apps/api/src/main.ts` (só remove marcador) · `packages/auth/src/autenticacao.ts` · `packages/auth/test/bloqueio.spec.ts` (CT-236 (c) — exige `SUT_IS_CORRECT_BECAUSE:`) · `apps/api/test/ambiente.spec.ts` · `CLAUDE.md`
- Referência (NÃO alterar): `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` · `deploy/scripts/verificacao/rodar-baterias.sh` · `deploy/scripts/instalacao/verificar-fundacao.sh`

## Restrições que mordem o desenho dos casos

- **`sudo -n` FALHA neste host** — 3 das 11 baterias exigem privilégio (critério `exigir_privilegio|EUID -ne 0`). Caso que exige privilégio DEVE declarar `precondicao_privilegiada`.
- **`packages/auth/src/autenticacao.ts` tem duas `DECISÃO FECHADA`** — intocáveis; o marcador do `D27` declara que não as alcança.
- **Efeito externo é irreversível** — o SMTP de produção aponta hoje para um capturador de desenvolvimento (`smtp://127.0.0.1:1025`), e a Tentativa de envio registraria `Desfecho=entregue`. Nenhum caso pode disparar e-mail real.
- **Nenhuma migração, nenhuma tabela, nenhuma rota** — quem propuser caso que altere schema ou superfície está fora do escopo.
