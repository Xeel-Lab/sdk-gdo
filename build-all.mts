import { build, type InlineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fg from "fast-glob";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import pkg from "./package.json" with { type: "json" };
import tailwindcss from "@tailwindcss/vite";

const outDir = "assets";

const PER_ENTRY_CSS_GLOB = "**/*.{css,pcss,scss,sass}";
const PER_ENTRY_CSS_IGNORE = "**/*.module.*".split(",").map((s) => s.trim());
const GLOBAL_CSS_LIST = [path.resolve("src/index.css")];

const targets: string[] = [
  "gdo",
  "gdo-carousel",
  "gdo-list",
  "gdo-albums",
  "gdo-shop",
  "mixed-auth-search",
  "shopping-cart",
];

function wrapEntryPlugin(
  virtualId: string,
  entryFile: string,
  cssPaths: string[]
): Plugin {
  return {
    name: `virtual-entry-wrapper:${entryFile}`,
    resolveId(id) {
      if (id === virtualId) return id;
    },
    load(id) {
      if (id !== virtualId) {
        return null;
      }

      const cssImports = cssPaths
        .map((css) => `import ${JSON.stringify(css)};`)
        .join("\n");

      // Import the entry file and re-export everything properly
      // This avoids circular dependency issues
      return `
    ${cssImports}
    import * as __entry_module from ${JSON.stringify(entryFile)};
    
    // Re-export all named exports
    export * from ${JSON.stringify(entryFile)};
    
    // Export default, with fallback to App if default is not available
    const __default_export = __entry_module.default ?? __entry_module.App ?? __entry_module;
    export default __default_export;
  `;
    },
  };
}

// Plugin per generare sourcemap per le trasformazioni CSS di Tailwind
function generateCssSourcemaps(): Plugin {
  return {
    name: "generate-css-sourcemaps",
    enforce: "post",
    transform(code, id, options) {
      // Intercetta le trasformazioni CSS e genera sourcemap
      // Questo include le trasformazioni di Tailwind CSS
      if (
        id.endsWith(".css") ||
        id.includes("tailwind") ||
        id.includes("@tailwindcss") ||
        id.includes("virtual:") ||
        (options?.ssr === false && typeof code === "string" && code.includes("@tailwind"))
      ) {
        // Genera un sourcemap semplice per il CSS trasformato
        // Questo risolve i warning sui sourcemap mancanti
        const map = {
          version: 3,
          sources: [id],
          mappings: "AAAA",
          names: [],
        };

        return {
          code,
          map: map as any,
        };
      }
      return null;
    },
    // Also handle CSS chunks during bundle generation
    generateBundle(_options, _bundle) {
      // CSS sourcemaps are handled automatically by Vite's build configuration
      // No need to manually set sourcemap on assets
      // This hook is kept for potential future use but currently does nothing
    },
  };
}

async function main() {
  try {
    console.log("Starting build process...");
    console.log("Working directory:", process.cwd());
    console.log("Node version:", process.version);

    // Verifica che la directory src esista
    if (!fs.existsSync("src")) {
      throw new Error("Directory 'src' not found. Current directory: " + process.cwd());
    }

    const entries = fg.sync("src/**/index.{tsx,jsx}");
    console.log(`Found ${entries.length} entry files`);

    if (entries.length === 0) {
      throw new Error("No entry files found in src/**/index.{tsx,jsx}");
    }

    const builtNames: string[] = [];

    // Rimuovi la directory di output se esiste
    if (fs.existsSync(outDir)) {
      console.log(`Removing existing ${outDir} directory...`);
      fs.rmSync(outDir, { recursive: true, force: true });
    }

    for (const file of entries) {
      const name = path.basename(path.dirname(file));
      if (targets.length && !targets.includes(name)) {
        console.log(`Skipping ${name} (not in targets list)`);
        continue;
      }

      console.log(`Processing entry: ${file}`);
      const entryAbs = path.resolve(file);
      const entryDir = path.dirname(entryAbs);

      if (!fs.existsSync(entryAbs)) {
        throw new Error(`Entry file not found: ${entryAbs}`);
      }

      // Collect CSS for this entry using the glob(s) rooted at its directory
      const perEntryCss = fg.sync(PER_ENTRY_CSS_GLOB, {
        cwd: entryDir,
        absolute: true,
        dot: false,
        ignore: PER_ENTRY_CSS_IGNORE,
      });

      // Global CSS (Tailwind, etc.), only include those that exist
      const globalCss = GLOBAL_CSS_LIST.filter((p) => fs.existsSync(p));

      // Final CSS list (global first for predictable cascade)
      const cssToInclude = [...globalCss, ...perEntryCss].filter((p) =>
        fs.existsSync(p)
      );

      const virtualId = `\0virtual-entry:${entryAbs}`;

      const createConfig = (): InlineConfig => ({
        plugins: [
          wrapEntryPlugin(virtualId, entryAbs, cssToInclude),
          tailwindcss(),
          react(),
          generateCssSourcemaps(),
          {
            name: "remove-manual-chunks",
            outputOptions(options) {
              if ("manualChunks" in options) {
                delete (options as any).manualChunks;
              }
              return options;
            },
          },
        ],
        esbuild: {
          jsx: "automatic",
          jsxImportSource: "react",
          target: "es2022",
          sourcemap: true,
        },
        css: {
          devSourcemap: true,
          postcss: {
            // Ensure PostCSS generates sourcemaps
            map: true,
          },
        },
        build: {
          target: "es2022",
          outDir,
          emptyOutDir: false,
          chunkSizeWarningLimit: 2000,
          minify: "esbuild",
          cssCodeSplit: false,
          sourcemap: true,
          rollupOptions: {
            input: virtualId,
            output: {
              format: "es",
              entryFileNames: `${name}.js`,
              inlineDynamicImports: true,
              assetFileNames: (info) =>
                (info.name || "").endsWith(".css")
                  ? `${name}.css`
                  : `[name]-[hash][extname]`,
            },
            preserveEntrySignatures: "allow-extension",
            treeshake: true,
            onwarn(warning, warn) {
              // Sopprimi i warning specifici sui sourcemap di Tailwind CSS
              if (
                warning.message &&
                warning.message.includes("@tailwindcss/vite:generate:build") &&
                warning.message.includes("Sourcemap is likely to be incorrect")
              ) {
                return; // Sopprimi il warning
              }
              // Mostra tutti gli altri warning normalmente
              warn(warning);
            },
          },
        },
      });

      console.group(`Building ${name} (react)`);
      try {
        await build(createConfig());
        console.groupEnd();
        builtNames.push(name);
        console.log(`✓ Built ${name}`);
      } catch (buildError) {
        console.groupEnd();
        console.error(`✗ Failed to build ${name}:`, buildError);
        throw buildError;
      }
    }

    if (builtNames.length === 0) {
      throw new Error("No targets were built successfully");
    }

    // Verifica che la directory assets esista e contenga file
    if (!fs.existsSync("assets")) {
      throw new Error("Assets directory was not created");
    }

    const outputs = fs
      .readdirSync("assets")
      .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
      .map((f) => path.join("assets", f))
      .filter((p) => fs.existsSync(p));

    if (outputs.length === 0) {
      throw new Error("No output files were generated in assets directory");
    }

    console.log(`Generated ${outputs.length} output files`);

    const h = crypto
      .createHash("sha256")
      .update(pkg.version, "utf8")
      .digest("hex")
      .slice(0, 4);

    console.group("Hashing outputs");
    for (const out of outputs) {
      const dir = path.dirname(out);
      const ext = path.extname(out);
      const base = path.basename(out, ext);
      const newName = path.join(dir, `${base}-${h}${ext}`);

      fs.renameSync(out, newName);
      console.log(`${out} -> ${newName}`);
    }
    console.groupEnd();

    console.log("new hash: ", h);

    // Always use localhost for build - the server will rewrite URLs with BASE_URL at runtime
    // This ensures URLs are always rewritten correctly even if BASE_URL changes
    const normalizedBaseUrl = "http://localhost:4444";
    console.log(`Using ${normalizedBaseUrl} for generated HTML (server will rewrite with BASE_URL at runtime)`);

    for (const name of builtNames) {
      const dir = outDir;
      const hashedHtmlPath = path.join(dir, `${name}-${h}.html`);
      const liveHtmlPath = path.join(dir, `${name}.html`);
      // Always use /assets/ prefix in paths - the server will handle BASE_URL if needed
      const html = `<!doctype html>
<html>
<head>
  <script type="module" src="${normalizedBaseUrl}/assets/${name}-${h}.js"></script>
  <link rel="stylesheet" href="${normalizedBaseUrl}/assets/${name}-${h}.css">
</head>
<body>
  <div id="${name}-root"></div>
</body>
</html>
`;
      fs.writeFileSync(hashedHtmlPath, html, { encoding: "utf8" });
      fs.writeFileSync(liveHtmlPath, html, { encoding: "utf8" });
      console.log(`Generated HTML: ${liveHtmlPath}`);
    }

    console.log("✓ Build completed successfully!");
  } catch (error) {
    console.error("✗ Build failed with error:");
    console.error(error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }
}

main();
