# Contexto de QA — Crazy Chicken

Documento de referência para as demais skills de qualidade. Estado atualizado no checkout em 3 de outubro de 2026. Fatos externos à máquina, como configuração efetiva da Hostinger, banco de produção, e-mail e dados reais, permanecem identificados como não verificados.

## Product

- **Nome:** Crazy Chicken.
- **Tipo:** e-commerce de restaurante e painel operacional administrativo.
- **Propósito:** publicar um cardápio digital, registrar pedidos com entrega ou retirada e encaminhar a confirmação para o WhatsApp, enquanto a equipe administra catálogo e operação.
- **Produção documentada:** https://crazychicken247.com.br.
- **Painel documentado:** https://crazychicken247.com.br/admin/login.
- **Desenvolvimento local:** http://localhost:3000.
- **Staging:** nenhum ambiente de staging foi detectado ou confirmado no repositório.

### Jornadas críticas

1. Cliente abre a vitrine, consulta categorias, destaques, bebidas e busca produtos.
2. Cliente personaliza um produto com opções, define quantidade e observação e ajusta o carrinho antes de finalizar.
3. Cliente escolhe retirada ou entrega, informa dados e o servidor recalcula produtos, opções, taxa, pedido mínimo e total.
4. Cliente registra o pedido com chave de idempotência, recebe o código e abre a mensagem formatada no WhatsApp.
5. Cliente consulta o pedido registrado por código e telefone e acompanha a mudança de status.
6. Administrador autentica, mantém sessão, encerra sessão e acessa somente as seções permitidas para seu papel.
7. Equipe administra produtos, opções, disponibilidade, categorias, bairros, taxas, aparência, banners e uploads de mídia.
8. Proprietário configura horário automático, abertura manual ou fechamento manual; a API deve bloquear pedidos quando a loja estiver fechada.
9. Proprietário ou gestor administra convites, recuperação de senha, MFA opcional, suspensão de usuários e auditoria.

O produto atual não possui fluxo de pagamento PIX ou cartão integrado. Qualquer plano futuro de pagamento não deve ser tratado como cobertura existente.

## Tech Stack

- **Runtime:** Node.js 22.13.0 ou superior, com npm e `package-lock.json`.
- **Frontend e servidor:** Next.js 16.3.6 com App Router, React 19.2.8 e TypeScript 5.9.3.
- **API:** Route Handlers Next.js em `app/api`, com endpoints JSON REST-like; servidor de produção próprio em `server.js`.
- **Banco e acesso:** MariaDB ou MySQL na Hostinger, Drizzle ORM 0.45.2 e `mysql2` 3.24.4. Migrações SQL ficam em `db/migrations`.
- **Estilo e componentes:** Tailwind CSS 4.2.1, componentes React reutilizáveis e componentes de UI baseados em Radix e shadcn.
- **Integrações:** Resend para convites e recuperação por e-mail; WhatsApp por URL `wa.me` para confirmação do pedido; Instagram apenas como link da vitrine.
- **Cache e rate limit:** não há Redis ou cache externo detectado; existe rate limit em memória para fluxos específicos.
- **Uploads:** armazenamento persistente configurado por `UPLOAD_DIR`, externo à pasta temporária de build em produção.
- **Hospedagem de produção:** Hostinger com aplicação Node.js, comando de build `npm run build`, comando de início `npm start` e porta fornecida pelo ambiente.
- **Ferramentas de preview:** `vite.config.ts`, Vinext, Wrangler e plugin Cloudflare estão presentes para preview e tooling local; isso não foi considerado a fonte de produção, que está documentada como Hostinger.
- **CDN e monitoramento:** nenhum CDN, APM ou serviço de monitoramento operacional foi detectado no repositório.
- **Monorepo:** não detectado. Não há `pnpm-workspace.yaml`, `turbo.json` ou `nx.json`.

## Test Stack

### E2E e integração

- **Framework:** Playwright 1.60.0 com TypeScript, configuração em `playwright.config.ts` e lint específico por `eslint-plugin-playwright`.
- **Organização:** testes em `e2e/tests`, fixtures e mocks em `e2e/fixtures`, Page Objects em `e2e/pages` e inicialização isolada do servidor em `e2e/support/global-setup.ts`.
- **Projetos:** Chromium desktop em 1440 × 900 e mobile Chromium em 320 × 720, 375 × 812 e 414 × 896.
- **Cobertura:** cardápio e busca, loja fechada, personalização e quantidade no carrinho, entrega e taxa por bairro, retirada, abertura do WhatsApp, navegação mobile, acesso sem sessão e navegação do painel autenticado.
- **Isolamento:** vitrine, pedido, WhatsApp e APIs administrativas usam dados determinísticos e interceptação de rede. O modo de vitrine E2E só é aceito fora de produção quando `E2E_MODE=true`; produção ignora o cabeçalho de teste.
- **Comandos:** `npm run test:e2e`, `npm run test:e2e:list`, `npm run test:e2e:types` e `npm run test:e2e:ui`.
- **Limite atual:** a suíte não valida MariaDB, Resend, arquivos persistentes, WhatsApp real, produção ou staging; também não cobre ainda rastreamento completo do pedido nem todos os papéis e mutações administrativas.

### Unitário e componente

- **Framework:** nenhum framework unitário selecionado.
- **Padrão a adotar quando esta camada for criada:** Vitest, conforme o default da skill para projeto sem infraestrutura unitária.
- **Testes atuais:** `scripts/test-store-rules.mjs`, `scripts/test-security.mjs` e `scripts/test-whatsapp-order.mjs` executam asserts diretamente sobre módulos; `tests/store-hours.test.cjs` e `tests/admin-recovery.test.cjs` usam `node:test` e `node:assert/strict`.
- **Configuração:** não há `vitest.config.*` nem `jest.config.*`.
- **Dados de teste:** fixtures inline e um adaptador de banco simulado; não há factory, seed automatizado ou banco MySQL de teste configurado.

### Visual, acessibilidade e performance

- **Estado:** regressão visual automatizada com Playwright em Chromium no desktop 1440 × 900 e no mobile 320 × 720, 375 × 812 e 414 × 896. Ainda não há auditoria dedicada de acessibilidade ou teste de performance.
- **Cobertura visual:** 31 baselines versionados cobrem topo e hero, logo com tolerância de zero pixels, banner de bebidas, dois cards de produto, carrinho, dashboard administrativo e menu lateral do painel nos três tamanhos mobile.
- **Estabilidade:** relógio e dados administrativos são fixados, APIs usam mocks determinísticos, animações e cursores são desativados durante a captura e o conteúdo dinâmico do navegador de desenvolvimento é ocultado.
- **Comandos:** `npm run test:visual` compara os baselines e `npm run test:visual:update` atualiza imagens após revisão explícita. O processo de aprovação está documentado em `e2e/VISUAL_TESTING.md`.

### Validação executada neste levantamento

- `npm.cmd run test:store`: passou.
- `npm.cmd run test:security`: passou.
- `npm.cmd run test:whatsapp`: passou.
- `npm.cmd run test:e2e:types`: passou.
- `npm.cmd run test:e2e:list`: listou 13 execuções em 4 arquivos.
- `npm.cmd run test:e2e`: 13 de 13 execuções passaram em Chromium desktop e nos três viewports mobile.
- `npm.cmd run test:visual:update`: gerou 31 baselines Windows para 11 cenários visuais.
- `npm.cmd run test:visual`: 11 de 11 cenários passaram na comparação subsequente dos baselines.
- `node --test tests/admin-recovery.test.cjs tests/store-hours.test.cjs`: 10 passaram e 3 falharam. As falhas de recuperação acontecem porque a senha fixa do teste não contém número, contrariando a regra atual; os cenários de concorrência e rollback não chegam ao trecho que pretendem validar.
- `npm.cmd run lint`: passou sem erros, com 12 avisos existentes de `@next/next/no-img-element`.
- `npm.cmd run build`: passou com Next.js 16.3.6, webpack, TypeScript e geração de 27 páginas e rotas.
- Os scripts Node emitiram aviso de reinterpretação como módulo ES por ausência de `type` no `package.json`; isso não impediu os três comandos de teste.

## CI/CD

- **CI detectado:** GitHub Actions em `.github/workflows/e2e.yml`, acionado em pull request e manualmente.
- **Remotos detectados:** `origin` aponta para o GitHub `andrewklayverr/crazychicken-cardapio`; também existe um remote `sites` de tooling. O checkout analisado estava em `main`, alinhado com `origin/main` no commit `0c0b03c` antes das mudanças visuais locais.
- **Deploy documentado:** Hostinger executa `npm run build` e `npm start` com Node 22 ou superior. O build usa o fallback webpack configurado no projeto.
- **Gates Playwright:** o job funcional instala dependências e Chromium, valida tipos, executa lint e roda os 13 cenários. Um job visual separado em `windows-latest` baixa os baselines por Git LFS e bloqueia diferenças acima do limite configurado. O workflow ainda não foi configurado como proteção obrigatória de branch e não publica a aplicação.
- **Banco:** backup e migração são operações separadas. A documentação exige backup antes de migrações e confirmação das migrações no MariaDB antes de considerar uma publicação pronta.
- **Artefatos:** em falhas, o workflow publica `playwright-report` e `test-results`; o job visual publica o artefato `visual-regression-report` com imagens esperadas, atuais e diffs para revisão.
- **Rollback:** não existe procedimento automatizado detectado; o rollback depende do estado do deploy na Hostinger, do Git e do backup do banco e uploads.

## Environments

| Ambiente | URL ou origem | Estado e paridade |
| --- | --- | --- |
| Desenvolvimento | `http://localhost:3000` | Next.js local. Fluxos com banco exigem MariaDB ou MySQL e variáveis locais derivadas de `.env.example`. |
| E2E local e CI | `http://127.0.0.1:3100` | Servidor Next.js iniciado e encerrado pela suíte. Catálogo e APIs críticas são controlados por fixture; não comprova banco ou integrações externas. |
| Preview local | tooling Vite, Vinext e Wrangler | Configuração presente para preview e Cloudflare local; não há evidência de paridade completa com Hostinger, MariaDB, uploads persistentes ou Resend. |
| Staging | não detectado | Não há URL, banco, pipeline ou configuração de staging confirmados. |
| Produção | `https://crazychicken247.com.br` | Hostinger, Node.js, MariaDB ou MySQL, Resend, WhatsApp por `wa.me` e `UPLOAD_DIR` persistente. A configuração efetiva de conta, DNS, variáveis e integrações não foi acessada neste levantamento. |

Diferenças com maior impacto de paridade: produção depende de banco remoto, origem HTTPS exata para CSRF e links, diretório de uploads fora do build, DNS e remetente verificado no Resend. O desenvolvimento local e o preview não provam que essas dependências estejam operacionais na Hostinger.

## Quality Goals

Não existem metas de cobertura, flakiness ou duração declaradas no código, nem ferramenta de cobertura instalada. Para a maturidade atual, ficam registradas estas metas operacionais mensuráveis:

- **Gate de publicação:** lint sem erros, build de produção bem-sucedido e 100 por cento dos testes automatizados existentes passando antes de publicar.
- **Lógica de negócio:** atingir pelo menos 60 por cento de cobertura de linhas quando uma ferramenta de cobertura for introduzida, priorizando cálculo de pedido, horários, autorização, uploads e recuperação.
- **E2E:** manter cardápio, loja fechada, carrinho, entrega, retirada, WhatsApp, mobile e painel no gate; adicionar rastreamento por código e telefone para completar os 5 primeiros fluxos críticos.
- **Flakiness:** manter taxa abaixo de 2 por cento em janela móvel de 30 dias.
- **Duração:** testes de lógica abaixo de 3 minutos e suíte E2E completa abaixo de 15 minutos.
- **Segurança:** nenhuma falha crítica ou alta conhecida aberta em autenticação, autorização, CSRF, uploads, exposição de segredo ou cálculo de total no gate de publicação.
- **Estado atual:** o gate de 100 por cento ainda não é atendido porque a suíte combinada `node:test` possui 3 falhas conhecidas; cobertura e taxa de flakiness ainda não são medidas.

## Risk Areas

| Área | Nível | Impacto de negócio | Impacto × likelihood e foco de teste |
| --- | --- | --- | --- |
| Registro de pedido, total no servidor e idempotência | Crítico | Pedido com valor incorreto, duplicado ou perdido gera prejuízo direto e quebra o canal de vendas. | Alto × alto. Testar concorrência, opções, quantidade, pedido mínimo, taxa, loja fechada, repetição da chave e divergência entre total exibido e persistido. |
| Autenticação administrativa, sessão, papéis, CSRF e recuperação | Crítico | Acesso indevido pode expor pedidos, alterar catálogo ou controlar a operação. Recuperação quebrada impede o proprietário de operar. | Alto × médio. Testar acesso sem sessão, papéis owner, manager e attendant, logout, expiração, origem, token único, MFA e recuperação concorrente. A suíte atual tem 3 falhas neste domínio. |
| Upload persistente e entrega de mídia | Crítico | Logo, banners e fotos ausentes degradam a vitrine e podem impedir a operação visual do cliente. | Alto × alto. Validar assinatura real, limites, nome seguro, autorização, `UPLOAD_DIR` absoluto e persistente, leitura por `/api/media` e comportamento após novo deploy. Já houve evidência histórica de 404 em produção, dependente de configuração externa. |
| Paridade de banco e migrações | Crítico | Schema incompleto pode derrubar pedidos, login, configurações ou equipe após publicação. | Alto × médio. Testar backup, aplicação ordenada das migrações 001 a 005, schema compatível, conexão real e rollback operacional. Não confundir formato de `DATABASE_URL` com conexão validada. |
| Horários, entrega, bairros e taxas | Importante | A loja pode aceitar pedido fechado, cobrar taxa errada ou recusar uma entrega válida. | Alto × médio. Há E2E determinístico para loja fechada, retirada, entrega e taxa; manter cobertura unitária para America/Sao_Paulo, virada de meia-noite, modo manual e intervalos sobrepostos. |
| WhatsApp e e-mail transacional | Importante | A equipe pode não receber o pedido ou o cliente pode não conseguir confirmar convite e recuperação. | Médio × médio. A URL `wa.me` e o payload do pedido são cobertos com mock; ainda faltam WhatsApp real, ausência de número, Resend, origem dos links e falhas do provedor. |
| Responsividade e acessibilidade do fluxo de compra e painel | Importante | Falhas em mobile impedem a maioria dos clientes de comprar ou da equipe de operar. | Alto × médio. Há cobertura funcional e visual em 320, 375 e 414 px; ainda faltam teclado completo, foco e auditoria automatizada de acessibilidade. |
| Persistência do carrinho | Importante | Recarregar ou fechar a página pode apagar a seleção do cliente e reduzir conversão. | Médio × alto. O estado atual é apenas em memória e não persiste após recarregar; tratar como comportamento conhecido até existir requisito e implementação de persistência. |
| Cabeçalhos, CSP e exposição de dados | Monitor | Configuração incorreta pode bloquear funcionalidades ou expor dados do cliente. | Alto × baixo a médio. Revalidar scripts, imagens, conexões, cookies, erros e payloads de API após mudanças de autenticação ou infraestrutura. |

## Team

- **Headcount declarado no repositório:** não há arquivo de equipe, processo ou ownership formal.
- **Modelo operacional para este checkout:** solo ou zero QA dedicado detectável; razão dev:QA tratada como efetivamente infinita para planejamento.
- **Ownership recomendado pelo estado atual:** o responsável pelo desenvolvimento mantém testes de lógica, integração e build; a mesma pessoa executa a regressão crítica de browser até existir QA dedicado.
- **Metodologia:** não detectada.
- **Momento de QA:** não formalizado. O contexto atual recomenda shift-left em qualquer mudança de autenticação, banco, pedido, upload ou deploy, porque esses fluxos atravessam código e configuração externa.

## Conventions

- **Organização:** páginas e Route Handlers em `app`, UI em `components`, regras compartilhadas em `lib`, persistência em `db`, scripts operacionais em `scripts` e testes em `tests`.
- **Nomes de testes existentes:** scripts `test-*.mjs` em `scripts`, arquivos `*.test.cjs` em `tests` e E2E `*.spec.ts` em `e2e/tests`.
- **Seletores E2E:** roles, labels, placeholders e nomes acessíveis; a suíte não usa seletores CSS nem depende de classes de estilo.
- **Estratégia de locator:** priorizar contrato visível ao usuário e nomes acessíveis estáveis; adicionar `data-testid` somente quando um fluxo não puder ser selecionado semanticamente.
- **Dados de teste:** fixtures determinísticas, interceptação de API por contexto e Page Objects. Não há seed, factory ou isolamento de um banco MySQL real.
- **Anti-flakiness:** auto-wait do Playwright, zero `waitForTimeout`, zero `force`, traces e screenshots em falha, retries apenas no CI e execução com um worker para estabilidade do servidor Next.js local.
- **Branches:** checkout em `main`; não há convenção de branch ou requisito de pull request documentado no repositório.
- **Segredos:** valores reais devem permanecer no ambiente de execução; `.env.example` contém apenas exemplos. Não imprimir `DATABASE_URL`, chaves, senhas, tokens ou hashes em testes e relatórios.
- **Segurança de servidor:** Route Handlers e mutações administrativas devem conservar autorização no servidor, CSRF, origem HTTPS configurada, limites de requisição, validação de entrada e controle de upload. O guia `DESENVOLVIMENTO_SEGURO.md` é a referência para mudanças futuras.
- **Deploy e migração:** publicar código não substitui backup, migração, configuração de variáveis, restauração de uploads ou validação do domínio. Cada um desses itens deve ser evidenciado separadamente.

## Evidence and Limits

- Fontes consultadas: `package.json`, `package-lock.json`, `README.md`, `HOSTINGER.md`, `.env.example`, `next.config.mjs`, `drizzle.config.ts`, `vite.config.ts`, `AGENTS.md`, `DESENVOLVIMENTO_SEGURO.md`, `playwright.config.ts`, `.github/workflows/e2e.yml`, rotas, bibliotecas, scripts e testes existentes.
- A análise não acessou a conta Hostinger, o banco real, o Resend, o WhatsApp, DNS, logs de produção ou um navegador em staging. Portanto, URLs e configurações documentadas não equivalem a uma validação operacional.
- A infraestrutura E2E adiciona uma seam de dados públicos protegida por `NODE_ENV !== "production"` e `E2E_MODE=true`, além de permitir `unsafe-eval` na CSP somente em desenvolvimento para a hidratação do Next.js. A política de produção permanece sem `unsafe-eval`.
