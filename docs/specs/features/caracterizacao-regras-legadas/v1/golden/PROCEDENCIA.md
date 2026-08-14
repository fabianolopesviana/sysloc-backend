# Procedência dos golden — caracterização das regras legadas

> Gerado por `deploy/scripts/caracterizacao/capturar.py`. Não editar à mão: o
> manifesto é reescrito a cada captura e a bijeção entre as máscaras aqui
> declaradas e os marcadores presentes nos golden é verificada por
> `verificar-golden.sh` (CT-014).

## 1. Identificação da captura

| Campo | Valor |
|---|---|
| Data e hora da captura | 2026-08-12T23:20:26 |
| Site de captura | caracterizacao.localhost |
| Dump de origem | sites/frontend/private/backups/20260812_231735-frontend-database.sql.gz |
| Timestamp do dump | 2026-08-12T23:17:43 |
| Versão do app (commit) | 5a4e5197ee1d4e1cd262b6886c054ddf9a0da9b2 |
| Versões do bench | erpnext 15.4.0 · frappe 15.4.0 |
| Nível da ordem de queda alcançado (régua) | 1 — despachante substituído dentro do processo de captura, com o percurso completo da régua executando |

O dump de origem é o único vínculo com o ambiente que atende a operação, e ele
recebeu exclusivamente `bench backup` — comando que produz arquivo e não altera
dado (ADR-0006). Toda a captura executou no site efêmero acima, destruído ao fim
do fluxo.

## 2. Máscaras aplicadas

| Marcador | Artefato | Campo mascarado | Motivo |
|---|---|---|---|
| `<DATA_EXECUCAO>` | `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json`, `atualizar-atrasos-cobrancas.json`, `regua-de-cobranca.json` | `retorno.data_execucao`; `estado_resultante.*.data_inicio_atraso`; `estado_resultante.*.data_ultima_atualizacao_atraso`; na régua, o `hoje=` do resumo do `runner.py` e `estado_resultante.configuracao_da_regua.ultima_execucao_em` | As três rotinas derivam de `nowdate()`, e a régua também. Gravar a data absoluta faria o golden expirar no dia seguinte; o marcador representa o offset zero — o próprio dia da execução. |
| `<DATA_GERACAO_EXTENSO>` | `contrato-pdf.txt`, `contrato-pdf-pessoa-juridica.txt` | Data por extenso do fecho do contrato (`DD de MÊS de AAAA`), montada pelo Server Script com `nowdate()` | É o único campo do documento que muda a cada geração. Sem a máscara, a comparação textual acusaria diferença todo dia, onde não há diferença de comportamento. |
| `<PDF_CONTRATO_CODIFICADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato`; `estado_resultante.contratos[].pdf_contrato`; `retorno.retorno.pdf_contrato` | O campo guarda o documento inteiro codificado, com megabytes que mudam a cada geração. O que a regra observa é a PRESENÇA — é ela que libera ou bloqueia o cancelamento —, e é a presença que o marcador preserva; ausência continua gravada como `null`. |
| `<ARQUIVO_PDF_PRIVADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato_arquivo`; `estado_resultante.contratos[].pdf_contrato_arquivo`; `retorno.retorno.pdf_contrato_arquivo` | O caminho do anexo privado carrega identificador sorteado pelo arcabouço a cada gravação, e duas capturas nunca coincidiriam. A troca de `pdf_contrato` por `pdf_contrato_arquivo` é o efeito observável do cancelamento, e o par marcador/`null` a preserva. |
| `<HORA_EXECUCAO>` | `regua-de-cobranca.json` | O `agora=` do resumo que o `runner.py` grava em `Automacao Cobranca Config.ultimo_erro_execucao` | A régua compara o relógio da execução com o horário configurado, e grava os dois no resumo. O `agora=` muda a cada minuto; os demais `HH:MM` do resumo são CONFIGURAÇÃO e ficam sem máscara de propósito — apagá-los tiraria do oráculo a janela com que a régua rodou. |
| `<DATA_VENCIMENTO_FORMATADA>` | `regua-de-cobranca.json` | A data de vencimento renderizada em `dd/MM/yyyy` dentro do corpo de cada mensagem (`retorno.template[].corpo`, `retorno.automatico.mensagens[].corpo`, `retorno.manual[].mensagens[].corpo`) | O corpo é parte do oráculo — a régua decide a quem cobrar **e com que texto** —, mas a data que ele imprime deriva de `nowdate()` pelo offset do cenário. Sem a máscara o corpo mudaria todo dia; o offset continua gravado em `entrada.cobrancas[].vencimento_offset_dias`. |
| `<IDENTIFICADOR_DE_REQUISICAO>` | `regua-de-cobranca.json` | `retorno.manual[].resultado.retorno.request_id` | O identificador de requisição do envio manual embute `now()` com precisão de microssegundo, e duas capturas nunca coincidiriam. O que a trava de intervalo observa é o PREFIXO, e ele fica preservado por extenso em `estado_resultante.log_envio_cobranca[].prefixo_request_id`. |
| `<DOCUMENTO_DO_LOCADOR>` | `contrato-pdf-pessoa-juridica.txt` | número do CPF ou do CNPJ, na forma em que a regra o imprime | O RÓTULO que a regra escolhe — `CPF` contra `CNPJ` — é o próprio objeto do eixo `locatario_pessoa_juridica` e fica sem máscara; o número é dado pessoal e sai. |
| `<DOCUMENTO_DO_LOCATARIO>` | `contrato-pdf-pessoa-juridica.txt` | número do CPF ou do CNPJ, na forma em que a regra o imprime | O RÓTULO que a regra escolhe — `CPF` contra `CNPJ` — é o próprio objeto do eixo `locatario_pessoa_juridica` e fica sem máscara; o número é dado pessoal e sai. |
| `<ENDERECO_DO_IMOVEL>` | `contrato-pdf-pessoa-juridica.txt` | endereço composto da parte ou do imóvel, com CEP | A composição do endereço já tem oráculo em `contrato-pdf.txt`, que a exibe inteira com dado fabricado. Aqui o valor é real e localiza pessoa. |
| `<ENDERECO_DO_LOCADOR>` | `contrato-pdf-pessoa-juridica.txt` | endereço composto da parte ou do imóvel, com CEP | A composição do endereço já tem oráculo em `contrato-pdf.txt`, que a exibe inteira com dado fabricado. Aqui o valor é real e localiza pessoa. |
| `<ENDERECO_DO_LOCATARIO>` | `contrato-pdf-pessoa-juridica.txt` | endereço composto da parte ou do imóvel, com CEP | A composição do endereço já tem oráculo em `contrato-pdf.txt`, que a exibe inteira com dado fabricado. Aqui o valor é real e localiza pessoa. |
| `<IDENTIFICADOR_DO_IMOVEL>` | `contrato-pdf-pessoa-juridica.txt` | identificador do imóvel exibido na cláusula primeira | Identifica o imóvel real do contrato. O que o oráculo precisa é a posição em que a regra o escreve, e o marcador a preserva. |
| `<NOME_DO_LOCADOR>` | `contrato-pdf-pessoa-juridica.txt` | nome da parte, na qualificação e na linha de assinatura | O documento vem de contrato REAL: o nome identifica pessoa, não é reproduzível pelo produto novo e não é o que se compara. O que o oráculo precisa é a POSIÇÃO em que a regra o escreve, e o marcador a preserva. |
| `<NOME_DO_LOCATARIO>` | `contrato-pdf-pessoa-juridica.txt` | nome da parte, na qualificação e na linha de assinatura | O documento vem de contrato REAL: o nome identifica pessoa, não é reproduzível pelo produto novo e não é o que se compara. O que o oráculo precisa é a POSIÇÃO em que a regra o escreve, e o marcador a preserva. |
| `<PRACA_DO_FECHO>` | `contrato-pdf-pessoa-juridica.txt` | cidade e estado do imóvel na linha de fecho, antes da data | A regra escreve a localidade do imóvel uma SEGUNDA vez no fecho, fora do endereço composto. Sem marcador próprio ela sobrevive à máscara do endereço — e foi exatamente o que a varredura de resíduo pegou. |

Os marcadores por PAPEL (`…_DO_LOCADOR`, `…_DO_LOCATARIO`, `…_DO_FIADOR`,
`…_DO_IMOVEL`) são os da §4.1 e existem por uma razão diferente da das demais
máscaras desta tabela: ali o documento vem de contrato **real**, e o texto
carregaria nome, documento e endereço de pessoa para dentro da árvore versionada.
O que a regra DECIDE — o rótulo `CPF` contra `CNPJ`, a presença ou a ausência do
trecho de identidade civil — fica sem máscara, porque é justamente o oráculo do
eixo; o que sai é o valor. A captura recusa gravar o artefato quando alguma
máscara não casa, e recusa de novo quando qualquer valor sobrevive à varredura de
resíduo — são duas barreiras independentes, e a segunda existe porque a primeira
prova que ENCONTROU, não que não sobrou.

Os cinco marcadores acrescentados são nomeados **sem algarismo** de propósito: a
bijeção do `verificar-golden.sh` varre `<[A-Z_]+>`, que não casa dígito, e um nome
como `<PDF_CONTRATO_BASE64>` escaparia da varredura — viraria máscara órfã
justamente no verificador que existe para achar máscara órfã.

Todas as demais datas dos golden das rotinas são gravadas como **offset inteiro
de dias** relativo à data de captura (`vencimento_offset_dias`,
`data_fim_locacao_offset_dias`), nunca como data absoluta. É o que permite à F5
reconstruir o mesmo cenário em qualquer dia. O mesmo vale para
`contrato-cancelamento.json` e para `regua-de-cobranca.json`, que não gravam data
absoluta nenhuma — na régua, o vencimento de cada cobrança e a data de cada linha
do histórico de envio são offsets (`vencimento_offset_dias`, `envio_offset_dias`).

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
- **Horário da régua fixado em `00:00`.** `is_hora_execucao` compara o relógio da
  execução com o horário configurado; com o `09:00` de produção, uma captura das
  03h não entraria em bloco nenhum e o golden dependeria da hora do dia. A janela
  de horário não fica sem oráculo por isso — ela é capturada à parte, como função
  pura (`normalize_hhmm`, `is_hora_execucao`), com o "agora" passado explicitamente.
- **A régua roda por último, e a carteira que ela enxerga é maior que os cenários
  dela.** O `SELECT` do `runner.py` não filtra por contrato: ele varre toda
  cobrança em aberto do site. Antecipar a fase poria as cobranças da régua dentro
  do conjunto que as três rotinas de estado varrem, e aqueles seis artefatos são de
  fatia fechada. A contrapartida está registrada, não escondida: as cobranças que
  sobraram das fases anteriores entram no `SELECT` e aparecem em
  `entrada.carteira_herdada`, separadas dos cenários próprios.
- **Histórico e fila zerados antes de semear.** O site restaurado traz `Log Envio
  Cobranca` e `Email Queue` reais do dump. Sem a purga, a trava de intervalo ficaria
  sujeita a log de produção e a contagem final da fila do arcabouço não poderia
  afirmar nada sobre esta execução. Nenhuma fase anterior lê essas duas tabelas.
- **Trava de intervalo provada com o negativo que discrimina.** Além dos envios
  recente e antigo, o histórico traz uma linha de status `Erro` recente. Sem ela,
  "a trava só conta envio bem-sucedido" seria indistinguível de "a trava conta
  qualquer linha" — e o filtro de status poderia sumir sem que nada acusasse.

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
- **A régua de cobrança (`cobranca_automation`) FOI caracterizada, no nível
  1 da ordem de queda:** despachante substituído dentro do processo de captura, com o percurso completo da régua executando. Os dois pontos de despacho do
  arcabouço — `emailer.py:203`, em `enviar_email_automacao`, e `emailer.py:251`, em
  `enviar_email_manual` — foram cobertos por um registrador em memória, e os pontos
  que o registrador efetivamente observou durante a captura foram `emailer.py:203`, `emailer.py:251`. O
  contador de despacho real vale `0` e a fila de e-mail do
  arcabouço terminou com `0` documento(s). Nenhuma mensagem saiu;
  o percurso inteiro executou.
- **Os dois resolvedores de estado da régua discordam, e a divergência é o achado
  desta captura.** `get_status_template` (`core.py`) tem o ramo `Fechada`, que sai
  de `STATUS_FECHADA = ("paga","pago","cancelada","cancelado")`;
  `get_status_template_manual` (`emailer.py`) **não tem esse ramo** e testa o
  vencimento antes de qualquer estado. O cenário `cobranca_cancelada_e_vencida`
  registra o efeito: o caminho automático nunca alcança a cobrança, porque o
  `SELECT` do `runner.py` exclui `["Paga","Cancelada"]`, enquanto o envio manual
  monta o template `Vencida` e cobra por uma dívida cancelada — `is_cobranca_paga`
  conhece `Paga` e não conhece `Cancelada`. O contraste que discrimina está no
  cenário `cobranca_paga`, ao lado, em que o manual É barrado. Gravado como veio,
  sem correção: é o defeito que motiva a unicidade estrutural do estado.
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

## 4.1 Caminhos do documento sem oráculo — um desfecho por eixo

> Fase B-2 de `capturar.py`, e a única que lê dado **real**: ela roda ANTES da
> purga, porque é a purga que apaga o conjunto onde os eixos podem ser procurados.
> Cada eixo termina com **exatamente um** desfecho — `capturado`, com o artefato e
> o contrato de origem, ou **ausência medida**, com a consulta que executou e não
> retornou linha. **Não existe terceiro estado**: "provavelmente não há" não é
> desfecho, e ausência inferida não é ausência medida.
>
> Nada foi escrito no site que atende a operação. A composição do documento
> executa a própria regra do legado sobre o contrato REAL, e essa regra persiste
> `pdf_contrato` no contrato — tudo dentro do site efêmero restaurado do dump
> (ADR-0006), que é destruído ao fim. Nenhum contrato foi criado, alterado em
> cadastro ou fabricado para completar cobertura.

Contratos reais examinados nesta captura: **1**.

### `contrato_com_fiador` — ausência medida

Ramo da regra sem oráculo até aqui: o bloco de qualificação do fiador e as cláusulas que o referenciam.
Contratos reais que o exercitam: **0** de **1**.
Nenhum artefato foi gravado para este eixo, e **nada foi criado no sistema legado** para produzir um: contrato fabricado não é oráculo de coisa alguma. A consulta abaixo executou e não retornou linha.

```sql
SELECT c.name
  FROM `tabContrato` c
 WHERE EXISTS (SELECT 1
                 FROM `tabFiadores` f
                WHERE f.parent = c.name
                  AND f.parenttype = 'Contrato'
                  AND TRIM(COALESCE(f.fiador, '')) <> '')
 ORDER BY c.name
```

### `locatario_pessoa_juridica` — capturado

Ramo da regra sem oráculo até aqui: a qualificação por CNPJ no lugar do par CPF + identidade civil.
Contratos reais que o exercitam: **1** de **1**.
Artefato: `contrato-pdf-pessoa-juridica.txt` · contrato de origem: `CTR-2026-00020`.

```sql
SELECT c.name
  FROM `tabContrato` c
  JOIN `tabLocatario` l ON l.name = c.locatario
 WHERE LOWER(COALESCE(l.tipo_locatario, '')) LIKE '%jur%'
    OR (LOWER(COALESCE(l.tipo_locatario, '')) NOT LIKE '%fis%'
        AND LOWER(COALESCE(l.tipo_locatario, '')) NOT LIKE '%fís%'
        AND CHAR_LENGTH(REGEXP_REPLACE(COALESCE(l.documento_principal, ''),
                                       '[^0-9]', '')) = 14)
 ORDER BY c.name
```

### `parte_sem_documento_identidade` — capturado

Ramo da regra sem oráculo até aqui: a OMISSÃO do trecho de identidade civil, no lugar de um trecho vazio.
Contratos reais que o exercitam: **1** de **1**.
Artefato: `contrato-pdf-pessoa-juridica.txt` · contrato de origem: `CTR-2026-00020`.
O artefato é o do eixo `locatario_pessoa_juridica`: o mesmo contrato real exercita os dois ramos, e o texto é um só. Gravá-lo duas vezes sob nomes diferentes seria duas cópias do mesmo fato, livres para divergir na recaptura seguinte — os eixos que ele cobre são `locatario_pessoa_juridica`, `parte_sem_documento_identidade`.

```sql
SELECT c.name
  FROM `tabContrato` c
  LEFT JOIN `tabLocador` d ON d.name = c.locador
  LEFT JOIN `tabLocatario` l ON l.name = c.locatario
 WHERE TRIM(COALESCE(d.rg, '')) = ''
    OR TRIM(COALESCE(l.rg, '')) = ''
    OR EXISTS (SELECT 1
                 FROM `tabFiadores` f
                 JOIN `tabFiador` fi ON fi.name = f.fiador
                WHERE f.parent = c.name
                  AND f.parenttype = 'Contrato'
                  AND TRIM(COALESCE(fi.rg, '')) = '')
 ORDER BY c.name
```

## 5. Inventário dos artefatos

> Seção mantida por `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh`. A
> lista é DECLARADA no script, nunca derivada do diretório: derivá-la faria a
> bijeção do CT-601 comparar o `ls` consigo mesmo, e um artefato apagado sairia
> dos dois lados sem reprovar nada.
>
> **Este manifesto tem dois autores, e a fronteira é esta seção.** As seções 1 a
> 4 saem de `capturar.py`, que ao reescrever o arquivo RECORTA e REANEXA tudo o
> que vem daqui em diante (`compor_manifesto`). Desta seção em diante o dono é
> o extrator, e ela é regravável sem o sistema legado de pé:
> `bash deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh --so-manifesto`.

| Artefato | Produzido por | O que é |
|---|---|---|
| `PROCEDENCIA.md` | `capturar.py` | este manifesto: identificação da captura, máscaras e convenções |
| `atualizar-atrasos-cobrancas.json` | `capturar.py` | oráculo da rotina de atualização de atraso |
| `calcular-mora.json` | `capturar.py` | os 6 casos canônicos de `_calcular_mora`, portados sem reexecução |
| `contrato-ativacao.json` | `capturar.py` | oráculo da ativação de contrato, com a virada de mês |
| `contrato-cancelamento.json` | `capturar.py` | oráculo do cancelamento de contrato e da cascata |
| `contrato-pdf-fonte.py` | `extrair-fonte-do-pdf.sh` | o FONTE do Server Script `PDF contrato` — a regra que compõe o documento |
| `contrato-pdf.txt` | `capturar.py` | a SAÍDA da regra do documento: texto extraído do PDF gerado |
| `encerrar-contratos-vencidos.json` | `capturar.py` | oráculo da rotina de encerramento de contrato vencido |
| `marcar-cobrancas-vencidas.json` | `capturar.py` | oráculo da rotina que marca cobrança vencida |
| `metragem.json` | `capturar.py` | oráculo da metragem derivada dos cômodos |
| `regua-de-cobranca.json` | `capturar.py` | oráculo da régua de cobrança, com a divergência automático × manual |
| `contrato-pdf-pessoa-juridica.txt` | `capturar.py` | o documento de contrato REAL nos ramos que o sintético não exercita — locatário pessoa jurídica e parte sem identidade civil |

Um único artefato não sai de `capturar.py`: `contrato-pdf-fonte.py` é o FONTE do
Server Script `PDF contrato`, que existe apenas dentro do banco do sistema
legado e desaparece com ele na virada. Ele foi lido por `SELECT` no serviço de
banco, autenticado como o usuário da base — nenhum `bench` foi apontado para o
site que atende a operação, e nada foi escrito lá (ADR-0006). O conteúdo é
byte a byte o do campo `script`, sem máscara alguma: não há dado volátil nem
credencial nele, e mascarar a regra destruiria justamente o que se captura.

Última alteração da regra no legado (`modified`): `2026-03-10 14:24:24.623970`. É esse o
carimbo que o cabeçalho do artefato repete — o instante da EXTRAÇÃO fica de
fora dos dois de propósito, para que recapturar produza byte a byte o mesmo
arquivo e o determinismo (CT-603) seja verificável.
