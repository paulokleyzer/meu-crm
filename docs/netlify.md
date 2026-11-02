# Publicar a CRM v2 no segundo projeto Netlify

A branch `feat/crm-v2`, baseada em `feat/crm-netlify`, executa Next.js/React/TypeScript em Functions e usa o SDK oficial **`@netlify/database`**. Os dados ficam no Netlify Database (PostgreSQL). Não exige VPS, Supabase, Docker ou computador ligado depois da publicação.

**Não use o projeto `lucky-donut-3d0c63`.** Seu site, domínio e dados anteriores devem permanecer intactos. As instruções abaixo destinam-se a um segundo projeto de testes, com dados fictícios. Não há solicitação de senha no modo de demonstração: a base é pública e compartilhada.

## Conectar o GitHub e preparar a publicação

1. Se o segundo projeto ainda não existir, no Netlify abra **Add new project → Import an existing project → GitHub** e escolha `paulokleyzer/meu-crm`. Crie um nome novo. Se já existir, abra somente esse projeto de testes.
2. Selecione **`feat/crm-v2`** como branch de produção do **novo projeto**. Diretório base: raiz do repositório. Não altere `main` ou a configuração do projeto antigo.
3. Confirme `netlify.toml`: build **`npm run build:netlify`**, publish directory **`.next`**, Node.js **24**, adaptador oficial `@netlify/plugin-nextjs`. Não use `out`, `build:static` ou o ZIP legado.
4. Configure as variáveis abaixo no novo projeto, disponíveis em build/Functions e nos contextos que for testar:

   | Variável             | Valor                                                                                                                                                                 |
   | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `CRM_ACCESS_MODE`    | `demo`. É também o padrão desta branch. Permite acesso sem usuário ou senha.                                                                                          |
   | `CRM_ALLOWED_ORIGIN` | Origem HTTPS exata da **nova URL**, sem barra final, por exemplo `https://<novo-projeto>.netlify.app`.                                                                |
   | `CRM_DEPLOY_V2`      | Defina `true` **somente quando quiser liberar o build/publicação deste segundo projeto**. Enquanto ausente/diferente, a regra `build.ignore` pula builds automáticos. |

   `CRM_BASIC_USER` e `CRM_BASIC_PASSWORD` não são necessários no modo `demo`; valores antigos são ignorados nesse modo. Não configure `CRM_E2E_ALLOW_RESET=true` no site publicado. Nenhuma credencial do banco ou token deve ir para `NEXT_PUBLIC_*`.

5. Na área **Database** do novo projeto, conclua a ativação do **Netlify Database**, caso o painel solicite. O build detecta o SDK oficial e pode provisionar a base automaticamente. Verifique disponibilidade, créditos/franquia do plano e região antes de confirmar qualquer contratação; o código não solicita upgrade pago.
6. Quando você decidir publicar, com `CRM_DEPLOY_V2=true` configurado, dispare um deploy **somente do segundo projeto**. Confira o adaptador Next.js e os quatro arquivos de migração no build. O Netlify fornece `NETLIFY_DB_URL` e o driver ao SDK; não copie `DATABASE_URL` da VPS/local nem configure uma URL manual de Neon/Supabase.
7. Confira o resultado das migrações no painel Database. A primeira instalação cria um funil vazio e um responsável chamado **Equipe**, que pode ser renomeado em Configurações. Nenhum seed ou dado real é publicado automaticamente.
8. Abra a nova URL HTTPS. Deve carregar diretamente, sem diálogo de senha. Execute o checklist abaixo antes de usar a demonstração.

Se o assistente disparar um build antes de você definir a variável de publicação, ele será ignorado. Depois de preparar o projeto, defina a variável e solicite novo deploy. Para continuar exigindo ação manual nas próximas versões, pause os deploys automáticos no painel do novo projeto ou remova a variável quando terminar a publicação. Não vincule o checkout ao projeto antigo, nem use `netlify link/init/deploy` apontando para ele.

## Migrações e registros anteriores

O runner oficial lê `netlify/database/migrations/` por `[database.migrations]`, gera artefatos de publicação e aplica os arquivos no banco do contexto do deploy:

- `001_crm.sql`: clientes, funis, etapas, oportunidades, atividades históricas e revisão.
- `002_snapshot.sql`: cache de leitura transacional e restrições para ordenação.
- `003_crm_v2.sql`: tipos, origens, responsáveis, regras, agenda, limites da demonstração e snapshot v2.
- `004_whatsapp_foundation.sql`: conversas/mensagens e estado de pausa da IA, somente no servidor, sem webhook ativo.

A migração 003 preserva as tabelas e registros anteriores. Extrai as origens e responsáveis existentes para cadastros, sem listas fixas, e mantém a revisão. Negócios antigos ficam sem tipo até serem classificados. Histórico de transações não é apagado.

Não execute `db:migrate` no build Netlify. O runner oficial usa `netlify.migrations`; o runner legado da VPS usa `crm_migrations` e checksums. Não misture os runners no mesmo banco. Migrações publicadas são imutáveis; mudanças futuras exigem novo arquivo. Faça backup antes de atualizar uma base existente. Dados locais do navegador/site antigo só são transferidos por importação explícita.

O SDK usa a conexão do contexto atual e encerra pools por requisição. Confira a base/branch atribuída a cada Deploy Preview antes de testar; não sobrescreva `NETLIFY_DB_URL` com uma conexão de produção comum. Desative previews/branch deploys desnecessários no segundo projeto para reduzir consumo.

## Backup e importação

1. No navegador que contém os dados do CRM antigo, escolha **menu do espaço de trabalho → Exportar backup**.
2. Exporte também a base atual da v2 antes de restaurar qualquer arquivo.
3. Na v2, use **Importar backup** e selecione JSON v1 ou v2, menor que 4 MB, deixando margem para o envelope HTTP.
4. Revise a confirmação: a restauração **substitui o conjunto compartilhado inteiro**, incluindo configurações, regras e agenda. Um v1 não contém regras/agenda/tipos; esses conjuntos ficam vazios, e suas origens/responsáveis são derivados dos negócios importados.
5. Confirme e recarregue em outro dispositivo. IDs e dados do arquivo são preservados; o estado anterior fica em `crm_history`. A importação não altera o site antigo.

Abas de versões anteriores não podem gravar v1 como uma edição normal: recebem 426 e devem ser recarregadas. Backups v1 continuam permitidos pela operação explícita de importação. O JSON v2 exportado não deve ser importado na interface estática antiga.

## Conferência na nova URL

Use apenas dados fictícios:

1. Abra uma janela privada. `/` e `GET /api/crm` devem carregar sem senha e sem `WWW-Authenticate`. PUT sem origem autorizada deve retornar 403. Ausência de senha significa acesso público; origem e limites não são autenticação.
2. Cadastre cliente e oportunidade, crie um funil e etapas, recarregue e confira em outro dispositivo. No Database, consulte contagens de leitura de `crm_customers`, `crm_deals` e a revisão em `crm_state`.
3. Arraste cartões entre etapas, para uma coluna vazia e para um dos destinos de outro funil que aparecem durante o arraste. Teste reordenação, teclado e toque no celular.
4. Em Configurações, crie/renomeie tipos e origens, crie um responsável e teste desativação. Configure regras, prioridade e padrão. Use o simulador e confira a oportunidade fictícia no destino.
5. Crie uma atividade vencida e outra futura. Confira o indicador no cartão, conclusão/reabertura, lembretes internos e persistência após recarga.
6. Confira filtros, indicadores e um backup fictício. Faça uma alteração em dois dispositivos para verificar sincronização e aviso de conflito.
7. Confira respostas 304 nas consultas com revisão inalterada e ausência de credenciais nos arquivos públicos. Não execute testes automatizados de reset contra a URL hospedada.

O comportamento hospedado, o provisionamento e a execução Edge precisam ser conferidos após sua publicação. Não há nova URL criada por esta tarefa.

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

O CLI 27.16.2 tenta provisionar Database até com `netlify build --offline`. O teste de empacotamento usa uma cópia temporária, excluindo somente essa detecção remota do manifesto da cópia. O SDK continua instalado/executado, e o manifesto real não muda. Verifica Function, proxy Edge, quatro migrações, segredos e CRUD v2 com SQL local. Isso não comprova publicação hospedada. Veja o [registro de validação](netlify-validation.md) para as limitações observadas.

## Consumo e proteção opcional

A sincronização mantém 30 segundos em atividade, 120 segundos após um minuto sem interação e pausa em aba oculta ou após cinco minutos inativa. Recuperar foco atualiza imediatamente. Uma revisão inalterada retorna 304, mas ainda utiliza Function/banco.

No modo demo, além da leitura do snapshot, uma consulta SQL atualiza contadores compartilhados entre instâncias. Limites por minuto: 300 leituras/120 gravações por identificador e 2.400 leituras/600 gravações globais. No Netlify, o identificador deriva do IP de conexão informado pela plataforma, armazenado como hash; sem essa informação usa um grupo compartilhado. Fora do Netlify, o limite é compartilhado localmente. Excesso retorna 429 com `Retry-After: 60`. Contadores antigos são removidos durante requisições. Não há confiança em `X-Forwarded-For` enviado pelo navegador.

Monitore créditos de Functions, build, Database e armazenamento do histórico, que guarda snapshots completos. Franquias comerciais podem mudar; não há promessa de uso ilimitado ou custo sempre zero.

Para voltar à proteção compartilhada sem reconstruir a UI, configure `CRM_ACCESS_MODE=basic`, `CRM_BASIC_USER`, senha aleatória de pelo menos 16 caracteres em `CRM_BASIC_PASSWORD` e a origem HTTPS. A caixa nativa do navegador voltará a pedir credenciais. Não é autenticação individual nem controle de permissões. Antes de dados reais ou WhatsApp real, essa demonstração deve passar por uma etapa específica de autenticação, proteção e integração oficial.
