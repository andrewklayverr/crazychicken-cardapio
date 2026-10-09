import { expect, test } from "../fixtures/app.fixture";

async function expectCheckoutInsideViewport(page: import("@playwright/test").Page): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  await expect.poll(async () => {
    const drawer = await page.getByRole("dialog", { name: "Seu pedido" }).boundingBox();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (!drawer) return false;

    return documentWidth <= viewport!.width
      && drawer.x >= 0
      && drawer.x + drawer.width <= viewport!.width + 1;
  }).toBe(true);
}

test("mantém cardápio, menu e carrinho utilizáveis no mobile", async ({ page, storefrontPage }) => {
  await storefrontPage.goto();

  const trackingButton = page.getByRole("banner").getByRole("link", { name: "Acompanhar pedido" });
  await expect(trackingButton).toBeVisible();
  await expect(trackingButton.getByText("Pedidos")).toBeVisible();

  await storefrontPage.openMobileMenuButton.click();
  await expect(storefrontPage.mobileMenu).toBeVisible();
  await expect(storefrontPage.mobileMenu.getByRole("button", { name: "Cardápio" })).toBeVisible();
  await expect(storefrontPage.mobileMenu.getByRole("link", { name: "Acompanhar pedido" })).toBeVisible();
  await storefrontPage.mobileMenu.getByRole("button", { name: "Meu pedido" }).click();
  await expect(storefrontPage.cart.heading).toHaveText("Seu carrinho está vazio");
  await storefrontPage.cart.close();

  await storefrontPage.addProduct("Balde 500 g");
  await storefrontPage.openCart();
  await expect(storefrontPage.cart.heading).toHaveText("Tá ficando bom.");
});

test("abre a navegação mobile do painel admin", async ({ adminPage, adminApi }) => {
  await adminApi.install();
  await adminPage.goto();

  await adminPage.openMobileMenuButton.click();
  await expect(adminPage.navigation).toBeVisible();
  await adminPage.selectSection("Pedidos");
  await expect(adminPage.heading).toHaveText("Pedidos");
});

test("mantém as três etapas do checkout dentro da tela", async ({ page, storefrontPage }) => {
  await storefrontPage.goto();
  await storefrontPage.addProduct("Balde 500 g");
  await storefrontPage.openCart();

  await expectCheckoutInsideViewport(page);
  await storefrontPage.cart.continueToCheckout();
  await storefrontPage.cart.fillCustomer("Cliente Responsivo", "11999999999");
  await storefrontPage.cart.chooseDelivery("Rua Responsiva, 247", "Centro");

  await expectCheckoutInsideViewport(page);
  await storefrontPage.cart.goToPayment();
  await storefrontPage.cart.pixButton.click();
  await expectCheckoutInsideViewport(page);
  await expect(storefrontPage.cart.root).toBeVisible();
});
