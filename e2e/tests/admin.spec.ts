import { expect, test } from "../fixtures/app.fixture";

test("redireciona visitante sem sessão para o login", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Entrar no admin" })).toBeVisible();
});

test("carrega o painel e navega pelas áreas operacionais", async ({ adminPage, adminApi, page }) => {
  await adminApi.install();
  await adminPage.goto();

  await expect(adminPage.heading).toHaveText(/Bom dia|Boa noite/);
  await expect(page.getByText("Proprietário E2E", { exact: true })).toBeVisible();

  await test.step("pedidos", async () => {
    await adminPage.selectSection("Pedidos");
    await expect(adminPage.heading).toHaveText("Pedidos");
    await expect(page.getByText("Cliente E2E")).toBeVisible();
  });

  await test.step("produtos", async () => {
    await adminPage.selectSection("Produtos");
    await expect(adminPage.heading).toHaveText("Produtos");
    await expect(page.getByText("Produto E2E")).toBeVisible();
  });

  await test.step("configurações", async () => {
    await adminPage.selectSection("Configurações");
    await expect(adminPage.heading).toHaveText("Configurações");
    await expect(page.getByText("Centro", { exact: true })).toBeVisible();
  });

  await test.step("equipe", async () => {
    await adminPage.selectSection("Equipe e acessos");
    await expect(adminPage.heading).toHaveText("Equipe e acessos");
    await expect(page.getByText("e2e-owner@example.test")).toBeVisible();
  });
});
