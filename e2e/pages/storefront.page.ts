import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";
import { CartDrawer } from "./components/cart-drawer.component";

export class StorefrontPage extends BasePage {
  readonly path = "/";
  readonly heroHeading: Locator;
  readonly searchInput: Locator;
  readonly closedBanner: Locator;
  readonly openMobileMenuButton: Locator;
  readonly mobileMenu: Locator;
  readonly cart: CartDrawer;

  constructor(page: Page) {
    super(page);
    this.heroHeading = page.getByRole("heading", { name: "Hoje é dia de frango!", level: 1 });
    this.searchInput = page.getByPlaceholder("Buscar no cardápio");
    this.closedBanner = page.getByText("Loja fechada para novos pedidos.", { exact: true });
    this.openMobileMenuButton = page.getByRole("button", { name: "Abrir menu" });
    this.mobileMenu = page.getByRole("dialog", { name: "Menu principal" });
    this.cart = new CartDrawer(page.getByRole("dialog", { name: "Seu pedido" }));
  }

  productHeading(name: string): Locator {
    return this.page.getByRole("heading", { name, level: 3 });
  }

  addProductButton(name: string): Locator {
    return this.page.getByRole("button", { name: `Adicionar ${name}` });
  }

  openCartButton(): Locator {
    return this.page.getByRole("button", { name: "Abrir carrinho" });
  }

  async addProduct(name: string): Promise<void> {
    await this.addProductButton(name).click();
    const productDialog = this.page.getByRole("dialog", { name });
    if (await productDialog.isVisible({ timeout: 700 }).catch(() => false)) {
      await productDialog.getByRole("button", { name: /^Adicionar \d+ ·/ }).click();
    }
  }

  async openCart(): Promise<void> {
    await this.openCartButton().click();
  }
}
