import { expect, test } from "../fixtures/app.fixture";

const fixedTime = "2026-10-03T12:00:00.000Z";

test.describe("regressão visual da navegação administrativa mobile @visual", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
  });

  test("preserva o menu lateral aberto", async ({ page, adminPage, adminApi }) => {
    await adminApi.install({ timestamp: fixedTime });
    await adminPage.goto();

    await expect(adminPage.heading).toHaveText("Bom dia, Proprietário E2E.");
    await adminPage.openMobileMenuButton.click();
    await expect(adminPage.navigation).toBeVisible();
    await page.evaluate(() => {
      document.getAnimations().forEach((animation) => animation.finish());
    });
    await expect(page).toHaveScreenshot("admin-mobile-menu.png");
  });
});
