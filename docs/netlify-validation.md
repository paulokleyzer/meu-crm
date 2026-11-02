# Validação da adaptação Netlify

Execução em 2 de novembro de 2026, na branch `feat/crm-netlify`, baseada no commit `840adaa` de `feat/crm-postgres`. Somente dados fictícios e bancos locais foram utilizados. Nenhum projeto foi criado, vinculado ou publicado no Netlify e o site `lucky-donut-3d0c63.netlify.app` não foi alterado.

| Verificação                                 | Resultado                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint e TypeScript                         | Passaram, sem avisos do projeto.                                                                                                                     |
| Vitest unitário                             | 38 testes passaram.                                                                                                                                  |
| PostgreSQL 16 nativo                        | 11 testes passaram, incluindo concorrência, idempotência, rollback e migração do esquema anterior com dados.                                         |
| Banco local oficial `@netlify/database-dev` | 4 testes passaram: migrações repetíveis, SDK, movimento de oportunidade, recuperação após parar/reabrir e bloqueio do runner legado em base oficial. |
| Playwright + Chromium em Netlify Dev        | 19 testes passaram, com API protegida e banco local oficial.                                                                                         |
| Build de produção `build:netlify`           | Passou com Next.js 16.4.3 e Node.js 24.                                                                                                              |
| Prettier e `git diff --check`               | Passaram.                                                                                                                                            |
| Empacotamento oficial                       | Adaptador Next.js 5.16.5, Function, proxy Edge e dois artefatos SQL gerados e conferidos. Ressalva de rede abaixo.                                   |
| Função empacotada                           | Invocada localmente: 401 sem credenciais, GET/PUT autenticados, recuperação por SQL e 304 sem corpo passaram.                                        |
| Segredos em arquivos públicos               | Valores privados disponíveis na execução não foram encontrados nos arquivos do navegador examinados pelo teste.                                      |
| Provisionamento/publicação hospedados       | **Pendente: requer segundo projeto e acesso à conta Netlify.**                                                                                       |

Os testes de navegador cobrem criação/edição/duplicação/exclusão de funis e etapas, mouse, teclado e toque no celular, destino vazio, recarga, cadastro manual de clientes e oportunidades, filtros, detalhes, importação/exportação, sincronização entre dispositivos, conflito de formulário, acessibilidade e falhas de gravação. Os componentes do quadro e seus estilos não foram reconstruídos.

## Limites do empacotamento local

O CLI 27.16.2 tenta provisionar Database mesmo com `--offline`. Sem uma conta vinculada isso falha antes do build. `test:netlify:package` usa uma cópia temporária, removendo somente a detecção de provisionamento remoto do manifesto dessa cópia. O manifesto real mantém o SDK e a integração oficial. A função gerada usa o SDK instalado e um Netlify Database local novo, com `DATABASE_URL` removida para impedir fallback ao PostgreSQL nativo.

O empacotador também informou restrição de rede ao importar `https://edge.netlify.com/bootstrap/globals/types.ts`. Apesar do aviso, gerou o bundle eszip e o manifesto com a rota do proxy; ambos são conferidos pelo teste. A execução da Function foi validada, mas o comportamento do Edge na infraestrutura hospedada permanece parte da conferência obrigatória do novo projeto. TLS e a proteção de acesso permaneceram habilitados.

Dois testes de backup falharam na primeira execução do navegador porque o indicador de desenvolvimento do Next.js sobrepunha o botão do menu. A configuração agora oculta esse indicador de desenvolvimento; os 19 cenários passaram na repetição completa. Não foi necessário mudar o layout do CRM.

O relatório temporário detalhado é gerado em `.netlify/runtime-validation.json`, ignorado pelo Git. Ele mantém `hostedDeploymentValidated: false` para não confundir testes locais com uma publicação real. A ativação deve seguir o [guia do segundo projeto Netlify](netlify.md), incluindo seu checklist de validação após publicar a nova URL.
