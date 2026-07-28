# SalesCockpit

Aplicação interna para organizar bases, empresas, importações e a futura operação
comercial da Menegardo.

## Stack

- Next.js 16 e React 19
- TypeScript
- Prisma 6
- PostgreSQL
- Better Auth
- Tailwind CSS e Base UI

## Ambiente local

1. Instale as dependências com `npm install`.
2. Crie um `.env` local a partir dos nomes documentados em `.env.example`.
3. Use exclusivamente um banco isolado de desenvolvimento.
4. Aplique as migrations no banco isolado conforme o procedimento aprovado.
5. Crie o primeiro administrador.
6. Inicie a aplicação:

```powershell
npm run dev -- -p 3001
```

Acesse [http://localhost:3001](http://localhost:3001).

## Primeiro administrador

Depois de aplicar a migration de autenticação na branch isolada autorizada, configure
as variáveis locais e execute o comando do projeto:

```powershell
npm run create-admin
```

Nome, e-mail e senha são solicitados interativamente; a senha não aparece no terminal.
O comando aceita somente o host isolado
`ep-soft-sky-ac9ou8si-pooler.sa-east-1.aws.neon.tech`, bloqueia explicitamente
produção e recusa a execução quando já existe um ADMIN ativo ou o e-mail está
cadastrado. Ele usa `auth.api.createUser` do Better Auth e não implementa hash
manualmente.

Não passe credenciais como argumentos e não mantenha senhas em scripts, documentação,
Git ou histórico do shell.

## Verificações

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npx next typegen
npm run lint
npx tsc --noEmit
npm test
npm run build
git diff --check
```

## Documentação

- [Mapa do produto](docs/product-map.md)
- [Arquitetura](docs/architecture.md)
- [Plano de implementação](docs/implementation-plan.md)
- [Checklist de QA](docs/qa-checklist.md)

## Produção

Push para `main` pode iniciar deploy automático. Migrations e deploy exigem janela
operacional, backup validado e aprovação explícita. Nenhuma migration deve ser
executada em produção a partir do fluxo local de desenvolvimento.
