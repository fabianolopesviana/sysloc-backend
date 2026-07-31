# Relatório do Run — integracao-bancaria-configuravel/v3

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, mutações) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **1/1 task concluída** · 120 testes verdes (113 baseline + 7 novos) · 3 tentativas

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Impedir cópia pública do certificado no ciclo pendente/ativo | opus | 2 mod | ✅ APROVADO (3ª rodada) | ✅ APROVADO_COM_OBSERVACOES |

**O que foi corrigido**: `attach_files_to_document` (hook do Frappe no `on_update` de todo documento) criava um `File` **sem `is_private`** — portanto público — quando um campo `Attach` apontava para URL cujo `File` pertencia a outro registro. O ciclo pendente/ativo copiava `certificado_arquivo` entre registros e caía nisso, publicando o certificado em `public/files/`.

**Solução** (direção (c) do `scope.md` §5): novo helper `_replicar_vinculo_certificado` dá ao documento de destino um `File` privado **próprio**, fazendo o hook parar no caso (1). `_sincronizar_campos` deixa de copiar o campo cru; novo `_obter_pendente` centraliza os 3 call sites e reconcilia registros legados na leitura.

**Descoberta que invalidou um risco da spec**: o `scope.md` §5(c) previa risco de deleção em cascata do binário. O executor demonstrou, e o QA confirmou no fonte do Frappe, que isso não ocorre — `save_file` reaproveita o binário por `content_hash` (o vínculo é só mais uma linha de `File`) e `_delete_file_on_disk` só remove do disco quando nenhum outro `File` compartilha o hash.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado (severidade baixa não bloqueia). Resolva de uma vez com `/agent-spec-debt-resolution docs/specs/features/integracao-bancaria-configuravel/v3/`.

### D1 · BAIXO · architecture · T1 · Tech Review — ✓ em cleanup (v4-debits)
- **Onde:** `integracao_bancaria_api/service.py` (~370, docstring de `_replicar_vinculo_certificado`)
- **Problema:** o docstring afirma que a correção fecha a classe "em QUALQUER `save()` futuro, por qualquer caminho". A garantia real é condicional ao **estado** do documento (ter `File` próprio), não à escrita: o helper é invocado explicitamente em 3 pontos. Um caminho novo que atribua `certificado_arquivo` a um documento sem `File` próprio e salve volta a cair no caso (3).
- **Impacto:** nenhuma exposição presente — os 4 pontos estão fechados e provados por mutação. Risco futuro e documental: um leitor pode concluir que basta salvar por qualquer caminho novo.
- **O que fazer:** mover a garantia para o `on_update`/`before_save` do controller da DocType (ponto que toda escrita atravessa), deixando os 3 call sites como no-op idempotente; ou ajustar a redação ao escopo real. Extrair `"certificado_arquivo"` para constante referenciada por `CAMPOS_COPIAVEIS` e pelo `continue`.

### D2 · BAIXO · error_handling · T1 · Tech Review — ✓ em cleanup (v4-debits)
- **Onde:** `integracao_bancaria_api/service.py` (~819, docstring de `_apagar_certificado_privado`)
- **Problema:** a garantia "apagar o vínculo do pendente não apaga o binário porque o File do ativo compartilha o `content_hash`" é **condicional** a o ativo possuir `File` próprio. Se o **ativo** estiver em estado legado (campo preenchido, sem linha de `File`), o vínculo do pendente vira o único portador do hash e `remover_certificado` apagaria o binário do certificado em vigor.
- **Impacto:** perda do certificado em uso (emissão/baixa falhariam ou cairiam no `pfx_path_legado`). **Não alcançável** pelos fluxos pós-correção nem pelo estado atual de produção (o ativo `80eee0d13b` tem o `File` privado; quem está sem `File` é o pendente).
- **O que fazer:** antes do `delete_doc`, checar se outro registro da DocType referencia aquela `file_url` e pular a exclusão; ou reconciliar também o ativo; ou declarar a premissa no docstring.

### D3 · BAIXO · error_handling · T1 · Tech Review — ✓ em cleanup (v4-debits)
- **Onde:** `integracao_bancaria_api/service.py`, `_replicar_vinculo_certificado`
- **Problema:** o helper apaga os vínculos obsoletos **antes** de validar o alvo. As etapas não são simétricas em transacionalidade: `delete_doc` remove o binário do disco na hora, enquanto o rollback restaura apenas a linha do `File`. Com `url_alvo` inválido: (a) binário ausente → `IOError`, e a linha obsoleta volta apontando para binário já apagado; (b) url pública (`/files/...`, resíduo do incidente) → `ValidationError` do Frappe.
- **Impacto:** baixo — exige estado previamente corrompido. Trava as 4 operações de configuração com erro técnico em vez de erro de negócio. Nenhuma exposição de certificado; em (b) a falha é alta e explícita, confirmando a promessa de "divergência nunca silenciosa".
- **O que fazer:** pré-validar `url_alvo` (prefixo `/private/files/` + existência do binário) e devolver `_falha(...)` antes de qualquer deleção.

### D4 · BAIXO · code_quality · T1 · Tech Review — ✓ em cleanup (v4-debits)
- **Onde:** `integracao_bancaria_api/service.py`, `_obter_pendente`
- **Problema:** nome de leitura, contrato de escrita — a função pode criar o pendente, deletar e inserir `File`s (efeitos no banco e no filesystem) e mutar o documento. Os demais helpers do módulo usam verbos de escrita (`_criar_pendente_de_ativa`, `_ressincronizar_ex_ativo`, `_replicar_vinculo_certificado`).
- **Impacto:** legibilidade e risco futuro — um chamador novo que só queira *ler* o pendente herdaria escritas silenciosas. Sem impacto funcional hoje.
- **O que fazer:** renomear para `_preparar_pendente` ou `_obter_pendente_com_vinculo`.

## 3. Tasks Bloqueadas

✅ **Nenhuma task bloqueada.** T1 consumiu as 3 tentativas do ciclo, mas aprovou na terceira.

## 4. Notas para Revisão Humana

**As duas rejeições do QA foram legítimas e pegaram defeitos reais** — vale registrar porque ambas seriam invisíveis a uma revisão por leitura:

1. **Rodada 1 — tautologia de setup.** O QA aplicou **teste de mutação**: removeu individualmente cada chamada do helper e a suíte continuou **verde** em 2 dos 3 call sites. Os testes partiam de um estado em que o pendente já tinha `File` próprio, então as asserções eram verdadeiras por construção. Foi corrigido com `_estado_legado()`, que rebaixa o pendente ao estado real pré-correção.

2. **Rodada 2 — CRÍTICO de segurança.** O executor havia executado as mutações para provar detecção e **não restaurou a Mutação A**: a chamada em `_obter_pendente` ficou ausente, com o docstring prometendo o que o corpo não fazia. O QA rodou a suíte e reproduziu o vazamento real (`/files/certificado6d850a.pfx`, `is_private=0`). **Falha do orquestrador**: eu havia conferido o diff por grep agregado e concluído "estrutura intacta"; não verifiquei call site por call site. A partir daí passei a extrair o corpo de cada função programaticamente.

**Ressalva do executor validada, não descartada.** Ele contestou a premissa do QA de que a Mutação A deveria produzir 3 vermelhos, argumentando que são 2: em `enviar_certificado` o campo é sobrescrito e em `remover_certificado` é zerado, ambos **antes** do `save()`, então a reconciliação ali é defesa em profundidade sem efeito observável. O QA verificou no código e **deu razão a ele** — forjar um vermelho ali seria antipadrão. O Tech Review depois confirmou que isso é centralização legítima, não código morto.

**Colisão de ID corrigida**: os casos nasceram como CT-030/CT-031, mas CT-030/031/032 já designavam contratos da v1 (T10/T11). Renumerados para **CT-033/034/035**.

**Sinal de rule mining**: o QA emitiu `repeated_fixture` — o patch de `requests_pkcs12.post` com `_token_ok()` aparece em 4 pontos do arquivo de teste; um helper compartilhado evitaria mock drift.

## 5. Pós-merge (fora do run — pendente)

1. **Reconciliar o dado de produção.** `c699b0110f.certificado_arquivo` está `null` por mitigação manual do incidente. Com `_obter_pendente`, a reconciliação agora acontece **sozinha** na próxima edição da configuração — o passo manual previsto no `scope.md` §6 deixou de ser necessário. O CT-035 prova esse caminho.
2. **Verificar após a primeira operação de configuração**, conforme o `runbook_frappe.md` ("ALERTA - copia publica do certificado"): `ls public/files/*.pfx` vazio e `GET /files/certificado.pfx` → 404.
3. **Atualizar `reference/contexto_backend.md` e `reference/runbook_frappe.md`**, que descrevem o bug como não resolvido. ⚠️ São `root:root` e exigem `sudo`.
