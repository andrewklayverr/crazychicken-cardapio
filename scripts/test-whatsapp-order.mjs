import assert from "node:assert/strict";
import { buildWhatsappMessage, buildWhatsappUrl, normalizeWhatsAppTemplate } from "../lib/whatsapp-order.ts";

const order = {
  code: "CC-TESTE-1234",
  fulfillmentType: "delivery",
  customerName: "Andrew Klayver",
  customerPhone: "85999999999",
  address: "Rua 7 de Setembro, 247",
  neighborhood: "Centro",
  notes: "Chamar no portão",
  subtotalCents: 4999,
  deliveryFeeCents: 500,
  totalCents: 5499,
};
const items = [{ productName: "Balde 500 g", quantity: 1, unitPriceCents: 4999, optionsJson: JSON.stringify({ options: ["Barbecue"] }), itemNotes: "Pouco molho" }];

const complete = buildWhatsappMessage(order, items, "complete");
assert.match(complete, /\*Dados do cliente:\*/);
assert.match(complete, /\*Valores:\*/);
assert.match(complete, /\n\n/);
assert.match(complete, /Barbecue/);
assert.match(complete, /Pouco molho/);
assert.match(complete, /R\$\s*54,99/);

const compact = buildWhatsappMessage(order, items, "compact");
assert.match(compact, /\*Cliente:\*/);
assert.doesNotMatch(compact, /Subtotal:/);

const quick = buildWhatsappMessage({ ...order, fulfillmentType: "pickup", address: null, neighborhood: null }, items, "quick");
assert.match(quick, /\*Recebimento:\* Retirada no balcão/);
assert.match(quick, /Aguardo a confirmação/);
assert.doesNotMatch(quick, /85999999999/);

assert.equal(normalizeWhatsAppTemplate("unknown"), "complete");
const url = buildWhatsappUrl(order, items, "+55 (85) 99999-9999", "complete");
assert.match(url, /^https:\/\/wa\.me\/5585999999999\?text=/);
assert.match(url, /%0A/);
assert.match(new URL(url).searchParams.get("text") ?? "", /\n\n/);

console.log("Templates de WhatsApp validados.");
