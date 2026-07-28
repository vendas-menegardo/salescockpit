# Mapa do produto

## Estado auditado

| Módulo | Rota | Estado encontrado | Estado desta entrega |
| --- | --- | --- | --- |
| Login | `/login` | Ausente | Implementado com e-mail, senha, sessão e mensagem segura |
| Dashboard | `/` | Placeholder | Protegido; métricas continuam pendentes do modelo operacional |
| Operação | `/operacao` | Placeholder | Protegido; regras comerciais aguardam decisão |
| Bases | `/bases` | Funcional, mas público | Leitura autenticada; mutações e telas de edição restritas a ADMIN |
| Empresas | `/empresas` | Parcial | Leitura autenticada; busca e filtro funcionam, paginação e detalhes pendentes |
| Pesquisa | `/pesquisa` | Placeholder | Protegido; implementação pendente |
| Importação | `/importacao` | Funcional e retomável | Preservado e restrito a ADMIN no servidor |
| Relatórios | `/relatorios` | Placeholder | Protegido; depende de dados reais da Operação |
| Usuários | `/usuarios` | Placeholder | Implementado e restrito a ADMIN |
| Configurações | `/configuracoes` | Placeholder | Protegido; preferências e opções globais ainda não definidas |

Existe também `/busca`, uma rota placeholder duplicada e fora do mapa oficial. Ela foi
mantida para não remover uma possível URL já utilizada; deve ser redirecionada ou
eliminada em uma decisão posterior.

## Perfis

### ADMIN

- Acessa todos os módulos.
- Cria e edita usuários, define ADMIN ou USER e ativa/desativa contas.
- Cria, edita, ativa e exclui bases.
- Executa importações.
- Não pode desativar nem rebaixar a própria conta.
- Não pode desativar ou rebaixar o último administrador ativo.

### USER

- Acessa as rotas internas após login.
- Consulta Bases e Empresas.
- Não visualiza Importação ou Usuários na navegação.
- Não acessa as páginas administrativas nem executa suas Server Actions diretamente.
- Operação, Pesquisa, Relatórios e preferências pessoais ainda dependem das próximas fases.

## Integrações atuais

- PostgreSQL no Neon via Prisma.
- Better Auth com sessões persistidas no PostgreSQL.
- CSV processado no servidor em jobs retomáveis e lotes.
- Next.js App Router com Server Components e Server Actions.
- Vercel identificada como plataforma de produção pelo histórico operacional, sem
  configuração alterada nesta entrega.

## Fluxos funcionais

### Bases

O ADMIN cria e administra bases. ADMIN e USER podem consultar bases e suas empresas.
Uma empresa pode pertencer a várias bases por `BaseCompany`; o vínculo duplicado é
impedido pela chave composta.

### Empresas

O cadastro é centralizado por `Company`. A consulta suporta nome, nome fantasia, CNPJ
e filtro por base, mas retorna no máximo 100 registros e ainda não oferece detalhe ou
paginação real.

### Importação

O ADMIN analisa o CSV, confirma a prévia, prepara linhas persistidas e processa lotes.
O job é retomado por identidade de arquivo/base e usa restrições únicas como garantia
final de deduplicação. O limite continua em 10 MB.

### Usuários

Um ADMIN cria a conta com senha inicial, altera nome/perfil e ativa ou desativa acesso.
Desativar uma conta remove suas sessões na mesma transação.

## Dependências do núcleo operacional

Não foram encontradas no schema, no código, nas migrations ou no histórico definições
confiáveis para resultado de contato, distribuição de empresas, conclusão, retorno ou
conflito entre operadores. Dashboard e Relatórios não devem apresentar métricas até
essas regras e seus modelos persistentes existirem.
