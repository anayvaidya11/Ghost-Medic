/**
 * EVACUATION DECISIONS
 *
 * Wilderness medicine's defining decision is GO / STAY / CALL:
 *   GO    — self-evacuate (walk-out / assisted), care continues en route.
 *   STAY  — shelter in place and treat; bring help to the patient.
 *   CALL  — activate outside SAR resources (ground team or helicopter).
 *
 * This module encodes how to translate a patient picture into:
 *   1. an urgency level (IMMEDIATE / URGENT / DELAYED / NONE),
 *   2. a resource choice (helicopter vs ground SAR vs walk-out), and
 *   3. the information dispatch actually needs to launch the right asset.
 *
 * It is intentionally independent of any single condition protocol so it can be
 * reused by the evacuation screen and by the LLM-grounding context.
 */

import type { EvacuationLevel } from './wildernessProtocols';

export type EvacDisposition = 'GO' | 'STAY' | 'CALL';

export type EvacResource = 'helicopter' | 'ground-sar' | 'walk-out' | 'assisted-walk-out';

export type EvacUrgency = 'immediate' | '24hr' | 'walk-out';

export type EvacuationProfile = {
  level: EvacuationLevel;
  /** Human-readable urgency window. */
  urgency: EvacUrgency;
  /** Recommended high-level disposition. */
  disposition: EvacDisposition;
  /** Preferred resource(s), best-first. */
  resources: EvacResource[];
  /** Short label/color hint for UI. */
  color: string;
  /** When this level applies. */
  criteria: string;
  /** What the responder should do operationally. */
  action: string;
};

/** Palette mirrors src/theme RISK colors so the screen stays on-brand. */
export const EVAC_PROFILES: Record<EvacuationLevel, EvacuationProfile> = {
  IMMEDIATE: {
    level: 'IMMEDIATE',
    urgency: 'immediate',
    disposition: 'CALL',
    resources: ['helicopter', 'ground-sar'],
    color: '#ff4d4d',
    criteria:
      'Life or limb threat now: airway/breathing failure, severe shock, severe hypothermia, heat stroke, HACE/HAPE, major trauma, anaphylaxis after epi.',
    action:
      'Activate SAR and request helicopter if terrain/weather/daylight allow. Do not wait — minutes matter.',
  },
  URGENT: {
    level: 'URGENT',
    urgency: '24hr',
    disposition: 'CALL',
    resources: ['ground-sar', 'helicopter', 'assisted-walk-out'],
    color: '#ffb547',
    criteria:
      'Serious but not immediately life-threatening: stable fractures, moderate hypothermia, snake bite, near-drowning recovered, deep frostbite.',
    action:
      'Initiate evacuation within hours (target < 24h). Ground SAR usually appropriate; helicopter if access is slow or patient is deteriorating.',
  },
  DELAYED: {
    level: 'DELAYED',
    urgency: 'walk-out',
    disposition: 'GO',
    resources: ['assisted-walk-out', 'walk-out'],
    color: '#60A5FA',
    criteria:
      'Can be managed in the field and moved without urgency: mild hypothermia/AMS, heat exhaustion resolving, minor injuries.',
    action:
      'Self-evacuate at a sustainable pace, or monitor and reassess. Escalate if the trend worsens.',
  },
  NONE: {
    level: 'NONE',
    urgency: 'walk-out',
    disposition: 'STAY',
    resources: ['walk-out'],
    color: '#7cff6b',
    criteria:
      'No evacuation indicated: minor issue fully treated in the field, normal vitals and mentation.',
    action:
      'Continue activity or walk out normally. Document and monitor; no outside resources needed.',
  },
};

/**
 * HELICOPTER vs GROUND decision factors. Encoded as guidance, not a hard rule —
 * the field call always weighs patient acuity against operational risk.
 */
export const HELICOPTER_VS_GROUND = {
  favorsHelicopter: [
    'Time-critical condition (IMMEDIATE urgency)',
    'Long or technical ground egress (many hours, exposure, rough terrain)',
    'Patient deteriorating faster than ground evac can move them',
    'Adequate daylight, acceptable weather, and a usable landing/hoist site',
  ],
  favorsGround: [
    'Weather/darkness/wind below helicopter limits',
    'No safe landing zone or hoist point near the patient',
    'Stable patient who can tolerate a longer carry-out',
    'Helicopter unavailable or delayed beyond acceptable time',
  ],
  alwaysReport: [
    'GPS coordinates / lat-long and a verbal location description',
    'Number of patients and overall severity',
    'Suitability of terrain for landing or hoist',
    'Current and forecast weather at the scene',
  ],
};

/**
 * The structured packet dispatch / SAR needs in order to launch the right asset.
 * Mirrors a standard SAR call-out brief.
 */
export type DispatchReport = {
  location: string;
  patient: string; // age / sex / one-line condition
  mechanism: string;
  primaryFindings: string;
  vitalsTrend: string;
  evacRequest: string; // urgency + resource ask
  hazards: string;
};

export const DISPATCH_FIELDS: Array<{ key: keyof DispatchReport; label: string; hint: string }> = [
  { key: 'location', label: 'LOCATION', hint: 'GPS / lat-long + trail or feature description' },
  { key: 'patient', label: 'PATIENT', hint: 'Age, sex, and a one-line problem statement' },
  { key: 'mechanism', label: 'MECHANISM OF INJURY', hint: 'What happened / nature of illness' },
  { key: 'primaryFindings', label: 'PRIMARY FINDINGS', hint: 'ABCDE problems and key SAMPLE points' },
  { key: 'vitalsTrend', label: 'VITALS TREND', hint: 'Latest vitals and whether improving or worsening' },
  { key: 'evacRequest', label: 'EVAC REQUEST', hint: 'Urgency + helicopter vs ground + special needs' },
  { key: 'hazards', label: 'SCENE / HAZARDS', hint: 'Terrain, weather, landing-zone suitability' },
];

export function getEvacProfile(level: EvacuationLevel): EvacuationProfile {
  return EVAC_PROFILES[level];
}

/**
 * Parse a Ghost Medic response and extract the declared evacuation level.
 * The system prompt requires the model to end with "EVACUATION: [LEVEL] ...".
 */
export function parseEvacuationLevel(response: string): EvacuationLevel | null {
  const match = response.match(/EVACUATION:\s*\[?\s*(IMMEDIATE|URGENT|DELAYED|NONE)/i);
  if (!match) return null;
  return match[1].toUpperCase() as EvacuationLevel;
}
