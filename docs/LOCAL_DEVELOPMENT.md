# Guida allo Sviluppo Locale

Questa guida spiega come configurare e avviare il progetto GDO in locale per sviluppo e debugging, senza dover dipendere da Render.

## Prerequisiti

- **Node.js 18+** e **pnpm** (o npm/yarn)
- **Python 3.10+**
- **ngrok** installato e configurato (per esporre il server a ChatGPT)
- **VS Code** (opzionale, per debugging)

## Setup Iniziale

### 1. Installazione Dipendenze

```bash
# Installa dipendenze Node.js
pnpm install

# Crea virtual environment Python (consigliato)
python -m venv .venv

# Attiva virtual environment
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Installa dipendenze Python
pip install -r gdo_server_python/requirements.txt
```

### 2. Configurazione Variabili d'Ambiente

Copia il file `.env.template` come `.env` nella root del progetto:

**Windows (PowerShell):**
```powershell
Copy-Item .env.template .env
```

**Linux/Mac:**
```bash
cp .env.template .env
```

Poi modifica il file `.env` con i tuoi valori reali (soprattutto `MOTHERDUCK_TOKEN`).

**Nota:** Le variabili `BASE_URL`, `MCP_ALLOWED_HOSTS` e `MCP_ALLOWED_ORIGINS` vengono aggiornate automaticamente dal server Python quando ngrok viene avviato. Non è necessario configurarle manualmente.

### 3. Configurazione Ngrok

Aggiungi il tuo authtoken ngrok al file `.env`:

```env
NGROK_AUTH_TOKEN=your_ngrok_auth_token_here
```

Puoi ottenere il tuo authtoken da: https://dashboard.ngrok.com/get-started/your-authtoken

**Nota:** Il server Python avvierà automaticamente ngrok quando viene avviato, quindi non è necessario configurare ngrok separatamente.

## Avvio del Server

Esegui i seguenti script separatamente nell'ordine indicato:

**1. Build assets:**
```powershell
.\scripts\build.ps1
# Oppure per forzare la rebuild:
.\scripts\build.ps1 -Force
```

**2. Avvia il server Python (ngrok viene avviato automaticamente):**
```powershell
.\scripts\start.ps1
```

Il server Python avvia automaticamente ngrok se:
- `pyngrok` è installato (viene installato automaticamente con `pip install -r gdo_server_python/requirements.txt`)
- `NGROK_AUTH_TOKEN` è configurato nel file `.env` o come variabile d'ambiente
- Il server non è in esecuzione su Render (ngrok viene saltato automaticamente su Render)


### VS Code Debugging

1. Apri il progetto in VS Code
2. Vai al pannello "Run and Debug" (F5)
3. Seleziona "Python: GDO Server (uvicorn)" o "Python: GDO Server (main.py)"
4. Premi F5 per avviare con breakpoint

**Configurazione breakpoint:**
- Apri qualsiasi file Python in `gdo_server_python/`
- Clicca a sinistra del numero di riga per aggiungere un breakpoint
- Il debugger si fermerà quando il codice raggiunge il breakpoint

### Metodo 4: Terminale Manuale

#### Avvia il server Python:

```bash
# Con virtual environment attivato
python -m uvicorn gdo_server_python.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Ngrok viene avviato automaticamente

Ngrok viene avviato automaticamente dal server Python quando viene eseguito. Non è necessario avviarlo manualmente in un terminale separato.

## Aggiungi Connector a ChatGPT

Per ottenere l'URL pubblico del server, hai diverse opzioni:

**Opzione 1: Guarda i log del server**
Dopo aver avviato il server Python, cerca nell'output il messaggio "PUBLIC URL (accessible from outside):" seguito dall'URL ngrok. L'URL viene mostrato in modo ben visibile nei log.

**Opzione 2: Usa l'endpoint `/url`**
Apri nel browser o fai una richiesta HTTP a:
```
http://localhost:8000/url
```
oppure
```
http://localhost:8000/public-url
```
Questo restituirà un JSON con l'URL pubblico, l'endpoint MCP e altre informazioni.

**Opzione 3: Usa l'endpoint `/config`**
Apri nel browser o fai una richiesta HTTP a:
```
http://localhost:8000/config
```
Questo restituirà informazioni complete sulla configurazione, incluso l'URL pubblico nel campo `public_url` e l'endpoint MCP nel campo `mcp_endpoint`.

**Aggiungi il connector a ChatGPT:**
1. Copia l'URL ngrok mostrato (es: `https://xxxx-xxxx-xxxx.ngrok-free.app`)
2. Vai su ChatGPT → Settings → Connectors
3. Aggiungi nuovo connector
4. URL: `https://xxxx-xxxx-xxxx.ngrok-free.app/mcp` (aggiungi `/mcp` alla fine)
5. Salva

**Nota:** Il server Python aggiorna automaticamente il file `.env` con le variabili necessarie quando ngrok viene avviato. L'URL ngrok viene mostrato nei log del server in modo ben visibile.

## Debugging

### Debugging Backend (Python)

**Con VS Code:**
1. Apri `.vscode/launch.json` (già configurato)
2. Seleziona "Python: GDO Server (uvicorn)"
3. Imposta breakpoint nel codice Python
4. Premi F5 per avviare

**Con PyCharm:**
1. Crea una nuova configurazione "Python"
2. Script: `gdo_server_python/main.py`
3. Oppure usa "Python Debug Server" con uvicorn

**Breakpoint comuni:**
- `gdo_server_python/main.py:2868` - Handler chiamata tool
- `gdo_server_python/main.py:2822` - Handler lettura risorsa
- `gdo_server_python/main.py:669` - Query MotherDuck

### Debugging Frontend (React/TypeScript)

**Opzione 1: Browser DevTools**
1. Apri ChatGPT e carica un widget
2. Apri DevTools (F12)
3. Vai alla tab "Sources"
4. Trova i file in `webpack://` o `vite://`
5. Imposta breakpoint direttamente nel browser

**Opzione 2: VS Code (con estensione)**
1. Installa estensione "Debugger for Chrome" o "JavaScript Debugger"
2. Crea configurazione in `.vscode/launch.json`:

```json
{
  "type": "chrome",
  "request": "attach",
  "name": "Attach to Chrome",
  "port": 9222,
  "webRoot": "${workspaceFolder}"
}
```

3. Avvia Chrome con `--remote-debugging-port=9222`
4. Collega il debugger

## Troubleshooting

### Il server non si avvia

**Errore: "MOTHERDUCK_TOKEN not found"**
- Verifica che il file `.env` esista nella root del progetto
- Verifica che `MOTHERDUCK_TOKEN` sia configurato correttamente

**Errore: "Assets directory not found"**
- Esegui `pnpm run build` per generare gli asset

**Errore: "Port 8000 already in use"**
- Cambia la porta in `.env`: `PORT=8001`
- Oppure termina il processo che usa la porta 8000

### I widget non si caricano in ChatGPT

**Problema: CORS errors**
- Verifica che `MCP_ALLOWED_ORIGINS` includa `https://chat.openai.com`
- Verifica che `MCP_ALLOWED_HOSTS` sia configurato correttamente (senza `https://`)

**Problema: Asset non trovati (404)**
- Verifica che `BASE_URL` sia impostato correttamente con l'URL ngrok
- Verifica che gli asset siano stati costruiti (`pnpm run build`)
- Controlla i log del server per vedere se gli asset vengono serviti correttamente

**Problema: DNS rebinding protection**
- Assicurati che `MCP_ALLOWED_HOSTS` sia configurato con l'hostname ngrok (senza `https://`)

### Ngrok non funziona

**Errore: "authtoken required"**
- Verifica che `NGROK_AUTH_TOKEN` sia configurato nel file `.env`
- Ottieni il tuo authtoken da: https://dashboard.ngrok.com/get-started/your-authtoken

**Errore: "tunnel session failed"**
- Verifica che il server Python sia in esecuzione sulla porta 8000
- Verifica la connessione internet

## Workflow di Sviluppo

### Sviluppo Backend

1. Modifica codice Python in `gdo_server_python/`
2. Il server si ricarica automaticamente (grazie a `--reload`)
3. Testa le modifiche chiamando i tool da ChatGPT

### Sviluppo Frontend

1. Modifica codice React/TypeScript in `src/`
2. Esegui `pnpm run build` per ricostruire gli asset
3. **Importante:** Riavvia il server Python per caricare i nuovi asset (il server usa `@lru_cache`)

**Nota:** Per sviluppo frontend più rapido, puoi usare `pnpm run dev` sulla porta 4444, ma questo è solo per test locali nel browser, non per ChatGPT.

## Task VS Code

Il progetto include task predefiniti in `.vscode/tasks.json`:

- **Build assets**: Costruisce gli asset frontend
- **Start Python server**: Avvia il server Python
- **Start ngrok tunnel**: Avvia ngrok
- **Start full dev environment**: Avvia tutto insieme

Per usare i task:
1. Premi `Ctrl+Shift+P` (o `Cmd+Shift+P` su Mac)
2. Digita "Tasks: Run Task"
3. Seleziona il task desiderato

## Note Importanti

1. **Gli asset vengono costruiti automaticamente** - Lo script `build.ps1` verifica se la cartella `assets/` esiste e contiene file. Se non esiste o è vuota, esegue automaticamente la build. Usa `-Force` per forzare la rebuild.

2. **Riavvia il server dopo ogni build** - Il server Python usa `@lru_cache` per gli HTML, quindi deve essere riavviato per caricare le modifiche. Dopo ogni build, riavvia lo script `start.ps1`.

3. **BASE_URL viene aggiornato automaticamente** - Quando il server Python avvia ngrok, il file `.env` viene aggiornato automaticamente con l'URL ngrok corretto.

4. **MCP_ALLOWED_HOSTS e MCP_ALLOWED_ORIGINS vengono aggiornati automaticamente** - Queste variabili vengono configurate automaticamente dal server quando ngrok viene avviato.

5. **Il server serve già gli asset statici** - Non serve un server separato per gli asset quando usi ngrok, il server Python li serve da `/assets/`

## Supporto

Per problemi o domande:
- Controlla i log del server Python nella console
- Controlla il dashboard ngrok su `http://127.0.0.1:4040`
- Verifica le variabili d'ambiente nel file `.env`
