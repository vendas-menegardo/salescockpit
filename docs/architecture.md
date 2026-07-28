# Arquitetura

## Aplicação

O SalesCockpit usa Next.js 16 App Router, React 19, TypeScript, Prisma 6 e PostgreSQL.
Páginas de leitura usam Server Components; mutações usam Server Actions. O layout
interno é o limite principal de autenticação e torna as rotas do dashboard dinâmicas.

## Autenticação

Foi adotado Better Auth 1.6 com adaptador Prisma porque oferece integração mantida
para Next.js, hash de senha, sessões persistentes e extensão administrativa sem
criptografia própria.

- Login por e-mail e senha.
- Cadastro público desativado.
- Senha mínima de 12 caracteres.
- Sessão com duração de 8 horas e renovação a cada hora.
- Cookies definidos pela integração oficial com Next.js.
- Sessão consultada no servidor antes de carregar dados internos.
- Contas inativas têm as sessões removidas e não podem criar nova sessão.
- Telemetria da biblioteca desativada.

`src/proxy.ts` faz apenas o redirecionamento otimista quando o cookie não existe. Ele
não é a fronteira de segurança. O layout, as páginas administrativas e cada Server
Action sensível validam a sessão novamente.

## Autorização

Os perfis persistidos são `admin` e `user`, apresentados na interface como ADMIN e
USER. A sidebar é adaptada ao perfil, mas a segurança não depende dela:

- `requireSession()` protege todas as rotas internas.
- `requireAdmin()` protege Usuários, Importação, edição/criação de Bases e todas as
  ações correspondentes.
- Leitura de Bases e Empresas está disponível aos dois perfis.
- Endpoints administrativos do Better Auth capazes de alterar perfil, bloqueio,
  senha ou remoção foram desabilitados. A criação de usuário permanece disponível
  somente para uma sessão administrativa.

Alterações de perfil e estado usam uma transação Prisma e
`pg_advisory_xact_lock(8492713)`. O lock serializa decisões sobre administradores e
evita que duas requisições concorrentes removam, ao mesmo tempo, os últimos acessos
administrativos. Ao desativar uma conta, suas sessões são excluídas atomicamente.

## Banco

### Modelos existentes

- `Base`: conjunto comercial e contador materializado de empresas.
- `Company`: cadastro central, com CNPJ único quando informado.
- `BaseCompany`: associação muitos-para-muitos, status por base e chave composta.
- `ImportJob`: progresso e contadores da importação retomável.
- `ImportJobRow`: linhas elegíveis persistidas e marca de processamento.

### Modelos adicionados

- `User`: identidade, e-mail único, perfil e estado da conta.
- `Session`: token único, expiração e metadados de sessão.
- `Account`: credencial com senha armazenada pelo Better Auth como hash.
- `Verification`: estrutura padrão para futuros fluxos de verificação.

A migration `20260728142922_add_authentication_and_users` é progressiva: cria apenas
novas tabelas, índices e FKs com cascata para dados de autenticação. Ela não altera
Base, Company, BaseCompany, ImportJob ou ImportJobRow.

## Importação

A importação existente permanece dividida em preparação e processamento:

1. valida e deduplica o CSV;
2. persiste linhas em lotes;
3. processa cada lote em transação curta;
4. busca e cria empresas em lote;
5. cria vínculos por `BaseCompany`;
6. atualiza contadores somente no commit do lote;
7. retoma pelo job persistido.

Esta entrega adiciona autorização administrativa antes de cada ponto de entrada,
sem modificar deduplicação, tamanho de lote ou migration existente.

Jobs de importação não possuem proprietário no modelo atual. Eles são compartilhados
entre administradores autorizados da mesma aplicação; usuários USER não acessam o
fluxo. Associar jobs a um administrador exigiria uma migration progressiva e uma
regra de transferência ainda não definida.

## Segurança operacional

- Nenhum segredo é versionado; `.env.example` contém somente placeholders.
- O host conhecido de produção não deve ser usado para migrations, seeds ou testes
  de escrita.
- A migration nova deve ser testada primeiro em uma branch isolada do Neon.
- A aplicação não pode ser publicada antes da migration e da criação segura do
  primeiro administrador, pois as rotas internas passam a exigir as novas tabelas.

## Bootstrap do primeiro administrador

`npm run create-admin` é o único procedimento documentado para a conta inicial. O
script carrega `.env`, aceita somente a branch Neon isolada autorizada, bloqueia os
hosts direto e pooled de produção e não recebe credenciais por argumentos.

Antes da escrita, ele verifica a ausência de ADMIN ativo. A decisão é repetida dentro
de uma seção serializada por advisory lock para impedir dois bootstraps concorrentes.
A criação usa a API server-side `auth.api.createUser` do Better Auth sobre o mesmo
`TransactionClient` que mantém o lock. Assim, `User` e `Account` são confirmados ou
revertidos juntos. O Better Auth gera o hash e a conta de credencial; a senha é
coletada sem eco e nunca é registrada.
