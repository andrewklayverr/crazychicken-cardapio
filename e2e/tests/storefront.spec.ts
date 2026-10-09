import { expect, test } from "../fixtures/app.fixture";

test.describe("cardápio e disponibilidade", () => {
  test("exibe o cardápio e filtra produtos @smoke", async ({ storefrontPage }) => {
    await storefrontPage.goto();

    await expect(storefrontPage.heroHeading).toBeVisible();
    await expect(storefrontPage.productHeading("Balde 500 g")).toBeVisible();

    await storefrontPage.searchInput.fill("Mini churros");
    await expect(storefrontPage.productHeading("Mini churros")).toBeVisible();
    await expect(storefrontPage.productHeading("Balde 500 g")).toBeHidden();
  });

  test("leva Cardápio e Bebidas ao catálogo com o filtro correto", async ({ page, storefrontPage }) => {
    await storefrontPage.goto();
    const navigation = page.getByRole("navigation", { name: "Navegação principal" });

    await navigation.getByRole("button", { name: "Bebidas" }).click();
    await expect(page.getByRole("button", { name: "Bebidas", exact: true }).last()).toHaveClass(/category-pill--active/);
    await expect(storefrontPage.productHeading("Caipirinha gourmet")).toBeVisible();
    await expect(storefrontPage.productHeading("Balde 500 g")).toBeHidden();

    await navigation.getByRole("button", { name: "Cardápio" }).click();
    await expect(page.getByRole("button", { name: "Todos", exact: true })).toHaveClass(/category-pill--active/);
    await expect(storefrontPage.productHeading("Balde 500 g")).toBeVisible();
  });

  test("abre a consulta de pedido pelo header", async ({ page, storefrontPage }) => {
    await storefrontPage.goto();
    await page.getByRole("banner").getByRole("link", { name: "Acompanhar pedido" }).click();

    await expect(page).toHaveURL(/\/pedido$/);
    await expect(page.getByLabel("Código do pedido")).toBeVisible();
    await expect(page.getByLabel("WhatsApp")).toBeVisible();
  });

  test.describe("loja fechada", () => {
    test.use({ storeMode: "closed" });

    test("informa o fechamento e bloqueia novos itens", async ({ storefrontPage }) => {
      await storefrontPage.goto();

      await expect(storefrontPage.closedBanner).toBeVisible();
      await expect(storefrontPage.closedProductButton("Balde 500 g")).toBeDisabled();
      await expect(storefrontPage.openCartButton()).toBeVisible();
    });
  });
});
