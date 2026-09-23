export type CatalogProduct = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  slug: string;
  imageKey: string | null;
  badge: string | null;
  available: boolean;
  featured: boolean;
  options: Array<{ id: number; groupName: string; label: string; priceDeltaCents: number; required: boolean; selectionMode?: "single" | "multiple"; minSelections?: number; maxSelections?: number }>;
};

export const fallbackCategories = [
  { id: 1, name: "Frangos", slug: "frangos", sortOrder: 1 },
  { id: 2, name: "Acompanhamentos", slug: "acompanhamentos", sortOrder: 2 },
  { id: 3, name: "Molhos", slug: "molhos", sortOrder: 3 },
  { id: 4, name: "Novidades", slug: "novidades", sortOrder: 4 },
  { id: 5, name: "Bebidas", slug: "bebidas", sortOrder: 5 },
];

export const fallbackProducts: CatalogProduct[] = [
  { id: 1, name: "Balde 500 g", description: "Frango crocante, sequinho e cheio de sabor.", priceCents: 4999, category: "Frangos", slug: "balde-500-g", imageKey: "hero-food.jpeg", badge: "Mais pedido", available: true, featured: true, options: [] },
  { id: 2, name: "Balde 1.000 g", description: "Para dividir com a galera. Acompanha 2 molhos.", priceCents: 6999, category: "Frangos", slug: "balde-1000-g", imageKey: "menu-cover.jpeg", badge: "Favorito", available: true, featured: true, options: [] },
  { id: 3, name: "Balde 1.500 g", description: "O grandão para matar a fome de todo mundo.", priceCents: 11999, category: "Frangos", slug: "balde-1500-g", imageKey: "hero-food.jpeg", badge: null, available: true, featured: false, options: [] },
  { id: 4, name: "Anéis de cebola", description: "Crocantes por fora, macios por dentro.", priceCents: 3999, category: "Acompanhamentos", slug: "aneis-de-cebola", imageKey: "hero-food.jpeg", badge: "Crocante", available: true, featured: false, options: [] },
  { id: 5, name: "Mix de petiscos", description: "Coxinha, bolinho de queijo e calabresa.", priceCents: 4290, category: "Novidades", slug: "mix-de-petiscos", imageKey: "mix-petiscos.jpeg", badge: "Novidade", available: true, featured: true, options: [] },
  { id: 6, name: "Batata cheddar & bacon", description: "Batata dourada, cheddar cremoso e bacon crocante.", priceCents: 3490, category: "Acompanhamentos", slug: "batata-cheddar-bacon", imageKey: "hero-food.jpeg", badge: null, available: true, featured: false, options: [] },
  { id: 7, name: "Molho da casa", description: "Maionese temperada Crazy Chicken.", priceCents: 499, category: "Molhos", slug: "molho-da-casa", imageKey: "hero-food.jpeg", badge: null, available: true, featured: false, options: [] },
  { id: 8, name: "Mini churros", description: "Doce, quentinho e perfeito para fechar.", priceCents: 1999, category: "Novidades", slug: "mini-churros", imageKey: "mix-petiscos.jpeg", badge: null, available: true, featured: false, options: [] },
  { id: 9, name: "Caipirinha gourmet", description: "Limão, morango, maracujá ou kiwi. Feita na hora.", priceCents: 4499, category: "Bebidas", slug: "caipirinha-gourmet", imageKey: "drinks-menu.jpeg", badge: "Destaque da casa", available: true, featured: true, options: [{ id: 1, groupName: "Sabor", label: "Limão", priceDeltaCents: 0, required: true }, { id: 2, groupName: "Sabor", label: "Morango", priceDeltaCents: 0, required: true }, { id: 3, groupName: "Sabor", label: "Maracujá", priceDeltaCents: 0, required: true }, { id: 4, groupName: "Sabor", label: "Kiwi", priceDeltaCents: 0, required: true } ] },
  { id: 10, name: "Heineken 600 ml", description: "Cerveja long neck gelada para acompanhar seu balde.", priceCents: 1800, category: "Bebidas", slug: "heineken-600", imageKey: "drinks-menu.jpeg", badge: null, available: true, featured: false, options: [] },
  { id: 11, name: "Gin tônica copão", description: "Gin, tônica e muito gelo no copão Crazy.", priceCents: 4000, category: "Bebidas", slug: "gin-tonica-copao", imageKey: "drinks-menu.jpeg", badge: "Drink", available: true, featured: false, options: [] },
  { id: 12, name: "Refrigerante lata", description: "Coca-Cola, Fanta ou Sprite, 350 ml.", priceCents: 700, category: "Bebidas", slug: "refrigerante-lata", imageKey: "drinks-menu.jpeg", badge: null, available: true, featured: false, options: [] },
];

export const fallbackSettings = {
  brandName: "Crazy Chicken",
  logoKey: "/logo-frango.png",
  whatsappNumber: "",
  address: "Rua 7 de Setembro, 247 · Suzano",
  openingHours: "18h às 23h",
  orderingMode: "open" as const,
  weeklySchedule: { sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] },
  deliveryEnabled: true,
  pickupEnabled: true,
  minimumOrderCents: 0,
  defaultDeliveryFeeCents: 0,
  theme: "cartaz-amarelo",
  appearance: {
    heroTitle: "Hoje é dia de frango!",
    heroDescription: "Seu balde favorito, crocante e quentinho, está a um clique.",
    accent: "#ffc21b",
    primary: "#e32120",
    background: "#fff8e9",
    fontScale: "normal",
    density: "comfortable",
    visibleSections: ["destaques", "bebidas", "cardapio", "sobre"],
  },
};
