// Renders the subreddit icon and banner as PNGs, using the game's own character art.
// Usage: npm run brand   (needs Google Chrome installed)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Mood } from '../src/shared/art.ts';
import { suspectSvg } from '../src/shared/art.ts';
import type { SuspectId } from '../src/shared/puzzle/types.ts';

const root = join(import.meta.dirname, '..');
const out = join(root, 'branding');
mkdirSync(out, { recursive: true });

const font = (p: string) => pathToFileURL(join(root, 'node_modules', p)).href;

const BASE_CSS = `
@font-face { font-family: 'Luckiest Guy'; src: url('${font('@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Rubik'; font-weight: 300 900; src: url('${font('@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2')}') format('woff2'); }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; overflow: hidden; }
.halftone { background-color: #FFF6E0; background-image: radial-gradient(#F3DFAE 2.4px, transparent 2.8px); background-size: 15px 15px; }
.logo { font-family: 'Luckiest Guy'; color: #FFC93C; -webkit-text-stroke: 5px #141414; paint-order: stroke fill; text-shadow: 7px 7px 0 #141414; letter-spacing: 2px; line-height: 1; }
.bubble { font-family: 'Luckiest Guy'; background: #fff; border: 4px solid #141414; border-radius: 18px; box-shadow: 4px 4px 0 #141414; padding: 6px 14px 2px; white-space: nowrap; }
`;

const CLOUD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64" width="WIDTH"><path d="M18 48 C6 48 4 34 14 30 C12 18 26 12 34 20 C38 8 58 8 62 20 C72 14 86 22 80 34 C92 36 90 52 76 50 C70 58 56 58 50 52 C42 58 26 58 18 48 Z" fill="#B8D94A" stroke="#141414" stroke-width="4" stroke-linejoin="round"/><path d="M30 34 q6 -6 12 0 M52 32 q6 -6 12 0" fill="none" stroke="#141414" stroke-width="4" stroke-linecap="round"/></svg>`;
const cloud = (width: number) => CLOUD.replace('WIDTH', String(width));

const LINEUP: [SuspectId, Mood][] = [
  ['agnes', 'shifty'],
  ['brock', 'nervous'],
  ['pip', 'neutral'],
  ['biscuit', 'guilty'],
  ['linda', 'shifty'],
  ['marcel', 'nervous'],
];

// Reddit shows banners as a thin strip (at least 1072 x 128 on desktop and
// 1080 x 128 in the app), so both are about 8.4 times wider than tall. We
// render them at double size so they stay sharp.
const desktopBanner = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body { width: 2144px; height: 256px; }
.wrap { width: 2144px; height: 256px; display: flex; align-items: center; justify-content: center; gap: 56px; }
.left { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; transform: rotate(-2deg); }
.tag { font-family: 'Rubik'; font-weight: 800; font-size: 30px; color: #141414; }
.lift { position: relative; display: flex; align-items: flex-end; gap: 4px; padding: 16px 20px 6px; background: #CDEEE8; border: 6px solid #141414; border-radius: 24px; box-shadow: 8px 8px 0 #141414; }
.lift .bubble { position: absolute; top: -20px; left: 92px; font-size: 24px; transform: rotate(-5deg); }
.cloud { position: absolute; top: -30px; right: -40px; transform: rotate(8deg); }
</style></head><body class="halftone"><div class="wrap">
  <div class="left">
    <div class="logo" style="font-size:110px">WHO FARTED?</div>
    <div class="tag">A new elevator every day. Six suspects. One guess.</div>
  </div>
  <div class="lift">
    ${LINEUP.map(([id, mood]) => suspectSvg(id, mood, 150)).join('')}
    <div class="bubble">NOT ME!</div>
    <div class="cloud">${cloud(110)}</div>
  </div>
</div></body></html>`;

// The app shows the banner tiny on a phone, so: just the logo, big, with faces.
const mobileBanner = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body { width: 2160px; height: 256px; }
.wrap { width: 2160px; height: 256px; display: flex; align-items: center; justify-content: center; gap: 36px; }
.faces { display: flex; align-items: flex-end; gap: 6px; padding-top: 40px; }
</style></head><body class="halftone"><div class="wrap">
  <div class="faces">${suspectSvg('agnes', 'shifty', 200)}${suspectSvg('brock', 'nervous', 200)}</div>
  <div class="logo" style="font-size:150px; transform: rotate(-2deg)">WHO FARTED?</div>
  <div class="faces">${suspectSvg('biscuit', 'guilty', 200)}${suspectSvg('marcel', 'nervous', 200)}</div>
</div></body></html>`;

// 512 x 512 icon. Reddit shows icons as circles, so the art stays inside one.
const icon = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body { width: 512px; height: 512px; }
.bg { width: 512px; height: 512px; background-color: #FFC93C; background-image: radial-gradient(#F2B22B 3px, transparent 3.5px); background-size: 20px 20px; position: relative; overflow: hidden; }
.dog { position: absolute; left: 50%; bottom: -12px; transform: translateX(-50%); }
.cloud { position: absolute; top: 80px; right: 92px; transform: rotate(10deg); }
.q { position: absolute; top: 70px; left: 92px; font-family: 'Luckiest Guy'; font-size: 92px; color: #fff; -webkit-text-stroke: 5px #141414; paint-order: stroke fill; text-shadow: 5px 5px 0 #141414; transform: rotate(-12deg); }
</style></head><body><div class="bg">
  <div class="q">?</div>
  <div class="cloud">${cloud(130)}</div>
  <div class="dog">${suspectSvg('biscuit', 'guilty', 430)}</div>
</div></body></html>`;

const files: [string, string, number, number][] = [
  ['banner-desktop', desktopBanner, 2144, 256],
  ['banner-mobile', mobileBanner, 2160, 256],
  ['icon', icon, 512, 512],
];

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const [name, html, width, height] of files) {
  const htmlPath = join(out, `${name}.html`);
  writeFileSync(htmlPath, html);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--screenshot=${join(out, `${name}.png`)}`,
    '--virtual-time-budget=3000',
    pathToFileURL(htmlPath).href,
  ]);
  console.log(`branding/${name}.png (${width}x${height})`);
}
