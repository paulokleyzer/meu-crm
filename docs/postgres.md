# PostgreSQL, acesso protegido e instalação na VPS

Este guia descreve a instalação alternativa em servidor próprio, originada na branch `feat/crm-postgres`. Para a branch atual `feat/crm-netlify`, prefira o [guia Netlify sem VPS e sem Docker](netlify.md). Não exige Supabase. O domínio, o layout, a navegação e os componentes dnd-kit são os mesmos da versão funcional anterior. As mudanças visíveis se limitam aos avisos de gravação/sincronização e aos textos que antes diziam que os dados ficavam apenas no navegador.

A v2 é uma demonstração sem senha por padrão. Este guia alternativo mantém o perfil VPS com `CRM_ACCESS_MODE=basic` (padrão do Compose VPS) e credenciais configuradas. Não use dados reais no modo `demo`. O procedimento recomendado está no [guia do projeto Netlify existente](netlify.md); a publicação continua dependendo de autorização e `CRM_DEPLOY_V2=true`.

## Executar no computador ou neste ambiente

Requisitos: Node.js 24 LTS, npm e Docker com Compose. Use o checkout existente; cada tarefa na nuvem já é isolada, sem necessidade de outro worktree.

```bash
git switch feat/crm-postgres
npm ci
npm run setup:local
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

`setup:local` gera senhas aleatórias e cria `.env.local` com permissão 0600, sem sobrescrever um arquivo existente. Se você já tem `.env.local`, preserve-o e complete os nomes descritos em `.env.example` manualmente. O banco é exposto somente em `127.0.0.1:55432`; os dados ficam no volume Docker `crm_pgdata` do projeto.

Abra **http://127.0.0.1:3000** na máquina em que iniciou o aplicativo. O navegador solicitará o usuário `CRM_BASIC_USER` e a senha `CRM_BASIC_PASSWORD` presentes em `.env.local`. Não há uma tela de login no CRM nem papéis/níveis de acesso. A proteção externa HTTP Basic impede acesso anônimo à aplicação e à API, inclusive em desenvolvimento. Não coloque essa senha no código, no chat ou em variáveis `NEXT_PUBLIC_*`.

`CRM_ALLOWED_ORIGIN` deve ser exatamente a origem usada no navegador, sem barra final. Se estiver configurado `http://127.0.0.1:3000`, não abra por `http://localhost:3000`: são origens diferentes. O servidor rejeitará a gravação por uma origem divergente.

`db:migrate` pode ser repetido e confere checksums das migrações aplicadas. `db:seed` só funciona em banco inicial sem contatos, oportunidades ou histórico; não sobrescreve dados existentes. O banco recém-migrado já tem um funil vazio e não precisa do seed para funcionar.

Para produção local, pare o servidor de desenvolvimento e execute:

```bash
npm run build
npm start
```

Os servidores locais escutam em loopback por padrão. Este ambiente não fornece URL pública de prévia da porta 3000.

## Variáveis

| Nome                  | Finalidade                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Conexão PostgreSQL do servidor. Nunca é enviada ao navegador.                                                                      |
| `POSTGRES_PASSWORD`   | Senha do usuário do container PostgreSQL no Compose. Deve coincidir com a senha da URL.                                            |
| `CRM_BASIC_USER`      | Usuário de acesso HTTP Basic.                                                                                                      |
| `CRM_BASIC_PASSWORD`  | Senha de acesso com pelo menos 16 caracteres; prefira uma senha longa e aleatória.                                                 |
| `CRM_ALLOWED_ORIGIN`  | Origem exata permitida para gravações. HTTPS é obrigatório para domínios externos.                                                 |
| `TEST_DATABASE_URL`   | Banco exclusivo de desenvolvimento/CI, onde os testes de integração criam e removem schemas isolados.                              |
| `CRM_E2E_ALLOW_RESET` | Só `true` em banco descartável de testes: a suíte E2E restaura dados fictícios antes de cada cenário. Nunca habilitar em produção. |

Credenciais ausentes ou configuração de origem inválida fazem a aplicação/API responder 503. Não há modo anônimo de fallback. Uma conexão remota ao PostgreSQL deve usar TLS com verificação de certificado (por exemplo `sslmode=verify-full` e CA apropriada); a conexão interna do Compose fica na rede privada Docker.

## Hostinger VPS

Use uma VPS com Docker/Compose, Nginx e ferramentas para emitir um certificado TLS, como Certbot. A hospedagem estática anterior não executa esta API. Para começar, uma VPS com memória suficiente para compilar o Next.js (recomendado ao menos 4 GB) evita limitações durante o build; monitore os recursos conforme o uso crescer.

1. Mantenha o site estático do Netlify no endereço atual. Escolha outro endereço, como um subdomínio dedicado ao CRM com PostgreSQL, e aponte seu DNS para a VPS.
2. Clone o repositório na VPS e selecione `feat/crm-postgres`. Não copie `.env.local` de desenvolvimento para a VPS.
3. Crie um arquivo `.env.vps` protegido (`chmod 600 .env.vps`), a partir dos nomes de `.env.example`. Configure valores reais localmente na VPS. No Compose de produção, use:

   ```text
   POSTGRES_PASSWORD=<senha nova e aleatória do banco>
   DATABASE_URL=postgresql://meu_crm:<a mesma senha, codificada para URL>@db:5432/meu_crm
   CRM_ACCESS_MODE=basic
   CRM_BASIC_USER=<seu usuário de acesso>
   CRM_BASIC_PASSWORD=<outra senha nova e aleatória de pelo menos 16 caracteres>
   CRM_ALLOWED_ORIGIN=https://<subdomínio escolhido>
   ```

   Os marcadores acima são exemplos de formato, não valores para copiar. Senhas hexadecimais longas evitam ambiguidades de codificação na URL. Não configure as variáveis de teste na VPS de produção.

4. Prepare os containers, aplique as migrações e suba a aplicação:

   ```bash
   docker compose -p meu-crm-vps --env-file .env.vps -f compose.vps.yaml build app
   docker compose -p meu-crm-vps --env-file .env.vps -f compose.vps.yaml up -d db
   docker compose -p meu-crm-vps --env-file .env.vps -f compose.vps.yaml run --rm app npm run db:migrate
   docker compose -p meu-crm-vps --env-file .env.vps -f compose.vps.yaml up -d app
   ```

   Para uma demonstração nova, opcionalmente execute `run --rm app npm run db:seed` antes de cadastrar/importar dados. A imagem também contém as ferramentas de migração. Nenhuma migração ou seed é executado automaticamente durante um restart.

5. Configure o Nginx para encaminhar o subdomínio para `127.0.0.1:3000`. Há um exemplo em `deploy/nginx-crm.conf`. Substitua o domínio, valide a configuração com `nginx -t`, emita o certificado e configure redirecionamento obrigatório de HTTP para HTTPS antes de utilizar o CRM. A autenticação Basic precisa de HTTPS para proteger a senha em trânsito.
6. Deixe somente SSH, HTTP para emissão/redirecionamento e HTTPS liberados no firewall da VPS. O Compose publica a aplicação apenas em loopback e não publica a porta do PostgreSQL.
7. Abra o endereço HTTPS, informe as credenciais na caixa do navegador e verifique criar cliente, mover um cartão e recarregar em outro dispositivo.

Não remova o volume do banco ao atualizar. **`docker compose down -v` apaga o volume e não é um comando de atualização.** Faça backup antes de cada migração/atualização. Senhas do PostgreSQL já inicializado não são alteradas apenas editando `.env.vps`; a rotação exige alterar a credencial no PostgreSQL e atualizar a URL da aplicação de forma coordenada.

### Build neste ambiente com proxy corporativo

O Dockerfile aceita opcionalmente a CA de sessão sem gravá-la na imagem. Neste ambiente gerenciado, use o certificado fornecido pela plataforma:

```bash
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t meu-crm-postgres .
```

Na VPS comum, o build do Compose não precisa desse segredo. TLS e a verificação de pacotes permanecem habilitados.

## Importar os dados anteriores

1. No site antigo do Netlify, use **avatar PK → Exportar backup** no navegador que contém os seus funis e clientes.
2. No novo CRM, exporte um backup do banco atual antes de substituir qualquer conteúdo.
3. Use **avatar PK → Importar backup** e selecione o JSON v1 da versão anterior.
4. Revise a confirmação e restaure. A operação substitui o conjunto compartilhado inteiro, não apenas os dados do dispositivo, e é atômica: clientes, funis, etapas, negócios e atividades são validados e gravados juntos.
5. O estado anterior e o novo ficam registrados em `crm_history`. Recarregue e abra em outro dispositivo para confirmar.

Não há migração automática do `localStorage`, porque ele pertence a cada navegador e ao domínio do site antigo. Nada é enviado para o novo servidor sem essa importação explícita. IDs antigos de texto e funis personalizados são preservados; o JSON de exportação continua no formato `schemaVersion: 1`.

## Sincronização e conflitos

Nesta branch, a interface atualiza a cada 30 segundos em atividade e 120 segundos após um minuto sem interação; pausa em aba oculta ou após cinco minutos inativa. Recuperar foco/visibilidade atualiza imediatamente. A confirmação “Salvo no PostgreSQL” aparece após a API confirmar a transação. Enquanto grava, o cartão pode se mover imediatamente; se a operação falhar, ele volta ao estado confirmado e o erro é exibido. Formulários não fecham nem exibem sucesso quando o banco recusa a gravação.

Cada gravação carrega a revisão que o cliente leu e um UUID da requisição. O PostgreSQL bloqueia a revisão, compara o valor e grava dados + nova revisão + histórico na mesma transação. Uma requisição repetida com o mesmo ID e conteúdo é idempotente; o mesmo ID com outro conteúdo é rejeitado. Um cliente desatualizado recebe 409 e precisa revisar sua alteração. Formulários abertos antes de uma atualização remota também exigem reabertura para evitar sobrescrever dados novos com campos antigos.

O controle de revisão é do conjunto inteiro, adequado a esta primeira versão centralizada: até alterações em negócios diferentes podem gerar conflito. Não há edição colaborativa caractere a caractere, mesclagem automática ou fila offline. Para uso intenso, a próxima evolução é revisão por entidade e endpoints de comandos específicos.

## API e histórico

- `GET /api/crm`: dados e revisão atual, com ETag e sem cache.
- `PUT /api/crm`: `{ data, baseRevision, requestId, operation }`; `operation` é `change` ou `import`.
- `GET /api/crm/history`: últimas 100 revisões, operação e data.

Todos exigem autenticação. PUT também exige `Origin` exatamente igual à origem configurada (no Netlify também aceita as URLs exatas do deploy fornecidas pela plataforma), `Content-Type: application/json` e corpo de até 4 MB nesta branch. Há validação de campos, IDs, referências, valores financeiros e versão do backup. Erros: 401 sem autenticação, 403 origem inválida, 413 corpo excedido, 415 formato incorreto, 422 dados inválidos, 409 conflito e 503 banco/configuração indisponíveis. Respostas não expõem senhas, URLs de conexão ou mensagens internas do PostgreSQL.

Os snapshots anteriores ficam no banco em `crm_history.before_data` e os posteriores em `after_data`. O histórico não é apagado por uma importação ou exclusão de oportunidade. As atividades visíveis de um negócio continuam no painel de detalhes; o histórico de transações não cria uma nova tela ou muda a navegação.

## Backups e recuperação

O menu de exportação gera o JSON confirmado recebido do servidor. Também é possível executar `npm run db:export -- backup.json`; o arquivo é criado com permissão 0600 e não sobrescreve outro existente.

Para backup completo do PostgreSQL na VPS, sem imprimir senhas:

```bash
docker compose -p meu-crm-vps --env-file .env.vps -f compose.vps.yaml exec -T db pg_dump -U meu_crm -d meu_crm -Fc > crm-backup.dump
```

Armazene backups criptografados fora da VPS e verifique a restauração em um banco separado. A recuperação completa usa `pg_restore` no banco de destino e as mesmas versões das migrações. Não restaure diretamente sobre produção sem backup e janela de manutenção.

## Testes

```bash
npm run check
npm run test:db
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

O terceiro comando pode omitir a variável se o Chromium do Playwright estiver instalado. Os testes E2E compartilham o banco e rodam em sequência, com reset fictício explícito em loopback. Traces estão desativados para não registrar cabeçalhos de autenticação. Testes de integração criam um schema com nome aleatório `crm_test_*`, validam SQL real, concorrência, idempotência, rollback e recuperação por nova conexão, e removem somente esse schema ao finalizar. Nunca execute as suítes de integração/E2E contra uma base de produção.
