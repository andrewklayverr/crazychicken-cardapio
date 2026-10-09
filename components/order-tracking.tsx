"use client";

import { FormEvent, useState } from "react";
import { Check, Clock3, MapPin, QrCode, Search } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { displayOrderCode } from "../lib/order-code";

const labels: Record<string, string> = { received: "Recebido", confirmed: "Confirmado", preparing: "Em preparo", ready: "Pronto", out_for_delivery: "Saiu para entrega", completed: "Finalizado", cancelled: "Cancelado" };
const statuses = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed"];
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PaymentData = { method: "pix" | "pay_on_fulfillment"; status: string; paymentLinkUrl?: string | null; qrCodeUrl?: string | null };
type OrderData = { order: { id?: number; code: string; status: string; customerName: string; fulfillmentType: string; address: string | null; neighborhood: string | null; subtotalCents: number; deliveryFeeCents: number; totalCents: number }; items: Array<{ productName: string; quantity: number; unitPriceCents: number; optionsJson: string; itemNotes?: string | null }>; payment?: PaymentData };

export function OrderTracking({ code = "", initialPhone = "" }: { code?: string; initialPhone?: string }) {
  const [lookupCode, setLookupCode] = useState(code);
  const [phone, setPhone] = useState(initialPhone);
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (event?: FormEvent) => {
    event?.preventDefault(); setLoading(true); setError("");
    try {
      const requestedCode = normalizeLookupCode(lookupCode);
      if (!requestedCode) throw new Error("Informe o código do pedido.");
      const response = await fetch(`/api/orders/${encodeURIComponent(requestedCode)}?phone=${encodeURIComponent(phone)}`);
      const result = await response.json() as OrderData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Pedido não encontrado.");
      setLookupCode(result.order.code);
      if (result.payment?.method === "pix" && result.payment.status !== "paid") {
        const paymentResponse = await fetch(`/api/orders/${encodeURIComponent(result.order.code)}/payment?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
        const paymentResult = await paymentResponse.json().catch(() => ({})) as { payment?: PaymentData };
        if (paymentResponse.ok && paymentResult.payment) result.payment = paymentResult.payment;
      }
      setData(result);
    } catch (requestError) { setData(null); setError(requestError instanceof Error ? requestError.message : "Pedido não encontrado."); } finally { setLoading(false); }
  };

  const currentIndex = data ? statuses.indexOf(data.order.status) : -1;
  const visibleCode = displayOrderCode(data?.order.id, data?.order.code ?? lookupCode);
  // The tracking logo links back to the storefront root.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
return <main className="tracking-page"><section className="tracking-card"><a className="tracking-brand" href="/"><BrandMark /></a><span className="eyebrow">Acompanhe seu pedido</span><h1>Onde está o pedido?</h1><p>{code ? <>Informe o telefone usado na compra para consultar o andamento do protocolo <strong>{visibleCode}</strong>.</> : "Digite o código do pedido e o WhatsApp usado na compra."}</p><form className={`tracking-form ${code ? "" : "tracking-form--lookup"}`} onSubmit={load}>{!code && <label className="form-label">Código do pedido<input required value={lookupCode} onChange={(event) => setLookupCode(event.target.value)} placeholder="#0001 ou CC-..." autoCapitalize="characters" /></label>}<label className="form-label">WhatsApp<input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" /></label><button type="submit" className="primary-button" disabled={loading}>{loading ? "Consultando..." : "Consultar pedido"} <Search size={17} /></button></form>{error && <p className="form-error">{error}</p>}{data && <div className="tracking-result"><div className="tracking-result__heading"><div><span className="eyebrow">Protocolo</span><h2>{visibleCode}</h2></div><span className={`tracking-status tracking-status--${data.order.status}`}>{labels[data.order.status] ?? data.order.status}</span></div><div className="tracking-timeline">{data.order.status === "cancelled" ? <div className="tracking-step tracking-step--cancelled"><strong>Pedido cancelado</strong><span>Entre em contato pelo WhatsApp da loja para mais informações.</span></div> : statuses.map((status, index) => <div className={`tracking-step ${index <= currentIndex ? "tracking-step--done" : ""}`} key={status}><span>{index <= currentIndex ? <Check size={14} /> : <Clock3 size={14} />}</span><strong>{labels[status]}</strong></div>)}</div><div className="tracking-items">{data.items.map((item, index) => <div key={`${item.productName}-${index}`}><span>{item.quantity}x {item.productName}{parseOptions(item.optionsJson) && ` · ${parseOptions(item.optionsJson)}`}{item.itemNotes ? ` · ${item.itemNotes}` : ""}</span><strong>{money(item.unitPriceCents * item.quantity)}</strong></div>)}</div><div className="tracking-total"><span>Total</span><strong>{money(data.order.totalCents)}</strong></div>{data.payment?.method === "pix" && <div className={`tracking-payment tracking-payment--${data.payment.status}`}><QrCode size={18} /><div><strong>{data.payment.status === "paid" ? "PIX confirmado" : data.payment.status === "expired" ? "PIX expirado" : "PIX aguardando pagamento"}</strong><span>{data.payment.status === "paid" ? "Pagamento recebido pela loja." : "A confirmação pode levar alguns segundos."}</span></div>{data.payment.status !== "paid" && data.payment.paymentLinkUrl && <a href={data.payment.paymentLinkUrl} target="_blank" rel="noreferrer">Pagar agora</a>}</div>}<p className="tracking-delivery"><MapPin size={16} /> {data.order.fulfillmentType === "delivery" ? `${data.order.address ?? "Entrega"}${data.order.neighborhood ? ` · ${data.order.neighborhood}` : ""}` : "Retirada no balcão"}</p></div>}</section></main>;
}

function parseOptions(value: string) {
  try { const parsed = JSON.parse(value) as { options?: string[] } | string[]; return (Array.isArray(parsed) ? parsed : parsed.options ?? []).join(", "); } catch { return ""; }
}

function normalizeLookupCode(value: string) {
  const candidate = value.trim().toUpperCase();
  const numeric = /^#?(\d{1,10})$/.exec(candidate);
  if (numeric) return numeric[1];
  return /^CC-[A-Z0-9-]+$/.test(candidate) ? candidate : "";
}
