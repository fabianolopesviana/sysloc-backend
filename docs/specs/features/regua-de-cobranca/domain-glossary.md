# Glossário de Domínio — Régua de cobrança

> Termos restritos a esta feature. Os termos canônicos do projeto — **Aviso**, **Régua de cobrança**,
> **Janela de horário**, **Tentativa de envio** e **Desfecho** — vivem em
> `/docs/specs/domain-glossary.md` e **não** se redefinem aqui.

## Termos

**Política de aviso**:
A configuração, própria de cada **Empresa**, que diz à **Régua de cobrança** se ela está ligada, em que dias relativos ao vencimento avisar, qual o **Intervalo mínimo** entre dois avisos da mesma **Cobrança**, qual a **Janela de horário** e qual o canal. Nasce desligada e não existe até ser escrita — a ausência dela é a régua desligada, nunca uma falha.
_Evitar_: régua (para a configuração), configuração da régua, automação de cobrança, parâmetros de cobrança, política de cobrança

**Intervalo mínimo**:
O número de dias que precisa ter passado desde a última **Tentativa de envio** com **Desfecho** *entregue* para que a mesma **Cobrança** volte a receber **Aviso** pelo caminho automático. Ele existe para proteger a caixa do **Locatário** — por isso conta apenas o que de fato chegou lá, e não a tentativa que falhou.
_Evitar_: cooldown, carência, janela de repetição, intervalo entre envios, trava (fora de contexto técnico)

**Disparo manual**:
O ato pelo qual uma pessoa autorizada faz sair, na hora, o **Aviso** de uma **Cobrança** específica, dispensando a **Janela de horário**, o **Intervalo mínimo** e o recorte de dias — mas **não** a recusa sobre cobrança paga ou cancelada. É **Ação sensível** do catálogo.
_Evitar_: reenvio, envio forçado, disparo avulso, cobrança manual, notificação manual

**Caminho**:
Por onde uma **Tentativa de envio** foi originada: pela **Régua de cobrança** (*automático*) ou pelo **Disparo manual** (*manual*). É atributo do registro, e é o que permite auditar quem originou cada mensagem.
_Evitar_: origem, tipo de envio, modo, gatilho, fonte

**Candidata ao aviso**:
Uma **Cobrança em aberto** que o banco devolveu como elegível numa passagem da **Régua de cobrança** — já filtrada por estado, por dia relativo ao vencimento e pelo **Intervalo mínimo**, e já acompanhada do destinatário e dos dados do imóvel que a mensagem imprime. Ser candidata **não** significa que o **Aviso** saiu: ela ainda pode terminar sem destinatário ou em falha.
_Evitar_: elegível, selecionada, fila de envio, lista de cobrança, alvo

## Relacionamentos

- Uma **Empresa** tem no máximo uma **Política de aviso**; a ausência dela equivale à régua desligada.
- Uma **Política de aviso** declara exatamente um **Intervalo mínimo** e exatamente uma **Janela de horário** — não há valores separados por estado da cobrança.
- Uma passagem da **Régua de cobrança** produz zero ou mais **Candidatas ao aviso**, e cada candidata produz exatamente uma **Tentativa de envio**.
- Toda **Tentativa de envio** tem exatamente um **Caminho** e exatamente um **Desfecho**.
- O **Disparo manual** produz **Tentativa de envio** com **Caminho** *manual*, e ela conta para o histórico como qualquer outra — mas **não** alimenta o **Intervalo mínimo** de forma diferente das demais.

## Ambiguidades resolvidas

- "Intervalo" era usado tanto para o **Intervalo mínimo** entre avisos quanto para o recorte de dias antes do vencimento. Resolvido: são campos distintos da **Política de aviso** — o primeiro governa a *repetição*, o segundo governa a *antecedência*.
- "Envio" era usado tanto para a mensagem que saiu quanto para o registro do que foi tentado. Resolvido: a mensagem é o **Aviso** (glossário global); o registro é a **Tentativa de envio**, e ela existe mesmo quando nada saiu.
- "Automático" nomeava tanto o **Caminho** de uma tentativa quanto o gatilho de tempo que aciona a régua. Resolvido: o **Caminho** é atributo do registro e existe nesta feature; o gatilho de tempo **não existe aqui** (RN-14) e pertence à fase de automações agendadas.
- A política do legado tinha **duas trilhas** (uma para *a vencer*, outra para *vencida*), com intervalo, horário e canal separados. Resolvido: a **Política de aviso** tem **trilha única** por decisão do PRD — o mapeamento campo a campo, e a prova de que nenhum veredito do oráculo muda com o colapso, estão na §21.2 do `tech_spec.md`.
