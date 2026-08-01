# Versão do banco: verificação × operação (CA-14)

> **Arquivo gerado** por `deploy/scripts/instalacao/apurar-versao-banco.sh`.
> Não edite à mão: a próxima execução reescreve o arquivo inteiro. Para atualizá-lo,
> execute o procedimento de novo.

Este registro existe porque quem escrever a primeira migração precisa saber contra qual
versão os testes rodam. A verificação levanta instância efêmera própria (ADR-0006) e a
operação roda a instância provisionada por `provisionar-base.sh`: as duas vêm de origens
diferentes por construção, e a diferença entre elas é dado, não suposição.

## Apuração

| Lado | Configuração lida | Destino consultado | `SHOW server_version` |
|---|---|---|---|
| Verificação (instância efêmera da suíte) | `/tmp/carimbar-ca14-4vaC7m/verificacao.env` | `127.0.0.1:24204` | `18.4` |
| Operação (instância provisionada) | `/etc/sysloc/backend.env` | `/var/run/postgresql:5432` | `18.4 (Ubuntu 18.4-1.pgdg24.04+1)` |

Data da apuração: 2026-08-01T09:43:59Z

Sem divergência: os dois lados executam PostgreSQL 18.4.

As duas leituras vieram de `SHOW server_version` executado na instância que a
configuração de cada lado aponta — nenhuma delas foi inferida de pacote instalado ou
de arquivo de configuração. O rótulo do lado da operação é **derivado** do arquivo de
ambiente que foi lido, e não escrito à mão: ele só diz `instância provisionada` quando
a configuração veio de `/etc/sysloc/backend.env`, que é o arquivo que as unidades de
serviço consomem; qualquer outro caminho produz `SUBSTITUTO` no próprio rótulo.

## O que quem escrever a primeira migração precisa saber

- Os dois lados estão na mesma versão. Nenhum recurso precisa ser evitado por causa
  de diferença de versão, e o que a verificação aprovar vale para a operação.
- Ausência de divergência **hoje** não é garantia permanente: ela some no dia em que
  qualquer um dos dois lados subir de versão sozinho — a dependência de teste que
  empacota o binário da verificação e o pacote do sistema na operação são atualizados
  por caminhos independentes. Reexecute este procedimento a cada mudança de qualquer
  um dos dois.
