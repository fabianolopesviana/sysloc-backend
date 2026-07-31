# Plano de Frontend — Tela de Integração Bancária Configurável

> Gerado em 2026-07-22, a partir de [`handoff-frontend.md`](handoff-frontend.md) (commit `7c8ae1b`).
> **O handoff é o contrato; este plano é o roteiro de execução.** Onde os dois divergirem, o handoff vence — ele foi verificado contra o código, este documento propõe uma implementação.

---

## 1. Objetivo

Entregar a tela de configuração da integração bancária no app React Sysloc: o gestor da imobiliária troca conta, credenciais e certificado digital, testa a conexão e coloca em vigor — sem SSH e sem Desk do Frappe.

**Não entra**: emissão/baixa/consulta de boletos (contrato inalterado, o app já consome), notificação ativa de vencimento (adiada, PRD §4.2), qualquer canal de e-mail.

---

## 2. O que foi verificado sobre o codebase — e o que NÃO foi

> Leia isto antes de seguir o plano. **O fonte do React não está neste servidor** — só o build publicado em `/opt/react/sysloc/html`. Tudo abaixo foi inferido do bundle minificado e do runbook.

**Verificado (confiável):**

| Fato | Como foi apurado |
|---|---|
| App React, build Create React App (`static/js/main.<hash>.js`, `npm run build` → `build/`) | runbook "Hospedagem React Sysloc" + estrutura do diretório publicado |
| Autenticação por **cookie de sessão**: `credentials: "same-origin"` | string literal no bundle |
| Base da API é **`/api/`** relativa, resolvida pelo proxy Nginx do container | bundle + `default.conf` do runbook |
| O app **já consome 8 métodos** `locacao_automation.*` whitelisted | strings no bundle |
| CSS **próprio e semântico** (542 classes, ex.: `.auth-screen`) — **não** é Tailwind nem framework de utilitários | `main.<hash>.css` |
| Deploy: build local → tar → scp → troca de `/opt/react/sysloc/html` → `nginx -s reload` | runbook, procedimento oficial |

**NÃO verificado — o implementador deve conferir no fonte antes de codificar:**

- Biblioteca de UI/componentes (o bundle minificado não permite identificar).
- Gerenciador de estado (há 1 ocorrência de `redux`, insuficiente para afirmar).
- Roteador e o padrão de registro de rotas.
- **Se já existe um cliente HTTP centralizado** para `/api/method/*`. ⚠️ **Isto é o item mais importante da lista**: o app já faz 8 chamadas whitelisted, então quase certamente existe um helper. **Reaproveite-o**; não crie um segundo cliente HTTP.
- Convenção de testes (o runbook cita `npm test -- --watchAll=false`, o que sugere Jest + Testing Library do CRA).

> **Regra para o implementador**: onde este plano propuser uma estrutura de arquivos ou um padrão, **prevaleça a convenção que já existe no repositório**. O plano descreve *o que* precisa existir, não impõe *onde*.

---

## 3. Arquitetura em três camadas

```
┌─────────────────────────────────────────────────────────┐
│  UI          ConfiguracaoBancariaPage + componentes     │
│              (apresentação, sem regra de contrato)      │
├─────────────────────────────────────────────────────────┤
│  Estado      useConfiguracaoBancaria                    │
│              máquina de estados + decisão do gestor     │
├─────────────────────────────────────────────────────────┤
│  API         integracaoBancaria.api                     │
│              8 funções + desembrulho do envelope        │
│              + classificação de erro (única fonte)      │
└─────────────────────────────────────────────────────────┘
```

**Por que separar a classificação de erro na camada de API**: o backend não devolve `error_code` — a discriminação é por **prefixo de texto**. Se esse conhecimento vazar para os componentes, cada tela repete os prefixos e a próxima mudança de mensagem quebra em N lugares. Concentre em **uma** função `classificarErro(resposta)` que devolve um símbolo (`'campo_invalido'`, `'certificado_ilegivel'`, `'cancelado'`, …). Os componentes nunca comparam string.

---

## 4. Máquina de estados da tela

```
                    ┌──────────┐
                    │ carregando│
                    └─────┬─────┘
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
    ┌──────────┐   ┌────────────┐   ┌──────────────┐
    │sem_config│   │ visualizando│   │ sem_permissao│  (403)
    └──────────┘   └──────┬──────┘   └──────────────┘
                          │ usuário edita
                          ▼
                    ┌──────────┐
              ┌─────│ editando │◄──────────────┐
              │     └─────┬────┘               │
              │           │ salvar             │
              │           ▼                    │
              │     ┌──────────┐               │
              │     │ salvando │               │
              │     └─────┬────┘               │
              │           │                    │
              │   ┌───────┼────────┐           │
              │   ▼       ▼        ▼           │
              │ sucesso  erro   requer_decisao │
              │   │       │          │         │
              │   │       └──────────┼─────────┘
              │   │                  ▼
              │   │           ┌─────────────┐
              │   │           │ decidindo   │  ← diálogo RN-08
              │   │           └──────┬──────┘
              │   │        ┌─────────┼──────────┐
              │   │        ▼         ▼          ▼
              │   │    cancelar   aceitar   baixar+aceitar
              │   │        │         └────┬─────┘
              │   │        │              │ re-POST com decisao
              │   │        └──────────────┴──► volta a "salvando"
              │   ▼
              │ ┌──────────┐  testar e ativar
              │ │ testando │◄──────────────────┘
              │ └─────┬────┘
              │       │ sucesso → RELOAD obter_configuracao
              └───────┴──────────────────────► visualizando
```

**Estado que precisa sobreviver entre chamadas** (a parte que se erra com mais facilidade):

```js
{
  decisaoTomada: null | 'aceitar' | 'aceitar_com_consolidado',
  // ↑ uma vez que o gestor decidiu, TODA gravação seguinte reenvia este valor.
  //   O servidor NÃO lembra. Sem isto, o diálogo reabre a cada save.
  camposEditados: { …payload parcial… },
  // ↑ o POST recusado por requer_decisao NÃO gravou nada.
  //   A confirmação precisa reenviar o payload INTEIRO, não só {decisao}.
}
```

---

## 5. Fases

Cada fase é entregável e testável isoladamente. **Fase 1 é pré-requisito de todas**; 2, 3 e 4 são independentes entre si.

### Fase 1 — Camada de API e leitura (fundação)

| # | Tarefa | Entrega |
|---|---|---|
| 1.1 | Localizar o cliente HTTP existente do app e **reusá-lo**. Se não houver, criar um wrapper mínimo que já desembrulhe `body.message` | `chamarMetodo(path, body?)` |
| 1.2 | Implementar as 8 funções de API (§7) | `integracaoBancaria.api` |
| 1.3 | Implementar `classificarErro(resposta)` — **fonte única** dos prefixos de texto | símbolos, nunca strings, para a UI |
| 1.4 | Implementar o hook de estado com a máquina do §4 | `useConfiguracaoBancaria` |
| 1.5 | Tela em modo leitura: blocos `configuracao`, `certificado`, `pendente` | página navegável |
| 1.6 | Badge de vencimento a partir de `certificado.dias_para_vencer` | componente |
| 1.7 | Estados `carregando` / `sem_config` / `sem_permissao` (403) | — |

**Pronto quando**: a tela abre, mostra a configuração em vigor e o badge, e trata 403 sem vazar detalhe do backend.

### Fase 2 — Edição e ciclo de ativação

| # | Tarefa | Nota crítica |
|---|---|---|
| 2.1 | Formulário dos campos de conta (`numero_cliente`, `numero_conta_corrente`, `codigo_modalidade`) | inteiros > 0 |
| 2.2 | Acordeão "Configurações avançadas": `auth_url`, `api_base_url`, `ambiente`, `parametros_provedor` | colapsado por padrão |
| 2.3 | **Omitir chaves não editadas** no POST | 🚨 semântica de atualização parcial: `client_id` mascarado reenviado gravaria `********f456` como credencial real |
| 2.4 | Botão **"Testar e ativar"** | não existe "Ativar" separado; o rótulo precisa avisar que o sucesso coloca em vigor **imediatamente** |
| 2.5 | Após qualquer escrita bem-sucedida, **recarregar `obter_configuracao`** | nunca inferir o novo estado localmente |
| 2.6 | Distinguir "em vigor" de "em edição" | ver a decisão em aberto no §10.2 |
| 2.7 | Erros de validação inline por campo | mapeamento do handoff bloco 6 |

**Pronto quando**: o gestor edita a conta, salva, testa/ativa e vê o novo estado — sem boletos em aberto envolvidos.

### Fase 3 — Certificado

| # | Tarefa | Nota crítica |
|---|---|---|
| 3.1 | Upload → base64 **puro** | 🚨 remover o prefixo `data:...;base64,` — o backend recusa data-URI |
| 3.2 | Pré-validação de tamanho (256–32768 bytes **decodificados**) | valores **provisórios** (`TODO` no backend): mensagem própria, nunca copiar a do backend |
| 3.3 | Tela de confirmação pós-upload: `titular`, `documento`, `emissor`, validade | *"É esta a conta?"* — salvaguarda contra arquivo errado |
| 3.4 | Formatar `documento` como CPF/CNPJ | backend devolve **só dígitos** |
| 3.5 | Remover certificado | ⚠️ `presente` pode continuar `true` com `origem: "legado"` — não assuma `false` |
| 3.6 | Estado de erro do vínculo (handoff 4.7) + CTA de reenvio | garantia explícita: *"nada foi alterado"* |

**Pronto quando**: upload, confirmação, troca e remoção funcionam, e o erro de vínculo oferece o caminho de recuperação.

### Fase 4 — Boletos em aberto e decisão (RN-08/RN-09) 🚨

> **A fase de maior risco.** É onde estão as três armadilhas do handoff.

| # | Tarefa | Nota crítica |
|---|---|---|
| 4.1 | Aviso preventivo ao abrir a edição, via `apurar_boletos_abertos` | endpoint **barato** (1 query). Melhor o gestor saber antes de preencher |
| 4.2 | Diálogo de decisão disparado por **`requer_decisao === true`** | 🚨 **nunca** pelo texto — `total_abertos` é interpolado na mensagem |
| 4.3 | Renderizar as opções a partir de **`opcoes[]` da resposta** | não hard-codear a lista |
| 4.4 | `aceitar` → re-POST com **payload completo** + `decisao` | o primeiro POST não gravou nada |
| 4.5 | `nao_aceitar` → fechar o diálogo, **sem estado de erro** | 🚨 ver 4.7 abaixo |
| 4.6 | `aceitar_com_consolidado` → **o cliente baixa** via `baixar_consolidado_boletos_abertos`, depois re-POST | 🚨 o backend **não baixa nada**; é sinônimo de `aceitar` |
| 4.7 | 🚨 **Não** tratar a mensagem de cancelamento como o erro de certificado | as três terminam com `"nenhuma alteracao foi feita."` — discriminar por **prefixo** |
| 4.8 | Persistir `decisaoTomada` e reenviar nas gravações seguintes | o servidor não lembra |
| 4.9 | Após o download, avisar quantos ficaram de fora (`resumir_consolidado_boletos_abertos.ausentes`) | endpoint **caro** — sob demanda, com indicador de operação lenta |
| 4.10 | Download tratado como **blob**, nunca `.json()` | PDF de 0 páginas é resposta válida, não erro |

**Pronto quando**: os três caminhos funcionam, o cancelamento não vira alarme falso, e a decisão não reabre o diálogo na segunda gravação.

---

## 6. Componentes propostos

| Componente | Responsabilidade | Fase |
|---|---|---|
| `ConfiguracaoBancariaPage` | orquestra o hook e compõe as seções | 1 |
| `BlocoConfiguracaoAtiva` | dados em vigor (somente leitura) | 1 |
| `BadgeVencimentoCertificado` | `dias_para_vencer` → informativo / crítico / oculto | 1 |
| `FormularioConta` | campos de conta + validação inline | 2 |
| `AcordeaoAvancado` | urls, ambiente, parâmetros | 2 |
| `PainelCertificado` | metadados, upload, remoção | 3 |
| `ConfirmacaoCertificado` | *"É esta a conta?"* pós-upload | 3 |
| `DialogoDecisaoTroca` | RN-08: contagem + opções de `opcoes[]` | 4 |
| `AvisoBoletosAbertos` | aviso preventivo (contagem) | 4 |
| `ResumoAusentesConsolidado` | *"N de M não puderam ser incluídos"* | 4 |

---

## 7. Camada de API — assinaturas

Todas retornam o **conteúdo de `body.message`** já desembrulhado (exceto o download).

```js
// leitura
obterConfiguracao(provedor?)                  // GET  → {success, configuracao, certificado, pendente?}
apurarBoletosAbertos()                        // GET  → {total, identificadores}          ⚡ barato
resumirConsolidadoBoletosAbertos()            // GET  → {total, disponiveis, ausentes}    🐢 CARO
verificarSaudeIntegracao(provedor?)           // GET  → {success, status_code, message, sicoob}  🩺 round-trip real

// escrita — SEMPRE POST
salvarConfiguracao(payloadParcial, decisao?)  // POST → sucesso | requer_decisao | erro
enviarCertificado({arquivoBase64, nomeArquivo, senha}, provedor?)  // POST
testarConexao(provedor?)                      // POST → testa E ATIVA
removerCertificado(provedor?)                 // POST

// arquivo — NÃO desembrulha, devolve Blob
baixarConsolidadoBoletosAbertos()             // GET  → Blob (PDF; pode ter 0 páginas)
```

**Regras da camada:**

1. **Verbo importa.** `@frappe.whitelist()` sem `methods` aceita GET, mas o Frappe **faz rollback** em métodos não-unsafe: um GET de escrita retorna `200 {success:true}` e **não grava nada**. Escrita é sempre POST.
2. `apurar` e `resumir` **não têm `success`** — o shape é cru. Não escreva `if (r.success)` nelas.
3. `requer_decisao` **não tem `configuracao`** — 5 chaves, shape próprio.
4. `baixarConsolidado` não tem envelope: **falha = status ≠ 200**.
5. `verificarSaudeIntegracao` **tem `success`**, mas o motivo real de falha está em **`sicoob.corpo`** (cru, string), **não** em `message` (que é genérico). É um round-trip real ao banco → **sob demanda, nunca polling**. O `access_token` nunca vem (RN-06) — não conte com ele. Ver handoff §4.10.

---

## 8. Classificação de erro (uma função, uma vez)

```js
classificarErro(resposta) → 
  | 'requer_decisao'         // resposta.requer_decisao === true      ← campo, não texto
  | 'cancelado_pelo_gestor'  // prefixo "A troca de configuracao foi cancelada"   ← NÃO é erro
  | 'certificado_ilegivel'   // prefixo "O vinculo do certificado alvo e invalido"
                             //      ou "O certificado alvo nao foi encontrado"
  | 'sem_config_ativa'       // "Nenhuma configuracao de integracao bancaria ativa"
  | 'campo_invalido'         // prefixos "O campo auth_url" / "O campo api_base_url" / "O campo '"
  | 'certificado_invalido'   // "Senha incorreta ou arquivo nao e um PKCS#12" / "Tamanho do certificado ("
  | 'decisao_invalida'       // "O campo 'decisao' e invalido"        ← BUG DO CLIENTE: logar, não exibir
  | 'sem_certificado_proprio'
  | 'desconhecido'
```

🚨 **A regra que mais importa**: `'cancelado_pelo_gestor'` e `'certificado_ilegivel'` **terminam com a mesma frase** (`"nenhuma alteracao foi feita."`). Discriminar por sufixo faz o botão **Cancelar** exibir *"O certificado não pôde ser lido, envie novamente"*. **Sempre por prefixo.**

---

## 9. Testes

Espelham o bloco 10 do handoff. `npm test -- --watchAll=false`.

**Component**: badge (crítico/informativo/oculto) · metadados do certificado formatados · "em edição" vs "em vigor" · `apurar` com `total: 0` não mostra aviso · resposta de `apurar`/`resumir` lida sem `success`.

**Integration**: base64 inválido → erro inline · senha errada → mensagem neutra (não afirmar "senha errada") · `testar_conexao` falho → banner com `message`, `detalhes` **nunca** exibido · sucesso → recarrega · payload não reenvia `client_id` mascarado nem senha vazia · 403 → `forbidden`, 417 → erro + reload · download por blob, PDF de 0 páginas não quebra.

**Fluxo RN-08**: `requer_decisao` abre o diálogo com `opcoes[]` · `aceitar` reenvia payload completo e grava · `nao_aceitar` fecha sem erro · `aceitar_com_consolidado` dispara o download **pelo cliente** · ausentes viram aviso · segunda gravação reenvia `decisao` e **não** reabre o diálogo.

**Regressão obrigatória** 🚨: *cancelamento não dispara o estado de certificado ilegível*. Este teste existe por causa da colisão de sufixo. Sem ele, a regressão é invisível.

> 15 fixtures verificadas contra o código estão no bloco 7 do handoff — use-as como mocks; não invente resposta.

---

## 10. Decisões pendentes e riscos

### 10.1 Decidido — textos do fluxo de troca (§14)

**(a) Texto do diálogo de decisão** — ✅ **RESOLVIDO em 2026-07-22.** Redigido como **advertência**, conforme decisão. O deck completo de textos está no **§14**. O backend entrega só a constatação (`"Existem N boletos em aberto emitidos pela conta atual."`); **a consequência é responsabilidade da tela** e está escrita lá.

**(b) Profundidade da lista de boletos.** `apurar`/`resumir` devolvem `name` de `Cobranca` (`COB-0001`) — identificador interno, sem sacado, valor ou vencimento. Lista legível exigiria backend novo ou N chamadas a `/api/resource/Cobranca/<name>`.
→ **Recomendação: começar pela contagem.** Resolve o essencial ("o consolidado não está completo") e não bloqueia. Os textos do §14 foram escritos para funcionar **sem** a lista nominal.

### 10.2 Decisão de implementação a tomar na Fase 2

**Como sinalizar "em edição".** Em produção **já existe** um registro pendente, então a tela abre em "em edição" na primeira carga. Pior: o **certificado não entra em `campos_divergentes`** — trocar só o certificado deixa `{}`.

| Opção | Consequência |
|---|---|
| `pendente` existe → "em edição" | falso positivo desde a primeira carga (estado atual da produção) |
| `campos_divergentes` não vazio → "em edição" | ✅ evita o falso positivo, mas **perde** a troca só-de-certificado |
| Combinar: `campos_divergentes` não vazio **ou** certificado do pendente difere do ativo | correto, mas exige comparar os blocos `certificado` |

→ **Recomendação: começar pela segunda** (mais simples, resolve o caso real de hoje) e registrar a limitação. Migrar para a terceira se a troca só-de-certificado se mostrar comum.

### 10.3 Riscos conhecidos

| Risco | Mitigação |
|---|---|
| `resumir_consolidado` sem tempo medido em produção | chamar sob demanda, indicador de operação lenta, timeout generoso. **Medir** antes de pôr em caminho crítico |
| Faixa de tamanho do PFX é provisória (`TODO` no backend) | nunca hard-codear a mensagem; usar a `message` devolvida |
| Corpo exato de 403/417 varia por versão do Frappe | tratar pelo **status**, nunca pelo corpo |
| Pendente residual em produção | ver 10.2 |
| `detalhes` de `testar_conexao` pode conter **caminho absoluto do servidor** | 🔒 **nunca** exibir `detalhes` ao gestor — só log/área técnica |

---

## 11. Critérios de pronto

- [ ] Todas as leituras usam `body.message`; escrita é sempre POST.
- [ ] Nenhum componente compara texto de erro — só símbolos de `classificarErro`.
- [ ] `client_id` mascarado e `certificado_senha` vazia **nunca** são reenviados.
- [ ] Ciclo salvar → testar/ativar → recarregar funciona ponta a ponta.
- [ ] Upload, confirmação de titular, troca e remoção de certificado funcionam.
- [ ] Os três caminhos do RN-08 funcionam; a decisão é reenviada nas gravações seguintes.
- [ ] 🚨 Cancelamento **não** exibe erro de certificado (teste de regressão verde).
- [ ] `aceitar_com_consolidado` baixa o PDF **pelo cliente** antes de confirmar.
- [ ] Ausentes do consolidado são informados ao gestor.
- [ ] 403 → "Sem permissão" sem detalhe; 417 → erro + reload.
- [ ] `detalhes` de `testar_conexao` nunca aparece na tela.
- [ ] `npm test -- --watchAll=false` verde.

---

## 12. Deploy

Procedimento oficial do runbook (**não editar produção direto**):

```bash
# local
npm test -- --watchAll=false
npm run build
tar -czf deploy/sysloc-react-build.tar.gz -C build .
scp deploy/sysloc-react-build.tar.gz sysloc@177.185.117.139:/tmp/sysloc-react-build.tar.gz
```

No servidor: backup com timestamp de `/opt/react/sysloc/html` → limpar → extrair → `docker exec sysloc-react-1 nginx -s reload` → validar raiz, rota SPA e `/api/method/ping`.

⚠️ O backend está em **produção** (site `frontend`). A tela escreve configuração real de cobrança bancária: valide em ambiente controlado antes de publicar, e lembre que **`testar_conexao` ativa de verdade**.

---

## 13. Ordem sugerida

```
Fase 1 (fundação)  ──►  Fase 2 (edição/ativação)
                   ├──►  Fase 3 (certificado)
                   └──►  Fase 4 (RN-08/RN-09)   ← maior risco, deixe por último
```

2, 3 e 4 são independentes depois da 1. Se houver mais de uma pessoa, paralelize — mas **a Fase 4 merece o revisor mais atento**: é onde estão as três armadilhas (colisão de sufixo, sinônimo de `aceitar_com_consolidado`, decisão não memorizada) e as três são silenciosas, não quebram build.

---

## 14. Textos do fluxo de troca (copy aprovado — 2026-07-22)

> Decisão registrada: **redigir como advertência**, não como aviso informativo. Textos abaixo são para uso literal. Onde houver `{n}`, `{disponiveis}`, `{ausentes}`, interpole os valores vindos do backend.

### 14.1 O princípio que orienta estes textos

O gestor não é técnico e usa esta tela **raramente** (renovação anual, troca de conta). Ele não tem repertório acumulado para inferir consequência. Três decisões de redação seguem disso:

1. **Separar o que é certo do que é incerto.** O boleto já emitido **existe no banco** — isso é fato, e dizer o contrário assustaria à toa. O que é incerto é se o *nosso sistema* continuará conseguindo acompanhá-lo. Misturar as duas coisas produz ou pânico ou falsa segurança.
2. **Nomear a consequência prática, não o mecanismo.** "Pode ser necessário dar baixa manualmente" é acionável. "A autenticação passa a usar outras credenciais" não é.
3. **Assumir a incerteza em voz alta.** Não sabemos se a baixa continuará funcionando. Escrever "não confirmamos" é mais honesto — e mais útil — do que escolher um lado.

### 14.2 Aviso preventivo (ao abrir a edição, via `apurar_boletos_abertos`)

> Mostrado **antes** de o gestor preencher qualquer campo, quando `total > 0`. Tom informativo — aqui ele ainda não pediu nada.

**Título:** `Esta conta tem {n} boletos em aberto`

**Corpo:**
> Se você trocar a configuração bancária, estes boletos podem passar a exigir acompanhamento manual. Você poderá baixar a relação deles antes de confirmar a troca.

Quando `total == 0`: **não exiba nada.** Ausência de aviso já comunica "não há pendência".

### 14.3 Diálogo de decisão (resposta `requer_decisao`)

> A advertência propriamente dita. Aparece quando o gestor **já pediu para salvar**.

**Título:** `Atenção: {n} boletos em aberto foram emitidos por esta conta`

**Corpo:**
> Estes boletos já estão registrados no banco e **continuam válidos para o cliente pagar** — trocar a configuração aqui não cancela nenhum deles.
>
> O problema é do lado do sistema. Depois da troca, ele passa a falar com o banco em nome da conta nova, e **muito provavelmente deixará de conseguir consultar e dar baixa nestes {n} boletos**, porque eles pertencem à conta anterior. Na prática: os pagamentos precisarão ser acompanhados e baixados manualmente, um a um, até que todos sejam quitados.
>
> Se puder, **quite ou aguarde estes boletos antes de trocar**. Se precisar trocar agora, baixe o consolidado: é o registro de quais boletos ficaram nessa situação.

**Ações** — mapeamento literal para os valores de `opcoes[]`:

| Valor do backend | Rótulo do botão | Ênfase | Ação da tela |
|---|---|---|---|
| `aceitar_com_consolidado` | **Baixar consolidado e continuar** | primário (recomendado) | `baixar_consolidado_boletos_abertos` → depois re-POST |
| `aceitar` | Continuar sem baixar | secundário | re-POST direto |
| `nao_aceitar` | Cancelar a troca | terciário / discreto | fecha o diálogo, **sem estado de erro** |

⚠️ **Os rótulos são um mapa `valor → texto`, não uma lista fixa.** A ordem e a presença vêm de `opcoes[]` (plano §5, tarefa 4.3). Se o backend publicar um valor desconhecido, renderize-o com o próprio literal em vez de omitir a opção.

**Por que "Baixar consolidado e continuar" é o primário**: é a única ação que deixa o gestor em posição melhor do que antes. As outras duas ou adiam o problema ou seguem sem rede.

### 14.4 Após o download — resumo de ausentes (`resumir_consolidado_boletos_abertos`)

**Quando `ausentes` está vazio:**
> Consolidado gerado com os {n} boletos em aberto.

**Quando há ausentes:**
> **O consolidado não está completo.** Ele inclui {disponiveis} dos {n} boletos. Os outros {ausentes} não puderam ser incluídos porque o arquivo do boleto não está disponível ou não pôde ser lido — eles continuam em aberto e **não** aparecem no PDF.

⚠️ **Não prometa a lista nominal.** Enquanto valer a decisão do §10.1(b) (só contagem), o texto acima é deliberadamente escrito para ser completo **sem** citar quais boletos são. Se um dia a lista enriquecida existir, acrescente-a — mas não escreva "veja abaixo quais" antes de haver um "abaixo".

### 14.5 Cancelamento (`decisao: "nao_aceitar"`)

🚨 **Não exiba mensagem de erro.** O backend responde `success: false`, mas isto é um **cancelamento pedido pelo usuário**, não uma falha. O comportamento correto é fechar o diálogo e devolver o gestor ao formulário **com o que ele havia preenchido intacto**.

Se quiser confirmar visualmente, use uma confirmação neutra e discreta:
> Troca cancelada. Nenhuma alteração foi feita.

**Nunca** o texto do erro de certificado (*"O certificado atual não pôde ser lido…"*) — é exatamente a armadilha da colisão de sufixo (§8 e tarefa 4.7).

### 14.6 Base factual da advertência (verificado em 2026-07-22)

> Os textos acima **não são precaução genérica**. Foram calibrados por uma auditoria do código do caminho de baixa. Resumo do que a sustenta:

**Estabelecido lendo o código (certo):**

1. `solicitar_baixa` envia `{numeroCliente, codigoModalidade}` da **configuração ATIVA** (`adapter.py` → `mapeamento.montar_body_baixa(self._conta)`), com o `nossoNumero` do boleto antigo na URL. `confirmar_baixa` e `consultar` fazem o mesmo por query param.
2. `resolver_credenciais` sempre busca `{"ativo": 1}` — **não existe** resolução de credencial por boleto.
3. O `nossoNumero` é **atribuído pelo Sicoob na emissão** (`interpretar_emissao` lê `nossoNumero` da resposta), sob a conta que emitiu.
4. ⇒ **Após a troca, toda requisição de baixa é inconsistente por construção**: pareia um `nossoNumero` da conta A com o `numeroCliente` da conta B.
5. O código **já documentava** esse acoplamento (`baixa.py:21-24`, `consulta.py:237-242`, `confirmacao_baixa.py:26`): as validações dos campos `numero_cliente_sicoob` da própria Cobrança foram removidas de propósito, porque "o body usa a conta da CONFIG ATIVA". Decisão consciente, tomada **sem considerar o cenário de troca**.
6. **O dado da conta emissora existe por boleto**: `emissao.py:377-378` grava `numero_cliente_sicoob` e `codigo_modalidade_sicoob` em cada Cobrança. Está persistido e ninguém consome.
7. Nenhum teste cobre o cenário; não há spec da API Sicoob no repositório.

**Inferido — praticamente certo:**

A baixa após a troca **falha**, e falhar é o desfecho **bom**. Dois argumentos independentes convergem, e é importante entender que eles atuam em camadas diferentes:

| Camada | Papel | Consequência |
|---|---|---|
| Certificado mTLS + `client_id` + token | **autenticação/autorização** — define o que a entidade pode tocar | é aqui que mora a segurança |
| `numeroCliente` / `codigoModalidade` no corpo | **chave de busca** dentro do escopo já autorizado | parâmetro, não controle de acesso |

- **Troca entre titulares diferentes** → o token do certificado novo não tem escopo sobre os boletos da conta antiga. Bloqueado na autorização. Aceitar essa requisição seria **falha de autorização em nível de objeto** (BOLA/IDOR, OWASP API #1) — um banco não erra isso.
- **Troca dentro do mesmo titular** (mesma cooperativa, outra conta) → o token *pode* legitimamente cobrir as duas contas, e aí não há questão de segurança. Mas o `nossoNumero` é **sequencial por conta**, então as duas contas podem ter boletos com o mesmo número: sem o `numeroCliente` a busca seria ambígua. O banco é obrigado a usá-lo para desambiguar.

⇒ **Nos dois caminhos a baixa falha.** A segurança está garantida pelo certificado em qualquer cenário — a pergunta sobre o par `numeroCliente`+`nossoNumero` nunca foi de segurança, é de **semântica de lookup**.

**O caso que nenhum código nosso resolve:** entre titulares diferentes, a barreira é o certificado. Mandar o `numeroCliente` antigo não ajudaria. Só a troca "cosmética" (mesmo titular, corrigindo um número) seria consertável por código.

**Desconhecido — sem consequência prática:** se a falha volta como 204 (não encontrado) ou 4xx (não autorizado). Ambos são falha, ambos são seguros, e o código já trata os dois (`confirmar_baixa` mapeia 204 → `BOLETO_NAO_ENCONTRADO`; ≥400 preserva o status via `parametros_provedor`). Não foi testado contra a API porque `baixa` **cancela boleto** e a configuração ativa é a conta real de produção.

### 14.7 Consequência para o backend — DECISÃO: não corrigir agora (2026-07-22)

> Registrado aqui porque saiu desta auditoria, mas **é decisão de backend/produto**, não da tela. **A decisão já foi tomada. Este bloco existe para que ninguém a reabra sem os dados abaixo.**

**A correção que existiria**: fazer baixa/consulta/confirmação usarem `numero_cliente_sicoob`/`codigo_modalidade_sicoob` **do próprio boleto** (já gravados por `emissao.py:377-378`) em vez da config ativa, com fallback para a ativa quando ausentes.

**Decisão: NÃO fazer agora.** Cinco razões, em ordem de força:

1. **A correção é inverificável neste ambiente.** Não sabemos se o Sicoob usa o `numeroCliente` como chave de busca ou o ignora; não há homologação provisionada (`[DÚVIDA] #4`); e testar em produção significaria **cancelar um boleto real**. Testes verdes provariam que o código faz o que mandamos — não que o banco aceita. Seria mexer no caminho de pagamento apoiado numa hipótese não falsificável.
2. **Benefício hoje é exatamente zero.** Estado verificado em produção (2026-07-22): config ativa `80eee0d13b` tem `numero_cliente = 33065`, `codigo_modalidade = 1`; **os 10 boletos emitidos têm exatamente os mesmos valores**, todos populados, nenhum nulo. A correção produziria requisição byte-a-byte idêntica. Só passa a importar **depois** de uma troca.
3. **Mesmo depois da troca, resolve só metade dos casos.** Entre titulares diferentes o certificado bloqueia de qualquer forma (§14.6) — nenhum payload conserta.
4. **A falha atual é do tipo bom: alta e não destrutiva.** `BOLETO_NAO_ENCONTRADO`, alguém percebe, o trabalho vira manual. Não é perda de dado nem baixa no boleto errado.
5. **O problema real — o gestor não saber — já está resolvido de graça** pelo texto de advertência do §14.3.

**Risco que a correção introduziria** (e que a versão atual não tem): se um dia existir Cobrança com `numero_cliente_sicoob` vazio ou incorreto (migração, importação, edição manual), a versão "corrigida" mandaria lixo onde hoje manda o valor certo da config ativa. Os 10 registros de hoje estão consistentes, mas é superfície de erro nova.

**Custo de não corrigir**: se houver troca de conta, os boletos em aberto exigem baixa manual até quitarem. Tedioso, não perigoso, e agora **avisado ao gestor antes de ele decidir**.

**Quando reabrir**: quando uma troca de conta virar **concreta** — e não antes. Nesse momento existem as duas coisas que faltam hoje: um caso real para testar e um motivo para perguntar ao Sicoob (ou provisionar homologação) se o `numeroCliente` participa da busca. Se já houver troca planejada, investigue **antes** dela.

**Também exigiria** ADR ou nota explícita revertendo a decisão registrada em três docstrings (`baixa.py:21-24`, `consulta.py:237-242`, `confirmacao_baixa.py:26`), que sob ADR-0001 declararam esses campos código morto.

**Enquanto não for corrigido**, o texto do §14.3 está certo e deve continuar como está.
