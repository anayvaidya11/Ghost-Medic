/**
 * EVACUATION DECISION SCREEN
 *
 * Sits between treatment (action) and the SAR handoff. It surfaces the
 * evacuation level Ghost Medic recommended, builds a read-aloud SAR dispatch
 * report, tracks time since the incident, and lets the responder log and lock
 * the moment evacuation is initiated.
 */
import React, { useEffect, useState } from 'react';
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
import {
  useSessionStore,
  selectActiveScenario,
} from '@/store/sessionStore';
import { SessionHeader } from '@/components/SessionHeader';
import {
  EVAC_PROFILES,
  parseEvacuationLevel,
  DISPATCH_FIELDS,
  type DispatchReport,
} from '@/data/protocols/evacuationDecisions';
import type { EvacuationLevel } from '@/data/protocols/wildernessProtocols';

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function EvacuationScreen() {
  const insets = useSafeAreaInsets();

  const aiResponse = useSessionStore((s) => s.aiResponse);
  const mechanism = useSessionStore((s) => s.mechanism);
  const selectedSymptoms = useSessionStore((s) => s.selectedSymptoms);
  const vitals = useSessionStore((s) => s.vitals);
  const sessionStartTime = useSessionStore((s) => s.sessionStartTime);
  const evacuationInitiatedAt = useSessionStore((s) => s.evacuationInitiatedAt);
  const markEvacuationInitiated = useSessionStore((s) => s.markEvacuationInitiated);
  const scenario = useSessionStore(selectActiveScenario);

  // Live timer since incident start
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!sessionStartTime) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  // Evacuation level recommended by the AI (fallback to URGENT if none parsed)
  const parsed = parseEvacuationLevel(aiResponse);
  const level: EvacuationLevel = parsed ?? 'URGENT';
  const profile = EVAC_PROFILES[level];
  const levelKnown = parsed !== null;

  const patient = scenario.patient;
  const v = vitals;

  // Pre-formatted SAR dispatch report (read-aloud)
  const report: DispatchReport = {
    location: '[ GPS / LAT-LONG HERE ] — describe trail, feature, or drainage',
    patient: `${patient.age} y/o ${patient.sex === 'M' ? 'male' : 'female'} — ${scenario.title}`,
    mechanism: (mechanism ?? patient.mechanism).toUpperCase(),
    primaryFindings:
      selectedSymptoms.length > 0
        ? selectedSymptoms.map((s) => s.replace(/_/g, ' ')).join(', ')
        : patient.injuries.map((i) => `${i.region}: ${i.type}`).join('; '),
    vitalsTrend: [
      v.heartRate ? `HR ${v.heartRate}` : `HR ${patient.vitals.hr}`,
      v.systolicBP
        ? `BP ${v.systolicBP}${v.diastolicBP ? `/${v.diastolicBP}` : ''}`
        : `BP ${patient.vitals.bpSys}/${patient.vitals.bpDia}`,
      v.respiratoryRate ? `RR ${v.respiratoryRate}` : `RR ${patient.vitals.rr}`,
      v.oxygenSat ? `SpO2 ${v.oxygenSat}%` : `SpO2 ${patient.vitals.spo2}%`,
      v.avpu ? `AVPU ${v.avpu}` : `AVPU ${patient.consciousness}`,
    ].join(' | '),
    evacRequest: `${level} — ${profile.disposition}, prefer ${profile.resources[0].replace(/-/g, ' ')}`,
    hazards: scenario.terrain ?? scenario.environment,
  };

  const locked = evacuationInitiatedAt !== null;
  const lockedSeconds = evacuationInitiatedAt
    ? Math.floor((evacuationInitiatedAt - (sessionStartTime ?? evacuationInitiatedAt)) / 1000)
    : 0;

  return (
    <SafeAreaView style={s.container}>
      <SessionHeader />

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.screenLabel}>EVACUATION DECISION</Text>

        {/* LEVEL CARD */}
        <View style={[s.levelCard, { borderColor: profile.color, backgroundColor: '#0d0d0d' }]}>
          <Text style={s.levelLabel}>
            {levelKnown ? 'RECOMMENDED LEVEL' : 'DEFAULT (run Ghost Medic for a recommendation)'}
          </Text>
          <Text style={[s.levelValue, { color: profile.color }]}>{level}</Text>
          <Text style={s.levelUrgency}>
            {profile.disposition} · {profile.urgency.toUpperCase()} · {profile.resources[0].replace(/-/g, ' ').toUpperCase()}
          </Text>
          <Text style={s.levelAction}>{profile.action}</Text>
        </View>

        {/* TIMER */}
        <View style={s.timerRow}>
          <Text style={s.timerLabel}>TIME SINCE INCIDENT START</Text>
          <Text style={[s.timerValue, { color: profile.color }]}>{formatClock(elapsed)}</Text>
        </View>

        {/* DISPATCH REPORT */}
        <Text style={s.sectionLabel}>SAR DISPATCH REPORT — READ ALOUD</Text>
        <View style={[s.reportCard, locked && s.reportCardLocked]}>
          {DISPATCH_FIELDS.map((f) => (
            <View key={f.key} style={s.reportRow}>
              <Text style={s.reportKey}>{f.label}</Text>
              <Text style={s.reportVal}>{report[f.key]}</Text>
            </View>
          ))}
          {locked && (
            <View style={s.lockBanner}>
              <Text style={s.lockBannerText}>
                🔒 LOCKED · EVAC INITIATED AT T+{formatClock(Math.max(0, lockedSeconds))}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* PRIMARY ACTION */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[s.initBtn, locked && s.initBtnLocked]}
          onPress={locked ? undefined : markEvacuationInitiated}
          activeOpacity={locked ? 1 : 0.85}
        >
          <Text style={[s.initBtnText, locked && s.initBtnTextLocked]}>
            {locked ? '✓ EVACUATION INITIATED — REPORT LOCKED' : 'MARK EVACUATION INITIATED'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.nextBtn} onPress={() => router.push('/handoff')}>
          <Text style={s.nextBtnText}>SAR HANDOFF ▶</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  screenLabel: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Level card
  levelCard: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center',
  },
  levelLabel: {
    color: C.dim,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  levelValue: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
  },
  levelUrgency: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 6,
    textAlign: 'center',
  },
  levelAction: {
    color: C.white,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },

  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  timerLabel: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 2,
  },
  timerValue: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },

  // Report
  sectionLabel: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 4,
    marginBottom: 10,
  },
  reportCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 14,
  },
  reportCardLocked: {
    borderColor: C.green,
    backgroundColor: C.greenBg,
  },
  reportRow: {
    marginBottom: 12,
  },
  reportKey: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 3,
  },
  reportVal: {
    color: C.white,
    fontSize: 15,
    lineHeight: 21,
  },
  lockBanner: {
    borderTopWidth: 1,
    borderColor: C.green,
    paddingTop: 10,
    marginTop: 2,
  },
  lockBannerText: {
    color: C.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    gap: 8,
  },
  initBtn: {
    backgroundColor: C.red,
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  initBtnLocked: {
    backgroundColor: C.greenBg,
    borderWidth: 1,
    borderColor: C.green,
  },
  initBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: C.white,
    letterSpacing: 2,
    textAlign: 'center',
  },
  initBtnTextLocked: {
    color: C.green,
  },
  nextBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  nextBtnText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
