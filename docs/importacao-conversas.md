# Recuperação de leads — importação de conversas

**Branch de desenvolvimento:** feat/crm-recuperacao-leads. Não substitua a produção antes de conferir a prévia.

## Implementado

- Nova seção Recuperação, preservando o layout dos funis.
- Leitura local, no navegador, de exportações WhatsApp TXT e ZIP (somente TXT interno; mídias ignoradas), até 100 conversas pendentes por lote, 60 MB por lote, 20 MB por arquivo e 5 MB por transcrição. **Não há limite total de lotes:** conclua a revisão/importação, limpe a análise local e carregue o próximo conjunto. Essa versão ainda não mantém uma fila de múltiplos lotes entre recargas.
- Leitura de histórico iPhone e Android, mensagens com múltiplas linhas, participantes, nomes, telefones disponíveis e detecção aproximada de grupos.
- Triagem inicial por regras. Essa triagem não é inteligência artificial e nunca deve ser tratada como decisão definitiva.
- Revisão por conversa: categoria, situação, evidências, nome, telefone, tipo de negócio, funil e etapa.
- IA opcional via endpoint privado, com JSON estruturado e consentimento explícito, usando chave separada de API da OpenAI no servidor.
- Aprovação manual para cada oportunidade. Gravação transacional com auditoria da operação chat_import e prevenção conservadora de duplicidades. Até 30 oportunidades por gravação.
- Não armazena a transcrição completa, não envia mensagens e não cria contatos sem aprovação.

## Segurança antes de dados reais

A aplicação atual está em CRM_ACCESS_MODE=demo, com banco compartilhado. **Não carregue conversas reais nela.** Em modo demo, a prévia funciona somente para dados fictícios; a análise com IA e a operação de importação estão bloqueadas também no servidor.

Antes de usar conversas reais:
1. Configure uma instância de prévia ou o projeto privado, sem substituir a produção.
2. Configure variáveis no Netlify em escopos apropriados, com HTTPS:
   - CRM_ACCESS_MODE=basic
   - CRM_BASIC_USER=usuario_admin
   - CRM_BASIC_PASSWORD=senha_unica_de_16_ou_mais_caracteres
   - CRM_ALLOWED_ORIGIN=URL_HTTPS_EXATA_DA_INSTANCIA
   - CRM_CHAT_IMPORT_API_KEY=chave_OpenAI_PRIVADA
   - CRM_CHAT_IMPORT_MODEL=gpt-5-mini (opcional)
3. Nunca coloque senhas ou chaves em arquivos versionados, no chat ou em nomes NEXT_PUBLIC_.
4. Verifique autenticação de páginas, API CRM e API de análise; faça backup do banco e valide a migração SQL 005.
5. Teste primeiro com exportações fictícias. Depois obtenha consentimentos e analise obrigações de tratamento de dados (LGPD).

O uso da API OpenAI tem custo por consumo independente da assinatura ChatGPT. O endpoint usa store:false, mas enviará a transcrição à API somente quando o operador autorizar e clicar em analisar.

## Como usar

1. WhatsApp Business: abra cada conversa, toque no nome do contato, exporte a conversa **sem mídia** e salve TXT/ZIP. A exportação oficial é individual.
2. CRM protegido > Recuperação > Selecionar conversas (até 100 por lote). Para mais conversas, finalize o lote, use Concluir lote / começar outro e repita; não existe limite total de registros importados.
3. Confira a triagem inicial. Grupos, fornecedores e conversas sem interesse não se tornam clientes por padrão.
4. Com a API de IA configurada, autorize explicitamente o envio à OpenAI e clique Analisar com IA; revise cada resultado e suas evidências.
5. Ajuste classificação e estágio; marque apenas conversas individuais classificadas como interesse ativo ou recuperável e sem oportunidade duplicada.
6. Clique em Importar oportunidades aprovadas. O CRM salva o resumo revisado, nunca a conversa integral.

## Limites

- Sem sincronização automática da Meta ou Coexistência nesta fase; não migre o número existente por conta própria.
- IA: no máximo 5.000 mensagens e 100 mil caracteres por conversa. Históricos maiores não são processados por completo nesta versão e ficam bloqueados para importação; exigem síntese em partes com rastreabilidade na próxima evolução.
- Mídias, PDFs, áudios e contatos anexos não são analisados.
- Desistência não é inferida por silêncio. A triagem sem IA é de baixa confiança; mesmo a IA exige revisão humana.
- Fornecedores e grupos devem ter cadastros separados em fase posterior.
- Arquivos e sugestões permanecem apenas na memória da aba; fechar ou recarregar limpa a análise não aprovada. Resumo das oportunidades aprovadas fica no PostgreSQL.
- Nenhum contato é enviado automaticamente. A API de IA deve receber controle de custos e rate limits persistentes antes de uso em escala.
