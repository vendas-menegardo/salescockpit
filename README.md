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

Depois de aplicar a migration de autenticação em um banco isolado, configure as
variáveis locais e execute o assistente oficial sem colocar a senha na linha de
comando:

```powershell
npx auth@latest create-admin
```

Informe e-mail, nome, senha forte e perfil `admin` de forma interativa. Confirme no
banco isolado que existe exatamente um usuário ADMIN ativo antes de testar o login.
Não mantenha credenciais iniciais em scripts, documentação, Git ou histórico do shell.

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
