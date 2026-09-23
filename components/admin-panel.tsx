"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bell, Check, ChevronRight, Eye, History, ImagePlus, LayoutDashboard, LogOut, Menu, Package, Pencil, Plus, Settings2, ShoppingBag, SlidersHorizontal, Trash2, Users, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { fallbackSettings } from "../lib/catalog";
import { emptyWeeklySchedule, getStoreAvailability, weekDays, type OrderingMode, type WeeklySchedule } from "../lib/store-hours";
import { getStoreThemeTokens } from "../lib/store-theme";

type Category = "Frangos" | "Acompanhamentos" | "Molhos" | "Novidades" | "Bebidas" | string;
export type ProductOption = { id: number; groupName: string; label: string; priceDeltaCents?: number; required?: boolean; selectionMode?: "single" | "multiple"; minSelections?: number; maxSelections?: number };
export type Product = { id: number; name: string; description: string; price: number; category: Category; image: string; imageKey?: string | null; badge?: string; featured?: boolean; available?: boolean; options?: ProductOption[] };
export type CurrentAdmin = { id: number; email: string; displayName: string; role: "owner" | "manager" | "attendant"; mfaEnabledAt: string | null };
export type AdminSection = "visao" | "pedidos" | "produtos" | "aparencia" | "configuracoes" | "equipe" | "atividades" | "seguranca";
type AdminOrder = { id: number; code: string; status: string; fulfillmentType: string; customerName: string; customerPhone: string; address?: string | null; neighborhood?: string | null; notes?: string | null; subtotalCents: number; deliveryFeeCents: number; totalCents: number; createdAt: string; updatedAt?: string };
type OrderItem = { id: number; productName: string; quantity: number; unitPriceCents: number; optionsJson: string; itemNotes?: string | null };
type Member = { id: number; email: string; name: string; role: string; status: string; mfaEnabledAt?: string | null; lastLoginAt?: string | null };
type DeliveryZone = { id: number; name: string; feeCents: number; active: boolean; sortOrder: number };
type AuditEntry = { id: number; actorEmail: string; action: string; entity: string; entityId?: string | null; createdAt: string };
type Appearance = {
  heroTitle: string;
  heroDescription: string;
  accent: string;
  primary: string;
  background: string;
  fontScale: string;
  density: string;
  visibleSections: string[];
};
type AdminSettings = {
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
  appearance: Appearance;
  availability?: { isOpen: boolean; message: string };
  updatedAt?: string | null;
};
type SettingsScope = "appearance" | "operations";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels: Record<string, string> = { received: "Recebido", confirmed: "Confirmado", preparing: "Em preparo", ready: "Pronto", out_for_delivery: "Saiu para entrega", completed: "Finalizado", cancelled: "Cancelado" };
const roleLabels: Record<string, string> = { owner: "Proprietário", manager: "Gerente", attendant: "Atendente" };
const dayLabels: Record<string, string> = { sunday: "Domingo", monday: "Segunda", tuesday: "Terça", wednesday: "Quarta", thursday: "Quinta", friday: "Sexta", saturday: "Sábado" };
const themePresets = [
  { id: "cartaz-amarelo", label: "Cartaz amarelo", accent: "#ffc21b", primary: "#e32120", background: "#fff8e9" },
  { id: "noite-crazy", label: "Noite Crazy", accent: "#ffc21b", primary: "#e32120", background: "#141414" },
  { id: "menu-claro", label: "Menu claro", accent: "#e8a500", primary: "#af171a", background: "#fffdf7" },
];

function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const cookie = document.cookie.split("; ").find((item) => item.startsWith("crazy_chicken_csrf="));
  const csrf = cookie?.slice("crazy_chicken_csrf=".length);
  return fetch(input, { ...init, cache: "no-store", headers: { ...(init.headers as Record<string, string> | undefined), ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}) } });
}

function mapProduct(item: Product & { priceCents?: number; imageKey?: string | null; category?: string }): Product {
  const imageKey = item.imageKey ?? null;
  const image = !imageKey ? "/hero-food.jpeg" : imageKey.startsWith("/") || imageKey.includes(".") && !imageKey.includes("/") ? `/${imageKey.replace(/^\//, "")}` : `/api/media?key=${encodeURIComponent(imageKey)}`;
  return { ...item, price: item.priceCents !== undefined ? item.priceCents / 100 : item.price, category: item.category ?? "Novidades", image, imageKey };
}

type DashboardPeriod = "day" | "week" | "fortnight" | "month";
type OrderPeriod = DashboardPeriod | "all";
const dashboardPeriodLabels: Record<DashboardPeriod, string> = { day: "Hoje", week: "Esta semana", fortnight: "Quinzena", month: "Este mês" };
const realizedOrderStatuses = new Set(["confirmed", "preparing", "ready", "out_for_delivery", "completed"]);

function saoPauloDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function periodStartKey(period: DashboardPeriod, now = new Date()) {
  const today = saoPauloDateKey(now);
  if (period === "month") return `${today.slice(0, 7)}-01`;
  const days = period === "day" ? 0 : period === "week" ? 6 : 14;
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString().slice(0, 10);
}

function isInDashboardPeriod(value: string, period: DashboardPeriod | "all") {
  if (period === "all") return true;
  const key = saoPauloDateKey(value);
  return key >= periodStartKey(period) && key <= saoPauloDateKey(new Date());
}

function greetingForSaoPaulo(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(now));
  return hour < 12 ? "Bom dia" : "Boa noite";
}

function parseOptions(value: string) {
  try { const parsed = JSON.parse(value) as { options?: string[] } | string[]; return (Array.isArray(parsed) ? parsed : parsed.options ?? []).join(", "); }
  catch { return ""; }
}

function settingsSignature(scope: SettingsScope, settings: Partial<AdminSettings>) {
  if (scope === "appearance") return JSON.stringify({ brandName: settings.brandName, theme: settings.theme, appearance: settings.appearance });
  return JSON.stringify({ logoKey: settings.logoKey, whatsappNumber: settings.whatsappNumber, address: settings.address, openingHours: settings.openingHours, orderingMode: settings.orderingMode, weeklySchedule: settings.weeklySchedule, deliveryEnabled: settings.deliveryEnabled, pickupEnabled: settings.pickupEnabled, minimumOrderCents: settings.minimumOrderCents, defaultDeliveryFeeCents: settings.defaultDeliveryFeeCents });
}

export function AdminPanel({ products, currentUser, initialSection = "visao" }: { products: Product[]; currentUser: CurrentAdmin; initialSection?: AdminSection }) {
  const router = useRouter();
  const [section, setSectionState] = useState<AdminSection>(initialSection);
  const [catalog, setCatalog] = useState(products);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({ ...fallbackSettings, orderingMode: "open", weeklySchedule: emptyWeeklySchedule() });
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{ order: AdminOrder; items: OrderItem[] } | null>(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("day");
  const [orderPeriod, setOrderPeriod] = useState<OrderPeriod>("day");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState<Record<SettingsScope, boolean>>({ appearance: false, operations: false });
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const menuFirst = useRef<HTMLButtonElement>(null);
  const settingsDirtyRef = useRef<Record<SettingsScope, boolean>>({ appearance: false, operations: false });
  const settingsLoadId = useRef(0);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); };
  const setSection = (value: AdminSection) => { setSectionState(value); setMobileMenu(false); setNotifications(false); setAccountMenu(false); const url = value === "visao" ? "/admin" : `/admin?section=${value}`; window.history.replaceState(null, "", url); };

  const loadOrders = async () => { const response = await adminFetch("/api/admin/orders"); if (response.status === 401) return router.replace("/admin/login"); if (response.ok) setOrders((await response.json() as { orders: AdminOrder[] }).orders); };
  const loadCatalog = async () => { const response = await adminFetch("/api/admin/products"); if (!response.ok) return; const data = await response.json() as { products: Array<Product & { categoryId: number; priceCents: number }>; categories: Array<{ id: number; name: string }> }; const names = new Map(data.categories.map((category) => [category.id, category.name])); setCategories(data.categories); setCatalog(data.products.map((item) => mapProduct({ ...item, category: names.get(item.categoryId) ?? "Novidades" }))); };
  const loadSettings = async () => { const requestId = ++settingsLoadId.current; const response = await adminFetch("/api/admin/settings"); if (!response.ok) { notify("Não foi possível carregar as configurações da loja."); return; } const data = await response.json() as { settings: Partial<AdminSettings> | null }; if (requestId !== settingsLoadId.current || !data.settings || settingsDirtyRef.current.appearance || settingsDirtyRef.current.operations) return; setSettings((current) => ({ ...current, ...data.settings, appearance: { ...current.appearance, ...(data.settings?.appearance ?? {}) }, weeklySchedule: data.settings?.weeklySchedule ?? current.weeklySchedule })); };
  const loadZones = async () => { const response = await adminFetch("/api/admin/delivery-zones"); if (response.ok) setZones((await response.json() as { zones: DeliveryZone[] }).zones); };
  const loadMembers = async () => { const response = await adminFetch("/api/admin/users"); if (response.ok) setMembers((await response.json() as { users: Member[] }).users); };
  const loadAudit = async () => { const response = await adminFetch("/api/admin/audit-log"); if (response.ok) setAudit((await response.json() as { entries: AuditEntry[] }).entries); };

  useEffect(() => { void Promise.all([loadOrders(), loadSettings().then(() => setLoaded((value) => ({ ...value, settings: true })))]); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (new URLSearchParams(window.location.search).get("created") !== "1") return; notify("Conta criada com sucesso. Bem-vindo ao painel."); window.history.replaceState(null, "", "/admin"); }, []);
  useEffect(() => {
    const tasks: Promise<void>[] = [];
    if (section === "produtos" && !loaded.products) tasks.push(loadCatalog().then(() => setLoaded((value) => ({ ...value, products: true }))));
    if (section === "configuracoes" && !loaded.zones) tasks.push(loadZones().then(() => setLoaded((value) => ({ ...value, zones: true }))));
    if (section === "equipe" && !loaded.team) tasks.push(loadMembers().then(() => setLoaded((value) => ({ ...value, team: true }))));
    if (section === "atividades" && !loaded.audit) tasks.push(loadAudit().then(() => setLoaded((value) => ({ ...value, audit: true }))));
    void Promise.all(tasks);
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadOrders(); }, 30000); return () => window.clearInterval(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const locked = mobileMenu || Boolean(editing) || Boolean(selectedOrder); document.body.style.overflow = locked ? "hidden" : ""; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMobileMenu(false); setEditing(null); setSelectedOrder(null); setNotifications(false); setAccountMenu(false); } }; window.addEventListener("keydown", escape); return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", escape); }; }, [mobileMenu, editing, selectedOrder]);
  useEffect(() => { if (mobileMenu) menuFirst.current?.focus(); }, [mobileMenu]);

  const saveProduct = async (product: Product) => {
    const categoryId = categories.find((category) => category.name === product.category)?.id;
    const response = await adminFetch("/api/admin/products", { method: product.id === 0 ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id, name: product.name, description: product.description, priceCents: Math.round(product.price * 100), categoryId, imageKey: product.imageKey, badge: product.badge ?? null, available: product.available !== false, featured: product.featured === true, options: product.options ?? [] }) });
    const data = await response.json().catch(() => ({})) as { error?: string; product?: Product & { priceCents: number } };
    if (!response.ok || !data.product) throw new Error(data.error ?? "Não foi possível salvar o produto.");
    const saved = mapProduct({ ...data.product, category: product.category });
    setCatalog((items) => product.id === 0 ? [...items, saved] : items.map((item) => item.id === saved.id ? saved : item));
    setEditing(null); notify("Produto salvo no cardápio.");
  };
  const deleteProduct = async (product: Product) => { if (!window.confirm(`Excluir ${product.name}? Essa ação não pode ser desfeita.`)) return; const response = await adminFetch(`/api/admin/products?id=${product.id}`, { method: "DELETE" }); if (response.ok) { setCatalog((items) => items.filter((item) => item.id !== product.id)); notify("Produto removido."); } else notify("Não foi possível remover o produto."); };
  const saveSettings = async (scope: SettingsScope) => {
    setSavingSettings(true);
    const payload = scope === "appearance"
      ? { brandName: settings.brandName, theme: settings.theme, appearance: settings.appearance }
      : { logoKey: settings.logoKey, whatsappNumber: settings.whatsappNumber, address: settings.address, openingHours: settings.openingHours, orderingMode: settings.orderingMode, weeklySchedule: settings.weeklySchedule, deliveryEnabled: settings.deliveryEnabled, pickupEnabled: settings.pickupEnabled, minimumOrderCents: settings.minimumOrderCents, defaultDeliveryFeeCents: settings.defaultDeliveryFeeCents };
    try {
      const response = await adminFetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({})) as { error?: string; settings?: AdminSettings };
      if (!response.ok || !data.settings) throw new Error(data.error ?? "Não foi possível publicar as configurações.");
      const publicResponse = await fetch(`/api/storefront/config?published=${Date.now()}`, { cache: "no-store" });
      const publicData = await publicResponse.json().catch(() => ({})) as { settings?: AdminSettings };
      if (!publicResponse.ok || !publicData.settings || settingsSignature(scope, data.settings) !== settingsSignature(scope, publicData.settings)) throw new Error("A configuração foi gravada, mas a publicação ainda não foi confirmada. Tente novamente.");
      const saved = data.settings;
      setSettings((current) => ({ ...current, ...saved, appearance: { ...current.appearance, ...saved.appearance }, weeklySchedule: saved.weeklySchedule ?? current.weeklySchedule }));
      settingsDirtyRef.current = { ...settingsDirtyRef.current, [scope]: false };
      setSettingsDirty((current) => ({ ...current, [scope]: false }));
      notify(scope === "appearance" ? "Aparência publicada na loja." : "Funcionamento publicado na loja.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível publicar as configurações.");
    } finally {
      setSavingSettings(false);
    }
  };
  const patchSettings = (patch: Partial<AdminSettings>, scope: SettingsScope) => { setSettings((current) => ({ ...current, ...patch, appearance: patch.appearance ? { ...current.appearance, ...patch.appearance } : current.appearance })); settingsDirtyRef.current = { ...settingsDirtyRef.current, [scope]: true }; setSettingsDirty((current) => ({ ...current, [scope]: true })); };
  const updateOrderStatus = async (id: number, status: string) => { const response = await adminFetch("/api/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); if (!response.ok) return notify("Não foi possível atualizar o status."); const order = (await response.json() as { order: AdminOrder }).order; setOrders((items) => items.map((item) => item.id === id ? order : item)); setSelectedOrder((current) => current?.order.id === id ? { ...current, order } : current); notify("Status atualizado."); };
  const openOrder = async (id: number) => { const response = await adminFetch(`/api/admin/orders?id=${id}`); if (response.ok) setSelectedOrder(await response.json() as { order: AdminOrder; items: OrderItem[] }); else notify("Não foi possível abrir o pedido."); };
  const upload = async (file: File) => { const body = new FormData(); body.append("file", file); const response = await adminFetch("/api/admin/uploads", { method: "POST", body }); if (!response.ok) throw new Error("Não foi possível enviar a imagem."); return (await response.json() as { key: string }).key; };
  const logout = async () => { const response = await adminFetch("/api/admin/logout", { method: "POST" }); if (!response.ok) return notify("Não foi possível sair agora."); router.replace("/admin/login"); router.refresh(); };

  const allowedSections: AdminSection[] = currentUser.role === "owner" ? ["visao", "pedidos", "produtos", "aparencia", "configuracoes", "equipe", "atividades"] : currentUser.role === "manager" ? ["visao", "pedidos", "produtos", "aparencia", "configuracoes"] : ["visao", "pedidos"];
  const allNavItems: Array<[AdminSection, typeof LayoutDashboard, string]> = [["visao", LayoutDashboard, "Visão geral"], ["pedidos", ShoppingBag, "Pedidos"], ["produtos", Package, "Produtos"], ["aparencia", SlidersHorizontal, "Aparência"], ["configuracoes", Settings2, "Configurações"], ["equipe", Users, "Equipe e acessos"], ["atividades", History, "Atividades"]];
  const navItems = allNavItems.filter(([key]) => allowedSections.includes(key));
  const pendingOrders = orders.filter((order) => ["received", "confirmed", "preparing"].includes(order.status));
  const periodOrders = orders.filter((order) => isInDashboardPeriod(order.createdAt, dashboardPeriod));
  const revenue = periodOrders.filter((order) => realizedOrderStatuses.has(order.status)).reduce((sum, order) => sum + order.totalCents, 0);
  const visibleOrders = orders.filter((order) => isInDashboardPeriod(order.createdAt, orderPeriod) && (orderFilter === "all" || order.status === orderFilter));
  const title: Record<AdminSection, string> = { visao: `${greetingForSaoPaulo()}, ${currentUser.displayName}.`, pedidos: "Pedidos", produtos: "Produtos", aparencia: "Aparência", configuracoes: "Configurações", equipe: "Equipe e acessos", atividades: "Atividades", seguranca: "Minha segurança" };

  const navigation = <><div className="admin-sidebar__top"><BrandMark /><span className="admin-tag">painel do admin</span><button type="button" className="admin-mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button></div><nav className="admin-nav" aria-label="Painel administrativo">{navItems.map(([key, Icon, label], index) => <button ref={index === 0 ? menuFirst : undefined} key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={18} />{label}{key === "pedidos" && pendingOrders.length > 0 && <span className="admin-nav__count">{pendingOrders.length}</span>}</button>)}</nav><Link className="admin-back" href="/"><Eye size={17} /> Ver loja</Link><button type="button" className="admin-user" onClick={() => setAccountMenu((value) => !value)} aria-expanded={accountMenu}><div className="admin-avatar">{currentUser.displayName.slice(0, 2).toUpperCase()}</div><span><strong>{currentUser.displayName}</strong><small>{roleLabels[currentUser.role]}</small></span><ChevronRight size={15} /></button>{accountMenu && <div className="admin-account-menu"><button type="button" onClick={() => setSection("seguranca")}><Settings2 size={16} /> Minha segurança</button><button type="button" onClick={logout}><LogOut size={16} /> Sair</button></div>}</>;

  return <div className="admin-shell">
    <div className={`admin-mobile-overlay ${mobileMenu ? "open" : ""}`} onClick={() => setMobileMenu(false)} />
    <aside className={`admin-sidebar ${mobileMenu ? "admin-sidebar--open" : ""}`}>{navigation}</aside>
    <main className="admin-main">
      <div className="admin-mobile-bar"><button type="button" className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu" aria-expanded={mobileMenu}><Menu size={21} /></button><BrandMark compact /><button type="button" className="icon-button" onClick={() => setNotifications((value) => !value)} aria-label="Pedidos pendentes"><Bell size={19} />{pendingOrders.length > 0 && <b>{pendingOrders.length}</b>}</button></div>
      <header className="admin-header"><div><span className="eyebrow">Operação Crazy Chicken</span><h1>{title[section]}</h1></div><div className="admin-header__actions"><div className="admin-popover-wrap"><button type="button" className="icon-button" onClick={() => setNotifications((value) => !value)} aria-label="Notificações"><Bell size={19} />{pendingOrders.length > 0 && <b>{pendingOrders.length}</b>}</button>{notifications && <div className="admin-notifications"><strong>Pedidos em andamento</strong>{pendingOrders.slice(0, 5).map((order) => <button type="button" key={order.id} onClick={() => { setSection("pedidos"); void openOrder(order.id); }}>{order.code}<span>{statusLabels[order.status]}</span></button>)}{!pendingOrders.length && <p>Nenhum pedido pendente.</p>}</div>}</div><Link className="admin-store-link" href="/">Abrir loja <ArrowRight size={16} /></Link></div></header>
      {notice && <div className="admin-notice" role="status"><Check size={17} /> {notice}</div>}
      {section === "visao" && <Dashboard orders={periodOrders} periodOrders={periodOrders} revenue={revenue} period={dashboardPeriod} onPeriod={setDashboardPeriod} onSection={setSection} onOrder={openOrder} onStatus={updateOrderStatus} />}
      {section === "pedidos" && <OrdersSection orders={visibleOrders} filter={orderFilter} onFilter={setOrderFilter} period={orderPeriod} onPeriod={setOrderPeriod} onOrder={openOrder} onStatus={updateOrderStatus} />}
      {section === "produtos" && <ProductsSection products={catalog} onEdit={setEditing} onDelete={deleteProduct} onNew={() => setEditing({ id: 0, name: "Novo produto", description: "", price: 0, category: categories[0]?.name ?? "Frangos", image: "/hero-food.jpeg", available: true, options: [] })} />}
      {section === "aparencia" && <AppearanceSection settings={settings} dirty={settingsDirty.appearance} saving={savingSettings} onPatch={(patch) => patchSettings(patch, "appearance")} onSave={() => saveSettings("appearance")} />}
      {section === "configuracoes" && <SettingsSection settings={settings} zones={zones} dirty={settingsDirty.operations} saving={savingSettings} onPatch={(patch) => patchSettings(patch, "operations")} onSave={() => saveSettings("operations")} onZones={setZones} notify={notify} upload={upload} />}
      {section === "equipe" && currentUser.role === "owner" && <TeamSection currentUser={currentUser} members={members} reload={loadMembers} notify={notify} />}
      {section === "atividades" && currentUser.role === "owner" && <AuditSection entries={audit} />}
      {section === "seguranca" && <SecuritySection currentUser={currentUser} notify={notify} />}
    </main>
    {editing && <ProductEditor product={editing} categories={categories.map((category) => category.name)} onClose={() => setEditing(null)} onSave={saveProduct} onUpload={upload} />}
    {selectedOrder && <OrderDetails data={selectedOrder} onClose={() => setSelectedOrder(null)} onStatus={updateOrderStatus} />}
  </div>;
}

function Dashboard({ orders, periodOrders, revenue, period, onPeriod, onSection, onOrder, onStatus }: { orders: AdminOrder[]; periodOrders: AdminOrder[]; revenue: number; period: DashboardPeriod; onPeriod: (value: DashboardPeriod) => void; onSection: (section: AdminSection) => void; onOrder: (id: number) => void; onStatus: (id: number, status: string) => void }) {
  const valid = periodOrders.filter((order) => realizedOrderStatuses.has(order.status));
  const periodLabel = dashboardPeriodLabels[period];
  const stats = [[`Pedidos · ${periodLabel}`, String(periodOrders.length), "todos os status"], [`Faturamento · ${periodLabel}`, money(revenue), "confirmados ou finalizados"], ["Ticket médio", money(valid.length ? revenue / valid.length : 0), `média de ${periodLabel.toLowerCase()}`]];
  return <><div className="admin-card dashboard-toolbar"><div><span className="eyebrow">Período do dashboard</span><strong>Resumo da operação</strong></div><select className="filter-button" value={period} onChange={(event) => onPeriod(event.target.value as DashboardPeriod)} aria-label="Período do dashboard">{Object.entries(dashboardPeriodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><div className="stats-grid">{stats.map(([label, value, help]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small>{help}</small></div>)}</div><div className="admin-columns"><section className="admin-card"><div className="admin-card__heading"><div><span className="eyebrow">Acompanhe de perto</span><h2>Pedidos recentes</h2></div><button type="button" className="text-button" onClick={() => onSection("pedidos")}>Ver todos <ArrowRight size={15} /></button></div><OrderList orders={orders.slice(0, 5)} onOrder={onOrder} onStatus={onStatus} /></section><section className="admin-card admin-card--dark"><span className="eyebrow eyebrow--light">Atalho rápido</span><h2>Atualize sua operação.</h2><p>Produtos, visual, horários, taxas e bairros em um só painel.</p><button type="button" className="dark-card-button" onClick={() => onSection("configuracoes")}>Abrir configurações <ArrowRight size={16} /></button></section></div></>;
}

function OrdersSection({ orders, filter, onFilter, period, onPeriod, onOrder, onStatus }: { orders: AdminOrder[]; filter: string; onFilter: (value: string) => void; period: OrderPeriod; onPeriod: (value: OrderPeriod) => void; onOrder: (id: number) => void; onStatus: (id: number, status: string) => void }) {
  return <section className="admin-card page-card"><div className="admin-card__heading"><div><span className="eyebrow">Operação</span><h2>Todos os pedidos</h2></div><div className="orders-filters"><select className="filter-button" value={period} onChange={(event) => onPeriod(event.target.value as OrderPeriod)} aria-label="Período dos pedidos"><option value="all">Todos os períodos</option>{Object.entries(dashboardPeriodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select className="filter-button" value={filter} onChange={(event) => onFilter(event.target.value)} aria-label="Status dos pedidos"><option value="all">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></div><OrderList orders={orders} onOrder={onOrder} onStatus={onStatus} /></section>;
}

function OrderList({ orders, onOrder, onStatus }: { orders: AdminOrder[]; onOrder: (id: number) => void; onStatus: (id: number, status: string) => void }) {
  if (!orders.length) return <div className="admin-empty">Ainda não há pedidos nesta lista.</div>;
  return <div className="admin-order-list">{orders.map((order) => <article className="admin-order-card" key={order.id} onClick={() => onOrder(order.id)}><div><strong>{order.code}</strong><span>{order.customerName} · {new Date(order.createdAt).toLocaleString("pt-BR")}</span></div><b>{money(order.totalCents)}</b><select value={order.status} onClick={(event) => event.stopPropagation()} onChange={(event) => onStatus(order.id, event.target.value)} aria-label={`Status do pedido ${order.code}`}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronRight size={17} /></article>)}</div>;
}

function ProductsSection({ products, onEdit, onDelete, onNew }: { products: Product[]; onEdit: (product: Product) => void; onDelete: (product: Product) => void; onNew: () => void }) {
  return <section className="admin-card page-card"><div className="admin-card__heading"><div><span className="eyebrow">Seu catálogo</span><h2>Produtos cadastrados</h2></div><button type="button" className="primary-button" onClick={onNew}><Plus size={17} /> Novo produto</button></div><div className="admin-products-list">{products.map((product) => <article className="admin-product-row" key={product.id}><img src={product.image} width="52" height="45" loading="lazy" alt="" /><div><strong>{product.name}</strong><span>{product.category} · {product.available === false ? "indisponível" : product.description}</span></div><b>{money(Math.round(product.price * 100))}</b><button type="button" className="icon-button" onClick={() => onEdit(product)} aria-label={`Editar ${product.name}`}><Pencil size={17} /></button><button type="button" className="icon-button icon-button--danger" onClick={() => onDelete(product)} aria-label={`Excluir ${product.name}`}><Trash2 size={17} /></button></article>)}</div></section>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (next: string) => { setText(next); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase()); };
  return <label className="form-label color-field">{label}<span><input type="color" value={value} onChange={(event) => commit(event.target.value)} aria-label={`Selecionar ${label.toLowerCase()}`} /><input value={text} onChange={(event) => commit(event.target.value)} maxLength={7} pattern="#[0-9a-fA-F]{6}" aria-label={`${label} hexadecimal`} /></span></label>;
}

function AppearanceSection({ settings, dirty, saving, onPatch, onSave }: { settings: AdminSettings; dirty: boolean; saving: boolean; onPatch: (patch: Partial<AdminSettings>) => void; onSave: () => void }) {
  const changeAppearance = (patch: Partial<Appearance>) => onPatch({ appearance: { ...settings.appearance, ...patch } });
  const previewStyle = getStoreThemeTokens(settings.appearance) as CSSProperties;
  return <section className="appearance-layout"><div className="admin-card page-card"><div className="admin-card__heading"><div><span className="eyebrow">Identidade da loja</span><h2>Personalize sua vitrine</h2></div><Settings2 size={21} /></div><label className="form-label">Nome da loja<input value={settings.brandName} onChange={(event) => onPatch({ brandName: event.target.value })} /></label><label className="form-label">Título principal<input value={settings.appearance.heroTitle} onChange={(event) => changeAppearance({ heroTitle: event.target.value })} /></label><label className="form-label">Descrição da vitrine<textarea value={settings.appearance.heroDescription} onChange={(event) => changeAppearance({ heroDescription: event.target.value })} /></label><div className="form-label">Modelo visual<div className="theme-grid">{themePresets.map((theme) => <button type="button" key={theme.id} className={`theme-option ${settings.theme === theme.id ? "active" : ""}`} onClick={() => onPatch({ theme: theme.id, appearance: { ...settings.appearance, accent: theme.accent, primary: theme.primary, background: theme.background } })}><span style={{ background: theme.background, borderColor: theme.primary }}><i style={{ background: theme.accent }} /><i style={{ background: theme.primary }} /></span>{theme.label}</button>)}</div></div><div className="appearance-colors"><ColorField label="Cor de destaque" value={settings.appearance.accent} onChange={(value) => onPatch({ theme: "custom", appearance: { ...settings.appearance, accent: value } })} /><ColorField label="Cor principal" value={settings.appearance.primary} onChange={(value) => onPatch({ theme: "custom", appearance: { ...settings.appearance, primary: value } })} /><ColorField label="Fundo" value={settings.appearance.background} onChange={(value) => onPatch({ theme: "custom", appearance: { ...settings.appearance, background: value } })} /></div><p className={`publish-meta ${dirty ? "pending" : ""}`}>{dirty ? "Alterações pendentes" : settings.updatedAt ? `Publicado em ${new Date(settings.updatedAt).toLocaleString("pt-BR")}` : "Aguardando primeira publicação"}</p><button type="button" className="primary-button appearance-save" disabled={!dirty || saving} onClick={onSave}><Check size={17} /> {saving ? "Publicando..." : dirty ? "Salvar e publicar" : "Publicado"}</button></div><div className="admin-card preview-card"><div className="admin-card__heading"><div><span className="eyebrow">Prévia antes de publicar</span><h2>Sua loja</h2></div></div><div className="mini-preview" style={previewStyle}><div className="mini-preview__top"><BrandMark compact /><span>Meu pedido <ShoppingBag size={12} /></span></div><div className="mini-preview__hero"><img src="/menu-cover.jpeg" alt="" /><div><small>{settings.brandName}</small><strong>{settings.appearance.heroTitle}</strong></div></div><h3>Escolha sua fome do dia.</h3><button type="button">Adicionar ao pedido</button><div className="mini-preview__line" /><div className="mini-preview__line mini-preview__line--short" /></div></div></section>;
}

function ScheduleEditor({ schedule, onChange }: { schedule: WeeklySchedule; onChange: (schedule: WeeklySchedule) => void }) {
  const update = (day: keyof WeeklySchedule, index: number, patch: { open?: string; close?: string }) => onChange({ ...schedule, [day]: schedule[day].map((interval, item) => item === index ? { ...interval, ...patch } : interval) });
  return <div className="schedule-editor">{weekDays.map((day) => <div className="schedule-day" key={day}><div><strong>{dayLabels[day]}</strong><button type="button" onClick={() => onChange({ ...schedule, [day]: [...schedule[day], { open: "18:00", close: "23:00" }] })}><Plus size={14} /> Horário</button></div>{schedule[day].length ? schedule[day].map((interval, index) => <div className="schedule-interval" key={`${day}-${index}`}><input type="time" value={interval.open} onChange={(event) => update(day, index, { open: event.target.value })} aria-label={`Abertura de ${dayLabels[day]}`} /><span>até</span><input type="time" value={interval.close} onChange={(event) => update(day, index, { close: event.target.value })} aria-label={`Fechamento de ${dayLabels[day]}`} /><button type="button" className="remove-button" onClick={() => onChange({ ...schedule, [day]: schedule[day].filter((_, item) => item !== index) })} aria-label="Remover horário"><Trash2 size={15} /></button></div>) : <small>Fechado</small>}</div>)}</div>;
}

function SettingsSection({ settings, zones, dirty, saving, onPatch, onSave, onZones, notify, upload }: { settings: AdminSettings; zones: DeliveryZone[]; dirty: boolean; saving: boolean; onPatch: (patch: Partial<AdminSettings>) => void; onSave: () => void; onZones: (zones: DeliveryZone[]) => void; notify: (message: string) => void; upload: (file: File) => Promise<string> }) {
  const [zoneName, setZoneName] = useState(""); const [zoneFee, setZoneFee] = useState("0");
  const addZone = async () => { const response = await adminFetch("/api/admin/delivery-zones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: zoneName, feeCents: Math.round(Number(zoneFee.replace(",", ".")) * 100) }) }); const data = await response.json().catch(() => ({})) as { zone?: DeliveryZone; error?: string }; if (!response.ok || !data.zone) return notify(data.error ?? "Não foi possível adicionar o bairro."); onZones([...zones, data.zone]); setZoneName(""); setZoneFee("0"); };
  const patchZone = async (zone: DeliveryZone, patch: Partial<DeliveryZone>) => { const response = await adminFetch("/api/admin/delivery-zones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: zone.id, ...patch }) }); if (response.ok) onZones(zones.map((item) => item.id === zone.id ? { ...item, ...patch } : item)); else notify("Não foi possível atualizar o bairro."); };
  const removeZone = async (zone: DeliveryZone) => { if (!window.confirm(`Remover ${zone.name}?`)) return; const response = await adminFetch(`/api/admin/delivery-zones?id=${zone.id}`, { method: "DELETE" }); if (response.ok) onZones(zones.filter((item) => item.id !== zone.id)); else notify("Não foi possível remover o bairro."); };
  const availability = getStoreAvailability(settings);
  return <div className="settings-layout"><section className="admin-card settings-card"><div className="admin-card__heading"><div><span className="eyebrow">Operação</span><h2>Funcionamento e pedidos</h2></div><span className={`store-mode-badge ${availability.isOpen ? "open" : "closed"}`}>{availability.message}</span></div><div className="mode-selector">{([["automatic", "Automático"], ["open", "Aberto manualmente"], ["closed", "Fechado manualmente"]] as Array<[OrderingMode, string]>).map(([value, label]) => <button type="button" className={settings.orderingMode === value ? "active" : ""} key={value} onClick={() => onPatch({ orderingMode: value })}>{label}</button>)}</div>{settings.orderingMode === "automatic" && <ScheduleEditor schedule={settings.weeklySchedule} onChange={(weeklySchedule) => onPatch({ weeklySchedule })} />}<div className="form-two-col"><label className="form-label">WhatsApp para pedidos<input inputMode="tel" value={settings.whatsappNumber} onChange={(event) => onPatch({ whatsappNumber: event.target.value })} placeholder="5511999999999" /></label><label className="form-label">Texto de horário<input value={settings.openingHours} onChange={(event) => onPatch({ openingHours: event.target.value })} /></label></div><label className="form-label">Endereço da loja<input value={settings.address} onChange={(event) => onPatch({ address: event.target.value })} /></label><div className="form-two-col"><label className="form-label">Taxa padrão<input type="number" min="0" step="0.01" value={(settings.defaultDeliveryFeeCents / 100).toFixed(2)} onChange={(event) => onPatch({ defaultDeliveryFeeCents: Math.round(Number(event.target.value || 0) * 100) })} /></label><label className="form-label">Pedido mínimo<input type="number" min="0" step="0.01" value={(settings.minimumOrderCents / 100).toFixed(2)} onChange={(event) => onPatch({ minimumOrderCents: Math.round(Number(event.target.value || 0) * 100) })} /></label></div><div className="settings-checks"><label><input type="checkbox" checked={settings.pickupEnabled} onChange={(event) => onPatch({ pickupEnabled: event.target.checked })} /> Aceitar retirada</label><label><input type="checkbox" checked={settings.deliveryEnabled} onChange={(event) => onPatch({ deliveryEnabled: event.target.checked })} /> Aceitar entrega</label></div><div className="settings-upload"><label className="secondary-button"><ImagePlus size={17} /> Enviar logo<input type="file" accept="image/png,image/svg+xml,image/jpeg" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { onPatch({ logoKey: await upload(file) }); } catch (error) { notify(error instanceof Error ? error.message : "Falha no envio."); } }} /></label>{settings.logoKey && <span>{settings.logoKey}</span>}</div><button type="button" className="primary-button appearance-save" disabled={!dirty || saving} onClick={onSave}><Check size={17} /> {saving ? "Salvando..." : dirty ? "Salvar configurações" : "Configurações salvas"}</button></section><section className="admin-card"><div className="admin-card__heading"><div><span className="eyebrow">Entrega</span><h2>Bairros e taxas</h2></div></div><div className="zone-create"><input placeholder="Nome do bairro" value={zoneName} onChange={(event) => setZoneName(event.target.value)} /><input type="number" min="0" step="0.01" value={zoneFee} onChange={(event) => setZoneFee(event.target.value)} aria-label="Taxa" /><button type="button" className="primary-button" disabled={!zoneName.trim()} onClick={addZone}><Plus size={16} /> Adicionar</button></div><div className="zone-list">{zones.map((zone) => <div className="zone-row" key={zone.id}><span><strong>{zone.name}</strong><small>{money(zone.feeCents)}</small></span><label><input type="checkbox" checked={zone.active} onChange={(event) => void patchZone(zone, { active: event.target.checked })} /> Ativo</label><button type="button" className="remove-button" onClick={() => void removeZone(zone)} aria-label={`Remover ${zone.name}`}><Trash2 size={16} /></button></div>)}</div></section></div>;
}

function TeamSection({ currentUser, members, reload, notify }: { currentUser: CurrentAdmin; members: Member[]; reload: () => Promise<void>; notify: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("attendant");
  const invite = async (member?: Member) => { const response = await adminFetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: member?.email ?? email, name: member?.name ?? name, role: member?.role ?? role }) }); const data = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) return notify(data.error ?? "Não foi possível enviar o convite."); setEmail(""); setName(""); await reload(); notify(member ? "Convite reenviado." : "Convite enviado."); };
  const update = async (member: Member, patch: Partial<Member>) => { const response = await adminFetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id, ...patch }) }); const data = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) return notify(data.error ?? "Não foi possível atualizar o acesso."); await reload(); notify("Acesso atualizado."); };
  const remove = async (member: Member) => { if (!window.confirm(`Excluir permanentemente o acesso de ${member.name} (${member.email})?`)) return; const response = await adminFetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id }) }); const data = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) return notify(data.error ?? "Não foi possível excluir o acesso."); await reload(); notify("Acesso excluído."); };
  return <div className="team-layout"><section className="admin-card team-invite"><div className="admin-card__heading"><div><span className="eyebrow">Proprietário</span><h2>Convidar pessoa</h2></div></div><div className="team-invite__fields"><label className="form-label">Nome<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-label">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label></div><label className="form-label">Função<select value={role} onChange={(event) => setRole(event.target.value)}><option value="attendant">Atendente · pedidos</option><option value="manager">Gerente · operação</option></select></label><button type="button" className="primary-button" disabled={!email.includes("@")} onClick={() => void invite()}>Enviar convite</button></section><section className="admin-card team-members"><div className="admin-card__heading"><div><span className="eyebrow">Acessos</span><h2>Equipe</h2></div></div>{members.map((member) => <article className="team-member" key={member.id}><div><strong>{member.name}</strong><span>{member.email}</span><small>{member.lastLoginAt ? `Último acesso: ${new Date(member.lastLoginAt).toLocaleString("pt-BR")}` : "Ainda não acessou"}</small></div><div className="team-badges"><b>{member.status === "active" ? "Ativo" : member.status === "suspended" ? "Suspenso" : "Convidado"}</b><b>{member.mfaEnabledAt ? "MFA ativo" : "Sem MFA"}</b></div>{member.id !== currentUser.id && <div className="team-actions"><select value={member.role} onChange={(event) => void update(member, { role: event.target.value })}><option value="owner">Proprietário</option><option value="manager">Gerente</option><option value="attendant">Atendente</option></select>{member.status === "invited" && <button type="button" className="secondary-button" onClick={() => void invite(member)}>Reenviar</button>}<button type="button" className="secondary-button" onClick={() => void update(member, { status: member.status === "suspended" ? "active" : "suspended" })}>{member.status === "suspended" ? "Reativar" : "Suspender"}</button><button type="button" className="danger-button" onClick={() => void remove(member)}>Excluir</button></div>}</article>)}</section></div>;
}

function AuditSection({ entries }: { entries: AuditEntry[] }) {
  const labels: Record<string, string> = { create: "criou", update: "atualizou", delete: "removeu", status_change: "alterou o status", invite: "convidou", resend_invite: "reenviou um convite", owner_password_recovered: "recuperou a senha" };
  return <section className="admin-card page-card"><div className="admin-card__heading"><div><span className="eyebrow">Auditoria</span><h2>Últimas atividades</h2></div><History size={20} /></div><div className="audit-list">{entries.map((entry) => <article key={entry.id}><span><strong>{entry.actorEmail}</strong> {labels[entry.action] ?? entry.action} <b>{entry.entity}</b></span><time>{new Date(entry.createdAt).toLocaleString("pt-BR")}</time></article>)}{!entries.length && <div className="admin-empty">Nenhuma atividade registrada.</div>}</div></section>;
}

function SecuritySection({ currentUser, notify }: { currentUser: CurrentAdmin; notify: (message: string) => void }) {
  const [secret, setSecret] = useState(""); const [code, setCode] = useState(""); const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const setupMfa = async () => { const response = await adminFetch("/api/admin/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setup" }) }); const data = await response.json().catch(() => ({})) as { secret?: string; error?: string }; if (!response.ok || !data.secret) return notify(data.error ?? "Não foi possível iniciar o MFA."); setSecret(data.secret); };
  const enableMfa = async () => { const response = await adminFetch("/api/admin/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enable", secret, code }) }); const data = await response.json().catch(() => ({})) as { recoveryCodes?: string[]; error?: string }; if (!response.ok) return notify(data.error ?? "Código inválido."); setRecoveryCodes(data.recoveryCodes ?? []); setSecret(""); setCode(""); notify("MFA ativado. Entre novamente após guardar os códigos."); };
  return <section className="admin-card account-security page-card"><span className="eyebrow">Proteção da conta</span><h2>Autenticação em dois fatores</h2><p>O MFA é opcional e recomendado. Ao ativá-lo, as sessões atuais são encerradas para proteger sua conta.</p>{recoveryCodes.length ? <><p>Guarde estes códigos em local seguro. Eles não serão exibidos novamente.</p><div className="recovery-codes">{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div></> : secret ? <><code className="mfa-secret">{secret}</code><label className="form-label">Código do aplicativo<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} /></label><button type="button" className="primary-button" onClick={enableMfa}>Confirmar MFA</button></> : <button type="button" className="secondary-button" disabled={Boolean(currentUser.mfaEnabledAt)} onClick={setupMfa}>{currentUser.mfaEnabledAt ? "MFA já configurado" : "Configurar MFA"}</button>}</section>;
}

function OrderDetails({ data, onClose, onStatus }: { data: { order: AdminOrder; items: OrderItem[] }; onClose: () => void; onStatus: (id: number, status: string) => void }) {
  const { order, items } = data;
  const flow = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed"];
  const currentStep = flow.indexOf(order.status);
  return <div className="modal-backdrop" onClick={onClose}><aside className="admin-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="order-title" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">Detalhes do pedido</span><h2 id="order-title">{order.code}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div><label className="form-label">Status<select value={order.status} onChange={(event) => onStatus(order.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="order-customer"><strong>{order.customerName}</strong><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a><span>{order.fulfillmentType === "delivery" ? `${order.address ?? ""}${order.neighborhood ? ` · ${order.neighborhood}` : ""}` : "Retirada no balcão"}</span>{order.notes && <p>Observação: {order.notes}</p>}</div><div className="order-detail-items">{items.map((item) => <div key={item.id}><span><strong>{item.quantity}x {item.productName}</strong>{parseOptions(item.optionsJson) && <small>{parseOptions(item.optionsJson)}</small>}{item.itemNotes && <small>Obs.: {item.itemNotes}</small>}</span><b>{money(item.unitPriceCents * item.quantity)}</b></div>)}</div><div className="order-totals"><span>Subtotal <b>{money(order.subtotalCents)}</b></span><span>Entrega <b>{money(order.deliveryFeeCents)}</b></span><strong>Total <b>{money(order.totalCents)}</b></strong></div><div className="order-timeline">{order.status === "cancelled" ? <span className="active">Cancelado</span> : flow.map((value, index) => <span className={index <= currentStep ? "active" : ""} key={value}>{statusLabels[value]}</span>)}</div></aside></div>;
}

type OptionGroupDraft = { key: string; name: string; selectionMode: "single" | "multiple"; required: boolean; minSelections: number; maxSelections: number; options: ProductOption[] };
function toGroups(options: ProductOption[] = []): OptionGroupDraft[] { const map = new Map<string, ProductOption[]>(); options.forEach((option) => map.set(option.groupName, [...(map.get(option.groupName) ?? []), option])); return [...map].map(([name, group]) => ({ key: crypto.randomUUID(), name, selectionMode: group[0]?.selectionMode ?? "single", required: group.some((item) => item.required), minSelections: Math.max(...group.map((item) => item.minSelections ?? 0), 0), maxSelections: Math.max(...group.map((item) => item.maxSelections ?? 1), 1), options: group })); }
function flattenGroups(groups: OptionGroupDraft[]) { return groups.flatMap((group) => group.options.map((option) => ({ ...option, groupName: group.name, selectionMode: group.selectionMode, required: group.required, minSelections: group.required ? Math.max(1, group.minSelections) : group.minSelections, maxSelections: group.selectionMode === "single" ? 1 : Math.max(group.maxSelections, group.minSelections, 1) }))); }
function groupSnapshot(group: OptionGroupDraft) { return { name: group.name, selectionMode: group.selectionMode, required: group.required, minSelections: group.minSelections, maxSelections: group.maxSelections, options: group.options }; }

function ProductEditor({ product, categories, onClose, onSave, onUpload }: { product: Product; categories: string[]; onClose: () => void; onSave: (product: Product) => Promise<void>; onUpload: (file: File) => Promise<string> }) {
  const [draft, setDraft] = useState(product); const [groups, setGroups] = useState(() => toGroups(product.options)); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [initial] = useState(() => JSON.stringify({ product, groups: toGroups(product.options).map(groupSnapshot) }));
  const dirty = JSON.stringify({ product: draft, groups: groups.map(groupSnapshot) }) !== initial;
  const close = () => { if (!dirty || window.confirm("Descartar as alterações deste produto?")) onClose(); };
  const save = async () => { setError(""); if (!draft.name.trim()) return setError("Informe o nome do produto."); if (!Number.isFinite(draft.price) || draft.price < 0) return setError("Informe um preço válido."); if (groups.some((group) => !group.name.trim() || !group.options.length || group.options.some((option) => !option.label.trim()))) return setError("Confira os grupos e nomes das opções."); setSaving(true); try { await onSave({ ...draft, options: flattenGroups(groups) }); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar."); setSaving(false); } };
  const updateGroup = (key: string, patch: Partial<OptionGroupDraft>) => setGroups((items) => items.map((group) => group.key === key ? { ...group, ...patch } : group));
  return <div className="modal-backdrop" onClick={close}><section className="product-editor" role="dialog" aria-modal="true" aria-labelledby="product-editor-title" onClick={(event) => event.stopPropagation()}><header className="product-editor__header"><div><span className="eyebrow">Cadastro</span><h2 id="product-editor-title">{product.id ? "Editar produto" : "Novo produto"}</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Fechar"><X size={20} /></button></header><div className="product-editor__body"><section className="editor-section"><h3>Foto e informações</h3><div className="editor-image"><img src={draft.image} alt="Prévia do produto" /><label className="primary-button"><ImagePlus size={16} /> Trocar foto<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const key = await onUpload(file); setDraft({ ...draft, imageKey: key, image: `/api/media?key=${encodeURIComponent(key)}` }); } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Falha no envio."); } }} /></label></div><label className="form-label">Nome<input value={draft.name} maxLength={100} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="form-label">Descrição<textarea value={draft.description} maxLength={300} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><div className="form-two-col"><label className="form-label">Preço<input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label><label className="form-label">Categoria<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div><label className="form-label">Selo opcional<input value={draft.badge ?? ""} maxLength={40} onChange={(event) => setDraft({ ...draft, badge: event.target.value })} placeholder="Ex.: Mais pedido" /></label><div className="settings-checks"><label><input type="checkbox" checked={draft.available !== false} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Disponível</label><label><input type="checkbox" checked={draft.featured === true} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /> Destaque</label></div></section><section className="editor-section option-editor"><div className="option-editor__heading"><div><h3>Sabores e extras</h3><p>Organize as opções por grupos.</p></div><button type="button" className="secondary-button" onClick={() => setGroups((items) => [...items, { key: crypto.randomUUID(), name: "Novo grupo", selectionMode: "single", required: false, minSelections: 0, maxSelections: 1, options: [{ id: 0, groupName: "Novo grupo", label: "Nova opção", priceDeltaCents: 0 }] }])}><Plus size={15} /> Adicionar grupo</button></div>{groups.map((group) => <article className="option-group-editor" key={group.key}><div className="option-group-editor__head"><label>Nome do grupo<input value={group.name} onChange={(event) => updateGroup(group.key, { name: event.target.value })} /></label><label>Seleção<select value={group.selectionMode} onChange={(event) => updateGroup(group.key, { selectionMode: event.target.value as "single" | "multiple", maxSelections: event.target.value === "single" ? 1 : Math.max(2, group.maxSelections) })}><option value="single">Uma escolha</option><option value="multiple">Várias escolhas</option></select></label><label className="option-required"><input type="checkbox" checked={group.required} onChange={(event) => updateGroup(group.key, { required: event.target.checked, minSelections: event.target.checked ? Math.max(1, group.minSelections) : 0 })} /> Obrigatório</label><button type="button" className="remove-button" onClick={() => setGroups((items) => items.filter((item) => item.key !== group.key))} aria-label="Remover grupo"><Trash2 size={16} /></button></div>{group.selectionMode === "multiple" && <div className="option-limits"><label>Mínimo<input type="number" min="0" value={group.minSelections} onChange={(event) => updateGroup(group.key, { minSelections: Number(event.target.value) })} /></label><label>Máximo<input type="number" min="1" value={group.maxSelections} onChange={(event) => updateGroup(group.key, { maxSelections: Number(event.target.value) })} /></label></div>}<div className="option-items">{group.options.map((option, index) => <div className="option-item-editor" key={`${option.id}-${index}`}><label>Opção<input value={option.label} onChange={(event) => updateGroup(group.key, { options: group.options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} /></label><label>Adicional<input type="number" min="0" step="0.01" value={(option.priceDeltaCents ?? 0) / 100} onChange={(event) => updateGroup(group.key, { options: group.options.map((item, itemIndex) => itemIndex === index ? { ...item, priceDeltaCents: Math.round(Number(event.target.value || 0) * 100) } : item) })} /></label><button type="button" className="remove-button" onClick={() => updateGroup(group.key, { options: group.options.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Remover opção"><Trash2 size={15} /></button></div>)}</div><button type="button" className="text-button" onClick={() => updateGroup(group.key, { options: [...group.options, { id: 0, groupName: group.name, label: "Nova opção", priceDeltaCents: 0 }] })}><Plus size={14} /> Adicionar opção</button></article>)}</section>{error && <p className="form-error" role="alert">{error}</p>}</div><footer className="product-editor__actions"><button type="button" className="secondary-button" onClick={close}>Cancelar</button><button type="button" className="primary-button" disabled={saving} onClick={save}><Check size={17} /> {saving ? "Salvando..." : "Salvar produto"}</button></footer></section></div>;
}
