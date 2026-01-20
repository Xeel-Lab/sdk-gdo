from __future__ import annotations

"""GDO demo MCP server implemented with the Python FastMCP helper.

The server exposes widget-backed tools that render the GDO UI bundle.
Each handler returns the HTML shell via an MCP resource and echoes structured
content so the ChatGPT client can hydrate the widget. The module also wires the
handlers into an HTTP/SSE stack so you can run the server with uvicorn on port
8000, matching the Node transport behavior.

Version: 1.0.0
MCP Protocol Version: 2024-11-05
"""

__version__ = "1.0.0"

import os
import json
import uuid
import logging
import duckdb
import re
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP

# Carica il file .env dalla root del progetto (non dalla directory gdo_server_python)
# __file__ è main.py in gdo_server_python/, quindi parent.parent è la root
# Prova anche nella directory corrente come fallback
env_paths = [
    Path(__file__).resolve().parent.parent / ".env",  # Root del progetto
    Path.cwd() / ".env",  # Directory corrente
    Path(__file__).resolve().parent / ".env",  # Directory gdo_server_python (fallback)
]

env_path = None
for path in env_paths:
    if path.exists():
        env_path = path
        load_dotenv(dotenv_path=env_path)
        break

if not env_path:
    # Prova comunque a caricare dalla directory corrente o dalle variabili d'ambiente di sistema
    load_dotenv()

# Configurazione logging per activity logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Log info sul caricamento del file .env (dopo che logger è stato configurato)
if env_path:
    logger.info(f"Loaded .env file from: {env_path}")
    # Verifica se MOTHERDUCK_TOKEN è presente dopo il caricamento
    token_after_load = os.getenv("MOTHERDUCK_TOKEN")
    if token_after_load:
        logger.info("MOTHERDUCK_TOKEN found in .env file")
    else:
        logger.warning("MOTHERDUCK_TOKEN not found in .env file after loading. Check that it exists in the file.")
else:
    logger.warning(f".env file not found in any of the searched paths. Environment variables will be read from system environment.")
    logger.warning(f"Searched paths: {env_paths}")

from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

import mcp.types as types
import uvicorn
from fastapi import Request, FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from mcp.server.fastmcp import FastMCP
from starlette.staticfiles import StaticFiles
from starlette.routing import Mount, Route
from starlette.responses import HTMLResponse as StarletteHTMLResponse, Response
from starlette.types import ASGIApp, Scope, Receive, Send
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, ValidationError
import httpx
import stripe
from urllib.parse import urlparse, urlencode


stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()

# Demo map: SPT -> Stripe PaymentMethod id
DEMO_SPT_TO_PM = {
    "test_spt_visa": "pm_card_visa",
    "test_spt_3ds2": "pm_card_authenticationRequired",
}


def resolve_payment_method_from_spt(shared_payment_token: str | None) -> str | None:
    if not shared_payment_token:
        return None
    return DEMO_SPT_TO_PM.get(shared_payment_token)


def create_payment_intent(
    amount_minor: int,
    currency: str,
    buyer_email: str,
    shared_payment_token: str | None,
    metadata: dict | None = None,
):
    """
    Crea un PaymentIntent limitato a 'card' per evitare metodi redirect (niente return_url richiesto).
    Se è presente uno SPT demo, lo mappa a un PaymentMethod test di Stripe.
    """
    pm = resolve_payment_method_from_spt(shared_payment_token)

    kwargs = dict(
        amount=amount_minor,
        currency=currency,
        receipt_email=buyer_email,
        capture_method="automatic",
        metadata=metadata or {},
        confirm=False,
        # Evita metodi redirect: mantieni soltanto carte
        payment_method_types=["card"],
    )
    if pm:
        kwargs["payment_method"] = pm

    pi = stripe.PaymentIntent.create(**kwargs)
    return pi


def confirm_payment_intent(payment_intent_id: str):
    """
    Conferma il PI. Se manca un payment_method (nessuno SPT passato in create),
    usa come fallback la carta test 'pm_card_visa' per la demo.
    """
    pi_obj = stripe.PaymentIntent.retrieve(payment_intent_id)
    if not pi_obj.get("payment_method"):
        # Fallback demo per flusso 'happy path'
        pi = stripe.PaymentIntent.confirm(payment_intent_id, payment_method="pm_card_visa")
    else:
        pi = stripe.PaymentIntent.confirm(payment_intent_id)
    return pi


@dataclass(frozen=True)
class GdoWidget:
    identifier: str
    title: str
    template_uri: str
    invoking: str
    invoked: str
    html: str
    response_text: str


ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"

def get_motherduck_connection():
    """
    Crea e restituisce una connessione DuckDB al database MotherDuck.
    
    Returns:
        duckdb.DuckDBPyConnection: Connessione al database MotherDuck.
        
    Raises:
        ValueError: Se MOTHERDUCK_TOKEN non è configurato come variabile d'ambiente.
    """
    md_token = os.getenv("MOTHERDUCK_TOKEN")
    if not md_token:
        raise ValueError(
            "MOTHERDUCK_TOKEN non trovato nelle variabili d'ambiente. "
            "Configurare MOTHERDUCK_TOKEN per connettersi a MotherDuck."
        )
    
    # Connessione a MotherDuck usando il formato md:database_name?motherduck_token=TOKEN
    # Il database è 'app_gpt_gdo'
    connection_string = f"md:app_gpt_gdo?motherduck_token={md_token}"
    con = duckdb.connect(connection_string)
    
    # Imposta lo schema di ricerca su 'main' per semplificare le query
    con.execute("SET search_path TO main;")
    
    return con


# Mapping delle categorie principali agli URL immagini
CATEGORY_IMAGE_URLS = {
    "Ortofrutta": "https://picjumbo.com/fresh-colorful-fruits-and-vegetables/",
    "Carne e pollame": "https://www.bigstockphoto.com/image-398974238/stock-photo-fresh-raw-chicken-meat-and-chicken-parts-black-background-top-view",
    "Pesce e prodotti ittici": "https://www.vectorstock.com/royalty-free-vector/seafood-vector-5372182",
    "Salumi e affettati": "https://millennialmagazine.com/2025/02/27/italian-cold-cuts/",
    "Latticini e uova": "https://www.freeimages.com/premium/dairy-products-and-eggs-isolated-on-white-651700",
    "Panetteria e prodotti da forno": "https://www.publicdomainpictures.net/en/view-image.php?image=534534&picture=various-fresh-bread",
    "Pasta, riso e cereali": "https://www.colourbox.com/image/dried-pasta-rice-image-16237250",
    "Gastronomia pronta": "https://depositphotos.com/photo/388240657/stock-photo-variety-of-ready-meals-in-trays.html",
    "Surgelati": "https://depositphotos.com/photo/415375170/assortment-of-frozen-vegetables-on-ice.html",
    "Dispensa / grocery secco": "https://biritegrocery.com/products/dry-goods/",
    "Dolci e snack": "https://www.freeimages.com/photo/sweets-1329905",
    "Bevande": "https://www.bigstockphoto.com/image-195711415/stock-photo-bottles-of-assorted-global-soft-drinks",
    "Alimentazione vegetale / plant-based": "https://foodinsight.org/what-does-eating-a-plant-based-diet-mean/",
    "Integratori e benessere alimentare": "https://www.bigstockphoto.com/image-327606634/stock-photo-nutritional-supplement-and-vitamin-supplements-as-a-capsule-with-fruit-vegetables-nuts-and-beans-ins",
}

PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/400x300?text=Product+Image"

# Mapping delle categorie principali ai tag associati (stesso mapping del frontend)
CATEGORY_MAPPING = {
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
    "Salumi e affettati": [
        "salumi", "affettati", "prosciutto crudo", "prosciutto cotto",
        "salami", "bresaola", "mortadella", "speck", "pancetta",
        "coppa", "capocollo", "salame", "wurstel"
    ],
    "Latticini e uova": [
        "latticini", "uova", "latte", "yogurt", "fermentati", "formaggi freschi",
        "formaggi stagionati", "burro", "panna", "ricotta", "mozzarella",
        "parmigiano", "grana", "pecorino", "gorgonzola", "formaggio"
    ],
    "Panetteria e prodotti da forno": [
        "panetteria", "prodotti da forno", "pane fresco", "pane confezionato",
        "focacce", "piadine", "prodotti da forno dolci", "brioche", "cornetti",
        "pizza", "pane", "grissini", "crackers"
    ],
    "Pasta, riso e cereali": [
        "pasta", "riso", "cereali", "pasta secca", "pasta fresca",
        "cereali secchi", "legumi secchi", "spaghetti", "penne", "fusilli",
        "riso integrale", "riso basmati", "farro", "orzo", "quinoa",
        "lenticchie", "ceci", "fagioli"
    ],
    "Gastronomia pronta": [
        "gastronomia", "gastronomia pronta", "piatti pronti freschi",
        "insalate pronte", "preparazioni gastronomiche", "pranzo pronto",
        "cena pronta", "contorni pronti", "antipasti pronti"
    ],
    "Surgelati": [
        "surgelati", "verdur surgelate", "pesce surgelato", "carne surgelata",
        "piatti pronti surgelati", "gelati", "gelato", "verdura surgelata",
        "patate surgelate", "spinaci surgelati", "piselli surgelati"
    ],
    "Dispensa / grocery secco": [
        "dispensa", "grocery", "grocery secco", "conserve", "sughi", "salse",
        "oli", "condimenti", "spezie", "aromi", "olio", "aceto", "sale",
        "pepe", "pomodori pelati", "passata", "sugo", "pesto"
    ],
    "Dolci e snack": [
        "dolci", "snack", "biscotti", "merendine", "cioccolato",
        "snack dolci", "snack salati", "patatine", "popcorn", "crackers",
        "torte", "dolci confezionati", "caramelle", "cioccolatini"
    ],
    "Bevande": [
        "bevande", "acqua", "bibite", "succhi", "bevande vegetali",
        "birra", "vino", "acqua minerale", "acqua frizzante", "coca cola",
        "aranciata", "limonata", "the", "caffè", "latte"
    ],
    "Alimentazione vegetale / plant-based": [
        "vegetale", "plant-based", "carne vegetale", "affettati vegetali",
        "latticini vegetali", "tofu", "seitan", "tempeh", "hamburger vegetale",
        "salsicce vegetali", "beyond meat", "impossible", "vegano"
    ],
    "Integratori e benessere alimentare": [
        "integratori", "benessere alimentare", "integratori vitaminici",
        "proteine", "sport", "alimenti funzionali", "vitamine", "minerali",
        "omega 3", "probiotici", "proteine in polvere"
    ],
}


def _get_primary_category(product: Dict[str, Any]) -> str | None:
    """
    Determina la categoria principale di un prodotto basandosi sui tag/categorie.
    
    Returns:
        Nome della categoria principale o None se non trovata
    """
    categories_raw = _extract_product_categories(product)
    if not categories_raw:
        return None
    
    normalized_categories = _normalize_text(" ".join(categories_raw))
    best_category = None
    best_score = 0
    
    for category, category_tags in CATEGORY_MAPPING.items():
        score = sum(1 for tag in category_tags if tag in normalized_categories)
        if score > best_score:
            best_score = score
            best_category = category
    
    return best_category if best_score > 0 else None


def _get_product_image_url(product: Dict[str, Any]) -> str:
    """
    Restituisce l'URL immagine per un prodotto basato sulla sua categoria.
    
    Returns:
        URL immagine della categoria o placeholder se categoria non trovata
    """
    category = _get_primary_category(product)
    if category and category in CATEGORY_IMAGE_URLS:
        return CATEGORY_IMAGE_URLS[category]
    return PLACEHOLDER_IMAGE_URL


def filter_products_by_category(products: List[Dict[str, Any]], category: str) -> List[Dict[str, Any]]:
    """
    Filtra i prodotti per categoria basandosi sui tag/categorie nel database.
    
    Logica semplificata: cerca se uno dei tag della categoria è contenuto in una delle
    categorie del prodotto (match parziale case-insensitive).
    
    Args:
        products: Lista di prodotti dal database
        category: Nome della categoria (es. "Ortofrutta", "Carne e pollame", "Pesce e prodotti ittici")
                  o tag specifico (es. "carne", "pesce", "latticini")
    
    Returns:
        Lista filtrata di prodotti che appartengono alla categoria specificata
    """
    if not products or not category:
        return products
    
    # Normalizza la categoria richiesta (case-insensitive)
    category_lower = category.lower().strip()
    
    # Trova i tag da cercare nel mapping
    search_tags = []
    matched_main_category = None
    
    # Cerca se la categoria richiesta corrisponde a una categoria principale o a un tag
    for main_category, tags in CATEGORY_MAPPING.items():
        if category_lower == main_category.lower():
            # La categoria richiesta è una categoria principale - usa tutti i tag
            search_tags = [t.lower().strip() for t in tags]
            matched_main_category = main_category
            break
        elif category_lower in [t.lower() for t in tags]:
            # La categoria richiesta è uno dei tag di una categoria principale
            # Usa tutti i tag della categoria principale
            matched_main_category = main_category
            search_tags = [t.lower().strip() for t in tags]
            # Aggiungi sempre il tag richiesto stesso
            if category_lower not in search_tags:
                search_tags.append(category_lower)
            break
    
    # Se non trovata nel mapping, usa la categoria stessa come tag da cercare
    if not search_tags:
        search_tags = [category_lower]
        logger.info(f"Category '{category}' not in mapping, using as direct search tag")
    else:
        logger.info(f"Category '{category}' matched to '{matched_main_category}', searching for tags: {search_tags[:5]}...")
    
    filtered_products = []
    products_without_categories = 0
    
    for product in products:
        # Estrai tutte le categorie/tag del prodotto (da categories)
        product_categories_raw = []
        
        # Usa categories (stringa separata da virgole)
        if product.get("categories"):
            if isinstance(product["categories"], list):
                product_categories_raw.extend([str(cat).strip() for cat in product["categories"] if cat])
            elif isinstance(product["categories"], str):
                product_categories_raw.extend([cat.strip() for cat in product["categories"].split(",") if cat.strip()])
        
        # Normalizza le categorie del prodotto (lowercase)
        product_categories = [cat.lower().strip() for cat in product_categories_raw if cat]
        
        # Se il prodotto non ha categorie, salta
        if not product_categories:
            products_without_categories += 1
            continue
        
        # Verifica se almeno uno dei tag da cercare matcha con una categoria del prodotto
        # Match semplice: controlla se il tag è contenuto nella categoria (o viceversa per tag lunghi)
        matches = False
        
        for search_tag in search_tags:
            search_tag_clean = search_tag.lower().strip()
            
            for product_cat in product_categories:
                product_cat_clean = product_cat.lower().strip()
                
                # Match esatto
                if search_tag_clean == product_cat_clean:
                    matches = True
                    break
                
                # Match parziale: il tag è contenuto nella categoria del prodotto
                # Es: "carne" matcha "carne bovina", "carne macinata", ecc.
                if search_tag_clean in product_cat_clean:
                    matches = True
                    break
                
                # Match parziale inverso: la categoria è contenuta nel tag (per tag composti)
                # Es: "pesce fresco" contiene "pesce" quando cerchiamo "pesce"
                if len(search_tag_clean) > 3 and product_cat_clean in search_tag_clean:
                    matches = True
                    break
            
            if matches:
                break
        
        if matches:
            filtered_products.append(product)
    
    # Log risultati
    if filtered_products:
        sample_names = [p.get("description", "Unknown")[:30] for p in filtered_products[:5]]
        logger.info(
            f"✅ Filter matched {len(filtered_products)}/{len(products)} products for category '{category}'. "
            f"Sample products: {sample_names}. "
            f"Showing only filtered products (no unrelated products will be added)."
        )
    else:
        logger.warning(
            f"❌ Filter found 0 products for category '{category}'. "
            f"Total products: {len(products)}, Products without categories: {products_without_categories}. "
            f"Search tags: {search_tags[:5]}. "
            f"IMPORTANT: Will return empty list instead of adding unrelated products."
        )
        # Log esempi di categorie reali per debugging
        if products:
            all_categories = set()
            for product in products[:10]:
                cats = []
                if product.get("categories"):
                    if isinstance(product["categories"], list):
                        cats = [str(c).strip().lower() for c in product["categories"]]
                    elif isinstance(product["categories"], str):
                        cats = [c.strip().lower() for c in product["categories"].split(",")]
                all_categories.update(cats)
            
            logger.warning(f"Sample categories in database: {sorted(list(all_categories))[:15]}")
    
    return filtered_products


def rank_products_by_criteria(
    products: List[Dict[str, Any]], 
    criteria: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Ordina i prodotti basandosi sui criteri di ricerca del cliente.
    
    La funzione ordina i prodotti in modo che:
    1. Corrispondenze esatte vengano per prime (es. 45 pollici se richiesto)
    2. Prodotti simili vengano dopo (es. 50 pollici con prezzo simile)
    3. Altri prodotti vengano alla fine
    
    Args:
        products: Lista di prodotti da ordinare
        criteria: Dizionario con criteri di ricerca opzionali:
            - size_inches: Dimensione richiesta in pollici (es. 45, 50)
            - max_price: Prezzo massimo desiderato
            - min_price: Prezzo minimo desiderato
            - target_price: Prezzo target (per trovare prodotti con prezzo simile)
            - keywords: Lista di parole chiave da cercare nel campo description (contiene ingredienti esatti)
    
    Returns:
        Lista di prodotti ordinata per rilevanza rispetto ai criteri
    """
    if not products or not criteria:
        return products
    
    def extract_size_from_name(name: str) -> int | None:
        """Estrae la dimensione in pollici dal nome del prodotto."""
        if not name:
            return None
        # Cerca pattern come "45 inch", "45\"", "45 pollici", "45in", "45-inch"
        patterns = [
            r'(\d+)\s*(?:inch|pollici|"|in)(?:es)?',
            r'(\d+)[\s-]*(?:inch|pollici|"|in)',
            r'(\d+)\s*(?:inch|pollici)',
        ]
        for pattern in patterns:
            match = re.search(pattern, name, re.IGNORECASE)
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    continue
        return None
    
    def get_price(product: Dict[str, Any]) -> float:
        """Estrae il prezzo dal prodotto. Il prezzo è una stringa che può contenere /kg."""
        price_str = product.get("price", "")
        if not isinstance(price_str, str):
            price_str = str(price_str) if price_str else ""
        
        # Rimuovi /kg e altri suffissi, poi estrai il numero
        price_clean = price_str.replace("/kg", "").replace("€", "").replace(",", ".").strip()
        try:
            # Prova a estrarre il primo numero dalla stringa
            match = re.search(r'(\d+\.?\d*)', price_clean)
            if match:
                return float(match.group(1))
        except (ValueError, AttributeError):
            pass
        return 0.0
    
    def calculate_relevance_score(product: Dict[str, Any]) -> tuple:
        """
        Calcola uno score di rilevanza per il prodotto.
        Restituisce una tupla (score, ...) per ordinamento stabile.
        Score più basso = più rilevante (viene prima).
        """
        score = 1000  # Score base (bassa priorità)
        
        # 1. Corrispondenza esatta per dimensione (priorità massima)
        target_size = criteria.get("size_inches")
        if target_size:
            product_size = extract_size_from_name(product.get("description", ""))
            if product_size:
                size_diff = abs(product_size - target_size)
                if size_diff == 0:
                    # Corrispondenza esatta: score molto basso
                    score = 0
                elif size_diff <= 5:
                    # Dimensione simile (entro 5 pollici): score basso
                    score = 10 + size_diff
                else:
                    # Dimensione molto diversa: score alto
                    score = 50 + size_diff
        
        # 2. Corrispondenza per prezzo target (priorità alta)
        target_price = criteria.get("target_price")
        if target_price:
            product_price = get_price(product)
            if product_price > 0:
                price_diff = abs(product_price - target_price)
                price_diff_percent = (price_diff / target_price) * 100 if target_price > 0 else 100
                # Se c'è già uno score per dimensione, aggiungi solo un piccolo bonus
                # Altrimenti, usa il prezzo come criterio principale
                if score >= 1000:
                    # Nessuna corrispondenza dimensione, usa prezzo come criterio principale
                    if price_diff_percent <= 10:
                        score = 20  # Prezzo molto simile (entro 10%)
                    elif price_diff_percent <= 25:
                        score = 30  # Prezzo simile (entro 25%)
                    else:
                        score = 40 + price_diff_percent
                else:
                    # C'è già uno score per dimensione, aggiungi bonus per prezzo simile
                    if price_diff_percent <= 25:
                        score += 1  # Bonus per prezzo simile
        
        # 3. Filtri prezzo min/max
        max_price = criteria.get("max_price")
        min_price = criteria.get("min_price")
        product_price = get_price(product)
        if max_price and product_price > max_price:
            score += 100  # Penalità se supera il prezzo massimo
        if min_price and product_price < min_price:
            score += 50  # Piccola penalità se sotto il prezzo minimo
        
        # 4. Corrispondenza per parole chiave
        keywords = criteria.get("keywords", [])
        if keywords:
            desc_lower = (product.get("description", "") or "").lower()
            matched_keywords = sum(1 for kw in keywords if kw.lower() in desc_lower)
            if matched_keywords > 0:
                # Bonus per corrispondenza keyword (riduce lo score)
                score = max(0, score - (matched_keywords * 5))
        
        # Restituisci tupla per ordinamento stabile (score, prezzo, nome)
        return (score, -get_price(product), product.get("description", ""))
    
    # Ordina i prodotti per rilevanza
    sorted_products = sorted(products, key=calculate_relevance_score)
    
    return sorted_products


async def get_products_from_motherduck(category: str = None):
    """
    Recupera i prodotti alimentari dal database MotherDuck, opzionalmente filtrati per categoria.
    
    Args:
        category: Categoria opzionale per filtrare i prodotti (es. "Ortofrutta", "Carne e pollame", "Pesce e prodotti ittici")
    
    Returns:
        List[Dict[str, Any]]: Lista di prodotti come dizionari Python.
        Ritorna lista vuota in caso di errore.
    """
    try:
        logger.info("Connecting to MotherDuck database")
        with get_motherduck_connection() as con:
            # Query per recuperare tutti i prodotti dalla tabella products_xeel_shop
            # La tabella è nello schema 'main' (impostato in get_motherduck_connection)
            # Database: app_gpt_gdo.main.products_xeel_shop
            # Colonne: ID, company, description, price, categories
            query = "SELECT ID, company, description, price, categories FROM products_xeel_shop"
            logger.debug(f"Executing query: {query}")
            products_df = con.execute(query).fetchdf()
            
            # Converti DataFrame in lista di dizionari per compatibilità JSON
            products = products_df.to_dict(orient="records")
            
            # Filtra per categoria se specificata
            if category:
                original_count = len(products)
                logger.info(f"🔍 Applying category filter '{category}' to {original_count} products")
                products = filter_products_by_category(products, category)
                filtered_count = len(products)
                logger.info(f"✅ Filter result: {filtered_count}/{original_count} products match category '{category}'")
                
                if filtered_count == 0 and original_count > 0:
                    logger.warning(
                        f"⚠️ No products found for category '{category}'. "
                        f"Total products available: {original_count}. "
                        f"Check filter logic and category mapping."
                    )
                elif filtered_count == original_count:
                    logger.warning(
                        f"⚠️ Filter returned all products ({filtered_count}). "
                        f"This might indicate the filter is not working correctly."
                    )
            
            # Log per audit
            if products:
                logger.info(f"Retrieved {len(products)} products from MotherDuck" + (f" (filtered by category: {category})" if category else ""))
            else:
                logger.warning("No products retrieved from MotherDuck (empty result)" + (f" for category: {category}" if category else ""))
            
            return products
    except ValueError as e:
        # Errore di configurazione (es. MOTHERDUCK_TOKEN mancante)
        logger.warning(
            f"MotherDuck token not configured: {e}. "
            "Widgets will display empty data until MOTHERDUCK_TOKEN is configured."
        )
        return []
    except Exception as e:
        # Altri errori (es. connessione, query, ecc.)
        logger.error(f"Error retrieving products from MotherDuck: {e}", exc_info=True)
        return []


def transform_products_to_places(
    products: List[Dict[str, Any]], 
    criteria: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Trasforma prodotti dal database MotherDuck in formato 'places' per i widget UI.
    
    I widget carousel/map/list/albums si aspettano una struttura 'places' con:
    - id, name, coords (lat, lon), description, city, price (stringa), thumbnail
    
    I prodotti dal database app_gpt_gdo.main.products_xeel_shop hanno:
    - ID, company, description, price, categories
    
    Questa funzione mappa i campi dal database e genera valori default per campi mancanti 
    (coords, city - generati automaticamente).
    
    I prodotti vengono ordinati in base ai criteri specificati (dimensioni, prezzo, ecc.)
    per mostrare prima le corrispondenze esatte e poi i prodotti simili.
    
    Mapping colonne DB -> places:
    - ID -> id
    - description -> name
    - price -> price (già stringa, può contenere /kg)
    - categories -> (usato per filtri)
    - thumbnail -> placeholder vuoto
    - coords, city -> generati automaticamente (default San Francisco)
    
    Args:
        products: Lista di prodotti dal database (dizionari Python)
        criteria: Dizionario opzionale con criteri di ordinamento (size_inches, target_price, ecc.)
    
    Returns:
        Lista di 'places' nel formato atteso dai widget, ordinata per rilevanza
    """
    if not products:
        return []
    
    # Ordina i prodotti in base ai criteri prima di trasformarli
    if criteria:
        products = rank_products_by_criteria(products, criteria)
    
    # Coordinate di default per San Francisco (dove sono i place attuali in markers.json)
    # Distribuite in diverse zone della città per varietà visiva
    default_coords = [
        [-122.4098, 37.8001],  # North Beach
        [-122.4093, 37.7990],  # North Beach
        [-122.4255, 37.7613],  # Mission
        [-122.4388, 37.7775],  # Alamo Square
        [-122.4077, 37.7990],  # North Beach
        [-122.4097, 37.7992],  # North Beach
        [-122.4380, 37.7722],  # Lower Haight
        [-122.4123, 37.7899],  # Nob Hill
        [-122.4135, 37.7805],  # SoMa
        [-122.4019, 37.7818],  # Yerba Buena
        [-122.4194, 37.7749],  # Mission
        [-122.4313, 37.7849],  # Western Addition
    ]
    
    # Città di default
    default_cities = [
        "San Francisco",
        "North Beach",
        "Mission",
        "Alamo Square",
        "SoMa",
        "Nob Hill",
        "Lower Haight",
        "Yerba Buena",
    ]
    
    places = []
    seen_ids = set()  # Traccia gli ID già visti per evitare duplicati
    
    for idx, product in enumerate(products):
        # Ottieni l'ID del prodotto - assicurati che sia univoco
        product_id = product.get("ID") or product.get("id")
        if not product_id:
            # Se non c'è ID, genera uno basato sull'indice
            product_id = f"product-{idx}"
        else:
            # Converti ID in stringa e assicurati che sia univoco
            product_id = str(product_id).strip()
            if not product_id:
                product_id = f"product-{idx}"
        
        # Se l'ID è già stato visto, aggiungi un suffisso per renderlo univoco
        original_id = product_id
        counter = 0
        while product_id in seen_ids:
            counter += 1
            product_id = f"{original_id}-{counter}"
        
        seen_ids.add(product_id)
        
        # Se abbiamo dovuto modificare l'ID, logga un warning
        if product_id != original_id:
            logger.warning(
                f"Duplicate product ID detected: '{original_id}'. "
                f"Using unique ID: '{product_id}' for product '{product.get('description', 'Unknown')}'"
            )
        
        # Ottieni il prezzo dalla colonna price (già stringa, può contenere /kg)
        price_str = product.get("price", "")
        if not isinstance(price_str, str):
            price_str = str(price_str) if price_str else ""
        
        # Genera coordinate usando pattern circolare sulle coordinate default
        coords = default_coords[idx % len(default_coords)]
        
        # Genera città usando pattern circolare
        city = default_cities[idx % len(default_cities)]
        
        # Mappa i campi usando i nomi colonne corretti del database
        # IMPORTANTE: Usa product_id (garantito univoco) invece di product.get("ID")
        place = {
            "id": product_id,  # Usa l'ID univoco garantito
            "name": product.get("description", "Unknown Product"),  # Usa description come name
            "coords": coords,
            "description": product.get("description", ""),  # Usa description dal DB
            "city": city,
            "price": price_str,  # Prezzo già stringa, può contenere /kg
            "thumbnail": _get_product_image_url(product),  # URL immagine basato su categoria
        }
        
        places.append(place)
    
    return places


def transform_products_to_albums(
    products: List[Dict[str, Any]], 
    criteria: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Trasforma prodotti dal database MotherDuck in formato 'albums' per il widget albums.
    
    Il widget albums si aspetta una struttura con:
    - albums array
      - id, title, cover
      - photos array con id, title, url
    
    Strategia: Raggruppa prodotti per categoria (categories).
    I prodotti dal database app_gpt_gdo.main.products_xeel_shop hanno:
    - categories (stringa separata da virgole)
    - description per il titolo
    
    I prodotti vengono ordinati in base ai criteri specificati prima di essere raggruppati,
    in modo che all'interno di ogni album i prodotti più rilevanti vengano mostrati per primi.
    
    Args:
        products: Lista di prodotti dal database (dizionari Python)
        criteria: Dizionario opzionale con criteri di ordinamento (size_inches, target_price, ecc.)
    
    Returns:
        Lista di 'albums' nel formato atteso dal widget albums, con prodotti ordinati per rilevanza
    """
    if not products:
        return []
    
    # Ordina i prodotti in base ai criteri prima di raggrupparli
    if criteria:
        products = rank_products_by_criteria(products, criteria)
    
    # Raggruppa prodotti per tag principale (primo tag più comune)
    # Oppure crea album tematici
    albums_map = {}
    
    for product in products:
        # Usa categories dal database (stringa separata da virgole)
        categories = []
        if product.get("categories"):
            if isinstance(product["categories"], list):
                categories = [str(cat).strip() for cat in product["categories"] if cat]
            elif isinstance(product["categories"], str):
                categories = [cat.strip() for cat in product["categories"].split(",") if cat.strip()]
        
        # Usa la prima categoria come categoria principale, o "General" se non ci sono
        category = categories[0] if categories else "General GDO"
        
        # Normalizza il nome della categoria per l'id dell'album
        album_id = category.lower().replace(" ", "-").replace("&", "and")[:30]
        
        if album_id not in albums_map:
            albums_map[album_id] = {
                "id": album_id,
                "title": category,
                "cover": "",  # Placeholder vuoto per immagini
                "photos": [],
            }
        
        # Aggiungi prodotto come photo nell'album
        product_id = product.get("ID") or product.get("id")
        photo = {
            "id": str(product_id) if product_id else f"photo-{len(albums_map[album_id]['photos'])}",
            "title": product.get("description", "Product"),
            "url": "",  # Placeholder vuoto per immagini
        }
        
        albums_map[album_id]["photos"].append(photo)
    
    # Se non ci sono album creati (nessun tag), crea un album unico con tutti i prodotti
    if not albums_map:
        albums_map["all-products"] = {
            "id": "all-products",
            "title": "All Products",
            "cover": "",
            "photos": [],
        }
        
        for product in products:
            product_id = product.get("ID") or product.get("id")
            photo = {
                "id": str(product_id) if product_id else f"photo-{len(albums_map['all-products']['photos'])}",
                "title": product.get("description", "Product"),
                "url": "",
            }
            albums_map["all-products"]["photos"].append(photo)
    
    # Converti dict in lista e limita a massimo 4 album
    albums = list(albums_map.values())[:4]
    
    return albums


@lru_cache(maxsize=None)
def _load_widget_html(component_name: str) -> str:
    html_path = ASSETS_DIR / f"{component_name}.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf8")

    fallback_candidates = sorted(ASSETS_DIR.glob(f"{component_name}-*.html"))
    if fallback_candidates:
        return fallback_candidates[-1].read_text(encoding="utf8")

    raise FileNotFoundError(
        f'Widget HTML for "{component_name}" not found in {ASSETS_DIR}. '
        "Run `pnpm run build` to generate the assets before starting the server."
    )


widgets: List[GdoWidget] = [
    GdoWidget(
        identifier="gdo-map",
        title="Show GDO Map",
        template_uri="ui://widget/gdo-map.html",
        invoking="Loading GDO map",
        invoked="GDO map loaded",
        html=_load_widget_html("gdo"),
        response_text="Rendered a GDO map!",
    ),
    GdoWidget(
        identifier="gdo-carousel",
        title="Show GDO Carousel",
        template_uri="ui://widget/gdo-carousel.html",
        invoking="Loading GDO carousel",
        invoked="GDO carousel loaded",
        html=_load_widget_html("gdo-carousel"),
        response_text="Rendered a GDO carousel!",
    ),
    GdoWidget(
        identifier="gdo-albums",
        title="Show GDO Album",
        template_uri="ui://widget/gdo-albums.html",
        invoking="Loading GDO album",
        invoked="GDO album loaded",
        html=_load_widget_html("gdo-albums"),
        response_text="Rendered a GDO album!",
    ),
    GdoWidget(
        identifier="gdo-list",
        title="Show GDO List",
        template_uri="ui://widget/gdo-list.html",
        invoking="Loading GDO list",
        invoked="GDO list loaded",
        html=_load_widget_html("gdo-list"),
        response_text="Rendered a GDO list!",
    ),
    GdoWidget(
        identifier="gdo-shop",
        title="Open GDO Shop",
        template_uri="ui://widget/gdo-shop.html",
        invoking="Opening the GDO shop",
        invoked="GDO shop opened",
        html=_load_widget_html("gdo-shop"),
        response_text="Rendered the GDO shop!",
    ),
    GdoWidget(
        identifier="product-list",
        title="List Products from MotherDuck",
        template_uri="ui://widget/product-list.html",
        invoking="Fetching products",
        invoked="Fetched products from MotherDuck",
        html="<p>Product list is being rendered...</p>",
        response_text="Here are the products from MotherDuck!",
    ),
    GdoWidget(
        identifier="shopping-cart",
        title="Show Shopping Cart",
        template_uri="ui://widget/shopping-cart.html",
        invoking="Loading shopping cart",
        invoked="Shopping cart loaded",
        html=_load_widget_html("shopping-cart"),
        response_text="Here is your shopping cart!",
    ),
]

MIME_TYPE = "text/html+skybridge"


WIDGETS_BY_ID: Dict[str, GdoWidget] = {
    widget.identifier: widget for widget in widgets
}
WIDGETS_BY_URI: Dict[str, GdoWidget] = {
    widget.template_uri: widget for widget in widgets
}


# Note: GdoInput removed - most widgets don't require input parameters
# If needed in the future, create GdoInput with appropriate fields


def _split_env_list(value: str | None) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _transport_security_settings() -> TransportSecuritySettings:
    allowed_hosts = _split_env_list(os.getenv("MCP_ALLOWED_HOSTS"))
    allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
    if not allowed_hosts and not allowed_origins:
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=allowed_hosts,
        allowed_origins=allowed_origins,
    )


class SSEBypassMiddleware:
    """
    Middleware ASGI personalizzato per bypassare completamente le richieste SSE/messages.
    Questo middleware deve essere il primo per evitare che BaseHTTPMiddleware processi
    il body delle risposte SSE, che hanno un formato ASGI particolare.
    """
    
    def __init__(self, app: ASGIApp):
        self.app = app
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path = scope.get("path", "")
            if (
                path.startswith("/mcp")
                or path == "/sse"
                or path.startswith("/messages")
            ):
                await self.app(scope, receive, send)
                return
        
        await self.app(scope, receive, send)


class CORSMiddleware:
    """
    Middleware ASGI nativo per aggiungere CORS (Cross-Origin Resource Sharing) headers alle risposte HTTP.
    
    Permette al browser di caricare risorse (JS, CSS) da origini diverse, necessario
    quando il widget viene caricato da ChatGPT che ha un'origine diversa dal server.
    """
    
    def __init__(self, app: ASGIApp):
        self.app = app
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        path = scope.get("path", "")
        
        # Per risposte SSE, passa direttamente senza modificare headers
        if path.startswith("/mcp") or path == "/sse" or path.startswith("/messages"):
            await self.app(scope, receive, send)
            return
        
        # Gestisci richieste OPTIONS (preflight)
        if scope["method"] == "OPTIONS":
            origin = None
            for header_name, header_value in scope.get("headers", []):
                if header_name == b"origin":
                    origin = header_value.decode("utf-8")
                    break
            
            allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
            
            cors_origin = "*"
            if allowed_origins:
                if origin and origin in allowed_origins:
                    cors_origin = origin
                elif origin:
                    cors_origin = origin
            elif origin:
                cors_origin = origin
            
            headers = [
                (b"access-control-allow-origin", cors_origin.encode("utf-8")),
                (b"access-control-allow-methods", b"GET, POST, OPTIONS"),
                (b"access-control-allow-headers", b"Content-Type, Authorization"),
                (b"access-control-max-age", b"86400"),
            ]
            
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": headers,
            })
            await send({
                "type": "http.response.body",
                "body": b"",
            })
            return
        
        # Per tutte le altre richieste, intercetta http.response.start e aggiungi header CORS
        origin = None
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"origin":
                origin = header_value.decode("utf-8")
                break
        
        allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
        
        cors_origin = "*"
        if allowed_origins:
            if origin and origin in allowed_origins:
                cors_origin = origin
            elif origin:
                cors_origin = origin
        elif origin:
            cors_origin = origin
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"access-control-allow-origin", cors_origin.encode("utf-8")))
                headers.append((b"access-control-allow-methods", b"GET, POST, OPTIONS"))
                headers.append((b"access-control-allow-headers", b"Content-Type, Authorization"))
                message["headers"] = headers
            await send(message)
        
        await self.app(scope, receive, send_wrapper)


class CSPMiddleware:
    """
    Middleware ASGI nativo per aggiungere Content Security Policy (CSP) headers alle risposte HTTP.
    
    CSP previene attacchi XSS limitando le risorse che possono essere caricate ed eseguite.
    """
    
    def __init__(self, app: ASGIApp):
        self.app = app
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        path = scope.get("path", "")
        
        # Per risposte SSE/streaming, passa direttamente senza modificare headers
        if path.startswith("/mcp") or path == "/sse" or path.startswith("/messages"):
            await self.app(scope, receive, send)
            return
        
        # Costruisci la policy CSP come stringa singola per evitare problemi con h11
        csp_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://chat.openai.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        
        # Intercetta http.response.start e aggiungi header CSP
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                try:
                    headers.append((b"content-security-policy", csp_policy.encode("utf-8")))
                    headers.append((b"x-content-type-options", b"nosniff"))
                    headers.append((b"x-frame-options", b"DENY"))
                except Exception as e:
                    logger.warning(f"Failed to set CSP header: {e}")
                message["headers"] = headers
            await send(message)
        
        await self.app(scope, receive, send_wrapper)


async def proxy_image_handler(request: Request):
    """
    Proxy endpoint per servire immagini esterne con header CORS corretti.
    
    Risolve il problema ERR_BLOCKED_BY_ORB (Opaque Response Blocking) che si verifica
    quando il browser blocca immagini cross-origin senza header CORS appropriati.
    
    Query parameters:
        url (required): URL dell'immagine da proxyare (deve essere URL-encoded)
    
    Returns:
        Response con l'immagine e header CORS corretti, oppure errore 400/500
    """
    # Estrai l'URL dell'immagine dai query parameters
    image_url = request.query_params.get("url")
    
    if not image_url:
        logger.warning("Proxy image request without 'url' parameter")
        return Response(
            content="Missing 'url' parameter",
            status_code=400,
            media_type="text/plain"
        )
    
    # Valida che sia un URL valido
    try:
        parsed_url = urlparse(image_url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError("Invalid URL format")
        
        # Whitelist di domini permessi (opzionale, per sicurezza)
        # Per ora permettiamo tutti i domini, ma si può restringere se necessario
        allowed_domains = os.getenv("PROXY_ALLOWED_DOMAINS", "").split(",")
        if allowed_domains and allowed_domains[0]:  # Se configurato
            domain = parsed_url.netloc.lower()
            if not any(allowed in domain for allowed in allowed_domains if allowed):
                logger.warning(f"Proxy request blocked for domain: {domain}")
                return Response(
                    content="Domain not allowed",
                    status_code=403,
                    media_type="text/plain"
                )
    except Exception as e:
        logger.warning(f"Invalid URL in proxy request: {image_url}, error: {e}")
        return Response(
            content=f"Invalid URL: {str(e)}",
            status_code=400,
            media_type="text/plain"
        )
    
    try:
        # Scarica l'immagine dal server esterno
        logger.debug(f"Proxying image from: {image_url}")
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            image_response = await client.get(image_url)
            image_response.raise_for_status()  # Solleva eccezione se status non è 2xx
        
        # Determina il content type dall'header o dall'estensione
        content_type = image_response.headers.get("content-type", "image/png")
        if not content_type.startswith("image/"):
            # Se il content-type non è un'immagine, prova a dedurlo dall'URL
            ext = parsed_url.path.lower().split(".")[-1] if "." in parsed_url.path else ""
            content_type_map = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "gif": "image/gif",
                "webp": "image/webp",
                "svg": "image/svg+xml",
            }
            content_type = content_type_map.get(ext, "image/png")
        
        # Crea la risposta con l'immagine e header CORS
        response = Response(
            content=image_response.content,
            status_code=200,
            media_type=content_type
        )
        
        # Aggiungi header CORS per permettere il caricamento cross-origin
        origin = request.headers.get("origin")
        allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
        
        if not allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif origin and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        elif origin:
            # Permetti l'origine se presente (utile per ChatGPT con origini dinamiche)
            response.headers["Access-Control-Allow-Origin"] = origin
        
        # Header aggiuntivi per caching e sicurezza
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Cache-Control"] = "public, max-age=86400"  # Cache per 24 ore
        
        # Copia header utili dall'immagine originale (se presenti)
        if "etag" in image_response.headers:
            response.headers["ETag"] = image_response.headers["etag"]
        if "last-modified" in image_response.headers:
            response.headers["Last-Modified"] = image_response.headers["last-modified"]
        
        logger.debug(f"Successfully proxied image: {image_url} ({len(image_response.content)} bytes)")
        return response
        
    except httpx.TimeoutException:
        logger.error(f"Timeout while proxying image: {image_url}")
        return Response(
            content="Timeout while fetching image",
            status_code=504,
            media_type="text/plain"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error while proxying image: {image_url}, status: {e.response.status_code}")
        return Response(
            content=f"Failed to fetch image: HTTP {e.response.status_code}",
            status_code=e.response.status_code,
            media_type="text/plain"
        )
    except Exception as e:
        logger.error(f"Error proxying image: {image_url}, error: {str(e)}", exc_info=True)
        return Response(
            content=f"Error proxying image: {str(e)}",
            status_code=500,
            media_type="text/plain"
        )


# Handler per richieste OPTIONS (preflight) per il proxy
async def proxy_image_options_handler(request: Request):
    """Handler per richieste OPTIONS (preflight) per il proxy immagini."""
    origin = request.headers.get("origin")
    allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
    
    response = Response(status_code=200)
    
    if not allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = "*"
    elif origin and origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    elif origin:
        response.headers["Access-Control-Allow-Origin"] = origin
    
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Max-Age"] = "86400"
    
    return response


mcp = FastMCP(
    name="gdo-python",
    stateless_http=True,
    transport_security=_transport_security_settings(),
)

# Aggiungi middleware CSP all'app FastAPI
# Nota: FastMCP espone l'app tramite sse_app(), quindi dobbiamo aggiungere il middleware
# dopo che l'app è creata, ma prima di esporla


# Tool input schemas - most widgets don't require input
# Define specific schemas per tool if needed
EMPTY_TOOL_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": False,
}

# Schema per tool che possono filtrare per categoria
CATEGORY_FILTER_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "category": {
            "type": "string",
            "description": "Categoria opzionale per filtrare i prodotti (es. 'Ortofrutta', 'Carne e pollame', 'Pesce e prodotti ittici', 'Latticini e uova'). Se non specificata, vengono restituiti tutti i prodotti.",
        },
        "size_inches": {
            "type": "integer",
            "description": "Quantità richiesta (es. 500, 1000). Usa questo parametro quando il cliente specifica una quantità specifica (es. '500g di carne'). I prodotti con quantità esatta verranno mostrati per primi, seguiti da prodotti con quantità simili.",
        },
        "target_price": {
            "type": "number",
            "description": "Prezzo target desiderato dal cliente. I prodotti con prezzo simile verranno mostrati prima. Usa questo quando il cliente specifica un budget o un prezzo desiderato.",
        },
        "max_price": {
            "type": "number",
            "description": "Prezzo massimo che il cliente è disposto a spendere. I prodotti sopra questo prezzo avranno priorità più bassa.",
        },
        "min_price": {
            "type": "number",
            "description": "Prezzo minimo desiderato. I prodotti sotto questo prezzo avranno priorità più bassa.",
        },
        "keywords": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Lista di parole chiave da cercare nel nome o descrizione del prodotto. I prodotti che corrispondono a più parole chiave avranno priorità più alta.",
        },
    },
    "required": [],
    "additionalProperties": False,
}

CHECKOUT_SESSION_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "description": "Articoli del carrello da includere nella Checkout Session.",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "quantity": {"type": "integer", "minimum": 1},
                    "unit_amount_major": {
                        "type": "number",
                        "description": "Prezzo unitario in major unit (es. 10.50 per EUR).",
                    },
                    "description": {"type": "string"},
                },
                "required": ["name", "quantity", "unit_amount_major"],
                "additionalProperties": False,
            },
        },
        "currency": {
            "type": "string",
            "description": "Codice valuta ISO (es. 'eur').",
        },
        "success_url": {
            "type": "string",
            "description": "URL di ritorno dopo pagamento riuscito.",
        },
        "cancel_url": {
            "type": "string",
            "description": "URL di ritorno dopo annullamento.",
        },
        "customer_email": {
            "type": "string",
            "description": "Email cliente (opzionale).",
        },
        "billing_details": {
            "type": "object",
            "description": "Dati di fatturazione (opzionali).",
            "properties": {
                "name": {"type": "string"},
                "address_line1": {"type": "string"},
                "address_line2": {"type": "string"},
                "city": {"type": "string"},
                "postal_code": {"type": "string"},
                "country": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "metadata": {
            "type": "object",
            "description": "Metadata opzionale per la sessione.",
            "additionalProperties": {"type": "string"},
        },
    },
    "required": ["items", "currency", "success_url", "cancel_url"],
    "additionalProperties": False,
}


CHECKOUT_CREATE_SESSION_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "description": "Articoli del carrello con prezzo in major unit.",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "quantity": {"type": "integer", "minimum": 1},
                    "unit_amount_major": {
                        "type": "number",
                        "description": "Prezzo unitario in major unit (es. 10.50 per EUR).",
                    },
                    "description": {"type": "string"},
                },
                "required": ["name", "quantity", "unit_amount_major"],
                "additionalProperties": False,
            },
        },
        "currency": {"type": "string"},
        "buyer_email": {"type": "string"},
        "shared_payment_token": {"type": "string"},
        "promo_code": {"type": "string"},
        "idempotency_key": {"type": "string"},
    },
    "required": ["items", "currency", "buyer_email"],
    "additionalProperties": False,
}

CHECKOUT_UPDATE_SESSION_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "session_id": {"type": "string"},
        "items": CHECKOUT_CREATE_SESSION_INPUT_SCHEMA["properties"]["items"],
        "currency": {"type": "string"},
        "promo_code": {"type": "string"},
    },
    "required": ["session_id"],
    "additionalProperties": False,
}

CHECKOUT_COMPLETE_SESSION_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "session_id": {"type": "string"},
        "idempotency_key": {"type": "string"},
    },
    "required": ["session_id"],
    "additionalProperties": False,
}


CREATE_PAYMENT_INTENT_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "amount_minor": {"type": "integer", "minimum": 1},
        "currency": {"type": "string"},
        "buyer_email": {"type": "string"},
        "shared_payment_token": {"type": "string"},
        "metadata": {
            "type": "object",
            "additionalProperties": {"type": "string"},
        },
    },
    "required": ["amount_minor", "currency", "buyer_email"],
    "additionalProperties": False,
}

CONFIRM_PAYMENT_INTENT_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "payment_intent_id": {"type": "string"},
    },
    "required": ["payment_intent_id"],
    "additionalProperties": False,
}

CROSS_SELL_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "cartItems": {
            "type": "array",
            "description": "Articoli presenti nel carrello per calcolare i suggerimenti.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "shortDescription": {"type": "string"},
                    "detailSummary": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "category": {"type": "string"},
                },
                "required": ["id", "name"],
                "additionalProperties": False,
            },
        },
        "maxResults": {
            "type": "integer",
            "minimum": 1,
            "maximum": 8,
            "description": "Numero massimo di suggerimenti da restituire (1-8).",
        },
    },
    "required": ["cartItems"],
    "additionalProperties": False,
}


class CheckoutItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    unit_amount_major: float = Field(gt=0)
    description: str | None = None


class CheckoutSessionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[CheckoutItemInput]
    currency: str = Field(min_length=3)
    success_url: str = Field(min_length=1)
    cancel_url: str = Field(min_length=1)
    customer_email: str | None = None
    billing_details: Dict[str, str] | None = None
    metadata: Dict[str, str] | None = None


class CheckoutCartItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    unit_amount_major: float = Field(gt=0)
    description: str | None = None


class CheckoutCreateSessionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[CheckoutCartItemInput]
    currency: str = Field(min_length=3)
    buyer_email: str = Field(min_length=1)
    shared_payment_token: str | None = None
    promo_code: str | None = None
    idempotency_key: str | None = None


class CheckoutUpdateSessionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1)
    items: List[CheckoutCartItemInput] | None = None
    currency: str | None = None
    promo_code: str | None = None


class CheckoutCompleteSessionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=1)
    idempotency_key: str | None = None


class CheckoutCartTotals(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subtotal_minor: int
    discount_minor: int
    tax_minor: int
    shipping_minor: int
    grand_total_minor: int
    currency: str


class CheckoutCart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[CheckoutCartItemInput]
    totals: CheckoutCartTotals


class CheckoutSession(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    status: str
    cart: CheckoutCart
    payment_intent_id: str | None


class CheckoutCompleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    status: str
    cart: CheckoutCart
    payment_intent_id: str | None


class CreatePaymentIntentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_minor: int = Field(gt=0)
    currency: str = Field(min_length=3)
    buyer_email: str = Field(min_length=1)
    shared_payment_token: str | None = None
    metadata: Dict[str, str] | None = None


class ConfirmPaymentIntentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment_intent_id: str = Field(min_length=1)


class CrossSellCartItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str | None = None
    short_description: str | None = Field(default=None, alias="shortDescription")
    detail_summary: str | None = Field(default=None, alias="detailSummary")
    tags: List[str] | None = None
    category: str | None = None


class CrossSellRequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    cart_items: List[CrossSellCartItemInput] = Field(alias="cartItems")
    max_results: int = Field(default=8, ge=1, le=8, alias="maxResults")


CROSS_SELL_CARNE_KEYWORDS = [
    "carne",
    "manzo",
    "vitello",
    "maiale",
    "pollo",
    "tacchino",
    "hamburger",
    "polpette",
    "salsicce",
    "bistecche",
    "fettine",
    "macinato",
    "carne bovina",
    "carne suina",
    "carne avicola",
]
CROSS_SELL_PESCE_KEYWORDS = [
    "pesce",
    "salmone",
    "tonno",
    "branzino",
    "orata",
    "gamberi",
    "gamberetti",
    "cozze",
    "vongole",
    "calamari",
    "polpo",
    "prodotti ittici",
    "crostacei",
    "molluschi",
]

CROSS_SELL_ACCESSORIES_TAG = "accessori"
CROSS_SELL_POPULAR_TAG = "popular"
CROSS_SELL_RECOMMENDED_TAG = "recommended"

CROSS_SELL_FALLBACK_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "cs-olio-oliva-01",
        "sku": "CS-OLIO-OLIVA-01",
        "name": "Olio extravergine di oliva",
        "price": 8.9,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["carne", "pesce", "ortofrutta"],
        "priority": 95,
    },
    {
        "id": "cs-sale-01",
        "sku": "CS-SALE-01",
        "name": "Sale fino marino",
        "price": 1.5,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["carne", "pesce", "ortofrutta"],
        "priority": 90,
    },
    {
        "id": "cs-pepe-01",
        "sku": "CS-PEPE-01",
        "name": "Pepe nero macinato",
        "price": 2.9,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_RECOMMENDED_TAG],
        "compatibleWith": ["carne", "pesce"],
        "priority": 88,
    },
    {
        "id": "cs-spezie-01",
        "sku": "CS-SPEZIE-01",
        "name": "Mix di spezie per carne",
        "price": 4.5,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_RECOMMENDED_TAG],
        "compatibleWith": ["carne"],
        "priority": 85,
    },
    {
        "id": "cs-limone-01",
        "sku": "CS-LIMONE-01",
        "name": "Limoni freschi",
        "price": 3.9,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["pesce", "ortofrutta"],
        "priority": 82,
    },
    {
        "id": "cs-salsa-pomodoro-01",
        "sku": "CS-SALSA-POMODORO-01",
        "name": "Passata di pomodoro",
        "price": 2.2,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["pasta"],
        "priority": 80,
    },
    {
        "id": "cs-sugo-01",
        "sku": "CS-SUGO-01",
        "name": "Sugo pronto per pasta",
        "price": 3.5,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_RECOMMENDED_TAG],
        "compatibleWith": ["pasta"],
        "priority": 78,
    },
    {
        "id": "cs-formaggio-01",
        "sku": "CS-FORMAGGIO-01",
        "name": "Parmigiano Reggiano grattugiato",
        "price": 6.9,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["pasta"],
        "priority": 75,
    },
    {
        "id": "cs-insalata-01",
        "sku": "CS-INSALATA-01",
        "name": "Insalata mista",
        "price": 2.9,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_RECOMMENDED_TAG],
        "compatibleWith": ["pesce", "ortofrutta"],
        "priority": 72,
    },
    {
        "id": "cs-aceto-01",
        "sku": "CS-ACETO-01",
        "name": "Aceto balsamico di Modena",
        "price": 5.9,
        "imageUrl": "",
        "tags": [CROSS_SELL_ACCESSORIES_TAG, CROSS_SELL_RECOMMENDED_TAG],
        "compatibleWith": ["ortofrutta"],
        "priority": 70,
    },
    {
        "id": "cs-pane-01",
        "sku": "CS-PANE-01",
        "name": "Pane fresco",
        "price": 2.5,
        "imageUrl": "",
        "tags": [CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["carne", "pesce", "pasta"],
        "priority": 68,
    },
    {
        "id": "cs-acqua-01",
        "sku": "CS-ACQUA-01",
        "name": "Acqua minerale naturale",
        "price": 1.2,
        "imageUrl": "",
        "tags": [CROSS_SELL_POPULAR_TAG],
        "compatibleWith": ["carne", "pesce", "pasta", "ortofrutta"],
        "priority": 65,
    },
]


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _collect_cart_text(cart_items: List[CrossSellCartItemInput]) -> str:
    chunks = []
    for item in cart_items:
        chunks.extend(
            [
                item.name,
                item.description,
                item.short_description,
                item.detail_summary,
                " ".join(item.tags or []),
            ]
        )
    return " ".join([chunk for chunk in chunks if chunk])


def _get_cart_category_intent(
    cart_items: List[CrossSellCartItemInput],
) -> tuple[List[str], bool]:
    if not cart_items:
        return [], False

    normalized_text = _normalize_text(_collect_cart_text(cart_items))
    tokens = {token for token in normalized_text.split() if token}

    explicit_categories = []
    for item in cart_items:
        if not item.category:
            continue
        normalized_category = _normalize_text(item.category)
        if any(keyword in normalized_category for keyword in ["carne", "manzo", "pollo", "maiale", "hamburger", "polpette"]):
            explicit_categories.append("carne")
        if any(keyword in normalized_category for keyword in ["pesce", "salmone", "tonno", "gamberi", "cozze"]):
            explicit_categories.append("pesce")

    has_carne = (
        "carne" in explicit_categories
        or any(keyword in tokens or keyword in normalized_text for keyword in CROSS_SELL_CARNE_KEYWORDS)
    )
    has_pesce = (
        "pesce" in explicit_categories
        or any(keyword in tokens or keyword in normalized_text for keyword in CROSS_SELL_PESCE_KEYWORDS)
    )
    
    pasta_keywords = ["pasta", "spaghetti", "penne", "fusilli", "rigatoni", "fettuccine", "lasagne", "riso", "cereali"]
    has_pasta = any(keyword in tokens or keyword in normalized_text for keyword in pasta_keywords)
    
    ortofrutta_keywords = ["ortofrutta", "verdura", "frutta", "verdure", "insalata", "pomodori", "zucchine", "peperoni", "melanzane", "carote", "patate", "cipolle", "mele", "pere", "banane", "arance", "limoni"]
    has_ortofrutta = any(keyword in tokens or keyword in normalized_text for keyword in ortofrutta_keywords)

    categories: List[str] = []
    if has_carne:
        categories.append("carne")
    if has_pesce:
        categories.append("pesce")
    if has_pasta:
        categories.append("pasta")
    if has_ortofrutta:
        categories.append("ortofrutta")

    return categories, has_carne or has_pesce or has_pasta or has_ortofrutta


def _get_cart_identifiers(cart_items: List[CrossSellCartItemInput]) -> tuple[set[str], set[str]]:
    ids = set()
    names = set()
    for item in cart_items:
        if item.id:
            ids.add(_normalize_text(item.id))
        if item.name:
            names.add(_normalize_text(item.name))
    return ids, names


def _has_accessory_keyword(cart_items: List[CrossSellCartItemInput], keywords: List[str]) -> bool:
    normalized_text = _normalize_text(_collect_cart_text(cart_items))
    return any(keyword in normalized_text for keyword in keywords)


def _sort_by_priority(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(items, key=lambda item: item.get("priority", 0), reverse=True)


def _dedupe_by_sku(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    deduped = []
    for item in items:
        sku = item.get("sku")
        if not sku or sku in seen:
            continue
        seen.add(sku)
        deduped.append(item)
    return deduped


def _extract_product_categories(product: Dict[str, Any]) -> List[str]:
    categories_raw: List[str] = []
    
    categories = product.get("categories")
    if isinstance(categories, list):
        categories_raw.extend([str(cat).strip() for cat in categories if cat])
    elif isinstance(categories, str):
        categories_raw.extend([cat.strip() for cat in categories.split(",") if cat.strip()])

    return categories_raw


def _product_has_category_keywords(product: Dict[str, Any], keywords: List[str]) -> bool:
    normalized_categories = _normalize_text(" ".join(_extract_product_categories(product)))
    return any(keyword in normalized_categories for keyword in keywords)


def _extract_price_from_product(product: Dict[str, Any]) -> float:
    """Estrae il prezzo dal prodotto. Il prezzo è una stringa che può contenere /kg."""
    price_str = product.get("price", "")
    if not isinstance(price_str, str):
        price_str = str(price_str) if price_str else ""
    
    # Rimuovi /kg e altri suffissi, poi estrai il numero
    price_clean = price_str.replace("/kg", "").replace("€", "").replace(",", ".").strip()
    try:
        # Prova a estrarre il primo numero dalla stringa
        match = re.search(r'(\d+\.?\d*)', price_clean)
        if match:
            return float(match.group(1))
    except (ValueError, AttributeError):
        pass
    return 0.0


def _extract_image_url(product: Dict[str, Any]) -> str:
    """Restituisce l'URL immagine basato sulla categoria del prodotto."""
    return _get_product_image_url(product)


def _resolve_cart_products(
    cart_items: List[CrossSellCartItemInput],
    products: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not cart_items or not products:
        return []

    lookup: Dict[str, Dict[str, Any]] = {}
    for product in products:
        product_id = product.get("ID") or product.get("id")
        product_description = product.get("description")
        if product_id:
            lookup[_normalize_text(str(product_id))] = product
        if isinstance(product_description, str) and product_description:
            lookup[_normalize_text(product_description)] = product

    resolved = []
    for item in cart_items:
        key_candidates = [_normalize_text(item.id), _normalize_text(item.name)]
        for key in key_candidates:
            if key in lookup:
                resolved.append(lookup[key])
                break
    return resolved


def _detect_cart_intent_from_products(
    cart_products: List[Dict[str, Any]],
) -> tuple[List[str], bool]:
    if not cart_products:
        return [], False

    normalized_categories = _normalize_text(
        " ".join(
            [" ".join(_extract_product_categories(product)) for product in cart_products]
        )
    )

    has_pesce = any(keyword in normalized_categories for keyword in ["pesce", "salmone", "tonno", "gamberi", "cozze", "prodotti ittici"])
    has_carne = any(
        keyword in normalized_categories
        for keyword in ["carne", "manzo", "pollo", "maiale", "hamburger", "polpette", "salsicce"]
    )

    categories: List[str] = []
    if has_carne:
        categories.append("carne")
    if has_pesce:
        categories.append("pesce")

    return categories, has_carne or has_pesce


def _map_product_to_cross_sell_item(product: Dict[str, Any]) -> Dict[str, Any]:
    product_id = product.get("ID") or product.get("id")
    sku = str(product_id) if product_id is not None else ""
    name = product.get("description", "")
    price = _extract_price_from_product(product)
    primary_categories = _extract_product_categories(product)
    normalized_categories = _normalize_text(" ".join(primary_categories))

    tags: List[str] = []
    if "olio" in normalized_categories or "condimento" in normalized_categories:
        tags.append(CROSS_SELL_ACCESSORIES_TAG)
    if "salsa" in normalized_categories or "sugo" in normalized_categories:
        tags.append(CROSS_SELL_POPULAR_TAG)
    if "spezie" in normalized_categories or "aromi" in normalized_categories:
        tags.append(CROSS_SELL_RECOMMENDED_TAG)

    compatible_with: List[str] = []
    if any(token in normalized_categories for token in ["carne", "manzo", "pollo", "maiale", "hamburger"]):
        compatible_with.append("carne")
    if any(token in normalized_categories for token in ["pesce", "salmone", "tonno", "gamberi"]):
        compatible_with.append("pesce")
    if any(token in normalized_categories for token in ["pasta", "spaghetti", "penne", "fusilli", "riso", "cereali"]):
        compatible_with.append("pasta")
    if any(token in normalized_categories for token in ["ortofrutta", "verdura", "frutta", "verdure", "insalata", "pomodori", "limoni"]):
        compatible_with.append("ortofrutta")

    priority = 60
    if CROSS_SELL_ACCESSORIES_TAG in tags:
        priority = 90
    elif "salsa" in normalized_categories or "sugo" in normalized_categories:
        priority = 82
    elif "spezie" in normalized_categories:
        priority = 78
    elif "condimento" in normalized_categories:
        priority = 76

    return {
        "id": sku,
        "sku": sku,
        "name": name,
        "price": price,
        "imageUrl": _extract_image_url(product),
        "tags": tags,
        "compatibleWith": compatible_with,
        "priority": priority,
        "primaryCategories": primary_categories,
    }


def _get_cross_sell_suggestions_from_db(
    cart_items: List[CrossSellCartItemInput],
    products: List[Dict[str, Any]],
    max_results: int,
) -> List[Dict[str, Any]]:
    if not cart_items or not products:
        return []

    cart_products = _resolve_cart_products(cart_items, products)
    categories, has_food_category = _detect_cart_intent_from_products(cart_products)

    carne_keywords = ["olio", "sale", "pepe", "spezie", "condimenti", "marinata"]
    pesce_keywords = [
        "olio",
        "limone",
        "sale",
        "pepe",
        "spezie",
        "condimenti",
        "insalata",
    ]

    accessory_products: List[Dict[str, Any]] = []
    for product in products:
        normalized_categories = _normalize_text(" ".join(_extract_product_categories(product)))
        if "carne" in categories and any(keyword in normalized_categories for keyword in carne_keywords):
            accessory_products.append(product)
        elif "pesce" in categories and any(keyword in normalized_categories for keyword in pesce_keywords):
            accessory_products.append(product)
        elif "pasta" in categories and any(keyword in normalized_categories for keyword in ["salsa", "sugo", "pomodoro", "formaggio"]):
            accessory_products.append(product)

    catalog = [_map_product_to_cross_sell_item(product) for product in accessory_products]
    catalog = [item for item in catalog if item.get("price", 0) > 0 and item.get("name")]

    suggestions = _get_cross_sell_suggestions(cart_items, catalog)

    if has_food_category:
        suggestions = [item for item in suggestions if item.get("sku")]

    return suggestions[:max_results]


def _get_cross_sell_suggestions(
    cart_items: List[CrossSellCartItemInput],
    catalog: List[Dict[str, Any]],
    max_results: int,
) -> List[Dict[str, Any]]:
    if not cart_items or not catalog:
        return []

    categories, has_food_category = _get_cart_category_intent(cart_items)
    cart_ids, cart_names = _get_cart_identifiers(cart_items)
    normalized_cart_text = _normalize_text(_collect_cart_text(cart_items))

    eligible = _dedupe_by_sku(
        [
            item
            for item in catalog
            if _normalize_text(item.get("sku", "")) not in cart_ids
            and _normalize_text(item.get("id", "")) not in cart_ids
            and _normalize_text(item.get("name", "")) not in cart_names
        ]
    )

    suggestions: List[Dict[str, Any]] = []
    seen_skus = set()

    def push_suggestion(item: Dict[str, Any]) -> None:
        sku = item.get("sku")
        if not sku or sku in seen_skus:
            return
        seen_skus.add(sku)
        suggestions.append(item)

    if has_food_category and categories:
        cleaning_candidates = _sort_by_priority(
            [
                item
                for item in eligible
                if CROSS_SELL_ACCESSORIES_TAG in (item.get("tags") or [])
                and any(category in categories for category in item.get("compatibleWith", []))
            ]
        )
        for item in cleaning_candidates[:2]:
            push_suggestion(item)

    if "carne" in categories:
        needs_olio = not _has_accessory_keyword(cart_items, ["olio", "condimento"])
        needs_spezie = not _has_accessory_keyword(cart_items, ["spezie", "sale", "pepe"])
        carne_candidates = [item for item in eligible if "carne" in item.get("compatibleWith", [])]

        if needs_olio:
            for item in _sort_by_priority(
                [item for item in carne_candidates if "olio" in (item.get("tags") or []) or CROSS_SELL_ACCESSORIES_TAG in (item.get("tags") or [])]
            )[:1]:
                push_suggestion(item)

        if needs_spezie:
            for item in _sort_by_priority(
                [item for item in carne_candidates if "spezie" in (item.get("tags") or [])]
            )[:1]:
                push_suggestion(item)

    if "pesce" in categories:
        needs_limone = "limone" not in normalized_cart_text
        needs_olio = not _has_accessory_keyword(cart_items, ["olio", "condimento"])
        pesce_candidates = [item for item in eligible if "pesce" in item.get("compatibleWith", [])]

        if needs_limone:
            for item in _sort_by_priority(
                [item for item in pesce_candidates if "limone" in (item.get("tags") or []) or "ortofrutta" in (item.get("tags") or [])]
            )[:1]:
                push_suggestion(item)

        if needs_olio:
            for item in _sort_by_priority(
                [item for item in pesce_candidates if "olio" in (item.get("tags") or []) or CROSS_SELL_ACCESSORIES_TAG in (item.get("tags") or [])]
            )[:1]:
                push_suggestion(item)

    if "pasta" in categories:
        needs_salsa = not _has_accessory_keyword(cart_items, ["salsa", "sugo", "pomodoro"])
        pasta_candidates = [item for item in eligible if "pasta" in item.get("compatibleWith", [])]

        if needs_salsa:
            for item in _sort_by_priority(
                [item for item in pasta_candidates if "salsa" in (item.get("tags") or []) or "sugo" in (item.get("tags") or [])]
            )[:1]:
                push_suggestion(item)

    category_set = set(categories)
    scored: List[tuple[Dict[str, Any], int]] = []
    for item in eligible:
        sku = item.get("sku")
        if not sku or sku in seen_skus:
            continue
        if categories and not any(cat in category_set for cat in item.get("compatibleWith", [])):
            continue

        score = int(item.get("priority", 0))
        if has_food_category and CROSS_SELL_ACCESSORIES_TAG in (item.get("tags") or []):
            score += 15
        if "carne" in categories and "carne" in item.get("compatibleWith", []):
            score += 10
        if "pesce" in categories and "pesce" in item.get("compatibleWith", []):
            score += 10
        if "pasta" in categories and "pasta" in item.get("compatibleWith", []):
            score += 10
        if "ortofrutta" in categories and "ortofrutta" in item.get("compatibleWith", []):
            score += 10
        if CROSS_SELL_POPULAR_TAG in (item.get("tags") or []):
            score += 4
        scored.append((item, score))

    scored.sort(key=lambda entry: entry[1], reverse=True)
    for item, _score in scored:
        push_suggestion(item)

    return suggestions[:max_results]


ZERO_DECIMAL_CURRENCIES = {
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
}

THREE_DECIMAL_CURRENCIES = {
    "bhd",
    "jod",
    "kwd",
    "omr",
    "tnd",
}


def _currency_exponent(currency: str) -> int:
    currency_lower = currency.lower()
    if currency_lower in ZERO_DECIMAL_CURRENCIES:
        return 0
    if currency_lower in THREE_DECIMAL_CURRENCIES:
        return 3
    return 2


def _to_minor_amount(amount_major: float, currency: str) -> int:
    exponent = _currency_exponent(currency)
    quantize_exp = Decimal(1) / (Decimal(10) ** exponent)
    decimal_amount = Decimal(str(amount_major)).quantize(quantize_exp, rounding=ROUND_HALF_UP)
    return int(decimal_amount * (10 ** exponent))


CHECKOUT_SESSIONS: Dict[str, Dict[str, Any]] = {}
IDEMPOTENCY_CACHE: Dict[tuple[str, str], str] = {}


def _get_idempotent_response(key: str | None, operation: str) -> str | None:
    if not key:
        return None
    return IDEMPOTENCY_CACHE.get((key, operation))


def _save_idempotent_response(key: str, operation: str, payload_json: str) -> None:
    IDEMPOTENCY_CACHE[(key, operation)] = payload_json


def _compute_checkout_totals(
    items: List[CheckoutCartItemInput],
    currency: str,
    promo_code: str | None,
) -> CheckoutCartTotals:
    subtotal = 0
    for item in items:
        unit_amount = _to_minor_amount(item.unit_amount_major, currency)
        if unit_amount <= 0:
            raise ValueError(f"Invalid unit_amount for item '{item.name}'.")
        subtotal += unit_amount * item.quantity

    discount = 0
    if promo_code and promo_code.upper() == "WELCOME10":
        discount = int(subtotal * 0.10)

    taxable_base = max(0, subtotal - discount)
    tax = 0
    shipping = 500 if currency.upper() == "EUR" and (subtotal / 100.0) < 50.0 else 0
    grand = max(0, taxable_base + shipping)

    return CheckoutCartTotals(
        subtotal_minor=subtotal,
        discount_minor=discount,
        tax_minor=tax,
        shipping_minor=shipping,
        grand_total_minor=grand,
        currency=currency.upper(),
    )


def _serialize_checkout_session(
    session_id: str,
    status: str,
    cart: CheckoutCart,
    payment_intent_id: str | None,
) -> CheckoutSession:
    return CheckoutSession(
        id=session_id,
        status=status,
        cart=cart,
        payment_intent_id=payment_intent_id,
    )



def _resource_description(widget: GdoWidget) -> str:
    return f"{widget.title} widget markup"


def _tool_description(widget: GdoWidget) -> str:
    """
    Genera una descrizione dettagliata per ogni tool basata sul suo identificatore.
    
    Returns:
        str: Descrizione dettagliata del tool che spiega cosa fa, quando usarlo e cosa restituisce.
    """
    descriptions = {
        "gdo-map": (
            "Mostra una mappa interattiva dei negozi GDO. "
            "Usa questo tool quando l'utente chiede di vedere la posizione dei negozi o di visualizzare "
            "una mappa interattiva. Restituisce un widget HTML con una mappa cliccabile."
        ),
        "gdo-carousel": (
            "Mostra un carosello interattivo di prodotti GDO (massimo 6 prodotti). "
            "Usa questo tool quando l'utente vuole sfogliare prodotti in formato carosello o visualizzare "
            "una selezione di prodotti in modo interattivo. Puoi filtrare per categoria usando il parametro 'category' "
            "(es. 'Ortofrutta', 'Carne e pollame', 'Pesce e prodotti ittici', 'Latticini e uova'). Restituisce un widget HTML con un carosello navigabile."
        ),
        "gdo-albums": (
            "Mostra una galleria di prodotti GDO con visualizzazione a album. "
            "Usa questo tool quando l'utente chiede di vedere una galleria di prodotti, foto o immagini "
            "in formato album. Puoi filtrare per categoria usando il parametro 'category' "
            "(es. 'Ortofrutta', 'Carne e pollame', 'Pesce e prodotti ittici', 'Latticini e uova'). Restituisce un widget HTML con una galleria interattiva."
        ),
        "gdo-list": (
            "Mostra una lista di prodotti GDO. "
            "Usa questo tool quando l'utente chiede di vedere un elenco di prodotti o una lista semplice. "
            "Puoi filtrare per categoria usando il parametro 'category' "
            "(es. 'Ortofrutta', 'Carne e pollame', 'Pesce e prodotti ittici', 'Latticini e uova'). Restituisce un widget HTML con una lista formattata di prodotti."
        ),
        "gdo-shop": (
            "Apre il negozio GDO completo con funzionalità di shopping (massimo 24 prodotti). "
            "Usa questo tool quando l'utente vuole accedere al negozio completo, vedere prodotti con dettagli, "
            "o iniziare lo shopping. Puoi filtrare per categoria usando il parametro 'category' "
            "(es. 'Ortofrutta', 'Carne e pollame', 'Pesce e prodotti ittici', 'Latticini e uova'). Restituisce un widget HTML con l'interfaccia completa del negozio."
        ),
        "product-list": (
            "Recupera e mostra la lista completa di prodotti alimentari dal database MotherDuck. "
            "Usa questo tool quando l'utente chiede di vedere tutti i prodotti disponibili, cercare prodotti, "
            "o visualizzare il catalogo completo. Puoi filtrare per categoria usando il parametro 'category' "
            "(es. 'Ortofrutta', 'Carne e pollame', 'Pesce e prodotti ittici', 'Latticini e uova'). Restituisce dati strutturati JSON con i prodotti recuperati dal database, "
            "inclusi dettagli come nome, prezzo, descrizione e immagini."
        ),
        "shopping-cart": (
            "Mostra il carrello della spesa con tutti i prodotti che l'utente ha aggiunto tramite i pulsanti 'Aggiungi al carrello' "
            "nei vari widget (carousel, list, albums, map, search). **USALO QUANDO L'UTENTE CHIEDE DI VEDERE IL CARRELLO, "
            "MOSTRARE GLI ARTICOLI NEL CARRELLO, O VERIFICARE COSA HA AGGIUNTO**. Il carrello mostra SOLO i prodotti che l'utente "
            "ha esplicitamente aggiunto cliccando sui pulsanti 'Aggiungi al carrello'. Se il carrello è vuoto, mostra un messaggio appropriato. "
            "Restituisce un widget HTML interattivo che permette all'utente di vedere gli articoli nel carrello, modificare le quantità, e procedere al checkout."
        ),
    }
    return descriptions.get(widget.identifier, widget.title)


def _tool_meta(widget: GdoWidget) -> Dict[str, Any]:
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
    }


def _tool_invocation_meta(widget: GdoWidget) -> Dict[str, Any]:
    return {
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
    }



@mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    """
    Lista tutti i tool disponibili nel server MCP.
    
    Returns:
        List[types.Tool]: Lista di tool con schemi input, descrizioni dettagliate e metadati.
    """
    # Tool che possono filtrare per categoria (recuperano prodotti da MotherDuck)
    tools_with_category_filter = {
        "product-list",
        "gdo-carousel",
        "gdo-albums",
        "gdo-list",
        "gdo-shop",
    }
    
    tools = [
        types.Tool(
            name=widget.identifier,
            title=widget.title,
            description=_tool_description(widget),
            inputSchema=deepcopy(
                CATEGORY_FILTER_INPUT_SCHEMA if widget.identifier in tools_with_category_filter
                else EMPTY_TOOL_INPUT_SCHEMA
            ),
            _meta=_tool_meta(widget),
            # Annotazioni per indicare che i tool sono read-only e non distruttivi
            annotations={
                "destructiveHint": False,  # I tool non modificano dati
                "openWorldHint": False,    # I tool non accedono a dati esterni non controllati
                "readOnlyHint": True,      # I tool sono read-only
            },
        )
        for widget in widgets
    ]
    
    # Aggiungi il tool get_instructions che non è un widget
    tools.append(
        types.Tool(
            name="get_instructions",
            title="Get Instructions",
            description=(
                "Restituisce il contenuto testuale delle istruzioni (prompt) attualmente utilizzate dal server. "
                "Usa questo tool quando vuoi vedere quale prompt/instructions il server sta utilizzando. "
                "Restituisce il testo completo delle istruzioni dal file prompts/instructions.md."
            ),
            inputSchema=deepcopy(EMPTY_TOOL_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        )
    )

    tools.append(
        types.Tool(
            name="cross_sell_recommendations",
            title="Cross-sell Recommendations",
            description=(
                "Genera suggerimenti di cross-selling per il carrello in base alle categorie "
                "dei prodotti presenti e alle regole business predefinite. Restituisce una lista "
                "di accessori consigliati con SKU, nome, prezzo e tags."
            ),
            inputSchema=deepcopy(CROSS_SELL_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        )
    )
    
    tools.append(
        types.Tool(
            name="create_checkout_session",
            title="Create Checkout Session",
            description=(
                "Crea una Stripe Checkout Session per completare il pagamento del carrello. "
                "Usa questo tool quando l'utente decide di acquistare e vuoi generare il link "
                "di checkout. Richiede gli articoli del carrello con prezzi in major unit, "
                "la valuta, e gli URL di ritorno (success/cancel). Restituisce l'URL di checkout."
            ),
            inputSchema=deepcopy(CHECKOUT_SESSION_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": True,
                "readOnlyHint": False,
            },
        )
    )

    tools.append(
        types.Tool(
            name="checkout_create_session",
            title="Checkout Create Session",
            description=(
                "Crea una sessione di checkout in stile ACP e genera un PaymentIntent Stripe. "
                "Accetta prezzi in major unit e restituisce id sessione, totali e payment_intent_id."
            ),
            inputSchema=deepcopy(CHECKOUT_CREATE_SESSION_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": True,
                "readOnlyHint": False,
            },
        )
    )

    tools.append(
        types.Tool(
            name="checkout_update_session",
            title="Checkout Update Session",
            description=(
                "Aggiorna una sessione di checkout (items/currency/promo) e ricalcola i totali."
            ),
            inputSchema=deepcopy(CHECKOUT_UPDATE_SESSION_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": True,
                "readOnlyHint": False,
            },
        )
    )

    tools.append(
        types.Tool(
            name="checkout_complete_session",
            title="Checkout Complete Session",
            description=(
                "Completa una sessione di checkout confermando il PaymentIntent associato."
            ),
            inputSchema=deepcopy(CHECKOUT_COMPLETE_SESSION_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": True,
                "readOnlyHint": False,
            },
        )
    )

    tools.append(
        types.Tool(
            name="create_payment_intent",
            title="Create Payment Intent",
            description=(
                "Crea un PaymentIntent Stripe (solo carte) e supporta SPT demo "
                "mappati a PaymentMethod test. Restituisce id, client_secret e status."
            ),
            inputSchema=deepcopy(CREATE_PAYMENT_INTENT_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": True,
                "readOnlyHint": False,
            },
        )
    )

    tools.append(
        types.Tool(
            name="confirm_payment_intent",
            title="Confirm Payment Intent",
            description=(
                "Conferma un PaymentIntent. Se non ha payment_method, "
                "usa la card test 'pm_card_visa' come fallback."
            ),
            inputSchema=deepcopy(CONFIRM_PAYMENT_INTENT_INPUT_SCHEMA),
            annotations={
                "destructiveHint": False,
                "openWorldHint": True,
                "readOnlyHint": False,
            },
        )
    )
    
    return tools


@mcp._mcp_server.list_resources()
async def _list_resources() -> List[types.Resource]:
    return [
        types.Resource(
            name=widget.title,
            title=widget.title,
            uri=widget.template_uri,
            description=_resource_description(widget),
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


@mcp._mcp_server.list_resource_templates()
async def _list_resource_templates() -> List[types.ResourceTemplate]:
    return [
        types.ResourceTemplate(
            name=widget.title,
            title=widget.title,
            uriTemplate=widget.template_uri,
            description=_resource_description(widget),
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


async def _handle_read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
    widget = WIDGETS_BY_URI.get(str(req.params.uri))
    if widget is None:
        return types.ServerResult(
            types.ReadResourceResult(
                contents=[],
                _meta={"error": f"Unknown resource: {req.params.uri}"},
            )
        )

    # Rewrite HTML to use correct paths for JS/CSS files
    # Handles multiple cases:
    # - http://localhost:4444/file.js -> /assets/file.js or BASE_URL/assets/file.js
    # - http://localhost:4444/assets/file.js -> /assets/file.js or BASE_URL/assets/file.js
    # - /file.js -> /assets/file.js or BASE_URL/assets/file.js
    html_content = widget.html
    import re
    
    base_url = os.getenv("BASE_URL", "").rstrip("/")
    
    def fix_asset_path(match):
        attr, path = match.group(1), match.group(2)
        # Remove leading slash if present, ensure assets/ prefix
        path = path.lstrip('/')
        if not path.startswith('assets/'):
            path = f'assets/{path}'
        
        if base_url:
            return f'{attr}="{base_url}/{path}"'
        else:
            return f'{attr}="/{path}"'
    
    # Pattern 1: localhost URLs (with or without assets/)
    html_content = re.sub(
        r'(src|href)="http://localhost:\d+/([^"]+\.(js|css))"',
        fix_asset_path,
        html_content
    )
    
    # Pattern 2: Absolute root paths
    html_content = re.sub(
        r'(src|href)="/([^"]+\.(js|css))"',
        fix_asset_path,
        html_content
    )
    
    # Pattern 3: BASE_URL paths (if set)
    if base_url:
        html_content = re.sub(
            rf'(src|href)="{re.escape(base_url)}/(?!assets/)([^"]+\.(js|css))"',
            fix_asset_path,
            html_content
        )

    # Inject server base URL for proxy configuration
    # This allows the frontend to know the server URL for proxy requests
    # Use BASE_URL from environment if available, otherwise use empty string (relative URLs)
    server_url = base_url or ""
    
    # Inject script to set server URL before closing </head> or before </body>
    injection_script = f"""<script>
    // Inject server base URL for image proxy configuration
    if (typeof window !== 'undefined') {{
      window.__GDO_SERVER_URL__ = {repr(server_url)};
      console.log('[Server] Injected server base URL:', window.__GDO_SERVER_URL__);
    }}
    </script>"""
    
    # Try to inject before </head>, if not found inject before </body>
    if "</head>" in html_content:
        html_content = html_content.replace("</head>", injection_script + "\n</head>", 1)
    elif "</body>" in html_content:
        html_content = html_content.replace("</body>", injection_script + "\n</body>", 1)
    else:
        # If no head or body tag, prepend to HTML
        html_content = injection_script + "\n" + html_content

    contents = [
        types.TextResourceContents(
            uri=widget.template_uri,
            mimeType=MIME_TYPE,
            text=html_content,
            _meta=_tool_meta(widget),
        )
    ]

    return types.ServerResult(types.ReadResourceResult(contents=contents))


async def _call_tool_request(req: types.CallToolRequest) -> types.ServerResult:
    """
    Gestisce le richieste di esecuzione tool con logging per audit.
    
    Logs:
    - Tool name e arguments (senza dati sensibili)
    - Timestamp dell'esecuzione
    - Successo/errore dell'esecuzione
    - Durata dell'esecuzione (se possibile)
    """
    tool_name = req.params.name
    arguments = req.params.arguments or {}
    start_time = datetime.now()
    
    # Log inizio esecuzione tool (senza dati sensibili)
    logger.info(
        f"Tool execution started: tool={tool_name}, "
        f"arguments_keys={list(arguments.keys()) if arguments else 'none'}"
    )
    
    # Gestione speciale per get_instructions (non è un widget)
    if tool_name == "get_instructions":
        try:
            # Valida che non ci siano argomenti inattesi
            if arguments:
                logger.warning(
                    f"Tool {tool_name}: Received unexpected arguments: {list(arguments.keys())}. "
                    "Ignoring arguments as this tool does not require input."
                )
            
            # Leggi il file prompts/instructions.md
            # Il file è nella root del progetto, non nella directory gdo_server_python
            instructions_path = Path(__file__).resolve().parent.parent / "prompts" / "instructions.md"
            
            if not instructions_path.exists():
                error_msg = f"Instructions file not found: {instructions_path}"
                logger.error(f"Tool {tool_name}: {error_msg}")
                return types.ServerResult(
                    types.CallToolResult(
                        content=[
                            types.TextContent(
                                type="text",
                                text=error_msg,
                            )
                        ],
                        isError=True,
                    )
                )
            
            # Leggi il contenuto del file
            instructions_text = instructions_path.read_text(encoding="utf-8")
            logger.info(f"Tool {tool_name}: Successfully read instructions from {instructions_path}")
            
            result = types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=instructions_text,
                        )
                    ],
                    structuredContent={},
                )
            )
            
            # Log successo esecuzione
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"Tool execution completed: tool={tool_name}, "
                f"success=True, duration={duration:.3f}s"
            )
            
            return result
            
        except Exception as e:
            error_msg = f"Error reading instructions file: {str(e)}"
            logger.error(f"Tool {tool_name}: {error_msg}", exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )
    
    if tool_name == "cross_sell_recommendations":
        try:
            cross_sell_input = CrossSellRequestInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        try:
            products = await get_products_from_motherduck()
            if products:
                suggestions = _get_cross_sell_suggestions_from_db(
                    cross_sell_input.cart_items,
                    products,
                    cross_sell_input.max_results,
                )
                if not suggestions:
                    suggestions = _get_cross_sell_suggestions(
                        cross_sell_input.cart_items,
                        CROSS_SELL_FALLBACK_CATALOG,
                    )[: cross_sell_input.max_results]
            else:
                suggestions = _get_cross_sell_suggestions(
                    cross_sell_input.cart_items,
                    CROSS_SELL_FALLBACK_CATALOG,
                )[: cross_sell_input.max_results]
        except Exception as e:
            error_msg = f"Error generating cross-sell suggestions: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="Cross-sell suggestions generated.",
                    )
                ],
                structuredContent={"suggestions": suggestions},
            )
        )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )

        return result

    if tool_name == "create_checkout_session":
        try:
            checkout_input = CheckoutSessionInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )
        
        stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
        if not stripe_secret_key:
            error_msg = "STRIPE_SECRET_KEY non configurata. Imposta la variabile d'ambiente per creare la Checkout Session."
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )
        
        stripe.api_key = stripe_secret_key
        currency = checkout_input.currency.lower()
        
        line_items = []
        for item in checkout_input.items:
            unit_amount = _to_minor_amount(item.unit_amount_major, currency)
            if unit_amount <= 0:
                error_msg = f"Invalid unit_amount for item '{item.name}'."
                logger.warning(error_msg)
                return types.ServerResult(
                    types.CallToolResult(
                        content=[
                            types.TextContent(
                                type="text",
                                text=error_msg,
                            )
                        ],
                        isError=True,
                    )
                )
            product_data = {"name": item.name}
            if item.description:
                product_data["description"] = item.description
            line_items.append(
                {
                    "price_data": {
                        "currency": currency,
                        "product_data": product_data,
                        "unit_amount": unit_amount,
                    },
                    "quantity": item.quantity,
                }
            )
        
        metadata = dict(checkout_input.metadata or {})
        if checkout_input.billing_details:
            for key, value in checkout_input.billing_details.items():
                if value:
                    metadata[f"billing_{key}"] = value
        
        customer_email = checkout_input.customer_email.strip() if checkout_input.customer_email else None
        
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                line_items=line_items,
                success_url=checkout_input.success_url,
                cancel_url=checkout_input.cancel_url,
                customer_email=customer_email,
                billing_address_collection="required",
                metadata=metadata,
            )
        except Exception as e:
            error_msg = f"Error creating checkout session: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )
        
        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="Checkout session creata con successo.",
                    )
                ],
                structuredContent={
                    "id": session.id,
                    "url": session.url,
                    "currency": session.currency,
                    "amount_total": session.amount_total,
                },
            )
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )
        
        return result

    if tool_name == "checkout_create_session":
        try:
            checkout_input = CheckoutCreateSessionInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        cached = _get_idempotent_response(checkout_input.idempotency_key, "create")
        if cached:
            cached_session = CheckoutSession.model_validate_json(cached)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text="Idempotent response (cached).",
                        )
                    ],
                    structuredContent=cached_session.model_dump(),
                )
            )

        stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
        if not stripe_secret_key:
            error_msg = "STRIPE_SECRET_KEY non configurata. Imposta la variabile d'ambiente per creare il PaymentIntent."
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        stripe.api_key = stripe_secret_key
        currency = checkout_input.currency.lower()

        try:
            totals = _compute_checkout_totals(
                checkout_input.items,
                currency,
                checkout_input.promo_code,
            )
        except Exception as e:
            error_msg = f"Error computing totals: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        cart = CheckoutCart(items=checkout_input.items, totals=totals)

        try:
            pi = create_payment_intent(
                amount_minor=totals.grand_total_minor,
                currency=currency,
                buyer_email=checkout_input.buyer_email,
                shared_payment_token=checkout_input.shared_payment_token,
                metadata={
                    "purpose": "acp_demo",
                    "items": json.dumps([item.model_dump() for item in checkout_input.items]),
                },
            )
        except Exception as e:
            error_msg = f"Error creating payment intent: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        session_id = str(uuid.uuid4())
        CHECKOUT_SESSIONS[session_id] = {
            "status": "requires_confirmation",
            "payment_intent_id": pi["id"],
            "buyer_email": checkout_input.buyer_email,
            "currency": checkout_input.currency,
            "items": [item.model_dump() for item in checkout_input.items],
            "promo_code": checkout_input.promo_code,
            "totals_json": cart.totals.model_dump_json(),
        }

        session_obj = _serialize_checkout_session(
            session_id,
            "requires_confirmation",
            cart,
            pi["id"],
        )

        if checkout_input.idempotency_key:
            _save_idempotent_response(
                checkout_input.idempotency_key,
                "create",
                session_obj.model_dump_json(),
            )

        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=session_obj.model_dump_json(),
                    )
                ],
                structuredContent=session_obj.model_dump(),
            )
        )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )

        return result

    if tool_name == "checkout_update_session":
        try:
            update_input = CheckoutUpdateSessionInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        session = CHECKOUT_SESSIONS.get(update_input.session_id)
        if not session:
            error_msg = "Session not found"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        items = (
            update_input.items
            if update_input.items is not None
            else [CheckoutCartItemInput(**item) for item in session["items"]]
        )
        currency = update_input.currency or session["currency"]
        promo_code = (
            update_input.promo_code
            if update_input.promo_code is not None
            else session["promo_code"]
        )

        try:
            totals = _compute_checkout_totals(items, currency, promo_code)
        except Exception as e:
            error_msg = f"Error computing totals: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        cart = CheckoutCart(items=items, totals=totals)
        session.update(
            {
                "currency": currency,
                "items": [item.model_dump() for item in items],
                "promo_code": promo_code,
                "totals_json": cart.totals.model_dump_json(),
            }
        )

        session_obj = _serialize_checkout_session(
            update_input.session_id,
            "requires_confirmation",
            cart,
            session.get("payment_intent_id"),
        )

        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=session_obj.model_dump_json(),
                    )
                ],
                structuredContent=session_obj.model_dump(),
            )
        )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )

        return result

    if tool_name == "checkout_complete_session":
        try:
            complete_input = CheckoutCompleteSessionInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        cached = _get_idempotent_response(complete_input.idempotency_key, "complete")
        if cached:
            cached_response = CheckoutCompleteResponse.model_validate_json(cached)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text="Idempotent response (cached).",
                        )
                    ],
                    structuredContent=cached_response.model_dump(),
                )
            )

        session = CHECKOUT_SESSIONS.get(complete_input.session_id)
        if not session:
            error_msg = "Session not found"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        items = [CheckoutCartItemInput(**item) for item in session["items"]]
        totals = CheckoutCartTotals.model_validate_json(session["totals_json"])
        cart = CheckoutCart(items=items, totals=totals)

        try:
            payment_result = confirm_payment_intent(session["payment_intent_id"])
        except Exception as e:
            error_msg = f"Error confirming payment intent: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        new_status = "succeeded" if payment_result.get("status") == "succeeded" else "failed"
        session["status"] = new_status

        response_obj = CheckoutCompleteResponse(
            id=complete_input.session_id,
            status=new_status,
            cart=cart,
            payment_intent_id=session.get("payment_intent_id"),
        )

        if complete_input.idempotency_key:
            _save_idempotent_response(
                complete_input.idempotency_key,
                "complete",
                response_obj.model_dump_json(),
            )

        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=response_obj.model_dump_json(),
                    )
                ],
                structuredContent=response_obj.model_dump(),
            )
        )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )

        return result

    if tool_name == "create_payment_intent":
        try:
            pi_input = CreatePaymentIntentInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
        if not stripe_secret_key:
            error_msg = "STRIPE_SECRET_KEY non configurata. Imposta la variabile d'ambiente per creare il PaymentIntent."
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        stripe.api_key = stripe_secret_key

        try:
            pi = create_payment_intent(
                amount_minor=pi_input.amount_minor,
                currency=pi_input.currency.lower(),
                buyer_email=pi_input.buyer_email,
                shared_payment_token=pi_input.shared_payment_token,
                metadata=pi_input.metadata,
            )
        except Exception as e:
            error_msg = f"Error creating payment intent: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="PaymentIntent creato con successo.",
                    )
                ],
                structuredContent={
                    "id": pi.id,
                    "client_secret": pi.client_secret,
                    "status": pi.status,
                },
            )
        )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )

        return result

    if tool_name == "confirm_payment_intent":
        try:
            confirm_input = ConfirmPaymentIntentInput.model_validate(arguments or {})
        except ValidationError as e:
            error_msg = f"Invalid input for {tool_name}: {str(e)}"
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        stripe_secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
        if not stripe_secret_key:
            error_msg = "STRIPE_SECRET_KEY non configurata. Imposta la variabile d'ambiente per confermare il PaymentIntent."
            logger.warning(error_msg)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        stripe.api_key = stripe_secret_key

        try:
            pi = confirm_payment_intent(confirm_input.payment_intent_id)
        except Exception as e:
            error_msg = f"Error confirming payment intent: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=error_msg,
                        )
                    ],
                    isError=True,
                )
            )

        result = types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="PaymentIntent confermato con successo.",
                    )
                ],
                structuredContent={
                    "id": pi.id,
                    "status": pi.status,
                },
            )
        )

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, success=True, duration={duration:.3f}s"
        )

        return result
    
    widget = WIDGETS_BY_ID.get(tool_name)
    if widget is None:
        error_msg = f"Unknown tool: {tool_name}"
        logger.warning(f"Tool execution failed: tool={tool_name}, error={error_msg}")
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=error_msg,
                    )
                ],
                isError=True,
            )
        )

    try:
        # Estrai i parametri dagli argomenti
        category = arguments.get("category") if arguments else None
        size_inches = arguments.get("size_inches") if arguments else None
        target_price = arguments.get("target_price") if arguments else None
        max_price = arguments.get("max_price") if arguments else None
        min_price = arguments.get("min_price") if arguments else None
        keywords = arguments.get("keywords") if arguments else None
        
        # Costruisci il dizionario dei criteri di ordinamento
        criteria = {}
        if size_inches is not None:
            criteria["size_inches"] = int(size_inches) if isinstance(size_inches, (int, float, str)) else None
        if target_price is not None:
            criteria["target_price"] = float(target_price) if isinstance(target_price, (int, float, str)) else None
        if max_price is not None:
            criteria["max_price"] = float(max_price) if isinstance(max_price, (int, float, str)) else None
        if min_price is not None:
            criteria["min_price"] = float(min_price) if isinstance(min_price, (int, float, str)) else None
        if keywords:
            criteria["keywords"] = keywords if isinstance(keywords, list) else [keywords] if keywords else []
        
        # Rimuovi valori None dal dizionario criteri
        criteria = {k: v for k, v in criteria.items() if v is not None and v != []}
        
        if category:
            logger.info(f"Tool {tool_name}: Category filter requested: '{category}'")
        if criteria:
            logger.info(f"Tool {tool_name}: Ranking criteria: {criteria}")
        
        if tool_name == "product-list":
            # Tool che richiede accesso a MotherDuck
            logger.info(f"Tool {tool_name}: Fetching products from MotherDuck")
            products = await get_products_from_motherduck(category=category)
            product_count = len(products) if products else 0
            if product_count == 0:
                # Se la lista è vuota, potrebbe essere dovuto a:
                # 1. Errore precedente (pandas mancante, token mancante, ecc.) - già loggato come ERROR/WARNING
                # 2. Database vuoto - comportamento normale
                logger.warning(
                    f"Tool {tool_name}: No products retrieved from MotherDuck. "
                    "Widget will display empty products list. "
                    "Check previous logs for errors (e.g., pandas missing, MOTHERDUCK_TOKEN not configured, or database connection issues)."
                )
            else:
                logger.info(f"Tool {tool_name}: Retrieved {product_count} products from MotherDuck")
            
            result = types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=widget.response_text,
                        )
                    ],
                    structuredContent={"products": products},
                    _meta=_tool_invocation_meta(widget),
                )
            )
        elif tool_name == "gdo-albums":
            # Widget che usa formato 'albums' - recupera prodotti e trasforma in albums
            # IMPORTANTE: Se viene passata una categoria, mostra SOLO i prodotti di quella categoria
            # Non aggiungere mai prodotti di altre categorie per "riempire" la galleria
            logger.info(f"Tool {tool_name}: Fetching products from MotherDuck and transforming to albums")
            products = await get_products_from_motherduck(category=category)
            if category:
                logger.info(
                    f"Tool {tool_name}: Filtered {len(products)} products for category '{category}'. "
                    "Showing only filtered products (no unrelated products will be added)."
                )
            albums = transform_products_to_albums(products, criteria=criteria if criteria else None)
            album_count = len(albums) if albums else 0
            if album_count == 0:
                # Se la lista è vuota, potrebbe essere dovuto a:
                # 1. Errore precedente (pandas mancante, token mancante, ecc.) - già loggato come ERROR/WARNING
                # 2. Database vuoto - comportamento normale
                logger.warning(
                    f"Tool {tool_name}: No products retrieved from MotherDuck. "
                    "Widget will display empty albums list. "
                    "Check previous logs for errors (e.g., pandas missing, MOTHERDUCK_TOKEN not configured, or database connection issues)."
                )
            else:
                logger.info(f"Tool {tool_name}: Retrieved {len(products)} products, transformed to {album_count} albums")
            
            # Note: category parameter is expected and already processed above
            # No need to warn about expected arguments
            
            result = types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=widget.response_text,
                        )
                    ],
                    structuredContent={"albums": albums},
                    _meta=_tool_invocation_meta(widget),
                )
            )
        elif tool_name in ["gdo-carousel", "gdo-map", "gdo-list", "mixed-auth-search"]:
            # Widget che usano formato 'places' - recupera prodotti e trasforma in places
            # IMPORTANTE: Se viene passata una categoria, mostra SOLO i prodotti di quella categoria
            # Non aggiungere mai prodotti di altre categorie per "riempire" la lista/carosello
            logger.info(f"Tool {tool_name}: Fetching products from MotherDuck and transforming to places")
            products = await get_products_from_motherduck(category=category)
            
            # Limiti per evitare risposte troppo grandi
            MAX_CAROUSEL_PRODUCTS = 6
            MAX_LIST_PRODUCTS = 100  # Limite per gdo-list per evitare risposte troppo grandi
            
            # Per gdo-carousel, limita a 6 prodotti se viene passata una categoria
            # IMPORTANTE: Non aggiungere prodotti di altre categorie se il filtro ne trova meno di 6
            # Il limite è un MASSIMO, non un obbligo - se ci sono solo 3 prodotti filtrati, mostra solo quelli
            if category and tool_name != "gdo-carousel":
                logger.info(
                    f"Tool {tool_name}: Filtered {len(products)} products for category '{category}'. "
                    "Showing only filtered products (no unrelated products will be added)."
                )
            
            if tool_name == "gdo-carousel" and category:
                original_count = len(products)
                if original_count > MAX_CAROUSEL_PRODUCTS:
                    products = products[:MAX_CAROUSEL_PRODUCTS]
                    logger.info(
                        f"Tool {tool_name}: Limited products from {original_count} to {len(products)} "
                        f"(max {MAX_CAROUSEL_PRODUCTS} for carousel with category filter)"
                    )
                else:
                    logger.info(
                        f"Tool {tool_name}: Found {original_count} products for category '{category}' "
                        f"(showing all {original_count}, no need to add unrelated products)"
                    )
            
            # Per gdo-list, limita il numero di prodotti se non c'è un filtro categoria
            # per evitare risposte troppo grandi che causano errori HTTP
            if tool_name == "gdo-list" and not category:
                original_count = len(products)
                if original_count > MAX_LIST_PRODUCTS:
                    products = products[:MAX_LIST_PRODUCTS]
                    logger.info(
                        f"Tool {tool_name}: Limited products from {original_count} to {len(products)} "
                        f"(max {MAX_LIST_PRODUCTS} for list without category filter to avoid large responses)"
                    )
            
            # Trasforma i prodotti in places, applicando l'ordinamento basato sui criteri
            places = transform_products_to_places(products, criteria=criteria if criteria else None)
            place_count = len(places) if places else 0
            if place_count == 0:
                # Se la lista è vuota, potrebbe essere dovuto a:
                # 1. Errore precedente (pandas mancante, token mancante, ecc.) - già loggato come ERROR/WARNING
                # 2. Database vuoto - comportamento normale
                # 3. Filtro categoria che non ha trovato prodotti
                logger.warning(
                    f"Tool {tool_name}: No products retrieved from MotherDuck. "
                    "Widget will display empty places list. "
                    "Check previous logs for errors (e.g., pandas missing, MOTHERDUCK_TOKEN not configured, or database connection issues)."
                )
            else:
                logger.info(f"Tool {tool_name}: Retrieved {len(products)} products, transformed to {place_count} places")
            
            # Note: category parameter is expected and already processed above
            # No need to warn about expected arguments
            
            result = types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=widget.response_text,
                        )
                    ],
                    structuredContent={"places": places},
                    _meta=_tool_invocation_meta(widget),
                )
            )
        elif tool_name == "gdo-shop":
            # gdo-shop recupera prodotti dal database MotherDuck e li trasforma in places
            # IMPORTANTE: Se viene passata una categoria, mostra SOLO i prodotti di quella categoria
            logger.info(f"Tool {tool_name}: Fetching products from MotherDuck and transforming to places")
            products = await get_products_from_motherduck(category=category)
            
            # Limita a MAX_PRODUCTS_SHOP (24) per evitare risposte troppo grandi
            MAX_SHOP_PRODUCTS = 24
            original_count = len(products)
            if original_count > MAX_SHOP_PRODUCTS:
                products = products[:MAX_SHOP_PRODUCTS]
                logger.info(
                    f"Tool {tool_name}: Limited products from {original_count} to {len(products)} "
                    f"(max {MAX_SHOP_PRODUCTS} for shop)"
                )
            
            if category:
                logger.info(
                    f"Tool {tool_name}: Filtered {len(products)} products for category '{category}'. "
                    "Showing only filtered products (no unrelated products will be added)."
                )
            
            # Trasforma i prodotti in places, applicando l'ordinamento basato sui criteri
            places = transform_products_to_places(products, criteria=criteria if criteria else None)
            place_count = len(places) if places else 0
            if place_count == 0:
                logger.warning(
                    f"Tool {tool_name}: No products retrieved from MotherDuck. "
                    "Widget will display empty places list. "
                    "Check previous logs for errors (e.g., pandas missing, MOTHERDUCK_TOKEN not configured, or database connection issues)."
                )
            else:
                logger.info(f"Tool {tool_name}: Retrieved {len(products)} products, transformed to {place_count} places")
            
            result = types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=widget.response_text,
                        )
                    ],
                    structuredContent={"places": places},
                    _meta=_tool_invocation_meta(widget),
                )
            )
        else:
            # Widget di visualizzazione che non richiedono input e non usano database
            # Valida che non ci siano argomenti inattesi
            if arguments:
                logger.warning(
                    f"Tool {tool_name}: Received unexpected arguments: {list(arguments.keys())}. "
                    "Ignoring arguments as this tool does not require input."
                )
            
            result = types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=widget.response_text,
                        )
                    ],
                    structuredContent={},
                    _meta=_tool_invocation_meta(widget),
                )
            )
        
        # Log successo esecuzione
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"Tool execution completed: tool={tool_name}, "
            f"success=True, duration={duration:.3f}s"
        )
        
        return result
        
    except Exception as e:
        # Log errore esecuzione
        duration = (datetime.now() - start_time).total_seconds()
        logger.error(
            f"Tool execution failed: tool={tool_name}, "
            f"error={str(e)}, duration={duration:.3f}s",
            exc_info=True
        )
        
        # Restituisci errore all'utente
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Error executing tool {tool_name}: {str(e)}",
                    )
                ],
                isError=True,
            )
        )


mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request
mcp._mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource


# Expose the FastAPI app for uvicorn
# For SSE transport (used by ChatGPT SDK), use sse_app()
# For Streamable HTTP transport, use streamable_http_app()
app = mcp.sse_app()

# Aggiungi middleware CORS all'app (deve essere prima di CSP)
# Il middleware CORS permette il caricamento di risorse (JS, CSS) da origini diverse
# necessario quando il widget viene caricato da ChatGPT che ha un'origine diversa
# Usa wrapping diretto invece di add_middleware per middleware ASGI nativi
app = CORSMiddleware(app)

# Aggiungi middleware CSP all'app
# Il middleware aggiunge Content Security Policy headers per prevenire attacchi XSS
app = CSPMiddleware(app)

# Root route handler - provides information about available endpoints
async def root_handler(request):
    """Root endpoint that provides information about the server."""
    widget_names = [w.identifier for w in widgets]
    widgets_list = "\n".join([f"    <li><code>{name}</code> - {WIDGETS_BY_ID[name].title}</li>" for name in widget_names])
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>GDO MCP Server</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        h1 {{ color: #2563eb; }}
        code {{
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: ui-monospace, monospace;
        }}
        ul {{ padding-left: 20px; }}
        .endpoint {{ 
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }}
        .endpoint strong {{ color: #059669; }}
    </style>
</head>
<body>
    <h1>GDO MCP Server</h1>
    <p>Version: <code>{__version__}</code></p>
    <p>MCP Protocol Version: 2024-11-05</p>
    
    <h2>Available Endpoints</h2>
    <div class="endpoint">
        <strong>GET /</strong> - This page (server information)
    </div>
    <div class="endpoint">
        <strong>GET /sse</strong> - SSE stream for MCP protocol (main endpoint)
    </div>
    <div class="endpoint">
        <strong>GET /mcp</strong> - SSE stream for MCP protocol (internal, redirected from /sse)
    </div>
    <div class="endpoint">
        <strong>GET /assets/*</strong> - Static files (HTML, JS, CSS) from the assets directory
    </div>
    <div class="endpoint">
        <strong>GET /proxy-image?url=...</strong> - Proxy per immagini esterne (risolve problema ORB/CORS). 
        Accetta parametro <code>url</code> (URL-encoded) dell'immagine da proxyare.
    </div>
    
    <h2>Available Widgets ({len(widgets)})</h2>
    <ul>
{widgets_list}
    </ul>
    
    <h2>Documentation</h2>
    <p>See <code>gdo_server_python/README.md</code> for more information.</p>
</body>
</html>"""
    return StarletteHTMLResponse(content=html_content)

# Health check endpoint - returns 200 OK for health checks (useful for Render, etc.)
async def health_handler(request):
    """Health check endpoint for monitoring and load balancers."""
    return Response(content="OK", status_code=200, media_type="text/plain")

# Serve static files from assets directory
if ASSETS_DIR.exists():
    # Serve from /assets/ for explicit asset access
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR), html=False), name="assets")
    logger.info(f"Static files available at /assets/ (serving from {ASSETS_DIR})")
else:
    logger.warning(f"Assets directory not found at {ASSETS_DIR}. Static files will not be served.")

# Add routes using Starlette's add_route (since sse_app() returns a Starlette app, not FastAPI)
app.add_route("/", root_handler, methods=["GET"])
app.add_route("/health", health_handler, methods=["GET"])
app.add_route("/proxy-image", proxy_image_handler, methods=["GET"])
app.add_route("/proxy-image", proxy_image_options_handler, methods=["OPTIONS"])

# Aggiungi middleware per bypassare completamente le richieste SSE/messages
# Deve essere l'ultimo middleware wrappato per intercettare le richieste prima che
# BaseHTTPMiddleware processi il body (che causa errori con risposte SSE)
# IMPORTANTE: deve essere fatto DOPO tutte le configurazioni di route e mount
app = SSEBypassMiddleware(app)


if __name__ == "__main__":
    """
    Permette di eseguire il server direttamente con: python main.py
    Per produzione, usa invece: uvicorn gdo_server_python.main:app --host 0.0.0.0 --port $PORT
    """
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "127.0.0.1")
    
    logger.info(f"Starting server on {host}:{port}")
    logger.info(f"Access the server at http://{host}:{port}")
    logger.info(f"MCP endpoint: http://{host}:{port}/mcp")
    
    uvicorn.run(app, host=host, port=port)

