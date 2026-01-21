import React from "react";
import { createRoot } from "react-dom/client";
import { PlusCircle, ShoppingCart } from "lucide-react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Image } from "@openai/apps-sdk-ui/components/Image";
import { useOpenAiGlobal } from "../use-openai-global";
import { useCart } from "../use-cart";
import { AnimatePresence } from "framer-motion";
import ProductDetails from "../utils/ProductDetails";

function App() {
  // Leggi dati da toolOutput (popolato dal server quando recupera dati da MotherDuck)
  const toolOutput = useOpenAiGlobal("toolOutput");
  const places = toolOutput?.places || [];
  const { addToCart, isInCart } = useCart();
  const [selectedPlace, setSelectedPlace] = React.useState(null);

  const handleAddToCart = (place) => {

    console.log("[gdo-list] Adding to cart", place);

    addToCart({
      id: place.id,
      name: place.name,
      price: place.price,
      description: place.description,
      thumbnail: place.thumbnail,
    });
  };

  return (
    <div className="antialiased w-full text-black px-4 pb-2 border border-black/10 rounded-2xl sm:rounded-3xl overflow-hidden bg-white rounded-2xl shadow-sm">
      <div className="max-w-full">
        <div className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4">
          <div
            className="sm:w-18 w-16 aspect-square rounded-xl bg-cover bg-center"
            style={{
              backgroundImage:
                "url(https://persistent.oaistatic.com/electronics/title.png)",
            }}
          ></div>
          <div>
            <div className="text-base sm:text-xl font-medium">
              Prodotti GDO
            </div>
            <div className="text-sm text-black/60">
              Una selezione dei migliori prodotti alimentari
            </div>
          </div>
          <div className="flex-auto hidden sm:flex justify-end pr-2">
            <Button color="primary" variant="solid" size="md">
              Save List
            </Button>
          </div>
        </div>
        <div className="min-w-full text-sm flex flex-col">
          {places.slice(0, 7).map((place, i) => (
            <div
              key={place.id}
              className="px-3 -mx-2 rounded-2xl hover:bg-black/5 cursor-pointer"
              onClick={(e) => {
                // Non aprire i dettagli se si clicca sul pulsante "Aggiungi al carrello" o sul selettore quantità
                if (e.target && e.target.closest && (e.target.closest('button') || e.target.closest('input'))) {
                  return;
                }
                setSelectedPlace(place);
              }}
            >
              <div
                style={{
                  borderBottom:
                    i === 7 - 1 ? "none" : "1px solid rgba(0, 0, 0, 0.05)",
                }}
                className="flex w-full items-center hover:border-black/0! gap-2"
              >
                <div className="py-3 pr-3 min-w-0 w-full sm:w-3/5">
                  <div className="flex items-center gap-3">
                    <Image
                      src={place.thumbnail}
                      alt={place.name}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover ring ring-black/5"
                    />
                    <div className="w-3 text-end sm:block hidden text-sm text-black/40">
                      {i + 1}
                    </div>
                    <div className="min-w-0 sm:pl-1 flex flex-col items-start h-full">
                      <div className="font-medium text-sm sm:text-md truncate max-w-[40ch]">
                        {place.name}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="py-2 whitespace-nowrap flex justify-end">
                  <Button
                    aria-label={isInCart(place.id) ? `${place.name} già nel carrello` : `Aggiungi ${place.name} al carrello`}
                    color={isInCart(place.id) ? "primary" : "secondary"}
                    variant={isInCart(place.id) ? "soft" : "ghost"}
                    size="sm"
                    uniform
                    onClick={() => handleAddToCart(place)}
                    disabled={isInCart(place.id)}
                  >
                    {isInCart(place.id) ? (
                      <ShoppingCart strokeWidth={1.5} className="h-5 w-5" />
                    ) : (
                      <PlusCircle strokeWidth={1.5} className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {places.length === 0 && (
            <div className="py-6 text-center text-black/60">
              No products found.
            </div>
          )}
        </div>
        <div className="sm:hidden px-0 pt-2 pb-2">
          <Button color="primary" variant="solid" size="md" block>
            Save List
          </Button>
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
    </div>
  );
}

createRoot(document.getElementById("gdo-list-root")).render(<App />);

export { App };
export default App;
