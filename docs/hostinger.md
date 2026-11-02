# Colocar a versão de testes no ar na Hostinger

> Este guia e o ZIP referem-se à versão estática anterior (`feat/crm-v1`). Para a nova versão com banco centralizado, siga [PostgreSQL e Hostinger VPS](postgres.md). O ZIP antigo permanece sem alterações e não inclui a API PostgreSQL.

A versão atual do CRM funciona no navegador, usando React e `localStorage`. Pode ser publicada como arquivos estáticos em uma hospedagem que sirva HTML, CSS e JavaScript, sem servidor Node.js, PostgreSQL ou chave de API. Os funis, o cadastro de clientes e o arrastar e soltar continuam funcionando.

## Preparar os arquivos

Para fazer o upload sem instalar o projeto, baixe o pacote já compilado [meu-crm-hostinger-0.1.0.zip](../deploy/meu-crm-hostinger-0.1.0.zip) e siga a seção de publicação abaixo. Esse arquivo contém a versão de testes atual; após alterações futuras no código, gere um novo pacote.

Para gerar os arquivos a partir do código:

No repositório, na branch `feat/crm-v1`:

```bash
npm ci
npm run build:static
```

O resultado fica em `out/`: `index.html`, diretório `_next/`, ícone e demais arquivos gerados pelo Next.js. Essa é a pasta a publicar. A compilação estática também usa `.next/` durante o processamento; caso queira voltar a executar `npm start`, refaça o build normal com `npm run build`. Execute builds com o servidor Next.js parado.

Compacte **o conteúdo** de `out/`, de modo que `index.html` e `_next/` estejam na raiz do ZIP. Não envie o código-fonte, `node_modules`, `.next` ou somente o arquivo `index.html`.

## Publicar pelo hPanel

1. No hPanel da Hostinger, escolha um site de testes ou crie um subdomínio destinado ao CRM. Use uma hospedagem de sites que permita enviar arquivos pelo Gerenciador de arquivos. Um produto limitado a construtor de sites pode exigir outro plano/produto para upload de uma aplicação própria.
2. Abra o **Gerenciador de arquivos** do site/subdomínio e entre na **raiz de publicação** configurada para ele. Em uma hospedagem comum, ela é `public_html`; a pasta de um subdomínio depende da configuração mostrada no painel.
3. Faça upload do ZIP e extraia o conteúdo diretamente nessa raiz. Depois da extração, ela deve conter `index.html` e `_next/` lado a lado. Se ficar uma pasta intermediária `out/`, mova o conteúdo dela para a raiz do site.
4. Use um site/subdomínio dedicado para não sobrescrever outro site. Se a raiz já tiver uma página padrão, preserve uma cópia antes de substituí-la. Um `index.php` antigo também pode ter precedência sobre `index.html`; remova-o da raiz apenas se ele pertencer ao site de testes que será substituído.
5. Aguarde o domínio/subdomínio apontar para a hospedagem e ative o certificado SSL no painel. Se a Hostinger oferecer um domínio temporário para esse site, ele também pode ser usado para os testes.
6. Abra pelo navegador o endereço HTTPS atribuído ao site ou ao subdomínio. O link vem dessa configuração da Hostinger; executar `npm start` neste ambiente não cria esse endereço.

Publique na raiz do site/subdomínio. Esta configuração não usa `basePath` para servir dentro de uma subpasta como `/crm`.

## Testar a interface

1. Abra **Gerenciar funis → Criar funil** e crie etapas personalizadas.
2. Acesse **Clientes → Novo cliente** para cadastrar manualmente um contato.
3. Use **Nova oportunidade** para associar um negócio ao cliente.
4. Arraste o cartão entre etapas, inclusive para uma coluna vazia, e clique nele para editar os detalhes.
5. Recarregue a página: os dados continuam salvos no mesmo navegador e no mesmo endereço.

Os dados são locais a cada navegador/origem. Outro computador, navegador ou domínio começará com seus próprios dados fictícios. Para transferir seus dados de teste, use **avatar PK → Exportar backup / Importar backup**. Não há login, sincronização multiusuário nem integração com WhatsApp; use dados fictícios nesta versão pública de testes.

## Validar o pacote antes do upload

Sirva `out/` por HTTP, por exemplo com Python instalado:

```bash
python3 -m http.server 3001 --directory out
```

Abra o endereço local da porta 3001 no computador onde executou esse comando. Não abra `index.html` por `file://`, pois os arquivos do Next.js precisam ser servidos por HTTP/HTTPS.

Opcionalmente, execute os testes do navegador contra o servidor estático:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

`PLAYWRIGHT_BASE_URL` seleciona o servidor a testar e evita iniciar o servidor Next.js. No ambiente deste projeto, um Chromium já instalado pode ser selecionado com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.

Para atualizar a versão hospedada, gere um novo `out/` e substitua o pacote do site de testes. Preserve os backups dos dados do navegador. Uma atualização de arquivos não publica os dados de `localStorage` dos usuários.

## Quando adicionar o backend

Ao integrar PostgreSQL, login, WhatsApp ou IA, a hospedagem estática sozinha não executará os serviços do servidor. Nessa etapa, será necessário um produto com suporte a Node.js/API ou uma VPS, conforme a arquitetura escolhida. O comando `npm run build` e o servidor `npm start` continuam disponíveis para a versão Next.js normal.
