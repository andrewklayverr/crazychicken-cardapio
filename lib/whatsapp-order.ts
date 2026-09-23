import type { orderItems, orders } from "../db/schema";

export type WhatsAppTemplate = "complete" | "compact" | "quick";

export const whatsappTemplateOptions: Array<{ id: WhatsAppTemplate; label: string; description: string; preview: string }> = [
  { id: "complete", label: "Completo", description: "Todos os dados do pedido, cliente, entrega e valores.", preview: "Pedido + itens + cliente + entrega + valores" },
  { id: "compact", label: "Compacto", description: "Resumo organizado para confirmações mais rápidas.", preview: "Pedido + itens + cliente + recebimento + total" },
  { id: "quick", label: "Atendimento rápido", description: "Mensagem curta para agilizar a confirmação no WhatsApp.", preview: "Pedido + itens + total + confirmação" },
];

export function isWhatsAppTemplate(value: unknown): value is WhatsAppTemplate {
  return value === "complete" || value === "compact" || value === "quick";
}

export function normalizeWhatsAppTemplate(value: unknown): WhatsAppTemplate {
  return isWhatsAppTemplate(value) ? value : "complete";
}

type OrderForMessage = Pick<typeof orders.$inferSelect, "code" | "fulfillmentType" | "customerName" | "customerPhone" | "address" | "neighborhood" | "notes" | "subtotalCents" | "deliveryFeeCents" | "totalCents">;
type ItemForMessage = Pick<typeof orderItems.$inferSelect, "productName" | "quantity" | "unitPriceCents" | "optionsJson" | "itemNotes">;

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseStoredOptions(value: string) {
  try {
    const parsed = JSON.parse(value) as { options?: string[] } | string[];
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.options) ? parsed.options : [];
  } catch {
    return [];
  }
}

function itemLines(items: ItemForMessage[]) {
  return items.map((item) => {
    const options = parseStoredOptions(item.optionsJson);
    return [
      `• ${item.quantity}x ${item.productName} — ${money(item.unitPriceCents * item.quantity)}`,
      options.length ? `  Adicionais: ${options.join(", ")}` : "",
      item.itemNotes ? `  Observação: ${item.itemNotes}` : "",
    ].filter(Boolean).join("\n");
  });
}

function fulfillmentLine(order: OrderForMessage) {
  return order.fulfillmentType === "delivery"
    ? `Entrega: ${order.address ?? ""}${order.neighborhood ? ` — ${order.neighborhood}` : ""}`
    : "Retirada no balcão";
}

export function buildWhatsappMessage(order: OrderForMessage, items: ItemForMessage[], template: WhatsAppTemplate = "complete") {
  const selectedTemplate = normalizeWhatsAppTemplate(template);
  const lines = itemLines(items);
  const itemsBlock = ["*Itens:*", ...lines];

  if (selectedTemplate === "quick") {
    return [
      "Olá! Quero confirmar meu pedido na Crazy Chicken.",
      "",
      `*Pedido:* ${order.code}`,
      ...lines,
      "",
      `*Total:* ${money(order.totalCents)}`,
      `*Recebimento:* ${fulfillmentLine(order)}`,
      "",
      "Aguardo a confirmação. Obrigado!",
    ].join("\n");
  }

  if (selectedTemplate === "compact") {
    return [
      "Olá! Quero confirmar meu pedido na Crazy Chicken.",
      "",
      `*Pedido:* ${order.code}`,
      ...itemsBlock,
      "",
      `*Cliente:* ${order.customerName}`,
      `*Telefone:* ${order.customerPhone}`,
      `*Recebimento:* ${fulfillmentLine(order)}`,
      `*Total:* ${money(order.totalCents)}`,
    ].join("\n");
  }

  return [
    "Olá! Quero confirmar meu pedido na Crazy Chicken.",
    "",
    `*Pedido:* ${order.code}`,
    ...itemsBlock,
    "",
    "*Dados do cliente:*",
    `Nome: ${order.customerName}`,
    `Telefone: ${order.customerPhone}`,
    `Recebimento: ${fulfillmentLine(order)}`,
    order.notes ? `Observações: ${order.notes}` : null,
    "",
    "*Valores:*",
    `Subtotal: ${money(order.subtotalCents)}`,
    `Taxa de entrega: ${money(order.deliveryFeeCents)}`,
    `*Total: ${money(order.totalCents)}*`,
  ].filter((line): line is string => line !== null).join("\n");
}

export function buildWhatsappUrl(order: OrderForMessage, items: ItemForMessage[], whatsappNumber: string | null | undefined, template: WhatsAppTemplate = "complete") {
  const phone = String(whatsappNumber ?? "").replace(/\D/g, "");
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsappMessage(order, items, template))}`;
}
