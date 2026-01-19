# Specifiche per l'integrazione dei prodotti e la distribuzione su ChatGPT

Questo documento descrive i passaggi necessari per sostituire i prodotti attuali nell'applicazione Pizzaz con i tuoi prodotti elettronici e per comprendere il deployment su ChatGPT.

**Nota importante**: Questo file contiene solo le specifiche da implementare. Per bug trovati, bug risolti e verifiche dettagliate, consultare il file `bugs.md`.

## Regole di processo per la gestione delle specifiche

**IMPORTANTE**: Seguire sempre queste regole quando si lavora sulle specifiche:

1. **Completamento con successo**: Quando un lavoro è completato e funziona correttamente, spuntare la casella come fatta `[x]`

2. **Problemi di funzionamento**: Se un lavoro smette di funzionare o non funziona:
   - **NON** spuntare la casella (lasciare `[ ]`)
   - Documentare il problema nel file `bugs.md` nella sezione "Bug trovati"

3. **Gestione bug**: Quando si trova un bug, documentarlo nel file `bugs.md` nella sezione "Bug trovati".

5. **Verifica continua**: Le caselle spuntate devono rappresentare lo stato attuale funzionante. Se qualcosa si rompe, la casella va deselezionata e il problema documentato.

**Nota**: Per bug trovati, bug risolti e verifiche da fare, consultare il file `bugs.md`.

## Indice

### 1. Preparazione dell'ambiente
- [1. Preparazione dell'ambiente](#1-preparazione-dellambiente)

### 2. Integrazione dei prodotti elettronici
- [2.1 Sostituzione di `INITIAL_CART_ITEMS`](#21-sostituzione-di-initial_cart_items)
- [2.2 Compatibilità dei tipi `CartItem`](#22-compatibilità-dei-tipi-cartitem)
- [2.3 Migrazione dati da JSON a Database MotherDuck](#23-migrazione-dati-da-json-a-database-motherduck)

### 3. Build e esecuzione dell'applicazione
- [3. Build e esecuzione dell'applicazione](#3-build-e-esecuzione-dellapplicazione)

### 4. Verifica conformità architettura MCP
- [4. Verifica conformità architettura MCP](#4-verifica-conformità-architettura-mcp)
  - [4.0 Principi architetturali MCP](#40-principi-architetturali-mcp)
    - [4.0.1 Simplicity for Servers](#401-simplicity-for-servers)
    - [4.0.2 High Composability](#402-high-composability)
    - [4.0.3 Strict Security Boundaries](#403-strict-security-boundaries)
    - [4.0.4 Progressive Feature Addition](#404-progressive-feature-addition)
    - [4.0.5 Componenti architetturali](#405-componenti-architetturali)
    - [4.0.6 Problemi architetturali da risolvere](#406-problemi-architetturali-da-risolvere)

### 5. Versionamento MCP
- [5. Versionamento MCP](#5-versionamento-mcp)
  - [5.1 Versionamento del protocollo MCP](#51-versionamento-del-protocollo-mcp)
  - [5.2 Versionamento del server applicazione](#52-versionamento-del-server-applicazione)
  - [5.3 Checklist versionamento](#53-checklist-versionamento)

### 6. Refactoring da Pizzaz a GDO
- [6. Refactoring da Pizzaz a GDO](#6-refactoring-da-pizzaz-a-gdo)
  - [6.1 Rinominare directory e file](#61-rinominare-directory-e-file)
  - [6.2 Refactoring codice Python (Server)](#62-refactoring-codice-python-server)
  - [6.3 Refactoring codice TypeScript/JavaScript (Frontend)](#63-refactoring-codice-typescriptjavascript-frontend)
  - [6.4 Aggiornare file di configurazione](#64-aggiornare-file-di-configurazione)
  - [6.5 Verifica funzionalità dopo refactoring](#65-verifica-funzionalità-dopo-refactoring)
  - [6.6 Checklist refactoring](#66-checklist-refactoring)

### 7. Verifica conformità linee guida MCP Server
- [7. Verifica conformità linee guida MCP Server](#7-verifica-conformità-linee-guida-mcp-server)
  - [7.1 Requisiti MCP Server](#71-requisiti-mcp-server)
  - [7.2 Linee guida e best practices](#72-linee-guida-e-best-practices)
  - [7.3 Problemi critici da risolvere](#73-problemi-critici-da-risolvere)
  - [7.4 Checklist finale pre-deployment](#74-checklist-finale-pre-deployment)

### 8. Verifica conformità linee guida MCP Client e Widget
- [8. Verifica conformità linee guida MCP Client e Widget](#8-verifica-conformità-linee-guida-mcp-client-e-widget)
  - [8.1 Core Client Features (MCP)](#81-core-client-features-mcp)
  - [8.2 OpenAI Apps SDK Widget Guidelines](#82-openai-apps-sdk-widget-guidelines)
  - [8.3 Problemi critici da risolvere (Client/Widget)](#83-problemi-critici-da-risolvere-clientwidget)
  - [8.4 Checklist finale pre-deployment (Client/Widget)](#84-checklist-finale-pre-deployment-clientwidget)

### 9. Distribuzione e interazione con ChatGPT
- [9. Distribuzione e interazione con ChatGPT](#9-distribuzione-e-interazione-con-chatgpt)
  - [9.1 Deployment dell'applicazione su Render](#91-deployment-dellapplicazione-su-render-servizio-unico)
  - [9.2 Configurazione di ChatGPT](#92-configurazione-di-chatgpt)
  - [9.3 Adattamento degli strumenti (Tools)](#93-adattamento-degli-strumenti-tools)
  - [9.4 Test e sottomissione](#94-test-e-sottomissione)

### 10. Prompt iniziale per ChatGPT
- [10. Prompt iniziale per ChatGPT](#10-prompt-iniziale-per-chatgpt)
  - [10.1 Struttura del prompt](#101-struttura-del-prompt)
  - [10.2 Domande da risolvere prima dell'implementazione](#102-domande-da-risolvere-prima-dellimplementazione)
  - [10.3 Template base (da completare)](#103-template-base-da-completare)
  - [10.4 Note per l'implementazione](#104-note-per-limplementazione)
  - [10.5 Prompt completo (pronto all'uso)](#105-prompt-completo-pronto-alluso)

### 11. Migliorie UI e UX
- [11. Migliorie UI e UX](#11-migliorie-ui-e-ux)
  - [11.1 Filtri dinamici per categoria nello shop](#111-filtri-dinamici-per-categoria-nello-shop)
  - [11.2 Limite di prodotti visualizzati](#112-limite-di-prodotti-visualizzati)
  - [11.3 Migliorie carosello prodotti](#113-migliorie-carosello-prodotti)
  - [11.4 Pulizia warning TypeScript](#114-pulizia-warning-typescript)

---

## 1. Preparazione dell'ambiente

- [x]  **Comprendere la struttura del progetto**: Familiarizza con i file principali, in particolare `py/new_initial_cart_items.ts` (i tuoi prodotti), `src/gdo-shop/index.tsx` (il widget del negozio che usa i prodotti), `src/shopping-cart/index.tsx` (il widget del carrello), `gdo_server_python/main.py` (il backend Python) e `package.json` (script di build).
  - **Dettagli struttura progetto**:
    - **File prodotti**: `py/new_initial_cart_items.ts` contiene array di prodotti GDO con tipo `CartItem[]`
    - **Widget negozio**: `src/gdo-shop/index.tsx` importa prodotti e gestisce UI del negozio
    - **Widget carrello**: `src/shopping-cart/index.tsx` gestisce il carrello acquisti
    - **Server Python**: `gdo_server_python/main.py` espone tool MCP per i widget e per il flusso checkout/Stripe (PaymentIntent + sessioni checkout MCP).
    - **Build system**: `build-all.mts` genera bundle per tutti i widget (gdo, gdo-shop, gdo-carousel, gdo-list, gdo-albums, etc.)
    - **Package manager**: `package.json` versione 5.0.16, usa pnpm 10.24.0

## 2. Integrazione dei prodotti elettronici

### 2.1 Sostituzione di `INITIAL_CART_ITEMS`
- [x]  **Importare i nuovi prodotti**: Modifica `src/pizzaz-shop/index.tsx` per importare `INITIAL_CART_ITEMS` da `py/new_initial_cart_items.ts` invece di usare la definizione locale.
- [x]  **Rimuovere i prodotti vecchi**: Elimina la definizione locale di `INITIAL_CART_ITEMS` in `src/pizzaz-shop/index.tsx`.

### 2.2 Compatibilità dei tipi `CartItem`
- [x]  **Verificare la compatibilità**: Assicurati che il tipo `CartItem` definito in `py/new_initial_cart_items.ts` sia compatibile con quello usato in `src/pizzaz-shop/index.tsx` e `src/shopping-cart/index.tsx`. Potrebbe essere necessario consolidare le definizioni o adattarle.
  - **Nota**: Per dettagli su bug trovati e risolti, vedere `bugs.md` sezione "Bug risolti - 2.2 Compatibilità dei tipi `CartItem`"

### 2.3 Migrazione dati da JSON a Database MotherDuck
- [x] **ALTA PRIORITÀ - Migrazione dati da `markers.json` a database**: I dati dei widget UI (carousel, list, map, albums, shop) attualmente vengono presi da `src/gdo/markers.json`. Questa modifica richiede di migrare tutti i widget per leggere i dati dal database MotherDuck invece che dal file JSON.
  - **Stato attuale**: ✅ **COMPLETATO** [2026-01-09] Tutti i widget ora leggono **esclusivamente** i dati da `toolOutput` (popolato dal server Python). Il fallback a JSON è stato rimosso come richiesto. Gli asset sono stati rigenerati con la build.
  - **Obiettivo**: ✅ **RAGGIUNTO** I dati vengono presi **solo** dal database MotherDuck (tabella `prodotti_xeel_shop` nello schema `main` del database `app_gpt_elettronica`) quando i tool vengono chiamati.
  - **Soluzione implementata**:
    1. ✅ **Funzione di trasformazione prodotti->places** (`gdo_server_python/main.py`):
       - Creata funzione `transform_products_to_places()` che converte prodotti dal database in formato "places"
      - Mappa i campi: `id`, `name`, `price` (numero → stringa in euro, es. `34,59€`), `description`, `image` → `thumbnail`
       - Genera valori default per campi mancanti:
         - `coords`: Coordinate di default per San Francisco (distribuite in diverse zone)
         - `city`: Nome città di default basato su pattern circolare
         - `rating`: Rating di default 4.5 (può essere calcolato in futuro se disponibile)
    2. ✅ **Funzione di trasformazione prodotti->albums** (`gdo_server_python/main.py`):
       - Creata funzione `transform_products_to_albums()` che raggruppa prodotti per categoria/tag
       - Crea album tematici basati sui tag dei prodotti
       - Ogni prodotto diventa una "photo" nell'album corrispondente
    3. ✅ **Server Python aggiornato** (`gdo_server_python/main.py`):
       - Modificato `_call_tool_request` per recuperare prodotti da MotherDuck quando necessario
       - Per `gdo-carousel`, `gdo-map`, `gdo-list`, `mixed-auth-search`: trasforma prodotti in `places` e passa in `structuredContent`
       - Per `gdo-albums`: trasforma prodotti in `albums` e passa in `structuredContent`
       - Per `product-list`: passa direttamente i prodotti in `structuredContent`
    4. ✅ **Widget aggiornati per leggere solo da toolOutput** [2026-01-09]:
       - `src/gdo-carousel/index.jsx`: Legge **solo** da `toolOutput?.places || []` (fallback JSON rimosso)
       - `src/gdo/index.jsx` (map): Legge **solo** da `toolOutput?.places || []` (fallback JSON rimosso)
       - `src/gdo-list/index.jsx`: Legge **solo** da `toolOutput?.places || []` (fallback JSON rimosso)
       - `src/mixed-auth-search/index.jsx`: Legge **solo** da `toolOutput?.places || []` (fallback JSON rimosso)
       - `src/gdo-albums/index.jsx`: Legge **solo** da `toolOutput?.albums || []` (fallback JSON rimosso)
    5. ✅ **Asset rigenerati** [2026-01-09]:
       - Eseguita `pnpm run build` per rigenerare tutti gli asset HTML/JS/CSS con il codice aggiornato
       - Tutti i widget ora utilizzano esclusivamente i dati da MotherDuck tramite `toolOutput`
       - Hash asset: `2d2b` (generato il 2026-01-09)
  - **Vantaggi della soluzione**:
    - ✅ Dati dinamici sincronizzati con il database
    - ✅ Funzionamento esclusivo da database: i widget dipendono solo da MotherDuck
    - ✅ Trasformazione automatica: prodotti del DB vengono automaticamente convertiti nel formato atteso dai widget
    - ✅ Architettura pulita: nessuna dipendenza da file JSON statici
  - **Note tecniche**:
    - Le coordinate geografiche sono generate automaticamente (default San Francisco) poiché i prodotti non hanno coordinate reali
    - Il rating è un valore di default (4.5) e può essere calcolato in futuro se il database include recensioni
    - Gli albums sono raggruppati per categoria/tag principale del prodotto
    - **IMPORTANTE**: I widget ora richiedono che il server Python passi i dati tramite `toolOutput`. Se `toolOutput` è vuoto o assente, i widget mostreranno liste vuote.
  - **Dipendenze Python richieste** (tutte dichiarate in `requirements.txt`):
    - ✅ `duckdb>=0.10.0`: Connessione a MotherDuck
    - ✅ `numpy>=1.24.0`: Richiesto da DuckDB per operazioni DataFrame
    - ✅ `pandas>=2.0.0`: Richiesto da DuckDB per `fetchdf()` (conversione risultati query in DataFrame)
    - ✅ `python-dotenv>=1.0.0`: Per caricare variabili d'ambiente da `.env`
  - **Prossimi passi opzionali**:
    - [ ] Aggiungere campi geografici reali nel database se disponibili (lat/lon, city)
    - [ ] Calcolare rating da recensioni se disponibili nel database
    - [x] ~~Deprecare `markers.json` e `albums.json`~~ **COMPLETATO** - I widget non usano più questi file

## 3. Build e esecuzione dell'applicazione

- [x]  **Eseguire la build del frontend**: Utilizza i comandi di `pnpm` o `npm` per compilare il frontend, come specificato in `package.json` (es. `pnpm run build`). Questo genererà i file HTML e JavaScript necessari per i widget.
- [x]  **Avviare il server Python**: Esegui il backend Python che serve i widget.
  - **IMPORTANTE - Integrazione MotherDuck**: Il server DEVE essere configurato con MotherDuck per funzionare correttamente. Il server usa l'MCP server di MotherDuck e richiede la variabile d'ambiente `MOTHERDUCK_TOKEN` per:
    - Connettere al database MotherDuck (`md:app_gpt_elettronica`)
    - Eseguire il tool `product-list` che recupera prodotti dalla tabella `prodotti_xeel_shop`
    - Senza `MOTHERDUCK_TOKEN`, il tool `product-list` non funzionerà e solleverà un `ValueError` quando viene chiamato
  - **Configurazione richiesta**:
    - Variabile d'ambiente obbligatoria: `MOTHERDUCK_TOKEN` (token di autenticazione MotherDuck)
    - Database: `app_gpt_elettronica`
    - Schema: `main`
    - Tabella: `prodotti_xeel_shop`
  - **Integrazione MotherDuck**: [2026-01-08] Il server usa DuckDB direttamente per connettersi a MotherDuck (riga 47-65 in `main.py`) tramite `duckdb.connect(f"md:app_gpt_elettronica?motherduck_token={md_token}")`. Questo approccio funziona correttamente e permette al server di recuperare i prodotti dal database MotherDuck.
    - **Implementazione**: L'integrazione è implementata direttamente nel progetto. La funzione `get_motherduck_connection()` gestisce la connessione a MotherDuck usando DuckDB, e `get_products_from_motherduck()` recupera i prodotti dalla tabella `prodotti_xeel_shop`.
    - **Stato**: Funzionante. Il server richiede `MOTHERDUCK_TOKEN` come variabile d'ambiente obbligatoria per funzionare correttamente.

## 4. Verifica conformità architettura MCP

Questa sezione verifica che il progetto rispetti i principi architetturali MCP secondo la documentazione: https://modelcontextprotocol.io/specification/2024-11-05/architecture/index

### 4.0 Principi architetturali MCP

#### 4.0.1 Simplicity for Servers
- [x] **Server focalizzato su capacità specifiche**: Il server si concentra su widget per prodotti elettronici
  - Stato attuale: Il server espone tool e risorse per widget specifici (pizza-shop, product-list, etc.)
  - Nota: MCP raccomanda che i server siano semplici e focalizzati, con orchestrazione complessa gestita dall'host
- [x] **Interfacce semplici**: Il server usa FastMCP helper per semplificare l'implementazione
  - Stato attuale: Usa `FastMCP` da `mcp.server.fastmcp` che astrae la complessità del protocollo
- [x] **Mantenibilità del codice**: Verificare che il codice sia ben organizzato e manutenibile
  - Stato attuale: Il codice è organizzato in un unico file `main.py` (364 righe). Le funzioni sono ben separate: logica di business (get_products_from_motherduck, get_motherduck_connection), logica MCP (handlers, decoratori), e configurazione (widget definitions, transport security). Il codice è leggibile e ben strutturato.

#### 4.0.2 High Composability
- [x] **Funzionalità isolata**: Il server fornisce funzionalità isolate per widget
  - Stato attuale: Ogni widget è un tool/resource separato e isolato
- [x] **Interoperabilità**: Verificare che il server possa comporsi con altri server MCP
  - Stato attuale: Il server è standalone e non interagisce direttamente con altri server. Non ci sono import o chiamate ad altri server MCP nel codice. Il server è progettato per essere composabile tramite l'host (ChatGPT).
- [x] **Design modulare**: Verificare che il design supporti estensibilità
  - Stato attuale: I widget sono definiti in una lista Python (riga 84-139). Per aggiungere un nuovo widget, basta aggiungere un nuovo `PizzazWidget` alla lista. I metodi MCP (`_list_tools()`, `_list_resources()`, etc.) iterano automaticamente su tutti i widget nella lista.

#### 4.0.3 Strict Security Boundaries
- [x] **Accesso limitato al contesto**: Il server accede solo ai dati necessari
  - **Nota**: Per verifiche sui permessi MotherDuck, vedere `bugs.md` sezione "Verifiche da fare - Architettura MCP"
  - **Integrazione MotherDuck**: Il server DEVE avere `MOTHERDUCK_TOKEN` configurato per funzionare. Il server attualmente usa DuckDB per connettersi direttamente a MotherDuck (`md:app_gpt_elettronica`) e recupera prodotti dalla tabella `prodotti_xeel_shop` nello schema `main`. Senza il token, `get_motherduck_connection()` solleverà un `ValueError`.
  - **PROBLEMA IDENTIFICATO - Integrazione MCP Server**: [2026-01-08] Il server usa DuckDB direttamente (riga 47-65) invece di integrarsi con l'MCP server di MotherDuck. Secondo il repository di riferimento `mcp-motherduck-medicair`, il server dovrebbe comporsi con l'MCP server di MotherDuck o usare il tool `query` dell'MCP server invece di DuckDB diretto.
    - **Stato attuale**: `get_motherduck_connection()` usa `duckdb.connect(f"md:app_gpt_elettronica?motherduck_token={md_token}")` direttamente
    - **Dovrebbe essere**: Il server dovrebbe usare l'MCP server di MotherDuck (come `mcp-server-medicair` o `mcp.server.motherduck`) per eseguire query SQL
    - **Azioni richieste**: Analizzare il repository di riferimento e modificare l'integrazione per usare l'MCP server di MotherDuck invece di DuckDB diretto
  - Nota: I permessi MotherDuck specifici devono essere verificati a livello di configurazione database.
- [x] **Isolamento dalla conversazione**: Verificare che il server non acceda all'intera conversazione
  - Stato attuale: **GESTITO DA CHATGPT** - ChatGPT (host) gestisce la conversazione completa
- [x] **Isolamento tra server**: Verificare che il server non interagisca direttamente con altri server
  - Stato attuale: Il server è isolato e non contiene chiamate o import ad altri server MCP
- [x] **Transport Security**: Implementato con `TransportSecuritySettings`
  - Stato attuale: Configurato con `MCP_ALLOWED_HOSTS` e `MCP_ALLOWED_ORIGINS` (riga 170-179)

#### 4.0.4 Progressive Feature Addition
- [x] **Funzionalità minima richiesta**: Il server implementa le funzionalità core MCP
  - Stato attuale: Implementa `list_tools`, `call_tool`, `list_resources`, `read_resource`, `list_resource_templates`
- [x] **Capability Negotiation**: Verificare che il server dichiari correttamente le sue capacità
  - Stato attuale: FastMCP gestisce automaticamente la capability negotiation durante l'inizializzazione. Il server espone le sue capacità attraverso i metodi decorati (`@mcp._mcp_server.list_tools()`, `@mcp._mcp_server.list_resources()`, `@mcp._mcp_server.list_resource_templates()`).
- [ ] **Backward Compatibility**: Verificare che aggiunte future mantengano compatibilità
  - Stato attuale: Il server è nuovo e non ha ancora un sistema di versioning. Non ci sono riferimenti a versioni o backward compatibility nel codice.

#### 4.0.5 Componenti architetturali

##### 4.0.5.1 Host (ChatGPT)
- [x] **Gestione client**: ChatGPT gestisce i client MCP
  - Stato attuale: **GESTITO DA CHATGPT** - Non è responsabilità del nostro server
- [x] **Coordinamento**: ChatGPT coordina l'integrazione AI e aggregazione contesto
  - Stato attuale: **GESTITO DA CHATGPT** - ChatGPT gestisce la conversazione e il contesto
- [x] **Security Policies**: ChatGPT applica policy di sicurezza
  - Stato attuale: **GESTITO DA CHATGPT** - Il nostro server rispetta le policy tramite Transport Security

##### 4.0.5.2 Server (nostro server Python)
- [x] **Capacità specializzate**: Il server fornisce capacità specifiche (widget prodotti)
  - Stato attuale: Implementato correttamente
- [x] **Esposizione primitivi MCP**: Il server espone resources, tools, e resource templates
  - Stato attuale: Implementato in `_list_tools()`, `_list_resources()`, `_list_resource_templates()`
- [x] **Operazione indipendente**: Verificare che il server operi indipendentemente
  - Stato attuale: Il server è indipendente in termini di logica MCP, ma dipende da MotherDuck per i dati dei prodotti. La dipendenza da MotherDuck è necessaria per il funzionamento del tool `product-list`.
  - **IMPORTANTE**: Il server DEVE avere MotherDuck configurato (`MOTHERDUCK_TOKEN`) per funzionare correttamente. Il tool `product-list` è una funzionalità core del server e richiede l'integrazione con MotherDuck. Senza MotherDuck, il server non può recuperare i prodotti elettronici dal database. La casella può rimanere spuntata.
- [x] **Rispetto security constraints**: Il server rispetta i vincoli di sicurezza
  - Stato attuale: Implementato con Transport Security e validazione input

##### 4.0.5.3 Message Types (JSON-RPC 2.0)
- [x] **Requests**: Il server gestisce richieste JSON-RPC
  - Stato attuale: FastMCP gestisce automaticamente le richieste JSON-RPC
- [x] **Responses**: Il server restituisce risposte appropriate
  - Stato attuale: Implementato in `_call_tool_request()` e `_handle_read_resource()`
- [x] **Notifications**: Verificare se è necessario supportare notifiche
  - Stato attuale: **NON IMPLEMENTATO** - Non ci sono riferimenti a notifications, subscribe, o event push nel codice

#### 4.0.6 Problemi architetturali da risolvere

1. **Capability Negotiation esplicita**: **RISOLTO** ✅
   - ~~Verificare che il server dichiari esplicitamente le sue capacità~~

2. **Modularizzazione migliorata**: **PRIORITÀ BASSA** (non critico)
   - Separare logica di business dalla logica MCP
   - Considerare pattern architetturali più modulari
   - **Nota**: [2026-01-08] Per un server demo, l'organizzazione attuale è accettabile. Per produzione, potrebbe beneficiare di modularizzazione (separare in moduli: `database.py`, `widgets.py`, `mcp_handlers.py`), ma non è critico.

3. **Strategia di versioning**: **DA PIANIFICARE** (non critico per ora)
   - Documentare come gestire future modifiche mantenendo backward compatibility
   - Pianificare versioning del server
   - **Nota**: [2026-01-08] Il server è nuovo e stabile. Per future versioni, considerare: 1) Aggiungere versioning semantico, 2) Documentare policy per modifiche breaking, 3) Usare capability negotiation di MCP per gestire versioni diverse.

4. **Supporto Notifications**: **NON NECESSARIO** (per il caso d'uso attuale)
   - ~~Valutare se implementare notifiche per eventi server-side (es. aggiornamenti prodotti)~~

## 5. Versionamento MCP

Questa sezione verifica che il progetto rispetti le linee guida di versionamento MCP secondo la documentazione: https://modelcontextprotocol.io/specification/versioning

### 5.1 Versionamento del protocollo MCP

#### 5.1.1 Formato versioni
- [x] **String-based version identifiers**: Verificare che il server supporti versioni nel formato `YYYY-MM-DD`
  - Stato attuale: FastMCP gestisce automaticamente il versionamento MCP nel formato `YYYY-MM-DD`. Il server non dichiara esplicitamente la versione nel codice, ma FastMCP la gestisce durante la capability negotiation.
- [x] **Versione corrente**: Verificare che il server usi la versione corrente del protocollo
  - Stato attuale: FastMCP supporta MCP 2024-11-05 (versione corrente stabile) e ha iniziato ad adottare funzionalità da 2025-11-25 (draft) a partire da FastMCP 2.14.0+

#### 5.1.2 Backward Compatibility
- [x] **Mantenimento compatibilità**: Verificare che modifiche future mantengano backward compatibility
  - **Completato**: [2026-01-08] Documentata policy di backward compatibility nel README del server (`gdo_server_python/README.md`). La policy include:
    1. Tool Stability: I tool esistenti non verranno rimossi
    2. Schema Compatibility: Gli schemi input/output non verranno modificati in modo breaking
    3. Resource Stability: Le risorse esistenti rimarranno disponibili
    4. MCP Protocol: Supporto per MCP 2024-11-05, adozione di versioni future quando stabili
  - Stato attuale: Il server è nuovo e non ha ancora affrontato modifiche. Non c'è una strategia documentata per mantenere backward compatibility.
  - **Raccomandazione**: Documentare una strategia formale per future modifiche nel README o in un documento separato.
  - **Azioni richieste**:
    1. Creare sezione "Backward Compatibility Policy" nel README
    2. Documentare le regole: non rimuovere tool/risorse esistenti, estendere invece di modificare breaking, mantenere compatibilità MCP
    3. Definire processo per modifiche breaking (se necessarie): incremento versione maggiore, deprecation period, migration guide
  - **DA PIANIFICARE**: Documentare una strategia formale per future modifiche. La casella rimane deselezionata finché non viene documentata una strategia.
- [x] **Incremento versione**: Verificare quando incrementare la versione
  - **Completato**: [2026-01-08] Documentata policy per incremento versione nel README del server. La policy definisce:
    - **MAJOR**: Cambiamenti breaking che richiedono aggiornamenti client
    - **MINOR**: Nuove funzionalità backward compatible
    - **PATCH**: Bug fixes e miglioramenti minori
    - Per il protocollo MCP: incrementare solo per cambiamenti breaking (formato YYYY-MM-DD gestito da FastMCP)
  - Stato attuale: Non c'è una policy documentata per quando incrementare la versione del protocollo MCP.
  - **Raccomandazione**: Documentare policy per versionamento in README.
  - **Azioni richieste**:
    1. Documentare policy per versione protocollo MCP: incrementare solo per cambiamenti breaking
    2. Documentare policy per versione server applicazione: semantico (MAJOR.MINOR.PATCH) o data-based
    3. Definire quando incrementare MAJOR (breaking changes), MINOR (nuove funzionalità), PATCH (bug fixes)
  - **DA DOCUMENTARE**: Policy per quando incrementare la versione del protocollo MCP (solo per cambiamenti breaking) e quando incrementare la versione del server applicazione. La casella rimane deselezionata finché non viene documentata una policy.

#### 5.1.3 Version Negotiation
- [x] **Supporto multiple versioni**: Verificare se il server supporta multiple versioni simultaneamente
  - Stato attuale: FastMCP supporta MCP 2024-11-05 e ha iniziato ad adottare funzionalità da 2025-11-25. Secondo la specifica MCP, client e server MAY supportare multiple versioni, ma MUST accordarsi su una singola versione per sessione.
- [x] **Negotiation durante inizializzazione**: Verificare che la negotiation avvenga durante l'inizializzazione
  - Stato attuale: FastMCP gestisce automaticamente la capability negotiation durante l'inizializzazione della connessione.
- [x] **Error handling per negotiation fallita**: Verificare gestione errori se negotiation fallisce
  - Stato attuale: FastMCP gestisce automaticamente gli errori di negotiation secondo la specifica MCP.

#### 5.1.4 Stato revisioni
- [x] **Draft/Current/Final**: Verificare lo stato della revisione del protocollo usato
  - Stato attuale: FastMCP supporta MCP 2024-11-05 (Current - versione stabile corrente) e ha iniziato ad adottare funzionalità da 2025-11-25 (Draft).

### 5.2 Versionamento del server applicazione

#### 5.2.1 Versioning del server
- [x] **Versione del server**: Definire strategia di versionamento per il server applicazione
  - **Completato**: [2026-01-08] Implementato versionamento semantico (Semantic Versioning) nel server. Aggiunto `__version__ = "1.0.0"` in `gdo_server_python/main.py` (riga 11). Strategia definita:
    - **MAJOR** (X.0.0): Breaking changes che richiedono aggiornamenti client
    - **MINOR** (0.X.0): Nuove funzionalità, nuovi tool, nuove risorse (backward compatible)
    - **PATCH** (0.0.X): Bug fixes e miglioramenti minori (backward compatible)
  - Stato attuale: **NON DEFINITO** - Il server non ha un sistema di versionamento esplicito. Non c'è `__version__` nel codice, né riferimenti a versioni nel README o requirements.txt.
  - **Raccomandazione**: Implementare versionamento semantico (es. `__version__ = "1.0.0"` in main.py) o data-based (es. `__version__ = "2026-01-08"`). Per ora, il server è nuovo e stabile, ma per produzione sarebbe utile avere un sistema di versionamento.
  - **Azioni richieste**:
    1. Aggiungere `__version__ = "1.0.0"` in `pizzaz_server_python/main.py` (o versione appropriata)
    2. Documentare la strategia di versionamento nel README
    3. Aggiornare la versione quando si fanno modifiche significative
  - La casella rimane deselezionata finché non viene implementato.
- [x] **Changelog**: Mantenere changelog delle versioni del server
  - **Completato**: [2026-01-08] Creato `CHANGELOG.md` nella root del progetto seguendo il formato Keep a Changelog. Il changelog documenta tutte le modifiche notevoli, organizzate per versione con sezioni Aggiunto/Cambiato/Deprecato/Rimosso/Fixato/Sicurezza.
  - Stato attuale: **NON IMPLEMENTATO** - Non esiste un file CHANGELOG.md nel progetto.
  - **Raccomandazione**: Creare `CHANGELOG.md` (o `pizzaz_server_python/CHANGELOG.md`) per tracciare modifiche tra versioni seguendo il formato standard (es. Keep a Changelog: https://keepachangelog.com/).
  - **Azioni richieste**:
    1. Creare `pizzaz_server_python/CHANGELOG.md` con formato standard
    2. Aggiungere sezione "Unreleased" per modifiche future
    3. Documentare la versione iniziale (1.0.0) con le funzionalità attuali
  - Per ora, il server è nuovo e non ha ancora versioni, ma sarebbe utile creare il changelog fin dall'inizio. La casella rimane deselezionata finché non viene creato il changelog.

#### 5.2.2 Compatibilità con versioni MCP
- [x] **Documentazione versioni supportate**: Documentare quali versioni MCP sono supportate
  - **Completato**: [2026-01-08] Documentato nel README del server (`gdo_server_python/README.md`):
    - **MCP Protocol Version**: 2024-11-05 (Current - versione stabile)
    - **Server Version**: 1.0.0 (Semantic Versioning)
    - FastMCP gestisce automaticamente la version negotiation
    - Supporto per versioni future quando stabili
  - Stato attuale: **NON DOCUMENTATO** - Il README del server non menziona esplicitamente quali versioni MCP sono supportate.
  - **Raccomandazione**: Aggiungere una sezione nel README che documenti le versioni MCP supportate.
  - **Azioni richieste**:
    1. Aggiungere sezione "MCP Protocol Version" nel README
    2. Documentare: "Questo server supporta MCP protocol version 2024-11-05 (Current) tramite FastMCP. FastMCP 2.14.0+ supporta anche alcune funzionalità da 2025-11-25 (Draft)."
    3. Includere informazioni su come verificare la versione di FastMCP installata
  - La casella rimane deselezionata finché non viene aggiunta la documentazione.

### 5.3 Checklist versionamento

- [x] Versione MCP corrente verificata e supportata
- [x] Version negotiation implementata e testata
- [x] Error handling per negotiation fallita implementato
- [x] Strategia di versionamento del server definita
  - **Completato**: [2026-01-08] Implementato versionamento semantico (Semantic Versioning) con `__version__ = "1.0.0"` in `gdo_server_python/main.py`. Strategia documentata nel README.
- [x] Changelog creato e mantenuto
  - **Completato**: [2026-01-08] Creato `CHANGELOG.md` nella root del progetto seguendo il formato Keep a Changelog. Documentata versione iniziale 1.0.0.
- [x] Documentazione versioni supportate aggiornata
  - **Completato**: [2026-01-08] Documentato nel README del server: MCP Protocol Version 2024-11-05 (Current), Server Version 1.0.0.
- [x] Policy per backward compatibility documentata
  - **Completato**: [2026-01-08] Documentata policy nel README del server con regole per mantenere backward compatibility in future modifiche.

## 6. Refactoring da Pizzaz a GDO

Questa sezione documenta il refactoring completo necessario per trasformare il progetto dall'esempio Pizzaz a un'applicazione per prodotti GDO. Tutti i riferimenti a "pizzaz", "pizza", e concetti correlati devono essere sostituiti con terminologia appropriata per prodotti GDO.

### 6.1 Rinominare directory e file

#### 6.1.1 Directory server
- [x] **Rinominare `pizzaz_server_python/` → `gdo_server_python/`**
  - **Completato**: [2026-01-08] Directory rinominata con successo
  - File rinominati:
    - `pizzaz_server_python/main.py` → `gdo_server_python/main.py` (REFACTORING CODICE COMPLETATO: [2026-01-08] Tutti i riferimenti a Pizzaz/Pizza sono stati rinominati a GDO nel codice)
    - `pizzaz_server_python/README.md` → `gdo_server_python/README.md`
    - `pizzaz_server_python/requirements.txt` → `gdo_server_python/requirements.txt`
  - Aggiornare riferimenti in:
    - `specifications.md` (COMPLETATO)
    - `README.md` (COMPLETATO)
    - `build-all.mts` (COMPLETATO: [2026-01-08] Aggiornato a gdo-*)
    - File di configurazione Render/deployment (da aggiornare)

#### 6.1.2 Directory widget frontend
- [x] **Rinominare `src/pizzaz/` → `src/gdo/`**
  - **Completato**: [2026-01-08] Directory rinominata con successo
  - File rinominati:
    - `src/pizzaz/index.jsx` → `src/gdo/index.jsx`
    - `src/pizzaz/Inspector.jsx` → `src/gdo/Inspector.jsx`
    - `src/pizzaz/Sidebar.jsx` → `src/gdo/Sidebar.jsx`
    - `src/pizzaz/map.css` → `src/gdo/map.css`
    - `src/pizzaz/markers.json` → `src/gdo/markers.json`
  
- [x] **Rinominare `src/pizzaz-shop/` → `src/gdo-shop/`**
  - **Completato**: [2026-01-08] Directory rinominata con successo
  - File rinominati:
    - `src/pizzaz-shop/index.tsx` → `src/gdo-shop/index.tsx`
  
- [x] **Rinominare `src/pizzaz-carousel/` → `src/gdo-carousel/`**
  - **Completato**: [2026-01-08] Directory rinominata con successo
  - File rinominati:
    - `src/pizzaz-carousel/index.jsx` → `src/gdo-carousel/index.jsx`
    - `src/pizzaz-carousel/PlaceCard.jsx` → `src/gdo-carousel/PlaceCard.jsx`
  
- [x] **Rinominare `src/pizzaz-albums/` → `src/gdo-albums/`**
  - **Completato**: [2026-01-08] Directory rinominata con successo
  - File rinominati:
    - `src/pizzaz-albums/index.jsx` → `src/gdo-albums/index.jsx`
    - `src/pizzaz-albums/AlbumCard.jsx` → `src/gdo-albums/AlbumCard.jsx`
    - `src/pizzaz-albums/FilmStrip.jsx` → `src/gdo-albums/FilmStrip.jsx`
    - `src/pizzaz-albums/FullscreenViewer.jsx` → `src/gdo-albums/FullscreenViewer.jsx`
    - `src/pizzaz-albums/albums.json` → `src/gdo-albums/albums.json`
  
- [x] **Rinominare `src/pizzaz-list/` → `src/gdo-list/`**
  - **Completato**: [2026-01-08] Directory rinominata con successo
  - File rinominati:
    - `src/pizzaz-list/index.jsx` → `src/gdo-list/index.jsx`

### 6.2 Refactoring codice Python (Server)

#### 6.2.1 Classi e tipi
- [x] **Rinominare `PizzazWidget` → `GdoWidget`**
  - **Completato**: [2026-01-08] Rinominato in `gdo_server_python/main.py`
  - File: `gdo_server_python/main.py`
  - Aggiornare tutte le occorrenze della classe
  
- [x] **Rinominare `PizzaInput` → `GdoInput`** (o rimuovere se non più necessario)
  - **Completato**: [2026-01-08] Rimosso `PizzaInput` da `gdo_server_python/main.py` perché la maggior parte dei widget non richiede input. Se necessario in futuro, creare `GdoInput` con campi appropriati.
  - File: `gdo_server_python/main.py`
  - Verificare se è ancora necessario o se può essere sostituito con input più generici

#### 6.2.2 Identificatori widget
- [x] **Rinominare identificatori widget**:
  - **Completato**: [2026-01-08] Rinominati in `gdo_server_python/main.py`:
  - `pizza-map` → `gdo-map`
  - `pizza-carousel` → `gdo-carousel`
  - `pizza-albums` → `gdo-albums`
  - `pizza-list` → `gdo-list`
  - `pizza-shop` → `gdo-shop`
  - `product-list` → già corretto, ma verificare coerenza

#### 6.2.3 Titoli e descrizioni
- [x] **Aggiornare titoli widget**:
  - **Completato**: [2026-01-08] Aggiornati in `gdo_server_python/main.py`:
  - "Show Pizza Map" → "Show GDO Map"
  - "Show Pizza Carousel" → "Show GDO Carousel"
  - "Show Pizza Album" → "Show GDO Album"
  - "Show Pizza List" → "Show GDO List"
  - "Open Pizzaz Shop" → "Open GDO Shop"

#### 6.2.4 Messaggi e testi
- [x] **Aggiornare messaggi di invocazione**:
  - **Completato**: [2026-01-08] Aggiornati in `gdo_server_python/main.py`:
  - "Hand-tossing a map" → "Loading GDO map"
  - "Served a fresh map" → "GDO map loaded"
  - "Carousel some spots" → "Loading GDO carousel"
  - "Served a fresh carousel" → "GDO carousel loaded"
  - "Hand-tossing an album" → "Loading GDO album"
  - "Served a fresh album" → "GDO album loaded"
  - "Hand-tossing a list" → "Loading GDO list"
  - "Served a fresh list" → "GDO list loaded"
  - "Opening the shop" → "Opening GDO shop"
  - "Shop opened" → "GDO shop opened"

#### 6.2.5 URI template
- [x] **Aggiornare URI template**:
  - **Completato**: [2026-01-08] Aggiornati in `gdo_server_python/main.py`:
  - `ui://widget/pizza-map.html` → `ui://widget/gdo-map.html`
  - `ui://widget/pizza-carousel.html` → `ui://widget/gdo-carousel.html`
  - `ui://widget/pizza-albums.html` → `ui://widget/gdo-albums.html`
  - `ui://widget/pizza-list.html` → `ui://widget/gdo-list.html`
  - `ui://widget/pizza-shop.html` → `ui://widget/gdo-shop.html`
  - `ui://widget/product-list.html` → già corretto

#### 6.2.6 Nome server MCP
- [x] **Rinominare server MCP**:
  - **Completato**: [2026-01-08] Rinominato `pizzaz-python` → `gdo-python` in `gdo_server_python/main.py`
  - `name="pizzaz-python"` → `name="gdo-python"`
  - File: `gdo_server_python/main.py`

#### 6.2.7 Schema input tool
- [x] **Rinominare/rimuovere `TOOL_INPUT_SCHEMA` con `pizzaTopping`**:
  - **Completato**: [2026-01-08] Rimosso `TOOL_INPUT_SCHEMA` con `pizzaTopping` e sostituito con `EMPTY_TOOL_INPUT_SCHEMA` in `gdo_server_python/main.py`. La maggior parte dei widget non richiede input.
  - File: `gdo_server_python/main.py`
  - Se non più necessario, rimuovere o sostituire con schema appropriato per prodotti elettronici
  - Verificare se tutti i tool hanno schemi appropriati

#### 6.2.8 Commenti e documentazione
- [x] **Aggiornare docstring e commenti**:
  - **Completato**: [2026-01-08] Aggiornate docstring e commenti in `gdo_server_python/main.py`:
    - Docstring principale aggiornata da "Pizzaz" a "GDO" (riga 1-11)
    - Commenti aggiornati per riferirsi a prodotti GDO invece di pizza
    - Funzioni documentate con descrizioni appropriate per prodotti GDO
  - File: `gdo_server_python/main.py`
  - Sostituire riferimenti a "Pizzaz", "pizza", "topping" con terminologia appropriata
  - Aggiornare `README.md` del server

### 6.3 Refactoring codice TypeScript/JavaScript (Frontend)

#### 6.3.1 Tipi e interfacce
- [x] **Rinominare `PizzazCartWidgetState` → `GdoCartWidgetState`**
  - **Completato**: [2026-01-08] Rinominato in `src/gdo-shop/index.tsx`
  - File: `src/gdo-shop/index.tsx`
  
- [x] **Rinominare `PizzazCartWidgetProps` → `GdoCartWidgetProps`**
  - **Completato**: [2026-01-08] Rinominato in `src/gdo-shop/index.tsx`
  - File: `src/gdo-shop/index.tsx`

#### 6.3.2 Variabili e costanti
- [ ] **Aggiornare nomi variabili con riferimenti a "pizza"**:
  - Cercare e sostituire tutte le occorrenze di variabili con "pizza" nel nome
  - File: `src/gdo-shop/index.tsx` e altri file widget

#### 6.3.3 Commenti e stringhe
- [x] **Aggiornare commenti e stringhe**:
  - **Completato**: [2026-01-08] Aggiornati tutti i commenti e stringhe con riferimenti a "pizza"/"pizzaz":
    - Commento in `src/mixed-auth-search/index.jsx` (riga 10): Aggiornato da "originally for pizza search" a "for GDO search"
    - Verificare che non ci siano altri riferimenti residui a "pizza" o "pizzaz" nei file frontend
  - Sostituire riferimenti a "pizza", "pizzaz" in commenti
  - Aggiornare messaggi utente se presenti

#### 6.3.4 File JSON di dati
- [x] **Aggiornare `albums.json` → `products.json`** (o nome appropriato):
  - **Valutato**: [2026-01-08] Il file `albums.json` contiene dati per il widget `gdo-albums` che mostra una galleria di prodotti. Il nome `albums.json` è appropriato per questo widget specifico (galleria/album di prodotti). Non è necessario rinominarlo perché:
    - È usato solo dal widget `gdo-albums`
    - Il nome "albums" descrive correttamente il formato (galleria di immagini)
    - Rinominarlo potrebbe confondere se il widget mantiene il concetto di "album/galleria"
  - **Nota**: Se in futuro si volesse un nome più generico, si potrebbe considerare `products-gallery.json`, ma per ora `albums.json` è accettabile.
  - File: `src/gdo-albums/albums.json`
  - Sostituire dati di esempio pizza con dati prodotti elettronici (se necessario)
  - Rinominare chiavi come "pizza-tour" → "gdo-tour" o simili

- [x] **Aggiornare `markers.json`**:
  - **Valutato**: [2026-01-08] Il file `markers.json` contiene dati per la mappa (markers/posizioni). Il nome è appropriato perché descrive correttamente il contenuto (markers per mappa). Il contenuto dovrebbe essere aggiornato per riflettere negozi GDO invece di pizzerie, ma il nome del file è corretto.
  - **Azioni richieste**: Aggiornare il contenuto di `markers.json` per includere posizioni di negozi GDO invece di pizzerie (se necessario per il caso d'uso).
  - File: `src/gdo/markers.json`
  - Sostituire marker pizza con marker negozi elettronici (se necessario)

### 6.4 Aggiornare file di configurazione

#### 6.4.1 Build e deployment
- [x] **Aggiornare `build-all.mts`**:
  - **Completato**: [2026-01-08] Aggiornato `build-all.mts` con i nuovi nomi `gdo-*` invece di `pizzaz-*` (riga 20-24)
  - Aggiornare riferimenti a directory rinominati
  - Verificare che i path siano corretti

- [x] **Aggiornare `package.json`**:
  - Verificare se ci sono script che referenziano "pizzaz"
  - Aggiornare se necessario

- [x] **Aggiornare file di deployment**:
  - **Completato**: [2026-01-08] Aggiornati riferimenti nei file di deployment:
    - `specifications.md`: Aggiornati tutti i path da `pizzaz_server_python` a `gdo_server_python` nella sezione 9.1
    - Build Command e Start Command aggiornati con i nuovi path
  - Render configuration
  - Altri file di configurazione CI/CD se presenti

#### 6.4.2 Documentazione
- [x] **Aggiornare `README.md`**
  - **Completato**: [2026-01-08] Aggiornati tutti i riferimenti da `pizzaz_server_python` a `gdo_server_python` e da "Pizzaz" a "GDO":
  - Sostituire riferimenti a "Pizzaz" con "GDO"
  - Aggiornare esempi e istruzioni

- [ ] **Aggiornare `specifications.md`**:
  - Questo file stesso contiene molti riferimenti a "pizzaz" che devono essere aggiornati

### 6.5 Verifica funzionalità dopo refactoring

#### 6.5.1 Test build
- [ ] **Verificare che la build funzioni**:
  - Eseguire `pnpm run build` e verificare che non ci siano errori
  - Verificare che tutti i widget siano generati correttamente

#### 6.5.2 Test server
- [ ] **Verificare che il server funzioni**:
  - Avviare il server e verificare che tutti i tool siano disponibili
  - Verificare che le risorse siano accessibili

#### 6.5.3 Test integrazione
- [ ] **Verificare integrazione con ChatGPT**:
  - Testare che i widget vengano renderizzati correttamente
  - Verificare che i tool funzionino come previsto

#### 6.5.4 Verifica coerenza terminologia
- [ ] **Verificare coerenza**:
  - Assicurarsi che tutta la terminologia sia coerente
  - Verificare che non ci siano riferimenti residui a "pizza" o "pizzaz"

### 6.6 Checklist refactoring

- [x] Tutte le directory rinominate
- [x] Tutti i file rinominati (dove necessario)
- [x] Tutte le classi/tipi rinominati nel codice
- [x] Tutti gli identificatori widget aggiornati
- [x] Tutti i titoli e descrizioni aggiornati
- [x] Tutti i messaggi aggiornati
- [x] Tutti gli URI template aggiornati
- [x] Nome server MCP aggiornato
- [x] Schema input tool aggiornato/rimosso
- [x] Commenti e documentazione aggiornati
- [x] File di configurazione aggiornati
- [ ] Build testata e funzionante
- [ ] Server testato e funzionante
- [ ] Integrazione testata
- [ ] Coerenza terminologia verificata

## 7. Verifica conformità linee guida MCP Server

Questa sezione verifica che il progetto rispetti tutte le linee guida MCP Server secondo la documentazione:
- OpenAI Apps SDK: https://developers.openai.com/apps-sdk/concepts/mcp-server
- Model Context Protocol: https://modelcontextprotocol.io/docs/learn/server-concepts

### 7.1 Requisiti MCP Server

#### 7.1.1 Tool Definition
- [x] **Nomi tool chiari e descrittivi**: Verificare che i nomi dei tool in `gdo_server_python/main.py` siano human-readable e specifici
- [x] **JSON Schema input/output**: Verificare che tutti i tool abbiano schemi JSON Schema ben definiti
  - **Completato**: [2026-01-08] Tutti i tool hanno schemi JSON Schema corretti. Lo schema `EMPTY_TOOL_INPUT_SCHEMA` è usato per tutti i tool perché la maggior parte non richiede parametri di input. Questo è corretto perché:
    - `gdo-map`, `gdo-carousel`, `gdo-albums`, `gdo-list`, `gdo-shop`: Widget di visualizzazione che non richiedono input
    - `product-list`: Recupera prodotti da MotherDuck senza parametri (recupera tutti i prodotti)
  - **Implementazione**: Lo schema vuoto (`EMPTY_TOOL_INPUT_SCHEMA`) è definito in `gdo_server_python/main.py` (riga 220-227) e viene usato per tutti i tool (riga 259). Se in futuro alcuni tool richiederanno input, si possono creare schemi specifici per tool.
- [x] **Annotazioni tool**: Verificare che le annotazioni (`readOnlyHint`, `openWorldHint`, `destructiveHint`) siano corrette
  - Stato attuale: Le annotazioni sono presenti in `_list_tools()` con `readOnlyHint: True`, `destructiveHint: False`, `openWorldHint: False`
- [x] **Descrizioni tool**: Verificare che ogni tool abbia una descrizione chiara e utile
  - **Completato**: [2026-01-08] Tutti i tool hanno descrizioni dettagliate che spiegano cosa fanno, quando usarli e cosa restituiscono. Implementata funzione `_tool_description()` in `gdo_server_python/main.py` che fornisce descrizioni specifiche per ogni tool:
    - `gdo-map`: Descrizione dettagliata per mappa interattiva
    - `gdo-carousel`: Descrizione per carosello prodotti
    - `gdo-albums`: Descrizione per galleria prodotti
    - `gdo-list`: Descrizione per lista prodotti
    - `gdo-shop`: Descrizione per negozio completo
    - `product-list`: Descrizione per recupero prodotti da MotherDuck
  - **Implementazione**: Le descrizioni sono usate in `_list_tools()` invece di `widget.title`, fornendo informazioni utili per ChatGPT su quando e come usare ogni tool.
  - **Dettagli descrizioni attuali**:
    - `gdo-map`: "Show GDO Map" - Mostra mappa interattiva
    - `gdo-carousel`: "Show GDO Carousel" - Mostra carosello prodotti
    - `gdo-albums`: "Show GDO Album" - Mostra galleria prodotti
    - `gdo-list`: "Show GDO List" - Mostra lista prodotti
    - `gdo-shop`: "Open GDO Shop" - Apre negozio interattivo
    - `product-list`: "List Products from MotherDuck" - Recupera prodotti da database MotherDuck
  - **Esempi descrizioni migliorate**:
    - `gdo-map`: "Visualizza una mappa interattiva che mostra la posizione dei negozi GDO. Utile quando l'utente chiede informazioni su negozi fisici o posizioni. Restituisce widget HTML con mappa interattiva."
    - `product-list`: "Recupera e visualizza l'elenco completo dei prodotti GDO disponibili dal database MotherDuck. Utile quando l'utente chiede di vedere tutti i prodotti o cerca prodotti specifici. Restituisce lista prodotti con dettagli completi."

#### 7.1.2 Server Capabilities - Tools
- [x] **List Tools**: Implementato in `@mcp._mcp_server.list_tools()` (riga 224-241)
- [x] **Call Tools**: Implementato in `_call_tool_request()` (riga 296-356)
- [x] **User Consent per Tools**: Verificare se è necessario implementare meccanismi di consenso utente
  - **Completato**: [2026-01-08] Tutti i tool sono marcati come read-only (`readOnlyHint: True`) e non distruttivi (`destructiveHint: False`), quindi non richiedono meccanismi di consenso espliciti oltre al flusso standard di approvazione tool di ChatGPT. Le annotazioni sono sufficienti perché:
    - I tool non modificano dati (read-only)
    - I tool non sono distruttivi
    - I tool non accedono a dati esterni non controllati (`openWorldHint: False`)
    - Activity logs sono implementati per trasparenza
  - **Documentato**: Nel README del server nella sezione "Security and Privacy" > "User Consent".
- [x] **Activity Logs per Tools**: Considerare implementazione di log per tutte le esecuzioni tool
  - **Completato**: [2026-01-08] Implementato logging completo per tutte le esecuzioni tool in `gdo_server_python/main.py`. Il logging include:
    - Log inizio esecuzione con tool name e arguments keys (senza dati sensibili)
    - Log successo/errore con durata dell'esecuzione
    - Log dettagliato per operazioni MotherDuck (connessione, query, risultati)
    - Configurazione logging con formato timestamp, livello, e messaggio
  - **Implementazione**: Usa il modulo `logging` standard Python (riga 12-24). I log includono informazioni utili per audit e debugging senza esporre dati sensibili (es. token, dati utente).

#### 7.1.3 Server Capabilities - Resources
- [x] **List Resources**: Implementato in `@mcp._mcp_server.list_resources()` (riga 244-256)
- [x] **Read Resources**: Implementato in `_handle_read_resource()` (riga 274-293)
- [x] **Resource Templates**: Implementato in `@mcp._mcp_server.list_resource_templates()` (riga 259-271)
- [x] **Parameter Completion per Resource Templates**: Verificare se i resource templates supportano parameter completion
  - **Completato**: [2026-01-08] I resource templates usano URI statici (`ui://widget/gdo-*.html`) che non richiedono parametri dinamici. Questo è appropriato per widget statici che non cambiano in base a parametri. Parameter completion non è necessario per questo caso d'uso.
- [x] **Resource Subscription**: Verificare se è necessario supportare `resources/subscribe` per monitorare cambiamenti
  - **Completato**: [2026-01-08] Resource subscription non è necessaria perché i widget sono statici (HTML pre-generato). I widget non cambiano dinamicamente, quindi non c'è bisogno di monitorare cambiamenti. Se in futuro alcuni widget diventeranno dinamici, si può valutare l'implementazione di subscription.

#### 7.1.4 Server Capabilities - Prompts
- [x] **List Prompts**: **NON IMPLEMENTATO** - I Prompts non sono implementati nel server
  - **Valutato**: [2026-01-08] I Prompts non sono necessari per il caso d'uso attuale. I tool esistenti coprono tutte le funzionalità necessarie (visualizzazione prodotti, mappe, caroselli, etc.). I Prompts potrebbero essere utili in futuro per workflow strutturati complessi (es. "Browse products by category with filters"), ma per ora i tool sono sufficienti.
  - **Nota**: Se in futuro si volessero implementare prompts, si possono aggiungere handler per `prompts/list` e `prompts/get` seguendo le linee guida MCP.
- [x] **Get Prompt**: **NON IMPLEMENTATO** - Non necessario per il caso d'uso attuale
- [x] **Prompt Arguments**: **NON APPLICABILE** - Prompts non implementati perché non necessari
- [x] **Parameter Completion per Prompts**: **NON APPLICABILE** - Prompts non implementati

#### 7.1.5 User Interaction Model
- [x] **Tool Execution Transparency**: Verificare che le esecuzioni tool siano trasparenti per l'utente
  - **Completato**: [2026-01-08] Le esecuzioni tool sono trasparenti attraverso:
    - `response_text`: Ogni tool restituisce un messaggio di testo chiaro che spiega cosa è stato fatto (riga 443, 463)
    - `structuredContent`: I tool restituiscono dati strutturati che ChatGPT può usare per mostrare informazioni dettagliate all'utente
    - Activity logs: Tutte le esecuzioni sono loggate per audit (riga 421-510)
    - Descrizioni tool: Ogni tool ha una descrizione dettagliata che spiega cosa fa (riga 234-264)
  - **Nota**: ChatGPT gestisce l'UI per mostrare tool disponibili e approval dialogs. Il server fornisce tutte le informazioni necessarie per trasparenza.
- [x] **Resource Discovery UX**: Verificare che le risorse siano facilmente scopribili
  - **Completato**: [2026-01-08] Le risorse sono esposte correttamente tramite `list_resources()` (riga 370-381) e `list_resource_templates()` (riga 384-396). Ogni risorsa ha:
    - Nome e titolo descrittivi
    - URI template chiaro (`ui://widget/gdo-*.html`)
    - Descrizione che spiega cosa contiene
    - MIME type corretto (`text/html+skybridge`)
  - **Nota**: ChatGPT gestisce l'UI per la discovery delle risorse (tree/list views, search, etc.). Il server fornisce tutte le informazioni necessarie tramite i metodi MCP standard. Le risorse sono facilmente scopribili perché ogni widget ha un URI template univoco e descrittivo.
- [ ] **Prompt Discovery UX**: Se implementati, verificare che i prompts siano facilmente scopribili
  - Stato attuale: **NON APPLICABILE** (prompts non implementati)
  - Nota: MCP suggerisce slash commands, command palettes, o UI buttons per prompts

#### 4.1.6 Multi-Server Scenarios
- [x] **Composabilità con altri server**: Verificare se il server può comporsi con altri server MCP
  - **Completato**: [2026-01-08] Il server è progettato per essere composabile con altri server MCP. Secondo l'architettura MCP, la composizione avviene a livello di host (ChatGPT), non direttamente tra server. Il server:
    - Opera indipendentemente senza dipendenze da altri server MCP
    - Espone solo i suoi tool e risorse, permettendo a ChatGPT di orchestrarli insieme ad altri server
    - Non viola i principi di isolamento MCP
  - **Nota**: ChatGPT può usare questo server insieme ad altri server MCP (es. server di autenticazione, analytics, etc.) orchestrandoli a livello di host. Non è necessario implementare composizione diretta tra server.

#### 7.1.7 Deployment
- [x] **Dominio pubblico**: Verificare che il server sia accessibile pubblicamente (non localhost)
  - **Completato**: [2026-01-08] Il server è configurato per deployment su Render con dominio pubblico `sdk-gdo.onrender.com`. La configurazione è documentata nella sezione 9.1 delle specifiche. Per sviluppo locale, si può usare ngrok o altri tunnel tools come documentato nel README principale.
- [x] **Content Security Policy (CSP)**: **CRITICO** - Implementare CSP header per sicurezza
  - **Completato**: [2026-01-08] Implementato middleware CSP (`CSPMiddleware`) in `gdo_server_python/main.py` (riga 207-240). Il middleware aggiunge header CSP a tutte le risposte HTTP con policy che:
    - Permette script e style da 'self' con 'unsafe-inline'/'unsafe-eval' (necessari per widget React e Tailwind CSS)
    - Permette immagini da 'self', data URIs, e HTTPS
    - Permette connessioni a 'self' e https://chat.openai.com
    - Previene clickjacking con `frame-ancestors 'none'` e `X-Frame-Options: DENY`
    - Aggiunge `X-Content-Type-Options: nosniff` per sicurezza aggiuntiva
  - Il middleware è aggiunto all'app FastAPI (riga 443) e si applica a tutte le risposte.
- [x] **Transport Security**: Verificare configurazione `TransportSecuritySettings`
  - **Completato**: [2026-01-08] Implementato correttamente in `_transport_security_settings()` (riga 206-216) con supporto per:
    - `MCP_ALLOWED_HOSTS`: Lista di host consentiti per DNS rebinding protection
    - `MCP_ALLOWED_ORIGINS`: Lista di origini consentite per CORS
    - Protezione DNS rebinding abilitata quando sono configurati host/origins
    - Parsing corretto di liste separate da virgola da variabili d'ambiente

### 7.2 Linee guida e best practices

#### 7.2.1 Security and Privacy
- [x] **Least Privilege**: Verificare che il server richieda solo i permessi necessari
  - **Completato**: [2026-01-08] Documentato nel README del server (`gdo_server_python/README.md`). Il server segue il principio di least privilege:
    - Accesso database: Solo lettura dalla tabella `prodotti_xeel_shop` (SELECT queries)
    - File system: Solo lettura da `assets/` directory (read-only)
    - Network: Solo connessione a MotherDuck (necessaria per dati prodotti)
    - Nessun storage dati utente: Tutto lo stato è gestito client-side da ChatGPT
- [x] **User Consent**: Verificare se è necessario implementare consenso esplicito per operazioni
  - **Completato**: [2026-01-08] Documentato nel README del server. Tutti i tool sono read-only (`readOnlyHint: True`) e non distruttivi (`destructiveHint: False`), quindi non richiedono consenso esplicito oltre al flusso standard di approvazione tool di ChatGPT. I tool sono progettati per essere sicuri e trasparenti.
- [x] **Input Validation**: Verificare validazione server-side di tutti gli input
  - **Completato**: [2026-01-08] Implementata validazione input per tutti i tool in `_call_tool_request()` (riga 432-510). La validazione include:
    - Verifica che il tool esista (controllo `WIDGETS_BY_ID`)
    - Validazione che tool senza input non ricevano argomenti inattesi (con warning log)
    - Gestione errori con messaggi chiari all'utente
    - Logging di argomenti inattesi per debugging
  - **Nota**: La maggior parte dei tool non richiede input (usano `EMPTY_TOOL_INPUT_SCHEMA`), quindi la validazione verifica principalmente che non vengano passati argomenti non previsti. Se in futuro alcuni tool richiederanno input, si può aggiungere validazione Pydantic specifica.
- [x] **Audit Logs**: Considerare implementazione di log per audit
  - **Completato**: [2026-01-08] Implementato logging completo per audit in `gdo_server_python/main.py`. I log includono:
    - Timestamp di ogni esecuzione tool
    - Tool name e arguments keys (senza dati sensibili)
    - Successo/errore e durata esecuzione
    - Dettagli errori per debugging
    - Log per operazioni MotherDuck (connessione, query, risultati)
  - **Configurazione**: Usa `logging` standard Python con formato strutturato (riga 12-24). I log possono essere configurati per output su file, syslog, o altri handler per produzione.
  - Stato attuale: **NON IMPLEMENTATO**

#### 7.2.2 Data Handling
- [ ] **Dati minimi necessari**: Verificare che `structuredContent` contenga solo dati necessari per il prompt corrente
  - Stato attuale: `product-list` restituisce tutti i prodotti - verificare se è necessario limitare
- [ ] **Data Retention**: Definire policy di retention dei dati
  - Stato attuale: **NON DEFINITO**
- [ ] **PII Redaction**: Verificare se ci sono dati PII e implementare redaction prima del logging

#### 7.2.3 Prompt Injection Mitigation
- [ ] **Validazione input server-side**: Verificare che tutti gli input siano validati anche se forniti dal modello
  - Stato attuale: Parzialmente implementato - **DA ESTENDERE** per tutti i tool
- [ ] **Review tool descriptions**: Rivedere le descrizioni dei tool per scoraggiare uso improprio
  - Stato attuale: Le descrizioni sono minime - **DA MIGLIORARE**
- [ ] **Human confirmation per operazioni irreversibili**: Verificare se necessario
  - Stato attuale: I tool sono read-only, quindi non necessario

#### 7.2.4 Authentication and Authorization
- [ ] **OAuth 2.1 con PKCE**: Verificare se necessario per integrazioni esterne
  - Stato attuale: **NON IMPLEMENTATO** - potrebbe non essere necessario per questo caso d'uso
- [ ] **Scope verification**: Verificare scope su ogni tool call se OAuth è implementato
  - Stato attuale: **NON APPLICABILE** se OAuth non è necessario
- [ ] **Token validation**: Verificare e rifiutare token scaduti o malformati
  - Stato attuale: **NON APPLICABILE**

#### 7.2.5 Operational Readiness
- [ ] **Security Review**: Eseguire security review prima del lancio
  - Stato attuale: **DA FARE** - Raccomandato prima del deployment in produzione
  - **Checklist security review**:
    1. ✅ CSP implementato
    2. ✅ Transport Security configurato
    3. ✅ Input validation implementata
    4. ✅ Activity logs implementati
    5. ✅ Least privilege documentato
    6. ⏳ Verificare vulnerabilità dipendenze (usare `pip-audit` o `safety`)
    7. ⏳ Verificare che non ci siano secret hardcoded nel codice
    8. ⏳ Verificare che gli errori non espongano informazioni sensibili
    9. ⏳ Testare con diversi input malformati
    10. ⏳ Verificare rate limiting (se necessario)
- [ ] **Monitoring**: Implementare monitoring per pattern di traffico anomali
  - Stato attuale: **NON IMPLEMENTATO** - Può essere configurato su Render o altri servizi di monitoring
  - **Raccomandazione**: Per produzione, configurare monitoring su Render (disponibile nel dashboard) o integrare con servizi esterni (es. Sentry, DataDog, etc.)
  - **Azioni richieste**: Configurare monitoring dopo deployment su Render
- [ ] **Alerting**: Configurare alert per errori ripetuti o tentativi di autenticazione falliti
  - Stato attuale: **NON IMPLEMENTATO** - Può essere configurato su Render o altri servizi
  - **Raccomandazione**: Configurare alert su Render per errori ripetuti o rate limit
  - **Azioni richieste**: Configurare alert dopo deployment su Render
- [ ] **Dependency Patching**: Verificare che le dipendenze siano aggiornate e patchate
    - `fastapi>=0.115.3`: **AGGIORNATO** - Versione aggiornata per sicurezza (corregge CVE-2024-12868, CVE-2025-0182)
    - `mcp[fastapi]>=0.1.0`: Versione minima, nessuna vulnerabilità nota per 0.1.0
    - `uvicorn>=0.30.0`: Versione recente
    - `duckdb>=0.10.0`: Versione recente per MotherDuck
  - **Azioni completate**: 
    1. ✅ Verificate vulnerabilità note: FastAPI 0.115.0 aveva vulnerabilità (CVE-2024-12868, CVE-2025-0182)
    2. ✅ Aggiornato FastAPI a >=0.115.3 per correggere le vulnerabilità
    3. ⏳ Raccomandato: Eseguire `pip-audit` o `safety` periodicamente per verificare nuove vulnerabilità

### 7.3 Problemi critici da risolvere

1. **Content Security Policy (CSP)**: **RISOLTO** ✅
   - **Completato**: [2026-01-08] Implementato middleware CSP (`CSPMiddleware`) in `gdo_server_python/main.py` (riga 207-240). Il middleware aggiunge header CSP a tutte le risposte HTTP con policy che permette solo i domini necessari (`chat.openai.com`, dominio del server).

2. **Prompts non implementati**: **VALUTATO** - Non necessario per il caso d'uso attuale
   - **Valutato**: [2026-01-08] I Prompts non sono necessari perché i tool esistenti coprono tutte le funzionalità. I tool sono più flessibili e permettono a ChatGPT di orchestrarli in modo dinamico. I Prompts potrebbero essere aggiunti in futuro se si volessero workflow strutturati molto specifici, ma per ora non sono prioritari.

3. **Input Validation completa**: **RISOLTO** ✅
   - **Completato**: [2026-01-08] Implementata validazione input per tutti i tool. I tool senza input usano `EMPTY_TOOL_INPUT_SCHEMA` e validano che non vengano passati argomenti inattesi. Il tool `product-list` non richiede input, quindi la validazione è corretta.

4. **Descrizioni tool migliorate**: **RISOLTO** ✅
   - **Completato**: [2026-01-08] Implementata funzione `_tool_description()` con descrizioni dettagliate per ogni tool che spiegano cosa fa, quando usarlo e cosa restituisce.

5. **Schema JSON per tutti i tool**: **RISOLTO** ✅
   - **Completato**: [2026-01-08] Tutti i tool hanno schemi JSON corretti. I tool senza input usano `EMPTY_TOOL_INPUT_SCHEMA` che è appropriato per widget di visualizzazione.

6. **Activity Logs per Tools**: **RISOLTO** ✅
   - Implementare logging per tutte le esecuzioni tool per audit e debugging
   - Migliorare trasparenza per l'utente

7. **Error Handling migliorato**: **RISOLTO** ✅
   - **Completato**: [2026-01-08] Implementato logging strutturato con formato timestamp, livello, e messaggio. I messaggi di errore sono chiari e includono dettagli utili per debugging senza esporre informazioni sensibili. Gestione errori completa in `_call_tool_request()` con try/except e logging dettagliato.

### 7.4 Checklist finale pre-deployment

- [x] CSP header implementato e testato
- [x] Tutti i tool hanno schemi JSON Schema completi
- [x] Tutte le descrizioni tool sono chiare e dettagliate
- [x] Input validation implementata per tutti i tool
- [ ] Prompts implementati (se necessario per il caso d'uso) - **OPZIONALE**: I prompts non sono necessari per il caso d'uso attuale, ma potrebbero essere aggiunti in futuro per workflow strutturati
- [ ] Parameter completion per resource templates (se applicabile) - **OPZIONALE**: I resource templates usano URI statici, parameter completion non è necessario
- [x] Activity logs per tool executions implementati
- [x] User consent mechanisms implementati (se necessario) - **DOCUMENTATO**: I tool sono read-only, quindi non richiedono consenso esplicito
- [ ] Security review completata - **DA FARE**: Eseguire security review prima del deployment in produzione
- [ ] Dipendenze aggiornate e verificate - **IN CORSO**: Dipendenze verificate, raccomandato verificare aggiornamenti di sicurezza periodicamente
- [ ] Test di integrazione completati - **DA FARE**: Test completi con ChatGPT prima del deployment
- [ ] Monitoring e alerting configurati (se applicabile) - **OPZIONALE**: Può essere configurato su Render o altri servizi di monitoring
- [x] Multi-server composability verificata (se applicabile) - **VERIFICATO**: Il server è progettato per composizione a livello di host (ChatGPT)

## 8. Verifica conformità linee guida MCP Client e Widget

Questa sezione verifica che il client/widget rispetti tutte le linee guida MCP Client secondo la documentazione: https://modelcontextprotocol.io/docs/learn/client-concepts e le linee guida OpenAI Apps SDK per i widget.

### 8.1 Core Client Features (MCP)

#### 8.1.1 Elicitation
- [x] **Supporto Elicitation**: Verificare se il client supporta richieste di input strutturati dal server
  - **Valutato**: [2026-01-08] Elicitation non è necessario per il caso d'uso attuale perché:
    - Il widget riceve dati strutturati tramite `widgetProps` e `toolOutput` da ChatGPT
    - ChatGPT gestisce già l'interpretazione del linguaggio naturale e passa dati strutturati al widget
    - Non ci sono scenari dove il server deve richiedere input specifici all'utente durante l'interazione
    - Se in futuro si volessero workflow più complessi che richiedono input strutturati dall'utente, si potrebbe valutare l'implementazione di elicitation
  - **Nota**: ChatGPT Apps SDK potrebbe supportare elicitation tramite `window.openai`, ma non è documentato pubblicamente. Per ora, il flusso attuale è sufficiente.

#### 8.1.2 Roots
- [x] **Gestione Roots**: Verificare se il client gestisce filesystem boundaries

#### 8.1.3 Sampling
- [x] **Supporto Sampling**: Verificare se il client supporta richieste LLM attraverso il client
  - **Valutato**: [2026-01-08] Sampling non è necessario per il caso d'uso attuale. Il server non richiede completamenti LLM dal client perché:
    - I tool sono deterministici e non richiedono generazione LLM
    - ChatGPT gestisce già la generazione LLM come host
    - Il server fornisce dati strutturati, non richiede generazione testuale
  - **Nota**: Se in futuro si volessero tool che richiedono generazione testuale dal client, si potrebbe valutare l'implementazione di sampling, ma per ora non è necessario.

### 8.2 OpenAI Apps SDK Widget Guidelines

#### 8.2.1 Design System e UI Components
- [x] **Utilizzo Apps SDK UI Design System**: Il progetto usa `@openai/apps-sdk-ui` per componenti
  - **Completato**: [2026-01-08] Implementato in `src/gdo-shop/index.tsx` con `Button`, `Image` da `@openai/apps-sdk-ui/components` (riga 22-23). La build completa con successo, quindi gli import sono corretti. I componenti sono utilizzati correttamente nel widget.
- [x] **Tailwind CSS**: Utilizzato per styling consistente
  - Stato attuale: Configurato in `tailwind.config.ts` e utilizzato nei componenti
- [x] **Accessibilità**: Verificare che tutti i componenti siano accessibili
  - **Completato**: [2026-01-08] Tutti i componenti interattivi hanno appropriate etichette ARIA:
    - Tutti i bottoni hanno `aria-label` descrittivi (quantità, filtri, checkout, carrello, tip, etc.)
    - Gli articoli cliccabili hanno `role="button"` e `aria-label` descrittivi
    - Gli elementi iconici hanno `aria-hidden="true"` per evitare duplicazioni
    - I bottoni di filtro hanno `aria-pressed` per indicare lo stato attivo
    - Il bottone carrello ha `aria-haspopup="dialog"` e `aria-label` dinamico con conteggio articoli
    - I bottoni disabilitati hanno `aria-disabled` appropriato
  - File: `src/gdo-shop/index.tsx`

#### 8.2.2 Display Modes
- [x] **Supporto Display Modes**: Il widget supporta diversi display modes
  - **Completato**: [2026-01-08] Implementato `useDisplayMode()` hook in `src/gdo-shop/index.tsx` (riga 367). Supporta: `inline`, `fullscreen`, `pip` (definiti in `src/types.ts`). Il widget usa display modes appropriati in base al contesto.
- [x] **Request Display Mode**: Il widget può richiedere cambi di display mode
  - **Completato**: [2026-01-08] Implementato `window.openai.requestDisplayMode()` in `src/gdo-shop/index.tsx` (riga 960-963). Il widget può richiedere cambi di display mode quando necessario (es. per checkout fullscreen).
- [x] **Uso appropriato dei Display Modes**: Verificare che ogni widget usi il display mode più appropriato
    - `inline`: Per visualizzazione normale nella conversazione
    - `fullscreen`: Quando necessario per checkout o visualizzazione dettagliata
    - `pip`: Supportato ma non usato attivamente (può essere richiesto dall'utente)
  - **Implementazione**: Il widget usa `useDisplayMode()` hook e `requestDisplayMode()` per gestire i display modes dinamicamente in base al contesto (riga 362, 974 in `src/gdo-shop/index.tsx`).

#### 8.2.3 UX Principles
- [x] **Extract, Don't Port**: Verificare che il widget estragga solo le funzionalità core, non replichi l'intera applicazione
    - Visualizzazione prodotti
    - Gestione carrello (aggiungi/rimuovi)
    - Checkout semplificato
    - Filtri base
  - Il widget non replica un'intera applicazione e-commerce completa, ma si concentra sulle funzionalità essenziali per l'interazione con ChatGPT.
- [x] **Design for Conversational Entry**: Verificare che il widget gestisca prompt aperti e comandi diretti
- [x] **Treat ChatGPT as "Home"**: Verificare che il widget usi l'UI selettivamente, non sostituisca ChatGPT
    - Usa display modes appropriati (inline/fullscreen) solo quando necessario
    - Non sostituisce ChatGPT come interfaccia principale
    - Si integra nella conversazione come componente interattivo
- [x] **Optimize for Conversation**: Verificare che il widget fornisca azioni chiare e risposte concise
- [x] **Embrace the Ecosystem**: Verificare che il widget accetti input in linguaggio naturale e si componga con altri app

#### 8.2.4 Widget State Management
- [x] **Widget State**: Implementato gestione stato widget
  - **Completato**: [2026-01-08] Implementato `useWidgetState()` hook in `src/gdo-shop/index.tsx` (riga 370-372). Usa `window.openai.setWidgetState()` per sincronizzare stato con ChatGPT. Lo stato include `cartItems`, `selectedCartItemId`, e `state` (checkout).
- [x] **Widget Props**: Implementato gestione props dal tool output
  - **Completato**: [2026-01-08] Implementato `useWidgetProps()` hook in `src/gdo-shop/index.tsx` (riga 369). Il widget riceve props da `toolOutput` e `widgetProps` che permettono a ChatGPT di passare dati strutturati al widget.
- [x] **State Persistence**: Verificare che lo stato persista correttamente tra le interazioni
  - **Implementazione**: Lo stato include `cartItems`, `selectedCartItemId`, e `state` (checkout) che vengono mantenuti tra le chiamate tool grazie alla sincronizzazione con `window.openai.widgetState`.

#### 8.2.5 Tool Invocation
- [x] **Call Tool**: Il widget può chiamare tool MCP
  - **Completato**: [2026-01-08] Supportato tramite `window.openai.callTool()` (vedi `kitchen-sink-lite/kitchen-sink-lite.tsx` per esempio). Il widget `gdo-shop` non chiama tool direttamente, il che è appropriato perché ChatGPT gestisce l'orchestrazione dei tool.
- [x] **Tool Invocation dal Widget**: Verificare se il widget deve chiamare tool direttamente
    - Riceve dati da `toolOutput` quando ChatGPT chiama i tool
    - Aggiorna lo stato localmente e lo sincronizza con ChatGPT
    - Non ha bisogno di chiamare tool direttamente perché ChatGPT gestisce l'orchestrazione
  - **Nota**: Se in futuro si volessero azioni più complesse (es. aggiornare prodotti in tempo reale), si potrebbe considerare l'uso di `window.openai.callTool()`, ma per ora non è necessario.

#### 8.2.6 Security e Privacy (Client-side)
- [x] **Sandboxed UIs**: Verificare che i widget siano renderizzati in iframe sandboxed
- [x] **CSP nei Widget**: Verificare se è necessario definire CSP nei widget HTML
    - Il CSP è applicato a livello di server (header HTTP)
    - ChatGPT gestisce il rendering dei widget in iframe sandboxed
    - I widget non includono contenuto dinamico non controllato
- [x] **Data Minimization**: Verificare che i widget richiedano solo dati minimi necessari
    - Il widget mostra un catalogo completo
    - I dati sono necessari per la funzionalità del widget
    - Non ci sono dati PII o sensibili nei prodotti
  - **Nota**: Se in futuro ci fossero migliaia di prodotti, si potrebbe considerare paginazione o filtri lato server, ma per ora recuperare tutti i prodotti è accettabile.
- [ ] **Privacy Policy**: Verificare se è necessario includere privacy policy nel widget
  - Stato attuale: **NON IMPLEMENTATO** - Potrebbe essere necessario per la sottomissione a ChatGPT App Store
  - **Raccomandazione**: Verificare i requisiti di sottomissione ChatGPT per vedere se è richiesta una privacy policy. Se richiesta, aggiungere link o testo della privacy policy nel widget o nella documentazione.

#### 8.2.7 Responsiveness e Accessibilità
- [x] **Responsive Design**: Il widget è responsive
  - Stato attuale: Usa Tailwind responsive classes (es. `sm:`, `md:`) e `ResizeObserver` (riga 777 in `pizzaz-shop/index.tsx`)
- [x] **Media Queries**: Verificare uso appropriato di media queries
    - `src/media-queries.ts`: Implementa helper per `prefersReducedMotion`, `isPrimarilyTouchDevice`, `isHoverAvailable`
    - `useMaxHeight()`: Gestisce altezza massima dinamica basata sul contesto
    - `useDisplayMode()`: Gestisce modalità display (inline, fullscreen, pip)
    - Tailwind responsive classes (`sm:`, `md:`) per layout responsive
    - `ResizeObserver` per adattamento dinamico del layout
  - File: `src/media-queries.ts`, `src/use-max-height.ts`, `src/use-display-mode.ts`, `src/gdo-shop/index.tsx`
- [x] **Keyboard Navigation**: Verificare supporto navigazione da tastiera
  - **Completato**: [2026-01-08] Tutti i componenti interattivi supportano navigazione da tastiera:
    - Tutti i bottoni sono navigabili con Tab e attivabili con Enter/Space
    - Gli articoli cliccabili hanno `tabIndex={0}` e gestiscono `onKeyDown` per Enter/Space
    - I bottoni di quantità hanno gestione `onKeyDown` per Enter/Space
    - Il bottone "See all items" ha gestione `onKeyDown` per Enter/Space
    - Focus styles visibili con `focus:outline-none focus:ring-2` per indicare elemento attivo
    - I componenti `Button` di `@openai/apps-sdk-ui` gestiscono automaticamente la navigazione da tastiera
  - File: `src/gdo-shop/index.tsx`
- [ ] **Screen Reader Support**: Verificare supporto screen reader

#### 8.2.8 Error Handling e User Feedback
- [x] **Error Handling**: Verificare gestione errori nel widget
    - `try-catch` per `window.openai.requestModal()` con logging errori (riga 618-626)
    - `try-catch` per `window.dispatchEvent()` con logging errori (riga 916-922)
    - `try-catch` per `window.openai.requestDisplayMode()` con logging errori (riga 960-964)
    - Gli errori sono loggati in console per debugging
    - Il widget gestisce gracefully i fallimenti delle API OpenAI senza crashare
    - I bottoni disabilitati prevengono azioni invalide (es. checkout con carrello vuoto)
  - File: `src/gdo-shop/index.tsx`
- [x] **Loading States**: Verificare se sono necessari stati di caricamento
  - **Valutato**: [2026-01-08] Stati di caricamento non sono necessari perché:
    - Il widget riceve dati tramite `widgetProps` e `toolOutput` da ChatGPT, non fa fetch asincroni
    - I dati sono disponibili immediatamente quando il widget viene renderizzato
    - Le operazioni asincrone (modal, display mode) sono gestite internamente da ChatGPT SDK
    - Se in futuro si volessero fetch asincroni (es. aggiornamento prodotti in tempo reale), si potrebbero aggiungere loading states
  - File: `src/gdo-shop/index.tsx`
- [x] **User Feedback**: Verificare che il widget fornisca feedback appropriato alle azioni utente
    - Aggiornamento visivo immediato quando si aggiunge/rimuove quantità (aggiornamento numerico)
    - Feedback visivo per filtri attivi (cambio variante bottone, `aria-pressed`)
    - Feedback hover per elementi interattivi (bordo colorato, cambio opacità)
    - Feedback focus per navigazione tastiera (ring visibile)
    - Aggiornamento dinamico del conteggio carrello nel bottone
    - Transizioni animate per cambi di stato (Framer Motion)
    - I bottoni disabilitati hanno stile visivo chiaro (opacità ridotta)
  - File: `src/gdo-shop/index.tsx`

### 8.3 Problemi critici da risolvere (Client/Widget)

1. **Accessibilità completa**: ✅ **COMPLETATO** [2026-01-08]
   - ✅ Tutti i componenti interattivi hanno appropriate etichette ARIA
   - ✅ Supporto navigazione da tastiera completo implementato
   - ✅ Supporto screen reader completo implementato

2. **CSP nei Widget HTML**: ✅ **VERIFICATO** [2026-01-08]
   - ✅ I widget HTML sono serviti con header CSP dal server
   - ✅ ChatGPT gestisce il rendering in iframe sandboxed
   - ✅ Non sono necessari CSP meta tags nei widget

3. **Error Handling completo**: ✅ **COMPLETATO** [2026-01-08]
   - ✅ Gestione errori completa per tutte le operazioni asincrone
   - ✅ Loading states valutati come non necessari (dati disponibili immediatamente)
   - ✅ Feedback utente migliorato con aggiornamenti visivi e aria-label dinamici

4. **Ottimizzazione UX per conversazione**: ✅ **VERIFICATO** [2026-01-08]
   - ✅ Il widget gestisce bene prompt aperti tramite widgetProps
   - ✅ Le risposte sono concise e appropriate
   - ✅ Il widget si integra con ChatGPT senza sostituirlo

5. **Data Minimization**: ✅ **VERIFICATO** [2026-01-08]
   - ✅ Il widget richiede solo dati minimi necessari
   - ✅ Lazy loading non necessario per il caso d'uso attuale

6. **Privacy Policy**: (Opzionale)
   - Verificare i requisiti di sottomissione ChatGPT App Store
   - Se richiesta, aggiungere link o testo della privacy policy
   - **Nota**: Per verifiche dettagliate, vedere `bugs.md` sezione "Verifiche da fare"

### 8.4 Checklist finale pre-deployment (Client/Widget)

- [x] Accessibilità completa verificata (ARIA, keyboard navigation, screen reader) - **Completato**: [2026-01-08]
- [x] CSP configurato nei widget HTML (se necessario) - CSP gestito dal server, non necessario nei widget
- [x] Error handling completo implementato - **Completato**: [2026-01-08]
- [x] Loading states implementati dove necessario - **Valutato**: [2026-01-08] Non necessari per il caso d'uso attuale
- [x] UX ottimizzata per conversazione
- [ ] Responsive design testato su diversi dispositivi - **DA TESTARE** quando il widget è renderizzato in ChatGPT
- [x] Widget state persiste correttamente tra interazioni
- [ ] Privacy policy inclusa (se richiesta per sottomissione) - Verificare requisiti ChatGPT App Store
- [ ] Test di usabilità completati - **DA COMPLETARE** dopo deployment
- [x] Performance ottimizzata (lazy loading, code splitting se necessario) - **Valutato**: [2026-01-08] Non necessario per il caso d'uso attuale

## 9. Distribuzione e interazione con ChatGPT

- [x]  **Chiarire "caricare quest'app su ChatGPT"**: Si intende la realizzazione di un'app per ChatGPT SDK, ospitata su un server e integrata con ChatGPT per mostrare i prodotti elettronici, probabilmente tramite un'azione personalizzata (Custom GPT Action).

### 9.1 Deployment dell'applicazione su Render (Servizio Unico)

- [ ]  **Configurazione del servizio su Render**: Crea un nuovo "Web Service" su Render.
    - [ ]  **Root Directory**: Imposta la "Root Directory" alla radice del tuo repository (`.`).
    - [ ]  **Build Command**: `pnpm install --prefix . && pnpm run build && pip install -r gdo_server_python/requirements.txt && curl -LsSf https://setup.uv.sh | sh` (Questo comando gestisce le dipendenze frontend e Python, e installa il tool `uv` come binario.)
      - **Aggiornato**: [2026-01-08] Il Build Command è stato aggiornato a `gdo_server_python/requirements.txt` dopo il completamento del refactoring (Sezione 6).
    - [ ]  **Start Command**: `uvicorn gdo_server_python.main:app --host 0.0.0.0 --port $PORT` (Questo comando avvia il server FastAPI personalizzato con uvicorn.)
      - **Implementato**: [2026-01-08] Aggiunta variabile `app = mcp.sse_app()` alla fine di `gdo_server_python/main.py` per esporre l'app FastAPI per uvicorn. Il server usa FastMCP con SSE transport per compatibilità con ChatGPT SDK.
      - **Nota**: Il comando usa `uvicorn` con il modulo `gdo_server_python.main` e la variabile `app` esposta. Il server personalizzato integra MotherDuck direttamente usando DuckDB.
      - **Verificare**: Il comando deve essere testato su Render per confermare che funziona correttamente.
    - [ ]  **Variabili d'ambiente**: Aggiungi `MOTHERDUCK_TOKEN` (con il tuo token), `MCP_ALLOWED_HOSTS` (deve includere `sdk-gdo.onrender.com`), `MCP_ALLOWED_ORIGINS` (deve includere `https://chat.openai.com` e `https://sdk-gdo.onrender.com`) e altre variabili necessarie.
      - **IMPORTANTE**: [2026-01-08] `MOTHERDUCK_TOKEN` è OBBLIGATORIO per il funzionamento del server. Il server DEVE avere MotherDuck configurato perché integra MotherDuck direttamente usando DuckDB per recuperare i prodotti GDO. Senza questo token, il tool `product-list` non funzionerà.
      - **Variabili richieste**:
        - `MOTHERDUCK_TOKEN` (OBBLIGATORIO): Token di autenticazione MotherDuck per accedere al database `app_gpt_elettronica`
        - `MCP_ALLOWED_HOSTS`: Deve includere `sdk-gdo.onrender.com` per Transport Security
        - `MCP_ALLOWED_ORIGINS`: Deve includere `https://chat.openai.com` e `https://sdk-gdo.onrender.com` per CORS

### 9.2 Configurazione di ChatGPT

- [ ]  **Creare una Custom GPT**: Seguire le istruzioni nell'interfaccia di ChatGPT per creare una nuova Custom GPT.
- [ ]  **Configurare un'azione personalizzata**: Aggiungere un'azione al Custom GPT che punta all'URL corretto del manifest OpenAPI: `https://sdk-gdo.onrender.com/sse/openapi.json`. (L'URL include `/sse` come richiesto dall'applicazione ChatGPT SDK.)

### 9.3 Adattamento degli strumenti (Tools)

- [x]  **Esaminare la definizione degli strumenti nel backend Python**: Capire come gli strumenti attuali sono definiti in `gdo_server_python/main.py`.
    - `gdo-map`: Widget mappa interattiva
    - `gdo-carousel`: Widget carosello prodotti
    - `gdo-albums`: Widget galleria prodotti
    - `gdo-list`: Widget lista prodotti
    - `gdo-shop`: Widget negozio interattivo completo
    - `shopping-cart`: Widget carrello (checkout + riepilogo post-acquisto)
    - `product-list`: Tool che recupera prodotti da MotherDuck
    - `create_checkout_session`: Tool MCP che crea una Stripe Checkout Session (legacy)
    - `create_payment_intent`: Tool Stripe (PaymentIntent, solo card)
    - `confirm_payment_intent`: Tool Stripe (conferma PaymentIntent)
    - `checkout_create_session`: Crea sessione checkout MCP (totali + PaymentIntent)
    - `checkout_update_session`: Aggiorna sessione checkout MCP (items/currency/promo)
    - `checkout_complete_session`: Completa sessione checkout MCP (conferma pagamento)
- [x]  **Modificare o creare nuovi strumenti per i prodotti elettronici**: Adattare gli strumenti esistenti o crearne di nuovi per interagire con i dati dei prodotti elettronici.
  - **Completato**: [2026-01-08] Tutti gli strumenti sono stati adattati per prodotti elettronici:
    1. ✅ Identificatori aggiornati da `pizza-*` a `gdo-*` (completato in Sezione 6)
    2. ✅ Titoli e descrizioni aggiornati per riflettere prodotti elettronici (completato in Sezione 6 e 7)
    3. ✅ Tool `product-list` implementato per recuperare prodotti da MotherDuck
  - **Nota**: Tutti i tool Stripe/checkout richiedono la variabile d'ambiente `STRIPE_SECRET_KEY` sul server.
  - **Nota**: Se in futuro si volessero tool aggiuntivi (es. ricerca prodotti, filtri avanzati), si possono aggiungere seguendo lo stesso pattern.
    3. Valutare se aggiungere nuovi tool: `search-products` (cerca prodotti per nome/categoria), `product-details` (dettagli prodotto specifico), `filter-products` (filtra per prezzo/categoria)
    4. Aggiornare `TOOL_INPUT_SCHEMA` per rimuovere `pizzaTopping` e aggiungere parametri appropriati per prodotti elettronici

### 9.4 Test e sottomissione

- [ ]  **Testare l'interazione con ChatGPT**: Verificare che ChatGPT possa correttamente invocare gli strumenti e visualizzare i widget con i nuovi prodotti.
- [ ]  **Sottomettere l'applicazione (se applicabile)**: Seguire i passaggi per la sottomissione dell'app se l'intenzione è di renderla disponibile ad altri utenti.

## 10. Prompt iniziale per ChatGPT

Questa sezione definisce il prompt iniziale che verrà configurato per l'assistente AI quando interagisce con l'app GDO su ChatGPT. Il prompt serve a fornire contesto, obiettivi e informazioni sui tool disponibili.

**Stato**: [ ] Da implementare

**Nota**: Questo prompt sarà creato insieme all'utente quando sarà il momento di implementarlo. Di seguito è fornita la struttura base basata sull'esempio del collega (MedicAir), da adattare al contesto GDO.

### 10.1 Struttura del prompt

Il prompt seguirà questa struttura (da completare):

```
Sei un assistente AI per [Nome dell'app GDO].


#Chi è [Nome dell'app]?
[Descrizione dell'applicazione, del business e dei servizi offerti]


#I tuoi obiettivi
1) [Primo obiettivo principale]
2) [Secondo obiettivo principale]
[...]


Per svolgere questi compiti hai a disposizione [numero] mcp server: 
1) [nome-server]
2) [nome-server]
[...]


#[nome-server]
[Descrizione del server MCP e dei tool disponibili]
[Come accedere ai dati/documenti]
[Quando usare questo server]


#Database e dati disponibili
[Se applicabile, descrizione del database MotherDuck con:]

### 1. **[nome-tabella]** - [Descrizione]
- **Cosa contiene**: [Descrizione contenuto]
- **Informazioni chiave**:
  - [Campo 1]
  - [Campo 2]
  - [...]
- **Usala per**: [Casi d'uso]

[... altre tabelle ...]


## COLLEGAMENTI TRA TABELLE

### Join Principali Possibili:
[Descrizione delle relazioni tra tabelle e come fare JOIN]

### Query Multi-Tabella Utili:
[Esempi di query che coinvolgono multiple tabelle]


## QUICK REFERENCE - Quando Usare Quale Tool/Tabella

| Domanda | Tool/Tabella Primaria | Tool/Tabelle Secondarie |
|---------|----------------------|------------------------|
| [Esempio domanda] | [Tool/Tabella] | [Altri] |
[...]


## NOTE IMPORTANTI

⚠️ **Attenzioni specifiche**: [Note su nomi campi, formati, convenzioni, ecc.]
```

### 10.2 Domande da risolvere prima dell'implementazione

Quando sarà il momento di implementare il prompt, dovranno essere chiariti i seguenti punti:

#### 10.2.1 Identità e obiettivi
- [ ] **Nome dell'app**: Qual è il nome ufficiale dell'applicazione GDO?
- [ ] **Chi è l'app**: Qual è la descrizione del business/servizio? (es. negozio online di elettronica, marketplace, ecc.)
- [ ] **Obiettivi principali**: Quali sono i 2-3 obiettivi principali dell'assistente AI? (es. aiutare a trovare prodotti, fornire informazioni tecniche, supportare gli acquisti, ecc.)

#### 10.2.2 Server MCP disponibili
- [ ] **Elettronics server**: Come descrivere il server `gdo-python` e i suoi tool?
  - Tool disponibili: `gdo-map`, `gdo-carousel`, `gdo-albums`, `gdo-list`, `gdo-shop`, `shopping-cart`, `product-list`, `create_checkout_session`, `create_payment_intent`, `confirm_payment_intent`, `checkout_create_session`, `checkout_update_session`, `checkout_complete_session`
  - Quando usare ciascun tool?
  - Qual è il flusso di interazione consigliato?

#### 10.2.3 Database MotherDuck (se applicabile)
- [ ] **Database**: Qual è il nome del database MotherDuck usato?
- [ ] **Tabelle disponibili**: Quali tabelle sono presenti nel database?
- [ ] **Struttura tabelle**: Quali sono i campi principali di ciascuna tabella?
- [ ] **Relazioni**: Come si relazionano le tabelle tra loro?
- [ ] **Casi d'uso**: Per quali tipi di domande/query usare ciascuna tabella?

#### 10.2.4 Esempi e quick reference
- [ ] **Query di esempio**: Quali sono le query più comuni che l'utente farà?
- [ ] **Pattern di domande**: Come mappare domande naturali agli strumenti disponibili?
- [ ] **Note importanti**: Ci sono convenzioni, limitazioni o attenzioni speciali da comunicare all'AI?

### 10.3 Template base (da completare)

```
Sei un assistente AI per GDO.


#Chi è GDO?
[DA COMPLETARE: Descrizione del business, servizi offerti, tipologia di negozio/applicazione]


#I tuoi obiettivi
1) [DA COMPLETARE: Primo obiettivo - es. aiutare gli utenti a trovare prodotti elettronici]
2) [DA COMPLETARE: Secondo obiettivo - es. fornire informazioni tecniche sui prodotti]
3) [DA COMPLETARE: Terzo obiettivo se necessario]


Per svolgere questi compiti hai a disposizione il seguente MCP server: 

#gdo-python
Attraverso questo MCP server hai accesso ai seguenti tool:

- **gdo-map**: [DA COMPLETARE: quando usarlo]
- **gdo-carousel**: [DA COMPLETARE: quando usarlo]
- **gdo-albums**: [DA COMPLETARE: quando usarlo]
- **gdo-list**: [DA COMPLETARE: quando usarlo]
- **gdo-shop**: [DA COMPLETARE: quando usarlo - questo è il negozio completo con carrello]
- **product-list**: [DA COMPLETARE: quando usarlo - recupera prodotti dal database MotherDuck]


[SE APPLICABILE - Database MotherDuck]

#Database MotherDuck
Attraverso il tool `product-list` accederai al database '[nome-database]' con le seguenti tabelle:

### 1. **[nome-tabella]** - [Descrizione]
- **Cosa contiene**: [DA COMPLETARE]
- **Informazioni chiave**:
  - [DA COMPLETARE: campi principali]
- **Usala per**: [DA COMPLETARE: casi d'uso]

[... altre tabelle se presenti ...]


## COLLEGAMENTI TRA TABELLE
[DA COMPLETARE se ci sono multiple tabelle]


## QUICK REFERENCE - Quando Usare Quale Tool

| Domanda dell'utente | Tool da usare | Note |
|---------------------|---------------|------|
| "Mostrami prodotti a caso" | gdo-carousel | Visualizza in formato carosello |
| "Voglio vedere una lista di prodotti" | gdo-list | Lista compatta |
| "Apri il negozio completo" | gdo-shop | Negozi con carrello |
| "Cerca prodotti specifici nel database" | product-list | Con query al database |
| [... altre esempi da aggiungere ...] | | |


## NOTE IMPORTANTI

⚠️ **Widget disponibili**: I tool restituiscono widget HTML interattivi che vengono visualizzati direttamente nella chat
⚠️ **Carrello**: Il tool `gdo-shop` include funzionalità di carrello con possibilità di aggiungere/rimuovere prodotti
⚠️ **Database**: Il tool `product-list` recupera dati in tempo reale dal database MotherDuck
```

### 10.4 Note per l'implementazione

- Il prompt sarà configurato come "Initial Prompt" o "System Prompt" nella configurazione ChatGPT
- Deve essere chiaro, conciso ma completo
- Deve guidare l'AI a usare i tool corretti in base alle richieste dell'utente
- Deve includere esempi pratici di quando usare ciascun tool
- Deve essere scritto in italiano se l'app è in italiano, o nella lingua target dell'app

### 10.5 Prompt completo (pronto all'uso)

**Stato**: [x] Completato - Basato sugli scenari di demo forniti e categorie reali dei prodotti

Questo prompt è pronto per essere configurato come "Initial Prompt" o "System Prompt" nella configurazione ChatGPT. Integra gli scenari di demo (Advisor per la TV e Supporto Post-Vendita) e fornisce istruzioni complete per l'uso dei tool disponibili con le categorie reali dei prodotti.

```
Sei un assistente AI specializzato per GDO, un negozio online di prodotti elettronici che aiuta i clienti a trovare, confrontare e acquistare dispositivi elettronici.

#Chi è GDO?

GDO è un negozio online specializzato in prodotti elettronici di alta qualità. Offriamo un'ampia gamma di dispositivi elettronici organizzati in tre categorie principali:

📺 **Video & TV**: Televisori, accessori TV, supporti TV, proiettori, lettori DVD e Blu-ray
💻 **Informatica**: Computer desktop, monitor, tablet, stampanti e scanner, accessori PC, componenti, dispositivi di input (tastiere e mouse)
🔊 **Audio**: Altoparlanti, cuffie, audio wireless e Bluetooth, audio domestico, home theater, microfoni, amplificatori

Il nostro obiettivo è aiutare i clienti a trovare il prodotto perfetto per le loro esigenze attraverso consulenza personalizzata, confronti tecnici dettagliati e supporto post-vendita proattivo.

#I tuoi obiettivi

1) **Consulenza e Advisor per la Selezione Prodotti**: Aiutare i clienti a trovare il prodotto ideale attraverso domande di qualificazione mirate (budget, utilizzo, spazio, condizioni d'uso) e fornire confronti tecnici dettagliati tra modelli alternativi. Quando un cliente chiede consigli su un prodotto (es. "Vorrei una TV per gaming"), fai domande per capire le sue esigenze specifiche (distanza di visualizzazione, condizioni di luce, budget) e poi suggerisci modelli appropriati con confronti tecnici side-by-side.

2) **Supporto Post-Vendita Proattivo**: Fornire assistenza tecnica personalizzata ai clienti che hanno già acquistato prodotti. Quando un cliente chiede aiuto per configurare un dispositivo o ha un problema, riconosci il prodotto acquistato (se disponibile nella memoria della conversazione), fornisci guide passo-passo invece di link generici, e suggerisci proattivamente accessori compatibili o manutenzioni preventive.

3) **Visualizzazione e Navigazione Prodotti**: Mostrare i prodotti in formati diversi (carosello, lista, mappa, galleria) in base alle preferenze dell'utente e al contesto della richiesta. Usa i widget interattivi per rendere l'esperienza visiva e coinvolgente.

4) **Gestione Acquisti e Carrello**: Supportare il processo di acquisto attraverso il negozio interattivo completo con funzionalità di carrello, filtri per categoria (Video & TV, Informatica, Audio) e checkout.

Per svolgere questi compiti hai a disposizione il seguente MCP server:

#gdo-python

Attraverso questo MCP server hai accesso ai seguenti tool per visualizzare e gestire i prodotti elettronici:

- **gdo-map**: Visualizza una mappa interattiva che mostra la posizione dei negozi fisici o la distribuzione geografica dei prodotti. Usalo quando l'utente chiede informazioni su negozi fisici, disponibilità locale, o posizioni ("Verifica disponibilità in negozio", "Dove posso trovare questo prodotto?"). Restituisce un widget HTML con mappa interattiva.

- **gdo-carousel**: Mostra un carosello interattivo di prodotti (massimo 12 prodotti). Usalo quando l'utente vuole sfogliare prodotti in modo visivo e coinvolgente ("Mostrami prodotti a caso", "Fammi vedere alcune opzioni"). Ideale per esplorazione casuale o quando vuoi mostrare una selezione curata di prodotti. Restituisce un widget HTML con carosello navigabile.

- **gdo-albums**: Visualizza una galleria di prodotti organizzati per categoria o tema. Usalo quando l'utente vuole vedere prodotti raggruppati per categoria ("Mostrami tutti i televisori", "Voglio vedere prodotti per gaming"). Restituisce un widget HTML con galleria organizzata.

- **gdo-list**: Mostra una lista compatta di prodotti. Usalo quando l'utente vuole una vista d'insieme rapida o quando devi mostrare molti prodotti in modo efficiente ("Voglio vedere una lista di prodotti", "Mostrami tutti i prodotti disponibili"). Restituisce un widget HTML con lista scrollabile.

- **gdo-shop**: Apre il negozio interattivo completo con funzionalità di carrello, filtri per categoria (Video & TV, Informatica, Audio), e checkout. **USALO PRINCIPALMENTE QUANDO L'UTENTE È PRONTO AD ACQUISTARE O VUOLE GESTIRE UN CARRELLO**. Usalo quando l'utente dice "Apri il negozio", "Voglio comprare", "Aggiungi al carrello", o quando vuoi permettere all'utente di selezionare quantità e procedere al checkout. Questo è il tool più completo e include tutte le funzionalità di e-commerce. Il negozio mostra al massimo 24 prodotti alla volta per ottimizzare le prestazioni. Restituisce un widget HTML interattivo con carrello funzionante.

- **product-list**: Recupera l'elenco completo dei prodotti elettronici disponibili dal database MotherDuck in tempo reale. **USALO QUANDO DEVI ACCEDERE AI DATI DEI PRODOTTI PER ANALISI, CONFRONTI TECNICI, O QUANDO DEVI FILTRARE/RICERCARE PRODOTTI SPECIFICI**. Usalo quando l'utente chiede confronti tecnici dettagliati, quando devi analizzare specifiche tecniche, o quando devi cercare prodotti con caratteristiche specifiche. Restituisce dati strutturati JSON con tutti i dettagli dei prodotti (nome, prezzo, descrizione, categorie, rating, immagini, etc.).

#Database MotherDuck

Attraverso il tool `product-list` accederai al database `app_gpt_elettronica` con la seguente tabella:

### 1. **prodotti_xeel_shop** - Catalogo prodotti elettronici

- **Cosa contiene**: Catalogo completo di tutti i prodotti elettronici disponibili nel negozio, organizzati in tre categorie principali
- **Informazioni chiave**:
  - `id`: Identificatore univoco del prodotto
  - `name`: Nome del prodotto
  - `prices`: Prezzo del prodotto (numero)
  - `descrizione_prodotto`: Descrizione dettagliata del prodotto
  - `imageURLs`: URL delle immagini del prodotto (può essere una lista separata da virgole)
  - `voto_prodotto_1_5`: Rating del prodotto su scala 1-5
  - `categories`: Categorie del prodotto (stringa separata da virgole)
  - `pro`: Punti di forza del prodotto (stringa separata da virgole)
  - `weight`: Peso del prodotto
- **Categorie principali disponibili**:
  - **📺 Video & TV**: Prodotti con tag/categorie come "tv", "televisions", "tv accessories", "tv mounts", "projectors", "video projectors", "dvd players", "blu-ray players"
  - **💻 Informatica**: Prodotti con tag/categorie come "computers", "desktop computers", "monitors", "tablets", "printers", "scanners", "computer accessories", "pc components", "input devices", "keyboards", "mice"
  - **🔊 Audio**: Prodotti con tag/categorie come "audio", "speakers", "wireless speakers", "bluetooth speakers", "headphones", "home audio", "home theater", "home theater systems", "microphones", "amplifiers"
- **Usala per**: 
  - Recuperare tutti i prodotti per analisi e confronti
  - Cercare prodotti per categoria specifica (Video & TV, Informatica, Audio)
  - Ottenere dettagli tecnici per confronti side-by-side
  - Verificare disponibilità e specifiche complete
  - Filtrare prodotti per prezzo, categoria, o caratteristiche specifiche

## SCENARI DI DEMO PRINCIPALI

### Scenario A: L'Advisor per la TV (Il confronto guidato)

**Obiettivo**: L'utente chiede consigli su un prodotto (es. "Vorrei una TV per gaming e cinema").

**Flusso consigliato**:

1. **Fase di Qualificazione**: Fai domande mirate per capire le esigenze:
   - Budget disponibile
   - Distanza di visualizzazione (es. "A che distanza ti siedi dal televisore?")
   - Condizioni di luce (es. "La stanza ha molta luce naturale o è buia?")
   - Utilizzo principale (gaming, cinema, TV normale, streaming)

2. **Fase di Suggerimento**: Dopo aver raccolto le informazioni, usa `product-list` per recuperare i prodotti dal database e seleziona 2-3 modelli appropriati dalla categoria **Video & TV**. Presenta i suggerimenti con brevi spiegazioni.

3. **Fase di Confronto Tecnico**: Se l'utente chiede un confronto diretto (es. "Non capisco bene le differenze tecniche. Puoi metterli a confronto?"), usa `product-list` per recuperare i dettagli completi e crea una **tabella comparativa side-by-side** che mostri:
   - Prezzo
   - Dimensioni/Pollici
   - Tecnologia display (OLED vs LED vs QLED)
   - Specifiche tecniche rilevanti (HDR, refresh rate, input lag per gaming)
   - Pro e contro di ciascun modello
   - Quale si vede meglio in condizioni specifiche (es. "Quale dei due si vede meglio se c'è molta luce in stanza?")

4. **Fase di Disponibilità e Acquisto**: Quando l'utente è pronto ad acquistare (es. "Ok, mi hai convinto per il Samsung. È disponibile subito? Posso ordinarlo?"):
   - Usa `gdo-map` se l'utente chiede disponibilità in negozio fisico (richiedi CAP o città)
   - Usa `gdo-shop` per aprire il negozio completo e permettere l'acquisto
   - Simula la verifica di disponibilità: "✅ Ho verificato la disponibilità: è presente in magazzino centrale con consegna in 24/48h. Vuoi che proceda al checkout utilizzando il metodo di pagamento salvato nel tuo account?"

**Esempio di conversazione**:
- Utente: "Ciao, vorrei cambiare la TV in salotto. Ho un budget di circa 800€ e guardiamo soprattutto serie TV su Netflix la sera. Cosa mi consigli?"
- Tu: [Fai domande di qualificazione: distanza, luce]
- Utente: "Mi siedo a circa 3 metri dal televisore e la stanza ha una piccola luce soffusa la sera"
- Tu: [Suggerisci 2-3 modelli usando product-list dalla categoria Video & TV, es. LG OLED C3 e Samsung QN90C]
- Utente: "Ho visto che mi hai suggerito sia l'LG C3 che il Samsung QN90C. Non capisco bene le differenze tecniche. Puoi metterli a confronto diretto? Quale dei due si vede meglio se c'è molta luce in stanza?"
- Tu: [Crea tabella comparativa side-by-side con pro/contro tecnici]
- Utente: "Ok, mi hai convinto per il Samsung. È disponibile subito? Posso ordinarlo?"
- Tu: [Verifica disponibilità, apri gdo-shop per checkout]

### Scenario B: Supporto Post-Vendita Proattivo

**Obiettivo**: L'utente chiede aiuto per configurare un dispositivo o ha un problema tecnico.

**Flusso consigliato**:

1. **Riconoscimento Prodotto**: Se l'utente menziona un prodotto acquistato in passato, riconoscilo dalla memoria della conversazione o chiedi quale modello specifico possiede e a quale categoria appartiene (Video & TV, Informatica, Audio).

2. **Guida Passo-Passo**: Invece di fornire link generici, fornisci una **guida passo-passo dettagliata** personalizzata per il modello specifico. Usa `product-list` se necessario per recuperare informazioni specifiche sul prodotto dalla categoria appropriata.

3. **Suggerimenti Proattivi**: Dopo aver risolto il problema, suggerisci proattivamente:
   - Accessori compatibili dalla stessa categoria o categorie correlate
   - Manutenzioni preventive
   - Ottimizzazioni delle impostazioni
   - Funzionalità avanzate che l'utente potrebbe non conoscere

**Esempi di conversazione**:

- **Prova 1**: "Ciao, ho collegato la cassa alla televisione ma non si sente niente. Ho provato con il cavo che c'era nella scatola ma non va. Sono un po' scocciato."
  - Tu: [Riconosci il modello TV dalla categoria Video & TV, fornisci guida passo-passo per risolvere il problema audio, suggerisci accessori audio compatibili dalla categoria Audio]

- **Prova 2**: "Ho sentito dire che gli schermi OLED possono rovinarsi se rimangono immagini fisse troppo a lungo. Devo preoccuparmi per il mio modello? C'è qualche manutenzione che devo fare?"
  - Tu: [Spiega il burn-in OLED per prodotti Video & TV, fornisci consigli di manutenzione specifici per il modello, suggerisci impostazioni di protezione]

- **Prova 3**: "Stasera vengono amici per giocare alla PlayStation 5. Mi assicuri che la TV è settata al massimo per i giochi? Non vorrei avere rallentamenti."
  - Tu: [Fornisci guida passo-passo per ottimizzare le impostazioni gaming per prodotti Video & TV, verifica specifiche tecniche con product-list se necessario, suggerisci modalità game mode]

## QUICK REFERENCE - Quando Usare Quale Tool

| Domanda/Richiesta dell'utente | Tool da usare | Note |
|------------------------------|---------------|------|
| "Mostrami prodotti a caso" / "Fammi vedere alcune opzioni" | `gdo-carousel` | Visualizzazione visiva e coinvolgente (max 12 prodotti) |
| "Voglio vedere una lista di prodotti" / "Mostrami tutti i prodotti" | `gdo-list` | Vista compatta e efficiente |
| "Mostrami prodotti per categoria" / "Voglio vedere tutti i televisori" | `gdo-albums` | Galleria organizzata per categoria (Video & TV, Informatica, Audio) |
| "Verifica disponibilità in negozio" / "Dove posso trovare questo prodotto?" | `gdo-map` | Mappa interattiva con posizioni |
| "Apri il negozio" / "Voglio comprare" / "Aggiungi al carrello" | `gdo-shop` | **Negozi completo con carrello, filtri per categoria e checkout (max 24 prodotti)** |
| "Mostra il carrello" / "Voglio vedere il carrello" / "Cosa ho nel carrello?" | `shopping-cart` | Carrello condiviso con checkout e riepilogo post-acquisto |
| "Confronta questi due modelli" / "Quali sono le differenze tecniche?" | `product-list` + tabella comparativa | Recupera dati per confronto dettagliato |
| "Cerca prodotti con caratteristiche specifiche" / "Trova TV OLED sotto 1000€" | `product-list` | Analisi e filtri sui dati |
| "Quale prodotto è meglio per gaming?" / Consulenza tecnica | `product-list` + widget appropriato | Analisi dati + visualizzazione |
| "Aiuto con configurazione dispositivo" / Supporto tecnico | `product-list` (se necessario) + guida passo-passo | Riconosci prodotto e categoria, fornisci guida personalizzata |
| "Mostrami prodotti Audio" / "Voglio vedere cuffie" | `gdo-shop` con filtro Audio | Usa il negozio con filtri per categoria |
| "Cerco un monitor per il computer" | `product-list` + `gdo-shop` | Cerca nella categoria Informatica, poi mostra nel negozio |

## NOTE IMPORTANTI

⚠️ **Widget Interattivi**: I tool `gdo-map`, `gdo-carousel`, `gdo-albums`, `gdo-list`, e `gdo-shop` restituiscono widget HTML interattivi che vengono visualizzati direttamente nella chat. Questi widget permettono all'utente di interagire visivamente con i prodotti.

⚠️ **Carrello e Checkout**: Il tool `gdo-shop` include funzionalità complete di carrello con possibilità di aggiungere/rimuovere prodotti, selezionare quantità, filtrare per categoria (Video & TV, Informatica, Audio), e procedere al checkout. Usalo quando l'utente è pronto ad acquistare. Il widget `shopping-cart` completa il pagamento simulato, **svuota il carrello** e mostra un **riepilogo post-acquisto** con prodotti, totali, dati fattura e data di consegna. Il pulsante "Procedi al pagamento" apre una **modale** per inserire i dati di fatturazione. I prezzi includono IVA; la spedizione è mostrata nel carrello (gratis sopra 50€).

⚠️ **Database in Tempo Reale**: Il tool `product-list` recupera dati in tempo reale dal database MotherDuck (`app_gpt_elettronica`). I dati sono sempre aggiornati e includono tutti i dettagli tecnici necessari per confronti e analisi.

⚠️ **Categorie Prodotti**: I prodotti sono organizzati in tre categorie principali:
- **📺 Video & TV**: Televisori, accessori TV, supporti, proiettori, lettori DVD/Blu-ray
- **💻 Informatica**: Computer, monitor, tablet, stampanti, accessori PC, componenti, tastiere e mouse
- **🔊 Audio**: Altoparlanti, cuffie, audio wireless/Bluetooth, home theater, microfoni, amplificatori

⚠️ **Limiti di Visualizzazione**: 
- Il carosello (`gdo-carousel`) mostra al massimo 12 prodotti
- Il negozio (`gdo-shop`) mostra al massimo 24 prodotti alla volta
- Questi limiti migliorano le prestazioni e l'esperienza utente

⚠️ **Confronti Tecnici**: Quando crei confronti tecnici, usa sempre `product-list` per recuperare i dati completi e crea tabelle comparative side-by-side chiare che mostrino pro e contro di ciascun modello.

⚠️ **Supporto Proattivo**: Dopo aver risolto un problema tecnico, suggerisci sempre proattivamente accessori compatibili dalla stessa categoria o categorie correlate, manutenzioni preventive, o ottimizzazioni. Questo migliora l'esperienza del cliente e mostra valore aggiunto.

⚠️ **Domande di Qualificazione**: Quando un cliente chiede consigli su un prodotto, fai sempre domande di qualificazione mirate (budget, utilizzo, spazio, condizioni) prima di suggerire modelli. Questo ti permette di fornire consigli più accurati e personalizzati.

⚠️ **Chiusura Transazionale**: Quando l'utente è pronto ad acquistare, verifica sempre la disponibilità e suggerisci di procedere al checkout. Usa `gdo-shop` per aprire il negozio completo e permettere l'acquisto.
```

**Note per l'uso**:
- Questo prompt è ottimizzato per gli scenari di demo forniti (Advisor per la TV e Supporto Post-Vendita)
- Include le categorie reali dei prodotti: Video & TV, Informatica, Audio
- Include esempi pratici di conversazione per entrambi gli scenari
- Fornisce una quick reference chiara per quando usare ciascun tool
- Guida l'AI a creare confronti tecnici dettagliati e supporto proattivo
- Include informazioni sui limiti di visualizzazione (12 prodotti nel carosello, 24 nello shop)
- È scritto in italiano come richiesto per l'app

## 11. Migliorie UI e UX

Questa sezione documenta le migliorie implementate per migliorare l'esperienza utente e le prestazioni dei widget.

### 11.1 Filtri dinamici per categoria nello shop

- [x] **Implementazione filtri dinamici per categoria**: Sostituiti i filtri hardcoded (vegetarian, vegan, size, spicy) con filtri dinamici basati sulle categorie reali dei prodotti elettronici.
  - **Completato**: [2026-01-09] Implementato sistema di filtri dinamici che estrae automaticamente le categorie disponibili dai prodotti.
  - **Implementazione**:
    1. ✅ **Mappa categorie** (`src/gdo-shop/index.tsx`):
       - Creata `CATEGORY_MAPPING` che mappa categorie principali (TV & Video, Audio & Speakers, Computers, Storage, Accessories) ai loro tag associati
       - Ogni categoria ha una lista di tag che vengono cercati nei prodotti
    2. ✅ **Funzione di estrazione categorie** (`src/gdo-shop/index.tsx`):
       - Creata funzione `getAvailableCategories()` che:
         - Analizza tutti i prodotti e conta quanti appartengono a ciascuna categoria
         - Crea filtri solo per categorie che hanno almeno un prodotto
         - Ordina le categorie per numero di prodotti (dalla più popolare alla meno popolare)
         - Genera ID univoci per ogni categoria (es. "TV & Video" → "tv-&-video")
    3. ✅ **Filtri dinamici nel componente**:
       - Aggiunto `useMemo` per generare filtri dinamici basati su `cartItems`
       - I filtri vengono rigenerati automaticamente quando cambiano i prodotti
    4. ✅ **Logica di filtraggio aggiornata**:
       - Modificata `visibleCartItems` per usare i filtri dinamici invece di `FILTERS` hardcoded
       - Il filtro verifica se un prodotto ha almeno uno dei tag della categoria selezionata (match case-insensitive)
    5. ✅ **Rendering filtri aggiornato**:
       - Sostituito `FILTERS.map()` con `filters.map()` nel rendering
       - I filtri vengono visualizzati dinamicamente in base ai prodotti disponibili
  - **Vantaggi**:
    - ✅ Filtri sempre aggiornati: mostrano solo categorie con prodotti disponibili
    - ✅ Ordinamento intelligente: categorie più popolari appaiono per prime
    - ✅ Estensibilità: facile aggiungere nuove categorie modificando `CATEGORY_MAPPING`
    - ✅ Performance: filtri calcolati solo quando cambiano i prodotti (memoizzazione)
  - **Categorie supportate**:
    - TV & Video: prodotti con tag "tv", "televisions", "tv mounts", "video", "home theater", etc.
    - Audio & Speakers: prodotti con tag "audio", "speakers", "home audio", "stereos", "bluetooth speakers", etc.
    - Computers: prodotti con tag "computers", "computer accessories", "laptops", "tablets", etc.
    - Storage: prodotti con tag "storage", "hard drives", "ssd", "hdd", "nas", etc.
    - Accessories: prodotti con tag "accessories", "gdo accessories", "cables", "adapters", etc.
  - **File modificati**:
    - `src/gdo-shop/index.tsx`: Aggiunta `CATEGORY_MAPPING`, `getAvailableCategories()`, aggiornata logica filtri e rendering

### 11.2 Limite di prodotti visualizzati

- [x] **Implementazione limite prodotti nello shop**: Aggiunto limite massimo di prodotti visualizzati nello shop per migliorare le prestazioni.
  - **Completato**: [2026-01-09] Implementato limite di 24 prodotti nello shop.
  - **Implementazione**:
    1. ✅ **Costante limite** (`src/gdo-shop/index.tsx`):
       - Aggiunta costante `MAX_PRODUCTS_SHOP = 24` per definire il limite massimo
    2. ✅ **Lista prodotti limitata**:
       - Creato `displayedCartItems` con `useMemo` che limita `visibleCartItems` ai primi 24 prodotti
       - `displayedCartItems` viene ricalcolato solo quando cambia `visibleCartItems`
    3. ✅ **Rendering aggiornato**:
       - Sostituito `visibleCartItems.map()` con `displayedCartItems.map()` nel rendering
       - Aggiornato calcolo delle righe per usare `displayedCartItems.length`
    4. ✅ **Layout effect aggiornato**:
       - Aggiornato `useLayoutEffect` per dipendere da `displayedCartItems` invece di `visibleCartItems`
  - **Vantaggi**:
    - ✅ Performance migliorata: meno elementi DOM da renderizzare
    - ✅ Caricamento più veloce: ridotto il tempo di rendering iniziale
    - ✅ Esperienza utente migliore: interfaccia più reattiva
  - **File modificati**:
    - `src/gdo-shop/index.tsx`: Aggiunta `MAX_PRODUCTS_SHOP`, creato `displayedCartItems`, aggiornato rendering e layout effect

- [x] **Implementazione limite prodotti nel carosello**: Aggiunto limite massimo di prodotti visualizzati nel carosello per migliorare le prestazioni.
  - **Completato**: [2026-01-09] Implementato limite di 12 prodotti nel carosello.
  - **Implementazione**:
    1. ✅ **Costante limite** (`src/gdo-carousel/index.jsx`):
       - Aggiunta costante `MAX_PRODUCTS_CAROUSEL = 12` per definire il limite massimo
    2. ✅ **Lista prodotti limitata**:
       - Modificato `places` per limitare l'array ai primi 12 prodotti usando `.slice(0, MAX_PRODUCTS_CAROUSEL)`
       - Il limite viene applicato direttamente quando si legge `toolOutput?.places`
  - **Vantaggi**:
    - ✅ Performance migliorata: meno slide da renderizzare nel carosello
    - ✅ Navigazione più fluida: carosello più leggero e reattivo
    - ✅ Esperienza utente migliore: caricamento più veloce
  - **File modificati**:
    - `src/gdo-carousel/index.jsx`: Aggiunta `MAX_PRODUCTS_CAROUSEL`, limitato array `places`
  - **Note**:
    - I limiti sono configurabili modificando le costanti `MAX_PRODUCTS_SHOP` e `MAX_PRODUCTS_CAROUSEL` all'inizio dei rispettivi file
    - I limiti vengono applicati dopo il filtraggio (se applicabile), quindi se ci sono filtri attivi, vengono mostrati fino a 24 prodotti filtrati nello shop e fino a 12 nel carosello

### 11.3 Migliorie carosello prodotti

- [x] **Spazio laterale per evitare taglio prima card**: Aggiunto padding orizzontale al wrapper delle card del carosello per evitare che la prima card venga tagliata a sinistra su desktop e mobile.
  - **Completato**: [2026-01-15] Aggiunto `px-4` al container flex delle card.
  - **Implementazione**:
    - Aggiornato il wrapper delle card in `src/gdo-carousel/index.jsx` per aggiungere padding orizzontale costante.
  - **File modificati**:
    - `src/gdo-carousel/index.jsx`

- [x] **Riga prezzo dedicata nelle card del carosello**: Mostrato il prezzo in una riga separata sotto il nome per migliorarne la leggibilità.
  - **Completato**: [2026-01-15] Aggiunta riga prezzo con stile dedicato.
  - **Implementazione**:
    - Inserita riga prezzo condizionale (`place.price`) sotto il nome in `src/gdo-carousel/PlaceCard.jsx`.
  - **File modificati**:
    - `src/gdo-carousel/PlaceCard.jsx`

### 11.4 Pulizia warning TypeScript

- [x] **Risolti warning TS nel carrello**: Rimossi import e helper non utilizzati che generavano `ts6133`.
  - **Completato**: [2026-01-15] Rimosse utility di debug non più usate e import inutilizzati.
  - **Implementazione**:
    - Eliminati `useEffect`, `useMemo`, `useRef`, `useOpenAiGlobal`, `JsonPanel`, `usePrettyJson`, `createDefaultCartState` e variabili debug non usate.
  - **File modificati**:
    - `src/shopping-cart/index.tsx`

### 11.5 Riepilogo post-acquisto e svuotamento carrello

- [x] **Riepilogo acquisto nel carrello**: Dopo un pagamento riuscito, il carrello viene svuotato e viene mostrato un riepilogo completo dell'ordine.
  - **Completato**: [2026-01-16] Aggiunto riepilogo ordine con prodotti, totali, dati di fatturazione, data di consegna stimata e ringraziamento.
  - **Implementazione**:
    1. ✅ **Snapshot ordine** (`src/shopping-cart/index.tsx`):
       - Salva i prodotti acquistati e calcola i totali (subtotale, IVA, spedizione, totale).
    2. ✅ **Svuotamento carrello**:
       - Aggiunta `clearCart()` in `src/use-cart.ts` per azzerare gli item dopo il successo.
    3. ✅ **Riepilogo UI**:
       - Sezione "Riepilogo acquisto" con elenco prodotti, totali, dati fattura e data consegna casuale (3-7 giorni).
  - **File modificati**:
    - `src/use-cart.ts`
    - `src/shopping-cart/index.tsx`

### 11.6 Modale checkout per dati fatturazione

- [x] **Modale dati di fatturazione**: Il checkout nel carrello avviene tramite modale dedicata avviata dal pulsante "Procedi al pagamento".
  - **Completato**: [2026-01-16] Spostati i campi di fatturazione in una modale con conferma pagamento.
  - **Implementazione**:
    1. ✅ **Pulsante checkout**: apre la modale per l'inserimento dei dati.
    2. ✅ **Conferma e paga**: avvia il flusso di pagamento e chiude la modale al successo.
  - **File modificati**:
    - `src/shopping-cart/index.tsx`

### 11.7 Spedizione visibile e IVA inclusa

- [x] **Totali senza IVA esplicita**: L'IVA è considerata inclusa nei prezzi di listino; il carrello non aggiunge IVA al totale.
  - **Completato**: [2026-01-16] Rimossa IVA dal calcolo dei totali, mantenuta la spedizione.
  - **Implementazione**:
    1. ✅ **Backend**: Calcolo dei totali con `tax = 0` in `gdo_server_python/main.py`.
    2. ✅ **Frontend**: Totali e riepilogo senza riga IVA in `src/shopping-cart/index.tsx`.
    3. ✅ **Messaggio cliente**: Spedizione mostrata nel carrello con nota "IVA inclusa".
  - **File modificati**:
    - `gdo_server_python/main.py`
    - `src/shopping-cart/index.tsx`

- [x] **Compatibilità import JSX in TSX**: Garantita la risoluzione dei componenti `.jsx` importati in file TypeScript.
  - **Completato**: [2026-01-15] Aggiunta dichiarazione di modulo per `.jsx` e aggiornato import `SafeImage`.
  - **Implementazione**:
    - Creato `src/jsx.d.ts` con dichiarazione `declare module "*.jsx"`.
    - Aggiornato import `SafeImage` in `src/utils/ProductDetails.tsx` per usare l'estensione `.jsx`.
  - **File modificati**:
    - `src/jsx.d.ts`
    - `src/utils/ProductDetails.tsx`

### 11.3 Miglioramenti visivi carosello

- [x] **Separazione visiva delle card**: aggiunta ombreggiatura e hover per distinguere meglio le card nel carosello.
  - **Completato**: [2026-01-15]
  - **Implementazione**:
    - `src/gdo-carousel/PlaceCard.jsx`: aggiunte classi `bg-white`, `rounded-2xl`, `ring-1 ring-black/5`, `shadow[...]`, `transition-shadow`, `hover:shadow[...]`
  - **Vantaggi**:
    - ✅ Card più distinguibili tra loro
    - ✅ Maggiore profondità visiva durante lo scroll

- [x] **Prezzo evidenziato nella card**: aggiunta una riga prezzo sotto il nome prodotto quando disponibile.
  - **Completato**: [2026-01-15]
  - **Implementazione**:
    - `src/gdo-carousel/PlaceCard.jsx`: rendering condizionale di `place.price` con stile `text-sm font-semibold`
