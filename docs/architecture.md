# Arquitetura da primeira versão

## Escopo atual

Aplicação Next.js App Router com uma tela cliente hidratada a partir do `localStorage`. O HTML inicial tem um estado de carregamento; a leitura dos dados ocorre no navegador. O primeiro acesso recebe dois funis e dados fictícios. Não há backend, login ou chamadas a serviços de terceiros.

O fluxo é `componentes → operações de domínio → validação Zod → repositório local → store React`. `useSyncExternalStore` publica snapshots consistentes e ouve alterações em outras abas. Falhas de persistência têm aviso explícito; a interface continua funcionando durante a sessão. Dados inválidos já armazenados são preservados.

## Modelo e invariantes

- `Pipeline`: nome, descrição e lista ordenada de etapas.
- `Stage`: identificador estável, nome e probabilidade de 0 a 100.
- `Customer`: contato, empresa, e-mail e telefone.
- `Deal`: cliente e etapa vinculados, valor em BRL, ordem na etapa, status, responsável, origem, prioridade, previsão, notas e datas.
- `Activity`: registro de criação, edição e transferência de uma oportunidade.

Identificadores novos usam UUID; os dados demonstrativos usam identificadores estáveis para tornar os testes determinísticos. O schema impede identificadores duplicados, referências órfãs, funis sem etapas, valores negativos e backups de versões incompatíveis. A mesma validação é usada na importação e na gravação.

Operações imutáveis em `src/lib/crm.ts` são independentes do React. Excluir etapa ou funil transfere oportunidades antes de remover a estrutura. A exclusão de negócio remove seu histórico e mantém o contato. Reordenações não criam atividades falsas de transferência.

A ordenação dos funis é a ordem da lista; a ordenação das etapas fica na lista de cada funil; a dos cartões usa `position`. A lista e o quadro usam os mesmos negócios filtrados. Receita ponderada = soma de valor × probabilidade da etapa para abertos, 100% para ganhos e 0% para perdidos.

## Arrastar e soltar

Cada coluna é um `useDroppable` independente, mesmo quando não contém cartões. Cada cartão usa `useSortable`, com `SortableContext` por etapa e `DragOverlay` para a representação durante o movimento. Mouse, toque com atraso e teclado têm sensores próprios. O movimento é confirmado no `onDragEnd`; cancelar ou soltar fora do quadro mantém os dados anteriores.

O editor de funis usa outro contexto para reordenar etapas e também oferece botões de subir/descer. Nenhuma configuração depende exclusivamente de arrastar com o mouse. Todos os detalhes dos negócios podem ser editados por formulário.

## Caminho para PostgreSQL

1. Adicionar autenticação, autorização por workspace e uma API no servidor antes de usar dados reais.
2. Mapear entidades para tabelas `workspaces`, `pipelines`, `stages`, `customers`, `deals`, `activities`. Usar chaves estrangeiras e índices por workspace, funil, etapa e posição. Valores financeiros devem usar `numeric(14,2)` ou centavos inteiros no banco.
3. Mover as operações do domínio para uma camada de serviços da API, com transações para transferências/exclusões/reordenações e validação no servidor. A validação no navegador não é uma fronteira de segurança.
4. Substituir o adaptador local por um adaptador HTTP. O contrato atual é síncrono por ser local; a store deverá tratar carregamento e erros assíncronos, concorrência e cancelamento ao adotar a API. Os componentes e as operações puras podem ser reaproveitados.
5. Adicionar revisão otimista/controle de versão por registro e resolução de conflitos entre usuários. A sincronização local atual segue a última gravação e não oferece colaboração multiusuário.
6. Oferecer importação transacional dos backups v1; não conectar o banco diretamente ao navegador nem colocar credenciais em variáveis `NEXT_PUBLIC_*`.

Nenhum banco ou endpoint fictício foi criado nesta etapa. A ausência de infraestrutura externa permite testar o CRM imediatamente.

## WhatsApp Business e atendimento por IA

Esses módulos devem entrar como serviços no servidor, separados do quadro:

- Adaptador oficial da WhatsApp Business Platform, com credenciais somente no servidor, validação de assinatura de webhooks, IDs externos únicos e processamento idempotente.
- Entidades próprias para conversas e mensagens ligadas a clientes e oportunidades; mensagens não devem ser gravadas nas notas do negócio como substituto de um modelo de conversa.
- Fila de processamento e auditoria para direcionamento por origem/tipo de negócio, notificações e automações. Eventos como criação, alteração de etapa e recebimento de mensagem podem alimentar essas regras.
- Estado de atendimento por conversa: `automático`, `humano`, `pausado`. Uma resposta manual deve pausar a IA atomicamente; o trabalhador de IA deve revalidar esse estado imediatamente antes de enviar qualquer mensagem.
- Consentimento, permissões, retenção de mensagens e regras de templates devem fazer parte da implementação oficial futura.

Não há credenciais, telas de login, mensagens simuladas ou ações de WhatsApp nesta primeira versão.

## Limitações conhecidas

Persistência por navegador/origem, sem controle de acesso ou colaboração remota. O `localStorage` tem limite de espaço e gravação síncrona; é adequado para esta demonstração, não para bases grandes. O schema de backup é versionado (`schemaVersion: 1`) para permitir migrações futuras. Exportação/importação usa JSON e não executa conteúdo fornecido pelo arquivo.

O layout responsivo suporta o navegador móvel, sem prometer aplicativo nativo ou recursos offline de PWA. A base React e o domínio separado permitem reaproveitar regras em uma futura experiência móvel.
