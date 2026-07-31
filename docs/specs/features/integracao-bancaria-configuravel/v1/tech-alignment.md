# Tech Alignment — Integração bancária configurável pelo frontend

| | |
|---|---|
| **Feature** | `integracao-bancaria-configuravel` |
| **Versão** | v1 |
| **Framework** | SDD |
| **Variante** | `backend` (Fase 1 do roadmap; a Fase 2 é web e consome as capacidades decididas aqui) |
| **Documento de definição** | `docs/prds/features/integracao-bancaria-configuravel/v1/prd.md` |
| **Discovery lido** | `docs/specs/features/integracao-bancaria-configuravel/v1/pre-refinement.md` |
| **ADRs consultadas** | ADR-0001 — Modelo canônico de cobrança bancária com adaptador por provedor (ativa, governa D2/D5) |
| **Data** | 2026-07-20 |
| **Status** | Decidido |

---

## Contexto técnico

A operação de cobrança bancária está acoplada ao dialeto de um provedor específico em toda a sua superfície: o payload é montado inline no ponto de emissão, a resposta é interpretada por varredura do documento cru do provedor, e o endereço de comunicação é constante literal replicada em quatro módulos. A resolução da configuração ativa está duplicada em cinco módulos — idêntica em corpo, divergente apenas no tipo do erro devolvido (um deles estrutura o erro em dicionário; os outros quatro devolvem texto). A credencial de acesso é um arquivo em caminho fixo do sistema, montado somente-leitura e fora do alcance de escrita da aplicação.

A ADR-0001 já fixou a forma da solução: núcleo agnóstico conversando com uma porta única, adaptadores traduzindo por provedor. Este alinhamento decide **como essa forma é introduzida sobre código em produção** sem violar as duas invariantes que o PRD impõe: continuidade da operação durante toda a transição (CA-16) e equivalência do comportamento observável ao final dela (CA-17).

Três características do terreno condicionam quase todas as decisões abaixo. **A estrutura de dados não é versionada** — as DocTypes do domínio são custom criadas pela interface administrativa e existem apenas no banco; o repositório não as descreve e uma migração não as reproduz. **Não existe precedente de patch** no app. E **o contador sequencial que identifica os boletos é lido sob bloqueio de linha** mantido até o commit da emissão — o que torna a existência simultânea de dois contadores o principal risco de corrupção da feature.

---

## Soluções técnicas decididas

### D1 — A estrutura canônica de configuração nasce versionada em arquivo

**Escolhido**: a nova estrutura de configuração é descrita no repositório e criada pelo processo de migração do framework.
**Rejeitado**: criá-la pela interface administrativa, como as demais estruturas do projeto.

**Motivo**: a migração de dados prevista depende de ordenação — a estrutura precisa existir antes do patch que a popula. O processo de migração sincroniza estruturas versionadas em arquivo e só então executa patches; uma estrutura criada apenas pela interface administrativa não participa dessa sincronização, o que forçaria o patch a criá-la programaticamente (sem revisão, sem histórico) ou a depender de um passo manual não reproduzível. Versionar também é o que permite revisar a mudança e reproduzi-la em outro ambiente.

**Trade-off aceito**: custo de processo, não técnico. Com a estrutura em arquivo, alterá-la pela interface administrativa passa a produzir mudança no repositório que precisa ser incorporada — ignorar isso cria divergência entre banco e arquivo. O modo de desenvolvimento já está habilitado no ambiente, então não há impedimento técnico.

**Escopo**: aplica-se **apenas à estrutura nova**. Converter as estruturas existentes é refactor fora do escopo desta feature (ver Pontos em aberto).

### D2 — Cutover por estrangulamento, operação a operação, começando pela leitura

**Escolhido**: o adaptador passa a existir e as operações migram uma por vez, na ordem **consulta → confirmação de baixa → baixa → sincronização → emissão**.
**Rejeitado**: migrar as cinco operações numa única passagem.

**Motivo**: consulta é leitura pura — não altera o boleto no provedor, não consome contador, não cria obrigação financeira. Migrá-la primeiro valida o mapeamento canônico de ida e volta contra o provedor real com dano zero em caso de erro. Emissão vai por último por ser a única que cria dinheiro e consome o contador sequencial. Com big bang, um erro de mapeamento só se manifestaria com todas as operações já convertidas, contrariando a exigência de continuidade.

**Trade-off aceito**: durante a transição convivem dois caminhos de execução, e as duplicações existentes (resolução de configuração e registro de eventos) permanecem até a última operação migrar.

### D3 — Migração da configuração: patch idempotente com fallback de leitura, exceto para o contador

**Escolhido**: patch idempotente copia a configuração legada; a resolução em runtime cai na configuração legada enquanto a canônica não estiver completa. **O contador sequencial é exceção**: migra em corte único e atômico, sem fallback de leitura.
**Rejeitado**: apenas patch (quebra se ainda não executado) ou apenas resolução em runtime (mantém duas fontes de verdade indefinidamente).

**Motivo**: o fallback é o que sustenta a continuidade exigida pelo PRD antes do primeiro envio de credencial pela tela. Mas o contador não tolera esse tratamento — ele é lido sob bloqueio de linha mantido até o commit da emissão, e duas origens vivas simultaneamente produziriam identificador repetido, violando a invariante de unicidade (RN-03). Para o contador, portanto, vale o inverso: uma única origem a partir do instante da migração.

**Trade-off aceito**: a migração do contador é um ponto de não-retorno dentro da migração geral, e precisa ser verificada explicitamente antes de a emissão ser migrada (D2 já a coloca por último, o que dá margem).

### D4 — Credencial materializada e token com escopo de operação

**Escolhido**: a credencial é materializada uma vez por operação e descartada ao final dela, inclusive em caso de erro; o token é obtido uma vez dentro da mesma operação.
**Rejeitado**: materializar por chamada individual (dobra escrita e remoção de material sensível sem ganho); manter token em cache entre operações (invalidação e superfície de segurança que nada cobra hoje).

**Motivo**: hoje cada operação já realiza dois handshakes — um para o token, outro para a chamada — e a credencial vive num caminho fixo. Ao passar a ser materializada, o escopo de operação preserva o número de handshakes atual e minimiza a janela de existência do material em disco sem multiplicá-la. Cache de token seria otimização especulativa: o PRD não estabelece requisito de desempenho.

**Trade-off aceito**: a operação continua obtendo token a cada execução, como hoje. Nenhum ganho de desempenho é buscado nesta versão.

### D5 — Situação canônica e texto cru do provedor convivem

**Escolhido**: o enumerado canônico governa as decisões internas; o texto cru devolvido pelo provedor continua sendo persistido como hoje.
**Rejeitado**: substituir o texto persistido pelo valor canônico.

**Motivo**: o campo que hoje guarda a situação é texto livre, e há lógica em produção que compara esse texto. Trocar o que se persiste altera dado e comportamento observável — exatamente o que CA-17 proíbe. A ADR-0001 exige que o núcleo só decida sobre tipos canônicos, e isso é satisfeito sem mudar o que é gravado.

**Trade-off aceito**: convivência de duas representações da mesma informação. Mitigado pelo fato de o canônico preservar o texto cru ao lado, como a própria ADR-0001 já previa.

### D6 — Documento consolidado montado em memória e entregue por streaming

**Escolhido**: o documento consolidado é montado em memória e entregue pelo mecanismo de streaming já usado para apresentar documentos ao usuário; não é persistido.
**Rejeitado**: persistir o consolidado como arquivo privado anexado à configuração.

**Motivo**: o consolidado é artefato de momento, atado a uma decisão pontual de troca de conta. Persistir criaria arquivo sem dono, sem ciclo de vida e sem regra de expurgo. Os documentos individuais permanecem disponíveis caso o consolidado precise ser refeito. A biblioteca de manipulação necessária já está no ambiente e já é usada pelo app para composição de documentos.

**Trade-off aceito**: cada acionamento remonta o documento. Aceitável dada a frequência da operação (troca de conta é evento raro).

### D7 — Contrato dos serviços de configuração (decisão direta)

**Escolhido**: os serviços de configuração seguem o **shape de resposta estruturada com indicador de sucesso**, o mesmo da família de operações de cobrança — não o shape alternativo usado nas rotinas internas do app. O conteúdo da credencial trafega **codificado dentro do documento estruturado**, dado que o cliente é exclusivamente estruturado.

**Motivo**: decisão determinada pelo terreno, não escolha aberta. O consumidor é a mesma camada que já trata o shape com indicador de sucesso, e erro de negócio precisa retornar de forma estruturada em vez de exceção — o outro shape existente no projeto lança exceção em erro, o que não atende à exigência de mensagens de negócio para persona não-técnica.

**Trade-off aceito**: a codificação acrescenta cerca de um terço ao tamanho do conteúdo transmitido, e o limite de tamanho aceitável passa a precisar de validação explícita (ver Pontos em aberto).

---

## Candidatas a ADR

**Versionamento em arquivo da estrutura de dados do app (D1)** — decisão transversal e evergreen: estabelece um padrão que afeta toda estrutura futura do projeto, contradiz o padrão de fato vigente (estrutura criada pela interface administrativa) e tem custo de reversão alto. Um leitor futuro encontrará uma estrutura versionada ao lado de várias não-versionadas e perguntará por quê.

```bash
/agent-spec-adr-create "versionar estrutura de dados do app em arquivo em vez de criar pela interface administrativa"
```

**Candidata secundária — padronização do shape de resposta dos serviços expostos (D7)**: o projeto tem dois shapes coexistindo. Canonizar um deles é transversal, mas esta feature apenas segue o dominante em vez de decidir pelo projeto inteiro. Registrar como ADR só se houver intenção de padronizar os serviços existentes — o que está fora deste escopo.

> A forma da solução (núcleo canônico + porta + adaptadores) **já está canonizada na ADR-0001** e não é reaberta aqui.

---

## Restrições e invariantes técnicas

Qualquer implementação desta feature deve respeitar:

1. **Unicidade do identificador sequencial** — o contador é único e contínuo, nunca reinicia, e em nenhum instante pode existir mais de uma origem viva (RN-03 + D3).
2. **Continuidade e equivalência** — a operação de cobrança não pode ser interrompida durante a transição, e o comportamento observável ao final dela deve ser equivalente ao anterior (CA-16, CA-17). Em particular, as assinaturas expostas hoje e as chaves de resposta que o cliente já consome são contrato e não mudam.
3. **Sigilo do material criptográfico** — senha e conteúdo da credencial nunca aparecem em retorno, registro de diagnóstico ou histórico (RN-06). Isso inclui os registros de evento da integração, que hoje serializam payloads inteiros.
4. **Descarte garantido** — o material materializado em disco é removido ao final da operação inclusive em caminho de erro, com permissão restrita ao proprietário enquanto existe.
5. **Núcleo agnóstico** — nenhum campo, endereço ou vocabulário de provedor cruza a porta do adaptador (ADR-0001).
6. **Acesso restrito** — as capacidades de configuração são acessíveis apenas a perfil administrativo (RN-11).
7. **Credencial sempre privada** — o arquivo de credencial gerenciado pela aplicação é privado e entra no backup do sistema junto aos demais arquivos privados.
8. **Agendamento fora do framework** — o app não registra eventos de agendamento próprios; rotinas periódicas são acionadas por agendador do host. Nada nesta feature deve introduzir agendamento interno sem decisão explícita.
9. **Dependências disponíveis apenas no ambiente virtual do bench** — a biblioteca de composição de documentos e a de comunicação autenticada por certificado não existem no interpretador do sistema.
10. **Propagação de mudanças** — o app é montado por vínculo de diretório; após alteração de código é obrigatório reiniciar os quatro serviços que o carregam, pelos próprios serviços de orquestração (nunca por encerramento forçado de processo).

---

## Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC**

- **Unificação do tipo de erro na resolução de configuração**: as cinco cópias divergem — uma estrutura o erro, quatro devolvem texto. A convergência para uma única origem precisa escolher a forma, e a escolha afeta os pontos de chamada.
- **Faixa aceitável de tamanho da credencial**: o PRD exige recusa de conteúdo fora de faixa sem definir a faixa.
- **Cache de token entre operações**: descartado nesta versão por ausência de requisito. Reconsiderar apenas se surgir evidência de custo relevante.
- **Alcance da unificação de duplicações**: além da resolução de configuração, o registro de eventos está duplicado em cinco módulos. Unificar além do que o cutover exige é refactor oportunista e fica fora do escopo — decidir apenas o mínimo que D2 obriga.

**Dependências de produto / externas — não decididas aqui**

- **Comportamento do provedor ao receber baixa ou consulta de boleto emitido sob outra conta**: não altera o fluxo já fechado no PRD, apenas a redação do aviso ao gestor (informativo ou de advertência). Precisa de resposta antes da Fase 2.
- **Disponibilidade de credenciais de homologação no provedor**: sem elas, a alternância de ambiente tem valor limitado para teste.

**Observações fora do escopo (débito registrado, não proposto)**

- As estruturas de dados existentes permanecem não versionadas. D1 impede o crescimento da dívida, mas não a resolve; convertê-las é iniciativa própria.
- A divergência entre banco e arquivo passa a ser possível a partir de D1 e depende de disciplina de processo, não de mecanismo.
