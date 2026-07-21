export const SYMPTOM_GROUPS = [
  {
    label: 'HEMORRHAGE',
    items: [
      { id: 'extremity_bleed',   label: 'Extremity bleeding',    icon: '🩸' },
      { id: 'junctional_bleed',  label: 'Neck / groin / armpit', icon: '🩸' },
      { id: 'heavy_bleeding',    label: 'Heavy bleeding (other)', icon: '🩸' },
      { id: 'abdominal_wound',   label: 'Abdominal wound',       icon: '🫀' },
    ],
  },
  {
    label: 'AIRWAY / BREATHING',
    items: [
      { id: 'unconscious',          label: 'Unconscious',              icon: '😶' },
      { id: 'airway_obstruction',   label: 'Airway obstruction',       icon: '🫁' },
      { id: 'gurgling',             label: 'Gurgling breath sounds',   icon: '🫁' },
      { id: 'snoring_breathing',    label: 'Snoring / noisy breathing',icon: '💤' },
      { id: 'sucking_chest_wound',  label: 'Sucking chest wound',      icon: '🫁' },
      { id: 'chest_wound',          label: 'Penetrating chest wound',  icon: '🫁' },
      { id: 'difficulty_breathing', label: 'Difficulty breathing',     icon: '😮‍💨' },
      { id: 'chest_pain',           label: 'Chest pain',               icon: '💢' },
    ],
  },
  {
    label: 'CIRCULATION / SHOCK',
    items: [
      { id: 'rapid_weak_pulse',     label: 'Rapid / weak pulse',       icon: '💓' },
      { id: 'pale_skin',            label: 'Pale / gray skin',         icon: '🫥' },
      { id: 'cool_clammy',          label: 'Cool / clammy skin',       icon: '🌡️' },
      { id: 'altered_mental_status',label: 'Altered mental status',    icon: '🧠' },
      { id: 'deviated_trachea',     label: 'Deviated trachea',         icon: '🫁' },
      { id: 'neck_vein_distention', label: 'Neck vein distention',     icon: '🩺' },
    ],
  },
  {
    label: 'HEAD / NEURO',
    items: [
      { id: 'head_injury',          label: 'Head injury / TBI',        icon: '🧠' },
      { id: 'loss_of_consciousness',label: 'Loss of consciousness',    icon: '😶' },
      { id: 'seizure',              label: 'Seizure',                  icon: '⚡' },
      { id: 'eye_injury',           label: 'Eye injury',               icon: '👁️' },
    ],
  },
  {
    label: 'THERMAL / ENVIRONMENT',
    items: [
      { id: 'burn',                 label: 'Burns',                    icon: '🔥' },
      { id: 'shivering',            label: 'Shivering / cold',         icon: '🥶' },
      { id: 'hypothermia',          label: 'Hypothermia (known)',       icon: '❄️' },
    ],
  },
];
