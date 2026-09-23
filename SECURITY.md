# Política de segurança

Este arquivo descreve como comunicar uma possível vulnerabilidade neste repositório. As práticas de implementação ficam em [DESENVOLVIMENTO_SEGURO.md](DESENVOLVIMENTO_SEGURO.md).

> **Antes de publicar:** configure um canal privado de reporte para este repositório. No GitHub, habilite *Private vulnerability reporting* em **Settings → Security → Code security and analysis**. Se usar outro canal privado, substitua a seção abaixo por instruções reais. Não publique este arquivo com um contato inexistente.

## Como reportar

Use a opção **Report a vulnerability** na aba **Security** deste repositório. Envie o relato de forma privada; não inclua passos de exploração ou dados de terceiros em uma issue pública.

Informe, quando possível:

- versão, commit ou ambiente afetado;
- descrição do problema, impacto e pré-requisitos;
- passos mínimos para reproduzir, sem acessar dados de outras pessoas;
- evidências redigidas para remover credenciais e dados pessoais;
- sugestão de correção, se houver.

## Tratamento dos relatos

Cada relato será avaliado quanto a impacto e reprodutibilidade. A correção e a divulgação serão coordenadas com quem reportou, conforme a gravidade e a disponibilidade de uma solução. Não há prazo de resposta garantido por este modelo; defina um prazo aqui apenas se a equipe puder cumpri-lo.

Não realize testes destrutivos, negação de serviço, engenharia social nem acesso a contas ou dados de terceiros.

## Escopo e versões

O escopo mantido é a versão publicada a partir da branch principal deste repositório, incluindo a loja pública, o painel administrativo e as APIs servidas em `crazychiken.com.br`. Serviços de terceiros, contas dos provedores e ataques contra disponibilidade não fazem parte do escopo, mas falhas de integração que exponham dados desta aplicação podem ser reportadas.
