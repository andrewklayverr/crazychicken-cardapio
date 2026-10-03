import type { Page } from "@playwright/test";

export abstract class BasePage {
  abstract readonly path: string;

  constructor(protected readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
