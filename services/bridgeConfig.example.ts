/**
 * BRIDGE CONNECTION CONFIG
 *
 * Where the app finds the Ghost Medic sensor bridge (the NDJSON -> WebSocket
 * dumb pipe in ../bridge). The app connects to the bridge's /stream endpoint
 * as a consumer and receives one telemetry line per message.
 *
 * This is the wired/USB-serial stand-in for the eventual wrist->pack BLE link
 * (see bridge/README.md and ARCHITECTURE.md). It is not BLE.
 *
 * Usage: copy this file to services/bridgeConfig.ts and adjust if needed.
 * bridgeConfig.ts is gitignored (like llmConfig.ts) so machine-specific hosts
 * don't get committed; this .example.ts is the safe, committed template.
 */

// Host/port where `node bridge/bridge.js` is listening. For the simulator /
// file-replay demo this is your own machine.
export const BRIDGE_HOST = 'localhost';
export const BRIDGE_PORT = 8080;

// Consumers receive telemetry on the /stream path (producers push on /sim-input).
export const BRIDGE_STREAM_URL = `ws://${BRIDGE_HOST}:${BRIDGE_PORT}/stream`;

// If the bridge is unreachable, how long to wait before retrying (ms).
export const BRIDGE_RECONNECT_MS = 2000;
