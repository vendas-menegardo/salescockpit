# Plano de implementação

## Checkpoint comercial implementado

- Paginação no servidor para Empresas e detalhe de Base.
- Dossiê com contatos e histórico.
- Fila comercial por base e visão.
- Registro atômico e idempotente de interação, estágio, retorno e cursor.
- Adaptador API4Com e webhook, com fallback manual.

O próximo passo operacional é aplicar e validar a migration primeiro em uma branch
isolada do Neon, executar QA com dois usuários e decidir expiração/liberação de
atribuições. Dashboard, Pesquisa e Relatórios devem usar os dados reais gerados por
essa operação.

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

## Segundo checkpoint implementado

- Dashboard real com período, base e usuário para ADMIN.
- Funil, pendências e indicadores de qualidade derivados do histórico.
- Relatórios com filtros, histórico, empresas e exportação CSV integral.
- Pesquisa paginada com filtros de cadastro e completude.
- Edição do dossiê com auditoria de campos e completude.
- Contrato de provedor e jobs persistentes preparados sem dados fictícios.

## Parcial

- Bases: CRUD e vínculos funcionam; detalhe agora é paginado.
- Empresas: busca, filtro, paginação, dossiê e edição auditada funcionam.
- Importação: fluxo funcional; os testes de integração exigem banco isolado.
- Operação: núcleo funcional; política administrativa de atribuição ainda pendente.
- Busca/enriquecimento: pesquisa local funcional; execução externa depende da escolha
  e configuração de um provedor.
- Configurações: rota protegida, sem opções persistentes.

## Próximo marco recomendado

Definir a política de liberação/redistribuição de empresas atribuídas e escolher um
provedor de enriquecimento com contrato, limites e credenciais aprovados.

## Decisões do proprietário

### Distribuição

- Opção A: fila fixa atribuída por ADMIN.
- Opção B: operador retira a próxima empresa disponível.
- Implementação atual: a primeira gravação atribui a empresa ao operador.
- Pendente: definir expiração, liberação e redistribuição administrativa.

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

1. Aplicar a migration progressiva em banco isolado.
2. Validar fila, contatos, histórico, retornos e concorrência com dois usuários.
3. Definir política administrativa de liberação e redistribuição.
4. Alimentar Dashboard com consultas reais.
5. Alimentar Relatórios com agregações reais e filtros.
6. Completar Pesquisa e vínculo autorizado a bases.
7. Separar preferências pessoais de configurações administrativas.

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
