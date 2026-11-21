#!/usr/bin/env node
/**
 * Finds a Chrome/Chromium that Remotion can render with, so it doesn't have to download its own
 * (that download is blocked on some networks). Order: $REMOTION_BROWSER, then a headless Chromium
 * installed by Playwright on Linux. Prints nothing if none is found: Remotion then uses its own browser.
 * Behind an HTTPS proxy it returns tools/chrome_via_proxy.sh, which runs that browser through the proxy.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const realBrowser = () => {
  const env = process.env.REMOTION_BROWSER;
  if (env && fs.existsSync(env)) return env;
  for (const base of ["/opt/pw-browsers", path.join(process.env.HOME || "", ".cache", "ms-playwright")]) {
    if (!fs.existsSync(base)) continue;
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse();
    for (const d of dirs) {
      const bin = path.join(base, d, "chrome-headless-shell-linux64", "chrome-headless-shell");
      if (fs.existsSync(bin)) return bin;
    }
  }
  return "";
};

/** The browser to hand Remotion: behind an HTTPS proxy, a wrapper that routes it through the proxy. */
export const findBrowser = () => {
  const real = realBrowser();
  if (real && (process.env.HTTPS_PROXY || process.env.https_proxy)) return path.join(path.dirname(new URL(import.meta.url).pathname), "chrome_via_proxy.sh");
  return real;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(process.argv[2] === "--real" ? realBrowser() : findBrowser());
