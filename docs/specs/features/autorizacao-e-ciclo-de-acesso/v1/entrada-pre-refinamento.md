# Entrada do pré-refinamento — `autorizacao-e-ciclo-de-acesso` v1

> **Este arquivo é ENTRADA, não artefato gerado.** Ele é o prompt que se passa a
> `/agent-spec-pre-refinement`. O artefato que a skill produz é o `pre-refinement.md`, neste mesmo
> diretório — os dois não colidem, e manter a entrada ao lado da saída deixa rastreável o que foi
> pedido contra o que foi convergido.
>
> Escrito em 2026-08-03, logo após a fatia 1 da F1 fechar e ser provada de ponta a ponta no cluster
> real. Toda afirmação aqui foi conferida contra os artefatos citados.

---

Pré-refinamento da SEGUNDA E ÚLTIMA fatia da Fase 1 do backend nativo Sysloc:
`autorizacao-e-ciclo-de-acesso`, v1.

## Onde esta fatia se encaixa

A F1 foi desdobrada em duas fatias pela direção A3 do pré-refinamento da primeira
(`docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md`, Ramo A, linha 74),
cortando DEPOIS da autenticação. O corte isolamento × identidade foi explicitamente rebatido por
atravessar a camada 5 — a fonte legítima do `empresa_id` é a sessão, e cortar ali produziria
retrofit, contra o invariante 1 do CLAUDE.md.

A fatia 1 está CONCLUÍDA e provada de ponta a ponta no cluster real (11/11 tasks nos dois gates,
bateria agregada 7/7 e CT-006 aprovado por reinício real da máquina). Ela entregou: schema com
`empresa_id`, RLS forçada e FK composta em toda tabela de negócio; contexto por `AsyncLocalStorage`
mais `SET LOCAL`; guarda de cobertura sobre o catálogo; better-auth com barreira única de admissão
de sessão; e os 3 perfis apenas como RÓTULO. Dá para logar, e o isolamento está provado.

Esta segunda fatia é o que falta para valer o "o SaaS existe — vazio, mas completo" do fim da §F1
do plano de execução. Depois dela vêm F2 a F7.

## Leitura obrigatória antes de propor qualquer rumo

1. `docs/plano-backend-novo/plano-execucao.md` §F1 — a tabela do desdobramento e os itens 9 a 12
2. `docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md` — Ramos B, C, D e E
3. `docs/specs/features/fundacao-multitenancy-identidade/v1/tech_spec.md` — o que já existe
4. `docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md` §2 — os 15 débitos
   abertos, com atenção aos que caem aqui (abaixo)
5. `.claude/plans/plano-saas.md` — as 10 telas × 7 ações sensíveis
6. `docs/adr/0007`, `0008`, `0009` — ADRs ativas e vinculantes
7. `CLAUDE.md` e `.claude/rules/nao-regressao.md`

## Escopo — o que ESTA fatia entrega

- Item 9: autorização em `@sysloc/auth` — matriz 10 telas × 7 ações sensíveis, com o perfil como
  default e ajuste por usuário; o efetivo de cada pessoa é o do perfil com os overrides dela
- Item 10: objeto de sessão "gordo" com empresa, perfil, telas e ações liberadas, mais
  `versao_permissoes` — que muda também quando um override muda, não só quando muda o perfil
- Item 11: onboarding com senha temporária e troca obrigatória, nos dois caminhos
  (Master→Admin, Admin→Usuário)
- Item 12: suspensão de empresa encerra sessões ativas na hora, não no próximo login
- Rotas do Master para o ciclo de vida da empresa: criar empresa, criar o Admin inicial, suspender,
  reativar, listar

## Fora de escopo — já entregue na fatia 1, NÃO reabrir

Schema e RLS, FK composta, `SET LOCAL`, contexto por `AsyncLocalStorage`, guarda de cobertura,
better-auth (senha, bloqueio, sessão de 8h, 2FA, trilha de auditoria), barreira de admissão de
sessão, recusas indistinguíveis da RN-10, e os 3 perfis como rótulo.

## Direções JÁ CONVERGIDAS — trate como fechadas, não como opções

O pré-refinamento da fatia 1 convergiu quatro direções que dizem, cada uma, "Cai na fatia 2 do A3".
Reabri-las é regressão de decisão (R3 do Protocolo Antirregressão). Explore COMO implementá-las,
nunca SE:

- B2 — ciclo de vida da empresa em rota, e nada além
- C2 — perfil como default, ajuste por usuário
- D3 + D2 combinados — são DOIS eventos distintos que o plano trata como um só: suspender empresa
  ou desativar usuário APAGA as sessões (401); mudar permissão MANTÉM a sessão e invalida o efetivo
  pela comparação de `versao_permissoes`
- E1 — senha temporária exibida uma vez a quem cria, entregue fora de banda

Se alguma delas se mostrar inviável contra o terreno, PARE e escale ao usuário com a evidência —
não decida sozinho.

## Débitos abertos que esta fatia herda, com dono declarado

- D7 (F1/T6, tem marcador em `packages/auth/src/autenticacao.ts`) — criar pessoa pelo adaptador é
  INEXEQUÍVEL hoje: `perfil` e `empresa_id` não são campos do modelo `user` e o `INSERT` é recusado.
  O gatilho é a primeira rota de criação de pessoa, que é o onboarding desta fatia. A correção tem
  eixo de segurança: `perfil` aberto é elevação de privilégio; `empresa_id` aberto é fuga de tenant
- D21 (F1/T7, tem marcador, gatilho JÁ DISPARADO) — a recusa da barreira não desfaz o que
  `/change-password` já escreveu; dono declarado é esta fatia, que redesenha a troca de senha
- D5 (F1/T2) — nada no banco concilia `acesso_usuario_app.empresa_id` com `identidade.usuario`;
  o custo "se materializa na fatia de autorização"
- P-T6-1 e P-T6-2 (`fundacao-multitenancy-identidade/v1/tasks/T8.md` §7) — ABERTOS E SEM DONO.
  Exigem valor novo no enum `desfecho_tentativa` mais uma migração `0003`. Avalie no brainstorm se
  esta fatia os absorve: ela já vai mexer no mesmo enum, o que torna este o momento barato

## Critérios de aceitação da §F1 que só esta fatia satisfaz

- Revogação de permissão reflete na requisição seguinte
- Suspensão de empresa encerra sessões ativas na hora

## Restrições não negociáveis

- Português brasileiro em tudo; o projeto roda exclusivamente em Opus
- Os 8 invariantes do CLAUDE.md, com destaque para o 1 (multi-tenancy é fundação, não retrofit),
  o 2 (contexto nunca lido do request) e o 6 (a API fala camelCase)
- Protocolo Antirregressão (`.claude/rules/nao-regressao.md`): baseline antes e depois, e nenhuma
  alteração de código sob marcador `DECISÃO FECHADA` sem escalar
- A superfície da API será CONGELADA no marco de entrega — as rotas que esta fatia criar são as que
  o `@sysloc/contracts` vai publicar e o React vai consumir
- O plano indica SDD para esta fatia; confirme ou desafie ao recomendar o framework, com razão

## O que eu quero deste pré-refinamento

Explorar os rumos de PRODUTO com Tree of Thought, ancorados no código que já existe, e convergir
comigo. Não gere PRD, tech spec nem tasks — só o `pre-refinement.md` e a recomendação de framework.
