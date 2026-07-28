# Plano de implementação

## Concluído nesta entrega

- Auditoria de rotas, navegação, componentes, ações, serviços, schema e migrations.
- Login, logout e sessão persistente.
- Proteção de todas as rotas internas.
- Autorização ADMIN nas páginas e ações administrativas.
- Sidebar por perfil e navegação mobile.
- Gestão administrativa de usuários.
- Bloqueio de autodesativação e do último ADMIN ativo.
- Encerramento de sessões de contas desativadas.
- Estados globais de carregamento e erro.
- Documentação e exemplo de ambiente sem segredos.

## Parcial

- Bases: CRUD e vínculos funcionam; detalhe ainda carrega todos os vínculos.
- Empresas: busca e filtro funcionam; falta paginação, detalhe e ações autorizadas.
- Importação: fluxo funcional; os testes de integração exigem banco isolado.
- Dashboard: autenticado, mas sem indicadores por falta de modelo operacional.
- Configurações: rota protegida, sem opções persistentes.

## Próximo marco recomendado

Definir e implementar o modelo mínimo da Operação. Ele deve ser o próximo marco
porque é a fonte de verdade necessária para Dashboard, retornos e Relatórios.

Proposta técnica inicial, ainda sujeita à aprovação das regras:

1. `OperationAssignment`: empresa/base, responsável, estado da atribuição e lock
   otimista para evitar trabalho simultâneo.
2. `OperationActivity`: autor, instante, tipo de contato, resultado e observação.
3. `OperationFollowUp`: responsável, data/hora, estado e vínculo com atividade.
4. Histórico imutável de eventos importantes.

## Decisões do proprietário

### Distribuição

- Opção A: fila fixa atribuída por ADMIN.
- Opção B: operador retira a próxima empresa disponível.
- Recomendação: começar por fila atribuída, por ser auditável e previsível.

### Resultados comerciais

- Definir a lista oficial de resultados e quais encerram uma empresa.
- Não usar livre texto como única fonte porque inviabiliza relatórios consistentes.

### Base ativa

- Decidir se existe uma base ativa global, por usuário ou apenas um filtro de trabalho.
- O campo atual `Base.isActive` é global e permite somente uma base ativa pelo serviço.

### Reabertura e retorno

- Definir quem pode reabrir uma empresa concluída.
- Definir atraso tolerado, fuso e regra de redistribuição de retornos.

## Microetapas verificáveis

1. Aprovar estados, resultados, distribuição e política de conflito.
2. Criar migration progressiva em banco isolado.
3. Implementar repositório e políticas de atribuição com testes de concorrência.
4. Entregar fila paginada e seleção de base.
5. Entregar detalhe da empresa e registro de atividade.
6. Entregar próximo passo/retorno e histórico.
7. Alimentar Dashboard com consultas reais.
8. Alimentar Relatórios com agregações reais e filtros.
9. Completar Pesquisa e vínculo autorizado a bases.
10. Separar preferências pessoais de configurações administrativas.

## Dependências operacionais

- Branch isolada do Neon com as seis migrations aplicadas em ordem.
- Variáveis `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`.
- Primeiro administrador criado após a migration de autenticação.
- Bootstrap disponível por `npm run create-admin`, restrito à branch isolada e sem
  credenciais em argumentos.
- Revisão separada das vulnerabilidades indicadas por `npm audit`. Na auditoria de
  2026-07-28 foram reportadas 6 altas e 2 moderadas em cadeias de Next, Prisma,
  PostCSS, Sharp e MCP/Hono. A correção automática sugerida para Next é incompatível
  com a versão do projeto e não deve ser aplicada sem uma atualização planejada.
