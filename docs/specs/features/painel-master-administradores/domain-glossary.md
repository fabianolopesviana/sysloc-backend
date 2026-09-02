# Glossário de Domínio — Painel Master

> Termos operacionais desta feature. O vocabulário de negócio do produto (Empresa, Sysloc Master,
> Admin Empresa, Usuário Empresa, Vínculo de acesso) vive no glossário **global**, em
> `docs/specs/domain-glossary.md`, e não se repete aqui.
>
> Canonizados na sessão `/agent-spec-challenge-spec` de 2026-09-01.

## Termos

**Impedimento de exclusão**:
A restrição de chave estrangeira `ON DELETE no action` que o banco aciona ao recusar a remoção
física de uma Empresa ou de um Admin Empresa, traduzida na **classe** que a superfície devolve. O
identificador dele é o **`constraint_name`**, nunca a tabela referenciadora — é o que o erro `23503`
entrega no campo `constraint`, e uma mesma tabela pode carregar mais de uma restrição sobre o mesmo
alvo (`negocio.acesso_usuario_app` carrega duas sobre `identidade.usuario`).
_Evitar_: origem de impedimento, dependência bloqueante, vínculo impeditivo

**Caminho bloqueante**:
A cadeia de chaves estrangeiras por colunas `NOT NULL` que liga uma tabela de `negocio` até
`identidade.empresa`, e que faz a exclusão da Empresa ser recusada enquanto houver linha naquela
tabela. Direto quando a tabela referencia a Empresa ela própria; transitivo quando chega lá por
outra tabela de `negocio`. É a propriedade de que o critério de exclusão depende, e a ausência dela
em **qualquer** tabela torna uma Empresa cheia excluível deixando registros órfãos.
_Evitar_: cascata, corrente de FK, dependência transitiva

**Prévia de elegibilidade**:
O resultado de executar **a própria instrução do ato de exclusão** dentro de um ponto de salvamento
desfeito incondicionalmente, para responder se a exclusão seria aceita — nunca uma contagem de
registros escrita à parte. Não existe segundo critério: decidir e executar são a mesma instrução.
_Evitar_: pré-checagem, validação prévia, contagem de dependências

**Superfície do operador do SaaS**:
O conjunto de operações publicadas sob `/v1/master`, consumido pelo painel em
`syslocadmin.systera.com.br`. Fica **fora** do congelamento do marco de entrega (ADR-0039), que
alcança apenas a superfície que o pacote de contratos entrega à aplicação da imobiliária.
_Evitar_: superfície do Master, rotas administrativas, área administrativa

## Relacionamentos

- Uma **Empresa** só é removível quando nenhuma tabela de `negocio` alcançável por **Caminho
  bloqueante** guarda linha dela.
- Um **Impedimento de exclusão** é o que a **Prévia de elegibilidade** devolve quando a instrução
  ensaiada é recusada; a classe dele é derivada do `constraint_name` por mapa fechado.
- Toda operação da **Superfície do operador do SaaS** exige o perfil `SYSLOC_MASTER`, e nenhuma
  delas estabelece contexto de empresa.

## Ambiguidades resolvidas

- **"origem" de impedimento** era usado tanto para a **tabela** referenciadora quanto para a
  **restrição** — e as duas contagens divergem: sobre `identidade.usuario` são **7** tabelas e
  **8** restrições. Resolvido: o termo canônico é **Impedimento de exclusão**, e a unidade é a
  **restrição**. A palavra "origem" não se usa.
- **"exclusão"** significava tanto retirada de circulação (o cadastro do domínio, ADR-0014) quanto
  remoção física (a identidade, ADR-0038). Resolvido: nesta feature, **exclusão é sempre física**,
  e a retirada de circulação chama-se **suspensão**.
