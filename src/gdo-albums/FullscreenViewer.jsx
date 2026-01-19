import React from "react";
import { ShoppingCart } from "lucide-react";
import { useMaxHeight } from "../use-max-height";
import FilmStrip from "./FilmStrip";
import SafeImage from "../gdo/SafeImage";
import { useProxyBaseUrl } from "../use-proxy-base-url";
import { useCart } from "../use-cart";
import { Button } from "@openai/apps-sdk-ui/components/Button";

export default function FullscreenViewer({ album }) {
  const maxHeight = useMaxHeight() ?? undefined;
  const [index, setIndex] = React.useState(0);
  const proxyBaseUrl = useProxyBaseUrl();
  const { addToCart, isInCart } = useCart();

  React.useEffect(() => {
    setIndex(0);
  }, [album?.id]);

  const photo = album?.photos?.[index];
  const photoId = photo?.id || `album-${album.id}-photo-${index}`;

  const handleAddToCart = () => {
    if (photo) {
      addToCart({
        id: photoId,
        name: photo.title || album.title,
        description: album.title,
        thumbnail: photo.url,
      });
    }
  };

  return (
    <div
      className="relative w-full h-full bg-white"
      style={{
        maxHeight,
        height: maxHeight,
      }}
    >
      <div className="absolute inset-0 flex flex-row overflow-hidden">
        {/* Film strip */}
        <div className="hidden md:block absolute pointer-events-none z-10 left-0 top-0 bottom-0 w-40">
          <FilmStrip album={album} selectedIndex={index} onSelect={setIndex} proxyBaseUrl={proxyBaseUrl} />
        </div>
        {/* Main photo */}
        <div className="flex-1 min-w-0 px-40 py-10 relative flex items-center justify-center">
          <div className="relative w-full h-full">
            {photo ? (
              <>
                <SafeImage
                  src={photo.url}
                  alt={photo.title || album.title}
                  className="absolute inset-0 m-auto rounded-3xl shadow-sm border border-black/10 max-w-full max-h-full object-contain"
                  proxyBaseUrl={proxyBaseUrl}
                />
                {/* Add to cart button */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                  <Button
                    color="primary"
                    variant="solid"
                    size="md"
                    onClick={handleAddToCart}
                    disabled={isInCart(photoId)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isInCart(photoId)
                      ? "Nel carrello"
                      : "Aggiungi al carrello"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
