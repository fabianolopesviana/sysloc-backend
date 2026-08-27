# TASK PLAN – MiniSpec

## 1. Identificação
- **Feature**: `publicacao-e-backup`
- **Intent**: `docs/specs/features/publicacao-e-backup/v1/intent.md`
- **Scope**: `docs/specs/features/publicacao-e-backup/v1/scope.md`
- **Responsável**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-25
- **Status**: Concluído

---

## 2. Objetivo Técnico

Tornar o produto **alcançável** pelo aplicativo do cliente, **recuperável** por cópia diária com restauração provada em base vazia, e **capaz de trabalhar sozinho** — instalando no servidor as 6 Rotinas agendadas que o repositório entrega e que hoje não existem lá. No mesmo movimento, fechar os cinco débitos que aguardavam a publicação, sob a política já decidida na ADR-0037.

**Nada da superfície muda**: as âncoras `106 / 91 / 20` saem intactas.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 — Linha de base**
  - Objetivo: medir o estado **antes** de qualquer edição (P1 do Protocolo Antirregressão) e resolver, na mesma janela, as quatro dúvidas do discovery.
  - Tasks: T1
- **Fase 2 — Preservação**
  - Objetivo: a cópia existe, os segredos ficam em pacote separado (ADR-0032), a restauração é **provada**, e uma bateria prova tudo isso. **Vem antes da publicação — a ordem inversa é irreversível.**
  - Tasks: T2, T3, T4, T5
- **Fase 3 — Convergência do host**
  - Objetivo: o servidor passa a executar o que o repositório entrega.
  - Tasks: T6
- **Fase 4 — Origem confiável e eixo**
  - Objetivo: a conferência de origem passa a comparar com as origens públicas reais, e o eixo de origem passa a existir.
  - Tasks: T7, T8
- **Fase 5 — Bordas públicas**
  - Objetivo: o app do cliente alcança o produto; a entrada de fato de terceiro ganha a proteção que a ADR-0037 decide.
  - Tasks: T9, T10
- **Fase 6 — Fecho**
  - Objetivo: comparação caso a caso contra a linha de base (P5) e escrituração conferida nos dois sentidos.
  - Tasks: T11

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|-------------|---------|------|-------------|------------------------------------|--------|
| T1 | Linha de base assistida | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | Cópia, preservação de segredos **e a bateria** | [T2](tasks/T2.md) | 2 | T1 | Não | Concluído |
| T3 | Restauração em base vazia | [T3](tasks/T3.md) | 2 | T2 | Não | Concluído |
| T4 | Unidades da cópia diária e roster | [T4](tasks/T4.md) | 2 | T2, T3 | Não | Concluído |
| T5 | Fecho da bateria e do `D9` (esqueleto) | [T5](tasks/T5.md) | 2 | T2, T3, T4 | Não | Concluído |
| T6 | Instalar o roster completo + bateria de unidades | [T6](tasks/T6.md) | 3 | T5 | Não | Concluído |
| T7 | Origens públicas como lista (fecha `D23`) | [T7](tasks/T7.md) | 4 | T1 | Não | Concluído |
| T8 | Eixo de origem (fecha `D27 · F1/T6`) | [T8](tasks/T8.md) | 4 | T7 | Não | Concluído |
| T9 | Borda pública do app (fecha `D24`) | [T9](tasks/T9.md) | 5 | T5, T7, T8 | Não | Concluído |
| T10 | Proteção da entrada de terceiro (fecha `D27 · F4/T11`) | [T10](tasks/T10.md) | 5 | T1 | Não | Concluído |
| T11 | Fecho: comparação e escrituração | [T11](tasks/T11.md) | 6 | T6, T9, T10 | Não | Concluído |

> ⚠️ **Toda a coluna é `Não`, e isso foi DERIVADO — não é conservadorismo preguiçoso.** Aplicando o
> Invariante de Paralelismo às tasks da mesma fase: T2→T3→T4→T5 formam cadeia de dependência direta;
> T8 depende de T7; T1, T6 e T11 estão sozinhas na fase.
>
> **O único par que passaria em três dos quatro testes é T9 × T10** — independentes no grafo, símbolos
> disjuntos, e nenhuma depende da outra. Elas reprovam no **quarto**: as duas tocam o `CLAUDE.md`,
> que é arquivo de alta contenção (o índice de débitos), porque cada uma fecha um débito e a §3-B do
> Protocolo Antirregressão manda remover **marcador e linha do índice no mesmo movimento**. Mover a
> escrituração do índice para T11 as liberaria — e foi recusado: índice que fica mentindo entre duas
> tasks é exatamente a falha que a §3-B descreve.

---

## 5. Ordem de Execução

```
T1
 └─> T2 -> T3 -> T4 -> T5 -> T6 ──────────┐
      │                                    │
      └─(T1)─> T7 -> T8 -> T9 -> T10 ──────┴─> T11
```

### Grafo de Dependências

| Task | Depende de | Status |
|------|------------|--------|
| T1 | — | Concluído |
| T2 | T1 | Concluído |
| T3 | T2 | Concluído |
| T4 | T2, T3 | Concluído |
| T5 | T2, T3, T4 | Concluído |
| T6 | T5 | Concluído |
| T7 | T1 | Concluído |
| T8 | T7 | Concluído |
| T9 | T5, T7, T8 | Concluído |
| T10 | T1 | Concluído |
| T11 | T6, T9, T10 | Concluído |

---

## 6. Arquivos / Áreas Impactadas (visão consolidada)

| Área | Arquivos | Ação |
|------|----------|------|
| `deploy/scripts/backup/` | `copiar-base.sh`, `preservar-segredos.sh`, `verificar-backup.sh` (T2) · `restaurar-base.sh` (T3) | criar |
| `deploy/scripts/verificacao/` | `esqueleto-de-assercao.sh` (fecha o `D9`) | criar |
| `deploy/scripts/*/` | as **11 baterias existentes** — passam a carregar o esqueleto por `source` | modificar |
| `packages/shared/test/` | `unidades-agendadas.spec.ts` — 3 predicados cegos ao prefixo | modificar |
| `deploy/systemd/` | `sysloc-backup-da-base.service`, `sysloc-backup-da-base.timer` | criar |
| `deploy/nginx/` | `sysloc-app.conf` | criar |
| `deploy/nginx/` | `sysloc-notificacao-bancaria.conf` | modificar |
| `deploy/scripts/borda/` | `instalar-borda-do-app.sh`, `verificar-borda-do-app.sh` | criar |
| `deploy/scripts/instalacao/` | `verificar-unidades-agendadas.sh` | criar |
| `deploy/scripts/borda/` | `verificar-notificacao-bancaria.sh` | modificar |
| `deploy/scripts/instalacao/` | `instalar-unidades.sh`, `verificar-provisionamento.sh` | modificar |
| `apps/api/src/` | `configuracao/ambiente.ts`, `autenticacao/autenticacao.module.ts`, `main.ts` | modificar |
| `apps/api/test/` | `origem-publica.e2e.spec.ts` | criar |
| `apps/api/test/` | `ambiente.spec.ts` | modificar |
| `packages/auth/` | `src/autenticacao.ts`, `test/bloqueio.spec.ts` | modificar |
| **fora da árvore versionada** | `/opt/web/syslocadmin/nginx/default.conf` (remoção do paliativo) | modificar |
| raiz | `CLAUDE.md` | modificar |
| `_run/` | `linha-de-base.md`, `convergencia-do-host.md`, `comparacao-final.md` | criar |

> **Legenda de Ações:** `criar` | `modificar` | `remover`
>
> ⚠️ **NÃO ALTERAR**: `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` (a âncora de superfície),
> `deploy/scripts/verificacao/rodar-baterias.sh` (descobre as baterias novas sozinho) e
> `deploy/scripts/instalacao/verificar-fundacao.sh` (consulta `/docs` e `/docs/json` literais).

---

## 7. Critérios de Conclusão Geral

- [x] Todas as 11 tasks concluídas e aprovadas nos gates declarados
- [x] Um pedido de dados ao endereço público do app devolve **dado**, com o **tipo do conteúdo** asserido — `CT-1180` e seguintes, em `verificar-borda-do-app.sh` (194 asserções, 12/12)
- [x] Uma **restauração foi executada e conferida** em base vazia — T3, provada por caso
- [x] Cópia e segredos preservados em **pacotes separados** (ADR-0032), afirmado por medição — T2
- [ ] As **6 Rotinas agendadas** instaladas, habilitadas e sobrevivendo a reinício — ⚠️ **PENDENTE DE JANELA ASSISTIDA (a)**: as 6 Rotinas já estão no host, mas as **2 unidades do backup** exigem `sudo bash deploy/scripts/instalacao/instalar-unidades.sh`, e o invariante 7 exige `sudo systemctl reboot`. `sudo -n` falha neste host e nenhum agente digita senha
- [x] Duas origens distintas consomem **baldes distintos** do limitador — T8, o eixo de origem
- [x] Rajada legítima do provedor **não** é recusada — `CT-1191`, 30 requisições consecutivas do mesmo endereço, códigos distintos = `["204"]`, `0` de `503`, `0` de `429`
- [x] Superfície em **106 / 91 / 20**, suíte verde com contagem igual ou maior — **1987** (era 1968), os 9 pacotes medidos um a um, nenhum encolheu. A superfície é agora **ancorada por caso** (`CT-1196`), o que não existia antes desta fatia
- [x] **Baterias executadas nos dois extremos, com a contagem obtida por DESCOBERTA** — **14** por `find`, afirmadas por igualdade de conjunto. **11 executadas** (0 FALHA, 1225 asserções OK); **3 privilegiadas** degradaram declarando, com `sudo -n true` medido a devolver `sudo: a password is required`
- [x] Os débitos fechados saíram do código **e** do índice, conferidos nos dois sentidos — ⚠️ **foram SEIS, não cinco**: o `D39 · F7/T8` faltava na conta da spec. Índice em **38** linhas (`39` marcadores menos a fixture `D99 · F7/T3`), e os **dois homônimos sobreviventes** (`D23 · F0/T3`, `D26 · F3/T8`) medem `1` e `1` — é o que discrimina o fecho **por par** do fecho **por número**
- [x] O destino do e-mail é **afirmado por caso** — `CT-1152` e `CT-1189`. ⚠️ As duas asserções são **contraditórias por construção** e é isso que o `D41 · F7/T9` registra: hoje passam por motivos assimétricos (uma medindo, outra degradando), e se movem juntas quando o operador trocar o `SMTP_URL`

> **10 de 11 critérios atendidos e verificados.** O único em aberto — as 2 unidades do backup e o reinício —
> **não é defeito**: é a janela assistida (a), que exige o usuário presente porque `sudo -n` falha neste host.
> O roteiro literal, comando a comando, está em `_run/convergencia-do-host.md` §4 e em `_run/comparacao-final.md` §8.

---

## 8. Notas para a LLM Executora

1. **Protocolo Antirregressão é pré-condição de toda edição** (`.claude/rules/nao-regressao.md`). As três linhas antes de cada edição — `CAUSA-RAIZ:`, `POR QUE ISTO FECHA A CLASSE:`, `O QUE ESTA MUDANÇA REMOVE:` — não são opcionais. Não conseguiu escrever a segunda com convicção? O diagnóstico não está pronto: **não edite**.
2. **A ordem entre as fases 2 e 5 é questão de segurança**, não de conveniência: preservação antes de publicação. **Não a inverta** nem "adiante" a borda porque é mais rápido.
3. **`packages/auth/src/autenticacao.ts` tem duas `DECISÃO FECHADA`**. O marcador do `D27` declara que não as alcança. Se a sua correção exigir tocá-las, **PARE e escale**.
4. **Alterar `CT-236 (c)` exige a linha `SUT_IS_CORRECT_BECAUSE:`** — o caso está certo para o regime de hoje. Sem a linha, é fraude de gate.
5. **Meça por pacote** (`pnpm --filter @sysloc/<p> test`). O agregador do monorepo aborta os pacotes irmãos e a saída agregada não é confiável.
6. **Toda asserção sobre a borda afirma o tipo do conteúdo**, nunca só o código de resposta: o modo de falhar medido é `200` com o corpo errado.
7. **Asserção estática exige prova de falsificação** com mutante plantado em `mktemp -d` — nunca na árvore de trabalho. Asserção comportamental **não** se falsifica por execução; declara-se qual asserção discrimina.
8. **Nenhum caso pode disparar e-mail real.** E a **ordem dentro da T6 é irreversível**: afirmar o destino → uma passada controlada com os relógios **parados** → só então habilitá-los.
9. **A bateria do backup NASCE na T2**, não na T5 — senão T2 e T3 fechariam **sem rede permanente**, contra o P4. A T3 a estende; a T5 a completa e **extrai o esqueleto** que fecha o `D9`. As duas baterias posteriores (borda e unidades) **consomem** o esqueleto; escrevê-las como cópias reabriria o débito.
10. **Três predicados do acessório de teste de unidades são CEGOS** ao prefixo de rotina e não alcançam as unidades do backup. Corrigi-los é **pré-condição** de acrescentar as unidades ao roster — sem isso, o critério da T4 fica sem rede. O destino atual é um capturador de desenvolvimento, e essa é uma decisão registrada desta fatia (scope §5.9), não um defeito a corrigir aqui.
11. **A premissa que sustenta a fatia**: *o cliente não usa o sistema antigo*. Se ela cair, **PARE e escale**.
12. **Nada de frontend.** Nenhuma linha de código do aplicativo, nenhum arquivo na máquina local do usuário — é gatilho de parada.
