import React from "react";
import { createRoot } from "react-dom/client";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, Flame } from "lucide-react";
import { useWidgetProps } from "../use-widget-props";
import { useOpenAiGlobal } from "../use-openai-global";
import SliceCard from "./SliceCard";
import { AnimatePresence } from "framer-motion";
import ProductDetails from "../utils/ProductDetails";

function App() {
  // Note: This widget is for GDO search
  // Uses GDO-specific props
  const { searchTerm = "" } = useWidgetProps({ searchTerm: "" });
  const searchLabel = String(searchTerm || "").trim();
  // Leggi dati da toolOutput (popolato dal server quando recupera dati da MotherDuck)
  const toolOutput = useOpenAiGlobal("toolOutput");
  const places = toolOutput?.places || [];
  const [selectedPlace, setSelectedPlace] = React.useState(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    containScroll: "trimSnaps",
    slidesToScroll: "auto",
    dragFree: true,
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
    <div className="antialiased relative w-full text-black rounded-2xl border border-black/10 bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F46C21]/15 text-[#F46C21]">
            <Flame strokeWidth={1.5} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold">GDO spotlights</div>
            <div className="text-sm text-black/60">
              {searchLabel
                ? `Search results for: ${searchLabel}`
                : "Trending products near you"}
            </div>
          </div>
          <div className="ml-auto text-xs uppercase tracking-wide text-black/40">
            Updated 5m ago
          </div>
        </div>
        {searchLabel && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#F46C21]/10 px-3 py-1 text-xs font-medium text-[#F46C21]">
            Showing results for: {searchLabel}
          </div>
        )}
      </div>
      <div className="relative px-5 pb-6">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4 items-stretch">
            {places.map((place, index) => (
              <SliceCard
                key={place.id}
                place={place}
                index={index}
                onCardClick={setSelectedPlace}
              />
            ))}
          </div>
        </div>
        <div
          aria-hidden
          className={
            "pointer-events-none absolute inset-y-0 left-0 w-5 transition-opacity duration-200 " +
            (canPrev ? "opacity-100" : "opacity-0")
          }
        >
          <div className="h-full w-full bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
        <div
          aria-hidden
          className={
            "pointer-events-none absolute inset-y-0 right-0 w-5 transition-opacity duration-200 " +
            (canNext ? "opacity-100" : "opacity-0")
          }
        >
          <div className="h-full w-full bg-gradient-to-l from-white via-white/70 to-transparent" />
        </div>
        {canPrev && (
          <button
            aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white text-black shadow-lg ring ring-black/5 hover:bg-white"
            onClick={() => emblaApi && emblaApi.scrollPrev()}
            type="button"
          >
            <ArrowLeft strokeWidth={1.5} className="h-4.5 w-4.5" />
          </button>
        )}
        {canNext && (
          <button
            aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white text-black shadow-lg ring ring-black/5 hover:bg-white"
            onClick={() => emblaApi && emblaApi.scrollNext()}
            type="button"
          >
            <ArrowRight strokeWidth={1.5} className="h-4.5 w-4.5" />
          </button>
        )}
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
    </div>
  );
}

createRoot(document.getElementById("mixed-auth-search-root")).render(<App />);

export { App };
export default App;
