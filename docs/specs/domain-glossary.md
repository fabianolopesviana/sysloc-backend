# Glossário de Domínio — Projeto

> Termos canônicos do projeto, válidos entre features. Termos restritos a uma feature vivem em `/docs/specs/features/{feature}/domain-glossary.md`.

## Termos

**Boleto em aberto**:
Boleto já emitido que ainda pode ser pago ou cobrado — não foi liquidado nem baixado. Operacionalmente: cobrança com boleto gerado e identificador do banco preenchido, cujo estado é pendente ou vencido.
_Evitar_: boleto pendente, boleto ativo, boleto em cobrança, título aberto

**Provedor**:
Instituição financeira que recebe as operações de cobrança bancária, acessada pelo sistema através de um adaptador próprio que traduz o modelo canônico para o formato dela.
_Evitar_: banco, integração, gateway, PSP

**Contador sequencial**:
Número único e contínuo **em todo o SaaS** — não de uma **Empresa** — que identifica cada boleto emitido **perante o provedor**. Nunca reinicia: nem na virada de mês, nem na troca de conta bancária, nem entre empresas. Compõe o **Identificador perante o provedor** junto de um prefixo de competência. É exigência do provedor, não do domínio: não confundir com o contador de uma **Série declarada**, que é por empresa e reinicia quando o escopo dela inclui o ano.
_Evitar_: seu número, sequencial do boleto, numeração, contador de emissão, contador da série, contador da empresa

**Identificador perante o provedor**:
A cadeia de 18 posições que identifica uma cobrança junto ao **Provedor** — 6 de prefixo de competência mais 12 do **Contador sequencial** preenchido à esquerda. É a composição que **o produto** envia, nunca o valor incremental sozinho, e é por ela que a notificação recebida do provedor descobre a que **Empresa** pertence. Não confundir com o **Número do título no provedor**, que é o identificador que vem no sentido contrário.
_Evitar_: nosso número, seu número, nosso numero, identificador do boleto

**Número do título no provedor**:
O identificador que **o Provedor atribui** a um boleto emitido e devolve ao produto — é dele, não do produto, e o produto apenas o guarda e o publica junto da linha digitável e do código de barras. Chega como inteiro no dialeto do provedor e é coagido para cadeia na fronteira do adaptador.
_Evitar_: nosso número, nosso numero, número do boleto, identificador do boleto

**Notícia do provedor**:
O fato que o **Provedor** envia por iniciativa dele, sem que o produto tenha perguntado, quando algo acontece com um boleto — tipicamente o recebimento. Ela **avisa onde olhar** e nunca decide: o efeito nasce da **consulta** que o produto faz em seguida pelo canal autenticado. Não confundir com a **Liquidação**, que é o ato que ela pode levar a registrar.
_Evitar_: webhook, callback, notificação, aviso de baixa, evento do banco

**Recebido cru**:
O corpo de uma **Notícia do provedor**, gravado exatamente como chegou e **antes** de qualquer interpretação, com prazo de guarda próprio. É diagnóstico, nunca fonte de autoridade: nada que ele contenha escolhe **Empresa**, estado ou efeito.
_Evitar_: payload, body, evento bruto, corpo da requisição

**Identificador da liquidação**:
O identificador que **o Provedor atribui** a uma **Liquidação** e devolve na **Notícia do provedor**. É por ele que um mesmo recebimento produz efeito **uma única vez**. É o terceiro identificador do provedor, e não se confunde com os outros dois: o **Identificador perante o provedor** endereça a cobrança e é nosso; o **Número do título no provedor** endereça o boleto e é dele.
_Evitar_: número identificador da baixa, id da baixa, identificador do pagamento, número da baixa

**Carnê**:
O documento único que reúne, num só arquivo, os boletos das **Cobranças** de um **Contrato de locação** num intervalo de competências, na ordem de vencimento. É composto no instante do pedido e nunca armazenado; os boletos que ele reúne são preservados **como o Provedor os emitiu**, sem recomposição.
_Evitar_: carnê de boletos, bloco de boletos, livro de pagamento, talão

**Revogação de boleto**:
O ato que torna impagável um boleto vivo junto ao **Provedor**, a pedido do produto ou por decisão do próprio provedor. Não cancela a **Cobrança** nem apaga fato nenhum: a cobrança volta a ser uma cobrança sem boleto, e pode ganhar outro. Não confundir com **Retirada de circulação**, que é visibilidade de cadastro e não alcança fato financeiro.
_Evitar_: baixa, solicitar baixa, retirada de circulação do boleto, cancelamento do boleto, estorno do boleto

**Liquidação**:
O ato que registra que uma **Cobrança em aberto** foi paga, gravando data e valor recebidos junto dos **Carimbos** da configuração vigente. Vale por qualquer caminho de entrada — informada por quem opera ou descoberta junto ao **Provedor** —, e é reversível apenas pelo estorno que o provedor informa.
_Evitar_: baixa, dar baixa, quitação, conciliação

**Certificado do provedor**:
O material que identifica uma **Empresa** perante o **Provedor**, entregue pelo **Admin Empresa** junto da senha que o abre. Toda empresa que cobra tem o seu: não existe identidade de reserva nem compartilhada. O que o produto publica dele é titular, validade, impressão digital, quem o registrou e desde quando — nunca o material nem a senha.
_Evitar_: certificado digital, pfx, certificado A1, credencial do banco, identidade bancária

**Segredo operável**:
Segredo de terceiro que o produto precisa **usar**, e não apenas conferir — por isso guardado cifrado de forma reversível, com a chave fora da árvore versionada, e jamais devolvido por superfície alguma. Opõe-se ao segredo verificável (**Senha provisória**, **Portador de confirmação**), que vai ao banco como resumo irreversível e nada recupera.
_Evitar_: credencial, segredo reversível, segredo criptografado, chave do cliente

**Meio de recebimento**:
A forma pela qual uma **Cobrança** é recebida junto ao **Provedor** — boleto ou pix. É conceito do modelo canônico do produto, escolhido de lista fechada; pix está previsto e sem operação.
_Evitar_: forma de pagamento, tipo de cobrança, modalidade, método de pagamento

**Empresa**:
A imobiliária atendida pelo produto — a unidade de isolamento de dados do sistema, à qual toda informação de negócio pertence.
_Evitar_: tenant, cliente, organização, conta, inquilino

**Sysloc Master**:
Perfil de quem opera o SaaS: cria e suspende empresas, e não alcança dado de negócio de nenhuma delas.
_Evitar_: administrador do sistema, superusuário, admin global, root

**Admin Empresa**:
Perfil de quem administra uma empresa no dia a dia, cria os usuários dela e ajusta o que cada um alcança.
_Evitar_: administrador, gestor, dono da conta, admin local

**Usuário Empresa**:
Perfil de quem opera as telas liberadas dentro de uma empresa, sem administrar ninguém.
_Evitar_: usuário comum, operador, colaborador, usuário final

**Senha provisória**:
Senha atribuída por quem cria a conta, válida apenas até o primeiro acesso, cuja troca é obrigatória antes de qualquer outra ação.
_Evitar_: senha temporária, senha inicial, senha padrão, senha de primeiro acesso

**Vínculo de acesso**:
Registro que liga uma pessoa a uma empresa e é a base sobre a qual as permissões dela naquela empresa são definidas.
_Evitar_: associação, membership, permissão, papel do usuário

**Área de tela**:
Uma das dez divisões fixas do app pelas quais o acesso é concedido — Resumo, Imóveis, Contratos, Cadastros, Financeiro, Automação de cobrança, Integrações bancárias, Multa e juros, Relatórios, Usuários.
_Evitar_: módulo, seção, página, menu, seção do sistema

**Ação sensível**:
Uma das sete operações de impacto que exigem concessão própria, além da área de tela que as comporta — emitir boleto, solicitar baixa, ativar contrato, cancelar contrato, excluir cadastro, configurar integração, enviar cobrança manual.
_Evitar_: permissão especial, operação crítica, ação restrita, ação privilegiada

**Efetivo de permissão**:
O conjunto de áreas de tela e ações sensíveis que uma pessoa alcança num dado momento — o padrão do perfil dela, acrescido do que lhe foi concedido individualmente e subtraído do que lhe foi retirado.
_Evitar_: permissões do usuário, ACL, conjunto de acesso, escopo, efetivas

**Ajuste individual**:
Concessão ou retirada de uma área de tela ou ação sensível para uma pessoa específica, aplicada sobre o padrão do perfil dela. A retirada vence a concessão.
_Evitar_: override, exceção, permissão extra, customização, ajuste fino

**Conjunto**:
Agrupamento de imóveis administrados sob o mesmo empreendimento — o nível acima do imóvel na carteira da empresa.
_Evitar_: condomínio, edifício, empreendimento, agrupamento, bloco

**Imóvel**:
A unidade locável que a imobiliária administra, pertencente a um conjunto e identificada perante o município por um identificador próprio.
_Evitar_: unidade, propriedade, apartamento, bem

**Cômodo**:
Divisão interna de um imóvel, com nome e metragem, cuja soma compõe a metragem total dele. Não tem vida própria: existe dentro do imóvel e é removido de fato quando a planta é corrigida.
_Evitar_: ambiente, dependência, peça, sala

**Locador**:
A pessoa que cede o imóvel em locação — o lado proprietário do contrato.
_Evitar_: proprietário, senhorio, dono, arrendador

**Locatário**:
A pessoa que toma o imóvel em locação — o lado que ocupa e paga.
_Evitar_: inquilino, arrendatário, morador, cliente

**Fiador**:
A pessoa que garante as obrigações do locatário perante o contrato, sem ocupar o imóvel.
_Evitar_: avalista, garantidor, responsável

**Contrato de locação**:
O acordo que liga um imóvel, um locador e um locatário sob prazo, valor e datas — o documento central do negócio. Tem código legível próprio, quatro estados possíveis e zero ou mais fiadores.
_Evitar_: locação, aluguel, acordo, contrato de aluguel, arrendamento

**Rascunho**:
O estado em que um contrato nasce: ele já existe e já consumiu o número da série, mas ainda não vale. É o único estado em que os termos e os fiadores podem ser corrigidos.
_Evitar_: pendente, em edição, provisório, não efetivado, draft

**Ativação de contrato**:
O ato deliberado que faz um contrato passar a valer: confere as condições de entrada, calcula a data de fim e o valor total, e marca o imóvel como locado. Exige concessão própria, separada da de montar o contrato.
_Evitar_: efetivar, submeter, aprovar, confirmar, assinar, publicar

**Cancelamento de contrato**:
O ato deliberado que faz um contrato vigente deixar de valer e devolve o imóvel à disponibilidade. O contrato permanece na carteira como histórico. Exige concessão própria.
_Evitar_: rescindir, encerrar, anular, desfazer, distratar

**Contrato vigente**:
O contrato ativo que ocupa um imóvel. Um imóvel tem no máximo um, e a exclusividade é garantida pelo banco — não por conferência da aplicação.
_Evitar_: contrato atual, contrato em vigor, locação ativa, contrato válido

**Série declarada**:
O conjunto dos códigos legíveis de uma entidade, com escopo e contador próprios — o do contrato inclui o ano, e por isso reinicia a cada ano. O número nunca é reusado e a sequência admite furo.
_Evitar_: numeração, sequência, autoname, contador sequencial

**Carteira**:
O conjunto dos registros de um tipo que a empresa administra. **Sempre qualificada** — carteira de imóveis, carteira de contratos, carteira de cobranças —, porque desqualificada ela não diz de quê.
_Evitar_: portfólio, base, cadastro geral, "a carteira" sem qualificação

**Metragem total**:
A soma das metragens dos cômodos de um imóvel, calculada pelo servidor a cada leitura e nunca informada diretamente. Cômodo sem metragem informada conta como zero.
_Evitar_: área, área total, metragem do imóvel, tamanho

**Identificador municipal**:
O identificador do imóvel perante a prefeitura, informado no cadastro, obrigatório e único dentro de cada empresa. É o identificador externo do imóvel — não se confunde com a chave que a API expõe.
_Evitar_: inscrição, matrícula, IPTU, cadastro municipal, código do imóvel

**Cobrança**:
O fato financeiro que a imobiliária lança contra um contrato de locação — um valor a receber com competência, vencimento e natureza próprios. Tem código legível próprio, nasce da ativação do contrato ou de lançamento avulso, e nunca é apagada.
_Evitar_: título, fatura, lançamento, conta a receber, débito, parcela

**Cobrança em aberto**:
Cobrança que ainda pode ser paga ou cancelada — não foi liquidada nem cancelada. Operacionalmente: sem data de pagamento e sem instante de cancelamento. É sobre ela, e só sobre ela, que a mora é apurada.
_Evitar_: cobrança pendente, cobrança ativa, em atraso, dívida aberta

**Mora**:
O acréscimo devido pelo atraso de uma cobrança — a multa somada aos juros. É derivada da política vigente enquanto a cobrança está em aberto, e vira carimbo no ato que a liquida.
_Evitar_: atraso, encargo, acréscimo, juros e multa, penalidade

**Configuração de mora**:
A política de multa e juros **de uma empresa** — um par de percentuais, um por empresa. Empresa que nunca a definiu apura mora zero: a ausência e o par zerado são a mesma coisa.
_Evitar_: atraso, parâmetros de multa, regra de juros, política de cobrança

**Carimbo**:
O valor que era derivado e passa a ser gravado no instante do ato que liquida um fato financeiro, junto da configuração que o produziu. Depois de carimbado não muda mais, e mudar a política não o alcança.
_Evitar_: snapshot, congelamento, valor fixado, histórico

**Natureza da cobrança**:
Aquilo que a cobrança cobra, escolhido de uma lista fechada — aluguel, água, condomínio, energia ou outro. É campo próprio, e a distinção nunca se faz interpretando texto.
_Evitar_: tipo, categoria, espécie, classificação, tipo de título

**Competência**:
O mês a que a cobrança se refere, representado sempre pelo primeiro dia dele. Não se confunde com o vencimento, que é quando ela deve ser paga.
_Evitar_: mês de referência, período, mês, data-base

**Referência**:
O rótulo em texto livre que descreve a cobrança para quem a lê — no aluguel, o intervalo do período coberto. É legenda, nunca critério: somar por tipo se faz pela **Natureza da cobrança**.
_Evitar_: descrição, histórico, observação, título, memorando

**Retirada de circulação**:
A operação que tira um cadastro das escolhas e das listagens sem apagá-lo: ele deixa de ser oferecido ao montar um contrato, permanece legível por quem já o referencia, e pode voltar à circulação.
_Evitar_: exclusão, excluir, remoção, desativação, arquivamento, soft delete

**Aviso**:
A mensagem que o sistema entrega ao **Locatário** sobre uma **Cobrança** que vai vencer ou já venceu.
_Evitar_: cobrança (para a mensagem), e-mail de cobrança, notificação, lembrete, comunicado

**Régua de cobrança**:
O trabalho que percorre as cobranças em aberto de uma **Empresa** e decide quais delas recebem **Aviso**.
_Evitar_: régua (desqualificada), automação de cobrança, rotina de cobrança, política de cobrança

**Janela de horário**:
O intervalo do dia, declarado pela **Empresa**, dentro do qual a **Régua de cobrança** tem permissão de entregar **Avisos** — ela diz *quando é permitido*, nunca *quando acontece*.
_Evitar_: horário de envio, agendamento, gatilho de horário, janela de execução

**Tentativa de envio**:
O fato registrado a cada vez que o sistema tenta entregar um **Aviso** — existe mesmo quando nada saiu, e nunca é apagada nem alterada.
_Evitar_: envio (para a tentativa que falhou), log de e-mail, histórico de disparo

**Desfecho**:
O que aconteceu com uma **Tentativa de envio**: entregue, falhou, ou não havia endereço de contato.
_Evitar_: status do envio, resultado, situação da mensagem

**Documento do contrato**:
A representação em PDF de um **Contrato de locação**, composta a partir do cadastro no instante em que é pedida e nunca guardada.
_Evitar_: PDF do contrato, arquivo do contrato, contrato gerado, minuta

**Marca de cancelamento**:
O que o **Documento do contrato** passa a carregar quando o contrato está cancelado, produzido como parâmetro da composição e nunca mesclado sobre um arquivo pronto.
_Evitar_: carimbo, tarja, selo, watermark, marca d'água

**Portador de confirmação**:
O segredo sorteado que autoriza o **Locatário** a confirmar o próprio endereço de e-mail sem ter sessão, guardado apenas como derivado, com prazo e de efeito único.
_Evitar_: token, link mágico, chave de confirmação, magic link

**Veredito de divergência**:
A decisão, escrita **antes** da execução, sobre o que fazer com cada diferença medida entre o produto novo e o sistema antigo — quem vence, ou por que a diferença não é diferença.
_Evitar_: exceção, desvio aceito, diff conhecido, waiver

## Relacionamentos

- Uma **Cobrança** pode originar um boleto junto a um **Provedor**.
- Uma **Empresa** tem no máximo uma configuração da **Régua de cobrança**, e ela nasce desligada.
- A **Régua de cobrança** é sempre de uma **Empresa** só — não existe percurso que atravesse empresas.
- Um **Aviso** é sobre exatamente uma **Cobrança**, e vai ao **Locatário** do **Contrato de locação** dela.
- Toda entrega de **Aviso** produz exatamente uma **Tentativa de envio**, que tem exatamente um **Desfecho**.
- Uma **Cobrança** paga ou cancelada **nunca** origina **Aviso**, por caminho nenhum.
- Toda **Cobrança** pertence a exatamente um **Contrato de locação**, e o **Locatário** dela é o do contrato — nunca um vínculo próprio.
- Toda **Cobrança** consome, ao nascer, um número da **Série declarada** dela, cujo escopo inclui o ano.
- Uma **Cobrança em aberto** apura **Mora** pela **Configuração de mora** da **Empresa** dela; uma cobrança liquidada publica **Carimbos** e não reapura.
- Uma **Empresa** tem no máximo uma **Configuração de mora**; a ausência dela equivale ao par zerado.
- Toda **Cobrança** tem exatamente uma **Natureza da cobrança**, uma **Competência** e uma **Referência**.
- A **Ativação de contrato** produz zero ou mais **Cobranças**; o **Cancelamento de contrato** cancela as que estiverem em aberto.
- Todo boleto emitido consome exatamente um valor do **Contador sequencial**, e recebe um **Identificador perante o provedor** que o compõe com o prefixo de competência.
- Todo boleto emitido tem **dois** identificadores, em sentidos opostos: o **Identificador perante o provedor**, que o produto compõe e envia, e o **Número do título no provedor**, que o provedor atribui e devolve. Ambos são guardados; só o segundo é publicado.
- Uma **Notícia do provedor** é sobre exatamente uma **Cobrança**, e é o **Identificador perante o provedor** — emitido por nós e devolvido por ele — que descobre qual, e com ela a **Empresa**.
- Uma **Notícia do provedor** guarda exatamente um **Recebido cru**, com prazo; o efeito que ela leva a registrar não tem prazo.
- Uma **Liquidação** descoberta por **Notícia do provedor** tem exatamente um **Identificador da liquidação**, e é ele que a torna única.
- Um **Carnê** reúne os boletos de zero ou mais **Cobranças** de exatamente um **Contrato de locação**; ele não existe fora do pedido que o compôs.
- Uma **Empresa** tem no máximo um **Certificado do provedor** valendo por vez; registrar um novo substitui o anterior, cujo **Segredo operável** deixa de existir no mesmo ato.
- Uma **Empresa** sem **Certificado do provedor** não opera contra o **Provedor** — e a recusa a nomeia, em vez de recorrer à identidade de outra.
- O material e a senha de um **Certificado do provedor** são um **Segredo operável**; a **Senha provisória** e o **Portador de confirmação** não são.
- Toda **Cobrança** que vai ao **Provedor** o faz por exatamente um **Meio de recebimento**.
- Um **Boleto em aberto** pertence a uma **Cobrança** e foi emitido sob uma configuração de um **Provedor**.
- Toda informação de negócio pertence a exatamente uma **Empresa**.
- Um **Admin Empresa** e um **Usuário Empresa** pertencem a exatamente uma **Empresa**; um **Sysloc Master** não pertence a nenhuma.
- Uma pessoa tem um **Vínculo de acesso** por **Empresa** em que atua.
- Uma **Senha provisória** pertence a uma conta e deixa de valer na primeira troca.
- O **Efetivo de permissão** de uma pessoa deriva do perfil dela e dos **Ajustes individuais** que ela tem.
- Toda **Ação sensível** pertence a exatamente uma **Área de tela**, e só vale para quem alcança essa área.
- Um **Ajuste individual** existe sobre um **Vínculo de acesso** — logo não existe para quem não pertence a nenhuma **Empresa**, como o **Sysloc Master**.
- Um **Conjunto** agrupa zero ou mais **Imóveis**; um **Imóvel** pertence a exatamente um **Conjunto**.
- Um **Imóvel** tem zero ou mais **Cômodos**, e a **Metragem total** dele é a soma das metragens deles.
- Um **Imóvel** tem exatamente um **Identificador municipal**, único dentro da **Empresa**.
- **Locador**, **Locatário** e **Fiador** são cadastros distintos, cada um com o próprio documento único por **Empresa** — a mesma pessoa pode existir nos três papéis.
- A **Retirada de circulação** alcança **Conjunto**, **Imóvel**, **Locador**, **Locatário**, **Fiador** e **Contrato de locação**; não alcança **Cômodo**, que é removido de fato, nem o vínculo entre contrato e fiador, cuja linha se remove.
- Um **Contrato de locação** liga exatamente um **Imóvel**, um **Locador** e um **Locatário**, todos da mesma **Empresa**, e tem zero ou mais **Fiadores**.
- Um **Contrato de locação** nasce em **Rascunho**, passa a vigorar pela **Ativação de contrato** e deixa de vigorar pelo **Cancelamento de contrato**.
- Um **Imóvel** tem no máximo um **Contrato vigente**; um **Contrato vigente** ocupa exatamente um **Imóvel**.
- Todo **Contrato de locação** consome, ao nascer, um número da **Série declarada** dele — e o consome para sempre, mesmo que a criação seja abortada.
- A **Ativação de contrato** e o **Cancelamento de contrato** são **Ações sensíveis**, ambas dentro da **Área de tela** Contratos.
- A **Retirada de circulação** de um **Contrato de locação** não muda o estado dele nem libera o **Imóvel** — ela é ortogonal ao ciclo de vida.
- Todo **Contrato de locação** tem exatamente um **Documento do contrato**, e ele não existe entre um pedido e outro: é composto a cada vez, de modo que documento e cadastro não têm como discordar.
- O **Cancelamento de contrato** faz o **Documento do contrato** passar a carregar a **Marca de cancelamento**, sem que nada seja regravado.
- Um **Locatário** tem zero ou mais **Portadores de confirmação**; emitir um novo invalida os anteriores daquele locatário.
- Um **Portador de confirmação** resolve exatamente um **Locatário** de exatamente uma **Empresa**, e é dele que sai a empresa do ato — nunca do pedido.

## Ambiguidades resolvidas

- **"Baixa" nomeava dois atos opostos.** No sistema antigo, *solicitar baixa* é **pedir a revogação** de um boleto vivo — o oposto de receber; no discovery e na fala corrente, "baixa" é **receber**. Resolvido no challenge de `emissao-e-conciliacao` (2026-08-16): a palavra não se usa. O ato que torna o boleto impagável é a **Revogação de boleto**; o ato que registra o pagamento é a **Liquidação**. A chave de permissão `ACAO:solicitar_baixa_de_boleto` preserva o nome histórico — é do catálogo fechado e persistida —, e governa a **revogação**.
- **"Retirada de circulação" foi reusada para o boleto, e não podia.** Resolvido no mesmo challenge: o termo é do **cadastro** (visibilidade em listagens e escolhas) e esta mesma seção já registrava que ele *"não alcança a cobrança: é operação sobre cadastro, não sobre fato financeiro"*. O ato sobre o instrumento de pagamento é a **Revogação de boleto**, com símbolos, rota e tipo de evento próprios. Dois conceitos sem parentesco não compartilham nome.
- **"Número do título" estava listado como alias a evitar do Identificador perante o provedor, e passou a nomear conceito próprio.** Resolvido no challenge de `emissao-e-conciliacao` (2026-08-16): o produto guarda **dois** identificadores de sentidos opostos, e a lista de evitados do primeiro tratava o segundo como se fosse ele. O que o produto compõe e envia é o **Identificador perante o provedor**; o que o provedor atribui e devolve é o **Número do título no provedor**, publicado como `numeroDoTituloNoProvedor`. O alias "nosso número" continua proibido para **os dois** — é o vocabulário do provedor que a ADR-0001 barra —, e a coluna física `nosso_numero`, herdada da migração `0009`, é renomeada para `numero_do_titulo_no_provedor` pela fatia `webhook-e-carne` (2026-08-18), que fecha o débito D14 · F4/T6 ao consumi-la.
- **"Notificação" nomeava o aviso do provedor e o aviso de cobrança ao locatário — dois atos em sentidos opostos.** Resolvido no challenge de `webhook-e-carne` (2026-08-18): o que **chega** do provedor por iniciativa dele é a **Notícia do provedor**; o que **sai** do produto para o locatário é o **Aviso**, da régua de cobrança. "Webhook" e "callback" são vocabulário de transporte e não nomeiam nenhum dos dois.
- **"Baixa" tinha um terceiro uso, no identificador que o provedor devolve.** Resolvido no mesmo challenge: o valor que torna um recebimento único é o **Identificador da liquidação**. A palavra "baixa" continua fora do vocabulário, pelas razões já registradas acima.
- "Seu número" era usado tanto para o **Contador sequencial** quanto para o identificador completo enviado ao provedor (prefixo + contador). Resolvido: são conceitos distintos — o contador é o valor incremental; a composição enviada é o **Identificador perante o provedor**, que agora tem termo próprio.
- **"Contador sequencial" foi definido como *"mantido pela imobiliária"*, e isso era falso.** Resolvido no challenge de `fundacao-bancaria` (2026-08-14): o escopo dele é **o SaaS inteiro**. A definição antiga vinha de um sistema que atendia uma empresa só, onde os dois escopos coincidiam; com duas imobiliárias emitindo no mesmo mês, um contador por empresa faz dois boletos disputarem o mesmo número. A regra geral que reconcilia os três contadores do produto é que **cada série declara o próprio escopo** — duas por `(empresa, ano)`, uma pelo SaaS —, e ela está fixada na **ADR-0033** (2026-08-14), que superseded a ADR-0015 por esta exata razão: a `Decision` de lá abria com *"todo contador sequencial deste produto é único por empresa"*, quantificador universal que este contador falsifica.
- "Certificado" era usado tanto para o material que a empresa entrega ao produto quanto para o registro que o produto publica sobre ele. Resolvido: o termo é **Certificado do provedor** e nomeia o registro; o material e a senha dentro dele são o **Segredo operável**, e é essa metade que nunca volta.
- "Segredo" nomeava indistintamente o que se confere e o que se usa. Resolvido: o que se confere vai resumido e irreversível (**Senha provisória**, **Portador de confirmação**); o que se **usa** é o **Segredo operável**, cifrado de forma reversível. A distinção existe para que ninguém "corrija" a cifra reversível em nome da coerência.
- "Banco" era usado tanto para a instituição financeira quanto para o banco de dados. Resolvido: a instituição é **Provedor**; banco de dados permanece "banco de dados".
- "Usuário" era usado tanto para qualquer pessoa autenticada quanto para o perfil sem poderes administrativos. Resolvido: pessoa autenticada é "pessoa" ou "conta"; o perfil é **Usuário Empresa**.
- "Empresa" e "tenant" apareciam como sinônimos em textos técnicos. Resolvido: o termo do produto é **Empresa**; "tenant" fica restrito à discussão de isolamento no banco, nunca à API nem à interface.
- "Carimbo" era o nome que o sistema antigo dava à marca do documento cancelado, e o produto já usa **Carimbo** para o valor financeiro gravado no instante da liquidação. Resolvido: são conceitos distintos e sem parentesco — a marca do documento é **Marca de cancelamento**, e **Carimbo** permanece exclusivamente financeiro. A colisão é a razão de o termo novo existir.
- "Permissão" era usado tanto para uma chave isolada quanto para o conjunto que a pessoa alcança. Resolvido: a chave é uma **Área de tela** ou uma **Ação sensível**; o conjunto é o **Efetivo de permissão**.
- "Excluir cadastro" nomeia a **Ação sensível** do catálogo (chave `ACAO:excluir_cadastro`, fechada desde a F1 e persistida em `acesso_usuario_permissao` — não renomeável), mas a operação que ela governa **não exclui**: ela é a **Retirada de circulação**, e nada é apagado (ADR-0014). Resolvido: a chave preserva o nome histórico; o termo do domínio, das rotas e da documentação é *retirada de circulação*.
- "Metragem" era usada tanto para a metragem de um **Cômodo** quanto para a do imóvel inteiro. Resolvido: a do cômodo é *metragem*; a do imóvel é **Metragem total**, e é derivada, nunca informada.
- "Cadastro" era usado tanto para as entidades de negócio quanto para pessoas do sistema. Resolvido: cadastro é entidade de negócio (**Conjunto**, **Imóvel**, **Locador**, **Locatário**, **Fiador**, **Contrato de locação**); quem entra no sistema é pessoa, com **Vínculo de acesso**.
- "Contador sequencial" nomeava dois números incompatíveis: o do boleto perante o provedor, que **nunca reinicia**, e o de um código legível como `CTR-2026-00001`, que **reinicia a cada ano**. Resolvido: o primeiro continua sendo o **Contador sequencial** (exigência do provedor); o segundo é o contador de uma **Série declarada**, cujo escopo cada série declara.
- "Carteira" nomeava tanto a árvore de conjuntos com os imóveis de cada um quanto a lista de contratos da empresa. Resolvido: **Carteira** é sempre qualificada — de imóveis, de contratos, de cobranças —, e o termo desqualificado não é usado.
- "Novo título" era o texto pelo qual o sistema antigo distinguia uma cobrança que não é aluguel — a **Natureza da cobrança** não existia lá, e a distinção se fazia lendo a **Referência**. Resolvido: são campos distintos, e a natureza é a única que se soma, filtra e agrupa; a referência é legenda.
- "Em aberto" nomeava tanto o **Boleto em aberto** quanto a **Cobrança em aberto**. Resolvido: são níveis diferentes — a cobrança é o fato financeiro; o boleto é o instrumento que um **Provedor** emite para ela. Nem toda cobrança em aberto tem boleto.
- "Atraso" nomeava três coisas: o fato de estar vencida, o valor devido pelo atraso e a política que o calcula. Resolvido: o estado é *vencida*; o valor é a **Mora**; a política é a **Configuração de mora**.
- "Cancelar uma cobrança" e "excluir uma cobrança" eram lidos como a mesma coisa. Resolvido: cancelar é transição de estado que preserva o registro e o código consumido — e é a única que existe. Cobrança **nunca é apagada**, e a **Retirada de circulação** não a alcança: ela é operação sobre cadastro, não sobre fato financeiro.
- "Cancelar" e "encerrar" eram usados como sinônimos para tirar um contrato de vigência. Resolvido: são estados distintos e têm produtores distintos — o **Cancelamento de contrato** é decisão de uma pessoa, com ação sensível própria; o encerramento é consequência do vencimento do prazo, escrito por rotina agendada.
- "Excluir um contrato" era lido tanto como cancelá-lo quanto como tirá-lo das listagens. Resolvido: cancelar é transição de estado que libera o **Imóvel**; **Retirada de circulação** é visibilidade e não libera nada. Um rascunho abandonado se retira, não se cancela.
- "Cobrança" era usado tanto para o **fato financeiro** quanto, coloquialmente, para a mensagem que o sistema envia ao inadimplente. Resolvido: são conceitos distintos — o fato é a **Cobrança**; a mensagem é o **Aviso**. ⚠️ A chave do catálogo `ACAO:enviar_cobranca_manual` preserva o nome histórico (o catálogo é fechado desde a F1 e persistido em `acesso_usuario_permissao` — não renomeável), e **não** redefine "cobrança": o que ela governa é o envio de um **Aviso**. Mesmo caso, e mesma resolução, de `ACAO:excluir_cadastro` acima.
- "Régua" nomeava tanto a **configuração** quanto o **trabalho** que a aplica. Resolvido: o trabalho é a **Régua de cobrança**; a configuração que ele lê é a *política de aviso*, termo do glossário da feature `regua-de-cobranca`. O pacote `@sysloc/regua` e a fila `regua-de-cobranca` nomeiam o trabalho, coerentes com esta resolução.
