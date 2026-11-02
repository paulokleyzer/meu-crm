# CRM no Netlify com PostgreSQL

A branch `feat/crm-netlify` parte de `feat/crm-postgres`. Mantém os mesmos componentes, funis e drag and drop e usa o SDK oficial **`@netlify/database`**, API Next.js em Netlify Functions e migrações oficiais do Netlify Database. Não exige VPS, Docker, Supabase ou um computador ligado para usar a versão publicada.

**Use um segundo projeto. Não vincule esta branch ao projeto `lucky-donut-3d0c63`.** O site antigo e seus dados locais devem continuar funcionando no endereço atual. O código inclui uma regra `build.ignore` para pular builds automáticos do projeto antigo antes da instalação/provisionamento, além de uma trava no comando de build pelo nome/endereço. Essas proteções não substituem a escolha correta do projeto. Não execute `netlify link`, `netlify init` ou comandos de publicação apontando para aquele projeto.

## Criar o segundo projeto conectado ao GitHub

1. No Netlify, abra **Add new project → Import an existing project → GitHub**. Autorize o repositório `paulokleyzer/meu-crm`.
2. Escolha um **nome novo**, por exemplo `meu-crm-postgres-<seu-identificador>`, e a branch de produção **`feat/crm-netlify`**. Não selecione `main` ou o projeto antigo. O diretório base é a raiz do repositório.
3. Confirme as configurações lidas de `netlify.toml`: build **`npm run build:netlify`**, publish directory **`.next`**, Node.js **24**. O adaptador oficial `@netlify/plugin-nextjs` executa a API e o proxy de acesso. Não use `out`, `build:static` ou o ZIP de `deploy/`.
4. **Antes do primeiro deploy**, adicione as variáveis abaixo nas configurações do projeto. A senha é um segredo do servidor, criado e salvo por você no gerenciador de senhas. Não a envie ao chat ou ao GitHub. A caixa HTTP Basic do navegador usa essas credenciais; nenhuma tela de login foi adicionada ao CRM.

   | Variável             | Valor/configuração                                                                                                                                                                        |
   | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `CRM_BASIC_USER`     | Seu usuário de acesso ao espaço compartilhado.                                                                                                                                            |
   | `CRM_BASIC_PASSWORD` | Senha aleatória, preferencialmente com 32 ou mais caracteres; mínimo 16. Marque como secreta quando disponível.                                                                           |
   | `CRM_ALLOWED_ORIGIN` | URL **do novo projeto**, por exemplo `https://meu-crm-postgres-<seu-identificador>.netlify.app`, sem barra final. Troque para o domínio HTTPS definitivo se adicionar um domínio próprio. |

   As variáveis de acesso precisam estar disponíveis para **Functions e execução do aplicativo**, além de qualquer contexto de preview que você habilitar. Se a interface de configuração não separar os escopos, use todos os escopos. Não crie variáveis `NEXT_PUBLIC_*` para credenciais. Não configure `CRM_E2E_ALLOW_RESET=true` no projeto publicado.

5. Na área **Database** do **novo projeto**, habilite/conclua o provisionamento do **Netlify Database**, se o painel pedir. A dependência `@netlify/database` permite que o build oficial detecte e provisione a base. Verifique a disponibilidade e a franquia de créditos/banco do seu plano antes de confirmar qualquer contratação. Este projeto não solicita upgrade pago.
6. Publique **somente o novo projeto**. O Netlify fornece `NETLIFY_DB_URL` e a configuração do driver à execução; o aplicativo os lê pelo SDK oficial. **Não copie a `DATABASE_URL` da VPS/local para o Netlify**, não configure manualmente uma URL de Neon/Supabase e não defina `NETLIFY_DB_DRIVER` no painel sem orientação do serviço.
7. Confirme no log de build o adaptador Next.js e as duas migrações. Na área Database, verifique o resultado das migrações. O banco inicial tem um funil vazio; nenhum cliente real nem seed de demonstração é publicado automaticamente.
8. Abra a **nova URL HTTPS**, informe as credenciais na caixa do navegador e execute a conferência abaixo. O site antigo continua no endereço anterior.

Se o assistente iniciar um deploy antes de permitir definir as variáveis, o aplicativo falha fechado (503) e nenhum endpoint é aberto. Configure as variáveis no novo projeto e faça um novo deploy. Tokens pessoais do Netlify não são necessários para conectar GitHub pelo painel; não os coloque nas variáveis do site.

## Migrações e isolamento do banco

Os arquivos ficam em `netlify/database/migrations/`:

- `001_crm.sql`: tabelas normalizadas, histórico, controle de revisão e funil vazio.
- `002_snapshot.sql`: snapshot de leitura e restrições adiadas para reordenar/transferir entidades em lotes sem inconsistência.

O build oficial lê `[database.migrations]`, prepara os arquivos em `.netlify/internal/db/migrations/` e a plataforma aplica as migrações na publicação. Não rode `db:migrate` no build Netlify e não apague tabelas para repetir uma migração. Migrações publicadas são imutáveis; mudanças futuras exigem um novo arquivo numerado.

O runner oficial registra arquivos em `netlify.migrations`; o runner legado da VPS registra checksums em `crm_migrations`. **Não aplique os dois runners no mesmo banco**: para esta implantação crie uma base Netlify nova e use apenas as migrações oficiais. Para migrar dados de uma base anterior, exporte/importe e confira em um destino separado. A migração 002 também foi validada sobre o esquema anterior sem apagar os registros.

Deploy Previews/branch deploys usam a conexão de banco fornecida pela plataforma para seu contexto; o pool não é compartilhado globalmente entre contextos. Não sobrescreva `NETLIFY_DB_URL` com uma URL de produção comum a todos os previews. Confira no painel a base/branch atribuída a cada preview antes de utilizá-lo. Se não precisar desses ambientes, desative builds de branches/previews no **novo projeto** para economizar créditos.

## Importar o backup anterior

1. No CRM antigo, use **menu do espaço de trabalho → Exportar backup**, no navegador que contém seus dados locais.
2. Exporte também o novo CRM se ele já contiver dados.
3. Na nova URL, escolha **Importar backup**, selecione o JSON v1 e revise a confirmação. Para esta versão serverless, use um arquivo menor que **4 MB**, deixando margem para o envelope da requisição.
4. Confirme a restauração. Ela substitui o conjunto compartilhado inteiro em uma transação, preserva IDs, funis, etapas e cartões e registra o estado anterior no histórico.
5. Recarregue a página e abra a nova URL em outro dispositivo para confirmar. O site antigo não é modificado pela importação.

## Conferir a versão publicada

Use somente dados fictícios nesta validação:

1. Sem credenciais, `/` e `/api/crm` devem solicitar autenticação (401); uma gravação com origem diferente deve ser rejeitada (403).
2. Cadastre um cliente, crie um funil e suas etapas, cadastre uma oportunidade e recarregue. Verifique os registros na área Database com consultas de leitura, como `SELECT count(*) FROM crm_customers;` e `SELECT revision FROM crm_state;`.
3. Arraste a oportunidade entre etapas e para uma etapa vazia. Recarregue e confira a etapa em outro dispositivo.
4. Edite em dois dispositivos: a atualização aparece na próxima sincronização ou ao recuperar foco. Gravar uma revisão antiga deve gerar aviso de conflito, sem sobrescrever a alteração remota.
5. Importe/exporte um backup fictício e confira o histórico. Em Network, a consulta com revisão inalterada deve retornar **304**, sem reenviar os dados.
6. Confirme que os arquivos JavaScript públicos não contêm senha, token ou URL do banco. As credenciais devem existir somente no servidor e no diálogo nativo de acesso do navegador.

Não execute a suíte E2E contra a URL publicada: ela restaura dados fictícios e só aceita loopback. O checklist acima deve ser feito no segundo projeto antes de considerá-lo liberado para uso.

## Rodar localmente sem Docker

Requisitos: Node.js 24 e npm. O Netlify CLI usa seu banco local oficial (PostgreSQL via PGlite e protocolo pg) e o runtime de Edge Functions utiliza Deno, obtido pelo CLI quando necessário. O ambiente precisa permitir acesso HTTPS aos recursos oficiais do Netlify e à distribuição do Deno; não desative TLS para contornar falhas de rede.

```bash
git switch feat/crm-netlify
npm ci
npm run setup:netlify
npm run netlify:db:migrate
npm run netlify:dev
```

Abra **http://localhost:8888** na mesma máquina. As credenciais geradas estão em `.env.local` (arquivo privado, nunca versionado). `setup:netlify` não sobrescreve um arquivo existente: se você vinha da VPS, mantenha seu backup e configure `CRM_ALLOWED_ORIGIN=http://localhost:8888` para este modo. O SDK recebe a conexão local do Netlify Dev; os dados ficam em `.netlify/db`, ignorada pelo Git. A porta 3000 é o servidor interno; abra pelo endereço 8888 para testar a execução integrada.

Não remova `.netlify/db` se quiser preservar seus dados locais. O banco local não envia automaticamente os dados para a nuvem: use o backup JSON para uma transferência explícita. Um computador ligado é necessário apenas enquanto você desenvolve localmente, não para o site publicado.

## Consumo e sincronização

- Uma aba visível e ativa consulta a revisão a cada **30 segundos**; após um minuto sem interação, a cada **120 segundos**. Abas ocultas ou sem interação por cinco minutos pausam. Voltar ao foco atualiza imediatamente.
- Resposta **304** quando não há mudanças, uma consulta SQL indexada na linha de revisão e nenhum reenvio do snapshot. Mesmo um 304 continua consumindo uma invocação de Function; não representa custo zero.
- Escritas em lote apenas das entidades alteradas, transações atômicas e pool com no máximo duas conexões por requisição, encerradas ao finalizar. Movimentar um cartão não regrava clientes inalterados.
- Em uma hora de atividade contínua, o intervalo regular cai de aproximadamente 1.440 consultas para 120 por aba, em comparação com os 2,5 segundos anteriores. Foco, salvamentos e recarregamentos geram requisições adicionais.

Monitore no painel créditos de build, Functions e Database, inclusive armazenamento e branches de preview. Configure alertas disponíveis e remova previews desnecessários. As franquias e condições comerciais podem mudar; esta configuração é compatível com serviços oficiais, mas não promete uso ilimitado ou custo sempre zero. O histórico armazena snapshots completos e cresce com cada gravação. Faça backups e avalie retenção antes de uma base grande; não há limpeza automática de histórico nesta etapa.

## Testes e limites da validação

```bash
npm run check
npm run test:netlify:db
npm run netlify:db:migrate
npm run netlify:dev
```

Em outro terminal, com a autorização de reset **somente para seu banco local de testes**:

```bash
CRM_E2E_ALLOW_RESET=true PLAYWRIGHT_BASE_URL=http://localhost:8888 npm run test:e2e
```

Instale o Chromium do Playwright (`npx playwright install --with-deps chromium`) ou informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. A suíte verifica os fluxos existentes, mouse, teclado e toque, colunas vazias, recarga, conflitos, importação e proteção da API.

`npm run test:netlify:package` valida o adaptador oficial, o bundle do proxy, os artefatos de migração, ausência de segredos nos arquivos públicos e invocação da função empacotada com GET/PUT/304 contra um Netlify Database local novo. O CLI 27.16.2 tenta provisionar Database mesmo com `netlify build --offline`; o teste usa uma cópia temporária e exclui apenas essa detecção remota do manifesto da cópia. O SDK continua instalado e é executado pelo teste. O manifesto de produção não é modificado. Esta verificação exige Deno e rede para o empacotador, e **não comprova provisionamento ou publicação no serviço hospedado**.

`npm run netlify:package` executa o build oficial completo, incluindo a integração de provisionamento, quando o checkout estiver vinculado **ao novo projeto** e autenticado. Não o use vinculado ao site antigo. A validação hospedada depende de acesso à conta, criação do segundo projeto e conferência do checklist. Nenhum projeto foi criado ou publicado automaticamente por esta alteração.

## Integrações futuras

Domínio, persistência, HTTP e componentes permanecem separados. WhatsApp Business e IA devem entrar por endpoints de servidor com assinatura de webhooks, idempotência e fila persistente. Credenciais continuam fora do navegador; trabalhadores não devem depender de um processo permanente dentro de uma Function. Resposta manual deverá pausar a IA por conversa atomicamente. Nenhum envio de WhatsApp ou atendimento automatizado foi ativado nesta etapa.
