export type Vitals = {
  hr: number;       // beats per minute
  bpSys: number;    // systolic mmHg
  bpDia: number;    // diastolic mmHg
  rr: number;       // respirations per minute
  spo2: number;     // % oxygen saturation
};

export type Injury = {
  region: string;
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  notes?: string;
};

export type Casualty = {
  callsign: string;
  age: number;
  sex: 'M' | 'F';
  weightKg: number;
  mechanism: string;
  timeOfInjury: string;
  consciousness: 'A' | 'V' | 'P' | 'U';
  injuries: Injury[];
  vitals: Vitals;
};

export type Scenario = {
  id: string;
  title: string;
  briefing: string;
  environment: string;
  casualty: Casualty;
};
