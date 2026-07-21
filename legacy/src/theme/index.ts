// Military-grade color palette — dark, high-contrast, tactically clear
export const C = {
  bg:           '#0a0f0a',
  surface:      '#141A1B',
  surfaceHigh:  '#1C2426',
  border:       '#1E2C2E',

  green:     '#7cff6b',   // status / go signal (matches spec)
  greenBg:   '#052E16',
  yellow:    '#ffb547',   // caution
  yellowBg:  '#1C1000',
  red:       '#ff4d4d',   // critical alert (matches spec)
  redBg:     '#1F0000',
  blue:      '#60A5FA',
  blueBg:    '#0A1628',
  purple:    '#A78BFA',
  purpleBg:  '#1E1035',
  teal:      '#34D399',
  tealBg:    '#022C22',

  white:  '#FFFFFF',
  muted:  '#9aa090',     // dim text minimum per spec
  dim:    '#334155',
} as const;

export const RISK: Record<string, { color: string; bg: string; label: string }> = {
  EXTREME:  { color: '#ff4d4d', bg: '#2D0000', label: 'EXTREME'  },
  CRITICAL: { color: '#ff4d4d', bg: '#1F0000', label: 'CRITICAL' },
  HIGH:     { color: '#ffb547', bg: '#1C0F00', label: 'HIGH'     },
  MODERATE: { color: '#60A5FA', bg: '#0A1628', label: 'MODERATE' },
  STABLE:   { color: '#7cff6b', bg: '#052E16', label: 'STABLE'   },
};

export const MARCH_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  'CUF': { color: '#ff4d4d', bg: '#2D0000', label: 'UNDER FIRE'   },
  'M':   { color: '#ff4d4d', bg: '#1F0000', label: 'M'            },
  'A':   { color: '#ffb547', bg: '#1C0F00', label: 'A'            },
  'R':   { color: '#60A5FA', bg: '#0A1628', label: 'R'            },
  'C':   { color: '#A78BFA', bg: '#1E1035', label: 'C'            },
  'H':   { color: '#34D399', bg: '#022C22', label: 'H'            },
  'EVA': { color: '#9aa090', bg: '#1C2426', label: 'EVAC'         },
};
