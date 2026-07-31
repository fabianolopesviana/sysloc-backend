# Glossário de Domínio — Integração bancária configurável

> Termos específicos desta feature. Termos cross-feature vivem em `/docs/specs/domain-glossary.md`, que tem precedência menor em caso de conflito (feature sobrescreve global).

## Termos

**Configuração ativa**:
O único conjunto de credenciais, endereços e conta em vigor para um provedor num dado momento. Toda operação de cobrança exige exatamente uma — nem zero, nem duas.
_Evitar_: configuração vigente, config em uso, integração ativa

**Configuração pendente**:
Conjunto de alterações salvo mas ainda sem efeito, aguardando teste de conexão bem-sucedido para poder ser ativado. Existe no máximo uma por provedor e é sobrescrita livremente enquanto não for aprovada.
_Evitar_: rascunho, configuração provisória, draft

**Credencial**:
O certificado digital e a senha que autenticam o sistema junto ao provedor. Pode ter duas origens: enviada pela tela (arquivo privado gerenciado pela aplicação) ou pré-existente (arquivo montado no servidor, usado como fallback enquanto nenhuma for enviada).
_Evitar_: certificado (isolado), PFX, chave, cert

**Situação canônica**:
Estado do boleto expresso no vocabulário neutro do sistema, independente do texto que o provedor devolveu. O texto original é preservado ao lado, nunca substituído.
_Evitar_: status do boleto, situação do banco, estado bruto

## Relacionamentos

- Uma **Configuração pendente** torna-se **Configuração ativa** ao passar no teste de conexão; a anterior é desativada na mesma transação.
- Toda **Configuração ativa** referencia exatamente uma **Credencial**, de origem enviada ou pré-existente.
- Toda consulta a um boleto produz uma **Situação canônica** acompanhada do texto original do [[provedor]].

## Ambiguidades resolvidas

- "Configuração" era usado tanto para o que está em vigor quanto para o que está sendo editado. Resolvido: **Configuração ativa** e **Configuração pendente** são registros distintos, com ciclos de vida distintos.
- "Certificado" era usado ora para o arquivo, ora para o conjunto arquivo + senha. Resolvido: **Credencial** designa o conjunto; "certificado" refere-se apenas ao arquivo.
