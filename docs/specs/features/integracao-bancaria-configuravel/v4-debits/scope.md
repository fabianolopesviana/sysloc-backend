# Scope — Cleanup dos débitos da v3

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v4-debits
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Parent**: v3

---

## 2. Inclui

| Débito | Arquivo | Correção esperada |
|---|---|---|
| D-001 | `integracao_bancaria_api/service.py` (~370, docstring de `_replicar_vinculo_certificado`; ~115 `CAMPOS_COPIAVEIS`; ~366 guard de `_sincronizar_campos`) | Ajustar a redação ao escopo real da garantia + extrair `"certificado_arquivo"` para constante de módulo referenciada nos dois pontos |
| D-002 | `integracao_bancaria_api/service.py` (~819, docstring de `_apagar_certificado_privado`) | Declarar a premissa: a preservação do binário vale **enquanto o ativo tiver `File` próprio** |
| D-003 | `integracao_bancaria_api/service.py` (`_replicar_vinculo_certificado`) | Pré-validar `url_alvo` (prefixo `/private/files/` + existência do binário) e devolver erro de negócio **antes** de apagar qualquer `File` |
| D-004 | `integracao_bancaria_api/service.py` (`_obter_pendente` + 3 call sites) | Renomear para `_preparar_pendente` |

**Nenhum débito ficou fora do escopo** — o usuário selecionou os 4 coletados.

---

## 3. Restrições

- **Não regredir a correção de segurança da v3.** Os 4 pontos de disparo (`salvar_configuracao`, `enviar_certificado`, `testar_conexao`, `remover_certificado`) devem continuar fechados, com o poder de detecção provado por mutação intacto.
- **RN-06** (senha/bytes nunca em log, retorno ou auditoria), **RN-01**, **RN-04**, **RN-10** (fallback `pfx_path_legado`).
- Site `frontend` é **produção**: a suíte pode rodar; `bench migrate` não é necessário nesta versão.
- Baseline: **120 testes** verdes.

---

## 4. Ordem de execução e colisão de arquivo

Os 4 débitos vivem no **mesmo arquivo** → **nenhum paralelismo**. A ordem foi escolhida por risco crescente:

1. **T1 (D-001)** — documental + constante
2. **T2 (D-002)** — documental
3. **T3 (D-004)** — rename mecânico
4. **T4 (D-003)** — **único que altera runtime**, deixado por último para não bloquear os de risco nulo

---

## 5. Exceção à política de testes

A política de cleanup é "não cria testes". **T4 (D-003) é exceção**: ela introduz um ramo de erro novo (erro de negócio para `url_alvo` inválida) e altera a ordem de operações de uma função de segurança. Sem teste, não há prova de que o novo ramo funciona nem de que a ordem antiga não regrediu. T4 **deve** trazer teste do caminho de erro.

T1, T2 e T3 seguem a política normal (sem testes novos; a suíte existente é o oráculo).

---

## 6. ADRs aplicáveis

- **ADR-0001** — modelo canônico e adaptador por provedor. Não é contrariada: as mudanças vivem na camada de API/persistência.
