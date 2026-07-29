# Mapa do produto

## Evolução comercial atual

- **Empresas**: busca e filtro com paginação no servidor; dossiê individual com
  vínculos, contatos e histórico comercial.
- **Operação**: fila por base e visão, com registro de resultado, estágio,
  observação, retorno e avanço.
- **Contatos**: múltiplos registros por empresa, com tipo, origem, validade,
  responsável e indicação de principal.
- **Telefonia**: API4Com opcional no servidor; sem configuração, copiar telefone e
  registro manual continuam disponíveis.

O salvamento da operação confirma interação, estágio, retorno e cursor na mesma
transação. Uma chave idempotente impede repetição da mesma ação, e a atualização
otimista rejeita uma gravação baseada em estágio ou atribuição desatualizados.

As visões disponíveis são não trabalhadas, em tentativa, retornos do dia, atrasadas,
qualificadas, reuniões e congeladas. WhatsApp, e-mail e demais canais estão
modelados para evolução futura, mas somente a ligação está preparada nesta etapa.

## Estado auditado

| Módulo | Rota | Estado encontrado | Estado desta entrega |
| --- | --- | --- | --- |
| Login | `/login` | Ausente | Implementado com e-mail, senha, sessão e mensagem segura |
| Dashboard | `/` | Placeholder | Indicadores reais por período, usuário e base, com funil e pendências |
| Operação | `/operacao` | Placeholder | Fila, interação, estágio, retorno e histórico implementados |
| Bases | `/bases` | Funcional, mas público | Leitura autenticada; mutações e telas de edição restritas a ADMIN |
| Empresas | `/empresas` | Parcial | Busca, filtro, paginação e dossiê implementados |
| Pesquisa | `/pesquisa` | Placeholder | Pesquisa paginada, filtros de completude e estrutura de enriquecimento |
| Importação | `/importacao` | Funcional e retomável | Preservado e restrito a ADMIN no servidor |
| Relatórios | `/relatorios` | Placeholder | Filtros históricos, operação, funil, empresas e exportação CSV |
| Usuários | `/usuarios` | Placeholder | Implementado e restrito a ADMIN |
| Configurações | `/configuracoes` | Placeholder | Protegido; preferências e opções globais ainda não definidas |

Existe também `/busca`, mantida por compatibilidade e redirecionada para a rota oficial
`/pesquisa`.

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
- Pesquisa e Relatórios respeitam o escopo do usuário no servidor. Preferências
  pessoais ainda dependem de definição.

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

O cadastro é centralizado por `Company`. A consulta suporta nome, nome fantasia,
CNPJ e filtro por base, com paginação no servidor e dossiê individual.

### Operação

O usuário seleciona uma base ativa e uma visão da fila. Cada atendimento registra
resultado, transição de estágio, observação e retorno opcional, preservando o
histórico por empresa, base e operador.

### Importação

O ADMIN analisa o CSV, confirma a prévia, prepara linhas persistidas e processa lotes.
O job é retomado por identidade de arquivo/base e usa restrições únicas como garantia
final de deduplicação. O limite continua em 10 MB.

### Usuários

Um ADMIN cria a conta com senha inicial, altera nome/perfil e ativa ou desativa acesso.
Desativar uma conta remove suas sessões na mesma transação.

## Métricas, relatórios e pesquisa

Dashboard e Relatórios usam `SalesInteraction`, `FollowUpTask`, `BaseCompany`,
`CompanyContact` e `CompanyDataChange` como fonte única. Empresas trabalhadas são
contadas por CNPJ/empresa distinta, sem transformar várias tentativas em várias
empresas.

A Pesquisa consulta somente a página necessária no PostgreSQL. O adapter de
enriquecimento e os jobs persistentes estão preparados, mas permanecem inativos
enquanto não houver provedor real configurado. Nenhuma informação externa é simulada.
