import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createMercadoPagoOrder, mapMercadoPagoStatus, validateMercadoPagoOrder, validateMercadoPagoWebhookSignature } from "../lib/mercado-pago.ts";

const previousFetch = globalThis.fetch;
const previousToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const previousExpiration = process.env.MERCADO_PAGO_PIX_EXPIRES_IN;
process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-token-de-teste-com-tamanho-suficiente";
process.env.MERCADO_PAGO_PIX_EXPIRES_IN = "1800";

let captured;
globalThis.fetch = async (url, init) => {
  captured = { url, init };
  return Response.json({
    id: "ORD01HRYFWNYRE1MR1E60MW3X0T2P",
    external_reference: "CC-TESTE",
    total_amount: "54.99",
    status: "action_required",
    status_detail: "waiting_transfer",
    transactions: { payments: [{ id: "PAY01TESTE", status: "action_required", status_detail: "waiting_transfer", amount: "54.99", payment_method: { id: "pix", type: "bank_transfer", ticket_url: "https://www.mercadopago.com.br/sandbox/payments/test/ticket", qr_code: "000201010212TESTEPIX6304ABCD", qr_code_base64: "aVZCT1J3MEtHZ29B" } }] },
  });
};

try {
  const order = await createMercadoPagoOrder({ externalReference: "CC-TESTE", valueCents: 5499, payerEmail: "comprador@testuser.com", payerFirstName: "APRO", idempotencyKey: "idempotency-key-test" });
  assert.equal(order.id, "ORD01HRYFWNYRE1MR1E60MW3X0T2P");
  assert.equal(captured.url, "https://api.mercadopago.com/v1/orders");
  assert.equal(captured.init.headers.Authorization, "Bearer APP_USR-token-de-teste-com-tamanho-suficiente");
  assert.equal(captured.init.headers["X-Idempotency-Key"], "idempotency-key-test");
  const sent = JSON.parse(captured.init.body);
  assert.equal(sent.total_amount, "54.99");
  assert.equal(sent.payer.email, "comprador@testuser.com");
  assert.equal(sent.payer.first_name, "APRO");
  assert.equal(sent.transactions.payments[0].expiration_time, "PT1800S");
  assert.equal(mapMercadoPagoStatus(order), "pending");
  assert.equal(mapMercadoPagoStatus({ status: "processed", status_detail: "accredited" }), "paid");
  assert.equal(mapMercadoPagoStatus({ status: "canceled", status_detail: "expired" }), "expired");
  assert.throws(() => validateMercadoPagoOrder({ ...order, total_amount: "0.01" }, { orderId: order.id, externalReference: "CC-TESTE", valueCents: 5499 }), /inconsistentes/);

  const secret = "segredo-de-webhook-com-tamanho-seguro";
  const dataId = "ORD01TESTE";
  const requestId = "request-id-test";
  const ts = "1742505638683";
  const signature = createHmac("sha256", secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  assert.equal(validateMercadoPagoWebhookSignature({ xSignature: `ts=${ts},v1=${signature}`, xRequestId: requestId, dataId, secret }), true);
  assert.equal(validateMercadoPagoWebhookSignature({ xSignature: `ts=${ts},v1=${"0".repeat(64)}`, xRequestId: requestId, dataId, secret }), false);
} finally {
  globalThis.fetch = previousFetch;
  if (previousToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN; else process.env.MERCADO_PAGO_ACCESS_TOKEN = previousToken;
  if (previousExpiration === undefined) delete process.env.MERCADO_PAGO_PIX_EXPIRES_IN; else process.env.MERCADO_PAGO_PIX_EXPIRES_IN = previousExpiration;
}

console.log("Criação, validação e assinatura do Mercado Pago verificadas.");
