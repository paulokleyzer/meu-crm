# Arquitetura do CRM com PostgreSQL

A branch `feat/crm-postgres` mantém os componentes da primeira versão e substitui a persistência ativa por uma API Next.js com PostgreSQL. O esquema do backup continua `schemaVersion: 1`; os IDs de texto da versão anterior são aceitos. A versão estática publicada no Netlify e o ZIP anterior não são modificados.

## Fluxo de dados

`componentes → domínio imutável → store assíncrona → HTTP → validação no servidor → transação PostgreSQL`.

- `src/lib/crm.ts`: regras existentes de criação, edição, transferência e exclusão, independentes do React e do banco.
- `src/hooks/use-crm.ts`: snapshot confirmado, visualização otimista, fila de gravações do dispositivo, polling, tratamento de erros e invalidação de formulários desatualizados.
- `src/lib/http-repository.ts`: cliente same-origin, sem cache; repete uma falha de rede incerta usando o mesmo ID de requisição.
- `src/app/api/crm`: leitura e substituição validada do conjunto; importação é explícita e auditada.
- `src/server`: proteção, pool PostgreSQL, transações e migrações.

A UI não escreve no `localStorage` nem usa dados fictícios de fallback quando a API falha. O adaptador local em `src/lib/repository.ts` foi mantido como código de compatibilidade da versão anterior e para seus testes de formato; ele não participa da store atual.

## Modelo relacional

`crm_pipelines`, `crm_stages`, `crm_customers`, `crm_deals` e `crm_activities` armazenam as entidades separadamente. Etapas e oportunidades usam chaves estrangeiras; a referência composta garante que a etapa pertence ao funil. Valores usam `numeric(14,2)`, datas usam `date`/`timestamptz`, e posições mantêm a ordem do quadro.

`crm_state` possui a revisão única do conjunto. `crm_history` é append-only pela aplicação e registra revisão, UUID da requisição, hash do conteúdo, operação e snapshots anterior/posterior. Importar um backup não apaga o histórico de transações. As atividades visíveis de cada negócio continuam no painel de detalhes, sem mudança de navegação.

Uma gravação bloqueia a linha de revisão, verifica a versão, substitui as entidades na ordem exigida pelas chaves estrangeiras e grava histórico + revisão na mesma transação. Leitores usam transação read-only com snapshot repeatable-read: recebem um conjunto inteiro, nunca uma atualização parcial. Qualquer erro SQL causa rollback de tudo. A validação Zod rejeita referências órfãs, IDs duplicados, funis sem etapas, valores inválidos e backups incompatíveis antes da escrita.

## Concorrência e sincronização

Dois clientes que gravam a mesma revisão não podem ter ambos sucesso: o segundo recebe 409. Repetir uma requisição já confirmada com o mesmo ID/conteúdo não gera outra gravação. Campos de formulários não são reaplicados automaticamente após conflito. Mudanças remotas invalidam o token de edição de formulários e movimentos em andamento, exigindo revisão/reabertura.

O protocolo atual usa snapshots completos e revisão global, adequado a esta primeira versão centralizada. Não há mesclagem automática, colaboração por campo, paginação da base ou fila offline. A evolução para bases maiores é endpoints de comandos com revisão por entidade e escrita incremental; o domínio e os IDs estáveis já estão separados para essa evolução.

## Acesso e implantação

HTTP Basic protege a aplicação e a API, sem tela de login ou níveis de acesso no CRM. Credenciais/origem ausentes falham fechado. Gravações exigem origem exata e JSON, com tamanho limitado. Para acesso externo, o servidor exige uma origem HTTPS; a implantação usa proxy reverso TLS, aplicativo em loopback e banco na rede privada. Credenciais nunca são enviadas no bundle cliente nem colocadas em `NEXT_PUBLIC_*`.

A proteção é de um espaço compartilhado. Ela não identifica autores individuais e não equivale a autenticação multiusuário. Essa será outra etapa antes de introduzir permissões ou auditoria por pessoa.

O [guia operacional](postgres.md) contém configuração local, Docker/VPS, migrações, importação v1, backups e testes. Não há dependência de Supabase. Migrações são versionadas e conferidas por checksum, sem instalação automática ou seed em cada inicialização.

## WhatsApp Business e IA

Permanecem fora desta etapa. Devem entrar como serviços do servidor, com credenciais protegidas, validação de webhooks, idempotência, fila e modelos próprios de conversas/mensagens. A resposta manual de um atendente deverá pausar a IA atomicamente por conversa, e o trabalhador de IA deverá revalidar esse estado antes de enviar. Esses serviços podem reutilizar clientes, oportunidades e IDs existentes sem alterar a estrutura visual dos funis.
