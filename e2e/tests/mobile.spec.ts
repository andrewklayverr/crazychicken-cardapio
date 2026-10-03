import { expect, test } from "../fixtures/app.fixture";

test("mantém cardápio, menu e carrinho utilizáveis no mobile", async ({ storefrontPage }) => {
  await storefrontPage.goto();

  await storefrontPage.openMobileMenuButton.click();
  await expect(storefrontPage.mobileMenu).toBeVisible();
  await expect(storefrontPage.mobileMenu.getByRole("link", { name: "Cardápio" })).toBeVisible();
  await storefrontPage.mobileMenu.getByRole("button", { name: "Meu pedido" }).click();
  await expect(storefrontPage.cart.heading).toHaveText("Seu carrinho está vazio");
  await storefrontPage.cart.root.getByRole("button", { name: "Fechar carrinho" }).click();

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
