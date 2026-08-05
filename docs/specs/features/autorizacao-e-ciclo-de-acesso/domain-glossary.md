# Glossário de Domínio — autorizacao-e-ciclo-de-acesso

> Termos específicos desta feature. Os termos canônicos do projeto vivem em `/docs/specs/domain-glossary.md` — leia os dois; em conflito, este sobrescreve.
>
> Compartilhado entre versões da feature (sem `{version}` no caminho).

## Termos

**Área de tela "Usuários"**:
A área que governa a administração das pessoas de uma empresa — criar, ajustar o que cada uma alcança, trocar de perfil, desativar e reativar. **Alcança todas as pessoas da empresa, de qualquer perfil**, inclusive as de perfil **Admin Empresa**.
_Evitar_: gestão de usuários comuns, administração de operadores, tela de colaboradores

**Intenção declarada**:
Confirmação explícita, no próprio pedido, de que quem administra aceita perder ajustes individuais ao trocar o perfil de uma pessoa. Sem ela a operação é recusada, e a recusa informa quantos ajustes se perderiam.
_Evitar_: forçar, confirmar, sobrescrever, flag de confirmação

## Relacionamentos

- A **Área de tela "Usuários"** é uma das dez áreas do catálogo global e autoriza as rotas de ciclo de vida das pessoas.
- Trocar o perfil de uma pessoa que tem **Ajustes individuais** exige **Intenção declarada**.

## Ambiguidades resolvidas

- **"Usuários" (a área de tela) × "Usuário Empresa" (o perfil)** eram lidos como o mesmo recorte, sugerindo que a área administrasse apenas as pessoas sem poderes administrativos. Resolvido: são conceitos distintos — a **área** alcança **todas** as pessoas da empresa; o **perfil** é um dos três que uma pessoa pode ter. O glossário global já resolvera a ambiguidade do termo "usuário" em prosa; esta entrada resolve o alcance da **área** e das rotas que ela autoriza, que entram na superfície congelada da API.
