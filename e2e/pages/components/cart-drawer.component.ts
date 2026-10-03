import type { Locator } from "@playwright/test";

export class CartDrawer {
  readonly heading: Locator;
  readonly continueButton: Locator;
  readonly pickupButton: Locator;
  readonly deliveryButton: Locator;
  readonly nameInput: Locator;
  readonly phoneInput: Locator;
  readonly addressInput: Locator;
  readonly neighborhoodSelect: Locator;
  readonly notesInput: Locator;
  readonly submitButton: Locator;
  readonly whatsappButton: Locator;
  readonly trackingLink: Locator;

  constructor(readonly root: Locator) {
    this.heading = root.getByRole("heading", { level: 2 });
    this.continueButton = root.getByRole("button", { name: "Continuar pedido" });
    this.pickupButton = root.getByRole("button", { name: "Retirar" });
    this.deliveryButton = root.getByRole("button", { name: "Entregar" });
    this.nameInput = root.getByLabel("Nome", { exact: true });
    this.phoneInput = root.getByLabel("WhatsApp", { exact: true });
    this.addressInput = root.getByLabel("Endereço", { exact: true });
    this.neighborhoodSelect = root.getByRole("combobox", { name: "Bairro" });
    this.notesInput = root.getByLabel("Observações do pedido", { exact: true });
    this.submitButton = root.getByRole("button", { name: "Registrar pedido e abrir WhatsApp" });
    this.whatsappButton = root.getByRole("button", { name: "Abrir WhatsApp" });
    this.trackingLink = root.getByRole("link", { name: "Acompanhar pedido" });
  }

  async continueToCheckout(): Promise<void> {
    await this.continueButton.click();
  }

  async fillCustomer(name: string, phone: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.phoneInput.fill(phone);
  }

  async chooseDelivery(address: string, neighborhood: string): Promise<void> {
    await this.deliveryButton.click();
    await this.addressInput.fill(address);
    await this.neighborhoodSelect.selectOption(neighborhood);
  }
}
