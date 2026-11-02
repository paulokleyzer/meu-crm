# Meu CRM

CRM web em React, TypeScript e Next.js, com interface de funis inspirada no Pipedrive, cartões dnd-kit e persistência centralizada em PostgreSQL.

A branch **`feat/crm-netlify`**, baseada em `feat/crm-postgres`, prepara a aplicação para um **segundo projeto Netlify**, com o SDK oficial Netlify Database e API protegida em Functions. A interface, a navegação e os funis existentes foram preservados. Não exige VPS, Supabase ou Docker para usar esta implantação.

**O site antigo `lucky-donut-3d0c63.netlify.app` permanece independente. Não vincule esta branch àquele projeto.** Nenhuma publicação é executada pelo código ou pelos testes. O ZIP em `deploy/` é a versão estática anterior e não deve ser usado para a versão PostgreSQL.

## Publicar no segundo projeto Netlify

O [guia Netlify](docs/netlify.md) detalha cada passo: importar `paulokleyzer/meu-crm` do GitHub como um projeto novo, selecionar `feat/crm-netlify`, configurar acesso, ativar o Database, aplicar migrações e conferir a nova URL.

Configuração versionada: build `npm run build:netlify`, publish `.next`, Node.js 24 e adaptador oficial Next.js. Defina `CRM_BASIC_USER`, `CRM_BASIC_PASSWORD` e `CRM_ALLOWED_ORIGIN` no **novo projeto**, antes de usá-lo. O Netlify fornece `NETLIFY_DB_URL` ao SDK; nunca coloque credenciais em `NEXT_PUBLIC_*`.

Provisionamento e publicação hospedados precisam ser validados na conta do Netlify. Os testes locais e o empacotamento oficial não substituem essa conferência.

## Início rápido sem Docker

Requisitos: Node.js 24 LTS e npm.

```bash
git switch feat/crm-netlify
npm ci
npm run setup:netlify
npm run netlify:db:migrate
npm run netlify:dev
```

Abra **http://localhost:8888** na máquina que executou os comandos. A caixa HTTP Basic do navegador usa as credenciais de `.env.local`, geradas pelo setup. Não há tela de login ou níveis de acesso dentro do CRM. A API permanece fechada sem proteção configurada.

O Netlify Dev usa o banco local oficial e persiste em `.netlify/db`. O setup não sobrescreve um `.env.local` existente; configure a origem para `http://localhost:8888` se vier da instalação anterior. Não abra pela porta interna 3000 neste modo.

## Fluxos disponíveis

- Criar, editar, duplicar e excluir funis; configurar e reorganizar etapas.
- Arrastar cartões com mouse, toque ou teclado, inclusive para colunas vazias.
- Cadastrar clientes e oportunidades, editar detalhes, registrar atividades, ganhos e perdas.
- Pesquisar e filtrar negócios, alternar quadro/lista e consultar indicadores.
- Persistir no PostgreSQL, recuperar em outro dispositivo e tratar conflitos de revisão.
- Importar/exportar backup JSON v1, preservando IDs e funis da versão anterior.

Exclusões de etapas/funis preservam oportunidades por transferência. Gravações são confirmadas após uma transação no banco. Falhas não caem silenciosamente para armazenamento local. Sincronização usa ETag/304, intervalos de 30/120 segundos conforme atividade e pausa em abas ocultas ou inativas. Não há mesclagem automática de edições simultâneas.

## Verificar

```bash
npm run check                # lint, tipos, testes unitários e build
npm run test:netlify:db      # SDK, migrações oficiais e recuperação sem Docker
npm run test:netlify:package # adaptador/função empacotada; exige Deno e rede
npm run test:db             # PostgreSQL nativo exclusivo de testes
npm run test:e2e            # UI protegida, drag and drop e API em loopback
npm run format:check
```

Leia os [comandos e limites dos testes Netlify](docs/netlify.md#testes-e-limites-da-validação). E2E exige Chromium e `CRM_E2E_ALLOW_RESET=true` em banco local fictício; para o Netlify Dev informe `PLAYWRIGHT_BASE_URL=http://localhost:8888`. Nunca execute contra produção. Há CI com PostgreSQL e o banco local oficial do Netlify.

Os resultados e as verificações que ainda dependem do serviço hospedado estão no [registro de validação](docs/netlify-validation.md).

## Estrutura

- `src/components/`: interface e quadro originais.
- `src/lib/crm.ts`: operações de domínio e transferências.
- `src/hooks/use-crm.ts`: gravação assíncrona, estado confirmado e sincronização.
- `src/lib/http-repository.ts`: HTTP, revisão e repetição idempotente de falhas de rede.
- `src/app/api/crm/`: dados e histórico no servidor.
- `src/server/`: acesso, transações, SDK/pool e escrita incremental PostgreSQL.
- `netlify/database/migrations/`: migrações SQL oficiais.
- `tests/`: domínio, SQL nativo, SDK Netlify e navegador.

O [guia de arquitetura](docs/architecture.md) descreve as decisões e limites. A instalação alternativa em servidor próprio continua documentada em [PostgreSQL/Hostinger VPS](docs/postgres.md). WhatsApp, IA, autenticação individual e níveis de acesso são etapas futuras.
