# Validação da CRM v2

Validação em 2 de novembro de 2026 na branch `feat/crm-v2`, baseada em `feat/crm-netlify` (`42de3fe`). Todos os registros e eventos de teste são fictícios. Nenhum projeto Netlify foi criado, vinculado ou publicado. `main` e o site `lucky-donut-3d0c63.netlify.app` foram preservados.

| Verificação                    | Cobertura                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint / TypeScript / Prettier | Código e configuração.                                                                                                                                   |
| Vitest unitário                | 60 testes: domínio anterior, catálogos, regras, agenda, lembretes, WhatsApp, métricas, importação e modos de acesso.                                     |
| PostgreSQL 16                  | 14 testes: migração com dados anteriores, CRUD normalizado v2, revisão, idempotência, rollback, limites concorrentes e pausa explícita da IA.            |
| Banco local oficial Netlify    | 5 testes: quatro migrações repetíveis, SDK, gravação de configuração/regras/agenda, recuperação após parar/reabrir e proteção contra runners misturados. |
| Playwright + Chromium          | 34 cenários de interface, API e sincronização no Netlify Dev, com acesso anônimo.                                                                        |
| Build de produção              | Next.js 16.4.3, Node.js 24 e comando `build:netlify`.                                                                                                    |
| Empacotamento oficial          | Adaptador 5.16.5, Function, bundle/manifesto do proxy Edge e quatro artefatos SQL. Ressalva de rede abaixo.                                              |
| Função empacotada              | Basic opcional/401, demo sem senha/200, origem/403, CRUD v2, consulta SQL, 304 e limite/429 com `Retry-After`.                                           |
| Segredos                       | Valores privados disponíveis na execução não foram encontrados nos arquivos públicos examinados pelo teste.                                              |
| Publicação hospedada           | **Não realizada: depende do segundo projeto e da ação de publicação do usuário.**                                                                        |

Os testes de navegador incluem os cenários anteriores de funil, colunas vazias, reordenação, mouse, teclado e toque; acrescentam arraste entre funis, cadastro sem senha, link E.164, cadastros configuráveis, regras criadas/editadas/excluídas pela interface, prioridades, padrão, simulador e override manual, filtros, dashboard, quatro tipos de atividade, atraso, conclusão, reabertura, exclusão, recarga, lembrete e sincronização de agenda/responsáveis entre dispositivos. Testam também formulário antigo, v1 importável, atualização v1 indevida/426, corpo excessivo/413 e acessibilidade/responsividade.

Resultado final: **113 testes passaram** (60 unitários + 14 PostgreSQL + 5 Netlify Database local + 34 de navegador). O relatório final do Playwright registrou 34 esperados, zero falhas, zero instáveis e zero ignorados. Lint, TypeScript, build de produção, formatação e `git diff --check` passaram.

## Evidência de persistência

Os testes não usam `localStorage` ou mocks como prova de persistência. Consultam PostgreSQL real e tabelas normalizadas, recuperam dados por nova conexão e reabrem o diretório persistente do motor local oficial Netlify. O CLI oficial aplicou 003/004 sobre a base local anterior, que já possuía 001/002 e dados fictícios, sem reset.

A função produzida pelo adaptador é invocada com um banco oficial local novo. `DATABASE_URL` é removida desse processo, impedindo fallback ao banco nativo; o SDK usa `NETLIFY_DB_URL`. Um cliente, categoria, origem, responsável, regra, oportunidade e atividade são gravados e recuperados também por SQL.

## Limitações e problemas corrigidos

O CLI 27.16.2 tenta provisionar Database até com `netlify build --offline`. A validação local usa uma cópia temporária e remove somente essa detecção do manifesto da cópia; mantém o SDK instalado/executado e não altera o manifesto real.

A rede deste ambiente bloqueou a importação de `https://edge.netlify.com/bootstrap/globals/types.ts`. O empacotador gerou eszip e manifesto com a rota do proxy, conferidos pelo teste, e a Function foi executada. Isso não comprova a execução Edge ou o provisionamento hospedados. Ambos devem ser conferidos no segundo projeto, conforme o [guia Netlify](netlify.md). TLS permaneceu habilitado.

A ampliação do drag and drop inicialmente interferiu na detecção de colisões por teclado. Os destinos de outros funis passaram a ser excluídos da detecção do teclado dentro do quadro, preservando as coordenadas anteriores. A suíte verifica os dois fluxos.

Os testes de acessibilidade passaram a usar movimento reduzido para não medir opacidade durante a animação dos diálogos. Os textos das novas telas com contraste insuficiente foram corrigidos. Testes de exclusão/desativação aguardam a confirmação da gravação, além do estado otimista; as novas telas exibem o estado de salvamento.

O relatório temporário `.netlify/runtime-validation.json` permanece ignorado pelo Git e registra `hostedDeploymentValidated: false`. A regra `build.ignore` exige `CRM_DEPLOY_V2=true` no segundo projeto, e continua bloqueando o nome/endereço do site antigo, para que o envio da branch não libere uma publicação automaticamente.
