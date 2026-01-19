import React from "react";
import { useOpenAiGlobal } from "./use-openai-global";
import type { CartItem } from "./types";

type CartWidgetState = {
  cartId?: string;
  items?: CartItem[];
  [key: string]: unknown;
};

// Chiave specifica per il carrello condiviso tra widget (diversa da gdo-shop)
const CART_STATE_KEY = "sharedCartItems";

const createDefaultCartState = (): CartWidgetState => ({
  items: [],
});

/**
 * Hook per gestire il carrello condiviso tra tutti i widget
 * Usa widgetState globale per persistenza tra widget
 */
export function useCart() {
  // IMPORTANTE: Il carrello parte SEMPRE vuoto e legge SOLO dalla chiave specifica "sharedCartItems"
  // Ignora completamente qualsiasi altro dato in widgetState (es. da gdo-shop)
  // Usa useOpenAiGlobal per reagire ai cambiamenti di widgetState
  const widgetStateGlobal = useOpenAiGlobal("widgetState") as Record<string, unknown> | null;
  
  // Estrai SOLO la chiave specifica, ignora tutto il resto
  // Leggi anche direttamente da window.openai.widgetState come fallback
  const widgetStateFromGlobal = React.useMemo(() => {
    // Prova prima da useOpenAiGlobal
    if (widgetStateGlobal && typeof widgetStateGlobal === "object") {
      const globalState = widgetStateGlobal as Record<string, unknown>;
      // Leggi SOLO dalla chiave specifica "sharedCartItems", ignora qualsiasi altra chiave
      if (globalState[CART_STATE_KEY] && typeof globalState[CART_STATE_KEY] === "object") {
        const globalCartState = globalState[CART_STATE_KEY] as CartWidgetState;
        if (Array.isArray(globalCartState.items)) {
          return globalCartState;
        }
      }
    }
    
    // Fallback: leggi direttamente da window.openai.widgetState
    if (typeof window !== "undefined" && window.openai?.widgetState) {
      const directState = window.openai.widgetState as Record<string, unknown>;
      if (directState[CART_STATE_KEY] && typeof directState[CART_STATE_KEY] === "object") {
        const directCartState = directState[CART_STATE_KEY] as CartWidgetState;
        if (Array.isArray(directCartState.items)) {
          return directCartState;
        }
      }
    }
    
    return null;
  }, [widgetStateGlobal]);

  const [cartState, setCartState] = React.useState<CartWidgetState>(() => {
    // Se c'è uno stato valido nella chiave specifica, usalo (anche se vuoto)
    if (widgetStateFromGlobal && Array.isArray(widgetStateFromGlobal.items)) {
      return widgetStateFromGlobal;
    }
    
    // Fallback: leggi direttamente da window.openai.widgetState durante l'inizializzazione
    if (typeof window !== "undefined" && window.openai?.widgetState) {
      const directState = window.openai.widgetState as Record<string, unknown>;
      if (directState[CART_STATE_KEY] && typeof directState[CART_STATE_KEY] === "object") {
        const directCartState = directState[CART_STATE_KEY] as CartWidgetState;
        if (Array.isArray(directCartState.items)) {
          return directCartState;
        }
      }
    }
    
    // Altrimenti parte sempre vuoto
    return createDefaultCartState();
  });

  // Ref per tracciare se stiamo aggiornando lo stato localmente (per evitare loop)
  const isUpdatingLocalRef = React.useRef(false);

  // Sincronizza quando widgetState globale cambia (solo per la chiave specifica)
  React.useEffect(() => {
    // Non sincronizzare se stiamo aggiornando localmente
    if (isUpdatingLocalRef.current) {
      return;
    }

    if (widgetStateFromGlobal && Array.isArray(widgetStateFromGlobal.items)) {
      setCartState((prevState) => {
        const currentItems = Array.isArray(prevState?.items) ? prevState.items : [];
        const globalItems = widgetStateFromGlobal.items;
        // Solo sincronizza se è diverso E se lo stato globale ha più items (non sovrascrivere con uno stato vuoto)
        const currentItemsStr = JSON.stringify(currentItems);
        const globalItemsStr = JSON.stringify(globalItems);
        if (currentItemsStr !== globalItemsStr) {
          // IMPORTANTE: Se lo stato globale ha items e quello locale è vuoto, usa sempre quello globale
          // Se lo stato locale ha items e quello globale è vuoto, mantieni quello locale (non sovrascrivere)
          if (globalItems.length > 0 && currentItems.length === 0) {
            return widgetStateFromGlobal;
          } else if (globalItems.length === 0 && currentItems.length > 0) {
            return prevState;
          } else {
            // Entrambi hanno items o entrambi sono vuoti - sincronizza solo se diverso
            return widgetStateFromGlobal;
          }
        }
        return prevState;
      });
    }
  }, [widgetStateFromGlobal]);

  // Ref per tracciare se questo è il primo render (per evitare di sovrascrivere lo stato globale all'inizializzazione)
  const isFirstRenderRef = React.useRef(true);
  
  // Aggiorna widgetState globale quando cambia cartState
  React.useEffect(() => {
    // Al primo render, non aggiornare lo stato globale se è vuoto (potrebbe sovrascrivere uno stato esistente)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      const localItems = Array.isArray(cartState?.items) ? cartState.items : [];
      if (localItems.length === 0) {
        // Al primo render con carrello vuoto, verifica se lo stato globale ha items
        if (typeof window !== "undefined" && window.openai?.widgetState) {
          const currentGlobalState = window.openai.widgetState as Record<string, unknown>;
          const currentGlobalCart = currentGlobalState[CART_STATE_KEY] as CartWidgetState | undefined;
          const currentGlobalItems = Array.isArray(currentGlobalCart?.items) ? currentGlobalCart.items : [];
          if (currentGlobalItems.length > 0) {
            setCartState(currentGlobalCart || createDefaultCartState());
            return;
          }
        }
      }
    }
    
    if (typeof window !== "undefined" && window.openai?.setWidgetState) {
      const currentGlobalState = (window.openai.widgetState || {}) as Record<string, unknown>;
      // Evita loop infiniti: non aggiornare se lo stato globale è già uguale
      const currentGlobalCart = currentGlobalState[CART_STATE_KEY] as CartWidgetState | undefined;
      const currentGlobalItems = Array.isArray(currentGlobalCart?.items) ? currentGlobalCart.items : [];
      const localItems = Array.isArray(cartState?.items) ? cartState.items : [];
      
      // IMPORTANTE: Non sovrascrivere uno stato globale con items con uno stato locale vuoto
      // Questo previene che un nuovo widget che parte vuoto cancelli il carrello esistente
      if (currentGlobalItems.length > 0 && localItems.length === 0) {
        // Aggiorna lo stato locale con quello globale invece di sovrascrivere
        setCartState((prev) => {
          const prevItems = Array.isArray(prev?.items) ? prev.items : [];
          if (JSON.stringify(prevItems) !== JSON.stringify(currentGlobalItems)) {
            return currentGlobalCart || createDefaultCartState();
          }
          return prev;
        });
        return;
      }
      
      // Solo aggiorna se lo stato è effettivamente cambiato
      const currentGlobalCartStr = JSON.stringify(currentGlobalCart);
      const cartStateStr = JSON.stringify(cartState);
      if (currentGlobalCartStr !== cartStateStr) {
        isUpdatingLocalRef.current = true;
        const newState = {
          ...currentGlobalState,
          [CART_STATE_KEY]: cartState,
        };
        void window.openai.setWidgetState(newState).then(() => {
          // Reset il flag dopo che setWidgetState è completato
          // Usa setTimeout per dare tempo all'evento di propagarsi e agli altri widget di reagire
          setTimeout(() => {
            isUpdatingLocalRef.current = false;
          }, 200);
        }).catch((error) => {
          isUpdatingLocalRef.current = false;
        });
      } else {
      }
    } else {
    }
  }, [cartState]);

  const cartItems = Array.isArray(cartState?.items) ? cartState.items : [];
  
  // Prevenzione chiamate multiple rapide (debounce per ID)
  const lastAddTimeRef = React.useRef<Map<string, number>>(new Map());

  /**
   * Aggiunge un prodotto al carrello
   * Se il prodotto esiste già, incrementa la quantità di 1
   * IMPORTANTE: Aggiunge SOLO il prodotto specificato, non altri prodotti
   */
  function addToCart(product: {
    id: string;
    name: string;
    price?: string | number;
    description?: string;
    image?: string;
    thumbnail?: string;
  }) {
    if (!product.id || !product.name) {
      return;
    }

    // Prevenzione chiamate multiple rapide (debounce di 500ms per ID)
    const now = Date.now();
    const lastAddTime = lastAddTimeRef.current.get(product.id) || 0;
    const timeSinceLastAdd = now - lastAddTime;
    
    if (timeSinceLastAdd < 500) {
      return;
    }
    
    lastAddTimeRef.current.set(product.id, now);
    
    setCartState((prevState) => {
      const baseState: CartWidgetState = prevState ?? createDefaultCartState();
      const items = Array.isArray(baseState.items)
        ? baseState.items.map((item) => ({ ...item }))
        : [];

      // Cerca se il prodotto esiste già nel carrello (solo per ID specifico)
      const existingIndex = items.findIndex((item) => item.id === product.id);
      
      // Debug: verifica se ci sono altri prodotti con lo stesso ID (non dovrebbe succedere)
      const duplicateIds = items.filter((item) => item.id === product.id);
      if (duplicateIds.length > 1) {
        // Keep first occurrence; we will deduplicate later.
      }

      // Converti prezzo da stringa a numero se necessario
      let price = 0;
      if (typeof product.price === "number") {
        price = product.price;
      } else if (typeof product.price === "string") {
        const rawPrice = product.price.trim();
        // Estrai numero da stringhe come "$", "$$", "$$$" o numeri
        if (rawPrice === "$") {
          price = 25; // Default per $
        } else if (rawPrice === "$$") {
          price = 75; // Default per $$
        } else if (rawPrice === "$$$") {
          price = 150; // Default per $$$
        } else {
          let normalized = rawPrice;
          if (normalized.includes(",")) {
            if (normalized.includes(".")) {
              normalized = normalized.replace(/\./g, "").replace(",", ".");
            } else {
              normalized = normalized.replace(",", ".");
            }
          }
          const numeric = normalized.replace(/[^0-9.-]/g, "");
          price = parseFloat(numeric) || 0;
        }
      }

      const imageUrl = product.image || product.thumbnail || "";

      if (existingIndex >= 0) {
        // Prodotto già presente: incrementa quantità di 1
        const current = items[existingIndex];
        items[existingIndex] = {
          ...current,
          quantity: (current.quantity ?? 0) + 1,
        };
      } else {
        // Nuovo prodotto: aggiungi SOLO questo prodotto al carrello
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          price: price,
          description: product.description || "",
          quantity: 1,
          image: imageUrl,
        };
        items.push(newItem);
      }

      // Verifica finale: assicurati che non ci siano duplicati
      const finalItemIds = items.map((item) => item.id);
      const uniqueIds = new Set(finalItemIds);
      if (finalItemIds.length !== uniqueIds.size) {
        // Rimuovi duplicati, mantieni solo il primo
        const seen = new Set<string>();
        const deduplicatedItems = items.filter((item) => {
          if (seen.has(item.id)) {
            return false;
          }
          seen.add(item.id);
          return true;
        });
        const newState = { ...baseState, items: deduplicatedItems };
        return newState;
      }

      const newState = { ...baseState, items };
      return newState;
    });
  }

  /**
   * Rimuove un prodotto dal carrello o ne decrementa la quantità
   */
  function removeFromCart(productId: string) {
    setCartState((prevState) => {
      const baseState: CartWidgetState = prevState ?? createDefaultCartState();
      const items = Array.isArray(baseState.items)
        ? baseState.items.map((item) => ({ ...item }))
        : [];

      const index = items.findIndex((item) => item.id === productId);
      if (index >= 0) {
        const current = items[index];
        const newQuantity = (current.quantity ?? 0) - 1;
        if (newQuantity <= 0) {
          items.splice(index, 1);
        } else {
          items[index] = { ...current, quantity: newQuantity };
        }
      }

      const newState = { ...baseState, items };
      return newState;
    });
  }

  function clearCart() {
    setCartState(createDefaultCartState());
  }

  /**
   * Verifica se un prodotto è già nel carrello
   */
  function isInCart(productId: string): boolean {
    return cartItems.some((item) => item.id === productId);
  }

  return {
    cartItems,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
  };
}
