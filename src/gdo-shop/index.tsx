import clsx from "clsx";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { useDisplayMode } from "../use-display-mode";
import { INITIAL_CART_ITEMS as NEW_INITIAL_CART_ITEMS } from "../../py/new_initial_cart_items";
import { useMaxHeight } from "../use-max-height";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetProps } from "../use-widget-props";
import { useWidgetState } from "../use-widget-state";
import ProductDetails from "../utils/ProductDetails";

import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Image } from "@openai/apps-sdk-ui/components/Image";
import type { CartItem, NutritionFact } from "../types";

type GdoCartWidgetState = {
  state?: "checkout" | null;
  cartItems?: CartItem[];
  selectedCartItemId?: string | null;
};

type GdoCartWidgetProps = {
  cartItems?: CartItem[];
  widgetState?: Partial<GdoCartWidgetState> | null;
};

const SERVICE_FEE = 3;
const DELIVERY_FEE = 2.99;
const TAX_FEE = 3.4;
const CONTINUE_TO_PAYMENT_EVENT = "gdo-shop:continue-to-payment";
const MAX_PRODUCTS_SHOP = 24; // Limite massimo di prodotti da visualizzare nello shop

// Mappa delle categorie principali con i loro tag associati
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
  "Latticini e uova": [
    "latticini", "uova", "formaggi", "latte", "yogurt", "burro",
    "panna", "mozzarella", "parmigiano", "ricotta", "stracchino",
    "gorgonzola", "pecorino", "provolone", "fontina", "asiago"
  ],
};

const RELATED_ITEMS_LIMIT = 3;
const RELATED_PRICE_RANGE = 0.3;

const getCategoryScore = (item: CartItem, categoryTags: string[]) => {
  const tags = item.tags ?? [];
  return categoryTags.reduce((score, categoryTag) => {
    const hasMatch = tags.some((tag) =>
      tag.toLowerCase().includes(categoryTag.toLowerCase())
    );
    return score + (hasMatch ? 1 : 0);
  }, 0);
};

const getPrimaryCategory = (item: CartItem) => {
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
};

const getCpuTier = (text: string) => {
  const match = text.match(/\b(i[3579]|ryzen\s*[3579])\b/i);
  if (!match) {
    return 0;
  }

  const token = match[1].toLowerCase().replace(/\s+/g, "");
  if (token.includes("i9") || token.includes("ryzen9")) {
    return 4;
  }
  if (token.includes("i7") || token.includes("ryzen7")) {
    return 3;
  }
  if (token.includes("i5") || token.includes("ryzen5")) {
    return 2;
  }
  if (token.includes("i3") || token.includes("ryzen3")) {
    return 1;
  }
  return 0;
};

const getRelatedItems = (current: CartItem, items: CartItem[]) => {
  const category = getPrimaryCategory(current);
  const currentText = [
    current.name,
    current.shortDescription,
    current.detailSummary,
    ...(current.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const currentTier = getCpuTier(currentText);
  const currentPrice = getItemPrice(current);
  const priceBand = Math.max(currentPrice * RELATED_PRICE_RANGE, 15);

  const candidates = items.filter((item) => item.id !== current.id);

  const scored = candidates.map((item) => {
    const candidateText = [
      item.name,
      item.shortDescription,
      item.detailSummary,
      ...(item.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const categoryTags = category ? CATEGORY_MAPPING[category] ?? [] : [];
    const categoryScore =
      categoryTags.length > 0 ? getCategoryScore(item, categoryTags) : 0;

    const currentTokens = new Set(
      currentText.split(/\s+/).filter(Boolean)
    );
    const candidateTokens = new Set(
      candidateText.split(/\s+/).filter(Boolean)
    );
    let overlap = 0;
    currentTokens.forEach((token) => {
      if (candidateTokens.has(token)) {
        overlap += 1;
      }
    });
    const textScore = Math.min(6, overlap) * 0.2;

    const candidateTier = getCpuTier(candidateText);

    const candidatePrice = getItemPrice(item);
    const priceDelta = Math.abs(candidatePrice - currentPrice);
    const priceScore =
      priceDelta <= priceBand ? 1 - priceDelta / priceBand : -0.5;

    const isUpgrade =
      candidateTier > currentTier && candidatePrice <= currentPrice * 1.2;
    const isBetterValue = candidatePrice <= currentPrice;

    return {
      item,
      isPreferred: isUpgrade || isBetterValue,
      score:
        priceScore +
        textScore +
        (categoryScore ? Math.min(3, categoryScore) * 0.2 : 0) +
        (isUpgrade ? 0.6 : 0) +
        (isBetterValue ? 0.3 : 0),
    };
  });

  return scored
    .filter((entry) => entry.score > 0.1)
    .sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) {
        return a.isPreferred ? -1 : 1;
      }
      return b.score - a.score;
    })
    .slice(0, RELATED_ITEMS_LIMIT)
    .map((entry) => entry.item);
};

const getItemPrice = (item: CartItem) => {
  const rawPrice = (item as Record<string, unknown>).prices;
  if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
    return rawPrice;
  }
  if (typeof rawPrice === "string") {
    const parsed = Number(rawPrice);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (rawPrice && typeof rawPrice === "object") {
    const nested = rawPrice as { amountMax?: number; amountMin?: number };
    const amount = nested.amountMax ?? nested.amountMin;
    if (typeof amount === "number" && Number.isFinite(amount)) {
      return amount;
    }
  }

  return item.price;
};

const formatPrice = (value: number) => `€${value.toFixed(2)}`;

// Funzione per estrarre le categorie disponibili dai prodotti
const getAvailableCategories = (items: CartItem[]): Array<{ id: string; label: string; tags: string[] }> => {
  const categoryCounts: Record<string, number> = {};

  // Conta quanti prodotti appartengono a ciascuna categoria
  items.forEach((item) => {
    const tags = item.tags ?? [];
    Object.entries(CATEGORY_MAPPING).forEach(([category, categoryTags]) => {
      const hasCategory = categoryTags.some((tag) =>
        tags.some((itemTag) => itemTag.toLowerCase().includes(tag.toLowerCase()))
      );
      if (hasCategory) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });
  });

  // Crea filtri solo per categorie che hanno almeno un prodotto
  const filters: Array<{ id: string; label: string; tags: string[] }> = [
    { id: "all", label: "All", tags: [] },
  ];

  Object.entries(CATEGORY_MAPPING)
    .filter(([category]) => categoryCounts[category] > 0)
    .sort(([a], [b]) => (categoryCounts[b] || 0) - (categoryCounts[a] || 0))
    .forEach(([category, tags]) => {
      filters.push({
        id: category.toLowerCase().replace(/\s+/g, "-"),
        label: category,
        tags,
      });
    });

  return filters;
};


const cloneCartItem = (item: CartItem): CartItem => ({
  ...item,
  nutritionFacts: item.nutritionFacts?.map((fact) => ({ ...fact })),
  highlights: item.highlights ? [...item.highlights] : undefined,
  tags: item.tags ? [...item.tags] : undefined,
});

const createDefaultCartItems = (): CartItem[] =>
  NEW_INITIAL_CART_ITEMS.map((item) => cloneCartItem(item));

const createDefaultWidgetState = (): GdoCartWidgetState => ({
  state: null,
  cartItems: createDefaultCartItems(),
  selectedCartItemId: null,
});

const nutritionFactsEqual = (
  a?: NutritionFact[],
  b?: NutritionFact[]
): boolean => {
  if (!a?.length && !b?.length) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((fact, index) => {
    const other = b[index];
    if (!other) {
      return false;
    }
    return fact.label === other.label && fact.value === other.value;
  });
};

const highlightsEqual = (a?: string[], b?: string[]): boolean => {
  if (!a?.length && !b?.length) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((highlight, index) => highlight === b[index]);
};

const cartItemsEqual = (a: CartItem[], b: CartItem[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!right) {
      return false;
    }
    if (
      left.id !== right.id ||
      left.quantity !== right.quantity ||
      left.name !== right.name ||
      left.price !== right.price ||
      left.description !== right.description ||
      left.shortDescription !== right.shortDescription ||
      left.detailSummary !== right.detailSummary ||
      !nutritionFactsEqual(left.nutritionFacts, right.nutritionFacts) ||
      !highlightsEqual(left.highlights, right.highlights) ||
      !highlightsEqual(left.tags, right.tags) ||
      left.image !== right.image
    ) {
      return false;
    }
  }
  return true;
};

type SelectedCartItemPanelProps = {
  item: CartItem;
  onAdjustQuantity: (id: string, delta: number) => void;
};

function SelectedCartItemPanel({
  item,
  onAdjustQuantity,
}: SelectedCartItemPanelProps) {
  const nutritionFacts = Array.isArray(item.nutritionFacts)
    ? item.nutritionFacts
    : [];
  const highlights = Array.isArray(item.highlights) ? item.highlights : [];
  const displayPrice = getItemPrice(item);

  const hasNutritionFacts = nutritionFacts.length > 0;
  const hasHighlights = highlights.length > 0;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-none border-b border-black/5 bg-white">
        <div className="relative flex items-center justify-center overflow-hidden">
          <Image
            src={item.image}
            alt={item.name}
            className="max-h-[320px] w-[80%] object-cover"
          />
          <div className="absolute inset-0 bg-black/[0.025]" />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0">
            <p className="text-xl font-medium text-black">
              {formatPrice(displayPrice)}
            </p>
            <h2 className="text-base text-black">{item.name}</h2>
          </div>
          <div className="flex items-center rounded-full bg-black/[0.04] px-1 py-1 text-black">
            <Button
              type="button"
              variant="ghost"
              color="secondary"
              size="xs"
              uniform
              aria-label={`Decrease quantity of ${item.name}`}
              onClick={() => onAdjustQuantity(item.id, -1)}
            >
              <Minus
                strokeWidth={2}
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </Button>
            <span className="mx-2 min-w-[10px] text-center text-base font-medium">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              color="secondary"
              size="xs"
              uniform
              aria-label={`Increase quantity of ${item.name}`}
              onClick={() => onAdjustQuantity(item.id, 1)}
            >
              <Plus
                strokeWidth={2}
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        <p className="text-sm text-black/60">{item.description}</p>

        {item.detailSummary ? (
          <p className="text-sm font-medium text-black">{item.detailSummary}</p>
        ) : null}

        {hasNutritionFacts ? (
          <div className="grid grid-cols-3 gap-3 rounded-3xl border border-black/[0.05] px-4 py-2 text-center sm:grid-cols-4">
            {nutritionFacts.map((fact) => (
              <div key={`${item.id}-${fact.label}`} className="space-y-0.5">
                <p className="text-base font-medium text-black">{fact.value}</p>
                <p className="text-xs text-black/60">{fact.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {hasHighlights ? (
          <div className="space-y-1 text-sm text-black/60">
            {highlights.map((highlight, index) => (
              <p key={`${item.id}-highlight-${index}`}>{highlight}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type CheckoutDetailsPanelProps = {
  shouldShowCheckoutOnly: boolean;
  subtotal: number;
  total: number;
  onContinueToPayment?: () => void;
};

function CheckoutDetailsPanel({
  shouldShowCheckoutOnly,
  subtotal,
  total,
  onContinueToPayment,
}: CheckoutDetailsPanelProps) {
  return (
    <>
      {!shouldShowCheckoutOnly && (
        <header className="hidden space-y-4 sm:block">
          <h2 className="text-xl text-black">Checkout details</h2>
        </header>
      )}

      <section className="space-y-4 border-t border-black/5 pt-3">
        <div className="space-y-0">
          <h3 className="text-sm font-medium">Delivery address</h3>
        </div>
        <div className="space-y-0">
          <p className="text-base text-sm font-medium text-slate-900">
            1234 Main St, San Francisco, CA
          </p>
          <p className="text-xs text-black/50">
            Leave at door - Delivery instructions
          </p>
        </div>

        <div className="mt-1 flex flex-row items-center gap-3">
          <div className="flex flex-1 items-center justify-between rounded-xl border border-black/35 bg-white px-4 py-2.5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-900">Fast</p>
              <p className="line-clamp-1 text-xs text-black/50">
                50 min - 2 hr 10 min
              </p>
            </div>
            <span className="text-sm font-semibold text-[#047857]">Free</span>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-xl border border-black/10 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-900">Priority</p>
              <p className="line-clamp-1 text-xs text-black/50">35 min</p>
            </div>
            <span className="text-sm font-semibold text-[#047857]">Free</span>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-black/5 pt-3">
        <div>
          <h3 className="text-sm font-medium text-black">Delivery tip</h3>
          <p className="text-xs text-black/50">100% goes to the shopper</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Button
            type="button"
            variant="soft"
            color="secondary"
            size="sm"
            className="flex-1"
            aria-label="Select 5% tip"
          >
            5%
          </Button>
          <Button
            type="button"
            variant="solid"
            color="primary"
            size="sm"
            className="flex-1"
            aria-label="Select 10% tip"
          >
            10%
          </Button>
          <Button
            type="button"
            variant="soft"
            color="secondary"
            size="sm"
            className="flex-1"
            aria-label="Select 15% tip"
          >
            15%
          </Button>
          <Button
            type="button"
            variant="soft"
            color="secondary"
            size="sm"
            className="flex-1"
            aria-label="Select custom tip amount"
          >
            Other
          </Button>
        </div>
      </section>

      <section className="space-y-1 border-t border-black/5 pt-3 text-center">
        <div className="flex items-center justify-between">
          <span className="text-sm text-black/70">Subtotal</span>
          <span className="text-md text-black">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-black/70">Total</span>
          <span className="text-md font-medium text-black">
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-3 mb-4 border-b border-black/5 text-xs text-black/50"></p>
        <Button
          type="button"
          color="primary"
          variant="solid"
          size="md"
          className="mx-auto w-full max-w-xs"
          block
          aria-label="Continue to payment"
          onClick={onContinueToPayment}
        >
          Continue to payment
        </Button>
      </section>
    </>
  );
}

function App() {
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";
  const widgetProps = useWidgetProps<GdoCartWidgetProps>(() => ({}));
  const [widgetState, setWidgetState] = useWidgetState<GdoCartWidgetState>(
    createDefaultWidgetState
  );
  const navigate = useNavigate();
  const location = useLocation();
  const isCheckoutRoute = useMemo(() => {
    const pathname = location?.pathname ?? "";
    if (!pathname) {
      return false;
    }

    return pathname === "/checkout" || pathname.endsWith("/checkout");
  }, [location?.pathname]);

  // Leggi dati da toolOutput (popolato dal server quando recupera dati da MotherDuck)
  const toolOutput = useOpenAiGlobal("toolOutput");
  const placesFromServer = (toolOutput as any)?.places || [];

  // Converti places in CartItem[] per il widget
  const productsFromServer = useMemo((): CartItem[] => {
    if (!Array.isArray(placesFromServer)) {
      return [];
    }
    return placesFromServer.map((place: any): CartItem => ({
      id: place.id || "",
      name: place.name || place.description || "",
      price: typeof place.price === "string"
        ? parseFloat(place.price.replace(/[^\d.,]/g, "").replace(",", ".")) || 0
        : typeof place.price === "number"
          ? place.price
          : 0,
      description: place.description || "",
      shortDescription: place.name || place.description || "",
      detailSummary: "",
      nutritionFacts: [],
      highlights: [],
      tags: place.categories ? (typeof place.categories === "string"
        ? place.categories.split(",").map((c: string) => c.trim())
        : Array.isArray(place.categories)
          ? place.categories
          : []) : [],
      quantity: 1,
      image: place.thumbnail || "",
    }));
  }, [placesFromServer]);

  // Usa prodotti dal server se disponibili, altrimenti usa defaultCartItems
  const defaultCartItems = useMemo((): CartItem[] => {
    if (productsFromServer.length > 0) {
      return productsFromServer;
    }
    return createDefaultCartItems();
  }, [productsFromServer]);
  const cartGridRef = useRef<HTMLDivElement | null>(null);
  const [gridColumnCount, setGridColumnCount] = useState(1);

  const mergeWithDefaultItems = useCallback(
    (items: CartItem[]): CartItem[] => {
      const existingIds = new Set(items.map((item) => item.id));
      const merged = items.map((item) => {
        const defaultItem = defaultCartItems.find(
          (candidate) => candidate.id === item.id
        );

        if (!defaultItem) {
          return cloneCartItem(item);
        }

        const enriched: CartItem = {
          ...cloneCartItem(defaultItem),
          ...item,
          tags: item.tags ? [...item.tags] : defaultItem.tags,
          nutritionFacts:
            item.nutritionFacts ??
            defaultItem.nutritionFacts?.map((fact) => ({ ...fact })),
          highlights:
            item.highlights != null
              ? [...item.highlights]
              : defaultItem.highlights
                ? [...defaultItem.highlights]
                : undefined,
        };

        return cloneCartItem(enriched);
      });

      defaultCartItems.forEach((defaultItem) => {
        if (!existingIds.has(defaultItem.id)) {
          merged.push(cloneCartItem(defaultItem));
        }
      });

      return merged;
    },
    [defaultCartItems]
  );

  const resolvedCartItems = useMemo(() => {
    if (Array.isArray(widgetState?.cartItems) && widgetState.cartItems.length) {
      return mergeWithDefaultItems(widgetState.cartItems);
    }

    if (
      Array.isArray(widgetProps?.widgetState?.cartItems) &&
      widgetProps.widgetState.cartItems.length
    ) {
      return mergeWithDefaultItems(widgetProps.widgetState.cartItems);
    }

    if (Array.isArray(widgetProps?.cartItems) && widgetProps.cartItems.length) {
      return mergeWithDefaultItems(widgetProps.cartItems);
    }

    return mergeWithDefaultItems(defaultCartItems);
  }, [
    defaultCartItems,
    mergeWithDefaultItems,
    widgetProps?.cartItems,
    widgetProps?.widgetState?.cartItems,
    widgetState,
  ]);

  const [cartItems, setCartItems] = useState<CartItem[]>(resolvedCartItems);

  useEffect(() => {
    setCartItems((previous) =>
      cartItemsEqual(previous, resolvedCartItems) ? previous : resolvedCartItems
    );
  }, [resolvedCartItems]);

  const resolvedSelectedCartItemId =
    widgetState?.selectedCartItemId ??
    widgetProps?.widgetState?.selectedCartItemId ??
    null;

  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(
    resolvedSelectedCartItemId
  );

  useEffect(() => {
    setSelectedCartItemId((prev) =>
      prev === resolvedSelectedCartItemId ? prev : resolvedSelectedCartItemId
    );
  }, [resolvedSelectedCartItemId]);

  // Access modal information via toolResponseMetadata if available
  // Note: "view" is not a valid key in OpenAiGlobals, so we use toolResponseMetadata instead
  const toolResponseMetadata = useOpenAiGlobal("toolResponseMetadata") as Record<string, unknown> | null;
  const viewParams = toolResponseMetadata && typeof toolResponseMetadata === "object"
    ? (toolResponseMetadata as { params?: unknown })
    : null;
  const viewParamsObj = viewParams?.params && typeof viewParams.params === "object"
    ? (viewParams.params as Record<string, unknown>)
    : null;
  // Check if we're in modal view by checking if params exist in toolResponseMetadata
  const isModalView = viewParamsObj !== null;
  const checkoutFromState =
    (widgetState?.state ?? widgetProps?.widgetState?.state) === "checkout";
  const modalParams =
    viewParamsObj && typeof viewParamsObj === "object"
      ? (viewParamsObj as {
        state?: unknown;
        cartItems?: unknown;
        subtotal?: unknown;
        total?: unknown;
        totalItems?: unknown;
      })
      : null;

  const modalState =
    modalParams && typeof modalParams.state === "string"
      ? (modalParams.state as string)
      : null;

  const isCartModalView = isModalView && modalState === "cart";
  const shouldShowCheckoutOnly =
    isCheckoutRoute || (isModalView && !isCartModalView);
  const wasModalViewRef = useRef(isModalView);

  useEffect(() => {
    if (!viewParamsObj || typeof viewParamsObj !== "object") {
      return;
    }

    const paramsWithSelection = viewParamsObj as {
      selectedCartItemId?: unknown;
    };

    const selectedIdFromParams = paramsWithSelection.selectedCartItemId;

    if (
      typeof selectedIdFromParams === "string" &&
      selectedIdFromParams !== selectedCartItemId
    ) {
      setSelectedCartItemId(selectedIdFromParams);
      return;
    }

    if (selectedIdFromParams === null && selectedCartItemId !== null) {
      setSelectedCartItemId(null);
    }
  }, [selectedCartItemId, viewParamsObj]);

  const [hoveredCartItemId, setHoveredCartItemId] = useState<string | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<CartItem | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const updateWidgetState = useCallback(
    (partial: Partial<GdoCartWidgetState>) => {
      setWidgetState((previous) => ({
        ...createDefaultWidgetState(),
        ...(previous ?? {}),
        ...partial,
      }));
    },
    [setWidgetState]
  );

  useEffect(() => {
    if (!Array.isArray(widgetState?.cartItems)) {
      return;
    }

    const merged = mergeWithDefaultItems(widgetState.cartItems);

    if (!cartItemsEqual(widgetState.cartItems, merged)) {
      updateWidgetState({ cartItems: merged });
    }
  }, [mergeWithDefaultItems, updateWidgetState, widgetState?.cartItems]);

  useEffect(() => {
    if (wasModalViewRef.current && !isModalView && checkoutFromState) {
      updateWidgetState({ state: null });
    }

    wasModalViewRef.current = isModalView;
  }, [checkoutFromState, isModalView, updateWidgetState]);

  const adjustQuantity = useCallback(
    (id: string, delta: number) => {
      setCartItems((previousItems) => {
        const updatedItems = previousItems.map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        );

        if (!cartItemsEqual(previousItems, updatedItems)) {
          updateWidgetState({ cartItems: updatedItems });
        }

        return updatedItems;
      });
    },
    [updateWidgetState]
  );

  useEffect(() => {
    if (!shouldShowCheckoutOnly) {
      return;
    }

    setHoveredCartItemId(null);
  }, [shouldShowCheckoutOnly]);

  const manualCheckoutTriggerRef = useRef(false);

  const requestModalWithAnchor = useCallback(
    ({
      title,
      params,
      anchorElement,
    }: {
      title: string;
      params: Record<string, unknown>;
      anchorElement?: HTMLElement | null;
    }) => {
      if (isModalView) {
        return;
      }

      const anchorRect = anchorElement?.getBoundingClientRect();
      const anchor =
        anchorRect == null
          ? undefined
          : {
            top: anchorRect.top,
            left: anchorRect.left,
            width: anchorRect.width,
            height: anchorRect.height,
          };

      void (async () => {
        try {
          await window?.openai?.requestModal?.({
            title,
            params,
            ...(anchor ? { anchor } : {}),
          });
        } catch (error) {
        }
      })();
    },
    [isModalView]
  );

  const openCheckoutModal = useCallback(
    (anchorElement?: HTMLElement | null) => {
      requestModalWithAnchor({
        title: "Checkout",
        params: { state: "checkout" },
        anchorElement,
      });
    },
    [requestModalWithAnchor]
  );

  const openCartItemModal = useCallback(
    ({
      selectedId,
      selectedName,
      anchorElement,
    }: {
      selectedId: string;
      selectedName: string | null;
      anchorElement?: HTMLElement | null;
    }) => {
      requestModalWithAnchor({
        title: selectedName ?? selectedId,
        params: { state: "checkout", selectedCartItemId: selectedId },
        anchorElement,
      });
    },
    [requestModalWithAnchor]
  );

  const handleCartItemSelect = useCallback(
    (id: string, anchorElement?: HTMLElement | null) => {
      const itemName = cartItems.find((item) => item.id === id)?.name ?? null;
      manualCheckoutTriggerRef.current = true;
      setSelectedCartItemId(id);
      updateWidgetState({ selectedCartItemId: id, state: "checkout" });
      openCartItemModal({
        selectedId: id,
        selectedName: itemName,
        anchorElement,
      });
    },
    [cartItems, openCartItemModal, updateWidgetState]
  );

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + getItemPrice(item) * Math.max(0, item.quantity),
        0
      ),
    [cartItems]
  );

  const total = subtotal + SERVICE_FEE + DELIVERY_FEE + TAX_FEE;

  const totalItems = useMemo(
    () =>
      cartItems.reduce((total, item) => total + Math.max(0, item.quantity), 0),
    [cartItems]
  );

  // Genera filtri dinamici basati sui prodotti disponibili
  const filters = useMemo(() => getAvailableCategories(cartItems), [cartItems]);

  const visibleCartItems = useMemo(() => {
    if (!activeFilters.length) {
      return cartItems;
    }

    return cartItems.filter((item) => {
      const tags = item.tags ?? [];

      return activeFilters.every((filterId) => {
        const filterMeta = filters.find((filter) => filter.id === filterId);
        if (!filterMeta || filterId === "all" || !filterMeta.tags.length) {
          return true;
        }
        // Verifica se il prodotto ha almeno uno dei tag della categoria
        return filterMeta.tags.some((categoryTag) =>
          tags.some((itemTag) => itemTag.toLowerCase().includes(categoryTag.toLowerCase()))
        );
      });
    });
  }, [activeFilters, cartItems, filters]);

  // Limita i prodotti visualizzati al massimo consentito
  const displayedCartItems = useMemo(
    () => visibleCartItems.slice(0, MAX_PRODUCTS_SHOP),
    [visibleCartItems]
  );

  const updateItemColumnPlacement = useCallback(() => {
    const gridNode = cartGridRef.current;

    const width = gridNode?.offsetWidth ?? 0;

    let baseColumnCount = 1;
    if (width >= 768) {
      baseColumnCount = 3;
    } else if (width >= 640) {
      baseColumnCount = 2;
    }

    const columnCount = isFullscreen
      ? Math.max(baseColumnCount, 3)
      : baseColumnCount;

    if (gridNode) {
      gridNode.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
    }

    setGridColumnCount(columnCount);
  }, [isFullscreen]);

  const handleFilterToggle = useCallback(
    (id: string) => {
      setActiveFilters((previous) => {
        if (id === "all") {
          return [];
        }

        const isActive = previous.includes(id);
        if (isActive) {
          return [];
        }

        return [id];
      });

      requestAnimationFrame(() => {
        updateItemColumnPlacement();
      });
    },
    [updateItemColumnPlacement]
  );

  useEffect(() => {
    const node = cartGridRef.current;

    if (!node) {
      return;
    }

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
          requestAnimationFrame(updateItemColumnPlacement);
        })
        : null;

    observer?.observe(node);
    window.addEventListener("resize", updateItemColumnPlacement);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateItemColumnPlacement);
    };
  }, [updateItemColumnPlacement]);

  const openCartModal = useCallback(
    (anchorElement?: HTMLElement | null) => {
      if (isModalView || shouldShowCheckoutOnly) {
        return;
      }

      requestModalWithAnchor({
        title: "Cart",
        params: {
          state: "cart",
          cartItems,
          subtotal,
          total,
          totalItems,
        },
        anchorElement,
      });
    },
    [
      cartItems,
      isModalView,
      requestModalWithAnchor,
      shouldShowCheckoutOnly,
      subtotal,
      total,
      totalItems,
    ]
  );

  type CartSummaryItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
  };

  const cartSummaryItems: CartSummaryItem[] = useMemo(() => {
    if (!isCartModalView) {
      return [];
    }

    const items = Array.isArray(modalParams?.cartItems)
      ? modalParams?.cartItems
      : null;

    if (!items) {
      return cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: getItemPrice(item),
        quantity: Math.max(0, item.quantity),
        image: item.image,
      }));
    }

    const sanitized = items
      .map((raw, index) => {
        if (!raw || typeof raw !== "object") {
          return null;
        }
        const candidate = raw as Record<string, unknown>;
        const id =
          typeof candidate.id === "string" ? candidate.id : `cart-${index}`;
        const name =
          typeof candidate.name === "string" ? candidate.name : "Item";
        const priceValue = Number(candidate.price);
        const quantityValue = Number(candidate.quantity);
        const price = Number.isFinite(priceValue) ? priceValue : 0;
        const quantity = Number.isFinite(quantityValue)
          ? Math.max(0, quantityValue)
          : 0;
        const image =
          typeof candidate.image === "string" ? candidate.image : undefined;

        return {
          id,
          name,
          price,
          quantity,
          image,
        } as CartSummaryItem;
      })
      .filter(Boolean) as CartSummaryItem[];

    if (sanitized.length === 0) {
      return cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: getItemPrice(item),
        quantity: Math.max(0, item.quantity),
        image: item.image,
      }));
    }

    return sanitized;
  }, [cartItems, isCartModalView, modalParams?.cartItems]);

  const cartSummarySubtotal = useMemo(() => {
    if (!isCartModalView) {
      return subtotal;
    }

    const candidate = Number(modalParams?.subtotal);
    return Number.isFinite(candidate) ? candidate : subtotal;
  }, [isCartModalView, modalParams?.subtotal, subtotal]);

  const cartSummaryTotal = useMemo(() => {
    if (!isCartModalView) {
      return total;
    }

    const candidate = Number(modalParams?.total);
    return Number.isFinite(candidate) ? candidate : total;
  }, [isCartModalView, modalParams?.total, total]);

  const cartSummaryTotalItems = useMemo(() => {
    if (!isCartModalView) {
      return totalItems;
    }

    const candidate = Number(modalParams?.totalItems);
    return Number.isFinite(candidate) ? candidate : totalItems;
  }, [isCartModalView, modalParams?.totalItems, totalItems]);

  const handleContinueToPayment = useCallback(
    (event?: ReactMouseEvent<HTMLElement>) => {
      const anchorElement = event?.currentTarget ?? null;

      if (typeof window !== "undefined") {
        const detail = {
          subtotal: isCartModalView ? cartSummarySubtotal : subtotal,
          total: isCartModalView ? cartSummaryTotal : total,
          totalItems: isCartModalView ? cartSummaryTotalItems : totalItems,
        };

        try {
          window.dispatchEvent(
            new CustomEvent(CONTINUE_TO_PAYMENT_EVENT, { detail })
          );
        } catch (error) {
        }
      }

      if (isCartModalView) {
        return;
      }

      manualCheckoutTriggerRef.current = true;
      updateWidgetState({ state: "checkout" });
      const shouldNavigateToCheckout = isCartModalView || !isCheckoutRoute;

      if (shouldNavigateToCheckout) {
        navigate("/checkout");
        return;
      }

      openCheckoutModal(anchorElement);
    },
    [
      cartSummarySubtotal,
      cartSummaryTotal,
      cartSummaryTotalItems,
      isCartModalView,
      isCheckoutRoute,
      navigate,
      openCheckoutModal,
      subtotal,
      total,
      totalItems,
      updateWidgetState,
    ]
  );

  const handleSeeAll = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await window?.openai?.requestDisplayMode?.({ mode: "fullscreen" });
    } catch (error) {
    }
  }, []);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(updateItemColumnPlacement);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [updateItemColumnPlacement, displayedCartItems]);

  const selectedCartItem = useMemo(() => {
    if (selectedCartItemId == null) {
      return null;
    }
    return cartItems.find((item) => item.id === selectedCartItemId) ?? null;
  }, [cartItems, selectedCartItemId]);

  const selectedCartItemName = selectedCartItem?.name ?? null;
  const shouldShowSelectedCartItemPanel =
    selectedCartItem != null && !isFullscreen;
  const selectedProductDetails = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    return {
      id: selectedProduct.id,
      name: selectedProduct.name,
      price: formatPrice(getItemPrice(selectedProduct)),
      description:
        selectedProduct.shortDescription ??
        selectedProduct.detailSummary ??
        selectedProduct.description,
      thumbnail: selectedProduct.image,
      stock: selectedProduct.stock,
    };
  }, [selectedProduct]);

  const relatedItems = useMemo(() => {
    if (!selectedProduct) {
      return [];
    }
    return getRelatedItems(selectedProduct, cartItems);
  }, [selectedProduct, cartItems]);

  useEffect(() => {
    if (isCheckoutRoute) {
      return;
    }

    if (!checkoutFromState) {
      return;
    }

    if (manualCheckoutTriggerRef.current) {
      manualCheckoutTriggerRef.current = false;
      return;
    }

    if (selectedCartItemId) {
      openCartItemModal({
        selectedId: selectedCartItemId,
        selectedName: selectedCartItemName,
      });
      return;
    }

    openCheckoutModal();
  }, [
    isCheckoutRoute,
    checkoutFromState,
    openCartItemModal,
    openCheckoutModal,
    selectedCartItemId,
    selectedCartItemName,
  ]);

  const cartPanel = (
    <section>
      {!shouldShowCheckoutOnly && (
        <header className="mb-4 flex flex-col gap-3 border-b border-black/5 px-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
          {!isFullscreen ? (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={(event) =>
                  openCartModal(event.currentTarget as HTMLElement)
                }
                aria-haspopup="dialog"
                aria-label={`View cart, ${totalItems} item${totalItems !== 1 ? 's' : ''} in cart`}
                variant="outline"
                color="secondary"
                size="sm"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span>Cart</span>
              </Button>
            </div>
          ) : (
            <div className="text-lg text-black/70">Results</div>
          )}
          <nav className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => {
              const isActive =
                filter.id === "all"
                  ? activeFilters.length === 0
                  : activeFilters.includes(filter.id);

              return (
                <Button
                  key={filter.id}
                  type="button"
                  onClick={() => handleFilterToggle(filter.id)}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${filter.label}`}
                  variant={isActive ? "solid" : "outline"}
                  color="primary"
                  size="sm"
                >
                  {filter.label}
                </Button>
              );
            })}
          </nav>
        </header>
      )}

      <LayoutGroup id="gdo-grid">
        <div
          ref={cartGridRef}
          className={clsx(
            "mt-4 grid gap-[1.5px]",
            isFullscreen ? "grid-cols-3" : "sm:grid-cols-2 md:grid-cols-3"
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {displayedCartItems.map((item, index) => {
              const isHovered = hoveredCartItemId === item.id;
              const shortDescription =
                item.shortDescription ?? item.description.split(".")[0];
              const displayPrice = getItemPrice(item);
              const columnCount = Math.max(gridColumnCount, 1);
              const rowStartIndex =
                Math.floor(index / columnCount) * columnCount;
              const itemsRemaining = displayedCartItems.length - rowStartIndex;
              const rowSize = Math.min(columnCount, itemsRemaining);
              const positionInRow = index - rowStartIndex;

              const isSingle = rowSize === 1;
              const isLeft = positionInRow === 0;
              const isRight = positionInRow === rowSize - 1;

              return (
                <motion.article
                  layout
                  layoutId={item.id}
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 26,
                    mass: 0.8,
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name}, ${formatPrice(displayPrice)}, ${item.quantity} in cart. Click to view details`}
                  onClick={(event) =>
                    handleCartItemSelect(
                      item.id,
                      event.currentTarget as HTMLElement
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleCartItemSelect(
                        item.id,
                        event.currentTarget as HTMLElement
                      );
                    }
                  }}
                  onMouseEnter={() => setHoveredCartItemId(item.id)}
                  onMouseLeave={() => setHoveredCartItemId(null)}
                  className={clsx(
                    "group mb-4 flex cursor-pointer flex-col overflow-hidden border border-transparent bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:ring-offset-2",
                    isHovered && "border-[#0f766e]"
                  )}
                >
                  <div
                    className={clsx(
                      "relative overflow-hidden",
                      isSingle && "rounded-3xl",
                      !isSingle && isLeft && "rounded-l-3xl",
                      !isSingle && isRight && "rounded-r-3xl",
                      !isSingle && !isLeft && !isRight && "rounded-none"
                    )}
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      className="h-60 w-full object-cover transition-transform duration-200"
                    />

                    <div className="absolute inset-0 bg-black/[0.05]" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 pe-6 pt-3 pb-4 text-left">
                    <div className="space-y-0.5">
                      <p className="text-base font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-sm text-black/60">
                        {formatPrice(displayPrice)}
                      </p>
                    </div>
                    {shortDescription ? (
                      <p
                        className="text-sm leading-snug text-black/50"
                        title={shortDescription}
                      >
                        {shortDescription}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="self-start text-xs font-semibold text-[#F46C21] transition hover:underline"
                      aria-label={`Open details for ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedProduct(item);
                      }}
                    >
                      Dettagli
                    </button>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded-full bg-black/[0.04] px-1.5 py-1 text-black">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-full opacity-50 transition-colors hover:bg-slate-200 hover:opacity-100"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            adjustQuantity(item.id, -1);
                          }}
                        >
                          <Minus
                            strokeWidth={2.5}
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                        </button>
                        <span className="min-w-[20px] px-1 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-full opacity-50 transition-colors hover:bg-slate-200 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:ring-offset-1"
                          aria-label={`Increase quantity of ${item.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            adjustQuantity(item.id, 1);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              adjustQuantity(item.id, 1);
                            }
                          }}
                        >
                          <Plus
                            strokeWidth={2.5}
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </section>
  );

  if (isCartModalView && !isCheckoutRoute) {
    return (
      <div className="flex w-full flex-col gap-6 px-4">
        <div className="divide-y divide-black/5">
          {cartSummaryItems.length ? (
            cartSummaryItems.map((item) => (
              <div
                key={`modal-${item.id}`}
                className="flex items-center gap-3 py-2"
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-black/[0.05]" />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-black/50">
                      {formatPrice(item.price)} • Qty{" "}
                      {Math.max(0, item.quantity)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-black">
                    {formatPrice(item.price * Math.max(0, item.quantity))}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-black/20 bg-white/90 p-6 text-center text-sm text-black/50">
              Your cart is empty.
            </p>
          )}
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-sm font-medium text-black">
            <span>Subtotal</span>
            <span>{formatPrice(cartSummarySubtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-black/60">
            <span>Total</span>
            <span>{formatPrice(cartSummaryTotal)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleContinueToPayment}
          className="mx-auto mb-4 w-full rounded-full bg-[#FF5100] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a26] focus:outline-none focus:ring-2 focus:ring-[#FF5100] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-black/20 disabled:opacity-50"
          disabled={cartSummaryTotalItems === 0}
          aria-label={cartSummaryTotalItems === 0 ? "Continue to checkout (cart is empty)" : `Continue to checkout with ${cartSummaryTotalItems} item${cartSummaryTotalItems !== 1 ? 's' : ''}`}
          aria-disabled={cartSummaryTotalItems === 0}
        >
          Continue to checkout
        </button>
      </div>
    );
  }

  const checkoutPanel = (
    <div
      className={
        shouldShowCheckoutOnly
          ? "space-y-4"
          : "space-y-4 overflow-hidden border-black/[0.075] pt-4 md:rounded-3xl md:border md:px-5 md:pb-5 md:shadow-[0px_6px_14px_rgba(0,0,0,0.06)]"
      }
    >
      {shouldShowSelectedCartItemPanel ? (
        <SelectedCartItemPanel
          item={selectedCartItem}
          onAdjustQuantity={adjustQuantity}
        />
      ) : (
        <CheckoutDetailsPanel
          shouldShowCheckoutOnly={shouldShowCheckoutOnly}
          subtotal={subtotal}
          total={total}
          onContinueToPayment={handleContinueToPayment}
        />
      )}
    </div>
  );

  return (
    <div
      className={clsx(
        `flex items-center justify-center overflow-hidden rounded-2xl shadow-sm`,
        isModalView ? "px-0 pb-4" : ""
      )}
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
        overflow: "hidden",
        scrollbarGutter: "0px",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <main
        className={`w-full overflow-hidden ${isFullscreen ? "max-w-7xl" : ""}`}
      >
        {shouldShowCheckoutOnly ? (
          checkoutPanel
        ) : isFullscreen ? (
          <div className="mt-8 grid gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px] md:gap-8">
            <div className="md:col-span-2">{cartPanel}</div>
            <div>{checkoutPanel}</div>
          </div>
        ) : (
          cartPanel
        )}
        {!isFullscreen && !shouldShowCheckoutOnly && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSeeAll}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/70 transition-colors hover:border-black/40 hover:text-black focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:ring-offset-2"
              aria-label="See all products in fullscreen mode"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSeeAll();
                }
              }}
            >
              See all items
            </button>
          </div>
        )}
      </main>
      <AnimatePresence>
        {selectedProductDetails && (
          <ProductDetails
            place={selectedProductDetails}
            onClose={() => setSelectedProduct(null)}
            position="modal"
            relatedItems={relatedItems}
            onSelectRelated={(item) => setSelectedProduct(item)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

createRoot(document.getElementById("gdo-shop-root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export { App };
export default App;
