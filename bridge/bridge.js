#!/usr/bin/env node
/**
 * Ghost Medic — Sensor Bridge
 *
 * A DUMB PIPE. It reads NDJSON telemetry lines from a source (producer) and
 * forwards each line UNCHANGED to every connected app/consumer over a WebSocket.
 *
 * ┌───────────────────────────── producers ─────────────────────────────┐
 * │  --source=sim     browser simulator pushes lines to  ws .../sim-input │
 * │  --source=file    replay a captured .ndjson file at ~10 Hz            │
 * │  --source=serial  (NOT IMPLEMENTED — stub seam for a real Pico later) │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              │  forward line UNCHANGED
 *                              ▼
 *                    consumers connect to  ws .../stream
 *
 * Per DATA_FORMAT.md the ONLY transformation the bridge performs is a filter:
 * it drops any line that lacks a "t_ms" field (this silently drops the one-time
 * boot line). It does NOT parse-and-rebuild, reshape, or validate anything else.
 *
 * HONEST SCOPE: this is a wired, local WebSocket stand-in for the eventual
 * wireless wrist->pack BLE link. It is not BLE. Nothing here has run on real
 * hardware. See bridge/README.md.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// ── CLI args ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { source: null, file: null, port: 8080, hz: 10, loop: false };
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const [, key, val] = m;
    if (key === 'source') args.source = val;
    else if (key === 'file') args.file = val;
    else if (key === 'port') args.port = parseInt(val, 10);
    else if (key === 'hz') args.hz = parseFloat(val);
    else if (key === 'loop') args.loop = true;
    else if (key === 'help') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Ghost Medic sensor bridge — a dumb NDJSON -> WebSocket pipe.

Usage:
  node bridge.js --source=sim   [--port=8080]
  node bridge.js --source=file  --file=sample.ndjson [--hz=10] [--loop] [--port=8080]
  node bridge.js --source=serial   (not implemented yet)

Consumers (the app / a test client) connect to:   ws://localhost:<port>/stream
Producers (the simulator) push lines to:           ws://localhost:<port>/sim-input
`);
}

// ── The filter: the ONE rule the bridge enforces (DATA_FORMAT.md) ─────────────
// Keep a line only if it is JSON containing a "t_ms" field. Drops the boot line
// and any blank/garbage line. We parse ONLY to make this decision; we still
// forward the ORIGINAL, unmodified string — never a re-serialized version.
function hasTMs(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  try {
    const obj = JSON.parse(trimmed);
    return obj !== null && typeof obj === 'object' && 't_ms' in obj;
  } catch {
    return false;
  }
}

// ── Consumer registry + forwarding core ───────────────────────────────────────
// Every source funnels through forward(). This is the single choke point that
// makes sources interchangeable — adding --source=serial later means calling
// forward() from a serial reader, with zero changes here or downstream.
function makeHub() {
  let forwarded = 0;
  let dropped = 0;

  return {
    /** consumers: the set of /stream sockets, managed by the WS server below */
    consumers: new Set(),

    /** Forward one raw line unchanged to all consumers, after the t_ms filter. */
    forward(rawLine, consumers) {
      const line = rawLine.replace(/[\r\n]+$/, ''); // strip trailing newline only
      if (!hasTMs(line)) {
        dropped++;
        return;
      }
      forwarded++;
      for (const ws of consumers) {
        if (ws.readyState === ws.OPEN) ws.send(line);
      }
    },

    stats() {
      return { forwarded, dropped };
    },
  };
}

// ── Sources (producers) ───────────────────────────────────────────────────────

// file: replay a captured NDJSON file at a fixed rate, then stop.
// The replay does NOT start until the first consumer connects, so a canned file
// is never dumped to an empty room. (Live sources — sim/serial — stream
// continuously instead; a late consumer just joins mid-stream, like real hw.)
// Returns a begin() to be called once, on first consumer connection.
function makeFileSource(hub, filePath, hz, loop) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const withTMs = lines.filter(hasTMs).length;
  console.log(
    `[bridge] file source: ${abs}\n` +
      `[bridge] ${lines.length} non-empty line(s); ` +
      `${withTMs} have t_ms, ${lines.length - withTMs} lack t_ms (will be dropped)\n` +
      `[bridge] mode: ${loop ? 'LOOP (replay forever)' : 'once (stop at end)'}\n` +
      `[bridge] waiting for a consumer on /stream before replaying...`
  );

  const periodMs = 1000 / hz;
  return function begin(consumers) {
    console.log(
      `[bridge] consumer present — replaying ${lines.length} line(s) at ${hz} Hz` +
        (loop ? ' (looping)' : '')
    );
    let i = 0;
    const timer = setInterval(() => {
      if (i >= lines.length) {
        if (loop) {
          i = 0; // restart from the top, same interval — continuous stream
          return;
        }
        clearInterval(timer);
        const { forwarded, dropped } = hub.stats();
        console.log(
          `[bridge] file replay complete: forwarded ${forwarded}, dropped ${dropped}`
        );
        return;
      }
      hub.forward(lines[i], consumers);
      i++;
    }, periodMs);
  };
}

// sim: accept pushed lines from the browser simulator on /sim-input.
// (No extra setup — the WS server below routes /sim-input messages into forward.)
function announceSimSource(port) {
  console.log(
    `[bridge] sim source: waiting for the simulator to connect and push lines to ` +
      `ws://localhost:${port}/sim-input`
  );
}

// serial: intentionally not implemented. Stub seam so it slots in as a peer
// source later (Phase 3) by calling hub.forward() from a serialport reader.
function startSerialSource() {
  console.error(
    '[bridge] --source=serial is not implemented yet.\n' +
      '         It is reserved as a peer source for a real flashed Pico.\n' +
      '         When added: open the serial port, read lines, call the same\n' +
      '         forward() path used by file/sim. No other code needs to change.'
  );
  process.exit(2);
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.source) {
    usage();
    process.exit(args.source ? 0 : 1);
  }

  const hub = makeHub();

  // Set by file mode: a one-shot replay to kick off when the first consumer
  // connects. Null for live sources (sim/serial), which stream continuously.
  let beginOnFirstConsumer = null;

  // One HTTP server, one WS server, routed by URL path.
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Ghost Medic bridge. Connect via WebSocket: /stream (consume) or /sim-input (produce).\n');
  });

  const wss = new WebSocketServer({ server });
  wss.consumers = hub.consumers;

  wss.on('connection', (ws, req) => {
    const url = (req.url || '').split('?')[0];

    if (url === '/stream') {
      hub.consumers.add(ws);
      console.log(`[bridge] consumer connected (/stream). total=${hub.consumers.size}`);
      if (beginOnFirstConsumer) {
        const begin = beginOnFirstConsumer;
        beginOnFirstConsumer = null; // one-shot
        begin(hub.consumers);
      }
      ws.on('close', () => {
        hub.consumers.delete(ws);
        console.log(`[bridge] consumer disconnected. total=${hub.consumers.size}`);
      });
    } else if (url === '/sim-input') {
      console.log('[bridge] producer connected (/sim-input)');
      ws.on('message', (data) => {
        // Each message is expected to be one NDJSON line. Forward unchanged.
        hub.forward(data.toString(), hub.consumers);
      });
      ws.on('close', () => console.log('[bridge] producer disconnected (/sim-input)'));
    } else {
      ws.close(1008, 'unknown path — use /stream or /sim-input');
    }
  });

  server.listen(args.port, () => {
    console.log(`[bridge] listening on ws://localhost:${args.port}`);
    console.log(`[bridge]   consumers -> ws://localhost:${args.port}/stream`);
    console.log(`[bridge]   producers -> ws://localhost:${args.port}/sim-input`);

    if (args.source === 'file') {
      if (!args.file) {
        console.error('[bridge] --source=file requires --file=<path>');
        process.exit(1);
      }
      beginOnFirstConsumer = makeFileSource(hub, args.file, args.hz, args.loop);
    } else if (args.source === 'sim') {
      announceSimSource(args.port);
    } else if (args.source === 'serial') {
      startSerialSource();
    } else {
      console.error(`[bridge] unknown --source=${args.source} (use sim | file | serial)`);
      process.exit(1);
    }
  });
}

main();
