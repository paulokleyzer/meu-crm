# Usar e evoluir a CRM v2

A interface aprovada foi estendida com duas entradas na navegação: **Atividades** e **Configurações**. Os componentes de funil, etapas e dnd-kit continuam os mesmos, com um destino adicional para transferência entre funis durante o arraste.

## Tipos, origens e responsáveis

Em Configurações, crie, renomeie ou exclua tipos de negócio e origens. Não há exemplos fixos obrigatórios. Cada oportunidade escolhe tipo e origem separadamente, e os filtros podem combiná-los.

Renomear uma origem atualiza os negócios e as regras que a usam. Renomear um responsável atualiza negócios e agenda. Desativar preserva atribuições anteriores, mas o nome deixa de ser oferecido para novas atribuições; editar um registro já atribuído continua permitido. Pelo menos um responsável precisa ficar ativo. Nomes de responsáveis são cadastros comerciais, sem login ou permissões.

Excluir tipo/origem preserva as oportunidades, remove essa classificação e desativa regras relacionadas. A confirmação informa isso. Ao excluir um funil, as oportunidades são transferidas como antes; regras do funil removido são desativadas e apontadas ao destino escolhido, para revisão explícita.

## Regras e simulador

Uma regra combina tipo e origem com **E**. Um campo vazio aceita qualquer valor. A primeira regra ativa correspondente, na ordem configurada, vence. A única regra padrão é considerada depois das regras com condições, mesmo que apareça antes na lista. Desativar a padrão impede seu uso. O destino é sempre a primeira etapa atual do funil escolhido.

Na criação/edição de uma oportunidade, o modo inicial é **Escolher funil manualmente**, preservando o comportamento anterior. Selecionar **Aplicar regras automáticas** mostra a regra e seu destino; sem correspondência, o salvamento automático fica indisponível e a escolha manual continua acessível. Alterar regra, origem ou categoria não redistribui negócios existentes por conta própria. Arrastar ou editar manualmente continua possível após uma distribuição.

O simulador informa a classificação e permite criar um cliente e uma oportunidade **fictícios**, juntos em uma gravação transacional. Não recebe nem envia mensagens. O mecanismo puro em `src/lib/crm-v2.ts` pode ser reutilizado por um futuro serviço de entrada validado no servidor.

## Agenda e lembretes

Tarefas, ligações, reuniões e retornos possuem data/hora, responsável, cliente e oportunidade opcionais entre si (pelo menos uma associação). Ao escolher uma oportunidade, o cliente correspondente é vinculado. Alterar o cliente do negócio mantém a agenda coerente. Excluir o negócio preserva a atividade associada ao cliente.

A agenda é uma lista cronológica com filtros de pendentes, futuras, vencidas, concluídas e responsável. Permite editar, concluir, reabrir e excluir atividades. Excluir uma atividade não apaga clientes ou negócios. O histórico antigo das oportunidades continua separado da agenda.

Horários são digitados e exibidos no fuso do navegador e armazenados em UTC. O lembrete configurável e os indicadores são recalculados dentro do CRM aberto; cartões indicam atividade vencida. Não há notificação de sistema, push, e-mail ou execução em segundo plano.

## Dashboard

Exibe oportunidades abertas, ganhos, perdas, valores e tabelas por funil, origem, tipo e responsável. **Conversão = ganhos ÷ (ganhos + perdidos)**, com zero quando nenhum negócio foi encerrado. Todos os períodos são considerados; não há atribuição de campanha além da origem registrada na oportunidade.

## Persistência e compatibilidade

O snapshot/backup passa a `schemaVersion: 2`. A migração SQL é aditiva e mantém registros, IDs, funis, ordem e revisão. Origens e vendedores anteriores são convertidos em cadastros persistidos. O importador aceita v1 e v2; o v1 é convertido antes da validação. Importação continua uma substituição explícita do conjunto inteiro, com confirmação e histórico.

Categorias, regras, agenda e negócios entram no mesmo protocolo de revisão global, fila otimista, idempotência e transações. Mudanças simultâneas não são mescladas silenciosamente: a segunda gravação recebe 409 e formulários antigos exigem revisão. Não há fila offline ou colaboração por campo.

## WhatsApp Business e IA

O atalho de clientes usa somente `https://wa.me/<E.164>`. Telefones brasileiros de 10/11 dígitos recebem DDI 55; números internacionais devem informar `+` ou `00`. Valores inválidos/ambíguos não geram link. Abrir o atalho não conecta a API e não envia mensagem automaticamente.

A migração 004 prepara `crm_conversations` e `crm_messages`, fora do snapshot público. `src/server/whatsapp.ts` fornece persistência idempotente de eventos **já verificados** e pausa da IA com revisão. Conversas começam pausadas; uma resposta humana verificada pausa novamente, e novas mensagens recebidas não reativam a IA. Somente reativação explícita no servidor, com a revisão atual, pode liberar o estado.

Não há webhook público, credencial, trabalhador de IA ou chamada à Meta nesta etapa. A detecção de resposta pelo aplicativo WhatsApp Business dependerá da modalidade oficial de coexistência e dos eventos/echoes fornecidos e autorizados pela Meta. O adaptador futuro deverá verificar assinatura, distinguir mensagens do aplicativo das enviadas pela própria API e registrar IDs da origem. Não se promete essa detecção sem a integração oficial habilitada.

Recebimento/classificação automática, criação de contatos, conversas e envios futuros deverão reutilizar o domínio e transações, com fila/outbox e verificação de pausa antes de cada envio. Não executar trabalhadores permanentes dentro de Functions. Nenhuma API não oficial ou interface de conversas simulada foi criada.
