"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";

/** Dark is the product's identity; light is opt-in. */
export const DEFAULT_THEME = "dark";
export const THEME_STORAGE_KEY = "cw.theme";

/**
 * Theme is per-device on purpose and never leaves this browser — see the Known
 * gaps note in CLAUDE.md.
 *
 * `next-themes` is here for the parts that are fiddly to hand-roll: it injects
 * the pre-paint script that sets the attribute before first paint (no white
 * flash for a dark-mode user), follows `prefers-color-scheme` changing while the
 * app is open, syncs across tabs via the storage event, and keeps the server and
 * client renders in agreement.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme={DEFAULT_THEME}
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      // Sets `color-scheme` on the root, so native controls, scrollbars and
      // autofill follow the theme rather than staying dark on a light page.
      enableColorScheme
      // The whole page cross-fading is jarring and costly; instant is correct.
      disableTransitionOnChange
    >
      <BrowserChromeColor />
      {children}
    </NextThemeProvider>
  );
}

/** Mobile browser chrome (status bar / address bar) follows the resolved theme. */
function BrowserChromeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    // Read the palette rather than repeating it, so the two cannot drift.
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (!bg) return;

    // This tag is created and owned here. React renders no `theme-color` of its
    // own (the static `viewport` export deliberately omits it), because deleting
    // a node React owns makes its next commit fail on a null parent — which
    // breaks client navigation, not just the colour.
    let meta = document.head.querySelector<HTMLMetaElement>('meta[data-owner="theme"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.dataset.owner = "theme";
      document.head.appendChild(meta);
    }
    meta.content = bg;
  }, [resolvedTheme]);

  return null;
}
