/**
 * Varredura de fonte — o acessório comum das asserções ESTÁTICAS desta suíte.
 *
 * ===========================================================================
 * Por que um acessório, e não duas cópias
 * ===========================================================================
 *
 * Duas asserções estáticas diferentes precisam do mesmo par de operações — listar fonte e ler linha
 * com os comentários fora: o CT-005 (`isolamento.spec.ts`), que procura ramo por perfil Master no
 * caminho do dado, e o CT-014 (`unidade-de-trabalho.spec.ts`), que audita quem chama o escritor do
 * contexto de tenant. Uma terceira cópia do mesmo caminhamento seria a fixture duplicada que o Gate
 * 1 já anotou (BAIXO-002), agravada: cópias de um varredor divergem em silêncio, e um varredor que
 * divergiu passa a provar coisa diferente da que o caso afirma provar.
 *
 * ===========================================================================
 * Duas decisões deliberadas
 * ===========================================================================
 *
 * **Diretório ausente é ERRO.** A versão anterior deste caminhamento engolia `readdir` que falhava
 * (`.catch(() => [])`), de modo que um alvo renomeado reduzia a cobertura a zero **sem alarme** —
 * e o caso seguia verde provando nada. Aqui o erro sobe. Quem quiser auditar um alvo que pode não
 * existir escolhe o alvo dinamicamente (é o que o CT-014 faz, listando os pacotes do workspace),
 * em vez de silenciar a ausência.
 *
 * **Comentários saem antes da comparação.** Sem isso, a prosa que explica por que o defeito não
 * existe faz a asserção reprovar o código correto — o defeito literal registrado em
 * `.claude/rules/testing-stack.md` ("asserção que casava `ALTER ROLE` em comentário e mensagem de
 * erro"). A substituição preserva as quebras de linha, para que o número relatado continue
 * apontando para o ponto certo do arquivo.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface VarreduraDeFontes {
  /** Quantos arquivos foram efetivamente lidos. Zero nunca é escondido: é afirmável. */
  readonly arquivos: number;
  /** `<caminho>:<linha>` de cada linha que casou, na ordem de leitura. */
  readonly ocorrencias: string[];
  /** O texto de cada linha que casou, sem comentários — na mesma ordem de `ocorrencias`. */
  readonly linhas: string[];
}

/**
 * Lista recursivamente os `.ts` de um diretório.
 *
 * Não engole ausência: diretório inexistente levanta, e é o que impede a cobertura de cair a zero
 * em silêncio quando um alvo é renomeado ou movido.
 */
export async function listarFontesTs(diretorio: string): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });

  const caminhos: string[] = [];
  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      caminhos.push(...(await listarFontesTs(caminho)));
    } else if (entrada.name.endsWith('.ts')) {
      caminhos.push(caminho);
    }
  }
  return caminhos.sort();
}

/** O fonte com comentários de linha e de bloco substituídos por espaço, preservando as quebras. */
export function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

/**
 * Lê cada arquivo da lista e coleta as linhas que o predicado aceita.
 *
 * Recebe **arquivos**, e não diretórios, de propósito: o alvo de uma asserção estática precisa ser
 * declarado e verificável, e um arquivo que sumiu faz `readFile` levantar — que é o alarme que o
 * caminhamento tolerante não dava.
 */
export async function varrerArquivos(
  arquivos: readonly string[],
  casa: (linha: string) => boolean,
): Promise<VarreduraDeFontes> {
  const ocorrencias: string[] = [];
  const linhasCasadas: string[] = [];

  for (const caminho of arquivos) {
    const conteudo = semComentarios(await readFile(caminho, 'utf8'));
    conteudo.split('\n').forEach((linha, indice) => {
      if (casa(linha)) {
        ocorrencias.push(`${caminho}:${indice + 1}`);
        linhasCasadas.push(linha.trim());
      }
    });
  }

  return { arquivos: arquivos.length, ocorrencias, linhas: linhasCasadas };
}
