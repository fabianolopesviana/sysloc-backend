# INTENT — Cleanup de Débitos · saas-multi-empresa · v3-debits

## 1. Identificação

- **Feature**: saas-multi-empresa
- **Versão**: v3-debits
- **Versão pai**: v2-debits
- **Variante**: backend (herdada de v1 → v2-debits)
- **Origem**: gerado por `/agent-spec-debt-resolution` em 2026-07-30
- **Fonte dos débitos**: `docs/specs/features/saas-multi-empresa/v2-debits/_run/run-report.md` §2

---

## 2. Objetivo

Fechar os **2 débitos de código** que sobraram da `v2-debits`, ambos no bloco `except`/`finally` de `main()` em `deploy/scripts/portao_orfaos.py`.

**Zero feature nova. Zero mudança de prosa.** Esta versão existe para corrigir comportamento, não texto — e essa distinção é o critério que a gerou.

---

## 3. Por que só estes dois, de seis

A `v2-debits` gerou **6 débitos**, todos de severidade baixa. O especialista os separou por uma linha que se provou decisiva na versão anterior: **código vs prosa**.

A `v2-debits` custou **9 rejeições de gate em 4 tasks** — todas de **prosa**. Nas tasks T2 e T3, o código foi aprovado na primeira rodada e ficou byte-inalterado até o fim (provado por hash da AST em cada rodada); o que reprovou, cinco vezes, foram afirmações técnicas sobre o comportamento do framework que não se sustentavam na medição.

Logo: nestes dois arquivos de gate, **"é só mudar um comentário" não é barato**. Os 4 débitos de prosa ficaram fora por custo/risco desproporcional ao ganho — e um deles (`D-005`) recebeu `risco_regressao: medio` justamente porque reformular um texto que levou 3 rodadas para ficar preciso arrisca introduzir uma imprecisão nova.

Os 2 selecionados são **código**, escapam dessa penalidade, e um deles pode **flipar o código de saída do portão**.

---

## 4. Débitos selecionados

| ID (v2-debits) | Severidade | Categoria | Onde | O que é |
|---|---|---|---|---|
| **D-003** | BAIXO | `error_handling` | `deploy/scripts/portao_orfaos.py:388` | Exceção em `frappe.destroy()` dentro do `finally` descarta o valor de retorno e propaga → o Python sai **1**, o código **contratualmente** reservado ao VERMELHO, **sem nenhum `PORTAO_VEREDITO`** na saída |
| **D-006** | BAIXO | `error_handling` | `deploy/scripts/portao_orfaos.py:383` | O `except Exception` do corpo registra só `type(e).__name__` e `str(e)[:160]`, sem localização — e o corpo que ele protege tem ~130 linhas |

Os dois vivem nas **mesmas linhas** (383-389). Foram agrupados numa **única task** por decisão explícita do usuário: o gate revisa o diff do arquivo inteiro de uma vez, então duas tasks separadas pagariam dois ciclos de gate pelo mesmo diff.

---

## 5. Por que o D-003 importa mais do que a severidade sugere

`portao_orfaos.py` roda **antes** de um `bench migrate` que pode apagar a definição de DocTypes de produção — `Imovel` (22 registros), `Locatario` (24), `Contrato` (1). Quando isso acontece, **só a definição some**: a tabela física e as linhas sobrevivem como órfãs, mas list view, API `resource/`, permissões e relatórios desaparecem.

O portão responde por **código de saída**, e os três têm significado contratual:

| Exit | Significado |
|---|---|
| 0 | VERDE — nenhum DocType seria apagado |
| 1 | VERMELHO — há DocType que o migrate apagaria; **NÃO migre** |
| 2 | RODADA_INVALIDA — o portão não pode afirmar nada |

O D-003 é um caminho pelo qual o script sai **1** sem ter concluído nada — "achei um problema" quando a verdade é "não consegui terminar". É **exatamente o modo de falha que a `v2-debits` acabou de fechar** no corpo do mesmo arquivo (o débito `D-010` da v1), num caminho que a correção não cobriu porque a §6 daquela task proibia resolver débito não listado.

É a segunda metade de uma correção que ficou pela metade.

---

## 6. Quem consome o artefato

- **T2 e T3 da v1** — as duas tasks que vão rodar `bench migrate` sobre a estrutura de dados real. O portão é o gate que as autoriza.
- **CI futura** — o script foi promovido a arquivo versionado exatamente para poder ser invocado por automação.

---

## 7. Fora do escopo

Os **4 débitos de prosa** não selecionados seguem anotados na §2 do `_run/run-report.md` da `v2-debits`, com `file:linha` e fix sugerido. Ver `scope.md` §2 desta versão para o registro de auditoria.

Nada de prosa é tocado nesta versão. Nenhuma seção de docstring é reescrita.
