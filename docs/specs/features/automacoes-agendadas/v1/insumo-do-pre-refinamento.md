# Insumo para o pré-refinamento — `automacoes-agendadas/v1` (F5, fatia ii)

> **Como usar.** Entrada do `/agent-spec-pre-refinement`. Carrega o problema de produto, o que já
> está decidido, o que **mudou** desde a decisão original, e a dúvida que precisa ser resolvida
> **antes** de a fatia começar.
>
> ⚠️ **Rode esta fatia DEPOIS que a `integracao-bancaria-autonoma/v1` fechar.** As duas são
> independentes em domínio, mas a ordem da F5 é sequencial e a primeira é pré-condição de operação.
>
> ⚠️ **Modelo**: este projeto roda **exclusivamente em Opus**. Onde o `SKILL.md` recomendar Sonnet,
> leia Opus. ⚠️ **Idioma**: português brasileiro em tudo.

---

## 0. ⚠️ AÇÃO PRÉVIA — resolva ANTES de rodar o discovery

Existe uma dúvida aberta desde o pré-refinamento original, marcada por escrito como
**"necessário antes da F5"**, e ela nunca foi resolvida:

> **Qual é o crontab real do root do servidor antigo?** Os dois levantamentos **divergem no horário**
> de uma das rotinas (`1 0 * * *` contra `10 0 * * *`), e **ambos vieram de documentação mantida à
> mão**, não do agendador.

Colete com `sudo crontab -l` (e confira também `/etc/cron.d/`) **antes** do discovery. Sem isso, a
fatia porta um horário que ninguém verificou — e o sintoma de errar seria uma rotina rodando na hora
errada, todos os dias, sem nada acusar.

---

## 1. O problema, em uma frase

**O que hoje roda sozinho no sistema antigo precisa continuar rodando sozinho no novo** — e o
agendamento atual é frágil de três formas medidas: pula o dia em silêncio quando a máquina está fora
do ar, varre trabalho que não existe, e não avisa quando para.

---

## 2. O que existe hoje, e o que está errado nele

| Hoje (sistema antigo) | O defeito medido |
|---|---|
| Cron do root chamando script no contêiner | **global**, não por empresa; e o agendador do arcabouço antigo **já parou sem aviso em produção** |
| A rotina de cobranças varre **todas** as cobranças abertas a cada minuto | trabalho inútil a cada disparo, e escrita na configuração a cada execução — produziu um log de **10 MB** |
| Nada avisa quando uma rotina para | descoberta pelo efeito: alguém repara que o e-mail não saiu |
| Máquina fora do ar na hora marcada | o dia é **pulado em silêncio** |

---

## 3. O que já está DECIDIDO — e o que MUDOU desde a decisão original

⚠️ **Uma decisão foi superada, e o discovery precisa saber, ou vai reabri-la:**

> **A decisão original dizia "manter o cron do sistema operacional".** Ela foi **refinada**: o gatilho
> passa a ser **systemd timer**, com `Persistent=true`. A razão do refinamento é o defeito da última
> linha da tabela acima — `Persistent=true` faz o timer **disparar ao voltar** em vez de pular o dia,
> que é exatamente o que o cron não faz. **Não reabra "cron ou timer": está decidido, e a razão é
> medida.**

O que permanece decidido:

1. **Timers versionados** no repositório, instalados por script **idempotente** — rodar duas vezes
   não duplica entrada.
2. **Despachante por horário**: uma consulta barata por minuto — *quais empresas têm horário
   configurado para agora* — e enfileira **só essas**. Substitui a varredura geral.
3. **Um job por empresa ativa**, com **falha isolada** (erro em A não impede B) e **lock** por
   (empresa, rotina).
4. **Histórico gravado só quando houve trabalho**, com expurgo automático — não uma linha por
   disparo vazio.
5. **Suspensão congela tudo; reativação põe em dia** — sem disparar nada retroativo.
6. **Régua não reenvia retroativo na reativação** — o locatário não recebe uma enxurrada de avisos
   antigos.
7. **`OnFailure=` alimenta o alerta.**

---

## 4. O que a fatia herda pronto (não construa de novo)

O trabalho de fundo **já existe e está em produção**. A fatia é **agendamento**, não processamento:

| Já implementado | O que faz |
|---|---|
| Seis filas de trabalho | régua, confirmação, emissão em lote, conferência bancária, notícia bancária, eco |
| Processo de trabalho próprio, com unidade systemd | consome as filas, com contexto de empresa por carga |
| Conferência bancária | consulta o provedor e liquida ou estorna — **é a rotina diária mais importante da F5** |
| Emissão em lote | emite boletos da competência |
| Régua de cobrança | avisos configuráveis por empresa |

⚠️ **Hoje existem duas unidades systemd (serviço da API e do trabalhador) e NENHUM timer.** O que
falta é quem **dispara** as rotinas, e a maquinaria de saúde em volta disso.

---

## 5. Perguntas de produto a explorar

1. **Quais rotinas, exatamente?** A conferência bancária diária é certa. A emissão em lote é
   agendada ou sempre por ato do Admin? A régua roda de quanto em quanto tempo?
2. **O horário é por empresa ou do SaaS?** A decisão do despachante pressupõe horário **por
   empresa** — isso é configurável na tela? Por quem?
3. **O que é "rotina atrasada"?** Quanto tempo sem executar dispara alerta? É por rotina ou uma
   régua só? Quem recebe — o operador do SaaS, o Admin da empresa, os dois?
4. **A tela de saúde é de quem? — há uma recomendação, e ela tem razão estrutural.**
   **Recomendado: por tenant, no app de locação; NENHUMA tela nova no painel do operador.** O
   critério não é "de quem é a informação", e sim **quem age quando a rotina falha**: certificado
   vencido, identidade ausente, webhook desabilitado e e-mail rejeitado são **configuração do
   Admin**; timer parado e processo caído são **infraestrutura do operador**, e para isso o
   `OnFailure=` e o diário do sistema já bastam — construir tela seria fazer monitoramento dentro do
   produto.
   ⚠️ **O argumento que decide é o isolamento**: o histórico de execução é **tenantizado** (decisão
   28, "registro por empresa"), logo tem dono-empresa e vive sob isolamento do banco — e o operador
   do SaaS **não o alcança**, por invariante. Uma tela dele ou violaria o isolamento, ou mostraria
   agregado anônimo que não diz a ninguém o que fazer.
   **Consequência:** a fatia publica **rota nova** (estado atual das rotinas da empresa, e histórico
   recente), sob as chaves da empresa. É leitura tenantizada e cabe no isolamento sem exceção.
   O discovery pode divergir, mas divergir exige derrubar o argumento do isolamento.
5. **"Pôr em dia ao reativar" significa o quê, concretamente?** Rodar as rotinas perdidas uma vez?
   Só a última? Nenhuma, e apenas retomar o ciclo?
6. **O histórico é dado de produto ou de operação?** Se o Admin o vê, precisa de vocabulário do
   produto; se só o operador, pode ser mais cru.
7. **O alerta sai por qual canal?** Há e-mail no produto; há também o diário do sistema. Alerta de
   rotina parada por e-mail depende do e-mail estar funcionando — o que pode ser justamente o que
   quebrou.

---

## 6. Restrições que a fatia herda

- **Tudo sobe sozinho após reboot** — é invariante do projeto, testado com reinício real. Timer novo
  entra nessa prova.
- **Falha isolada por empresa** — o erro de uma não pode parar as outras. Isso é multi-tenancy no
  agendamento, e vale como invariante.
- **Instalador idempotente** — rodar duas vezes produz o mesmo estado, sem duplicar unidade.
- **Nenhum segredo em script versionado.**
- ⚠️ **Esta é a ÚLTIMA fatia que publica rota.** O congelamento da superfície é logo depois da F5, e
  é o item 2 do marco de entrega. A rota da tela de saúde (§5.4) precisa nascer **aqui** — depois
  disso, não entra mais antes do handoff do frontend.

---

## 7. Framework recomendado pelo plano

O plano de execução já indica **miniSpec** para esta fatia — *"porte com CA claros; o gatilho
(systemd timers) já está decidido"*. O discovery pode confirmar ou divergir, mas divergir exige
razão: a fatia é mais porte do que descoberta.

---

## 8. Referências dentro do repositório

| O quê | Onde |
|---|---|
| A fase e as duas fatias | `docs/plano-backend-novo/plano-execucao.md` §F5 |
| As decisões 25 a 31 | `.claude/plans/plano-saas-decisoes.md` |
| A dúvida do crontab (§0) | `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md`, item 5 |
| As unidades systemd existentes | `deploy/systemd/` |
| O processo de trabalho e as filas | `apps/worker/src/` |
| A conferência bancária, já implementada | `apps/worker/src/tarefas/conferencia-bancaria.ts` |
