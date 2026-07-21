/**
 * BIOSENSOR SERVICE — BLE vital-signs integration stub
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REAL INTEGRATION CHECKLIST (swap this stub for production hardware):
 *
 * 1. PACKAGE:   npm install react-native-ble-plx
 *               Add expo plugin: "react-native-ble-plx" in app.json > plugins
 *
 * 2. BLE GATT PROFILE (standard heart-rate / pulse-ox profile):
 *    Service UUID:       0x180D (Heart Rate Service)
 *    Characteristic:     0x2A37 (Heart Rate Measurement) — NOTIFY
 *
 *    Service UUID:       0x1822 (Pulse Oximetry Service)
 *    Characteristic:     0x2A5F (PLX Continuous Measurement) — NOTIFY
 *
 *    Service UUID:       0x1810 (Blood Pressure Service)
 *    Characteristic:     0x2A35 (Blood Pressure Measurement) — INDICATE
 *
 *    Service UUID:       0x1809 (Health Thermometer Service)
 *    Characteristic:     0x2A1C (Temperature Measurement) — INDICATE
 *
 * 3. POLLING INTERVAL: BLE NOTIFY/INDICATE is event-driven (no polling needed).
 *    For devices that don't push, poll every 2000ms per characteristic.
 *
 * 4. SWAP POINT:  Replace the setInterval simulation block below with:
 *    a) BleManager.startDeviceScan → find device by name/UUID
 *    b) device.connect() → discoverAllServicesAndCharacteristics()
 *    c) device.monitorCharacteristicForService(svcUUID, charUUID, callback)
 *    d) Parse BLE byte arrays per GATT spec into numeric vitals
 *    e) Call setVitals() in each callback
 *
 * 5. PERMISSIONS (add to app.json infoPlist / android permissions):
 *    iOS:    NSBluetoothAlwaysUsageDescription
 *    Android: BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';

export type BiosensorVitals = {
  hr: number;
  bpSys: number;
  bpDia: number;
  rr: number;
  spo2: number;
  skinTemp: number;
  shockIndex: number;
  connected: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const jitter = (v: number, delta: number) => v + (Math.random() * delta * 2 - delta);

const INITIAL: BiosensorVitals = {
  connected: true,     // Simulated as connected
  hr: 78,
  bpSys: 118,
  bpDia: 76,
  rr: 16,
  spo2: 98,
  skinTemp: 36.8,
  shockIndex: 0.66,   // HR ÷ sBP — >1.0 = shock flag
};

/**
 * useBiosensorVitals — returns live vitals from the connected biosensor.
 *
 * Today this returns simulated values (copied from Jonathan's useBraceletVitals).
 * When real BLE hardware is available:
 *   1. Remove the setInterval block
 *   2. Import BleManager from react-native-ble-plx
 *   3. Follow the swap checklist above
 */
export function useBiosensorVitals(): BiosensorVitals {
  const [vitals, setVitals] = useState<BiosensorVitals>(INITIAL);

  useEffect(() => {
    // ── SIMULATION — replace this block with BLE callbacks ──────────
    const id = setInterval(() => {
      setVitals((v) => {
        const hr = clamp(Math.round(jitter(v.hr, 2)), 30, 220);
        const bpSys = clamp(Math.round(jitter(v.bpSys, 2)), 40, 220);
        const bpDia = clamp(Math.round(jitter(v.bpDia, 1.5)), 30, 140);
        const rr = clamp(Math.round(jitter(v.rr, 0.5)), 4, 60);
        const spo2 = clamp(Math.round(jitter(v.spo2, 0.8)), 70, 100);
        const skinTemp = clamp(+jitter(v.skinTemp, 0.08).toFixed(1), 28, 42);
        return {
          ...v,
          hr,
          bpSys,
          bpDia,
          rr,
          spo2,
          skinTemp,
          shockIndex: +(hr / bpSys).toFixed(2),
        };
      });
    }, 2000);
    // ── END SIMULATION ───────────────────────────────────────────────

    return () => clearInterval(id);
  }, []);

  return vitals;
}
