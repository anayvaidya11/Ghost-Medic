import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export default function VitalsBar({ vitals }) {
  if (!vitals) return null;
  const { connected, heartRate, oxygenSat, systolicBP, skinTemp, shockIndex } = vitals;

  const hrColor   = heartRate  > 110 || heartRate  < 50  ? C.red : heartRate  > 90 ? C.yellow : C.green;
  const o2Color   = oxygenSat  < 90                      ? C.red : oxygenSat  < 94 ? C.yellow : C.green;
  const bpColor   = systolicBP < 90                      ? C.red : systolicBP < 100? C.yellow : C.green;
  const tmpColor  = skinTemp   < 35                      ? C.red : skinTemp   < 36 ? C.yellow : C.green;
  const shockFlag = shockIndex >= 1.0;

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <View style={s.connPill}>
          <View style={[s.dot, { backgroundColor: connected ? C.green : C.red }]} />
          <Text style={[s.connText, { color: connected ? C.green : C.red }]}>
            {connected ? 'BRACELET' : 'NO SENSOR'}
          </Text>
        </View>
        {shockFlag && (
          <View style={s.shockPill}>
            <Text style={s.shockText}>⚠ SHOCK INDEX {shockIndex}</Text>
          </View>
        )}
      </View>

      <View style={s.vitalsRow}>
        <Stat label="HR"   value={`${heartRate}`}          unit="bpm"  color={hrColor}  />
        <Stat label="SpO2" value={`${oxygenSat}`}          unit="%"    color={o2Color}  />
        <Stat label="sBP"  value={`${systolicBP}`}         unit="mmHg" color={bpColor}  />
        <Stat label="TEMP" value={`${skinTemp.toFixed(1)}`} unit="°C"   color={tmpColor} />
      </View>
    </View>
  );
}

function Stat({ label, value, unit, color }) {
  return (
    <View style={st.wrap}>
      <Text style={[st.value, { color }]}>
        {value}<Text style={st.unit}> {unit}</Text>
      </Text>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  shockPill: {
    backgroundColor: '#2D0000',
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  shockText: {
    color: C.red,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  vitalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

const st = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  unit: {
    fontSize: 10,
    fontWeight: '400',
  },
  label: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2,
    marginTop: 2,
  },
});
