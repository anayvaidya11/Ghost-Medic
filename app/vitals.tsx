/**
 * VITALS SCREEN
 * Manual entry for HR, BP, RR, SpO2 + AVPU.
 * When biosensor is connected, manual fields are replaced by live readouts.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { C } from '@/theme/index';
import { useSessionStore } from '@/store/sessionStore';
import { AVPU } from '@/logic/tccc';
import { generateProtocol } from '@/logic/tccc';
import { useBiosensorVitals } from '@/services/biosensorService';
import VitalsBar from '@/components/VitalsBar';
import { SessionHeader } from '@/components/SessionHeader';

export default function VitalsScreen() {
  const sensorVitals = useBiosensorVitals();
  const setVitals = useSessionStore((s) => s.setVitals);
  const setProtocol = useSessionStore((s) => s.setProtocol);
  const underFire = useSessionStore((s) => s.underFire);
  const mechanism = useSessionStore((s) => s.mechanism);
  const selectedSymptoms = useSessionStore((s) => s.selectedSymptoms);
  const mode = useSessionStore((s) => s.mode);

  const [hr, setHr] = useState('');
  const [sbp, setSbp] = useState('');
  const [rr, setRr] = useState('');
  const [o2, setO2] = useState('');
  const [avpu, setAvpu] = useState<string | null>(null);

  const isSilent = mode === 'silent';
  const sensorConnected = sensorVitals.connected;

  const buildAndNavigate = () => {
    const vitalsObj = sensorConnected
      ? {
          heartRate: sensorVitals.hr,
          systolicBP: sensorVitals.bpSys,
          diastolicBP: sensorVitals.bpDia,
          respiratoryRate: sensorVitals.rr,
          oxygenSat: sensorVitals.spo2,
          skinTemp: sensorVitals.skinTemp,
          shockIndex: sensorVitals.shockIndex,
          avpu: avpu as 'A' | 'V' | 'P' | 'U' | null,
        }
      : {
          heartRate: hr ? parseInt(hr, 10) : null,
          systolicBP: sbp ? parseInt(sbp, 10) : null,
          diastolicBP: null,
          respiratoryRate: rr ? parseInt(rr, 10) : null,
          oxygenSat: o2 ? parseInt(o2, 10) : null,
          skinTemp: null,
          shockIndex: null,
          avpu: avpu as 'A' | 'V' | 'P' | 'U' | null,
        };

    setVitals(vitalsObj);

    const proto = generateProtocol({
      underFire,
      mechanism,
      symptoms: selectedSymptoms,
      vitals: vitalsObj,
      supplies: [
        'tourniquet',
        'hemostatic_gauze',
        'gauze',
        'pressure_bandage',
        'chest_seal',
        'needle_decompression',
        'npa',
        'iv_kit',
        'saline_fluids',
        'space_blanket',
        'tape',
        'scissors',
      ],
    });
    setProtocol(proto);
    router.push('/action');
  };

  const containerStyle = [s.container, isSilent && s.silentOverlay];

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, isSilent && s.silentOverlay]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={containerStyle}>
        <SessionHeader />
        <VitalsBar vitals={sensorVitals} />

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Sensor connected — show live readouts instead of manual fields */}
          {sensorConnected ? (
            <View style={s.liveWrap}>
              <View style={s.liveBadge}>
                <View style={[s.liveDot, { backgroundColor: C.green }]} />
                <Text style={s.liveLabel}>BIOSENSOR LIVE</Text>
              </View>
              <Text style={s.liveHint}>
                Vitals are being read automatically from the connected biosensor.{'\n'}
                Manual entry not required.
              </Text>
              <View style={s.liveGrid}>
                <LiveCell label="HEART RATE" value={`${sensorVitals.hr}`} unit="bpm"
                  warn={sensorVitals.hr > 100 || sensorVitals.hr < 50} />
                <LiveCell label="SYSTOLIC BP" value={`${sensorVitals.bpSys}`} unit="mmHg"
                  warn={sensorVitals.bpSys < 90} />
                <LiveCell label="RESP RATE" value={`${sensorVitals.rr}`} unit="/min"
                  warn={sensorVitals.rr > 20 || sensorVitals.rr < 8} />
                <LiveCell label="OXYGEN SAT" value={`${sensorVitals.spo2}`} unit="%"
                  warn={sensorVitals.spo2 < 94} />
              </View>
            </View>
          ) : (
            <View style={s.fieldsWrap}>
              <Text style={s.hint}>MANUAL ENTRY — NO SENSOR CONNECTED</Text>
              <VitalField
                label="HEART RATE" value={hr} set={setHr} unit="bpm" placeholder="72"
                warn={(v) => parseInt(v, 10) > 100 || parseInt(v, 10) < 50}
              />
              <VitalField
                label="SYSTOLIC BP" value={sbp} set={setSbp} unit="mmHg" placeholder="120"
                warn={(v) => parseInt(v, 10) < 90}
              />
              <VitalField
                label="RESP RATE" value={rr} set={setRr} unit="/min" placeholder="16"
                warn={(v) => parseInt(v, 10) > 20 || parseInt(v, 10) < 8}
              />
              <VitalField
                label="OXYGEN SAT" value={o2} set={setO2} unit="%" placeholder="98"
                warn={(v) => parseInt(v, 10) < 94}
              />
            </View>
          )}

          {/* AVPU — always shown */}
          <Text style={s.sectionLabel}>LEVEL OF CONSCIOUSNESS (AVPU)</Text>
          <View style={s.avpuRow}>
            {AVPU.map((a) => (
              <TouchableOpacity
                key={a.code}
                style={[s.avpuBtn, avpu === a.code && s.avpuActive]}
                onPress={() => setAvpu(avpu === a.code ? null : a.code)}
                activeOpacity={0.75}
              >
                <Text style={[s.avpuCode, avpu === a.code && s.avpuCodeActive]}>{a.code}</Text>
                <Text style={s.avpuLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {avpu && (
            <Text style={s.avpuDetail}>
              {AVPU.find((a) => a.code === avpu)?.detail}
            </Text>
          )}

        </ScrollView>

        {/* PRIMARY ACTION — bottom, full width */}
        <View style={s.footer}>
          <TouchableOpacity style={s.nextBtn} onPress={buildAndNavigate} activeOpacity={0.8}>
            <Text style={s.nextBtnText}>GENERATE PROTOCOL →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.skipBtn}
            onPress={() => {
              setVitals({});
              const proto = generateProtocol({
                underFire,
                mechanism,
                symptoms: selectedSymptoms,
                vitals: {},
                supplies: [
                  'tourniquet', 'hemostatic_gauze', 'gauze', 'pressure_bandage',
                  'chest_seal', 'needle_decompression', 'npa', 'iv_kit',
                  'saline_fluids', 'space_blanket', 'tape', 'scissors',
                ],
              });
              setProtocol(proto);
              router.push('/action');
            }}
          >
            <Text style={s.skipBtnText}>SKIP VITALS — TREAT NOW</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function VitalField({
  label, value, set, unit, placeholder, warn,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  unit: string;
  placeholder: string;
  warn: (v: string) => boolean;
}) {
  const isWarn = value.length > 0 && warn(value);
  return (
    <View style={vf.row}>
      <View style={vf.labelWrap}>
        <Text style={vf.label}>{label}</Text>
        <Text style={vf.unit}>{unit}</Text>
        {isWarn && (
          <View style={vf.warnBadge}>
            <Text style={vf.warnText}>!</Text>
          </View>
        )}
      </View>
      <TextInput
        style={[vf.input, isWarn && vf.inputWarn]}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType="numeric"
        value={value}
        onChangeText={set}
        maxLength={4}
      />
    </View>
  );
}

function LiveCell({
  label, value, unit, warn,
}: {
  label: string;
  value: string;
  unit: string;
  warn: boolean;
}) {
  const color = warn ? C.red : C.green;
  return (
    <View style={lc.cell}>
      <Text style={lc.label}>{label}</Text>
      <Text style={[lc.value, { color }]}>{value}</Text>
      <Text style={lc.unit}>{unit}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  silentOverlay: { backgroundColor: '#030503' },
  scroll: { padding: 16, paddingBottom: 16 },
  hint: {
    color: C.dim,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 16,
  },
  fieldsWrap: { gap: 10, marginBottom: 24 },

  liveWrap: { marginBottom: 24 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: {
    color: C.green,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  liveHint: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  liveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  sectionLabel: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 4,
    marginBottom: 12,
  },
  avpuRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  avpuBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    minHeight: 56,
    justifyContent: 'center',
  },
  avpuActive: {
    backgroundColor: C.yellowBg,
    borderColor: C.yellow,
  },
  avpuCode: {
    fontSize: 20,
    fontWeight: '900',
    color: C.muted,
  },
  avpuCodeActive: {
    color: C.yellow,
  },
  avpuLabel: {
    fontSize: 8,
    color: C.dim,
    letterSpacing: 1,
    textAlign: 'center',
  },
  avpuDetail: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    gap: 8,
  },
  nextBtn: {
    backgroundColor: C.green,
    borderRadius: 6,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.bg,
    letterSpacing: 2,
  },
  skipBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 11,
    color: C.dim,
    letterSpacing: 2,
  },
});

const vf = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    minHeight: 56,
  },
  labelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 2,
  },
  unit: { fontSize: 10, color: C.dim },
  warnBadge: {
    backgroundColor: C.red,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    color: C.white,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 80,
  },
  inputWarn: {
    borderColor: C.red,
    color: C.red,
  },
});

const lc = StyleSheet.create({
  cell: {
    width: '47.5%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  unit: {
    fontSize: 10,
    color: C.dim,
  },
});
