import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AdminPage extends BasePage {
  readonly path = "/admin";
  readonly heading: Locator;
  readonly navigation: Locator;
  readonly openMobileMenuButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { level: 1 });
    this.navigation = page.getByRole("navigation", { name: "Painel administrativo" });
    this.openMobileMenuButton = page.getByRole("button", { name: "Abrir menu" });
  }

  sectionButton(name: string): Locator {
    return this.navigation.getByRole("button", { name });
  }

  async selectSection(name: string): Promise<void> {
    await this.sectionButton(name).click();
  }
}
