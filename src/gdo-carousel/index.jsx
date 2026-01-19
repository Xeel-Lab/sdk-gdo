import React from "react";
import "../index.css";
import { createRoot } from "react-dom/client";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import PlaceCard from "./PlaceCard";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { useOpenAiGlobal } from "../use-openai-global";
import { AnimatePresence } from "framer-motion";
import ProductDetails from "../utils/ProductDetails";

const MAX_PRODUCTS_CAROUSEL = 6; // Limite massimo di prodotti da visualizzare nel carosello

function App() {
  // Leggi dati da toolOutput (popolato dal server quando recupera dati da MotherDuck)
  const toolOutput = useOpenAiGlobal("toolOutput");
  const places = (toolOutput?.places || []).slice(0, MAX_PRODUCTS_CAROUSEL);
  const [selectedPlace, setSelectedPlace] = React.useState(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: "trimSnaps",
    slidesToScroll: "auto",
    dragFree: false,
  });
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  React.useEffect(() => {
    if (!emblaApi) return;
    const updateButtons = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    updateButtons();
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi]);

  return (
    <div className="antialiased relative w-full text-black py-5 bg-[#3D4347] rounded-2xl shadow-sm">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 px-4 max-sm:mx-5 items-stretch">
          {places.map((place) => (
            <PlaceCard 
              key={place.id} 
              place={place} 
              onCardClick={setSelectedPlace}
            />
          ))}
        </div>
      </div>
      <AnimatePresence>
        {selectedPlace && (
          <ProductDetails
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
            position="modal"
            relatedSourceItems={places}
            onSelectRelated={(item) => setSelectedPlace(item)}
          />
        )}
      </AnimatePresence>
      {/* Edge gradients */}
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-y-0 left-0 w-3 z-[5] transition-opacity duration-200 " +
          (canPrev ? "opacity-100" : "opacity-0")
        }
      >
        <div
          className="h-full w-full border-l border-black/15 bg-gradient-to-r from-black/10 to-transparent"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
          }}
        />
      </div>
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-y-0 right-0 w-3 z-[5] transition-opacity duration-200 " +
          (canNext ? "opacity-100" : "opacity-0")
        }
      >
        <div
          className="h-full w-full border-r border-black/15 bg-gradient-to-l from-black/10 to-transparent"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
          }}
        />
      </div>
      {canPrev && (
        <Button
          aria-label="Previous"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 shadow-lg"
          color="secondary"
          size="sm"
          variant="solid"
          uniform
          onClick={() => emblaApi && emblaApi.scrollPrev()}
          type="button"
        >
          <ArrowLeft
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        </Button>
      )}
      {canNext && (
        <Button
          aria-label="Next"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shadow-lg"
          color="secondary"
          size="sm"
          variant="solid"
          uniform
          onClick={() => emblaApi && emblaApi.scrollNext()}
          type="button"
        >
          <ArrowRight
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        </Button>
      )}
    </div>
  );
}

createRoot(document.getElementById("gdo-carousel-root")).render(<App />);

export { App };
export default App;
