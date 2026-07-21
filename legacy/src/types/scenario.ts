export type Vitals = {
  hr: number;       // beats per minute
  bpSys: number;    // systolic mmHg
  bpDia: number;    // diastolic mmHg
  rr: number;       // respirations per minute
  spo2: number;     // % oxygen saturation
};

export type Injury = {
  region: string;     // e.g. "left calf", "right ankle"
  type: string;       // e.g. "snake bite", "fall", "frostbite"
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  notes?: string;
};

export type Patient = {
  patientId: string;       // field-assigned patient identifier
  age: number;
  sex: 'M' | 'F';
  weightKg: number;
  mechanism: string;       // mechanism of injury / nature of illness
  timeOfInjury: string;    // ISO-ish, free text for demo
  consciousness: 'A' | 'V' | 'P' | 'U'; // AVPU
  injuries: Injury[];
  vitals: Vitals;
};

export type Scenario = {
  id: string;
  title: string;
  briefing: string;
  environment: string;     // terrain / conditions, e.g. "alpine bowl, dusk"
  terrain?: string;        // optional terrain detail for SAR context
  evacNote?: string;       // optional evac framing for SAR context
  patient: Patient;
};
