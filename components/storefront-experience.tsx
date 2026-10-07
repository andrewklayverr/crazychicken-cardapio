"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, ChevronRight, Clock3, Copy, Flame, MapPin, Menu, Minus, Plus, QrCode, Search, ShoppingBag, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { fallbackProducts, fallbackSettings, type CatalogProduct } from "../lib/catalog";
import { getStoreAvailability, normalizeOrderingMode, type OrderingMode, type WeeklySchedule } from "../lib/store-hours";
import { getStoreThemeTokens } from "../lib/store-theme";
import { displayOrderCode } from "../lib/order-code";

type Category = "Todos" | "Frangos" | "Acompanhamentos" | "Molhos" | "Novidades" | "Bebidas";
type ProductOption = { id: number; groupName: string; label: string; priceDeltaCents: number; required: boolean; selectionMode?: "single" | "multiple"; minSelections?: number; maxSelections?: number };
type Product = { id: number; name: string; description: string; priceCents: number; category: Exclude<Category, "Todos">; image: string; badge?: string | null; featured?: boolean; options: ProductOption[] };
type StoreSettings = {
  brandName: string;
  logoKey: string | null;
  whatsappNumber: string;
  address: string;
  openingHours: string;
  orderingMode: OrderingMode;
  weeklySchedule: WeeklySchedule;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  minimumOrderCents: number;
  defaultDeliveryFeeCents: number;
  theme: string;
  appearance: { heroImageKey: string | null; heroMobileImageKey: string | null; drinkBannerImageKey: string | null; drinkBannerImageKeys: string[]; heroTitle: string; heroDescription: string; accent: string; primary: string; background: string; fontScale: string; density: string; visibleSections: string[] };
  availability?: { isOpen: boolean; message: string };
  updatedAt?: string | null;
};
type DeliveryZone = { id: number; name: string; feeCents: number };
type CartItem = { lineId: string; product: Product; quantity: number; selectedOptions: ProductOption[]; itemNotes: string };
type PublicPayment = { method: "pix" | "pay_on_fulfillment"; status: string; brCode?: string | null; paymentLinkUrl?: string | null; expiresAt?: string | null; paidAt?: string | null; qrCodeUrl?: string | null };
type InitialStorefrontData = { products: CatalogProduct[]; settings: Omit<Partial<StoreSettings>, "orderingMode"> & { orderingMode?: string }; deliveryZones: DeliveryZone[] };

const categoryNames: Category[] = ["Todos", "Frangos", "Acompanhamentos", "Molhos", "Novidades", "Bebidas"];
const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const assetUrl = (key: string | null | undefined) => !key ? "/hero-food.jpeg" : key.startsWith("/") || key.includes(".") && !key.includes("/") ? `/${key.replace(/^\//, "")}` : `/api/media?key=${encodeURIComponent(key)}`;
const recoverImage = (event: { currentTarget: HTMLImageElement }, fallback: string) => { if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback; };
const recoverPictureImage = (event: { currentTarget: HTMLImageElement }, fallback: string) => { event.currentTarget.parentElement?.querySelectorAll("source").forEach((source) => source.removeAttribute("srcset")); recoverImage(event, fallback); };

function ProductCard({ product, onAdd, disabled }: { product: Product; onAdd: (product: Product) => void; disabled: boolean }) {
  return <article className="product-card"><div className="product-card__image-wrap"><img src={product.image} alt={product.name} className="product-card__image" loading="lazy" decoding="async" onError={(event) => recoverImage(event, "/hero-food.jpeg")} width="640" height="480" />{product.badge && <span className="product-card__badge">{product.badge}</span>}{disabled && <span className="product-card__closed">Fechado</span>}</div><div className="product-card__body"><div className="product-card__meta"><span>{product.category}</span><span className="product-card__dot" /><span>feito na hora</span></div><h3>{product.name}</h3><p>{product.description}</p><div className="product-card__footer"><strong>{money(product.priceCents)}</strong><button type="button" className="product-card__add" disabled={disabled} onClick={() => onAdd(product)} aria-label={disabled ? `Loja fechada; ${product.name} indisponível para pedido` : `Adicionar ${product.name} ao pedido`}>{!disabled && <Plus size={16} strokeWidth={2.5} aria-hidden={true} />}<span>{disabled ? "Loja fechada" : "Adicionar ao pedido"}</span></button></div></div></article>;
}

function ProductOptionsDialog({ product, onClose, onConfirm }: { product: Product; onClose: () => void; onConfirm: (options: ProductOption[], quantity: number, notes: string) => void }) {
  const groups = useMemo(() => [...product.options].reduce((map, option) => map.set(option.groupName, [...(map.get(option.groupName) ?? []), option]), new Map<string, ProductOption[]>()), [product.options]);
  const [selected, setSelected] = useState<Record<string, number[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const selectedOptions = Object.values(selected).flat().map((id) => product.options.find((option) => option.id === id)).filter((option): option is ProductOption => Boolean(option));
  const optionTotal = selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0);

  const toggle = (groupName: string, option: ProductOption) => {
    const group = groups.get(groupName) ?? [];
    const mode = group[0]?.selectionMode === "multiple" ? "multiple" : "single";
    setSelected((current) => {
      const currentIds = current[groupName] ?? [];
      if (mode === "single") return { ...current, [groupName]: [option.id] };
      if (currentIds.includes(option.id)) return { ...current, [groupName]: currentIds.filter((id) => id !== option.id) };
      const max = group[0]?.maxSelections || group.length;
      return { ...current, [groupName]: currentIds.length >= max ? currentIds : [...currentIds, option.id] };
    });
  };

  const confirm = () => {
    for (const [groupName, group] of groups) {
      const count = (selected[groupName] ?? []).length;
      const min = Math.max(...group.map((option) => option.minSelections ?? 0), group.some((option) => option.required) ? 1 : 0);
      if (count < min) { setError(`Escolha uma opção em ${groupName}.`); return; }
    }
    onConfirm(selectedOptions, quantity, notes.trim().slice(0, 220));
  };

  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="product-options-dialog" role="dialog" aria-modal="true" aria-labelledby="product-options-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">Personalize seu pedido</span><h2 id="product-options-title">{product.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div><p className="dialog-description">Escolha os sabores, extras e a quantidade antes de adicionar.</p>{[...groups].map(([groupName, group]) => <fieldset className="option-group" key={groupName}><legend>{groupName} <small>{Math.max(...group.map((option) => option.minSelections ?? 0), group.some((option) => option.required) ? 1 : 0) > 0 ? "obrigatório" : "opcional"}</small></legend><div className="option-list">{group.map((option) => { const active = (selected[groupName] ?? []).includes(option.id); return <button type="button" key={option.id} className={`option-choice ${active ? "selected" : ""}`} onClick={() => toggle(groupName, option)}><span><strong>{option.label}</strong>{option.priceDeltaCents ? <small>+ {money(option.priceDeltaCents)}</small> : null}</span><span className="option-radio">{active ? <Check size={14} /> : null}</span></button>; })}</div></fieldset>)}<div className="customizer-row"><span>Quantidade</span><div className="quantity-control"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuir quantidade"><Minus size={14} /></button><b>{quantity}</b><button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Aumentar quantidade"><Plus size={14} /></button></div></div><label className="form-label">Observação deste item<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={220} placeholder="Ex.: pouco gelo, sem cebola..." /></label>{error && <p className="form-error">{error}</p>}<button type="button" className="primary-button" onClick={confirm}>Adicionar {quantity} · {money((product.priceCents + optionTotal) * quantity)} <Plus size={17} /></button></section></div>;
}

function MobileMenu({ onClose, onOpenCart }: { onClose: () => void; onOpenCart: () => void }) {
  return <div className="mobile-menu-backdrop" onClick={onClose}><aside className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu principal" onClick={(event) => event.stopPropagation()}><div className="mobile-menu__header"><BrandMark /><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar menu"><X size={20} /></button></div><nav className="mobile-menu__nav">{[["#cardapio", "Cardápio"], ["#destaques", "Destaques"], ["#bebidas", "Bebidas"], ["#sobre", "A casa"]].map(([href, label]) => <a key={href} href={href} onClick={onClose}>{label}<ChevronRight size={18} /></a>)}<button type="button" onClick={() => { onClose(); onOpenCart(); }}>Meu pedido <ShoppingBag size={18} /></button></nav></aside></div>;
}

function CartDrawer({ cart, settings, zones, orderingOpen, availabilityMessage, onClose, onChangeQuantity, onRemove, onClear }: { cart: CartItem[]; settings: StoreSettings; zones: DeliveryZone[]; orderingOpen: boolean; availabilityMessage: string; onClose: () => void; onChangeQuantity: (lineId: string, delta: number) => void; onRemove: (lineId: string) => void; onClear: () => void }) {
  const [step, setStep] = useState<"cart" | "details" | "payment" | "success">("cart");
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">(settings.pickupEnabled ? "pickup" : "delivery");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "pay_on_fulfillment">("pay_on_fulfillment");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", neighborhood: "", notes: "" });
  const [error, setError] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [orderId, setOrderId] = useState<number | undefined>();
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const idempotencyKey = useRef("");
  const subtotal = cart.reduce((sum, item) => sum + (item.product.priceCents + item.selectedOptions.reduce((optionSum, option) => optionSum + option.priceDeltaCents, 0)) * item.quantity, 0);
  const selectedZone = zones.find((zone) => zone.name === form.neighborhood);
  const estimatedDelivery = fulfillmentType === "delivery" ? selectedZone?.feeCents ?? settings.defaultDeliveryFeeCents : 0;
  const estimatedTotal = subtotal + estimatedDelivery;
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const updateForm = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (step !== "success" || payment?.method !== "pix" || payment.status === "paid") return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/payment?phone=${encodeURIComponent(form.phone)}`, { cache: "no-store" });
        const data = await response.json() as { payment?: PublicPayment; whatsappUrl?: string | null };
        if (active && response.ok && data.payment) {
          setPayment(data.payment);
          setWhatsappUrl(data.whatsappUrl ?? null);
        }
      } catch { /* O webhook ou a próxima consulta confirmará o pagamento. */ }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [form.phone, orderCode, payment?.method, payment?.status, step]);

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!orderingOpen) { setError(availabilityMessage); return; }
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: idempotencyKey.current, customerName: form.name, customerPhone: form.phone, customerEmail: paymentMethod === "pix" ? form.email : "", fulfillmentType, paymentMethod, address: form.address, neighborhood: form.neighborhood, notes: form.notes, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, optionIds: item.selectedOptions.map((option) => option.id), itemNotes: item.itemNotes })) }) });
      const data = await response.json() as { error?: string; whatsappUrl?: string | null; payment?: PublicPayment; order?: { id?: number; code: string; totalCents: number } };
      if (!response.ok || !data.order) throw new Error(data.error ?? "Não foi possível registrar o pedido.");
      setOrderCode(data.order.code);
      setOrderId(data.order.id);
      setServerTotal(data.order.totalCents);
      setWhatsappUrl(data.whatsappUrl ?? null);
      setPayment(data.payment ?? null);
      setStep("success");
      if (paymentMethod === "pay_on_fulfillment" && data.whatsappUrl) window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível registrar o pedido.");
    } finally { setSubmitting(false); }
  };

  const copyPix = async () => {
    if (!payment?.brCode) return;
    try { await navigator.clipboard.writeText(payment.brCode); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setError("Não foi possível copiar. Selecione o código PIX manualmente."); }
  };

  const goToPayment = () => {
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (form.name.trim().length < 2) { setError("Informe seu nome."); return; }
    if (phoneDigits.length < 8) { setError("Informe um WhatsApp válido."); return; }
    if (fulfillmentType === "delivery" && !form.address.trim()) { setError("Informe o endereço de entrega."); return; }
    if (fulfillmentType === "delivery" && zones.length > 0 && !form.neighborhood) { setError("Selecione o bairro de entrega."); return; }
    setError("");
    setStep("payment");
  };

  return (
    <div className="drawer-backdrop checkout-backdrop" onClick={onClose}>
      <aside className={`cart-drawer checkout-drawer checkout-drawer--${step}`} role="dialog" aria-modal="true" aria-label="Seu pedido" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-header checkout-drawer__header">
          <div>
            <span className="eyebrow">{step === "success" ? "Pedido registrado" : step === "cart" ? "Seu pedido" : "Finalizar pedido"}</span>
            <h2>{step === "success" ? "Recebemos seu pedido." : step === "cart" ? (cart.length ? "Tá ficando bom." : "Seu carrinho está vazio") : step === "details" ? "Só falta isso." : paymentMethod === "pix" ? "Pagamento via PIX" : "Escolha o pagamento."}</h2>
          </div>
          <button type="button" className="checkout-close" onClick={onClose} aria-label="Fechar checkout"><X size={21} /></button>
        </header>

        {step !== "success" && (
          <ol className="checkout-steps" aria-label="Etapas do pedido">
            <li className={step === "cart" ? "active" : "complete"}><span>1</span> Carrinho</li>
            <li className={step === "details" ? "active" : step === "payment" ? "complete" : ""}><span>2</span> Dados</li>
            <li className={step === "payment" ? "active" : ""}><span>3</span> Pagamento</li>
          </ol>
        )}

        <div className="checkout-drawer__content">
          {step === "success" ? (
            <div className="order-success">
              <div className="success-icon"><Check size={30} /></div>
              <p>Pedido <strong>{displayOrderCode(orderId, orderCode)}</strong> registrado com total confirmado de <strong>{money(serverTotal ?? 0)}</strong>.</p>
              {payment?.method === "pix" && (
                <section className={`pix-payment pix-payment--${payment.status}`} aria-live="polite">
                  <div className="pix-payment__heading"><QrCode size={22} /><div><strong>{payment.status === "paid" ? "PIX confirmado" : payment.status === "expired" ? "PIX expirado" : "Pague agora com PIX"}</strong><span>{payment.status === "paid" ? "Pagamento recebido. Já avisamos a loja." : payment.status === "expired" ? "Abra o link do Mercado Pago para verificar a cobrança." : "Escaneie o QR Code ou copie o código abaixo."}</span></div></div>
                  {payment.status !== "paid" && <>
                    {payment.qrCodeUrl && <img className="pix-payment__qr" src={payment.qrCodeUrl} alt="QR Code PIX deste pedido" />}
                    {payment.brCode && <><label className="form-label">PIX copia e cola<textarea readOnly value={payment.brCode} rows={3} /></label><button type="button" className="pix-copy-button" onClick={copyPix}><Copy size={16} /> {copied ? "Código copiado" : "Copiar código PIX"}</button></>}
                    {payment.paymentLinkUrl && <a className="secondary-button" href={payment.paymentLinkUrl} target="_blank" rel="noreferrer">Abrir pagamento seguro <ArrowRight size={16} /></a>}
                    <small className="pix-payment__waiting"><span /> Aguardando confirmação do banco...</small>
                  </>}
                </section>
              )}
              {whatsappUrl ? <><p className="admin-help">{payment?.method === "pix" ? "Pagamento confirmado. Agora você pode enviar o pedido para a loja pelo WhatsApp." : "Tentamos abrir o WhatsApp com a mensagem completa. Se ele não abriu, use o botão abaixo."}</p><button type="button" className="checkout-button" onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}>Abrir WhatsApp <ArrowRight size={17} /></button></> : payment?.method === "pix" && payment.status !== "paid" ? <p className="checkout-info">O WhatsApp será liberado após a confirmação do PIX.</p> : <p className="form-error">O pedido foi salvo, mas o WhatsApp da loja ainda não está configurado no painel administrativo.</p>}
              <a className="secondary-button" href={`/pedido/${encodeURIComponent(orderCode)}?phone=${encodeURIComponent(form.phone)}`}>Acompanhar pedido <ArrowRight size={17} /></a>
              <button type="button" className="secondary-button" onClick={() => { onClear(); onClose(); }}>Voltar ao cardápio</button>
            </div>
          ) : step === "cart" ? (
            cart.length ? <section className="checkout-panel checkout-panel--cart">
              <div className="checkout-cart-list">
                {cart.map((item) => {
                  const unitPrice = item.product.priceCents + item.selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0);
                  return <article className="checkout-cart-item" key={item.lineId}>
                    <img src={item.product.image} alt="" loading="lazy" decoding="async" onError={(event) => recoverImage(event, "/hero-food.jpeg")} />
                    <div className="checkout-cart-item__copy">
                      <strong>{item.product.name}</strong>
                      <b>{money(unitPrice * item.quantity)}</b>
                      <small>{item.selectedOptions.map((option) => option.label).join(", ") || "Sem opções adicionais"}{item.itemNotes ? ` · ${item.itemNotes}` : ""}</small>
                      <div className="quantity-control"><button type="button" onClick={() => onChangeQuantity(item.lineId, -1)} aria-label="Diminuir quantidade"><Minus size={13} /></button><b>{item.quantity}</b><button type="button" onClick={() => onChangeQuantity(item.lineId, 1)} aria-label="Aumentar quantidade"><Plus size={13} /></button></div>
                    </div>
                    <button type="button" className="checkout-cart-item__remove" onClick={() => onRemove(item.lineId)} aria-label={`Remover ${item.product.name}`}><X size={15} /></button>
                  </article>;
                })}
              </div>
              <footer className="checkout-footer">
                <div className="checkout-totals">
                  <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                  <div><span>Entrega</span><em>Calculada no endereço</em></div>
                  <div className="checkout-totals__total"><span>Total estimado</span><strong>{money(subtotal)}</strong></div>
                </div>
                <button type="button" className="checkout-button" disabled={!orderingOpen} onClick={() => { setError(""); setStep("details"); }}>Continuar pedido</button>
                <small>Entrega, retirada e pagamento no próximo passo.</small>
              </footer>
            </section> : <div className="drawer-empty"><ShoppingBag size={36} /><p>Adicione seus favoritos e eles aparecem aqui.</p><button type="button" onClick={onClose}>Explorar cardápio</button></div>
          ) : step === "details" ? (
            <form key="details" className="checkout-form checkout-panel" onSubmit={(event) => { event.preventDefault(); goToPayment(); }}>
              <div className="checkout-order-preview">
                <span>{cartCount} {cartCount === 1 ? "item no carrinho" : "itens no carrinho"}</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div className="fulfillment-toggle" role="group" aria-label="Forma de recebimento">
                <button type="button" className={fulfillmentType === "pickup" ? "active" : ""} onClick={() => setFulfillmentType("pickup")} disabled={!settings.pickupEnabled}>Retirar</button>
                <button type="button" className={fulfillmentType === "delivery" ? "active" : ""} onClick={() => setFulfillmentType("delivery")} disabled={!settings.deliveryEnabled}>Entregar</button>
              </div>
              <label className="form-label">Nome<input required autoComplete="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Seu nome" /></label>
              <label className="form-label">WhatsApp<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="(11) 99999-9999" /></label>
              {fulfillmentType === "delivery" && <label className="form-label">Endereço<input required autoComplete="street-address" value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Rua, número e complemento" /></label>}
              {fulfillmentType === "delivery" && zones.length > 0 && <label className="form-label">Bairro<select required value={form.neighborhood} onChange={(event) => updateForm("neighborhood", event.target.value)}><option value="">Selecione seu bairro</option>{zones.map((zone) => <option key={zone.id} value={zone.name}>{zone.name} · {money(zone.feeCents)}</option>)}</select></label>}
              {fulfillmentType === "delivery" && zones.length === 0 && <label className="form-label">Bairro<input value={form.neighborhood} onChange={(event) => updateForm("neighborhood", event.target.value)} placeholder="Seu bairro" /></label>}
              <label className="form-label">Observações<textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} maxLength={300} rows={2} placeholder="Ex.: chamar no portão..." /></label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <footer className="checkout-form__actions">
                <button type="submit" className="checkout-button">Ir para pagamento</button>
                <button type="button" className="checkout-back-button" onClick={() => { setError(""); setStep("cart"); }}>Voltar ao carrinho</button>
              </footer>
            </form>
          ) : (
            <form key="payment" className="checkout-form checkout-panel checkout-panel--payment" onSubmit={submitOrder}>
              <div className="checkout-summary">
                {cart.map((item) => <div key={item.lineId}><span><b>{item.quantity}x {item.product.name}</b><small>{item.selectedOptions.map((option) => option.label).join(", ") || "Sem opções adicionais"}</small></span><strong>{money((item.product.priceCents + item.selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0)) * item.quantity)}</strong></div>)}
              </div>
              <fieldset className="payment-choice payment-choice--stacked">
                <legend>Escolha o pagamento</legend>
                <button type="button" className={paymentMethod === "pix" ? "active" : ""} onClick={() => { setPaymentMethod("pix"); setError(""); }}><span className="payment-choice__icon"><QrCode size={18} /></span><span><strong>PIX agora</strong><small>QR Code e copia e cola</small></span><span className="payment-choice__radio">{paymentMethod === "pix" ? <Check size={12} /> : null}</span></button>
                <button type="button" className="payment-choice__future" disabled aria-disabled="true"><span className="payment-choice__icon">▣</span><span><strong>Cartão de crédito</strong><small>Em breve no pagamento online</small></span><span className="payment-choice__tag">Em breve</span></button>
                <button type="button" className={paymentMethod === "pay_on_fulfillment" ? "active" : ""} onClick={() => { setPaymentMethod("pay_on_fulfillment"); setError(""); }}><span className="payment-choice__icon"><Clock3 size={18} /></span><span><strong>Ao receber</strong><small>Dinheiro ou maquininha</small></span><span className="payment-choice__radio">{paymentMethod === "pay_on_fulfillment" ? <Check size={12} /> : null}</span></button>
              </fieldset>

              {paymentMethod === "pix" ? <section className="checkout-payment-preview checkout-payment-preview--pix">
                <div className="checkout-payment-preview__qr" aria-hidden="true">PIX</div>
                <div><strong>Escaneie para pagar</strong><p>Após a confirmação do banco, o pedido é liberado e o WhatsApp fica disponível.</p></div>
                <label className="form-label">E-mail para gerar o PIX<input required type="email" autoComplete="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="seuemail@exemplo.com" /></label>
              </section> : <section className="checkout-payment-preview"><Clock3 size={22} /><div><strong>Pagamento na entrega ou retirada</strong><p>Combine dinheiro ou maquininha diretamente com a loja.</p></div></section>}

              {error && <div className="form-error" role="alert">{error}</div>}
              <footer className="checkout-footer checkout-footer--payment">
                <div className="checkout-totals">
                  <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                  <div><span>Entrega</span><em>{fulfillmentType === "pickup" ? "Grátis na retirada" : selectedZone ? money(estimatedDelivery) : "Calculada no endereço"}</em></div>
                  <div className="checkout-totals__total"><span>Total estimado</span><strong>{money(estimatedTotal)}</strong></div>
                </div>
                <button type="submit" className="checkout-button" disabled={!orderingOpen || submitting}>{submitting ? "Registrando..." : paymentMethod === "pix" ? "Confirmar pedido e gerar PIX" : "Confirmar pedido"} {!submitting && <ArrowRight size={16} />}</button>
                <button type="button" className="checkout-back-button" onClick={() => { setError(""); setStep("details"); }}>Voltar aos dados</button>
              </footer>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

export function StorefrontExperience({ initialData }: { initialData: InitialStorefrontData }) {
  const initialSettings: StoreSettings = { ...fallbackSettings, ...initialData.settings, logoKey: initialData.settings.logoKey ?? fallbackSettings.logoKey, whatsappNumber: initialData.settings.whatsappNumber ?? "", orderingMode: normalizeOrderingMode(initialData.settings.orderingMode), weeklySchedule: initialData.settings.weeklySchedule ?? fallbackSettings.weeklySchedule, appearance: { ...fallbackSettings.appearance, ...(initialData.settings.appearance ?? {}) } };
  const [products] = useState<Product[]>(() => (initialData.products.length ? initialData.products : fallbackProducts).map(mapProduct));
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [zones] = useState<DeliveryZone[]>(initialData.deliveryZones);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState<Category>("Todos");
  const [search, setSearch] = useState("");
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [closedNotice, setClosedNotice] = useState("");
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const featured = products.filter((product) => product.featured);
  const filtered = products.filter((product) => { const matchesCategory = category === "Todos" || product.category === category; const query = search.toLowerCase().trim(); return matchesCategory && (!query || `${product.name} ${product.description}`.toLowerCase().includes(query)); });

  useEffect(() => { const saved = window.localStorage.getItem("crazy-chicken-cart"); if (saved) { try { setCart(normalizeCart(JSON.parse(saved))); } catch { window.localStorage.removeItem("crazy-chicken-cart"); } } }, []);
  useEffect(() => { window.localStorage.setItem("crazy-chicken-cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { document.body.style.overflow = menuOpen || cartOpen || Boolean(customizing) ? "hidden" : ""; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setCartOpen(false); setCustomizing(null); } }; window.addEventListener("keydown", closeOnEscape); return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); }; }, [menuOpen, cartOpen, customizing]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    const refreshConfig = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/storefront/config", { cache: "no-store" });
        const data = await response.json() as { settings?: Partial<StoreSettings>; updatedAt?: string | null };
        if (!active || !data.settings) return;
        setSettings((current) => ({
          ...current,
          ...data.settings,
          logoKey: data.settings?.logoKey ?? fallbackSettings.logoKey,
          whatsappNumber: data.settings?.whatsappNumber ?? "",
          orderingMode: normalizeOrderingMode(data.settings?.orderingMode ?? current.orderingMode),
          weeklySchedule: data.settings?.weeklySchedule ?? current.weeklySchedule,
          appearance: { ...current.appearance, ...(data.settings?.appearance ?? {}) },
          updatedAt: data.updatedAt ?? data.settings?.updatedAt ?? current.updatedAt,
        }));
        setClock(Date.now());
      } catch {
        setSettings((current) => ({ ...current, orderingMode: "closed", availability: { isOpen: false, message: "Pedidos temporariamente indisponíveis" } }));
      }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshConfig(); };
    const timer = window.setInterval(() => void refreshConfig(), 30000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const availability = useMemo(() => getStoreAvailability(settings, new Date(clock)), [settings, clock]);
  const orderingOpen = availability.isOpen;
  const themeStyle = getStoreThemeTokens(settings.appearance) as CSSProperties;
  const desktopHeroUrl = assetUrl(settings.appearance.heroImageKey || "/menu-cover.jpeg");
  const mobileHeroUrl = assetUrl(settings.appearance.heroMobileImageKey || settings.appearance.heroImageKey || "/menu-cover.jpeg");
  const drinkBannerKeys = settings.appearance.drinkBannerImageKeys?.length ? settings.appearance.drinkBannerImageKeys : [settings.appearance.drinkBannerImageKey || "/drinks-menu.jpeg"];
  const drinkBannerUrls = drinkBannerKeys.map(assetUrl);

  const addToCart = (product: Product, selectedOptions: ProductOption[] = [], quantity = 1, itemNotes = "") => setCart((items) => { const optionKey = selectedOptions.map((option) => option.id).sort().join(","); const existing = items.find((item) => item.product.id === product.id && item.selectedOptions.map((option) => option.id).sort().join(",") === optionKey && item.itemNotes === itemNotes); return existing ? items.map((item) => item.lineId === existing.lineId ? { ...item, quantity: Math.min(20, item.quantity + quantity) } : item) : [...items, { lineId: crypto.randomUUID(), product, quantity, selectedOptions, itemNotes }]; });
  const startAdd = (product: Product) => { if (!orderingOpen) { setClosedNotice(availability.message); window.setTimeout(() => setClosedNotice(""), 4000); return; } setCustomizing(product); };
  const changeQuantity = (lineId: string, delta: number) => setCart((items) => items.map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  const removeFromCart = (lineId: string) => setCart((items) => items.filter((item) => item.lineId !== lineId));
  const closeMenu = () => setMenuOpen(false);

  return <div className="storefront-shell" style={themeStyle}><header className="store-header"><div className="store-header__inner"><button type="button" className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen}><Menu size={21} /></button><BrandMark logoKey={settings.logoKey} /><nav className="store-nav" aria-label="Navegação principal"><a href="#cardapio" className="store-nav__link store-nav__link--active">Cardápio</a><a href="#destaques" className="store-nav__link">Destaques</a><a href="#bebidas" className="store-nav__link">Bebidas</a><a href="#sobre" className="store-nav__link">A casa</a></nav><div className="store-header__actions"><button type="button" className="cart-button" onClick={() => setCartOpen(true)} aria-label="Abrir carrinho"><ShoppingBag size={20} /><span>Meu pedido</span>{cartCount > 0 && <b>{cartCount}</b>}</button></div></div></header><main>{closedNotice && <div className="store-closed-toast" role="status">{closedNotice}</div>}{!orderingOpen && <div className="store-closed-banner"><Clock3 size={17} /> <span><strong>Loja fechada para novos pedidos.</strong> {availability.message}</span></div>}<section className="hero-banner" id="cardapio"><picture className="hero-banner__media"><source media="(max-width: 760px)" srcSet={mobileHeroUrl} /><img src={desktopHeroUrl} alt="Balde de frango crocante Crazy Chicken" loading="eager" fetchPriority="high" decoding="async" onError={(event) => recoverPictureImage(event, "/menu-cover.jpeg")} /></picture><div className="hero-banner__shade" /><div className="hero-banner__content"><span className="eyebrow eyebrow--light"><Flame size={14} /> Sabor que vira rotina</span><h1>{settings.appearance.heroTitle}</h1><p>{settings.appearance.heroDescription}</p><a className="hero-banner__cta" href="#destaques">Ver o cardápio <ArrowRight size={18} /></a></div><div className="hero-banner__stamp"><span>247</span><small>Suzano</small></div></section><section className="store-content" id="destaques"><div className="section-heading"><div><span className="eyebrow">Direto da cozinha</span><h2>Escolha sua<br /><span>fome do dia.</span></h2></div><div className={`store-status ${orderingOpen ? "" : "store-status--closed"}`}><span className="status-dot" /> {availability.message} <Clock3 size={15} /> {settings.openingHours}</div></div><div className="featured-strip">{featured.slice(0, 3).map((product) => <button type="button" key={product.id} className="featured-strip__item" disabled={!orderingOpen} onClick={() => startAdd(product)}><img src={product.image} alt="" loading="lazy" decoding="async" onError={(event) => recoverImage(event, "/hero-food.jpeg")} /><span><small>{product.badge || "Destaque"}</small><strong>{product.name}</strong></span><Plus size={16} /></button>)}</div><DrinkSpotlight imageUrls={drinkBannerUrls} onViewDrinks={() => { setCategory("Bebidas"); document.getElementById("cardapio-produtos")?.scrollIntoView({ behavior: "smooth" }); }} /><div className="menu-toolbar" id="cardapio-produtos"><div className="category-list" role="tablist" aria-label="Categorias do cardápio">{categoryNames.map((item) => <button type="button" key={item} className={`category-pill ${category === item ? "category-pill--active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-field"><Search size={18} /><input placeholder="Buscar no cardápio" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onAdd={startAdd} disabled={!orderingOpen} />)}</div>{filtered.length === 0 && <div className="empty-state"><strong>Nada encontrado por aqui.</strong><span>Tente outra categoria ou busca.</span></div>}</section><section className="order-callout" id="sobre"><div className="order-callout__copy"><span className="eyebrow eyebrow--light">Pediu, chegou</span><h2>O frango mais louco<br />da <em>zona leste.</em></h2><p>{settings.address}</p></div><div className="order-callout__detail"><MapPin size={21} /><span>Retire no balcão<br /><strong>ou receba em casa</strong></span><ChevronRight size={20} /></div></section></main><footer className="store-footer"><BrandMark compact logoKey={settings.logoKey} /><span>© {settings.brandName} 2026</span><a className="footer-social" href="https://www.instagram.com/crazychicken247/" target="_blank" rel="noreferrer" aria-label="Instagram da Crazy Chicken"><img src="/instagram.svg" alt="" width={16} height={16} loading="lazy" decoding="async" aria-hidden /><span>@crazychicken247</span></a></footer>{menuOpen && <MobileMenu onClose={closeMenu} onOpenCart={() => setCartOpen(true)} />}{cartOpen && <CartDrawer cart={cart} settings={settings} zones={zones} orderingOpen={orderingOpen} availabilityMessage={availability.message} onClose={() => setCartOpen(false)} onChangeQuantity={changeQuantity} onRemove={removeFromCart} onClear={() => setCart([])} />}{cartCount > 0 && !cartOpen && <button type="button" className="floating-cart" onClick={() => setCartOpen(true)}><ShoppingBag size={19} /><span>Ver pedido</span><b>{cartCount}</b></button>}{customizing && <ProductOptionsDialog product={customizing} onClose={() => setCustomizing(null)} onConfirm={(options, quantity, notes) => { addToCart(customizing, options, quantity, notes); setCustomizing(null); }} />}</div>;
}

function DrinkSpotlight({ imageUrls, onViewDrinks }: { imageUrls: string[]; onViewDrinks: () => void }) {
  const images = imageUrls.length ? imageUrls : ["/drinks-menu.jpeg"];
  const signature = images.join("|");
  const [activeSlide, setActiveSlide] = useState(0);
  const activeImage = images[activeSlide] ?? images[0];

  const showPrevious = () => setActiveSlide((current) => (current - 1 + images.length) % images.length);
  const showNext = () => setActiveSlide((current) => (current + 1) % images.length);

  useEffect(() => setActiveSlide(0), [signature]);
  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % images.length), 4500);
    return () => window.clearInterval(timer);
  }, [images.length, signature]);

  return <section className="drink-spotlight" id="bebidas" aria-label="Destaque de bebidas"><div className="drink-spotlight__image"><img key={activeImage} src={activeImage} alt={`Caipirinhas gourmet Crazy Chicken — imagem ${activeSlide + 1} de ${images.length}`} loading="lazy" decoding="async" onError={(event) => recoverImage(event, "/drinks-menu.jpeg")} />{images.length > 1 && <><button type="button" className="drink-carousel__arrow drink-carousel__arrow--previous" onClick={showPrevious} aria-label="Mostrar imagem anterior"><span aria-hidden>‹</span></button><button type="button" className="drink-carousel__arrow drink-carousel__arrow--next" onClick={showNext} aria-label="Mostrar próxima imagem"><span aria-hidden>›</span></button><div className="drink-carousel" aria-label="Escolher imagem do banner">{images.map((image, index) => <button type="button" key={`${image}-${index}`} className={index === activeSlide ? "active" : ""} onClick={() => setActiveSlide(index)} aria-label={`Mostrar imagem ${index + 1}`} aria-current={index === activeSlide ? "true" : undefined} />)}</div></>}</div><div className="drink-spotlight__copy"><div className="drink-spotlight__topline"><span className="eyebrow eyebrow--light"><Flame size={14} /> Nova parada da casa</span><div className="drink-price"><small>a partir de</small><strong>R$44<sup>,99</sup></strong></div></div><h2>Brinde com<br /><em>uma caipi.</em></h2><p>Caipirinhas gourmet feitas na hora, com frutas de verdade e aquele toque Crazy.</p><div className="drink-flavors"><span>Limão</span><span>Morango</span><span>Maracujá</span><span>Kiwi</span></div><button type="button" onClick={onViewDrinks}>Ver bebidas <ArrowRight size={17} /></button></div></section>;
}

function mapProduct(item: CatalogProduct): Product {
  return { id: item.id, name: item.name, description: item.description, priceCents: item.priceCents, category: (item.category as Exclude<Category, "Todos">) || "Novidades", image: assetUrl(item.imageKey), badge: item.badge, featured: item.featured, options: item.options.map((option) => ({ id: option.id, groupName: option.groupName, label: option.label, priceDeltaCents: option.priceDeltaCents, required: option.required, selectionMode: option.selectionMode, minSelections: option.minSelections, maxSelections: option.maxSelections })) };
}

function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Partial<CartItem> & Partial<Product>;
    const product = item.product ?? item as unknown as Product;
    if (!product || typeof product.id !== "number") return [];
    return [{ lineId: item.lineId ?? `${product.id}-${index}`, product: product as Product, quantity: Math.max(1, Number(item.quantity) || 1), selectedOptions: Array.isArray(item.selectedOptions) ? item.selectedOptions : [], itemNotes: typeof item.itemNotes === "string" ? item.itemNotes : "" }];
  });
}
