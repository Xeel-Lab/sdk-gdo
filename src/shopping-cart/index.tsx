import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence } from "framer-motion";
import { useCart } from "../use-cart";
import { AvocadoIcon, BreadIcon, EggIcon, JarIcon, TomatoIcon } from "./icons";
import CrossSellSection from "./CrossSellSection";
import type { CartItem } from "../types";
import ProductDetails from "../utils/ProductDetails";

const iconMatchers = [
  { keywords: ["egg", "eggs"], Icon: EggIcon },
  { keywords: ["bread"], Icon: BreadIcon },
  { keywords: ["tomato", "tomatoes"], Icon: TomatoIcon },
  { keywords: ["avocado", "avocados"], Icon: AvocadoIcon },
];

function App() {
  // IMPORTANTE: shopping-cart usa useCart che gestisce il carrello condiviso tramite la chiave specifica "sharedCartItems"
  // Questo garantisce che il carrello mostri SOLO i prodotti aggiunti tramite i pulsanti "Aggiungi al carrello"
  // Ignora completamente qualsiasi altro dato in widgetState (es. da gdo-shop)
  const { cartItems, addToCart, removeFromCart, clearCart } = useCart();
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<"success" | "cancel" | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [purchaseSummary, setPurchaseSummary] = useState<{
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
    currency: string;
    buyer: {
      email: string;
      name: string;
      address1: string;
      address2: string;
      city: string;
      postalCode: string;
      country: string;
    };
    deliveryDate: string;
  } | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [billingName, setBillingName] = useState("");
  const [billingAddress1, setBillingAddress1] = useState("");
  const [billingAddress2, setBillingAddress2] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("");
  const animationStyles = `
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;

  function adjustQuantity(id: string, delta: number) {
    if (!id || delta === 0) {
      return;
    }

    // Usa removeFromCart per decrementare (che gestisce anche la rimozione quando quantity = 0)
    // Per incrementare, trova l'item e aggiungilo di nuovo (useCart incrementerà la quantità)
    if (delta < 0) {
      // Decrementa: usa removeFromCart che decrementa di 1
      for (let i = 0; i < Math.abs(delta); i++) {
        removeFromCart(id);
      }
    } else {
      // Incrementa: trova l'item e aggiungilo di nuovo (useCart incrementerà la quantità se esiste già)
      const item = cartItems.find((item) => item.id === id);
      if (item) {
        // useCart.addToCart incrementerà la quantità se l'item esiste già
        for (let i = 0; i < delta; i++) {
          addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            description: item.description,
            image: item.image,
          });
        }
      }
    }
  }

  // IMPORTANTE: Il carrello mostra SOLO gli items aggiunti tramite i pulsanti "Aggiungi al carrello" nei widget
  // NON sincronizziamo da widgetState perché potrebbe contenere prodotti da altri widget (es. electronics-shop)
  // Il carrello viene popolato direttamente tramite useWidgetState quando l'utente clicca sui pulsanti nei widget
  
  // Rimuoviamo completamente la sincronizzazione da widgetState per evitare prodotti indesiderati
  // Il carrello parte sempre vuoto e viene popolato solo tramite i pulsanti "Aggiungi al carrello"

  function getIconForItem(name: string) {
    const words = name
      .toLowerCase()
      .replace(/[^a-z]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    for (const entry of iconMatchers) {
      if (entry.keywords.some((keyword) => words.includes(keyword))) {
        return entry.Icon;
      }
    }
    return JarIcon;
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    const status = url.searchParams.get("checkout");
    if (status === "success" || status === "cancel") {
      setCheckoutStatus(status);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

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
      if (
        typeof payload.id === "string" ||
        typeof payload.status === "string" ||
        typeof payload.cart === "object" ||
        typeof payload.payment_intent_id === "string"
      ) {
        return payload;
      }
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
    }
    return null;
  }

  function computeTotals(items: CartItem[]) {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 0),
      0
    );
    const discount = 0;
    const taxableBase = Math.max(0, subtotal - discount);
    const shipping = subtotal < 50 ? 5 : 0;
    const total = Number((taxableBase + shipping).toFixed(2));
    return { subtotal, discount, tax: 0, shipping, total };
  }

  function formatCurrency(value: number, currency = "EUR") {
    try {
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  function randomDeliveryDate() {
    const daysToAdd = Math.floor(Math.random() * 5) + 3; // 3-7 days
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  function extractSessionId(response: unknown): string | null {
    const structured = extractStructuredContent(response);
    if (structured && typeof structured.id === "string") {
      return structured.id;
    }
    if (response && typeof response === "object") {
      const payload = response as Record<string, unknown>;
      if (typeof payload.id === "string") {
        return payload.id;
      }
    }
    return null;
  }

  function extractStatus(response: unknown): string | null {
    const structured = extractStructuredContent(response);
    if (structured && typeof structured.status === "string") {
      return structured.status;
    }
    if (response && typeof response === "object") {
      const payload = response as Record<string, unknown>;
      if (typeof payload.status === "string") {
        return payload.status;
      }
    }
    return null;
  }

  async function handleCheckout() {
    if (!window.openai?.callTool) {
      setCheckoutError("callTool non disponibile in questo contesto.");
      return;
    }
    if (cartItems.length === 0) {
      return;
    }
    if (!customerEmail.trim()) {
      setCheckoutError("Inserisci un'email per continuare.");
      return;
    }
    const invalidItem = cartItems.find(
      (item) => !item.price || item.price <= 0 || !item.quantity || item.quantity <= 0
    );
    if (invalidItem) {
      setCheckoutError("Impossibile avviare il pagamento: alcuni articoli non hanno un prezzo valido.");
      return;
    }
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const createResponse = await window.openai.callTool("checkout_create_session", {
        items: cartItems.map((item) => ({
          name: item.name,
          quantity: item.quantity ?? 1,
          unit_amount_major: item.price,
          description: item.shortDescription ?? item.description ?? "",
        })),
        currency: "eur",
        buyer_email: customerEmail.trim(),
        shared_payment_token: "test_spt_visa",
      });
      console.log("[checkout_create_session]", createResponse);

      const createStructured = extractStructuredContent(createResponse);
      const sessionId =
        createStructured && typeof createStructured.id === "string"
          ? createStructured.id
          : null;
      const paymentIntentId =
        createStructured && typeof createStructured.payment_intent_id === "string"
          ? createStructured.payment_intent_id
          : null;

      if (!sessionId && !paymentIntentId) {
        throw new Error(
          `Risposta create_session non valida: ${JSON.stringify(createResponse)}`
        );
      }

      let status: string | null = null;

      if (sessionId) {
        try {
          const completeResponse = await window.openai.callTool(
            "checkout_complete_session",
            {
              session_id: sessionId,
            }
          );
          console.log("[checkout_complete_session]", completeResponse);
          status = extractStatus(completeResponse);
        } catch (error) {
          console.error("checkout_complete_session failed", error);
        }
      }

      if (!status && paymentIntentId) {
        const confirmResponse = await window.openai.callTool("confirm_payment_intent", {
          payment_intent_id: paymentIntentId,
        });
        console.log("[confirm_payment_intent]", confirmResponse);
        status = extractStatus(confirmResponse);
      }

      if (status === "succeeded") {
        const itemsSnapshot = cartItems.map((item) => {
          const quantity = item.quantity ?? 1;
          const unitPrice = item.price ?? 0;
          return {
            id: item.id,
            name: item.name,
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
          };
        });
        const totals = computeTotals(cartItems);
        setPurchaseSummary({
          items: itemsSnapshot,
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          shipping: totals.shipping,
          total: totals.total,
          currency: "EUR",
          buyer: {
            email: customerEmail.trim(),
            name: billingName.trim(),
            address1: billingAddress1.trim(),
            address2: billingAddress2.trim(),
            city: billingCity.trim(),
            postalCode: billingPostalCode.trim(),
            country: billingCountry.trim(),
          },
          deliveryDate: randomDeliveryDate(),
        });
        clearCart();
        setShowBillingModal(false);
        setCheckoutStatus("success");
      } else {
        setCheckoutStatus("cancel");
        throw new Error("Pagamento non riuscito.");
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Errore durante il checkout.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  const itemCards = cartItems.length ? (
    <div className="space-y-3">
      {cartItems.map((item) => (
        <div
          key={item.name}
          className="flex items-center justify-between rounded-2xl border border-black/20 bg-[#fffaf5] p-3"
          role="button"
          tabIndex={0}
          aria-label={`View details for ${item.name}`}
          onClick={() => setSelectedItem(item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedItem(item);
            }
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              {(() => {
                const Icon = getIconForItem(item.name);
                return <Icon className="h-6 w-6" />;
              })()}
            </div>
            <div>
              <p className="text-sm font-semibold text-black">{item.name}</p>
              <p className="text-xs text-black/60">
                Qty <span className="font-mono">{item.quantity ?? 0}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                adjustQuantity(item.id, -1);
              }}
              className="h-8 w-8 rounded-full border border-black/30 text-lg font-semibold text-black/70 transition hover:bg-white"
              aria-label={`Decrease ${item.name}`}
            >
              -
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                adjustQuantity(item.id, 1);
              }}
              className="h-8 w-8 rounded-full border border-black/30 text-lg font-semibold text-black/70 transition hover:bg-white"
              aria-label={`Increase ${item.name}`}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-black/40 bg-[#fffaf5] p-8 text-center">
      <p className="text-base font-medium text-black/70 mb-2">
        Carrello vuoto
      </p>
      <p className="text-sm text-black/60">
        Non hai aggiunto nessun articolo al carrello.
        <br />
        Usa i pulsanti "Aggiungi al carrello" nei widget per aggiungere prodotti.
      </p>
    </div>
  );

  return (
    <div
      className="min-h-screen w-full bg-white text-black bg-[radial-gradient(circle_at_top_left,_#fff7ed_0,_#ffffff_55%),radial-gradient(circle_at_bottom_right,_#eef2ff_0,_#ffffff_45%)] rounded-2xl shadow-sm"
      style={{
        fontFamily: '"Trebuchet MS", "Gill Sans", "Lucida Grande", sans-serif',
      }}
      data-theme="light"
    >
      <style>{animationStyles}</style>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:px-6 lg:px-8">
        <header
          className="space-y-2"
          style={{ animation: "fadeUp 0.6s ease-out both" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
            Simple cart
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Il tuo carrello
          </h1>
          <p className="text-sm text-black/70">
            Il carrello contiene solo i prodotti che hai aggiunto tramite i pulsanti "Aggiungi al carrello" nei widget.
          </p>
        </header>

        <div
          className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"
          style={{
            animation: "fadeUp 0.7s ease-out both",
            animationDelay: "80ms",
          }}
        >
          <section className="space-y-4">
            <header className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-widest text-black/70">
                Cart
              </p>
              <span className="text-xs text-black/60">
                {cartItems.length} items
              </span>
            </header>
            {checkoutStatus && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  checkoutStatus === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
                role="status"
              >
                {checkoutStatus === "success"
                  ? "Pagamento completato. Grazie per l'acquisto!"
                  : "Pagamento annullato. Puoi riprovare quando vuoi."}
              </div>
            )}
            {purchaseSummary && (
              <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-black/60">
                  Riepilogo acquisto
                </h2>
                <p className="mt-2 text-sm text-black/70">
                  Grazie per aver acquistato da noi! La consegna è prevista per{" "}
                  <span className="font-semibold">{purchaseSummary.deliveryDate}</span>.
                </p>
                <div className="mt-4 space-y-3">
                  {purchaseSummary.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-black/80">{item.name}</p>
                        <p className="text-xs text-black/60">
                          Quantità: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right text-sm font-semibold text-black/70">
                        {formatCurrency(item.lineTotal)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 text-sm text-black/70">
                  <div className="flex items-center justify-between">
                    <span>Subtotale</span>
                    <span>{formatCurrency(purchaseSummary.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sconto</span>
                    <span>{formatCurrency(purchaseSummary.discount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Spedizione</span>
                    <span>{formatCurrency(purchaseSummary.shipping)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-black">
                    <span>Totale</span>
                    <span>{formatCurrency(purchaseSummary.total)}</span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-black/5 bg-white px-3 py-2 text-sm text-black/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Dati di fatturazione
                  </p>
                  <p className="mt-2">{purchaseSummary.buyer.name || "Cliente"}</p>
                  <p>{purchaseSummary.buyer.email}</p>
                  <p>{purchaseSummary.buyer.address1}</p>
                  {purchaseSummary.buyer.address2 ? (
                    <p>{purchaseSummary.buyer.address2}</p>
                  ) : null}
                  <p>
                    {purchaseSummary.buyer.postalCode} {purchaseSummary.buyer.city}
                  </p>
                  <p>{purchaseSummary.buyer.country}</p>
                </div>
                <p className="mt-4 text-sm text-black/70">
                  Se hai bisogno di assistenza, rispondi a questa chat e saremo felici di aiutarti.
                </p>
              </div>
            )}
            {!purchaseSummary ? itemCards : null}
            {!purchaseSummary && (
              <CrossSellSection
                cartItems={cartItems}
                formatCurrency={formatCurrency}
                onAdd={(item) => {
                  addToCart({
                    id: item.sku,
                    name: item.name,
                    price: item.price,
                    description: item.tags?.join(", ") ?? "",
                    image: item.imageUrl ?? "",
                  });
                }}
              />
            )}
            {!purchaseSummary && (
              <>
                <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-black/70">
                  I prezzi includono IVA. Spedizione:{" "}
                  <span className="font-semibold">
                    {formatCurrency(computeTotals(cartItems).shipping)}
                  </span>{" "}
                  {computeTotals(cartItems).shipping > 0
                    ? "(gratis sopra 50€)"
                    : "(già inclusa)"}
                </div>
                <button
                  type="button"
                  disabled={cartItems.length === 0 || isCheckingOut}
                  onClick={() => setShowBillingModal(true)}
                  className="w-full rounded-2xl border border-black/30 bg-white py-3 text-sm font-semibold text-black/70 transition hover:border-black/50 disabled:cursor-not-allowed disabled:opacity-70"
                  aria-busy={isCheckingOut}
                >
                  {isCheckingOut ? "Apertura checkout..." : "Procedi al pagamento"}
                </button>
                {checkoutError && (
                  <p className="text-xs text-red-600" role="alert">
                    {checkoutError}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      <AnimatePresence>
        {showBillingModal && !purchaseSummary && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-label="Dati per il checkout"
          >
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-black/60">
                  Dati per il checkout
                </p>
                <button
                  type="button"
                  className="rounded-full border border-black/10 px-2 py-1 text-xs text-black/60 hover:border-black/30"
                  onClick={() => setShowBillingModal(false)}
                >
                  Chiudi
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="text-xs font-semibold text-black/70">
                  Email
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="nome@esempio.com"
                    className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-black/70">
                  Nome e cognome (fatturazione)
                  <input
                    type="text"
                    value={billingName}
                    onChange={(event) => setBillingName(event.target.value)}
                    placeholder="Mario Rossi"
                    className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-black/70">
                  Indirizzo
                  <input
                    type="text"
                    value={billingAddress1}
                    onChange={(event) => setBillingAddress1(event.target.value)}
                    placeholder="Via Roma 1"
                    className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-black/70">
                  Indirizzo (opzionale)
                  <input
                    type="text"
                    value={billingAddress2}
                    onChange={(event) => setBillingAddress2(event.target.value)}
                    placeholder="Scala, interno, ecc."
                    className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-black/70">
                    Città
                    <input
                      type="text"
                      value={billingCity}
                      onChange={(event) => setBillingCity(event.target.value)}
                      placeholder="Milano"
                      className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-black/70">
                    CAP
                    <input
                      type="text"
                      value={billingPostalCode}
                      onChange={(event) => setBillingPostalCode(event.target.value)}
                      placeholder="20100"
                      className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <label className="text-xs font-semibold text-black/70">
                  Paese
                  <input
                    type="text"
                    value={billingCountry}
                    onChange={(event) => setBillingCountry(event.target.value)}
                    placeholder="IT"
                    className="mt-1 w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {checkoutError && (
                <p className="mt-3 text-xs text-red-600" role="alert">
                  {checkoutError}
                </p>
              )}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-black/20 px-4 py-2 text-xs text-black/60"
                  onClick={() => setShowBillingModal(false)}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={isCheckingOut}
                  onClick={handleCheckout}
                  className="rounded-xl border border-black/30 bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
                  aria-busy={isCheckingOut}
                >
                  {isCheckingOut ? "Pagamento in corso..." : "Conferma e paga"}
                </button>
              </div>
            </div>
          </div>
        )}
        {selectedItem && (
          <ProductDetails
            place={{
              id: selectedItem.id,
              name: selectedItem.name,
              price: `$${selectedItem.price.toFixed(2)}`,
              description: selectedItem.description,
              thumbnail: selectedItem.image,
              stock: selectedItem.stock,
            }}
            onClose={() => setSelectedItem(null)}
            position="modal"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const rootElement = document.getElementById("shopping-cart-root");
if (!rootElement) {
  throw new Error("Missing shopping-cart-root element");
}

createRoot(rootElement).render(<App />);

export { App };
export default App;
