# Scope — Fechar RN-08 e RN-09

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v5
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Parent**: v4-debits

---

## 2. Inclui

| Item | Onde |
|---|---|
| Expor a apuração de boletos em aberto como método whitelisted | `integracao_bancaria_api/service.py` |
| Expor o resumo do consolidado (`total`/`disponiveis`/`ausentes`) como método whitelisted | `integracao_bancaria_api/service.py` |
| Implementar RN-08 em `salvar_configuracao` (contagem + `requer_decisao` + parâmetro `decisao`) | `integracao_bancaria_api/service.py` |
| Testes dos dois requisitos | `tests/test_boletos_abertos.py` e/ou `tests/test_integracao_bancaria_api.py` |

---

## 3. Contrato a implementar

### 3.1 RN-08 — decisão na troca (fonte: `v1/tech_spec.md:285-290`, `:362`, `:516`)

Em `salvar_configuracao`, **antes de gravar o pendente**:

1. Apurar a contagem de boletos em aberto (RN-02).
2. Se **contagem > 0** e o payload **não traz** `decisao` → devolver, **sem escrever nada**:
   ```
   {success: False, requer_decisao: True, total_abertos: <n>, opcoes: [...], message: "Existem {n} boletos em aberto emitidos pela conta atual."}
   ```
3. Com `decisao` presente:
   - `aceitar` → prossegue com a gravação normal do pendente.
   - `nao_aceitar` → cancela **sem escrita**.
   - `aceitar_com_consolidado` → ver §3.3.
4. Contagem **zero** → a etapa de decisão é **dispensada** (comportamento atual preservado).

**A ordem importa**: a apuração e a recusa acontecem antes de qualquer escrita — inclusive antes de criar o pendente. É o mesmo princípio que a v4-debits estabeleceu para a pré-validação do certificado ("recusa de zero escrita").

### 3.2 RN-09 / CA-10 — canal para os ausentes (decisão do usuário: **endpoint JSON irmão**)

O streaming de `baixar_consolidado_boletos_abertos` **permanece inalterado** (`v1/tech_spec.md:214` justifica por que não pode ser fundido).

Acrescentar métodos whitelisted que devolvam JSON:
- apuração: `{total, identificadores}` — serve ao aviso e ao passo 1 do RN-08.
- resumo do consolidado: `{total, disponiveis, ausentes}` — serve ao aviso de "N ficaram de fora".

Nomes, granularidade (um método ou dois) e assinatura ficam a critério do executor, desde que: sejam whitelisted, exijam System Manager (RN-11), não devolvam bytes de PDF, e o shape esteja documentado.

### 3.3 Semântica de `aceitar_com_consolidado`

O `tech_spec.md:290` define que o **cliente** aciona o consolidado primeiro e depois chama `salvar_configuracao` com `decisao=aceitar` — a ordem garante que o gestor tenha os boletos em mãos antes da alteração.

Logo, `aceitar_com_consolidado` **não** precisa gerar PDF no backend. Decida como sênior entre:
- **(a)** aceitar o valor como sinônimo de `aceitar` (o download é responsabilidade do cliente), documentando isso; ou
- **(b)** recusar o valor com erro de negócio orientando a usar `aceitar` após baixar.

**Justifique a escolha.** Não invente geração de PDF dentro de `salvar_configuracao` — contraria a decisão de streaming do tech_spec.

---

## 4. Restrições

- **`**_ignorados` é o motivo de a falha ser silenciosa hoje.** Ao acrescentar `decisao`, garanta que um valor **inválido** seja recusado com erro de negócio — nunca engolido.
- **RN-11**: os métodos novos exigem System Manager, como todos os demais.
- **RN-06**: nenhum segredo nos retornos.
- **RN-04**: o ciclo pendente/carimbo não muda.
- Não alterar `FILTROS_BOLETO_ABERTO` (fonte única desde a v2-debits; CT-019 atual o cruza com o dry_run de produção).
- Não regredir a correção de segurança do certificado (v3/v4-debits).
- Site `frontend` é **produção**: só a suíte, sem `bench migrate`.
- Baseline: **124 testes**.

---

## 5. Colisão de identificadores de CT

`CT-019` e `CT-020` **já estão ocupados** por testes existentes, e `CT-019` designa hoje um contrato **diferente** do que a matriz da v1 previa. `CT-030` a `CT-036` também estão em uso.

Os testes desta versão devem usar **IDs livres** — verifique por grep antes de escolher — e a task deve registrar a colisão histórica, para não repetir o erro que escondeu esta lacuna.

---

## 6. ADRs aplicáveis

- **ADR-0001** — modelo canônico e adaptador por provedor. Não é contrariada: a mudança vive na camada de API.
