import { motion, AnimatePresence } from "framer-motion";
import { Star, X, ShoppingCart } from "lucide-react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import SafeImage from "../gdo/SafeImage.jsx";
import { useProxyBaseUrl } from "../use-proxy-base-url";
import { useCart } from "../use-cart";
import type { CartItem } from "../types";

type ProductDetailsProps = {
  place: {
    id: string;
    name: string;
    price?: string;
    description?: string;
    thumbnail?: string;
    rating?: number;
    stock?: number;
    city?: string;
  } | null;
  onClose: () => void;
  position?: "modal" | "sidebar" | "overlay";
  relatedItems?: CartItem[];
  onSelectRelated?: (item: CartItem) => void;
  relatedTitle?: string;
  relatedSourceItems?: Array<{
    id: string;
    name: string;
    price?: number | string;
    description?: string;
    thumbnail?: string;
    image?: string;
    shortDescription?: string;
    detailSummary?: string;
    highlights?: string[];
    tags?: string[];
  }>;
};

/**
 * Componente riutilizzabile per mostrare i dettagli di un prodotto
 * Può essere usato come modal, sidebar o overlay
 */
export default function ProductDetails({
  place,
  onClose,
  position = "modal",
  relatedItems,
  onSelectRelated,
  relatedTitle,
  relatedSourceItems,
}: ProductDetailsProps) {
  const proxyBaseUrl = useProxyBaseUrl();
  const { addToCart, isInCart } = useCart();

  const formatPrice = (value: number) => `€${value.toFixed(2)}`;

  const parsePriceValue = (value: number | string | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const numeric = Number(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
      if (/^\$+$/.test(value)) {
        return value.length * 100;
      }
    }
    return null;
  };

  const getPriceLabel = (value: number | string | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return formatPrice(value);
    }
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    return "";
  };

  const buildText = (item: {
    name?: string;
    shortDescription?: string;
    detailSummary?: string;
    description?: string;
    tags?: string[];
    highlights?: string[];
  }) =>
    [
      item.name,
      item.shortDescription,
      item.detailSummary,
      item.description,
      ...(item.tags ?? []),
      ...(item.highlights ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const getRelatedFromSource = (
    current: NonNullable<ProductDetailsProps["place"]>,
    source: ProductDetailsProps["relatedSourceItems"]
  ) => {
    if (!current || !Array.isArray(source)) {
      return [];
    }

    const currentText = buildText(current);
    const currentTokens = new Set(currentText.split(/\s+/).filter(Boolean));
    const currentPriceValue = parsePriceValue(current.price);
    const priceBand =
      currentPriceValue != null ? Math.max(currentPriceValue * 0.3, 15) : null;

    const scored = source
      .filter((item) => item?.id && item.id !== current.id)
      .map((item) => {
        const candidateText = buildText(item);
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

        const candidatePriceValue = parsePriceValue(item.price);
        let priceScore = 0;
        if (
          priceBand != null &&
          candidatePriceValue != null &&
          Number.isFinite(candidatePriceValue)
        ) {
          const priceDelta = Math.abs(candidatePriceValue - currentPriceValue);
          priceScore =
            priceDelta <= priceBand ? 1 - priceDelta / priceBand : -0.5;
        }

        return {
          item,
          score: textScore + priceScore,
        };
      });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const filtered = sorted.filter((entry) => entry.score > 0.1);

    return (filtered.length ? filtered : sorted)
      .slice(0, 3)
      .map((entry) => entry.item);
  };

  const explicitRelatedItems = Array.isArray(relatedItems)
    ? relatedItems.slice(0, 3)
    : [];

  const derivedRelatedItems =
    explicitRelatedItems.length === 0 && relatedSourceItems && place
      ? getRelatedFromSource(place, relatedSourceItems)
      : [];

  const displayedRelatedItems = (
    explicitRelatedItems.length ? explicitRelatedItems : derivedRelatedItems
  ).slice(0, 3);

  const shouldShowRelated = displayedRelatedItems.length > 0;

  const getBadgeText = (item: {
    detailSummary?: string;
    highlights?: string[];
    shortDescription?: string;
    description?: string;
    tags?: string[];
  }) => {
    const candidate =
      item.detailSummary ??
      item.highlights?.[0] ??
      item.shortDescription ??
      item.description ??
      item.tags?.[0] ??
      "";
    return candidate?.trim();
  };

  const handleAddToCart = () => {
    if (!place) return;
    addToCart({
      id: place.id,
      name: place.name,
      price: place.price,
      description: place.description,
      thumbnail: place.thumbnail,
    });
  };

  if (!place) return null;

  // Stili in base alla posizione
  const containerClasses = {
    modal: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50",
    sidebar: "absolute z-30 top-0 bottom-4 left-0 right-auto xl:left-auto xl:right-6 md:z-20 w-[340px] xl:w-[360px] xl:top-6 xl:bottom-8 pointer-events-auto",
    overlay: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50",
  };

  const contentClasses = {
    modal: "relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white text-black shadow-xl",
    sidebar: "relative h-full overflow-y-auto rounded-none xl:rounded-3xl bg-white text-black xl:shadow-xl xl:ring ring-black/10",
    overlay: "relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white text-black shadow-xl",
  };

  return (
    <AnimatePresence>
      <motion.div
        key={place.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={containerClasses[position]}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 20 }}
          transition={{ type: "spring", bounce: 0, duration: 0.25 }}
          className={contentClasses[position]}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            aria-label="Close details"
            className="inline-flex absolute z-10 top-4 left-4 xl:top-4 xl:left-4 shadow-xl rounded-full p-2 bg-white ring ring-black/10 xl:shadow-2xl hover:bg-white"
            variant="solid"
            color="secondary"
            size="sm"
            uniform
            onClick={onClose}
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </Button>
          <div className="relative mt-2 xl:mt-0 px-2 xl:px-0">
            <SafeImage
              src={place.thumbnail || ""}
              alt={place.name}
              className="w-full rounded-3xl xl:rounded-none h-80 object-cover xl:rounded-t-2xl"
              proxyBaseUrl={proxyBaseUrl}
            />
          </div>

          <div className="h-[calc(100%-11rem)] sm:h-[calc(100%-14rem)]">
            <div className="p-4 sm:p-5">
              <div className="text-2xl font-medium truncate">{place.name}</div>
              <div className="text-sm mt-1 opacity-70 flex items-center gap-1">
                {place.rating && (
                  <>
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    {typeof place.rating === "number" ? place.rating.toFixed(1) : place.rating}
                  </>
                )}
                {place.price && <span>· {place.price}</span>}
                {place.city && <span>· {place.city}</span>}
              </div>
              <div className="mt-3 flex flex-row items-center gap-3 font-medium">
                <Button 
                  color="primary" 
                  variant="solid" 
                  size="sm"
                  onClick={handleAddToCart}
                  disabled={isInCart(place.id)}
                  className="flex-1"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {isInCart(place.id) ? "Nel carrello" : "Aggiungi al carrello"}
                </Button>
                <Button
                  color="primary"
                  variant="outline"
                  size="sm"
                  className="border-[#F46C21]/50 text-[#F46C21]"
                >
                  Contact
                </Button>
              </div>
              <div className="text-sm mt-5">
                {place.description || "Nessuna descrizione disponibile."}
              </div>
            </div>

            <div className="px-4 sm:px-5 pb-4">
              <div className="text-lg font-medium mb-2">Reviews</div>
              <ul className="space-y-3 divide-y divide-black/5">
                {[
                  {
                    user: "Leo M.",
                    avatar: "https://persistent.oaistatic.com/electronics/user1.png",
                    text: "Fantastic product quality and great value for money!",
                  },
                  {
                    user: "Priya S.",
                    avatar: "https://persistent.oaistatic.com/electronics/user2.png",
                    text: "Excellent customer service and fast delivery.",
                  },
                  {
                    user: "Maya R.",
                    avatar: "https://persistent.oaistatic.com/electronics/user3.png",
                    text: "Highly recommended! Will definitely buy again.",
                  },
                ].map((review, idx) => (
                  <li key={idx} className="py-3">
                    <div className="flex items-start gap-3">
                      <SafeImage
                        src={review.avatar}
                        alt={`${review.user} avatar`}
                        className="h-8 w-8 ring ring-black/5 rounded-full object-cover flex-none"
                        proxyBaseUrl={proxyBaseUrl}
                      />
                      <div className="min-w-0 gap-1 flex flex-col">
                        <div className="text-xs font-medium text-black/70">
                          {review.user}
                        </div>
                        <div className="text-sm">{review.text}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {shouldShowRelated ? (
              <div className="px-4 sm:px-5 pb-5">
                <div className="text-lg font-medium mb-2">
                  {relatedTitle ?? "Ti potrebbe interessare anche"}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {displayedRelatedItems.map((item) => {
                    const badgeText = getBadgeText(item);
                    const imageSrc =
                      (item as { image?: string; thumbnail?: string }).image ??
                      (item as { image?: string; thumbnail?: string })
                        .thumbnail ??
                      "";
                    const priceLabel = getPriceLabel(
                      (item as { price?: number | string }).price
                    );

                    return (
                      <button
                        key={(item as { id?: string }).id}
                        type="button"
                        className="text-left"
                        aria-label={`Open details for ${item.name}`}
                        onClick={() => onSelectRelated?.(item as CartItem)}
                        disabled={!onSelectRelated}
                      >
                        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:border-black/20">
                          <div className="relative h-24 w-full overflow-hidden">
                            <SafeImage
                              src={imageSrc}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              proxyBaseUrl={proxyBaseUrl}
                            />
                            <div className="absolute inset-0 bg-black/[0.04]" />
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium line-clamp-2">
                              {item.name}
                            </p>
                            {priceLabel ? (
                              <p className="text-sm text-black/70 mt-1">
                                {priceLabel}
                              </p>
                            ) : null}
                            {badgeText ? (
                              <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/70 line-clamp-1">
                                {badgeText}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
