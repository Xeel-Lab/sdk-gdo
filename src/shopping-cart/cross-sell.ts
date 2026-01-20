import type { CartItem } from "../types";

export type CrossSellCategory = "carne" | "pesce" | "pasta" | "ortofrutta";

export type CrossSellItem = {
  id: string;
  sku: string;
  name: string;
  price: number;
  imageUrl?: string;
  tags?: string[];
  compatibleWith: CrossSellCategory[];
  priority: number;
};

type CartCategoryIntent = {
  categories: CrossSellCategory[];
  hasFoodCategory: boolean;
};

const CARNE_KEYWORDS = [
  "carne",
  "manzo",
  "vitello",
  "maiale",
  "pollo",
  "tacchino",
  "anatra",
  "coniglio",
  "hamburger",
  "polpette",
  "salsicce",
  "bistecche",
  "fettine",
  "macinato",
  "pollame",
  "bovina",
  "suina",
  "avicola",
];

const PESCE_KEYWORDS = [
  "pesce",
  "salmone",
  "tonno",
  "branzino",
  "orata",
  "gamberi",
  "gamberetti",
  "cozze",
  "vongole",
  "calamari",
  "polpo",
  "prodotti ittici",
  "crostacei",
  "molluschi",
];

const PASTA_KEYWORDS = [
  "pasta",
  "spaghetti",
  "penne",
  "fusilli",
  "rigatoni",
  "fettuccine",
  "lasagne",
  "riso",
  "cereali",
];

const ORTOFRUTTA_KEYWORDS = [
  "ortofrutta",
  "verdura",
  "frutta",
  "verdure",
  "insalata",
  "pomodori",
  "zucchine",
  "peperoni",
  "melanzane",
  "carote",
  "patate",
  "cipolle",
  "mele",
  "pere",
  "banane",
  "arance",
  "limoni",
];

const ACCESSORIES_TAG = "accessories";
const POPULAR_TAG = "popular";
const RECOMMENDED_TAG = "recommended";

export const crossSellFallbackCatalog: CrossSellItem[] = [
  {
    id: "cs-olio-oliva-01",
    sku: "CS-OLIO-OLIVA-01",
    name: "Olio extravergine di oliva",
    price: 8.9,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, POPULAR_TAG],
    compatibleWith: ["carne", "pesce", "ortofrutta"],
    priority: 95,
  },
  {
    id: "cs-sale-01",
    sku: "CS-SALE-01",
    name: "Sale fino marino",
    price: 1.5,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, POPULAR_TAG],
    compatibleWith: ["carne", "pesce", "ortofrutta"],
    priority: 90,
  },
  {
    id: "cs-pepe-01",
    sku: "CS-PEPE-01",
    name: "Pepe nero macinato",
    price: 2.9,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, RECOMMENDED_TAG],
    compatibleWith: ["carne", "pesce"],
    priority: 88,
  },
  {
    id: "cs-spezie-01",
    sku: "CS-SPEZIE-01",
    name: "Mix di spezie per carne",
    price: 4.5,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, RECOMMENDED_TAG],
    compatibleWith: ["carne"],
    priority: 85,
  },
  {
    id: "cs-limone-01",
    sku: "CS-LIMONE-01",
    name: "Limoni freschi",
    price: 3.9,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, POPULAR_TAG],
    compatibleWith: ["pesce", "ortofrutta"],
    priority: 82,
  },
  {
    id: "cs-salsa-pomodoro-01",
    sku: "CS-SALSA-POMODORO-01",
    name: "Passata di pomodoro",
    price: 2.2,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, POPULAR_TAG],
    compatibleWith: ["pasta"],
    priority: 80,
  },
  {
    id: "cs-sugo-01",
    sku: "CS-SUGO-01",
    name: "Sugo pronto per pasta",
    price: 3.5,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, RECOMMENDED_TAG],
    compatibleWith: ["pasta"],
    priority: 78,
  },
  {
    id: "cs-formaggio-01",
    sku: "CS-FORMAGGIO-01",
    name: "Parmigiano Reggiano grattugiato",
    price: 6.9,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, POPULAR_TAG],
    compatibleWith: ["pasta"],
    priority: 75,
  },
  {
    id: "cs-insalata-01",
    sku: "CS-INSALATA-01",
    name: "Insalata mista",
    price: 2.9,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, RECOMMENDED_TAG],
    compatibleWith: ["pesce", "ortofrutta"],
    priority: 72,
  },
  {
    id: "cs-aceto-01",
    sku: "CS-ACETO-01",
    name: "Aceto balsamico di Modena",
    price: 5.9,
    imageUrl: "",
    tags: [ACCESSORIES_TAG, RECOMMENDED_TAG],
    compatibleWith: ["ortofrutta"],
    priority: 70,
  },
  {
    id: "cs-pane-01",
    sku: "CS-PANE-01",
    name: "Pane fresco",
    price: 2.5,
    imageUrl: "",
    tags: [POPULAR_TAG],
    compatibleWith: ["carne", "pesce", "pasta"],
    priority: 68,
  },
  {
    id: "cs-acqua-01",
    sku: "CS-ACQUA-01",
    name: "Acqua minerale naturale",
    price: 1.2,
    imageUrl: "",
    tags: [POPULAR_TAG],
    compatibleWith: ["carne", "pesce", "pasta", "ortofrutta"],
    priority: 65,
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCartText(cartItems: CartItem[]) {
  return cartItems
    .map((item) =>
      [
        item.name,
        item.description,
        item.shortDescription,
        item.detailSummary,
        ...(item.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
}

export function getCartCategoryIntent(cartItems: CartItem[]): CartCategoryIntent {
  if (!cartItems.length) {
    return { categories: [], hasFoodCategory: false };
  }

  const normalized = normalizeText(getCartText(cartItems));
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));

  const hasCarne = CARNE_KEYWORDS.some((keyword) => tokens.has(keyword.replace(/\s+/g, ""))) ||
    CARNE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasPesce = PESCE_KEYWORDS.some((keyword) => tokens.has(keyword.replace(/\s+/g, ""))) ||
    PESCE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasPasta = PASTA_KEYWORDS.some((keyword) => tokens.has(keyword.replace(/\s+/g, ""))) ||
    PASTA_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasOrtofrutta = ORTOFRUTTA_KEYWORDS.some((keyword) => tokens.has(keyword.replace(/\s+/g, ""))) ||
    ORTOFRUTTA_KEYWORDS.some((keyword) => normalized.includes(keyword));

  const categories: CrossSellCategory[] = [];
  if (hasCarne) {
    categories.push("carne");
  }
  if (hasPesce) {
    categories.push("pesce");
  }
  if (hasPasta) {
    categories.push("pasta");
  }
  if (hasOrtofrutta) {
    categories.push("ortofrutta");
  }

  return { categories, hasFoodCategory: hasCarne || hasPesce || hasPasta || hasOrtofrutta };
}

function getCartIdentifiers(cartItems: CartItem[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of cartItems) {
    if (item.id) {
      ids.add(normalizeText(item.id));
    }
    if (item.name) {
      names.add(normalizeText(item.name));
    }
  }
  return { ids, names };
}

function hasAccessoryKeyword(cartItems: CartItem[], keywords: string[]) {
  const normalized = normalizeText(getCartText(cartItems));
  return keywords.some((keyword) => normalized.includes(keyword));
}

function sortByPriority(items: CrossSellItem[]) {
  return [...items].sort((a, b) => b.priority - a.priority);
}

function dedupeBySku(items: CrossSellItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sku)) {
      return false;
    }
    seen.add(item.sku);
    return true;
  });
}

export function getCrossSellSuggestions(
  cartItems: CartItem[],
  catalog: CrossSellItem[]
): CrossSellItem[] {
  if (!cartItems.length || !catalog.length) {
    return [];
  }

  const { categories, hasFoodCategory } = getCartCategoryIntent(cartItems);
  const { ids, names } = getCartIdentifiers(cartItems);
  const normalizedCartText = normalizeText(getCartText(cartItems));

  const eligible = dedupeBySku(
    catalog.filter((item) => {
      const normalizedSku = normalizeText(item.sku);
      const normalizedId = normalizeText(item.id);
      const normalizedName = normalizeText(item.name);
      if (
        ids.has(normalizedSku) ||
        ids.has(normalizedId) ||
        names.has(normalizedName)
      ) {
        return false;
      }
      return true;
    })
  );

  const suggestions: CrossSellItem[] = [];
  const seenSkus = new Set<string>();

  const pushSuggestion = (item: CrossSellItem) => {
    if (seenSkus.has(item.sku)) {
      return;
    }
    seenSkus.add(item.sku);
    suggestions.push(item);
  };

  if (hasFoodCategory && categories.length > 0) {
    const accessoryCandidates = sortByPriority(
      eligible.filter(
        (item) =>
          item.tags?.includes(ACCESSORIES_TAG) &&
          item.compatibleWith.some((category) => categories.includes(category))
      )
    );
    accessoryCandidates.slice(0, 2).forEach(pushSuggestion);
  }

  if (categories.includes("carne")) {
    const needsOlio = !hasAccessoryKeyword(cartItems, ["olio", "condimento"]);
    const needsSpezie = !hasAccessoryKeyword(cartItems, ["spezie", "sale", "pepe"]);
    const carneCandidates = eligible.filter((item) => item.compatibleWith.includes("carne"));

    if (needsOlio) {
      sortByPriority(carneCandidates.filter((item) =>
        normalizeText(item.name).includes("olio") || item.tags?.includes(ACCESSORIES_TAG)
      ))
        .slice(0, 1)
        .forEach(pushSuggestion);
    }

    if (needsSpezie) {
      sortByPriority(carneCandidates.filter((item) =>
        normalizeText(item.name).includes("spezie") ||
        normalizeText(item.name).includes("pepe") ||
        normalizeText(item.name).includes("sale")
      ))
        .slice(0, 1)
        .forEach(pushSuggestion);
    }
  }

  if (categories.includes("pesce")) {
    const needsLimone = !normalizedCartText.includes("limone");
    const needsOlio = !hasAccessoryKeyword(cartItems, ["olio", "condimento"]);
    const pesceCandidates = eligible.filter((item) => item.compatibleWith.includes("pesce"));

    if (needsLimone) {
      sortByPriority(pesceCandidates.filter((item) =>
        normalizeText(item.name).includes("limone") || item.compatibleWith.includes("ortofrutta")
      ))
        .slice(0, 1)
        .forEach(pushSuggestion);
    }

    if (needsOlio) {
      sortByPriority(pesceCandidates.filter((item) =>
        normalizeText(item.name).includes("olio") || item.tags?.includes(ACCESSORIES_TAG)
      ))
        .slice(0, 1)
        .forEach(pushSuggestion);
    }
  }

  if (categories.includes("pasta")) {
    const needsSalsa = !hasAccessoryKeyword(cartItems, ["salsa", "sugo", "pomodoro"]);
    const pastaCandidates = eligible.filter((item) => item.compatibleWith.includes("pasta"));

    if (needsSalsa) {
      sortByPriority(pastaCandidates.filter((item) =>
        normalizeText(item.name).includes("salsa") ||
        normalizeText(item.name).includes("sugo") ||
        normalizeText(item.name).includes("pomodoro")
      ))
        .slice(0, 1)
        .forEach(pushSuggestion);
    }
  }

  const categorySet = new Set(categories);
  const scored = eligible
    .filter((item) => {
      if (seenSkus.has(item.sku)) {
        return false;
      }
      if (categories.length === 0) {
        return true;
      }
      return item.compatibleWith.some((category) => categorySet.has(category));
    })
    .map((item) => {
      let score = item.priority;
      if (hasFoodCategory && item.tags?.includes(ACCESSORIES_TAG)) {
        score += 15;
      }
      if (categories.includes("carne") && item.compatibleWith.includes("carne")) {
        score += 10;
      }
      if (categories.includes("pesce") && item.compatibleWith.includes("pesce")) {
        score += 10;
      }
      if (categories.includes("pasta") && item.compatibleWith.includes("pasta")) {
        score += 10;
      }
      if (categories.includes("ortofrutta") && item.compatibleWith.includes("ortofrutta")) {
        score += 10;
      }
      if (item.tags?.includes(POPULAR_TAG)) {
        score += 4;
      }
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  scored.forEach(pushSuggestion);

  return suggestions.slice(0, 8);
}

export function getCrossSellTagLabel(tags?: string[]) {
  if (tags?.includes(POPULAR_TAG)) {
    return "Molto richiesto";
  }
  if (tags?.includes(RECOMMENDED_TAG)) {
    return "Consigliato";
  }
  return null;
}
