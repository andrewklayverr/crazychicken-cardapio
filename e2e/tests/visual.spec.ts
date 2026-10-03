import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures/app.fixture";

const fixedTime = "2026-10-03T12:00:00.000Z";

async function waitForImages(root: Locator): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  const images = root.locator("img:visible");

  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node) => {
      const element = node as HTMLImageElement;
      return element.complete && element.naturalWidth > 0;
    })).toBe(true);
  }
}

async function stabilize(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.getAnimations().forEach((animation) => {
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
    });
  });
}

test.describe("regressão visual da vitrine @visual", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("preserva banners, logo, textos, cards e carrinho", async ({ page, storefrontPage }) => {
    await storefrontPage.goto();
    await expect(storefrontPage.heroHeading).toBeVisible();

    const header = page.getByRole("banner");
    const logo = header.getByRole("img", { name: "Crazy Chicken" });
    const hero = page.locator("#cardapio");
    await waitForImages(header);
    await waitForImages(hero);
    await stabilize(page);

    await expect(page).toHaveScreenshot("storefront-hero.png");
    await expect(logo).toHaveScreenshot("brand-logo.png", { maxDiffPixels: 0 });

    const drinkBanner = page.getByRole("region", { name: "Destaque de bebidas" });
    await expect(drinkBanner).toBeVisible();
    await waitForImages(drinkBanner);
    await stabilize(page);
    await expect(drinkBanner).toHaveScreenshot("drink-banner.png");

    const primaryCard = page.locator(".product-card").filter({ has: storefrontPage.productHeading("Balde 500 g") });
    const drinkCard = page.locator(".product-card").filter({ has: storefrontPage.productHeading("Caipirinha gourmet") });
    await waitForImages(primaryCard);
    await waitForImages(drinkCard);
    await stabilize(page);
    await expect(primaryCard).toHaveScreenshot("product-card-primary.png");
    await expect(drinkCard).toHaveScreenshot("product-card-drink.png");

    await storefrontPage.addProduct("Balde 500 g");
    await storefrontPage.openCart();
    await expect(storefrontPage.cart.root).toBeVisible();
    await waitForImages(storefrontPage.cart.root);
    await stabilize(page);
    await expect(storefrontPage.cart.root).toHaveScreenshot("cart.png");
  });
});

test.describe("regressão visual do painel administrativo @visual", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
  });

  test("preserva o dashboard", async ({ page, adminPage, adminApi }) => {
    await adminApi.install({ timestamp: fixedTime });
    await adminPage.goto();

    await expect(adminPage.heading).toHaveText("Bom dia, Proprietário E2E.");
    await expect(page.getByText("CC-E2E-ADMIN")).toBeVisible();
    await waitForImages(page.locator(".admin-shell"));
    await stabilize(page);
    await expect(page).toHaveScreenshot("admin-dashboard.png", { fullPage: true });
  });
});
