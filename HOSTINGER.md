# Publicação do Crazy Chicken na Hostinger

## Aplicação

Use um plano Hostinger Business ou Cloud com Node.js e configure no hPanel:

- Build: `npm run build`
- Start: `npm start`
- Node: 22 ou superior
- Porta: a variável `PORT` fornecida pela Hostinger

Não publique arquivos `.env`, senhas ou a pasta `backups/` no repositório.

## MariaDB

Crie o banco e o usuário no hPanel. Cadastre as variáveis do `.env.example`. O formato de `DATABASE_URL` é:

`mysql://USUARIO:SENHA@HOST:3306/BANCO`

Gere a senha administrativa localmente com `npm run auth:hash -- "SUA_SENHA_FORTE"`. Copie o resultado para `ADMIN_PASSWORD_HASH` e informe o e-mail autorizado em `ADMIN_EMAILS`.

Com o banco configurado, execute uma vez `npm run db:migrate`. Antes de atualizações importantes, execute `npm run db:backup` e guarde o SQL fora da hospedagem.

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
