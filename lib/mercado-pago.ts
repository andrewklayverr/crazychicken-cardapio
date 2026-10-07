import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MERCADO_PAGO_API = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 10_000;

export type PixPaymentStatus = "creating" | "pending" | "paid" | "expired" | "failed" | "not_requested";

export type MercadoPagoPayment = {
  id?: string;
  status?: string;
  status_detail?: string;
  amount?: string;
  paid_amount?: string;
  payment_method?: {
    id?: string;
    type?: string;
    ticket_url?: string;
    qr_code?: string;
    qr_code_base64?: string;
  };
};

export type MercadoPagoOrder = {
  id?: string;
  external_reference?: string;
  total_amount?: string;
  status?: string;
  status_detail?: string;
  transactions?: { payments?: MercadoPagoPayment[] };
};

type MercadoPagoErrorResponse = { message?: string; error?: string; errors?: Array<{ code?: string; message?: string }> };

export class MercadoPagoError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "MercadoPagoError";
    this.status = status;
  }
}

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token || token.length < 20) throw new MercadoPagoError("O PIX ainda não está disponível. Escolha pagar na entrega ou retirada.", 503);
  return token;
}

export function mercadoPagoPixExpiresInSeconds() {
  const configured = Number(process.env.MERCADO_PAGO_PIX_EXPIRES_IN ?? 1800);
  return Number.isFinite(configured) ? Math.max(1800, Math.min(30 * 24 * 60 * 60, Math.trunc(configured))) : 1800;
}

function centsToAmount(cents: number) {
  if (!Number.isInteger(cents) || cents < 1) throw new MercadoPagoError("Valor do pedido inválido.", 400);
  return (cents / 100).toFixed(2);
}

function amountToCents(value: unknown) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

async function mercadoPagoJson(path: string, init?: RequestInit): Promise<MercadoPagoOrder> {
  let response: Response;
  try {
    response = await fetch(`${MERCADO_PAGO_API}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new MercadoPagoError("Não foi possível falar com o Mercado Pago agora. Tente novamente.");
  }

  const body = await response.json().catch(() => ({})) as MercadoPagoOrder & MercadoPagoErrorResponse;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new MercadoPagoError("O PIX está temporariamente indisponível.", 503);
    if (response.status === 429) throw new MercadoPagoError("Muitas tentativas de gerar PIX. Aguarde um instante e tente novamente.", 503);
    throw new MercadoPagoError("O Mercado Pago não conseguiu gerar a cobrança PIX.", response.status >= 500 ? 502 : 400);
  }
  return body;
}

export function mercadoPagoIdempotencyKey(orderKey: string, orderCode: string) {
  return createHash("sha256").update(`crazy-chicken:${orderKey}:${orderCode}`, "utf8").digest("hex");
}

export async function createMercadoPagoOrder(input: { externalReference: string; valueCents: number; payerEmail: string; idempotencyKey: string }) {
  const amount = centsToAmount(input.valueCents);
  const response = await mercadoPagoJson("/v1/orders", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      type: "online",
      total_amount: amount,
      external_reference: input.externalReference,
      processing_mode: "automatic",
      transactions: {
        payments: [{
          amount,
          payment_method: { id: "pix", type: "bank_transfer" },
          expiration_time: `PT${mercadoPagoPixExpiresInSeconds()}S`,
        }],
      },
      payer: { email: input.payerEmail },
    }),
  });
  return validateMercadoPagoOrder(response, { orderId: response.id, externalReference: input.externalReference, valueCents: input.valueCents });
}

export async function getMercadoPagoOrder(orderId: string) {
  if (!/^ORD[A-Za-z0-9_-]{8,117}$/.test(orderId)) throw new MercadoPagoError("Cobrança PIX inválida.", 400);
  return mercadoPagoJson(`/v1/orders/${encodeURIComponent(orderId)}`);
}

export function mercadoPagoPayment(order: MercadoPagoOrder) {
  return Array.isArray(order.transactions?.payments) ? order.transactions.payments[0] : undefined;
}

export function mapMercadoPagoStatus(order: MercadoPagoOrder): PixPaymentStatus {
  const payment = mercadoPagoPayment(order);
  const status = String(payment?.status ?? order.status ?? "").toLowerCase();
  const detail = String(payment?.status_detail ?? order.status_detail ?? "").toLowerCase();
  if (status === "processed" && detail === "accredited") return "paid";
  if (status === "expired" || detail === "expired") return "expired";
  if (["failed", "rejected"].includes(status)) return "failed";
  if (status === "canceled" || status === "cancelled") return detail === "expired" ? "expired" : "failed";
  return "pending";
}

export function validateMercadoPagoOrder(order: MercadoPagoOrder, expected: { orderId?: string; externalReference: string; valueCents: number }) {
  const payment = mercadoPagoPayment(order);
  const orderAmount = amountToCents(order.total_amount);
  const paymentAmount = payment?.amount === undefined ? expected.valueCents : amountToCents(payment.amount);
  if (!order.id || (expected.orderId && order.id !== expected.orderId) || order.external_reference !== expected.externalReference || orderAmount !== expected.valueCents || paymentAmount !== expected.valueCents) {
    throw new MercadoPagoError("A cobrança PIX retornou dados inconsistentes.");
  }
  if (payment?.payment_method && (payment.payment_method.id !== "pix" || payment.payment_method.type !== "bank_transfer")) {
    throw new MercadoPagoError("A cobrança PIX retornou um meio de pagamento inesperado.");
  }
  return order;
}

export function mercadoPagoWebhookSecret() {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";
  return secret.length >= 16 ? secret : null;
}

export function validateMercadoPagoWebhookSignature(input: { xSignature: string; xRequestId: string; dataId: string; secret: string }) {
  const parts = new Map(input.xSignature.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator < 1 ? ["", ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  const ts = parts.get("ts") ?? "";
  const signature = parts.get("v1") ?? "";
  if (!/^\d{9,16}$/.test(ts) || !/^[a-f0-9]{64}$/i.test(signature) || !input.xRequestId || input.xRequestId.length > 200 || !input.dataId || input.dataId.length > 200) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
