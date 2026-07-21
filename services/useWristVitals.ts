/**
 * useWristVitals — live vitals from the Ghost Medic sensor bridge.
 *
 * Connects to the bridge's /stream WebSocket (see ../bridge and BRIDGE_STREAM_URL),
 * parses each NDJSON telemetry line with the pure parser, and returns the latest
 * WristVitals snapshot. Drop-in intended replacement for the SIMULATED stub
 * `useBiosensorVitals` in services/biosensorService.ts — but note the shapes
 * differ on purpose: this hook returns what the firmware ACTUALLY sends
 * (environment / motion / raw optical counts), not fabricated HR/BP/SpO2.
 *
 * HONEST BEHAVIOR:
 *   - Bridge not running / unreachable  -> returns DISCONNECTED_VITALS
 *     (all readings null, source:'disconnected'). Never throws, never crashes.
 *   - Connected, awaiting first line     -> source:'connecting'.
 *   - Receiving lines                    -> source:'live', connected:true.
 *   - A dropped connection auto-reconnects every BRIDGE_RECONNECT_MS.
 *
 * No new dependency: WebSocket is a global in React Native and browsers.
 */

import { useEffect, useRef, useState } from 'react';
import { BRIDGE_STREAM_URL, BRIDGE_RECONNECT_MS } from '@services/bridgeConfig';
import {
  parseWristLine,
  DISCONNECTED_VITALS,
  type WristVitals,
} from '@services/wristVitalsParser';

export function useWristVitals(): WristVitals {
  const [vitals, setVitals] = useState<WristVitals>(DISCONNECTED_VITALS);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUnmount = useRef(false);

  useEffect(() => {
    closedByUnmount.current = false;

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(BRIDGE_STREAM_URL);
      } catch {
        scheduleRetry();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        // Connected, but no data yet — mark connecting, not live.
        setVitals((v) => ({ ...v, connected: true, source: 'connecting' }));
      };

      ws.onmessage = (evt: WebSocketMessageEvent) => {
        const parsed = parseWristLine(String(evt.data));
        if (parsed) {
          parsed.connected = true;
          parsed.source = 'live';
          setVitals(parsed);
        }
        // Non-data lines (no t_ms) are ignored, keeping the last good snapshot.
      };

      ws.onerror = () => {
        // Swallow — onclose handles recovery. (Prevents unhandled error noise.)
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUnmount.current) return;
        setVitals(DISCONNECTED_VITALS);
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (closedByUnmount.current) return;
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(connect, BRIDGE_RECONNECT_MS);
    };

    connect();

    return () => {
      closedByUnmount.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return vitals;
}
