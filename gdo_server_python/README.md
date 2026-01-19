# Electronics MCP server (Python)

This directory packages a Python implementation of the Electronics MCP server using the `FastMCP` helper from the official Model Context Protocol SDK. It exposes electronics product widgets as both resources and tools, with integration to MotherDuck for product data.

## Version

- **Server Version**: 1.1.0
- **MCP Protocol Version**: 2024-11-05 (Current)

## Backward Compatibility Policy

This server follows MCP best practices for backward compatibility:

1. **Tool Stability**: Existing tools will not be removed. New tools may be added in future versions.
2. **Schema Compatibility**: Input/output schemas for existing tools will not be changed in breaking ways. New optional fields may be added.
3. **Resource Stability**: Existing resources and resource templates will remain available.
4. **MCP Protocol**: The server supports MCP 2024-11-05. Future protocol versions will be adopted when stable.

### Versioning Strategy

- **MAJOR** (X.0.0): Breaking changes that require client updates
- **MINOR** (0.X.0): New features, new tools, or new resources (backward compatible)
- **PATCH** (0.0.X): Bug fixes and minor improvements (backward compatible)

See [CHANGELOG.md](../../CHANGELOG.md) for detailed version history.

## Prerequisites

- Python 3.10+
- A virtual environment (recommended)

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> **Heads up:** There is a similarly named package named `modelcontextprotocol`
> on PyPI that is unrelated to the official MCP SDK. The requirements file
> installs the official `mcp` distribution with its FastAPI extra so that the
> `mcp.server.fastmcp` module is available. If you previously installed the
> other project, run `pip uninstall modelcontextprotocol` before reinstalling
> the requirements.

## Run the server

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn electronics_server_python.main:app --port 8000
```

This boots a FastAPI app with uvicorn on `http://127.0.0.1:8000`. The endpoints are:

- `GET /mcp` exposes the SSE stream.
- `POST /mcp/messages?sessionId=...` accepts follow-up messages for an active session.

Cross-origin requests are allowed so you can drive the server from local tooling or the MCP Inspector. Each tool returns structured content with product data and metadata that points to the correct widget shell.

## Environment Variables

- **MOTHERDUCK_TOKEN** (required): MotherDuck authentication token for accessing the `app_gpt_elettronica` database
- **MCP_ALLOWED_HOSTS** (optional): Comma-separated list of allowed hosts for Transport Security (e.g., `sdk-electronics.onrender.com`)
- **MCP_ALLOWED_ORIGINS** (optional): Comma-separated list of allowed origins for CORS (e.g., `https://chat.openai.com,https://sdk-electronics.onrender.com`)

## Security and Privacy

### Least Privilege

The server follows the principle of least privilege:

- **Database Access**: The server only accesses the `app_gpt_elettronica` database in MotherDuck, specifically the `prodotti_xeel_shop` table in the `main` schema. It performs read-only operations (SELECT queries only).
- **No File System Access**: The server does not access the local file system except for reading widget HTML files from the `assets/` directory (read-only).
- **No Network Access**: The server does not make external network requests except for the MotherDuck database connection (which is necessary for product data).
- **No User Data Storage**: The server does not store or persist any user data. All state is managed client-side by ChatGPT.

### User Consent

All tools are marked as read-only (`readOnlyHint: True`) and non-destructive (`destructiveHint: False`), meaning they do not modify data or require explicit user consent beyond the standard ChatGPT tool approval flow. The tools are designed to be safe and transparent in their operations.

### Input Validation

All tool inputs are validated server-side:
- Tools that don't require input use `EMPTY_TOOL_INPUT_SCHEMA` and reject unexpected arguments
- Invalid tool names are rejected with clear error messages
- All errors are logged for audit purposes

### Activity Logging

The server logs all tool executions for audit and debugging:
- Tool name and execution timestamp
- Success/failure status
- Execution duration
- Error details (when applicable)

Logs do not contain sensitive information (no tokens, user data, or PII).

## Available Tools

The server exposes the following tools:

- `electronics-map`: Interactive map of electronics stores
- `electronics-carousel`: Product carousel widget (max 6 products, shows only requested category)
- `electronics-albums`: Product gallery widget
- `electronics-list`: Product list widget
- `electronics-shop`: Full electronics shop interface
- `product-list`: Retrieve products from MotherDuck database
- `shopping-cart`: Shopping cart widget (displays products added via "Add to Cart" buttons)

### Shopping Cart System

All product widgets (`electronics-carousel`, `electronics-list`, `electronics-albums`, `electronics-map`, `mixed-auth-search`) include "Aggiungi al carrello" (Add to Cart) buttons. Products added via these buttons are stored in a shared cart state using the `sharedCartItems` key in `widgetState`, which is isolated from other widgets like `electronics-shop`.

The cart:
- Starts empty by default
- Only shows products explicitly added via "Add to Cart" buttons
- Persists across widget interactions
- Uses unique product IDs to prevent duplicates
- Includes debouncing to prevent accidental multiple additions

## Next steps

Use these handlers as a starting point when wiring in real data, authentication, or localization support. The structure demonstrates how to:

1. Register reusable UI resources that load static HTML bundles.
2. Associate tools with those widgets via `_meta.openai/outputTemplate`.
3. Ship structured JSON alongside human-readable confirmation text.
4. Integrate with external data sources (MotherDuck example included).
