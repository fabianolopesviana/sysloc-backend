# Insumo para o pré-refinamento — `integracao-bancaria-autonoma/v1` (F5, fatia i)

> **Como usar.** Este arquivo é a **entrada** do `/agent-spec-pre-refinement`. Ele carrega o problema
> de produto, o que já está medido, o que está decidido e o que continua em aberto. Não é spec: é o
> material para o discovery discutir.
>
> ⚠️ **Modelo**: este projeto roda **exclusivamente em Opus** (`CLAUDE.md`, sem negociação). Onde o
> `SKILL.md` recomendar Sonnet, leia Opus.
>
> ⚠️ **Idioma**: português brasileiro em tudo — raciocínio exibido, perguntas e artefato.

---

## 1. O problema, em uma frase

**Duas coisas da integração bancária só funcionam hoje com alguém logado no servidor** — e num SaaS
multiempresa isso não escala: cada cliente novo e cada renovação de certificado viram um chamado
para quem opera a máquina.

---

## 2. As duas frentes, e por que são a mesma fatia

Elas nasceram de dois achados independentes, em dias seguidos, contra a **API e o certificado
reais**. São problemas diferentes com **a mesma forma**: o Admin da imobiliária precisa resolver
sozinho, pela tela, e hoje não consegue.

### Frente A — ativar o webhook do provedor, por cliente

O cadastro do webhook no provedor é **por cliente** (`numeroCliente`), feito com o certificado e o
identificador de aplicação **daquele cliente**. Ninguém consegue fazer por ele sem ter as credenciais
dele.

⚠️ **A URL é UMA SÓ, e isso já está resolvido — não reabra.** Os N clientes cadastram webhooks
apontando para o **mesmo** endereço público. O roteamento é pelo identificador que o próprio produto
emitiu (único no SaaS inteiro), e a empresa é **derivada da cobrança encontrada**, nunca do corpo
recebido. Não há subdomínio, vhost nem rota por cliente. O que falta é **o ato de ativar**.

### Frente B — aceitar o certificado como a Autoridade Certificadora o entrega

A AC entregou o material em **cifra legada** nas **duas emissões consecutivas** (julho/2025 e
agosto/2026). O runtime do produto recusa, a rota devolve erro **culpando a senha**, e o Admin — que
renova pela tela — não tem como saber nem como contornar. Existe um script que converte, mas ele é
de **servidor**: exige acesso à máquina, que o Admin não tem e não deve ter.

---

## 3. O que já está MEDIDO (não é hipótese, e não precisa ser redescoberto)

| Achado | Evidência |
|---|---|
| O cadastro de webhook é **único por (cliente, tipo de movimento, período)** | recusa `10260` do provedor, contra a conta real |
| Só existe **um** período válido para o tipo de movimento que interessa | recusa `10262` em todos os outros valores sondados |
| A concessão de credencial para a família de webhook exige **escopos próprios** | os escopos de boleto obtêm token, mas o gateway recusa a operação com `401` |
| **Não existe escopo de exclusão** de webhook | recusa `invalid_scope` na concessão |
| A AC entrega em **cifra legada** | duas emissões consecutivas; o runtime falha ao abrir as duas |
| Conversão preserva o certificado | série, titular e validade idênticos antes e depois, afirmado por medição |
| Um cliente real **já tem a vaga ocupada** por sistema de terceiro | consulta à conta real; **o webhook dele é intocável, por decisão do usuário** |

---

## 4. O comportamento de produto que o usuário JÁ definiu

Isto **não está em aberto** — é requisito, e o discovery deve partir dele:

> Um botão **"Habilitar webhook"** dentro da integração do provedor, por cliente. Ele dispara o ciclo
> **cadastrar → consultar para confirmar**. A tela exibe **Habilitado** somente se os dois derem
> positivo. Caso contrário, exibe **Desabilitado** com o **motivo completo** — a mensagem íntegra e
> todos os dados que o provedor devolveu — e um botão **"Tentar novamente"**, que repete o mesmo
> ciclo. **Com o webhook desabilitado, o produto opera normalmente** pela conferência por consulta.

⚠️ **O cliente que tem a vaga ocupada é o teste vivo desse desenho**: ele vai clicar, receber a
recusa do provedor, e a tela vai mostrar o motivo. Não é exceção a tratar — é o fluxo funcionando.

---

## 5. O que está DECIDIDO e não se reabre

1. **Uma URL para todos os tenants.** Roteamento por identificador próprio; empresa derivada do dado
   encontrado. Já implementado e em produção.
2. **A degradação é primeira classe.** Sem webhook, a conferência por consulta liquida e estorna. Já
   implementado; a fatia **declara e testa**, não constrói.
3. **A porta nova é conforme à arquitetura** — porta irmã de configuração, autorizada por critério de
   classe já registrado. **Não há ADR nova nem emenda a fazer.** O precedente é a porta de identidade
   bancária, cuja conformidade é varrida por teste; a fatia **estende** aquele caso.
4. **Nenhum vocabulário do provedor cruza a porta.** Os termos da família de webhook já foram
   acrescentados à lista varrida **antes** de existir a porta — de propósito, para que não nasçam
   contornados.
5. **O webhook de terceiro de um cliente específico é intocável.** Nada na fatia pode alterar,
   desativar ou substituir cadastro que não seja do próprio produto.

---

## 6. O que está EM ABERTO — o material do discovery

### 6.1 A forma da conversão do material (frente B) — **decisão de arquitetura não tomada**

Três candidatas, com custo e risco registrados. ⚠️ A mais barata é a que o registro recomenda
**recusar**:

| Forma | Custo | Risco |
|---|---|---|
| Converter no servidor, invocando a ferramenta de linha de comando já presente no host | baixo; o roteiro está provado | o produto passa a executar processo externo |
| Ligar o provider legado no runtime | baixíssimo — uma flag | ⚠️ habilita cifra fraca **no processo inteiro**, que é o mesmo que manipula todo segredo operável |
| Biblioteca de terceiro em JS | médio; dependência nova | traz código de criptografia de terceiro para o caminho do segredo |

### 6.2 Perguntas de produto a explorar

1. **O que a tela mostra quando o material foi convertido?** O arquivo que o Admin guardou não é byte
   a byte o que o produto usa. Ele precisa saber? Isso muda a confiança dele no registro?
2. **Ativar o webhook é ato sensível?** Ele muda como o dinheiro chega ao produto. Merece a mesma
   cerimônia de outros atos sensíveis, ou é configuração comum?
3. **O estado do webhook precisa ser reconferido sozinho?** O provedor pode desativar um webhook que
   falha muito. O produto descobre isso quando? Só quando alguém abrir a tela?
4. **A recusa fica registrada por quanto tempo?** O motivo da última tentativa é dado que a tela lê —
   ele expira? Vira trilha?
5. **Quem pode ativar?** A mesma chave que configura certificado, ou é ato mais restrito?
6. **O que acontece na renovação do certificado com webhook já ativo?** O cadastro no provedor
   sobrevive à troca do material, ou precisa ser reconfirmado?
7. **A tela deve oferecer desativar?** Não há escopo de exclusão no provedor — só alteração. Isso
   muda o que é possível prometer.

---

## 7. Restrições que a fatia herda

- **Multi-tenancy é do banco**: tabela nova nasce com dono-empresa, isolamento forçado e chave
  composta. Sem exceção.
- **Segredo de terceiro é cifrado e não retorna por superfície alguma** — provado por medição da
  saída real, nunca por leitura de código.
- **Entrada fechada, saída da projeção que pode carregar segredo também fechada.**
- **Esta é a última fatia da INTEGRAÇÃO BANCÁRIA que acrescenta rota.** ⚠️ Não é a última da F5: a
  fatia (ii) ainda pode publicar — a tela de saúde das rotinas é leitura tenantizada e precisa de
  rota. O congelamento é **depois da F5 inteira**, não depois desta fatia. O que não entrar na F5
  não entra mais antes do handoff.
- **O handoff do frontend depende dela**: a tela do botão é implementada fora deste repositório, a
  partir do que esta fatia publicar.

---

## 8. Referências dentro do repositório

| O quê | Onde |
|---|---|
| A fase e as duas frentes | `docs/plano-backend-novo/plano-execucao.md` §F5 |
| O painel de estado | `docs/plano-backend-novo/roadmap.md` |
| O débito da frente B, com as três formas | `docs/specs/features/fundacao-bancaria/v1/_run/run-report.md` §2, `D64` |
| A recepção da notícia, já implementada | `docs/specs/features/webhook-e-carne/v1/` |
| O que o frontend precisa saber | `docs/plano-backend-novo/levantamento-frontend.md` §8 |
| O runbook da borda em produção | `deploy/scripts/borda/prompt-de-ativacao-do-webhook.md` |
| O script que converte o material | `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` |
