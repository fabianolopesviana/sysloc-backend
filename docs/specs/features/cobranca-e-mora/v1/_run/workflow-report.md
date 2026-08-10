# Workflow report — cobranca-e-mora/v1

> Telemetria de pipeline (append-only). O relatório humano é o `run-report.md`.

## Challenge Session — 2026-08-09 (artifact: tech_spec.md)

- Questões processadas: 6
- Conflitos de terminologia resolvidos: 1 (campo `objeto` → `tabela` em `ExcecaoDeIsolamento`, CT-523)
- Contradições com o código real corrigidas: 2
  - `catalogo.ts` já cobre a espécie VIEW com `VISAO_NAO_DELEGA_ISOLAMENTO`, `ehVisao`,
    `delegaIsolamento`, `PROPRIEDADES_DA_VISAO`, `propriedadesDe()` e a extração normalizada de
    `security_invoker` — a spec mandava "estender", e a região está sob `DECISÃO FECHADA`
    (T4/Gate 2 · 2026-08-02). Corrigido em 3 pontos (§19 Recomendações, §20 mitigação, §21 ADR-0009).
  - `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` vivem em `contracts/src/contrato.ts` (L163, L193),
    e não em `comum.ts`, que era a única origem que a §3.7 declarava.
- Decisões implícitas explicitadas: 4
  - Fluxo **F** (`POST /v1/cobrancas`): as duas unidades sequenciais do contador estavam escritas
    só para a ativação; a 1ª cobrança do ano pode nascer pela rota avulsa, e
    `proximo_numero_de_cobranca` consome a sequência, nunca a cria.
  - **RD-21**: `GET /v1/multa-e-juros` de empresa sem linha responde 200 com zeros, nunca 404, e não
    cria linha. A rota declarava 200/401/403 sem dizer o que fazia no caso que a §5.2 admite.
  - Fronteira estrita de RD-04 (`<`): registrada como decisão desta fatia, não como porte — o golden
    `marcar-cobrancas-vencidas.json` não tem deslocamento `0`.
  - Origem das constantes monetárias fixada por escrito, com débito com gatilho no 3º consumidor.
- Vãos de cobertura fechados: 1 (as 2 rotas de `/v1/multa-e-juros` não tinham caso de comportamento:
  nem PUT 200, nem faixa/escala, nem `strictObject`, nem upsert, nem GET zerado) → **CT-538** e
  **CT-539**; 37 → 39 casos. Reconciliada a §3.4: 2 arquivos de teste sem CT algum removidos da
  árvore, e cada arquivo restante passou a nomear os CTs que hospeda.
- Termos canonizados no glossário: 8, todos no GLOBAL — Cobrança, Cobrança em aberto, Mora,
  Configuração de mora, Carimbo, Natureza da cobrança, Competência, Referência. Mais 7
  Relacionamentos e 4 Ambiguidades resolvidas. `Cobrança` fechou vão anterior à fatia: já era usada
  em Relacionamentos sem definição na seção Termos.
- Candidatos a ADR sinalizados: 0 novos (os 2 parciais da §21 seguem válidos e inalterados)
- ADRs sugeridos para criação: 0
- Débitos registrados para a §2 do run-report: 1 (constantes monetárias em `contrato.ts`; gatilho no
  3º consumidor monetário do pacote de contratos)
