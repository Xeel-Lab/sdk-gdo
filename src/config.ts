/**
 * Global configuration for the GDO SDK.
 * 
 * This file contains configuration that can be used across the application,
 * including server URLs, API endpoints, and other global settings.
 */

/**
 * Gets the server base URL for API calls and proxy endpoints.
 * 
 * Priority order:
 * 1. window.__GDO_SERVER_URL__ (injected at runtime, e.g., from HTML meta tag)
 * 2. BASE_URL from environment (for build-time configuration)
 * 3. Deduced from script sources or window.location
 * 4. Empty string (relative URLs)
 */
export function getServerBaseUrl(): string {
  // Check for runtime injection (can be set via meta tag or script tag in HTML)
  if (typeof window !== "undefined" && (window as any).__GDO_SERVER_URL__) {
    const injected = (window as any).__GDO_SERVER_URL__;
    return injected;
  }

  // Check for script source that looks like our server (gdo-carousel, etc.)
  if (typeof document !== "undefined") {
    const scripts = document.getElementsByTagName("script");
    for (let script of scripts) {
      if (script.src) {
        try {
          const url = new URL(script.src);
          // Check if it's from our server (contains /assets/ or gdo in path)
          if (url.pathname.includes("/assets/") || url.pathname.includes("gdo")) {
            return url.origin;
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
  }

  // Try window.location (works in same-origin contexts)
  if (typeof window !== "undefined" && window.location) {
    const origin = window.location.origin;
    if (origin && !origin.startsWith("data:") && !origin.startsWith("blob:")) {
      return origin;
    }
  }

  // Fallback: empty string (relative URLs)
  return "";
}

/**
 * Global configuration object.
 * Can be extended with other configuration values as needed.
 */
export const config = {
  /**
   * Server base URL for API calls and proxy endpoints.
   * Automatically deduced or can be set explicitly.
   */
  get serverBaseUrl() {
    return getServerBaseUrl();
  },

  /**
   * Proxy endpoint path for images.
   */
  proxyImagePath: "/proxy-image",

  /**
   * Builds a proxy URL for an image.
   */
  getProxyImageUrl(imageUrl: string): string {
    const base = this.serverBaseUrl;
    const encodedUrl = encodeURIComponent(imageUrl);
    const proxyUrl = `${base}${this.proxyImagePath}?url=${encodedUrl}`;
    return proxyUrl;
  },
};
