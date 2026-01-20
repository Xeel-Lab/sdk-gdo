import type { CartItem } from "../types";

const CATEGORY_IMAGE_URLS: Record<string, string> = {
  "Ortofrutta": "https://picjumbo.com/fresh-colorful-fruits-and-vegetables/",
  "Carne e pollame": "https://www.bigstockphoto.com/image-398974238/stock-photo-fresh-raw-chicken-meat-and-chicken-parts-black-background-top-view",
  "Pesce e prodotti ittici": "https://www.vectorstock.com/royalty-free-vector/seafood-vector-5372182",
  "Salumi e affettati": "https://millennialmagazine.com/2025/02/27/italian-cold-cuts/",
  "Latticini e uova": "https://www.freeimages.com/premium/dairy-products-and-eggs-isolated-on-white-651700",
  "Panetteria e prodotti da forno": "https://www.publicdomainpictures.net/en/view-image.php?image=534534&picture=various-fresh-bread",
  "Pasta, riso e cereali": "https://www.colourbox.com/image/dried-pasta-rice-image-16237250",
  "Gastronomia pronta": "https://depositphotos.com/photo/388240657/stock-photo-variety-of-ready-meals-in-trays.html",
  "Surgelati": "https://depositphotos.com/photo/415375170/assortment-of-frozen-vegetables-on-ice.html",
  "Dispensa / grocery secco": "https://biritegrocery.com/products/dry-goods/",
  "Dolci e snack": "https://www.freeimages.com/photo/sweets-1329905",
  "Bevande": "https://www.bigstockphoto.com/image-195711415/stock-photo-bottles-of-assorted-global-soft-drinks",
  "Alimentazione vegetale / plant-based": "https://foodinsight.org/what-does-eating-a-plant-based-diet-mean/",
  "Integratori e benessere alimentare": "https://www.bigstockphoto.com/image-327606634/stock-photo-nutritional-supplement-and-vitamin-supplements-as-a-capsule-with-fruit-vegetables-nuts-and-beans-ins",
};

const PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/400x300?text=Product+Image";

const CATEGORY_MAPPING: Record<string, string[]> = {
  "Ortofrutta": [
    "ortofrutta", "verdura", "frutta", "verdure fresche", "frutta fresca",
    "frutta secca", "frutta disidratata", "insalata", "pomodori", "zucchine",
    "peperoni", "melanzane", "carote", "patate", "cipolle", "aglio",
    "mele", "pere", "banane", "arance", "limoni", "uva", "fragole"
  ],
  "Carne e pollame": [
    "carne", "pollame", "carne bovina", "carne suina", "carne avicola",
    "carne ovina", "preparati di carne", "manzo", "vitello", "maiale",
    "pollo", "tacchino", "anatra", "coniglio", "hamburger", "polpette",
    "salsicce", "bistecche", "fettine", "macinato"
  ],
  "Pesce e prodotti ittici": [
    "pesce", "prodotti ittici", "pesce fresco", "pesce surgelato",
    "crostacei", "molluschi", "preparati ittici", "salmone", "tonno",
    "branzino", "orata", "gamberi", "gamberetti", "cozze", "vongole",
    "calamari", "polpo", "surgelati pesce"
  ],
  "Salumi e affettati": [
    "salumi", "affettati", "prosciutto crudo", "prosciutto cotto",
    "salami", "bresaola", "mortadella", "speck", "pancetta",
    "coppa", "capocollo", "salame", "wurstel"
  ],
  "Latticini e uova": [
    "latticini", "uova", "formaggi", "latte", "yogurt", "burro",
    "panna", "mozzarella", "parmigiano", "ricotta", "stracchino",
    "gorgonzola", "pecorino", "provolone", "fontina", "asiago"
  ],
  "Panetteria e prodotti da forno": [
    "panetteria", "prodotti da forno", "pane fresco", "pane confezionato",
    "focacce", "piadine", "prodotti da forno dolci", "brioche", "cornetti",
    "pizza", "pane", "grissini", "crackers"
  ],
  "Pasta, riso e cereali": [
    "pasta", "riso", "cereali", "pasta secca", "pasta fresca",
    "cereali secchi", "legumi secchi", "spaghetti", "penne", "fusilli",
    "riso integrale", "riso basmati", "farro", "orzo", "quinoa",
    "lenticchie", "ceci", "fagioli"
  ],
  "Gastronomia pronta": [
    "gastronomia", "gastronomia pronta", "piatti pronti freschi",
    "insalate pronte", "preparazioni gastronomiche", "pranzo pronto",
    "cena pronta", "contorni pronti", "antipasti pronti"
  ],
  "Surgelati": [
    "surgelati", "verdur surgelate", "pesce surgelato", "carne surgelata",
    "piatti pronti surgelati", "gelati", "gelato", "verdura surgelata",
    "patate surgelate", "spinaci surgelati", "piselli surgelati"
  ],
  "Dispensa / grocery secco": [
    "dispensa", "grocery", "grocery secco", "conserve", "sughi", "salse",
    "oli", "condimenti", "spezie", "aromi", "olio", "aceto", "sale",
    "pepe", "pomodori pelati", "passata", "sugo", "pesto"
  ],
  "Dolci e snack": [
    "dolci", "snack", "biscotti", "merendine", "cioccolato",
    "snack dolci", "snack salati", "patatine", "popcorn", "crackers",
    "torte", "dolci confezionati", "caramelle", "cioccolatini"
  ],
  "Bevande": [
    "bevande", "acqua", "bibite", "succhi", "bevande vegetali",
    "birra", "vino", "acqua minerale", "acqua frizzante", "coca cola",
    "aranciata", "limonata", "the", "caffè", "latte"
  ],
  "Alimentazione vegetale / plant-based": [
    "vegetale", "plant-based", "carne vegetale", "affettati vegetali",
    "latticini vegetali", "tofu", "seitan", "tempeh", "hamburger vegetale",
    "salsicce vegetali", "beyond meat", "impossible", "vegano"
  ],
  "Integratori e benessere alimentare": [
    "integratori", "benessere alimentare", "integratori vitaminici",
    "proteine", "sport", "alimenti funzionali", "vitamine", "minerali",
    "omega 3", "probiotici", "proteine in polvere"
  ],
};

function getCategoryScore(item: CartItem, categoryTags: string[]): number {
  const tags = item.tags ?? [];
  return categoryTags.reduce((score, categoryTag) => {
    const hasMatch = tags.some((tag) =>
      tag.toLowerCase().includes(categoryTag.toLowerCase())
    );
    return score + (hasMatch ? 1 : 0);
  }, 0);
}

export function getPrimaryCategory(item: CartItem): string | null {
  let bestCategory: string | null = null;
  let bestScore = 0;

  Object.entries(CATEGORY_MAPPING).forEach(([category, categoryTags]) => {
    const score = getCategoryScore(item, categoryTags);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return bestScore > 0 ? bestCategory : null;
}

export function getProductImageUrl(item: CartItem | { tags?: string[] }): string {
  const category = getPrimaryCategory(item as CartItem);
  if (category && CATEGORY_IMAGE_URLS[category]) {
    return CATEGORY_IMAGE_URLS[category];
  }
  return PLACEHOLDER_IMAGE_URL;
}

export function getProductImageUrlFromPlace(place: {
  id?: string;
  name?: string;
  tags?: string[];
  thumbnail?: string;
  image?: string;
}): string {
  if (!place) {
    return PLACEHOLDER_IMAGE_URL;
  }
  
  const item: CartItem = {
    id: place.id || "",
    name: place.name || "",
    price: 0,
    description: "",
    quantity: 1,
    tags: place.tags || [],
    image: place.thumbnail || place.image || "",
  };
  
  return getProductImageUrl(item);
}
