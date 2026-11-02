# Meu CRM

CRM web inspirado na experiência de funis do Pipedrive, com identidade própria.

## Objetivo

Construir um CRM genérico que permita criar múltiplos funis personalizados, cadastrar contatos e oportunidades manualmente, e movimentar cartões entre etapas por arrastar e soltar (drag and drop), com persistência de dados.

## Primeira etapa

- Interface web responsiva com React e TypeScript.
- Múltiplos funis com etapas configuráveis.
- Cartões de oportunidades com drag and drop real, inclusive entre colunas vazias.
- Cadastro manual de contatos e oportunidades.
- Dados fictícios durante o desenvolvimento inicial.
- Sem login na primeira etapa de prototipagem; não publicar dados reais sem proteção de acesso.

## Etapas futuras

- Banco de dados PostgreSQL e hospedagem Hostinger.
- Integração oficial do WhatsApp Business (mesmo número com aplicativo, quando elegível).
- Regras para direcionar contatos por tipo de negócio e origem.
- Atendimento por IA com pausa automática por conversa quando o atendente responder manualmente.
- App móvel Android e iPhone.

## Executar a aplicação

Requisitos: Node.js 22.13 ou superior (recomendado: Node 24 LTS) e npm. Não é necessário banco, conta externa, arquivo `.env` ou chave de API.

```bash
git clone https://github.com/paulokleyzer/meu-crm.git
cd meu-crm
# Enquanto a primeira versão não estiver integrada na main:
git switch feat/crm-v1
npm ci
npm run dev
```

Ao executar no seu computador, abra **http://localhost:3000**. O servidor escuta em `0.0.0.0` e precisa continuar em execução. O ambiente na nuvem deste chat não disponibiliza uma URL pública de prévia nem um recurso de encaminhamento de portas; o endereço local dele não é acessível pelo seu computador.

Para acessar pelo navegador sem instalar o projeto no seu computador, publique a versão estática em uma hospedagem. O [guia para a Hostinger](docs/hostinger.md) descreve como enviar o pacote para um domínio ou subdomínio de testes.

Em um checkout já existente, execute `npm ci` e `npm run dev` na raiz do projeto. Cada tarefa na nuvem já é isolada: use o checkout existente, sem criar outro worktree.

Para testar a versão otimizada:

```bash
npm run build
npm start
```

## O que funciona nesta versão

- Funis independentes: criar, editar, duplicar a estrutura e excluir com confirmação.
- Etapas: adicionar, renomear, excluir, definir probabilidade e reorganizar por arrastar ou pelas setas no editor.
- Quadro Kanban com **dnd-kit**: arrastar entre etapas, soltar em colunas vazias e reordenar cartões na mesma etapa.
- Cadastro e edição de clientes, inclusive durante o cadastro de uma oportunidade.
- Oportunidades com valor, cliente, etapa, responsável, origem, prioridade, previsão, notas e status (aberta, ganha ou perdida).
- Detalhes editáveis e histórico das movimentações ao clicar no cartão.
- Pesquisa por título, contato, empresa ou e-mail, sem diferenciar acentos; filtros por responsável, prioridade, status e atraso.
- Indicadores por etapa, totais do filtro, receita ponderada, negócios ganhos e visão geral de todos os funis.
- Visualização em lista, cadastro de clientes e navegação responsiva com barra inferior no celular.
- Persistência local, sincronização entre abas do mesmo navegador e exportação/importação de backup JSON validado.

### Experimente em poucos minutos

1. Abra o **Funil de vendas**, que começa com oportunidades fictícias.
2. Arraste um cartão de “Novo lead” para “Qualificação” e recarregue: a movimentação permanece.
3. Selecione **Parcerias** e arraste o cartão para a etapa vazia “Reunião”.
4. Use **Gerenciar funis → Criar funil** para definir seu próprio processo.
5. Use **Nova oportunidade → Cadastrar cliente** e registre um negócio.
6. Clique no cartão para editar os detalhes ou marcar como ganho. Negócios ganhos e perdidos aparecem ao selecionar o status em **Filtros**.

No celular, mantenha o cartão pressionado brevemente antes de arrastar. No teclado: Tab até o cartão, Espaço para pegar, setas para mover, Espaço para soltar e Escape para cancelar. Como alternativa, edite o campo **Etapa** nos detalhes.

### Regras que preservam seus dados

- É obrigatório manter ao menos um funil e uma etapa por funil.
- Ao excluir uma etapa, os negócios dela são transferidos para a primeira etapa restante. O editor informa a transferência antes de salvar.
- Ao excluir um funil, escolha outro para receber todos os negócios na primeira etapa. O status e o histórico são preservados.
- Duplicar copia a estrutura do funil, com novos identificadores, sem copiar oportunidades.
- A exclusão individual de uma oportunidade exige confirmação e preserva o cadastro do cliente.

## Dados locais e backups

A chave `meu-crm:data:v1` no `localStorage` guarda os dados neste navegador e nesta origem. Dados de outra porta, outro navegador ou outro dispositivo são independentes. Em uma origem nova, os dados fictícios são criados automaticamente.

Pelo menu do avatar **PK**, exporte um backup JSON ou importe um arquivo existente. A importação valida versão, campos e referências e pede confirmação antes de substituir os dados. Se o armazenamento estiver cheio, bloqueado ou corrompido, uma mensagem informa o problema; dados corrompidos não são sobrescritos automaticamente. Exporte as alterações da sessão antes de sair.

Esta versão é para testes com dados fictícios. Não há autenticação, armazenamento no servidor, compartilhamento entre usuários ou controle de acesso. O armazenamento local não substitui backups. Em edição simultânea entre abas, a última gravação prevalece; reabra formulários se receber um aviso de atualização por outra aba.

## Validação e testes

```bash
npm run lint        # ESLint e regras de React/Next.js
npm run typecheck   # TypeScript estrito
npm test            # Vitest: regras de negócio, filtros e persistência
npm run build       # Build de produção, incluindo validação TypeScript
npm run check       # Todos os quatro comandos acima
```

Para os testes reais de navegador:

```bash
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

Se já houver Chromium instalado, use-o sem baixar outro navegador:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

O Playwright inicia o servidor de produção automaticamente na porta 3000. A suíte cobre arrastar com mouse, colunas vazias, teclado, recarga dos dados, ciclo de vida dos funis, cadastros, edição, exclusão, filtros, backup, armazenamento inválido, layout móvel e verificações de acessibilidade WCAG A/AA com axe. Relatório em `playwright-report/`; traces de falhas em `test-results/`.

Há um workflow de CI em `.github/workflows/ci.yml` com instalação pelo lockfile, lint, tipos, testes, build e testes de navegador.

## Estrutura e próximas integrações

```text
src/app/             Rotas, layout e estilos Next.js
src/components/      Quadro, formulários, clientes e indicadores
src/hooks/use-crm.ts Store React e sincronização com o navegador
src/lib/types.ts     Entidades do domínio
src/lib/crm.ts       Operações puras e regras dos funis
src/lib/schema.ts    Validação dos dados e backups com Zod
src/lib/repository.ts Fronteira de persistência e adaptador local
src/lib/seed.ts      Dados fictícios
tests/unit/          Testes de domínio e persistência
tests/e2e/           Testes funcionais com Chromium
docs/architecture.md Decisões e caminho para PostgreSQL, WhatsApp e IA
```

A interface segue os padrões de navegação, quadro por etapas, totais e detalhes de negócios do Pipedrive, com identidade visual própria. Usa Next.js App Router, React, TypeScript, dnd-kit, Radix UI, Lucide e Zod, sem depender de fontes ou APIs externas na execução.

PostgreSQL, WhatsApp Business e atendimento automatizado por IA **não estão integrados nesta etapa**. O [documento de arquitetura](docs/architecture.md) descreve as fronteiras e o modelo para adicioná-los sem acoplar essas integrações aos componentes do funil.
