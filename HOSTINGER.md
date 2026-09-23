# Publicação do Crazy Chicken na Hostinger

## Atualização do painel e funcionamento da loja

Antes de publicar a versão mobile-first do painel, importe uma vez o arquivo `db/migrations/004_admin_operations.sql` no phpMyAdmin da Hostinger. A migração adiciona o modo de funcionamento e a agenda semanal à tabela `store_settings`; ela começa em `open`, portanto não fecha a loja após a atualização.

Depois da importação, publique o código e confira em **Admin > Configurações**:

- `Aberto manualmente`: aceita pedidos em qualquer horário;
- `Fechado manualmente`: mantém o cardápio visível, mas bloqueia novos pedidos;
- `Automático`: aplica os intervalos semanais no fuso `America/Sao_Paulo`, inclusive horários que atravessam a meia-noite.

O bloqueio é validado novamente pela API e responde HTTP 409 quando a loja está fechada. Teste também bairros, taxas, detalhes do pedido, equipe, logout, aparência e telas de 320, 375 e 414 px. Importe a migração antes do deploy porque a versão nova passa a consultar essas duas colunas.

## Recuperar o proprietário sem e-mail ou SQL

Após publicar esta versão, execute **localmente** na pasta do projeto:

```powershell
node scripts/generate-admin-recovery.mjs
```

O comando imprime `ADMIN_RECOVERY_EMAIL`, `ADMIN_RECOVERY_CODE` e `ADMIN_RECOVERY_EXPIRES_AT`, com código aleatório de 32 bytes e validade de 23 horas. Copie os valores para as variáveis da aplicação na Hostinger (não para o GitHub). Confirme `APP_URL=https://crazychiken.com.br`, salve e faça redeploy. O arquivo local `hostinger.env` não configura automaticamente a hospedagem.

Abra `https://crazychiken.com.br/admin/recover`, informe o código e `rodrigostuarth@hotmail.com`, escolha uma senha de 12 a 128 caracteres e confirme-a. Após a confirmação de sucesso, siga para o login e use essa senha. Não coloque a senha nem seu hash nas variáveis de ambiente ou no banco manualmente.

O formulário atende somente a conta proprietária existente e ativa do e-mail configurado; não cria outra conta, não altera permissões e preserva MFA. O código é de uso único, mesmo que as variáveis permaneçam configuradas. Valores expirados ou com mais de 24 horas restantes são recusados. Para obter novo prazo, gere **outro código**. Cinco tentativas por conta ou IP em 15 minutos bloqueiam temporariamente a recuperação, sem bloquear o login normal.

Depois de confirmar o login, remova `ADMIN_RECOVERY_EMAIL`, `ADMIN_RECOVERY_CODE`, `ADMIN_RECOVERY_EXPIRES_AT`, `ADMIN_SETUP_CODE` e `ADMIN_SETUP_EXPIRES_AT` e reinicie/republique. Remova também `ADMIN_EMAILS` e `ADMIN_PASSWORD_HASH` quando o acesso individual estiver validado. Preserve `AUTH_SECRET`. A senha individual do banco tem prioridade sobre as variáveis antigas.

Não é necessário repetir migrações: usa as tabelas administrativas da migração 002. `/admin/setup` fica reservado à instalação sem nenhuma conta administrativa. A recuperação não depende do Resend e não entra automaticamente na conta; ela encerra sessões e invalida links anteriores.

Validação local: `node --test tests/admin-recovery.test.cjs`, `npm.cmd run lint` e `npm.cmd run build`. Os testes usam um banco simulado com transações serializadas; bloqueios e concorrência reais do MySQL precisam ser conferidos em uma instalação de teste antes da validação final na Hostinger.

## Aplicação

Use um plano Hostinger Business ou Cloud com Node.js e configure no hPanel:

- Build: `npm run build`
- Start: `npm start`
- Node: 22 ou superior
- Porta: a variável `PORT` fornecida pela Hostinger

Não publique arquivos `.env`, senhas ou a pasta `backups/` no repositório.

## Modelos de mensagem do WhatsApp

Depois de fazer backup, importe `db/migrations/005_whatsapp_templates.sql` no phpMyAdmin antes de publicar esta versao. O campo recebe `complete` automaticamente para manter o formato completo nas instalacoes existentes.

Em **Admin > Configuracoes**, escolha **Completo**, **Compacto** ou **Atendimento rapido** e salve. A escolha fica em `store_settings` e e usada pelo servidor tanto em pedidos novos quanto quando o mesmo pedido e reenviado por idempotencia. O texto usa quebras de linha reais e continua sendo aberto pelo WhatsApp via `wa.me`.

## MariaDB

O banco da aplicação é o MariaDB/MySQL da Hostinger. O phpMyAdmin é somente a interface de manutenção para importar migrações, consultar registros, fazer backup e diagnosticar problemas; o painel e a loja acessam o banco diretamente pela `DATABASE_URL`.

As operações comuns devem ser feitas no painel do site, sem editar manualmente os registros no phpMyAdmin. Aparência, modo de funcionamento e agenda ficam na tabela `store_settings`. Produtos, pedidos, opções, bairros e administradores permanecem em suas tabelas próprias.

Crie o banco e o usuário no hPanel. Cadastre as variáveis do `.env.example`. O formato de `DATABASE_URL` é:

`mysql://USUARIO:SENHA@HOST:3306/BANCO`

Contas administrativas ativas usam o e-mail e o hash individual da tabela `admin_users`. Não coloque a senha escolhida no painel nas variáveis de ambiente. `ADMIN_EMAILS` e `ADMIN_PASSWORD_HASH` são apenas compatibilidade legada e podem ser removidas da hospedagem depois de validar o acesso individual.

Com o banco configurado, execute uma vez `npm run db:migrate` ou importe as migrações pelo phpMyAdmin na ordem numérica. A correção de publicação não cria uma migração nova; apenas confirme que a `004_admin_operations.sql` já foi aplicada. Antes de atualizações importantes, execute `npm run db:backup` e guarde o SQL fora da hospedagem.

## Uploads

O painel salva logo, banners e imagens em `UPLOAD_DIR`. Em produção, use uma pasta persistente da conta Hostinger, fora de uma pasta temporária de build. O upload exige sessão administrativa e o endpoint de mídia só serve chaves do diretório `uploads/`.

## Validação antes do DNS

No endereço temporário, valide vitrine, bebidas e caipirinhas, carrinho após recarregar, retirada, entrega, total recalculado no servidor, WhatsApp, protocolo, login administrativo, produtos, aparência, logo, status, idempotência e telas mobile/desktop. Mantenha a hospedagem antiga ativa até concluir essa conferência.

## Domínio

O domínio oficial deste projeto é `crazychiken.com.br`. A marca exibida continua sendo "Crazy Chicken"; apenas o endereço usa a grafia sem o segundo `c` de "chicken".

Configure na Hostinger:

- `APP_URL=https://crazychiken.com.br`
- `EMAIL_FROM=Crazy Chicken <noreply@crazychiken.com.br>` somente depois de verificar esse domínio no Resend

O site, o certificado SSL e a aplicação Node.js devem estar associados a `crazychiken.com.br`. Depois do deploy, teste `https://crazychiken.com.br`, `https://crazychiken.com.br/admin` e `https://crazychiken.com.br/admin/setup`. Evite qualquer variação com uma letra `c` adicional no endereço.

Após a validação, confirme os registros exibidos no hPanel, ative HTTPS e teste com e sem `www`. A propagação pode levar algumas horas. A criação da aplicação, do banco e dos registros DNS depende do acesso à conta Hostinger e do domínio exato.
