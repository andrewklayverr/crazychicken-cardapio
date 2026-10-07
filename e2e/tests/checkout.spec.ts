import { expect, test } from "../fixtures/app.fixture";

test("atualiza a quantidade e o subtotal do carrinho", async ({ storefrontPage }) => {
  await storefrontPage.goto();
  await storefrontPage.addProduct("Balde 500 g");
  await storefrontPage.openCart();

  await storefrontPage.cart.root.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(storefrontPage.cart.root.getByText(/99,98/).first()).toBeVisible();
});

test("registra entrega, calcula o bairro e abre o WhatsApp", async ({ storefrontPage, orderApi, context }) => {
  await storefrontPage.goto();
  await storefrontPage.addProduct("Balde 500 g");
  await storefrontPage.openCart();
  await storefrontPage.cart.continueToCheckout();
  await storefrontPage.cart.fillCustomer("Cliente Entrega", "11999999999");
  await storefrontPage.cart.chooseDelivery("Rua de Teste, 100", "Centro");
  await storefrontPage.cart.goToPayment();

  await expect(storefrontPage.cart.root.getByText(/54,99/)).toBeVisible();
  const popupPromise = context.waitForEvent("page");
  await storefrontPage.cart.submitButton.click();
  const whatsappPage = await popupPromise;

  await expect(storefrontPage.cart.heading).toHaveText("Recebemos seu pedido.");
  await expect(storefrontPage.cart.root.getByText(/CC-E2E-0001/)).toBeVisible();
  await expect(storefrontPage.cart.trackingLink).toHaveAttribute("href", /CC-E2E-0001/);
  await expect(whatsappPage).toHaveURL(/wa\.me\/5511999999999/);
  await whatsappPage.close();

  expect(orderApi.requests).toHaveLength(1);
  expect(orderApi.requests[0]).toMatchObject({
    fulfillmentType: "delivery",
    address: "Rua de Teste, 100",
    neighborhood: "Centro",
  });
});

test("registra retirada sem exigir endereço", async ({ storefrontPage, orderApi, context }) => {
  await storefrontPage.goto();
  await storefrontPage.addProduct("Balde 500 g");
  await storefrontPage.openCart();
  await storefrontPage.cart.continueToCheckout();
  await storefrontPage.cart.pickupButton.click();
  await storefrontPage.cart.fillCustomer("Cliente Retirada", "11988888888");

  await expect(storefrontPage.cart.addressInput).toBeHidden();
  await storefrontPage.cart.goToPayment();
  const popupPromise = context.waitForEvent("page");
  await storefrontPage.cart.submitButton.click();
  const whatsappPage = await popupPromise;

  await expect(storefrontPage.cart.heading).toHaveText("Recebemos seu pedido.");
  await expect(storefrontPage.cart.root.getByText(/49,99/)).toBeVisible();
  await whatsappPage.close();

  expect(orderApi.requests).toHaveLength(1);
  expect(orderApi.requests[0]).toMatchObject({ fulfillmentType: "pickup", address: "", neighborhood: "" });
});

test("gera PIX opcional para entrega sem abrir o WhatsApp automaticamente", async ({ storefrontPage, orderApi }) => {
  await storefrontPage.goto();
  await storefrontPage.addProduct("Balde 500 g");
  await storefrontPage.openCart();
  await storefrontPage.cart.continueToCheckout();
  await storefrontPage.cart.fillCustomer("Cliente PIX", "11977777777");
  await storefrontPage.cart.chooseDelivery("Rua PIX, 247", "Centro");
  await storefrontPage.cart.goToPayment();
  await storefrontPage.cart.pixButton.click();
  await storefrontPage.cart.fillPixEmail("comprador@testuser.com");

  await storefrontPage.cart.root.getByRole("button", { name: "Confirmar pedido e gerar PIX" }).click();

  await expect(storefrontPage.cart.heading).toHaveText("Recebemos seu pedido.");
  await expect(storefrontPage.cart.root.getByText("Pague agora com PIX")).toBeVisible();
  await expect(storefrontPage.cart.root.getByRole("button", { name: "Copiar código PIX" })).toBeVisible();
  expect(orderApi.requests[0]).toMatchObject({ fulfillmentType: "delivery", paymentMethod: "pix", customerEmail: "comprador@testuser.com" });
});
