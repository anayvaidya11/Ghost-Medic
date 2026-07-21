/**
 * SESSION STORE — Zustand single source of truth for the entire GhostMedic session.
 * All screens read/write from here. No prop drilling.
 */
import { create } from 'zustand';
import type { Scenario } from '@/types/scenario';
import hypothermiaSkier from '@/scenarios/hypothermia-skier.json';
import snakeBiteHiker from '@/scenarios/snake-bite-hiker.json';
import anaphylaxisBeeSting from '@/scenarios/anaphylaxis-bee-sting.json';
import fallFromHeight from '@/scenarios/fall-from-height.json';
import altitudeCerebralEdema from '@/scenarios/altitude-cerebral-edema.json';

// ── TYPES ────────────────────────────────────────────────────────────

export type Mode = 'self' | 'teammate' | 'stealth';

export type Vitals = {
  heartRate: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  respiratoryRate: number | null;
  oxygenSat: number | null;
  skinTemp: number | null;
  shockIndex: number | null;
  avpu: 'A' | 'V' | 'P' | 'U' | null;
};

export type ProtocolSubStep = {
  text: string;
  critical: boolean;
};

export type ProtocolStep = {
  id: string;
  phaseCode: string;
  priority: number;
  riskLevel: string;
  category: string;
  action: string;
  detail: string;
  resource: string | null;
  supplyAlt: string | null;
  steps: ProtocolSubStep[];
  diagram?: string | null;
  diagnosis: string;
};

export type LogEntry = {
  id: string;
  timestamp: number;
  text: string;
};

export type SessionState = {
  // Session metadata
  mode: Mode;
  sessionStartTime: number | null;

  // Evacuation
  evacuationInitiatedAt: number | null;

  // Triage inputs
  underFire: boolean;
  mechanism: string | null;
  selectedSymptoms: string[];
  woundPhotoBase64: string | null;
  woundPhotoUri: string | null;
  audioTranscript: string | null;

  // Vitals
  vitals: Vitals;

  // Protocol (MARCH decision tree output)
  protocol: ProtocolStep[];

  // LLM / AI state
  aiResponse: string;
  isThinking: boolean;
  streamingResponse: string;

  // Medic log
  log: LogEntry[];

  // Scenarios (for reference / LLM context)
  scenarios: Scenario[];
  activeScenarioId: string;

  // ── ACTIONS ─────────────────────────────────────────────────────────
  setMode: (mode: Mode) => void;
  startSession: () => void;
  resetSession: () => void;
  markEvacuationInitiated: () => void;

  setUnderFire: (val: boolean) => void;
  setMechanism: (val: string | null) => void;
  toggleSymptom: (id: string) => void;
  setSelectedSymptoms: (ids: string[]) => void;
  setWoundPhoto: (uri: string | null, base64: string | null) => void;
  setAudioTranscript: (text: string | null) => void;

  setVitals: (v: Partial<Vitals>) => void;
  setProtocol: (steps: ProtocolStep[]) => void;

  appendLog: (text: string) => void;
  clearLog: () => void;

  setThinking: (val: boolean) => void;
  appendStreamToken: (token: string) => void;
  setAiResponse: (text: string) => void;

  loadScenario: (id: string) => void;
};

// ── INITIAL VITALS ───────────────────────────────────────────────────

const EMPTY_VITALS: Vitals = {
  heartRate: null,
  systolicBP: null,
  diastolicBP: null,
  respiratoryRate: null,
  oxygenSat: null,
  skinTemp: null,
  shockIndex: null,
  avpu: null,
};

// ── SCENARIOS ───────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  hypothermiaSkier as Scenario,
  snakeBiteHiker as Scenario,
  anaphylaxisBeeSting as Scenario,
  fallFromHeight as Scenario,
  altitudeCerebralEdema as Scenario,
];

// ── STORE ────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>((set, get) => ({
  mode: 'self',
  sessionStartTime: null,
  evacuationInitiatedAt: null,

  underFire: false,
  mechanism: null,
  selectedSymptoms: [],
  woundPhotoBase64: null,
  woundPhotoUri: null,
  audioTranscript: null,

  vitals: { ...EMPTY_VITALS },

  protocol: [],

  aiResponse: '',
  isThinking: false,
  streamingResponse: '',

  log: [],

  scenarios: SCENARIOS,
  activeScenarioId: SCENARIOS[0].id,

  // ── Actions ─────────────────────────────────────────────────────────

  setMode: (mode) => set({ mode }),

  startSession: () => set({ sessionStartTime: Date.now() }),

  markEvacuationInitiated: () =>
    set((s) => ({ evacuationInitiatedAt: s.evacuationInitiatedAt ?? Date.now() })),

  resetSession: () =>
    set({
      sessionStartTime: null,
      evacuationInitiatedAt: null,
      underFire: false,
      mechanism: null,
      selectedSymptoms: [],
      woundPhotoBase64: null,
      woundPhotoUri: null,
      audioTranscript: null,
      vitals: { ...EMPTY_VITALS },
      protocol: [],
      aiResponse: '',
      isThinking: false,
      streamingResponse: '',
      log: [],
    }),

  setUnderFire: (val) => set({ underFire: val }),
  setMechanism: (val) => set({ mechanism: val }),

  toggleSymptom: (id) =>
    set((s) => ({
      selectedSymptoms: s.selectedSymptoms.includes(id)
        ? s.selectedSymptoms.filter((x) => x !== id)
        : [...s.selectedSymptoms, id],
    })),

  setSelectedSymptoms: (ids) => set({ selectedSymptoms: ids }),

  setWoundPhoto: (uri, base64) =>
    set({ woundPhotoUri: uri, woundPhotoBase64: base64 }),

  setAudioTranscript: (text) => set({ audioTranscript: text }),

  setVitals: (v) =>
    set((s) => ({ vitals: { ...s.vitals, ...v } })),

  setProtocol: (steps) => set({ protocol: steps }),

  appendLog: (text) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      text,
    };
    set((s) => ({ log: [...s.log, entry] }));
  },

  clearLog: () => set({ log: [] }),

  setThinking: (val) =>
    set(
      val
        ? { isThinking: true, streamingResponse: '', aiResponse: '' }
        : { isThinking: false }
    ),

  appendStreamToken: (token) =>
    set((s) => ({ streamingResponse: s.streamingResponse + token })),

  setAiResponse: (text) => set({ aiResponse: text }),

  loadScenario: (id) => {
    const found = get().scenarios.find((s) => s.id === id);
    if (!found) return;
    set({ activeScenarioId: id });
  },
}));

// ── SELECTORS ────────────────────────────────────────────────────────

export const selectActiveScenario = (s: SessionState): Scenario =>
  s.scenarios.find((x) => x.id === s.activeScenarioId) ?? s.scenarios[0];

export const selectElapsedSeconds = (s: SessionState): number => {
  if (!s.sessionStartTime) return 0;
  return Math.floor((Date.now() - s.sessionStartTime) / 1000);
};
