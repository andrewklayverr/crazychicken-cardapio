# Regressão visual

A suíte usa as comparações nativas de screenshot do Playwright em Chromium. Os baselines são separados por projeto e plataforma para desktop 1440 × 900 e mobile 320 × 720, 375 × 812 e 414 × 896.

## Execução

- Comparar com os baselines aprovados: `npm run test:visual`.
- Listar todos os testes: `npm run test:e2e:list`.
- Testes funcionais sem screenshots: `npm run test:e2e`.

Os baselines oficiais são gerados no Windows com a mesma versão do Playwright e do Chromium instalada pelo CI:

```powershell
npm.cmd run test:visual:update
```

Depois da geração, execute novamente sem `--update-snapshots` para comprovar que o comparador passa:

```powershell
npm.cmd run test:visual
```

## Revisão e aprovação

1. Quando o CI detectar diferença, baixe o artefato `visual-regression-report`, que contém imagens esperadas, atuais e diffs, além do relatório HTML.
2. Quem aprova o pull request deve conferir cada imagem alterada. Em fluxo solo, faça essa revisão explícita antes de atualizar qualquer baseline.
3. Se a alteração for intencional, gere novamente somente os baselines afetados com `--update-snapshots`, revise as imagens e inclua os PNGs na mesma mudança visual.
4. Se a alteração não for intencional, corrija a interface e execute a comparação novamente. Não aceite o diff apenas para deixar o CI verde.

Os PNGs são armazenados com Git LFS conforme `.gitattributes`, evitando crescimento desnecessário do histórico Git.
