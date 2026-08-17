// One-off Playwright script that rasterizes the app's checklist glyph into
// the PWA manifest icon set (public/icons/). Not part of the test suite —
// re-run manually any time the glyph or brand colors change. Mirrors
// capture-help-screenshots.mjs's approach (render real markup in a real
// browser, screenshot it) rather than hand-editing PNGs.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/icons');
mkdirSync(OUT_DIR, { recursive: true });

const BG = '#161826';
const ACCENT = '#9184d9';

// A checklist glyph — three rows, each a checkbox + a text bar — standing
// in for "list with checkbox items" per the brand refresh. `scale` shrinks
// it within its viewport for the maskable variant, whose OS-applied crop
// only guarantees the inner ~80% "safe zone" is visible (same padding
// concern documented in CHANGELOG's Phase 6 icon section).
function glyphSvg(scale = 1) {
  const inset = (256 - 256 * scale) / 2;
  return `
    <svg width="100%" height="100%" viewBox="0 0 256 256">
      <g transform="translate(${inset} ${inset}) scale(${scale})">
        <rect x="20" y="20" width="52" height="52" rx="12" fill="none" stroke="${ACCENT}" stroke-width="16"/>
        <path d="M30 48 L44 62 L64 30" stroke="${ACCENT}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <rect x="96" y="36" width="140" height="20" rx="10" fill="${ACCENT}"/>

        <rect x="20" y="102" width="52" height="52" rx="12" fill="none" stroke="${ACCENT}" stroke-width="16"/>
        <path d="M30 130 L44 144 L64 112" stroke="${ACCENT}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <rect x="96" y="118" width="140" height="20" rx="10" fill="${ACCENT}"/>

        <rect x="20" y="184" width="52" height="52" rx="12" fill="none" stroke="${ACCENT}" stroke-width="16" opacity="0.45"/>
        <rect x="96" y="200" width="140" height="20" rx="10" fill="${ACCENT}" opacity="0.45"/>
      </g>
    </svg>`;
}

function pageHtml(svg) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:${BG}}
    body{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}
  </style></head><body>${svg}</body></html>`;
}

async function shot(page, size, svg, filename) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(pageHtml(svg));
  const buffer = await page.screenshot();
  writeFileSync(`${OUT_DIR}/${filename}`, buffer);
  console.log(`wrote ${filename} (${size}x${size})`);
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const page = await browser.newPage();

  await shot(page, 192, glyphSvg(1), 'icon-192.png');
  await shot(page, 512, glyphSvg(1), 'icon-512.png');
  await shot(page, 512, glyphSvg(0.8), 'icon-512-maskable.png');

  await browser.close();
}

main();
