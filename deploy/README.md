# Pacote para a Hostinger

Este ZIP preserva a versão estática anterior. A nova branch `feat/crm-postgres` usa servidor Node.js e banco, com instalação descrita em [PostgreSQL e Hostinger VPS](../docs/postgres.md); não deve ser publicada substituindo arquivos desse ZIP.

`meu-crm-hostinger-0.1.0.zip` contém a aplicação estática compilada da primeira versão funcional. Ele pode ser extraído na raiz de um site/subdomínio dedicado ao teste do CRM. Não precisa de Node.js na hospedagem e não inclui dados cadastrados por usuários.

O pacote foi gerado com `npm run build:static`, compactando os arquivos de `out/` com `index.html` e `_next/` na raiz do ZIP. Não é atualizado automaticamente quando o código muda. Para publicar outra versão, refaça a compilação e substitua o arquivo por um novo pacote do conteúdo de `out/`.

Veja o [passo a passo de publicação](../docs/hostinger.md). Não há login nesta versão; utilize dados fictícios. A criação de funis, os cadastros e os movimentos dos cartões são executados pelo JavaScript no navegador e persistidos localmente.
