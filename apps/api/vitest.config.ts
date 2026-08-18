/**
 * Configuração de teste do serviço de aplicação.
 *
 * Este arquivo é o projeto que a configuração da raiz (`vitest.config.ts`, de T4) agrega pelo
 * padrão `apps/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/api test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui. A verificação sobe instâncias efêmeras
 * próprias de banco e de fila (`packages/shared/test/`) e monta o ambiente do processo a partir
 * do que os helpers devolvem — uma leitura de configuração de conexão neste arquivo bastaria
 * para a suíte alcançar, em silêncio, o ambiente que atende a operação.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * O diretório dos boletos da verificação — descartável, criado **na configuração**, fora da árvore.
 *
 * Ele não pode ser um literal como as outras variáveis semeadas abaixo: a partida exige o caminho
 * **presente, absoluto e gravável**, e um valor inerte no molde de `.invalid` faria toda aplicação
 * real da suíte recusar subir. O diretório é criado uma vez por execução, dentro do diretório
 * temporário do sistema operacional, e leva embora o que os casos gravarem quando a máquina o
 * expurgar — nada é escrito na árvore de trabalho, que é o que
 * `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh` mede pelo outro lado.
 *
 * Isso **não** enfraquece a barreira de partida: quem prova que a variável é obrigatória, e que
 * caminho relativo ou diretório inexistente são recusados nomeando a variável, é `test/ambiente.spec.ts`
 * — que chama a validação com a fonte de variáveis por PARÂMETRO. E não fere a ADR-0006: nada é lido
 * do ambiente, e o valor é fixado pela própria configuração.
 */
const DIRETORIO_DOS_BOLETOS_DA_VERIFICACAO = mkdtempSync(join(tmpdir(), 'sysloc-boletos-api-'));

export default defineConfig({
  // O transformador do arcabouço deduz as opções de TypeScript do `tsconfig.json` que ALCANÇA
  // cada arquivo, e o deste pacote alcança apenas `src/` — é ele que emite o serviço, e alargá-lo
  // faria `dist/` levar junto o código de teste. A consequência é que um decorador escrito dentro
  // de `test/` (o controlador-fixture que provoca a exceção não prevista do CT-006) chegaria ao
  // runtime sem transformação, e o processo falharia com erro de sintaxe. Declarar aqui a forma de
  // decorador que o projeto usa resolve para os arquivos de verificação sem tocar no que é emitido.
  oxc: { decorator: { legacy: true } },
  test: {
    name: '@sysloc/api',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Os casos de rota sobem instância real de banco e de fila; o teto padrão de 5 s do arcabouço
    // reprovaria a subida antes de ela terminar. O teto de CASO fica no padrão de propósito: cada
    // caso que sobe instância declara o próprio limite, e afrouxá-lo aqui só alargaria o teto dos
    // casos que não precisam dele.
    hookTimeout: 90_000,
    // Descartar as instâncias efêmeras é trabalho de encerramento: teto curto abortaria o descarte
    // no meio e deixaria exatamente o resíduo que a CA-7 proíbe.
    teardownTimeout: 60_000,
    // -----------------------------------------------------------------------------------------
    // Segredo de assinatura de sessão e COORDENADAS INERTES DO TRANSPORTE (T8, T10)
    // -----------------------------------------------------------------------------------------
    //
    // A partir da T8 a validação de partida exige `BETTER_AUTH_SECRET`, e todo caso que sobe a
    // aplicação real passa por ela. Ele é declarado AQUI, e não em cada arquivo de verificação, por
    // uma razão de disciplina: `test/saude.e2e.spec.ts` é a prova das rotas de saúde e da ADR-0007
    // e não tem nada a ver com identidade — acrescentar a variável ao arranjo dele seria editar,
    // por causa desta task, um arquivo que a task declara intocável.
    //
    // O valor é literal e ostensivamente inútil: ele assina sessões que morrem com a instância
    // efêmera do caso. Isto NÃO enfraquece a exigência — quem prova que a variável é obrigatória é
    // `test/ambiente.spec.ts`, que chama a validação com a fonte de variáveis por PARÂMETRO e
    // demonstra a falha por ausência e por valor curto demais, sem depender do ambiente do
    // processo. E não fere a ADR-0006: nada aqui é coordenada de conexão, e nada é lido do
    // ambiente — o valor é fixado, não herdado.
    //
    // `SMTP_URL` e `EMAIL_REMETENTE` entram na **T10** pela MESMA razão, palavra por palavra: a
    // partir dela o disparo manual envia de dentro deste processo, a validação de partida exige as
    // duas, e **todo** caso que sobe a aplicação real passa por ela — inclusive `saude.e2e.spec.ts`,
    // que não tem nada a ver com envio de aviso. Declará-las aqui é o que evita editar vinte
    // arquivos de verificação por causa desta task, e é o precedente que a T8 abriu.
    //
    // ⚠️ **Os dois valores são deliberadamente INERTES, e a escolha é conteúdo.** A porta `1` é
    // reservada e recusa a conexão de imediato, e `.invalid` é o domínio que a RFC 6761 garante não
    // resolver: uma mensagem que escapasse por aqui não teria para onde ir. Eles NÃO enfraquecem a
    // barreira da CA-17 — quem a sustenta é a substituição do provedor por `overrideProvider` e a
    // varredura do `CT-626`, que afirma por igualdade que arquivo de teste nenhum nomeia o adaptador
    // de produção. E não ferem a ADR-0006 pela mesma razão do segredo acima: nada é lido do
    // ambiente, e o destino é impossível por construção. Quem prova que as duas são **obrigatórias**
    // é `test/ambiente.spec.ts` (CT-639), que chama a validação com a fonte por PARÂMETRO.
    //
    // `URL_BASE_DA_CONFIRMACAO` entra na **T9** da fatia `documentos-e-confirmacao` pela MESMA
    // razão, e o precedente vale palavra por palavra: a partida passa a exigi-la, e **todo** caso
    // que sobe a aplicação real passa pela validação — inclusive `saude.e2e.spec.ts`, que não tem
    // nada a ver com confirmação de e-mail. Declará-la aqui é o que evita editar vinte arquivos de
    // verificação por causa desta task.
    //
    // O valor é INERTE pelo mesmo critério: `.invalid` é o domínio que a RFC 6761 garante não
    // resolver, de modo que um link composto sobre ele não leva a lugar nenhum. Ele **não**
    // enfraquece a exigência — quem prova que a variável é obrigatória é `test/ambiente.spec.ts`,
    // que chama a validação com a fonte por PARÂMETRO e demonstra a recusa por ausência e por
    // cadeia em branco. E não fere a ADR-0006: nada é lido do ambiente, e o valor é fixado.
    //
    // `CHAVE_DE_CIFRA_DO_CERTIFICADO` e `ENDERECO_DO_PROVEDOR_BANCARIO` entram na **T11** da fatia
    // `fundacao-bancaria` pela MESMA razão, e o precedente das três acima vale palavra por palavra:
    // a partida passa a exigir as duas, e **todo** caso que sobe a aplicação real passa pela
    // validação — inclusive `saude.e2e.spec.ts`, que não tem nada a ver com certificado de provedor.
    // Declará-las aqui é o que evita editar vinte e oito arquivos de verificação por causa desta
    // task.
    //
    // Os dois valores são INERTES pelo mesmo critério das anteriores, e cada um por uma razão
    // própria. A chave decodifica exatamente para o texto `chave-de-verificacao-sem-valor!!` — 32
    // bytes, o comprimento que o AES-256-GCM exige, escolhido para ser **legível** ao ser
    // decodificado: ela não protege segredo nenhum, porque cifra e decifra o material que a
    // instância efêmera do caso leva embora. O endereço aponta para `.invalid`, o domínio que a RFC
    // 6761 garante não resolver, de modo que uma verificação que escapasse por aqui não teria com
    // quem apertar a mão.
    //
    // Eles **não** enfraquecem as barreiras: quem prova que as duas são obrigatórias é
    // `test/ambiente.spec.ts` (CT-851 a CT-853), que chama a validação com a fonte por PARÂMETRO e
    // demonstra a recusa por ausência, por cadeia em branco e por chave de comprimento inaceitável.
    // E não ferem a ADR-0006 pela razão de sempre: nada é lido do ambiente, e os valores são
    // fixados.
    env: {
      BETTER_AUTH_SECRET: 'segredo-de-verificacao-sem-valor-operacional',
      SMTP_URL: 'smtp://127.0.0.1:1',
      EMAIL_REMETENTE: 'avisos@exemplo.invalid',
      URL_BASE_DA_CONFIRMACAO: 'https://app.exemplo.invalid',
      CHAVE_DE_CIFRA_DO_CERTIFICADO: 'Y2hhdmUtZGUtdmVyaWZpY2FjYW8tc2VtLXZhbG9yISE=',
      ENDERECO_DO_PROVEDOR_BANCARIO: 'https://provedor.exemplo.invalid',
      // `DIRETORIO_DOS_BOLETOS` entra na **T13** da fatia `emissao-e-conciliacao` pela MESMA razão das
      // seis acima, e o precedente vale palavra por palavra: a partida passa a exigi-la, e **todo**
      // caso que sobe a aplicação real passa pela validação — inclusive `saude.e2e.spec.ts`, que não
      // tem nada a ver com boleto. Declará-la aqui é o que evita editar trinta e dois arquivos de
      // verificação por causa desta task.
      //
      // ⚠️ **O valor NÃO pode ser inerte como os demais**, e a razão está no docblock de
      // {@link DIRETORIO_DOS_BOLETOS_DA_VERIFICACAO}: a conferência de partida toca o disco, de modo
      // que um `.invalid` derrubaria a montagem de toda aplicação real. O que o substitui é um
      // diretório **descartável**, fora da árvore versionada.
      DIRETORIO_DOS_BOLETOS: DIRETORIO_DOS_BOLETOS_DA_VERIFICACAO,
    },
  },
});
