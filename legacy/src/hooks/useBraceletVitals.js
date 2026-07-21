// Simulates live BLE bracelet sensor feed.
// Replace setInterval data with real BLE characteristic reads when hardware exists.
import { useState, useEffect } from 'react';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const jitter = (v, delta) => v + (Math.random() * delta * 2 - delta);

export function useBraceletVitals() {
  const [vitals, setVitals] = useState({
    connected: true,
    heartRate:   78,
    oxygenSat:   98,
    systolicBP:  118,
    skinTemp:    36.8,
    shockIndex:  0.66,   // HR ÷ sBP — >1.0 = shock flag
  });

  useEffect(() => {
    const id = setInterval(() => {
      setVitals(v => {
        const hr  = clamp(Math.round(jitter(v.heartRate,  2)), 30, 220);
        const sbp = clamp(Math.round(jitter(v.systolicBP, 2)), 40, 220);
        const o2  = clamp(Math.round(jitter(v.oxygenSat,  0.8)), 70, 100);
        const tmp = clamp(+jitter(v.skinTemp, 0.08).toFixed(1), 28, 42);
        return {
          ...v,
          heartRate:  hr,
          systolicBP: sbp,
          oxygenSat:  o2,
          skinTemp:   tmp,
          shockIndex: +(hr / sbp).toFixed(2),
        };
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return vitals;
}
