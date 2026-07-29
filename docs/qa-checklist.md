# Checklist de QA

## Operação comercial

- [ ] Paginar Empresas mantendo busca e filtro por base.
- [ ] Abrir dossiê e cadastrar, validar, invalidar e priorizar contato.
- [ ] Registrar resultado e estágio e confirmar histórico após recarregar.
- [ ] Agendar retorno e conferir as visões do dia e atrasados.
- [ ] Reenviar a mesma ação e confirmar que não duplica interação.
- [ ] Tentar atualização concorrente com dois usuários e confirmar rejeição segura.
- [ ] Confirmar fallback manual quando API4Com não estiver configurada.
- [ ] Validar webhook com segredo correto, incorreto e evento repetido.

## Dashboard, Relatórios e Pesquisa

- [ ] Comparar tentativas e empresas únicas com o mesmo filtro no histórico.
- [ ] Confirmar que USER não consulta nem exporta dados de outro usuário.
- [ ] Alternar período, base, usuário, etapa, resultado e canal.
- [ ] Exportar CSV e conferir todas as linhas filtradas, não apenas a página visível.
- [ ] Abrir CSV com acentos e CNPJ preservados como texto.
- [ ] Pesquisar por CNPJ, razão social, cidade, UF, segmento e completude.
- [ ] Confirmar que nenhum job é criado sem provedor configurado.
- [ ] Editar o dossiê e conferir auditoria e completude antes/depois.

## Segurança e ambiente

- [ ] Confirmar que o banco alvo não é o endpoint de produção antes de qualquer escrita.
- [ ] Confirmar que `.env`, URLs, tokens e senhas não estão no diff.
- [ ] Aplicar migrations somente em branch isolada e na ordem documentada.
- [ ] Confirmar `BETTER_AUTH_SECRET` forte e diferente por ambiente.
- [ ] Confirmar `BETTER_AUTH_URL` igual à origem do ambiente.
- [ ] Confirmar que `npm run create-admin` bloqueia qualquer host diferente da branch
  isolada autorizada.
- [ ] Confirmar que o bootstrap recusa uma segunda conta quando já existe ADMIN ativo.
- [ ] Confirmar que o bootstrap não aceita credenciais por argumentos.
- [ ] Confirmar que a senha não é exibida nem registrada.

## Login e sessão

- [ ] Login válido redireciona ao Dashboard.
- [ ] Login inválido retorna mensagem genérica.
- [ ] Conta inativa não cria sessão.
- [ ] Rota interna sem cookie redireciona para `/login`.
- [ ] Cookie inválido ou expirado é rejeitado pelo layout no servidor.
- [ ] Logout remove a sessão e redireciona para `/login`.
- [ ] Usuário autenticado que abre `/login` retorna ao Dashboard.

## ADMIN

- [ ] Visualiza Importação e Usuários na sidebar.
- [ ] Cria USER e ADMIN com senha válida.
- [ ] E-mail duplicado é rejeitado sem detalhes internos.
- [ ] Edita o nome de outro usuário.
- [ ] Ativa e desativa outro usuário.
- [ ] Sessões da conta desativada deixam de funcionar.
- [ ] Não desativa nem rebaixa a própria conta.
- [ ] Não desativa ou rebaixa o último ADMIN ativo.
- [ ] Duas alterações concorrentes não removem todos os ADMINs.

## USER

- [ ] Não visualiza Importação ou Usuários.
- [ ] URL `/usuarios` é rejeitada no servidor.
- [ ] URL `/importacao` é rejeitada no servidor.
- [ ] Chamada direta às Server Actions administrativas é rejeitada.
- [ ] Consulta Bases e Empresas.
- [ ] Não visualiza ações de criar, editar, ativar ou excluir Base.

## Regressão

- [ ] Criar, editar, ativar e excluir Base como ADMIN.
- [ ] Confirmar exclusão de Base no diálogo.
- [ ] Consultar empresas de uma Base.
- [ ] Buscar empresa por CNPJ e nome.
- [ ] Importar CSV válido menor ou igual a 10 MB.
- [ ] Retomar importação interrompida.
- [ ] Reimportar o mesmo arquivo sem duplicar empresa ou vínculo.
- [ ] Associar a mesma empresa a bases diferentes.
- [ ] Conferir `Base.companiesCount` após importação.

## Interface

- [ ] Navegar por teclado e verificar foco visível.
- [ ] Conferir labels de login e formulários de usuário.
- [ ] Conferir estados disabled e loading.
- [ ] Conferir estados vazio e erro.
- [ ] Testar 375 px, tablet e desktop.
- [ ] Verificar ausência de avisos do Base UI no console.

## Qualidade antes da publicação

- [ ] `npx prisma format`
- [ ] `npx prisma validate`
- [ ] `npx prisma generate`
- [ ] `npx next typegen`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] Revisar `npm audit` e aceitar ou corrigir cada risco conscientemente.
