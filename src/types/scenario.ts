export type Vitals = {
  hr: number;       // beats per minute
  bpSys: number;    // systolic mmHg
  bpDia: number;    // diastolic mmHg
  rr: number;       // respirations per minute
  spo2: number;     // % oxygen saturation
};

export type Injury = {
  region: string;     // e.g. "right chest", "left thigh"
  type: string;       // e.g. "GSW", "blast frag", "burn"
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  notes?: string;
};

export type Casualty = {
  callsign: string;
  age: number;
  sex: 'M' | 'F';
  weightKg: number;
  mechanism: string;       // mechanism of injury
  timeOfInjury: string;    // ISO-ish, free text for demo
  consciousness: 'A' | 'V' | 'P' | 'U'; // AVPU
  injuries: Injury[];
  vitals: Vitals;
};

export type Scenario = {
  id: string;
  title: string;
  briefing: string;
  environment: string;     // e.g. "urban, night, hostile"
  casualty: Casualty;
};
