# Meu CRM

CRM web com interface de funis inspirada no Pipedrive, identidade própria e persistência centralizada em PostgreSQL.

A branch **feat/crm-postgres** preserva o quadro, os cartões dnd-kit, a navegação, clientes, formulários, filtros e indicadores da versão funcional anterior. Acrescenta API Next.js, transações, revisão otimista, sincronização entre dispositivos e importação do backup JSON v1.

A versão estática já publicada no Netlify permanece independente. Não houve publicação nem atualização daquele site. O ZIP em `deploy/` continua sendo a versão anterior, com dados locais ao navegador; a versão PostgreSQL exige um servidor Node.js.

## Início rápido

Requisitos: Node.js 24 LTS, npm e Docker com Compose.

```bash
git switch feat/crm-postgres
npm ci
npm run setup:local
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Abra **http://127.0.0.1:3000** na máquina em que executou o servidor. A caixa de autenticação do navegador usa `CRM_BASIC_USER` e `CRM_BASIC_PASSWORD` do arquivo `.env.local`, gerado pelo setup. Não há tela de login ou níveis de acesso dentro do CRM. A API permanece fechada sem a configuração de proteção.

`setup:local` não sobrescreve um arquivo existente. `db:seed` cria dados fictícios apenas no banco vazio; pode ser omitido. Leia o [guia completo de PostgreSQL e Hostinger VPS](docs/postgres.md) para configurar uma base existente, HTTPS, migrações, importação e backups.

## Fluxos disponíveis

- Criar, editar, duplicar e excluir funis; configurar e reorganizar etapas.
- Arrastar cartões com mouse, toque ou teclado, entre etapas e para colunas vazias.
- Cadastrar clientes e oportunidades, editar detalhes, registrar notas, ganhos e perdas.
- Pesquisar e filtrar negócios, alternar quadro/lista e consultar indicadores.
- Persistir os dados no PostgreSQL, recarregar em outro dispositivo e detectar conflitos.
- Importar/exportar backup JSON, preservando IDs, funis, negócios e atividades da versão anterior.

Exclusões de etapas/funis preservam oportunidades por transferência. Cada gravação só é confirmada após transação no banco. Falhas não caem silenciosamente para armazenamento local, e alterações concorrentes não são sobrescritas automaticamente.

## Produção e Hostinger

```bash
npm run build
npm start
```

Para VPS, há `Dockerfile`, `compose.vps.yaml` e exemplo Nginx em `deploy/nginx-crm.conf`. O procedimento completo, incluindo o arquivo de configuração e os comandos de migração, está em [docs/postgres.md](docs/postgres.md#hostinger-vps). Não depende de Supabase. O acesso público deve usar HTTPS e as credenciais de proteção do servidor.

Não use `build:static` nesta branch: um site estático não executa a nova API. Use a branch `feat/crm-v1` para a versão estática anterior, sem modificar o site existente no Netlify durante o desenvolvimento.

## Verificar

```bash
npm run check       # lint, tipos, testes unitários e build
npm run test:db     # PostgreSQL real; requer TEST_DATABASE_URL
npm run test:e2e    # UI e API protegidas; banco local exclusivo de testes
npm run format:check
```

Os E2E requerem Chromium (`npx playwright install --with-deps chromium`) ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. A suíte restaura dados fictícios antes de cada cenário e exige `CRM_E2E_ALLOW_RESET=true` com servidor em loopback. Não a execute em produção. Há CI com PostgreSQL.

## Estrutura

- `src/components/`: interface e quadro originais.
- `src/lib/crm.ts`: operações de domínio e regras de transferência.
- `src/hooks/use-crm.ts`: gravação assíncrona, estado confirmado e sincronização.
- `src/lib/http-repository.ts`: cliente HTTP com repetição idempotente de erros de rede.
- `src/app/api/crm/`: endpoints de dados e histórico.
- `src/server/`: acesso, transações, migrações e repositório PostgreSQL.
- `db/migrations/`: esquema SQL versionado e conferido por checksum.
- `tests/unit`, `tests/integration`, `tests/e2e`: domínio, SQL real e interface.

O histórico de transações guarda snapshots anteriores e posteriores no banco. O controle de concorrência é do conjunto inteiro, sem mesclagem automática. Ainda não há WhatsApp, IA, autenticação individual de usuários ou níveis de acesso. Essas integrações seguem como próximas etapas; use dados fictícios durante a validação desta versão.
