import type { Locator } from "@playwright/test";

export class CartDrawer {
  readonly heading: Locator;
  readonly closeButton: Locator;
  readonly continueButton: Locator;
  readonly paymentButton: Locator;
  readonly pickupButton: Locator;
  readonly deliveryButton: Locator;
  readonly nameInput: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;
  readonly addressInput: Locator;
  readonly neighborhoodSelect: Locator;
  readonly notesInput: Locator;
  readonly submitButton: Locator;
  readonly pixButton: Locator;
  readonly whatsappButton: Locator;
  readonly trackingLink: Locator;

  constructor(readonly root: Locator) {
    this.heading = root.getByRole("heading", { level: 2 });
    this.closeButton = root.getByRole("button", { name: "Fechar checkout" });
    this.continueButton = root.getByRole("button", { name: "Continuar pedido" });
    this.paymentButton = root.getByRole("button", { name: "Ir para pagamento" });
    this.pickupButton = root.getByRole("button", { name: "Retirar" });
    this.deliveryButton = root.getByRole("button", { name: "Entregar" });
    this.nameInput = root.getByLabel("Nome", { exact: true });
    this.phoneInput = root.getByLabel("WhatsApp", { exact: true });
    this.emailInput = root.getByLabel("E-mail para gerar o PIX", { exact: true });
    this.addressInput = root.getByLabel("Endereço", { exact: true });
    this.neighborhoodSelect = root.getByRole("combobox", { name: "Bairro" });
    this.notesInput = root.getByLabel("Observações", { exact: true });
    this.submitButton = root.getByRole("button", { name: "Confirmar pedido", exact: true });
    this.pixButton = root.getByRole("button", { name: /PIX agora/ });
    this.whatsappButton = root.getByRole("button", { name: "Abrir WhatsApp" });
    this.trackingLink = root.getByRole("link", { name: "Acompanhar pedido" });
  }

  async continueToCheckout(): Promise<void> {
    await this.continueButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async fillCustomer(name: string, phone: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.phoneInput.fill(phone);
  }

  async goToPayment(): Promise<void> {
    await this.paymentButton.click();
  }

  async fillPixEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async chooseDelivery(address: string, neighborhood: string): Promise<void> {
    await this.deliveryButton.click();
    await this.addressInput.fill(address);
    await this.neighborhoodSelect.selectOption(neighborhood);
  }
}
