# Intent — Corrigir exposição pública do certificado na troca de configuração

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v3
- **Variante**: backend
- **Parent**: v1 (implementação) / v2-debits (cleanup)
- **Origem**: incidente de segurança em produção, 2026-07-21
- **Tipo**: correção de bug de segurança

---

## 2. O QUE

Impedir que operações de configuração da integração bancária publiquem o certificado digital (PKCS#12) como arquivo acessível **sem autenticação**.

---

## 3. POR QUE

Em 2026-07-21, ao migrar o certificado do Sicoob para o campo `certificado_arquivo` (Attach), a ativação da configuração criou uma **cópia pública** do certificado em `/files/certificado.pfx`, servida pelo nginx sem qualquer autenticação.

O arquivo tinha conteúdo byte-a-byte idêntico ao certificado privado (hash SHA-256 conferido) e ficou exposto por cerca de 12 minutos até a contenção manual.

**Causa raiz** (não é código do app, é interação com o framework): o hook `attach_files_to_document` do Frappe (`frappe/core/doctype/file/utils.py`) roda no `on_update` de **todo** documento. Quando um campo `Attach` aponta para uma URL cujo `File` está vinculado a **outro** documento, ele cria um `File` novo **sem passar `is_private`** — o registro nasce público e o Frappe copia o binário para `sites/<site>/public/files/`.

O app dispara isso porque `certificado_arquivo` faz parte de `CAMPOS_COPIAVEIS`, e o ciclo pendente/ativo copia esse campo entre registros.

### Impacto

- Material de autenticação bancária exposto na internet, sem sessão.
- O PKCS#12 é protegido por senha (que **não** vazou — está cifrada no banco), mas um PFX exposto permite ataque offline contra a senha.
- Contraria diretamente RN-06 ("bytes do certificado nunca saem por log, retorno ou auditoria") — aqui saíam por um canal ainda mais direto.

### Estado atual (mitigado, não corrigido)

- Cópia pública removida (registro `File` + binário). `/files/certificado.pfx` responde 404.
- `certificado_arquivo` do ex-ativo (`c699b0110f`) foi **zerado manualmente** para remover o gatilho.
- Auditoria do `access.log`: nenhum acesso externo ao arquivo durante a exposição — apenas requisições do próprio diagnóstico (`172.18.0.1`).
- **O bug permanece no código.** A mitigação quebra o invariante do ciclo pendente (o pendente deixou de ser cópia integral do ativo).

---

## 4. Critério de sucesso

Nenhuma operação de configuração — em nenhum dos 4 pontos de disparo — pode resultar em arquivo de certificado acessível sem autenticação, e o invariante do ciclo pendente volta a valer.

---

## 5. Fora do escopo

- Renovar o certificado junto ao provedor (avaliado como desnecessário: sem acesso externo durante a exposição).
- Rever o modelo de armazenamento do certificado (Attach vs secret no host).
- Corrigir o comportamento do Frappe upstream.
