/**
 * MODE SELECT SCREEN
 * The entry point: pick SELF-AID, TEAMMATE, or STEALTH mode.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C } from '@/theme/index';
import { useSessionStore } from '@/store/sessionStore';
import type { Mode } from '@/store/sessionStore';

const MODES: Array<{
  id: Mode;
  label: string;
  sub: string;
  color: string;
  bg: string;
  icon: string;
}> = [
  {
    id: 'self',
    label: 'SELF-AID',
    sub: 'You are the patient',
    color: C.green,
    bg: C.greenBg,
    icon: '◎',
  },
  {
    id: 'teammate',
    label: 'TEAMMATE',
    sub: 'You are treating another person',
    color: C.blue,
    bg: C.blueBg,
    icon: '⊕',
  },
  {
    id: 'stealth',
    label: 'STEALTH',
    sub: 'No audio · Dim screen · Vibration only — night / avalanche zones',
    color: C.red,
    bg: C.redBg,
    icon: '◈',
  },
];

export default function IndexScreen() {
  const setMode = useSessionStore((s) => s.setMode);
  const resetSession = useSessionStore((s) => s.resetSession);
  const startSession = useSessionStore((s) => s.startSession);

  const handleSelect = (modeId: Mode) => {
    resetSession();
    setMode(modeId);
    startSession();
    router.push('/triage');
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.cross}>✚</Text>
        <Text style={s.title}>GHOST MEDIC</Text>
        <Text style={s.tagline}>
          Offline wilderness trauma assistant — when help is hours away.
        </Text>
        <Text style={s.protocol}>WMS · PATIENT ASSESSMENT SYSTEM</Text>
      </View>

      <View style={s.statusRow}>
        <StatusPill label="OFFLINE" color={C.green} />
        <StatusPill label="NO SIGNAL" color={C.green} />
        <StatusPill label="NO RF" color={C.green} />
        <StatusPill label="BATT" color={C.yellow} />
      </View>

      <Text style={s.selectLabel}>SELECT MODE</Text>

      <View style={s.modes}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[s.modeBtn, { borderColor: m.color, backgroundColor: m.bg }]}
            onPress={() => handleSelect(m.id)}
            activeOpacity={0.75}
          >
            <View style={s.modeBtnInner}>
              <Text style={[s.modeIcon, { color: m.color }]}>{m.icon}</Text>
              <View style={s.modeText}>
                <Text style={[s.modeName, { color: m.color }]}>{m.label}</Text>
                <Text style={s.modeSub}>{m.sub}</Text>
              </View>
              <Text style={[s.modeArrow, { color: m.color }]}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.disclaimer}>
        DECISION SUPPORT TOOL ONLY · NOT A SUBSTITUTE FOR MEDICAL TRAINING{'\n'}
        WILDERNESS MEDICAL SOCIETY · PATIENT ASSESSMENT SYSTEM
      </Text>
    </SafeAreaView>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[sp.pill, { borderColor: color }]}>
      <View style={[sp.dot, { backgroundColor: color }]} />
      <Text style={[sp.text, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
  },
  cross: {
    fontSize: 38,
    color: C.red,
    marginBottom: 6,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 10,
  },
  tagline: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  protocol: {
    fontSize: 10,
    color: C.dim,
    letterSpacing: 4,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    marginBottom: 28,
  },
  selectLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 14,
  },
  modes: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  modeBtn: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 18,
    minHeight: 56,
    justifyContent: 'center',
  },
  modeBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  modeIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  modeText: {
    flex: 1,
  },
  modeName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 3,
  },
  modeSub: {
    fontSize: 12,
    color: C.muted,
  },
  modeArrow: {
    fontSize: 24,
  },
  disclaimer: {
    textAlign: 'center',
    color: C.dim,
    fontSize: 9,
    letterSpacing: 1,
    lineHeight: 14,
    paddingBottom: 12,
    paddingTop: 8,
  },
});

const sp = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
