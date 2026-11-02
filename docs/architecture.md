# Arquitetura do CRM com PostgreSQL

A branch `feat/crm-v2`, baseada em `feat/crm-netlify`, mantém os componentes da primeira versão e usa API Next.js com PostgreSQL pelo SDK oficial `@netlify/database`. O backup usa `schemaVersion: 2`; backups v1 são convertidos preservando IDs e nomes. A versão estática publicada no Netlify e o ZIP anterior não são modificados.

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

`crm_state` possui a revisão única do conjunto e um snapshot JSONB de leitura. `crm_history` é append-only pela aplicação e registra revisão, UUID da requisição, hash do conteúdo, operação e snapshots anterior/posterior. Importar um backup não apaga o histórico de transações. As atividades visíveis de cada negócio continuam no painel de detalhes, sem mudança de navegação.

Uma gravação bloqueia a linha de revisão, verifica a versão, compara entidades e executa upserts em lote apenas das linhas alteradas, além das exclusões explícitas. Restrições de posição e referências adiadas validam o estado final no commit. Linhas normalizadas, snapshot, histórico e revisão mudam na mesma transação. Uma única leitura SQL recupera o snapshot confirmado; uma revisão inalterada retorna 304 sem transferi-lo. Não edite tabelas diretamente: uma escrita externa deverá usar o repositório para manter o snapshot coerente. Qualquer erro causa rollback de tudo. Zod rejeita referências órfãs, IDs duplicados, funis sem etapas, valores inválidos e backups incompatíveis.

## Concorrência e sincronização

Dois clientes que gravam a mesma revisão não podem ter ambos sucesso: o segundo recebe 409. Repetir uma requisição já confirmada com o mesmo ID/conteúdo não gera outra gravação. Campos de formulários não são reaplicados automaticamente após conflito. Mudanças remotas invalidam o token de edição de formulários e movimentos em andamento, exigindo revisão/reabertura.

O protocolo HTTP usa snapshots completos e revisão global; a escrita SQL é incremental. Não há mesclagem por campo, paginação ou fila offline. Para bases maiores, a evolução é endpoints de comandos e revisão por entidade. A sincronização consulta a cada 30 segundos em atividade, 120 segundos após um minuto sem interação e pausa em aba oculta ou após cinco minutos inativa. Foco/visibilidade atualizam imediatamente. Um 304 ainda utiliza Function e banco. No modo demo, uma consulta adicional mantém limites compartilhados no PostgreSQL; monitore os créditos.

## Acesso e implantação

A demonstração usa `CRM_ACCESS_MODE=demo`, público e sem senha. A proteção HTTP Basic é opcional via `CRM_ACCESS_MODE=basic`, sem tela de login ou níveis de acesso; nesse modo, credenciais ausentes falham fechado. Ambos validam origem e formato das gravações. Gravações exigem origem exata e JSON, com limite de 4 MB. Para acesso externo, o servidor exige HTTPS; no Netlify o TLS e a execução são gerenciados pela plataforma, enquanto na VPS usa-se proxy reverso TLS e aplicativo em loopback. Credenciais nunca são enviadas no bundle cliente nem colocadas em `NEXT_PUBLIC_*`.

A proteção é de um espaço compartilhado. Ela não identifica autores individuais e não equivale a autenticação multiusuário. Essa será outra etapa antes de introduzir permissões ou auditoria por pessoa.

O [guia Netlify](netlify.md) descreve a preparação no projeto existente `lucky-donut-3d0c63`, a trava `CRM_DEPLOY_V2`, Database oficial, migrações e validação. O SDK usa a conexão do contexto atual de execução; pools Netlify têm até duas conexões e são encerrados por requisição, sem cache global que misture branches. Fora do Netlify, o pool nativo e a instalação [VPS](postgres.md) continuam disponíveis. O runner oficial e o legado não devem ser misturados no mesmo banco. Não há seed automático nem Supabase.

## WhatsApp Business e IA

Permanecem fora desta etapa. Devem entrar como serviços do servidor, com credenciais protegidas, validação de webhooks, idempotência, fila e modelos próprios de conversas/mensagens. A resposta manual de um atendente deverá pausar a IA atomicamente por conversa, e o trabalhador de IA deverá revalidar esse estado antes de enviar. Esses serviços podem reutilizar clientes, oportunidades e IDs existentes sem alterar a estrutura visual dos funis.

## Extensões v2

`crm_business_types`, `crm_sources`, `crm_sellers`, `crm_distribution_rules` e `crm_scheduled_activities` são normalizados e escritos incrementalmente na mesma transação do snapshot e do histórico. Regras mantêm prioridade por posição; agenda mantém datas UTC. Vendedores são cadastros comerciais, sem autenticação individual.

`crm_demo_limits` não participa dos backups/snapshots e controla requisições anonimamente por contadores atômicos compartilhados. `crm_conversations` e `crm_messages` são uma fundação de servidor, não exposta no snapshot; não existe webhook ou conexão WhatsApp ativa. Detalhes em [CRM v2](crm-v2.md).
