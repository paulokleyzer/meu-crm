# Preparar a CRM v2 no projeto lucky-donut-3d0c63

A branch `feat/crm-v2` executa Next.js/React/TypeScript em Functions e mantém o SDK oficial **`@netlify/database`**, PostgreSQL e as quatro migrações existentes. Não exige VPS, Supabase, Docker ou computador ligado depois da publicação.

O destino passou a ser o projeto existente **`lucky-donut-3d0c63`**, no endereço **https://lucky-donut-3d0c63.netlify.app**. O bloqueio por nome/domínio foi removido. **Esta etapa prepara a conexão e as variáveis; não autoriza substituir a versão publicada.** Mantenha `CRM_DEPLOY_V2=false` até autorizar a publicação. A demonstração da v2 continua pública, compartilhada e sem senha, somente para dados fictícios.

## Agora: conectar o GitHub e configurar sem publicar

1. Abra o projeto existente **lucky-donut-3d0c63** no Netlify. Não crie outro projeto. Exporte o backup JSON do CRM atual no navegador que guarda os dados e anote o deploy atualmente publicado, para referência antes da troca futura.
2. **Antes de vincular o GitHub, pause os builds automáticos** nas configurações de Build & deploy/Continuous deployment (Stop builds/Pause builds). Em Deploys, mantenha a versão atual travada contra publicação automática, se essa opção estiver disponível. Isso também cobre um primeiro build que o painel possa disparar ao conectar o repositório, inclusive se selecionar `main` por padrão: `main` não contém a trava desta branch.
3. Nas variáveis de ambiente do projeto, configure a tabela abaixo. A trava precisa estar disponível no **escopo de Build e em todos os contextos** que possam executar builds, inclusive Production e previews. Não deixe um `CRM_DEPLOY_V2=true` em outro contexto.

   | Variável             | Valor durante a preparação                                                                     |
   | -------------------- | ---------------------------------------------------------------------------------------------- |
   | `CRM_DEPLOY_V2`      | **`false`**. Não alterar para `true` nesta etapa.                                              |
   | `CRM_ACCESS_MODE`    | `demo`, disponível para Functions/execução do aplicativo.                                      |
   | `CRM_ALLOWED_ORIGIN` | `https://lucky-donut-3d0c63.netlify.app`, sem barra final, disponível para Functions/execução. |

   Se o painel não separar escopos, use todos os escopos. `CRM_BASIC_USER` e `CRM_BASIC_PASSWORD` não são necessários em `demo`; valores antigos são ignorados nesse modo. Não configure `CRM_E2E_ALLOW_RESET=true` no site e não coloque credenciais em `NEXT_PUBLIC_*`.

4. Em **Project configuration → Build & deploy → Continuous deployment → Repository**, escolha **Link repository/Link to a Git provider**, autorize GitHub e selecione **`paulokleyzer/meu-crm`**. Os nomes podem variar no painel. Se o projeto já estiver conectado ao repositório correto, apenas confira a configuração.
5. Escolha **`feat/crm-v2`** como branch de produção. Não altere o conteúdo de `main`. Confirme diretório base na raiz, build **`npm run build:netlify`**, publish **`.next`**, Node.js **24** e adaptador oficial `@netlify/plugin-nextjs`, conforme `netlify.toml`. Não use `out`, `build:static` ou o ZIP legado.
6. Mantenha os builds/publicações automáticos pausados e a versão atual publicada. **Não clique em Deploy/Trigger deploy nem execute `netlify deploy`, `netlify build` ou migrações remotas nesta preparação.** Não é necessário obter ou enviar token ao chat para conectar GitHub pelo painel.

A regra `build.ignore` pula o build quando a variável não for exatamente `true` (saída 0). Com `true`, permite continuar (saída 1), inclusive neste projeto e em suas URLs de preview. O comando `build:netlify` confere a mesma variável antes de chamar Next.js, cobrindo builds forçados que pulem o descarte. Não há mais lista de nomes/domínios bloqueados.

Pausar builds e manter `CRM_DEPLOY_V2=false` não atualiza os arquivos que o Netlify já serve. Nenhuma configuração no painel, conexão de repositório, variável ou publicação foi executada automaticamente por esta alteração no código.

## Depois: somente após autorizar a publicação

1. Quando a publicação for autorizada, altere **`CRM_DEPLOY_V2=true` no escopo de Build** do contexto que será publicado. Até lá, mantenha `false`.
2. Na área **Database** de **lucky-donut-3d0c63**, conclua a ativação do **Netlify Database**, se solicitada. O build detecta o SDK oficial e pode provisionar a base automaticamente. Confira disponibilidade, região e créditos/franquia antes de confirmar qualquer contratação; o código não solicita upgrade pago.
3. Retome os builds e dispare manualmente o build da branch `feat/crm-v2`. Confira adaptador Next.js e quatro migrações. O Netlify fornece `NETLIFY_DB_URL` e o driver ao SDK; não copie `DATABASE_URL` local/VPS nem configure manualmente Neon/Supabase. Não execute `db:migrate` no build.
4. Se a publicação automática estiver travada, confira o deploy candidato antes de promover a versão autorizada. Valide banco, acesso sem senha, cadastro e arraste. A primeira instalação cria um funil vazio e o responsável **Equipe**, configurável pela interface; nenhum seed ou dado real é publicado automaticamente.
5. Publique a versão aprovada para o mesmo endereço **https://lucky-donut-3d0c63.netlify.app**. É nesse momento que a interface anterior será substituída. Use o backup exportado para importar dados na v2 e execute o checklist abaixo.
6. Para exigir nova ação manual em futuras atualizações, volte `CRM_DEPLOY_V2=false` e pause novamente builds/publicações automáticos. Essa variável é uma trava de build; não desliga a aplicação já publicada.

## Migrações e registros anteriores

O runner oficial lê `netlify/database/migrations/` por `[database.migrations]`, gera artefatos de publicação e aplica os arquivos no banco do contexto do deploy:

- `001_crm.sql`: clientes, funis, etapas, oportunidades, atividades históricas e revisão.
- `002_snapshot.sql`: cache de leitura transacional e restrições para ordenação.
- `003_crm_v2.sql`: tipos, origens, responsáveis, regras, agenda, limites da demonstração e snapshot v2.
- `004_whatsapp_foundation.sql`: conversas/mensagens e estado de pausa da IA, somente no servidor, sem webhook ativo.

A migração 003 preserva as tabelas e registros anteriores. Extrai as origens e responsáveis existentes para cadastros, sem listas fixas, e mantém a revisão. Negócios antigos ficam sem tipo até serem classificados. Histórico de transações não é apagado.

Não execute `db:migrate` no build Netlify. O runner oficial usa `netlify.migrations`; o runner legado da VPS usa `crm_migrations` e checksums. Não misture os runners no mesmo banco. Migrações publicadas são imutáveis; mudanças futuras exigem novo arquivo. Faça backup antes de atualizar uma base existente. Dados locais do navegador só são transferidos por importação explícita; exporte o JSON antes de substituir a interface atual.

O SDK usa a conexão do contexto atual e encerra pools por requisição. Confira a base/branch atribuída a cada Deploy Preview antes de testar; não sobrescreva `NETLIFY_DB_URL` com uma conexão de produção comum. Desative previews/branch deploys desnecessários no projeto para reduzir consumo.

## Backup e importação

1. **Antes da publicação autorizada**, no navegador que contém os dados do CRM atual, escolha **menu do espaço de trabalho → Exportar backup**. O endereço será o mesmo após a troca e a v2 não lê automaticamente o armazenamento local antigo.
2. Exporte também a base atual da v2 antes de restaurar qualquer arquivo.
3. Na v2, use **Importar backup** e selecione JSON v1 ou v2, menor que 4 MB, deixando margem para o envelope HTTP.
4. Revise a confirmação: a restauração **substitui o conjunto compartilhado inteiro**, incluindo configurações, regras e agenda. Um v1 não contém regras/agenda/tipos; esses conjuntos ficam vazios, e suas origens/responsáveis são derivados dos negócios importados.
5. Confirme e recarregue em outro dispositivo. IDs e dados do arquivo são preservados; o estado anterior fica em `crm_history`. A importação altera a base PostgreSQL compartilhada, não o backup JSON exportado.

Abas de versões anteriores não podem gravar v1 como uma edição normal: recebem 426 e devem ser recarregadas. Backups v1 continuam permitidos pela operação explícita de importação. O JSON v2 exportado não deve ser importado na interface estática antiga.

## Conferência após a publicação autorizada

Use apenas dados fictícios:

1. Abra uma janela privada. `/` e `GET /api/crm` devem carregar sem senha e sem `WWW-Authenticate`. PUT sem origem autorizada deve retornar 403. Ausência de senha significa acesso público; origem e limites não são autenticação.
2. Cadastre cliente e oportunidade, crie um funil e etapas, recarregue e confira em outro dispositivo. No Database, consulte contagens de leitura de `crm_customers`, `crm_deals` e a revisão em `crm_state`.
3. Arraste cartões entre etapas, para uma coluna vazia e para um dos destinos de outro funil que aparecem durante o arraste. Teste reordenação, teclado e toque no celular.
4. Em Configurações, crie/renomeie tipos e origens, crie um responsável e teste desativação. Configure regras, prioridade e padrão. Use o simulador e confira a oportunidade fictícia no destino.
5. Crie uma atividade vencida e outra futura. Confira o indicador no cartão, conclusão/reabertura, lembretes internos e persistência após recarga.
6. Confira filtros, indicadores e um backup fictício. Faça uma alteração em dois dispositivos para verificar sincronização e aviso de conflito.
7. Confira respostas 304 nas consultas com revisão inalterada e ausência de credenciais nos arquivos públicos. Não execute testes automatizados de reset contra a URL hospedada.

O comportamento hospedado, o provisionamento e a execução Edge precisam ser conferidos depois da publicação autorizada no mesmo projeto. Nenhum deploy foi realizado nesta preparação.

## Rodar e testar localmente sem Docker

Requisitos: Node.js 24 e npm. Netlify Dev usa `@netlify/database-dev` (PGlite/PostgreSQL com protocolo pg), sem Docker. Edge Functions usam Deno, obtido pelo CLI quando necessário; permita downloads HTTPS oficiais, sem desabilitar TLS.

```bash
git switch feat/crm-v2
npm ci
npm run setup:netlify
npm run netlify:db:migrate
npm run netlify:dev
```

Abra **http://localhost:8888** na mesma máquina. O setup cria `.env.local` sem sobrescrever outro arquivo. Em um arquivo existente, use `CRM_ACCESS_MODE=demo` e `CRM_ALLOWED_ORIGIN=http://localhost:8888`. O SDK recebe a conexão do banco local automaticamente; `.netlify/db` é privada e ignorada pelo Git. Não a remova se quiser preservar esses dados. A porta 3000 é interna; o teste integrado deve usar 8888.

```bash
npm run check
npm run test:netlify:db
npm run test:netlify:package
npm run format:check
```

Com o servidor local aberto, em outro terminal:

```bash
CRM_E2E_ALLOW_RESET=true PLAYWRIGHT_BASE_URL=http://localhost:8888 npm run test:e2e
```

Instale o Chromium do Playwright ou informe seu executável. E2E só aceita loopback e restaura dados fictícios. Testes PostgreSQL nativos adicionais usam `npm run test:db` com `TEST_DATABASE_URL` exclusiva de testes.

O CLI 27.16.2 tenta provisionar Database até com `netlify build --offline`. O teste de empacotamento usa uma cópia temporária, excluindo somente essa detecção remota do manifesto da cópia. O SDK continua instalado/executado, e o manifesto real não muda. Habilita `CRM_DEPLOY_V2=true` somente no processo filho dessa cópia temporária, não vinculada a projeto e executada offline. Verifica Function, proxy Edge, quatro migrações, segredos e CRUD v2 com SQL local. Isso não comprova publicação hospedada. Veja o [registro de validação](netlify-validation.md) para as limitações observadas.

## Consumo e proteção opcional

A sincronização mantém 30 segundos em atividade, 120 segundos após um minuto sem interação e pausa em aba oculta ou após cinco minutos inativa. Recuperar foco atualiza imediatamente. Uma revisão inalterada retorna 304, mas ainda utiliza Function/banco.

No modo demo, além da leitura do snapshot, uma consulta SQL atualiza contadores compartilhados entre instâncias. Limites por minuto: 300 leituras/120 gravações por identificador e 2.400 leituras/600 gravações globais. No Netlify, o identificador deriva do IP de conexão informado pela plataforma, armazenado como hash; sem essa informação usa um grupo compartilhado. Fora do Netlify, o limite é compartilhado localmente. Excesso retorna 429 com `Retry-After: 60`. Contadores antigos são removidos durante requisições. Não há confiança em `X-Forwarded-For` enviado pelo navegador.

Monitore créditos de Functions, build, Database e armazenamento do histórico, que guarda snapshots completos. Franquias comerciais podem mudar; não há promessa de uso ilimitado ou custo sempre zero.

Para voltar à proteção compartilhada sem reconstruir a UI, configure `CRM_ACCESS_MODE=basic`, `CRM_BASIC_USER`, senha aleatória de pelo menos 16 caracteres em `CRM_BASIC_PASSWORD` e a origem HTTPS. A caixa nativa do navegador voltará a pedir credenciais. Não é autenticação individual nem controle de permissões. Antes de dados reais ou WhatsApp real, essa demonstração deve passar por uma etapa específica de autenticação, proteção e integração oficial.
