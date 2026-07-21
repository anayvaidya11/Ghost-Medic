/**
 * WILDERNESS PROTOCOLS
 *
 * Replaces the former TCCC / MARCH dataset. Encodes Wilderness Medical Society
 * (WMS) guidance and the Patient Assessment System (PAS) used by wilderness
 * EMTs, SAR responders, and backcountry users operating far from definitive care.
 *
 * PAS flow (the spine every protocol below assumes):
 *   SCENE  → is it safe? mechanism? number of patients? BSI/PPE?
 *   PRIMARY ASSESSMENT (ABCDE):
 *     A — Airway (with c-spine consideration)
 *     B — Breathing
 *     C — Circulation (bleeding, perfusion, pulse)
 *     D — Disability (AVPU, gross neuro, blood glucose)
 *     E — Environment / Exposure (protect from cold, heat, terrain)
 *   SECONDARY ASSESSMENT (SAMPLE):
 *     S — Signs / Symptoms
 *     A — Allergies
 *     M — Medications
 *     P — Past pertinent history
 *     L — Last oral intake
 *     E — Events leading up
 *   TREATMENT  → field interventions with a wilderness kit
 *   EVACUATION → GO / STAY / CALL decision (see evacuationDecisions.ts)
 *
 * Drug recommendations are limited to what is realistically carried in a
 * wilderness first-aid kit: epinephrine auto-injector, diphenhydramine,
 * ibuprofen, acetaminophen, aspirin, oral glucose.
 */

export type WildernessCategory = 'trauma' | 'environmental' | 'medical';

export type EvacuationLevel = 'IMMEDIATE' | 'URGENT' | 'DELAYED' | 'NONE';

export type PASPhaseCode =
  | 'SCENE'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'SAMPLE'
  | 'TX'
  | 'EVAC';

export type PASPhase = {
  code: PASPhaseCode;
  title: string;
  prompts: string[];
};

/**
 * The generic Patient Assessment System spine. Every wilderness response walks
 * this in order; condition-specific protocols below layer onto it.
 */
export const PAS_PRIMARY: PASPhase[] = [
  {
    code: 'SCENE',
    title: 'Scene Size-Up',
    prompts: [
      'Is the scene safe for you and the team? Rockfall, avalanche, water, weather, lightning, traffic.',
      'Put on barrier protection (gloves) before patient contact.',
      'Identify mechanism of injury or nature of illness.',
      'Count patients and request resources early if more than one.',
    ],
  },
  {
    code: 'A',
    title: 'Airway',
    prompts: [
      'Is the airway open and clear? Listen for stridor or gurgling.',
      'Consider spinal mechanism — control the head/neck if trauma is suspected.',
      'Reposition (jaw-thrust / chin-lift) or clear obvious obstruction.',
    ],
  },
  {
    code: 'B',
    title: 'Breathing',
    prompts: [
      'Look, listen, feel for adequate, effective breathing.',
      'Count respiratory rate and effort; note cyanosis.',
      'Treat open chest wounds and severe distress.',
    ],
  },
  {
    code: 'C',
    title: 'Circulation',
    prompts: [
      'Scan for and control major external bleeding (direct pressure, then tourniquet).',
      'Check perfusion: radial pulse, skin color/temp, cap refill.',
      'Assess for shock and lay the patient down if perfusion is poor.',
    ],
  },
  {
    code: 'D',
    title: 'Disability',
    prompts: [
      'Record level of responsiveness with AVPU.',
      'Gross neuro check: can the patient move and feel all four extremities?',
      'Consider blood glucose / hypoglycemia in altered patients.',
    ],
  },
  {
    code: 'E',
    title: 'Environment / Exposure',
    prompts: [
      'Expose to find hidden injuries, then re-cover quickly.',
      'Protect from the ground, wind, cold, heat, and wet.',
      'Build insulation under and around the patient (hypothermia wrap).',
    ],
  },
  {
    code: 'SAMPLE',
    title: 'Secondary Assessment (SAMPLE history)',
    prompts: [
      'Signs/Symptoms — what do you see, what does the patient feel?',
      'Allergies — medications, food, environmental.',
      'Medications — prescription, OTC, recreational, last doses.',
      'Past pertinent history — prior similar events, chronic conditions.',
      'Last oral intake — food and fluid.',
      'Events — what led up to the incident.',
    ],
  },
];

export type WildernessProtocol = {
  id: string;
  name: string;
  category: WildernessCategory;
  /** Optional staged severity, e.g. mild / moderate / severe. */
  stage?: string;
  /** One-line PAS-oriented framing of the problem. */
  summary: string;
  /** Findings that should jump out during the primary/secondary assessment. */
  keyFindings: string[];
  /** Findings that escalate urgency immediately. */
  redFlags: string[];
  /** Ordered field treatment steps with a wilderness kit. */
  treatment: string[];
  /** Wilderness-kit medications that may apply (names only — confirm dosing). */
  medications: string[];
  /** Default evacuation level for the typical presentation. */
  evacuation: EvacuationLevel;
  /** One sentence on what to communicate to dispatch / SAR. */
  evacuationNote: string;
};

export const WILDERNESS_PROTOCOLS: WildernessProtocol[] = [
  // ── ENVIRONMENTAL ──────────────────────────────────────────────────
  {
    id: 'hypothermia-mild',
    name: 'Hypothermia — Mild',
    category: 'environmental',
    stage: 'mild',
    summary: 'Cold, alert, still shivering vigorously. Core roughly 32–35°C.',
    keyFindings: [
      'Shivering present and forceful',
      'Alert, may be clumsy or apathetic ("umbles")',
      'Cold extremities, pale skin',
    ],
    redFlags: ['Shivering stops despite ongoing cold', 'Declining mental status'],
    treatment: [
      'Move to shelter, stop heat loss: remove wet layers, insulate from ground.',
      'Build a hypothermia wrap (insulation + vapor barrier + wind layer).',
      'Give warm, sweet fluids and simple carbohydrates if fully alert.',
      'Add active warming to the trunk (warm packs to chest, neck, armpits, groin).',
      'Allow gentle re-warming; let shivering do the work.',
    ],
    medications: ['oral glucose'],
    evacuation: 'DELAYED',
    evacuationNote:
      'Often treatable in field; evacuate if no improvement after rewarming or if status declines.',
  },
  {
    id: 'hypothermia-moderate',
    name: 'Hypothermia — Moderate',
    category: 'environmental',
    stage: 'moderate',
    summary: 'Shivering waning, confused/clumsy. Core roughly 28–32°C.',
    keyFindings: [
      'Shivering decreasing or stopped',
      'Confusion, slurred speech, poor coordination',
      'Slow pulse and respirations',
    ],
    redFlags: ['No shivering', 'Cannot follow commands', 'Bradycardia'],
    treatment: [
      'Handle GENTLY — rough movement can trigger cardiac arrhythmia.',
      'Horizontal hypothermia wrap; insulate fully, add external heat to trunk.',
      'Do NOT give oral fluids if not reliably alert (aspiration risk).',
      'Minimize exertion by the patient; keep them flat and still.',
      'Monitor breathing and pulse closely (assess for a full 60 seconds).',
    ],
    medications: [],
    evacuation: 'URGENT',
    evacuationNote:
      'Needs evacuation to controlled rewarming; tell dispatch "moderate hypothermia, handle gently."',
  },
  {
    id: 'hypothermia-severe',
    name: 'Hypothermia — Severe',
    category: 'environmental',
    stage: 'severe',
    summary: 'Not shivering, unconscious or near it. Core below ~28°C. May appear dead.',
    keyFindings: [
      'Unresponsive or barely responsive',
      'Rigid, no shivering, undetectable or very slow pulse',
      'Appears lifeless — "not dead until warm and dead"',
    ],
    redFlags: ['No detectable pulse', 'Apnea', 'Cardiac arrest'],
    treatment: [
      'Extreme gentle handling — any jostling may cause arrest.',
      'Check pulse for a FULL 60 seconds before deciding on CPR.',
      'If pulse present (even faint), do NOT start CPR — wrap and warm.',
      'Full hypothermia wrap with vapor barrier and external trunk heat.',
      'If pulseless/apneic and CPR is feasible, begin CPR and continue during evacuation.',
    ],
    medications: [],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate evac to ECMO/rewarming-capable facility; tell dispatch "severe hypothermia, possible cardiac arrest, warm before pronouncing."',
  },
  {
    id: 'hyperthermia-heat-exhaustion',
    name: 'Hyperthermia — Heat Exhaustion',
    category: 'environmental',
    stage: 'heat exhaustion',
    summary: 'Hot, heavy sweating, weak, but mentation intact.',
    keyFindings: [
      'Heavy sweating, pale, clammy skin',
      'Headache, nausea, weakness, dizziness',
      'Normal-to-mildly-altered but oriented mental status',
    ],
    redFlags: ['Confusion or collapse (suggests heat stroke)', 'Stops sweating'],
    treatment: [
      'Move to shade, remove excess clothing.',
      'Cool actively: wet skin + fanning, cold packs to neck/armpits/groin.',
      'Rehydrate orally with water and electrolytes if alert.',
      'Rest and continue cooling until symptoms resolve.',
    ],
    medications: [],
    evacuation: 'DELAYED',
    evacuationNote:
      'Usually field-treatable; evacuate if not improving or if mental status changes.',
  },
  {
    id: 'heat-stroke',
    name: 'Hyperthermia — Heat Stroke',
    category: 'environmental',
    stage: 'heat stroke',
    summary: 'Hot patient with ALTERED MENTAL STATUS — a true emergency.',
    keyFindings: [
      'Altered mental status (the defining sign): confusion, combativeness, seizure, coma',
      'Very hot skin (may be dry or sweaty)',
      'Tachycardia, hypotension',
    ],
    redFlags: ['Any altered mentation in a hot patient', 'Seizure', 'Unresponsive'],
    treatment: [
      'COOL IMMEDIATELY AND AGGRESSIVELY — cooling beats transport.',
      'Cold-water immersion if possible, or continuous wetting + fanning + ice packs.',
      'Target rapid temperature drop; stop active cooling near normal mentation.',
      'Protect the airway; do not force oral fluids in altered patients.',
      'Treat as load-and-go while cooling continues.',
    ],
    medications: [],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate evac, cool en route; tell dispatch "heat stroke, altered mental status, actively cooling."',
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    category: 'environmental',
    summary: 'Localized freezing of tissue, usually extremities or face.',
    keyFindings: [
      'Hard, waxy, white or grayish skin',
      'Numbness, then pain on rewarming',
      'Blisters (clear = better prognosis; blood-filled = worse)',
    ],
    redFlags: ['Hypothermia present (treat core first)', 'Risk of refreeze'],
    treatment: [
      'Treat any hypothermia FIRST — core before periphery.',
      'Do NOT rewarm if there is any chance the part will refreeze.',
      'If definitive warmth is assured: rapid rewarm in 37–39°C water until pliable.',
      'Do not rub the tissue or break blisters in the field.',
      'Ibuprofen for pain/inflammation; pad and protect the part for transport.',
    ],
    medications: ['ibuprofen', 'acetaminophen'],
    evacuation: 'URGENT',
    evacuationNote:
      'Deep frostbite needs specialist care; tell dispatch the affected part and whether rewarming has started.',
  },
  {
    id: 'altitude-ams',
    name: 'Altitude Illness — AMS',
    category: 'environmental',
    stage: 'AMS',
    summary: 'Acute Mountain Sickness: headache plus other symptoms after ascent.',
    keyFindings: [
      'Headache after recent ascent',
      'Nausea, fatigue, dizziness, poor sleep',
      'No ataxia and no severe dyspnea (would suggest HACE/HAPE)',
    ],
    redFlags: ['Ataxia (→ HACE)', 'Breathlessness at rest (→ HAPE)'],
    treatment: [
      'STOP ASCENT. Rest and hydrate at current altitude.',
      'Treat headache with ibuprofen or acetaminophen.',
      'Do not ascend until symptoms fully resolve.',
      'Descend if symptoms worsen or do not improve.',
    ],
    medications: ['ibuprofen', 'acetaminophen'],
    evacuation: 'DELAYED',
    evacuationNote: 'Descend if worsening; mild AMS often resolves with rest at altitude.',
  },
  {
    id: 'altitude-hape',
    name: 'Altitude Illness — HAPE',
    category: 'environmental',
    stage: 'HAPE',
    summary: 'High-Altitude Pulmonary Edema: fluid in the lungs at altitude.',
    keyFindings: [
      'Breathlessness at rest, decreased exercise tolerance',
      'Cough, possibly pink/frothy sputum',
      'Crackles, low SpO2 for altitude, cyanosis',
    ],
    redFlags: ['Dyspnea at rest', 'Cyanosis', 'Very low SpO2'],
    treatment: [
      'DESCEND immediately — descent is the definitive treatment.',
      'Keep the patient warm and minimize their exertion.',
      'Supplemental oxygen if available; portable hyperbaric bag as a bridge.',
      'Sit the patient upright if it eases breathing.',
    ],
    medications: [],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate descent/evac; tell dispatch "HAPE, suspected pulmonary edema, low SpO2, descending."',
  },
  {
    id: 'altitude-hace',
    name: 'Altitude Illness — HACE',
    category: 'environmental',
    stage: 'HACE',
    summary: 'High-Altitude Cerebral Edema: brain swelling at altitude. Life-threatening.',
    keyFindings: [
      'Ataxia (cannot walk heel-to-toe) — the hallmark',
      'Confusion, severe headache, vomiting',
      'Decreasing level of consciousness',
    ],
    redFlags: ['Ataxia', 'Altered mental status', 'Coma'],
    treatment: [
      'DESCEND immediately, even at night — do not wait for morning.',
      'Assist or carry the patient; they cannot safely walk alone.',
      'Supplemental oxygen and/or portable hyperbaric bag if available.',
      'Protect the airway in obtunded patients.',
    ],
    medications: [],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate descent/evac; tell dispatch "HACE, ataxia and altered mental status at altitude, descending."',
  },
  {
    id: 'drowning-submersion',
    name: 'Drowning / Submersion',
    category: 'environmental',
    summary: 'Respiratory impairment from submersion/immersion in liquid.',
    keyFindings: [
      'Recent submersion event',
      'Coughing, respiratory distress, or apnea',
      'Possible hypothermia and possible c-spine injury (diving)',
    ],
    redFlags: ['Apnea or cardiac arrest', 'Unconscious', 'Worsening respiratory distress'],
    treatment: [
      'Remove from water safely; protect the spine if diving/trauma is suspected.',
      'Open the airway; for arrest, prioritize rescue breaths/oxygenation.',
      'Begin CPR if pulseless/apneic (airway-and-breathing focused).',
      'Remove wet clothing and aggressively prevent hypothermia.',
      'All near-drowning patients need evaluation — delayed lung injury is possible.',
    ],
    medications: [],
    evacuation: 'URGENT',
    evacuationNote:
      'Even recovered patients need evaluation for delayed pulmonary injury; tell dispatch submersion time if known.',
  },
  {
    id: 'lightning-strike',
    name: 'Lightning Strike',
    category: 'environmental',
    summary: 'Electrical injury from lightning; reverse-triage the apparently dead first.',
    keyFindings: [
      'Cardiac/respiratory arrest is the main cause of death',
      'Confusion, amnesia, transient paralysis (keraunoparalysis)',
      'Ruptured eardrums, burns, possible blunt trauma from the blast',
    ],
    redFlags: ['Cardiac/respiratory arrest', 'Apnea with a pulse', 'Multiple victims'],
    treatment: [
      'Ensure scene safety — move to a low-risk location before treating.',
      'REVERSE TRIAGE: treat the apparently dead first (CPR can succeed here).',
      'For prolonged apnea with a pulse, support ventilations until breathing resumes.',
      'Assess for blunt trauma, spine injury, and burns.',
    ],
    medications: [],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate evac for any arrest or LOC; tell dispatch number of victims and any ongoing CPR.',
  },
  {
    id: 'lost-person-hypothermia',
    name: 'Lost-Person Hypothermia',
    category: 'environmental',
    summary: 'Overdue/lost subject found cold after prolonged exposure.',
    keyFindings: [
      'Prolonged unplanned exposure (hours), inadequate clothing',
      'Variable hypothermia stage on contact',
      'Often dehydrated, exhausted, possibly injured',
    ],
    redFlags: ['Shivering has stopped', 'Altered mental status', 'Undetectable pulse'],
    treatment: [
      'Assess hypothermia stage; handle gently if moderate/severe.',
      'Stop further heat loss immediately: shelter, insulate, vapor barrier.',
      'Warm sweet fluids only if reliably alert.',
      'Add external heat to the trunk; package for protected transport.',
      'Survey for occult injuries that contributed to becoming lost.',
    ],
    medications: ['oral glucose'],
    evacuation: 'URGENT',
    evacuationNote:
      'Match evac to hypothermia stage; tell dispatch exposure duration and current mental status.',
  },
  {
    id: 'avalanche-burial',
    name: 'Avalanche Burial Resuscitation',
    category: 'environmental',
    summary: 'Burial victim: asphyxia, trauma, and hypothermia combined.',
    keyFindings: [
      'Burial duration and presence of an air pocket drive prognosis',
      'Asphyxia is the leading cause of death',
      'Concurrent trauma and hypothermia are common',
    ],
    redFlags: ['Burial >35 min with no air pocket', 'Cardiac arrest', 'Obstructed airway on extrication'],
    treatment: [
      'Extricate the head/airway first and clear it of snow.',
      'Note burial time and whether an air pocket was present (drives the algorithm).',
      'If pulseless: short burial or air pocket present → start CPR.',
      'Treat aggressively for hypothermia; handle gently.',
      'Assess for traumatic injuries from the slide.',
    ],
    medications: [],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate evac; tell dispatch burial duration, air-pocket status, and whether CPR is in progress.',
  },

  // ── MEDICAL ────────────────────────────────────────────────────────
  {
    id: 'anaphylaxis',
    name: 'Anaphylaxis',
    category: 'medical',
    summary: 'Rapid systemic allergic reaction — airway/breathing/circulation threat.',
    keyFindings: [
      'Hives/flushing plus airway, breathing, or circulatory involvement',
      'Voice change, throat tightness, wheeze, stridor',
      'Hypotension, dizziness, sense of impending doom',
    ],
    redFlags: ['Any voice change or stridor', 'Wheeze/respiratory distress', 'Hypotension'],
    treatment: [
      'Give epinephrine via auto-injector to the lateral thigh IMMEDIATELY.',
      'Lay the patient flat (sitting up only if breathing is easier); legs raised if hypotensive.',
      'Give diphenhydramine as an adjunct once epinephrine is on board.',
      'Be ready to repeat epinephrine in 5–15 min if symptoms persist.',
      'Monitor airway continuously; reactions can rebound.',
    ],
    medications: ['epinephrine auto-injector', 'diphenhydramine'],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'Immediate evac after epinephrine; tell dispatch "anaphylaxis, epi given, may need more."',
  },
  {
    id: 'snake-bite',
    name: 'Snake Bite (Pit Viper)',
    category: 'medical',
    summary: 'Venomous bite with progressive local and possible systemic effects.',
    keyFindings: [
      'Paired puncture marks, progressive swelling/pain',
      'Bruising, blistering; possible numbness/tingling',
      'Systemic: nausea, metallic taste, bleeding, hypotension',
    ],
    redFlags: ['Rapidly progressing swelling', 'Systemic signs', 'Airway involvement (some species)'],
    treatment: [
      'Move away from the snake; keep the patient calm and still.',
      'Remove rings/watches/tight items before swelling progresses.',
      'Immobilize the limb and keep it at or slightly below heart level.',
      'Mark the leading edge of swelling with the time to track progression.',
      'Do NOT cut, suck, apply a tourniquet, ice, or electric shock. Antivenom is the definitive treatment.',
    ],
    medications: ['acetaminophen'],
    evacuation: 'URGENT',
    evacuationNote:
      'Needs antivenom; tell dispatch snake description, bite time, and swelling progression.',
  },
  {
    id: 'lost-person-medical',
    name: 'Found Subject — General Medical Survey',
    category: 'medical',
    summary: 'Systematic SAMPLE survey of a located subject who is not in extremis.',
    keyFindings: [
      'Dehydration, exhaustion, minor injuries common',
      'Pre-existing conditions may be involved (cardiac, diabetic)',
      'Mental status and ability to self-evacuate are key decisions',
    ],
    redFlags: ['Chest pain', 'Altered mental status', 'Unable to walk'],
    treatment: [
      'Full primary then secondary (SAMPLE) assessment.',
      'Rehydrate and feed simple carbohydrates if alert.',
      'Treat minor injuries; reassess perfusion and mentation.',
      'Decide walk-out vs assisted vs litter based on findings.',
    ],
    medications: ['oral glucose', 'ibuprofen', 'acetaminophen'],
    evacuation: 'DELAYED',
    evacuationNote:
      'Often a walk-out; escalate if vitals or mental status are abnormal.',
  },

  // ── TRAUMA ─────────────────────────────────────────────────────────
  {
    id: 'traumatic-injury-delayed-evac',
    name: 'Traumatic Injury with Delayed Evacuation',
    category: 'trauma',
    summary: 'Significant trauma where definitive care is hours or days away.',
    keyFindings: [
      'High-energy mechanism; potential for occult internal injury',
      'Pain, deformity, or instability of a limb or the pelvis',
      'Shock may develop over time',
    ],
    redFlags: ['Signs of shock', 'Suspected internal hemorrhage', 'Spinal mechanism'],
    treatment: [
      'Control major bleeding (direct pressure, then tourniquet for limbs).',
      'Stabilize the spine for concerning mechanisms; protect the airway.',
      'Splint fractures and check circulation/sensation/motion before and after.',
      'Keep warm, manage pain (ibuprofen/acetaminophen), reassess vitals on a schedule.',
      'Plan evacuation early; document a vitals trend for the receiving team.',
    ],
    medications: ['ibuprofen', 'acetaminophen', 'aspirin'],
    evacuation: 'URGENT',
    evacuationNote:
      'Match urgency to vitals trend; tell dispatch mechanism, suspected injuries, and trend.',
  },
  {
    id: 'fall-from-height',
    name: 'Fall from Height / Ground Fall',
    category: 'trauma',
    summary: 'Blunt multi-system trauma with spinal and long-bone/pelvis risk.',
    keyFindings: [
      'High-energy mechanism (the fall distance matters)',
      'Possible head, spine, pelvis, and long-bone injury',
      'Decreasing LOC or shock signal serious internal injury',
    ],
    redFlags: ['Altered LOC', 'Pelvic instability', 'Shock', 'Bilateral deficits'],
    treatment: [
      'Control bleeding and protect the airway with c-spine control.',
      'Stabilize the spine; do not move unnecessarily.',
      'Bind a suspected unstable pelvis with a wrap centered on the greater trochanters.',
      'Splint long-bone fractures; reassess distal pulses.',
      'Keep warm; treat for shock; package for litter or helicopter.',
    ],
    medications: ['acetaminophen'],
    evacuation: 'IMMEDIATE',
    evacuationNote:
      'High-mechanism trauma; tell dispatch fall height, GCS/AVPU, and suspected pelvis/femur injury.',
  },
];

/** Convenience lookups. */
export function getProtocolById(id: string): WildernessProtocol | undefined {
  return WILDERNESS_PROTOCOLS.find((p) => p.id === id);
}

export function getProtocolsByCategory(
  category: WildernessCategory
): WildernessProtocol[] {
  return WILDERNESS_PROTOCOLS.filter((p) => p.category === category);
}
