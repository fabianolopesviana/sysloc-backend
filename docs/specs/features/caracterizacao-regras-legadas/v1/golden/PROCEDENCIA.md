# Procedência dos golden — caracterização das regras legadas

> Gerado por `deploy/scripts/caracterizacao/capturar.py`. Não editar à mão: o
> manifesto é reescrito a cada captura e a bijeção entre as máscaras aqui
> declaradas e os marcadores presentes nos golden é verificada por
> `verificar-golden.sh` (CT-014).

## 1. Identificação da captura

| Campo | Valor |
|---|---|
| Data e hora da captura | 2026-08-09T00:50:10 |
| Site de captura | caracterizacao.localhost |
| Dump de origem | sites/frontend/private/backups/20260809_004612-frontend-database.sql.gz |
| Timestamp do dump | 2026-08-09T00:46:19 |
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
| `<PDF_CONTRATO_CODIFICADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato`; `estado_resultante.contratos[].pdf_contrato`; `retorno.retorno.pdf_contrato` | O campo guarda o documento inteiro codificado, com megabytes que mudam a cada geração. O que a regra observa é a PRESENÇA — é ela que libera ou bloqueia o cancelamento —, e é a presença que o marcador preserva; ausência continua gravada como `null`. |
| `<ARQUIVO_PDF_PRIVADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato_arquivo`; `estado_resultante.contratos[].pdf_contrato_arquivo`; `retorno.retorno.pdf_contrato_arquivo` | O caminho do anexo privado carrega identificador sorteado pelo arcabouço a cada gravação, e duas capturas nunca coincidiriam. A troca de `pdf_contrato` por `pdf_contrato_arquivo` é o efeito observável do cancelamento, e o par marcador/`null` a preserva. |

Os dois marcadores acima são nomeados **sem algarismo** de propósito: a bijeção do
`verificar-golden.sh` varre `<[A-Z_]+>`, que não casa dígito, e um nome como
`<PDF_CONTRATO_BASE64>` escaparia da varredura — viraria máscara órfã justamente
no verificador que existe para achar máscara órfã.

Todas as demais datas dos golden das rotinas são gravadas como **offset inteiro
de dias** relativo à data de captura (`vencimento_offset_dias`,
`data_fim_locacao_offset_dias`), nunca como data absoluta. É o que permite à F5
reconstruir o mesmo cenário em qualquer dia. O mesmo vale para
`contrato-cancelamento.json`, que não grava data absoluta nenhuma.

**`contrato-ativacao.json` é a exceção declarada, e ela é o próprio objeto da
captura.** Ali as datas são absolutas porque a derivação
`data_fim_locacao = add_days(add_months(inicio, prazo), -1)` é função pura da data
de início ESCOLHIDA no cenário, e não do relógio: gravar `2027-01-31 + 1 mês` como
offset destruiria exatamente o fato capturado — o ajuste de `add_months` quando o
dia de origem não existe no mês de destino. Nenhuma das datas daquele artefato
deriva de `nowdate()`, então o relógio não o alcança e ele não expira.

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
- **Documento em memória nas frentes puras da ativação.**
  `validar_contrato_para_ativacao` e `montar_dados_cobrancas_contrato` apenas leem
  o documento e não tocam o banco. Os cenários dessas duas frentes usam um
  `Contrato` montado em memória e **não inserido**: inserir trinta contratos
  degenerados — sem data de início, sem locatário — acrescentaria o Server Script
  de PDF ao caminho e deixaria estado inválido no site, sem que a regra capturada
  ganhasse nada. As frentes que escrevem (`ativar_imovel_contrato`,
  `ativar_contrato`, `cancelar_contrato`) usam documentos persistidos, e é delas
  que sai o `estado_resultante`.
- **Precondições do cancelamento montadas pelo estado, nunca por parâmetro.** O
  Server Script "PDF contrato" anexa o documento no `After Save` de todo contrato,
  de modo que a ausência de PDF só existe se for produzida: o cenário
  `contrato_sem_pdf` tem os dois campos de PDF zerados por escrita direta. E como
  a guarda de PDF vem ANTES da guarda de imóvel, o cenário `contrato_sem_imovel`
  recebe o PDF do contrato completo — sem isso ele recusaria pela primeira guarda
  e a segunda ficaria sem oráculo. Nenhuma bandeira de simulação foi acrescentada
  à regra.
- **Filtro de cobranças provado nos dois sentidos.** O contrato cancelado tem uma
  cobrança `Pendente`, uma `Vencida`, uma `Paga` e uma já `Cancelada`. Sem as duas
  últimas, "cancelou as canceláveis" seria indistinguível de "cancelou tudo".

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
- **`min(dia_vencimento, 28)` é inalcançável pelo caminho real.**
  `montar_dados_cobrancas_contrato` chama `validar_contrato_para_ativacao` na
  primeira linha, e essa validação recusa `dia_vencimento` fora de 1..28. O teto
  do `min` nunca chega a agir sobre valor maior que 28. O golden registra os dois
  fatos lado a lado — a recusa em `dia_vencimento_acima_do_teto` e a montagem com
  `dia_vencimento = 28` — sem corrigir nem remover o `min`, que fica onde está.
- **A ordem das guardas é dado, não detalhe.** Na ativação, o cenário
  `prazo_zero_e_valor_zero` viola duas condições ao mesmo tempo e mostra qual
  mensagem sai; no cancelamento, `contrato_sem_pdf` e `contrato_sem_imovel` são
  capturados separadamente porque a guarda de PDF precede a de imóvel. Cenário com
  violação isolada não consegue exibir precedência nenhuma.
- **Cenário deliberadamente não coberto no cancelamento:** o ramo em que a baixa
  Sicoob é `solicitada` ou devolve `erro`. Ele exige boleto emitido de verdade
  (`boleto_gerado = 1` com `nosso_numero`), e alcançá-lo faria a captura abrir
  conexão mTLS contra a instituição financeira a partir de um site sintético —
  efeito externo e irreversível, fora do que a ADR-0006 admite. Todas as cobranças
  do cenário nascem sem boleto, e o ramo capturado é o `ignoradas /
  sem_boleto_sicoob`, que é o único alcançável sem tocar a rede.
