import { useEffect, useMemo, useRef, useState } from "react";
import type { CartItem } from "../types";
import {
  crossSellFallbackCatalog,
  getCartCategoryIntent,
  getCrossSellSuggestions,
  getCrossSellTagLabel,
  type CrossSellItem,
} from "./cross-sell";
import { getProductImageUrl } from "../utils/product-image";

type CrossSellSectionProps = {
  cartItems: CartItem[];
  onAdd: (item: CrossSellItem, position: number) => void;
  formatCurrency: (value: number) => string;
};

type AnalyticsPayload = {
  cartItemCategories: string[];
  suggestedSku: string;
  position: number;
};

function emitAnalyticsEvent(eventName: string, payload: AnalyticsPayload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  } catch {
    // no-op: analytics is optional
  }
}

function extractStructuredContent(
  response: unknown
): Record<string, unknown> | null {
  if (!response) {
    return null;
  }
  if (typeof response === "string") {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>;
      return extractStructuredContent(parsed);
    } catch {
      return null;
    }
  }
  if (typeof response === "object") {
    const payload = response as Record<string, unknown>;
    const structured = payload.structuredContent as Record<string, unknown> | undefined;
    if (structured && typeof structured === "object") {
      return structured;
    }
    if (typeof payload.result === "string") {
      try {
        const parsed = JSON.parse(payload.result) as Record<string, unknown>;
        return extractStructuredContent(parsed);
      } catch {
        return null;
      }
    }
    return payload;
  }
  return null;
}

function toCrossSellItem(candidate: unknown): CrossSellItem | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const sku = typeof record.sku === "string" ? record.sku : "";
  const name = typeof record.name === "string" ? record.name : "";
  const price =
    typeof record.price === "number" ? record.price : Number(record.price);

  if (!sku || !name || !Number.isFinite(price)) {
    return null;
  }

  return {
    id: typeof record.id === "string" ? record.id : sku,
    sku,
    name,
    price,
    imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : "",
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag) => typeof tag === "string")
      : undefined,
    compatibleWith: Array.isArray(record.compatibleWith)
      ? record.compatibleWith.filter(
          (category) => category === "pc" || category === "tv"
        )
      : [],
    priority: typeof record.priority === "number" ? record.priority : 0,
  };
}

function extractSuggestions(response: unknown): CrossSellItem[] | null {
  const structured = extractStructuredContent(response);
  const suggestions = structured?.suggestions;
  if (!Array.isArray(suggestions)) {
    return null;
  }
  return suggestions
    .map((item) => toCrossSellItem(item))
    .filter((item): item is CrossSellItem => Boolean(item));
}

function CrossSellCard({
  item,
  position,
  onAdd,
  formatCurrency,
}: {
  item: CrossSellItem;
  position: number;
  onAdd: (item: CrossSellItem, position: number) => void;
  formatCurrency: (value: number) => string;
}) {
  const tagLabel = getCrossSellTagLabel(item.tags);
  const cartItem: CartItem = {
    id: item.id,
    name: item.name,
    price: item.price,
    description: "",
    quantity: 1,
    tags: item.tags || [],
    image: item.imageUrl || "",
  };
  const imageUrl = getProductImageUrl(cartItem);

  return (
    <div className="flex flex-col rounded-2xl border border-black/10 bg-white/90 p-3 shadow-sm">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
        <span>Accessorio</span>
        {tagLabel ? (
          <span className="rounded-full bg-black/5 px-2 py-1 text-[9px] text-black/60">
            {tagLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-black/10 bg-[#f7f3ef]">
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-black">{item.name}</p>
          <p className="text-xs text-black/60">{formatCurrency(item.price)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(item, position)}
        className="mt-3 w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-xs font-semibold text-black/70 transition hover:border-black/40"
        aria-label={`Aggiungi ${item.name} al carrello`}
      >
        Aggiungi
      </button>
    </div>
  );
}

function CrossSellCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="flex flex-col rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm"
      aria-hidden="true"
      key={`skeleton-${index}`}
    >
      <div className="h-3 w-24 rounded bg-black/10 animate-pulse" />
      <div className="mt-3 flex items-center gap-3">
        <div className="h-14 w-14 rounded-xl bg-black/10 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded bg-black/10 animate-pulse" />
          <div className="h-3 w-16 rounded bg-black/10 animate-pulse" />
        </div>
      </div>
      <div className="mt-3 h-8 w-full rounded-xl bg-black/10 animate-pulse" />
    </div>
  );
}

export default function CrossSellSection({
  cartItems,
  onAdd,
  formatCurrency,
}: CrossSellSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CrossSellItem[]>([]);
  const impressionKeyRef = useRef("");

  const categoryIntent = useMemo(
    () => getCartCategoryIntent(cartItems),
    [cartItems]
  );

  useEffect(() => {
    let isMounted = true;
    if (cartItems.length === 0) {
      setSuggestions([]);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);

    const loadSuggestions = async () => {
      const fallback = () => getCrossSellSuggestions(cartItems, crossSellFallbackCatalog);

      if (typeof window !== "undefined" && window.openai?.callTool) {
        try {
          const response = await window.openai.callTool("cross_sell_recommendations", {
            cartItems: cartItems.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              shortDescription: item.shortDescription,
              detailSummary: item.detailSummary,
              tags: item.tags,
            })),
            maxResults: 8,
          });
          const toolSuggestions = extractSuggestions(response);
          if (toolSuggestions) {
            return toolSuggestions;
          }
        } catch {
          // fall back to local list
        }
      }

      return fallback();
    };

    loadSuggestions()
      .then((items) => {
        if (!isMounted) {
          return;
        }
        setSuggestions(items);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setSuggestions([]);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cartItems]);

  useEffect(() => {
    if (isLoading || suggestions.length === 0) {
      return;
    }

    const key = suggestions.map((item) => item.sku).join("|");
    if (key === impressionKeyRef.current) {
      return;
    }
    impressionKeyRef.current = key;

    const cartItemCategories =
      categoryIntent.categories.length > 0 ? categoryIntent.categories : ["unknown"];

    suggestions.forEach((item, index) => {
      emitAnalyticsEvent("cart_cross_sell_impression", {
        cartItemCategories,
        suggestedSku: item.sku,
        position: index,
      });
    });
  }, [categoryIntent.categories, isLoading, suggestions]);

  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-black">Consigliati per te</h2>
        <p className="text-xs text-black/60">
          Accessori utili per completare il tuo acquisto
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <CrossSellCardSkeleton key={index} index={index} />
            ))
          : suggestions.map((item, index) => (
              <CrossSellCard
                key={item.sku}
                item={item}
                position={index}
                onAdd={(selected, position) => {
                  const cartItemCategories =
                    categoryIntent.categories.length > 0
                      ? categoryIntent.categories
                      : ["unknown"];
                  emitAnalyticsEvent("cart_cross_sell_add", {
                    cartItemCategories,
                    suggestedSku: selected.sku,
                    position,
                  });
                  onAdd(selected, position);
                }}
                formatCurrency={formatCurrency}
              />
            ))}
      </div>
    </section>
  );
}
