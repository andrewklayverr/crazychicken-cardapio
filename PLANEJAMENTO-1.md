# Planejamento 1

## Plataforma multi-restaurante sem alterar a Crazy Chicken

### Resumo

Criar uma aplicação SaaS independente usando o código atual apenas como base. A Crazy Chicken continuará no repositório, banco, domínio e hospedagem atuais, sem receber alterações.

O novo produto terá:

- Novo repositório privado e histórico Git próprio.
- Novo banco MariaDB/MySQL.
- Nova aplicação na hospedagem.
- Novo domínio neutro.
- Endereços como `restaurante.plataforma.com.br`.
- Uma única estrutura compartilhada com separação rigorosa dos dados de cada restaurante.
- Cobrança manual no MVP; pagamentos recorrentes ficam para uma segunda fase.

### Isolamento da Crazy Chicken

- Criar uma tag da versão estável atual e um backup completo do banco e dos uploads.
- Copiar apenas arquivos rastreados do código-fonte para o novo projeto.
- Não copiar `.git`, `.env`, `hostinger.env`, banco, backups, uploads ou dados comerciais.
- Não alterar `crazychicken247.com.br`, seu banco, suas variáveis ou seu deploy.
- Remover do novo projeto todos os produtos, imagens, textos, contatos e configurações específicos da Crazy Chicken.
- Somente considerar migrar a Crazy Chicken para a plataforma depois que o SaaS estiver validado com restaurantes de teste.

### Arquitetura multi-restaurante

- Criar `restaurants` para nome, slug, situação, plano e estado da assinatura.
- Criar `restaurant_domains` para subdomínios e futuros domínios próprios.
- Separar identidade e acesso:
  - `admin_users` representa a pessoa;
  - `restaurant_memberships` determina restaurante, função e situação;
  - o proprietário da plataforma administra clientes e planos.
- Adicionar `restaurant_id` a configurações, categorias, produtos, personalizações, zonas, pedidos, itens, auditoria, uploads e limites de tentativas.
- Converter unicidades globais em unicidades por restaurante, como:
  - restaurante + slug do produto;
  - restaurante + código do pedido;
  - restaurante + chave de idempotência.
- Exigir um contexto de restaurante em toda consulta. Nenhuma API poderá buscar ou alterar dados sem esse identificador.
- Organizar uploads em diretórios separados por restaurante.

### Domínios e navegação

- Loja pública: `restaurante.novodominio.com.br`.
- Painel do cliente: `app.novodominio.com.br/admin/restaurante`.
- Administração da plataforma: `app.novodominio.com.br/platform`.
- Resolver o restaurante somente por domínio registrado ou slug validado.
- Domínio desconhecido nunca poderá abrir a primeira loja cadastrada como fallback.
- Domínio próprio do cliente ficará para a segunda fase.
- Validar o suporte a DNS wildcard e roteamento na hospedagem antes do lançamento. Se a hospedagem Node gerenciada não atender, usar VPS com proxy reverso e SSL automático.

### Painel da plataforma e cobrança

- Criar restaurante e convidar o primeiro proprietário.
- Ativar, suspender ou encerrar clientes manualmente.
- Registrar plano, início, vencimento, período de teste e observações comerciais.
- Restaurante suspenso exibirá uma página de indisponibilidade e não aceitará pedidos.
- O proprietário suspenso poderá entrar apenas para visualizar o aviso da assinatura.
- Não integrar cartão, Pix, gateway ou cobrança automática no MVP.
- Preparar o modelo de dados para futura integração com Mercado Pago, Asaas ou Stripe.

### Configuração inicial de cada restaurante

- Assistente para cadastrar identidade visual, contatos, horários, entrega, bairros e WhatsApp.
- Catálogo começa vazio ou com dados demonstrativos explicitamente removíveis.
- Convite individual para proprietário, gerente e atendente.
- Cliente final continuará comprando sem criar conta.
- Pedidos continuarão sendo registrados e enviados por `wa.me`.
- Aparência, operação, equipe, pedidos e auditoria serão independentes por restaurante.

### Segurança e isolamento

- Usar somente sessões autenticadas no banco na nova plataforma.
- Remover qualquer autenticação baseada em cabeçalhos externos não confiáveis.
- Validar origem, domínio e restaurante em todas as mutações.
- Autorizar cada ação pela associação entre usuário, restaurante e função.
- Gerar links de convite e recuperação a partir do domínio confiável da plataforma.
- Incluir o restaurante nas chaves de cache, rate limit, auditoria e idempotência.
- Impedir acesso cruzado mesmo que alguém descubra o ID de um produto, pedido ou usuário de outro restaurante.
- Não expor variáveis, credenciais, URLs de banco ou segredos no bundle do navegador.

### Testes e implantação

- Criar dois restaurantes fictícios com produtos, usuários e pedidos diferentes.
- Confirmar que nenhum usuário consegue visualizar ou alterar dados do outro.
- Testar IDs e slugs iguais em restaurantes diferentes.
- Testar domínio falso, origem externa, sessão sem vínculo e troca manual de IDs.
- Validar catálogo, carrinho, WhatsApp, horários, loja fechada, equipe, auditoria e uploads.
- Testar suspensão e reativação de clientes.
- Executar testes automatizados, lint, build e auditoria de segurança.
- Publicar inicialmente em ambiente de homologação.
- Fazer piloto com dois ou três restaurantes antes de vender em escala.
- Monitorar erros, disponibilidade, uso do banco e consumo de armazenamento.

### Premissas registradas

- A Crazy Chicken permanecerá totalmente independente durante o MVP.
- Será comprado um domínio neutro exclusivo para a plataforma.
- O MVP usará subdomínios; domínios próprios entrarão posteriormente.
- O banco será compartilhado, mas todas as tabelas comerciais serão isoladas por `restaurant_id`.
- A cobrança será controlada manualmente no início.
- Restaurantes premium poderão receber banco ou instalação exclusiva como plano futuro.

### Situação

Este documento é apenas um planejamento. Nenhuma etapa deve ser implementada no projeto Crazy Chicken atual sem uma solicitação explícita posterior.
