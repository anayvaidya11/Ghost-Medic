#!/usr/bin/env node
/**
 * Ghost Medic — bridge test consumer.
 *
 * Connects to the bridge's /stream endpoint and prints every line it receives,
 * with a running count. Stands in for the React Native app during hardware-free
 * testing. Prints a final RECEIVED total on exit (Ctrl-C) so you can compare it
 * against how many lines in the source actually had t_ms.
 */

'use strict';

const WebSocket = require('ws');

const port = process.argv[2] || 8080;
const url = `ws://localhost:${port}/stream`;

let received = 0;
const ws = new WebSocket(url);

ws.on('open', () => console.log(`[test-client] connected to ${url}`));

ws.on('message', (data) => {
  received++;
  console.log(`[test-client] #${received}: ${data.toString()}`);
});

ws.on('close', () => {
  console.log(`[test-client] connection closed. RECEIVED total: ${received}`);
  process.exit(0);
});

ws.on('error', (err) => {
  console.error(`[test-client] error: ${err.message}`);
  process.exit(1);
});

function bye() {
  console.log(`\n[test-client] RECEIVED total: ${received}`);
  ws.close();
  setTimeout(() => process.exit(0), 100);
}
process.on('SIGINT', bye);
process.on('SIGTERM', bye);
