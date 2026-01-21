import React from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import SafeImage from "../gdo/SafeImage";
import { useProxyBaseUrl } from "../use-proxy-base-url";
import { useCart } from "../use-cart";

function PlaceCard({ place, onCardClick }) {
  const proxyBaseUrl = useProxyBaseUrl();
  const { addToCart, isInCart } = useCart();
  
  if (!place) return null;

  // Usa useCallback per evitare che l'handler venga ricreato ad ogni render
  // e per assicurarsi che ogni PlaceCard abbia il proprio handler specifico
  const handleAddToCart = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Verifica che place.id esista e sia valido
    if (!place.id) {
      return;
    }

    // Aggiungi SOLO questo prodotto specifico
    addToCart({
      id: place.id,
      name: place.name,
      price: place.price,
      description: place.description,
      thumbnail: place.thumbnail,
    });
  }, [place.id, place.name, place.price, place.description, place.thumbnail, addToCart]);

  const inCart = isInCart(place.id);

  return (
    <div 
      className="min-w-[220px] select-none max-w-[220px] w-[65vw] sm:w-[220px] self-stretch flex flex-col cursor-pointer bg-white rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.08)] ring-1 ring-black/5 transition-shadow hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)] px-2"
      onClick={(e) => {
        // Non aprire i dettagli se si clicca sul pulsante "Aggiungi al carrello"
        if (e.target && e.target.closest && e.target.closest('button')) {
          return;
        }
        if (onCardClick) {
          onCardClick(place);
        }
      }}
    >
      <div className="w-full">
        <SafeImage
          src={place.thumbnail}
          alt={place.name}
          className="w-full aspect-square rounded-2xl object-cover ring ring-black/5 shadow-[0px_2px_6px_rgba(0,0,0,0.06)]"
          proxyBaseUrl={proxyBaseUrl}
        />
      </div>
      <div className="mt-3 flex flex-col flex-1">
        <div className="text-base font-medium truncate line-clamp-1">
          {place.name}
        </div>
        {place.price ? (
          <div className="text-sm font-semibold text-black/80 mt-1">
            {place.price}
          </div>
        ) : null}
        {place.description ? (
          <div className="text-sm mt-2 text-black/80 flex-auto">
            {place.description}
          </div>
        ) : null}
        <div className="mt-5 flex gap-2">
          <Button 
            color="primary" 
            size="sm" 
            variant="solid"
            onClick={handleAddToCart}
            disabled={inCart}
            className="flex-1"
          >
            {inCart ? (
              <>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Nel carrello
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Aggiungi al carrello
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-render if place object reference changes
export default React.memo(PlaceCard, (prevProps, nextProps) => {
  // Custom comparison: only re-render if place ID changes
  return prevProps.place?.id === nextProps.place?.id;
});
