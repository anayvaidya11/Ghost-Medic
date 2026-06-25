/**
 * SAR HANDOFF SCREEN
 * Auto-filled from session data. Ready to read aloud to the receiving
 * SAR team, wilderness EMT, or transporting crew.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { C } from '@/theme/index';
import { useSessionStore } from '@/store/sessionStore';
import { SessionHeader } from '@/components/SessionHeader';

function formatElapsed(start: number | null): string {
  if (!start) return 'UNKNOWN';
  const secs = Math.floor((Date.now() - start) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s ago`;
}

export default function HandoffScreen() {
  const insets = useSafeAreaInsets();
  const mode = useSessionStore((s) => s.mode);
  const mechanism = useSessionStore((s) => s.mechanism);
  const selectedSymptoms = useSessionStore((s) => s.selectedSymptoms);
  const vitals = useSessionStore((s) => s.vitals);
  const protocol = useSessionStore((s) => s.protocol);
  const sessionStartTime = useSessionStore((s) => s.sessionStartTime);
  const evacuationInitiatedAt = useSessionStore((s) => s.evacuationInitiatedAt);
  const audioTranscript = useSessionStore((s) => s.audioTranscript);

  const isSilent = mode === 'stealth';

  // Build SAR handoff fields from session data
  const M_mechanism = mechanism
    ? mechanism.toUpperCase()
    : 'UNKNOWN — describe to receiver';

  const I_findings = selectedSymptoms.length > 0
    ? selectedSymptoms.map((s) => s.replace(/_/g, ' ').toUpperCase()).join(', ')
    : 'NOT DOCUMENTED';

  const S_signs = [
    vitals.heartRate ? `HR ${vitals.heartRate}` : 'HR —',
    vitals.systolicBP ? `BP ${vitals.systolicBP}${vitals.diastolicBP ? `/${vitals.diastolicBP}` : ''}` : 'BP —',
    vitals.respiratoryRate ? `RR ${vitals.respiratoryRate}` : 'RR —',
    vitals.oxygenSat ? `SpO2 ${vitals.oxygenSat}%` : 'SpO2 —',
    vitals.avpu ? `LOC: ${vitals.avpu}` : 'LOC —',
  ].join(' | ');

  const T_treatment = [
    `TREATMENT STARTED: ${formatElapsed(sessionStartTime)}`,
    `ACTIONS: ${protocol.filter((p) => p.id !== 'mist').map((p) => p.action).join(', ') || 'NONE'}`,
    evacuationInitiatedAt
      ? `EVAC INITIATED: ${formatElapsed(evacuationInitiatedAt)}`
      : 'EVAC: not yet initiated',
    audioTranscript ? `VOICE NOTE: ${audioTranscript}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const containerStyle = [s.container, isSilent && s.silentOverlay];

  return (
    <SafeAreaView style={containerStyle}>
      <SessionHeader />

      {/* ALERT at top */}
      <View style={s.alertBanner}>
        <Text style={s.alertText}>⚠ STATE TIMES AND TREND VERBALLY TO THE RECEIVING TEAM</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>SAR HANDOFF</Text>

        <HandoffField
          letter="M"
          title="MECHANISM OF INJURY"
          content={M_mechanism}
          color={C.red}
        />
        <HandoffField
          letter="I"
          title="INJURIES / FINDINGS"
          content={I_findings}
          color={C.yellow}
        />
        <HandoffField
          letter="S"
          title="SIGNS / VITALS"
          content={S_signs}
          color={C.blue}
        />
        <HandoffField
          letter="T"
          title="TREATMENT / EVAC"
          content={T_treatment}
          color={C.green}
        />
      </ScrollView>

      {/* PRIMARY ACTION at bottom */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>✓ HANDOFF COMPLETE — END SESSION</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.back()}
        >
          <Text style={s.secondaryBtnText}>◀ BACK TO EVACUATION</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function HandoffField({
  letter,
  title,
  content,
  color,
}: {
  letter: string;
  title: string;
  content: string;
  color: string;
}) {
  return (
    <View style={[mf.card, { borderLeftColor: color }]}>
      <View style={mf.header}>
        <Text style={[mf.letter, { color }]}>{letter}</Text>
        <Text style={mf.title}>{title}</Text>
      </View>
      <Text style={mf.content}>{content}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  silentOverlay: { backgroundColor: '#030503' },
  alertBanner: {
    backgroundColor: '#2D0000',
    borderBottomWidth: 1,
    borderColor: C.red,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  alertText: {
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  scroll: { padding: 16, paddingBottom: 16 },
  title: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: C.green,
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: C.bg,
    letterSpacing: 2,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: C.dim,
    fontSize: 11,
    letterSpacing: 2,
  },
});

const mf = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  letter: {
    fontSize: 24,
    fontWeight: '900',
    width: 28,
  },
  title: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  content: {
    color: C.white,
    fontSize: 15,
    lineHeight: 22,
  },
});
