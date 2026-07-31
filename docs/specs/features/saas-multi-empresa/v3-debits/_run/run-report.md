# Relatório do Run — saas-multi-empresa/v3-debits

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **1/1 task concluída** · oráculo de 6 casos provado nas 3 rodadas · suíte do app não executada (justificado — o diff não toca código do app) · sem análise estática disponível no host

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Fechar o `exit 1` do teardown e localizar o diagnóstico do corpo | sonnet | 1 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado (severidade baixa não bloqueia). Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/saas-multi-empresa/v3-debits/`.

### D1 · baixo · error_handling · T1 · QA
- **Onde:** `deploy/scripts/portao_orfaos.py:421`
- **Problema:** a guarda de `frames` vazio monta a mensagem de invalidação com `getattr(sys, 'tracebacklimit', 'ausente')!r` dentro de uma f-string, sem proteção. Se o `__repr__` do valor levantar, a conversão `!r` propaga para fora do `except`, atravessa o `finally` (que só protege `frappe.destroy()`) e o processo sai **1 sem `PORTAO_VEREDITO`**.
- **Impacto:** é o mesmo modo de falha do D-003 e do CRÍTICO da rodada 2, num **terceiro** ponto do mesmo arquivo. Calibrado baixo porque exige composição adversarial — `tracebacklimit` precisa ser um objeto não-inteiro **com** repr quebrado, **e** a lista de frames precisa estar vazia. Sem caminho operacional plausível na stack atual (nada seta `sys.tracebacklimit`).
- **O que fazer:** pré-computar a representação fora da f-string, protegida: `try: _tbl_repr = repr(getattr(sys, 'tracebacklimit', 'ausente'))` / `except Exception: _tbl_repr = '<repr indisponivel>'`, e referenciar a variável na mensagem.

### D2 · BAIXO · architecture · T1 · Tech Review
- **Onde:** `deploy/scripts/portao_orfaos.py` — bloco `if __name__ == "__main__":`
- **Problema:** o arquivo já teve a **mesma classe** de falha corrigida três vezes ponto a ponto (D-003 original, o `IndexError` do fallback na rodada 2, e o D1 acima). O Tech Review mediu um **quarto ponto latente**, não coberto por nenhum caso do oráculo: o `except` do teardown imprime `str(e)[:160]` — se `str(e)` levantar (um `__str__` quebrado), a própria impressão propaga, sai do `finally` sem imprimir nada e o processo termina 1 sem veredito.
- **Impacto:** enquanto a defesa for ponto a ponto, cada rodada de gate encontra o próximo ponto não coberto — foi o que consumiu 2 das 3 rodadas desta task. O padrão se repete desde o D-010 da v2-debits.
- **O que fazer:** acrescentar um safety-net **aditivo** (não substitutivo) em `if __name__ == "__main__":` — envolver `sys.exit(main())` num `try/except Exception` que imprime `PORTAO_VEREDITO: RODADA_INVALIDA` e sai `2`. O Tech Review **verificou** que isso não conflita com o invariante do D-003: o `try/except` interno do `finally` já intercepta a falha de teardown dentro de `main()` e devolve o veredito original sem propagar, então o wrapper nunca a vê — ele só atua sobre exceções que hoje escapam de toda a lógica interna, convertendo `exit 1` silencioso em `exit 2` com veredito. Fecha a categoria inteira em vez de aguardar o quinto ponto.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

**Duas das três rejeições foram defeitos introduzidos pelo próprio fix**, e as duas eram da classe que esta feature vem repetindo — afirmação sobre comportamento que a medição refuta:

1. **Rodada 1 (ALTO)** — o comentário afirmava que o `filename` do traceback "vira sempre `<stdin>`". Quando a exceção nasce no framework, o frame mais interno fica em `pymysql/err.py`, e a mensagem reportava `em linha 143` sem dizer de qual arquivo. **A linha 143 do `portao_orfaos.py` é uma frase do docstring** — apontava linha real do arquivo errado, o que é pior que não ter localização.
2. **Rodada 2 (CRÍTICO)** — o fallback `else frames[-1]` levantava `IndexError` quando `sys.tracebacklimit <= 0`, porque `traceback.extract_tb()` consulta esse global quando o `limit` é omitido. Reintroduzia exit 1 sem veredito, exatamente a classe que a task existe para fechar. Aqui a variação foi nova: **não era afirmação falsa, era omissão** — o comentário apresentava o fallback como seguro sem declarar a suposição de que `frames` nunca é vazio.

**O executor corrigiu uma premissa do orquestrador com medição, e isso aumentou a gravidade do débito.** A descrição do D-003 (escrita por mim) dizia que o defeito produzia exit 1 *"sem nenhum `PORTAO_VEREDITO`"*. Falso: o veredito **é** impresso, porque o CPython faz flush do stdio na finalização. O defeito é **só** o exit code — e isso é pior, porque o docstring do arquivo instrui *"códigos de saída são o veredito — não confie só no texto"*. Uma automação que **obedeça** o contrato publicado é enganada; só quem o desobedece escapa.

**Três medições dos gates que ninguém tinha feito e que valem além desta task:**
- `traceback.extract_tb()` **consulta `sys.tracebacklimit`** quando o `limit` é omitido, e devolve `[]` com o global em `0` ou negativo. Passar `limit` explícito faz a stdlib ignorar o global.
- `extract_tb` com limite **positivo** pega os frames **mais externos**, não os mais internos — contra-intuitivo, e significa que truncar perderia justamente a "origem" que o código quer reportar.
- `extract_tb(None, limit=...)` devolve `[]` **independente do limit** — foi isso que provou que a guarda é alcançável, e não defesa morta.

**Divergência de severidade registrada:** o QA classificou como `CRITICO` o achado da rodada 2. Confirmei por grep em `apps/` e `site-packages/` que **nada na stack seta `sys.tracebacklimit`** — o caminho exige um ator externo mutando estado global num script CLI de processo próprio. Minha leitura era `ALTO`. A diferença não muda o fluxo (as duas classes bloqueiam) e o fix eram duas linhas, então não gastei tentativa discutindo — mas fica registrado para quem ler não calibrar risco pela palavra errada.

**A prova de não-regressão foi invertida em relação à `v2-debits`, de propósito.** Lá as mudanças eram de prosa e a prova era o hash da AST **sem** o docstring (mostrando que o código não mudava). Aqui a mudança é de código, então a prova é o hash **do docstring isolado**. Ele ficou byte-idêntico (`fd8874e9433063970f161cce45a0f332`, 195 linhas) nas três rodadas — os dois débitos de prosa deste mesmo arquivo, excluídos por decisão do usuário, não foram tocados nem por acidente nem por "aproveitar que já estou aqui".

**Sinal de atenção medido pelo Tech Review:** a proporção comentário:código deste arquivo continua subindo — era 0,98:1 antes da `v2-debits`, foi a 1,49:1 depois dela, e o diff desta versão acrescentou 45 linhas de comentário para 23 de código (~1,96:1 no diff). Ele julgou que **ainda não é ata de reunião** — não há duplicação entre os parágrafos, cada um cobre uma causa distinta que custou uma rodada de gate — mas registrou que, se o arquivo receber mais uma rodada de correção, vale consolidar a justificativa histórica apontando para o run-report em vez de re-derivá-la inline.
