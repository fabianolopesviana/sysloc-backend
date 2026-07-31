# Scope — Corrigir exposição pública do certificado

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v3
- **Variante**: backend
- **Intent**: [intent.md](intent.md)

---

## 2. Inclui

| Item | Onde |
|---|---|
| Impedir a criação de `File` público ao copiar `certificado_arquivo` entre registros | `integracao_bancaria_api/service.py` |
| Restaurar o invariante "pendente = cópia do ativo" para o campo do certificado | idem |
| Teste de regressão que falha se um arquivo público for criado | `tests/` |
| Reconciliação do dado de produção mitigado manualmente | passo operacional (§6) |

### Pontos de disparo mapeados

`certificado_arquivo` está em `CAMPOS_COPIAVEIS`, e `_sincronizar_campos` é chamado por **dois** helpers, acionados de **quatro** lugares:

| Linha | Função whitelisted | Helper |
|---|---|---|
| ~553 | `salvar_configuracao` | `_criar_pendente_de_ativa` |
| ~666 | `testar_conexao` | `_ressincronizar_ex_ativo` |
| ~788 | `enviar_certificado` | `_criar_pendente_de_ativa` |
| ~865 | `remover_certificado` | `_criar_pendente_de_ativa` |

`insert()` e `save()` disparam `on_update` — portanto **ambos** os helpers são vetores, não só a ressincronização.

---

## 3. Fora do escopo

- Renovação do certificado junto ao provedor.
- Mudança do modelo de armazenamento (Attach vs secret montado).
- Patch no Frappe upstream.
- Alterar `CAMPOS_COPIAVEIS` para campos que não sejam `certificado_arquivo`.

---

## 4. Restrições

- **RN-06**: senha e bytes do certificado nunca em log, retorno ou auditoria.
- **RN-10**: `pfx_path_legado` permanece como fallback quando não há Attach.
- **RN-04**: o carimbo de conexão continua sendo invalidado por edição de componente.
- **RN-01**: no máximo uma configuração `ativo=1` por provedor.
- O contador `ultimo_sequencial_seu_numero` não pode retroceder (carry-forward com `FOR UPDATE` na ativação).
- Site `frontend` é **produção**: a suíte pode rodar; `bench migrate` não é necessário nesta versão.

---

## 5. Decisões técnicas em aberto (para o executor resolver e justificar)

Três direções foram levantadas no diagnóstico, todas com efeito colateral:

**(a) Não copiar `certificado_arquivo` em `_sincronizar_campos`.**
Simples e elimina o vetor. Mas quebra "pendente = cópia integral do ativo": a próxima edição ativaria um registro sem o Attach, caindo silenciosamente no fallback `pfx_path_legado`. Degradação silenciosa — precisaria de compensação explícita.

**(b) Gravar `certificado_arquivo` por `frappe.db.set_value` (não dispara `on_update`).**
Preserva o invariante e é cirúrgico. Mas o campo continua preenchido apontando para o `File` de outro documento: qualquer `save()` posterior daquele registro, por qualquer caminho, volta a disparar o hook. Fecha os 4 pontos conhecidos, não a classe do problema.

**(c) Dar ao pendente um `File` privado próprio.**
O hook encontra `File` vinculado ao documento e não cria nada — fecha a classe. Mas esbarra em `_apagar_certificado_privado`, que apaga `File`s anexados ao pendente: se apontar para o mesmo binário do ativo, pode removê-lo e derrubar a configuração em vigor. Duplicar o binário evita isso ao custo de duas cópias do certificado no volume.

> O executor deve escolher, **justificar no diff** e demonstrar por teste que a escolha fecha os 4 pontos de disparo. Se identificar uma quarta opção melhor, pode adotá-la com a mesma exigência de prova.

---

## 6. Reconciliação do dado em produção

A mitigação manual deixou `c699b0110f` (ex-ativo/pendente) com `certificado_arquivo = null`, divergindo do ativo `80eee0d13b`.

Depois da correção, esse registro deve voltar a refletir o ativo pelo caminho que a correção estabelecer — **sem** recriar a exposição. Validar com o procedimento de verificação do runbook.

---

## 7. ADRs aplicáveis

- **ADR-0001** — modelo canônico e adaptador por provedor. Não é contrariada aqui; a correção é da camada de API/persistência.
