#!/usr/bin/env bash
#
# Provisionamento dos serviços de base do backend Sysloc — T2 da fatia
# `fundacao-stack-nativa`.
#
# Instala e configura, diretamente no sistema operacional e sem camada de
# conteinerização, os três serviços de base:
#
#   1. PostgreSQL 18, do repositório oficial do fornecedor (PGDG), gerenciado
#      pelo sistema operacional e escutando APENAS no endereço de retorno
#      (127.0.0.1) e no socket de domínio Unix — nada dele é alcançável de fora
#      desta máquina;
#   2. uma INSTÂNCIA PRÓPRIA do Redis 7, com persistência em disco (AOF) ligada,
#      em porta e diretório de dados próprios;
#   3. o Mailpit, capturador de e-mail de desenvolvimento, preso ao endereço de
#      retorno (127.0.0.1) e sem exposição externa.
#
# ADR-0005 — rotina operacional versionada no repositório e posicionada por
# procedimento de instalação IDEMPOTENTE. Executar este script duas vezes
# seguidas termina com sucesso nas duas e não produz efeito adicional: serviço
# já instalado não reinstala, papel já existente não recria, configuração já
# correta não é reescrita. Cada passo imprime `CRIADO` (mudou algo) ou `JA-OK`
# (já estava correto), para que a segunda execução seja auditável linha a linha.
#
# ADR-0005, condição de entrada — NENHUMA credencial entra no repositório. As
# credenciais do banco — a do papel da aplicação e a do papel de migração — são
# GERADAS em tempo de execução e gravadas exclusivamente em ${ARQ_AMBIENTE} e
# ${ARQ_AMBIENTE_MIGRACAO} respectivamente (fora da árvore versionada por
# construção, não por regra de ignore) com modo 0600, e daí em diante apenas
# LIDAS. Os dois arquivos são separados de propósito: só o primeiro é
# `EnvironmentFile=` de unidade de serviço, e a credencial do papel DONO das
# tabelas não entra no ambiente do processo que atende requisição. Elas nunca
# são impressas, nunca trafegam por argumento de linha de comando e nunca são
# regravadas quando já existem — regerá-las a cada execução quebraria as
# unidades de serviço e o script de migração que as consomem. Por isso o
# rastreio verboso de comandos do shell jamais é ligado
# aqui: ele ecoaria o valor no log da operação. A bateria de verificação confere
# essa ausência de forma literal.
#
# ADR-0006 — a instância de fila provisionada aqui NÃO é a que a verificação
# automatizada usa. A suíte sobe instância efêmera própria, com diretório e
# porta próprios. Este script provisiona o ambiente que virá a atender a
# operação; a separação entre os dois é o invariante da ADR.
#
# ---------------------------------------------------------------------------
# Convivência com o ambiente legado (guardrail mais caro desta fatia)
# ---------------------------------------------------------------------------
#
# Este servidor é COMPARTILHADO com o ambiente que atende a operação hoje
# (/opt/frappe em Docker, mais uma pilha CloudPanel com nginx, Varnish, Percona,
# memcached e um `redis-server` de sistema na porta 6379). Nada aqui pode
# degradá-lo. Três decisões decorrem disso:
#
#   * O `redis-server` de sistema NÃO é reconfigurado. O pacote do Debian/Ubuntu
#     já traz a unidade-modelo `redis-server@.service`; provisionamos uma
#     INSTÂNCIA nomeada (`redis-server@sysloc`), com arquivo de configuração,
#     diretório de dados, arquivo de log e porta próprios. Reiniciar a nossa
#     instância — na verificação e na operação — nunca afeta a do legado.
#   * O PostgreSQL escuta no endereço de retorno (`listen_addresses =
#     '127.0.0.1'`) ALÉM do socket de domínio Unix — ver "Por que o banco
#     escuta em TCP", adiante. Nada dele é alcançável de fora desta máquina, e a
#     autenticação do papel da aplicação continua `scram-sha-256`, restrita ao
#     banco da aplicação e à rede ${REDE_LOOPBACK_DB}. Como ele deixou de ser o
#     único serviço sem porta, a porta do cluster ENTRA no guarda de colisão —
#     derivada da configuração do próprio cluster, nunca fixada aqui. Era essa a
#     condição que este cabeçalho registrava enquanto a escuta era nenhuma, e
#     ela está cumprida.
#   * As portas efetivamente ocupadas são DERIVADAS do estado real da máquina
#     (`ss -ltn`), nunca de lista fixa. Se uma porta que este script pretende
#     usar já estiver ocupada por outro processo, ele ABORTA nomeando a porta e
#     o dono — em vez de tomá-la.
#
# O script também simula a instalação de pacotes antes de executá-la e aborta se
# o gestor de pacotes pretender REMOVER qualquer coisa.
#
# ---------------------------------------------------------------------------
# Por que o banco escuta em TCP, e não só no socket de domínio Unix
# ---------------------------------------------------------------------------
#
# Porque `DATABASE_URL` precisa ser uma URL — e socket de domínio Unix não cabe
# em uma. As três formas candidatas foram exercitadas contra o cliente que a
# aplicação de fato usa (`postgres.js`, que constrói as opções de conexão com
# `new URL()`), e nenhuma alcança o socket:
#
#   postgresql://u:p@/sysloc?host=/var/run/postgresql&port=5432
#       não é URL válida — o interpretador do runtime a rejeita, e o cliente
#       lança `Invalid URL` antes de qualquer tentativa de conexão;
#   postgresql://u:p@%2Fvar%2Frun%2Fpostgresql:5432/sysloc
#       é URL válida, mas o cliente NÃO decodifica a codificação percentual:
#       tenta resolver `%2Fvar%2Frun%2Fpostgresql` como nome de máquina;
#   postgresql://u:p@localhost:5432/sysloc?host=/var/run/postgresql
#       é URL válida, mas o cliente IGNORA o `?host=` e vai para o endereço.
#
# Relaxar a validação de partida da aplicação não resolveria: o cliente só
# alcança socket pelo OBJETO de opções (`host: '/var/run/postgresql'`), nunca
# por URL. O processo passaria na partida e quebraria na primeira consulta.
#
# A alternativa — manter o socket e traduzir a cadeia dentro da aplicação — foi
# descartada porque exigiria a mesma tradução em toda ferramenta futura
# (migrador, cliente de linha de comando, apuração de versão) e faria
# `DATABASE_URL` deixar de ser uma URL que outras ferramentas leem. Escutar em
# `127.0.0.1` devolve uma cadeia que `psql`, `postgres.js` e o migrador da fatia
# seguinte entendem sem tradução, ao custo de uma porta que não sai desta
# máquina e de uma regra de `pg_hba` restrita a ela.
#
# ---------------------------------------------------------------------------
# Parâmetros de operação (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_DESTINO_DISCO      Sistema de arquivos medido antes de instalar
#                             qualquer coisa. Padrão: `/`, que é onde pacotes,
#                             cluster do banco, dados da fila e binário do
#                             capturador de e-mail aterrissam nesta máquina.
#                             Altere se /var passar a viver em volume próprio.
#
#   SYSLOC_MINIMO_DISCO_MIB   Espaço livre mínimo exigido, em MiB.
#                             Padrão: 1024. O valor NÃO é arbitrário — vem da
#                             soma medida dos componentes, com margem:
#
#                               pacotes do PostgreSQL 18 (instalados) .. 47 MiB
#                                 postgresql-18 34,6 + client-18 10,0 +
#                                 common 0,3 + client-common 0,2 + libpq5 1,2
#                               cache de download do apt ............... 10 MiB
#                               listas do repositório novo ............. 25 MiB
#                               cluster inicial (initdb + WAL) ......... 55 MiB
#                               binário do capturador + tarball ........ 45 MiB
#                               folga de crescimento do AOF da fila ... 200 MiB
#                               ------------------------------------------------
#                               subtotal medido ....................... 382 MiB
#                               margem de segurança (~2,7x) .......... 1024 MiB
#
#                             Reduza-o com cuidado: um `apt install` que morre
#                             sem espaço deixa o gestor de pacotes inconsistente
#                             e isso DEGRADA o ambiente legado, que é justamente
#                             o que esta fatia não pode fazer.
#
# Ao subir a versão fixada do capturador de e-mail (MAILPIT_VERSAO), atualize
# junto o MAILPIT_SHA256 — o binário vem de um artefato de release que o
# fornecedor não acompanha de arquivo de somas, então a soma é fixada aqui e
# conferida no download. Para obter a nova soma:
#
#   curl -sL https://github.com/axllent/mailpit/releases/download/<TAG>/mailpit-linux-amd64.tar.gz | sha256sum
#
# ---------------------------------------------------------------------------
# Uso
# ---------------------------------------------------------------------------
#
#   sudo bash deploy/scripts/instalacao/provisionar-base.sh
#
# Exige privilégio administrativo e acesso de rede ao repositório do PostgreSQL
# e ao artefato do capturador de e-mail. Verificação correspondente:
#
#   sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh
#

set -Eeuo pipefail

# --------------------------------------------------------------------------- #
# Constantes. O verificador confere que estes valores continuam declarados aqui
# nesta forma literal — mudá-los sem atualizar o verificador reprova a bateria,
# que é exatamente a proteção contra divergência silenciosa.
# --------------------------------------------------------------------------- #
readonly PREFIXO="[provisionar]"

readonly VERSAO_POSTGRES="18"
readonly PAPEL_DB="sysloc_app"
readonly BANCO_DB="sysloc"

# Papel DONO dos objetos e único que aplica migração (D2 da fatia
# `fundacao-multitenancy-identidade`). Ele não atende requisição, e o papel que
# atende não pertence a ele: contornar o isolamento passa a exigir duas falhas
# independentes em vez de uma. As restrições são as MESMAS do papel da aplicação
# — ser dono das tabelas já é o poder que ele precisa ter, e nenhum a mais.
readonly PAPEL_MIGRACAO="sysloc_migracao"

# Papel de PROPÓSITO ÚNICO: ser dono da função `negocio.resolver_portador_de_confirmacao`
# (migração `0014`). Ele não conecta (`NOLOGIN`, e nenhuma credencial é gerada
# para ele) e não é dono de tabela alguma.
#
# Ele existe porque `SECURITY DEFINER` NÃO atravessa `FORCE ROW LEVEL SECURITY`:
# a função roda como o dono dela, e enquanto esse dono era `${PAPEL_MIGRACAO}` —
# que é também o dono das tabelas, e é exatamente o papel que o `FORCE` deixou de
# isentar — a resolução do portador sem contexto devolvia zero linhas. A
# travessia passa a ser NOMINAL: uma política que alcança só este papel, e não um
# privilégio que ignora política. O detalhe está no bloco 2 da `0014`.
#
# Ele nasce AQUI, e não na migração, pela mesma razão dos schemas: `${PAPEL_MIGRACAO}`
# é NOCREATEROLE, e criar papel de lá devolve
# `42501 · Only roles with the CREATEROLE attribute may create roles`.
readonly PAPEL_RESOLUCAO="sysloc_resolucao"

# Papel de PROPÓSITO ÚNICO: ser dono da função
# `negocio.rotear_notificacao_bancaria` (migração `0020`). Mesmas propriedades
# de `${PAPEL_RESOLUCAO}` — `NOLOGIN`, sem credencial, dono de NENHUMA tabela —
# e pela mesma razão: `SECURITY DEFINER` não atravessa `FORCE ROW LEVEL
# SECURITY`, e o que atravessa é a posse por um papel nominal somada a uma
# política endereçada a ele.
#
# Ele é um QUARTO papel, e NÃO o reuso do terceiro. A emenda de 2026-08-13 da
# ADR-0024 exige `GRANT` mínimo — `SELECT` sobre *"a única tabela alcançada"* —,
# e reusar `${PAPEL_RESOLUCAO}` o faria alcançar DUAS tabelas
# (`negocio.portador_de_confirmacao` e `negocio.cobranca`), diluindo exatamente
# a propriedade que a ADR nomeia. O custo é este bloco, que é mecânico.
readonly PAPEL_ROTEAMENTO="sysloc_roteamento"

# Banco DESCARTÁVEL que a bateria `verificar-migracao.sh` cria e remove para
# exercitar o mutante de cobertura. Ele NÃO é criado aqui e não deve existir em
# repouso; o nome mora nesta constante por um motivo só: a regra de autenticação
# do papel de migração é declarada pelo bloco gerido de ${ARQ_PG_HBA}, e uma
# regra que não o nomeasse obrigaria a bateria a editar aquele arquivo — o que
# seria verificação alterando a configuração que ela deveria conferir.
readonly BANCO_VERIFICACAO="sysloc_verificacao"

# Os dois schemas da ADR-0009: `identidade` opera antes de existir contexto de
# empresa; `negocio` tem toda tabela vinculada a empresa, com RLS forçada. Eles
# nascem AQUI, e não na migração — ver `sql_preparar_banco_para_migracao`.
readonly SCHEMA_IDENTIDADE="identidade"
readonly SCHEMA_NEGOCIO="negocio"
# O terceiro schema, da ADR-0031: o que NÃO é dado de empresa nenhuma vive fora do
# schema de negócio e não carrega `empresa_id`. Ele guarda hoje a sequência e a
# função do identificador perante o provedor bancário (migração `0016`), e
# NENHUMA tabela — o roster de tabelas dele é vazio nesta fatia, e o vazio é o
# conteúdo: tabela nova ali só entra por alteração explícita e revisada.
#
# Nele NÃO há política de linha a impor (sequência não tem RLS): a proteção do que
# mora ali é papel e privilégio, e é por isso que `${PAPEL_DB}` recebe `USAGE` no
# schema e NADA sobre a sequência — só `EXECUTE` sobre a função, concedido pela
# própria `0016`.
readonly SCHEMA_PLATAFORMA="plataforma"

# Endereço em que o cluster escuta e que a cadeia de conexão declara. Endereço de
# retorno literal, e não `localhost`: o nome resolve para 127.0.0.1 e ::1 conforme
# a ordem de `/etc/hosts` e da resolução de nomes desta máquina, e uma cadeia de
# conexão que às vezes vai para IPv6 é uma fonte de falha intermitente que a regra
# de `pg_hba` abaixo não cobriria. A rede é a máscara correspondente, usada na
# regra de autenticação — e não `0.0.0.0/0`, que abriria o banco à rede.
readonly HOSPEDEIRO_DB="127.0.0.1"
readonly REDE_LOOPBACK_DB="127.0.0.1/32"

readonly INSTANCIA_FILA="sysloc"
readonly PORTA_FILA=6380
readonly ARQ_FILA_CONF="/etc/redis/redis-sysloc.conf"
readonly DIR_FILA_DADOS="/var/lib/redis/sysloc"
readonly UNIDADE_FILA="redis-server@sysloc.service"

readonly PORTA_SMTP_CAPTURADOR=1025
readonly PORTA_HTTP_CAPTURADOR=8025
readonly MAILPIT_VERSAO="v1.30.6"
readonly MAILPIT_SHA256="00f7570bf47c9683944f6189379ce4b7d4974b1c9cd911f93c55d4ad945bf3d2"
readonly BIN_CAPTURADOR="/usr/local/bin/mailpit"
readonly DIR_ESTADO_CAPTURADOR="/var/lib/sysloc-mailpit"
readonly ARQ_UNIDADE_CAPTURADOR="/etc/systemd/system/sysloc-mailpit.service"
readonly UNIDADE_CAPTURADOR="sysloc-mailpit.service"

# Endereço que assina o aviso de cobrança — o `From` da mensagem que a régua
# entrega, e a quinta chave do arquivo de ambiente.
#
# CAUSA de existir: o processador de trabalho passou a EXIGIR `EMAIL_REMETENTE`
# na partida, e a exigência recusa a subida quando a variável falta. Sem esta
# constante o arquivo nasceria sem a chave numa instalação de máquina nova, a
# unidade recusaria a partida nomeando a variável, o supervisor tentaria 5 vezes
# e desistiria — o modo de falha exato que o débito `D39 · F1/fechamento`
# descrevia, e que respondeu por 11 das 14 falhas da bateria agregada da F0. (Ele
# foi fechado em 2026-08-16; o modo de falha continua sendo a razão desta
# constante existir.)
#
# Ela NÃO é segredo, e é por isso que tem valor PADRÃO declarado em vez de ser
# gerada como a credencial do banco: é conteúdo de negócio. O domínio `.invalid`
# é reservado pela RFC 6761 justamente para não resolver em lugar nenhum — o
# valor é utilizável de imediato contra o capturador local (que é para onde a
# `SMTP_URL` provisionada aponta) e é obviamente um substituto a trocar quando a
# instalação passar a falar com um servidor de e-mail de verdade.
readonly REMETENTE_PADRAO_DO_AVISO="avisos@sysloc.invalid"

# Endereço público do aplicativo, sobre o qual o link de confirmação de e-mail é
# composto — a sexta chave do arquivo de ambiente.
#
# CAUSA de existir: a T9 da fatia `documentos-e-confirmacao` fez a `api` EXIGIR
# `URL_BASE_DA_CONFIRMACAO` na partida, e a T10 fará o mesmo no processador de
# trabalho, que é quem de fato compõe o link. O arquivo de ambiente é UM SÓ e é o
# `EnvironmentFile=` das duas unidades (§16.3 da tech spec da fatia), de modo que
# semeá-lo aqui entrega a chave aos DOIS processos de uma vez — a alternativa,
# declará-la por `Environment=` em cada unidade, criaria duas atribuições
# literais da mesma coordenada, livres para divergir.
#
# Ela NÃO é segredo: é o endereço que qualquer pessoa digita no navegador. Por
# isso tem valor PADRÃO declarado, como o remetente acima, em vez de ser gerada.
# O domínio `.invalid` é reservado pela RFC 6761 e não resolve em lugar nenhum:
# o valor é obviamente um substituto, e o endereço real é decidido na VIRADA
# (F7), quando o aplicativo passa a ser publicado atrás do servidor de borda. A
# partida dos serviços é recusada sem a linha, de modo que a troca não pode ser
# esquecida em silêncio.
readonly URL_BASE_PADRAO_DA_CONFIRMACAO="https://sysloc.invalid"

# Endereço do provedor bancário contra o qual a identidade da empresa é
# verificada — a sétima chave do arquivo de ambiente.
#
# CAUSA de existir: a T11 da fatia `fundacao-bancaria` fez a `api` EXIGIR
# `ENDERECO_DO_PROVEDOR_BANCARIO` na partida. Ele vem do AMBIENTE e nunca do
# corpo nem da sessão, e é essa origem que fecha a requisição forjada do lado do
# servidor: nenhuma entrada de cliente decide para onde o produto conecta
# apresentando o certificado de uma empresa.
#
# Ela NÃO é segredo — é um endereço —, e por isso tem valor PADRÃO declarado em
# vez de ser gerada, pelo mesmo critério das duas chaves de conteúdo acima. O
# domínio `.invalid` (RFC 6761) não resolve em lugar nenhum: o valor é
# obviamente um substituto, e o endereço real do provedor é decidido quando a
# empresa passa a cobrar de verdade. A FORMA não é conferida aqui nem na leitura
# do ambiente — quem recusa o endereço que não serve é a construção do
# adaptador, num lugar só —, de modo que este substituto não precisa satisfazer
# nada além de existir.
readonly ENDERECO_PADRAO_DO_PROVEDOR_BANCARIO="https://provedor.sysloc.invalid"
# O substituto do endereço de AUTORIZAÇÃO, em domínio reservado pela RFC 6761 — ele
# não resolve em lugar nenhum, e a instalação o troca pelo do banco real.
readonly ENDERECO_PADRAO_DE_AUTORIZACAO_BANCARIA="https://autorizacao.sysloc.invalid"

# Para ONDE o provedor entrega a notícia — o endereço público desta instalação.
# Exigido na partida da `api` desde a T7 da fatia `integracao-bancaria-autonoma`
# (fechamento do `D29`): sem ele, as duas operações da entrega resolvem negativas
# SEM chamar o provedor, e o Admin lê "o provedor não respondeu" onde o fato é
# "esta instalação não foi configurada". Nasce com substituto em domínio
# reservado pela RFC 6761; o caminho é o da rota que recebe a notícia, e o
# hostname é trocado pelo real quando o vhost da notificação for publicado.
#
# ⚠️ DIVERGÊNCIA DE ESCOPO DECLARADA: este arquivo NÃO está na §5.1/§5.2 do card
# da T7, nem no raio de impacto que ela declara — aquele raio é derivado das
# âncoras de superfície, e esta é uma consequência da conferência de PARTIDA da
# `api`. A razão de abri-lo é o fecho do `D29` (achado `architecture` do Gate 2
# da T6): a variável passou a ser EXIGIDA em `apps/api/src/configuracao/
# ambiente.ts`, e um arquivo de ambiente sem a linha faria o serviço recusar
# subir — este script é quem o semeia. Mesmo molde das anotações do
# `D26 (F2/T6)` que esta task deixou em `apps/api/test/contexto.e2e.spec.ts` e
# `apps/api/test/validacao.spec.ts`.
readonly ENDERECO_PADRAO_DA_ENTREGA_DA_NOTICIA="https://notificacao.sysloc.invalid/v1/notificacoes-bancarias"
# O contato operacional do cadastro da entrega — a outra metade do endereço acima,
# e declarado NECESSÁRIO pelo provedor. Substituto em domínio reservado pela RFC
# 2606, trocado pelo endereço real da operação quando o vhost for publicado.
readonly CONTATO_PADRAO_DA_ENTREGA_DA_NOTICIA="operacao@sysloc.invalid"

# Diretório onde os BYTES do boleto vivem — a oitava chave do arquivo de ambiente
# e o único diretório de dados de negócio que este script provisiona.
#
# CAUSA de existir: a T9 da fatia `emissao-e-conciliacao` publicou a guarda de
# boletos (`packages/cobranca-bancaria/src/guarda-de-boletos.ts`), que grava, lê
# e apaga sob um diretório-base recebido POR PARÂMETRO (ADR-0025 — o pacote não
# lê o ambiente). Quem lê `DIRETORIO_DOS_BOLETOS` é a composição raiz, e sem esta
# semeadura o arquivo de uma instalação anterior nunca ganharia a linha.
#
# POR QUE O BOLETO SE GUARDA, sendo a ADR-0030 o contrário disso: ele é FATO
# RECEBIDO DE TERCEIRO, e a cláusula de exclusão da própria ADR o nomeia por
# escrito. Ninguém o recompõe — quem o compõe é o banco —, de modo que perdê-lo
# custa uma re-obtenção junto ao provedor. O carnê, esse sim derivado, é composto
# sob demanda e não passa por aqui.
#
# OS BYTES NÃO SÃO CIFRADOS, e a decisão é declarada: o boleto é documento
# destinado a ser entregue ao locatário, e a linha digitável que ele carrega já é
# publicada pela API. Cifrá-lo protegeria contra um adversário que já tem leitura
# no filesystem deste host — que também teria a ${ARQ_AMBIENTE} 0600. O que
# protege o acervo é o modo do diretório, aplicado abaixo.
#
# O caminho fica em /var/lib porque é ESTADO da aplicação, e o nome segue o
# precedente do capturador de e-mail (`/var/lib/sysloc-mailpit`). Ele está fora
# da árvore versionada por construção, e não por regra de ignore — que é a
# condição de entrada da ADR-0005 e o que o verificador de infraestrutura confere.
readonly DIR_BOLETOS="/var/lib/sysloc-boletos"

# Dono e modo do diretório dos boletos.
#
# O dono é o usuário das unidades de serviço (`User=`/`Group=` de
# `deploy/systemd/sysloc-api.service` e `sysloc-worker.service`): é o processo da
# aplicação que grava e lê o arquivo, e nenhum outro. O modo 0750 é o mesmo do
# diretório de dados da fila — dono lê, escreve e percorre; grupo lê; os demais
# não enxergam sequer os nomes, que são códigos de cobrança de clientes reais.
readonly DONO_DIR_BOLETOS="sysloc"
readonly MODO_DIR_BOLETOS="0750"

readonly UNIDADE_BANCO="postgresql.service"

readonly DIR_CONFIG="/etc/sysloc"
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"
# Arquivo de ambiente do MIGRADOR, separado do da aplicação de propósito
# (§11.6 da tech spec da fatia `fundacao-multitenancy-identidade`): a credencial
# de migração NÃO entra em ${ARQ_AMBIENTE}, que é o `EnvironmentFile=` das
# unidades de serviço. Fossem o mesmo arquivo, o processo que atende requisição
# passaria a carregar no ambiente a credencial do papel DONO das tabelas — que é
# exatamente o poder que a separação de papéis existe para lhe negar.
readonly ARQ_AMBIENTE_MIGRACAO="/etc/sysloc/migracao.env"
# Dono do arquivo de ambiente. `root` é deliberado e é o mais restritivo
# possível: o `EnvironmentFile=` das unidades de serviço (T7) é lido pelo
# systemd, que roda como root, ANTES de descer para o usuário do serviço — o
# processo da aplicação nunca precisa de permissão de leitura sobre o arquivo.
readonly DONO_ARQ_AMBIENTE="root"

readonly ARQ_FONTE_PGDG="/etc/apt/sources.list.d/pgdg.sources"
readonly ARQ_CHAVE_PGDG="/usr/share/keyrings/postgresql-pgdg.gpg"
readonly URL_CHAVE_PGDG="https://www.postgresql.org/media/keys/ACCC4CF8.asc"
readonly URL_REPO_PGDG="https://apt.postgresql.org/pub/repos/apt"
# Impressão digital da chave de assinatura do PGDG. Conferida após o download:
# baixar uma chave por HTTPS e confiar nela sem conferir é aceitar o certificado
# como única prova de origem.
readonly IMPRESSAO_CHAVE_PGDG="B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8"

readonly DIR_PG_ETC="/etc/postgresql/18/main"
readonly ARQ_PG_CONF="/etc/postgresql/18/main/postgresql.conf"
readonly DIR_PG_CONFD="/etc/postgresql/18/main/conf.d"
readonly ARQ_PG_DROPIN="/etc/postgresql/18/main/conf.d/10-sysloc.conf"
readonly ARQ_PG_HBA="/etc/postgresql/18/main/pg_hba.conf"
readonly DIR_SOCKET_PG="/var/run/postgresql"
readonly MARCADOR_HBA_INICIO="# >>> sysloc-backend (gerido por provisionar-base.sh) >>>"
readonly MARCADOR_HBA_FIM="# <<< sysloc-backend <<<"

# Portas FIXAS que este script pretende abrir, com a unidade dona de cada uma.
# Serve ao guarda de colisão: se a porta já estiver ocupada e a unidade dona não
# for a nossa, o script aborta em vez de tomar a porta de alguém.
#
# A lista não é exaustiva: a porta do cluster do banco também é guardada, e não
# entra aqui porque não é fixa — ela é derivada da configuração do próprio
# cluster em `porta_declarada_do_cluster`, junto ao guarda.
declare -rA DONO_DA_PORTA=(
	[6380]="redis-server@sysloc.service"
	[1025]="sysloc-mailpit.service"
	[8025]="sysloc-mailpit.service"
)

# --------------------------------------------------------------------------- #
# Parâmetros de operação — ver o cabeçalho.
# --------------------------------------------------------------------------- #
DESTINO_DISCO="${SYSLOC_DESTINO_DISCO:-/}"
MINIMO_DISCO_MIB="${SYSLOC_MINIMO_DISCO_MIB:-1024}"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
disco_antes_mib=0
total_criado=0
total_ja_ok=0
# Comunica a P12 se a configuração da fila mudou em P11 — só nesse caso a
# instância é reiniciada.
CONFIGURACAO_FILA_MUDOU=0
# Credencial do banco. Variável de shell comum, NUNCA exportada: exportá-la a
# colocaria no ambiente de todo processo filho.
senha_db=""
# Credencial do papel de migração. Mesmo contrato da acima, pelo mesmo motivo.
senha_migracao=""
# Porta do cluster, descoberta em P06 a partir do estado real e consumida por P09.
porta_banco=""

# --------------------------------------------------------------------------- #
# Saída legível. Duas marcações estáveis, e só duas:
#
#   CRIADO  o passo alterou o estado do sistema;
#   JA-OK   o passo encontrou o estado já correto e não fez nada.
#
# Toda mensagem de falha diz O QUE falhou, POR QUÊ e O QUE FAZER — este script é
# executado por um humano que cola a saída de volta, não por um depurador.
# --------------------------------------------------------------------------- #
info() { printf '%s ..     %s\n' "${PREFIXO}" "$*"; }

criado() {
	total_criado=$((total_criado + 1))
	printf '%s CRIADO %s %s\n' "${PREFIXO}" "$1" "$2"
}

ja_ok() {
	total_ja_ok=$((total_ja_ok + 1))
	printf '%s JA-OK  %s %s\n' "${PREFIXO}" "$1" "$2"
}

erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer · $3 = código de saída (opc.)
abortar() {
	erro "$1"
	printf '%s O QUE FAZER: %s\n' "${PREFIXO}" "$2" >&2
	exit "${3:-1}"
}

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi
	# O arquivo de ambiente é migrado por intermediário no mesmo diretório, com a
	# credencial dentro. Se o procedimento morrer entre a escrita e a renomeação,
	# ele não pode ficar ao lado do arquivo real: quem o encontrasse depois não
	# teria como saber que é lixo de uma execução interrompida — e ele carrega
	# segredo.
	if [[ -f "${ARQ_AMBIENTE}.migrando" ]]; then
		rm -f "${ARQ_AMBIENTE}.migrando"
	fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal
# chama `exit` com o código convencional (128 + número do sinal), o que dispara
# o trap de EXIT uma única vez e faz a limpeza acontecer — inclusive a remoção
# do diretório temporário que hospeda o arquivo de senha do cliente do banco.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# Sem este gatilho, uma falha inesperada sob `set -e` sairia em silêncio e o
# operador não teria como saber em que ponto o provisionamento parou.
trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"; erro "O QUE FAZER: releia as últimas linhas acima, corrija a causa e execute o script de novo — ele é idempotente e retoma do ponto correto"' ERR

# --------------------------------------------------------------------------- #
# Utilitários.
# --------------------------------------------------------------------------- #

# Grava `destino` com o conteúdo lido da entrada padrão, mas SOMENTE se o
# conteúdo, o modo ou o dono divergirem do desejado. Devolve 0 quando escreveu
# (houve mudança) e 1 quando já estava correto — por isso é sempre chamado
# dentro de um `if`, nunca solto.
aplicar_arquivo() {
	local destino="$1" modo="$2" dono="$3" grupo="$4"
	local conteudo
	conteudo="$(cat)"

	if [[ -f "${destino}" ]] &&
		printf '%s\n' "${conteudo}" | cmp -s - "${destino}" &&
		[[ "$(stat -c '%a %U %G' "${destino}")" == "${modo#0} ${dono} ${grupo}" ]]; then
		return 1
	fi

	install -m "${modo}" -o "${dono}" -g "${grupo}" /dev/null "${destino}"
	printf '%s\n' "${conteudo}" >"${destino}"
	return 0
}

# Garante diretório com modo e dono. Devolve 0 se mudou, 1 se já estava correto.
aplicar_diretorio() {
	local destino="$1" modo="$2" dono="$3" grupo="$4"
	if [[ -d "${destino}" ]] &&
		[[ "$(stat -c '%a %U %G' "${destino}")" == "${modo#0} ${dono} ${grupo}" ]]; then
		return 1
	fi
	install -d -m "${modo}" -o "${dono}" -g "${grupo}" "${destino}"
	return 0
}

pacote_instalado() {
	[[ "$(dpkg-query -W -f='${db:Status-Status}' "$1" 2>/dev/null || true)" == "installed" ]]
}

unidade_habilitada() {
	[[ "$(systemctl is-enabled "$1" 2>/dev/null || true)" == "enabled" ]]
}

unidade_ativa() {
	[[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]
}

# Executa `psql` como o superusuário da instância, com o SQL vindo da ENTRADA
# PADRÃO — nunca por argumento. É o que mantém a credencial fora do `argv` dos
# processos filhos, visível a qualquer usuário da máquina em `ps`.
psql_admin() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -f - "$@"
}

# Consulta de leitura, com a consulta vindo por argumento (nenhuma consulta de
# leitura carrega segredo).
psql_consulta() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -c "$1"
}

# Gera um segredo alfanumérico de 32 caracteres. A restrição a [A-Za-z0-9] é
# deliberada: o valor entra numa URL de conexão, e caractere que exigisse
# codificação percentual viraria defeito silencioso no consumidor.
gerar_segredo() {
	head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-32
}

# Gera a chave de cifra do certificado: 32 bytes CRUS em base64 canônico.
#
# ⚠️ Ela NÃO pode ser produzida por `gerar_segredo`, e a diferença não é estética.
# O consumidor (`apps/api/src/configuracao/ambiente.ts`) DECODIFICA o valor e
# exige `bytes.length === 32` — é a chave do AES-256-GCM, e um texto de 32
# caracteres alfanuméricos decodifica para 24 bytes, que o esquema recusa na
# partida. Ele exige ainda que a codificação seja CANÔNICA
# (`bytes.toString('base64') === valor`), o que proíbe tanto o `tr -dc` (que
# comeria `+`, `/` e o `=` de preenchimento) quanto qualquer recorte por `cut`.
#
# Por isso a saída de `base64` vai inteira, e só se remove a quebra de linha que
# o próprio `base64` acrescenta — 32 bytes produzem exatamente 44 caracteres.
gerar_chave_de_cifra() {
	head -c 32 /dev/urandom | base64 | tr -d '\n'
}

# O invariante de formato da credencial, num lugar só — usado na GERAÇÃO, na
# LEITURA (P06) e imediatamente antes da única operação que reescreve a senha do
# banco (P09).
#
# CAUSA-RAIZ de tê-lo explícito: a versão anterior tentava validar o alfabeto
# DENTRO da expressão de extração (`\([A-Za-z0-9]*\)`). Uma classe quantificada
# com `*` numa substituição não falha — ela apenas casa um prefixo mais curto e
# substitui assim mesmo. O resultado era um valor TRUNCADO e não-vazio, que
# atravessava o guarda de "formato irreconhecível" (que só testava vazio) e
# chegava ao P09, onde o `ALTER ROLE` rebaixava a senha real do banco para esse
# prefixo — silenciosamente, reportando sucesso. Extração e validação são
# passos separados desde então.
#
# Por que o alfabeto é restrito, e não apenas uma preferência: a credencial
# viaja dentro de `DATABASE_URL`, e numa URL `:`, `@`, `?`, `&` e `/` são
# delimitadores. Sem codificação percentual — que teria de estar correta nas
# duas pontas e provada por asserção — o próprio formato do arquivo não carrega
# valor arbitrário sem ambiguidade. Restringir é a decisão; exigir é o guarda.
credencial_manuseavel() {
	[[ "$1" =~ ^[A-Za-z0-9]+$ ]]
}

# A cadeia de conexão do banco, num lugar só — usada na CRIAÇÃO do arquivo de
# ambiente (P06), na MIGRAÇÃO do arquivo já posicionado (P06) e na conferência de
# coordenadas. Função em vez de literal repetido porque é ela que a bateria de
# verificação carrega deste arquivo e submete ao cliente REAL da aplicação: com o
# formato espalhado por três `printf`, a asserção provaria a forma de um deles e
# os outros dois seguiriam livres.
#
# A forma é `postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO`, e ela é o
# assunto do bloco "Por que o banco escuta em TCP" no cabeçalho: é a ÚNICA que os
# consumidores desta cadeia — o cliente da aplicação, o cliente de linha de
# comando e o migrador da fatia seguinte — leem sem tradução. A forma de socket
# (`@/BANCO?host=DIRETORIO&port=PORTA`) não é URL válida e nenhum deles a alcança;
# reintroduzi-la volta a quebrar a partida do serviço de aplicação, e é o que a
# ponta (m) do CT-003 da bateria reprova.
#
# O segredo entra como parâmetro posicional de uma função do próprio shell — sem
# `exec`, sem linha de comando nova para `ps` mostrar e sem exportar nada.
#
# $1 = credencial · $2 = porta do cluster
#
# DECISÃO FECHADA — T7 / decidida com o usuário · 2026-08-01
# O QUÊ: `DATABASE_URL` é gravada como URL de endereço de rede
#        (`postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO`), e o cluster escuta em
#        TCP no endereço de retorno para atendê-la. A forma de socket de domínio Unix
#        não volta.
# POR QUÊ: a forma óbvia — socket, que dispensaria abrir porta — foi exercitada nas
#          três grafias possíveis contra o cliente REAL da aplicação (`postgres.js`
#          3.4.9, que monta as opções de conexão com `new URL()`), e NENHUMA conecta:
#          `@/BANCO?host=DIR&port=PORTA` é recusada com `Invalid URL`; a grafia com
#          codificação percentual do caminho passa em `URL.canParse` mas não é
#          decodificada e vai a DNS (`getaddrinfo ENOTFOUND %2Fvar%2Frun%2Fpostgresql`);
#          e `@localhost:PORTA/BANCO?host=DIR` passa em `URL.canParse` mas tem o
#          `?host=` IGNORADO. O cliente só alcança socket pelo OBJETO de opções
#          (`host: '/var/run/postgresql'`), nunca por URL — relaxar a validação de
#          partida da aplicação apenas adiaria a quebra para a primeira consulta. Foi
#          a recusa na partida do serviço de aplicação que revelou o vão.
# REVERTER EXIGE: demonstrar que o cliente de banco desta stack passou a alcançar
#                 socket de domínio Unix A PARTIR DE UMA URL — nomeando a versão de
#                 `postgres` em que isso mudou e reproduzindo a conexão — e que `psql`
#                 e o migrador leem a mesma cadeia sem tradução. Sem isso, voltar à
#                 forma de socket quebra a partida do serviço de aplicação, e é o que a
#                 ponta (m) do CT-003 de `verificar-provisionamento.sh` reprova.
montar_url_do_banco() {
	printf 'postgresql://%s:%s@%s:%s/%s' \
		"${PAPEL_DB}" "$1" "${HOSPEDEIRO_DB}" "$2" "${BANCO_DB}"
}

# O destino que a cadeia declara — tudo depois do último '@'. Não carrega
# credencial, e é por isso que as mensagens de divergência podem citá-lo.
destino_esperado_do_banco() {
	printf '%s:%s/%s' "${HOSPEDEIRO_DB}" "$1" "${BANCO_DB}"
}

# O destino que ESTE script gravava antes de o cluster passar a escutar em TCP.
# Existe para uma coisa só: reconhecer, por igualdade LITERAL, o arquivo de
# ambiente que a versão anterior deste procedimento deixou posicionado, para
# migrá-lo preservando a credencial. Qualquer outro destino divergente continua
# abortando o provisionamento — ver `passo_p06_arquivo_ambiente`.
destino_anterior_por_socket() {
	printf '/%s?host=%s&port=%s' "${BANCO_DB}" "${DIR_SOCKET_PG}" "$1"
}

# Resultados de `extrair_credencial_db`. Nenhum dos dois é exportado, e
# `CREDENCIAL_LIDA` nunca é impressa.
CREDENCIAL_LIDA=""
CHAVES_REPETIDAS=""

# O CAMINHO DE LEITURA do arquivo de ambiente, inteiro e sem efeito colateral —
# não escreve, não instala, não pede privilégio. Só lê e decide.
#
# Está extraído do P06 de propósito, e isso é o conserto de um defeito de teste,
# não estética: enquanto a leitura vivia dentro de `passo_p06_arquivo_ambiente`
# — que escreve em /etc, consulta o cluster e exige root — ela era intestável, e
# a bateria acabou testando uma REIMPLEMENTAÇÃO da leitura feita no verificador.
# O resultado é que um provisionador com a leitura truncante de volta passava na
# bateria inteira. Agora o verificador extrai ESTA função do arquivo real e a
# exercita diretamente; quem valida e quem executa são o mesmo código.
#
# Devolve, por código de saída:
#   0  credencial íntegra em ${CREDENCIAL_LIDA}
#   1  não consegui interpretar o arquivo (sem DATABASE_URL/REDIS_URL utilizável)
#   2  atribuição repetida — ${CHAVES_REPETIDAS} nomeia as chaves ambíguas
#   3  interpretei, mas o valor está fora de [A-Za-z0-9]
extrair_credencial_db() {
	local arquivo="$1"
	CREDENCIAL_LIDA=""
	CHAVES_REPETIDAS=""

	if [[ ! -f "${arquivo}" ]]; then
		return 1
	fi

	# Atribuição repetida é AMBIGUIDADE, e ambiguidade se recusa — não se resolve
	# escolhendo um lado. O `EnvironmentFile=` do systemd, que é como as unidades
	# de serviço leem este arquivo, resolve repetição pela ÚLTIMA ocorrência; um
	# leitor ingênuo pega a PRIMEIRA. Escolher qualquer uma das duas deixaria a
	# divergência silenciosa: o script trabalharia com uma credencial e os
	# serviços com outra, e o passo que ressincroniza a senha rebaixaria o banco
	# para o valor obsoleto reportando sucesso. A verificação é genérica porque a
	# causa é do formato, não da chave: vale para REDIS_URL e SMTP_URL igual.
	local repetidas
	# A âncora tolera INDENTAÇÃO porque o `EnvironmentFile=` do systemd a tolera:
	# `  REDIS_URL=outro` é atribuição válida para ele e era invisível para este
	# guarda. O efeito era o pior possível — a divergência que o guarda existe
	# para recusar ficava justamente no formato que ele não enxergava, e o script
	# seguia com um valor enquanto os serviços subiam com outro.
	#
	# Corrigir AQUI, e não nas dezesseis leituras do arquivo, é o que fecha a
	# classe: elas podem continuar ancoradas em `^CHAVE=`, porque nenhuma chega a
	# rodar sobre um arquivo ambíguo — este guarda aborta antes.
	repetidas="$(grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		tr -d ' \t' | sort | uniq -d | tr -d '=' | tr '\n' ' ' || true)"
	if [[ -n "${repetidas// /}" ]]; then
		CHAVES_REPETIDAS="${repetidas% }"
		return 2
	fi

	# Captura GULOSA até o ÚLTIMO '@' da linha. Não é detalhe: com uma classe
	# restrita (`[A-Za-z0-9]*`) ou com `[^@]*`, uma senha que contivesse símbolo
	# — ou o próprio '@' — seria cortada no primeiro deles e o pedaço passaria
	# adiante como se fosse a credencial. Assim ela vem INTEIRA, e a reprovação
	# acontece no guarda explícito abaixo, onde é visível. Não há `head -1`:
	# depois do guarda de repetição existe no máximo uma linha DATABASE_URL.
	local valor
	valor="$(sed -n 's|^DATABASE_URL=postgresql://[^:/]*:\(.*\)@.*$|\1|p' "${arquivo}")"
	if [[ -z "${valor}" ]]; then
		return 1
	fi

	if ! credencial_manuseavel "${valor}"; then
		return 3
	fi

	CREDENCIAL_LIDA="${valor}"
	return 0
}

# Resultados de `conferir_coordenadas_do_ambiente`.
COORDENADAS_DIVERGENTES=""
CHAVES_AUSENTES=""

# Confere que o arquivo de ambiente descreve o que ESTE script provisionou —
# não apenas que as chaves têm cara de URL.
#
# CAUSA-RAIZ de existir: o P06 era tudo-ou-nada. Ou o arquivo nascia, ou ele
# apenas validava a credencial. Nada comparava as COORDENADAS declaradas com as
# que o script de fato provisiona, e a validação de forma aceitava
# `REDIS_URL=redis://127.0.0.1:6379` sem ruído nenhum — a porta da instância do
# AMBIENTE LEGADO. A partir da fatia que enfileira trabalho de negócio, isso
# colocaria a fila do backend novo dentro do processo que atende a operação
# hoje: o guardrail mais caro desta fatia furado por um arquivo de configuração,
# não por um comando. As outras duas frestas eram `SMTP_URL` nunca exigida e o
# `port=` de `DATABASE_URL` congelado no instante da criação, enquanto o P09
# valida a credencial contra a porta VIVA do cluster — divergindo, o P09
# imprimiria sucesso e as unidades de serviço apontariam para uma porta de
# ${HOSPEDEIRO_DB} em que o cluster não escuta.
#
# Sem efeito colateral, e a porta do cluster entra por parâmetro em vez de ser
# descoberta aqui dentro: é o que a torna exercitável pela bateria sem banco e
# sem privilégio, do mesmo jeito que `extrair_credencial_db`.
#
# Nenhuma das comparações toca a credencial — de `DATABASE_URL` só se olha o
# papel e o trecho DEPOIS do último '@'. Por isso as mensagens de divergência
# podem citar os valores encontrados sem vazar segredo.
#
# Devolve:
#   0  todas as chaves presentes e coerentes
#   1  ao menos uma coordenada diverge — ${COORDENADAS_DIVERGENTES} descreve
#   2  ao menos uma chave declarada está ausente — ${CHAVES_AUSENTES} nomeia
conferir_coordenadas_do_ambiente() {
	local arquivo="$1" porta_pg="$2"
	COORDENADAS_DIVERGENTES=""
	CHAVES_AUSENTES=""

	local divergentes="" ausentes=""

	local papel destino destino_esperado
	papel="$(sed -n 's|^DATABASE_URL=postgresql://\([^:/]*\):.*|\1|p' "${arquivo}" 2>/dev/null)"
	destino="$(sed -n 's|^DATABASE_URL=postgresql://[^:/]*:.*@\(.*\)$|\1|p' "${arquivo}" 2>/dev/null)"
	destino_esperado="$(destino_esperado_do_banco "${porta_pg}")"

	if [[ -z "${papel}" ]]; then
		ausentes="${ausentes}DATABASE_URL "
	else
		if [[ "${papel}" != "${PAPEL_DB}" ]]; then
			divergentes="${divergentes}DATABASE_URL[papel esperado '${PAPEL_DB}', encontrado '${papel}'] "
		fi
		if [[ "${destino}" != "${destino_esperado}" ]]; then
			divergentes="${divergentes}DATABASE_URL[destino esperado '${destino_esperado}', encontrado '${destino}'] "
		fi
	fi

	# ⚠️ SÓ COORDENADA ENTRA AQUI, e a fronteira é o que impede esta lista de virar
	# o lugar errado para a pergunta certa. O que se cobra por IGUALDADE é o que
	# este script pôs em algum lugar: valor diferente do provisionado significa que
	# a aplicação falaria com outro processo, e a divergência aborta.
	#
	# As três variáveis que o `D39` mantinha em aberto — `BETTER_AUTH_SECRET`,
	# `CHAVE_DE_CIFRA_DO_CERTIFICADO` e `ENDERECO_DO_PROVEDOR_BANCARIO` — foram
	# fechadas na intervenção dirigida de 2026-08-16 e NÃO entram nesta conferência,
	# por naturezas diferentes e ambas legítimas: as duas primeiras são SEGREDOS
	# gerados nesta máquina (cobrá-las por igualdade exigiria que este script
	# conhecesse o valor, que é exatamente o que ele não deve fazer), e a terceira é
	# conteúdo que o operador troca ao sair do substituto para o provedor real.
	# Quem garante as três é a semeadura por EXISTÊNCIA DA LINHA —
	# `garantir_segredos_do_ambiente` e `garantir_chaves_de_conteudo` —, e quem
	# impede a lacuna de voltar é `EXIGIDAS_SEM_PROVISIONAMENTO`, em
	# `apps/api/test/ambiente.spec.ts`: ela é comparada por igualdade contra o
	# conjunto observado, hoje vazio, de modo que uma exigência NOVA sem caminho de
	# provisionamento reprova sozinha, sem depender de alguém se lembrar desta nota.
	local chave esperado encontrado
	for chave in REDIS_URL SMTP_URL; do
		case "${chave}" in
		REDIS_URL) esperado="redis://127.0.0.1:${PORTA_FILA}" ;;
		SMTP_URL) esperado="smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}" ;;
		esac
		# Ausência é decidida pela EXISTÊNCIA DA LINHA, nunca pelo valor — mesmo
		# critério que `garantir_chaves_de_conteudo` já adota logo abaixo
		# (`grep -q '^EMAIL_REMETENTE='`). Decidir pelo valor fazia um
		# `REDIS_URL=` esvaziado pelo operador entrar em `CHAVES_AUSENTES`; o P06
		# acrescentava uma SEGUNDA atribuição da mesma chave, e a execução
		# seguinte abortava por ambiguidade em `extrair_credencial_db` — o
		# provisionador criando, sozinho, a condição que ele existe para recusar.
		#
		# Com o critério certo, chave presente e vazia é DIVERGENTE (valor
		# esperado contra valor vazio), aborta com diagnóstico legível, e nada é
		# duplicado.
		if ! grep -qE "^[[:space:]]*${chave}=" "${arquivo}" 2>/dev/null; then
			ausentes="${ausentes}${chave} "
			continue
		fi
		encontrado="$(sed -n "s|^[[:space:]]*${chave}=||p" "${arquivo}" 2>/dev/null)"
		if [[ "${encontrado}" != "${esperado}" ]]; then
			divergentes="${divergentes}${chave}[esperado '${esperado}', encontrado '${encontrado}'] "
		fi
	done

	# Divergência tem precedência sobre ausência: acrescentar uma chave a um
	# arquivo que já aponta para o lugar errado seria consertar o detalhe e
	# manter o dano.
	if [[ -n "${divergentes}" ]]; then
		COORDENADAS_DIVERGENTES="${divergentes% }"
		return 1
	fi
	if [[ -n "${ausentes}" ]]; then
		CHAVES_AUSENTES="${ausentes% }"
		return 2
	fi
	return 0
}

# Resultado de `garantir_chaves_de_conteudo`.
CHAVES_SEMEADAS=""

# Garante que o arquivo de ambiente DECLARE as chaves de CONTEÚDO, semeando cada
# uma com o valor padrão quando a linha não existir.
#
# POR QUE ELAS NÃO ENTRAM NA CONFERÊNCIA DE COORDENADAS ACIMA. As chaves de lá
# descrevem ONDE este script pôs cada serviço, e por isso são cobradas por
# igualdade: valor diferente do provisionado significa que a aplicação falaria
# com outro processo, e a divergência aborta. `EMAIL_REMETENTE` não descreve
# coordenada nenhuma — é o endereço que assina o aviso de cobrança, conteúdo de
# negócio que o operador troca legitimamente ao apontar a instalação para um
# servidor de e-mail de verdade. Cobrá-la por igualdade faria o provisionamento
# ABORTAR na edição mais legítima que existe neste arquivo, mandando restaurar um
# substituto: conserto pior que o defeito.
#
# CAUSA de existir: a variável passou a ser EXIGIDA na partida do processador de
# trabalho (`apps/worker/src/main.ts`, `lerAmbiente`), e ausência ali recusa a
# subida. Sem esta semeadura, o arquivo de uma instalação anterior à exigência
# nunca ganharia a linha, a unidade recusaria a partida nomeando a variável, o
# supervisor tentaria 5 vezes e desistiria — sem que ninguém fosse avisado.
#
# ⚠️ O critério é a EXISTÊNCIA DA LINHA, e não o valor dela. A diferença é o que
# separa semear de estragar: com o critério do valor, um `EMAIL_REMETENTE=` que o
# operador tenha esvaziado de propósito ganharia uma SEGUNDA atribuição da mesma
# chave, e a execução seguinte abortaria em `extrair_credencial_db` — que recusa
# o arquivo ambíguo. Linha existente e vazia é deixada como está: a recusa de
# partida a nomeia, que é o diagnóstico correto e é ruidoso.
#
# Sem efeito colateral além do acréscimo, e só é chamada DEPOIS da conferência de
# coordenadas — um arquivo que aborta por divergência não pode ter sido tocado.
garantir_chaves_de_conteudo() {
	local arquivo="$1"
	CHAVES_SEMEADAS=""

	if ! grep -q '^EMAIL_REMETENTE=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"EMAIL_REMETENTE=${REMETENTE_PADRAO_DO_AVISO}"
		CHAVES_SEMEADAS="EMAIL_REMETENTE"
	fi

	# A segunda chave de conteúdo, pela MESMA razão e com o MESMO critério: ela
	# passou a ser exigida na partida (a `api` na T9, o processador de trabalho na
	# T10), e sem esta semeadura o arquivo de uma instalação anterior à exigência
	# nunca ganharia a linha. O acúmulo em ${CHAVES_SEMEADAS} é o que faz o
	# relatório do passo P06 nomear as duas quando as duas faltarem — a atribuição
	# direta as esconderia uma atrás da outra.
	if ! grep -q '^URL_BASE_DA_CONFIRMACAO=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"URL_BASE_DA_CONFIRMACAO=${URL_BASE_PADRAO_DA_CONFIRMACAO}"
		CHAVES_SEMEADAS="${CHAVES_SEMEADAS:+${CHAVES_SEMEADAS}, }URL_BASE_DA_CONFIRMACAO"
	fi

	# A terceira chave de conteúdo (F4/T11), pelo MESMO critério das duas acima: o
	# endereço do provedor bancário passou a ser exigido na partida da `api`, não é
	# segredo, e um arquivo de instalação anterior à exigência nunca ganharia a
	# linha. Ele NÃO entra na conferência de coordenadas: aquela cobra por
	# igualdade o que este script provisionou, e o endereço do provedor é
	# justamente o que o operador troca ao sair do substituto para o banco real.
	if ! grep -q '^ENDERECO_DO_PROVEDOR_BANCARIO=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"ENDERECO_DO_PROVEDOR_BANCARIO=${ENDERECO_PADRAO_DO_PROVEDOR_BANCARIO}"
		CHAVES_SEMEADAS="${CHAVES_SEMEADAS:+${CHAVES_SEMEADAS}, }ENDERECO_DO_PROVEDOR_BANCARIO"
	fi

	# O endereço de AUTORIZAÇÃO, pelo MESMO critério da linha acima e com o mesmo
	# tratamento: exigido na partida desde o fechamento do `D36 · F4/T10`
	# (2026-08-20), não é segredo, e um arquivo anterior à exigência nunca ganharia
	# a linha. No provedor real ele é máquina distinta da API — medido na
	# configuração do sistema antigo. Também NÃO entra na conferência de
	# coordenadas, pela razão da irmã: é justamente o que o operador troca ao sair
	# do substituto para o banco real.
	if ! grep -q '^ENDERECO_DE_AUTORIZACAO_BANCARIA=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"ENDERECO_DE_AUTORIZACAO_BANCARIA=${ENDERECO_PADRAO_DE_AUTORIZACAO_BANCARIA}"
		CHAVES_SEMEADAS="${CHAVES_SEMEADAS:+${CHAVES_SEMEADAS}, }ENDERECO_DE_AUTORIZACAO_BANCARIA"
	fi

	# O endereço da ENTREGA DA NOTÍCIA, pelo MESMO critério das duas linhas acima:
	# exigido na partida da `api` desde a T7 da fatia
	# `integracao-bancaria-autonoma`, não é segredo, e um arquivo de instalação
	# anterior à exigência nunca ganharia a linha. Também NÃO entra na conferência
	# de coordenadas, pela razão das irmãs: é justamente o que o operador troca ao
	# publicar o vhost real da notificação.
	if ! grep -q '^ENDERECO_DA_ENTREGA_DA_NOTICIA=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"ENDERECO_DA_ENTREGA_DA_NOTICIA=${ENDERECO_PADRAO_DA_ENTREGA_DA_NOTICIA}"
		CHAVES_SEMEADAS="${CHAVES_SEMEADAS:+${CHAVES_SEMEADAS}, }ENDERECO_DA_ENTREGA_DA_NOTICIA"
	fi

	# A outra metade da capacidade acima, e pelo MESMO critério: o provedor declara o
	# contato necessário no cadastro do webhook, e um arquivo de instalação anterior à
	# exigência nunca ganharia a linha. Acrescentada na intervenção dirigida de
	# 2026-08-22 (W2 da conformidade com a documentação do provedor).
	if ! grep -q '^CONTATO_DA_ENTREGA_DA_NOTICIA=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"CONTATO_DA_ENTREGA_DA_NOTICIA=${CONTATO_PADRAO_DA_ENTREGA_DA_NOTICIA}"
		CHAVES_SEMEADAS="${CHAVES_SEMEADAS:+${CHAVES_SEMEADAS}, }CONTATO_DA_ENTREGA_DA_NOTICIA"
	fi

	# A quarta chave de conteúdo (F4/T9), pelo MESMO critério das três acima. Ela
	# nomeia o diretório que o passo P17 provisiona, e por isso o valor padrão é a
	# constante ${DIR_BOLETOS} — e não um substituto em domínio reservado, como os
	# outros três: aqui o valor semeado é o que a instalação de fato usa.
	#
	# ⚠️ Ela NÃO entra na conferência de coordenadas, e a razão é a mesma das outras
	# três: aquela cobra por IGUALDADE o que este script pôs em algum lugar, e
	# abortaria na edição mais legítima que existe — o operador que move o acervo de
	# boletos para um volume próprio. Quem provisiona o diretório declarado aqui é o
	# P17, que lê a constante; um operador que mude a linha assume mover os bytes e
	# ajustar dono e modo, e o verificador
	# `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh` confere o
	# resultado.
	if ! grep -q '^DIRETORIO_DOS_BOLETOS=' "${arquivo}" 2>/dev/null; then
		acrescentar_linha_ao_ambiente "${arquivo}" \
			"DIRETORIO_DOS_BOLETOS=${DIR_BOLETOS}"
		CHAVES_SEMEADAS="${CHAVES_SEMEADAS:+${CHAVES_SEMEADAS}, }DIRETORIO_DOS_BOLETOS"
	fi
}

# Resultado de `garantir_segredos_do_ambiente`.
SEGREDOS_SEMEADOS=""

# Garante que o arquivo de ambiente declare os SEGREDOS que a partida exige,
# GERANDO cada um quando a linha não existir.
#
# POR QUE NÃO ENTRA EM `garantir_chaves_de_conteudo`. Aquela semeia valor PADRÃO
# declarado, e valor padrão de segredo é um defeito com outro nome: toda
# instalação nasceria com a mesma chave, e a primeira que vazasse abriria o
# acervo de todas. Aqui cada valor é gerado de `/dev/urandom` na máquina, e por
# isso a função é separada — o que se compartilha é o CRITÉRIO (a existência da
# linha), não a origem do valor.
#
# ⚠️ GERAR SE AUSENTE E NUNCA REGERAR, e as consequências de errar isto são
# assimétricas e graves:
#   - `BETTER_AUTH_SECRET` regerado INVALIDA toda sessão em curso — todo mundo
#     cai. É alavanca de emergência deliberada (o `.env.example` a documenta como
#     tal), nunca efeito colateral de rodar o provisionamento de novo.
#   - `CHAVE_DE_CIFRA_DO_CERTIFICADO` regerada torna ILEGÍVEL todo o material já
#     cifrado em `negocio.certificado_do_provedor` — e material vindo de terceiro
#     ninguém recompõe. Rotacioná-la obriga a recifrar o acervo de TODAS as
#     empresas, o que é operação com runbook, não passo de instalação.
# Por isso o critério é a EXISTÊNCIA DA LINHA e jamais o valor dela: linha
# existente e vazia é deixada como está, e a recusa de partida a nomeia — que é o
# diagnóstico correto e é ruidoso. Trocar isto por um teste de valor faria o
# provisionamento destruir o acervo de quem esvaziou a linha por engano.
#
# Sem efeito colateral além do acréscimo, e chamada só DEPOIS da conferência de
# coordenadas, como a irmã acima.
garantir_segredos_do_ambiente() {
	local arquivo="$1"
	SEGREDOS_SEMEADOS=""

	local chave valor
	for chave in BETTER_AUTH_SECRET CHAVE_DE_CIFRA_DO_CERTIFICADO; do
		if grep -q "^${chave}=" "${arquivo}" 2>/dev/null; then
			continue
		fi
		case "${chave}" in
		BETTER_AUTH_SECRET) valor="$(gerar_segredo)" ;;
		CHAVE_DE_CIFRA_DO_CERTIFICADO) valor="$(gerar_chave_de_cifra)" ;;
		esac
		acrescentar_linha_ao_ambiente "${arquivo}" "${chave}=${valor}"
		SEGREDOS_SEMEADOS="${SEGREDOS_SEMEADOS:+${SEGREDOS_SEMEADOS}, }${chave}"
	done
}

# Acrescenta UMA linha ao arquivo de ambiente, garantindo que ela nasça em linha
# própria. É a ENTRADA ÚNICA de acréscimo — D40 (F3/T8) fechado por classe, e não
# por ocorrência: os três pontos que acrescentam chave (a semeadura do remetente
# acima e as duas do passo P06) passam por aqui.
#
# ⚠️ O QUE ELA IMPEDE: `printf '%s\n' … >>arquivo` cola o acréscimo na última linha
# quando o arquivo preexistente NÃO termina em `\n` — o que acontece com arquivo
# editado à mão por editor que não a acrescenta. O resultado é duplamente ruim:
#
#     SMTP_URL=smtp://127.0.0.1:1025EMAIL_REMETENTE=avisos@sysloc.invalid
#
# a chave semeada continua ausente (a partida segue recusada, que é o defeito que
# a semeadura existia para fechar) E a `SMTP_URL` fica corrompida — de modo que a
# execução seguinte aborta acusando divergência de `SMTP_URL` e manda o operador
# corrigir uma linha cuja causa foi a execução anterior.
#
# A substituição de comando descarta as quebras finais, então `$(tail -c1)` devolve
# vazio exatamente quando o último byte JÁ é `\n` — que é o caso em que nada se
# acrescenta. Arquivo inexistente ou vazio também não recebe quebra de cortesia.
acrescentar_linha_ao_ambiente() { # acrescentar_linha_ao_ambiente <arquivo> <linha>
	local arquivo="$1" linha="$2"

	if [[ -s "${arquivo}" && -n "$(tail -c1 "${arquivo}")" ]]; then
		printf '\n' >>"${arquivo}"
	fi

	printf '%s\n' "${linha}" >>"${arquivo}"
}

# --------------------------------------------------------------------------- #
# MIGRAÇÃO do arquivo de ambiente posicionado pela versão anterior deste
# procedimento, quando o cluster ainda não escutava em TCP.
#
# Reconhece o arquivo a migrar por igualdade LITERAL do destino com o que ESTE
# script gravava — `/BANCO?host=DIRETORIO_DO_SOCKET&port=PORTA_VIVA` — e por nada
# mais. Não é uma licença geral para reescrever `DATABASE_URL`: qualquer outro
# destino divergente continua abortando o provisionamento em
# `conferir_coordenadas_do_ambiente`, com a mensagem que manda o operador decidir.
# Um destino de socket com OUTRA porta também diverge, e também aborta: porta
# diferente da porta viva do cluster é o defeito que aquela conferência nasceu
# para pegar, não um caso a migrar.
#
# A credencial NÃO é regerada. A que está no arquivo é a que o banco conhece —
# gerá-la de novo aqui quebraria o acesso de tudo que já a consome, que é
# exatamente o modo de falha que o reaproveitamento do arquivo existe para
# impedir. Ela chega aqui já lida e validada por `extrair_credencial_db`, e o
# guarda de formato é reafirmado no ponto da reescrita.
#
# A gravação é por arquivo intermediário no MESMO diretório do destino, seguida
# de renomeação: a troca é atômica e o arquivo real nunca existe pela metade. O
# intermediário nasce 0600 antes de qualquer byte de segredo, e o trap o remove
# se o procedimento morrer no meio.
#
# Devolve 0 quando migrou (houve mudança) e 1 quando não havia o que migrar — por
# isso é sempre chamada dentro de um `if`, nunca solta.
#
# $1 = arquivo de ambiente · $2 = porta viva do cluster
migrar_database_url_de_socket() {
	local arquivo="$1" porta_pg="$2"

	local destino
	destino="$(sed -n 's|^DATABASE_URL=postgresql://[^:/]*:.*@\(.*\)$|\1|p' "${arquivo}" 2>/dev/null)"
	[[ "${destino}" == "$(destino_anterior_por_socket "${porta_pg}")" ]] || return 1

	# Invariante afirmado NO PONTO da escrita, e não só na leitura lá atrás: esta
	# é a única linha do script que reescreve a cadeia de conexão de um arquivo
	# que já existe, e escrevê-la a partir de um valor lido pela metade gravaria
	# uma credencial truncada sobre a boa — sem que nada reclamasse, porque o
	# banco continuaria com a senha antiga e a falha só apareceria na partida do
	# serviço.
	if ! credencial_manuseavel "${senha_db}"; then
		abortar "recusa de reescrever a DATABASE_URL de ${arquivo}: a credencial em mãos não passa na verificação de formato, e gravá-la assim deixaria o arquivo apontando para uma senha que o banco não conhece" \
			"NADA foi alterado. Confira ${arquivo} — a credencial precisa conter apenas letras e números"
	fi

	local intermediario="${arquivo}.migrando"
	install -m 0600 -o "${DONO_ARQ_AMBIENTE}" -g "${DONO_ARQ_AMBIENTE}" /dev/null "${intermediario}"

	local linha
	while IFS= read -r linha || [[ -n "${linha}" ]]; do
		if [[ "${linha}" == DATABASE_URL=* ]]; then
			printf 'DATABASE_URL=%s\n' "$(montar_url_do_banco "${senha_db}" "${porta_pg}")"
		else
			printf '%s\n' "${linha}"
		fi
	done <"${arquivo}" >"${intermediario}"

	mv "${intermediario}" "${arquivo}"
	return 0
}

# --------------------------------------------------------------------------- #
# Pré-condições. Nenhuma delas altera coisa alguma no sistema.
# --------------------------------------------------------------------------- #
verificar_precondicoes() {
	if [[ "${EUID}" -ne 0 ]]; then
		abortar "este script precisa de privilégio administrativo — ele instala pacotes, cria papel de banco e escreve em /etc" \
			"execute como 'sudo bash deploy/scripts/instalacao/provisionar-base.sh'"
	fi

	local faltando=() ferramenta
	for ferramenta in apt-get dpkg-query systemctl curl gpg install ss stat sha256sum tar runuser getent df; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "ferramenta obrigatória ausente do PATH: ${faltando[*]}" \
			"instale os pacotes correspondentes (apt, systemd, curl, gnupg, coreutils, iproute2, util-linux) e execute de novo"
	fi

	if [[ ! "${MINIMO_DISCO_MIB}" =~ ^[0-9]+$ ]]; then
		abortar "SYSLOC_MINIMO_DISCO_MIB precisa ser um inteiro em MiB, e veio como '${MINIMO_DISCO_MIB}'" \
			"exporte um número, por exemplo SYSLOC_MINIMO_DISCO_MIB=1024"
	fi

	if [[ ! -d "${DESTINO_DISCO}" ]]; then
		abortar "o destino de medição de disco '${DESTINO_DISCO}' não existe ou não é um diretório" \
			"aponte SYSLOC_DESTINO_DISCO para um diretório existente (padrão: /)"
	fi

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-provisionar-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"
}

# Conferida DEPOIS do guarda de disco, de propósito: sem espaço nada vai ser
# instalado de qualquer forma, e a mensagem que interessa ao operador é a do
# disco — não um erro de rede que ele iria investigar à toa.
verificar_rede() {
	local codinome
	codinome="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
	if ! curl -fsS --max-time 30 -o /dev/null "${URL_REPO_PGDG}/dists/${codinome}-pgdg/Release"; then
		abortar "o repositório oficial do PostgreSQL não está alcançável em ${URL_REPO_PGDG}" \
			"confirme a saída de rede e a resolução de nomes desta máquina; sem ele não há como instalar o banco na versão fixada"
	fi
}

# --------------------------------------------------------------------------- #
# Guarda de disco. Roda ANTES de qualquer alteração — é a diferença entre um
# guarda e uma mensagem de erro tardia.
# --------------------------------------------------------------------------- #
medir_disco_mib() {
	df -BM --output=avail "$1" | tail -n 1 | tr -dc '0-9'
}

verificar_disco() {
	disco_antes_mib="$(medir_disco_mib "${DESTINO_DISCO}" || true)"
	if [[ -z "${disco_antes_mib}" ]]; then
		abortar "não foi possível medir o espaço livre em '${DESTINO_DISCO}'" \
			"confira se o caminho está montado e acessível"
	fi

	if [[ "${disco_antes_mib}" -lt "${MINIMO_DISCO_MIB}" ]]; then
		local deficit=$((MINIMO_DISCO_MIB - disco_antes_mib))
		erro "espaço livre insuficiente em '${DESTINO_DISCO}' — nada foi instalado"
		printf '%s        requerido=%d MiB  disponivel=%d MiB  deficit=%d MiB\n' \
			"${PREFIXO}" "${MINIMO_DISCO_MIB}" "${disco_antes_mib}" "${deficit}" >&2
		abortar "o provisionamento foi interrompido antes de tocar no gestor de pacotes, de propósito: uma instalação que morre no meio deixa o dpkg inconsistente e degrada o ambiente legado" \
			"libere ao menos ${deficit} MiB em '${DESTINO_DISCO}' e execute de novo; se o mínimo estiver superdimensionado para este ambiente, ajuste SYSLOC_MINIMO_DISCO_MIB (ver o cabeçalho deste script para a origem do valor)"
	fi

	info "espaço livre em '${DESTINO_DISCO}': ${disco_antes_mib} MiB (mínimo exigido: ${MINIMO_DISCO_MIB} MiB)"
}

# --------------------------------------------------------------------------- #
# Guarda de colisão de porta. As portas ocupadas são derivadas do estado real da
# máquina, nunca de lista fixa — o ambiente legado muda sem avisar este script.
# --------------------------------------------------------------------------- #
# $1 porta · $2 unidade dona · $3 o que fazer · $4 prova extra de posse (opcional,
# nome de função que recebe a porta e devolve 0 quando a porta é MESMO nossa)
#
# CAUSA-RAIZ de a prova extra existir: `unidade_ativa` sozinha responde "a nossa
# unidade está de pé", e isso NÃO é o mesmo que "a porta é nossa". A equivalência
# vale para as três portas fixas — as unidades de ${DONO_DA_PORTA} vinculam a porta
# ao subir, então unidade ativa implica porta vinculada — e é FALSA para o cluster
# do banco, que fica `active` servindo apenas pelo socket de domínio Unix enquanto
# `listen_addresses` estiver vazio. Esse é precisamente o estado em que a execução
# de transição encontra a máquina: unidade ativa, porta TCP sem dono. Com um
# terceiro nessa porta, o guarda a anunciava como "nossa instância", o P03
# reescrevia o sobreposto e o `systemctl restart` falhava ao VINCULAR — trocando um
# aborto limpo de pré-condição, antes de qualquer escrita em /etc, por um aborto de
# meio de execução com o cluster desligado dentro da janela.
conferir_colisao_de_porta() {
	local porta="$1" unidade="$2" remedio="$3" prova="${4:-}" dono

	if ! ss -ltnH "sport = :${porta}" 2>/dev/null | grep -q .; then
		return 0
	fi

	if unidade_ativa "${unidade}" && { [[ -z "${prova}" ]] || "${prova}" "${porta}"; }; then
		info "porta ${porta} já em uso por ${unidade} (nossa instância)"
		return 0
	fi

	dono="$(ss -ltnpH "sport = :${porta}" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -1)"
	abortar "a porta ${porta}, destinada a ${unidade}, já está ocupada pelo processo '${dono:-desconhecido}' — este script não toma porta de ninguém" \
		"${remedio}"
}

# A prova de posse da porta do cluster, perguntada ao cluster EM EXECUÇÃO e não ao
# arquivo de configuração: é o estado real que decide quem é o dono, do mesmo jeito
# que a lista de portas ocupadas vem de `ss` e não de lista fixa.
#
# Duas condições, e as duas são necessárias:
#
#   * `listen_addresses` não vazio — se o cluster não escuta em TCP endereço
#     nenhum, ele não escuta em porta nenhuma, e NENHUM ouvinte de porta TCP pode
#     ser nosso. É a condição que a execução de transição falseia;
#   * a porta viva do cluster é a porta sob guarda — o `port` de ${ARQ_PG_CONF}
#     pode ter sido alterado sem reinício, e nesse caso a porta guardada não é a
#     que o cluster de fato abriu.
#
# Não se compara `listen_addresses` com ${HOSPEDEIRO_DB}: o cluster pode
# legitimamente escutar por `localhost`, `*` ou `0.0.0.0` antes de o P03 gravar o
# sobreposto, e recusar essas formas transformaria uma reexecução legítima em
# aborto. O que discrimina é escutar ou não escutar em TCP.
#
# Qualquer falha em consultar o cluster devolve "não é nossa" — a direção segura,
# porque leva ao aborto ANTES de qualquer escrita em /etc.
cluster_escuta_na_porta() {
	local porta="$1" escuta viva
	escuta="$(runuser -u postgres -- psql -X -q -A -t -c 'SHOW listen_addresses' 2>/dev/null)" || return 1
	[[ -n "${escuta}" ]] || return 1
	viva="$(runuser -u postgres -- psql -X -q -A -t -c 'SHOW port' 2>/dev/null)" || return 1
	[[ "${viva}" == "${porta}" ]]
}

# A porta que o cluster do banco vai abrir. DERIVADA da configuração do próprio
# cluster — o `pg_createcluster` escolhe a primeira livre a partir de 5432, e
# fixar 5432 aqui guardaria uma porta que talvez não seja a nossa. Vazio quando o
# banco ainda não foi instalado: não há porta a guardar, e o `pg_createcluster`
# da instalação escolherá uma livre.
porta_declarada_do_cluster() {
	[[ -f "${ARQ_PG_CONF}" ]] || return 0
	sed -n "s/^[[:space:]]*port[[:space:]]*=[[:space:]]*\([0-9]\{1,\}\).*/\1/p" "${ARQ_PG_CONF}" | head -1
}

verificar_portas() {
	local porta
	for porta in "${!DONO_DA_PORTA[@]}"; do
		conferir_colisao_de_porta "${porta}" "${DONO_DA_PORTA[${porta}]}" \
			"libere a porta ${porta}, ou altere a constante correspondente no topo deste script (e no verificador) para uma porta livre desta máquina"
	done

	# A porta do banco entra no guarda desde que o cluster passou a escutar em
	# ${HOSPEDEIRO_DB}. Sem isto, a colisão apareceria como um `systemctl restart`
	# que não volta no meio do P03 — com o cluster desligado e o ambiente legado no
	# mesmo servidor. E é por isso que aqui — e SÓ aqui — a posse exige a prova
	# extra: nesta porta, "a nossa unidade está ativa" não prova nada.
	local porta_pg
	porta_pg="$(porta_declarada_do_cluster)"
	if [[ -n "${porta_pg}" ]]; then
		conferir_colisao_de_porta "${porta_pg}" "postgresql@${VERSAO_POSTGRES}-main.service" \
			"libere a porta ${porta_pg}, ou mova o cluster para uma porta livre ('port' em ${ARQ_PG_CONF}) e execute de novo" \
			cluster_escuta_na_porta
	fi
}

# =========================================================================== #
# P01 — repositório oficial do PostgreSQL configurado.
# =========================================================================== #
passo_p01_repositorio() {
	local mudancas=0 codinome arquitetura impressao

	codinome="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
	arquitetura="$(dpkg --print-architecture)"

	if [[ ! -s "${ARQ_CHAVE_PGDG}" ]]; then
		curl -fsS --max-time 60 "${URL_CHAVE_PGDG}" \
			-o "${DIR_TEMPORARIO}/pgdg.asc" ||
			abortar "não foi possível baixar a chave de assinatura do PGDG de ${URL_CHAVE_PGDG}" \
				"confira a saída de rede e execute de novo"

		gpg --batch --yes --dearmor -o "${DIR_TEMPORARIO}/pgdg.gpg" "${DIR_TEMPORARIO}/pgdg.asc"

		impressao="$(gpg --batch --with-colons --show-keys "${DIR_TEMPORARIO}/pgdg.gpg" |
			awk -F: '$1 == "fpr" { print $10; exit }')"
		if [[ "${impressao}" != "${IMPRESSAO_CHAVE_PGDG}" ]]; then
			abortar "a chave baixada de ${URL_CHAVE_PGDG} tem impressão digital '${impressao}', e a esperada é '${IMPRESSAO_CHAVE_PGDG}'" \
				"NÃO prossiga: ou o artefato foi substituído, ou a conexão foi interceptada. Confira a chave junto ao fornecedor antes de qualquer outra coisa"
		fi

		install -m 0644 -o root -g root "${DIR_TEMPORARIO}/pgdg.gpg" "${ARQ_CHAVE_PGDG}"
		mudancas=$((mudancas + 1))
	fi

	if aplicar_arquivo "${ARQ_FONTE_PGDG}" 0644 root root <<-FONTE
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		# Repositório oficial do PostgreSQL — a versão fixada pela stack (${VERSAO_POSTGRES})
		# não existe no repositório da distribuição, que traz apenas a 16.
		Types: deb
		URIs: ${URL_REPO_PGDG}
		Suites: ${codinome}-pgdg
		Components: main
		Architectures: ${arquitetura}
		Signed-By: ${ARQ_CHAVE_PGDG}
	FONTE
	then
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		info "atualizando as listas do gestor de pacotes (somente metadados; nada é instalado ou removido aqui)"
		DEBIAN_FRONTEND=noninteractive apt-get update -qq
		criado "P01" "repositório oficial do PostgreSQL configurado (${codinome}-pgdg)"
	else
		ja_ok "P01" "repositório oficial do PostgreSQL já configurado (${codinome}-pgdg)"
	fi
}

# =========================================================================== #
# P02 — pacotes do PostgreSQL instalados.
# =========================================================================== #
passo_p02_pacotes_banco() {
	local pacotes=("postgresql-${VERSAO_POSTGRES}" "postgresql-client-${VERSAO_POSTGRES}")
	local pendentes=() pacote

	for pacote in "${pacotes[@]}"; do
		pacote_instalado "${pacote}" || pendentes+=("${pacote}")
	done

	if [[ "${#pendentes[@]}" -eq 0 ]]; then
		ja_ok "P02" "pacotes do PostgreSQL ${VERSAO_POSTGRES} já instalados (${pacotes[*]})"
		return
	fi

	# Simulação antes da execução: num servidor compartilhado com o ambiente que
	# atende a operação, uma instalação que REMOVE pacote é dano, não efeito
	# colateral. Melhor abortar e deixar a decisão com quem opera.
	local simulacao remocoes
	simulacao="$(DEBIAN_FRONTEND=noninteractive apt-get install -s -y --no-install-recommends "${pendentes[@]}" 2>&1)"
	remocoes="$(printf '%s\n' "${simulacao}" | sed -n 's/^Remv \([^ ]*\).*/\1/p' | tr '\n' ' ')"
	if [[ -n "${remocoes// /}" ]]; then
		abortar "a instalação de '${pendentes[*]}' pretende REMOVER pacotes já presentes nesta máquina: ${remocoes}" \
			"não prossiga sem avaliar o impacto sobre o ambiente legado; investigue o conflito com 'apt-get install -s ${pendentes[*]}'"
	fi

	info "instalando ${pendentes[*]}"
	DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends "${pendentes[@]}"
	criado "P02" "pacotes do PostgreSQL ${VERSAO_POSTGRES} instalados (${pendentes[*]})"
}

# --------------------------------------------------------------------------- #
# O bloco de regras de autenticação que este script mantém em ${ARQ_PG_HBA},
# delimitado pelos dois marcadores. As três funções abaixo não têm efeito
# colateral e recebem o arquivo por parâmetro — é o que permite exercitá-las na
# bateria sem privilégio e sem cluster.
#
# São DUAS regras, uma por via de conexão que o cluster oferece:
#
#   local   pelo socket de domínio Unix. É por onde o superusuário da instância e
#           o cliente de linha de comando conversam com o banco;
#   host    pelo endereço de retorno. É por onde a APLICAÇÃO conversa: a cadeia
#           de conexão precisa ser uma URL, e URL não alcança socket (ver o
#           cabeçalho). Sem esta regra, a partida do serviço de aplicação falha
#           na autenticação com o cluster de pé e a credencial correta.
#
# Nenhuma das duas alcança outro banco ou outro papel, e a rede da segunda é
# ${REDE_LOOPBACK_DB} — uma única máquina, esta.
# --------------------------------------------------------------------------- #
bloco_hba_desejado() {
	printf '%s\n' "${MARCADOR_HBA_INICIO}"
	printf '# Autenticação por senha do papel da aplicação, pelas duas vias que o\n'
	printf '# cluster oferece: o socket de domínio Unix e o endereço de retorno.\n'
	printf '# Restritas ao banco "%s": nenhum outro banco desta instância é\n' "${BANCO_DB}"
	printf '# alcançável por este papel, e nada aqui é alcançável de fora da máquina.\n'
	printf 'local   %s   %s   scram-sha-256\n' "${BANCO_DB}" "${PAPEL_DB}"
	printf 'host    %s   %s   %s   scram-sha-256\n' "${BANCO_DB}" "${PAPEL_DB}" "${REDE_LOOPBACK_DB}"
	printf '#\n'
	printf '# Autenticação por senha do papel de MIGRAÇÃO, pelo endereço de retorno — a\n'
	printf '# mesma via que a cadeia de conexão dele declara. Só o script de migração\n'
	printf '# (deploy/scripts/instalacao/migrar-banco.sh) conecta com este papel; nenhuma\n'
	printf '# unidade de serviço o usa.\n'
	printf '#\n'
	printf '# A regra é declarada AQUI, e não deixada por conta da regra genérica que o\n'
	printf '# empacotamento da distribuição instala: depender dela faria a autenticação do\n'
	printf '# migrador desaparecer junto com qualquer endurecimento futuro deste arquivo,\n'
	printf '# sem que este procedimento tivesse como acusar. Os bancos alcançáveis são\n'
	printf '# nomeados — o da operação e o DESCARTÁVEL que a bateria de verificação de\n'
	printf '# migração cria e remove —, nunca "all".\n'
	printf 'host    %s,%s   %s   %s   scram-sha-256\n' \
		"${BANCO_DB}" "${BANCO_VERIFICACAO}" "${PAPEL_MIGRACAO}" "${REDE_LOOPBACK_DB}"
	printf '%s\n' "${MARCADOR_HBA_FIM}"
}

# O bloco como está hoje no arquivo, ou vazio se ele ainda não existe. A
# comparação é por linha inteira e literal (`$0 == ini`), nunca por expressão
# regular: os marcadores contêm '>' e '(' e '.', que uma expressão trataria como
# metacaracteres.
bloco_hba_presente() {
	[[ -f "$1" ]] || return 0
	awk -v ini="${MARCADOR_HBA_INICIO}" -v fim="${MARCADOR_HBA_FIM}" '
		$0 == ini { dentro = 1 }
		dentro    { print }
		$0 == fim { dentro = 0 }
	' "$1"
}

# O arquivo sem o bloco gerido — o que precisa ser preservado ao reescrevê-lo.
hba_sem_bloco() {
	[[ -f "$1" ]] || return 0
	awk -v ini="${MARCADOR_HBA_INICIO}" -v fim="${MARCADOR_HBA_FIM}" '
		$0 == ini { dentro = 1; next }
		$0 == fim { dentro = 0; next }
		!dentro   { print }
	' "$1"
}

# A postura de exposição do cluster, dita em VOZ ALTA — é a linha de auditoria
# que o operador lê no terminal durante a janela, e o único lugar do fluxo
# privilegiado onde essa postura é afirmada. Derivada das constantes que a
# decidem, nunca escrita como literal.
#
# CAUSA-RAIZ de existir: as duas mensagens do P03 diziam "socket local, sem
# escuta de rede" quarenta e poucas linhas ABAIXO de o mesmo passo gravar
# `listen_addresses = '${HOSPEDEIRO_DB}'`. A frase nasceu verdadeira e não
# acompanhou a mudança porque não dependia de nada — repetia em texto o que a
# constante decide. Derivando, a próxima mudança de ${HOSPEDEIRO_DB} ou de
# ${DIR_SOCKET_PG} reescreve a linha sozinha, em vez de vencê-la em silêncio.
postura_de_escuta_do_cluster() {
	printf 'escuta em %s e no socket de domínio Unix em %s; nada dele é alcançável de fora desta máquina' \
		"${HOSPEDEIRO_DB}" "${DIR_SOCKET_PG}"
}

# =========================================================================== #
# P03 — cluster do PostgreSQL configurado.
#
# O sobreposto vive em conf.d/ e não em postgresql.conf: reescrever o arquivo
# principal do fornecedor perderia a diferença entre "o que o pacote entregou" e
# "o que nós decidimos", e faria toda atualização do pacote virar conflito.
# =========================================================================== #
passo_p03_configuracao_banco() {
	local mudancas=0

	if [[ ! -d "${DIR_PG_ETC}" ]]; then
		abortar "o cluster ${VERSAO_POSTGRES}/main não existe — ${DIR_PG_ETC} não foi criado pela instalação do pacote" \
			"confira a saída de 'pg_lsclusters' e recrie o cluster com 'pg_createcluster ${VERSAO_POSTGRES} main --start' antes de executar de novo"
	fi

	if aplicar_diretorio "${DIR_PG_CONFD}" 0755 postgres postgres; then
		mudancas=$((mudancas + 1))
	fi

	if aplicar_arquivo "${ARQ_PG_DROPIN}" 0644 postgres postgres <<-DROPIN
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		# Alteração manual aqui é sobrescrita na próxima execução do provisionamento.

		# Escuta no endereço de retorno, e SÓ nele: nada deste cluster é alcançável
		# de fora desta máquina. O socket de domínio Unix continua existindo — as
		# duas vias convivem, e o que muda é que a cadeia de conexão passa a poder
		# ser uma URL de verdade (ver "Por que o banco escuta em TCP" no cabeçalho).
		# Endereço literal, e não 'localhost': o nome resolveria também para ::1
		# conforme a ordem da resolução de nomes, e a regra de ${ARQ_PG_HBA} abaixo
		# é a de ${REDE_LOOPBACK_DB}.
		# A porta usada é a do cluster, declarada pelo empacotamento da distribuição
		# em ${ARQ_PG_CONF} — este arquivo não a redefine, e o guarda de colisão a
		# lê de lá antes de qualquer alteração.
		listen_addresses = '${HOSPEDEIRO_DB}'
		unix_socket_directories = '${DIR_SOCKET_PG}'

		# Verificador de senha moderno. Em 18 já é o padrão; declarado para que a
		# propriedade seja explícita no arquivo e não dependa do padrão da versão.
		password_encryption = 'scram-sha-256'
	DROPIN
	then
		mudancas=$((mudancas + 1))
	fi

	# O `pg_createcluster` do Debian normalmente já deixa o include ativo. A
	# conferência existe porque, se ele não estiver, o sobreposto acima seria
	# lido por ninguém e o cluster seguiria escutando em TCP — falha silenciosa,
	# que é a pior espécie.
	if ! grep -qE "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf\.d'" "${ARQ_PG_CONF}"; then
		printf '\n# Acrescentado por provisionar-base.sh (backend Sysloc): carrega %s\ninclude_dir = %s\n' \
			"${DIR_PG_CONFD}" "'conf.d'" >>"${ARQ_PG_CONF}"
		mudancas=$((mudancas + 1))
	fi

	# Regra de autenticação do papel da aplicação. Precede as regras `peer` do
	# Debian de propósito: `peer` casaria o papel com um usuário do sistema
	# homônimo, que não existe — a aplicação autentica por senha.
	#
	# A decisão de reescrever compara o CONTEÚDO do bloco, e não a presença do
	# marcador. CAUSA-RAIZ de ter mudado: com `grep -qF "${MARCADOR_HBA_INICIO}"`,
	# uma máquina já provisionada tem o marcador e NENHUMA alteração de conteúdo
	# do bloco chega até ela — o passo reportaria `JA-OK` sobre um arquivo
	# desatualizado. Foi exatamente o que aconteceria com a regra `host` desta
	# fatia, e aconteceria de novo com a próxima mudança do bloco.
	if [[ "$(bloco_hba_presente "${ARQ_PG_HBA}")" != "$(bloco_hba_desejado)" ]]; then
		{
			bloco_hba_desejado
			printf '\n'
			# Remove o bloco antigo (se houver) e as linhas em branco que sobrarem no
			# topo, para que reescritas sucessivas não empilhem separadores.
			hba_sem_bloco "${ARQ_PG_HBA}" | sed -e '/./,$!d'
		} >"${DIR_TEMPORARIO}/pg_hba.conf"
		install -m 0640 -o postgres -g postgres "${DIR_TEMPORARIO}/pg_hba.conf" "${ARQ_PG_HBA}"
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		info "reiniciando o cluster para carregar a configuração"
		systemctl restart "postgresql@${VERSAO_POSTGRES}-main.service"
		criado "P03" "cluster ${VERSAO_POSTGRES}/main configurado ($(postura_de_escuta_do_cluster))"
	else
		ja_ok "P03" "cluster ${VERSAO_POSTGRES}/main já configurado ($(postura_de_escuta_do_cluster))"
	fi
}

# =========================================================================== #
# P04 — serviço do banco habilitado no arranque e ativo.
# =========================================================================== #
passo_p04_servico_banco() {
	local mudancas=0
	local instancia="postgresql@${VERSAO_POSTGRES}-main.service"

	if ! unidade_habilitada "${UNIDADE_BANCO}"; then
		systemctl enable "${UNIDADE_BANCO}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_ativa "${instancia}"; then
		systemctl start "${instancia}"
		mudancas=$((mudancas + 1))
	fi

	esperar_banco_responder

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P04" "${UNIDADE_BANCO} habilitado no arranque e ${instancia} ativo"
	else
		ja_ok "P04" "${UNIDADE_BANCO} já habilitado no arranque e ${instancia} já ativo"
	fi
}

# Sondagem por estado observável, com limite — nunca espera fixa.
esperar_banco_responder() {
	local limite=60 decorrido=0
	while ! runuser -u postgres -- psql -X -q -A -t -c 'SELECT 1' >/dev/null 2>&1; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			abortar "o cluster ${VERSAO_POSTGRES}/main não aceitou conexão em ${limite}s" \
				"investigue com 'systemctl status postgresql@${VERSAO_POSTGRES}-main' e 'journalctl -u postgresql@${VERSAO_POSTGRES}-main -n 50'"
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
}

# =========================================================================== #
# P05 — diretório de configuração fora da árvore versionada.
# =========================================================================== #
passo_p05_diretorio_config() {
	if aplicar_diretorio "${DIR_CONFIG}" 0750 root root; then
		criado "P05" "diretório de configuração ${DIR_CONFIG} criado (0750 root:root)"
	else
		ja_ok "P05" "diretório de configuração ${DIR_CONFIG} já existe (0750 root:root)"
	fi
}

# =========================================================================== #
# P06 — arquivo de ambiente com a credencial.
#
# O ponto mais sensível do script. Se o arquivo já existe e está íntegro, ele é
# REAPROVEITADO: regerar a credencial a cada execução passaria nos dois códigos
# de saída 0 e quebraria, na reinstalação seguinte, as unidades de serviço que a
# consomem. É o modo de falha que a bateria de verificação caça explicitamente.
# =========================================================================== #
passo_p06_arquivo_ambiente() {
	# Descoberta uma vez e reaproveitada por P09: a porta entra na `DATABASE_URL`
	# gravada logo abaixo e é por ela — em ${HOSPEDEIRO_DB}, o mesmo caminho que
	# as unidades de serviço percorrem — que o P09 valida a credencial.
	porta_banco="$(porta_do_cluster)"

	if [[ -f "${ARQ_AMBIENTE}" ]]; then
		# Toda a leitura acontece em `extrair_credencial_db`, que não tem efeito
		# colateral e é exercitada diretamente pela bateria. Aqui só se traduz o
		# desfecho em diagnóstico — cada um com uma causa e uma saída diferentes,
		# porque "não entendi o arquivo", "o arquivo é ambíguo" e "entendi e não
		# sei manusear o valor" pedem ações distintas do operador.
		local codigo_leitura=0
		extrair_credencial_db "${ARQ_AMBIENTE}" || codigo_leitura=$?
		senha_db="${CREDENCIAL_LIDA}"

		case "${codigo_leitura}" in
		0) : ;;
		1)
			abortar "não consegui interpretar ${ARQ_AMBIENTE}: falta uma linha 'DATABASE_URL=postgresql://USUARIO:SEGREDO@...' de onde ler a credencial" \
				"salve uma cópia do arquivo em local seguro, remova o original e execute de novo — o script gerará uma credencial nova e você precisará aplicá-la a quem já a consumia"
			;;
		2)
			abortar "${ARQ_AMBIENTE} atribui mais de uma vez a(s) chave(s): ${CHAVES_REPETIDAS} — o arquivo é ambíguo e este procedimento se recusa a escolher por você. O systemd (EnvironmentFile=) usa a ÚLTIMA atribuição e um leitor ingênuo usaria a PRIMEIRA; seguir adiante faria o script trabalhar com um valor e os serviços com outro" \
				"NADA foi alterado. Deixe exatamente UMA atribuição de cada chave em ${ARQ_AMBIENTE} (apague as linhas antigas em vez de acrescentar novas) e execute este script de novo"
			;;
		3)
			senha_db=""
			abortar "interpretei ${ARQ_AMBIENTE}, mas a credencial contém caractere fora de [A-Za-z0-9] — este procedimento não a manuseia, porque ela viaja dentro de uma URL de conexão, onde ':', '@', '?', '&' e '/' são delimitadores e exigiriam codificação percentual em ambas as pontas" \
				"NADA foi alterado. Escolha uma credencial só com letras e números, grave-a em ${ARQ_AMBIENTE} E aplique-a no banco com ALTER ROLE \"${PAPEL_DB}\" na MESMA janela; depois execute este script de novo"
			;;
		*)
			abortar "a leitura de ${ARQ_AMBIENTE} devolveu o desfecho inesperado ${codigo_leitura}" \
				"NADA foi alterado. Isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
			;;
		esac

		local mudancas=0 detalhes=""

		# MIGRAÇÃO da forma anterior, antes da conferência de coordenadas — porque é
		# ela que decide se o arquivo está coerente, e um arquivo por migrar seria
		# reprovado como divergente.
		#
		# O arquivo posicionado pela versão anterior deste procedimento declara o
		# destino por socket, que nenhum consumidor da cadeia interpreta. A
		# credencial que ele carrega é a que o BANCO conhece: regerá-la aqui
		# quebraria o acesso. A reescrita troca só a linha da cadeia, preservando o
		# segredo lido acima.
		if migrar_database_url_de_socket "${ARQ_AMBIENTE}" "${porta_banco}"; then
			detalhes="${detalhes}DATABASE_URL migrada da forma de socket para ${HOSPEDEIRO_DB}:${porta_banco} (credencial preservada); "
			mudancas=$((mudancas + 1))
		fi

		# As COORDENADAS que o arquivo declara precisam ser as que este script
		# provisiona. Divergência aborta; chave declarada e ausente é acrescentada,
		# o que é aditivo — não reescreve a credencial e some na execução seguinte.
		local codigo_coordenadas=0
		conferir_coordenadas_do_ambiente "${ARQ_AMBIENTE}" "${porta_banco}" || codigo_coordenadas=$?
		case "${codigo_coordenadas}" in
		0) : ;;
		1)
			abortar "${ARQ_AMBIENTE} aponta para coordenadas diferentes das que este script provisiona: ${COORDENADAS_DIVERGENTES}. Seguir adiante faria a aplicação falar com outro serviço — no caso da fila, com a instância do ambiente legado, que é justamente o que esta fatia não pode tocar" \
				"NADA foi alterado. Corrija as linhas divergentes em ${ARQ_AMBIENTE} para os valores esperados acima (edite a linha existente, não acrescente outra), ou ajuste as constantes no topo deste script se a mudança for deliberada; depois execute de novo"
			;;
		2)
			local chave
			for chave in ${CHAVES_AUSENTES}; do
				case "${chave}" in
				REDIS_URL)
					acrescentar_linha_ao_ambiente "${ARQ_AMBIENTE}" \
						"REDIS_URL=redis://127.0.0.1:${PORTA_FILA}"
					;;
				SMTP_URL)
					acrescentar_linha_ao_ambiente "${ARQ_AMBIENTE}" \
						"SMTP_URL=smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
					;;
				*)
					abortar "${ARQ_AMBIENTE} não declara '${chave}', e este script não sabe reconstruí-la sem a credencial" \
						"salve uma cópia do arquivo em local seguro, remova o original e execute de novo — o script gerará o arquivo inteiro, e você precisará aplicar a credencial nova a quem já a consumia"
					;;
				esac
			done
			detalhes="${detalhes}chave(s) acrescentada(s): ${CHAVES_AUSENTES}; "
			mudancas=$((mudancas + 1))
			;;
		*)
			abortar "a conferência de coordenadas de ${ARQ_AMBIENTE} devolveu o desfecho inesperado ${codigo_coordenadas}" \
				"NADA foi alterado. Isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
			;;
		esac

		# DEPOIS da conferência, e nunca antes: um arquivo que aborta por
		# divergência precisa sair desta função sem ter sido tocado.
		garantir_chaves_de_conteudo "${ARQ_AMBIENTE}"
		if [[ -n "${CHAVES_SEMEADAS}" ]]; then
			detalhes="${detalhes}chave(s) de conteúdo semeada(s) com o valor padrão: ${CHAVES_SEMEADAS}; "
			mudancas=$((mudancas + 1))
		fi

		# Os segredos, pelo mesmo critério de existência da linha — mas GERADOS, e
		# nunca com valor padrão. O relatório nomeia a chave e JAMAIS o valor: esta
		# linha vai para a saída do provisionamento, que o operador cola em registro
		# de instalação.
		garantir_segredos_do_ambiente "${ARQ_AMBIENTE}"
		if [[ -n "${SEGREDOS_SEMEADOS}" ]]; then
			detalhes="${detalhes}segredo(s) gerado(s) em tempo de execução: ${SEGREDOS_SEMEADOS}; "
			mudancas=$((mudancas + 1))
		fi

		if [[ "$(stat -c '%a %U' "${ARQ_AMBIENTE}")" != "600 ${DONO_ARQ_AMBIENTE}" ]]; then
			chmod 0600 "${ARQ_AMBIENTE}"
			chown "${DONO_ARQ_AMBIENTE}:${DONO_ARQ_AMBIENTE}" "${ARQ_AMBIENTE}"
			detalhes="${detalhes}permissão corrigida para 0600 ${DONO_ARQ_AMBIENTE}; "
			mudancas=$((mudancas + 1))
		fi

		if [[ "${mudancas}" -gt 0 ]]; then
			criado "P06" "arquivo de ambiente ${ARQ_AMBIENTE} ajustado (${detalhes%; })"
		else
			ja_ok "P06" "arquivo de ambiente ${ARQ_AMBIENTE} já presente, íntegro e coerente com as coordenadas provisionadas (credencial preservada)"
		fi
		return
	fi

	senha_db="$(gerar_segredo)"
	if [[ "${#senha_db}" -ne 32 ]] || ! credencial_manuseavel "${senha_db}"; then
		abortar "a geração da credencial não produziu 32 caracteres alfanuméricos" \
			"confira se /dev/urandom está acessível nesta máquina e execute de novo"
	fi

	# O segredo de assinatura de sessão. O piso que o consumidor exige são 32
	# caracteres, e `gerar_segredo` entrega exatamente 32 — a conferência existe
	# porque uma geração truncada (urandom curto, `base64` ausente) produziria um
	# valor NÃO-VAZIO e curto, que atravessaria um guarda de presença e só seria
	# recusado na partida do serviço, longe daqui.
	local segredo_sessao chave_de_cifra
	segredo_sessao="$(gerar_segredo)"
	if [[ "${#segredo_sessao}" -ne 32 ]] || ! credencial_manuseavel "${segredo_sessao}"; then
		abortar "a geração do segredo de sessão não produziu 32 caracteres alfanuméricos" \
			"confira se /dev/urandom está acessível nesta máquina e execute de novo"
	fi

	# A chave de cifra do certificado: 32 bytes crus, que em base64 canônico são
	# exatamente 44 caracteres. A conferência é do COMPRIMENTO CODIFICADO porque é
	# o que este script consegue observar sem decodificar — e ela discrimina o modo
	# de falha real: chave curta passa por qualquer teste de presença e só reprova
	# quando a primeira empresa tentar cobrar, que é o pior momento possível.
	chave_de_cifra="$(gerar_chave_de_cifra)"
	if [[ "${#chave_de_cifra}" -ne 44 ]]; then
		abortar "a geração da chave de cifra não produziu 32 bytes em base64 (44 caracteres)" \
			"confira se /dev/urandom e base64 estão acessíveis nesta máquina e execute de novo"
	fi

	# `install` cria o arquivo já com 0600 ANTES de qualquer byte de segredo
	# entrar nele — não há janela em que o conteúdo exista com permissão frouxa.
	install -m 0600 -o "${DONO_ARQ_AMBIENTE}" -g "${DONO_ARQ_AMBIENTE}" /dev/null "${ARQ_AMBIENTE}"
	{
		printf '# Arquivo de ambiente do backend Sysloc.\n'
		printf '#\n'
		printf '# GERADO por deploy/scripts/instalacao/provisionar-base.sh. Vive fora da\n'
		printf '# árvore versionada por construção (ADR-0005, condição de entrada) e é\n'
		printf '# consumido pelas unidades de serviço via EnvironmentFile=.\n'
		printf '#\n'
		printf '# A credencial abaixo NÃO é regerada em execuções seguintes do\n'
		printf '# provisionamento. Se você precisar trocá-la, altere aqui E no banco\n'
		printf '# (ALTER ROLE) na mesma janela, respeitando estas duas regras:\n'
		printf '#\n'
		printf '#   1. A credencial precisa conter apenas letras e números\n'
		printf '#      ([A-Za-z0-9]). Ela viaja dentro da URL de conexão, onde :, @,\n'
		printf '#      ?, & e / são delimitadores; qualquer outro caractere faz o\n'
		printf '#      provisionamento abortar.\n'
		printf '#   2. EDITE a linha existente — não acrescente uma segunda. Cada\n'
		printf '#      chave pode ser atribuída UMA única vez neste arquivo. O systemd\n'
		printf '#      usaria a última atribuição e o provisionamento se recusa a\n'
		printf '#      adivinhar qual vale, então ele também aborta.\n'
		printf '#\n'
		printf '# EMAIL_REMETENTE NÃO é segredo: é o endereço que assina o aviso de\n'
		printf '# cobrança. Ele nasce com um substituto em domínio reservado (.invalid),\n'
		printf '# que não resolve em lugar nenhum. Troque-o pelo endereço real ANTES de\n'
		printf '# apontar a SMTP_URL para um servidor de e-mail de verdade: o\n'
		printf '# provisionamento cobra a PRESENÇA desta linha, e nunca o conteúdo dela.\n'
		printf '#\n'
		printf '# URL_BASE_DA_CONFIRMACAO também NÃO é segredo: é o endereço público do\n'
		printf '# aplicativo, sobre o qual o link de confirmação de e-mail é composto.\n'
		printf '# Mesmo critério do acima — substituto em .invalid, presença cobrada e\n'
		printf '# conteúdo nunca. Ela mora AQUI, e não numa diretiva Environment= de\n'
		printf '# cada unidade, porque as duas unidades leem este arquivo e uma segunda\n'
		printf '# declaração literal da mesma coordenada ficaria livre para divergir.\n'
		printf '#\n'
		printf '# BETTER_AUTH_SECRET e CHAVE_DE_CIFRA_DO_CERTIFICADO são SEGREDOS, gerados\n'
		printf '# nesta máquina em tempo de execução e nunca regerados pelas execuções\n'
		printf '# seguintes. As consequências de trocá-los são diferentes, e as duas são\n'
		printf '# graves:\n'
		printf '#\n'
		printf '#   - trocar BETTER_AUTH_SECRET invalida toda sessão em curso (todo mundo\n'
		printf '#     precisa entrar de novo). É a alavanca de emergência para suspeita de\n'
		printf '#     vazamento, e existe para ser usada de propósito.\n'
		printf '#   - trocar CHAVE_DE_CIFRA_DO_CERTIFICADO torna ILEGÍVEL todo o material\n'
		printf '#     de certificado já guardado, de TODAS as empresas — e material vindo\n'
		printf '#     de terceiro ninguém recompõe. Rotacioná-la obriga a recifrar o\n'
		printf '#     acervo inteiro na mesma janela; não a troque sem esse procedimento.\n'
		printf '#\n'
		printf '# ENDERECO_DO_PROVEDOR_BANCARIO e ENDERECO_DE_AUTORIZACAO_BANCARIA NÃO são\n'
		printf '# segredos: são para onde o produto\n'
		printf '# conecta ao verificar a identidade da empresa perante o banco. Nasce com\n'
		printf '# um substituto em domínio reservado (.invalid) e é trocado pelo endereço\n'
		printf '# real do provedor quando a instalação passar a cobrar de verdade.\n'
		printf '#\n'
		printf '# ENDERECO_DA_ENTREGA_DA_NOTICIA também NÃO é segredo, e a direção dele é a\n'
		printf '# INVERSA das duas acima: ele é o endereço público DESTA instalação, que o\n'
		printf '# provedor passa a chamar quando algo acontece com um título. Mesmo\n'
		printf '# critério — substituto em .invalid, presença cobrada e conteúdo nunca —, e\n'
		printf '# é trocado pelo hostname real quando o vhost da notificação for publicado.\n'
		printf '#\n'
		printf '# CONTATO_DA_ENTREGA_DA_NOTICIA é a outra metade da capacidade acima, e o\n'
		printf '# provedor a declara NECESSÁRIA no cadastro do webhook. É por ele que o\n'
		printf '# provedor avisa quando INATIVA a entrega. Mesmo critério das demais chaves\n'
		printf '# de conteúdo: substituto em domínio reservado, presença cobrada, conteúdo\n'
		printf '# nunca — e é trocado pelo endereço real da operação.\n'
		printf '#\n'
		printf '# DIRETORIO_DOS_BOLETOS também NÃO é segredo: é onde os bytes do boleto\n'
		printf '# que o provedor devolveu ficam guardados. Diferente das três chaves de\n'
		printf '# conteúdo acima, o valor semeado é o REAL — o mesmo diretório que este\n'
		printf '# procedimento cria, com dono %s e modo %s. Mudá-lo obriga a mover os\n' \
			"${DONO_DIR_BOLETOS}" "${MODO_DIR_BOLETOS}"
		printf '# arquivos e a aplicar dono e modo no destino; o verificador\n'
		printf '# deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh confere.\n'
		printf '\n'
		printf 'DATABASE_URL=%s\n' "$(montar_url_do_banco "${senha_db}" "${porta_banco}")"
		printf 'REDIS_URL=redis://127.0.0.1:%s\n' "${PORTA_FILA}"
		printf 'SMTP_URL=smtp://127.0.0.1:%s\n' "${PORTA_SMTP_CAPTURADOR}"
		printf 'EMAIL_REMETENTE=%s\n' "${REMETENTE_PADRAO_DO_AVISO}"
		printf 'URL_BASE_DA_CONFIRMACAO=%s\n' "${URL_BASE_PADRAO_DA_CONFIRMACAO}"
		printf 'BETTER_AUTH_SECRET=%s\n' "${segredo_sessao}"
		printf 'CHAVE_DE_CIFRA_DO_CERTIFICADO=%s\n' "${chave_de_cifra}"
		printf 'ENDERECO_DO_PROVEDOR_BANCARIO=%s\n' "${ENDERECO_PADRAO_DO_PROVEDOR_BANCARIO}"
		printf 'ENDERECO_DE_AUTORIZACAO_BANCARIA=%s\n' "${ENDERECO_PADRAO_DE_AUTORIZACAO_BANCARIA}"
		printf 'ENDERECO_DA_ENTREGA_DA_NOTICIA=%s\n' "${ENDERECO_PADRAO_DA_ENTREGA_DA_NOTICIA}"
		printf 'CONTATO_DA_ENTREGA_DA_NOTICIA=%s\n' "${CONTATO_PADRAO_DA_ENTREGA_DA_NOTICIA}"
		printf 'DIRETORIO_DOS_BOLETOS=%s\n' "${DIR_BOLETOS}"
	} >"${ARQ_AMBIENTE}"

	criado "P06" "arquivo de ambiente ${ARQ_AMBIENTE} criado (0600 ${DONO_ARQ_AMBIENTE}, credencial gerada em tempo de execução)"
}

porta_do_cluster() {
	# Derivada do estado real do cluster, não fixada: o `pg_createcluster`
	# escolhe a primeira porta livre a partir de 5432, e assumir 5432 aqui
	# produziria um socket inexistente se ela já estivesse tomada.
	local porta
	porta="$(runuser -u postgres -- psql -X -q -A -t -c 'SHOW port' 2>/dev/null | tr -dc '0-9')"
	if [[ -z "${porta}" ]]; then
		abortar "não foi possível descobrir a porta do socket do cluster ${VERSAO_POSTGRES}/main" \
			"confira 'pg_lsclusters' e o estado da unidade postgresql@${VERSAO_POSTGRES}-main"
	fi
	printf '%s' "${porta}"
}

# =========================================================================== #
# P07 — papel da aplicação.
#
# Sem SUPERUSER, sem CREATEDB, sem CREATEROLE e sem REPLICATION. O papel enxerga
# o próprio banco e nada mais.
# =========================================================================== #
passo_p07_papel() {
	if [[ "$(psql_consulta "SELECT count(*) FROM pg_roles WHERE rolname = '${PAPEL_DB}'")" == "1" ]]; then
		ja_ok "P07" "papel de banco '${PAPEL_DB}' já existe"
		return
	fi

	# O SQL trafega pela entrada padrão. `log_statement`/`log_min_duration_statement`
	# são desligados na própria sessão para que a instrução com a credencial não
	# vá parar no log do servidor caso o registro de comandos esteja ligado.
	printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nCREATE ROLE \"%s\" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '%s';\n" \
		"${PAPEL_DB}" "${senha_db}" | psql_admin >/dev/null

	criado "P07" "papel de banco '${PAPEL_DB}' criado (sem privilégio administrativo na instância)"
}

# =========================================================================== #
# P08 — banco da aplicação.
# =========================================================================== #
passo_p08_banco() {
	if [[ "$(psql_consulta "SELECT count(*) FROM pg_database WHERE datname = '${BANCO_DB}'")" == "1" ]]; then
		ja_ok "P08" "banco da aplicação '${BANCO_DB}' já existe"
		return
	fi

	printf 'CREATE DATABASE "%s" OWNER "%s";\n' "${BANCO_DB}" "${PAPEL_DB}" | psql_admin >/dev/null
	# Nenhum outro papel da instância conecta neste banco.
	printf 'REVOKE ALL ON DATABASE "%s" FROM PUBLIC;\nGRANT ALL ON DATABASE "%s" TO "%s";\n' \
		"${BANCO_DB}" "${BANCO_DB}" "${PAPEL_DB}" | psql_admin >/dev/null

	criado "P08" "banco da aplicação '${BANCO_DB}' criado com dono '${PAPEL_DB}'"
}

# =========================================================================== #
# P09 — credencial validada de ponta a ponta.
#
# Sem este passo, o script poderia terminar com sucesso e a aplicação ainda não
# conseguir conectar: o arquivo de ambiente e o papel podem ter nascido em
# execuções diferentes, com valores diferentes. O arquivo de ambiente é a fonte
# de verdade, porque é o que as unidades de serviço consomem.
#
# A senha vai ao cliente por PGPASSFILE — arquivo 0600 dentro de um diretório
# temporário 0700 removido pelo trap. É o mecanismo nativo do libpq e o único
# que não coloca o valor no `argv` (visível em `ps`) nem no ambiente do processo
# (visível em /proc/PID/environ).
# =========================================================================== #
passo_p09_credencial_valida() {
	local arq_senha="${DIR_TEMPORARIO}/pgpass"

	escrever_pgpass "${arq_senha}"
	if credencial_conecta "${arq_senha}"; then
		ja_ok "P09" "a credencial de ${ARQ_AMBIENTE} conecta em '${BANCO_DB}' como '${PAPEL_DB}'"
		return
	fi

	# Invariante afirmado NO PONTO da operação perigosa. O `ALTER ROLE` abaixo é a
	# única linha do script que reescreve a senha do banco, e o defeito que este
	# guarda barra é exatamente o de reescrevê-la a partir de um valor lido pela
	# metade: a senha efetiva viraria um prefixo curto da real, com o arquivo de
	# ambiente — fonte que as unidades de serviço consomem — ainda guardando o
	# valor completo. O P06 já reprova antes de chegar aqui; esta afirmação é
	# local à operação porque é aqui que um refactor futuro do P06 faria estrago.
	if ! credencial_manuseavel "${senha_db}"; then
		abortar "recusa de reescrever a senha de '${PAPEL_DB}': a credencial em mãos não passa na verificação de formato, e reescrever a partir dela rebaixaria a senha efetiva do banco" \
			"confira ${ARQ_AMBIENTE} — a credencial precisa conter apenas letras e números; corrija-a lá e no banco (ALTER ROLE) na mesma janela"
	fi

	info "a credencial do arquivo de ambiente não conectou — ressincronizando a senha do papel a partir dele"
	printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nALTER ROLE \"%s\" WITH PASSWORD '%s';\n" \
		"${PAPEL_DB}" "${senha_db}" | psql_admin >/dev/null

	if ! credencial_conecta "${arq_senha}"; then
		abortar "mesmo após ressincronizar a senha, o papel '${PAPEL_DB}' não conecta em '${BANCO_DB}' por ${HOSPEDEIRO_DB}:${porta_banco}" \
			"confira a regra 'host' do papel em ${ARQ_PG_HBA} (bloco '${MARCADOR_HBA_INICIO}') e a linha 'listen_addresses' em ${ARQ_PG_DROPIN}; o log está em 'journalctl -u postgresql@${VERSAO_POSTGRES}-main -n 50'"
	fi

	criado "P09" "senha do papel '${PAPEL_DB}' ressincronizada com ${ARQ_AMBIENTE}"
}

escrever_pgpass() {
	local destino="$1"
	install -m 0600 -o root -g root /dev/null "${destino}"
	# Curingas nos três primeiros campos: o cliente casa a entrada pelo hospedeiro
	# que ele próprio resolveu, e fixá-lo aqui só criaria uma forma a mais de
	# errar — a entrada deixaria de casar por um detalhe do lado do cliente e a
	# falha apareceria como "senha errada".
	printf '*:*:%s:%s:%s\n' "${BANCO_DB}" "${PAPEL_DB}" "${senha_db}" >"${destino}"
}

# A conexão é tentada pelo MESMO destino que a `DATABASE_URL` gravada declara —
# o endereço de retorno, com a regra `host` do ${ARQ_PG_HBA} —, e não pelo socket.
#
# CAUSA-RAIZ de ter mudado: provar a credencial por um caminho que os serviços não
# percorrem é provar outra coisa com o mesmo nome. Com a validação pelo socket, um
# `pg_hba` sem a regra `host` ou um `listen_addresses` que não subiu deixavam este
# passo VERDE, e a falha aparecia depois, na partida do serviço de aplicação — que
# é a única coisa que este passo existe para antecipar.
credencial_conecta() {
	PGPASSFILE="$1" psql -X -q -A -t -w \
		-h "${HOSPEDEIRO_DB}" -p "${porta_banco}" -U "${PAPEL_DB}" -d "${BANCO_DB}" \
		-c 'SELECT 1' >/dev/null 2>&1
}

# =========================================================================== #
# P10 — pacote do servidor de fila.
# =========================================================================== #
passo_p10_pacote_fila() {
	if pacote_instalado redis-server; then
		ja_ok "P10" "pacote do servidor de fila já instalado ($(dpkg-query -W -f='${Version}' redis-server))"
		return
	fi

	info "instalando redis-server"
	DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends redis-server
	criado "P10" "pacote do servidor de fila instalado"
}

# =========================================================================== #
# P11 — configuração da instância própria da fila.
#
# Instância NOMEADA sobre a unidade-modelo que o próprio pacote entrega. O
# `redis-server` de sistema (porta 6379) não é tocado: ele pertence ao ambiente
# legado, e reconfigurá-lo colocaria a fila do backend novo dentro do processo
# que atende a operação hoje.
# =========================================================================== #
passo_p11_configuracao_fila() {
	local mudancas=0

	if aplicar_diretorio "${DIR_FILA_DADOS}" 0750 redis redis; then
		mudancas=$((mudancas + 1))
	fi

	if aplicar_arquivo "${ARQ_FILA_CONF}" 0640 redis redis <<-FILA
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		# Instância '${INSTANCIA_FILA}', servida pela unidade-modelo
		# redis-server@.service que o pacote da distribuição entrega.
		# Alteração manual aqui é sobrescrita na próxima execução do provisionamento.

		# Apenas o endereço de retorno. Nada desta instância é alcançável de fora.
		bind 127.0.0.1 -::1
		port ${PORTA_FILA}
		protected-mode yes

		supervised systemd
		daemonize no
		pidfile /run/redis-${INSTANCIA_FILA}/redis-server.pid
		logfile /var/log/redis/redis-server-${INSTANCIA_FILA}.log

		# Diretório de dados próprio — separado do da instância do legado.
		dir ${DIR_FILA_DADOS}
		dbfilename dump-${INSTANCIA_FILA}.rdb

		# Persistência em disco LIGADA. Esta instância guarda a fila de trabalho,
		# não cache: perder o conteúdo significa trabalho não executado. O AOF
		# sincronizado a cada segundo limita a perda a, no máximo, um segundo de
		# escrita — e o instantâneo periódico abaixo é a segunda linha.
		appendonly yes
		appendfsync everysec
		appendfilename "appendonly-${INSTANCIA_FILA}.aof"
		appenddirname "appendonlydir"
		save 900 1
		save 300 10
		save 60 10000

		# Nunca descartar chave por pressão de memória: descarte silencioso aqui
		# seria tarefa da fila desaparecendo sem erro em lugar nenhum.
		maxmemory-policy noeviction
	FILA
	then
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P11" "instância '${INSTANCIA_FILA}' da fila configurada (porta ${PORTA_FILA}, dados em ${DIR_FILA_DADOS}, persistência em disco ligada)"
	else
		ja_ok "P11" "instância '${INSTANCIA_FILA}' da fila já configurada (porta ${PORTA_FILA}, dados em ${DIR_FILA_DADOS}, persistência em disco ligada)"
	fi

	CONFIGURACAO_FILA_MUDOU="${mudancas}"
}

# =========================================================================== #
# P12 — serviço da fila habilitado no arranque e ativo.
# =========================================================================== #
passo_p12_servico_fila() {
	local mudancas=0

	if ! unidade_habilitada "${UNIDADE_FILA}"; then
		systemctl enable "${UNIDADE_FILA}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_ativa "${UNIDADE_FILA}"; then
		systemctl start "${UNIDADE_FILA}"
		mudancas=$((mudancas + 1))
	elif [[ "${CONFIGURACAO_FILA_MUDOU}" -gt 0 ]]; then
		info "reiniciando ${UNIDADE_FILA} para carregar a configuração nova"
		systemctl restart "${UNIDADE_FILA}"
		mudancas=$((mudancas + 1))
	fi

	esperar_fila_responder

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P12" "${UNIDADE_FILA} habilitado no arranque e ativo"
	else
		ja_ok "P12" "${UNIDADE_FILA} já habilitado no arranque e já ativo"
	fi
}

esperar_fila_responder() {
	local limite=60 decorrido=0
	while [[ "$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" ping 2>/dev/null || true)" != "PONG" ]]; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			abortar "a instância '${INSTANCIA_FILA}' da fila não respondeu na porta ${PORTA_FILA} em ${limite}s" \
				"investigue com 'systemctl status ${UNIDADE_FILA}' e 'journalctl -u ${UNIDADE_FILA} -n 50'"
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
}

# =========================================================================== #
# P13 — binário do capturador de e-mail de desenvolvimento.
# =========================================================================== #
passo_p13_binario_capturador() {
	local versao_nua="${MAILPIT_VERSAO#v}"

	if [[ -x "${BIN_CAPTURADOR}" ]] &&
		"${BIN_CAPTURADOR}" version 2>/dev/null | grep -qF "${versao_nua}"; then
		ja_ok "P13" "capturador de e-mail já instalado na versão ${MAILPIT_VERSAO} em ${BIN_CAPTURADOR}"
		return
	fi

	local url="https://github.com/axllent/mailpit/releases/download/${MAILPIT_VERSAO}/mailpit-linux-$(dpkg --print-architecture).tar.gz"
	local tarball="${DIR_TEMPORARIO}/mailpit.tar.gz"

	info "baixando o capturador de e-mail ${MAILPIT_VERSAO}"
	curl -fsSL --max-time 180 "${url}" -o "${tarball}" ||
		abortar "não foi possível baixar o capturador de e-mail de ${url}" \
			"confira a saída de rede desta máquina; se a versão fixada tiver saído do ar, atualize MAILPIT_VERSAO e MAILPIT_SHA256 no topo deste script"

	local soma
	soma="$(sha256sum "${tarball}" | cut -d' ' -f1)"
	if [[ "${soma}" != "${MAILPIT_SHA256}" ]]; then
		abortar "a soma SHA-256 do artefato baixado é '${soma}', e a fixada neste script é '${MAILPIT_SHA256}'" \
			"NÃO instale: ou o artefato da versão ${MAILPIT_VERSAO} foi republicado, ou o download foi adulterado. Confira junto ao fornecedor e só então atualize MAILPIT_SHA256"
	fi

	tar -xzf "${tarball}" -C "${DIR_TEMPORARIO}" mailpit
	install -m 0755 -o root -g root "${DIR_TEMPORARIO}/mailpit" "${BIN_CAPTURADOR}"
	criado "P13" "capturador de e-mail ${MAILPIT_VERSAO} instalado em ${BIN_CAPTURADOR} (soma SHA-256 conferida)"
}

# =========================================================================== #
# P14 — unidade do capturador de e-mail, habilitada no arranque e ativa.
#
# A unidade é gerada aqui, e não versionada em deploy/systemd/, porque aquele
# diretório pertence às unidades da aplicação e do processador, instaladas por
# outro procedimento. O conteúdo continua versionado — está neste arquivo.
#
# `DynamicUser=yes` evita criar um usuário de sistema só para o capturador: o
# systemd aloca um identificador efêmero e o `StateDirectory` nasce com o dono
# certo a cada arranque.
# =========================================================================== #
passo_p14_servico_capturador() {
	local mudancas=0

	if aplicar_arquivo "${ARQ_UNIDADE_CAPTURADOR}" 0644 root root <<-UNIDADE
		# Gerido por deploy/scripts/instalacao/provisionar-base.sh (backend Sysloc).
		[Unit]
		Description=Capturador de e-mail de desenvolvimento do backend Sysloc (Mailpit)
		Documentation=https://mailpit.axllent.org/
		After=network.target

		[Service]
		Type=simple
		DynamicUser=yes
		StateDirectory=sysloc-mailpit
		# Preso ao endereço de retorno nas duas portas: o capturador serve ao
		# ciclo de desenvolvimento e não é alcançável de fora desta máquina.
		ExecStart=${BIN_CAPTURADOR} --database ${DIR_ESTADO_CAPTURADOR}/mailpit.db --listen 127.0.0.1:${PORTA_HTTP_CAPTURADOR} --smtp 127.0.0.1:${PORTA_SMTP_CAPTURADOR}
		Restart=always
		RestartSec=5

		NoNewPrivileges=yes
		PrivateTmp=yes
		PrivateDevices=yes
		ProtectSystem=strict
		ProtectHome=yes
		ProtectKernelTunables=yes
		ProtectKernelModules=yes
		ProtectControlGroups=yes
		RestrictAddressFamilies=AF_INET AF_INET6
		RestrictNamespaces=yes
		RestrictRealtime=yes
		RestrictSUIDSGID=yes
		LockPersonality=yes
		SystemCallArchitectures=native

		[Install]
		WantedBy=multi-user.target
	UNIDADE
	then
		systemctl daemon-reload
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_habilitada "${UNIDADE_CAPTURADOR}"; then
		systemctl enable "${UNIDADE_CAPTURADOR}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	if ! unidade_ativa "${UNIDADE_CAPTURADOR}"; then
		systemctl start "${UNIDADE_CAPTURADOR}"
		mudancas=$((mudancas + 1))
	elif [[ "${mudancas}" -gt 0 ]]; then
		info "reiniciando ${UNIDADE_CAPTURADOR} para carregar a unidade nova"
		systemctl restart "${UNIDADE_CAPTURADOR}"
	fi

	esperar_capturador_responder

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P14" "${UNIDADE_CAPTURADOR} instalado, habilitado no arranque e ativo (SMTP ${PORTA_SMTP_CAPTURADOR}, painel ${PORTA_HTTP_CAPTURADOR}, ambos em 127.0.0.1)"
	else
		ja_ok "P14" "${UNIDADE_CAPTURADOR} já instalado, habilitado no arranque e ativo (SMTP ${PORTA_SMTP_CAPTURADOR}, painel ${PORTA_HTTP_CAPTURADOR}, ambos em 127.0.0.1)"
	fi
}

esperar_capturador_responder() {
	local limite=60 decorrido=0
	while ! ss -ltnH "sport = :${PORTA_SMTP_CAPTURADOR}" 2>/dev/null | grep -q .; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			abortar "o capturador de e-mail não abriu a porta ${PORTA_SMTP_CAPTURADOR} em ${limite}s" \
				"investigue com 'systemctl status ${UNIDADE_CAPTURADOR}' e 'journalctl -u ${UNIDADE_CAPTURADOR} -n 50'"
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
}

# =========================================================================== #
# Topologia de dois papéis — P15 e P16.
#
# O papel que atende requisição NÃO é dono de nada, e o dono NÃO atende
# requisição (ADR-0008 e decisão D2 da fatia `fundacao-multitenancy-identidade`).
# Sem essa separação, `FORCE ROW LEVEL SECURITY` seria a única coisa entre o
# processo da aplicação e a leitura de dado alheio; com ela, contornar o
# isolamento exige duas falhas independentes.
#
# Estes dois passos são ACRESCENTADOS ao fim da sequência, e nenhum passo
# anterior muda. O identificador cresce junto com a ordem de execução de
# propósito: o CT-001 da bateria de provisionamento deriva a lista de passos da
# própria saída, de modo que os dois entram na prova de idempotência sem que
# nada precise ser acrescentado à mão lá.
# =========================================================================== #

# A cadeia de conexão do MIGRADOR, num lugar só. Mesma forma da cadeia da
# aplicação — `postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO` —, e pelo mesmo
# motivo registrado na `DECISÃO FECHADA` de `montar_url_do_banco`: é a única
# forma que `psql` e o script de migração leem sem tradução.
#
# O segredo entra como parâmetro posicional de uma função do próprio shell — sem
# `exec`, sem linha de comando nova para `ps` mostrar e sem exportar nada.
#
# $1 = credencial · $2 = porta do cluster
montar_url_de_migracao() {
	printf 'postgresql://%s:%s@%s:%s/%s' \
		"${PAPEL_MIGRACAO}" "$1" "${HOSPEDEIRO_DB}" "$2" "${BANCO_DB}"
}

# Resultado de `extrair_credencial_migracao`. Não é exportado e nunca é impresso.
CREDENCIAL_MIGRACAO_LIDA=""
CHAVES_REPETIDAS_MIGRACAO=""

# O CAMINHO DE LEITURA do arquivo de ambiente do migrador, inteiro e sem efeito
# colateral. Espelha `extrair_credencial_db` — e a repetição é deliberada: aquela
# função é ancorada em `^DATABASE_URL=`, é carregada e exercitada pelo CT-003 a
# partir deste arquivo, e generalizá-la por parâmetro mudaria a assinatura de um
# símbolo que a bateria extrai por nome. O que NÃO se repete é o raciocínio, que
# vive lá por extenso; aqui ficam as três propriedades que ele produziu:
#
#   1. atribuição repetida é AMBIGUIDADE e se recusa — o `EnvironmentFile=` do
#      systemd resolve pela ÚLTIMA e um leitor ingênuo pela PRIMEIRA;
#   2. a captura é GULOSA até o ÚLTIMO '@' — classe restrita dentro da expressão
#      de extração não falha, ela TRUNCA, e o prefixo truncado atravessaria o
#      guarda de formato;
#   3. a validação de alfabeto é um passo SEPARADO da extração.
#
# Devolve, por código de saída:
#   0  credencial íntegra em ${CREDENCIAL_MIGRACAO_LIDA}
#   1  não consegui interpretar o arquivo
#   2  atribuição repetida — ${CHAVES_REPETIDAS_MIGRACAO} nomeia as chaves
#   3  interpretei, mas o valor está fora de [A-Za-z0-9]
extrair_credencial_migracao() {
	local arquivo="$1"
	CREDENCIAL_MIGRACAO_LIDA=""
	CHAVES_REPETIDAS_MIGRACAO=""

	if [[ ! -f "${arquivo}" ]]; then
		return 1
	fi

	local repetidas
	# Mesma âncora tolerante à indentação de `extrair_credencial_db`, e pela mesma
	# razão medida: o systemd lê `  CHAVE=valor` como atribuição, e um guarda de
	# ambiguidade que não a enxerga é cego exatamente onde o dano mora.
	repetidas="$(grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		tr -d ' \t' | sort | uniq -d | tr -d '=' | tr '\n' ' ' || true)"
	if [[ -n "${repetidas// /}" ]]; then
		CHAVES_REPETIDAS_MIGRACAO="${repetidas% }"
		return 2
	fi

	local valor
	valor="$(sed -n 's|^MIGRATION_DATABASE_URL=postgresql://[^:/]*:\(.*\)@.*$|\1|p' "${arquivo}")"
	if [[ -z "${valor}" ]]; then
		return 1
	fi

	if ! credencial_manuseavel "${valor}"; then
		return 3
	fi

	CREDENCIAL_MIGRACAO_LIDA="${valor}"
	return 0
}

# O SQL que prepara UM banco para receber as migrações, num lugar só.
#
# Ele é lido de VOLTA por `deploy/scripts/instalacao/verificar-migracao.sh`, que
# o extrai deste arquivo e o aplica ao banco descartável do mutante. A razão é a
# do antipadrão registrado em `.claude/rules/testing-stack.md`: um verificador
# que reimplementasse esta preparação estaria provando o mutante contra um banco
# montado de outro jeito, e a semelhança com o banco da operação seria
# coincidência mantida à mão. Mudar a assinatura ou o nome desta função quebra a
# extração lá — de forma ruidosa, que é como tem de ser.
#
# Por que os schemas nascem AQUI e não na migração (§7.3 da tech spec): criá-los
# na migração exigiria conceder `CREATE` sobre o banco ao migrador, e transferir
# propriedade depois exigiria `ALTER ... OWNER`, que só quem pertence ao papel de
# destino pode executar — e esse pertencimento é justamente o que a suíte de
# isolamento prova NÃO existir. Criando-os aqui, com privilégio administrativo
# que este procedimento já tem, as tabelas nascem do migrador por consequência.
#
# Nenhuma linha emitida carrega segredo: são concessões e criação de schema.
#
# $1 = nome do banco
sql_preparar_banco_para_migracao() {
	local banco="$1"
	printf 'GRANT CONNECT ON DATABASE "%s" TO "%s";\n' "${banco}" "${PAPEL_MIGRACAO}"
	printf 'CREATE SCHEMA IF NOT EXISTS "%s" AUTHORIZATION "%s";\n' \
		"${SCHEMA_IDENTIDADE}" "${PAPEL_MIGRACAO}"
	printf 'CREATE SCHEMA IF NOT EXISTS "%s" AUTHORIZATION "%s";\n' \
		"${SCHEMA_NEGOCIO}" "${PAPEL_MIGRACAO}"
	printf 'CREATE SCHEMA IF NOT EXISTS "%s" AUTHORIZATION "%s";\n' \
		"${SCHEMA_PLATAFORMA}" "${PAPEL_MIGRACAO}"
	printf 'GRANT USAGE ON SCHEMA "%s", "%s", "%s" TO "%s";\n' \
		"${SCHEMA_IDENTIDADE}" "${SCHEMA_NEGOCIO}" "${SCHEMA_PLATAFORMA}" "${PAPEL_DB}"
}

# Consulta de leitura DENTRO de um banco específico. `psql_consulta` conecta ao
# banco padrão do superusuário, e as perguntas sobre schema e concessão só têm
# resposta no banco em que os objetos vivem.
#
# $1 = banco · $2 = consulta (nenhuma consulta de leitura carrega segredo)
psql_consulta_no_banco() {
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q -A -t -d "$1" -c "$2"
}

escrever_pgpass_migracao() {
	local destino="$1"
	install -m 0600 -o root -g root /dev/null "${destino}"
	# Curingas nos três primeiros campos, pelo mesmo motivo de `escrever_pgpass`.
	printf '*:*:%s:%s:%s\n' "${BANCO_DB}" "${PAPEL_MIGRACAO}" "${senha_migracao}" >"${destino}"
}

credencial_de_migracao_conecta() {
	PGPASSFILE="$1" psql -X -q -A -t -w \
		-h "${HOSPEDEIRO_DB}" -p "${porta_banco}" -U "${PAPEL_MIGRACAO}" -d "${BANCO_DB}" \
		-c 'SELECT 1' >/dev/null 2>&1
}

# =========================================================================== #
# P15 — papel de migração e a credencial dele.
#
# Mesmas restrições do papel da aplicação (P07), mais `NOBYPASSRLS` explícito.
# O atributo já é o padrão, e declará-lo é deliberado: ele é o único que, ligado,
# faria a política deixar de valer para o DONO das tabelas mesmo com `FORCE`, e o
# CT-030 da bateria de provisionamento o afirma no catálogo. Propriedade que uma
# asserção cobra merece estar escrita, não herdada de um padrão que pode mudar.
#
# A credencial é gerada em tempo de execução e NUNCA regerada: regerá-la a cada
# execução deixaria o arquivo e o banco em desacordo a partir da segunda.
# =========================================================================== #
passo_p15_papel_migracao() {
	local mudancas=0 detalhes=""

	if [[ -f "${ARQ_AMBIENTE_MIGRACAO}" ]]; then
		local codigo_leitura=0
		extrair_credencial_migracao "${ARQ_AMBIENTE_MIGRACAO}" || codigo_leitura=$?
		senha_migracao="${CREDENCIAL_MIGRACAO_LIDA}"

		case "${codigo_leitura}" in
		0) : ;;
		1)
			abortar "não consegui interpretar ${ARQ_AMBIENTE_MIGRACAO}: falta uma linha 'MIGRATION_DATABASE_URL=postgresql://USUARIO:SEGREDO@...' de onde ler a credencial do papel de migração" \
				"salve uma cópia do arquivo em local seguro, remova o original e execute de novo — o script gerará uma credencial nova e a aplicará ao papel '${PAPEL_MIGRACAO}'"
			;;
		2)
			abortar "${ARQ_AMBIENTE_MIGRACAO} atribui mais de uma vez a(s) chave(s): ${CHAVES_REPETIDAS_MIGRACAO} — o arquivo é ambíguo e este procedimento se recusa a escolher por você" \
				"NADA foi alterado. Deixe exatamente UMA atribuição de cada chave em ${ARQ_AMBIENTE_MIGRACAO} (apague as linhas antigas em vez de acrescentar novas) e execute este script de novo"
			;;
		3)
			senha_migracao=""
			abortar "interpretei ${ARQ_AMBIENTE_MIGRACAO}, mas a credencial contém caractere fora de [A-Za-z0-9] — ela viaja dentro de uma URL de conexão, onde ':', '@', '?', '&' e '/' são delimitadores" \
				"NADA foi alterado. Escolha uma credencial só com letras e números, grave-a em ${ARQ_AMBIENTE_MIGRACAO} E aplique-a no banco com ALTER ROLE \"${PAPEL_MIGRACAO}\" na MESMA janela; depois execute este script de novo"
			;;
		*)
			abortar "a leitura de ${ARQ_AMBIENTE_MIGRACAO} devolveu o desfecho inesperado ${codigo_leitura}" \
				"NADA foi alterado. Isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
			;;
		esac

		if [[ "$(stat -c '%a %U' "${ARQ_AMBIENTE_MIGRACAO}")" != "600 ${DONO_ARQ_AMBIENTE}" ]]; then
			chmod 0600 "${ARQ_AMBIENTE_MIGRACAO}"
			chown "${DONO_ARQ_AMBIENTE}:${DONO_ARQ_AMBIENTE}" "${ARQ_AMBIENTE_MIGRACAO}"
			detalhes="${detalhes}permissão corrigida para 0600 ${DONO_ARQ_AMBIENTE}; "
			mudancas=$((mudancas + 1))
		fi
	else
		senha_migracao="$(gerar_segredo)"
		if [[ "${#senha_migracao}" -ne 32 ]] || ! credencial_manuseavel "${senha_migracao}"; then
			abortar "a geração da credencial de migração não produziu 32 caracteres alfanuméricos" \
				"confira se /dev/urandom está acessível nesta máquina e execute de novo"
		fi

		# `install` cria o arquivo já com 0600 ANTES de qualquer byte de segredo
		# entrar nele — não há janela em que o conteúdo exista com permissão frouxa.
		install -m 0600 -o "${DONO_ARQ_AMBIENTE}" -g "${DONO_ARQ_AMBIENTE}" /dev/null "${ARQ_AMBIENTE_MIGRACAO}"
		{
			printf '# Arquivo de ambiente do MIGRADOR do backend Sysloc.\n'
			printf '#\n'
			printf '# GERADO por deploy/scripts/instalacao/provisionar-base.sh. Vive fora da\n'
			printf '# árvore versionada por construção (ADR-0005, condição de entrada).\n'
			printf '#\n'
			printf '# Ele é SEPARADO de %s de propósito: aquele é o\n' "${ARQ_AMBIENTE}"
			printf '# EnvironmentFile= das unidades de serviço, e a credencial abaixo é do papel\n'
			printf '# DONO das tabelas. Juntá-las colocaria no ambiente do processo que atende\n'
			printf '# requisição exatamente o poder que a separação de papéis lhe nega.\n'
			printf '#\n'
			printf '# Consumido apenas por deploy/scripts/instalacao/migrar-banco.sh, que a\n'
			printf '# transporta ao cliente por PGPASSFILE — nunca por argumento de linha de\n'
			printf '# comando nem por variável exportada.\n'
			printf '#\n'
			printf '# A credencial NÃO é regerada em execuções seguintes do provisionamento. Se\n'
			printf '# precisar trocá-la, altere aqui E no banco (ALTER ROLE) na mesma janela,\n'
			printf '# respeitando as mesmas duas regras do arquivo da aplicação: apenas letras e\n'
			printf '# números, e UMA única atribuição por chave.\n'
			printf '\n'
			printf 'MIGRATION_DATABASE_URL=%s\n' \
				"$(montar_url_de_migracao "${senha_migracao}" "${porta_banco}")"
		} >"${ARQ_AMBIENTE_MIGRACAO}"
		detalhes="${detalhes}arquivo ${ARQ_AMBIENTE_MIGRACAO} criado (0600 ${DONO_ARQ_AMBIENTE}, credencial gerada em tempo de execução); "
		mudancas=$((mudancas + 1))
	fi

	if [[ "$(psql_consulta "SELECT count(*) FROM pg_roles WHERE rolname = '${PAPEL_MIGRACAO}'")" != "1" ]]; then
		# O SQL trafega pela entrada padrão, com o registro de comandos desligado na
		# própria sessão — mesmo cuidado do P07, pela mesma razão.
		printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nCREATE ROLE \"%s\" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '%s';\n" \
			"${PAPEL_MIGRACAO}" "${senha_migracao}" | psql_admin >/dev/null
		detalhes="${detalhes}papel '${PAPEL_MIGRACAO}' criado (sem privilégio administrativo na instância); "
		mudancas=$((mudancas + 1))
	fi

	# O papel de RESOLUÇÃO, sem credencial e sem LOGIN. Ele não entra no bloco
	# acima porque não há segredo a gerar nem arquivo de ambiente a escrever: o
	# que ele carrega é a propriedade de UMA função, e nada mais.
	#
	# Nenhuma instrução aqui traz segredo, então o registro de comandos não
	# precisa ser desligado — ao contrário do CREATE ROLE com PASSWORD acima.
	if [[ "$(psql_consulta "SELECT count(*) FROM pg_roles WHERE rolname = '${PAPEL_RESOLUCAO}'")" != "1" ]]; then
		printf 'CREATE ROLE "%s" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\n' \
			"${PAPEL_RESOLUCAO}" | psql_admin >/dev/null
		detalhes="${detalhes}papel '${PAPEL_RESOLUCAO}' criado (NOLOGIN, dono da resolução do portador); "
		mudancas=$((mudancas + 1))
	fi

	# O papel de ROTEAMENTO, gêmeo do de resolução e pela mesma razão — dono da
	# função `negocio.rotear_notificacao_bancaria` da `0020`. Ele é um papel
	# PRÓPRIO, e não o reuso do de resolução: ver o comentário da constante.
	if [[ "$(psql_consulta "SELECT count(*) FROM pg_roles WHERE rolname = '${PAPEL_ROTEAMENTO}'")" != "1" ]]; then
		printf 'CREATE ROLE "%s" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\n' \
			"${PAPEL_ROTEAMENTO}" | psql_admin >/dev/null
		detalhes="${detalhes}papel '${PAPEL_ROTEAMENTO}' criado (NOLOGIN, dono do roteamento da notícia bancária); "
		mudancas=$((mudancas + 1))
	fi

	# A membership existe para UMA coisa: o `ALTER FUNCTION … OWNER TO` da `0014`
	# exige que quem executa seja membro do papel de destino. `INHERIT FALSE` é o
	# mínimo que a torna suficiente — o migrador pode ASSUMIR o papel
	# deliberadamente, mas não herda os privilégios dele nas consultas comuns, de
	# modo que a leitura irrestrita do portador continua exigindo um `SET ROLE`
	# explícito em vez de acontecer por acidente.
	#
	# Conferida antes de concedida: `GRANT` repetido não erra, mas reportaria
	# mudança em toda execução e este passo deixaria de convergir.
	if [[ "$(psql_consulta "SELECT pg_has_role('${PAPEL_MIGRACAO}', '${PAPEL_RESOLUCAO}', 'MEMBER')")" != "t" ]]; then
		printf 'GRANT "%s" TO "%s" WITH INHERIT FALSE, SET TRUE;\n' \
			"${PAPEL_RESOLUCAO}" "${PAPEL_MIGRACAO}" | psql_admin >/dev/null
		detalhes="${detalhes}'${PAPEL_MIGRACAO}' passou a ser membro de '${PAPEL_RESOLUCAO}' (INHERIT FALSE), o que a migração 0014 exige para trocar o dono da função; "
		mudancas=$((mudancas + 1))
	fi

	# A mesma membership, pela mesma razão, para o papel de roteamento: é o
	# `ALTER FUNCTION … OWNER TO` da `0020` que a exige.
	if [[ "$(psql_consulta "SELECT pg_has_role('${PAPEL_MIGRACAO}', '${PAPEL_ROTEAMENTO}', 'MEMBER')")" != "t" ]]; then
		printf 'GRANT "%s" TO "%s" WITH INHERIT FALSE, SET TRUE;\n' \
			"${PAPEL_ROTEAMENTO}" "${PAPEL_MIGRACAO}" | psql_admin >/dev/null
		detalhes="${detalhes}'${PAPEL_MIGRACAO}' passou a ser membro de '${PAPEL_ROTEAMENTO}' (INHERIT FALSE), o que a migração 0020 exige para trocar o dono da função; "
		mudancas=$((mudancas + 1))
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P15" "papel de migração e credencial dele (${detalhes%; })"
	else
		ja_ok "P15" "papéis '${PAPEL_MIGRACAO}', '${PAPEL_RESOLUCAO}' e '${PAPEL_ROTEAMENTO}' já existem e ${ARQ_AMBIENTE_MIGRACAO} já está íntegro (credencial preservada)"
	fi
}

# =========================================================================== #
# P16 — banco preparado para a migração, e a credencial de migração validada.
#
# Sem a validação de ponta a ponta, este procedimento poderia terminar com
# sucesso e a migração ainda não conseguir conectar: o arquivo de ambiente e o
# papel podem ter nascido em execuções diferentes, com valores diferentes. É o
# mesmo raciocínio do P09, aplicado ao segundo papel — e por isso a validação
# percorre o MESMO caminho que `migrar-banco.sh` percorre, o endereço de retorno
# com a regra `host` do ${ARQ_PG_HBA}, e não o socket.
# =========================================================================== #
passo_p16_banco_preparado() {
	local mudancas=0

	# Schema que já exista com outro dono não é corrigido em silêncio: `CREATE
	# SCHEMA IF NOT EXISTS ... AUTHORIZATION` IGNORA a autorização quando o schema
	# existe, de modo que o passo reportaria mudança para sempre sem nunca
	# convergir. Trocar o dono é decisão com consequência sobre objeto já criado —
	# ela é do operador, não deste script.
	local schema dono
	for schema in "${SCHEMA_IDENTIDADE}" "${SCHEMA_NEGOCIO}" "${SCHEMA_PLATAFORMA}"; do
		dono="$(psql_consulta_no_banco "${BANCO_DB}" \
			"SELECT coalesce((SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner WHERE n.nspname = '${schema}'), 'AUSENTE')")"
		if [[ "${dono}" != "AUSENTE" && "${dono}" != "${PAPEL_MIGRACAO}" ]]; then
			abortar "o schema '${schema}' do banco '${BANCO_DB}' pertence a '${dono}', e não a '${PAPEL_MIGRACAO}' — com o dono errado a RLS forçada deixa de valer para quem cria as tabelas, e o isolamento existiria só no papel" \
				"NADA foi alterado. Decida o destino dos objetos que já vivem nele e, se a troca for deliberada, execute 'ALTER SCHEMA \"${schema}\" OWNER TO \"${PAPEL_MIGRACAO}\"' e 'REASSIGN OWNED' na mesma janela; depois execute este script de novo"
		fi
	done

	# A contagem é literal e casa com o número de schemas do laço acima. Ela é o que
	# faz um schema AUSENTE reprovar o predicado: sem ela, o `bool_and` correria
	# sobre as linhas que existem e um schema que nunca tivesse sido criado
	# passaria por "já preparado" — a preparação não rodaria, e a migração que o
	# referencia falharia depois, longe da causa.
	#
	# QUANDO ATUALIZAR: a fatia que acrescentar schema atualiza o laço acima, este
	# número e o `IN` abaixo, no mesmo commit.
	local ja_preparado
	ja_preparado="$(psql_consulta_no_banco "${BANCO_DB}" "
		SELECT (
			count(*) FILTER (WHERE r.rolname = '${PAPEL_MIGRACAO}') = 3
			AND bool_and(has_schema_privilege('${PAPEL_DB}', n.nspname, 'USAGE'))
			AND has_database_privilege('${PAPEL_MIGRACAO}', '${BANCO_DB}', 'CONNECT')
		)
		FROM pg_namespace n
		JOIN pg_roles r ON r.oid = n.nspowner
		WHERE n.nspname IN ('${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}', '${SCHEMA_PLATAFORMA}')")"

	if [[ "${ja_preparado}" != "t" ]]; then
		sql_preparar_banco_para_migracao "${BANCO_DB}" | psql_admin -d "${BANCO_DB}" >/dev/null
		mudancas=$((mudancas + 1))
	fi

	local arq_senha="${DIR_TEMPORARIO}/pgpass-migracao"
	escrever_pgpass_migracao "${arq_senha}"

	if ! credencial_de_migracao_conecta "${arq_senha}"; then
		# Mesmo invariante afirmado NO PONTO da operação perigosa que o P09 instala
		# para o papel da aplicação: o `ALTER ROLE` abaixo é a única linha deste
		# passo que reescreve a senha do papel de migração, e reescrevê-la a partir
		# de um valor lido pela metade rebaixaria a senha efetiva do banco enquanto
		# ${ARQ_AMBIENTE_MIGRACAO} seguiria guardando o valor completo.
		if ! credencial_manuseavel "${senha_migracao}"; then
			abortar "recusa de reescrever a senha de '${PAPEL_MIGRACAO}': a credencial em mãos não passa na verificação de formato, e reescrever a partir dela rebaixaria a senha efetiva do banco" \
				"confira ${ARQ_AMBIENTE_MIGRACAO} — a credencial precisa conter apenas letras e números; corrija-a lá e no banco (ALTER ROLE) na mesma janela"
		fi

		info "a credencial de migração não conectou — ressincronizando a senha do papel a partir de ${ARQ_AMBIENTE_MIGRACAO}"
		printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nALTER ROLE \"%s\" WITH PASSWORD '%s';\n" \
			"${PAPEL_MIGRACAO}" "${senha_migracao}" | psql_admin >/dev/null
		mudancas=$((mudancas + 1))

		if ! credencial_de_migracao_conecta "${arq_senha}"; then
			abortar "mesmo após ressincronizar a senha, o papel '${PAPEL_MIGRACAO}' não conecta em '${BANCO_DB}' por ${HOSPEDEIRO_DB}:${porta_banco}" \
				"confira a regra 'host' do papel em ${ARQ_PG_HBA} (bloco '${MARCADOR_HBA_INICIO}') e a concessão de CONNECT sobre '${BANCO_DB}'; o log está em 'journalctl -u postgresql@${VERSAO_POSTGRES}-main -n 50'"
		fi
	fi

	if [[ "${mudancas}" -gt 0 ]]; then
		criado "P16" "banco '${BANCO_DB}' preparado para a migração: schemas '${SCHEMA_IDENTIDADE}', '${SCHEMA_NEGOCIO}' e '${SCHEMA_PLATAFORMA}' com dono '${PAPEL_MIGRACAO}', uso concedido a '${PAPEL_DB}', e a credencial de migração conecta"
	else
		ja_ok "P16" "banco '${BANCO_DB}' já preparado para a migração e a credencial de '${PAPEL_MIGRACAO}' conecta"
	fi
}

# =========================================================================== #
# Encerramento.
# =========================================================================== #
# =========================================================================== #
# P17 — diretório dos boletos, fora da árvore versionada.
#
# ⚠️ Ele roda DEPOIS do P06, que semeia `DIRETORIO_DOS_BOLETOS` no arquivo de
# ambiente, e a ordem é deliberada: o P06 é o passo que ABORTA diante de arquivo
# ambíguo ou de coordenada divergente, e criar diretório antes dele deixaria
# resíduo de uma execução que se recusou a prosseguir. As duas pontas leem a
# MESMA constante (${DIR_BOLETOS}), de modo que a linha semeada e o diretório
# criado não podem divergir.
#
# A ausência do usuário do serviço ABORTA em vez de degradar para outro dono: um
# diretório de dono errado faz a aplicação falhar na primeira emissão, com
# `EACCES` numa gravação que o operador não relacionaria ao provisionamento. É a
# mesma conduta de `verificar_usuario_dos_servicos`, em `instalar-unidades.sh`.
# =========================================================================== #
passo_p17_diretorio_dos_boletos() {
	if ! getent passwd "${DONO_DIR_BOLETOS}" >/dev/null 2>&1; then
		abortar "o usuário '${DONO_DIR_BOLETOS}' não existe nesta máquina, e ele é o dono do diretório dos boletos (${DIR_BOLETOS}) — é como quem as unidades de serviço rodam (User=)" \
			"crie o usuário do serviço (ou ajuste DONO_DIR_BOLETOS no topo deste script, se o nome mudou) e execute de novo — nada além deste passo depende dele"
	fi

	if aplicar_diretorio "${DIR_BOLETOS}" "${MODO_DIR_BOLETOS}" \
		"${DONO_DIR_BOLETOS}" "${DONO_DIR_BOLETOS}"; then
		criado "P17" "diretório dos boletos ${DIR_BOLETOS} criado (${MODO_DIR_BOLETOS} ${DONO_DIR_BOLETOS}:${DONO_DIR_BOLETOS})"
	else
		ja_ok "P17" "diretório dos boletos ${DIR_BOLETOS} já existe (${MODO_DIR_BOLETOS} ${DONO_DIR_BOLETOS}:${DONO_DIR_BOLETOS})"
	fi
}

resumir() {
	local disco_depois_mib consumo
	disco_depois_mib="$(medir_disco_mib "${DESTINO_DISCO}" || true)"
	disco_depois_mib="${disco_depois_mib:-0}"
	consumo=$((disco_antes_mib - disco_depois_mib))

	printf '\n'
	info "resumo: ${total_criado} passo(s) alterado(s), ${total_ja_ok} passo(s) já corretos"
	info "disco em '${DESTINO_DISCO}': ${disco_antes_mib} MiB livres antes, ${disco_depois_mib} MiB depois (consumo ${consumo} MiB)"

	if [[ "${disco_depois_mib}" -lt "${MINIMO_DISCO_MIB}" ]]; then
		erro "o espaço livre em '${DESTINO_DISCO}' caiu para ${disco_depois_mib} MiB, abaixo do mínimo de ${MINIMO_DISCO_MIB} MiB"
		erro "O QUE FAZER: o provisionamento terminou, mas a próxima execução vai abortar no guarda de disco. Libere espaço antes de seguir para as etapas seguintes da fatia."
	fi

	info "bytes de boleto em ${DIR_BOLETOS} (${MODO_DIR_BOLETOS} ${DONO_DIR_BOLETOS}) — fora da árvore versionada, sem cifra por decisão declarada"
	info "credencial e cadeias de conexão em ${ARQ_AMBIENTE} (0600 ${DONO_ARQ_AMBIENTE}) — fora da árvore versionada"
	info "credencial do papel de migração em ${ARQ_AMBIENTE_MIGRACAO} (0600 ${DONO_ARQ_AMBIENTE}) — separada da anterior, consumida só por migrar-banco.sh"
	info "provisionamento concluído"
}

main() {
	printf '%s provisionamento dos serviços de base do backend Sysloc\n' "${PREFIXO}"

	verificar_precondicoes
	verificar_disco
	verificar_rede
	verificar_portas

	passo_p01_repositorio
	passo_p02_pacotes_banco
	passo_p03_configuracao_banco
	passo_p04_servico_banco
	passo_p05_diretorio_config
	passo_p06_arquivo_ambiente
	passo_p07_papel
	passo_p08_banco
	passo_p09_credencial_valida
	passo_p10_pacote_fila
	passo_p11_configuracao_fila
	passo_p12_servico_fila
	passo_p13_binario_capturador
	passo_p14_servico_capturador
	passo_p15_papel_migracao
	passo_p16_banco_preparado
	passo_p17_diretorio_dos_boletos

	resumir
}

main "$@"
