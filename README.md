# Meu CRM v2

CRM web em React, TypeScript e Next.js, com funis inspirados no Pipedrive e PostgreSQL pelo SDK oficial Netlify Database.

A branch **`feat/crm-v2`** parte de `feat/crm-netlify` (`42de3fe`). Preserva os funis independentes, etapas personalizáveis, dnd-kit, ordem dos cartões, cadastro manual e sincronização. Acrescenta configurações comerciais, distribuição automática opcional, agenda e indicadores.

**Esta é uma demonstração compartilhada sem senha. Use somente dados fictícios.** Qualquer pessoa com a URL pode consultar e alterar os dados. Validação, origem, limites e concorrência reduzem abusos, mas não são autenticação. A proteção Basic continua disponível por configuração do servidor, sem tela de login.

O projeto existente **`lucky-donut-3d0c63`** será o destino da publicação futura. A versão atual continua no ar: mantenha `CRM_DEPLOY_V2=false` e builds/publicações automáticos pausados enquanto conecta GitHub e configura variáveis. Não houve deploy nesta preparação, e `main` não foi alterada.

## Executar sem Docker

Requisitos: Node.js 24 LTS, npm e Chromium para os testes de navegador.

```bash
git switch feat/crm-v2
npm ci
npm run setup:netlify
npm run netlify:db:migrate
npm run netlify:dev
```

Abra **http://localhost:8888** no computador que executou os comandos. Não há solicitação de senha. O Netlify Dev usa seu banco local oficial, persistido em `.netlify/db`; não precisa de VPS, Supabase ou Docker.

O setup não sobrescreve `.env.local`. Se já existir, use `CRM_ACCESS_MODE=demo` e `CRM_ALLOWED_ORIGIN=http://localhost:8888` para este modo. O banco local não é enviado à nuvem automaticamente. O [guia Netlify](docs/netlify.md) explica a preparação e a publicação autorizada no projeto existente.

## Funcionalidades

- Funis e etapas: criar, editar, duplicar, excluir, reorganizar e transferir negócios sem perda.
- Cartões: arraste com mouse, toque ou teclado, inclusive para etapas vazias. Durante o arraste, os destinos de outros funis aparecem no topo; soltar em um deles envia à primeira etapa daquele funil.
- **Configurações**: tipos de negócio e origens livres; vendedores/responsáveis persistidos, com edição e desativação.
- **Regras de distribuição**: condições independentes de tipo/origem, prioridade, ativação, regra padrão e simulador interno. Na oportunidade, escolha manualmente o funil ou aplique as regras. Alterar regras não movimenta negócios existentes automaticamente.
- **Atividades**: tarefas, ligações, reuniões e retornos, com data/horário, cliente, oportunidade, responsável, conclusão, reabertura e filtros de agenda. Cartões mostram atraso; lembretes aparecem dentro do CRM aberto.
- **WhatsApp**: atalho oficial `wa.me` para telefones válidos. Não há conexão de mensagens, chat simulado ou envio automático.
- **Dashboard**: abertos, ganhos, perdidos, valores e conversão por funil, origem, tipo e responsável.
- Backups JSON v2 e importação de v1, transações, idempotência, revisão global, conflitos e sincronização entre dispositivos.

O [guia da v2](docs/crm-v2.md) descreve regras, agenda, compatibilidade e a preparação para a API oficial do WhatsApp. O [guia de arquitetura](docs/architecture.md) detalha a persistência. A opção de servidor próprio continua documentada em [PostgreSQL/Hostinger VPS](docs/postgres.md).

## Verificar

```bash
npm run check
npm run test:netlify:db
npm run test:netlify:package
npm run test:db
npm run format:check
```

`test:db` requer `TEST_DATABASE_URL` de um PostgreSQL de testes. `test:netlify:db` usa o banco local oficial sem Docker. O teste de empacotamento usa o adaptador oficial, Deno e uma cópia temporária; não cria projeto nem publica.

Com o Netlify Dev aberto, use outro terminal:

```bash
CRM_E2E_ALLOW_RESET=true PLAYWRIGHT_BASE_URL=http://localhost:8888 npm run test:e2e
```

Instale o Chromium (`npx playwright install --with-deps chromium`) ou informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. E2E restaura dados fictícios e só aceita loopback; nunca execute contra produção. Há CI com PostgreSQL e o banco oficial local. Resultados e limitações constam no [registro de validação](docs/netlify-validation.md).

## Publicação

Use o projeto existente **`lucky-donut-3d0c63`**, branch `feat/crm-v2`, build `npm run build:netlify`, publish `.next` e Node.js 24. O bloqueio por nome/endereço foi removido. `build.ignore` e o comando de build exigem **`CRM_DEPLOY_V2=true`**; mantenha **`false` até autorizar a publicação**.

O [passo a passo](docs/netlify.md) separa a conexão do GitHub/configuração de variáveis da publicação futura no mesmo endereço. Pause builds/publicações automáticos antes de conectar o repositório. O Netlify Database, as migrações e a demonstração sem senha foram preservados. Nenhuma publicação foi executada.
