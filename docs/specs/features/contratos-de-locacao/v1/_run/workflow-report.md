# Workflow report — contratos-de-locacao/v1

> Telemetria de pipeline, append-only. O relatório humano é o `_run/run-report.md`.

## Challenge Session — 2026-08-08 (artifact: tech_spec.md)

- Questões processadas: 6 (5 com decisão do usuário, 1 resolvida por leitura do código)
- Conflitos de terminologia resolvidos: 2
  - `Contador sequencial` — o glossário canoniza o contador do boleto, que **nunca reinicia**; a fatia introduz o contador da série do contrato, que **reinicia a cada ano**. Dois conceitos incompatíveis sob o mesmo nome canônico.
  - `Carteira` — dois sentidos já em uso (a árvore conjunto→imóvel em `lerCarteira`/`carteira.e2e.spec.ts`; a lista de contratos no PRD), nenhum canonizado.
- Contradições com código real: 1 (**alta**)
  - `alterarImovel` (`packages/db/src/imovel.ts:624`) escreve `status_locacao` incondicionalmente, e o corpo de entrada não aceita `LOCADO` — toda alteração de imóvel locado apagaria o `LOCADO` em silêncio, produzindo `statusLocacao: 'DISPONIVEL'` ao lado de `contratoVigente` preenchido na mesma resposta.
- Divergências spec × ADR resolvidas: 1
  - A correção acima exige rota própria (ADR-0019), mas **não há ação sensível** para ela no catálogo fechado. Resolvido por decisão do usuário: a rota exige só `TELA:imoveis` e a **leitura fica declarada** em §4.1.2 como interpretação, não como conformidade literal. A saída rigorosa (emendar a `Decision` da ADR-0019) fica nomeada.
- Decisões implícitas explicitadas: 2
  - `INDISPONIVEL` **não** impede a ativação — o sistema antigo não confere `status_locacao` em `ativar_imovel_contrato`, e acrescentar a recusa seria condição de entrada nova, contra a RN-08. A assimetria com a rota de situação é intencional e ficou escrita.
  - A rota de §4.1.2 **não se mapeia a nenhuma US** — é trabalho de invariante, não de escopo novo. Declarado na §17 para não ser lido como overengineering.
- Inconsistências internas corrigidas: 2
  - §3.4 listava quatro arquivos de teste E2E que a §19 não conhece; reconciliado para `apps/api/test/contratos.e2e.spec.ts` mais as suítes estendidas.
  - §3.4 listava `contador-de-contrato.spec.ts`, que a §19 não usa (os casos do contador vivem em `contrato.spec.ts`); removido, e `papel-de-conexao.spec.ts` acrescentado como `[M]` por causa do CT-431.
- Termos canonizados no glossário: 7, todos no **global** (21 → 28 termos)
  - `Contrato de locação`, `Rascunho`, `Ativação de contrato`, `Cancelamento de contrato`, `Contrato vigente`, `Série declarada`, `Carteira`
  - `Contador sequencial` teve a definição **restringida** ao caso bancário
  - 5 ambiguidades acrescentadas; 7 relacionamentos acrescentados
  - Glossário-feature **não criado** — nasceria vazio, os sete termos são cross-feature
- Candidatos a ADR sinalizados: 1
  - *"Estado de negócio nunca é escrito por atualização do recurso — nem quando não há ação sensível para ele"* — **5/5 critérios**, registrado na §21 como **confirmado e adiado por decisão do usuário**. A saída certa não é ADR nova: é emendar a `Decision` da ADR-0019.
- ADRs sugeridos para criação: 0 (a emenda da 0019 foi oferecida e adiada)

### Impacto no artefato

- Ajustes inline: 17, em 11 seções (§3.4, §3.6, §4.1, §4.1.1, §4.1.2 nova, §4.2, §6.3, §11.2, §17, §19, §20, §21)
- Superfície publicada revisada: **9 rotas novas** (era 8) · manipuladores 51 → **60** · `rotasEnumeradas` 66 → **77**
- Casos de teste: 33 → **34** (CT-434, acréscimo do challenge)

### Divergência conhecida a reconciliar no task-plan

`_run/test-cases.json` tem **33** casos e a §19 do `tech_spec.md` tem **34** — o CT-434 nasceu nesta sessão e a skill de challenge **não pode escrever** naquele arquivo (guardrail: só o artefato, os dois glossários, este relatório e `steps.validation` do estado). O `agent-spec-sdd-generate-task-plan` deve tomar a **§19 do tech_spec como canônica** e acrescentar o CT-434 ao distribuir, ou re-disparar o gerador.
