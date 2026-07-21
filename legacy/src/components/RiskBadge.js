import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RISK, MARCH_BADGE } from '../theme';

export function RiskBadge({ level }) {
  const r = RISK[level] || RISK.STABLE;
  return (
    <View style={[s.badge, { backgroundColor: r.bg, borderColor: r.color }]}>
      <Text style={[s.text, { color: r.color }]}>{r.label}</Text>
    </View>
  );
}

export function MarchBadge({ code }) {
  const b = MARCH_BADGE[code] || MARCH_BADGE['EVA'];
  return (
    <View style={[s.badge, { backgroundColor: b.bg, borderColor: b.color }]}>
      <Text style={[s.marchText, { color: b.color }]}>{b.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  marchText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
