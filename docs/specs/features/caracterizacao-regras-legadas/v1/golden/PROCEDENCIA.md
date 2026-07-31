# Procedência dos golden — caracterização das regras legadas

> Gerado por `deploy/scripts/caracterizacao/capturar.py`. Não editar à mão: o
> manifesto é reescrito a cada captura e a bijeção entre as máscaras aqui
> declaradas e os marcadores presentes nos golden é verificada por
> `verificar-golden.sh` (CT-014).

## 1. Identificação da captura

| Campo | Valor |
|---|---|
| Data e hora da captura | 2026-07-31T07:18:15 |
| Site de captura | caracterizacao.localhost |
| Dump de origem | sites/frontend/private/backups/20260731_071436-frontend-database.sql.gz |
| Timestamp do dump | 2026-07-31T07:14:43 |
| Versão do app (commit) | 5a4e5197ee1d4e1cd262b6886c054ddf9a0da9b2 |
| Versões do bench | erpnext 15.4.0 · frappe 15.4.0 |

O dump de origem é o único vínculo com o ambiente que atende a operação, e ele
recebeu exclusivamente `bench backup` — comando que produz arquivo e não altera
dado (ADR-0006). Toda a captura executou no site efêmero acima, destruído ao fim
do fluxo.

## 2. Máscaras aplicadas

| Marcador | Artefato | Campo mascarado | Motivo |
|---|---|---|---|
| `<DATA_EXECUCAO>` | `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json`, `atualizar-atrasos-cobrancas.json` | `retorno.data_execucao`; `estado_resultante.*.data_inicio_atraso`; `estado_resultante.*.data_ultima_atualizacao_atraso` | As três rotinas derivam de `nowdate()`. Gravar a data absoluta faria o golden expirar no dia seguinte; o marcador representa o offset zero — o próprio dia da execução. |
| `<DATA_GERACAO_EXTENSO>` | `contrato-pdf.txt` | Data por extenso do fecho do contrato (`DD de MÊS de AAAA`), montada pelo Server Script com `nowdate()` | É o único campo do documento que muda a cada geração. Sem a máscara, a comparação textual acusaria diferença todo dia, onde não há diferença de comportamento. |

Todas as demais datas dos golden das rotinas são gravadas como **offset inteiro
de dias** relativo à data de captura (`vencimento_offset_dias`,
`data_fim_locacao_offset_dias`), nunca como data absoluta. É o que permite à F5
reconstruir o mesmo cenário em qualquer dia.

O texto do contrato é capturado como **texto extraído** do PDF, nunca como bytes:
o binário carrega metadados de geração que variam a cada execução, e a comparação
byte a byte acusaria diferença onde não há. Nenhum byte de PDF é versionado.

## 3. Convenções dos dados sintéticos

- **Nomes fixos.** Todo documento sintético nasce com `name` explícito
  (`IMOVEL-CARACT-*`, `CTR-CARACT-*`, `COB-CARACT-*`). Sem isso o Frappe sortearia
  hash ou consumiria a série de numeração, e duas capturas nunca coincidiriam.
- **Sentinela de metragem.** Cada `Imovel` é salvo com `metragem_total = -1.0`. O
  valor é sobrescrito pelo Server Script no `Before Save`; se a regra não rodasse,
  a sentinela sobreviveria e denunciaria o golden vazio.
- **Metragem nula.** No cenário `varios_comodos_com_metragem_nula` um cômodo é
  informado com `metragem` nula. A coluna é `NOT NULL` no banco e o valor é
  persistido como `0.0` — o golden registra as duas coisas (`comodos_entrada` com
  `null`, `comodos_persistidos` com `0.0`), sem corrigir nenhuma delas.
- **Obrigatoriedade ignorada nos cenários degenerados.** `Imovel` sem cômodo e
  `Contrato` sem imóvel violam campos marcados como obrigatórios na interface.
  Eles são inseridos com `ignore_mandatory` porque são exatamente os caminhos que
  a regra precisa exibir — a validação da tela não faz parte da regra capturada.
- **Isolamento entre as duas rotinas de cobrança.** As cobranças de
  `marcar_cobrancas_vencidas` nascem com `pagamento_confirmado = 1` — campo que
  essa rotina ignora por completo — para que, depois de marcadas `Vencida`, não
  entrem no conjunto de candidatas de `atualizar_atrasos_cobrancas`, capturada em
  seguida no mesmo site.
- **Mora não-zerada no caminho ignorado.** `COB-CARACT-AAC-03` nasce com
  `valor_multa = 7,77` e `valor_juros = 3,33` para que "a rotina não escreveu
  nada" seja uma afirmação verificável, e não a constatação de que os campos
  continuam zerados.

## 4. Observações sobre o comportamento capturado

A referência reflete o comportamento atual do sistema legado, **inclusive
defeitos**. Nenhum resultado foi corrigido, arredondado ou completado.

- **Cenário deliberadamente não coberto:** o caminho
  `ignorado / contrato_sem_name` de `encerrar_contratos_vencidos()` não está no
  golden. `frappe.get_all` sempre devolve `name` preenchido para documento
  existente, então o ramo é inalcançável pelo caminho real; forjá-lo exigiria
  manipular o retorno da consulta e produziria a referência de um comportamento
  que a produção nunca exibe. O caminho irmão,
  `ignorado / contrato_sem_imovel`, está capturado.
- **`_calcular_mora()` foi portado, não re-executado.** Os casos de
  `calcular-mora.json` vêm de
  `locacao_automation/tests/test_cobranca_atraso.py::TestCalcularMora`, que já
  prova a função pura. O golden preserva os 6 casos do teste e as 7 tuplas de
  entrada distintas que eles exercitam — deduplicar por caso perderia a evidência
  de linearidade dos juros e de independência entre juros e multa.
- **A régua de cobrança (`cobranca_automation`) não foi caracterizada.** Ela tem
  efeito colateral de envio de e-mail e ficou fora do escopo desta captura.
