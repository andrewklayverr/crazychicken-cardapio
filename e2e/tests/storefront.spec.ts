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
