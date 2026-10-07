import { test as base } from "@playwright/test";
import { AdminPage } from "../pages/admin.page";
import { StorefrontPage } from "../pages/storefront.page";

type StoreMode = "open" | "closed";

export type OrderRequest = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillmentType: "pickup" | "delivery";
  paymentMethod: "pix" | "pay_on_fulfillment";
  address: string;
  neighborhood: string;
  notes: string;
  items: Array<{ productId: number; quantity: number; optionIds: number[]; itemNotes: string }>;
};

type OrderApi = {
  requests: OrderRequest[];
};

type AdminApi = {
  install: (options?: { timestamp?: string }) => Promise<void>;
};

type Fixtures = {
  storefrontPage: StorefrontPage;
  adminPage: AdminPage;
  orderApi: OrderApi;
  adminApi: AdminApi;
};

type Options = {
  storeMode: StoreMode;
};

export const test = base.extend<Fixtures & Options>({
  storeMode: ["open", { option: true }],

  storefrontPage: async ({ page, storeMode }, use) => {
    await page.setExtraHTTPHeaders({ "x-crazy-chicken-e2e-store": storeMode });
    await use(new StorefrontPage(page));
  },

  adminPage: async ({ page }, use) => {
    await page.setExtraHTTPHeaders({
      "oai-authenticated-user-id": "e2e-owner",
      "oai-authenticated-user-email": "e2e-owner@example.test",
      "oai-authenticated-user-full-name": "Propriet%C3%A1rio%20E2E",
      "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    });
    await use(new AdminPage(page));
  },

  orderApi: async ({ page, context }, use) => {
    const requests: OrderRequest[] = [];
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const payload = route.request().postDataJSON() as OrderRequest;
      requests.push(payload);
      const totalCents = payload.fulfillmentType === "delivery" ? 5499 : 4999;
      await route.fulfill({
        status: 201,
        json: {
          order: { code: "CC-E2E-0001", totalCents },
          payment: payload.paymentMethod === "pix" ? { method: "pix", status: "pending", brCode: "000201010212TESTEPIX6304ABCD", paymentLinkUrl: "https://www.mercadopago.com.br/sandbox/payments/test/ticket", qrCodeUrl: "/pix-e2e.png" } : { method: "pay_on_fulfillment", status: "not_requested" },
          whatsappUrl: "https://wa.me/5511999999999?text=Pedido%20CC-E2E-0001",
        },
      });
    });
    await context.route("https://wa.me/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp E2E</title>" });
    });
    await page.route("**/api/orders/CC-E2E-0001/payment?**", async (route) => {
      await route.fulfill({ json: { payment: { method: "pix", status: "pending", brCode: "000201010212TESTEPIX6304ABCD", paymentLinkUrl: "https://www.mercadopago.com.br/sandbox/payments/test/ticket", qrCodeUrl: "/pix-e2e.png" }, whatsappUrl: null } });
    });
    await page.route("**/pix-e2e.png", async (route) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4h8AAAAASUVORK5CYII=", "base64") });
    });
    await use({ requests });
  },

  adminApi: async ({ page }, use) => {
    const install = async (options?: { timestamp?: string }) => {
      const now = options?.timestamp ?? new Date().toISOString();
      await page.route("**/api/admin/orders**", async (route) => {
        await route.fulfill({
          json: {
            orders: [
              {
                id: 1,
                code: "CC-E2E-ADMIN",
                status: "confirmed",
                fulfillmentType: "delivery",
                customerName: "Cliente E2E",
                customerPhone: "11999999999",
                address: "Rua de Teste, 100",
                neighborhood: "Centro",
                subtotalCents: 4999,
                deliveryFeeCents: 500,
                totalCents: 5499,
                createdAt: now,
              },
            ],
          },
        });
      });
      await page.route("**/api/admin/settings", async (route) => {
        await route.fulfill({ json: { settings: { brandName: "Crazy Chicken", orderingMode: "open" } } });
      });
      await page.route("**/api/admin/products", async (route) => {
        await route.fulfill({
          json: {
            categories: [{ id: 1, name: "Frangos" }],
            products: [
              {
                id: 101,
                name: "Produto E2E",
                description: "Produto controlado pela suíte",
                priceCents: 2590,
                categoryId: 1,
                imageKey: "hero-food.jpeg",
                badge: null,
                available: true,
                featured: false,
                options: [],
              },
            ],
          },
        });
      });
      await page.route("**/api/admin/delivery-zones", async (route) => {
        await route.fulfill({ json: { zones: [{ id: 1, name: "Centro", feeCents: 500, active: true, sortOrder: 1 }] } });
      });
      await page.route("**/api/admin/users", async (route) => {
        await route.fulfill({ json: { users: [{ id: 1, email: "e2e-owner@example.test", name: "Proprietário E2E", role: "owner", status: "active" }] } });
      });
      await page.route("**/api/admin/audit-log", async (route) => {
        await route.fulfill({ json: { entries: [{ id: 1, actorEmail: "e2e-owner@example.test", action: "login", entity: "session", createdAt: now }] } });
      });
    };
    await use({ install });
  },
});

export { expect } from "@playwright/test";
