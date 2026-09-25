# Planejamento 2

## Atendimento de salão e divisão inteligente de contas

### Resumo

O próximo diferencial da plataforma será um módulo de atendimento presencial: o garçom abre a mesa, identifica as pessoas, lança cada item para quem pediu e envia as rodadas à cozinha. No fechamento, o sistema calcula automaticamente consumo individual, itens compartilhados, taxa de serviço e couvert artístico.

A proposta deverá ser mobile-first, em português, adequada a pequenos restaurantes brasileiros e integrada ao cardápio, equipe, cozinha e operação da futura plataforma multi-restaurante.

O módulo será desenvolvido somente na futura plataforma definida no Planejamento 1. A Crazy Chicken atual permanecerá inalterada.

### Funcionalidades principais

#### Salão e mesas

- Cadastro de ambientes, mesas, capacidade e ordem de exibição.
- Estados visuais: livre, ocupada, aguardando produção, pedido pronto e fechando.
- Um atendimento aberto por mesa.
- Garçom responsável, horário de abertura e quantidade de pessoas.
- Transferência de garçom, pessoas ou mesa.
- União de mesas quando grupos se juntarem.

#### Pessoas e comandas

- Ao abrir a mesa, criar “Pessoa 1”, “Pessoa 2” etc., com nomes opcionais.
- Antes de adicionar um item, o garçom escolhe uma ou várias pessoas.
- Item individual pertence integralmente à pessoa selecionada.
- Item compartilhado é dividido igualmente entre as pessoas escolhidas.
- Diferenças de centavos serão distribuídas de maneira determinística, sem alterar o total da mesa.
- Pessoas poderão pagar e sair antes do encerramento da mesa.
- Depois de pago, o consumo da pessoa ficará bloqueado; alterações exigirão reabertura registrada em auditoria.

#### Rodadas e cozinha

- O garçom monta uma rodada e pode alterá-la enquanto estiver em rascunho.
- Ao enviar, preços, adicionais, observações e responsáveis ficam registrados como snapshot.
- Cada produto poderá ser associado a uma estação, como cozinha, bar ou sobremesas.
- Tela de cozinha mobile e desktop com:
  - novas solicitações;
  - em preparo;
  - prontas;
  - entregues;
  - canceladas.
- Atualização automática a cada poucos segundos enquanto a tela estiver visível.
- Cancelamentos depois do início da produção exigirão motivo e permissão de gerente ou proprietário.
- Impressão automática ficará para uma fase posterior.

#### Conta individual

Para cada pessoa:

`consumo individual + participação em itens compartilhados + taxa de serviço + parte do couvert - pagamentos registrados`

- Taxa de serviço percentual configurável pelo restaurante, inicialmente sugerida em 10%.
- Taxa calculada sobre o consumo da pessoa, sem incluir o couvert.
- Taxa removível ou ajustável individualmente, com registro de quem fez a alteração.
- Couvert artístico como valor único por mesa.
- Couvert dividido igualmente entre as pessoas incluídas na conta.
- Couvert poderá ser removido da mesa, com auditoria.
- A visualização mostrará total por pessoa e total consolidado da mesa.

#### Pagamentos e fechamento

- Registrar dinheiro, Pix, débito, crédito ou outro método configurado.
- Aceitar pagamento parcial e mais de um método por pessoa.
- Para dinheiro, registrar valor recebido e troco.
- O garçom responsável poderá registrar pagamentos e encerrar sua própria mesa.
- Caixa, gerente e proprietário poderão fechar qualquer mesa.
- A mesa somente poderá ser fechada quando o saldo restante for zero.
- Gerente ou proprietário poderá encerrar com divergência mediante justificativa.
- O sistema apenas registrará pagamentos; não processará Pix ou cartão no MVP.

### Estrutura da plataforma

#### Dados

Criar entidades multi-tenant para:

- ambientes e mesas;
- atendimentos de mesa;
- pessoas da mesa;
- rodadas;
- itens e responsáveis pelo consumo;
- estações e tickets de produção;
- configurações de serviço e couvert;
- pagamentos;
- eventos e auditoria.

Todas terão `restaurant_id`, índices por restaurante e validação obrigatória de associação.

Os pedidos de entrega e retirada continuarão separados dos atendimentos de salão. Uma camada de produção reunirá os canais na tela da cozinha e uma camada de relatórios reunirá os resultados financeiros.

#### Funções e permissões

- Proprietário: acesso total.
- Gerente: operação, equipe, cancelamentos, divergências e relatórios.
- Garçom: abrir mesas, lançar rodadas, dividir contas, receber e fechar suas mesas.
- Caixa: pagamentos e fechamento de qualquer mesa.
- Cozinha: visualizar e atualizar somente tickets de produção.

O módulo de salão será uma funcionalidade habilitável por restaurante, permitindo oferecer:

- Plano Cardápio: delivery e retirada.
- Plano Salão: mesas, garçons, cozinha e divisão inteligente.

A ativação dos planos continuará manual conforme definido no Planejamento 1.

#### APIs e concorrência

As interfaces principais representarão:

- `TableSummary`;
- `DiningSession`;
- `TableGuest`;
- `DiningRound`;
- `DiningItemAllocation`;
- `BillPreview`;
- `PaymentRecord`;
- `KitchenTicket`.

Todas as mutações usarão:

- contexto obrigatório do restaurante;
- chave de idempotência;
- versão esperada do atendimento;
- cálculo financeiro exclusivamente no servidor;
- resposta HTTP 409 quando dois dispositivos tentarem alterar uma versão antiga.

Rascunhos poderão permanecer no celular, mas uma rodada só será considerada enviada após confirmação do servidor.

### Melhorias complementares

- Dashboard com mesas abertas, tempo médio, faturamento por canal, couvert, serviço e desempenho por garçom.
- Histórico legível de abertura, rodadas, transferências, cancelamentos, pagamentos e fechamento.
- Alertas sonoros opcionais para novas rodadas e pedidos prontos.
- Busca rápida de produtos e atalhos para itens mais pedidos.
- Interface para uso com uma mão, botões de pelo menos 44 px e nenhuma rolagem horizontal.
- Suporte completo a Android, iPhone, tablets e desktop.
- Indicador claro de conexão para impedir que uma falha de internet pareça um pedido enviado.

### Testes e critérios de aceite

- Abrir, transferir, unir e fechar mesas.
- Vários garçons operando simultaneamente sem pedidos duplicados.
- Item individual, item compartilhado e pessoa adicionada posteriormente.
- Divisão de R$ 10,00 entre três pessoas resultando em R$ 3,34, R$ 3,33 e R$ 3,33.
- Taxa de serviço aplicada e removida individualmente.
- Couvert único dividido corretamente entre todos.
- Pagamento parcial, múltiplos métodos, troco e pessoa que sai antes.
- Bloqueio de alterações em conta já paga.
- Rodadas chegando à estação correta e mudança de status na cozinha.
- Cancelamento antes e depois do início da produção.
- Duplo toque, repetição de requisição, perda de conexão e conflito entre dispositivos.
- Isolamento completo entre restaurantes.
- Permissões de proprietário, gerente, garçom, caixa e cozinha.
- Responsividade em 320, 375, 414, 768, 1024 px e desktop.
- Auditoria de todas as alterações financeiras e operacionais.

### Fora desta fase

- Cliente fazendo pedido por QR Code.
- Pagamento online dentro da plataforma.
- Impressoras e equipamentos fiscais.
- NFC-e, SAT ou integração contábil.
- Reservas de mesas.
- Estoque e ficha técnica de ingredientes.
- Fechamento completo de caixa e controle de despesas.
- Integração com iFood ou outros marketplaces.
- Migração da Crazy Chicken atual.

### Premissas registradas

- O Planejamento 1 será a fundação multi-restaurante.
- O Planejamento 2 será implementado apenas no novo SaaS.
- O garçom será o responsável inicial pelo lançamento dos pedidos.
- Itens compartilhados serão divididos entre as pessoas escolhidas.
- A taxa de serviço será configurável e removível.
- O couvert será um valor único por mesa.
- O garçom poderá receber e fechar as próprias mesas.
- A cozinha usará uma tela digital; impressão ficará para depois.

### Situação

Este documento é apenas um planejamento. Nenhuma etapa deve ser implementada no projeto Crazy Chicken atual sem uma solicitação explícita posterior.
