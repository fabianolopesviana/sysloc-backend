# Architecture Decision Records — INDEX

> Ultima atualizacao: 2026-08-02 (8 ADRs)

<!-- ADR-INDEX-START -->
| ID | Titulo | Status | Tags | Problema (1-linha) | Decisao (1-linha) |
|----|--------|--------|------|---------------------|--------------------|
| 0001 | Modelo canônico de cobrança bancária com adaptador por provedor | accepted | architecture, data, http | A integração de boletos foi construída acoplada ao Sicoob: os módulos de operação montam o payloa... | Toda a operação de cobrança bancária passa a trafegar em tipos canônicos agnósticos de provedor. ... |
| 0002 | Versionar estrutura de dados do app em arquivo | accepted | data, build | A estrutura de dados do domínio foi inteiramente criada pela interface administrativa do framewor... | Toda estrutura de dados criada a partir desta decisão nasce descrita em arquivo no repositório e ... |
| 0003 | Custom DocPerm como fonte única de permissão dos DocTypes de negócio | accepted | security, architecture, data | A contenção da credencial exposta criou um papel de serviço (Servico App) com permissão restrita ... | Os nove DocTypes de negócio — Atraso, Cobranca, Conjunto, Contrato, Fiador, Imovel, Locador, Loca... |
| 0004 | Endpoints herdados de Server Script preservam o nome curto | accepted | architecture, http, security | Os quatro Server Scripts ativos de tipo API expõem apimethod sem namespace — authlocacaoimoveis, ... | Os quatro endpoints herdados de Server Script preservam seus nomes curtos após a migração para có... |
| 0005 | Rotinas operacionais versionadas no repositório com instalação idempotente | accepted | build, architecture, security | As rotinas automáticas são disparadas pelo agendador do sistema operacional, e sua configuração e... | Toda rotina operacional agendada — a definição de agendamento e os scripts que ela invoca — vive ... |
| 0006 | Ambiente de verificação separado do ambiente que atende a operação | accepted | testing, architecture | A suíte de verificação executa contra o mesmo ambiente que atende a operação, porque nunca existi... | A suíte de verificação nunca executa contra o ambiente que atende a operação. Qual ambiente concr... |
| 0007 | Forma canônica do contrato da API do backend novo | accepted | http, architecture, error-handling | A API do Frappe vazou sua forma para dentro do frontend: name é chave e rótulo exibido em 11 inte... | Todo recurso da API obedece a cinco regras de forma: a chave exposta é o código textual legível (... |
| 0008 | Isolamento multi-tenant garantido pelo banco, não pela aplicação | accepted | architecture, security, data | O produto atende de 20 a 300 empresas sobre isolamento lógico — um banco só, com a coluna de | O isolamento entre empresas é propriedade do banco: toda tabela de negócio nasce com |
<!-- ADR-INDEX-END -->
