"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useState } from "react";
import { Check, Clock3, MapPin, Search } from "lucide-react";

const labels: Record<string, string> = { received: "Recebido", confirmed: "Confirmado", preparing: "Em preparo", ready: "Pronto", out_for_delivery: "Saiu para entrega", completed: "Finalizado", cancelled: "Cancelado" };
const statuses = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed"];
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type OrderData = { order: { code: string; status: string; customerName: string; fulfillmentType: string; address: string | null; neighborhood: string | null; subtotalCents: number; deliveryFeeCents: number; totalCents: number }; items: Array<{ productName: string; quantity: number; unitPriceCents: number; optionsJson: string; itemNotes?: string | null }> };

export function OrderTracking({ code, initialPhone = "" }: { code: string; initialPhone?: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (event?: FormEvent) => {
    event?.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`);
      const result = await response.json() as OrderData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Pedido não encontrado.");
      setData(result);
    } catch (requestError) { setData(null); setError(requestError instanceof Error ? requestError.message : "Pedido não encontrado."); } finally { setLoading(false); }
  };

  const currentIndex = data ? statuses.indexOf(data.order.status) : -1;
  return <main className="tracking-page"><section className="tracking-card"><a className="tracking-brand" href="/">Crazy <span>Chicken</span></a><span className="eyebrow">Acompanhe seu pedido</span><h1>Onde está o pedido?</h1><p>Informe o telefone usado na compra para consultar o andamento do protocolo <strong>{code}</strong>.</p><form className="tracking-form" onSubmit={load}><label className="form-label">WhatsApp<input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" /></label><button type="submit" className="primary-button" disabled={loading}>{loading ? "Consultando..." : "Consultar pedido"} <Search size={17} /></button></form>{error && <p className="form-error">{error}</p>}{data && <div className="tracking-result"><div className="tracking-result__heading"><div><span className="eyebrow">Protocolo</span><h2>{data.order.code}</h2></div><span className={`tracking-status tracking-status--${data.order.status}`}>{labels[data.order.status] ?? data.order.status}</span></div><div className="tracking-timeline">{data.order.status === "cancelled" ? <div className="tracking-step tracking-step--cancelled"><strong>Pedido cancelado</strong><span>Entre em contato pelo WhatsApp da loja para mais informações.</span></div> : statuses.map((status, index) => <div className={`tracking-step ${index <= currentIndex ? "tracking-step--done" : ""}`} key={status}><span>{index <= currentIndex ? <Check size={14} /> : <Clock3 size={14} />}</span><strong>{labels[status]}</strong></div>)}</div><div className="tracking-items">{data.items.map((item, index) => <div key={`${item.productName}-${index}`}><span>{item.quantity}x {item.productName}{parseOptions(item.optionsJson) && ` · ${parseOptions(item.optionsJson)}`}{item.itemNotes ? ` · ${item.itemNotes}` : ""}</span><strong>{money(item.unitPriceCents * item.quantity)}</strong></div>)}</div><div className="tracking-total"><span>Total</span><strong>{money(data.order.totalCents)}</strong></div><p className="tracking-delivery"><MapPin size={16} /> {data.order.fulfillmentType === "delivery" ? `${data.order.address ?? "Entrega"}${data.order.neighborhood ? ` · ${data.order.neighborhood}` : ""}` : "Retirada no balcão"}</p></div>}</section></main>;
}

function parseOptions(value: string) {
  try { const parsed = JSON.parse(value) as { options?: string[] } | string[]; return (Array.isArray(parsed) ? parsed : parsed.options ?? []).join(", "); } catch { return ""; }
}
