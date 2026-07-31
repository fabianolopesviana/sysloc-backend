# INTENT – Fundação da stack nativa instalada e provada

## 1. Identificação
- **Nome da Tarefa / Feature**: Fundação da stack nativa instalada e provada
- **Autor**: sysloc
- **Data**: 2026-07-31
- **Status**: Draft
- **Relacionados**:
  - `docs/specs/features/backend-nativo-sysloc/v1/pre-refinement.md` — discovery do programa; a §15.4 recomenda esta fatia em miniSpec e a tabela C2 justifica o peso
  - `docs/plano-backend-novo/plano-execucao.md` — §F0, entregas e critérios de aceitação; § Recorte em features, que mapeia esta fase a esta feature
  - `docs/specs/features/caracterizacao-regras-legadas/v1/` — fatia anterior, concluída; independente desta

---

## 2. Contexto & Motivação

**O problema hoje.** O repositório do backend novo está vazio de código. Existem os ativos de planejamento, a estrutura de diretórios e os artefatos da fatia de caracterização, mas nenhuma aplicação. Não há onde a primeira entidade de negócio nascer, nem forma de verificar automaticamente qualquer coisa que se escreva.

**Por que agora.** Esta é a fatia que destrava todas as outras. Nenhuma capacidade do produto — isolamento entre empresas, identidade de usuário, cadastro imobiliário, cobrança, integração bancária — pode ser construída antes que exista uma base instalada, funcionando e capaz de se recuperar sozinha. Enquanto ela não existir, o programa inteiro está parado.

**Custo de não fazer.** O sistema que atende a operação hoje permanece como única opção, com os defeitos que motivaram a decisão de substituí-lo: nenhuma autenticação real de usuário, nenhuma noção de empresa e estrutura de dados que só existe dentro do próprio ambiente, sem registro no repositório. Cada mês nessa situação é um mês em que não se pode atender uma segunda imobiliária.

**Por que esta fatia não contém regra de negócio.** Separar "a base existe e se sustenta" de "a base sabe algo sobre locação de imóveis" é deliberado. Misturar as duas coisas foi o que tornou a tentativa anterior difícil de verificar: quando um problema aparecia, não se sabia se era da fundação ou da regra. Aqui o critério é puramente operacional.

---

## 3. Objetivo

- Entregar uma **base de execução própria, instalada diretamente no sistema operacional**, que sobe sozinha, se recupera de queda sem intervenção humana e é capaz de hospedar tudo o que vier depois.
- Entregar a **capacidade de verificar automaticamente** o que for escrito daqui em diante, com a verificação rodando contra um banco de dados real e descartável — não contra substitutos.
- Entregar o **ciclo de trabalho do desenvolvedor**: um comando que levanta o ambiente completo e o mantém observável enquanto se trabalha.

Nenhuma regra de negócio, nenhuma estrutura de dados de domínio e nenhuma decisão sobre locação de imóveis entram nesta fatia.

---

## 4. Resultado Esperado

Ao final, um observador externo consegue verificar, sem conhecer o código:

1. **A base sobe do zero.** A partir do repositório limpo, uma sequência de comandos documentada deixa o ambiente instalado e construído, sem erro e sem passo manual não previsto.
2. **Os serviços respondem.** Existe um serviço de aplicação que responde a uma consulta de saúde, e existe um processador de trabalho em segundo plano que consome uma tarefa colocada numa fila e a conclui.
3. **A descrição do contrato da aplicação está publicada** e acessível — ainda vazia de operações de negócio, mas viva.
4. **A verificação automatizada roda e passa**, levantando um banco de dados real e descartável para isso.
5. **A base se recupera de queda.** Encerrar o processo do serviço de aplicação faz o sistema operacional trazê-lo de volta sozinho.
6. **A base sobrevive a um reinício completo do servidor.** Após reiniciar a máquina inteira, a base nova volta sozinha **e o sistema que atende a operação também volta sozinho** — nenhuma intervenção manual em nenhum dos dois. Esta é a prova central desta fatia, e será feita em janela de indisponibilidade combinada previamente.
7. **O trabalho enfileirado sobrevive a queda.** O que estiver aguardando processamento não desaparece quando o serviço que guarda a fila reinicia.
8. **A divergência de versão do banco de dados está apurada e registrada** — ver Restrições.

---

## 5. Restrições

**Decisões já tomadas, fora de negociação:**

- A composição da base — quais peças, em que versões — está fixada em `docs/plano-backend-novo/decisao-e-stack.md` §4 e **não se rediscute nesta fatia**.
- **Tudo é instalado nativamente no sistema operacional**, sem camada de conteinerização. Os serviços são gerenciados pelo próprio sistema operacional, com reinício automático.
- **Nada sobe manualmente.** Recuperação automática após queda e após reinício da máquina é requisito, não desejo.
- As 40 decisões de produto registradas em `.claude/plans/plano-saas-decisoes.md` continuam vinculantes, mesmo que nenhuma se aplique diretamente a esta fatia.
- O projeto opera em português brasileiro em todos os artefatos e interações.

**Restrições operacionais desta fatia:**

- **O servidor é compartilhado com o ambiente que atende a operação.** A nova base convive com ele até a virada, e **nada nesta fatia pode degradar ou interromper esse ambiente** — exceto a janela de indisponibilidade do reinício, que é combinada previamente e vale para os dois.
- **O reinício completo do servidor é critério de aceitação, não opcional.** Foi escolhido conscientemente sobre a alternativa de provar serviço a serviço, porque é a única prova da sequência real de arranque — que é justamente onde falhas de dependência entre serviços aparecem.
- **A verificação automatizada roda contra banco de dados real e descartável.** Se a versão disponível para esse uso divergir da versão que vai atender a operação, **a divergência é aceita**, mas **precisa estar apurada e registrada antes da primeira definição de estrutura de dados** — quem escrever a primeira migração tem de saber contra o que os testes rodam.
- **O espaço em disco é limitado** (o servidor opera acima de 75% de ocupação). A fatia não pode assumir espaço abundante, e o que ela instalar precisa caber ao lado do ambiente legado.
- O serviço que guarda a fila de trabalho **persiste em disco** — ele não guarda apenas dados descartáveis; perder seu conteúdo significa trabalho não executado.

**Fora do escopo desta fatia:**

- Qualquer estrutura de dados de domínio, qualquer regra de negócio, qualquer entidade de locação.
- Isolamento entre empresas e identidade de usuário — são a fatia seguinte, e nascem **antes** da primeira entidade de negócio.
- Qualquer alteração no ambiente que atende a operação hoje.
- Publicação externa da aplicação nova: nesta fatia ela existe e responde, mas não atende usuário final.

---

## 6. Checklist Final
- [x] INTENT descreve apenas O QUE / POR QUE
- [x] Objetivo claro e mensurável
- [x] Sem detalhes de implementação ou arquitetura
- [x] Resultado esperado específico
- [x] Restrições explícitas
- [x] Pronto para definição de SCOPE
