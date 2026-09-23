# Guia de desenvolvimento seguro para aplicações web

Aplicável, conforme a arquitetura, a projetos Next.js, Vite/React, APIs Node.js e integrações. Este guia orienta revisão e implementação; não afirma que um projeto está livre de vulnerabilidades. O [SECURITY.md](SECURITY.md) trata do reporte de falhas.

## Regra de aplicação

Antes de alterar segurança, identifique framework e versões, hospedagem, fronteiras cliente/servidor, fluxo de autenticação, provedores externos, subdomínios, cookies, webhooks, uploads e requisitos de produto. Registre o risco e a escolha de mitigação. Faça mudanças pequenas, teste em desenvolvimento ou staging e verifique os fluxos legítimos antes de publicar. Se uma diretriz não se aplicar, documente o motivo; não reduza uma proteção silenciosamente para fazer um fluxo voltar a funcionar.

Em projeto só estático, medidas como cookies de sessão, banco e rate limiting pertencem ao serviço que realmente executa essas funções. Código no navegador e prefixos de ambiente públicos nunca protegem segredos.

## 1. Segredos e configuração

- Mantenha segredos apenas em serviços confiáveis no servidor. Em Next.js, `NEXT_PUBLIC_*` é enviado ao cliente; em Vite, variáveis com prefixo `VITE_*` são expostas ao código do navegador. Também revise dados incorporados ao HTML, payloads de RSC e respostas de API.
- Diferencie credenciais secretas de identificadores públicos de SDK. Mesmo uma chave pública requer restrições apropriadas no provedor; ela não concede autorização por si só.
- Injete segredos em configuração segura do ambiente de execução; não faça commit de valores reais. Versione apenas um `.env.example` sem segredos, e ignore arquivos locais pertinentes ao projeto.
- Revogue/rotacione imediatamente um segredo vazado. Apagá-lo do arquivo ou do histórico Git não anula o acesso obtido.
- Separe ambientes e privilégios. Não registre segredos em logs, mensagens de erro, analytics nem relatórios de build.

## 2. Autenticação, autorização e acesso a objetos

- Autentique e autorize no servidor cada ação e leitura protegida. Valide papel, propriedade e permissão **para o objeto solicitado**; não confie em `userId`, `role`, flags ou controles do frontend.
- Trate Server Actions, Route Handlers, API routes, endpoints Express e funções serverless como entradas públicas. Server Components permitem executar lógica no servidor, mas não substituem checagens de autorização. Em Next.js, considere `server-only` para módulos exclusivos do servidor.
- Proteja consultas e recursos contra IDOR/BOLA. Filtre por escopo de locatário/usuário no servidor e teste acesso cruzado entre usuários e organizações.
- Use senhas com hash apropriado e parâmetro de custo atual (por exemplo, Argon2id; bcrypt com configuração adequada quando necessário). Nunca armazene senha em texto puro, hash rápido sem proteção apropriada ou cifra reversível como substituto do hash.

## 3. Sessões, cookies e dados no navegador

- Prefira sessões ou tokens de autenticação em cookies definidos no servidor com `HttpOnly`, `Secure` em produção HTTPS e `SameSite` escolhido para os fluxos reais. `HttpOnly` impede leitura do cookie por JavaScript, mas não elimina ações maliciosas em uma página com XSS.
- Avalie `SameSite=Lax` ou `Strict` conforme navegação externa, login federado e redirecionamentos. `SameSite=None` requer `Secure` e proteção CSRF adequada quando houver autenticação por cookie. Analise `Path`, `Domain`, expiração e prefixo `__Host-` (exige `Secure`, `Path=/` e ausência de `Domain`).
- Evite guardar identificadores de sessão, JWT, senhas e segredos em `localStorage` ou `sessionStorage`. Minimize dados pessoais armazenados no cliente; justifique sua necessidade, duração e exposição a XSS/dispositivo compartilhado. Não trate Web Storage como repositório seguro.
- Defina expiração no servidor (absoluta e, quando adequada, por inatividade), invalidação no logout e revogação/rotação segundo o desenho da sessão. Não dependa do evento de fechar aba: o navegador pode não dispará-lo de modo confiável.
- Teste login, logout, renovação, recuperação de conta, múltiplas abas e sessões expiradas.

## 4. XSS, renderização e CSP

- Use o escaping padrão do React para texto. Valide formatos de entrada no servidor e faça encoding de saída adequado ao contexto (HTML, atributo, URL, JS). Validação de entrada não substitui proteção na saída.
- Evite `innerHTML`, `dangerouslySetInnerHTML`, execução dinâmica e URLs com esquemas perigosos. Se precisar renderizar HTML não confiável, use sanitizador mantido e adequado ao ambiente, com configuração restrita; teste os casos reais.
- Implemente CSP de acordo com os scripts, estilos, imagens, fontes, conexões e embeds utilizados. Prefira nonce/hash quando o framework e o modo de renderização permitirem. Não copie uma CSP rígida genérica nem use `unsafe-inline` como conserto automático.
- Comece, quando viável, com `Content-Security-Policy-Report-Only`, analise violações e só depois aplique a política de bloqueio. Valide login, pagamento, captcha, analytics, uploads, fontes e integrações legítimas.
- Considere `frame-ancestors`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS no domínio servido por HTTPS, configurados para a necessidade do projeto. Não adicione cabeçalhos apenas para obter nota em scanner.

## 5. CSRF e CORS

- Se a autenticação usa cookies enviados automaticamente, proteja operações que mudam estado contra CSRF. Escolha o mecanismo conforme a arquitetura: token, verificações de `Origin`/`Referer` e/ou defesas mantidas pelo framework, com `SameSite` como camada adicional. Não mude estado em GET.
- CORS controla leitura de respostas por navegadores; não autentica clientes nem substitui autorização ou CSRF. Configure apenas origens que precisam de acesso via navegador. Para requisições com credenciais, use origem explícita e `Access-Control-Allow-Credentials: true`; evite refletir qualquer `Origin` sem validação.
- Revise redirecionamentos e callbacks de OAuth, cookies entre subdomínios e webhooks antes de fechar origens ou exigir token CSRF. Webhooks costumam exigir verificação de assinatura e não devem depender de cookies de usuário.

## 6. Entradas, consultas e arquivos

- Valide tipo, tamanho, limites e estrutura no servidor, inclusive em APIs usadas apenas pelo frontend. A validação no cliente melhora a experiência, mas é contornável.
- Use consultas parametrizadas ou APIs seguras do ORM. Evite concatenar entrada em SQL/NoSQL ou expressões de filtro; valide campos usados em ordenação e seleção dinâmica.
- Em uploads, limite tamanho, tipos permitidos e quantidade; verifique o conteúdo real quando aplicável, gere nomes seguros, armazene fora de execução pública e confira autorização na leitura. Considere varredura de malware para o risco do projeto.
- Limite a exposição de erros e dados retornados. Evite enviar registros completos do banco para Client Components, HTML inicial ou APIs.

## 7. Abuso, observabilidade e dependências

- Aplique limitação de taxa no ponto adequado para login, recuperação de senha, registro, OTP e endpoints caros. Considere limites por conta, IP e outros sinais para não punir usuários em redes compartilhadas. CAPTCHA/desafios adicionais são medidas condicionais ao abuso e à acessibilidade.
- Para DDoS volumétrico, considere proteção na borda (CDN/WAF/provedor); limitar requisições apenas dentro do Node.js pode ser insuficiente.
- Registre eventos de segurança sem senha, token, cookie, chave, cabeçalho `Authorization` ou dados pessoais desnecessários. Controle acesso e retenção dos logs.
- Mantenha lockfile e versões suportadas. Use alertas e auditoria (`npm audit`, Dependabot ou equivalente), avalie se a vulnerabilidade afeta o uso real e atualize com revisão, testes e build. Não aplique `npm audit fix --force` automaticamente.
- Source maps de produção devem seguir uma decisão consciente: não publique mapas com fontes internas por acidente; se precisar deles para diagnóstico, restrinja o acesso ao serviço de monitoramento. Desabilitá-los não torna o JavaScript enviado ao navegador secreto.

## Verificação antes de entregar uma alteração de segurança

1. Descreva ameaça, arquivos afetados e comportamento legítimo que precisa funcionar.
2. Revise dependências entre frontend, API, autenticação, cookies, domínios e serviços externos.
3. Faça a menor mudança que mitigue o risco; inclua testes de segurança relevantes (por exemplo, usuário sem permissão, CSRF ou entrada maliciosa) e regressão do fluxo legítimo.
4. Rode testes e build existentes. Teste manualmente os fluxos que dependem de browser, redirecionamento ou provedores externos quando necessário.
5. Registre mitigação, resultados e riscos restantes. Se não for possível verificar um fluxo, indique isso explicitamente; não declare que nada poderá quebrar.

## Aplicação neste projeto

- O MariaDB da Hostinger é a fonte de contas, sessões, tokens e limites administrativos; senhas usam `scrypt` e tokens são armazenados somente como hash.
- Mutações administrativas exigem sessão ativa, token CSRF e origem igual a `APP_URL`. Em produção, a ausência ou configuração inválida de `APP_URL` bloqueia a operação.
- A autenticação legada por variáveis fica desativada em produção, salvo ativação temporária e explícita por `ALLOW_LEGACY_ADMIN_AUTH=true`.
- Uploads novos aceitam somente PNG, JPG e WEBP confirmados pela assinatura do arquivo. SVG legado é servido com CSP isolada e não é aceito em novos envios.
- Convites e redefinições são de uso único, limitados por conta/token e IP e consumidos dentro de transação.
- O rate limit em memória dos pedidos reduz abuso local, mas não substitui a proteção volumétrica da Hostinger, CDN ou WAF.
- Nenhuma revisão garante ausência total de vulnerabilidades; execute os testes, a auditoria de dependências e uma validação em staging a cada mudança de autenticação ou infraestrutura.

## Referências técnicas

- [OWASP: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP: Cross-Site Request Forgery](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP: Cross-Site Scripting](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP: Content Security Policy](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [OWASP: REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security)
- [GitHub: Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
