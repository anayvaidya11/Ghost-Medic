/**
 * Headless screenshot of a served page, driven over the Chrome DevTools Protocol.
 *
 * This is a development tool, not a project dependency. It adds nothing to
 * package.json: Node's built-in WebSocket talks to whatever Chromium is already
 * on the machine. It exists so a change to the 3D concept viewer can be looked
 * at rather than guessed at, which matters because no amount of measuring a
 * bounding box tells you whether an arm looks like an arm.
 *
 * usage: node shot.mjs <url> <out.png> [waitMs] [width] [height] [clipSelector] [clickSelector]
 *
 * Point CHROME_PATH at a browser if none of the defaults below exist.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const CANDIDATES = [
  process.env.CHROME_PATH,
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/` +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chromium found. Set CHROME_PATH to a browser binary. Looked in:');
  for (const c of CANDIDATES) console.error(`  ${c}`);
  process.exit(1);
}

const [url, out, waitMs = '3500', w = '1400', h = '900', sel = '', click = ''] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node shot.mjs <url> <out.png> [waitMs] [w] [h] [selector]'); process.exit(1); }

const PORT = 9222 + Math.floor(Math.random() * 300);
const proc = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=/tmp/cdp-${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--window-size=${w},${h}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('chrome did not expose CDP');
}

await wsUrl();                       // wait until the debugging port answers

// Open a fresh tab and drive it directly.
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method) events.push(m);
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});

const consoleErrors = [];
await send('Runtime.enable');
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(w), height: Number(h), deviceScaleFactor: 2, mobile: false,
});
await send('Page.navigate', { url });

// Wait for load, then let the WebGL scene settle.
for (let i = 0; i < 100; i++) {
  if (events.some((e) => e.method === 'Page.loadEventFired')) break;
  await sleep(100);
}
await sleep(Number(waitMs));

if (click) {
  const r = await send('Runtime.evaluate', {
    expression: `(() => { const e = document.querySelector(${JSON.stringify(click)});
      if (!e) return 'NOT FOUND'; e.click(); return 'clicked'; })()`,
    returnByValue: true,
  });
  console.error(`click ${click}: ${r.result.value}`);
  await sleep(Number(waitMs));
}

let clip;
if (sel) {
  const r = await send('Runtime.evaluate', {
    expression: `(() => { const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return null; const b = e.getBoundingClientRect();
      return JSON.stringify({x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,scale:1}); })()`,
    returnByValue: true,
  });
  if (r.result.value) clip = JSON.parse(r.result.value);
  else console.error(`selector not found: ${sel}`);
}

const shot = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: !!clip, ...(clip ? { clip } : {}),
});
writeFileSync(out, Buffer.from(shot.data, 'base64'));

if (consoleErrors.length) console.error('PAGE ERRORS:\n' + consoleErrors.join('\n'));
console.log(`wrote ${out}${clip ? ` (clip ${Math.round(clip.width)}x${Math.round(clip.height)})` : ''}`);

ws.close();
proc.kill();
process.exit(0);
