/**
 * TCCC MARCH Protocol Decision Engine
 * Based on Tactical Combat Casualty Care Handbook v5 (TC 4-02.1)
 * M - Massive Hemorrhage | A - Airway | R - Respiration | C - Circulation | H - Hypothermia
 *
 * Ported from tccc.js to TypeScript — no logic changes.
 */

import type { ProtocolStep, Vitals } from '@/store/sessionStore';

export type GenerateProtocolArgs = {
  underFire: boolean;
  mechanism: string | null;
  symptoms: string[];
  vitals: Partial<Vitals> & { heartRate?: number | null; systolicBP?: number | null; oxygenSat?: number | null; skinTemp?: number | null };
  supplies: string[];
};

export function generateProtocol({
  underFire,
  mechanism,
  symptoms,
  vitals,
  supplies,
}: GenerateProtocolArgs): ProtocolStep[] {
  const has = (id: string) => symptoms.includes(id);
  const have = (id: string) => supplies.includes(id);
  const steps: ProtocolStep[] = [];

  // ── CARE UNDER FIRE ──────────────────────────────────────────────
  if (underFire) {
    steps.push({
      id: 'cuf',
      phaseCode: 'CUF',
      priority: 0,
      riskLevel: 'EXTREME',
      category: 'CARE UNDER FIRE',
      action: 'Suppress threat / Get to cover',
      detail:
        'Treat only life-threatening extremity hemorrhage. Move casualty to cover. Full assessment follows in Tactical Field Care.',
      resource: null,
      supplyAlt: null,
      steps: [
        { text: 'Return fire and take cover', critical: true },
        { text: 'Direct casualty to move to cover under own power if able', critical: false },
        { text: 'Drag casualty to cover if unable to self-move', critical: false },
        {
          text: 'Apply tourniquet to life-threatening extremity bleed ONLY — do not expose wound',
          critical: true,
        },
        { text: 'Do NOT remove clothing, assess wounds, or do IV under fire', critical: true },
        { text: 'Move to Tactical Field Care once threat is suppressed', critical: true },
      ],
      diagram: null,
      diagnosis: 'Care Under Fire phase — limited treatment until cover is achieved',
    });
  }

  // ── M: MASSIVE HEMORRHAGE ─────────────────────────────────────────
  if (has('extremity_bleed')) {
    steps.push({
      id: 'tourniquet',
      phaseCode: 'M',
      priority: 1,
      riskLevel: 'CRITICAL',
      category: 'M — Massive Hemorrhage',
      action: 'Apply tourniquet',
      detail:
        'Extremity hemorrhage is the #1 preventable cause of death in combat. Tourniquet now — no hesitation.',
      resource: have('tourniquet')
        ? 'CAT / SOFTT-W Tourniquet'
        : 'Improvised tourniquet (belt or cord)',
      supplyAlt: !have('tourniquet')
        ? 'Belt or strip of cloth: tie around limb 2–3in above wound, insert stick, twist until bleeding stops, secure stick to limb.'
        : null,
      steps: [
        { text: 'Expose limb — cut clothing above and below wound', critical: false },
        { text: 'Route tourniquet band 2–3 inches (5–7cm) above wound', critical: true },
        { text: 'Pull band tight — zero slack before windlass', critical: true },
        { text: 'Twist windlass until bleeding STOPS COMPLETELY', critical: true },
        { text: 'Lock windlass rod into clip — do not unlock', critical: true },
        { text: 'Write time of application on tourniquet with marker', critical: true },
        { text: 'Do NOT remove. Notify all receiving providers of TQ time.', critical: true },
      ],
      diagram:
        'Tourniquet position: 2–3 inches ABOVE wound on extremity. Not over joint.',
      diagnosis: 'Extremity hemorrhage — tourniquet applied',
    });
  }

  if (has('junctional_bleed') || has('neck_bleed') || has('groin_bleed') || has('armpit_bleed')) {
    steps.push({
      id: 'wound_pack',
      phaseCode: 'M',
      priority: 1,
      riskLevel: 'CRITICAL',
      category: 'M — Massive Hemorrhage',
      action: 'Wound packing + direct pressure',
      detail: 'Junctional bleed — tourniquet not applicable. Pack wound tightly with hemostatic material.',
      resource: have('hemostatic_gauze')
        ? 'Combat Gauze / QuikClot ACS+'
        : have('gauze')
        ? 'Gauze rolls'
        : 'Cleanest available cloth',
      supplyAlt: !have('hemostatic_gauze')
        ? 'Regular gauze or clean cloth — pack tightly into wound cavity, direct pressure minimum 3 minutes.'
        : null,
      steps: [
        { text: 'Expose wound — cut away clothing', critical: false },
        { text: 'Locate exact bleeding point inside wound', critical: true },
        { text: 'Pack wound firmly — push gauze DEEP into cavity', critical: true },
        { text: 'Apply direct pressure with BOTH hands — full body weight', critical: true },
        { text: 'Hold pressure MINIMUM 3 minutes — do not lift to check', critical: true },
        { text: 'Secure with pressure bandage', critical: false },
        {
          text: 'If still bleeding: add material on top — do NOT remove first pack',
          critical: true,
        },
      ],
      diagram:
        'Pack wound cavity tightly. Do not just cover surface. Push gauze deep to bleeding point.',
      diagnosis: 'Junctional hemorrhage — wound packing indicated',
    });
  }

  if (has('heavy_bleeding') && !has('extremity_bleed') && !has('junctional_bleed')) {
    steps.push({
      id: 'bleed_identify',
      phaseCode: 'M',
      priority: 1,
      riskLevel: 'CRITICAL',
      category: 'M — Massive Hemorrhage',
      action: 'Identify and control bleeding source',
      detail: 'Unknown bleed site. Rapid identification needed — method of control depends on location.',
      resource: have('tourniquet') ? 'Tourniquet + hemostatic gauze' : 'Any available material',
      supplyAlt: null,
      steps: [
        { text: 'Rapidly expose body — cut away clothing', critical: true },
        { text: 'Identify exact source of bleeding', critical: true },
        {
          text: 'Limb wound? → Apply tourniquet 2–3in above wound immediately',
          critical: true,
        },
        { text: 'Neck / groin / armpit? → Pack tightly, direct pressure 3+ minutes', critical: true },
        { text: 'Abdominal wound? → Cover with moist dressing, do NOT pack', critical: true },
        { text: 'Apply pressure bandage over all wounds', critical: false },
      ],
      diagram: 'Systematic exposure: head → neck → chest → abdomen → groin → limbs.',
      diagnosis: 'Hemorrhage — source identification required',
    });
  }

  if (
    have('tranexamic') &&
    (has('extremity_bleed') || has('junctional_bleed') || has('heavy_bleeding'))
  ) {
    steps.push({
      id: 'txa',
      phaseCode: 'M',
      priority: 2,
      riskLevel: 'HIGH',
      category: 'M — Massive Hemorrhage',
      action: 'Administer TXA (Tranexamic Acid)',
      detail: 'TXA reduces mortality when given within 3 hours of injury. Give now if significant hemorrhage.',
      resource: 'TXA 1g IV/IO over 10 min — MUST be given within 3hrs of injury',
      supplyAlt: null,
      steps: [
        { text: 'Confirm: <3 hours since injury?', critical: true },
        { text: 'Confirm: significant hemorrhage present?', critical: true },
        { text: 'Establish IV/IO access', critical: true },
        { text: 'Mix TXA 1g in 100ml NS — infuse over 10 minutes', critical: true },
        { text: 'Document time of administration', critical: true },
        { text: '2nd dose 1g TXA: can give over 8hrs if ongoing bleeding', critical: false },
      ],
      diagram: null,
      diagnosis: 'TXA indicated for traumatic hemorrhage within 3-hour window',
    });
  }

  // ── A: AIRWAY ────────────────────────────────────────────────────
  const airwayIssue =
    has('unconscious') ||
    has('gurgling') ||
    has('airway_obstruction') ||
    has('snoring_breathing');

  if (airwayIssue) {
    steps.push({
      id: 'airway',
      phaseCode: 'A',
      priority: 2,
      riskLevel: has('unconscious') ? 'CRITICAL' : 'HIGH',
      category: 'A — Airway',
      action: has('unconscious') ? 'Open and secure airway' : 'Clear airway obstruction',
      detail: has('unconscious')
        ? 'Unconscious casualty — airway will collapse without support. Secure immediately.'
        : 'Airway obstruction detected — clear and maintain open airway.',
      resource: have('npa') ? 'NPA (Nasopharyngeal Airway) + lubrication' : 'Positional management',
      supplyAlt: !have('npa')
        ? 'Recovery position (on side) maintains airway without equipment for unconscious casualty.'
        : null,
      steps: has('unconscious')
        ? [
            {
              text: 'Tilt head back, lift chin (unless spinal injury suspected → jaw thrust)',
              critical: true,
            },
            { text: 'Look, listen, feel for breathing — 10 seconds', critical: true },
            {
              text: 'Gurgling? Sweep finger through mouth to clear blood/debris',
              critical: false,
            },
            {
              text: 'Insert NPA: lubricate, insert into larger nostril bevel toward septum',
              critical: false,
            },
            {
              text: 'Position on side (recovery position) if breathing but unconscious',
              critical: true,
            },
            { text: 'Monitor breathing every 60 seconds', critical: true },
          ]
        : [
            { text: 'Open mouth — look for foreign body', critical: true },
            { text: 'Finger sweep if visible obstruction', critical: true },
            { text: 'Head-tilt chin-lift', critical: true },
            { text: 'Jaw thrust if spinal injury suspected', critical: false },
            { text: 'Insert NPA if available', critical: false },
          ],
      diagram:
        'NPA insertion: right nostril first. Bevel toward nasal septum. 6cm depth typical adult.',
      diagnosis: has('unconscious')
        ? 'Unconscious casualty — airway management required'
        : 'Airway obstruction',
    });
  }

  // ── R: RESPIRATION ───────────────────────────────────────────────
  if (has('sucking_chest_wound') || has('chest_wound')) {
    steps.push({
      id: 'chest_seal',
      phaseCode: 'R',
      priority: 2,
      riskLevel: 'CRITICAL',
      category: 'R — Respiration',
      action: 'Seal chest wound',
      detail:
        'Open pneumothorax. Seal on exhalation to prevent tension pneumothorax. Use vented seal.',
      resource: have('chest_seal')
        ? 'Hyfin / Bolin vented chest seal'
        : 'Improvised 3-sided occlusive dressing (plastic + tape)',
      supplyAlt: !have('chest_seal')
        ? 'Cut plastic (MRE wrapper, IV bag). Cover wound. Tape 3 sides only — leave bottom edge open as flutter valve.'
        : null,
      steps: [
        { text: 'Expose chest — cut or remove clothing', critical: false },
        { text: 'Wipe wound dry — seal will not stick to blood', critical: true },
        { text: 'Ask casualty to exhale fully', critical: true },
        {
          text: 'Apply chest seal over wound on exhalation — press ALL edges firmly',
          critical: true,
        },
        { text: 'Check for EXIT wound on back — seal if found', critical: true },
        {
          text: 'If using improvised: tape 3 sides, leave bottom open as flutter valve',
          critical: false,
        },
        {
          text: 'MONITOR: if breathing worsens or trachea deviates — burp the seal briefly',
          critical: true,
        },
      ],
      diagram:
        'Seal on exhalation. Vented seals preferred — allow trapped air to escape. Exit wound is as dangerous as entry.',
      diagnosis: 'Penetrating chest trauma — open pneumothorax',
    });
  }

  const hr = vitals.heartRate ?? null;
  const sbp = vitals.systolicBP ?? null;
  const o2 = vitals.oxygenSat ?? null;

  const tensionSigns =
    (o2 !== null && o2 < 90) ||
    (hr !== null && hr > 120) ||
    has('deviated_trachea') ||
    has('neck_vein_distention') ||
    (has('chest_wound') && has('difficulty_breathing') && has('rapid_weak_pulse'));

  if (tensionSigns && (has('chest_wound') || has('sucking_chest_wound'))) {
    steps.push({
      id: 'needle_decomp',
      phaseCode: 'R',
      priority: 2,
      riskLevel: 'CRITICAL',
      category: 'R — Respiration',
      action: 'Needle decompression',
      detail:
        'Tension pneumothorax: collapsed lung + mediastinal shift. Immediately fatal without decompression.',
      resource: have('needle_decompression')
        ? '14g 3.25in catheter-over-needle / NCD kit'
        : 'Largest available needle (14–16g preferred)',
      supplyAlt: null,
      steps: [
        { text: 'Identify affected side: decreased breath sounds, deviated trachea', critical: true },
        { text: 'PREFERRED site: lateral 4th–5th ICS, anterior axillary line', critical: true },
        { text: 'ALT site: 2nd ICS midclavicular line on affected side', critical: false },
        {
          text: 'Insert needle perpendicular to chest wall — rush of air confirms tension',
          critical: true,
        },
        { text: 'Leave catheter in place, remove needle, tape to secure', critical: true },
        { text: 'Reassess breathing — repeat if tension recurs', critical: true },
      ],
      diagram:
        'Lateral 4th–5th ICS (preferred): follow armpit line down to nipple level, insert over rib top (avoid vessels under rib).',
      diagnosis: 'Tension pneumothorax — immediate needle decompression',
    });
  }

  if (has('difficulty_breathing') && !has('chest_wound') && !has('sucking_chest_wound')) {
    steps.push({
      id: 'resp_support',
      phaseCode: 'R',
      priority: 3,
      riskLevel: 'HIGH',
      category: 'R — Respiration',
      action: 'Respiratory support',
      detail: 'Respiratory distress without obvious chest wound. Position, reassess, monitor.',
      resource: 'Positioning',
      supplyAlt: null,
      steps: [
        { text: 'Sit casualty upright if no spinal injury suspected', critical: false },
        { text: 'Loosen constrictive clothing at chest and neck', critical: false },
        { text: 'Re-examine chest for missed penetrating wound', critical: true },
        { text: 'Check airway — is it clear?', critical: true },
        { text: 'Count respiratory rate: normal 12–20/min', critical: false },
        { text: 'Monitor — escalate to urgent MEDEVAC if worsening', critical: false },
      ],
      diagram: null,
      diagnosis: 'Respiratory distress — etiology under assessment',
    });
  }

  // ── C: CIRCULATION ───────────────────────────────────────────────
  const skinTmp = vitals.skinTemp ?? null;

  const shockSigns =
    (hr !== null && hr > 100) ||
    (sbp !== null && sbp < 90) ||
    (o2 !== null && o2 < 94) ||
    has('pale_skin') ||
    has('cool_clammy') ||
    has('rapid_weak_pulse') ||
    has('altered_mental_status');

  if (shockSigns) {
    steps.push({
      id: 'shock',
      phaseCode: 'C',
      priority: 3,
      riskLevel: 'HIGH',
      category: 'C — Circulation',
      action: 'Treat hemorrhagic shock',
      detail:
        'Signs of shock. IV/IO access and controlled resuscitation. Target SBP 80–90 (permissive hypotension).',
      resource: have('iv_kit')
        ? 'Large-bore IV kit + fluids'
        : have('io_kit')
        ? 'IO drill kit (tibial)'
        : 'Positioning only',
      supplyAlt:
        !have('iv_kit') && !have('io_kit')
          ? 'No vascular access: lay flat, elevate legs 12in, keep warm, urgent MEDEVAC.'
          : null,
      steps: [
        { text: 'Verify all hemorrhage is controlled first', critical: true },
        have('iv_kit')
          ? { text: 'Establish large-bore IV — antecubital fossa preferred', critical: true }
          : { text: 'IO access: tibial plateau (2cm below tibial tuberosity, medial side)', critical: true },
        {
          text: have('blood_products')
            ? 'Transfuse: whole blood or 1:1:1 (PRBC:FFP:Plt)'
            : have('saline_fluids')
            ? 'Give 250ml NS/LR bolus — reassess — repeat if no improvement'
            : 'No fluids available: lay flat, elevate legs',
          critical: true,
        },
        { text: 'TARGET: SBP 80–90mmHg. Do NOT chase normal BP.', critical: true },
        { text: 'If TBI also present: TARGET SBP >90mmHg', critical: true },
        { text: 'Reassess vitals every 5 minutes', critical: false },
      ],
      diagram:
        'Permissive hypotension: deliberately low BP slows re-bleeding from clot. Do not over-hydrate penetrating trauma.',
      diagnosis: 'Hemorrhagic shock — fluid resuscitation indicated',
    });
  }

  if (has('extremity_bleed')) {
    steps.push({
      id: 'tq_reassess',
      phaseCode: 'C',
      priority: 4,
      riskLevel: 'MODERATE',
      category: 'C — Circulation',
      action: 'Reassess tourniquet',
      detail: 'Verify effectiveness and document time. Never remove without medical personnel.',
      resource: 'Tourniquet in place',
      supplyAlt: null,
      steps: [
        { text: 'Confirm bleeding is fully stopped distal to tourniquet', critical: true },
        { text: 'Check and record time of application', critical: true },
        { text: "Mark time on casualty's forehead: \"TQ [TIME]\"", critical: false },
        { text: 'Do NOT loosen or remove — document and hand off to medic', critical: true },
        { text: 'Note: limb salvage risk increases after 2hrs — urgent MEDEVAC', critical: false },
      ],
      diagram: null,
      diagnosis: 'Tourniquet — reassessment and time documentation',
    });
  }

  // ── H: HYPOTHERMIA + HEAD ────────────────────────────────────────
  const hypothermiaSigns =
    (skinTmp !== null && skinTmp < 35) ||
    has('shivering') ||
    has('cold_skin') ||
    has('hypothermia');
  const hasSignificantTrauma = steps.length > (underFire ? 1 : 0);

  if (hypothermiaSigns || hasSignificantTrauma) {
    steps.push({
      id: 'hypothermia',
      phaseCode: 'H',
      priority: 5,
      riskLevel: hypothermiaSigns ? 'HIGH' : 'MODERATE',
      category: 'H — Hypothermia Prevention',
      action: 'Prevent / treat hypothermia',
      detail:
        'Hypothermia triad: coagulopathy + acidosis + hypothermia = death. Wrap every trauma patient.',
      resource: have('hypothermia_blanket')
        ? 'Hypothermia Prevention Kit / Ready-Heat blanket'
        : have('space_blanket')
        ? 'Space / emergency blanket'
        : 'Poncho, extra clothing, sleeping bag — anything insulating',
      supplyAlt: null,
      steps: [
        { text: 'Remove wet clothing if tactical situation allows', critical: false },
        { text: 'Wrap casualty head-to-toe in insulating material', critical: true },
        { text: 'Insulate from ground — do NOT let casualty lie on bare cold surface', critical: true },
        { text: 'Cover head — significant heat loss through scalp', critical: false },
        { text: 'Warm IV fluids if available and patient going hypothermic', critical: false },
        { text: 'Warm oral fluids if conscious, alert, and no abdominal wound', critical: false },
      ],
      diagram: null,
      diagnosis: hypothermiaSigns
        ? 'Active hypothermia — rewarming required'
        : 'Hypothermia prevention — standard trauma protocol',
    });
  }

  if (has('head_injury') || has('loss_of_consciousness') || has('seizure')) {
    steps.push({
      id: 'head_tbi',
      phaseCode: 'H',
      priority: 4,
      riskLevel: 'HIGH',
      category: 'H — Head / TBI',
      action: 'Manage traumatic brain injury',
      detail:
        'TBI: prevent secondary injury. Maintain airway and BP. Do NOT give opioids for isolated TBI.',
      resource: have('eye_shield') ? 'Eye shield (if eye injury)' : 'Monitoring + positioning',
      supplyAlt: null,
      steps: [
        {
          text: 'Maintain airway — unconscious TBI requires active airway management',
          critical: true,
        },
        { text: 'Elevate head of stretcher 30° if no hypotension', critical: false },
        { text: 'Target SBP >90mmHg — higher than standard permissive hypotension', critical: true },
        {
          text: 'Do NOT give morphine for isolated TBI — use ketamine if pain control needed',
          critical: true,
        },
        {
          text: 'Monitor pupils every 5 min: unequal / blown pupil = herniation → urgent MEDEVAC',
          critical: true,
        },
        {
          text: 'If eye injury: shield eye, do NOT rub or apply pressure to globe',
          critical: false,
        },
        { text: 'Seizure: protect from injury, roll to side, do NOT restrain', critical: false },
      ],
      diagram:
        'Pupil check: shine light in eye. Normal = constricts. Blown (dilated + non-reactive) = herniation. ACT NOW.',
      diagnosis: 'Traumatic brain injury — conservative management and monitoring',
    });
  }

  // ── PAIN ─────────────────────────────────────────────────────────
  const canGivePain =
    !has('head_injury') && !has('unconscious') && !has('loss_of_consciousness');
  const hasPainMed = have('ketamine') || have('morphine') || have('ibuprofen');
  if (canGivePain && hasSignificantTrauma) {
    steps.push({
      id: 'pain',
      phaseCode: 'C',
      priority: 6,
      riskLevel: 'MODERATE',
      category: 'Pain Management',
      action: 'Treat pain',
      detail: 'Untreated pain worsens shock response. TCCC-approved pain management.',
      resource: have('ketamine')
        ? 'Ketamine (preferred TCCC analgesic)'
        : have('morphine')
        ? 'Morphine (with restrictions)'
        : have('ibuprofen')
        ? 'Meloxicam 15mg PO or Ibuprofen 800mg PO'
        : 'No pharmacological option — reassurance, positioning',
      supplyAlt: null,
      steps: [
        { text: 'Assess: conscious, breathing >12/min, SBP >90?', critical: true },
        have('ketamine')
          ? { text: 'Ketamine: 50mg IM or 20mg IV/IO slowly. Can repeat once.', critical: false }
          : have('morphine')
          ? {
              text: 'Morphine 5mg IV/IO: titrate slowly. Contraindicated: SBP<90, RR<12, TBI.',
              critical: true,
            }
          : have('ibuprofen')
          ? {
              text: 'Meloxicam 15mg PO or Ibuprofen 800mg PO with food if able',
              critical: false,
            }
          : {
              text: 'No meds: reassurance, comfortable positioning, explain each step',
              critical: false,
            },
        { text: 'Document: medication, dose, route, time', critical: true },
        { text: 'Reassess pain and vitals after 15 minutes', critical: false },
      ],
      diagram: null,
      diagnosis: hasPainMed ? 'Pain management — pharmacological' : 'Pain management — non-pharmacological',
    });
  }

  // ── MIST HANDOFF ─────────────────────────────────────────────────
  steps.push({
    id: 'mist',
    phaseCode: 'EVA',
    priority: 99,
    riskLevel: 'STABLE',
    category: 'MEDEVAC / Handoff',
    action: 'Prepare MIST report',
    detail: 'Prepare verbal handoff for receiving medical personnel using MIST format.',
    resource: null,
    supplyAlt: null,
    steps: [
      {
        text: 'M — MECHANISM: describe how injury occurred (GSW, blast, fall…)',
        critical: false,
      },
      { text: 'I — INJURIES: list all injuries found, head to toe', critical: false },
      { text: 'S — SIGNS: current HR, BP, RR, SpO2, LOC (AVPU)', critical: false },
      {
        text: 'T — TREATMENT: tourniquet time, fluids given (volume), medications (name/dose/time)',
        critical: false,
      },
      { text: 'STATE TQ TIME verbally to ALL receiving providers', critical: true },
    ],
    diagram: null,
    diagnosis: 'MIST handoff — continuity of care',
  });

  return steps.sort((a, b) => a.priority - b.priority);
}

export const AVPU = [
  { code: 'A', label: 'ALERT', detail: 'Eyes open, responds normally' },
  { code: 'V', label: 'VOICE', detail: 'Responds to verbal stimuli only' },
  { code: 'P', label: 'PAIN', detail: 'Responds to pain stimulus only' },
  { code: 'U', label: 'UNRESPONSIVE', detail: 'No response to any stimulus — critical' },
] as const;

export type AVPUCode = (typeof AVPU)[number]['code'];
