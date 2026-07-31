# QA Context — fundacao-stack-nativa/v1

> Gerado em 2026-07-31 a partir de `intent.md` + `scope.md`. Se o `scope.md` for editado
> após esta data (ex.: via /agent-spec-challenge-spec), este arquivo está STALE — regenere-o
> ou consulte INTENT/SCOPE diretamente.

## Natureza da feature

Fatia **F0** do programa de substituição do backend legado. Entrega a **fundação de execução**: base instalada nativamente no sistema operacional, que sobe sozinha, se recupera de queda sem intervenção e é verificável automaticamente. **Zero regra de negócio, zero estrutura de dados de domínio** — exclusão explícita da INTENT.

Variante: `backend`. Stack: Node 24 LTS · TypeScript estrito · NestJS+Fastify · BullMQ+Redis · PostgreSQL 18 · Vitest · pnpm+Turborepo+Biome · systemd. **Nada disso existe ainda** — `apps/` e `packages/` estão vazios, não há `package.json`, `vitest.config.ts` nem qualquer manifesto. A suíte de testes nasce nesta feature.

## Contexto operacional crítico

- O servidor é **compartilhado com o ambiente legado que atende a operação hoje** (`/opt/frappe`, em produção). Nada pode degradá-lo.
- **Disco acima de 75%** de ocupação.
- O reinício completo do servidor é critério de aceitação, executado em **janela de indisponibilidade combinada**.

## Critérios de aceite (CA-1 a CA-16, do scope §4)

1. Instalação e construção a partir do repositório limpo, sem erro e sem passo manual não previsto
2. `GET /saude` responde `200` **sem** consultar banco nem fila
3. `GET /saude/pronto` responde `200` com estado por dependência; `503` quando alguma não está alcançável
4. Descrição do contrato publicada e navegável (`GET /docs`)
5. Tarefa enfileirada é consumida pelo processador e concluída, com registro do término
6. Verificação automatizada passa subindo instância efêmera **própria** de banco **e** de fila; nenhuma é a instância provisionada
7. Instâncias efêmeras descartadas ao fim, sem diretório de dados nem processo órfão
8. Encerrar o processo do serviço de aplicação → supervisor do SO traz de volta sozinho
9. Após reinício completo do servidor: aplicação, processador **e o ambiente legado** voltam sozinhos
10. Tarefa enfileirada antes de parada do servidor de fila continua presente após ele voltar
11. Scripts de instalação executados 2× seguidas não duplicam nem sobrescrevem; terminam com sucesso
12. Nenhum script versionado carrega credencial; segredos em arquivo de ambiente com permissão restrita, fora do repositório
13. Erro provocado devolve corpo `{codigo, mensagem, campo?, detalhes?}` + status HTTP semântico (ADR-0007), não o formato padrão do framework
14. Divergência de versão entre o banco da verificação e o de operação apurada e **registrada em arquivo versionado**
15. Processo falha na partida, nomeando a variável ausente, quando falta configuração obrigatória
16. Nenhuma alteração no ambiente legado, exceto a janela combinada

## Decisões do scope que as tasks herdam

- **Instâncias efêmeras próprias** de banco e fila na verificação (ADR-0006). Banco: binário empacotado pela dependência de teste. Fila: binário já provisionado no sistema, com diretório e porta próprios. Nenhuma das duas é a instância que atende (ou virá a atender) a operação.
- **Saúde rasa × profunda separadas**: a rasa é consultada pelo supervisor do SO (se consultasse o banco, oscilação do banco derrubaria a aplicação em cascata); a profunda existe para provar que as dependências subiram após o reinício.
- **Rotas em português** (`/saude`, `/saude/pronto`), coerentes com o contrato que a ADR-0007 fixou.
- **Envelope de erro nasce conforme a ADR-0007**, não retrofitado.
- **Scripts de instalação versionados e idempotentes** (ADR-0005); nenhum carrega credencial.
- **Versionamento de API: decisão diferida** — não há recurso de negócio publicado.

## Componentes (nome → responsabilidade)

| Componente | Responsabilidade |
|---|---|
| Raiz do workspace | Fixar runtime/ferramentas, declarar pacotes, orquestrar build, formatar/lintar, TypeScript estrito compartilhado |
| `provisionar-base.sh` | Instalar e configurar banco, fila (com persistência em disco) e capturador de e-mail; idempotente; medir disco antes |
| `@sysloc/shared` → `erros.ts` | Tipo do corpo de erro e enum de códigos (ADR-0007) |
| `@sysloc/shared` → `log.ts` | Registro estruturado com correlação por requisição; sem segredo nem dado pessoal |
| `postgres-efemero.ts` / `redis-efemero.ts` | Subir e derrubar instância efêmera por execução da suíte |
| `apurar-versao-banco.sh` | Apurar versão do banco na verificação e na operação; gravar registro versionado (CA-14) |
| `apps/api` → `ambiente.ts` | Ler e validar variáveis de ambiente na partida; falhar nomeando a ausente |
| `apps/api` → `saude/*` | Rotas rasa e profunda |
| `apps/api` → `filtro-excecao.ts` | Traduzir exceção no formato da ADR-0007 |
| `apps/worker` → `fila.ts` + `tarefas/eco.ts` | Conexão à fila e tarefa trivial de ida e volta (única prova do caminho fila → processador) |
| `deploy/systemd/*.service` | Unidades com reinício automático, dependências declaradas, segredos por arquivo externo |
| `instalar-unidades.sh` / `verificar-fundacao.sh` | Posicionar/habilitar unidades (idempotente); executar a bateria de aceitação |

## Paths a criar (agregado)

`.mise.toml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `vitest.config.ts`, `mprocs.yaml`, `.env.example` · `apps/api/{package.json,tsconfig.json,src/{main.ts,app.module.ts,configuracao/ambiente.ts,saude/{saude.controller.ts,saude.service.ts,saude.module.ts},comum/filtro-excecao.ts},test/saude.e2e.spec.ts}` · `apps/worker/{package.json,tsconfig.json,src/{main.ts,fila.ts,tarefas/eco.ts},test/eco.spec.ts}` · `packages/shared/{package.json,tsconfig.json,src/{index.ts,erros.ts,log.ts},test/{postgres-efemero.ts,redis-efemero.ts,ambiente-efemero.spec.ts}}` · `deploy/systemd/{sysloc-api.service,sysloc-worker.service}` · `deploy/scripts/instalacao/{provisionar-base.sh,instalar-unidades.sh,verificar-fundacao.sh,apurar-versao-banco.sh}`

Modificar: `.gitignore`.

## ADRs aplicáveis (já confrontadas literalmente no scope §5)

- **ADR-0005** — rotinas operacionais versionadas com instalação idempotente; nenhum script entra carregando credencial
- **ADR-0006** — a suíte nunca executa contra o ambiente que atende a operação; o invariante é a separação
- **ADR-0007** — forma canônica do contrato: envelope de erro `{codigo, mensagem, campo?, detalhes?}` + status HTTP semântico; corpo em camelCase

## Observação para geração de testes

Não existe suíte no repositório. Espere `NO_SUITE_FOUND` e proponha o arquivo na convenção da stack alvo (Vitest, `*.spec.ts`). Os scripts de shell (`deploy/scripts/instalacao/*.sh`) não têm framework de teste no projeto — trate a verificação deles com a mesma disciplina usada na feature `caracterizacao-regras-legadas` (shell com asserções, exit code), cujo precedente está em `deploy/scripts/caracterizacao/verificar-golden.sh`.
